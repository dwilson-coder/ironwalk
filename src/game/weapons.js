// Projectiles and explosions for both sides.
// Player: tracer bullets (chaingun/scattergun/sidearms), railgun beams, seeker rockets, mortar shells,
// and weapon-drop rockets (heat-seeking / cursor-aimed).
// Enemy: bolts with optional gravity (shells/bombs), homing (missiles) and explosive payloads.
import * as THREE from 'three';
import { ROCKETS, MORTAR } from './config.js';
import { TAU, rand, clamp, lerp, pick, segmentHitsCircle } from './util.js';

export function createWeapons(ctx) {
  const bullets = [], bolts = [], rockets = [], beams = [];
  const free = (a) => a.find((o) => !o.live);

  function init() {
    const { scene, tex } = ctx;
    const tracerGeo = new THREE.BoxGeometry(2, 0.08, 0.08), tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd08a, toneMapped: false });
    for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(tracerGeo, tracerMat); m.visible = false; scene.add(m); bullets.push({ m, live: false }); }

    const boltGeo = new THREE.SphereGeometry(0.24, 8, 6), boltMat = new THREE.MeshBasicMaterial({ color: 0xffd0c0, toneMapped: false });
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(boltGeo, boltMat);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0xff3020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.scale.setScalar(2.2); m.add(glow); m.visible = false; scene.add(m); bolts.push({ m, glow, live: false });
    }

    const rocketGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.8, 6); rocketGeo.rotateZ(Math.PI / 2);
    const shellGeo = new THREE.SphereGeometry(0.32, 10, 8);
    const rocketMat = new THREE.MeshStandardMaterial({ color: 0x5a5f62, roughness: 0.4, metalness: 0.85 });
    for (let i = 0; i < 20; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(rocketGeo, rocketMat), shell = new THREE.Mesh(shellGeo, rocketMat);
      g.add(body, shell);
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      f.position.x = -0.5; f.scale.setScalar(1.4); g.add(f); g.visible = false; scene.add(g);
      rockets.push({ g, body, shell, flame: f, live: false });
    }

    const beamGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 4; i++) {
      const core = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      const halo = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0x3fc8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      core.visible = halo.visible = false; scene.add(core, halo);
      beams.push({ core, halo, t: 0, live: false });
    }
  }

  // ---------------------------------------------------------------- player fire
  function fireBullet(x, y, z, ang, speed, life, dmg) {
    const b = free(bullets); if (!b) return;
    Object.assign(b, { live: true, x, y, z, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life, dmg });
    b.m.visible = true; b.m.rotation.z = ang; b.m.position.set(x, y, z);
  }

  function fireRail(x, y, z, ang, range, dmg) {
    const cx = Math.cos(ang), cy = Math.sin(ang);
    let len = range;
    if (cy < -0.01) len = Math.min(len, (y - 0.05) / -cy); // stop at the ground
    if (ctx.world.ceiling && cy > 0.01) len = Math.min(len, (ctx.world.ceiling - y) / cy);
    const x1 = x + cx * len, y1 = y + cy * len;
    let hits = 0;
    for (const e of ctx.enemies) {
      if (e.dead) continue;
      if (segmentHitsCircle(x, y, x1, y1, e.x, e.y + e.cy, e.r)) {
        ctx.director.hurt(e, dmg, 'rail'); hits++;
        for (let i = 0; i < 8; i++) ctx.fx.emit(ctx.fx.FX, { x: e.x, y: e.y + e.cy, z: 0.5, vx: cx * rand(6, 18) + rand(-4, 4), vy: cy * rand(6, 18) + rand(-4, 6), life: 0.4, s0: 0.5, s1: 0.1, c: 0xbff4ff, g: -20 });
      }
    }
    if (hits) ctx.score.hit(1);
    const B = free(beams);
    if (B) {
      B.live = true; B.t = 0.22; B.core.visible = B.halo.visible = true;
      for (const [m, w] of [[B.core, 0.16], [B.halo, 0.6]]) { m.position.set((x + x1) / 2, (y + y1) / 2, z); m.rotation.set(0, 0, ang); m.scale.set(len, w, w); }
    }
    for (let i = 0; i < 14; i++) { const k = Math.random(); ctx.fx.emit(ctx.fx.FX, { x: x + cx * len * k, y: y + cy * len * k, z, vy: rand(0.5, 2), life: rand(0.2, 0.5), s0: 0.9, s1: 0.1, c: 0x7fe6ff }); }
    ctx.fx.emit(ctx.fx.FX, { x: x1, y: y1, z, life: 0.25, s0: 3.5, s1: 0.5, c: 0x9fe8ff });
    ctx.fx.flash(x, y, z + 1, 4, 0.15, 0x7fe6ff);
    if (y1 < 0.3) ctx.fx.scorch(x1, 1.6);
  }

  function nearestToAim(aimV, maxD = 18) {
    let tgt = null, bd = 1e9;
    for (const e of ctx.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - aimV.x, e.y + e.cy - aimV.y); if (d < bd) { bd = d; tgt = e; } }
    return bd < maxD ? tgt : null;
  }

  function launchRocket(from, aimV, face, mult) {
    const r = free(rockets); if (!r) return;
    Object.assign(r, { live: true, kind: 'rocket', x: from.x, y: from.y, z: from.z, vx: face * rand(4, 9), vy: rand(14, 20), life: 3.2, age: 0, tgt: nearestToAim(aimV), tx: aimV.x, ty: aimV.y, dmg: ROCKETS.damage * mult, radius: ROCKETS.radius, turn: ROCKETS.turnRate, maxSpeed: ROCKETS.maxSpeed, steerAt: 0.18 });
    r.g.visible = true; r.body.visible = true; r.shell.visible = false; r.flame.visible = true; r.flame.material.color.setHex(0xffa040);
    ctx.run.rockets++;
    ctx.fx.emit(ctx.fx.SMOKE, { x: r.x, y: r.y, z: r.z, life: 0.8, s0: 1, s1: 3, c: 0x8a8580, a: 0.6, vy: 2 });
    ctx.audio.sfx('rocket');
  }

  function nearestEnemyTo(x, y, maxD = 60) {
    let tgt = null, bd = maxD;
    for (const e of ctx.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.y + e.cy - y); if (d < bd) { bd = d; tgt = e; } }
    return tgt;
  }

  // Weapon-drop rockets (pickups). 'heat': locks onto the nearest enemy and re-acquires if it dies.
  // 'turret': launches straight at the reticle and keeps steering toward wherever the reticle is, detonating there.
  function launchSpecial(type, from, face, mult = 1) {
    const r = free(rockets); if (!r) return false;
    const base = { live: true, kind: type, x: from.x, y: from.y, z: from.z, life: 3.6, age: 0, tgt: null, radius: 4.2, retarget: 0 };
    if (type === 'heat') {
      Object.assign(r, base, { vx: face * rand(6, 10), vy: rand(8, 12), dmg: 40 * mult, turn: 9, maxSpeed: 52, steerAt: 0.12, tgt: nearestEnemyTo(from.x, from.y), tx: from.x + face * 30, ty: from.y });
    } else {
      const a = Math.atan2(ctx.aimV.y - from.y, ctx.aimV.x - from.x);
      Object.assign(r, base, { vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, dmg: 45 * mult, turn: 12, maxSpeed: 64, steerAt: 0.04, tx: ctx.aimV.x, ty: ctx.aimV.y });
    }
    r.g.visible = true; r.body.visible = true; r.shell.visible = false; r.flame.visible = true;
    r.flame.material.color.setHex(type === 'heat' ? 0xff4f3a : 0xffc23a);
    ctx.run.rockets++;
    ctx.fx.emit(ctx.fx.SMOKE, { x: r.x, y: r.y, z: r.z, life: 0.6, s0: 0.8, s1: 2.4, c: 0x8a8580, a: 0.6 });
    ctx.audio.sfx('rocket');
    return true;
  }

  function launchMortar(from, aimV, mult) {
    const ground = Math.max(0, aimV.y);
    [-3.2, 0, 3.2].slice(0, MORTAR.shells).forEach((off, i) => {
      const r = free(rockets); if (!r) return;
      const T = MORTAR.flightTime + i * 0.12, g = MORTAR.gravity;
      const tx = clamp(aimV.x + off, -ctx.world.arena, ctx.world.arena), ty = ground;
      Object.assign(r, { live: true, kind: 'mortar', x: from.x, y: from.y, z: from.z, vx: (tx - from.x) / T, vy: (ty - from.y + 0.5 * g * T * T) / T, life: T + 1.5, age: 0, tx, ty, dmg: MORTAR.damage * mult, radius: MORTAR.radius, grav: g });
      r.g.visible = true; r.body.visible = false; r.shell.visible = true; r.flame.visible = false;
      ctx.fx.emit(ctx.fx.FX, { x: tx, y: Math.max(ty, 0) + 0.15, z: 0.5, life: T, s0: 3, s1: 1.4, c: 0xffb040, a: 0.7 });
    });
    ctx.run.rockets += MORTAR.shells;
    ctx.fx.emit(ctx.fx.SMOKE, { x: from.x, y: from.y, z: from.z, life: 1.2, s0: 1.4, s1: 4, c: 0x8a8580, a: 0.7, vy: 3 });
    ctx.fx.emit(ctx.fx.FX, { x: from.x, y: from.y, z: from.z, life: 0.1, s0: 3, s1: 1, c: 0xffc070 });
    ctx.audio.sfx('mortar');
  }

  // ---------------------------------------------------------------- enemy fire
  // o: { x, y, tx, ty, speed } or { x, y, vx, vy }, plus dmg, g (gravity), home (turn rate), explosive, radius, scale, color, life
  function enemyFire(o) {
    const b = free(bolts); if (!b) return;
    let vx = o.vx, vy = o.vy;
    // Ghost Cloak: aimed shots lose the lock and go wide, missiles stop homing (lobbed shells and bombs still fall)
    const cloaked = ctx.player.isCloaked();
    if (vx == null) {
      const ty = cloaked ? o.ty + (Math.random() < 0.5 ? -1 : 1) * rand(6, 10) : o.ty;
      const a = Math.atan2(ty - o.y, o.tx - o.x); vx = Math.cos(a) * o.speed; vy = Math.sin(a) * o.speed;
    }
    Object.assign(b, { live: true, x: o.x, y: o.y, vx, vy, g: o.g || 0, home: cloaked ? 0 : o.home || 0, speed: o.speed || Math.hypot(vx, vy), life: o.life || 4, dmg: o.dmg, explosive: !!o.explosive, radius: o.radius || 3, age: 0 });
    const s = o.scale || 1;
    b.m.scale.setScalar(s); b.glow.material.color.setHex(o.color || 0xff3020);
    b.m.visible = true; b.m.position.set(o.x, o.y, 0);
    ctx.audio.sfx('enemy');
    ctx.fx.emit(ctx.fx.FX, { x: o.x, y: o.y, life: 0.15, s0: 2.5 * s, s1: 0.5, c: o.color || 0xff3020 });
  }

  // ---------------------------------------------------------------- explosions
  function explode(x, y, z, dmg, rad, fromPlayer, scale = 1) {
    const { FX, SMOKE, emit } = ctx.fx;
    for (let i = 0; i < 16 * scale; i++) emit(FX, { x: x + rand(-0.5, 0.5), y: y + rand(-0.5, 0.5), z: z + rand(-0.5, 0.5), vx: rand(-9, 9) * scale, vy: rand(-3, 11) * scale, vz: rand(-3, 3), life: rand(0.25, 0.55), s0: 2.2 * scale, s1: 5 * scale, c: pick([0xff7a20, 0xffb050, 0xffe2a0, 0xff5a10]), drag: 4 });
    for (let i = 0; i < 10 * scale; i++) emit(SMOKE, { x: x + rand(-1, 1), y: y + rand(-0.5, 1), z: z + rand(-1, 1), vx: rand(-3, 3), vy: rand(1, 4.5), life: rand(1.4, 2.6), s0: 2 * scale, s1: rand(6, 9) * scale, c: pick([0x3a3530, 0x2a2622, 0x4a423a]), a: 0.75, drag: 1.4 });
    for (let i = 0; i < 14 * scale; i++) emit(FX, { x, y, z, vx: rand(-22, 22), vy: rand(-4, 24), life: rand(0.4, 0.9), s0: 0.35, s1: 0.1, c: 0xffd090, g: -34 });
    ctx.fx.spawnDebris(x, y, z, Math.round(5 * scale), 9 * scale);
    ctx.fx.flash(x, y + 1, z + 2, 6 * scale, 0.35);
    if (y < 2.5) ctx.fx.scorch(x, 3.5 * scale);
    ctx.shake(0.5 * scale); ctx.audio.sfx(scale > 1.2 ? 'boom' : 'small');
    if (!dmg) return;
    if (fromPlayer) {
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - x, e.y + e.cy - y);
        if (d < rad + e.r) ctx.director.hurt(e, dmg * (1 - 0.5 * clamp(d / rad, 0, 1)), 'explosive');
      }
    } else {
      const T = ctx.T, d = Math.hypot(T.x - x, T.y + T.cy - y);
      if (!T.dead && d < rad + T.w) ctx.hurtTarget(dmg * (1 - 0.5 * clamp(d / rad, 0, 1)));
    }
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    const { FX, SMOKE, emit } = ctx.fx, T = ctx.T;
    for (const b of bullets) {
      if (!b.live) continue;
      b.life -= dt;
      const x0 = b.x, y0 = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt; b.m.position.set(b.x, b.y, b.z);
      let hit = b.life <= 0;
      if (!hit && (b.y <= 0 || (ctx.world.ceiling && b.y >= ctx.world.ceiling))) {
        hit = true;
        for (let i = 0; i < 4; i++) emit(FX, { x: b.x, y: Math.max(0.1, b.y), vx: rand(-6, 6), vy: rand(3, 9) * (b.y > 1 ? -1 : 1), life: 0.35, s0: 0.3, s1: 0.1, c: 0xffc080, g: -30 });
        if (b.y <= 0) emit(SMOKE, { x: b.x, y: 0.3, life: 0.6, s0: 0.5, s1: 1.6, c: 0x6a625a, a: 0.4, vy: 1 });
      }
      if (!hit) for (const e of ctx.enemies) {
        if (e.dead) continue;
        if (segmentHitsCircle(x0, y0, b.x, b.y, e.x, e.y + e.cy, e.r)) {
          ctx.score.hit(1); ctx.director.hurt(e, b.dmg, 'gun'); hit = true;
          for (let i = 0; i < 5; i++) emit(FX, { x: b.x, y: b.y, z: 0.5, vx: rand(-8, 8) - b.vx * 0.04, vy: rand(-4, 8), life: 0.3, s0: 0.4, s1: 0.1, c: 0xfff0c0, g: -25 });
          emit(FX, { x: b.x, y: b.y, z: 0.5, life: 0.08, s0: 1.6, s1: 0.6, c: 0xffb060 });
          break;
        }
      }
      if (hit) { b.live = false; b.m.visible = false; }
    }

    for (const B of beams) {
      if (!B.live) continue;
      B.t -= dt; const k = Math.max(0, B.t / 0.22);
      B.core.material.opacity = k; B.halo.material.opacity = k * 0.35;
      B.core.scale.y = B.core.scale.z = 0.16 * k + 0.02;
      if (B.t <= 0) { B.live = false; B.core.visible = B.halo.visible = false; }
    }

    for (const b of bolts) {
      if (!b.live) continue;
      b.life -= dt; b.age += dt;
      if (b.home && b.age > 0.35 && !T.dead && !ctx.player.isCloaked()) {
        const cur = Math.atan2(b.vy, b.vx), want = Math.atan2(T.y + T.cy - b.y, T.x - b.x);
        let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        const na = cur + clamp(d, -b.home * dt, b.home * dt), sp = lerp(Math.hypot(b.vx, b.vy), b.speed, dt * 2);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        if (Math.random() < 0.5) emit(SMOKE, { x: b.x, y: b.y, life: 0.6, s0: 0.4, s1: 1.4, c: 0x6a625a, a: 0.4 });
      }
      b.vy -= b.g * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.m.position.set(b.x, b.y, 0);
      let hit = b.life <= 0 || b.y < 0, hitPlayer = false;
      if (!hit && ctx.player.barrierBlocks(b)) {
        hit = true;
        for (let i = 0; i < 6; i++) emit(FX, { x: b.x, y: b.y, z: 0.5, vx: rand(-6, 6) - b.vx * 0.2, vy: rand(-4, 6), life: 0.35, s0: 0.6, s1: 0.1, c: 0x7fd6e2, g: -10 });
        ctx.audio.sfx('block');
        b.explosive = false;
      }
      if (!hit && !T.dead && Math.abs(b.x - T.x) < T.w && b.y > T.y + 0.2 && b.y < T.y + T.h) { hit = true; hitPlayer = true; }
      if (hit) {
        b.live = false; b.m.visible = false;
        if (b.explosive) explode(b.x, Math.max(0.3, b.y), 0, b.dmg, b.radius, false, 0.9);
        else if (hitPlayer) {
          ctx.hurtTarget(b.dmg);
          for (let i = 0; i < 6; i++) emit(FX, { x: b.x, y: b.y, z: 0.5, vx: rand(-8, 8), vy: rand(-4, 8), life: 0.3, s0: 0.5, s1: 0.1, c: 0xff6040, g: -20 });
        } else if (b.y < 0.2) emit(FX, { x: b.x, y: 0.2, life: 0.2, s0: 2, s1: 0.5, c: 0xff3020 });
      }
    }

    for (const r of rockets) {
      if (!r.live) continue;
      r.life -= dt; r.age += dt;
      let hit = false;
      if (r.kind === 'mortar') {
        r.vy -= r.grav * dt;
        r.x += r.vx * dt; r.y += r.vy * dt;
        r.g.position.set(r.x, r.y, r.z = lerp(r.z, 0, dt * 3));
        if (Math.random() < 0.6) emit(SMOKE, { x: r.x, y: r.y, z: r.z, life: 0.7, s0: 0.5, s1: 1.6, c: 0x8a8580, a: 0.4 });
        hit = r.life <= 0 || r.y <= 0.1 || (r.vy < 0 && r.y <= r.ty + 0.1 && Math.abs(r.x - r.tx) < 1.5);
      } else {
        if (r.kind === 'heat') {
          // re-acquire the nearest enemy every 0.25 s (or when the current one dies)
          r.retarget -= dt;
          if (!r.tgt || r.tgt.dead || r.retarget <= 0) { r.tgt = nearestEnemyTo(r.x, r.y) || r.tgt; r.retarget = 0.25; }
          if (!r.tgt || r.tgt.dead) { r.tgt = null; r.tx = r.x + r.vx; r.ty = r.y + r.vy; }
        } else if (r.kind === 'turret') { r.tx = ctx.aimV.x; r.ty = ctx.aimV.y; }
        if (r.tgt && r.tgt.dead) r.tgt = null;
        const tx = r.tgt ? r.tgt.x : r.tx, ty = r.tgt ? r.tgt.y + r.tgt.cy : r.ty;
        if (r.age > r.steerAt) {
          const cur = Math.atan2(r.vy, r.vx), want = Math.atan2(ty - r.y, tx - r.x);
          let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          const na = cur + clamp(d, -r.turn * dt, r.turn * dt);
          const sp = Math.min(r.maxSpeed, Math.hypot(r.vx, r.vy) + 70 * dt);
          r.vx = Math.cos(na) * sp; r.vy = Math.sin(na) * sp;
        } else r.vy -= 20 * dt;
        r.x += r.vx * dt; r.y += r.vy * dt; r.z = lerp(r.z, 0, dt * 3);
        r.g.position.set(r.x, r.y, r.z); r.g.rotation.z = Math.atan2(r.vy, r.vx);
        emit(SMOKE, { x: r.x, y: r.y, z: r.z, life: rand(0.6, 1.1), s0: 0.5, s1: 2, c: 0x8a8580, a: 0.5, vy: 0.6 });
        hit = r.life <= 0 || r.y <= 0.1 || (r.kind !== 'heat' && Math.abs(r.x - tx) < 0.8 && Math.abs(r.y - ty) < 0.8);
      }
      if (!hit && ctx.world.ceiling && r.y > ctx.world.ceiling - 0.3) hit = true;
      if (!hit) for (const e of ctx.enemies) { if (!e.dead && Math.hypot(e.x - r.x, e.y + e.cy - r.y) < e.r + 0.5) { hit = true; break; } }
      if (hit) {
        r.live = false; r.g.visible = false;
        explode(r.x, Math.max(r.y, 0.3), r.z, r.dmg, r.radius, true, r.kind === 'mortar' ? 1.5 : 1);
      }
    }
  }

  function clear() {
    [...bullets, ...bolts].forEach((b) => { b.live = false; b.m.visible = false; });
    rockets.forEach((r) => { r.live = false; r.g.visible = false; });
    beams.forEach((B) => { B.live = false; B.core.visible = B.halo.visible = false; });
  }

  return { init, fireBullet, fireRail, launchRocket, launchMortar, launchSpecial, enemyFire, explode, update, clear };
}
