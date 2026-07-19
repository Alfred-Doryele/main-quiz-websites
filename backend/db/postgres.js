// PostgreSQL adapter — same shape as the MySQL and MongoDB adapters.
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

let pool;

async function init() {
  pool = new Pool({
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    port: process.env.PG_PORT,
  });
  await pool.query("SELECT 1");
  console.log("Connected to PostgreSQL");
}

async function getQuizzes() {
  const { rows: quizRows } = await pool.query(`
    SELECT q.quiz_id, q.slug, q.title, q.description, q.minutes, q.round_size, c.name AS tag
    FROM quizzes q LEFT JOIN categories c ON c.category_id = q.category_id
  `);

  const quizzes = [];
  for (const quiz of quizRows) {
    const { rows: questionRows } = await pool.query(
      "SELECT question_id, question_text FROM questions WHERE quiz_id = $1 ORDER BY position",
      [quiz.quiz_id]
    );
    const questions = [];
    for (const q of questionRows) {
      const { rows: choiceRows } = await pool.query(
        "SELECT choice_text, is_correct FROM choices WHERE question_id = $1",
        [q.question_id]
      );
      questions.push({
        id: `q${q.question_id}`,
        text: q.question_text,
        options: choiceRows.map((c) => ({ t: c.choice_text, c: c.is_correct })),
      });
    }
    quizzes.push({
      slug: quiz.slug,
      tag: quiz.tag,
      title: quiz.title,
      description: quiz.description,
      minutes: quiz.minutes,
      round_size: quiz.round_size,
      questions,
    });
  }
  return quizzes;
}

async function saveAttempt({ username, quiz_slug, score, total }) {
  const { rows: [user] } = await pool.query("SELECT user_id FROM users WHERE username = $1", [username]);
  const { rows: [quiz] } = await pool.query("SELECT quiz_id FROM quizzes WHERE slug = $1", [quiz_slug]);
  if (!user || !quiz) throw new Error("Unknown user or quiz");

  await pool.query(
    "INSERT INTO attempts (user_id, quiz_id, score, total) VALUES ($1, $2, $3, $4)",
    [user.user_id, quiz.quiz_id, score, total]
  );
}

async function registerUser({ username, email, password }) {
  const { rows: [existing] } = await pool.query(
    "SELECT user_id FROM users WHERE username = $1 OR email = $2",
    [username, email]
  );
  if (existing) throw new Error("Username or email already in use");

  const password_hash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
    [username, email, password_hash]
  );
  return { username };
}

async function verifyLogin({ identifier, password }) {
  const { rows: [user] } = await pool.query(
    "SELECT username, password_hash FROM users WHERE username = $1 OR email = $1",
    [identifier]
  );
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? { username: user.username } : null;
}

async function createPasswordResetToken({ email }) {
  const { rows: [user] } = await pool.query("SELECT user_id, username FROM users WHERE email = $1", [email]);
  if (!user) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await pool.query("UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE user_id = $3", [
    token,
    expires,
    user.user_id,
  ]);
  return { token, username: user.username };
}

async function resetPassword({ token, newPassword }) {
  const { rows: [user] } = await pool.query(
    "SELECT user_id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
    [token]
  );
  if (!user) throw new Error("Reset link is invalid or has expired");

  const password_hash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2",
    [password_hash, user.user_id]
  );
}

async function getLeaderboard() {
  const { rows } = await pool.query("SELECT * FROM leaderboard LIMIT 10");
  return rows;
}

module.exports = { init, getQuizzes, saveAttempt, getLeaderboard, registerUser, verifyLogin, createPasswordResetToken, resetPassword };
