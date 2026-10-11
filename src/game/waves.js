// Mission director: runs the wave list for a mission, then the boss stage, supply drops and victory.
// Endless mode generates waves forever with a boss every `bossEvery` waves. Missions with boss: null
// (pilot-only side ops) end in victory after the last wave.
import { WAVES } from './config.js';
import { endlessWave } from './levels.js';
import { BOSSES } from './bosses.js';
import { rand } from './util.js';

export function createWaves(ctx) {
  const W = { state: 'idle', idx: 0, queue: [], spawnT: 0, timer: 0, supplyT: 0, level: null, endless: false };

  const totalWaves = () => (W.endless ? Infinity : W.level.waves.length);

  function difficulty() {
    return W.endless ? W.idx * 0.8 : (W.level.difficultyBase ?? W.level.index * 2) + W.idx * 0.6;
  }

  function start(level) {
    W.level = level; W.endless = !level.waves; W.idx = 0; W.queue = [];
    W.state = 'starting'; W.timer = 1.4;
    ctx.G.difficulty = difficulty();
    level.caches.forEach(([x, y, type]) => ctx.pickups.spawn(type, x, y, { cache: true }));
    // stashes in secret areas: only the pilot on foot can collect these
    (level.secretLoot || []).forEach(([x, y, type]) => ctx.pickups.spawn(type, x, y, { pilotOnly: true }));
  }

  function beginWave() {
    W.idx++;
    ctx.G.difficulty = difficulty();
    ctx.run.wave = W.idx;
    if (W.endless && W.idx % W.level.bossEvery === 0) {
      const rot = W.level.bossRotation;
      const type = rot[(W.idx / W.level.bossEvery - 1) % rot.length];
      W.state = 'preboss'; W.timer = 1.5; W.bossType = type;
      ctx.banner(`Wave ${String(W.idx).padStart(2, '0')}`, `Boss wave · ${BOSSES[type].name}`);
      return;
    }
    const comp = W.endless ? endlessWave(W.idx) : W.level.waves[W.idx - 1];
    const q = [];
    for (let i = 0; i < comp.drone; i++) q.push('drone');
    for (let i = 0; i < comp.crawler; i++) q.push('crawler');
    q.sort(() => Math.random() - 0.5);
    W.queue = q; W.spawnT = 0.8; W.state = 'wave';
    const big = W.endless ? `Wave ${String(W.idx).padStart(2, '0')}` : `Wave ${W.idx} / ${totalWaves()}`;
    ctx.banner(big, `${comp.drone} drones · ${comp.crawler} crawlers`);
    W.supplyT = W.idx >= 2 ? 1.8 : -1; // one supply drop shortly after each wave from wave 2 on
  }

  function waveCleared() {
    repair(WAVES.repairOnClear);
    const bonus = Math.round(WAVES.clearBonus * (1 + ctx.G.difficulty));
    ctx.score.add(bonus);
    ctx.audio.sfx('clear');
    const lastWave = !W.endless && W.idx >= totalWaves();
    if (lastWave && !W.level.boss) {
      W.state = 'victory'; W.timer = 3;
      ctx.banner('Area secured', `Bonus +${bonus.toLocaleString()} · extraction inbound`, 2600);
    } else if (lastWave) {
      W.state = 'preboss'; W.timer = 3.4; W.bossType = W.level.boss;
      ctx.banner('Sector clear', `Bonus +${bonus.toLocaleString()} · large contact approaching`, 2600);
    } else {
      W.state = 'break'; W.timer = WAVES.breakSeconds;
      ctx.banner('Sector clear', `Bonus +${bonus.toLocaleString()} · field repairs +${WAVES.repairOnClear}`);
    }
  }

  // field repairs go to the frame (even parked) and to the pilot if on foot
  function repair(n) {
    ctx.player.heal(n);
    if (ctx.S && ctx.S.active) ctx.pilot.heal(n);
  }

  function update(dt) {
    if (ctx.T.dead) return;
    switch (W.state) {
      case 'starting':
      case 'break':
        W.timer -= dt; if (W.timer <= 0) beginWave(); break;
      case 'wave':
        if (W.supplyT > 0) { W.supplyT -= dt; if (W.supplyT <= 0) ctx.pickups.supplyDrop(); }
        if (W.queue.length) { W.spawnT -= dt; if (W.spawnT <= 0) { ctx.director.spawn(W.queue.shift()); W.spawnT = rand(0.9, 1.6); } }
        else if (ctx.director.count() === 0) waveCleared();
        break;
      case 'preboss':
        W.timer -= dt;
        if (W.timer <= 0) { ctx.director.spawn(W.bossType); W.state = 'boss'; W.supplyT = WAVES.bossSupplyEvery * 0.6; }
        break;
      case 'boss':
        W.supplyT -= dt;
        if (W.supplyT <= 0) { W.supplyT = WAVES.bossSupplyEvery; ctx.pickups.supplyDrop(); }
        break;
      case 'victory':
        W.timer -= dt; if (W.timer <= 0) { W.state = 'done'; ctx.onMissionComplete(); }
        break;
      default: break;
    }
  }

  // called by the director when a boss dies
  function bossDefeated() {
    if (ctx.director.count() > 0) for (const e of ctx.enemies) if (!e.dead && !e.isBoss) ctx.director.kill(e, 'cleanup');
    if (W.endless) { W.state = 'break'; W.timer = WAVES.breakSeconds + 2; repair(50); }
    else { W.state = 'victory'; W.timer = 4.2; }
  }

  function label() {
    if (W.state === 'boss' || W.state === 'preboss' && W.timer < 2) return 'Boss';
    if (W.idx === 0) return 'Deploying';
    return W.endless ? `Wave ${W.idx}` : `Wave ${W.idx}/${totalWaves()}`;
  }

  return {
    start, update, bossDefeated, label, get wave() { return W.idx; },
    get state() { return W.state; },
    set state(v) { W.state = v; }, // test hook: 'idle' parks the director
  };
}
