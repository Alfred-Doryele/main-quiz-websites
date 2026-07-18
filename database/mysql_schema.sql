-- =============================================================
-- Brainiac Quizzes — MySQL schema
-- Engine: InnoDB (needed for foreign keys and transactions)
-- Run with: mysql -u root -p < mysql_schema.sql
-- Then seed real question data with: cd backend && npm run seed
-- =============================================================

CREATE DATABASE IF NOT EXISTS brainiac_quizzes
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE brainiac_quizzes;

-- ---------- users ----------
CREATE TABLE users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  email         VARCHAR(120) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,   -- never store plain-text passwords
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- categories ----------
CREATE TABLE categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE   -- e.g. Logic, STEM, Trivia, History
) ENGINE=InnoDB;

-- ---------- quizzes ----------
CREATE TABLE quizzes (
  quiz_id      INT AUTO_INCREMENT PRIMARY KEY,
  slug         VARCHAR(60) NOT NULL UNIQUE,   -- e.g. 'maths-iq'
  title        VARCHAR(120) NOT NULL,
  description  VARCHAR(255),
  category_id  INT,
  minutes      TINYINT UNSIGNED DEFAULT 3,
  round_size   TINYINT UNSIGNED DEFAULT 5,    -- how many questions are asked per play-through
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- questions ----------
-- A quiz can hold far more questions than one round shows (round_size) —
-- that's what makes "different questions every time you replay" possible:
-- the app draws a random round_size-sized sample from this pool.
CREATE TABLE questions (
  question_id  INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id      INT NOT NULL,
  question_text VARCHAR(255) NOT NULL,
  position     TINYINT UNSIGNED NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- choices ----------
CREATE TABLE choices (
  choice_id    INT AUTO_INCREMENT PRIMARY KEY,
  question_id  INT NOT NULL,
  choice_text  VARCHAR(255) NOT NULL,
  is_correct   BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (question_id) REFERENCES questions(question_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- attempts (one row per finished quiz) ----------
CREATE TABLE attempts (
  attempt_id   INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  quiz_id      INT NOT NULL,
  score        SMALLINT UNSIGNED NOT NULL,
  total        SMALLINT UNSIGNED NOT NULL,
  taken_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_attempts_quiz ON attempts (quiz_id);
CREATE INDEX idx_attempts_user ON attempts (user_id);

-- =============================================================
-- The leaderboard query the backend API runs (for your reference —
-- backend/db/mysql.js runs this exact query):
--
-- SELECT u.username, q.title AS quiz_title, a.score, a.total,
--        ROUND((a.score / a.total) * 100, 1) AS percentage
-- FROM attempts a
-- JOIN users u   ON u.user_id = a.user_id
-- JOIN quizzes q ON q.quiz_id = a.quiz_id
-- ORDER BY percentage DESC, a.taken_at ASC
-- LIMIT 10;
-- =============================================================

-- =============================================================
-- Next step: populate categories/quizzes/questions/choices for real.
-- Run this from the backend folder instead of hand-writing 60+ INSERTs:
--   cd backend
--   npm install
--   cp .env.example .env      (fill in your MySQL password)
--   npm run seed
-- =============================================================
