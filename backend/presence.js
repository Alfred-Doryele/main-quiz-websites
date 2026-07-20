// Presence and live Challenge Rooms are intentionally kept in memory rather
// than in MySQL/PostgreSQL/MongoDB. Both are short-lived, right-now data —
// "who's online in the last minute" and "what's happening in this specific
// live match" — not historical records anyone needs after the fact. Storing
// them in a database would mean extra tables, extra queries, and extra load
// for data nobody looks up again once the match ends. A simple in-memory
// store on the server is the right tool for this job.
//
// One tradeoff worth knowing: on Render's free tier, if the server has been
// asleep and wakes back up, this memory is empty again. That only matters
// if a match is actively in progress during a restart, which is rare.

const ONLINE_WINDOW_MS = 60 * 1000; // considered "online" if seen in the last 60s
const ROOM_TTL_MS = 30 * 60 * 1000; // rooms auto-expire after 30 minutes

const presence = new Map(); // username -> last seen timestamp (ms)
const rooms = new Map(); // code -> room object

function ping(username) {
  presence.set(username, Date.now());
}

function getOnlineUsers() {
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  const online = [];
  for (const [username, lastSeen] of presence.entries()) {
    if (lastSeen >= cutoff) online.push(username);
    else presence.delete(username);
  }
  return online;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRound(quiz) {
  const roundSize = Math.min(quiz.round_size || 5, quiz.questions.length);
  const chosen = shuffle(quiz.questions).slice(0, roundSize);
  return chosen.map((q) => ({ id: q.id, text: q.text, options: shuffle(q.options) }));
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function createRoom({ hostUsername, quiz }) {
  const code = generateCode();
  const room = {
    code,
    hostUsername,
    quizSlug: quiz.slug,
    quizTitle: quiz.title,
    isRiddle: !!quiz.is_riddle,
    questions: buildRound(quiz),
    status: "waiting", // waiting -> active -> finished
    players: new Map([[hostUsername, { score: null, total: null, finished: false, joinedAt: Date.now() }]]),
    createdAt: Date.now(),
    startedAt: null,
  };
  rooms.set(code, room);
  return room;
}

function joinRoom(code, username) {
  const room = rooms.get(code);
  if (!room) throw new Error("No challenge found with that code");
  if (room.status !== "waiting") throw new Error("This challenge has already started");
  if (!room.players.has(username)) {
    room.players.set(username, { score: null, total: null, finished: false, joinedAt: Date.now() });
  }
  return room;
}

function startRoom(code, username) {
  const room = rooms.get(code);
  if (!room) throw new Error("No challenge found with that code");
  if (room.hostUsername !== username) throw new Error("Only the host can start this challenge");
  room.status = "active";
  room.startedAt = Date.now();
  return room;
}

function finishRoom(code, username, score, total) {
  const room = rooms.get(code);
  if (!room) throw new Error("No challenge found with that code");
  const player = room.players.get(username);
  if (!player) throw new Error("You are not in this challenge");
  player.score = score;
  player.total = total;
  player.finished = true;
  if ([...room.players.values()].every((p) => p.finished)) {
    room.status = "finished";
  }
  return room;
}

function serializeRoom(room, { includeQuestions } = {}) {
  const players = [...room.players.entries()]
    .map(([username, p]) => ({
      username,
      score: p.score,
      total: p.total,
      finished: p.finished,
      percentage: p.finished && p.total ? Math.round((p.score / p.total) * 100) : null,
    }))
    .sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1));

  return {
    code: room.code,
    hostUsername: room.hostUsername,
    quizTitle: room.quizTitle,
    isRiddle: room.isRiddle,
    status: room.status,
    players,
    questions: includeQuestions ? room.questions : undefined,
  };
}

// Periodic cleanup of stale rooms and offline presence entries.
setInterval(() => {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [code, room] of rooms.entries()) {
    if (room.createdAt < cutoff) rooms.delete(code);
  }
  getOnlineUsers(); // also prunes stale presence entries as a side effect
}, 5 * 60 * 1000);

module.exports = {
  ping,
  getOnlineUsers,
  createRoom,
  joinRoom,
  startRoom,
  finishRoom,
  serializeRoom,
  rooms,
};
