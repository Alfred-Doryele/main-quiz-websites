// Loads data/quizzes.json into the active database (MySQL, PostgreSQL, or
// MongoDB, whichever DB_TYPE names). Run with:  npm run seed
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const quizzes = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/quizzes.json"), "utf-8"));
const DB_TYPE = process.env.DB_TYPE || "mysql";

async function seedMysql() {
  const mysql = require("mysql2/promise");
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  for (const quiz of quizzes) {
    await conn.query(
      "INSERT INTO categories (name) VALUES (?) ON DUPLICATE KEY UPDATE name = name",
      [quiz.tag]
    );
    const [[catRow]] = await conn.query("SELECT category_id FROM categories WHERE name = ?", [quiz.tag]);

    await conn.query(
      `INSERT INTO quizzes (slug, title, description, category_id, minutes, round_size)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title)`,
      [quiz.slug, quiz.title, quiz.description, catRow.category_id, quiz.minutes, quiz.round_size]
    );
    const [[quizRow]] = await conn.query("SELECT quiz_id FROM quizzes WHERE slug = ?", [quiz.slug]);

    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];
      const [qResult] = await conn.query(
        "INSERT INTO questions (quiz_id, question_text, position) VALUES (?, ?, ?)",
        [quizRow.quiz_id, q.text, i + 1]
      );
      for (const opt of q.options) {
        await conn.query(
          "INSERT INTO choices (question_id, choice_text, is_correct) VALUES (?, ?, ?)",
          [qResult.insertId, opt.t, opt.c]
        );
      }
    }
    console.log(`Seeded ${quiz.title} (${quiz.questions.length} questions)`);
  }
  await conn.end();
}

async function seedPostgres() {
  const { Client } = require("pg");
  const client = new Client({
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    port: process.env.PG_PORT,
  });
  await client.connect();

  for (const quiz of quizzes) {
    await client.query(
      "INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
      [quiz.tag]
    );
    const { rows: [catRow] } = await client.query("SELECT category_id FROM categories WHERE name = $1", [quiz.tag]);

    await client.query(
      `INSERT INTO quizzes (slug, title, description, category_id, minutes, round_size)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title`,
      [quiz.slug, quiz.title, quiz.description, catRow.category_id, quiz.minutes, quiz.round_size]
    );
    const { rows: [quizRow] } = await client.query("SELECT quiz_id FROM quizzes WHERE slug = $1", [quiz.slug]);

    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];
      const { rows: [qRow] } = await client.query(
        "INSERT INTO questions (quiz_id, question_text, position) VALUES ($1, $2, $3) RETURNING question_id",
        [quizRow.quiz_id, q.text, i + 1]
      );
      for (const opt of q.options) {
        await client.query(
          "INSERT INTO choices (question_id, choice_text, is_correct) VALUES ($1, $2, $3)",
          [qRow.question_id, opt.t, opt.c]
        );
      }
    }
    console.log(`Seeded ${quiz.title} (${quiz.questions.length} questions)`);
  }
  await client.end();
}

async function seedMongo() {
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.MONGO_DATABASE);

  for (const quiz of quizzes) {
    await db.collection("quizzes").updateOne(
      { slug: quiz.slug },
      { $set: quiz },
      { upsert: true }
    );
    console.log(`Seeded ${quiz.title} (${quiz.questions.length} questions)`);
  }
  await client.close();
}

const runners = { mysql: seedMysql, postgres: seedPostgres, mongodb: seedMongo };

runners[DB_TYPE]()
  .then(() => {
    console.log(`Done seeding ${DB_TYPE}.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
