// Minimal example: fetch the leaderboard from MySQL using Node.js
// Install first:  npm install mysql2
const mysql = require("mysql2/promise");

async function getLeaderboard() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "YOUR_PASSWORD",
    database: "brainiac_quizzes",
  });

  const [rows] = await connection.execute(`
    SELECT u.username, q.title AS quiz_title, a.score, a.total,
           ROUND((a.score / a.total) * 100, 1) AS percentage
    FROM attempts a
    JOIN users u ON u.user_id = a.user_id
    JOIN quizzes q ON q.quiz_id = a.quiz_id
    ORDER BY percentage DESC, a.taken_at ASC
    LIMIT 10;
  `);

  console.log(rows);
  await connection.end();
}

getLeaderboard();
