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
