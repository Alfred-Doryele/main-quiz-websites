/* ==========================================================================
   Brainiac Quizzes — app logic (v2)

   HOW THE BACKEND SWITCH WORKS
   -----------------------------
   Set API_BASE_URL below to a running backend (see /backend) and the site
   will use real MySQL, PostgreSQL, or MongoDB data — whichever the backend
   is configured for. Leave it empty and the site runs standalone using
   data/quizzes.json + localStorage, which is exactly what happens when this
   is hosted on GitHub Pages (a static host can't run a database).
   ========================================================================== */

const API_BASE_URL = ""; // e.g. "http://localhost:4000" once your backend is running

let ALL_QUIZZES = [];
let BIBLE_QUIZZES = [];
let activeBibleTab = "Old Testament";
let activeCategory = "all";
let activeQuiz = null;
let activeRound = [];
let activeIndex = 0;
let activeScore = 0;
let usingLiveApi = false;

/* ---------------- boot ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadQuizzes();
  await loadBibleQuizzes();
  renderFilterChips();
  renderQuizGrid(ALL_QUIZZES);
  renderBibleTabs();
  renderBibleBooks();
  await renderLeaderboard();
  updateHeaderForUser();
  updateHeroStats();
  setDataSourcePill();

  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", isOpen);
  });
  mainNav.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => mainNav.classList.remove("open"))
  );
});

/* ---------------- data loading (API first, local file fallback) ---------------- */
async function loadQuizzes() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/quizzes`);
      if (res.ok) {
        ALL_QUIZZES = await res.json();
        usingLiveApi = true;
        return;
      }
    } catch (err) {
      console.warn("Backend unreachable, falling back to local quiz data.", err);
    }
  }
  const res = await fetch("data/quizzes.json");
  ALL_QUIZZES = await res.json();
  usingLiveApi = false;
}

async function loadBibleQuizzes() {
  // Bible content always loads from the local file, regardless of whether a
  // backend is connected — it isn't (yet) part of the seeded database, so
  // scores from these quizzes still save the same way regular quizzes do
  // via submitAttempt(), but the questions themselves come from this file.
  const res = await fetch("data/bible.json");
  BIBLE_QUIZZES = await res.json();
}

function findQuizBySlug(slug) {
  return ALL_QUIZZES.find((q) => q.slug === slug) || BIBLE_QUIZZES.find((q) => q.slug === slug);
}

function setDataSourcePill() {
  const pill = document.getElementById("dataSourceNote");
  if (usingLiveApi) {
    pill.textContent = "Connected — scores are saved to the live database.";
    pill.classList.add("live");
    pill.classList.remove("local");
  } else {
    pill.textContent = "Demo mode — scores are saved to this browser only.";
    pill.classList.add("local");
    pill.classList.remove("live");
  }
}

/* ---------------- DATA LAYER: attempts + leaderboard ---------------- */
function getCurrentUser() {
  return localStorage.getItem("bq_current_user");
}
function setCurrentUser(name) {
  localStorage.setItem("bq_current_user", name);
}
function getLocalAttempts() {
  return JSON.parse(localStorage.getItem("bq_attempts") || "[]");
}
function saveLocalAttempt(attempt) {
  const attempts = getLocalAttempts();
  attempts.push(attempt);
  localStorage.setItem("bq_attempts", JSON.stringify(attempts));
}

async function submitAttempt(attempt) {
  if (usingLiveApi) {
    try {
      await fetch(`${API_BASE_URL}/api/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt),
      });
      return;
    } catch (err) {
      console.warn("Could not reach backend, saving locally instead.", err);
    }
  }
  saveLocalAttempt(attempt);
}

async function fetchLeaderboard() {
  if (usingLiveApi) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaderboard`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Could not reach backend for leaderboard.", err);
    }
  }
  return getLocalAttempts()
    .map((a) => ({ ...a, percentage: Math.round((a.score / a.total) * 100) }))
    .sort((a, b) => b.percentage - a.percentage || new Date(a.taken_at) - new Date(b.taken_at))
    .slice(0, 10);
}

/* ---------------- "don't repeat last round" logic ---------------- */
// Keyed per quiz slug so each category tracks its own recently-seen questions.
function getRecentlyUsed(slug) {
  return JSON.parse(localStorage.getItem(`bq_recent_${slug}`) || "[]");
}
function setRecentlyUsed(slug, ids) {
  localStorage.setItem(`bq_recent_${slug}`, JSON.stringify(ids));
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Picks a fresh set of questions for this play-through, avoiding whatever
// was asked last time whenever the pool is big enough to allow it. Once the
// full pool has been cycled through, it starts reusing older questions again
// rather than ever showing literally nothing.
function buildRound(quiz) {
  const roundSize = Math.min(quiz.round_size || 5, quiz.questions.length);
  const recent = getRecentlyUsed(quiz.slug);
  const fresh = quiz.questions.filter((q) => !recent.includes(q.id));
  const pool = fresh.length >= roundSize ? fresh : quiz.questions;

  const chosen = shuffle(pool).slice(0, roundSize);
  setRecentlyUsed(quiz.slug, chosen.map((q) => q.id));

  // Shuffle each question's own option order too, so the correct answer
  // isn't always sitting in the same position.
  return chosen.map((q) => ({
    id: q.id,
    text: q.text,
    options: shuffle(q.options),
  }));
}

/* ---------------- category icon art ---------------- */
const CATEGORY_ICONS = {
  Logic: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/><path d="M18 20a6 6 0 1 1 8 5.6V29" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="26" cy="34" r="1.6" fill="currentColor"/></svg>`,
  Lifestyle: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 36S10 27.4 10 18.8C10 13.9 13.9 10 18.6 10c2.9 0 5.5 1.5 7.4 3.9C27.9 11.5 30.5 10 33.4 10 38.1 10 42 13.9 42 18.8 42 27.4 24 36 24 36Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" transform="translate(-3 0) scale(0.9) translate(2.6 2.4)"/></svg>`,
  STEM: `<svg viewBox="0 0 48 48" fill="none"><path d="M19 8h10M21 8v10.5L13 34a4 4 0 0 0 3.6 5.8h14.8A4 4 0 0 0 35 34l-8-15.5V8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M16 30h16" stroke="currentColor" stroke-width="2"/></svg>`,
  Trivia: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/><path d="M20 19a4.5 4.5 0 1 1 6 4.2c-1.4.6-2 1.7-2 3.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="33" r="1.6" fill="currentColor"/></svg>`,
  History: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 10a14 14 0 1 0 14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M24 10 20 6M24 10l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M24 16v8l6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  Geography: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="2"/><path d="M8 24h32M24 8c4.5 4.5 6.5 10 6.5 16S28.5 39.5 24 44c-4.5-4.5-6.5-10-6.5-16S19.5 12.5 24 8Z" stroke="currentColor" stroke-width="2"/></svg>`,
  Entertainment: `<svg viewBox="0 0 48 48" fill="none"><rect x="8" y="12" width="32" height="24" rx="3" stroke="currentColor" stroke-width="2"/><path d="M20 19l9 5-9 5V19Z" fill="currentColor"/></svg>`,
  Bible: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 12v26M24 12c-3-3-9-3-12 0v22c3-3 9-3 12 0 3-3 9-3 12 0V12c-3-3-9-3-12 0Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  "Bible Knowledge": `<svg viewBox="0 0 48 48" fill="none"><path d="M24 12v26M24 12c-3-3-9-3-12 0v22c3-3 9-3 12 0 3-3 9-3 12 0V12c-3-3-9-3-12 0Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  "Bible Riddles": `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/><path d="M20 19a4.5 4.5 0 1 1 6 4.2c-1.4.6-2 1.7-2 3.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="33" r="1.6" fill="currentColor"/></svg>`,
};
function categoryIcon(tag) {
  return CATEGORY_ICONS[tag] || `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/></svg>`;
}

/* ---------------- rendering ---------------- */
function renderFilterChips() {
  const row = document.getElementById("filterRow");
  const categories = ["all", ...new Set(ALL_QUIZZES.map((q) => q.tag))];
  row.innerHTML = categories
    .map(
      (cat) =>
        `<button class="filter-chip ${cat === activeCategory ? "active" : ""}" data-cat="${cat}">${
          cat === "all" ? "All" : cat
        }</button>`
    )
    .join("");
  row.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      renderFilterChips();
      applyFilters();
    });
  });
}

/* ---------------- Bible Quiz Zone ---------------- */
const BIBLE_TABS = ["Old Testament", "New Testament", "General & Riddles"];

function renderBibleTabs() {
  const row = document.getElementById("bibleTabs");
  row.innerHTML = BIBLE_TABS.map(
    (tab) => `<button class="filter-chip ${tab === activeBibleTab ? "active" : ""}" data-tab="${tab}">${tab}</button>`
  ).join("");
  row.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeBibleTab = btn.dataset.tab;
      renderBibleTabs();
      renderBibleBooks();
    });
  });
}

function renderBibleBooks() {
  const grid = document.getElementById("bibleBookGrid");
  const term = document.getElementById("bibleSearch").value.trim().toLowerCase();

  let list;
  if (activeBibleTab === "General & Riddles") {
    list = BIBLE_QUIZZES.filter((q) => q.testament === "General");
  } else {
    list = BIBLE_QUIZZES.filter((q) => q.testament === activeBibleTab);
  }
  if (term) {
    list = list.filter((q) => q.book.toLowerCase().includes(term) || q.title.toLowerCase().includes(term));
  }

  grid.innerHTML = list
    .map(
      (quiz) => `
      <div class="bible-book-card">
        <div class="bible-book-icon">${categoryIcon(quiz.tag)}</div>
        <div class="bible-book-info">
          <h4>${quiz.book}</h4>
          <p>${quiz.round_size} of ${quiz.questions.length} questions${quiz.is_riddle ? " · riddle mode" : ""}</p>
        </div>
        <button class="btn btn-outline" data-quiz="${quiz.slug}">Play</button>
      </div>`
    )
    .join("");

  grid.querySelectorAll("button[data-quiz]").forEach((btn) => {
    btn.addEventListener("click", () => startQuiz(btn.dataset.quiz));
  });
}

function applyFilters() {
  const term = document.getElementById("searchBar").value.trim().toLowerCase();
  const filtered = ALL_QUIZZES.filter((q) => {
    const matchesCategory = activeCategory === "all" || q.tag === activeCategory;
    const matchesSearch =
      !term ||
      q.title.toLowerCase().includes(term) ||
      q.tag.toLowerCase().includes(term) ||
      q.description.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });
  renderQuizGrid(filtered);
}

function searchQuizzes() {
  applyFilters();
}

function renderQuizGrid(list) {
  const grid = document.getElementById("quizGrid");
  const noResults = document.getElementById("noResults");
  grid.innerHTML = "";

  if (list.length === 0) {
    noResults.hidden = false;
    return;
  }
  noResults.hidden = true;

  list.forEach((quiz) => {
    const card = document.createElement("article");
    card.className = "quiz-card";
    card.innerHTML = `
      <div class="quiz-card-media">${categoryIcon(quiz.tag)}</div>
      <div class="quiz-card-body">
        <span class="quiz-card-tag">${quiz.tag}</span>
        <h3>${quiz.title}</h3>
        <p>${quiz.description}</p>
        <div class="quiz-card-meta">
          <span>${quiz.round_size || 5} of ${quiz.questions.length} questions</span>
          <span>~${quiz.minutes} min</span>
        </div>
        <button class="btn btn-primary btn-block" data-quiz="${quiz.slug}">Play</button>
      </div>`;
    card.querySelector("button").addEventListener("click", () => startQuiz(quiz.slug));
    grid.appendChild(card);
  });
}

async function renderLeaderboard() {
  const body = document.getElementById("leaderboardBody");
  const rows = await fetchLeaderboard();

  if (rows.length === 0) {
    body.innerHTML = `<tr class="empty-row"><td colspan="4">No scores yet — be the first on the board.</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((a, i) => {
      const rankClass = i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "";
      return `<tr>
        <td class="rank-cell ${rankClass}">#${i + 1}</td>
        <td>${escapeHtml(a.username)}</td>
        <td>${escapeHtml(a.quiz_title)}</td>
        <td>${a.score}/${a.total}</td>
      </tr>`;
    })
    .join("");
}

async function updateHeroStats() {
  document.getElementById("statQuizzes").textContent = ALL_QUIZZES.length;
  const rows = await fetchLeaderboard();
  const players = new Set(rows.map((a) => a.username)).size;
  const top = rows.length ? Math.max(...rows.map((a) => a.percentage)) : null;
  document.getElementById("statPlayers").textContent = players || "0";
  document.getElementById("statTop").textContent = top !== null ? top + "%" : "—";
}

function updateHeaderForUser() {
  const user = getCurrentUser();
  const btn = document.getElementById("authBtn");
  if (user) {
    btn.textContent = user;
    btn.onclick = () => {
      if (confirm(`Log out ${user}?`)) {
        localStorage.removeItem("bq_current_user");
        updateHeaderForUser();
      }
    };
  } else {
    btn.textContent = "Log in";
    btn.onclick = () => (window.location.href = "login.html");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------- quiz engine ---------------- */
const QUESTION_SECONDS = 15;
let questionTimer = null;
let timeLeft = QUESTION_SECONDS;
let currentStreak = 0;
let bestStreak = 0;

function startQuiz(slug) {
  const quiz = findQuizBySlug(slug);
  if (!quiz) return;

  if (!getCurrentUser()) {
    if (usingLiveApi) {
      window.location.href = "login.html";
      return;
    }
    // Offline/demo mode: no backend to register a real account against,
    // so just capture a quick display name for the leaderboard.
    const name = window.prompt("No live database is connected, so this is demo mode. Enter a name to play:");
    if (!name || name.trim().length < 2) return;
    setCurrentUser(name.trim());
    updateHeaderForUser();
  }

  activeQuiz = quiz;
  activeRound = buildRound(quiz);
  activeIndex = 0;
  activeScore = 0;
  currentStreak = 0;
  bestStreak = 0;
  document.getElementById("quizModal").classList.add("open");
  renderQuestion();
}

function closeQuizModal() {
  clearInterval(questionTimer);
  document.getElementById("quizModal").classList.remove("open");
  activeQuiz = null;
}

function renderQuestion() {
  clearInterval(questionTimer);
  timeLeft = QUESTION_SECONDS;

  const container = document.getElementById("quizPlay");
  const q = activeRound[activeIndex];
  const progressPct = Math.round((activeIndex / activeRound.length) * 100);
  const isRiddle = !!activeQuiz.is_riddle;

  container.innerHTML = `
    <div class="qp-progress"><div class="qp-progress-bar" style="width:${progressPct}%"></div></div>
    <div class="qp-meta-row">
      <p class="qp-tag">${isRiddle ? "🧩 Riddle mode · " : ""}${activeQuiz.title} · Question ${activeIndex + 1} of ${activeRound.length}</p>
      <div class="qp-timer"><div class="qp-timer-bar" id="qpTimerBar" style="width:100%"></div></div>
    </div>
    <p class="qp-question">${q.text}</p>
    <div class="qp-options">
      ${q.options.map((opt, i) => `<button class="qp-opt" data-idx="${i}">${opt.t}</button>`).join("")}
    </div>
    <div class="qp-footer">
      <span>Score: ${activeScore}</span>
      <span class="qp-streak">${currentStreak > 1 ? `🔥 ${currentStreak} streak` : ""}</span>
      <span>${getCurrentUser()}</span>
    </div>
  `;

  container.querySelectorAll(".qp-opt").forEach((btn) => {
    btn.addEventListener("click", () => handleAnswer(parseInt(btn.dataset.idx, 10)));
  });

  const timerBar = document.getElementById("qpTimerBar");
  questionTimer = setInterval(() => {
    timeLeft -= 0.1;
    timerBar.style.width = `${Math.max(0, (timeLeft / QUESTION_SECONDS) * 100)}%`;
    if (timeLeft <= 0) {
      clearInterval(questionTimer);
      handleAnswer(-1); // time's up — counts as no answer
    }
  }, 100);
}

function handleAnswer(choiceIdx) {
  clearInterval(questionTimer);
  const q = activeRound[activeIndex];
  const correctIdx = q.options.findIndex((o) => o.c);
  const buttons = document.querySelectorAll(".qp-opt");
  buttons.forEach((b) => (b.disabled = true));
  buttons[correctIdx].classList.add("qp-correct");
  if (choiceIdx !== correctIdx) {
    if (choiceIdx >= 0) buttons[choiceIdx].classList.add("qp-wrong");
    currentStreak = 0;
  } else {
    activeScore++;
    currentStreak++;
    bestStreak = Math.max(bestStreak, currentStreak);
  }

  setTimeout(() => {
    activeIndex++;
    if (activeIndex < activeRound.length) {
      renderQuestion();
    } else {
      finishQuiz();
    }
  }, 900);
}

function getBadge(pct) {
  if (pct >= 90) return { label: "Gold Brainiac", emoji: "🥇" };
  if (pct >= 70) return { label: "Silver Scholar", emoji: "🥈" };
  if (pct >= 50) return { label: "Bronze Thinker", emoji: "🥉" };
  return { label: "Keep Practicing", emoji: "📘" };
}

async function finishQuiz() {
  const total = activeRound.length;
  const username = getCurrentUser();

  await submitAttempt({
    username,
    quiz_slug: activeQuiz.slug,
    quiz_title: activeQuiz.title,
    score: activeScore,
    total,
    taken_at: new Date().toISOString(),
  });

  const pct = Math.round((activeScore / total) * 100);
  const badge = getBadge(pct);
  const container = document.getElementById("quizPlay");
  container.innerHTML = `
    <div class="qp-result">
      <p class="qp-tag">${activeQuiz.title} — complete</p>
      <div class="qp-result-badge">${badge.emoji}</div>
      <div class="qp-result-score">${activeScore}/${total}</div>
      <p class="qp-result-badge-label">${badge.label}</p>
      <p class="qp-result-label">${pct}% correct${bestStreak > 1 ? ` · best streak ${bestStreak}` : ""}. Nice work, ${escapeHtml(username)}. Play again for a fresh set of questions.</p>
      <button class="btn btn-primary" id="qpDone">See leaderboard</button>
    </div>
  `;
  document.getElementById("qpDone").addEventListener("click", async () => {
    closeQuizModal();
    await renderLeaderboard();
    await updateHeroStats();
    document.getElementById("leaderboard").scrollIntoView({ behavior: "smooth" });
  });
}

/* close modals with backdrop click or Escape */
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) e.target.classList.remove("open");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal.open").forEach((m) => m.classList.remove("open"));
  }
});
