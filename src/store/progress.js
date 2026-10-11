// Campaign progress, saved loadout and per-mission best scores (localStorage).
import { DEFAULT_LOADOUT, sanitizeLoadout } from '../game/loadout.js';

const KEY = 'ironwalk.progress.v1';

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === 'object') return { cleared: 0, loadout: DEFAULT_LOADOUT, best: {}, ...v };
  } catch { /* fall through */ }
  return { cleared: 0, loadout: DEFAULT_LOADOUT, best: {} };
}
function write(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ } }

export function loadProgress() {
  const p = read();
  return { ...p, loadout: sanitizeLoadout(p.loadout, p.cleared) };
}

export function saveLoadout(loadout) {
  const p = read(); p.loadout = loadout; write(p);
}

// Returns the new cleared count (missions are cleared in order).
export function markCleared(levelIndex) {
  const p = read();
  p.cleared = Math.max(p.cleared, levelIndex + 1);
  write(p);
  return p.cleared;
}

export function recordMissionBest(levelId, score) {
  const p = read();
  if (!p.best[levelId] || score > p.best[levelId]) { p.best[levelId] = score; write(p); return true; }
  return false;
}

export function resetProgress() { write({ cleared: 0, loadout: DEFAULT_LOADOUT, best: {} }); }
