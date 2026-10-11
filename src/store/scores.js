// Local leaderboard (top 10) and lifetime stats, saved in the browser's localStorage.
// To make it global later, replace these functions with calls to your backend.

const SCORES_KEY = 'ironwalk.scores.v1';
const LIFETIME_KEY = 'ironwalk.lifetime.v1';
const MAX = 10;

function read(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: play on without saving */ }
}

export function loadScores() {
  const list = read(SCORES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function qualifies(score) {
  const list = loadScores();
  return score > 0 && (list.length < MAX || score > list[list.length - 1].score);
}

export function saveScore({ initials, score, wave, kills, accuracy, reached, mode }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    initials: (initials || '???').toUpperCase().slice(0, 3),
    score, wave, kills, accuracy, reached: reached || `Wave ${wave}`, mode: mode || 'campaign',
    date: new Date().toISOString().slice(0, 10),
  };
  const list = [...loadScores(), entry].sort((a, b) => b.score - a.score).slice(0, MAX);
  write(SCORES_KEY, list);
  return { list, id: entry.id, rank: list.findIndex((e) => e.id === entry.id) + 1 };
}

export function clearScores() { write(SCORES_KEY, []); }

export function loadLifetime() {
  return read(LIFETIME_KEY, { runs: 0, kills: 0, bestWave: 0, timePlayed: 0 });
}

export function recordRun(run) {
  const l = loadLifetime();
  const next = {
    runs: l.runs + 1,
    kills: l.kills + run.totalKills,
    bestWave: Math.max(l.bestWave, run.wave),
    timePlayed: l.timePlayed + run.time,
  };
  write(LIFETIME_KEY, next);
  return next;
}
