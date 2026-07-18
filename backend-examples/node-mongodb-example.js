// Minimal example: fetch the leaderboard from MongoDB using Node.js
// Install first:  npm install mongodb
const { MongoClient } = require("mongodb");

async function getLeaderboard() {
  const client = new MongoClient("mongodb://localhost:27017");
  await client.connect();
  const db = client.db("brainiac_quizzes");

  const leaderboard = await db
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
        $lookup: { from: "quizzes", localField: "quiz_slug", foreignField: "slug", as: "quiz" },
      },
      { $unwind: "$quiz" },
      {
        $project: { _id: 0, username: 1, quiz_title: "$quiz.title", score: 1, total: 1, percentage: 1 },
      },
    ])
    .toArray();

  console.log(leaderboard);
  await client.close();
}

getLeaderboard();
