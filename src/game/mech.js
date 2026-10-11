// Procedural mech built from primitives, plus a digitigrade (reverse-knee) walk cycle.
// The hierarchy mirrors a skeletal rig: root > body > torso > arms, body > hips > knees > ankles.
// Variants: chassis (warden / striker / bulwark / spectre), primary gun model, secondary system model, paint.
import * as THREE from 'three';
import { TAU, clamp, lerp } from './util.js';

export const std = (color, rough = 0.7, metal = 0.4, extra = {}) =>
  new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));

export const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
export const coneGeo = new THREE.ConeGeometry(0.24, 1.4, 10, 1, true);
coneGeo.rotateX(Math.PI);
coneGeo.translate(0, -0.7, 0);

export function playerMats(paint = { hull: 0xc9bc9f, accent: 0xd96a1f, glow: 0xffa040 }) {
  return {
    hull: std(paint.hull, 0.62, 0.42),
    dark: std(0x2c3134, 0.55, 0.7),
    joint: std(0x5a5f62, 0.4, 0.85),
    accent: std(paint.accent, 0.55, 0.3),
    glow: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: paint.glow, emissiveIntensity: 2.6 }),
  };
}
export function enemyMats(glow = 0xff3020, hull = 0x3a3d40) {
  return {
    hull: std(hull, 0.55, 0.6),
    dark: std(0x1c1f22, 0.6, 0.7),
    joint: std(0x4a4d50, 0.45, 0.8),
    accent: std(0x7d1f1a, 0.6, 0.35),
    glow: new THREE.MeshStandardMaterial({ color: 0x110000, emissive: glow, emissiveIntensity: 3 }),
  };
}

export function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function cyl(rt, rb, h, seg, mat, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function disposeTree(o) {
  o.traverse((c) => { if (c.geometry && c.geometry !== coneGeo) c.geometry.dispose(); });
}
export function disposeMats(mt) { Object.values(mt).forEach((m) => m.dispose && m.dispose()); }

function buildGun(kind, mt, gun) {
  const barrels = new THREE.Group(); gun.add(barrels);
  const muzzle = new THREE.Object3D();
  if (kind === 'scatter') {
    box(1.4, 0.62, 0.6, mt.dark, 0.8, -0.05, 0, gun);
    box(0.6, 0.3, 0.64, mt.accent, 0.5, 0.36, 0, gun);
    barrels.position.set(1.5, -0.05, 0);
    for (const y of [0.14, -0.14]) { const b = cyl(0.15, 0.17, 1.0, 10, mt.joint, barrels); b.rotation.z = Math.PI / 2; b.position.set(0.5, y, 0); }
    box(0.3, 0.6, 0.5, mt.dark, 0.95, 0, 0, barrels);
    muzzle.position.set(1.15, 0, 0);
  } else if (kind === 'rail') {
    box(1.8, 0.42, 0.42, mt.dark, 1.0, -0.05, 0, gun);
    box(0.9, 0.2, 0.46, mt.accent, 0.6, 0.28, 0, gun);
    barrels.position.set(1.9, -0.05, 0);
    const b = cyl(0.09, 0.11, 2.6, 8, mt.joint, barrels); b.rotation.z = Math.PI / 2; b.position.x = 1.3;
    for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), mt.glow); r.rotation.y = Math.PI / 2; r.position.x = 0.3 + i * 0.45; barrels.add(r); }
    muzzle.position.set(2.65, 0, 0);
  } else {
    box(1.6, 0.5, 0.5, mt.dark, 0.9, -0.05, 0, gun);
    box(0.7, 0.28, 0.56, mt.accent, 0.55, 0.3, 0, gun);
    barrels.position.set(1.7, -0.05, 0);
    for (let i = 0; i < 4; i++) {
      const b = cyl(0.07, 0.07, 1.3, 6, mt.joint, barrels); b.rotation.z = Math.PI / 2;
      const a = (i / 4) * TAU; b.position.set(0.65, Math.cos(a) * 0.13, Math.sin(a) * 0.13);
    }
    const collar = cyl(0.24, 0.24, 0.14, 10, mt.dark, barrels); collar.rotation.z = Math.PI / 2; collar.position.x = 1.1;
    muzzle.position.set(1.4, 0, 0);
  }
  barrels.add(muzzle);
  return { barrels, muzzle };
}

export function makeMech(mt, opts = {}) {
  const { chassis = 'warden', primary = 'chaingun', secondary = 'seeker' } = opts;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body); body.position.y = 3;
  box(1.3, 0.7, 1.7, mt.dark, 0, 0, 0, body); // pelvis

  const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso);
  const shell = new THREE.Group(); torso.add(shell);
  if (chassis === 'striker' || chassis === 'spectre') shell.scale.set(0.92, 0.88, 0.85);
  box(2.3, 1.5, 2, mt.hull, 0, 0, 0, shell);
  box(1.7, 0.32, 2.1, mt.dark, -0.1, 0.88, 0, shell);
  const cockpit = box(1.15, 0.95, 1.5, mt.dark, 1.35, 0.05, 0, shell); cockpit.rotation.z = chassis === 'striker' ? -0.42 : -0.22;
  box(0.14, 0.16, 1.25, mt.glow, 1.92, 0.25, 0, shell);
  box(2.32, 0.22, 2.04, mt.accent, 0, -0.5, 0, shell);
  box(0.9, 1.7, 1.7, mt.dark, -1.35, -0.05, 0, shell);
  for (let i = 0; i < 3; i++) box(0.06, 0.12, 1.4, mt.joint, -1.82, 0.5 - i * 0.3, 0, shell);
  if (chassis === 'striker') {
    for (const z of [0.45, -0.45]) { const fin = box(1.3, 0.08, 0.5, mt.accent, -1.7, 0.9, z, shell); fin.rotation.z = 0.5; }
  }
  if (chassis === 'spectre') {
    // sensor dish and twin whip antennas on the back, low angular brow
    const dish = cyl(0.62, 0.62, 0.1, 18, mt.joint, shell); dish.rotation.z = 1.1; dish.position.set(-1.6, 1.15, 0.2);
    box(0.12, 0.12, 0.5, mt.glow, -1.62, 1.15, 0.2, shell);
    for (const z of [0.55, -0.55]) { const ant = box(0.04, 1.8, 0.04, mt.dark, -1.2, 1.6, z, shell); ant.rotation.z = 0.25; }
    const brow = box(1.2, 0.18, 1.6, mt.dark, 1.2, 0.55, 0, shell); brow.rotation.z = -0.3;
  }
  if (chassis === 'bulwark') {
    box(2.6, 0.5, 2.3, mt.hull, 0.1, 1.05, 0, shell); // dorsal armor
    const brow = box(0.5, 0.5, 2.3, mt.accent, 1.5, 0.7, 0, shell); brow.rotation.z = -0.5;
  }

  const flames = [];
  for (const z of [-0.5, 0.5]) {
    const n = cyl(0.2, 0.3, 0.5, 10, mt.joint, torso); n.position.set(-1.55, -0.95, z);
    const f = new THREE.Mesh(coneGeo, flameMat); f.position.set(-1.55, -1.2, z); f.scale.set(1, 0.01, 1);
    torso.add(f); flames.push(f);
  }

  // secondary system model
  let pod, podMouth = new THREE.Object3D(), shieldEmitter = null;
  if (secondary === 'mortar') {
    pod = new THREE.Group(); pod.position.set(-0.7, 1.2, -0.62); torso.add(pod);
    const tube = cyl(0.32, 0.36, 1.6, 12, mt.accent, pod); tube.rotation.z = -0.5; tube.position.set(0.15, 0.5, 0);
    box(0.8, 0.4, 0.8, mt.dark, 0, -0.1, 0, pod);
    podMouth.position.set(0.55, 1.2, 0);
  } else if (secondary === 'barrier') {
    pod = box(1.2, 0.5, 0.8, mt.dark, -0.4, 1.15, -0.62, torso);
    const emitter = cyl(0.42, 0.42, 0.14, 16, mt.glow, pod); emitter.rotation.z = Math.PI / 2; emitter.position.set(0.64, 0.05, 0);
    shieldEmitter = emitter; podMouth.position.set(0.7, 0, 0);
  } else {
    pod = box(1.5, 0.75, 0.8, mt.accent, -0.3, 1.25, -0.62, torso);
    for (let i = 0; i < 4; i++) box(0.06, 0.22, 0.22, mt.dark, 0.76, i < 2 ? 0.17 : -0.17, i % 2 ? 0.18 : -0.18, pod);
    podMouth.position.set(0.8, 0, 0);
  }
  pod.add(podMouth);
  box(0.06, 1.2, 0.06, mt.joint, -0.9, 1.45, 0.72, torso); // antenna

  // near (camera-side) gun arm
  const armN = new THREE.Group(); armN.position.set(0.25, 0.15, 1.32); torso.add(armN);
  box(0.75, 0.75, 0.6, mt.hull, 0, 0, 0, armN);
  if (chassis === 'bulwark') box(1.0, 0.95, 0.3, mt.accent, -0.05, 0.25, 0.38, armN);
  const gun = new THREE.Group(); armN.add(gun);
  const { barrels, muzzle } = buildGun(primary, mt, gun);

  // far arm with shield plate
  const armF = new THREE.Group(); armF.position.set(0.25, 0.15, -1.32); torso.add(armF);
  box(0.75, 0.75, 0.6, mt.hull, 0, 0, 0, armF);
  box(chassis === 'bulwark' ? 1.8 : 1.3, chassis === 'bulwark' ? 1.4 : 0.9, 0.18, mt.dark, 0.55, -0.35, -0.2, armF);

  const legs = [];
  for (const z of [0.78, -0.78]) {
    const hip = new THREE.Group(); hip.position.set(0, -0.15, z); body.add(hip);
    box(chassis === 'striker' || chassis === 'spectre' ? 0.48 : 0.6, 1.6, 0.6, mt.hull, 0, -0.75, 0, hip);
    box(0.62, 0.4, 0.62, mt.accent, 0, -0.2, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -1.5; hip.add(knee);
    const kj = cyl(0.32, 0.32, 0.7, 12, mt.joint, knee); kj.rotation.x = Math.PI / 2;
    box(chassis === 'bulwark' ? 0.6 : 0.44, 1.45, chassis === 'bulwark' ? 0.6 : 0.44, mt.dark, 0, -0.72, 0, knee);
    box(0.12, 1.1, 0.12, mt.joint, 0.28, -0.65, 0, knee);
    if (chassis === 'bulwark') box(0.2, 1.1, 0.7, mt.hull, 0.36, -0.7, 0, knee); // shin guard
    const ankle = new THREE.Group(); ankle.position.y = -1.42; knee.add(ankle);
    box(1.3, 0.28, 0.72, mt.dark, 0.28, -0.08, 0, ankle);
    box(0.45, 0.22, 0.74, mt.joint, -0.38, -0.1, 0, ankle);
    box(0.4, 0.12, 0.74, mt.accent, 0.82, 0.02, 0, ankle);
    legs.push({ hip, knee, ankle, t: 0.45, k: -0.9 });
  }
  return { root, body, torso, armN, armF, gun, barrels, muzzle, pod, podMouth, shieldEmitter, legs, flames, ph: 0 };
}

// spd: forward speed relative to facing; air: airborne; land: 0..0.35 landing squash
export function animMech(m, spd, air, land, dt) {
  const amt = clamp(Math.abs(spd) / 11, 0, 1);
  m.ph += spd * dt * 0.62;
  let hmax = 0;
  m.legs.forEach((L, i) => {
    let t, k;
    if (air) { t = i ? 0.95 : 0.55; k = i ? -1.65 : -1.2; }
    else {
      const p = m.ph + i * Math.PI;
      t = 0.45 + Math.sin(p) * 0.5 * amt;
      k = -0.9 - Math.max(0, Math.cos(p) * Math.sign(spd || 1)) * 0.8 * amt;
    }
    L.t = lerp(L.t, t, Math.min(1, dt * 16)); L.k = lerp(L.k, k, Math.min(1, dt * 16));
    L.hip.rotation.z = L.t; L.knee.rotation.z = L.k; L.ankle.rotation.z = -(L.t + L.k);
    hmax = Math.max(hmax, 1.5 * Math.cos(L.t) + 1.42 * Math.cos(L.t + L.k) + 0.22);
  });
  const target = air ? 3 : 0.15 + hmax - land * 1.2;
  m.body.position.y = lerp(m.body.position.y, target, Math.min(1, dt * (air ? 6 : 30)));
}
