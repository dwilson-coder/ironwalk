// All textures are generated at load time on <canvas>, so the game ships with zero image assets.
// Swap any of these for real PBR textures (e.g. from ambientCG / Quixel) when you move to production art.
import * as THREE from 'three';
import { TAU, rand, pick } from './util.js';

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  return t;
}
const repeat = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

function noise(g, w, h, n, base, alpha) {
  for (let i = 0; i < n; i++) {
    const v = rand(base - 28, base + 28) | 0;
    g.fillStyle = `rgba(${v},${v - 4},${v - 8},${alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, rand(1, 3), rand(1, 3));
  }
}

export function createTextures() {
  const sky = (stops) => canvasTex(4, 512, (g, w, h) => {
    const r = g.createLinearGradient(0, 0, 0, h);
    stops.forEach(([at, c]) => r.addColorStop(at, c));
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });

  const glow = canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.22, 'rgba(255,255,255,.65)');
    r.addColorStop(0.55, 'rgba(255,255,255,.15)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  }, false);

  const smoke = canvasTex(128, 128, (g) => {
    for (let i = 0; i < 14; i++) {
      const x = 64 + rand(-22, 22), y = 64 + rand(-22, 22), rr = rand(18, 40);
      const r = g.createRadialGradient(x, y, 0, x, y, rr);
      r.addColorStop(0, 'rgba(255,255,255,.22)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    }
  }, false);

  const scorch = canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(8,6,5,.9)'); r.addColorStop(0.5, 'rgba(10,8,6,.55)'); r.addColorStop(1, 'rgba(10,8,6,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  }, false);

  const concrete = () => repeat(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4b4744'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 9000, 68, 0.35);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(20,16,14,${rand(0.08, 0.25)})`;
      g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(10, 50), rand(6, 26), rand(0, 3), 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(18,15,13,.7)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    g.lineWidth = 1.2;
    for (let c = 0; c < 5; c++) {
      let x = rand(0, w), y = rand(0, h);
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 12; s++) { x += rand(-12, 12); y += rand(-12, 12); g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(200,150,40,.35)';
    for (let y = 10; y < h; y += 64) g.fillRect(0, y, w, 5);
  }));

  // diamond-plate steel floor for indoor maps
  const metal = () => repeat(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3c3e40'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 6000, 70, 0.25);
    g.fillStyle = 'rgba(160,165,170,.18)';
    for (let y = 8; y < h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) {
      g.save(); g.translate(x, y); g.rotate(0.6); g.fillRect(-5, -1.2, 10, 2.4); g.restore();
    }
    g.strokeStyle = 'rgba(10,10,10,.6)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(90,50,20,${rand(0.08, 0.2)})`; g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(8, 40), rand(5, 18), rand(0, 3), 0, TAU); g.fill(); }
  }));

  // cracked salt crust for the flats
  const salt = () => repeat(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d8ccb4'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 7000, 205, 0.3);
    g.strokeStyle = 'rgba(140,120,95,.55)'; g.lineWidth = 1.4;
    for (let c = 0; c < 26; c++) {
      let x = rand(0, w), y = rand(0, h);
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += rand(-22, 22); y += rand(-22, 22); g.lineTo(x, y); }
      g.stroke();
    }
  }));

  // riveted wall panels for indoor back walls
  const panel = (tint) => repeat(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    noise(g, w, h, 5000, 60, 0.25);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = 'rgba(200,200,200,.25)';
    for (let x = 6; x < w; x += 128) for (let y = 6; y < h; y += 64) { g.fillRect(x, y, 3, 3); g.fillRect(x + 116, y, 3, 3); g.fillRect(x, y + 52, 3, 3); g.fillRect(x + 116, y + 52, 3, 3); }
    g.fillStyle = 'rgba(210,160,40,.3)'; g.fillRect(0, h - 22, w, 8);
  }));

  const windows = (lit) => canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#121518'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 11) for (let x = 6; x < w; x += 16) {
      const r = Math.random();
      g.fillStyle = r < lit ? pick(['#ffb35c', '#ffcf8a', '#ff9a40']) : r < lit * 1.4 ? '#3a4a52' : '#0b0d0f';
      g.fillRect(x, y, 9, 6);
    }
  });

  return { sky, glow, smoke, scorch, concrete, metal, salt, panel, windows };
}
