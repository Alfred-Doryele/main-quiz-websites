# Brainiac Quizzes v2 — bigger question banks, real shuffling, real backend

This is the upgrade on top of the first rebuild: more categories, questions
that don't repeat every time you replay, and an actual backend that can run
on MySQL, PostgreSQL, or MongoDB.

## What's new since v1

- **7 categories** instead of 4: Maths IQ, Family, Science, Intelligence,
  History, Geography, and Pop Culture & Movies — each with 10-12 questions
  in its pool.
- **No more repeat questions.** Every quiz only *shows* 5 questions per
  play-through, but pulls them randomly from its full pool, and specifically
  avoids repeating whatever you were just asked last time. Once you've
  cycled through the whole pool it starts reusing older ones again — you'll
  never see a quiz refuse to load because it "ran out."
- **Answer order shuffles too**, so the correct answer isn't always sitting
  in the same position.
- **Category filter chips** above the quiz grid.
- **A real backend** (`/backend`) that connects to MySQL, PostgreSQL, or
  MongoDB and serves quizzes + leaderboard over an API. The frontend tries
  the API first and quietly falls back to the local `data/quizzes.json` +
  browser storage if no backend is running — that's what keeps GitHub Pages
  working, since GitHub Pages can only serve static files and cannot run a
  database itself.

## Important: how "connect it to all three databases" actually works

A live site normally runs on **one** database at a time — that's how every
real production app works, and it's also the more honest way to demonstrate
this for your course. What's built here is a backend that can run on any of
the three, controlled by a single setting (`DB_TYPE` in `backend/.env`). You
can start it against MySQL, stop it, switch the setting to `postgres`,
restart, and get identical behavior — proving all three model the same data
correctly. That's a stronger demonstration than three databases running
at once ever would be.

## 1. Try it standalone first (no backend needed)

Nothing changes from before — open `index.html` with Live Server or:
```
python3 -m http.server 8000
```
Play a quiz, finish it, then play the *same* quiz again — you'll get a
different set of questions. That's all running on `data/quizzes.json` and
your browser's storage, same as v1.

## 2. Run the real backend

Pick one database to start with (MySQL is simplest if you're not sure).

```
cd backend
npm install
cp .env.example .env
```

Open `.env` and set `DB_TYPE` to `mysql`, `postgres`, or `mongodb`, and fill
in the matching password fields below it.

### If DB_TYPE=mysql
```
mysql -u root -p < ../database/mysql_schema.sql
npm run seed
npm start
```

### If DB_TYPE=postgres
```
psql -U postgres -f ../database/postgresql_schema.sql
npm run seed
npm start
```

### If DB_TYPE=mongodb
```
mongosh brainiac_quizzes ../database/mongodb_setup.js
npm run seed
npm start
```

Any of the three will print:
```
Brainiac Quizzes API running on http://localhost:4000 (DB_TYPE=mysql)
```

## 3. Point the frontend at the backend

Open `script.js`, find this line near the top:
```js
const API_BASE_URL = "";
```
Change it to:
```js
const API_BASE_URL = "http://localhost:4000";
```
Reload the site. The small dot next to the leaderboard will turn teal and
say "Connected — scores are saved to the live database" instead of "Demo
mode." Play a quiz, then check your leaderboard is now reading straight
from whichever database you picked.

To switch databases later: stop the backend, change `DB_TYPE` in `.env`,
re-run the matching schema + `npm run seed` for that database, restart
`npm start`. The frontend needs no changes at all — that's the point of
having one shared `db/index.js` switch.

## 4. Put GitHub Pages back to demo mode before pushing

GitHub Pages is a static host — it can't run `backend/server.js` for you.
Before pushing to GitHub, set `API_BASE_URL` back to `""` so the public
site keeps working in demo mode. If you want the backend live on the
internet too, that needs a small always-on host like Render or Railway
(free tiers exist) — ask me if you want to set that up later.

## File map

```
brainiac/
├── index.html
├── styles.css
├── script.js                      ← API-first, falls back to local data
├── data/
│   └── quizzes.json                ← single source of truth for all questions
├── database/
│   ├── mysql_schema.sql
│   ├── postgresql_schema.sql
│   └── mongodb_setup.js
└── backend/
    ├── package.json
    ├── .env.example
    ├── server.js                   ← Express API
    ├── seed.js                     ← loads data/quizzes.json into the DB
    └── db/
        ├── index.js                ← picks the adapter based on DB_TYPE
        ├── mysql.js
        ├── postgres.js
        └── mongodb.js
```

## Adding more questions later

Just edit `data/quizzes.json` — add new objects to any category's
`questions` array, or add a whole new category object. Then:
- Standalone mode picks it up immediately (no rebuild needed).
- Backend mode needs one re-run of `npm run seed` to push the new
  questions into whichever database is active.

---

# v3 additions: real accounts, the Bible Quiz Zone, gamification, and going live 24/7

## Real accounts (registration, login, forgot password)

The old "just type a username" login is now a real account system when a backend is connected:
- **Create an account** — username, email, password (6+ characters), stored with a bcrypt-hashed password.
- **Log in** — with username or email, plus password.
- **Forgot password** — enter your email, get a reset link (valid 1 hour). Without SMTP configured in `backend/.env`, the reset link prints to the backend's terminal instead of emailing — good enough for local testing.
- Standalone/demo mode (no backend connected, e.g. plain GitHub Pages) falls back to the old simple "play as guest" name-only flow, since real accounts need a database to store passwords in.

To actually send real reset emails, fill in the SMTP section of `backend/.env` — for Gmail specifically, you need an **app password** (Google Account → Security → App passwords), not your normal Gmail password.

## The Bible Quiz Zone

A new section (`data/bible.json`) with all 66 books of the Bible, each as its own quiz (5 questions drawn from a larger pool per book), plus a **General Knowledge** round and a **Riddles** round (clearly labeled "riddle mode" during play so it's never confused with a straightforward question). Tabs split it into Old Testament / New Testament / General & Riddles, with a search box to jump straight to a book.

Note: Bible content currently always loads from `data/bible.json` directly — it isn't yet part of the seeded MySQL/PostgreSQL/MongoDB data the way the main 7 categories are. Scores from Bible quizzes still save correctly through the same attempts system. Migrating Bible questions into the database too is a reasonable next step if you want everything in one place.

## Gamification

- A 15-second countdown timer per question (running out counts as a wrong answer).
- A live streak counter during play.
- Gold / Silver / Bronze / "Keep Practicing" badges on the results screen based on your score.

## Making it live 24/7, without your laptop needing to be on

Right now, your database and backend only run when your laptop does. To fix that permanently and for free:

1. **Database — MongoDB Atlas** (free forever, always-on, no credit card):
   - Sign up at mongodb.com/atlas, create a free M0 cluster.
   - Add a database user (username + password) under Database Access.
   - Under Network Access, allow access from anywhere (0.0.0.0/0) for simplicity.
   - Copy your connection string (Connect → Drivers) — it looks like `mongodb+srv://user:password@cluster.mongodb.net`.
   - Run `database/mongodb_setup.js` against it once (mongosh accepts a connection string directly), then `cd backend && npm run seed` with `MONGO_URI` in `.env` set to that connection string and `DB_TYPE=mongodb`.

2. **Backend — Render** (free tier, sleeps after 15 minutes idle, wakes itself in 30-60 seconds on the next visit):
   - Push this project to GitHub (already done).
   - On render.com, create a new **Web Service**, connect your GitHub repo, set the root directory to `backend`.
   - Build command: `npm install`. Start command: `npm start`.
   - Add all your `.env` values as Environment Variables in Render's dashboard instead (never commit `.env` itself).
   - Render gives you a permanent URL like `https://your-app.onrender.com`.

3. **Frontend**: set `API_BASE_URL` in `script.js` to that Render URL, then push to GitHub. Now anyone visiting your GitHub Pages link is talking to a database that's live even when your laptop is off — the only tradeoff is the first request after 15 minutes of no traffic takes 30-60 seconds to wake the backend up.

---

# v4 additions: dedicated auth pages and expanded question banks

## Login/register are now real pages, not a modal

- `login.html`, `register.html`, `forgot-password.html`, `reset-password.html` — each a standalone page with its own URL, matching the site's visual style.
- Shared logic lives in `auth.js` (new file) — keep `API_BASE_URL` at the top of `auth.js` in sync with the one in `script.js`.
- If no backend is connected, these pages show a clear notice instead of a broken form, and point back to guest play on the homepage.
- The homepage's "Log in" button and the "Play" button (when logged out) now link to `login.html` instead of opening a modal. In offline/demo mode, "Play" still offers a quick guest-name prompt so the standalone site keeps working without a backend.

## Expanded question banks

- The 7 main categories went from ~10-12 questions each to **30-32 each** (214 total).
- Bible **General Knowledge** and **Riddles** went from 20 each to **60 each**.
- The 66 individual Bible books are still at 5 questions each (330 total) — expanding those to 15-20 each is a much larger content pass (roughly 700-900 more questions) that's best tackled as its own follow-up given the sheer number of books.

All of this still uses the same shuffle + no-repeat logic from v2, so bigger pools mean more genuinely different rounds before questions start repeating.

---

# v5: fixing the "Bible quiz doesn't reach the leaderboard" bug

## What was actually wrong

Two separate bugs combined to make Bible quiz scores disappear silently:

1. **Bible quizzes were never seeded into the database** — only the 7 main categories were. When a live-connected site tried to save a Bible quiz attempt, the backend looked up the quiz by its slug, found nothing, and rejected the request.
2. **The frontend didn't check whether that save actually succeeded.** It only fell back to local storage if the network request itself failed — a rejected request (HTTP error) still "succeeded" as far as that check was concerned, so the score vanished instead of saving anywhere at all.

## What changed

- `data/bible.json` is now seeded into the database right alongside the 7 main categories — `npm run seed` loads both files together.
- The `quizzes` table (MySQL/PostgreSQL) gained three new columns: `book`, `testament`, and `is_riddle`, so Bible-specific info survives the round trip through the database.
- The frontend now properly checks the save actually succeeded before skipping the local-storage fallback.
- When connected live, the single `/api/quizzes` response is now split into the main 7 categories and the Bible content, instead of always fetching Bible questions from a separate local file. Bible scores now land in the exact same `attempts` table and the exact same leaderboard as everything else.

## If you already have a live database (like the Aiven one)

Your existing tables were created before these columns existed, so you need to add them:

```sql
ALTER TABLE quizzes ADD COLUMN book VARCHAR(60);
ALTER TABLE quizzes ADD COLUMN testament VARCHAR(20);
ALTER TABLE quizzes ADD COLUMN is_riddle BOOLEAN NOT NULL DEFAULT FALSE;
```

Run that once against your live database (Workbench → Aiven Live connection → paste and execute), then re-run:
```
cd backend
npm run seed
```
This adds all 68 Bible quizzes fresh; your existing 7 categories are simply left as-is (`book`/`testament` stay blank for them, which is correct).

---

# v6: live competitions ("Compete" section)

## What it does

A new **Compete** section on the homepage lets logged-in players:
- See roughly how many people are online right now (a lightweight "heartbeat" ping, not a precise headcount).
- **Create a challenge** — pick a category, get a 5-character room code.
- **Join a challenge** — enter a friend's code to join their room.
- Once the host clicks **Start**, everyone in the room answers the exact same set of questions (built once, server-side, so it's fair — no one can see it early).
- A live ranking updates every few seconds as players finish, ending with a 🏆 for whoever scored highest.
- Every challenge result is also saved as a normal attempt, so it counts on the main leaderboard too, not just within the challenge.

## Why this needs a live backend

Presence and challenge rooms only make sense with a real, shared server — everyone in a room needs to see the same state at the same time. In demo/offline mode (no backend connected), the Compete section explains this instead of pretending to work.

## A deliberate design choice worth understanding

Presence and challenge-room data live in the backend's **memory** (see `backend/presence.js`), not in MySQL/PostgreSQL/MongoDB. That's intentional: "who's online in the last minute" and "what's happening in this one live match right now" are short-lived facts nobody needs to look up again after the fact — storing them in a database would just be overhead for data with no lasting value. Quiz results still go into the real database, same as always; only the ephemeral "right now" state is kept in memory.

One consequence: if the Render free instance goes to sleep and wakes back up, any in-progress challenge room is lost (a rare edge case, and a reasonable tradeoff for a free-tier project). New rooms created after a restart work exactly as normal.

## New backend routes

- `POST /api/presence/ping` / `GET /api/presence/online`
- `POST /api/challenges` (create), `POST /api/challenges/:code/join`, `GET /api/challenges/:code`, `POST /api/challenges/:code/start`, `POST /api/challenges/:code/finish`

Nothing needs to be re-seeded for this feature — it's pure backend/frontend logic, no new database tables.
