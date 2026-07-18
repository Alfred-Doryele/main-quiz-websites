// Minimal example: fetch the leaderboard from PostgreSQL using Node.js
// Install first:  npm install pg
const { Client } = require("pg");

async function getLeaderboard() {
  const client = new Client({
    host: "localhost",
    user: "postgres",
    password: "YOUR_PASSWORD",
    database: "brainiac_quizzes",
    port: 5432,
  });

  await client.connect();
  const result = await client.query("SELECT * FROM leaderboard LIMIT 10;");
  console.log(result.rows);
  await client.end();
}

getLeaderboard();
