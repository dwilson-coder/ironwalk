import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { easeOutExpo } from '../ui/motion.jsx';
import FitText from '../ui/FitText.jsx';

const TIPS = [
  'Slam down with S to knock crawlers off balance.',
  'Seeker rockets home in on whatever is closest to your reticle.',
  'Weapons caches sit on the catwalks. The high ground pays.',
  'Bosses change their pattern at half health. Watch the notch on the boss bar.',
  'Clearing missions unlocks new frames and weapons in the hangar.',
  'Chain kills within three seconds to raise your score multiplier.',
  'The chaingun vents when heat hits 100. Feather the trigger.',
  'A dash makes you briefly untouchable. Use it through a walker charge.',
  'Clearing a wave repairs 25 hull and pays a bonus.',
];

// Blueprint of the Warden-7, drawn stroke by stroke while the engine boots.
const SCHEMATIC = [
  { d: 'M70 60 H150 L172 72 V100 L150 112 H70 Z', w: 2 }, // torso + cockpit
  { d: 'M48 56 H70 V114 H48 Z', w: 2 }, // reactor pack
  { d: 'M60 38 H114 V58 H60 Z', w: 2 }, // rocket pod
  { d: 'M118 84 H210 V98 H118 Z', w: 2 }, // gun housing
  { d: 'M210 87 H236 M210 92 H236 M210 96 H236', w: 1.4 }, // barrels
  { d: 'M84 112 H128 V124 H84 Z', w: 2 }, // pelvis
  { d: 'M102 124 L122 154 L104 184 M96 188 H132', w: 2.4 }, // near leg
  { d: 'M112 124 L130 152 L116 184 M110 188 H142', w: 1.4, dim: true }, // far leg
  { d: 'M78 38 V18', w: 1.2 }, // antenna
  { d: 'M48 98 L38 112 M56 98 L46 112', w: 1.2, dim: true }, // jet nozzles
  { d: 'M152 78 L168 82', w: 3, glow: true }, // visor
];

function Schematic() {
  return (
    <svg className="schematic" viewBox="0 0 260 210" role="img" aria-label="Warden-7 frame schematic">
      <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth=".6" />
        </pattern>
      </defs>
      <rect width="260" height="210" fill="url(#grid)" />
      <motion.path d="M16 190 H244" stroke="currentColor" strokeOpacity=".35" strokeDasharray="3 4" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
      {SCHEMATIC.map((p, i) => (
        <motion.path
          key={i}
          d={p.d}
          fill="none"
          stroke={p.glow ? 'var(--signal)' : 'currentColor'}
          strokeOpacity={p.dim ? 0.45 : 1}
          strokeWidth={p.w}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.12, duration: 0.9, ease: 'easeInOut' }}
        />
      ))}
      {/* dimension callouts */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.6 }} className="callouts">
        <path d="M250 18 V188 M246 18 H254 M246 188 H254" stroke="var(--signal)" strokeWidth="1" fill="none" />
        <text x="244" y="108" textAnchor="end">4.8 m</text>
        <path d="M118 104 L118 116 L186 116" stroke="currentColor" strokeOpacity=".5" fill="none" />
        <text x="190" y="119">M-40 rotary</text>
        <path d="M86 38 L86 26 L130 26" stroke="currentColor" strokeOpacity=".5" fill="none" />
        <text x="134" y="29">4× seeker pod</text>
        <text x="16" y="204">WARDEN-7 · SALVAGE FRAME · 40 t</text>
      </motion.g>
      {/* scanning line */}
      <motion.rect x="0" width="260" height="2" fill="var(--cool)" opacity=".5"
        initial={{ y: 0 }} animate={{ y: [0, 208, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }} />
    </svg>
  );
}

export default function LoadingScreen() {
  const load = useGame((s) => s.load);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  const pct = useSpring(0, { stiffness: 55, damping: 18 });
  const width = useTransform(pct, (v) => `${v}%`);
  const label = useTransform(pct, (v) => String(Math.round(v)).padStart(3, '0'));

  useEffect(() => { pct.set(load.progress * 100); }, [load.progress, pct]);
  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      className="loading"
      initial={{ opacity: 1 }}
      exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.8, ease: easeOutExpo } }}
      role="status"
      aria-live="polite"
    >
      <div className="loading-grid">
        <Schematic />
        <div className="loading-copy">
          <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            Sector 9 uplink · establishing frame link
          </motion.div>
          <FitText as={motion.h1} className="loading-title" initial={{ opacity: 0, letterSpacing: '0.4em' }} animate={{ opacity: 1, letterSpacing: '0.02em' }} transition={{ duration: 1.2, ease: easeOutExpo }}>
            IRONWALK
          </FitText>

          <ol className="bootlog">
            <AnimatePresence initial={false}>
              {load.log.map((line, i) => {
                const done = i < load.log.length - 1 || load.done;
                return (
                  <motion.li key={line} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
                    <span className={done ? 'ok' : 'busy'}>{done ? 'OK' : '··'}</span>
                    {line}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>

          <div className="loadbar" aria-hidden="true">
            <motion.i style={{ width }} />
          </div>
          <div className="loadmeta">
            <span>{load.error ? 'Boot failed' : load.done ? 'Frame ready' : load.stage}</span>
            <span className="pct"><motion.span>{label}</motion.span>%</span>
          </div>
          {load.error && <p className="error">{load.error}</p>}

          <div className="tip">
            <span className="tip-label">Field note</span>
            <AnimatePresence mode="wait">
              <motion.span key={tip} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
                {TIPS[tip]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
