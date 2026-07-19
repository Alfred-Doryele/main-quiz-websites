-- =============================================================
-- Brainiac Quizzes — PostgreSQL schema
-- Run with: psql -U postgres -f postgresql_schema.sql
-- Then seed real question data with: cd backend && npm run seed
-- =============================================================

CREATE DATABASE brainiac_quizzes;
-- Connect to it before running the rest:  \c brainiac_quizzes

-- ---------- users ----------
CREATE TABLE users (
  user_id       SERIAL PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  email         VARCHAR(120) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  reset_token   VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- categories ----------
CREATE TABLE categories (
  category_id SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE
);

-- ---------- quizzes ----------
CREATE TABLE quizzes (
  quiz_id      SERIAL PRIMARY KEY,
  slug         VARCHAR(60) NOT NULL UNIQUE,
  title        VARCHAR(120) NOT NULL,
  description  VARCHAR(255),
  category_id  INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
  minutes      SMALLINT NOT NULL DEFAULT 3 CHECK (minutes > 0),
  round_size   SMALLINT NOT NULL DEFAULT 5 CHECK (round_size > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- questions ----------
-- A quiz can hold far more questions than one round shows (round_size) —
-- that's what makes "different questions every time you replay" possible:
-- the app draws a random round_size-sized sample from this pool.
CREATE TABLE questions (
  question_id   SERIAL PRIMARY KEY,
  quiz_id       INTEGER NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  question_text VARCHAR(255) NOT NULL,
  position      SMALLINT NOT NULL CHECK (position > 0)
);

-- ---------- choices ----------
CREATE TABLE choices (
  choice_id   SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
  choice_text VARCHAR(255) NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------- attempts ----------
CREATE TABLE attempts (
  attempt_id SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  quiz_id    INTEGER NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  score      SMALLINT NOT NULL CHECK (score >= 0),
  total      SMALLINT NOT NULL CHECK (total > 0),
  taken_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (score <= total)
);

CREATE INDEX idx_attempts_quiz ON attempts (quiz_id);
CREATE INDEX idx_attempts_user ON attempts (user_id);

-- =============================================================
-- A reusable leaderboard VIEW (PostgreSQL-specific strength: real views)
-- backend/db/postgres.js queries this view directly.
-- =============================================================
CREATE VIEW leaderboard AS
SELECT
  u.username,
  q.title AS quiz_title,
  a.score,
  a.total,
  ROUND((a.score::numeric / a.total) * 100, 1) AS percentage,
  a.taken_at
FROM attempts a
JOIN users u   ON u.user_id = a.user_id
JOIN quizzes q ON q.quiz_id = a.quiz_id
ORDER BY percentage DESC, a.taken_at ASC;

-- =============================================================
-- Next step: populate categories/quizzes/questions/choices for real.
-- Run this from the backend folder instead of hand-writing 60+ INSERTs:
--   cd backend
--   npm install
--   cp .env.example .env      (fill in your PostgreSQL password)
--   npm run seed
-- =============================================================
