// PostgreSQL adapter — same shape as the MySQL and MongoDB adapters.
const { Pool } = require("pg");

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
  await pool.query(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING`,
    [username, "no-password-demo-account"]
  );
  const { rows: [user] } = await pool.query("SELECT user_id FROM users WHERE username = $1", [username]);
  const { rows: [quiz] } = await pool.query("SELECT quiz_id FROM quizzes WHERE slug = $1", [quiz_slug]);
  if (!user || !quiz) throw new Error("Unknown user or quiz");

  await pool.query(
    "INSERT INTO attempts (user_id, quiz_id, score, total) VALUES ($1, $2, $3, $4)",
    [user.user_id, quiz.quiz_id, score, total]
  );
}

async function getLeaderboard() {
  const { rows } = await pool.query("SELECT * FROM leaderboard LIMIT 10");
  return rows;
}

module.exports = { init, getQuizzes, saveAttempt, getLeaderboard };
