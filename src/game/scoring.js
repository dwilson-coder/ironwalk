// Run statistics, kill combos and score popups.
import { SCORING } from './config.js';
import { events } from '../store/gameStore.js';

export function newRun() {
  return {
    score: 0, time: 0,
    kills: { drone: 0, crawler: 0, boss: 0, total: 0 },
    shots: 0, hits: 0, rockets: 0, damageTaken: 0,
    combo: 0, maxCombo: 0, lastKill: -99,
    stomps: 0, stompKills: 0, pickups: 0,
    bosses: [], missions: 0, wave: 0, reached: '',
    lives: 0, secrets: 0, framesLost: 0, ejects: 0,
  };
}

export function createScoring(ctx) {
  const run = () => ctx.run;

  function multiplier() {
    const r = run();
    return Math.min(SCORING.maxMultiplier, 1 + Math.floor(Math.max(0, r.combo - 1) / SCORING.killsPerStep) * SCORING.stepSize);
  }

  function kill(e, source) {
    const r = run(), now = ctx.G.time;
    const prev = multiplier();
    r.combo = now - r.lastKill <= SCORING.comboWindow ? r.combo + 1 : 1;
    r.lastKill = now; r.maxCombo = Math.max(r.maxCombo, r.combo);
    const mult = multiplier();
    let pts = Math.round(e.score * mult);
    if (e.isBoss) {
      r.kills.boss++;
      r.bosses.push({ name: e.name, time: e.fightTime, flawless: e.hitsTaken === 0 });
      if (e.hitsTaken === 0) pts += SCORING.noDamageBossBonus;
    } else r.kills[e.type] = (r.kills[e.type] || 0) + 1;
    r.kills.total++;
    r.score += pts;
    if (source === 'stomp') r.stompKills++;
    if (mult > prev) { ctx.audio.sfx('combo'); events.emit('combo', { multiplier: mult }); }
    events.emit('popup', { ...ctx.toScreen(e.x, e.y + e.cy + (e.isBoss ? 4 : 1.8)), text: `+${pts.toLocaleString()}`, mult, kind: e.isBoss ? 'boss' : e.type });
    return pts;
  }

  function tick() {
    const r = run();
    if (r.combo && ctx.G.time - r.lastKill > SCORING.comboWindow) r.combo = 0;
  }

  return {
    multiplier, kill, tick,
    shot(n = 1) { run().shots += n; },
    hit(n = 1) { run().hits += n; },
    add(points) { run().score += points; },
    comboTime() { const r = run(); return r.combo ? Math.max(0, 1 - (ctx.G.time - r.lastKill) / SCORING.comboWindow) : 0; },
    snapshot() { return JSON.parse(JSON.stringify(run())); },
  };
}
