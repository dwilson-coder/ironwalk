// The pilot on foot (Phase 4). Has its own health bar, runs, jumps, climbs ladders, rolls through fire,
// shoots the sidearm chosen at pilot select, collects pickups and reaches pilot-only secret areas.
// State lives in ctx.S; ctx.T points at it while the pilot is the controlled body (see Engine.refreshTarget).
import * as THREE from 'three';
import { PILOT } from './config.js';
import { PILOTS, SIDEARMS } from './loadout.js';
import { rand, clamp, lerp } from './util.js';
import { std, box, disposeTree, disposeMats } from './mech.js';
import { events } from '../store/gameStore.js';

const Z = 1.4; // the pilot walks a little in front of the mech lane so it never hides inside a frame

export function createPilot(ctx) {
  const S = (ctx.S = { active: false, x: 0, y: 0, vx: 0, vy: 0, face: 1, hp: 100, maxHp: 100, ground: true, climb: null, rollT: 0, rollCD: 0, inv: 0, fireT: 0, dead: false, dropT: 0, hitT: 99, walk: 0 });
  let model = null, mats = null, def = PILOTS.mercer, arm = SIDEARMS.pistol;
  const tmpV = new THREE.Vector3();

  // ------------------------------------------------------------ model (placeholder primitives, ~1.9 m tall)
  function build(loadout) {
    if (model) { ctx.scene.remove(model.root); disposeTree(model.root); disposeMats(mats); }
    def = PILOTS[loadout.pilot] || PILOTS.mercer;
    arm = SIDEARMS[loadout.sidearm] || SIDEARMS.pistol;
    const android = def.kind === 'Android';
    const c = (s) => parseInt(s.replace('#', ''), 16); // '#rrggbb' → 0xrrggbb
    mats = {
      suit: std(c(def.look.suit), 0.8, 0.15),
      skin: std(c(def.look.skin), 0.6, android ? 0.7 : 0.05),
      hair: std(c(def.look.hair), 0.9, android ? 0.6 : 0),
      accent: std(c(def.look.accent), 0.5, 0.3),
      gun: std(0x2a2e31, 0.45, 0.8),
      visor: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c(def.look.accent), emissiveIntensity: android ? 3 : 1.4 }),
    };
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const hip = new THREE.Group(); hip.position.y = 0.95; body.add(hip);
    const legs = [-0.12, 0.12].map((z) => {
      const leg = new THREE.Group(); leg.position.set(0, 0, z); hip.add(leg);
      box(0.2, 0.5, 0.2, mats.suit, 0, -0.25, 0, leg);
      const shin = new THREE.Group(); shin.position.y = -0.5; leg.add(shin);
      box(0.18, 0.42, 0.18, mats.suit, 0, -0.21, 0, shin);
      box(0.28, 0.1, 0.2, mats.gun, 0.05, -0.43, 0, shin);
      return { leg, shin };
    });
    const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso);
    box(0.42, 0.58, 0.34, mats.suit, 0, 0.3, 0, torso);
    box(0.44, 0.12, 0.36, mats.accent, 0, 0.08, 0, torso); // belt
    box(0.2, 0.36, 0.3, mats.gun, -0.28, 0.32, 0, torso); // pack
    const head = new THREE.Group(); head.position.y = 0.72; torso.add(head);
    box(0.26, android ? 0.26 : 0.28, 0.26, mats.skin, 0, 0.12, 0, head);
    if (android) box(0.06, 0.18, 0.28, mats.hair, -0.04, 0.3, 0, head); // fin
    else box(0.28, 0.1, 0.28, mats.hair, -0.02, 0.28, 0, head);
    box(0.06, 0.08, 0.22, mats.visor, 0.14, 0.14, 0, head);
    const armG = new THREE.Group(); armG.position.set(0.04, 0.52, 0.2); torso.add(armG);
    box(0.36, 0.12, 0.12, mats.suit, 0.18, 0, 0, armG);
    const gun = new THREE.Group(); gun.position.x = 0.38; armG.add(gun);
    const len = arm.id === 'shotgun' ? 0.62 : arm.id === 'smg' ? 0.46 : 0.3;
    box(len, 0.1, 0.08, mats.gun, len / 2, 0.02, 0, gun);
    box(0.08, 0.16, 0.07, mats.gun, 0.06, -0.08, 0, gun);
    const muzzle = new THREE.Object3D(); muzzle.position.x = len + 0.05; gun.add(muzzle);
    root.visible = S.active;
    ctx.scene.add(root);
    model = { root, body, hip, legs, torso, head, armG, muzzle };
    S.maxHp = def.foot.hp; S.hp = Math.min(S.hp, S.maxHp);
  }

  // ------------------------------------------------------------ lifecycle
  function spawn(x, y, { vx = 0, vy = 0, hp = null } = {}) {
    Object.assign(S, { active: true, dead: false, x, y, vx, vy, ground: false, climb: null, rollT: 0, rollCD: 0, inv: 0.6, fireT: 0, dropT: 0, hitT: 99 });
    S.maxHp = def.foot.hp;
    S.hp = hp == null ? S.maxHp : clamp(hp, 1, S.maxHp);
    model.root.visible = true;
    model.root.position.set(x, y, Z);
  }
  function hide() { S.active = false; S.climb = null; model.root.visible = false; }
  function resetHealth() { S.maxHp = def.foot.hp; S.hp = S.maxHp; S.dead = false; }

  // ------------------------------------------------------------ helpers
  const HW = PILOT.halfWidth, H = PILOT.height;
  const solidPlats = () => ctx.world.plats; // the pilot can stand on every platform, including pilot-only ledges
  function onSurface() {
    if (S.y <= 0.01) return true;
    return solidPlats().some((p) => Math.abs(S.y - p.top) < 0.03 && Math.abs(S.x - p.x) < p.w / 2 + HW * 0.5);
  }
  function ladderAt() {
    for (const l of ctx.world.ladders) if (Math.abs(S.x - l.x) < 0.75 && S.y >= l.y0 - 0.1 && S.y <= l.y1 + 0.1) return l;
    return null;
  }
  // crawlspace roofs: the pilot fits under (2.6 m) but can't jump through them
  function roofAbove() {
    let r = Infinity;
    for (const b of ctx.world.blockers) if (S.x > b.x0 - HW && S.x < b.x1 + HW && S.y < b.top - 0.5) r = Math.min(r, b.top - 0.5);
    return r;
  }

  // ------------------------------------------------------------ update
  function update(dt) {
    if (!S.active || S.dead) return;
    const { key, pressed, touch, mouse } = ctx.input;
    const A = ctx.world.arena, C = ctx.world.ceiling;
    const L = key('KeyA') || key('ArrowLeft') || touch.left, Rt = key('KeyD') || key('ArrowRight') || touch.right;
    const up = key('KeyW') || key('ArrowUp') || touch.up;
    const downHeld = key('KeyS') || key('ArrowDown') || touch.down;
    const downPressed = pressed('KeyS') || pressed('ArrowDown') || pressed('t_down');
    const jump = pressed('Space') || pressed('t_jet');
    const mv = (Rt ? 1 : 0) - (L ? 1 : 0);

    ctx.player.aim();
    const sx = S.x, sy = S.y + 1.45;
    const dx = ctx.aimV.x - sx, dy = ctx.aimV.y - sy;
    if (S.rollT <= 0 && Math.abs(dx) > 0.3) S.face = dx >= 0 ? 1 : -1;

    // Tinker's field repair works on foot too
    S.hitT += dt;
    if (def.perk.regen && S.hitT > def.perk.regenDelay && S.hp < S.maxHp) S.hp = Math.min(S.maxHp, S.hp + def.perk.regen * dt);

    // ladders
    if (!S.climb && S.rollT <= 0) {
      const l = ladderAt();
      if (l && ((up && S.y < l.y1 - 0.05) || (downHeld && S.y > l.y0 + 0.05 && (S.ground || S.y > l.y0 + 0.3)))) {
        S.climb = l; S.x = l.x; S.vx = 0; S.vy = 0; S.ground = false;
      }
    }
    if (S.climb) {
      const l = S.climb, dir = (up ? 1 : 0) - (downHeld ? 1 : 0);
      S.y = clamp(S.y + dir * PILOT.climbSpeed * dt, l.y0, l.y1);
      S.walk += dir * dt * 6;
      if (dir > 0 && S.y >= l.y1) { S.climb = null; S.ground = true; S.vy = 0; stepOntoLedge(); }
      else if (dir < 0 && S.y <= l.y0) { S.climb = null; S.ground = true; S.vy = 0; }
      else if (jump) { S.climb = null; S.vy = PILOT.jumpVelocity * 0.7; S.vx = (mv || S.face) * def.foot.speed; }
      else if (mv && !up && !downHeld) { S.climb = null; S.vx = mv * def.foot.speed * 0.6; } // step off sideways
    }

    if (!S.climb) {
      // roll (Shift / DASH): quick, invulnerable, cooldown
      S.rollCD -= dt;
      if ((pressed('ShiftLeft') || pressed('ShiftRight') || pressed('t_dash')) && S.rollCD <= 0 && S.ground) {
        S.rollT = PILOT.rollTime; S.rollCD = PILOT.rollCooldown; S.inv = Math.max(S.inv, PILOT.rollTime + 0.05);
        S.rollDir = mv || S.face; ctx.audio.sfx('dash');
      }
      if (S.rollT > 0) { S.rollT -= dt; S.vx = S.rollDir * PILOT.rollSpeed; }
      else {
        const target = mv * def.foot.speed * (mv && mv !== S.face ? 0.8 : 1);
        const acc = S.ground ? 60 : 28;
        S.vx += clamp(target - S.vx, -acc * dt, acc * dt);
      }
      if (jump && S.ground) { S.vy = PILOT.jumpVelocity; S.ground = false; }
      if (downPressed && S.ground && S.y > 0.5 && !ladderAt()) { S.dropT = 0.25; S.ground = false; S.vy = -2; }
      S.dropT -= dt;

      S.vy = Math.max(-PILOT.maxFall, S.vy - PILOT.gravity * dt);
      const prevY = S.y, prevX = S.x;
      S.x += S.vx * dt; S.y += S.vy * dt;
      if (S.x < -A) { S.x = -A; S.vx = 0; }
      if (S.x > A) { S.x = A; S.vx = 0; }
      const roof = Math.min(roofAbove(), C ? C - 0.2 : Infinity);
      if (S.y + H > roof && prevY + H <= roof + 0.05) { S.y = roof - H; if (S.vy > 0) S.vy = 0; }
      // can't walk into a crawlspace wall from the side while standing taller than its opening
      for (const b of ctx.world.blockers) {
        if (S.y + H > b.top - 0.5 && S.y < b.top - 0.05 && S.x > b.x0 - HW && S.x < b.x1 + HW && !(prevX > b.x0 - HW && prevX < b.x1 + HW)) { S.x = prevX; S.vx = 0; }
      }
      let landed = false;
      if (S.y <= 0) { S.y = 0; landed = true; }
      else if (S.vy <= 0 && S.dropT <= 0) {
        for (const p of solidPlats()) {
          if (prevY >= p.top - 0.01 && S.y <= p.top && Math.abs(S.x - p.x) < p.w / 2 + HW * 0.5) { S.y = p.top; landed = true; break; }
        }
      }
      if (landed) {
        if (!S.ground && S.vy < -24) hurt(Math.round((-S.vy - 24) * 2.5), true); // long falls hurt a little
        S.vy = 0; S.ground = true;
      } else if (S.ground && !onSurface()) S.ground = false;
      S.walk += S.ground ? Math.abs(S.vx) * dt * 1.6 : 0;
    }
    S.inv -= dt;

    // sidearm
    S.fireT -= dt;
    if ((mouse.L || key('KeyJ') || touch.fire) && S.fireT <= 0 && !S.climb) {
      S.fireT = 1 / arm.rate;
      fire(Math.atan2(dy, dx));
    } else if (S.fireT < 0) S.fireT = 0;

    secrets();
    animate(dt, Math.atan2(dy, Math.abs(dx)));
  }

  // after climbing to the top of a ladder, step onto the ledge it serves
  function stepOntoLedge() {
    for (const p of solidPlats()) {
      if (Math.abs(p.top - S.y) < 0.05 && Math.abs(S.x - p.x) < p.w / 2 + 1.2) { S.x = clamp(S.x, p.x - p.w / 2 + 0.35, p.x + p.w / 2 - 0.35); return; }
    }
  }

  function fire(ang) {
    model.root.updateMatrixWorld(true);
    model.muzzle.getWorldPosition(tmpV);
    const mult = ctx.P.buffs && ctx.P.buffs.overdrive > 0 ? 1.5 : 1;
    const speed = PILOT.bulletSpeed, life = arm.range / speed;
    for (let i = 0; i < arm.pellets; i++) ctx.weapons.fireBullet(tmpV.x, tmpV.y, tmpV.z, ang + rand(-arm.spread, arm.spread), speed * rand(0.95, 1.05), life, arm.damage * mult);
    ctx.fx.emit(ctx.fx.FX, { x: tmpV.x, y: tmpV.y, z: tmpV.z, life: 0.05, s0: arm.pellets > 1 ? 1.6 : 0.8, s1: 0.3, c: 0xffc070 });
    ctx.score.shot(arm.pellets);
    ctx.audio.sfx(arm.id);
    S.recoil = arm.pellets > 1 ? 0.25 : 0.1;
  }

  function secrets() {
    for (const sec of ctx.world.secrets) {
      if (sec.found) continue;
      if (S.x > sec.x0 && S.x < sec.x1 && S.y >= sec.y0 && S.y <= sec.y1) { sec.found = true; ctx.onSecretFound(sec); }
    }
  }

  function animate(dt, aimA) {
    const m = model;
    m.root.position.set(S.x, S.y, Z);
    m.root.scale.set(S.face, 1, 1);
    const run = S.ground && !S.climb ? clamp(Math.abs(S.vx) / def.foot.speed, 0, 1) : 0;
    const ph = S.walk * 2.2;
    m.legs.forEach((l, i) => {
      const s = Math.sin(ph + i * Math.PI);
      if (S.climb) { l.leg.rotation.z = Math.sin(ph + i * Math.PI) * 0.5 - 0.3; l.shin.rotation.z = 0.6; }
      else if (!S.ground) { l.leg.rotation.z = i ? 0.5 : -0.2; l.shin.rotation.z = 0.7; }
      else { l.leg.rotation.z = s * 0.7 * run; l.shin.rotation.z = Math.max(0, -s) * 0.9 * run; }
    });
    m.body.position.y = S.ground ? Math.abs(Math.sin(ph)) * 0.05 * run : 0;
    // roll: tuck and spin
    m.body.rotation.z = S.rollT > 0 ? -(1 - S.rollT / PILOT.rollTime) * Math.PI * 2 : 0;
    if (S.rollT > 0) m.body.position.y = 0.4;
    m.torso.rotation.z = lerp(m.torso.rotation.z, S.climb ? 0 : -run * 0.12, dt * 10);
    S.recoil = Math.max(0, (S.recoil || 0) - dt * 2);
    m.armG.rotation.z = S.climb ? 1.4 : clamp(aimA, -1.2, 1.3) - m.torso.rotation.z;
    m.armG.position.x = 0.04 - S.recoil * 0.5;
    m.head.rotation.z = S.climb ? 0.3 : clamp(aimA * 0.4, -0.3, 0.4);
    // hit flicker
    m.root.visible = !(S.inv > 0 && S.rollT <= 0 && Math.sin(ctx.G.time * 40) > 0.3);
  }

  // ------------------------------------------------------------ damage
  function hurt(d, fall = false) {
    if (!S.active || S.dead || (!fall && S.inv > 0)) return;
    S.hp -= d; S.hitT = 0; if (!fall) S.inv = 0.25;
    ctx.run.damageTaken += d;
    const boss = ctx.director.boss(); if (boss) boss.hitsTaken++;
    ctx.shake(0.2); ctx.audio.sfx('hurt'); events.emit('hurt', { amount: d, pilot: true });
    if (S.hp <= 0) {
      S.hp = 0; S.dead = true; S.climb = null;
      for (let i = 0; i < 16; i++) ctx.fx.emit(ctx.fx.FX, { x: S.x, y: S.y + 1, z: Z, vx: rand(-6, 6), vy: rand(2, 9), life: 0.6, s0: 0.5, s1: 0.1, c: 0xff6040, g: -20 });
      model.root.visible = false;
      ctx.onPilotKilled();
    }
  }
  function heal(n) { if (!S.dead) S.hp = Math.min(S.maxHp, S.hp + n); }
  function knock(vx, vy) { if (S.climb) S.climb = null; S.vx = vx * 0.6; S.vy = vy * 0.6; S.ground = false; }

  function muzzle() {
    model.root.updateMatrixWorld(true);
    model.muzzle.getWorldPosition(tmpV);
    return { x: tmpV.x, y: tmpV.y, z: tmpV.z, face: S.face };
  }

  return {
    build, spawn, hide, resetHealth, update, hurt, heal, knock, muzzle,
    get def() { return def; }, get sidearm() { return arm; },
  };
}
