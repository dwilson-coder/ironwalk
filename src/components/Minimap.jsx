// Mini map: a side-on strip of the whole mission lane. Toggle with M or the HUD MAP button.
// Draws to a <canvas> at ~20 fps straight from engine.getMinimap(), so React doesn't re-render for it.
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const FPS = 20;

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return { hull: v('--hull', '#e2d8c3'), dim: v('--dim', '#8a969b'), signal: v('--signal', '#ff8a2a'), threat: v('--threat', '#ff4136'), cool: v('--cool', '#7fd6e2') };
}

export default function Minimap({ engine }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas.getContext('2d');
    const C = readColors();
    let raf = 0, last = 0;

    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 1000 / FPS) return;
      last = now;
      const m = engine.getMinimap();
      if (!m.active) return;

      // keep the backing store sharp on high-DPI screens
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const pad = 4, top = m.ceiling || 24;
      const sx = (x) => pad + ((x + m.arena) / (2 * m.arena)) * (w - pad * 2);
      const sy = (y) => h - pad - (Math.min(y, top) / top) * (h - pad * 2);

      // camera view window
      const vx0 = sx(Math.max(-m.arena, m.camX - m.viewHalf)), vx1 = sx(Math.min(m.arena, m.camX + m.viewHalf));
      g.fillStyle = 'rgba(226,216,195,0.06)'; g.fillRect(vx0, pad, vx1 - vx0, h - pad * 2);
      g.strokeStyle = 'rgba(226,216,195,0.3)'; g.lineWidth = 1; g.strokeRect(vx0 + 0.5, pad + 0.5, vx1 - vx0 - 1, h - pad * 2 - 1);

      // ground, ceiling, arena edges
      g.strokeStyle = C.dim; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(pad, sy(0)); g.lineTo(w - pad, sy(0)); g.stroke();
      if (m.ceiling) { g.beginPath(); g.moveTo(pad, sy(m.ceiling)); g.lineTo(w - pad, sy(m.ceiling)); g.stroke(); }
      g.strokeStyle = C.threat; g.setLineDash([2, 2]);
      g.beginPath(); g.moveTo(pad + 0.5, pad); g.lineTo(pad + 0.5, h - pad); g.moveTo(w - pad - 0.5, pad); g.lineTo(w - pad - 0.5, h - pad); g.stroke();
      g.setLineDash([]);

      // ladders (pilot routes)
      g.strokeStyle = 'rgba(176,138,58,0.55)'; g.lineWidth = 1;
      for (const l of m.ladders) { g.beginPath(); g.moveTo(sx(l.x) + 0.5, sy(l.y0)); g.lineTo(sx(l.x) + 0.5, sy(l.y1)); g.stroke(); }

      // catwalks; pilot-only ledges dashed
      g.lineWidth = 2;
      for (const p of m.plats) {
        g.strokeStyle = p.pilotOnly ? C.cool : 'rgba(226,216,195,0.55)';
        g.setLineDash(p.pilotOnly ? [3, 2] : []);
        g.beginPath(); g.moveTo(sx(p.x - p.w / 2), sy(p.top)); g.lineTo(sx(p.x + p.w / 2), sy(p.top)); g.stroke();
      }
      g.setLineDash([]);

      // secret areas: "?" until found
      g.font = '600 9px ui-monospace, monospace'; g.textAlign = 'center';
      for (const sc of m.secrets) {
        g.fillStyle = sc.found ? C.dim : C.cool;
        g.fillText(sc.found ? '✓' : '?', sx((sc.x0 + sc.x1) / 2), sy(sc.y0 + 0.4) - 2);
      }

      // pickups (diamonds)
      for (const it of m.pickups) {
        const x = sx(it.x), y = sy(it.y + 0.5);
        const r = it.pilotOnly ? 2.6 : 3.5;
        g.fillStyle = it.color; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill();
      }

      // enemies: drones = dots, crawlers = squares, boss = pulsing ring
      for (const e of m.enemies) {
        const x = sx(e.x), y = sy(e.y);
        g.fillStyle = C.threat;
        if (e.boss) {
          const r = 5 + Math.sin(m.time * 6) * 1.2;
          g.strokeStyle = C.threat; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
        } else if (e.type === 'crawler') g.fillRect(x - 2.5, y - 2.5, 5, 5);
        else { g.beginPath(); g.arc(x, y, 2.3, 0, Math.PI * 2); g.fill(); }
      }

      // parked / incoming frame while you're on foot: hollow triangle (blinks while dropping in)
      if (m.mech && (m.mech.mode === 'parked' || Math.sin(m.time * 10) > 0)) {
        const x = sx(m.mech.x), y = sy(m.mech.y + 2.4);
        g.strokeStyle = C.signal; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4.5, y + 4); g.lineTo(x - 4.5, y + 4); g.closePath(); g.stroke();
      }

      // player: triangle pointing the way the mech faces, or a smaller one for the pilot on foot
      if (!m.dead) {
        const k = m.onFoot ? 0.65 : 1;
        const x = sx(m.px), y = sy(m.py + (m.onFoot ? 1 : 2.4)), f = m.face;
        g.fillStyle = m.onFoot ? C.hull : C.signal; g.beginPath(); g.moveTo(x + 6 * f * k, y); g.lineTo(x - 4 * f * k, y - 4.5 * k); g.lineTo(x - 4 * f * k, y + 4.5 * k); g.closePath(); g.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return (
    // opacity-only animation: on touch screens the panel is centred with a CSS transform that a y-animation would overwrite
    <motion.div className="minimap" role="img" aria-label="Mini map of the mission lane" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="minimap-head"><span>Tactical</span><span><kbd>M</kbd> hide</span></div>
      <canvas ref={canvasRef} />
    </motion.div>
  );
}
