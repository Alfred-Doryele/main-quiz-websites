require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const { sendResetEmail } = require("./mailer");

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

app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password || password.length < 6) {
      return res.status(400).json({ error: "Username, email, and a password of at least 6 characters are required" });
    }
    const user = await db.registerUser({ username, email, password });
    res.status(201).json(user);
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: "Username/email and password are required" });
    }
    const user = await db.verifyLogin({ identifier, password });
    if (!user) return res.status(401).json({ error: "Incorrect username/email or password" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const result = await db.createPasswordResetToken({ email });
    if (result) {
      await sendResetEmail({ to: email, username: result.username, token: result.token });
    }
    // Always respond success, whether or not the email exists — this avoids
    // revealing which emails are registered to whoever is asking.
    res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not process the request" });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "A valid token and a password of at least 6 characters are required" });
    }
    await db.resetPassword({ token, newPassword });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
