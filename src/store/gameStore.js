// Tiny external store that bridges the 60fps game engine and React.
// The engine writes; React components subscribe with useGame(selector).
// Selectors must return existing references (e.g. s => s.hud), never build new objects.
import { useSyncExternalStore } from 'react';

const listeners = new Set();

export const initialHud = {
  hull: 100, maxHull: 100, heat: 0, venting: false, fuel: 100,
  waveLabel: 'Deploying', mission: '', wave: 0, score: 0, combo: 0, multiplier: 1, comboTime: 0,
  primary: '', secondary: '', secId: 'seeker', secReady: 1, secCooldown: 0, barrier: 0,
  callsign: '', mechName: '', skillName: '', skillActive: 0, skillCooldown: 0, skillReady: 1,
  dashReady: 1, buffs: [], boss: null, status: 'Online',
  // Phase 3: force field meter, extra lives, pickup rockets
  shield: 0, shieldT: 0, contT: 0, lives: 0, ammoType: null, ammo: 0, ammoLabel: '', ammoColor: '',
  // Phase 4: pilot on foot
  onFoot: false, pilotHp: 100, pilotMaxHp: 100, pilotDead: false, sidearm: '', mechMode: 'piloted', replaceT: 0, pilotOnly: false, prompt: null, secrets: 0,
};

let state = {
  // loading | title | missions | pilot | hangar | briefing | playing | paused | debrief | over
  phase: 'loading',
  load: { progress: 0, stage: 'Booting', log: [], done: false },
  hud: initialHud,
  banner: null, // { id, big, sub, ms }
  bossIntro: null, // { id, name, title, sub }
  briefing: null, // mission loading screen state
  debrief: null, // mission complete stats
  result: null, // final run stats on game over
  pending: null, // mission waiting for launch from the hangar: { mode, levelIndex }
  loadout: null,
  progress: { cleared: 0, best: {} },
  muted: false,
  minimap: true, // mini map visible during missions (M)
  touch: false,
};

export const store = {
  get: () => state,
  set(patch) {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  },
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
};

export function useGame(selector) {
  const snap = () => selector(store.get());
  return useSyncExternalStore(store.subscribe, snap, snap);
}

// Fire-and-forget events for one-off motion graphics (score popups, damage flashes).
const eventListeners = {};
export const events = {
  on(type, fn) { (eventListeners[type] ||= new Set()).add(fn); return () => eventListeners[type].delete(fn); },
  emit(type, payload) { eventListeners[type]?.forEach((fn) => fn(payload)); },
};
