// =============================================================
// Brainiac Quizzes — MongoDB setup
// Run with: mongosh brainiac_quizzes mongodb_setup.js
// Then seed real question data with: cd backend && npm run seed
//
// Key difference from the SQL versions: instead of tables joined
// together, a quiz DOCUMENT embeds its own questions and choices,
// because they're always read together and never queried alone.
// Users and attempts stay as separate collections because they grow
// independently and are queried on their own.
// =============================================================

db = db.getSiblingDB("brainiac_quizzes");

// ---------- users ----------
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["username", "created_at"],
      properties: {
        username: { bsonType: "string", description: "must be a string, required" },
        email: { bsonType: "string" },
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
      required: ["slug", "title", "tag", "questions"],
      properties: {
        slug: { bsonType: "string" },
        title: { bsonType: "string" },
        description: { bsonType: "string" },
        tag: { bsonType: "string" },
        minutes: { bsonType: "int" },
        round_size: { bsonType: "int" },
        questions: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["id", "text", "options"],
            properties: {
              id: { bsonType: "string" },
              text: { bsonType: "string" },
              options: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["t", "c"],
                  properties: {
                    t: { bsonType: "string" },
                    c: { bsonType: "bool" },
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
        quiz_title: { bsonType: "string" },
        score: { bsonType: "int", minimum: 0 },
        total: { bsonType: "int", minimum: 1 },
        taken_at: { bsonType: "date" },
      },
    },
  },
});
db.attempts.createIndex({ quiz_slug: 1 });
db.attempts.createIndex({ username: 1 });

print("Collections and validators created. Now run: cd backend && npm run seed");
