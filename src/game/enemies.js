// Regular enemy models + the enemy director (spawning, damage, death, per-frame AI).
// Boss models and behaviour live in bosses.js and plug in through BOSSES[type].
import * as THREE from 'three';
import { ENEMIES } from './config.js';
import { rand, clamp, lerp } from './util.js';
import { box, cyl, enemyMats, disposeTree, disposeMats } from './mech.js';
import { BOSSES } from './bosses.js';

export function makeDrone() {
  const mt = enemyMats(), g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), mt.hull); core.scale.set(1.35, 0.7, 1); core.castShadow = true; g.add(core);
  box(1.2, 0.18, 1.1, mt.accent, -0.2, 0.4, 0, g);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mt.glow); eye.position.set(0.86, 0, 0); g.add(eye);
  box(0.7, 0.14, 0.14, mt.dark, 0.35, -0.48, 0, g);
  const rotors = [];
  for (const z of [1, -1]) {
    box(0.16, 0.1, 0.55, mt.dark, 0, 0.2, z * 0.6, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 18), mt.dark); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.25, z * 1.05); g.add(ring);
    rotors.push(box(1.05, 0.03, 0.13, mt.joint, 0, 0.27, z * 1.05, g));
  }
  return { g, mt, rotors };
}

export function makeCrawler() {
  const mt = enemyMats(), g = new THREE.Group();
  box(3, 0.85, 2, mt.hull, 0, 0.95, 0, g);
  box(1.2, 0.5, 2.05, mt.dark, -1.1, 1.25, 0, g);
  const front = box(0.8, 0.7, 2, mt.hull, 1.55, 0.8, 0, g); front.rotation.z = 0.5;
  for (const z of [1.1, -1.1]) {
    box(3.4, 0.85, 0.55, mt.dark, 0, 0.45, z, g);
    for (let i = -1.2; i <= 1.21; i += 0.8) { const w = cyl(0.3, 0.3, 0.58, 10, mt.joint, g); w.rotation.x = Math.PI / 2; w.position.set(i, 0.42, z); }
  }
  const turret = new THREE.Group(); turret.position.set(0, 1.6, 0); g.add(turret);
  box(1.4, 0.6, 1.3, mt.hull, 0, 0, 0, turret);
  box(0.1, 0.14, 0.9, mt.glow, 0.71, 0.1, 0, turret);
  const barrel = new THREE.Group(); barrel.position.set(0.5, 0, 0); turret.add(barrel);
  const b = cyl(0.13, 0.16, 1.9, 8, mt.dark, barrel); b.rotation.z = Math.PI / 2; b.position.x = 0.95;
  const tip = new THREE.Object3D(); tip.position.x = 1.9; barrel.add(tip);
  return { g, mt, turret, barrel, tip };
}

// Used during loading so every enemy and boss shader is compiled before the first fight.
export function warmModels() {
  const list = [makeDrone(), makeCrawler()];
  for (const b of Object.values(BOSSES)) list.push(b.build());
  return list;
}

export function createDirector(ctx) {
  const list = ctx.enemies;
  const tmpV = new THREE.Vector3();

  function spawnX(min = 26, max = 36) {
    const A = ctx.world.arena - 4, P = ctx.T;
    let x = P.x + (Math.random() < 0.5 ? -1 : 1) * rand(min, max);
    if (Math.abs(x) > A) x = P.x - Math.sign(x - P.x) * rand(min, max);
    return clamp(x, -A, A);
  }

  function spawn(type, opts = {}) {
    const diff = ctx.G.difficulty;
    const e = { type, isBoss: false, x: opts.x ?? spawnX(), y: 0, vx: 0, vy: 0, t: rand(0, 10), dead: false, hitT: 0, face: 1 };
    if (type === 'drone' || type === 'crawler') {
      const cfg = ENEMIES[type];
      Object.assign(e, { hp: cfg.hp + diff * cfg.hpPerLevel, r: cfg.radius, cy: cfg.centerY, score: cfg.score });
      if (type === 'drone') {
        const top = ctx.world.ceiling ? ctx.world.ceiling - 3 : 17;
        Object.assign(e, makeDrone(), { y: opts.y ?? Math.min(top, rand(13, 17)), fireT: rand(1.5, 3), pref: rand(9, 16), side: Math.sign(e.x - ctx.T.x) || 1 });
      } else Object.assign(e, makeCrawler(), { fireT: rand(2, 3) });
    } else {
      const B = BOSSES[type];
      Object.assign(e, B.build(), { isBoss: true, name: B.name, title: B.title, hp: B.hp * (1 + diff * 0.04), r: B.radius, cy: B.centerY, score: B.score, phase: 1, fightTime: 0, hitsTaken: 0 });
      e.x = opts.x ?? spawnX(28, 34);
      B.init(ctx, e);
    }
    e.max = e.hp;
    e.g.position.set(e.x, e.y, 0);
    ctx.scene.add(e.g); list.push(e);
    return e;
  }

  function hurt(e, d, source) {
    if (e.dead || e.invulnerable) return;
    e.hp -= d; e.hitT = 0.08;
    if (e.isBoss && e.phase === 1 && e.hp < e.max * 0.5) {
      e.phase = 2;
      BOSSES[e.type].enrage?.(ctx, e);
      ctx.banner(`${e.name} enraged`, 'Phase two · watch the pattern change', 2000);
      ctx.shake(0.8); ctx.audio.sfx('alarm');
    }
    if (e.hp <= 0) kill(e, source);
  }

  function kill(e, source) {
    if (e.dead) return;
    e.dead = true;
    const pts = ctx.score.kill(e, source);
    const big = e.isBoss ? 3 : e.type === 'crawler' ? 1.3 : 1;
    ctx.weapons.explode(e.x, e.y + e.cy, 0, 0, 0, true, big);
    if (e.isBoss) {
      const { x, y, cy } = e;
      ctx.G.chain = [[0.2, x + 2, y + cy + 1, 1.6], [0.45, x - 2, y + cy - 1, 1.4], [0.75, x, y + cy + 2, 2.2], [1.1, x + 1, y + 1, 1.8]];
      ctx.banner(`${e.name} destroyed`, `+${pts.toLocaleString()}`, 2600);
      ctx.onBossDefeated(e);
    } else ctx.pickups.maybeDrop(e);
    ctx.scene.remove(e.g); disposeTree(e.g); disposeMats(e.mt);
  }

  function updateDrone(e, dt) {
    const P = ctx.T, px = P.x, py = P.y + P.cy, dx = px - e.x;
    if (Math.random() < dt * 0.15) e.side = -e.side;
    const top = ctx.world.ceiling ? ctx.world.ceiling - 2.5 : 30;
    const tx = px + e.side * e.pref, ty = Math.min(top, P.y + 9 + Math.sin(e.t * 1.4) * 1.6);
    e.vx += ((tx - e.x) * 2.2 - e.vx * 1.8) * dt; e.vy += ((ty - e.y) * 2.2 - e.vy * 1.8) * dt;
    e.x += e.vx * dt; e.y = Math.min(top, e.y + e.vy * dt);
    e.face = dx >= 0 ? 1 : -1;
    e.g.rotation.y = lerp(e.g.rotation.y, e.face > 0 ? 0 : Math.PI, dt * 6);
    e.g.rotation.z = clamp(-e.vx * 0.04 * e.face, -0.4, 0.4);
    e.rotors.forEach((r) => (r.rotation.y += dt * 40));
    e.fireT -= dt;
    e.mt.glow.emissiveIntensity = e.fireT < 0.45 ? 6 + Math.sin(e.t * 60) * 3 : 3;
    if (e.fireT <= 0) {
      e.fireT = rand(1.9, 3) - Math.min(0.8, ctx.G.difficulty * 0.08);
      if (Math.hypot(dx, py - e.y) < 40 && !P.dead) ctx.weapons.enemyFire({ x: e.x + e.face * 0.9, y: e.y - 0.3, tx: px + P.vx * 0.3, ty: py, speed: ENEMIES.drone.boltSpeed, dmg: ENEMIES.drone.boltDamage });
    }
  }

  function updateCrawler(e, dt) {
    const P = ctx.T, px = P.x, py = P.y + P.cy, dx = px - e.x, dist = Math.abs(dx);
    const want = dist > 17 ? Math.sign(dx) : dist < 9 ? -Math.sign(dx) : 0;
    e.vx = lerp(e.vx, want * 5.5, dt * 2); e.x = clamp(e.x + e.vx * dt, -ctx.world.arena, ctx.world.arena);
    const facing = dx >= 0 ? 1 : -1;
    e.g.rotation.y = lerp(e.g.rotation.y, facing > 0 ? 0 : Math.PI, dt * 2.5);
    e.face = Math.cos(e.g.rotation.y) > 0 ? 1 : -1;
    const la = clamp(Math.atan2(py - (e.y + 1.6), Math.abs(dx)), -0.1, 0.9);
    e.barrel.rotation.z = lerp(e.barrel.rotation.z, la, dt * 4);
    e.g.position.y = (Math.abs(Math.sin(e.t * 14)) * 0.04 * Math.abs(e.vx)) / 5;
    e.fireT -= dt; e.mt.glow.emissiveIntensity = e.fireT < 0.5 ? 7 : 3;
    if (e.fireT <= 0) {
      e.fireT = rand(2.4, 3.2) - Math.min(0.8, ctx.G.difficulty * 0.06);
      if (dist < 45 && e.face === facing && !P.dead) {
        e.tip.getWorldPosition(tmpV);
        ctx.weapons.enemyFire({ x: tmpV.x, y: tmpV.y, tx: px, ty: py, speed: ENEMIES.crawler.boltSpeed, dmg: ENEMIES.crawler.boltDamage });
        ctx.fx.emit(ctx.fx.SMOKE, { x: tmpV.x, y: tmpV.y, life: 0.8, s0: 1, s1: 3, c: 0x5a524a, a: 0.6, vy: 1.5 });
        e.barrel.position.x = 0.2;
      }
    }
    e.barrel.position.x = lerp(e.barrel.position.x, 0.5, dt * 6);
  }

  function update(dt) {
    for (const e of list) {
      if (e.dead) continue;
      if (e.frozenT > 0) {
        // Freeze pickup: no movement, no firing, icy tint and frost particles
        e.frozenT -= dt;
        e.mt.hull.emissive.setHex(e.frozenT > 0 ? 0x3a78b8 : 0);
        if (Math.random() < dt * 6) ctx.fx.emit(ctx.fx.FX, { x: e.x + rand(-e.r, e.r), y: e.y + e.cy + rand(-e.r, e.r), z: 0.6, vy: rand(-1, 1), life: 0.5, s0: 0.5, s1: 0.1, c: 0xd8f4ff });
        if (e.hitT > 0) e.hitT -= dt;
        continue;
      }
      e.t += dt;
      if (e.type === 'drone') updateDrone(e, dt);
      else if (e.type === 'crawler') updateCrawler(e, dt);
      else { e.fightTime += dt; BOSSES[e.type].update(ctx, e, dt); }
      if (e.hitT > 0) { e.hitT -= dt; e.mt.hull.emissive.setHex(0x664433); } else e.mt.hull.emissive.setHex(0);
      e.g.position.x = e.x;
      if (e.type !== 'crawler') e.g.position.y = e.y;
    }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) list.splice(i, 1);
  }

  function clear() {
    for (const e of list) { ctx.scene.remove(e.g); disposeTree(e.g); disposeMats(e.mt); }
    list.length = 0;
  }

  // Freeze pickup: every enemy inside the camera view stops for `sec` seconds
  function freezeInView(camX, halfWidth, sec) {
    let n = 0;
    for (const e of list) if (!e.dead && Math.abs(e.x - camX) < halfWidth + e.r) { e.frozenT = sec; n++; }
    return n;
  }

  return { spawn, hurt, kill, update, clear, freezeInView, boss: () => list.find((e) => e.isBoss && !e.dead) || null, count: (type) => list.filter((e) => !e.dead && (!type || e.type === type)).length };
}
