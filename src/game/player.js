// The player's mech: movement, aiming, primary/secondary weapons, mech skill, pilot perk and damage.
// Stats come from the equipped mech (CHASSIS), weapons and pilot from loadout.js.
// P.mode: 'piloted' (you drive it) · 'parked' (pilot ejected; the frame auto-defends) · 'dropping' (replacement frame
// falling in) · 'destroyed' (waiting for a replacement) · 'absent' (pilot-only missions).
import * as THREE from 'three';
import { PLAYER, GUN, ROCKETS } from './config.js';
import { CHASSIS, PRIMARIES, SECONDARIES, PAINTS, PILOTS } from './loadout.js';
import { TAU, rand, clamp, lerp, pick } from './util.js';
import { playerMats, makeMech, animMech, std, disposeTree, disposeMats } from './mech.js';
import { events } from '../store/gameStore.js';

export function createPlayer(ctx) {
  const P = ctx.P;
  let PM = null, mats = null, stats = CHASSIS.warden, prim = PRIMARIES.chaingun, sec = SECONDARIES.seeker, pilot = PILOTS.mercer;
  let cloaked = false;
  const tmpV = new THREE.Vector3();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const muzzleLight = new THREE.PointLight(0xffb060, 0, 14, 2); ctx.scene.add(muzzleLight);
  const brassMat = std(0xc8963a, 0.35, 0.9);

  // Aegis barrier: a curved energy wall drawn in front of the mech
  const barrierMat = new THREE.MeshBasicMaterial({ color: 0x7fd6e2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const barrier = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 6, 24, 1, true, -0.7, 1.4), barrierMat);
  barrier.visible = false; ctx.scene.add(barrier);

  function build(loadout) {
    if (PM) { ctx.scene.remove(PM.root); disposeTree(PM.root); disposeMats(mats); }
    stats = CHASSIS[loadout.chassis] || CHASSIS.warden;
    prim = PRIMARIES[loadout.primary] || PRIMARIES.chaingun;
    sec = SECONDARIES[loadout.secondary] || SECONDARIES.seeker;
    pilot = PILOTS[loadout.pilot] || PILOTS.mercer;
    mats = playerMats(PAINTS[loadout.paint] || PAINTS.salvage);
    cloaked = false;
    PM = makeMech(mats, loadout);
    PM.root.position.set(P.x || 0, P.y || 0, 0);
    ctx.scene.add(PM.root);
    ctx.PM = PM;
    if (P.hull != null) { P.maxHull = maxHull(); P.hull = Math.min(P.hull, P.maxHull); }
  }

  const maxHull = () => stats.hull + (pilot.perk.hull || 0);
  const skillActive = (id) => P.skillT > 0 && stats.skill.id === id;

  // Ghost Cloak visual: the whole frame turns see-through
  function setCloak(on) {
    if (on === cloaked || !mats) return;
    cloaked = on;
    for (const m of Object.values(mats)) { m.transparent = on; m.opacity = on ? 0.28 : 1; m.depthWrite = !on; m.needsUpdate = true; }
  }

  function reset(x = 0, mode = 'piloted') {
    Object.assign(P, {
      x, y: 0, vx: 0, vy: 0, face: 1, turn: 1, hull: maxHull(), maxHull: maxHull(), heat: 0, over: 0, fuel: 100, ground: true,
      dashT: 0, dashCD: 0, dashDir: 1, secCD: 0, salvo: 0, salvoT: 0, inv: 0, fireT: 0, spin: 0, land: 0,
      dropT: 0, pound: false, recoil: 0, dead: false, coolDelay: 0, thrust: 0, barrierT: 0,
      skillT: 0, skillCD: 0, hitT: 99, mode, autoT: 0, autoTarget: null,
      buffs: { coolant: 0, overdrive: 0, munitions: 0, plating: 0 },
    });
    PM.root.visible = mode !== 'absent'; PM.root.position.set(x, 0, 0); PM.root.rotation.set(0, 0, 0); PM.root.scale.setScalar(stats.scale);
    barrier.visible = false;
    setCloak(false);
  }

  // Sets ctx.aimV from the mouse (or, on touch, the nearest enemy in front of whatever you control)
  function updateAim() {
    const aimV = ctx.aimV, T = ctx.T;
    if (ctx.isTouch) {
      let best = null, bd = 1e9;
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        const d = Math.abs(e.x - T.x) + (Math.sign(e.x - T.x) === T.face ? 0 : 12);
        if (d < bd && Math.abs(e.x - T.x) < 42) { bd = d; best = e; }
      }
      if (best) aimV.set(best.x, best.y + best.cy, 0); else aimV.set(T.x + T.face * 20, T.y + T.h * 0.7, 0);
      return;
    }
    ndc.set((ctx.input.mouse.x / innerWidth) * 2 - 1, -(ctx.input.mouse.y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera); ray.ray.intersectPlane(planeZ, aimV);
  }

  // Overdrive pickup ×1.5, mech firepower rating, Fortify skill ×1.3
  const damageMult = () => (P.buffs.overdrive > 0 ? 1.5 : 1) * stats.firepower * (skillActive('fortify') ? 1.3 : 1);
  const worldGunAngle = () => { const a = PM.armN.rotation.z + PM.torso.rotation.z; return P.face > 0 ? a : Math.PI - a; };

  function update(dt) {
    if (P.mode === 'parked') return parked(dt);
    if (P.mode === 'dropping') return dropping(dt);
    if (P.mode !== 'piloted' || P.dead) return;
    const { key, pressed, touch, mouse } = ctx.input;
    const { fx, audio } = ctx;
    const A = ctx.world.arena, C = ctx.world.ceiling;
    const fortified = skillActive('fortify'); // planted: no walking, jets or dash
    const L = key('KeyA') || key('ArrowLeft') || touch.left, R = key('KeyD') || key('ArrowRight') || touch.right;
    const jet = !fortified && (key('Space') || key('KeyW') || key('ArrowUp') || touch.jet);
    const down = pressed('KeyS') || pressed('ArrowDown');
    const mv = (R ? 1 : 0) - (L ? 1 : 0);
    updateAim();
    const s = stats.scale;
    const sx = P.x + P.face * 0.25 * s, sy = P.y + (PM.body.position.y + 1.1) * s;
    const dx = ctx.aimV.x - sx, dy = ctx.aimV.y - sy;
    if (P.dashT <= 0 && Math.abs(dx) > 0.6) P.face = dx >= 0 ? 1 : -1;
    P.turn = lerp(P.turn, P.face, Math.min(1, dt * 16));
    PM.root.scale.set(s * (Math.abs(P.turn) < 0.15 ? 0.15 * Math.sign(P.turn || 1) : P.turn), s, s);

    // mech skill (R / SKILL button)
    P.skillCD = Math.max(0, P.skillCD - dt);
    if (P.skillT > 0) { P.skillT = Math.max(0, P.skillT - dt); if (P.skillT === 0) endSkill(); }
    if ((pressed('KeyR') || pressed('t_skill')) && P.skillCD <= 0 && P.skillT <= 0) startSkill();

    // pilot perk: Tinker's field repair
    P.hitT += dt;
    if (pilot.perk.regen && P.hitT > pilot.perk.regenDelay && P.hull < P.maxHull) P.hull = Math.min(P.maxHull, P.hull + pilot.perk.regen * dt);

    // dash
    P.dashCD -= dt;
    if ((pressed('ShiftLeft') || pressed('ShiftRight') || pressed('t_dash')) && P.dashCD <= 0 && !fortified) {
      P.dashDir = mv || P.face; P.dashT = PLAYER.dashTime; P.dashCD = skillActive('afterburner') ? 0.15 : stats.dashCooldown; P.inv = PLAYER.dashInvulnerable;
      audio.sfx('dash'); P.vy = Math.max(P.vy, P.ground ? 0 : 2);
    }
    if (P.dashT > 0) {
      P.dashT -= dt; P.vx = P.dashDir * PLAYER.dashSpeed;
      for (let i = 0; i < 2; i++) fx.emit(fx.FX, { x: P.x - P.dashDir * 1.8, y: P.y + 3.4 + rand(-0.4, 0.4), z: rand(-0.6, 0.6), vx: -P.dashDir * 20, life: 0.18, s0: 1.6, s1: 0.3, c: 0x7fd6e2 });
    } else {
      let target = fortified ? 0 : mv * stats.walkSpeed;
      if (mv && mv !== P.face) target *= 0.72;
      const acc = P.ground ? PLAYER.groundAccel : PLAYER.airAccel;
      P.vx += clamp(target - P.vx, -acc * dt, acc * dt);
    }

    // jump and jets
    P.thrust = 0;
    if (jet && P.ground) {
      P.vy = PLAYER.jumpVelocity; P.ground = false;
      for (let i = 0; i < 8; i++) fx.emit(fx.SMOKE, { x: P.x + rand(-2, 2), y: P.y + 0.4, z: rand(-1, 1), vx: rand(-6, 6), vy: rand(0.5, 2), life: 1, s0: 1.2, s1: 3.5, c: 0x6a625a, a: 0.5, drag: 2 });
    } else if (jet && !P.ground && P.fuel > 0 && P.vy < PLAYER.jetMaxRise) {
      P.vy += stats.jetAccel * dt; P.fuel -= stats.jetBurn * dt; P.thrust = 1;
    }
    if (P.ground) P.fuel = Math.min(100, P.fuel + PLAYER.fuelRegenPerSec * dt);
    if (skillActive('afterburner')) P.fuel = 100;
    if (down && !P.ground && P.y > 2.5 && !P.pound) { P.pound = true; P.vy = PLAYER.poundVelocity; }
    if (down && P.ground && P.y > 0.5) { P.dropT = 0.3; P.ground = false; P.vy = -2; }
    P.dropT -= dt;

    // integrate
    P.vy = Math.max(-PLAYER.maxFall, P.vy - PLAYER.gravity * dt);
    const prevY = P.y, prevX = P.x;
    P.x += P.vx * dt; P.y += P.vy * dt;
    blockers(prevX);
    if (P.x < -A) { P.x = -A; P.vx = 0; }
    if (P.x > A) { P.x = A; P.vx = 0; }
    if (C && P.y + PLAYER.height * s > C - 0.3) { P.y = C - 0.3 - PLAYER.height * s; if (P.vy > 0) P.vy = 0; }
    let landed = false;
    const impact = P.vy;
    if (P.y <= 0) { P.y = 0; landed = true; }
    else if (P.vy <= 0 && P.dropT <= 0) {
      for (const p of ctx.world.plats) {
        if (p.pilotOnly) continue; // pilot-only ledges are too flimsy for a frame
        if (prevY >= p.top - 0.01 && P.y <= p.top && Math.abs(P.x - p.x) < p.w / 2 + 0.4) { P.y = p.top; landed = true; break; }
      }
    }
    if (landed) {
      if (!P.ground) {
        P.land = clamp(-impact / 40, 0, 0.35);
        if (P.pound || impact < PLAYER.hardLandingVelocity) stomp();
        else for (let i = 0; i < 5; i++) fx.emit(fx.SMOKE, { x: P.x + rand(-1.6, 1.6), y: P.y + 0.3, z: rand(-1, 1), vx: rand(-4, 4), vy: rand(0.3, 1.2), life: 0.9, s0: 1, s1: 3, c: 0x6a625a, a: 0.45, drag: 2 });
      }
      P.vy = 0; P.ground = true; P.pound = false;
    } else if (P.ground) {
      const onPlat = P.y <= 0.01 || ctx.world.plats.some((p) => !p.pilotOnly && Math.abs(P.y - p.top) < 0.02 && Math.abs(P.x - p.x) < p.w / 2 + 0.4);
      if (!onPlat) P.ground = false;
    }
    P.land = Math.max(0, P.land - dt * 1.4);
    PM.root.position.set(P.x, P.y, 0);

    animMech(PM, P.ground ? P.vx * P.face : 0, !P.ground, fortified ? Math.max(P.land, 0.3) : P.land, dt);
    if (fortified && Math.random() < dt * 8) fx.emit(fx.FX, { x: P.x + rand(-1.2, 1.2), y: P.y + 0.2, z: rand(-0.8, 0.8), vy: rand(1, 3), life: 0.4, s0: 0.5, s1: 0.1, c: 0xffb040 });
    PM.flames.forEach((f) => f.scale.set(1, P.thrust ? rand(0.8, 1.25) : P.dashT > 0 ? 0.9 : 0.01, 1));
    if (P.thrust) {
      PM.torso.updateMatrixWorld();
      for (const f of PM.flames) { f.getWorldPosition(tmpV); fx.emit(fx.FX, { x: tmpV.x, y: tmpV.y - 0.6, z: tmpV.z, vx: rand(-1, 1), vy: -14, life: 0.18, s0: 1.2, s1: 0.3, c: pick([0xff9a40, 0xffd090]) }); }
      if (Math.random() < 0.4) fx.emit(fx.SMOKE, { x: P.x - P.face * 1.5, y: P.y + 1, z: rand(-1, 1), vy: -3, vx: rand(-2, 2), life: 1, s0: 1, s1: 3, c: 0x5a5550, a: 0.35, drag: 1 });
    }
    audio.setJet(P.thrust ? 0.22 : P.dashT > 0 ? 0.12 : 0);

    // aim the gun arm
    const a = clamp(Math.atan2(dy, dx * P.face), -1.15, 1.35);
    PM.torso.rotation.z = lerp(PM.torso.rotation.z, a * 0.14, dt * 8);
    P.recoil = Math.max(0, P.recoil - dt * 1.6);
    PM.armN.rotation.z = a - PM.torso.rotation.z; PM.gun.position.x = -P.recoil * 1.5; PM.armF.rotation.z = a * 0.4 - 0.2;

    updatePrimary(dt, mouse.L || key('KeyJ') || touch.fire);
    updateSecondary(dt, ctx.input.edge.rocket || pressed('KeyQ') || pressed('t_rocket'));
    P.inv -= dt;
  }

  function updatePrimary(dt, firing) {
    const { fx, audio } = ctx;
    const coolant = P.buffs.coolant > 0;
    const surge = skillActive('surge');
    if (coolant) { P.over = 0; P.heat = Math.max(0, P.heat - 120 * dt); }
    P.spin = lerp(P.spin, firing && P.over <= 0 ? 1 : 0, dt * (firing ? 9 : 3));
    if (prim.spinup) PM.barrels.rotation.x += P.spin * dt * 40;
    P.coolDelay -= dt;
    const ready = prim.spinup ? P.spin > 0.55 : true;
    if (P.over > 0) {
      P.over -= dt; P.heat = Math.max(0, P.heat - 60 * dt);
      if (Math.random() < 0.6) { PM.root.updateMatrixWorld(true); PM.muzzle.getWorldPosition(tmpV); fx.emit(fx.SMOKE, { x: tmpV.x - P.face, y: tmpV.y + 0.4, z: tmpV.z, vy: 3, vx: rand(-1, 1), life: 0.9, s0: 0.6, s1: 2.4, c: 0xd8d4cc, a: 0.45 }); }
    } else if (firing && ready) {
      PM.root.updateMatrixWorld(true);
      P.fireT -= dt;
      while (P.fireT <= 0) {
        firePrimaryShot();
        P.fireT += 1 / (prim.rate * (surge ? 1.25 : 1)); P.coolDelay = GUN.coolDelay;
        if (!coolant && !surge) P.heat += prim.heat * stats.heat;
        if (P.heat >= 100) { P.over = GUN.ventTime; audio.sfx('vent'); ctx.banner('', `${prim.type} venting`, 900); break; }
      }
    } else {
      // fireT is the time until the next shot is allowed, so tapping can never beat the weapon's rate of fire
      P.fireT = Math.max(0, P.fireT - dt);
    }
    if (P.coolDelay <= 0 && P.over <= 0) P.heat = Math.max(0, P.heat - GUN.coolPerSec * dt);
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 60);
  }

  function firePrimaryShot() {
    PM.muzzle.getWorldPosition(tmpV);
    const ang = worldGunAngle();
    const dmg = prim.damage * damageMult();
    const { fx, audio, weapons } = ctx;
    muzzleLight.position.copy(tmpV);
    if (prim.fire === 'rail') {
      weapons.fireRail(tmpV.x, tmpV.y, tmpV.z, ang, prim.range, dmg);
      muzzleLight.intensity = 9; muzzleLight.color.setHex(0x9fe8ff);
      P.recoil = 0.35; ctx.shake(0.25); audio.sfx('rail');
      P.vx -= Math.cos(ang) * 3;
    } else {
      for (let i = 0; i < prim.pellets; i++) weapons.fireBullet(tmpV.x, tmpV.y, tmpV.z, ang + rand(-prim.spread, prim.spread), prim.speed * rand(0.92, 1.05), prim.life, dmg);
      fx.emit(fx.FX, { x: tmpV.x, y: tmpV.y, z: tmpV.z, life: 0.06, s0: prim.pellets > 1 ? 3.4 : rand(1.6, 2.4), s1: 1, c: 0xffc070 });
      muzzleLight.intensity = prim.pellets > 1 ? 7 : 4; muzzleLight.color.setHex(0xffb060);
      fx.spawnDebris(tmpV.x - P.face * 1.2, tmpV.y, tmpV.z, 1, 6, brassMat, prim.pellets > 1 ? 0.22 : 0.12);
      P.recoil = prim.pellets > 1 ? 0.3 : 0.12;
      if (prim.pellets > 1) { ctx.shake(0.15); audio.sfx('scatter'); } else audio.sfx('gun');
    }
    ctx.score.shot(prim.fire === 'rail' ? 1 : prim.pellets);
  }

  function updateSecondary(dt, pressedNow) {
    const cd = sec.cooldown * (P.buffs.munitions > 0 ? 0.35 : 1);
    P.secCD -= dt;
    P.secMax = cd;
    if (pressedNow && P.secCD <= 0) {
      P.secCD = cd;
      if (sec.id === 'seeker') { P.salvo = ROCKETS.perSalvo; P.salvoT = 0; }
      else if (sec.id === 'mortar') { PM.root.updateMatrixWorld(true); PM.podMouth.getWorldPosition(tmpV); ctx.weapons.launchMortar(tmpV, ctx.aimV, damageMult()); ctx.shake(0.4); }
      else if (sec.id === 'barrier') { P.barrierT = sec.duration; ctx.audio.sfx('barrier'); }
    }
    if (P.salvo > 0) {
      P.salvoT -= dt;
      if (P.salvoT <= 0) { PM.root.updateMatrixWorld(true); PM.podMouth.getWorldPosition(tmpV); ctx.weapons.launchRocket(tmpV, ctx.aimV, P.face, damageMult()); P.salvo--; P.salvoT = ROCKETS.launchInterval; }
    }
    // barrier visual
    P.barrierT = Math.max(0, P.barrierT - dt);
    barrier.visible = P.barrierT > 0;
    if (barrier.visible) {
      const s = stats.scale;
      barrier.position.set(P.x + P.face * 0.2, P.y + 3 * s, 0);
      barrier.rotation.y = P.face > 0 ? Math.PI / 2 : -Math.PI / 2;
      barrierMat.opacity = (0.22 + Math.sin(ctx.G.time * 20) * 0.05) * Math.min(1, P.barrierT * 2);
      barrier.scale.setScalar(s);
      if (PM.shieldEmitter) PM.shieldEmitter.material.emissiveIntensity = 6;
    } else if (PM.shieldEmitter) PM.shieldEmitter.material.emissiveIntensity = 2.6;
  }

  function startSkill() {
    const sk = stats.skill;
    P.skillT = sk.duration;
    P.skillCD = sk.cooldown * (pilot.perk.skillCooldown || 1);
    if (sk.id === 'cloak') setCloak(true);
    if (sk.id === 'surge') { P.heat = 0; P.over = 0; }
    ctx.audio.sfx('skill');
    ctx.banner('', `${sk.name} online`, 1100);
    events.emit('popup', { ...ctx.toScreen(P.x, P.y + 6), text: sk.name.toUpperCase(), kind: 'pickup', color: '#7fd6e2' });
  }
  function endSkill() { setCloak(false); }

  function stomp() {
    const { fx, audio } = ctx;
    fx.ring(P.x, P.y); ctx.shake(1.1 * stats.stomp); audio.sfx('stomp');
    for (let i = 0; i < 18; i++) { const a = rand(0, TAU); fx.emit(fx.SMOKE, { x: P.x, y: P.y + 0.4, z: Math.sin(a) * 1.5, vx: Math.cos(a) * rand(8, 14), vz: Math.sin(a) * 3, vy: rand(0.3, 1.5), life: 1.3, s0: 1.4, s1: 4.5, c: 0x6a625a, a: 0.55, drag: 2.4 }); }
    if (P.y < 0.5) fx.scorch(P.x, 4.5);
    ctx.run.stomps++;
    const radius = PLAYER.stompRadius * Math.sqrt(stats.stomp);
    for (const e of ctx.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - P.x, e.y + e.cy - (P.y + 1));
      if (d < radius) {
        ctx.director.hurt(e, PLAYER.stompDamage * stats.stomp * damageMult() * (1 - d / (radius * 1.5)), 'stomp');
        if (!e.dead && !e.isBoss) { e.vx += Math.sign(e.x - P.x) * 10; if (e.type === 'drone') e.vy += 8; }
      }
    }
  }

  function hurt(d) {
    if (P.mode !== 'piloted' || P.dead || P.inv > 0) return;
    d *= stats.armor;
    if (skillActive('fortify')) d *= 0.4;
    if (P.buffs.plating > 0) d *= 0.5;
    P.hull -= d; P.inv = 0.12; P.hitT = 0;
    ctx.run.damageTaken += d;
    const boss = ctx.director.boss(); if (boss) boss.hitsTaken++;
    ctx.shake(0.35); ctx.audio.sfx('hurt'); events.emit('hurt', { amount: d });
    if (P.hull <= 0) { P.hull = 0; kill(); }
  }
  function kill() {
    P.dead = true; P.mode = 'destroyed';
    ctx.weapons.explode(P.x, P.y + 3, 0, 0, 0, false, 2.6);
    PM.root.visible = false; barrier.visible = false; P.skillT = 0; P.barrierT = 0; setCloak(false);
    ctx.fx.spawnDebris(P.x, P.y + 3, 0, 14, 14, mats.hull, 0.7);
    ctx.audio.setJet(0);
    ctx.onMechDestroyed();
  }

  // A frame can't squeeze into a crawlspace: push it back out of any blocker it is shorter than
  function blockers(prevX) {
    const hw = 1.3 * stats.scale;
    for (const b of ctx.world.blockers) {
      if (P.y >= b.top - 0.05) continue; // standing on the roof is fine
      if (P.x > b.x0 - hw && P.x < b.x1 + hw) {
        P.x = prevX <= (b.x0 + b.x1) / 2 ? b.x0 - hw : b.x1 + hw;
        P.vx = 0; if (P.dashT > 0) P.dashT = 0;
      }
    }
  }

  // ------------------------------------------------------------ pilot in / out (Phase 4)
  // Ejecting leaves the frame parked; it keeps shooting at the nearest hostile until you climb back in.
  function eject() {
    if (P.mode !== 'piloted' || P.dead) return false;
    P.mode = 'parked'; P.dashT = 0; P.thrust = 0; P.skillT = 0; P.barrierT = 0; P.salvo = 0;
    setCloak(false); barrier.visible = false; ctx.audio.setJet(0);
    return true;
  }
  function board() {
    if (P.mode !== 'parked') return false;
    P.mode = 'piloted'; P.inv = 0.5; P.vx = 0;
    return true;
  }
  // Replacement frame: falls in from the sky (or from the ceiling hatch indoors), then parks and waits
  function startDrop(x) {
    const A = ctx.world.arena - 3;
    x = clamp(x, -A, A);
    for (const b of ctx.world.blockers) if (x > b.x0 - 2 && x < b.x1 + 2) x = b.x0 - 3; // never inside a crawlspace
    PM.root.visible = true; PM.root.rotation.set(0, 0, 0);
    Object.assign(P, { x, y: ctx.world.ceiling ? ctx.world.ceiling - 5 : 34, vx: 0, vy: -8, dead: false, hull: maxHull(), maxHull: maxHull(), heat: 0, over: 0, fuel: 100, mode: 'dropping', inv: 0, skillT: 0, barrierT: 0, ground: false, pound: false });
    setCloak(false);
  }
  function hide() { P.mode = 'absent'; PM.root.visible = false; barrier.visible = false; ctx.audio.setJet(0); }

  // Shared falling/landing for frames nobody is driving
  function settle(dt) {
    if (P.ground) return false;
    P.vy = Math.max(-PLAYER.maxFall, P.vy - PLAYER.gravity * dt);
    const prevY = P.y; P.y += P.vy * dt;
    let landed = P.y <= 0;
    if (landed) P.y = 0;
    else if (P.vy <= 0) for (const p of ctx.world.plats) if (!p.pilotOnly && prevY >= p.top - 0.01 && P.y <= p.top && Math.abs(P.x - p.x) < p.w / 2 + 0.4) { P.y = p.top; landed = true; break; }
    if (landed) { P.vy = 0; P.ground = true; return true; }
    return false;
  }

  function dropping(dt) {
    const { fx } = ctx;
    PM.flames.forEach((f) => f.scale.set(1, rand(1, 1.5), 1));
    PM.torso.updateMatrixWorld();
    for (const f of PM.flames) { f.getWorldPosition(tmpV); fx.emit(fx.FX, { x: tmpV.x, y: tmpV.y - 0.6, z: tmpV.z, vx: rand(-1, 1), vy: -14, life: 0.2, s0: 1.4, s1: 0.3, c: pick([0xff9a40, 0xffd090]) }); }
    if (settle(dt)) {
      P.mode = 'parked'; P.land = 0.35;
      fx.ring(P.x, P.y); ctx.shake(0.8); ctx.audio.sfx('stomp');
      for (let i = 0; i < 14; i++) fx.emit(fx.SMOKE, { x: P.x + rand(-2, 2), y: P.y + 0.4, z: rand(-1, 1), vx: rand(-10, 10), vy: rand(0.3, 1.5), life: 1.2, s0: 1.4, s1: 4, c: 0x6a625a, a: 0.5, drag: 2.4 });
      PM.flames.forEach((f) => f.scale.set(1, 0.01, 1));
      ctx.onMechLanded && ctx.onMechLanded();
    }
    PM.root.position.set(P.x, P.y, 0);
    animMech(PM, 0, !P.ground, P.land, dt);
  }

  // Auto-defend: the parked frame tracks the nearest hostile and fires short bursts to cover the pilot
  function parked(dt) {
    settle(dt);
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 60);
    P.land = Math.max(0, P.land - dt * 1.4);
    P.heat = Math.max(0, P.heat - GUN.coolPerSec * dt);
    P.fuel = Math.min(100, P.fuel + PLAYER.fuelRegenPerSec * dt);
    P.hitT += dt;
    PM.root.position.set(P.x, P.y, 0);
    animMech(PM, 0, !P.ground, P.land, dt);
    PM.flames.forEach((f) => f.scale.set(1, 0.01, 1));
    let tgt = null, bd = 34;
    for (const e of ctx.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - P.x, e.y + e.cy - (P.y + 3)); if (d < bd) { bd = d; tgt = e; } }
    P.autoTarget = tgt;
    const s = stats.scale;
    if (!tgt) { PM.armN.rotation.z = lerp(PM.armN.rotation.z, -0.3, dt * 3); return; }
    if (Math.abs(tgt.x - P.x) > 0.6) P.face = tgt.x > P.x ? 1 : -1;
    P.turn = lerp(P.turn, P.face, Math.min(1, dt * 10));
    PM.root.scale.set(s * (Math.abs(P.turn) < 0.15 ? 0.15 * Math.sign(P.turn || 1) : P.turn), s, s);
    const sx = P.x + P.face * 0.25 * s, sy = P.y + (PM.body.position.y + 1.1) * s;
    const a = clamp(Math.atan2(tgt.y + tgt.cy - sy, (tgt.x - sx) * P.face), -1.15, 1.35);
    PM.armN.rotation.z = lerp(PM.armN.rotation.z, a - PM.torso.rotation.z, dt * 10);
    P.autoT -= dt;
    if (P.autoT <= 0) {
      P.autoT = 0.16;
      PM.root.updateMatrixWorld(true); PM.muzzle.getWorldPosition(tmpV);
      const ang = worldGunAngle();
      ctx.weapons.fireBullet(tmpV.x, tmpV.y, tmpV.z, ang + rand(-0.03, 0.03), 120, 0.4, 5 * stats.firepower);
      fx(tmpV);
      ctx.audio.sfx('gun');
    }
  }
  function fx(v) { ctx.fx.emit(ctx.fx.FX, { x: v.x, y: v.y, z: v.z, life: 0.06, s0: 1.6, s1: 0.6, c: 0xffc070 }); muzzleLight.position.copy(v); muzzleLight.intensity = 3; }
  function knock(vx, vy) { if (P.mode !== 'piloted') return; P.vx = vx; P.vy = vy; P.ground = false; }
  function heal(n) { if (P.dead || P.mode === 'absent') return; P.hull = Math.min(P.maxHull, P.hull + n); }

  // A bolt is blocked if the barrier is up and the bolt is just in front of the mech.
  function barrierBlocks(b) {
    if (P.mode !== 'piloted' || P.barrierT <= 0 || P.dead) return false;
    const fwd = (b.x - P.x) * P.face, s = stats.scale;
    return fwd > -0.5 && fwd < 3.6 * s && b.y > P.y - 0.5 && b.y < P.y + 6.2 * s;
  }

  // Title / hangar / debrief idle animation
  function idle(dt, t, spin) {
    PM.root.scale.setScalar(stats.scale);
    PM.root.rotation.y = spin ? Math.sin(t * 0.35) * 0.55 - 0.25 : 0;
    animMech(PM, 0, false, 0, dt);
    PM.armN.rotation.z = -0.15 + Math.sin(t * 0.6) * 0.05; PM.torso.rotation.z = Math.sin(t * 0.8) * 0.02;
    PM.flames.forEach((f) => f.scale.set(1, 0.01, 1));
    if (prim.spinup) PM.barrels.rotation.x += dt * 0.6;
    barrier.visible = false;
  }

  return {
    build, reset, update, hurt, knock, heal, idle, barrierBlocks, damageMult,
    eject, board, startDrop, hide, aim: updateAim,
    isCloaked: () => P.mode === 'piloted' && skillActive('cloak'),
    // pod mouth position for weapon-drop rockets fired from the mech
    muzzle() { PM.root.updateMatrixWorld(true); PM.podMouth.getWorldPosition(tmpV); return { x: tmpV.x, y: tmpV.y, z: tmpV.z, face: P.face }; },
    get stats() { return stats; }, get primary() { return prim; }, get secondary() { return sec; },
    get pilot() { return pilot; }, get skill() { return stats.skill; },
  };
}
