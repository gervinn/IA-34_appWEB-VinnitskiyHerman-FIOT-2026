const express = require("express");
const router = express.Router();
const { User, Post } = require("../models");

// Створити користувача через ORM
router.post("/users", async (req, res) => {
  try {
    const { name, email, role } = req.body;

    const user = await User.create({
      name,
      email,
      role: role || "user",
    });

    res.json({
      message: "Користувача створено через Sequelize",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: "Помилка ORM User", error: error.message });
  }
});

// Отримати користувачів разом з постами
router.get("/users", async (req, res) => {
  try {
    const users = await User.findAll({
      include: {
        model: Post,
        as: "posts",
      },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Помилка ORM SELECT", error: error.message });
  }
});

// Створити пост
router.post("/posts", async (req, res) => {
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
    res.status(500).json({ message: "Помилка ORM Post", error: error.message });
  }
});

// Отримати пости з автором
router.get("/posts", async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: {
        model: User,
        as: "author",
      },
    });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Помилка ORM Posts", error: error.message });
  }
});

module.exports = router;