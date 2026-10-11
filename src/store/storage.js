// Browser storage helpers: safe localStorage access, player settings,
// and a one-time copy of saves from the game's old name (ironwake.*) to the new one (ironwalk.*).

const PREFIX = 'ironwalk.';
const LEGACY_PREFIX = 'ironwake.';
const SETTINGS_KEY = `${PREFIX}settings.v1`;
const DEFAULT_SETTINGS = { minimap: true, muted: false };

export function readJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}

export function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: keep playing without saving */ }
}

// Copies any ironwake.* save (scores, progress, initials) to ironwalk.* unless the new key already exists.
export function migrateLegacyKeys() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    for (const k of keys) {
      if (!k || !k.startsWith(LEGACY_PREFIX)) continue;
      const next = PREFIX + k.slice(LEGACY_PREFIX.length);
      if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(k));
    }
  } catch { /* storage blocked */ }
}

export function loadSettings() {
  const s = readJSON(SETTINGS_KEY, {});
  return { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
}

export function saveSettings(patch) {
  writeJSON(SETTINGS_KEY, { ...loadSettings(), ...patch });
}
