// Boss fights. Each boss has: build() → model, init() → intro state, update() → AI, enrage() → phase two at 50% hp.
// Shared tools come from ctx: ctx.weapons.enemyFire / explode, ctx.hurtTarget / knockTarget, ctx.director.spawn, ctx.fx, ctx.audio.
// ctx.T is whatever the player currently controls: the mech, or the pilot on foot (x, y, cy, h, w, vx, dead, inv, ground).
import * as THREE from 'three';
import { rand, clamp, lerp } from './util.js';
import { box, cyl, enemyMats, makeMech, animMech } from './mech.js';

const tmpV = new THREE.Vector3();

// --- shared helpers ----------------------------------------------------------
function facePlayer(ctx, e, base, dt, rate = 5) {
  const facing = ctx.T.x >= e.x ? 1 : -1;
  e.turn = lerp(e.turn ?? 1, facing, Math.min(1, dt * rate));
  e.g.scale.x = base * (Math.abs(e.turn) < 0.15 ? 0.15 * Math.sign(e.turn || 1) : e.turn);
  e.face = facing;
  return facing;
}
function playerCenter(ctx) { return { px: ctx.T.x, py: ctx.T.y + ctx.T.cy }; }
function lobAt(ctx, x, y, tx, ty, T, g, opts) {
  // ballistic shell that lands at (tx, ty) after T seconds, with a ground marker shown in advance
  const vx = (tx - x) / T, vy = (ty - y + 0.5 * g * T * T) / T;
  ctx.weapons.enemyFire({ x, y, vx, vy, g, ...opts });
  ctx.fx.emit(ctx.fx.FX, { x: tx, y: 0.15, z: 0.5, life: T, s0: 3.2, s1: 1.2, c: 0xff2a1a, a: 0.9 });
}
function intro(ctx, e, sub) { ctx.bossIntro(e, sub); }

// ============================================================================
// ANVIL — siege walker (Freight Yard)
// ============================================================================
const ANVIL = {
  name: 'ANVIL', title: 'Siege walker', hp: 1400, radius: 3.4, centerY: 4.4, score: 5000,
  build() { const mt = enemyMats(0xff3020, 0x4a3a34); const mech = makeMech(mt, { chassis: 'bulwark' }); mech.root.scale.setScalar(1.6); return { g: mech.root, mech, mt }; },
  init(ctx, e) { Object.assign(e, { y: 34, vy: -10, state: 'drop', fireT: 3, burst: 0, burstT: 0, chargeCD: 6, chargeT: 0, turn: 1, base: 1.6 }); intro(ctx, e, 'Orbital drop inbound'); },
  enrage(ctx, e) { e.mt.glow.emissiveIntensity = 6; e.chargeCD = 1.5; },
  update(ctx, e, dt) {
    const m = e.mech, P = ctx.T, { px, py } = playerCenter(ctx), dx = px - e.x, dist = Math.abs(dx);
    if (e.state === 'drop') {
      e.vy -= 30 * dt; e.y += e.vy * dt;
      m.flames.forEach((f) => (f.scale.y = 1.6));
      ctx.fx.emit(ctx.fx.FX, { x: e.x - 2, y: e.y + 3, z: rand(-0.6, 0.6), vy: -14, life: 0.25, s0: 2, s1: 0.5, c: 0xff8030 });
      if (e.y <= 0) {
        e.y = 0; e.state = 'walk'; ctx.fx.ring(e.x, 0); ctx.shake(1.6); ctx.audio.sfx('stomp'); ctx.fx.scorch(e.x, 7);
        for (let i = 0; i < 18; i++) ctx.fx.emit(ctx.fx.SMOKE, { x: e.x + rand(-3, 3), y: 0.5, z: rand(-2, 2), vx: rand(-10, 10), vy: rand(0.5, 2), life: 1.6, s0: 2, s1: 7, c: 0x5a524a, a: 0.6, drag: 2 });
        if (dist < 8 && P.y < 3) ctx.hurtTarget(20);
      }
      animMech(m, 0, true, 0, dt); return;
    }
    const facing = facePlayer(ctx, e, e.base, dt);
    const p2 = e.phase === 2;
    e.chargeCD -= dt;
    if (e.state === 'charge') {
      e.chargeT -= dt; e.vx = e.cdir * (p2 ? 26 : 22);
      ctx.fx.emit(ctx.fx.FX, { x: e.x - e.cdir * 2.5, y: e.y + 5, vx: -e.cdir * 10, life: 0.2, s0: 2, s1: 0.4, c: 0xff6020 });
      if (Math.abs(P.x - e.x) < 3.8 && P.y < 6 && P.inv <= 0) { ctx.hurtTarget(22); ctx.knockTarget(e.cdir * 24, 10); ctx.shake(1); }
      if (e.chargeT <= 0) {
        e.state = 'walk'; e.chargeCD = p2 ? rand(3.5, 5) : rand(6, 8);
        if (p2) { ctx.fx.ring(e.x, 0); ctx.shake(1); ctx.audio.sfx('stomp'); if (Math.abs(P.x - e.x) < 9 && P.ground) ctx.hurtTarget(14); }
      }
    } else {
      e.vx = lerp(e.vx, dist > 14 ? facing * (p2 ? 4.4 : 3.4) : 0, dt * 3);
      if (e.chargeCD <= 0 && dist < 26 && dist > 6 && !P.dead) { e.state = 'charge'; e.chargeT = 0.8; e.cdir = facing; ctx.audio.sfx('dash'); }
    }
    e.x = clamp(e.x + e.vx * dt, -ctx.world.arena, ctx.world.arena);
    animMech(m, e.vx * Math.sign(e.g.scale.x) * 1.1, false, 0, dt);
    m.flames.forEach((f) => (f.scale.y = e.state === 'charge' ? 1.3 : 0.01));
    const la = clamp(Math.atan2(py - (e.y + 6.2), Math.abs(dx)), -0.9, 0.9);
    m.armN.rotation.z = lerp(m.armN.rotation.z, la, dt * 5);
    m.barrels.rotation.x += dt * (e.burst > 0 ? 30 : 3);
    e.fireT -= dt;
    if (e.fireT <= 0 && !P.dead && dist < 48) { e.burst = p2 ? 5 : 3; e.burstT = 0; e.fireT = p2 ? rand(2, 2.6) : rand(2.8, 3.6); }
    if (e.burst > 0) {
      e.burstT -= dt;
      if (e.burstT <= 0) { e.burst--; e.burstT = 0.15; e.g.updateMatrixWorld(true); m.muzzle.getWorldPosition(tmpV); ctx.weapons.enemyFire({ x: tmpV.x, y: tmpV.y, tx: px, ty: py + rand(-1.5, 1.5), speed: 25, dmg: 10 }); }
    }
    m.body.rotation.z = e.state === 'charge' ? -0.12 : 0;
  },
};

// ============================================================================
// CRUCIBLE — foundry siege tank with mortar battery (Foundry 7)
// ============================================================================
const CRUCIBLE = {
  name: 'CRUCIBLE', title: 'Foundry siege tank', hp: 2000, radius: 3.8, centerY: 2.6, score: 6000,
  build() {
    const mt = enemyMats(0xff6a1a, 0x4a3a30), g = new THREE.Group();
    box(8, 2.6, 4.2, mt.hull, 0, 2.2, 0, g);
    box(5, 1.2, 3.6, mt.dark, -0.8, 4.1, 0, g);
    for (const z of [2.5, -2.5]) {
      box(9, 1.8, 1, mt.dark, 0, 1, z, g);
      for (let x = -3.6; x <= 3.61; x += 1.2) { const w = cyl(0.62, 0.62, 1.05, 12, mt.joint, g); w.rotation.x = Math.PI / 2; w.position.set(x, 0.9, z); }
    }
    const plow = box(1.2, 2.6, 4.8, mt.accent, 4.4, 1.6, 0, g); plow.rotation.z = 0.35;
    const grill = box(0.2, 1.1, 3, mt.glow, 4.05, 2.6, 0, g); grill.castShadow = false;
    const tubes = [];
    for (const z of [-1.1, 0, 1.1]) {
      const t = new THREE.Group(); t.position.set(-2.2, 4.8, z); g.add(t);
      const c = cyl(0.42, 0.48, 2, 12, mt.joint, t); c.rotation.z = 0.5; c.position.set(-0.4, 0.7, 0);
      const tip = new THREE.Object3D(); tip.position.set(-0.9, 1.6, 0); t.add(tip); tubes.push(tip);
    }
    const turret = new THREE.Group(); turret.position.set(1.4, 4.9, 0); g.add(turret);
    box(2.2, 1, 2.2, mt.hull, 0, 0, 0, turret);
    const tips = [];
    for (const z of [0.45, -0.45]) { const b = cyl(0.16, 0.2, 2.4, 10, mt.dark, turret); b.rotation.z = Math.PI / 2; b.position.set(1.9, 0, z); const tip = new THREE.Object3D(); tip.position.set(3.1, 0, z); turret.add(tip); tips.push(tip); }
    return { g, mt, tubes, turret, tips };
  },
  init(ctx, e) {
    const A = ctx.world.arena;
    e.x = ctx.T.x > 0 ? -A + 2 : A - 2;
    Object.assign(e, { state: 'intro', mortarT: 3, turretT: 2, burst: 0, burstT: 0, droneT: 6, face: 1 });
    e.g.rotation.y = e.x < ctx.T.x ? 0 : Math.PI;
    intro(ctx, e, 'Heavy armor breaching the hall');
  },
  enrage(ctx, e) { e.mt.glow.emissiveIntensity = 7; e.droneT = 1; },
  update(ctx, e, dt) {
    const P = ctx.T, { px, py } = playerCenter(ctx), dx = px - e.x, dist = Math.abs(dx), p2 = e.phase === 2;
    const facing = dx >= 0 ? 1 : -1;
    if (e.state === 'intro') {
      e.vx = facing * 7; if (dist < 22) e.state = 'fight';
    } else {
      const want = dist > 24 ? facing : dist < 14 ? -facing : 0;
      e.vx = lerp(e.vx, want * (p2 ? 4 : 3), dt * 1.5);
    }
    e.x = clamp(e.x + e.vx * dt, -ctx.world.arena + 3, ctx.world.arena - 3);
    e.g.rotation.y = lerp(e.g.rotation.y, facing > 0 ? 0 : Math.PI, dt * 1.2);
    e.g.position.y = Math.abs(Math.sin(e.t * 10)) * 0.05;
    e.turret.rotation.z = lerp(e.turret.rotation.z, clamp(Math.atan2(py - 5, dist), -0.2, 0.7), dt * 3);
    // treads crush anything standing in the way
    if (Math.abs(P.x - e.x) < 4.8 && P.y < 4.6 && P.inv <= 0) { ctx.hurtTarget(12 * dt * 4); ctx.knockTarget(Math.sign(P.x - e.x) * 14, 6); }
    if (e.state === 'intro') return;

    e.mortarT -= dt;
    if (e.mortarT <= 0 && !P.dead) {
      e.mortarT = p2 ? 2.8 : 4.2;
      const offsets = p2 ? [-7, -3.5, 0, 3.5, 7] : [-4, 0, 4];
      const lead = P.vx * 0.6;
      e.g.updateMatrixWorld(true);
      offsets.forEach((o, i) => {
        const tip = e.tubes[i % e.tubes.length]; tip.getWorldPosition(tmpV);
        lobAt(ctx, tmpV.x, tmpV.y, clamp(px + lead + o, -ctx.world.arena, ctx.world.arena), 0, 1.5, 22, { dmg: 16, explosive: true, radius: 3.6, scale: 1.7, color: 0xff6a1a });
        ctx.fx.emit(ctx.fx.SMOKE, { x: tmpV.x, y: tmpV.y, life: 1.2, s0: 1.5, s1: 4, c: 0x3a3230, a: 0.7, vy: 3 });
      });
      ctx.audio.sfx('mortar'); ctx.shake(0.3);
    }
    e.turretT -= dt;
    if (e.turretT <= 0 && !P.dead) { e.turretT = p2 ? 1.8 : 2.6; e.burst = 4; e.burstT = 0; }
    if (e.burst > 0) {
      e.burstT -= dt;
      if (e.burstT <= 0) { e.burst--; e.burstT = 0.12; e.g.updateMatrixWorld(true); e.tips[e.burst % 2].getWorldPosition(tmpV); ctx.weapons.enemyFire({ x: tmpV.x, y: tmpV.y, tx: px, ty: py, speed: 27, dmg: 9 }); }
    }
    if (p2) {
      e.droneT -= dt;
      if (e.droneT <= 0) { e.droneT = 14; if (ctx.director.count('drone') < 4) for (let i = 0; i < 2; i++) ctx.director.spawn('drone', { x: e.x + rand(-3, 3), y: 7 }); ctx.audio.sfx('alarm'); }
      if (Math.random() < dt * 6) ctx.fx.emit(ctx.fx.FX, { x: e.x + facing * 4, y: 2.6, z: rand(-1.4, 1.4), vx: facing * rand(2, 5), vy: rand(1, 4), life: 0.5, s0: 0.6, s1: 0.1, c: 0xff8a3a, g: -10 });
    }
  },
};

// ============================================================================
// HARRIER — strike gunship (Salt Flats Relay)
// ============================================================================
const HARRIER = {
  name: 'HARRIER', title: 'Strike gunship', hp: 1700, radius: 3.2, centerY: 0, score: 6500,
  build() {
    const mt = enemyMats(0xff3020, 0x5a5f58), g = new THREE.Group();
    const fus = cyl(1.2, 1.0, 6, 14, mt.hull, g); fus.rotation.z = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2, 14), mt.dark); nose.rotation.z = -Math.PI / 2; nose.position.x = 4.1; nose.castShadow = true; g.add(nose);
    box(0.9, 0.5, 1.6, mt.glow, 3.3, 0.6, 0, g).castShadow = false; // canopy glow
    box(4, 0.5, 0.6, mt.dark, -4.4, 0.3, 0, g);
    const fin = box(1.4, 1.8, 0.2, mt.accent, -6, 1.2, 0, g); fin.rotation.z = 0.3;
    box(1.6, 0.25, 7, mt.hull, -0.4, 0.1, 0, g);
    const fans = [];
    for (const z of [3.6, -3.6]) {
      const duct = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.22, 8, 22), mt.dark); duct.rotation.x = Math.PI / 2; duct.position.set(-0.4, 0.1, z); g.add(duct);
      const blade = box(2.4, 0.06, 0.3, mt.joint, -0.4, 0.1, z, g); fans.push(blade);
      const blade2 = box(0.3, 0.06, 2.4, mt.joint, 0, 0, 0, blade); blade2.position.set(0, 0, 0);
      box(0.6, 0.2, 0.6, mt.glow, -0.4, -0.3, z, g).castShadow = false;
    }
    const chin = new THREE.Group(); chin.position.set(2.4, -1.1, 0); g.add(chin);
    box(0.8, 0.6, 0.8, mt.dark, 0, 0, 0, chin);
    const b = cyl(0.12, 0.12, 1.4, 8, mt.joint, chin); b.rotation.z = Math.PI / 2; b.position.x = 0.8;
    const tip = new THREE.Object3D(); tip.position.x = 1.5; chin.add(tip);
    return { g, mt, fans, chin, tip };
  },
  init(ctx, e) {
    const A = ctx.world.arena;
    e.x = clamp(ctx.T.x + (ctx.T.x > 0 ? -40 : 40), -A, A); e.y = 22;
    Object.assign(e, { state: 'intro', fanT: 3, strafeT: 8, missileT: 4, bombT: 0, side: Math.sign(e.x - ctx.T.x) || 1, sirenT: 0 });
    intro(ctx, e, 'Air support on station');
  },
  enrage(ctx, e) { e.mt.glow.emissiveIntensity = 7; e.strafeT = Math.min(e.strafeT, 2); },
  update(ctx, e, dt) {
    const P = ctx.T, { px, py } = playerCenter(ctx), p2 = e.phase === 2;
    const top = ctx.world.ceiling ? ctx.world.ceiling - 3 : 40;
    e.fans.forEach((f) => (f.rotation.y += dt * 30));
    let tx, ty;
    if (e.state === 'strafe') {
      e.vx = e.dir * (p2 ? 24 : 20); tx = e.x + e.vx; ty = P.y + 10;
      e.bombT -= dt;
      if (e.bombT <= 0) { e.bombT = p2 ? 0.16 : 0.22; ctx.weapons.enemyFire({ x: e.x, y: e.y - 1.2, vx: e.vx * 0.35, vy: -2, g: 30, dmg: 14, explosive: true, radius: 3.4, scale: 1.4, color: 0xffa040 }); }
      if ((e.x - px) * e.dir > 30 || Math.abs(e.x) > ctx.world.arena + 6) { e.state = 'hover'; e.side = e.dir; e.strafeT = p2 ? 6 : 9; }
    } else {
      tx = px + e.side * 14; ty = Math.min(top, P.y + 11 + Math.sin(e.t * 0.9) * 1.5);
      if (e.state === 'intro' && Math.abs(e.x - tx) < 6) e.state = 'hover';
    }
    if (e.state !== 'strafe') { e.vx += ((tx - e.x) * 1.4 - e.vx * 1.4) * dt; }
    e.vy += ((Math.min(top, ty) - e.y) * 1.8 - e.vy * 1.6) * dt;
    e.x += e.vx * dt; e.y = Math.min(top, e.y + e.vy * dt);
    const facing = e.state === 'strafe' ? e.dir : px >= e.x ? 1 : -1;
    e.g.rotation.y = lerp(e.g.rotation.y, facing > 0 ? 0 : Math.PI, dt * 3);
    e.g.rotation.z = clamp(-e.vx * 0.02 * (Math.cos(e.g.rotation.y) > 0 ? 1 : -1), -0.35, 0.35);
    e.chin.rotation.z = lerp(e.chin.rotation.z, clamp(Math.atan2(py - e.y, Math.abs(px - e.x)), -1.2, 0.3), dt * 4);
    if (e.state === 'intro' || P.dead) return;

    e.strafeT -= dt;
    if (e.state === 'hover' && e.strafeT <= 0) {
      e.state = 'strafe'; e.dir = px >= e.x ? 1 : -1; e.bombT = 0.4;
      ctx.banner('', 'Bombing run · get clear', 1200); ctx.audio.sfx('alarm');
    }
    if (e.state === 'hover') {
      e.fanT -= dt;
      if (e.fanT <= 0) {
        e.fanT = p2 ? 2.2 : 3;
        e.g.updateMatrixWorld(true); e.tip.getWorldPosition(tmpV);
        const a = Math.atan2(py - tmpV.y, px - tmpV.x), n = p2 ? 7 : 5;
        for (let i = 0; i < n; i++) { const aa = a + (i - (n - 1) / 2) * 0.13; ctx.weapons.enemyFire({ x: tmpV.x, y: tmpV.y, tx: tmpV.x + Math.cos(aa) * 10, ty: tmpV.y + Math.sin(aa) * 10, speed: 23, dmg: 8 }); }
      }
      if (p2) {
        e.missileT -= dt;
        if (e.missileT <= 0) { e.missileT = 5; for (let i = 0; i < 2; i++) ctx.weapons.enemyFire({ x: e.x, y: e.y - 0.5, vx: rand(-6, 6), vy: 8, home: 2.2, speed: 16, dmg: 12, explosive: true, radius: 2.6, scale: 1.2, color: 0xff3020, life: 5 }); ctx.audio.sfx('rocket'); }
      }
    }
  },
};

// ============================================================================
// REVENANT — rogue heavy frame that mirrors the player's kit (Sublevel Reactor)
// ============================================================================
const REVENANT = {
  name: 'REVENANT', title: 'Rogue heavy frame', hp: 2600, radius: 2.8, centerY: 3.8, score: 9000,
  build() { const mt = enemyMats(0x3fd6ff, 0x2a3036); const mech = makeMech(mt, { chassis: 'bulwark', primary: 'rail', secondary: 'seeker' }); mech.root.scale.setScalar(1.3); return { g: mech.root, mech, mt }; },
  init(ctx, e) {
    Object.assign(e, { y: Math.min(30, (ctx.world.ceiling || 34) - 6), vy: -6, ground: false, state: 'drop', fireT: 2.5, burst: 0, burstT: 0, rocketT: 5, jumpT: 4, dashT: 0, dashCD: 3, summons: 0, turn: 1, base: 1.3 });
    intro(ctx, e, 'Hostile frame signature matches yours');
  },
  enrage(ctx, e) { e.mt.glow.emissive.setHex(0xff3020); e.mt.glow.emissiveIntensity = 5; },
  update(ctx, e, dt) {
    const m = e.mech, P = ctx.T, { px, py } = playerCenter(ctx), dx = px - e.x, dist = Math.abs(dx), p2 = e.phase === 2;
    const facing = facePlayer(ctx, e, e.base, dt, 8);
    const top = ctx.world.ceiling ? ctx.world.ceiling - 6.5 : 30;
    // summons at 50% and 25%
    if (p2 && e.summons === 0 || e.hp < e.max * 0.25 && e.summons === 1) {
      e.summons++; for (let i = 0; i < 2; i++) ctx.director.spawn('drone', { x: e.x + (i ? 4 : -4), y: Math.min(top, 10) });
    }
    let thrust = false;
    if (e.state === 'drop') { thrust = e.y > 2; }
    else if (e.dashT > 0) {
      e.dashT -= dt; e.vx = e.ddir * 32;
      ctx.fx.emit(ctx.fx.FX, { x: e.x - e.ddir * 2, y: e.y + 4, z: rand(-0.6, 0.6), vx: -e.ddir * 16, life: 0.2, s0: 2, s1: 0.4, c: p2 ? 0xff5040 : 0x3fd6ff });
    } else {
      const want = dist > 20 ? facing : dist < 11 ? -facing : Math.sin(e.t * 0.8) * 0.4;
      e.vx = lerp(e.vx, want * (p2 ? 10 : 8), dt * 3);
      e.dashCD -= dt;
      if (e.dashCD <= 0 && e.ground) { e.dashCD = p2 ? rand(2, 3) : rand(3.5, 5); e.dashT = 0.25; e.ddir = Math.random() < 0.6 ? -facing : facing; ctx.audio.sfx('dash'); }
      e.jumpT -= dt;
      if (e.jumpT <= 0 && e.ground) { e.jumpT = p2 ? rand(3, 4.5) : rand(4.5, 6.5); e.vy = 16; e.ground = false; e.hover = 1.1; }
    }
    if (!e.ground && e.hover > 0 && e.vy < 2) { e.hover -= dt; e.vy += 50 * dt; thrust = true; }
    e.vy -= 34 * dt;
    e.x = clamp(e.x + e.vx * dt, -ctx.world.arena, ctx.world.arena);
    e.y = Math.min(top, e.y + e.vy * dt);
    if (e.y <= 0) {
      if (!e.ground && e.vy < -18) { ctx.fx.ring(e.x, 0); ctx.shake(0.8); ctx.audio.sfx('stomp'); if (e.state === 'drop' && dist < 7 && P.y < 3) ctx.hurtTarget(16); }
      e.y = 0; e.vy = 0; e.ground = true; if (e.state === 'drop') e.state = 'fight';
    }
    animMech(m, e.ground ? e.vx * Math.sign(e.g.scale.x) : 0, !e.ground, 0, dt);
    m.flames.forEach((f) => (f.scale.y = thrust ? rand(0.9, 1.3) : e.dashT > 0 ? 0.9 : 0.01));
    if (thrust) ctx.fx.emit(ctx.fx.FX, { x: e.x - facing * 2, y: e.y + 1.2, vy: -12, life: 0.18, s0: 1.4, s1: 0.3, c: p2 ? 0xff7050 : 0x7fe6ff });
    const la = clamp(Math.atan2(py - (e.y + 5), dist), -1, 1.1);
    m.armN.rotation.z = lerp(m.armN.rotation.z, la, dt * 6);
    if (e.state === 'drop' || P.dead) return;

    e.fireT -= dt;
    if (e.fireT <= 0 && dist < 50) { e.burst = p2 ? 6 : 4; e.burstT = 0; e.fireT = p2 ? rand(1.6, 2.2) : rand(2.2, 3); }
    if (e.burst > 0) {
      e.burstT -= dt;
      if (e.burstT <= 0) { e.burst--; e.burstT = 0.11; e.g.updateMatrixWorld(true); m.muzzle.getWorldPosition(tmpV); ctx.weapons.enemyFire({ x: tmpV.x, y: tmpV.y, tx: px + P.vx * 0.2, ty: py, speed: 28, dmg: 9, color: p2 ? 0xff3020 : 0x3fd6ff }); }
    }
    e.rocketT -= dt;
    if (e.rocketT <= 0) {
      e.rocketT = p2 ? 4 : 6; e.g.updateMatrixWorld(true); m.podMouth.getWorldPosition(tmpV);
      for (let i = 0; i < 3; i++) ctx.weapons.enemyFire({ x: tmpV.x, y: tmpV.y, vx: -facing * rand(2, 6), vy: rand(10, 14), home: 2.4, speed: 18, dmg: 12, explosive: true, radius: 2.6, scale: 1.1, color: 0x7fe6ff, life: 5 });
      ctx.audio.sfx('rocket');
    }
  },
};

export const BOSSES = { anvil: ANVIL, crucible: CRUCIBLE, harrier: HARRIER, revenant: REVENANT };
