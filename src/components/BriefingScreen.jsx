// Mission loading screen: briefing, objectives, threat list and a tactical map that draws itself
// while the engine builds the level. Deploy unlocks once the level is ready.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { resolveLevel } from '../game/levels.js';
import { BOSSES } from '../game/bosses.js';
import { PICKUPS } from '../game/config.js';
import { StaggerWord, easeOutExpo } from '../ui/motion.jsx';

const MIN_BRIEF_MS = 2400;

function MissionMap({ level }) {
  const A = level.arena, C = level.ceiling, W = 440, G = 150, K = 5.2;
  const sx = (x) => 20 + ((x + A) / (2 * A)) * (W - 40);
  const sy = (h) => G - h * K;
  const ticks = [];
  for (let m = -Math.floor(A / 40) * 40; m <= A; m += 40) ticks.push(m);
  const bossX = sx(A * 0.55), deployX = sx(-A * 0.35);
  const secrets = level.secrets || [];
  const draw = (i, extra = {}) => ({ initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { delay: 0.3 + i * 0.08, duration: 0.8, ease: 'easeInOut' }, ...extra });

  return (
    <svg className="tacmap" viewBox={`0 0 ${W} 190`} role="img" aria-label={`Tactical map of ${level.name}`}>
      <defs>
        <pattern id="tgrid" width="11" height="11" patternUnits="userSpaceOnUse"><path d="M11 0H0V11" fill="none" stroke="currentColor" strokeOpacity=".07" strokeWidth=".6" /></pattern>
      </defs>
      <rect width={W} height="190" fill="url(#tgrid)" />
      {/* terrain contours (outdoor) or structural bays (indoor) */}
      {!C && [0, 1, 2, 3].map((i) => (
        <motion.path key={`c${i}`} d={`M10 ${40 + i * 18} C 90 ${30 + i * 18 + (i % 2 ? 12 : -8)}, 180 ${52 + i * 16}, 260 ${38 + i * 18} S 400 ${46 + i * 17}, 430 ${36 + i * 18}`} fill="none" stroke="currentColor" strokeOpacity=".18" {...draw(i)} />
      ))}
      {C && (
        <>
          <motion.path d={`M20 ${sy(C)} H${W - 20}`} stroke="currentColor" strokeWidth="2" fill="none" {...draw(0)} />
          {ticks.map((m, i) => <motion.path key={`bay${m}`} d={`M${sx(m)} ${sy(C)} V${G}`} stroke="currentColor" strokeOpacity=".12" fill="none" {...draw(i * 0.3)} />)}
          <text x="24" y={sy(C) - 5} className="tm-label">CEILING {C} m</text>
        </>
      )}
      <motion.path d={`M20 ${G} H${W - 20}`} stroke="currentColor" strokeWidth="2" fill="none" {...draw(1)} />
      {[-1, 1].map((s) => <motion.path key={s} d={`M${s < 0 ? 20 : W - 20} ${G + 6} V${C ? sy(C) : 40}`} stroke="var(--threat)" strokeDasharray="3 3" fill="none" {...draw(2)} />)}
      {level.platforms.map(([x, h, w], i) => (
        <g key={i}>
          <motion.path d={`M${sx(x - w / 2)} ${sy(h)} H${sx(x + w / 2)}`} stroke="var(--hull)" strokeWidth="3" fill="none" {...draw(3 + i)} />
          <motion.path d={C ? `M${sx(x)} ${sy(h)} V${sy(C)}` : `M${sx(x)} ${sy(h)} V${G}`} stroke="currentColor" strokeOpacity=".3" fill="none" {...draw(3 + i)} />
        </g>
      ))}
      {/* pilot routes: rooftop ledges with their ladder, and crawlspaces marked with "?" */}
      {secrets.map((s, i) => (
        <motion.g key={`s${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 + i * 0.15 }}>
          {s.type === 'rooftop' ? (
            <>
              <path d={`M${sx(s.x - s.w / 2)} ${sy(s.h)} H${sx(s.x + s.w / 2)}`} stroke="var(--cool)" strokeWidth="2" strokeDasharray="4 2" fill="none" />
              <path d={`M${sx(s.ladderX)} ${G} V${sy(s.h)}`} stroke="var(--cool)" strokeOpacity=".7" strokeDasharray="1 2" fill="none" />
              <text x={sx(s.x)} y={sy(s.h) - 5} textAnchor="middle" className="tm-label cool">?</text>
            </>
          ) : (
            <>
              <rect x={sx(s.x - s.w / 2)} y={sy(2.6)} width={sx(s.x + s.w / 2) - sx(s.x - s.w / 2)} height={G - sy(2.6)} fill="none" stroke="var(--cool)" strokeDasharray="3 2" />
              <text x={sx(s.x)} y={G - 3} textAnchor="middle" className="tm-label cool">?</text>
            </>
          )}
        </motion.g>
      ))}
      {level.caches.map(([x, y, type], i) => (
        <motion.rect key={`k${i}`} x={sx(x) - 4} y={sy(y) - 12} width="8" height="8" transform={`rotate(45 ${sx(x)} ${sy(y) - 8})`} fill={PICKUPS[type].css}
          initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} transition={{ delay: 1.2 + i * 0.15, duration: 0.5 }} />
      ))}
      <motion.g initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
        <path d={`M${deployX - 6} ${G - 2} L${deployX} ${G - 12} L${deployX + 6} ${G - 2} Z`} fill="var(--cool)" />
        <text x={deployX} y={G + 16} textAnchor="middle" className="tm-label cool">{level.pilotOnly ? 'INSERT' : 'DEPLOY'}</text>
      </motion.g>
      {(level.boss || level.bossEvery) && <motion.g initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.4, 1] }} transition={{ delay: 1.4, duration: 1.2 }}>
        <circle cx={bossX} cy={G - 18} r="9" fill="none" stroke="var(--threat)" strokeWidth="2" />
        <circle cx={bossX} cy={G - 18} r="3" fill="var(--threat)" />
        <text x={bossX} y={G + 16} textAnchor="middle" className="tm-label threat">{level.boss ? BOSSES[level.boss].name : 'BOSSES'}</text>
      </motion.g>}
      {ticks.map((m) => <text key={`t${m}`} x={sx(m)} y="184" textAnchor="middle" className="tm-tick">{m} m</text>)}
      <motion.rect x="0" width="2" height="190" fill="var(--cool)" opacity=".5" initial={{ x: 0 }} animate={{ x: [0, W, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} />
    </svg>
  );
}

export default function BriefingScreen({ engine }) {
  const b = useGame((s) => s.briefing);
  const [minDone, setMinDone] = useState(false);
  const pct = useSpring(0, { stiffness: 60, damping: 18 });
  const width = useTransform(pct, (v) => `${v}%`);
  const label = useTransform(pct, (v) => String(Math.round(v)).padStart(3, '0'));
  useEffect(() => { const t = setTimeout(() => setMinDone(true), MIN_BRIEF_MS); return () => clearTimeout(t); }, []);
  useEffect(() => { if (b) pct.set(b.progress * 100); }, [b, pct]);
  const ready = b?.ready && minDone;
  useEffect(() => {
    if (!ready) return undefined;
    const key = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); engine.deploy(); } };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [ready, engine]);
  if (!b) return null;

  const level = resolveLevel(b);
  const secretsLine = level.secrets?.length ? `Optional: find ${level.secrets.length} pilot-only secret areas (marked ?)` : null;
  const objectives = (level.pilotOnly
    ? [`Clear ${level.waves.length} hostile waves on foot`, 'No frame support: climb, roll and use cover', 'Collect weapons caches along the gantries', secretsLine]
    : level.waves
      ? [`Clear ${level.waves.length} hostile waves`, `Destroy ${BOSSES[level.boss].name}, ${BOSSES[level.boss].title.toLowerCase()}`, 'Collect weapons caches on the catwalks', secretsLine]
      : ['Survive as many waves as you can', 'A boss drops in every fifth wave', 'Supply drops land at the start of each wave']).filter(Boolean);
  const threats = level.waves
    ? [['Drones', level.waves.reduce((s, w) => s + w.drone, 0)], ['Crawlers', level.waves.reduce((s, w) => s + w.crawler, 0)], ['Boss', level.boss ? BOSSES[level.boss].name : 'None']]
    : [['Drones', '∞'], ['Crawlers', '∞'], ['Bosses', 'Rotating']];

  return (
    <motion.section className="briefing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.7, ease: easeOutExpo } }}>
      <div className="brief-grid">
        <div className="brief-copy">
          <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Mission briefing · {level.code}</motion.div>
          <h2 className="brief-title"><StaggerWord text={level.name.toUpperCase()} delay={0.1} /></h2>
          <motion.div className="chips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <span className={`chip ${level.setting === 'Indoor' ? 'in' : 'out'}`}>{level.setting}</span>
            <span className="chip">{level.weather}</span>
            <span className="chip">{level.time}</span>
            <span className="chip">{level.location}</span>
          </motion.div>
          <motion.p className="lede" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>{level.brief}</motion.p>
          <div className="brief-cols">
            <div>
              <h3 className="opt-title">Objectives</h3>
              <ol className="objectives">
                {objectives.map((o, i) => (
                  <motion.li key={o} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.12 }}>{o}</motion.li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="opt-title">Expected contact</h3>
              <dl className="threats">
                {threats.map(([k, v], i) => (
                  <motion.div key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 + i * 0.1 }}><dt>{k}</dt><dd className={k.startsWith('Boss') ? 'threat' : ''}>{v}</dd></motion.div>
                ))}
              </dl>
            </div>
          </div>
          <motion.p className="intel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}><span>Intel</span>{level.intel}</motion.p>
        </div>

        <div className="brief-side">
          <MissionMap level={level} />
          <div className="loadbar" aria-hidden="true"><motion.i style={{ width }} /></div>
          <div className="loadmeta">
            <AnimatePresence mode="wait">
              <motion.span key={ready ? 'ready' : b.stage} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                {ready ? (level.pilotOnly ? 'Pilot at the insertion point' : 'Frame on the drop rail') : b.stage}
              </motion.span>
            </AnimatePresence>
            <span className="pct"><motion.span>{label}</motion.span>%</span>
          </div>
          <motion.button
            className={`btn deploy ${ready ? 'live' : ''}`}
            disabled={!ready}
            onClick={engine.deploy}
            animate={ready ? { boxShadow: ['0 0 0 0 rgba(255,138,42,.6)', '0 0 0 14px rgba(255,138,42,0)'] } : {}}
            transition={ready ? { duration: 1.2, repeat: Infinity } : {}}
          >
            {ready ? 'Deploy' : 'Loading'}
          </motion.button>
          {ready && <span className="fine-print">Press Enter or Space</span>}
        </div>
      </div>
    </motion.section>
  );
}
