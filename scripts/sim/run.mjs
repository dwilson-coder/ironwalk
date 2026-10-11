// Headless playthrough: boots the engine, then plays every campaign mission, endless boss waves,
// every weapon combination, pause/retry/menu flows and a death. Fails loudly on any exception or NaN.
// Phase 3: every pickup, special rockets, force field, extra lives, freeze. Phase 4: pilot on foot, eject/board,
// ladders, pilot-only ledges, crawlspaces, secrets, mech replacement drop, pilot-only side op.
const ls = new Map();
const winListeners = {};
const ctxProxy = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : ctxProxy), apply: () => ctxProxy, set: () => true });
Object.assign(globalThis, {
  window: globalThis, innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1,
  matchMedia: (q) => ({ matches: q.includes('coarse') }), // touch mode → auto-aim
  addEventListener(type, fn) { (winListeners[type] ||= []).push(fn); }, removeEventListener() {},
  localStorage: {
    getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k),
    key: (i) => [...ls.keys()][i] ?? null, get length() { return ls.size; },
  },
  requestAnimationFrame: (cb) => (cb.name === 'frame' ? 0 : setTimeout(() => cb(performance.now()), 0)),
  cancelAnimationFrame() {},
  document: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctxProxy }),
    fonts: { ready: Promise.resolve() }, addEventListener() {}, removeEventListener() {}, hidden: false,
  },
});

const M = await import('./.bundle.mjs');
const { createEngine, store, LEVELS, SIDE_OPS, PICKUPS, SUPPORT, MECH_REPLACEMENT_SECONDS, SECRET_BONUS, PRIMARIES, SECONDARIES, CHASSIS, PAINTS, PILOTS, SIDEARMS, canMount, __stats, migrateLegacyKeys, loadSettings } = M;
// a real keydown as the browser would deliver it to the window listeners
const press = (code) => (winListeners.keydown || []).forEach((fn) => fn({ code, repeat: false, target: { tagName: 'BODY' }, preventDefault() {}, stopPropagation() {} }));

// ------------------------------------------------------------------ Phase 1: save migration (runs before the engine boots, like main.jsx)
ls.set('ironwake.progress.v1', JSON.stringify({ cleared: 2, loadout: null, best: { yard: 1234 } }));
ls.set('ironwake.initials', 'DWS');
migrateLegacyKeys();

let failures = 0;
const fail = (msg) => { failures++; console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);
const engine = createEngine({ addEventListener() {}, removeEventListener() {} });
const ctx = engine._ctx, P = ctx.P;
const DT = 1 / 60;

function step(n = 1) {
  for (let i = 0; i < n; i++) {
    try { engine._step(DT); ctx.input.endFrame(); }
    catch (e) { console.log('\nEXCEPTION during step:\n', e.stack); process.exit(1); }
    for (const v of [P.x, P.y, P.vx, P.vy, P.hull]) if (!Number.isFinite(v)) { console.log('NaN in player state', { x: P.x, y: P.y, vx: P.vx, vy: P.vy, hull: P.hull }); process.exit(1); }
    for (const e of ctx.enemies) if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)) { console.log('NaN in enemy', e.type, e.x, e.y, e.hp); process.exit(1); }
  }
}

// Bot: keeps firing, uses secondary, jumps, dashes and slams. Optionally stays alive.
let botT = 0;
function bot({ immortal = true, assist = 0 } = {}) {
  botT += DT;
  ctx.input.setTouch('fire', true);
  if (Math.floor(botT * 2) % 9 === 0) ctx.input.setTouch('rocket', true); else ctx.input.setTouch('rocket', false);
  const ph = botT % 6;
  ctx.input.setTouch('right', ph < 1.5); ctx.input.setTouch('left', ph > 3 && ph < 4.5);
  ctx.input.setTouch('jet', ph > 2 && ph < 2.8);
  if (Math.abs(ph - 2.9) < DT) ctx.input.edge.KeyS = true;
  if (Math.abs(ph - 5) < DT) ctx.input.setTouch('dash', true); else ctx.input.setTouch('dash', false);
  if (immortal && P.hull < P.maxHull * 0.4) P.hull = P.maxHull;
  if (immortal && ctx.S.active && ctx.S.hp < ctx.S.maxHp * 0.4) ctx.S.hp = ctx.S.maxHp;
  if (assist && Math.random() < DT) for (const e of [...ctx.enemies]) if (!e.dead) ctx.director.hurt(e, e.max * assist, 'gun');
}

async function playUntil(cond, { maxSec = 600, ...opts } = {}) {
  const max = maxSec / DT;
  for (let i = 0; i < max; i++) { bot(opts); step(); if (cond()) return i * DT; if (i % 60 === 0) await new Promise((r) => setTimeout(r, 0)); }
  return -1;
}

// ------------------------------------------------------------------ boot
console.log('Boot');
await engine.load();
store.get().load.done ? ok('loading screen stages: ' + store.get().load.log.length) : fail('load not done');
store.set({ phase: 'title' });
step(120); ok('title idle 2s');

console.log('\nPhase 1: migration, pause, mini map, hotkeys');
const migrated = JSON.parse(ls.get('ironwalk.progress.v1') || 'null');
migrated && migrated.cleared === 2 && ls.get('ironwalk.initials') === 'DWS' ? ok('old ironwake.* saves copied to ironwalk.*') : fail('save migration');
store.get().progress.cleared === 2 ? ok('engine booted with migrated progress (2 missions cleared)') : fail('engine did not read migrated progress: ' + store.get().progress.cleared);
press('KeyM'); store.get().minimap === true ? ok('M ignored outside a mission') : fail('M toggled map on the title screen');
await engine.prepareMission({ mode: 'campaign', levelIndex: 0 });
engine.deploy(); step(240);
let mm = engine.getMinimap();
mm.active && mm.arena === 128 && mm.plats.filter((p) => !p.pilotOnly).length === 8 && mm.ladders.length >= 8 && mm.secrets.length === 2 && Number.isFinite(mm.viewHalf) && mm.viewHalf > 5 ? ok(`mini map snapshot: arena ±${mm.arena}, ${mm.plats.length} catwalks, view ±${mm.viewHalf.toFixed(1)} m, ${mm.pickups.length} pickups`) : fail('mini map snapshot ' + JSON.stringify({ a: mm.active, arena: mm.arena, v: mm.viewHalf }));
step(240); mm = engine.getMinimap();
mm.enemies.length > 0 && mm.enemies.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y)) ? ok(`mini map tracks ${mm.enemies.length} enemies`) : fail('mini map enemies');
press('KeyM'); store.get().minimap === false && loadSettings().minimap === false ? ok('M hides the mini map and remembers it') : fail('M toggle');
press('KeyM'); store.get().minimap === true ? ok('M shows it again') : fail('M toggle back');
press('KeyN'); store.get().muted === true && loadSettings().muted === true ? ok('N mutes (moved from M) and remembers it') : fail('N mute');
press('KeyN');
press('KeyP'); const tP = ctx.G.time; step(30);
store.get().phase === 'paused' && ctx.G.time === tP ? ok('P pauses and freezes the game') : fail('P pause');
press('KeyM'); store.get().minimap === false ? ok('M works while paused') : fail('M while paused'); press('KeyM');
press('Escape'); store.get().phase === 'playing' ? ok('Esc resumes') : fail('Esc resume');
press('Escape'); store.get().phase === 'paused' ? ok('Esc pauses') : fail('Esc pause');
engine.setPaused(false); store.get().phase === 'playing' ? ok('Resume button (setPaused false)') : fail('resume button');
engine.setPaused(true); store.get().phase === 'paused' ? ok('HUD pause button (setPaused true)') : fail('pause button');
engine.retryMission(); await new Promise((r) => setTimeout(r, 30));
await engine.prepareMission({ mode: 'campaign', levelIndex: 0, keepRun: true });
store.get().phase === 'briefing' && store.get().briefing.ready ? ok('Restart reloads the mission via the briefing screen') : fail('restart');
engine.deploy(); step(60); engine.setPaused(true); engine.toTitle(); step(10);
store.get().phase === 'title' && ctx.enemies.length === 0 && !engine.getMinimap().active ? ok('Quit returns to the title and the map goes inactive') : fail('quit');
ls.set('ironwalk.progress.v1', JSON.stringify({ cleared: 0, loadout: null, best: {} }));

// unlock everything for loadout testing later
ls.set('ironwalk.progress.v1', JSON.stringify({ cleared: 0, loadout: null, best: {} }));

// ------------------------------------------------------------------ campaign
for (let i = 0; i < LEVELS.length; i++) {
  const L = LEVELS[i];
  console.log(`\nMission ${L.code} ${L.name} (${L.setting}, boss ${L.boss})`);
  engine.openHangar({ mode: 'campaign', levelIndex: i });
  step(30);
  await engine.prepareMission({ mode: 'campaign', levelIndex: i, keepRun: i > 0 });
  const b = store.get().briefing;
  b.ready && b.levelId === L.id ? ok(`briefing loaded (${b.log.length} stages)`) : fail('briefing not ready');
  ctx.world.ceiling === L.ceiling ? ok(`map built · arena ±${ctx.world.arena} · ceiling ${L.ceiling ?? 'open sky'}`) : fail('ceiling mismatch');
  engine.deploy();
  store.get().phase === 'playing' ? ok('deployed') : fail('not playing');
  const cachesAtStart = ctx.pickups.items.filter((it) => !it.pilotOnly).length, stashes = ctx.pickups.items.filter((it) => it.pilotOnly).length;
  cachesAtStart === L.caches.length ? ok(`${cachesAtStart} weapons caches placed`) : fail(`caches ${cachesAtStart} vs ${L.caches.length}`);
  stashes === L.secretLoot.length && ctx.world.secrets.length === 2 ? ok(`${stashes} pilot-only stashes in ${ctx.world.secrets.length} secret areas`) : fail(`stashes ${stashes}`);

  let sawBoss = false, sawPhase2 = false, sawIntro = false, maxEnemies = 0, sawSupply = false;
  const introBefore = store.get().bossIntro?.id || 0;
  const t = await playUntil(() => {
    const boss = ctx.director.boss();
    if (boss) { sawBoss = true; if (boss.phase === 2) sawPhase2 = true; }
    if ((store.get().bossIntro?.id || 0) > introBefore) sawIntro = true;
    if (ctx.pickups.count > 0 && ctx.waves.wave >= 2) sawSupply = true;
    maxEnemies = Math.max(maxEnemies, ctx.enemies.length);
    if (P.ceilingCheck !== undefined) {}
    if (L.ceiling && P.y + 4.8 * ctx.player.stats.scale > L.ceiling) fail('player above ceiling');
    return store.get().phase === 'debrief';
  }, { assist: 0.04 });
  t > 0 ? ok(`mission complete in ${t.toFixed(0)}s sim time (max ${maxEnemies} enemies on screen)`) : fail('mission did not complete');
  sawIntro ? ok('boss intro card fired') : fail('no boss intro');
  sawBoss && sawPhase2 ? ok(`boss ${L.boss} fought through phase 2`) : fail(`boss phases: seen=${sawBoss} p2=${sawPhase2}`);
  sawSupply ? ok('supply drop / pickups appeared during waves') : fail('no supply drops seen');
  const d = store.get().debrief;
  if (d) {
    ok(`debrief: mission ${d.missionScore} · total ${d.totalScore} · kills ${d.kills} · acc ${(d.accuracy * 100).toFixed(0)}% · pickups ${d.pickups} · unlocked [${d.unlocked.map((u) => u.name).join(', ')}]`);
    if (d.isFinal) (d.result && d.result.reached === 'Campaign clear') ? ok('final mission produced campaign result for leaderboard') : fail('final result missing');
  }
  step(60);
}
const prog = JSON.parse(ls.get('ironwalk.progress.v1'));
prog.cleared === 4 ? ok('\nprogress saved: all 4 missions cleared') : fail('progress cleared=' + prog.cleared);

// ------------------------------------------------------------------ loadouts
console.log('\nLoadouts (all unlocked now)');
await engine.prepareMission({ mode: 'endless' });
engine.deploy();
let combos = 0;
for (const ch of Object.keys(CHASSIS)) for (const pr of Object.keys(PRIMARIES)) for (const se of Object.keys(SECONDARIES)) {
  engine.setLoadout({ ...store.get().loadout, chassis: ch, primary: pr, secondary: se, paint: Object.keys(PAINTS)[Math.floor(Math.random() * 4)] });
  const lo = store.get().loadout;
  const legal = canMount(ch, 'primary', pr) && canMount(ch, 'secondary', se);
  if (!legal) {
    // illegal combos must be repaired to something the frame can mount
    if (!canMount(ch, 'primary', lo.primary) || !canMount(ch, 'secondary', lo.secondary)) fail(`illegal loadout kept ${ch}/${lo.primary}/${lo.secondary}`);
    continue;
  }
  if (lo.chassis !== ch || lo.primary !== pr || lo.secondary !== se) fail(`loadout rejected ${ch}/${pr}/${se}`);
  combos++;
  const shots0 = ctx.run.shots;
  P.secCD = 0;
  await playUntil(() => false, { maxSec: 6 });
  if (ctx.run.shots === shots0) fail(`${pr} never fired on ${ch}`);
}
ok(`${combos} legal mech/primary/secondary combinations fired in combat; illegal ones were refitted (shots ${ctx.run.shots}, hits ${ctx.run.hits})`);

// ------------------------------------------------------------------ Phase 2: pilots, mech select, skills
console.log('\nPhase 2: pilots, mech select, skills');
const press2 = (code) => (winListeners.keydown || []).forEach((fn) => fn({ code, repeat: false, target: { tagName: 'BODY' }, preventDefault() {}, stopPropagation() {} }));
const release2 = (code) => (winListeners.keyup || []).forEach((fn) => fn({ code }));
engine.toTitle();
engine.openPilotSelect({ mode: 'campaign', levelIndex: 0 });
store.get().phase === 'pilot' && store.get().pending.levelIndex === 0 ? ok('pilot select opens with the pending mission') : fail('pilot phase');
for (const id of Object.keys(PILOTS)) for (const sa of Object.keys(SIDEARMS)) {
  engine.setLoadout({ ...store.get().loadout, pilot: id, sidearm: sa });
  if (store.get().loadout.pilot !== id || store.get().loadout.sidearm !== sa) fail(`pilot/sidearm ${id}/${sa}`);
}
engine.setLoadout({ ...store.get().loadout, pilot: 'reyes', sidearm: 'smg' });
const saved2 = JSON.parse(ls.get('ironwalk.progress.v1')).loadout;
saved2.pilot === 'reyes' && saved2.sidearm === 'smg' ? ok('3 pilots × 3 sidearms selectable; choice saved to progress') : fail('pilot save');
engine.openHangar(store.get().pending);
store.get().phase === 'hangar' ? ok('Choose mech → mech select') : fail('hangar phase');
engine.selectMech('spectre'); let lo2 = store.get().loadout;
lo2.chassis === 'spectre' && lo2.primary === 'rail' && lo2.secondary === 'barrier' ? ok('Spectre-2 fits its stock rail + barrier') : fail('spectre stock ' + JSON.stringify(lo2));
engine.selectMech('striker'); lo2 = store.get().loadout;
lo2.primary === 'scatter' && lo2.secondary === 'seeker' ? ok('Kestrel-3 fits its stock scattergun + seekers') : fail('striker stock');
engine.setLoadout({ ...lo2, primary: 'rail', secondary: 'mortar' }); lo2 = store.get().loadout;
lo2.primary !== 'rail' && lo2.secondary !== 'mortar' ? ok('Kestrel-3 refuses the railgun and mortar (hardpoints)') : fail('hardpoint enforcement');

const releaseTouch = () => { for (const k of ['fire', 'rocket', 'right', 'left', 'jet', 'dash', 'up', 'down']) ctx.input.setTouch(k, false); };
async function skillTest(chassis, pilot, fn) {
  engine.toTitle(); releaseTouch();
  engine.setLoadout({ ...store.get().loadout, pilot });
  engine.selectMech(chassis);
  await engine.prepareMission({ mode: 'campaign', levelIndex: 0 });
  engine.deploy(); step(30);
  return fn();
}
await skillTest('warden', 'mercer', async () => {
  P.maxHull === 115 ? ok('Mercer (Hardened): Warden-7 hull 100 → 115') : fail('mercer hull ' + P.maxHull);
  press2('KeyR'); step(1);
  ctx.player.skill.id === 'surge' && P.skillT > 5 ? ok('R fires the mech skill (Reactor Surge)') : fail('skill start');
  ctx.input.setTouch('fire', true); step(120); ctx.input.setTouch('fire', false);
  P.heat === 0 && P.over === 0 ? ok('Reactor Surge: 2 s of chaingun fire with zero heat') : fail('surge heat ' + P.heat);
  press2('KeyR'); step(1);
  P.skillCD > 15 && P.skillT < 5 ? ok('skill cannot be re-fired while recharging') : fail('skill cooldown');
  ctx.run.score >= 0 && store.get().hud.skillName === 'Reactor Surge' ? ok('HUD shows the skill slot') : fail('hud skill');
});
await skillTest('striker', 'reyes', async () => {
  press2('KeyR'); step(1);
  Math.abs(P.skillCD - 16 * 0.75) < 0.1 ? ok('Reyes (Overclock): Afterburner recharge 16 s → 12 s') : fail('reyes cd ' + P.skillCD);
  ctx.input.setTouch('jet', true); step(150); ctx.input.setTouch('jet', false);
  P.fuel === 100 ? ok('Afterburner: jets never drain') : fail('afterburner fuel ' + P.fuel);
});
await skillTest('bulwark', 'tinker', async () => {
  press2('KeyR'); step(1);
  const x0 = P.x; press2('KeyD'); step(60); release2('KeyD');
  Math.abs(P.x - x0) < 0.05 ? ok('Fortify: planted, cannot walk') : fail('fortify moved ' + (P.x - x0));
  P.inv = 0; const h0 = P.hull; ctx.player.hurt(10);
  Math.abs(h0 - P.hull - 10 * 0.85 * 0.4) < 0.01 ? ok('Fortify: 10 damage → 3.4 (armor 0.85 × 0.4)') : fail('fortify dmg ' + (h0 - P.hull));
  ctx.player.damageMult() > 1.55 ? ok('Fortify: firepower 1.2 × 1.3') : fail('fortify mult ' + ctx.player.damageMult());
  step(360); for (const e of [...ctx.enemies]) ctx.director.kill(e, 'test'); ctx.weapons.clear(); step(2);
  P.hull = 60; P.hitT = 10; const hr = P.hull; step(60);
  P.hull > hr + 1.5 ? ok(`Tinker (Field repair): +${(P.hull - hr).toFixed(1)} hull in 1 s after avoiding damage`) : fail('tinker regen');
});
await skillTest('spectre', 'mercer', async () => {
  for (const e of [...ctx.enemies]) ctx.director.kill(e, 'test');
  press2('KeyR'); step(1);
  ctx.player.isCloaked() ? ok('Ghost Cloak active') : fail('cloak');
  const h0 = P.hull;
  for (let i = 0; i < 12; i++) { P.inv = 0; ctx.weapons.enemyFire({ x: P.x + 20, y: P.y + 2.8, tx: P.x, ty: P.y + 2.8, speed: 25, dmg: 10 }); step(8); }
  step(60);
  P.hull === h0 ? ok('Ghost Cloak: 12 aimed shots all went wide') : fail('cloak hits ' + (h0 - P.hull));
  step(300);
  !ctx.player.isCloaked() ? ok('cloak expires') : fail('cloak stuck');
  const h1 = P.hull; P.inv = 0; ctx.weapons.enemyFire({ x: P.x + 20, y: P.y + 2.8, tx: P.x, ty: P.y + 2.8, speed: 25, dmg: 10 }); step(60);
  P.hull < h1 ? ok('aimed shots hit again once the cloak is down') : fail('post-cloak no hit');
});
engine.toTitle();
engine.setLoadout({ ...store.get().loadout, pilot: 'mercer' }); engine.selectMech('warden');

// barrier blocks bolts
engine.setLoadout({ ...store.get().loadout, chassis: 'warden', primary: 'chaingun', secondary: 'barrier', paint: 'salvage' });
await engine.prepareMission({ mode: 'endless' }); engine.deploy(); step(10);
P.barrierT = 3; P.face = 1;
const fakeBolt = { x: P.x + 2, y: P.y + 3 };
ctx.player.barrierBlocks(fakeBolt) ? ok('barrier blocks frontal bolts') : fail('barrier does not block');
ctx.player.barrierBlocks({ x: P.x - 3, y: P.y + 3 }) ? fail('barrier blocks from behind') : ok('barrier open from behind');

// pickups apply
for (const type of ['repair', 'coolant', 'overdrive', 'munitions', 'plating']) {
  P.hull = 20; ctx.pickups.spawn(type, P.x, P.y, {}); step(2);
  const applied = type === 'repair' ? P.hull > 20 : P.buffs[type] > 0;
  applied ? ok(`pickup ${type} applied`) : fail(`pickup ${type} not applied`);
}
ctx.player.damageMult() === 1.5 ? ok('overdrive multiplies damage ×1.5') : fail('overdrive mult');


// ------------------------------------------------------------------ Phase 3: pickups, special rockets, force field, freeze
console.log('\nPhase 3: pickups');
const R = ctx.R, S = ctx.S;
function clearField() { for (const e of [...ctx.enemies]) ctx.director.kill(e, 'test'); ctx.weapons.clear(); ctx.pickups.clear(); step(2); }
// keep the waves from interfering: hold the director in a long break
releaseTouch();
engine.toTitle(); engine.setLoadout({ ...store.get().loadout, pilot: 'mercer', sidearm: 'pistol' }); engine.selectMech('warden');
await engine.prepareMission({ mode: 'campaign', levelIndex: 0 }); engine.deploy(); step(10); clearField();
Object.keys(PICKUPS).length >= 10 && Object.values(PICKUPS).every((p) => /^#[0-9a-f]{6}$/i.test(p.css) && p.icon) && new Set(Object.values(PICKUPS).map((p) => p.css)).size === Object.keys(PICKUPS).length
  ? ok(`${Object.keys(PICKUPS).length} pickup types, each with its own colour and icon`) : fail('pickup colours/icons not distinct');
const at = (type, opts = {}) => { ctx.pickups.spawn(type, P.x, P.y, opts); step(2); };
P.hull = 30; at('repair'); P.hull > 30 ? ok('Health pickup repairs the hull') : fail('repair');
at('heat'); R.ammoType === 'heat' && R.ammo === 6 ? ok('Heat-seeking rockets: +6') : fail('heat ammo ' + R.ammoType + R.ammo);
at('heat'); at('heat'); R.ammo === SUPPORT.maxAmmo ? ok(`same rocket type stacks (cap ${SUPPORT.maxAmmo})`) : fail('stack ' + R.ammo);
at('turret'); R.ammoType === 'turret' && R.ammo === 6 ? ok('Turret rockets replace a different rocket type') : fail('turret replace');
R.shield = 0; at('shield'); R.shield === 20 ? ok('Force field cell: +20% shield') : fail('shield ' + R.shield);
for (let i = 0; i < 6; i++) at('shield'); R.shield === 100 ? ok('shield meter caps at 100%') : fail('shield cap ' + R.shield);
ctx.run.lives = 0; at('life'); ctx.run.lives === 1 ? ok('Extra life: +1') : fail('life');
at('life'); at('life'); at('life'); ctx.run.lives === SUPPORT.maxLives ? ok(`lives cap at ${SUPPORT.maxLives}`) : fail('lives cap');
step(12); store.get().hud.shield === 100 && store.get().hud.lives === 3 && store.get().hud.ammo === 6 ? ok('HUD carries shield meter, lives and rocket ammo') : fail('hud support fields');

// force field: F spends 20% for 3 s of invulnerability
R.shield = 20; press2('KeyF'); step(1);
R.shieldT > 2.9 && R.shield === 0 ? ok('F spends 20% of the meter for a 3 s force field') : fail(`F shield ${R.shieldT} ${R.shield}`);
let h = P.hull; ctx.hurtTarget(40); P.hull === h ? ok('force field: no damage taken') : fail('shield let damage through');
step(Math.ceil(3.1 / DT)); P.inv = 0; h = P.hull; ctx.hurtTarget(10); P.hull < h ? ok('force field expires after 3 s') : fail('shield stuck');
R.shield = 10; press2('KeyF'); step(1); R.shieldT === 0 ? ok('F refused below 20% charge') : fail('shield fired with 10%');
release2('KeyF');

// heat-seekers lock the nearest enemy; turret rockets go to the reticle
function rocketDuel(type) {
  clearField();
  ctx.director.spawn('drone'); ctx.director.spawn('drone');
  const [near, far] = ctx.enemies;
  near.x = P.x - 9; near.y = P.y + 7; far.x = P.x + 15; far.y = P.y + 7; // near is behind, far is in front (touch aim picks far)
  for (const e of [near, far]) { e.frozenT = 30; e.hp = e.max = 999; }
  P.face = 1; R.ammoType = type; R.ammo = 3; R.fireT = 0;
  press2('KeyG'); step(1); release2('KeyG');
  step(150);
  return { near: near.max - near.hp, far: far.max - far.hp, ammo: R.ammo };
}
let duel = rocketDuel('heat');
duel.near > 0 && duel.far === 0 && duel.ammo === 2 ? ok(`G fires a heat-seeker: turned around and hit the nearest enemy (${duel.near.toFixed(0)} dmg)`) : fail('heat duel ' + JSON.stringify(duel));
duel = rocketDuel('turret');
duel.far > 0 && duel.near === 0 ? ok(`turret rocket flew to the reticle target, ignoring the closer enemy (${duel.far.toFixed(0)} dmg)`) : fail('turret duel ' + JSON.stringify(duel));

// freeze: on-screen enemies only, 3 s
clearField();
ctx.director.spawn('drone'); ctx.director.spawn('crawler'); ctx.director.spawn('drone');
const [fa, fb, off] = ctx.enemies;
fa.x = P.x + 8; fa.y = 8; fb.x = P.x - 10; fb.y = 0; off.x = Math.min(ctx.world.arena - 1, P.x + 90); off.y = 8;
step(1); at('freeze');
fa.frozenT > 2.5 && fb.frozenT > 2.5 && !(off.frozenT > 0) ? ok('Freeze: on-screen enemies frozen, off-screen one unaffected') : fail(`freeze ${fa.frozenT} ${fb.frozenT} ${off.frozenT}`);
const fx0 = fa.x, fy0 = fa.y; step(60);
fa.x === fx0 && fa.y === fy0 ? ok('frozen enemies do not move') : fail('frozen drone moved');
step(Math.ceil(2.3 / DT)); !(fa.frozenT > 0) ? ok('freeze wears off after 3 s') : fail('freeze stuck');

// ------------------------------------------------------------------ Phase 4: pilot on foot
console.log('\nPhase 4: pilot on foot');
clearField();
const W = ctx.world;
// waves keep running; keep things calm by killing spawns as they arrive
const calm = () => { for (const e of [...ctx.enemies]) ctx.director.kill(e, 'test'); ctx.weapons.clear(); };
ctx.waves.state = 'idle'; // no more waves or boss while testing the pilot
function stepCalm(n) { for (let i = 0; i < n; i++) { calm(); step(1); } }
function hold(code, frames) { press2(code); stepCalm(frames); release2(code); }
P.x = -44.8; P.y = 0; P.vx = 0; stepCalm(5);
S.hp = S.maxHp; press2('KeyX'); step(1); release2('KeyX');
S.active && P.mode === 'parked' && ctx.T.onFoot ? ok('X ejects: pilot on foot, frame parked') : fail('eject');
stepCalm(90);
S.ground && S.hp === S.maxHp ? ok(`pilot landed with full health (${S.hp}) after a manual eject`) : fail('pilot after eject ' + S.ground + ' ' + S.hp);
step(4); const hud4 = store.get().hud;
hud4.onFoot && hud4.pilotHp === S.hp && hud4.mechMode === 'parked' ? ok('HUD switches to the pilot health bar') : fail('hud on foot');
let x0 = S.x; hold('KeyD', 40); S.x > x0 + 3 ? ok(`pilot walks (${(S.x - x0).toFixed(1)} m in 0.66 s)`) : fail('pilot walk');
x0 = S.x; hold('ShiftLeft', 2); stepCalm(20); S.x - x0 > 2 ? ok('Shift rolls') : fail('roll ' + (S.x - x0));
// sidearm
const sh0 = ctx.run.shots; ctx.input.setTouch('fire', true); stepCalm(60); ctx.input.setTouch('fire', false);
ctx.run.shots - sh0 >= 3 ? ok(`sidearm fires on foot (${ctx.run.shots - sh0} shots / s)`) : fail('sidearm');
// pilot takes damage on its own bar; the parked frame can't be hurt
P.inv = 0; const hull0 = P.hull; S.inv = 0; const hp0 = S.hp; ctx.hurtTarget(10); ctx.player.hurt(50);
S.hp === hp0 - 10 && P.hull === hull0 ? ok('enemy fire hurts the pilot, not the parked frame') : fail(`pilot dmg ${hp0 - S.hp} frame ${hull0 - P.hull}`);
// parked frame auto-defends
ctx.director.spawn('drone'); const dd = ctx.enemies[ctx.enemies.length - 1];
dd.x = P.x + 12; dd.y = P.y + 6; dd.frozenT = 30; dd.hp = dd.max = 500;
step(90);
dd.hp < 500 ? ok(`parked frame auto-defends (${(500 - dd.hp).toFixed(0)} dmg to a drone in 1.5 s)`) : fail('no auto-defend');
ctx.director.kill(dd, 'test');
// board again
S.x = P.x + 1; S.y = P.y; S.vx = 0; stepCalm(2);
store.get().hud.prompt?.text === 'Board frame' || (step(3), store.get().hud.prompt?.text === 'Board frame') ? ok('prompt: "E · Board frame" beside the mech') : fail('board prompt ' + JSON.stringify(store.get().hud.prompt));
press2('KeyE'); step(1); release2('KeyE');
!S.active && P.mode === 'piloted' && !ctx.T.onFoot ? ok('E boards the frame') : fail('board');
// pilot-only stash can't be collected by the frame
ctx.pickups.spawn('repair', P.x, P.y, { pilotOnly: true }); const pc = ctx.pickups.count; step(3);
ctx.pickups.count === pc ? ok('frame cannot collect pilot-only stashes') : fail('frame took a stash');
ctx.pickups.clear();

// ladders
press2('KeyX'); step(1); release2('KeyX'); stepCalm(90);
const lad = W.ladders.find((l) => l.y1 > 5);
S.x = lad.x; S.y = 0; S.vy = 0; S.ground = true; stepCalm(1);
hold('KeyW', Math.ceil((lad.y1 / 5 + 0.6) / DT));
Math.abs(S.y - lad.y1) < 0.01 && S.ground && !S.climb ? ok(`W climbs a ladder to the ${lad.y1} m catwalk`) : fail(`ladder y=${S.y} climb=${!!S.climb}`);
hold('KeyS', Math.ceil((lad.y1 / 5 + 0.6) / DT)); stepCalm(10);
S.y < 0.01 ? ok('S climbs back down') : fail('ladder down ' + S.y);

// pilot-only ledge: the pilot stands on it, the frame falls through
const roof = W.plats.find((p) => p.pilotOnly);
S.x = roof.x; S.y = roof.top + 1; S.vy = 0; S.ground = false; stepCalm(60);
Math.abs(S.y - roof.top) < 0.01 ? ok(`pilot lands on the rooftop ledge (${roof.top} m)`) : fail('pilot roof ' + S.y);
const secRoof = W.secrets.find((x) => x.label === 'Rooftop stash');
secRoof.found ? ok('rooftop secret discovered') : fail('rooftop secret');
P.x = roof.x; P.y = roof.top + 1; P.vy = 0; P.ground = false; stepCalm(60);
P.y < roof.top - 1 ? ok('the frame falls straight through the pilot-only ledge') : fail('mech on ledge ' + P.y);

// crawlspace: the frame is blocked, the pilot walks in and finds the secret + stash
const blk = W.blockers[0], secT = W.secrets.find((x) => x.label === 'Crawlspace');
S.x = blk.x0 - 3; S.y = 0; S.vy = 0; S.ground = true; S.climb = null; stepCalm(2);
const sc0 = ctx.run.score, lives0 = ctx.run.lives = 0;
ctx.pickups.spawn('life', (blk.x0 + blk.x1) / 2, 0, { pilotOnly: true });
hold('KeyD', 60);
S.x > blk.x0 + 1 ? ok('pilot walks into the crawlspace') : fail('pilot blocked ' + S.x);
secT.found && ctx.run.score - sc0 >= SECRET_BONUS ? ok(`secret area found: +${SECRET_BONUS} bonus`) : fail('crawlspace secret');
ctx.run.lives === lives0 + 1 ? ok('pilot collected the stash inside') : fail('stash');
S.y < 0.01 ? ok('pilot stays under the crawlspace roof') : fail('pilot y in tunnel ' + S.y);
// put the pilot back in the frame and drive into the crawlspace
S.x = P.x = blk.x0 - 6; P.y = 0; P.vy = 0; P.ground = true; S.y = 0; stepCalm(2);
press2('KeyE'); step(1); release2('KeyE');
P.mode === 'piloted' ? ok('boarded again') : fail('reboard');
hold('KeyD', 120);
P.x < blk.x0 && P.y < 0.5 ? ok(`the frame is too tall for the crawlspace (stopped at ${P.x.toFixed(1)})`) : fail(`mech entered tunnel x=${P.x} y=${P.y}`);

// frame destroyed → auto-eject at 50% → 25 s → replacement drops in → board
S.hp = S.maxHp; ctx.run.lives = 0; ctx.R.contT = 0; ctx.R.shieldT = 0;
P.x = -30; P.inv = 0; ctx.player.hurt(99999); step(1);
S.active && P.mode === 'destroyed' && S.hp === Math.ceil(S.maxHp * 0.5) ? ok(`frame destroyed: pilot auto-ejects at 50% health (${S.hp})`) : fail(`auto eject ${S.active} ${P.mode} ${S.hp}`);
Math.abs(ctx.G.replaceT - MECH_REPLACEMENT_SECONDS) < 0.1 ? ok(`replacement frame countdown: ${MECH_REPLACEMENT_SECONDS} s`) : fail('replaceT ' + ctx.G.replaceT);
stepCalm(Math.ceil((MECH_REPLACEMENT_SECONDS - 1) / DT));
P.mode === 'destroyed' && store.get().hud.replaceT < 1.5 ? ok('HUD counts the replacement down') : fail('countdown ' + P.mode + ' ' + store.get().hud.replaceT);
stepCalm(Math.ceil(1.2 / DT));
P.mode === 'dropping' || P.mode === 'parked' ? ok('replacement frame drops in') : fail('no drop ' + P.mode);
stepCalm(Math.ceil(4 / DT));
P.mode === 'parked' && P.hull === P.maxHull && P.y < 0.01 + 20 ? ok(`replacement landed with full hull at x=${P.x.toFixed(1)}`) : fail('landing ' + P.mode);
S.x = P.x; S.y = P.y; stepCalm(2); press2('KeyE'); step(1); release2('KeyE');
P.mode === 'piloted' ? ok('pilot climbs into the replacement') : fail('board replacement');

// extra life: the pilot is killed with a life in hand → auto-continue in a fresh frame with 3 s protection
press2('KeyX'); step(1); release2('KeyX'); stepCalm(30);
ctx.run.lives = 1; S.inv = 0; ctx.R.contT = 0; ctx.pilot.hurt(99999); step(1);
ctx.run.lives === 0 && P.mode === 'piloted' && !S.active && ctx.R.contT > 2.5 ? ok('extra life used: auto-continue in a fresh frame') : fail(`continue lives=${ctx.run.lives} mode=${P.mode}`);
P.inv = 0; h = P.hull; ctx.hurtTarget(30); P.hull === h ? ok('continue grants 3 s of protection') : fail('no continue protection');
// pilot killed without a life → game over
press2('KeyX'); step(1); release2('KeyX'); stepCalm(10);
ctx.R.contT = 0; S.inv = 0; ctx.pilot.hurt(99999);
stepCalm(Math.ceil(2 / DT));
store.get().phase === 'over' ? ok('pilot killed with no lives left → game over') : fail('no game over on foot: ' + store.get().phase);

// ------------------------------------------------------------------ pilot-only side op
console.log('\nSide op: pilot-only mission');
const cleared0 = JSON.parse(ls.get('ironwalk.progress.v1')).cleared;
const SO = SIDE_OPS[0];
await engine.prepareMission({ mode: 'sideop', levelId: SO.id });
store.get().briefing.levelId === SO.id && ctx.world.ceiling === SO.ceiling ? ok(`${SO.name} built (ceiling ${SO.ceiling} m)`) : fail('side op build');
engine.deploy(); step(5);
S.active && P.mode === 'absent' ? ok('deployed on foot with no frame') : fail('side op start ' + P.mode);
press2('KeyX'); step(1); release2('KeyX');
S.active && P.mode === 'absent' ? ok('X does nothing without a frame') : fail('eject in side op');
const tSO = await playUntil(() => store.get().phase === 'debrief', { assist: 0.05, maxSec: 400 });
const dSO = store.get().debrief;
tSO > 0 && dSO?.sideOp ? ok(`side op cleared on foot in ${tSO.toFixed(0)}s · secrets ${dSO.secretsFound}/${dSO.secretsTotal}`) : fail('side op not completed (wave ' + ctx.waves.wave + ' ' + ctx.waves.state + ')');
JSON.parse(ls.get('ironwalk.progress.v1')).cleared === cleared0 ? ok('side op does not change campaign progress') : fail('side op touched progress');
engine.nextMission(); store.get().phase === 'missions' ? ok('"Continue" after a side op returns to mission select') : fail('side op next ' + store.get().phase);
releaseTouch();

// ------------------------------------------------------------------ endless boss waves
console.log('\nEndless');
await engine.prepareMission({ mode: 'endless' });
engine.deploy();
const bossesSeen = new Set();
await playUntil(() => { const b = ctx.director.boss(); if (b) bossesSeen.add(b.type); return ctx.waves.wave >= 11; }, { assist: 0.05, maxSec: 1500 });
ctx.waves.wave >= 11 ? ok(`reached wave ${ctx.waves.wave}; bosses faced: ${[...bossesSeen].join(', ')}`) : fail('endless stalled at wave ' + ctx.waves.wave + ' state ' + ctx.waves.state);

// pause / resume
engine.togglePause(); const before = ctx.G.time; step(30);
ctx.G.time === before && store.get().phase === 'paused' ? ok('pause freezes simulation') : fail('pause');
engine.togglePause(); store.get().phase === 'playing' ? ok('resume') : fail('resume');

// death → game over: the frame goes down, the pilot ejects, then the pilot is killed with no lives left
ctx.run.lives = 0; ctx.R.shieldT = 0; ctx.R.contT = 0;
P.inv = 0; ctx.player.hurt(99999);
ctx.S.active && P.mode === 'destroyed' ? ok('frame destroyed → pilot ejected') : fail('no eject on destruction');
ctx.S.inv = 0; ctx.pilot.hurt(99999);
await playUntil(() => store.get().phase === 'over', { immortal: false, maxSec: 5 });
const res = store.get().result;
res && store.get().phase === 'over' ? ok(`game over: score ${res.score}, reached "${res.reached}", kills ${res.totalKills}, acc ${(res.accuracy * 100).toFixed(0)}%, runs ${res.lifetime.runs}`) : fail('no game over');

// retry + menu
engine.retryMission(); await new Promise((r) => setTimeout(r, 50)); await engine.prepareMission({ mode: 'campaign', levelIndex: 1 });
engine.deploy(); step(120);
store.get().phase === 'playing' && ctx.world.ceiling === 17 ? ok('retry / replay mission works') : fail('retry');
engine.toTitle(); step(60);
store.get().phase === 'title' && ctx.enemies.length === 0 ? ok('abandon to title clears combat') : fail('toTitle');

console.log(`\nLive materials ${__stats.mats()} · geometries ${__stats.geos()}`);
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
