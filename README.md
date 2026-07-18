# Brainiac Quizzes — rebuild + 3 databases

This replaces your old `b.html` / `Styles.CSS` / `script.js`. The old quiz
links pointed at `file:///C:/Users/Doryele Alfred/Desktop/...` — that's why
it broke the moment you cloned it anywhere else: those paths only exist on
your laptop. Everything below is self-contained and runs anywhere.

## 1. Run the website (do this first)

1. Copy these three files into one folder together:
   `index.html`, `styles.css`, `script.js`
2. Don't just double-click `index.html`. Use a local server so nothing
   silently breaks:
   - **VS Code**: install the "Live Server" extension, right-click
     `index.html` → "Open with Live Server".
   - **No VS Code**: open a terminal in that folder and run
     `python3 -m http.server 8000`, then visit `http://localhost:8000`.
3. Try it: click "Log in", type a username, play a quiz, then check the
   Leaderboard section — your score is stored in your browser's
   `localStorage` for now (see step 4 for why).

### What changed from your old version
- No more broken `file:///` links — all four quizzes are real and playable.
- Mobile menu, search bar, login, and quizzes all actually work.
- New visual identity: deep ink/violet background, gold "spotlight" accent,
  teal for correct answers, coral for wrong ones — built around the
  game-show energy of a live quiz, not a generic template.
- Fully responsive: resize your browser or open it on your phone.

## 2. Why three databases

Your lecturer is teaching MySQL, PostgreSQL, and MongoDB together because
they represent two different ways of modeling the *same* data:

| | MySQL / PostgreSQL | MongoDB |
|---|---|---|
| Model | Relational — data split across tables, joined with foreign keys | Document — related data embedded together |
| Quiz + its questions | 3 separate tables (`quizzes`, `questions`, `choices`) joined at query time | 1 document per quiz, questions/choices embedded inside it |
| Best for | Data with strict relationships and constraints (users, scores) | Data that's always read together (a quiz and its questions) |
| Schema | Fixed — every row must match the table's columns | Flexible — validated with a schema, but easier to change |

Both MySQL and PostgreSQL are relational, so their schemas
(`database/mysql_schema.sql` and `database/postgresql_schema.sql`) look
almost identical. The real contrast to understand for your course is
**relational vs. document** — SQL vs. MongoDB.

All three model the same five real-world things:
`users` → `quizzes` → `questions` → `choices`, plus `attempts` (a record
of someone finishing a quiz, used to build the leaderboard).

## 3. Set up MySQL

1. Install MySQL if you don't have it: https://dev.mysql.com/downloads/
2. In a terminal:
   ```
   mysql -u root -p < database/mysql_schema.sql
   ```
3. Check it worked:
   ```
   mysql -u root -p -e "USE brainiac_quizzes; SELECT * FROM quizzes;"
   ```

## 4. Set up PostgreSQL

1. Install PostgreSQL if you don't have it: https://www.postgresql.org/download/
2. Create and load the database:
   ```
   psql -U postgres -f database/postgresql_schema.sql
   ```
3. Check it worked:
   ```
   psql -U postgres -d brainiac_quizzes -c "SELECT * FROM leaderboard;"
   ```
   Notice PostgreSQL gets a real `VIEW` for the leaderboard — a saved
   query you can reuse anywhere. MySQL can do this too, but the script
   keeps it as a plain query so you can compare the raw SQL side by side.

## 5. Set up MongoDB

1. Install MongoDB Community Server:
   https://www.mongodb.com/try/download/community
2. Start the MongoDB service, then run:
   ```
   mongosh brainiac_quizzes database/mongodb_setup.js
   ```
3. Check it worked:
   ```
   mongosh brainiac_quizzes --eval "db.quizzes.find().pretty()"
   ```

## 6. (Bonus) Connecting the website to a real database

Right now the website stores scores in your browser only — that's
what `getAttempts()` / `saveAttempt()` do in `script.js`. To make scores
persist for every player, you'd add a small backend server that the
frontend talks to instead of `localStorage`. `backend-examples/` has one
tiny Node.js file per database showing the actual connection + leaderboard
query:

- `node-mysql-example.js` (needs `npm install mysql2`)
- `node-postgres-example.js` (needs `npm install pg`)
- `node-mongodb-example.js` (needs `npm install mongodb`)

You don't have to build the full backend for your database assignment —
the schemas in `database/` already are the deliverable. This is just here
so you can see, concretely, how the website would eventually talk to
whichever one you pick.

## File map

```
brainiac/
├── index.html                     ← homepage
├── styles.css                     ← all styling
├── script.js                      ← quiz engine, login, leaderboard, search
├── database/
│   ├── mysql_schema.sql
│   ├── postgresql_schema.sql
│   └── mongodb_setup.js
└── backend-examples/
    ├── node-mysql-example.js
    ├── node-postgres-example.js
    └── node-mongodb-example.js
```

## Next steps for your GitHub repo

1. Delete the old images with `file:///` links baked into `b.html`.
2. Replace `b.html`, `Styles.CSS`, `script.js` with the new files here
   (rename `b.html` to `index.html` so GitHub Pages can serve it directly).
3. Commit and push:
   ```
   git add .
   git commit -m "Redesign site, add MySQL/PostgreSQL/MongoDB schemas"
   git push
   ```
4. If you want it live on the web for free, enable **GitHub Pages** in
   your repo settings (Settings → Pages → deploy from `main` branch).
