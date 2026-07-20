/* ==========================================================================
   Shared logic for the standalone auth pages: login.html, register.html,
   forgot-password.html, reset-password.html. Mirrors the API calls used to
   live in script.js's modal-based auth flow, just split into real pages.
   ========================================================================== */

const API_BASE_URL = "https://main-quiz-websites.onrender.com"; // keep in sync with script.js — set to your backend URL once deployed

function getCurrentUser() {
  return localStorage.getItem("bq_current_user");
}
function setCurrentUser(name) {
  localStorage.setItem("bq_current_user", name);
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function showNote(el, message, isError) {
  el.textContent = message;
  el.style.color = isError ? "var(--coral)" : "var(--teal)";
}

/* ---------------- login.html ---------------- */
function initLoginPage() {
  const backendOffline = !API_BASE_URL;
  if (backendOffline) {
    document.getElementById("authOfflineNotice").hidden = false;
    document.getElementById("authForm").hidden = true;
    return;
  }
  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = document.getElementById("authIdentifier").value.trim();
    const password = document.getElementById("authPassword").value;
    const note = document.getElementById("authNote");
    try {
      const user = await apiPost("/api/login", { identifier, password });
      setCurrentUser(user.username);
      showNote(note, `Welcome back, ${user.username}! Redirecting…`, false);
      setTimeout(() => (window.location.href = "index.html"), 700);
    } catch (err) {
      showNote(note, err.message, true);
    }
  });
}

/* ---------------- register.html ---------------- */
function initRegisterPage() {
  const backendOffline = !API_BASE_URL;
  if (backendOffline) {
    document.getElementById("authOfflineNotice").hidden = false;
    document.getElementById("authForm").hidden = true;
    return;
  }
  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("authUsername").value.trim();
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const note = document.getElementById("authNote");
    try {
      await apiPost("/api/register", { username, email, password });
      showNote(note, "Account created! Redirecting to log in…", false);
      setTimeout(() => (window.location.href = "login.html"), 900);
    } catch (err) {
      showNote(note, err.message, true);
    }
  });
}

/* ---------------- forgot-password.html ---------------- */
function initForgotPage() {
  const backendOffline = !API_BASE_URL;
  if (backendOffline) {
    document.getElementById("authOfflineNotice").hidden = false;
    document.getElementById("authForm").hidden = true;
    return;
  }
  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const note = document.getElementById("authNote");
    try {
      const result = await apiPost("/api/forgot-password", { email });
      showNote(note, result.message, false);
    } catch (err) {
      showNote(note, err.message, true);
    }
  });
}

/* ---------------- reset-password.html ---------------- */
function initResetPage() {
  const token = new URLSearchParams(window.location.search).get("reset_token");
  const note = document.getElementById("authNote");
  if (!token) {
    document.getElementById("authForm").hidden = true;
    showNote(note, "This page needs a reset link from your email — check the link you clicked.", true);
    return;
  }
  const backendOffline = !API_BASE_URL;
  if (backendOffline) {
    document.getElementById("authOfflineNotice").hidden = false;
    document.getElementById("authForm").hidden = true;
    return;
  }
  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById("authPassword").value;
    try {
      await apiPost("/api/reset-password", { token, newPassword });
      showNote(note, "Password updated! Redirecting to log in…", false);
      setTimeout(() => (window.location.href = "login.html"), 900);
    } catch (err) {
      showNote(note, err.message, true);
    }
  });
}
