const express = require("express");
const router = express.Router();
const pool = require("../config/mysql2");

// SELECT
router.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Помилка SELECT", error: error.message });
  }
});

// INSERT
router.post("/users", async (req, res) => {
  try {
    const { name, email, role } = req.body;

    const [result] = await pool.query(
      "INSERT INTO users (name, email, role) VALUES (?, ?, ?)",
      [name, email, role || "user"]
    );

    res.json({
      message: "Користувача додано",
      userId: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ message: "Помилка INSERT", error: error.message });
  }
});

// UPDATE
router.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    await pool.query(
      "UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?",
      [name, email, role, id]
    );

    res.json({ message: "Користувача оновлено" });
  } catch (error) {
    res.status(500).json({ message: "Помилка UPDATE", error: error.message });
  }
});

// DELETE
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM users WHERE id = ?", [id]);

    res.json({ message: "Користувача видалено" });
  } catch (error) {
    res.status(500).json({ message: "Помилка DELETE", error: error.message });
  }
});

module.exports = router;