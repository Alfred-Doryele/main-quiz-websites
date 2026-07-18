/* ==========================================================================
   Brainiac Quizzes — app logic
   Data is intentionally shaped the way it would look coming out of a real
   database: quizzes -> questions -> choices, and attempts -> scores.
   That's the same shape used in database/mysql_schema.sql,
   database/postgresql_schema.sql and database/mongodb_setup.js.
   Right now everything is stored in localStorage as a stand-in for a real
   backend. Swap the three functions marked "DATA LAYER" for real fetch()
   calls once you wire up a server, and nothing else needs to change.
   ========================================================================== */

const QUIZZES = [
  {
    id: "maths-iq",
    tag: "Logic",
    title: "IQ Test: Maths",
    description: "Sharpen your mental arithmetic and pattern spotting.",
    minutes: 3,
    questions: [
      { q: "What is 12 × 8?", options: ["96", "88", "108", "86"], answer: 0 },
      { q: "Next number: 2, 4, 8, 16, ?", options: ["24", "32", "20", "18"], answer: 1 },
      { q: "What is 15% of 200?", options: ["25", "35", "30", "20"], answer: 2 },
      { q: "If x + 7 = 15, what is x?", options: ["7", "9", "8", "6"], answer: 2 },
      { q: "What is the square root of 144?", options: ["12", "14", "11", "13"], answer: 0 },
    ],
  },
  {
    id: "family-quiz",
    tag: "Lifestyle",
    title: "Family Quiz",
    description: "Fun questions about family life, traditions, and bonds.",
    minutes: 2,
    questions: [
      { q: "What is traditionally the 'head' role in many families?", options: ["Youngest child", "Parent/guardian", "Neighbour", "Pet"], answer: 1 },
      { q: "A gathering of extended family is often called a...", options: ["Reunion", "Meeting", "Session", "Conference"], answer: 0 },
      { q: "Which of these is a common family bonding activity?", options: ["Filing taxes separately", "Eating meals together", "Avoiding each other", "Working night shifts"], answer: 1 },
      { q: "What do many families celebrate yearly to mark someone's birth?", options: ["Anniversary", "Birthday", "Graduation", "Promotion"], answer: 1 },
    ],
  },
  {
    id: "science-quiz",
    tag: "STEM",
    title: "Science Quiz",
    description: "From chemistry to biology — how sharp is your science?",
    minutes: 3,
    questions: [
      { q: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2 },
      { q: "What is H2O more commonly known as?", options: ["Salt", "Water", "Sugar", "Oxygen"], answer: 1 },
      { q: "Which organ pumps blood around the body?", options: ["Lungs", "Liver", "Heart", "Kidney"], answer: 2 },
      { q: "What force pulls objects toward Earth?", options: ["Magnetism", "Gravity", "Friction", "Tension"], answer: 1 },
      { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1 },
    ],
  },
  {
    id: "intelligence-quiz",
    tag: "Trivia",
    title: "Intelligence Quiz",
    description: "General knowledge questions covering the world's sharpest minds.",
    minutes: 2,
    questions: [
      { q: "Who developed the theory of relativity?", options: ["Isaac Newton", "Albert Einstein", "Nikola Tesla", "Galileo Galilei"], answer: 1 },
      { q: "IQ stands for which of these?", options: ["Intelligence Quotient", "Instant Question", "Inner Quality", "Intellect Quality"], answer: 0 },
      { q: "Which of these is a sign of critical thinking?", options: ["Accepting all claims blindly", "Questioning evidence", "Ignoring facts", "Avoiding new ideas"], answer: 1 },
      { q: "Chess is often used to measure which skill?", options: ["Strength", "Strategic thinking", "Speed", "Memory only"], answer: 1 },
    ],
  },
];

/* ---------------- DATA LAYER (swap for API calls later) ---------------- */
function getCurrentUser() {
  return localStorage.getItem("bq_current_user");
}
function setCurrentUser(name) {
  localStorage.setItem("bq_current_user", name);
}
function getAttempts() {
  return JSON.parse(localStorage.getItem("bq_attempts") || "[]");
}
function saveAttempt(attempt) {
  const attempts = getAttempts();
  attempts.push(attempt); // shape: { username, quiz_id, quiz_title, score, total, taken_at }
  localStorage.setItem("bq_attempts", JSON.stringify(attempts));
}
/* ------------------------------------------------------------------------ */

let activeQuiz = null;
let activeIndex = 0;
let activeScore = 0;

document.addEventListener("DOMContentLoaded", () => {
  renderQuizGrid(QUIZZES);
  renderLeaderboard();
  updateHeaderForUser();
  updateHeroStats();

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

/* ---------------- rendering ---------------- */
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
          <span>${quiz.questions.length} questions</span>
          <span>~${quiz.minutes} min</span>
        </div>
        <button class="btn btn-primary btn-block" data-quiz="${quiz.id}">Play</button>
      </div>`;
    card.querySelector("button").addEventListener("click", () => startQuiz(quiz.id));
    grid.appendChild(card);
  });
}

function renderLeaderboard() {
  const body = document.getElementById("leaderboardBody");
  const attempts = getAttempts();

  if (attempts.length === 0) {
    body.innerHTML = `<tr class="empty-row"><td colspan="4">No scores yet — be the first on the board.</td></tr>`;
    return;
  }

  const ranked = [...attempts].sort((a, b) => b.score / b.total - a.score / a.total).slice(0, 10);
  body.innerHTML = ranked
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

function updateHeroStats() {
  const attempts = getAttempts();
  const players = new Set(attempts.map((a) => a.username)).size;
  const top = attempts.length ? Math.max(...attempts.map((a) => Math.round((a.score / a.total) * 100))) : null;
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

/* ---------------- search ---------------- */
function searchQuizzes() {
  const term = document.getElementById("searchBar").value.trim().toLowerCase();
  const filtered = QUIZZES.filter(
    (q) => q.title.toLowerCase().includes(term) || q.tag.toLowerCase().includes(term) || q.description.toLowerCase().includes(term)
  );
  renderQuizGrid(filtered);
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
function startQuiz(quizId) {
  const quiz = QUIZZES.find((q) => q.id === quizId);
  if (!quiz) return;

  if (!getCurrentUser()) {
    openLoginModal();
    return;
  }

  activeQuiz = quiz;
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
  const quiz = activeQuiz;
  const q = quiz.questions[activeIndex];
  const progressPct = Math.round((activeIndex / quiz.questions.length) * 100);

  container.innerHTML = `
    <div class="qp-progress"><div class="qp-progress-bar" style="width:${progressPct}%"></div></div>
    <p class="qp-tag">${quiz.title} · Question ${activeIndex + 1} of ${quiz.questions.length}</p>
    <p class="qp-question">${q.q}</p>
    <div class="qp-options">
      ${q.options.map((opt, i) => `<button class="qp-opt" data-idx="${i}">${opt}</button>`).join("")}
    </div>
    <div class="qp-footer"><span>Score: ${activeScore}</span><span>${getCurrentUser()}</span></div>
  `;

  container.querySelectorAll(".qp-opt").forEach((btn) => {
    btn.addEventListener("click", () => handleAnswer(parseInt(btn.dataset.idx, 10)));
  });
}

function handleAnswer(choiceIdx) {
  const q = activeQuiz.questions[activeIndex];
  const buttons = document.querySelectorAll(".qp-opt");
  buttons.forEach((b) => (b.disabled = true));
  buttons[q.answer].classList.add("qp-correct");
  if (choiceIdx !== q.answer) {
    buttons[choiceIdx].classList.add("qp-wrong");
  } else {
    activeScore++;
  }

  setTimeout(() => {
    activeIndex++;
    if (activeIndex < activeQuiz.questions.length) {
      renderQuestion();
    } else {
      finishQuiz();
    }
  }, 900);
}

function finishQuiz() {
  const total = activeQuiz.questions.length;
  const username = getCurrentUser();

  saveAttempt({
    username,
    quiz_id: activeQuiz.id,
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
      <p class="qp-result-label">${pct}% correct. Nice work, ${escapeHtml(username)}.</p>
      <button class="btn btn-primary" id="qpDone">See leaderboard</button>
    </div>
  `;
  document.getElementById("qpDone").addEventListener("click", () => {
    closeQuizModal();
    renderLeaderboard();
    updateHeroStats();
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
