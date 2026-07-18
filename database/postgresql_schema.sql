-- =============================================================
-- Brainiac Quizzes — PostgreSQL schema
-- Run with: psql -U postgres -f postgresql_schema.sql
-- =============================================================

CREATE DATABASE brainiac_quizzes;
-- Connect to it before running the rest:  \c brainiac_quizzes

-- ---------- users ----------
CREATE TABLE users (
  user_id       SERIAL PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  email         VARCHAR(120) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
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
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- questions ----------
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
-- Seed data
-- =============================================================
INSERT INTO categories (name) VALUES ('Logic'), ('Lifestyle'), ('STEM'), ('Trivia');

INSERT INTO quizzes (slug, title, description, category_id, minutes) VALUES
('maths-iq', 'IQ Test: Maths', 'Sharpen your mental arithmetic and pattern spotting.', 1, 3),
('family-quiz', 'Family Quiz', 'Fun questions about family life, traditions, and bonds.', 2, 2),
('science-quiz', 'Science Quiz', 'From chemistry to biology — how sharp is your science?', 3, 3),
('intelligence-quiz', 'Intelligence Quiz', 'General knowledge questions covering the world''s sharpest minds.', 4, 2);

INSERT INTO questions (quiz_id, question_text, position) VALUES
(1, 'What is 12 x 8?', 1),
(1, 'Next number: 2, 4, 8, 16, ?', 2);

INSERT INTO choices (question_id, choice_text, is_correct) VALUES
(1, '96', TRUE), (1, '88', FALSE), (1, '108', FALSE), (1, '86', FALSE),
(2, '24', FALSE), (2, '32', TRUE), (2, '20', FALSE), (2, '18', FALSE);

INSERT INTO users (username, email, password_hash) VALUES
('Alfred', 'doryelealfred4@gmail.com', 'REPLACE_WITH_BCRYPT_HASH');

-- =============================================================
-- A reusable leaderboard VIEW (PostgreSQL-specific strength: real views)
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

-- Usage:  SELECT * FROM leaderboard LIMIT 10;
