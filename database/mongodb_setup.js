// =============================================================
// Brainiac Quizzes — MongoDB setup
// Run with: mongosh brainiac_quizzes mongodb_setup.js
//
// Key difference from the SQL versions: instead of five separate
// tables joined together, a quiz DOCUMENT embeds its own questions
// and choices, because they're always read together and never
// queried alone. Users and attempts stay as separate collections
// because they grow independently and are queried on their own.
// =============================================================

db = db.getSiblingDB("brainiac_quizzes");

// ---------- users ----------
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["username", "password_hash", "created_at"],
      properties: {
        username: { bsonType: "string", description: "must be a string, required" },
        email: { bsonType: "string" },
        password_hash: { bsonType: "string", description: "never store plain-text passwords" },
        created_at: { bsonType: "date" },
      },
    },
  },
});
db.users.createIndex({ username: 1 }, { unique: true });

// ---------- quizzes (questions + choices embedded) ----------
db.createCollection("quizzes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["slug", "title", "category", "questions"],
      properties: {
        slug: { bsonType: "string" },
        title: { bsonType: "string" },
        description: { bsonType: "string" },
        category: { bsonType: "string" },
        minutes: { bsonType: "int" },
        questions: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["question_text", "choices"],
            properties: {
              question_text: { bsonType: "string" },
              choices: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["choice_text", "is_correct"],
                  properties: {
                    choice_text: { bsonType: "string" },
                    is_correct: { bsonType: "bool" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});
db.quizzes.createIndex({ slug: 1 }, { unique: true });

// ---------- attempts ----------
db.createCollection("attempts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["username", "quiz_slug", "score", "total", "taken_at"],
      properties: {
        username: { bsonType: "string" },
        quiz_slug: { bsonType: "string" },
        score: { bsonType: "int", minimum: 0 },
        total: { bsonType: "int", minimum: 1 },
        taken_at: { bsonType: "date" },
      },
    },
  },
});
db.attempts.createIndex({ quiz_slug: 1 });
db.attempts.createIndex({ username: 1 });

// =============================================================
// Seed data — mirrors QUIZZES in script.js
// =============================================================
db.quizzes.insertMany([
  {
    slug: "maths-iq",
    title: "IQ Test: Maths",
    description: "Sharpen your mental arithmetic and pattern spotting.",
    category: "Logic",
    minutes: 3,
    questions: [
      {
        question_text: "What is 12 x 8?",
        choices: [
          { choice_text: "96", is_correct: true },
          { choice_text: "88", is_correct: false },
          { choice_text: "108", is_correct: false },
          { choice_text: "86", is_correct: false },
        ],
      },
      {
        question_text: "Next number: 2, 4, 8, 16, ?",
        choices: [
          { choice_text: "24", is_correct: false },
          { choice_text: "32", is_correct: true },
          { choice_text: "20", is_correct: false },
          { choice_text: "18", is_correct: false },
        ],
      },
    ],
  },
  {
    slug: "family-quiz",
    title: "Family Quiz",
    description: "Fun questions about family life, traditions, and bonds.",
    category: "Lifestyle",
    minutes: 2,
    questions: [
      {
        question_text: "A gathering of extended family is often called a...",
        choices: [
          { choice_text: "Reunion", is_correct: true },
          { choice_text: "Meeting", is_correct: false },
          { choice_text: "Session", is_correct: false },
          { choice_text: "Conference", is_correct: false },
        ],
      },
    ],
  },
]);

db.users.insertOne({
  username: "Alfred",
  email: "doryelealfred4@gmail.com",
  password_hash: "REPLACE_WITH_BCRYPT_HASH",
  created_at: new Date(),
});

// =============================================================
// The leaderboard aggregation your frontend needs
// =============================================================
db.attempts.aggregate([
  {
    $addFields: {
      percentage: { $round: [{ $multiply: [{ $divide: ["$score", "$total"] }, 100] }, 1] },
    },
  },
  { $sort: { percentage: -1, taken_at: 1 } },
  { $limit: 10 },
  {
    $lookup: {
      from: "quizzes",
      localField: "quiz_slug",
      foreignField: "slug",
      as: "quiz",
    },
  },
  { $unwind: "$quiz" },
  {
    $project: {
      _id: 0,
      username: 1,
      quiz_title: "$quiz.title",
      score: 1,
      total: 1,
      percentage: 1,
    },
  },
]);
