// IRONWALK engine: owns the renderer, the shared game context (ctx) and the flow between screens.
// Gameplay systems live in their own modules and talk to each other only through ctx:
//   ctx.player (mech) · ctx.pilot (on foot) · ctx.support (shield / lives / weapon drops) · ctx.weapons
//   ctx.director (enemies + bosses) · ctx.pickups · ctx.waves · ctx.score · ctx.fx · ctx.audio
// ctx.T is "whatever the player currently controls" (the mech, or the pilot on foot). Enemies, bosses, bolts and
// pickups only ever look at ctx.T and call ctx.hurtTarget / knockTarget / healTarget.
// React never touches the scene; it reads the store and calls the methods returned at the bottom.
import * as THREE from 'three';
import { SCORING, PICKUPS, PILOT, PLAYER, MECH_REPLACEMENT_SECONDS, SECRET_BONUS } from './config.js';
import { LEVELS, resolveLevel } from './levels.js';
import { unlocksAt, sanitizeLoadout, stockLoadout, CHASSIS } from './loadout.js';
import { rand, clamp, lerp, nextFrame } from './util.js';
import { createTextures } from './textures.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { std, disposeTree, disposeMats } from './mech.js';
import { buildLevel } from './world.js';
import { createDirector, warmModels } from './enemies.js';
import { createPlayer } from './player.js';
import { createPilot } from './pilot.js';
import { createSupport } from './support.js';
import { createWeapons } from './weapons.js';
import { createPickups } from './pickups.js';
import { createWaves } from './waves.js';
import { createScoring, newRun } from './scoring.js';
import { createInput } from './input.js';
import { store, initialHud, events } from '../store/gameStore.js';
import { recordRun } from '../store/scores.js';
import { loadProgress, saveLoadout, markCleared, recordMissionBest } from '../store/progress.js';
import { loadSettings, saveSettings } from '../store/storage.js';

export function createEngine(canvas) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && !matchMedia('(pointer: fine)').matches);
  const saved = loadProgress();
  const settings = loadSettings();
  store.set({ touch: isTouch, loadout: saved.loadout, progress: { cleared: saved.cleared, best: saved.best }, muted: settings.muted, minimap: settings.minimap });

  const ctx = {
    isTouch, P: {}, G: { state: 'loading', time: 0, difficulty: 0, deathT: 0, replaceT: 0, chain: null },
    T: { x: 0, y: 0, cy: 2.7, h: 5, w: 1.5, vx: 0, dead: false, inv: 0, ground: true, face: 1, hp: 100, maxHp: 100, onFoot: false },
    run: newRun(), enemies: [], aimV: new THREE.Vector3(), world: null,
  };
  ctx.audio = createAudio();
  ctx.audio.setMuted(settings.muted);
  ctx.input = createInput(canvas, { onPause: () => togglePause(), onMute: () => toggleMute(), onMinimap: () => toggleMinimap() });

  const G = ctx.G, P = ctx.P;
  const cam = { x: 0, y: 6, z: 24, ly: 4.5, shake: 0 };
  let raf = 0, last = 0, hudT = 0, bannerId = 0, introId = 0, view = 'title';
  let mission = null; // { mode, level, startSnapshot }
  const projV = new THREE.Vector3();

  // ---------------------------------------------------------------- ctx services
  ctx.banner = (big, sub, ms = 2200) => store.set({ banner: { id: ++bannerId, big, sub, ms } });
  ctx.shake = (a) => { if (!reduceMotion) cam.shake = Math.min(1.6, cam.shake + a); };
  ctx.toScreen = (x, y, z = 0) => {
    projV.set(x, y, z).project(ctx.camera);
    return { x: (projV.x * 0.5 + 0.5) * innerWidth, y: (-projV.y * 0.5 + 0.5) * innerHeight };
  };
  ctx.bossIntro = (e, sub) => {
    store.set({ bossIntro: { id: ++introId, name: e.name, title: e.title, sub } });
    ctx.audio.sfx('bossIntro'); ctx.shake(0.6);
  };
  ctx.onBossDefeated = () => ctx.waves.bossDefeated();
  ctx.onMissionComplete = () => missionComplete();

  // ---------------------------------------------------------------- controlled body (mech or pilot)
  const onFoot = () => !!(ctx.S && ctx.S.active);
  function refreshTarget() {
    const T = ctx.T, S = ctx.S;
    if (S && S.active) {
      Object.assign(T, { x: S.x, y: S.y, cy: 1.0, h: PILOT.height, w: PILOT.halfWidth + 0.15, vx: S.vx, dead: S.dead, inv: S.inv, ground: S.ground, face: S.face, hp: S.hp, maxHp: S.maxHp, onFoot: true });
    } else {
      const sc = ctx.player ? ctx.player.stats.scale : 1;
      Object.assign(T, { x: P.x || 0, y: P.y || 0, cy: 2.7 * sc, h: 5 * sc, w: 1.5 * sc, vx: P.vx || 0, dead: !!P.dead || P.mode !== 'piloted', inv: P.inv || 0, ground: P.ground, face: P.face || 1, hp: P.hull, maxHp: P.maxHull, onFoot: false });
    }
  }
  ctx.refreshTarget = refreshTarget;
  ctx.hurtTarget = (d) => {
    if (ctx.support && ctx.support.invulnerable()) return;
    if (onFoot()) ctx.pilot.hurt(d); else ctx.player.hurt(d);
  };
  ctx.knockTarget = (vx, vy) => { if (onFoot()) ctx.pilot.knock(vx, vy); else ctx.player.knock(vx, vy); };
  ctx.healTarget = (n) => { if (onFoot()) ctx.pilot.heal(n); else ctx.player.heal(n); };
  ctx.avatarMuzzle = () => (onFoot() ? ctx.pilot.muzzle() : ctx.player.muzzle());
  ctx.camView = () => ({ x: cam.x, half: Math.tan((ctx.camera.fov * Math.PI) / 360) * cam.z * ctx.camera.aspect });

  // Mech destroyed with the pilot inside: the pilot auto-ejects at reduced health and has to survive until a
  // replacement frame drops in.
  ctx.onMechDestroyed = () => {
    const S = ctx.S;
    ctx.run.framesLost++;
    const hp = Math.min(S.hp, Math.ceil(S.maxHp * PILOT.autoEjectHealth));
    ctx.pilot.spawn(P.x, P.y + 3.5, { vx: -P.face * 4, vy: PILOT.ejectVelocity, hp });
    ctx.S.inv = 1.5;
    G.replaceT = MECH_REPLACEMENT_SECONDS;
    ctx.audio.sfx('eject');
    ctx.banner('Frame lost', `Pilot ejected · survive ${MECH_REPLACEMENT_SECONDS}s for a replacement frame`, 2600);
    refreshTarget();
  };
  ctx.onMechLanded = () => { ctx.banner('', 'Frame on the ground · press E beside it to board', 1800); };

  // Pilot killed: spend an extra life to continue right where you fell, or the run ends.
  ctx.onPilotKilled = () => {
    if (ctx.run.lives > 0) {
      ctx.run.lives--;
      const S = ctx.S, x = S.x;
      ctx.pilot.resetHealth();
      if (mission && mission.level.pilotOnly) ctx.pilot.spawn(x, S.y);
      else { ctx.pilot.hide(); ctx.player.reset(x, 'piloted'); G.replaceT = 0; }
      ctx.support.grantContinue();
      ctx.audio.sfx('life');
      ctx.banner('Extra life', `${ctx.run.lives} left · back in the fight`, 1800);
      refreshTarget();
    } else {
      G.deathT = 1.7;
    }
  };

  ctx.onSecretFound = (sec) => {
    ctx.run.secrets++;
    ctx.score.add(SECRET_BONUS);
    ctx.audio.sfx('secret');
    ctx.banner('Secret area', `${sec.label} · +${SECRET_BONUS}`, 1800);
    events.emit('popup', { ...ctx.toScreen(ctx.S.x, ctx.S.y + 3), text: `+${SECRET_BONUS} SECRET`, kind: 'pickup', color: '#ffc23a' });
  };

  function boardRange() { return PILOT.boardRange * (ctx.player.stats.scale || 1); }
  function nearParkedMech() {
    const S = ctx.S;
    return P.mode === 'parked' && !S.dead && Math.abs(S.x - P.x) < boardRange() && Math.abs(S.y - P.y) < 2.5 && !S.climb;
  }
  function nearLadder() {
    const S = ctx.S;
    return !S.climb && ctx.world.ladders.some((l) => Math.abs(S.x - l.x) < 0.75 && S.y >= l.y0 - 0.1 && S.y < l.y1 - 0.1);
  }

  // X: eject · E: board (touch: one MECH button does both)
  function interactions() {
    const { pressed } = ctx.input;
    const toggle = pressed('t_mech');
    if (!onFoot() && P.mode === 'piloted' && !P.dead && (pressed('KeyX') || toggle)) {
      if (mission && mission.level.pilotOnly) return;
      const hp = ctx.S.dead ? null : ctx.S.hp;
      ctx.player.eject();
      ctx.pilot.spawn(P.x - P.face * 0.8, P.y + 3.5, { vx: -P.face * 3, vy: PILOT.ejectVelocity, hp: hp || null });
      ctx.run.ejects++;
      ctx.audio.sfx('eject');
      ctx.banner('', 'Ejected · frame on auto-defend · E to board', 1500);
      refreshTarget();
      return;
    }
    if (onFoot() && (pressed('KeyE') || toggle) && nearParkedMech()) {
      ctx.pilot.hide();
      ctx.player.board();
      ctx.audio.sfx('skill');
      ctx.banner('', `${ctx.player.stats.name} online`, 1000);
      refreshTarget();
    }
  }

  function promptText() {
    if (!onFoot() || ctx.S.dead) return null;
    if (nearParkedMech()) return { key: ctx.isTouch ? 'MECH' : 'E', text: 'Board frame' };
    if (nearLadder()) return { key: ctx.isTouch ? '▲' : 'W', text: 'Climb' };
    return null;
  }

  // ---------------------------------------------------------------- boot
  function initRenderer() {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    ctx.renderer = r;
    ctx.scene = new THREE.Scene();
    ctx.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
    resize();
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
  }
  function resize() {
    if (!ctx.renderer) return;
    const w = innerWidth, h = innerHeight;
    ctx.renderer.setSize(w, h, false);
    ctx.camera.aspect = w / h; ctx.camera.fov = w / h < 1 ? 62 : 40; ctx.camera.updateProjectionMatrix();
  }
  function onVisibility() { if (document.hidden) setPaused(true); }

  function initSystems() {
    ctx.fx = createEffects(ctx.scene, ctx.tex, std(0x2c3134, 0.55, 0.7));
    ctx.weapons = createWeapons(ctx); ctx.weapons.init();
    ctx.director = createDirector(ctx);
    ctx.pickups = createPickups(ctx);
    ctx.score = createScoring(ctx);
    ctx.waves = createWaves(ctx);
    ctx.support = createSupport(ctx);
  }

  function warmEnemies() {
    // add one of every enemy and boss to the scene, compile their shaders, then throw them away
    const models = warmModels();
    models.forEach((m, i) => { m.g.position.set(-500 - i * 12, 0, 0); ctx.scene.add(m.g); });
    ctx.renderer.compile(ctx.scene, ctx.camera);
    models.forEach((m) => { ctx.scene.remove(m.g); disposeTree(m.g); disposeMats(m.mt); });
  }

  function applyWorld(level) {
    if (ctx.world) ctx.world.dispose();
    ctx.world = buildLevel(ctx.scene, level, ctx.tex);
    ctx.renderer.toneMappingExposure = ctx.world.exposure;
  }

  async function runSteps(steps, report) {
    for (let i = 0; i < steps.length; i++) {
      const [label, fn] = steps[i];
      report(label, i / steps.length, false);
      await nextFrame();
      await fn();
    }
    report('Ready', 1, true);
  }

  async function load() {
    await runSteps([
      ['Calibrating renderer', initRenderer],
      ['Generating surface textures', () => { ctx.tex = createTextures(); }],
      ['Priming particle, debris and projectile pools', initSystems],
      ['Assembling your frame', () => {
        ctx.player = createPlayer(ctx); ctx.player.build(saved.loadout); ctx.player.reset(0);
        ctx.pilot = createPilot(ctx); ctx.pilot.build(saved.loadout); ctx.pilot.hide();
        refreshTarget();
      }],
      ['Arming hostile frames and bosses', warmEnemies],
      ['Raising Sector 9 freight yard', () => applyWorld(LEVELS[0])],
      ['Compiling shaders', () => { cam.x = P.x + 5; updCamera(0.016, 'title'); ctx.renderer.compile(ctx.scene, ctx.camera); }],
      ['Loading typefaces', () => (document.fonts ? document.fonts.ready : null)],
    ], (label, progress, done) => store.set((s) => ({
      load: { ...s.load, stage: label, progress, done, log: done ? s.load.log : [...s.load.log, label] },
    })));
    G.state = 'title';
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- mission flow
  function clearCombat() {
    ctx.director.clear(); ctx.weapons.clear(); ctx.pickups.clear(); ctx.fx.clear();
    G.chain = null; G.deathT = 0; G.replaceT = 0;
  }
  const startX = (level) => -level.arena * 0.35;

  // mode: 'campaign' (levelIndex) · 'endless' · 'sideop' (levelId, pilot-only missions from SIDE_OPS)
  async function prepareMission({ mode = 'campaign', levelIndex = 0, levelId = null, keepRun = false } = {}) {
    const level = resolveLevel({ mode, levelIndex, levelId });
    if (!keepRun) ctx.run = newRun();
    mission = { mode, level, startSnapshot: null };
    G.state = 'briefing'; view = 'briefing';
    store.set({ phase: 'briefing', briefing: { levelId: level.id, mode, progress: 0, stage: 'Opening uplink', ready: false, log: [] }, debrief: null, result: null, banner: null, bossIntro: null });
    await runSteps([
      ['Recalling frame from the field', clearCombat],
      [`Building ${level.name}`, () => applyWorld(level)],
      [`Lighting ${level.setting.toLowerCase()} map · ${level.weather.toLowerCase()}`, () => {}],
      [level.pilotOnly ? 'Suiting up · pilot-only operation' : 'Fitting loadout', () => { placeAvatar(level); cam.x = ctx.T.x; }],
      ['Compiling shaders', () => { updCamera(0.016, 'play'); ctx.renderer.compile(ctx.scene, ctx.camera); }],
    ], (label, progress, done) => store.set((s) => ({
      briefing: { ...s.briefing, stage: label, progress, ready: done, log: done ? s.briefing.log : [...s.briefing.log, label] },
    })));
  }

  function deploy() {
    const b = store.get().briefing;
    if (!b || !b.ready || !mission) return;
    ctx.audio.init();
    clearCombat();
    ctx.support.reset({ keepLives: true }); // lives carry across a campaign run
    ctx.pilot.resetHealth();
    placeAvatar(mission.level);
    ctx.input.releaseAll();
    mission.startSnapshot = ctx.score.snapshot();
    ctx.waves.start(mission.level);
    G.state = 'play'; view = 'play'; hudT = 0;
    store.set({ phase: 'playing', hud: initialHud, banner: null, result: null, debrief: null });
    ctx.banner(mission.level.name, `${mission.level.code} · ${mission.level.location}`, 1300);
  }

  // Pilot-only missions start on foot with no frame; everything else starts in the mech.
  function placeAvatar(level) {
    if (level.pilotOnly) { ctx.player.reset(startX(level), 'absent'); ctx.pilot.spawn(startX(level), 0); ctx.S.inv = 0; }
    else { ctx.player.reset(startX(level)); ctx.pilot.hide(); }
    refreshTarget();
  }

  function reachedLabel() {
    if (!mission) return '';
    return mission.mode === 'endless' ? `Wave ${ctx.waves.wave}` : `${mission.level.code} · W${ctx.waves.wave}`;
  }

  function buildResult(extra = {}) {
    const r = ctx.run;
    return {
      mode: mission?.mode || 'campaign', missionName: mission?.level.name || '', reached: reachedLabel(),
      score: r.score, wave: ctx.waves.wave, time: r.time, kills: { ...r.kills }, totalKills: r.kills.total,
      accuracy: r.shots ? Math.min(1, r.hits / r.shots) : 0, shots: r.shots, rockets: r.rockets,
      maxCombo: r.maxCombo, damageTaken: Math.round(r.damageTaken), stomps: r.stomps, stompKills: r.stompKills,
      pickups: r.pickups, bosses: r.bosses.length, missions: r.missions, secrets: r.secrets, framesLost: r.framesLost, ...extra,
    };
  }

  function missionComplete() {
    const level = mission.level, r = ctx.run, s = mission.startSnapshot || newRun();
    const sideOp = !!level.sideOp;
    // side ops pay a flat bonus and don't touch campaign progress or unlocks
    const clearBonus = SCORING.missionClearBonus * (sideOp ? 1 : level.index + 1);
    ctx.score.add(clearBonus);
    r.missions++;
    const before = loadProgress().cleared;
    const cleared = sideOp ? before : markCleared(level.index);
    const unlocked = cleared > before ? unlocksAt(cleared) : [];
    const missionScore = r.score - s.score;
    const isFinal = !sideOp && level.index === LEVELS.length - 1;
    const secretsTotal = ctx.world.secrets.length, secretsFound = ctx.world.secrets.filter((x) => x.found).length;
    const boss = r.bosses[r.bosses.length - 1] || null;
    const debrief = {
      levelIndex: level.index, levelId: level.id, code: level.code, name: level.name, isFinal, sideOp,
      secretsFound, secretsTotal, framesLost: r.framesLost - (s.framesLost || 0),
      missionScore, totalScore: r.score, clearBonus,
      time: r.time - s.time, kills: r.kills.total - s.kills.total,
      accuracy: r.shots - s.shots ? Math.min(1, (r.hits - s.hits) / (r.shots - s.shots)) : 0,
      pickups: r.pickups - s.pickups, damageTaken: Math.round(r.damageTaken - s.damageTaken),
      boss, unlocked, newBest: recordMissionBest(level.id, missionScore),
    };
    if (isFinal) {
      const result = buildResult({ reached: 'Campaign clear', campaignClear: true });
      result.lifetime = recordRun(result);
      debrief.result = result;
    }
    const p = loadProgress();
    restoreIdle();
    G.state = 'debrief'; view = 'debrief';
    ctx.audio.setJet(0);
    store.set({ phase: 'debrief', debrief, progress: { cleared: p.cleared, best: p.best } });
  }

  function gameOver() {
    G.state = 'over'; ctx.audio.setJet(0);
    const result = buildResult();
    result.lifetime = recordRun(result);
    store.set({ phase: 'over', result });
  }

  function nextMission() {
    if (mission && mission.mode === 'sideop') return openMissions();
    if (!mission || mission.mode !== 'campaign') return;
    const next = mission.level.index + 1;
    if (next >= LEVELS.length) return toTitle();
    prepareMission({ mode: 'campaign', levelIndex: next, keepRun: true });
  }
  function retryMission() {
    if (!mission) return;
    ctx.run = mission.startSnapshot ? JSON.parse(JSON.stringify(mission.startSnapshot)) : newRun();
    prepareMission({ mode: mission.mode, levelIndex: Math.max(0, mission.level.index), levelId: mission.level.id, keepRun: true });
  }

  function toTitle() {
    clearCombat(); ctx.player.reset(0); ctx.pilot.hide(); refreshTarget();
    G.state = 'title'; view = 'title'; ctx.audio.setJet(0);
    store.set({ phase: 'title', banner: null, bossIntro: null, pending: null });
  }
  // Menus show the frame idling; put the pilot back in it if the last mission ended on foot
  function restoreIdle() {
    if (P.mode !== 'piloted' || onFoot()) { const x = onFoot() ? ctx.S.x : P.x; ctx.pilot.hide(); ctx.player.reset(x || 0); refreshTarget(); }
  }
  function openMissions() { restoreIdle(); G.state = 'title'; view = 'title'; store.set({ phase: 'missions' }); }
  function openHangar(pending = null) { restoreIdle(); G.state = 'title'; view = 'hangar'; store.set({ phase: 'hangar', pending }); }
  function openPilotSelect(pending = null) { restoreIdle(); G.state = 'title'; view = 'title'; store.set({ phase: 'pilot', pending }); }
  function setLoadout(l) {
    const clean = sanitizeLoadout(l, loadProgress().cleared);
    saveLoadout(clean);
    ctx.player.build(clean); ctx.player.reset(P.x); ctx.pilot.build(clean); ctx.pilot.hide();
    store.set({ loadout: clean });
  }
  // Picking a mech fits its stock weapons (or the closest unlocked ones its hardpoints accept).
  function selectMech(id) {
    const cleared = loadProgress().cleared;
    if (!CHASSIS[id] || CHASSIS[id].unlock > cleared) return;
    setLoadout({ ...store.get().loadout, chassis: id, ...stockLoadout(id, cleared) });
  }

  function setPaused(p) {
    if (p && G.state !== 'play') return;
    if (!p && G.state !== 'pause') return;
    G.state = p ? 'pause' : 'play';
    ctx.input.releaseAll();
    if (p) ctx.audio.suspend(); else { ctx.audio.resume(); last = performance.now(); }
    store.set({ phase: p ? 'paused' : 'playing' });
  }
  function togglePause() { if (G.state === 'play') setPaused(true); else if (G.state === 'pause') setPaused(false); }
  function toggleMute() { const m = !ctx.audio.muted; ctx.audio.setMuted(m); store.set({ muted: m }); saveSettings({ muted: m }); }
  function toggleMinimap() {
    if (G.state !== 'play' && G.state !== 'pause') return; // the map only exists in a mission
    const on = !store.get().minimap;
    store.set({ minimap: on }); saveSettings({ minimap: on });
    ctx.audio.sfx('ui');
  }

  // ---------------------------------------------------------------- mini map
  // Read by the Minimap component on its own animation frame, so React never re-renders for it.
  // One reused object: no allocations per call except the small dot arrays.
  const mini = { active: false, arena: 128, ceiling: null, plats: [], ladders: [], secrets: [], px: 0, py: 0, face: 1, dead: false, onFoot: false, mech: null, camX: 0, viewHalf: 20, enemies: [], pickups: [], time: 0 };
  const miniMech = { x: 0, y: 0, mode: 'parked' };
  function getMinimap() {
    mini.active = (G.state === 'play' || G.state === 'pause') && !!ctx.world;
    if (!mini.active) return mini;
    const cam3 = ctx.camera;
    mini.arena = ctx.world.arena; mini.ceiling = ctx.world.ceiling; mini.plats = ctx.world.plats;
    const T = ctx.T;
    mini.ladders = ctx.world.ladders; mini.secrets = ctx.world.secrets;
    mini.px = T.x; mini.py = T.y; mini.face = T.face; mini.dead = T.dead; mini.onFoot = T.onFoot; mini.time = G.time;
    // a parked or incoming frame is shown separately while you're on foot
    if (T.onFoot && (P.mode === 'parked' || P.mode === 'dropping')) { miniMech.x = P.x; miniMech.y = P.y; miniMech.mode = P.mode; mini.mech = miniMech; }
    else mini.mech = null;
    mini.camX = cam.x;
    mini.viewHalf = Math.tan((cam3.fov * Math.PI) / 360) * cam.z * cam3.aspect;
    mini.enemies.length = 0;
    for (const e of ctx.enemies) if (!e.dead) mini.enemies.push({ x: e.x, y: e.y + e.cy, type: e.type, boss: e.isBoss });
    mini.pickups.length = 0;
    for (const it of ctx.pickups.items) mini.pickups.push({ x: it.x, y: it.y, color: PICKUPS[it.type].css, pilotOnly: it.pilotOnly });
    return mini;
  }

  // ---------------------------------------------------------------- HUD bridge (20 Hz)
  function pushHud() {
    const boss = ctx.director.boss(), sec = ctx.player.secondary, prim = ctx.player.primary;
    const S = ctx.S, R = ctx.R, foot = onFoot();
    const ammoDef = R.ammoType ? PICKUPS[R.ammoType] : null;
    store.set({
      hud: {
        onFoot: foot, pilotHp: S.hp, pilotMaxHp: S.maxHp, pilotDead: S.dead, sidearm: ctx.pilot.sidearm.name,
        mechMode: P.mode, replaceT: G.replaceT, pilotOnly: !!(mission && mission.level.pilotOnly),
        shield: R.shield, shieldT: R.shieldT, contT: R.contT, lives: ctx.run.lives,
        ammoType: R.ammoType, ammo: R.ammo, ammoLabel: ammoDef ? ammoDef.label : '', ammoColor: ammoDef ? ammoDef.css : '',
        prompt: promptText(), secrets: ctx.run.secrets,
        hull: P.hull, maxHull: P.maxHull, heat: P.heat, venting: P.over > 0, fuel: P.fuel,
        waveLabel: ctx.waves.label(), mission: mission ? mission.level.code : '', wave: ctx.waves.wave,
        score: ctx.run.score, combo: ctx.run.combo, multiplier: ctx.score.multiplier(), comboTime: ctx.score.comboTime(),
        primary: prim.name, secondary: sec.name, secId: sec.id,
        callsign: ctx.player.pilot.callsign, mechName: ctx.player.stats.name,
        skillName: ctx.player.skill.name, skillActive: P.skillT, skillCooldown: P.skillCD,
        skillReady: 1 - clamp(P.skillCD / (ctx.player.skill.cooldown * (ctx.player.pilot.perk.skillCooldown || 1)), 0, 1),
        secReady: 1 - clamp(P.secCD / (P.secMax || sec.cooldown), 0, 1), secCooldown: Math.max(0, P.secCD), barrier: P.barrierT,
        dashReady: 1 - clamp(P.dashCD / ctx.player.stats.dashCooldown, 0, 1),
        buffs: Object.entries(P.buffs).filter(([, v]) => v > 0).map(([k, v]) => ({ id: k, label: PICKUPS[k].label, color: PICKUPS[k].css, t: v, max: PICKUPS[k].duration })),
        boss: boss ? { name: boss.name, title: boss.title, hp: clamp(boss.hp / boss.max, 0, 1), phase: boss.phase } : null,
        status: foot
          ? (S.dead ? 'Pilot down' : P.mode === 'destroyed' ? 'Frame lost' : P.mode === 'dropping' ? 'Frame inbound' : P.mode === 'parked' ? 'Frame on auto-defend' : 'On foot')
          : P.dead ? 'Signal lost' : P.over > 0 ? 'Venting' : P.hull < P.maxHull * 0.3 ? 'Hull critical' : 'Online',
      },
    });
  }

  // ---------------------------------------------------------------- camera
  function updCamera(dt, mode) {
    const cameraObj = ctx.camera, narrow = cameraObj.aspect < 1;
    let tx, ty, tz, ly;
    if (mode === 'play' && ctx.T.onFoot) {
      // tighter shot on the pilot
      const T = ctx.T, lead = clamp((ctx.aimV.x - T.x) * 0.18, -4, 4);
      tx = T.x + lead + T.vx * 0.1; ty = T.y * 0.7 + 5.6; tz = narrow ? 27 : 19; ly = T.y * 0.7 + 2.6;
      if (ctx.world.ceiling) { ty = Math.min(ty, ctx.world.ceiling - 1.5); ly = Math.min(ly, ctx.world.ceiling - 4); }
    } else if (mode === 'play') {
      const lead = clamp((ctx.aimV.x - P.x) * 0.22, -6, 6);
      tx = P.x + lead + P.vx * 0.15; ty = P.y * 0.6 + 9.2; tz = narrow ? 36 : 29; ly = P.y * 0.6 + 5;
      if (ctx.world.ceiling) { ty = Math.min(ty, ctx.world.ceiling - 4); ly = Math.min(ly, ctx.world.ceiling - 8); }
    } else if (mode === 'hangar') {
      tx = P.x + (narrow ? 0 : 3.6); ty = 4.2; tz = narrow ? 17 : 11.5; ly = 3.2;
    } else {
      tx = P.x + 5 + Math.sin(G.time * 0.15) * 3; ty = 8.5; tz = 24; ly = 4.3;
    }
    const A = ctx.world ? ctx.world.arena : 128;
    tx = clamp(tx, -A + 6, A + 6);
    const k = Math.min(1, dt * (mode === 'play' ? 4 : 2.5));
    cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, Math.min(1, dt * 3)); cam.z = lerp(cam.z, tz, Math.min(1, dt * 3)); cam.ly = lerp(cam.ly, ly, Math.min(1, dt * 3));
    const s = cam.shake * cam.shake; cam.shake = Math.max(0, cam.shake - dt * 2.2);
    cameraObj.position.set(cam.x + rand(-1, 1) * s * 0.6, cam.y + rand(-1, 1) * s * 0.6, cam.z);
    cameraObj.lookAt(cam.x, cam.ly, 0);
    if (ctx.world) {
      const o = ctx.world.sun.userData.offset || [-30, 42, 26];
      ctx.world.sun.position.set(cam.x + o[0], o[1], o[2]); ctx.world.sun.target.position.set(cam.x, 0, 0);
    }
  }

  // ---------------------------------------------------------------- main loop
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(dt);
    ctx.renderer.render(ctx.scene, ctx.camera);
    ctx.input.endFrame();
  }

  // One simulation tick. Exposed so tests can drive the game without a browser frame clock.
  function step(dt) {
    if (G.state === 'pause') return;
    G.time += dt;
    if (G.state === 'play' || G.state === 'over') {
      if (G.state === 'play') {
        refreshTarget();
        if (!ctx.T.dead) ctx.run.time += dt;
        interactions();
        if (onFoot()) ctx.pilot.update(dt);
        ctx.player.update(dt); // piloted, or parked auto-defend / replacement drop
        refreshTarget();
        ctx.support.update(dt);
        ctx.waves.update(dt);
        ctx.score.tick();
        // replacement frame countdown while the pilot is on foot without one
        if (G.replaceT > 0 && P.mode === 'destroyed' && !ctx.S.dead) {
          const before = G.replaceT;
          G.replaceT = Math.max(0, G.replaceT - dt);
          if (before > 5 && G.replaceT <= 5) ctx.banner('', 'Replacement frame inbound · 5s', 1400);
          if (G.replaceT === 0) {
            const S = ctx.S;
            ctx.player.startDrop(S.x - S.face * 6);
            ctx.audio.sfx('alarm');
          }
        }
        if (G.deathT > 0) { G.deathT -= dt; if (G.deathT <= 0) { G.deathT = 0; gameOver(); } }
        hudT -= dt; if (hudT <= 0) { pushHud(); hudT = 0.05; }
      }
      ctx.director.update(dt); ctx.weapons.update(dt); ctx.pickups.update(dt);
      if (G.chain) {
        for (const c of G.chain) { c[0] -= dt; if (c[0] <= 0 && c[0] > -1) { ctx.weapons.explode(c[1], c[2], 0, 0, 0, true, c[3]); c[0] = -2; } }
        if (G.chain.every((c) => c[0] <= -1)) G.chain = null;
      }
      updCamera(dt, 'play');
    } else {
      ctx.player.idle(dt, G.time, view === 'hangar');
      if (view === 'title' && !ctx.world.ceiling && Math.random() < dt * 0.5) ctx.weapons.explode(P.x + rand(10, 30), 0, -18, 0, 0, false, 0.9);
      if (G.chain) G.chain = null;
      ctx.weapons.update(dt);
      cam.shake = view === 'debrief' ? cam.shake : 0;
      updCamera(dt, view === 'hangar' ? 'hangar' : 'title');
    }
    ctx.fx.update(dt);
    ctx.world.update(dt, ctx.camera.position.x, (x, z) => ctx.fx.emit(ctx.fx.FX, { x, y: 0.05, z, life: 0.15, s0: 0.4, s1: 0.1, c: 0x8fa3ad, a: 0.4 }));
  }

  function dispose() {
    cancelAnimationFrame(raf);
    ctx.input.dispose(); ctx.audio.dispose();
    removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    if (ctx.renderer) ctx.renderer.dispose();
  }

  return {
    load, prepareMission, deploy, nextMission, retryMission, toTitle, openMissions, openHangar, openPilotSelect, setLoadout, selectMech,
    togglePause, setPaused, toggleMute, toggleMinimap, getMinimap, dispose, input: ctx.input, sfx: (k) => ctx.audio.sfx(k),
    _ctx: ctx, _step: step, // test hooks
  };
}
