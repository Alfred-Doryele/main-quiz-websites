// MySQL adapter — implements the same shape as the MongoDB adapter so
// server.js never needs to know which database is actually running.
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

let pool;

async function init() {
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  await pool.query("SELECT 1"); // fail fast if the connection is bad
  console.log("Connected to MySQL");
}

async function getQuizzes() {
  const [quizRows] = await pool.query(
    `SELECT q.quiz_id, q.slug, q.title, q.description, q.minutes, q.round_size, q.book, q.testament, q.is_riddle, c.name AS tag
     FROM quizzes q LEFT JOIN categories c ON c.category_id = q.category_id`
  );

  const quizzes = [];
  for (const quiz of quizRows) {
    const [questionRows] = await pool.query(
      "SELECT question_id, question_text, position FROM questions WHERE quiz_id = ? ORDER BY position",
      [quiz.quiz_id]
    );
    const questions = [];
    for (const q of questionRows) {
      const [choiceRows] = await pool.query(
        "SELECT choice_text, is_correct FROM choices WHERE question_id = ?",
        [q.question_id]
      );
      questions.push({
        id: `q${q.question_id}`,
        text: q.question_text,
        options: choiceRows.map((c) => ({ t: c.choice_text, c: !!c.is_correct })),
      });
    }
    quizzes.push({
      slug: quiz.slug,
      tag: quiz.tag,
      title: quiz.title,
      description: quiz.description,
      minutes: quiz.minutes,
      round_size: quiz.round_size,
      book: quiz.book || undefined,
      testament: quiz.testament || undefined,
      is_riddle: !!quiz.is_riddle,
      questions,
    });
  }
  return quizzes;
}

async function saveAttempt({ username, quiz_slug, score, total }) {
  const [[user]] = await pool.query("SELECT user_id FROM users WHERE username = ?", [username]);
  const [[quiz]] = await pool.query("SELECT quiz_id FROM quizzes WHERE slug = ?", [quiz_slug]);
  if (!user || !quiz) throw new Error("Unknown user or quiz");

  await pool.query(
    "INSERT INTO attempts (user_id, quiz_id, score, total) VALUES (?, ?, ?, ?)",
    [user.user_id, quiz.quiz_id, score, total]
  );
}

async function registerUser({ username, email, password }) {
  const [[existing]] = await pool.query(
    "SELECT user_id FROM users WHERE username = ? OR email = ?",
    [username, email]
  );
  if (existing) throw new Error("Username or email already in use");

  const password_hash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    [username, email, password_hash]
  );
  return { username };
}

async function verifyLogin({ identifier, password }) {
  const [[user]] = await pool.query(
    "SELECT username, password_hash FROM users WHERE username = ? OR email = ?",
    [identifier, identifier]
  );
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? { username: user.username } : null;
}

async function createPasswordResetToken({ email }) {
  const [[user]] = await pool.query("SELECT user_id, username FROM users WHERE email = ?", [email]);
  if (!user) return null; // caller should still respond success-looking to avoid leaking which emails exist

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await pool.query("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?", [
    token,
    expires,
    user.user_id,
  ]);
  return { token, username: user.username };
}

async function resetPassword({ token, newPassword }) {
  const [[user]] = await pool.query(
    "SELECT user_id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()",
    [token]
  );
  if (!user) throw new Error("Reset link is invalid or has expired");

  const password_hash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE user_id = ?",
    [password_hash, user.user_id]
  );
}

async function getLeaderboard() {
  const [rows] = await pool.query(`
    SELECT u.username, q.title AS quiz_title, a.score, a.total,
           ROUND((a.score / a.total) * 100, 1) AS percentage, a.taken_at
    FROM attempts a
    JOIN users u ON u.user_id = a.user_id
    JOIN quizzes q ON q.quiz_id = a.quiz_id
    ORDER BY percentage DESC, a.taken_at ASC
    LIMIT 10
  `);
  return rows;
}

module.exports = { init, getQuizzes, saveAttempt, getLeaderboard, registerUser, verifyLogin, createPasswordResetToken, resetPassword };
