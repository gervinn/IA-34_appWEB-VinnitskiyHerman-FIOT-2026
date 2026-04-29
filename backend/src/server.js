const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const sequelize = require("./config/sequelize");
const { User, Post } = require("./models");
const pool = require("./config/mysql2");

const app = express();

app.use(cors());
app.use(express.json());

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET || "macshnaknels_secret_key",
    {
      expiresIn: "24h",
    }
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Немає токена авторизації" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "macshnaknels_secret_key"
    );

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Недійсний або прострочений токен" });
  }
}

function isAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Доступ дозволено лише адміністратору" });
  }

  next();
}

app.get("/", (req, res) => {
  res.json({
    message: "MacShnaknels backend працює",
  });
});

// Реєстрація
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Заповніть усі поля" });
    }

    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      return res.status(409).json({
        message: "Користувач з таким email вже існує",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
    });

    res.status(201).json({
      message: "Реєстрація успішна",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Помилка реєстрації",
      error: error.message,
    });
  }
});

// Вхід
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Введіть email і пароль" });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Неправильний пароль" });
    }

    const token = createToken(user);

    res.json({
      message: "Вхід виконано успішно",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Помилка входу",
      error: error.message,
    });
  }
});

// Перевірка поточного користувача
app.get("/api/auth/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "name", "email", "role"],
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({
      message: "Помилка отримання користувача",
      error: error.message,
    });
  }
});

// SELECT через mysql2
app.get("/api/raw/users", async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT id, name, email, role, created_at FROM users"
    );

    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: "Помилка SELECT",
      error: error.message,
    });
  }
});

// INSERT через mysql2
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
    res.status(500).json({
      message: "Помилка INSERT",
      error: error.message,
    });
  }
});

// UPDATE через mysql2
app.put("/api/raw/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    await pool.query(
      "UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?",
      [name, email, role, id]
    );

    res.json({ message: "Користувача оновлено через mysql2" });
  } catch (error) {
    res.status(500).json({
      message: "Помилка UPDATE",
      error: error.message,
    });
  }
});

// DELETE через mysql2
app.delete("/api/raw/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM users WHERE id = ?", [id]);

    res.json({ message: "Користувача видалено через mysql2" });
  } catch (error) {
    res.status(500).json({
      message: "Помилка DELETE",
      error: error.message,
    });
  }
});

// ORM User
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
    res.status(500).json({
      message: "Помилка Sequelize User",
      error: error.message,
    });
  }
});

// ORM Post
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
    res.status(500).json({
      message: "Помилка Sequelize Post",
      error: error.message,
    });
  }
});

// One-to-Many
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
    res.status(500).json({
      message: "Помилка зв'язку One-to-Many",
      error: error.message,
    });
  }
});

// ADMIN: отримати всіх користувачів
app.get("/api/admin/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "name", "email", "role"],
      order: [["id", "ASC"]],
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: "Помилка отримання користувачів",
      error: error.message,
    });
  }
});

// ADMIN: змінити роль користувача
app.patch("/api/admin/users/:id/role", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Неправильна роль" });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
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
    res.status(500).json({
      message: "Помилка оновлення ролі",
      error: error.message,
    });
  }
});

// ADMIN: видалити користувача
app.delete("/api/admin/users/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({
        message: "Не можна видалити власний акаунт",
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    await user.destroy();

    res.json({ message: "Користувача видалено" });
  } catch (error) {
    res.status(500).json({
      message: "Помилка видалення користувача",
      error: error.message,
    });
  }
});

// ADMIN: отримати всі пости
app.get("/api/admin/posts", verifyToken, isAdmin, async (req, res) => {
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
    res.status(500).json({
      message: "Помилка отримання постів",
      error: error.message,
    });
  }
});

// ADMIN: створити пост
app.post("/api/admin/posts", verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "Заповніть назву і текст" });
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
    res.status(500).json({
      message: "Помилка створення поста",
      error: error.message,
    });
  }
});

// ADMIN: редагувати пост
app.put("/api/admin/posts/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const post = await Post.findByPk(id);

    if (!post) {
      return res.status(404).json({ message: "Пост не знайдено" });
    }

    post.title = title;
    post.content = content;
    await post.save();

    res.json({
      message: "Пост оновлено",
      post,
    });
  } catch (error) {
    res.status(500).json({
      message: "Помилка оновлення поста",
      error: error.message,
    });
  }
});

// ADMIN: видалити пост
app.delete("/api/admin/posts/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findByPk(id);

    if (!post) {
      return res.status(404).json({ message: "Пост не знайдено" });
    }

    await post.destroy();

    res.json({ message: "Пост видалено" });
  } catch (error) {
    res.status(500).json({
      message: "Помилка видалення поста",
      error: error.message,
    });
  }
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