// Pooled visual effects: additive sparks/fire, smoke, physical debris, flash lights, scorch decals, shockwave rings.
// Everything is allocated once at load so explosions never cause garbage-collection hitches or shader recompiles.
import * as THREE from 'three';
import { TAU, rand, lerp } from './util.js';

export function createEffects(scene, tex, darkMat) {
  function spritePool(n, map, additive) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      const s = new THREE.Sprite(m); s.visible = false; scene.add(s);
      arr.push({ s, m, life: 0 });
    }
    return { arr, i: 0, add: additive };
  }
  const FX = spritePool(320, tex.glow, true);
  const SMOKE = spritePool(180, tex.smoke, false);

  function emit(pool, o) {
    const p = pool.arr[pool.i]; pool.i = (pool.i + 1) % pool.arr.length;
    p.s.visible = true; p.s.position.set(o.x, o.y, o.z || 0);
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = p.max = o.life; p.s0 = o.s0; p.s1 = o.s1 == null ? o.s0 : o.s1; p.a0 = o.a == null ? 1 : o.a;
    p.m.color.setHex(o.c == null ? 0xffffff : o.c); p.drag = o.drag || 0; p.g = o.g || 0;
    p.m.rotation = Math.random() * TAU; p.spin = o.spin || 0;
    p.s.scale.setScalar(p.s0); p.m.opacity = p.a0;
  }
  function updPool(pool, dt) {
    for (const p of pool.arr) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      const k = 1 - p.life / p.max, dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr + p.g * dt; p.vz *= dr;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      if (p.s.position.y < 0.05 && p.g < 0) { p.s.position.y = 0.05; p.vy *= -0.3; }
      p.s.scale.setScalar(lerp(p.s0, p.s1, k));
      p.m.rotation += p.spin * dt;
      p.m.opacity = pool.add ? p.a0 * (1 - k) : p.a0 * Math.min(1, k * 8) * (1 - k);
    }
  }

  // Flash lights: fixed pool so the light count (and therefore shaders) never changes at runtime.
  const lights = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff8a3a, 0, 30, 2); scene.add(l); lights.push({ l, t: 0, max: 1, i0: 0 }); }
  let li = 0;
  function flash(x, y, z, intensity, dur, color = 0xff8a3a) {
    const L = lights[li]; li = (li + 1) % lights.length;
    L.l.position.set(x, y, z); L.l.color.setHex(color); L.i0 = intensity; L.t = L.max = dur; L.l.intensity = intensity;
  }

  const debrisGeo = new THREE.BoxGeometry(1, 1, 1);
  const debris = [];
  for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(debrisGeo, darkMat); m.castShadow = true; m.visible = false; scene.add(m); debris.push({ m, life: 0 }); }
  let di = 0;
  function spawnDebris(x, y, z, n, spd, mat, size) {
    for (let i = 0; i < n; i++) {
      const d = debris[di]; di = (di + 1) % debris.length;
      d.m.material = mat || darkMat;
      const s = size || rand(0.2, 0.6);
      d.m.scale.set(s * rand(0.6, 1.4), s * rand(0.5, 1), s);
      d.m.position.set(x, y, z + rand(-0.5, 0.5));
      d.vx = rand(-1, 1) * spd; d.vy = rand(0.4, 1.2) * spd; d.vz = rand(-0.4, 0.4) * spd;
      d.rx = rand(-10, 10); d.rz = rand(-10, 10); d.life = rand(1.6, 3); d.m.visible = true;
    }
  }
  function updDebris(dt) {
    for (const d of debris) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) { d.m.visible = false; continue; }
      d.vy -= 30 * dt;
      d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
      d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rz * dt;
      if (d.m.position.y < d.m.scale.y / 2) { d.m.position.y = d.m.scale.y / 2; d.vy *= -0.35; d.vx *= 0.6; d.rx *= 0.5; d.rz *= 0.5; }
    }
  }

  const scorchGeo = new THREE.PlaneGeometry(1, 1);
  const scorchMat = new THREE.MeshBasicMaterial({ map: tex.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const scorches = [];
  for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(scorchGeo, scorchMat); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); scorches.push(m); }
  let si = 0;
  function scorch(x, size) {
    const m = scorches[si]; si = (si + 1) % scorches.length;
    m.position.set(x, 0.03, rand(-1.5, 1.5)); m.scale.setScalar(size); m.rotation.z = rand(0, TAU); m.visible = true;
  }

  const rings = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffa050, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); rings.push({ m, t: 0 });
  }
  let ri = 0;
  function ring(x, y) { const R = rings[ri]; ri = (ri + 1) % rings.length; R.m.position.set(x, y + 0.1, 0); R.t = 0; R.m.visible = true; }

  function update(dt) {
    updPool(FX, dt); updPool(SMOKE, dt); updDebris(dt);
    for (const L of lights) { if (L.t > 0) { L.t -= dt; L.l.intensity = L.i0 * Math.max(0, L.t / L.max); } else L.l.intensity = 0; }
    for (const R of rings) {
      if (!R.m.visible) continue;
      R.t += dt; R.m.scale.setScalar(1 + R.t * 22); R.m.material.opacity = Math.max(0, 1 - R.t / 0.5);
      if (R.t > 0.5) R.m.visible = false;
    }
  }

  function clear() {
    for (const p of [...FX.arr, ...SMOKE.arr]) { p.life = 0; p.s.visible = false; }
    for (const d of debris) { d.life = 0; d.m.visible = false; }
    for (const m of scorches) m.visible = false;
  }

  return { FX, SMOKE, emit, flash, spawnDebris, scorch, ring, update, clear };
}
