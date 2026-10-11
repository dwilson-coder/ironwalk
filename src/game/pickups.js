// In-battle pickups: weapons caches placed on the map, parachute supply drops, loot from destroyed enemies,
// and pilot-only stashes in secret areas. Each type has its own colour and icon (see PICKUPS in config.js).
import * as THREE from 'three';
import { PICKUPS, PICKUP_DROP_CHANCE, PICKUP_LIFETIME } from './config.js';
import { rand, clamp } from './util.js';
import { canvasTex } from './textures.js';
import { events } from '../store/gameStore.js';

// Draws a pickup's SVG icon path onto a canvas texture for the crate's front face.
function iconTexture(def) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#0e1215'; g.fillRect(0, 0, w, h);
    g.strokeStyle = def.css; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    if (typeof Path2D === 'undefined') return; // headless test environment
    g.save(); g.translate(20, 20); g.scale(88 / 24, 88 / 24);
    g.strokeStyle = def.css; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke(new Path2D(def.icon));
    g.restore();
  });
}

export function createPickups(ctx) {
  const items = [];
  const crateGeo = new THREE.BoxGeometry(1.4, 1.0, 1.0);
  const bandGeo = new THREE.BoxGeometry(1.44, 0.24, 1.04);
  const faceGeo = new THREE.PlaneGeometry(0.86, 0.86);
  const beaconGeo = new THREE.CylinderGeometry(0.45, 0.45, 16, 12, 1, true);
  const chuteGeo = new THREE.SphereGeometry(1.6, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x2f3437, roughness: 0.6, metalness: 0.6 });
  const chuteMat = new THREE.MeshStandardMaterial({ color: 0xd9d2c0, roughness: 0.9, side: THREE.DoubleSide });
  const mats = {};
  for (const [k, p] of Object.entries(PICKUPS)) {
    const map = iconTexture(p);
    mats[k] = {
      band: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: p.color, emissiveIntensity: 2.2 }),
      face: new THREE.MeshBasicMaterial({ map, toneMapped: false }),
      beacon: new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    };
  }

  function weightedType() {
    const T = ctx.T;
    const lowHealth = T.hp < T.maxHp * 0.5;
    const entries = Object.entries(PICKUPS).map(([k, p]) => [k, k === 'repair' && lowHealth ? p.weight * 2.5 : p.weight]);
    let total = entries.reduce((s, [, w]) => s + w, 0), r = Math.random() * total;
    for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
    return 'repair';
  }

  function surfaceBelow(x, y) {
    let top = 0;
    for (const p of ctx.world.plats) if (Math.abs(x - p.x) < p.w / 2 - 0.4 && p.top <= y + 0.01 && p.top > top) top = p.top;
    return top;
  }

  function spawn(type, x, y, { drop = false, cache = false, pilotOnly = false } = {}) {
    const m = mats[type];
    const g = new THREE.Group();
    const crate = new THREE.Mesh(crateGeo, crateMat); crate.castShadow = true; g.add(crate);
    crate.add(new THREE.Mesh(bandGeo, m.band));
    const face = new THREE.Mesh(faceGeo, m.face); face.position.z = 0.51; crate.add(face);
    const back = new THREE.Mesh(faceGeo, m.face); back.position.z = -0.51; back.rotation.y = Math.PI; crate.add(back);
    const beacon = new THREE.Mesh(beaconGeo, m.beacon); beacon.position.y = 8; g.add(beacon);
    let chute = null;
    if (drop) { chute = new THREE.Mesh(chuteGeo, chuteMat); chute.position.y = 3.2; g.add(chute); }
    const startY = drop ? (ctx.world.ceiling ? ctx.world.ceiling - 2 : y + 24) : y;
    if (pilotOnly) g.scale.setScalar(0.75);
    g.position.set(x, startY, 0);
    ctx.scene.add(g);
    const it = { type, g, crate, beacon, chute, x, y: startY, vy: 0, falling: drop || startY > surfaceBelow(x, startY) + 0.01, life: cache || pilotOnly ? 999 : PICKUP_LIFETIME, t: rand(0, 6), cache, pilotOnly };
    items.push(it);
    return it;
  }

  function maybeDrop(e) {
    if (Math.random() > PICKUP_DROP_CHANCE) return;
    const it = spawn(weightedType(), clamp(e.x, -ctx.world.arena, ctx.world.arena), Math.max(0, e.y + e.cy));
    it.vy = 6; it.falling = true;
  }

  function supplyDrop() {
    const A = ctx.world.arena - 4, T = ctx.T;
    let x = T.x + rand(8, 16) * (Math.random() < 0.5 ? -1 : 1);
    if (Math.abs(x) > A) x = T.x - Math.sign(x) * rand(8, 16);
    spawn(weightedType(), clamp(x, -A, A), 0, { drop: true });
    ctx.banner('', 'Supply drop inbound', 1200);
    ctx.audio.sfx('ui');
  }

  function apply(it) {
    const def = PICKUPS[it.type];
    switch (def.kind) {
      case 'heal': ctx.healTarget(35); break;
      case 'buff':
        ctx.P.buffs[it.type] = def.duration;
        if (it.type === 'munitions') ctx.P.secCD = 0;
        if (it.type === 'coolant') { ctx.P.heat = 0; ctx.P.over = 0; }
        break;
      default: ctx.support.collect(it.type); // ammo, shield, life, freeze
    }
    ctx.run.pickups++;
    ctx.score.add(50);
    ctx.audio.sfx('pickup');
    const s = ctx.toScreen(it.x, it.y + 2.5);
    events.emit('popup', { ...s, text: def.short, kind: 'pickup', color: def.css });
    for (let i = 0; i < 14; i++) ctx.fx.emit(ctx.fx.FX, { x: it.x, y: it.y + 0.6, z: 0.3, vx: rand(-6, 6), vy: rand(2, 10), life: 0.6, s0: 0.6, s1: 0.1, c: def.color, g: -12 });
    ctx.fx.flash(it.x, it.y + 1, 2, 3, 0.3, def.color);
  }

  function remove(it) {
    ctx.scene.remove(it.g);
    const i = items.indexOf(it); if (i >= 0) items.splice(i, 1);
  }

  function update(dt) {
    const T = ctx.T;
    for (const it of [...items]) {
      it.t += dt; it.life -= dt;
      if (it.falling) {
        it.vy = it.chute ? Math.max(it.vy - 30 * dt, -5) : it.vy - 30 * dt;
        const prev = it.y; it.y += it.vy * dt;
        const top = surfaceBelow(it.x, prev);
        if (it.y <= top) {
          it.y = top; it.falling = false; it.vy = 0;
          if (it.chute) { it.g.remove(it.chute); it.chute = null; ctx.fx.emit(ctx.fx.SMOKE, { x: it.x, y: top + 0.3, life: 0.8, s0: 1, s1: 3, c: 0x6a625a, a: 0.5 }); }
        }
        if (it.chute) it.chute.rotation.z = Math.sin(it.t * 2) * 0.12;
      }
      const bob = it.falling ? 0 : 0.5 + Math.sin(it.t * 2.4) * 0.15;
      it.g.position.set(it.x, it.y + bob, 0);
      it.crate.rotation.y = Math.sin(it.t * 0.8) * 0.6; // sway so the icon face stays readable
      it.beacon.material.opacity = 0.1 + Math.sin(it.t * 3) * 0.05;
      it.g.visible = it.life > 4 || Math.sin(it.t * 18) > 0; // blink before expiring
      if (it.life <= 0) { remove(it); continue; }
      // collected by whatever the player controls; secret-area stashes only by the pilot on foot
      if (T.dead || (it.pilotOnly && !T.onFoot)) continue;
      const cy = it.y + bob;
      if (Math.abs(it.x - T.x) < T.w + 0.9 && cy > T.y - 1 && cy < T.y + T.h + 0.6) { apply(it); remove(it); }
    }
  }

  function clear() { for (const it of [...items]) remove(it); }

  return { spawn, maybeDrop, supplyDrop, update, clear, get count() { return items.length; }, get items() { return items; } };
}
