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
let activeCategory = "all";
let activeQuiz = null;
let activeRound = [];
let activeIndex = 0;
let activeScore = 0;
let usingLiveApi = false;

/* ---------------- boot ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadQuizzes();
  renderFilterChips();
  renderQuizGrid(ALL_QUIZZES);
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
      <div class="quiz-card-media">${quiz.title.charAt(0)}</div>
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
    btn.onclick = openLoginModal;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------- login modal ---------------- */
function openLoginModal() {
  document.getElementById("loginModal").classList.add("open");
  document.getElementById("username").focus();
}
function closeLoginModal() {
  document.getElementById("loginModal").classList.remove("open");
}
function loginUser() {
  const input = document.getElementById("username");
  const name = input.value.trim();
  const note = document.getElementById("loginNote");
  if (name.length < 2) {
    note.textContent = "Enter at least 2 characters.";
    note.style.color = "var(--coral)";
    return;
  }
  setCurrentUser(name);
  note.textContent = `Welcome, ${name}! You're ready to play.`;
  note.style.color = "var(--teal)";
  updateHeaderForUser();
  setTimeout(closeLoginModal, 700);
}

/* ---------------- quiz engine ---------------- */
function startQuiz(slug) {
  const quiz = ALL_QUIZZES.find((q) => q.slug === slug);
  if (!quiz) return;

  if (!getCurrentUser()) {
    openLoginModal();
    return;
  }

  activeQuiz = quiz;
  activeRound = buildRound(quiz);
  activeIndex = 0;
  activeScore = 0;
  document.getElementById("quizModal").classList.add("open");
  renderQuestion();
}

function closeQuizModal() {
  document.getElementById("quizModal").classList.remove("open");
  activeQuiz = null;
}

function renderQuestion() {
  const container = document.getElementById("quizPlay");
  const q = activeRound[activeIndex];
  const progressPct = Math.round((activeIndex / activeRound.length) * 100);

  container.innerHTML = `
    <div class="qp-progress"><div class="qp-progress-bar" style="width:${progressPct}%"></div></div>
    <p class="qp-tag">${activeQuiz.title} · Question ${activeIndex + 1} of ${activeRound.length}</p>
    <p class="qp-question">${q.text}</p>
    <div class="qp-options">
      ${q.options.map((opt, i) => `<button class="qp-opt" data-idx="${i}">${opt.t}</button>`).join("")}
    </div>
    <div class="qp-footer"><span>Score: ${activeScore}</span><span>${getCurrentUser()}</span></div>
  `;

  container.querySelectorAll(".qp-opt").forEach((btn) => {
    btn.addEventListener("click", () => handleAnswer(parseInt(btn.dataset.idx, 10)));
  });
}

function handleAnswer(choiceIdx) {
  const q = activeRound[activeIndex];
  const correctIdx = q.options.findIndex((o) => o.c);
  const buttons = document.querySelectorAll(".qp-opt");
  buttons.forEach((b) => (b.disabled = true));
  buttons[correctIdx].classList.add("qp-correct");
  if (choiceIdx !== correctIdx) {
    buttons[choiceIdx].classList.add("qp-wrong");
  } else {
    activeScore++;
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
  const container = document.getElementById("quizPlay");
  container.innerHTML = `
    <div class="qp-result">
      <p class="qp-tag">${activeQuiz.title} — complete</p>
      <div class="qp-result-score">${activeScore}/${total}</div>
      <p class="qp-result-label">${pct}% correct. Nice work, ${escapeHtml(username)}. Play again for a fresh set of questions.</p>
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
