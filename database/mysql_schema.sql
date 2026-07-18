-- =============================================================
-- Brainiac Quizzes — MySQL schema
-- Engine: InnoDB (needed for foreign keys and transactions)
-- Run with: mysql -u root -p < mysql_schema.sql
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
  name        VARCHAR(50) NOT NULL UNIQUE   -- e.g. Logic, STEM, Trivia, Lifestyle
) ENGINE=InnoDB;

-- ---------- quizzes ----------
CREATE TABLE quizzes (
  quiz_id      INT AUTO_INCREMENT PRIMARY KEY,
  slug         VARCHAR(60) NOT NULL UNIQUE,   -- e.g. 'maths-iq'
  title        VARCHAR(120) NOT NULL,
  description  VARCHAR(255),
  category_id  INT,
  minutes      TINYINT UNSIGNED DEFAULT 3,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- questions ----------
CREATE TABLE questions (
  question_id  INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id      INT NOT NULL,
  question_text VARCHAR(255) NOT NULL,
  position     TINYINT UNSIGNED NOT NULL,   -- order within the quiz
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

-- helpful indexes for the leaderboard query
CREATE INDEX idx_attempts_quiz ON attempts (quiz_id);
CREATE INDEX idx_attempts_user ON attempts (user_id);

-- =============================================================
-- Seed data — mirrors QUIZZES in script.js
-- =============================================================
INSERT INTO categories (name) VALUES ('Logic'), ('Lifestyle'), ('STEM'), ('Trivia');

INSERT INTO quizzes (slug, title, description, category_id, minutes) VALUES
('maths-iq', 'IQ Test: Maths', 'Sharpen your mental arithmetic and pattern spotting.', 1, 3),
('family-quiz', 'Family Quiz', 'Fun questions about family life, traditions, and bonds.', 2, 2),
('science-quiz', 'Science Quiz', 'From chemistry to biology — how sharp is your science?', 3, 3),
('intelligence-quiz', 'Intelligence Quiz', 'General knowledge questions covering the world''s sharpest minds.', 4, 2);

-- Questions + choices for "IQ Test: Maths" (quiz_id = 1)
INSERT INTO questions (quiz_id, question_text, position) VALUES
(1, 'What is 12 x 8?', 1),
(1, 'Next number: 2, 4, 8, 16, ?', 2);

INSERT INTO choices (question_id, choice_text, is_correct) VALUES
(1, '96', TRUE), (1, '88', FALSE), (1, '108', FALSE), (1, '86', FALSE),
(2, '24', FALSE), (2, '32', TRUE), (2, '20', FALSE), (2, '18', FALSE);

-- Example test user (password should be hashed by the app, e.g. bcrypt)
INSERT INTO users (username, email, password_hash) VALUES
('Alfred', 'doryelealfred4@gmail.com', 'REPLACE_WITH_BCRYPT_HASH');

-- =============================================================
-- The leaderboard query your frontend needs
-- =============================================================
SELECT
  u.username,
  q.title AS quiz_title,
  a.score,
  a.total,
  ROUND((a.score / a.total) * 100, 1) AS percentage
FROM attempts a
JOIN users u   ON u.user_id = a.user_id
JOIN quizzes q ON q.quiz_id = a.quiz_id
ORDER BY percentage DESC, a.taken_at ASC
LIMIT 10;
