require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const { sendResetEmail } = require("./mailer");
const presence = require("./presence");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- presence ("who's online") ---------------- */
app.post("/api/presence/ping", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "username is required" });
  presence.ping(username);
  res.json({ online: presence.getOnlineUsers() });
});

app.get("/api/presence/online", (req, res) => {
  res.json({ online: presence.getOnlineUsers() });
});

/* ---------------- live challenge rooms ---------------- */
app.post("/api/challenges", async (req, res) => {
  try {
    const { username, quiz_slug } = req.body;
    if (!username || !quiz_slug) return res.status(400).json({ error: "username and quiz_slug are required" });

    const quizzes = await db.getQuizzes();
    const quiz = quizzes.find((q) => q.slug === quiz_slug);
    if (!quiz) return res.status(404).json({ error: "Unknown quiz" });

    const room = presence.createRoom({ hostUsername: username, quiz });
    res.status(201).json(presence.serializeRoom(room));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create challenge" });
  }
});

app.post("/api/challenges/:code/join", (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "username is required" });
    const room = presence.joinRoom(req.params.code.toUpperCase(), username);
    res.json(presence.serializeRoom(room));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/challenges/:code", (req, res) => {
  const room = presence.rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: "No challenge found with that code" });
  // Only hand out the actual questions once the round has started, so
  // players in the waiting room can't peek at answers early.
  res.json(presence.serializeRoom(room, { includeQuestions: room.status !== "waiting" }));
});

app.post("/api/challenges/:code/start", (req, res) => {
  try {
    const { username } = req.body;
    const room = presence.startRoom(req.params.code.toUpperCase(), username);
    res.json(presence.serializeRoom(room, { includeQuestions: true }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/challenges/:code/finish", async (req, res) => {
  try {
    const { username, score, total } = req.body;
    if (!username || score == null || total == null) {
      return res.status(400).json({ error: "username, score, and total are required" });
    }
    const room = presence.finishRoom(req.params.code.toUpperCase(), username, score, total);

    // Also record it as a normal attempt, so a challenge result counts
    // toward the regular leaderboard too, not just the challenge's own
    // ranking.
    try {
      await db.saveAttempt({ username, quiz_slug: room.quizSlug, quiz_title: room.quizTitle, score, total });
    } catch (err) {
      console.warn("Challenge finished but could not also save as a regular attempt:", err.message);
    }

    res.json(presence.serializeRoom(room));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

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
