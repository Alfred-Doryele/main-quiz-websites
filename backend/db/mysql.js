// MySQL adapter — implements the same shape as the MongoDB adapter so
// server.js never needs to know which database is actually running.
const mysql = require("mysql2/promise");

let pool;

async function init() {
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });
  await pool.query("SELECT 1"); // fail fast if the connection is bad
  console.log("Connected to MySQL");
}

async function getQuizzes() {
  const [quizRows] = await pool.query(
    `SELECT q.quiz_id, q.slug, q.title, q.description, q.minutes, q.round_size, c.name AS tag
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
      questions,
    });
  }
  return quizzes;
}

async function saveAttempt({ username, quiz_slug, score, total }) {
  await pool.query(
    "INSERT IGNORE INTO users (username, password_hash) VALUES (?, ?)",
    [username, "no-password-demo-account"]
  );
  const [[user]] = await pool.query("SELECT user_id FROM users WHERE username = ?", [username]);
  const [[quiz]] = await pool.query("SELECT quiz_id FROM quizzes WHERE slug = ?", [quiz_slug]);
  if (!user || !quiz) throw new Error("Unknown user or quiz");

  await pool.query(
    "INSERT INTO attempts (user_id, quiz_id, score, total) VALUES (?, ?, ?, ?)",
    [user.user_id, quiz.quiz_id, score, total]
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

module.exports = { init, getQuizzes, saveAttempt, getLeaderboard };
