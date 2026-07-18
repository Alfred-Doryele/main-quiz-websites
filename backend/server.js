require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/quizzes", async (req, res) => {
  try {
    const quizzes = await db.getQuizzes();
    res.json(quizzes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load quizzes" });
  }
});

app.post("/api/attempts", async (req, res) => {
  try {
    const { username, quiz_slug, quiz_title, score, total } = req.body;
    if (!username || !quiz_slug || score == null || total == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    await db.saveAttempt({ username, quiz_slug, quiz_title, score, total });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save attempt" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const rows = await db.getLeaderboard();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

const PORT = process.env.PORT || 4000;

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Brainiac Quizzes API running on http://localhost:${PORT} (DB_TYPE=${process.env.DB_TYPE})`);
    });
  })
  .catch((err) => {
    console.error("Could not connect to the database:", err.message);
    process.exit(1);
  });
