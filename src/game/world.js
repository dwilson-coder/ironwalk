// Builds one mission map into a THREE.Group so it can be swapped out cleanly between levels.
// Maps: yard (outdoor, rain), foundry (indoor, embers), flats (outdoor, dust), core (indoor, steam),
// tunnels (pilot-only side op). Every map also gets ladders and secret areas for the pilot on foot.
import * as THREE from 'three';
import { rand, pick } from './util.js';
import { std, box, cyl } from './mech.js';

export function buildLevel(scene, level, tex) {
  const group = new THREE.Group();
  group.name = `level-${level.id}`;
  const add = (o) => { group.add(o); return o; };
  const T = level.theme, A = level.arena, C = level.ceiling;
  const anims = []; // per-frame callbacks for this map

  scene.background = tex.sky(T.sky);
  scene.fog = new THREE.Fog(...T.fog);

  add(new THREE.HemisphereLight(...T.hemi));
  const sun = new THREE.DirectionalLight(...T.sun);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 30, bottom: -12, near: 1, far: 160 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  sun.userData.offset = T.sunOffset;
  add(sun); add(sun.target);
  const rim = new THREE.DirectionalLight(...T.rim); rim.position.set(10, 14, -40); add(rim);

  const steelMat = std(0x3a3532, 0.6, 0.7);
  const glowSprite = (color, sx, sy, x, y, z, opacity = 1) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
    s.scale.set(sx, sy, 1); s.position.set(x, y, z); return add(s);
  };

  // ------------------------------------------------------------ catwalks (shared)
  const plats = [];
  const indoor = !!C;
  const deckMat = std(indoor ? 0x34383b : 0x4a4846, 0.7, 0.6);
  const railMat = std(level.map === 'core' ? 0x2c8aa0 : level.map === 'flats' ? 0xb04a2a : 0x9a7a3a, 0.6, 0.5);
  const lampMat = new THREE.MeshBasicMaterial({ color: level.map === 'core' ? 0x7fe6ff : 0xffc070, toneMapped: false });
  level.platforms.forEach(([x, h, w]) => {
    const g = new THREE.Group(); g.position.set(x, h, 0); add(g);
    box(w, 0.45, 3.2, deckMat, 0, -0.22, -0.4, g);
    box(w, 0.14, 0.14, railMat, 0, 1.1, -1.9, g);
    for (let i = -w / 2 + 0.5; i <= w / 2 - 0.4; i += w / 4) box(0.14, 1.1, 0.14, railMat, i, 0.55, -1.9, g);
    if (indoor && C) for (const px of [-w / 2 + 1, w / 2 - 1]) { const hang = box(0.12, C - h, 0.12, steelMat, px, (C - h) / 2, -1.7, g); hang.castShadow = false; }
    else for (const px of [-w / 2 + 1, w / 2 - 1]) box(0.5, h, 0.5, steelMat, px, -h / 2, -1.7, g);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.3), lampMat); lamp.position.set(0, -0.5, -0.4); g.add(lamp);
    plats.push({ x, top: h, w });
  });

  // ------------------------------------------------------------ pilot routes: ladders, rooftop ledges, crawlspace tunnels
  // ladders: the pilot can't jet, so every catwalk gets one. blockers: low structures a mech can't fit under.
  // secrets: areas only the pilot can reach; entering one for the first time pays a bonus.
  const ladders = [], blockers = [], secrets = [];
  const ladderMat = std(0xb08a3a, 0.6, 0.6);
  const ladder = (x, y0, y1) => {
    const g = add(new THREE.Group()); g.position.set(x, 0, 1.3);
    for (const dx of [-0.32, 0.32]) box(0.08, y1 - y0 + 0.9, 0.08, ladderMat, dx, (y0 + y1) / 2 + 0.45, 0, g).castShadow = false;
    for (let y = y0 + 0.35; y <= y1 + 0.5; y += 0.42) box(0.64, 0.06, 0.06, ladderMat, 0, y, 0, g).castShadow = false;
    ladders.push({ x, y0, y1 });
  };
  for (const p of plats) ladder(p.x + p.w / 2 - 0.7, 0, p.top);

  const shedMat = std(level.map === 'flats' ? 0x8c6a4e : 0x4a4644, 0.85, 0.3);
  const glowStrip = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false });
  (level.secrets || []).forEach((sec, i) => {
    if (sec.type === 'rooftop') {
      // narrow ledge with a low canopy: the pilot fits, a mech falls straight through the grating
      const { x, w, h } = sec;
      add(box(w, 0.3, 2.6, deckMat, x, h - 0.15, -0.3));
      add(box(w + 0.6, 0.25, 3, shedMat, x, h + 2.75, -0.3));
      add(box(w, 2.7, 0.2, shedMat, x, h + 1.35, -1.6)).castShadow = false;
      for (const px of [x - w / 2, x + w / 2]) add(box(0.15, 2.7, 0.15, steelMat, px, h + 1.35, 1));
      add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.06, 0.1), glowStrip)).position.set(x, h + 2.58, 0.6);
      plats.push({ x, top: h, w, pilotOnly: true });
      ladder(sec.ladderX, sec.ladderFrom || 0, h);
      secrets.push({ id: `${level.id}-${i}`, label: 'Rooftop stash', x0: x - w / 2, x1: x + w / 2, y0: h - 0.2, y1: h + 2.7, found: false });
    } else if (sec.type === 'tunnel') {
      // crawlspace: roof at 2.6 m (a mech is 4.8 m tall), open at both ends and cut away toward the camera
      const { x, w } = sec, H = 2.6, t = 0.5;
      add(box(w, t, 4.2, shedMat, x, H + t / 2, -0.5));
      add(box(w, H, 0.3, shedMat, x, H / 2, -2.4)).castShadow = false;
      for (const px of [x - w / 2, x + w / 2]) add(box(0.5, H, 0.5, steelMat, px, H / 2, -2.2));
      add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.06, 0.1), glowStrip)).position.set(x, H - 0.08, -1.2);
      plats.push({ x, top: H + t, w });
      blockers.push({ x0: x - w / 2, x1: x + w / 2, top: H + t });
      secrets.push({ id: `${level.id}-${i}`, label: 'Crawlspace', x0: x - w / 2 + 0.3, x1: x + w / 2 - 0.3, y0: -0.1, y1: H, found: false });
    }
  });

  // ------------------------------------------------------------ helpers
  function ground(map, color, repeatX, repeatY, z = -40, width = 700, depth = 140) {
    map.repeat.set(repeatX, repeatY);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), std(color, 0.92, indoor ? 0.35 : 0.05, { map }));
    m.rotation.x = -Math.PI / 2; m.position.z = z; m.receiveShadow = true; return add(m);
  }
  function smokeColumns(list, { color = 0x2a2420, rise = 55, grow = 26, speed = 0.045, opacity = 0.75, count = 14, drift = 18 } = {}) {
    const items = [];
    list.forEach(([x, z, y0 = 2]) => {
      for (let i = 0; i < count; i++) {
        const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.smoke, color, transparent: true, depthWrite: false, opacity })));
        items.push({ s, x, z, y0, t: i / count });
      }
    });
    anims.push((dt) => {
      for (const a of items) {
        a.t = (a.t + dt * speed) % 1; const k = a.t;
        a.s.position.set(a.x + k * drift + Math.sin(k * 6 + a.x) * 2, a.y0 + k * rise, a.z);
        a.s.scale.setScalar(4 + k * grow); a.s.material.opacity = Math.min(1, k * 6) * (1 - k) * opacity;
      }
    });
  }
  function pointField({ count, color, size, additive, area = [104, 30, 40], zRange = [-25, 14], vel, opacity = 0.9 }) {
    const pos = new Float32Array(count * 3), v = [];
    for (let i = 0; i < count; i++) { pos.set([rand(-area[0] / 2, area[0] / 2), rand(0, area[1]), rand(...zRange)], i * 3); v.push(vel()); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = add(new THREE.Points(geo, new THREE.PointsMaterial({ map: tex.glow, color, size, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })));
    pts.frustumCulled = false;
    anims.push((dt, camX) => {
      const half = area[0] / 2;
      for (let i = 0; i < count; i++) {
        const o = i * 3, vv = v[i];
        let x = pos[o] + vv[0] * dt, y = pos[o + 1] + vv[1] * dt;
        if (y > area[1]) y -= area[1]; if (y < 0) y += area[1];
        if (x < camX - half) x += area[0]; else if (x > camX + half) x -= area[0];
        pos[o] = x; pos[o + 1] = y;
      }
      geo.attributes.position.needsUpdate = true;
    });
  }
  function rain() {
    const N = 2200, rainPos = new Float32Array(N * 6);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    for (let i = 0; i < N; i++) { const x = rand(-50, 50), y = rand(0, 40), z = rand(-25, 16); rainPos.set([x, y, z, x + 0.12, y + 0.9, z], i * 6); }
    const lines = add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb2ba, transparent: true, opacity: 0.28 })));
    lines.frustumCulled = false;
    anims.push((dt, camX, splash) => {
      for (let i = 0; i < N; i++) {
        const o = i * 6;
        let y = rainPos[o + 1] - 46 * dt, x = rainPos[o] - 5 * dt;
        if (y < 0) { y = 40; x = camX + rand(-50, 50); if (splash && Math.random() < 0.04) splash(x, rainPos[o + 2]); }
        if (x < camX - 52) x += 104; else if (x > camX + 52) x -= 104;
        rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 3] = x + 0.12; rainPos[o + 4] = y + 0.9;
      }
      geo.attributes.position.needsUpdate = true;
    });
  }
  function boundaryPylons(color = 0xff3a20) {
    const stripMat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const p = add(box(1.2, 14, 1.2, steelMat, s * (A + 4), 7, -3 + k * 3));
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 12, 0.2), stripMat); strip.position.set(-s * 0.7, 0, 0); p.add(strip);
    }
  }
  function hallShell(wallTex, floorTex, floorColor, accentHex) {
    const L = A * 2 + 30;
    ground(floorTex, floorColor, 40, 8, -8, L + 40, 46);
    const wallMat = std(0xffffff, 0.85, 0.4, { map: wallTex });
    wallTex.repeat.set(L / 16, (C + 2) / 16);
    const wall = add(box(L, C + 2, 1, wallMat, 0, (C + 2) / 2, -13)); wall.castShadow = false;
    const ceil = add(box(L, 1, 30, std(0x1a1c1e, 0.9, 0.5), 0, C + 0.5, 1)); ceil.castShadow = false;
    for (const s of [-1, 1]) { const w = add(box(4, C + 1, 30, wallMat, s * (A + 3.4), (C + 1) / 2, 1)); w.castShadow = false; }
    const hazard = std(accentHex, 0.6, 0.3);
    for (let x = -A; x <= A; x += 16) {
      const p = add(box(1.6, C, 1.6, steelMat, x, C / 2, -11.5)); p.castShadow = false;
      box(1.7, 1.2, 1.7, hazard, 0, -C / 2 + 1.2, 0, p);
    }
    // overhead lamps
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, toneMapped: false });
    for (let x = -A + 8; x < A; x += 24) { const l = add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 0.8), lampMat)); l.position.set(x, C - 0.1, -2); }
  }

  // ------------------------------------------------------------ maps
  if (level.map === 'yard') {
    ground(tex.concrete(), 0xffffff, 70, 14);
    const puddle = add(new THREE.Mesh(new THREE.PlaneGeometry(700, 8), new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.12, metalness: 0.9, transparent: true, opacity: 0.45 })));
    puddle.rotation.x = -Math.PI / 2; puddle.position.set(0, 0.02, -3); puddle.receiveShadow = true;
    const skyline = (z, count, hmin, hmax, col, lit, emi) => {
      const mats = [0, 1, 2].map(() => { const t = tex.windows(lit); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); return std(col, 0.9, 0.2, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: emi }); });
      for (let i = 0; i < count; i++) {
        const w = rand(8, 22), h = rand(hmin, hmax), d = rand(6, 14);
        const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pick(mats)));
        m.position.set(-320 + i * (640 / count) + rand(-6, 6), h / 2, z + rand(-5, 5));
        if (Math.random() < 0.35) { const s = box(w * 0.6, rand(3, 8), d * 0.8, m.material, 0, h / 2 + 2, 0, m); s.rotation.z = rand(-0.4, 0.4); s.castShadow = false; }
      }
    };
    skyline(-150, 46, 30, 95, 0x2a2f35, 0.12, 0.55);
    skyline(-90, 34, 14, 48, 0x34363a, 0.08, 0.45);
    const ruinMat = std(0x6a625a, 0.95, 0.1, { map: tex.concrete() });
    for (let i = 0; i < 28; i++) {
      const x = -300 + i * 22 + rand(-6, 6), z = rand(-40, -26), h = rand(4, 14), w = rand(5, 12);
      add(box(w, h, 1.4, ruinMat, x, h / 2, z)).rotation.y = rand(-0.2, 0.2);
      if (Math.random() < 0.6) add(box(0.5, rand(8, 18), 0.5, steelMat, x + rand(-3, 3), 5, z + 1.5)).rotation.z = rand(-0.6, 0.6);
      if (Math.random() < 0.4) {
        const c = add(box(6, 2.6, 2.4, std(pick([0x6e3b26, 0x2f4a52, 0x5a5a3a]), 0.8, 0.4), x + 8, 1.3, z + 6)); c.rotation.y = rand(-0.5, 0.5);
        if (Math.random() < 0.5) box(6, 2.6, 2.4, c.material, 0, 2.6, 0, c).rotation.y = rand(-0.3, 0.3);
      }
    }
    const fgMat = std(0x141516, 0.9, 0.3);
    for (let i = 0; i < 34; i++) add(box(rand(2, 6), rand(0.4, 1.4), rand(1, 2.5), fgMat, -320 + i * 19 + rand(-5, 5), 0.3, rand(8, 11))).rotation.set(rand(-0.2, 0.2), rand(-0.6, 0.6), rand(-0.3, 0.3));
    boundaryPylons();
    [[-140, -70], [-20, -95], [85, -60], [200, -85]].forEach(([x, z]) => glowSprite(0xff6a20, 26, 12, x, 3, z));
    smokeColumns([[-140, -70], [-20, -95], [85, -60], [200, -85]]);
    rain();
  }

  if (level.map === 'foundry') {
    hallShell(tex.panel('#4a3a32'), tex.metal(), 0x9a8f86, 0xc9a227);
    // molten channel along the back of the hall
    const moltenMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false });
    const molten = add(new THREE.Mesh(new THREE.BoxGeometry(A * 2 + 20, 0.25, 2.4), moltenMat)); molten.position.set(0, 0.06, -8.6);
    const lip = std(0x2a2522, 0.8, 0.6);
    add(box(A * 2 + 20, 0.6, 0.4, lip, 0, 0.3, -7.2)); add(box(A * 2 + 20, 0.6, 0.4, lip, 0, 0.3, -10));
    const heat = [];
    for (let x = -A; x <= A; x += 12) heat.push(glowSprite(0xff6a1a, 14, 4, x, 0.8, -8.6, 0.8));
    for (const x of [-A * 0.6, 0, A * 0.6]) { const l = new THREE.PointLight(0xff7a30, 1.4, 34, 2); l.position.set(x, 2.5, -7); add(l); }
    anims.push((dt, camX, splash, t) => { moltenMat.color.setHSL(0.055, 1, 0.5 + Math.sin(t * 2) * 0.05); heat.forEach((s, i) => { s.material.opacity = 0.65 + Math.sin(t * 3 + i) * 0.2; }); });
    // overhead crane rails, trolleys and hanging hooks
    for (const z of [-3.5, -7.5]) add(box(A * 2 + 20, 0.7, 0.7, steelMat, 0, C - 1.4, z)).castShadow = false;
    const hooks = [];
    for (const x of [-A * 0.55, A * 0.1, A * 0.7]) {
      add(box(3, 1, 5, std(0xc9a227, 0.6, 0.4), x, C - 2.1, -5.5)).castShadow = false;
      const chain = add(cyl(0.06, 0.06, C * 0.45, 6, steelMat)); chain.position.set(x, C - 2.6 - C * 0.225, -5.5);
      const hook = add(box(0.9, 0.9, 0.4, steelMat, x, C - 2.8 - C * 0.45, -5.5)); hooks.push({ chain, hook, x });
    }
    anims.push((dt, camX, splash, t) => hooks.forEach((h, i) => { const sway = Math.sin(t * 0.7 + i) * 0.4; h.chain.position.x = h.x + sway * 0.5; h.hook.position.x = h.x + sway; }));
    // ladle crucibles in the background
    for (const x of [-A * 0.75, -A * 0.2, A * 0.45]) {
      const c = add(cyl(2.8, 2.2, 4, 16, std(0x2e2826, 0.7, 0.6))); c.position.set(x, 2, -11); c.rotation.z = 0.12;
      const rimGlow = add(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.18, 8, 24), moltenMat)); rimGlow.position.set(x + 0.2, 4.05, -11); rimGlow.rotation.x = Math.PI / 2;
    }
    const pipeMat = std(0x2a2c2e, 0.6, 0.7);
    for (const y of [0.6, 1.4]) { const p = add(cyl(0.35, 0.35, A * 2 + 20, 10, pipeMat)); p.rotation.z = Math.PI / 2; p.position.set(0, y, 9); }
    smokeColumns([[-A * 0.75, -11, 4], [A * 0.45, -11, 4]], { color: 0x2a1c14, rise: C - 4, grow: 10, speed: 0.08, opacity: 0.6, count: 10, drift: 4 });
    pointField({ count: 260, color: 0xff8a3a, size: 0.32, additive: true, area: [110, C, 0], zRange: [-10, 6], vel: () => [rand(-0.6, 0.6), rand(1.5, 3.5)] });
  }

  if (level.map === 'flats') {
    ground(tex.salt(), 0xffffff, 80, 22, -60, 900, 200);
    const mesaMat = std(0xa77d58, 0.95, 0.05, { flatShading: true });
    for (let i = 0; i < 18; i++) {
      const r = rand(14, 34), h = rand(16, 46);
      const m = add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, h, 7), mesaMat)); m.position.set(-400 + i * 46 + rand(-10, 10), h / 2 - 1, rand(-230, -170)); m.rotation.y = rand(0, 3);
    }
    // relay lattice towers with blinking beacons
    const lattice = std(0x9a3a24, 0.6, 0.5);
    const beacons = [];
    for (let i = 0; i < 9; i++) {
      const x = -280 + i * 70 + rand(-10, 10), z = rand(-70, -40), h = rand(28, 46);
      const g = add(new THREE.Group()); g.position.set(x, 0, z);
      for (const [lx, lz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) { const leg = box(0.3, h, 0.3, lattice, lx * 0.6, h / 2, lz * 0.6, g); leg.castShadow = false; }
      for (let y = 4; y < h; y += 5) { const b = box(2.4, 0.15, 0.15, lattice, 0, y, 1, g); b.rotation.z = 0.6; b.castShadow = false; }
      beacons.push(glowSprite(0xff2a1a, 3, 3, x, h + 1, z));
      if (i % 2 === 0) { const dish = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), std(0xe6e2da, 0.5, 0.3, { side: THREE.DoubleSide })); dish.position.set(0, h * 0.7, 2); dish.rotation.x = -1.2; g.add(dish); }
    }
    anims.push((dt, camX, splash, t) => beacons.forEach((b, i) => { b.material.opacity = Math.sin(t * 3 + i) > 0.3 ? 1 : 0.1; }));
    // half-buried wrecks and containers
    for (let i = 0; i < 16; i++) {
      const c = add(box(rand(4, 9), rand(2, 3.4), rand(2.2, 3), std(pick([0x7a6a58, 0x4f5f66, 0x8c4a2e]), 0.8, 0.5), -300 + i * 40 + rand(-10, 10), 0.8, rand(-34, -18)));
      c.rotation.set(rand(-0.15, 0.15), rand(-0.6, 0.6), rand(-0.2, 0.2));
    }
    const postMat = std(0x3b3530, 0.8, 0.4);
    for (let x = -320; x < 320; x += 6) add(box(0.15, rand(1, 1.6), 0.15, postMat, x, 0.6, 9.5)).rotation.z = rand(-0.2, 0.2);
    boundaryPylons(0xffb020);
    pointField({ count: 900, color: 0xe8d8b8, size: 0.45, additive: false, opacity: 0.55, area: [110, 18, 0], zRange: [-20, 12], vel: () => [rand(-22, -12), rand(-0.5, 0.8)] });
    // low dust sheets
    const sheets = [];
    for (let i = 0; i < 18; i++) {
      const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.smoke, color: 0xd8c8a6, transparent: true, depthWrite: false, opacity: 0.35 })));
      s.scale.set(rand(20, 34), rand(5, 9), 1); s.position.set(rand(-60, 60), rand(1, 4), rand(-18, 4)); sheets.push(s);
    }
    anims.push((dt, camX) => sheets.forEach((s) => { s.position.x -= dt * 9; if (s.position.x < camX - 70) s.position.x += 140; if (s.position.x > camX + 70) s.position.x -= 140; }));
  }

  if (level.map === 'tunnels') {
    hallShell(tex.panel('#30363a'), tex.concrete(), 0x8a8682, 0xc9a227);
    const pipeMat = std(0x3b3f42, 0.55, 0.75);
    for (const [y, r] of [[1.2, 0.35], [C - 1.2, 0.5]]) { const p = add(cyl(r, r, A * 2 + 30, 10, pipeMat)); p.rotation.z = Math.PI / 2; p.position.set(0, y, -11.5); p.castShadow = false; }
    const water = add(new THREE.Mesh(new THREE.PlaneGeometry(A * 2 + 20, 3), new THREE.MeshStandardMaterial({ color: 0x0e1a1e, roughness: 0.1, metalness: 0.9 })));
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.03, -8);
    const lamps = [];
    for (let x = -A + 6; x < A; x += 14) { const l = new THREE.PointLight(0xffd6a0, 0.9, 20, 2); l.position.set(x, C - 1, -3); add(l); lamps.push(l); }
    anims.push((dt, camX, splash, t) => lamps.forEach((l, i) => { l.intensity = Math.random() < 0.01 ? 0.1 : 0.9 + Math.sin(t * 7 + i) * 0.05; }));
    smokeColumns([[-A * 0.5, -9, 0], [A * 0.4, -9, 0]], { color: 0x9aa6aa, rise: C - 1, grow: 6, speed: 0.1, opacity: 0.25, count: 8, drift: 1 });
    pointField({ count: 140, color: 0xcfe6ee, size: 0.12, additive: true, area: [90, C, 0], zRange: [-8, 6], vel: () => [rand(-0.2, 0.2), rand(-1.2, -0.6)] });
  }

  if (level.map === 'core') {
    hallShell(tex.panel('#2a3338'), tex.metal(), 0x707a80, 0x2c8aa0);
    const cyan = new THREE.MeshBasicMaterial({ color: 0x3fd6ff, toneMapped: false });
    // reactor column behind the arena
    const reactor = add(cyl(7, 7, C + 2, 24, std(0x1c2428, 0.4, 0.8))); reactor.position.set(0, (C + 2) / 2, -22);
    const rings = [];
    for (let y = 2; y < C; y += 3) { const r = add(new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.25, 8, 40), cyan)); r.position.set(0, y, -22); r.rotation.x = Math.PI / 2; rings.push(r); }
    const core = glowSprite(0x3fd6ff, 30, C + 6, 0, C / 2, -15, 0.35);
    anims.push((dt, camX, splash, t) => { core.material.opacity = 0.28 + Math.sin(t * 1.6) * 0.1; rings.forEach((r, i) => { r.scale.setScalar(1 + Math.sin(t * 2 - i * 0.6) * 0.03); }); });
    for (const x of [-A * 0.6, 0, A * 0.6]) { const l = new THREE.PointLight(0x3fd6ff, 1.3, 36, 2); l.position.set(x, 3, -6); add(l); }
    // pipes and floor light strips
    const pipeMat = std(0x37424a, 0.5, 0.8);
    for (const [y, r] of [[3, 0.45], [6.5, 0.7], [C - 3, 0.9]]) { const p = add(cyl(r, r, A * 2 + 30, 12, pipeMat)); p.rotation.z = Math.PI / 2; p.position.set(0, y, -12); p.castShadow = false; }
    for (let x = -A; x <= A; x += 10) { const p = add(cyl(0.3, 0.3, C, 8, pipeMat)); p.position.set(x + 5, C / 2, -12.2); p.castShadow = false; }
    for (const z of [-6, 5]) { const s = add(new THREE.Mesh(new THREE.BoxGeometry(A * 2 + 20, 0.05, 0.25), cyan)); s.position.set(0, 0.03, z); }
    const fg = std(0x101417, 0.9, 0.4);
    for (let x = -A - 10; x < A + 10; x += 9) add(box(rand(2, 4), rand(0.6, 1.4), 1.2, fg, x + rand(-2, 2), 0.4, rand(8, 10)));
    smokeColumns([[-A * 0.7, -9, 0], [-A * 0.25, -9, 0], [A * 0.3, -9, 0], [A * 0.75, -9, 0]], { color: 0xb8d4dc, rise: C - 2, grow: 9, speed: 0.12, opacity: 0.35, count: 9, drift: 2 });
    pointField({ count: 220, color: 0x7fe6ff, size: 0.22, additive: true, area: [110, C, 0], zRange: [-10, 8], vel: () => [rand(-0.5, 0.5), rand(-0.4, 0.6)] });
  }

  scene.add(group);

  let t = 0;
  function update(dt, camX, splash) { t += dt; for (const fn of anims) fn(dt, camX, splash, t); }

  function dispose() {
    scene.remove(group);
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => { ['map', 'emissiveMap'].forEach((k) => m[k] && m[k] !== tex.glow && m[k] !== tex.smoke && m[k].dispose()); m.dispose(); });
    });
    if (scene.background && scene.background.dispose) scene.background.dispose();
  }

  return { group, sun, plats, ladders, blockers, secrets, arena: A, ceiling: C, exposure: T.exposure, update, dispose };
}
