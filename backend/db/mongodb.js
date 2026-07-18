// MongoDB adapter — same shape as the MySQL and PostgreSQL adapters.
// Quizzes are stored as whole documents (questions/choices embedded),
// which is the natural document-database way to model this, versus the
// joined tables the two SQL adapters use.
const { MongoClient } = require("mongodb");

let client;
let db;

async function init() {
  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.MONGO_DATABASE);
  await db.command({ ping: 1 });
  console.log("Connected to MongoDB");
}

async function getQuizzes() {
  const quizzes = await db.collection("quizzes").find({}, { projection: { _id: 0 } }).toArray();
  return quizzes;
}

async function saveAttempt({ username, quiz_slug, quiz_title, score, total }) {
  await db.collection("users").updateOne(
    { username },
    { $setOnInsert: { username, created_at: new Date() } },
    { upsert: true }
  );

  await db.collection("attempts").insertOne({
    username,
    quiz_slug,
    quiz_title,
    score,
    total,
    taken_at: new Date(),
  });
}

async function getLeaderboard() {
  return db
    .collection("attempts")
    .aggregate([
      {
        $addFields: {
          percentage: { $round: [{ $multiply: [{ $divide: ["$score", "$total"] }, 100] }, 1] },
        },
      },
      { $sort: { percentage: -1, taken_at: 1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          username: 1,
          quiz_title: 1,
          score: 1,
          total: 1,
          percentage: 1,
          taken_at: 1,
        },
      },
    ])
    .toArray();
}

module.exports = { init, getQuizzes, saveAttempt, getLeaderboard };
