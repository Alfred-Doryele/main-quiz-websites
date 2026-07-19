// MongoDB adapter — same shape as the MySQL and PostgreSQL adapters.
// Quizzes are stored as whole documents (questions/choices embedded),
// which is the natural document-database way to model this, versus the
// joined tables the two SQL adapters use.
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

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
  const user = await db.collection("users").findOne({ username });
  if (!user) throw new Error("Unknown user");

  await db.collection("attempts").insertOne({
    username,
    quiz_slug,
    quiz_title,
    score,
    total,
    taken_at: new Date(),
  });
}

async function registerUser({ username, email, password }) {
  const existing = await db.collection("users").findOne({ $or: [{ username }, { email }] });
  if (existing) throw new Error("Username or email already in use");

  const password_hash = await bcrypt.hash(password, 10);
  await db.collection("users").insertOne({ username, email, password_hash, created_at: new Date() });
  return { username };
}

async function verifyLogin({ identifier, password }) {
  const user = await db.collection("users").findOne({ $or: [{ username: identifier }, { email: identifier }] });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? { username: user.username } : null;
}

async function createPasswordResetToken({ email }) {
  const user = await db.collection("users").findOne({ email });
  if (!user) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: { reset_token: token, reset_token_expires: expires } }
  );
  return { token, username: user.username };
}

async function resetPassword({ token, newPassword }) {
  const user = await db.collection("users").findOne({
    reset_token: token,
    reset_token_expires: { $gt: new Date() },
  });
  if (!user) throw new Error("Reset link is invalid or has expired");

  const password_hash = await bcrypt.hash(newPassword, 10);
  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: { password_hash }, $unset: { reset_token: "", reset_token_expires: "" } }
  );
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

module.exports = { init, getQuizzes, saveAttempt, getLeaderboard, registerUser, verifyLogin, createPasswordResetToken, resetPassword };
