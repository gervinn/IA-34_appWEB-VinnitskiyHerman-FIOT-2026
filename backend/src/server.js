const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const morgan = require("morgan");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { body, validationResult } = require("express-validator");
require("dotenv").config();

const sequelize = require("./config/sequelize");
const { User, Post } = require("./models");
const pool = require("./config/mysql2");

const app = express();

app.use(cors());
app.use(express.json());
app.use(passport.initialize());

const logsDir = path.join(__dirname, "../logs");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const accessLogStream = fs.createWriteStream(path.join(logsDir, "access.log"), {
  flags: "a",
});

app.use(morgan("combined", { stream: accessLogStream }));
app.use(morgan("dev"));

function logError(error, req) {
  const message = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${error.message}\n`;
  fs.appendFileSync(path.join(logsDir, "errors.log"), message);
}

function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.ACCESS_TOKEN_SECRET || "macshnaknels_access_secret",
    {
      expiresIn: "15m",
    }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.REFRESH_TOKEN_SECRET || "macshnaknels_refresh_secret",
    {
      expiresIn: "7d",
    }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Немає токена авторизації",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Токен не передано",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET || "macshnaknels_access_secret"
    );

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Недійсний або прострочений access token",
    });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Доступ дозволено лише адміністратору",
    });
  }

  next();
}

function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Помилка валідації даних",
      errors: errors.array(),
    });
  }

  next();
}

async function sendMail(to, subject, text) {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.log("Email не відправлено, бо SMTP не налаштований.");
    console.log("Кому:", to);
    console.log("Тема:", subject);
    console.log("Текст:", text);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Забагато спроб входу. Спробуйте пізніше.",
  },
});

const googleConfigured =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

if (googleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:3000/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName || "Google User";

          if (!email) {
            return done(null, false, {
              message: "Google акаунт не містить email",
            });
          }

          let user = await User.findOne({
            where: { email },
          });

          if (!user) {
            const randomPassword = crypto.randomBytes(16).toString("hex");
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = await User.create({
              name,
              email,
              password: hashedPassword,
              role: "user",
              googleId: profile.id,
              emailConfirmed: true,
            });
          } else if (!user.googleId) {
            user.googleId = profile.id;
            user.emailConfirmed = true;
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}

app.get("/", (req, res) => {
  res.json({
    message: "MacShnaknels REST API працює",
  });
});

/*
|--------------------------------------------------------------------------
| AUTH ROUTES
|--------------------------------------------------------------------------
*/

app.post(
  "/api/auth/register",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Ім’я є обов’язковим")
      .isLength({ min: 2 })
      .withMessage("Ім’я має містити мінімум 2 символи"),

    body("email")
      .trim()
      .isEmail()
      .withMessage("Некоректний формат email")
      .normalizeEmail(),

    body("password")
      .isLength({ min: 6 })
      .withMessage("Пароль має містити мінімум 6 символів"),

    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Паролі не збігаються");
      }

      return true;
    }),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      const existingUser = await User.findOne({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({
          message: "Користувач з таким email вже існує",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const emailConfirmToken = crypto.randomBytes(32).toString("hex");

      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "user",
        emailConfirmed: false,
        emailConfirmToken,
      });

      const confirmLink = `http://localhost:3000/api/auth/confirm-email/${emailConfirmToken}`;

      await sendMail(
        email,
        "Підтвердження email MacShnaknels",
        `Для підтвердження email перейдіть за посиланням: ${confirmLink}`
      );

      res.status(201).json({
        message: "Реєстрація успішна. Підтвердіть email.",
        confirmLink,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailConfirmed: user.emailConfirmed,
        },
      });
    } catch (error) {
      logError(error, req);

      res.status(500).json({
        message: "Помилка реєстрації",
        error: error.message,
      });
    }
  }
);

app.post(
  "/api/auth/login",
  loginLimiter,
  [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Некоректний формат email")
      .normalizeEmail(),

    body("password")
      .notEmpty()
      .withMessage("Пароль є обов’язковим"),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({
        where: { email },
      });

      if (!user) {
        return res.status(404).json({
          message: "Користувача не знайдено",
        });
      }

      if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
        return res.status(429).json({
          message: "Акаунт тимчасово заблоковано через велику кількість невдалих спроб входу",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        user.loginAttempts = (user.loginAttempts || 0) + 1;

        if (user.loginAttempts >= 5) {
          user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        }

        await user.save();

        return res.status(401).json({
          message: "Неправильний пароль",
          attempts: user.loginAttempts,
        });
      }

      user.loginAttempts = 0;
      user.lockUntil = null;

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      user.refreshToken = refreshToken;
      await user.save();

      res.json({
        message: "Вхід виконано успішно",
        token: accessToken,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailConfirmed: user.emailConfirmed,
        },
      });
    } catch (error) {
      logError(error, req);

      res.status(500).json({
        message: "Помилка входу",
        error: error.message,
      });
    }
  }
);

app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        message: "Refresh token не передано",
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET || "macshnaknels_refresh_secret"
    );

    const user = await User.findByPk(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        message: "Недійсний refresh token",
      });
    }

    const accessToken = generateAccessToken(user);

    res.json({
      message: "Access token оновлено",
      accessToken,
      token: accessToken,
    });
  } catch (error) {
    logError(error, req);

    res.status(401).json({
      message: "Refresh token недійсний або прострочений",
      error: error.message,
    });
  }
});

app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    res.json({
      message: "Вихід виконано успішно",
    });
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка logout",
      error: error.message,
    });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "name", "email", "role", "emailConfirmed"],
    });

    if (!user) {
      return res.status(404).json({
        message: "Користувача не знайдено",
      });
    }

    res.json(user);
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка отримання профілю",
      error: error.message,
    });
  }
});

app.put(
  "/api/auth/profile",
  authMiddleware,
  [
    body("name")
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage("Ім’я має містити мінімум 2 символи"),

    body("email")
      .optional()
      .trim()
      .isEmail()
      .withMessage("Некоректний email")
      .normalizeEmail(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, email } = req.body;

      const user = await User.findByPk(req.user.id);

      if (!user) {
        return res.status(404).json({
          message: "Користувача не знайдено",
        });
      }

      if (email && email !== user.email) {
        const existingUser = await User.findOne({
          where: { email },
        });

        if (existingUser) {
          return res.status(409).json({
            message: "Цей email вже використовується",
          });
        }

        user.email = email;
        user.emailConfirmed = false;
        user.emailConfirmToken = crypto.randomBytes(32).toString("hex");
      }

      if (name) {
        user.name = name;
      }

      await user.save();

      res.json({
        message: "Профіль оновлено",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailConfirmed: user.emailConfirmed,
        },
      });
    } catch (error) {
      logError(error, req);

      res.status(500).json({
        message: "Помилка оновлення профілю",
        error: error.message,
      });
    }
  }
);

app.put(
  "/api/auth/change-password",
  authMiddleware,
  [
    body("oldPassword")
      .notEmpty()
      .withMessage("Старий пароль є обов’язковим"),

    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Новий пароль має містити мінімум 6 символів"),

    body("confirmNewPassword").custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Нові паролі не збігаються");
      }

      return true;
    }),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;

      const user = await User.findByPk(req.user.id);

      if (!user) {
        return res.status(404).json({
          message: "Користувача не знайдено",
        });
      }

      const isOldPasswordValid = await bcrypt.compare(
        oldPassword,
        user.password
      );

      if (!isOldPasswordValid) {
        return res.status(401).json({
          message: "Старий пароль неправильний",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.json({
        message: "Пароль успішно змінено",
      });
    } catch (error) {
      logError(error, req);

      res.status(500).json({
        message: "Помилка зміни пароля",
        error: error.message,
      });
    }
  }
);

app.delete("/api/auth/delete-account", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "Користувача не знайдено",
      });
    }

    await user.destroy();

    res.json({
      message: "Акаунт користувача видалено",
    });
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка видалення акаунта",
      error: error.message,
    });
  }
});

app.post(
  "/api/auth/forgot-password",
  [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Некоректний email")
      .normalizeEmail(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({
        where: { email },
      });

      if (!user) {
        return res.json({
          message: "Якщо email існує, інструкцію для відновлення буде створено",
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);

      await user.save();

      const resetText = `Токен для відновлення пароля: ${resetToken}`;

      await sendMail(email, "Відновлення пароля MacShnaknels", resetText);

      res.json({
        message: "Токен відновлення пароля створено",
        resetToken,
      });
    } catch (error) {
      logError(error, req);

      res.status(500).json({
        message: "Помилка відновлення пароля",
        error: error.message,
      });
    }
  }
);

app.post(
  "/api/auth/reset-password",
  [
    body("token")
      .notEmpty()
      .withMessage("Токен відновлення є обов’язковим"),

    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Новий пароль має містити мінімум 6 символів"),

    body("confirmNewPassword").custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Нові паролі не збігаються");
      }

      return true;
    }),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      const user = await User.findOne({
        where: {
          resetPasswordToken: token,
        },
      });

      if (!user) {
        return res.status(400).json({
          message: "Недійсний токен відновлення",
        });
      }

      if (
        !user.resetPasswordExpires ||
        new Date(user.resetPasswordExpires) < new Date()
      ) {
        return res.status(400).json({
          message: "Токен відновлення прострочений",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;

      await user.save();

      res.json({
        message: "Пароль успішно відновлено",
      });
    } catch (error) {
      logError(error, req);

      res.status(500).json({
        message: "Помилка скидання пароля",
        error: error.message,
      });
    }
  }
);

app.get("/api/auth/confirm-email/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      where: {
        emailConfirmToken: token,
      },
    });

    if (!user) {
      return res.status(400).json({
        message: "Недійсний токен підтвердження email",
      });
    }

    user.emailConfirmed = true;
    user.emailConfirmToken = null;

    await user.save();

    res.json({
      message: "Email успішно підтверджено",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailConfirmed: user.emailConfirmed,
      },
    });
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка підтвердження email",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| GOOGLE OAUTH
|--------------------------------------------------------------------------
*/

app.get("/api/auth/google", (req, res, next) => {
  if (!googleConfigured) {
    return res.status(501).json({
      message:
        "Google OAuth не налаштовано. Додайте GOOGLE_CLIENT_ID і GOOGLE_CLIENT_SECRET у .env",
    });
  }

  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })(req, res, next);
});

app.get("/api/auth/google/callback", (req, res, next) => {
  if (!googleConfigured) {
    return res.status(501).json({
      message:
        "Google OAuth не налаштовано. Додайте GOOGLE_CLIENT_ID і GOOGLE_CLIENT_SECRET у .env",
    });
  }

  passport.authenticate(
    "google",
    {
      session: false,
      failureRedirect: `${process.env.CLIENT_URL}/login.html`,
    },
    async (error, user) => {
      if (error || !user) {
        return res.redirect(`${process.env.CLIENT_URL}/login.html`);
      }

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      user.refreshToken = refreshToken;
      await user.save();

      return res.redirect(
        `${process.env.CLIENT_URL}/login.html?oauth=success&accessToken=${accessToken}&refreshToken=${refreshToken}`
      );
    }
  )(req, res, next);
});

/*
|--------------------------------------------------------------------------
| RAW SQL ROUTES THROUGH mysql2
|--------------------------------------------------------------------------
*/

app.get("/api/raw/users", async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT id, name, email, role, emailConfirmed FROM users"
    );

    res.json(users);
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка SELECT",
      error: error.message,
    });
  }
});

app.post("/api/raw/users", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, role || "user"]
    );

    res.json({
      message: "Користувача додано через mysql2",
      userId: result.insertId,
    });
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка INSERT",
      error: error.message,
    });
  }
});

app.put("/api/raw/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    await pool.query(
      "UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?",
      [name, email, role, id]
    );

    res.json({
      message: "Користувача оновлено через mysql2",
    });
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка UPDATE",
      error: error.message,
    });
  }
});

app.delete("/api/raw/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM users WHERE id = ?", [id]);

    res.json({
      message: "Користувача видалено через mysql2",
    });
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка DELETE",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| ORM ROUTES THROUGH Sequelize
|--------------------------------------------------------------------------
*/

app.post("/api/orm/users", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "user",
    });

    res.json({
      message: "Користувача створено через Sequelize",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка Sequelize User",
      error: error.message,
    });
  }
});

app.post("/api/orm/posts", async (req, res) => {
  try {
    const { title, content, user_id } = req.body;

    const post = await Post.create({
      title,
      content,
      user_id,
    });

    res.json({
      message: "Пост створено через Sequelize",
      post,
    });
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка Sequelize Post",
      error: error.message,
    });
  }
});

app.get("/api/orm/users-with-posts", async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "name", "email", "role"],
      include: {
        model: Post,
        as: "posts",
      },
    });

    res.json(users);
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка зв'язку One-to-Many",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| ADMIN ROUTES
|--------------------------------------------------------------------------
*/

app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "name", "email", "role", "emailConfirmed"],
      order: [["id", "ASC"]],
    });

    res.json(users);
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка отримання користувачів",
      error: error.message,
    });
  }
});

app.patch(
  "/api/admin/users/:id/role",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({
          message: "Неправильна роль",
        });
      }

      const user = await User.findByPk(id);

      if (!user) {
        return res.status(404).json({
          message: "Користувача не знайдено",
        });
      }

      user.role = role;
      await user.save();

      res.json({
        message: "Роль користувача оновлено",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      logError(error, req);

      res.status(500).json({
        message: "Помилка оновлення ролі",
        error: error.message,
      });
    }
  }
);

app.delete(
  "/api/admin/users/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (Number(id) === Number(req.user.id)) {
        return res.status(400).json({
          message: "Не можна видалити власний акаунт",
        });
      }

      const user = await User.findByPk(id);

      if (!user) {
        return res.status(404).json({
          message: "Користувача не знайдено",
        });
      }

      await user.destroy();

      res.json({
        message: "Користувача видалено",
      });
    } catch (error) {
      logError(error, req);

      res.status(500).json({
        message: "Помилка видалення користувача",
        error: error.message,
      });
    }
  }
);

app.get("/api/admin/posts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: {
        model: User,
        as: "author",
        attributes: ["id", "name", "email"],
      },
      order: [["id", "DESC"]],
    });

    res.json(posts);
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка отримання постів",
      error: error.message,
    });
  }
});

app.post("/api/admin/posts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        message: "Заповніть назву і текст",
      });
    }

    const post = await Post.create({
      title,
      content,
      user_id: req.user.id,
    });

    res.status(201).json({
      message: "Пост створено",
      post,
    });
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      message: "Помилка створення поста",
      error: error.message,
    });
  }
});

app.put(
  "/api/admin/posts/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content } = req.body;

      const post = await Post.findByPk(id);

      if (!post) {
        return res.status(404).json({
          message: "Пост не знайдено",
        });
      }

      post.title = title;
      post.content = content;

      await post.save();

      res.json({
        message: "Пост оновлено",
        post,
      });
    } catch (error) {
      logError(error, req);

      res.status(500).json({
        message: "Помилка оновлення поста",
        error: error.message,
      });
    }
  }
);

app.delete(
  "/api/admin/posts/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findByPk(id);

      if (!post) {
        return res.status(404).json({
          message: "Пост не знайдено",
        });
      }

      await post.destroy();

      res.json({
        message: "Пост видалено",
      });
    } catch (error) {
      logError(error, req);

      res.status(500).json({
        message: "Помилка видалення поста",
        error: error.message,
      });
    }
  }
);

app.use((error, req, res, next) => {
  logError(error, req);

  res.status(500).json({
    message: "Внутрішня помилка сервера",
    error: error.message,
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    console.log("Підключення до MySQL через Sequelize успішне");

    app.listen(PORT, () => {
      console.log(`Сервер працює на http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Помилка запуску сервера:", error.message);
  }
}

startServer();