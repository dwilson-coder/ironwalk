import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { CountUp, Overlay, StaggerWord, fadeUp, easeOutExpo } from '../ui/motion.jsx';
import ScoreEntry from './ScoreEntry.jsx';

export const fmtTime = (v) => { const s = Math.round(v); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const fmtPct = (v) => `${Math.round(v * 100)}%`;
const round = (v) => Math.round(v);

export default function GameOver({ engine }) {
  const r = useGame((s) => s.result);
  if (!r) return null;

  const stats = [
    ['Reached', null, null, r.reached],
    ['Kills', r.totalKills, round],
    ['Accuracy', r.accuracy, fmtPct],
    ['Best chain', r.maxCombo, round],
    ['Survived', r.time, fmtTime],
    ['Caches', r.pickups, round],
  ];
  const breakdown = [['Drones', r.kills.drone || 0, 'drone'], ['Crawlers', r.kills.crawler || 0, 'crawler'], ['Bosses', r.kills.boss || 0, 'walker']];
  const maxKills = Math.max(1, ...breakdown.map((b) => b[1]));

  return (
    <Overlay className="over">
      <div className="over-main">
        <motion.div className="eyebrow" variants={fadeUp} initial="hidden" animate="show">Telemetry lost · {r.missionName}</motion.div>
        <h2 className="h2"><StaggerWord text="FRAME DOWN" /></h2>

        <motion.div className="final" variants={fadeUp} initial="hidden" animate="show" custom={1}>
          <span className="lbl">Final score</span>
          <span className="final-num"><CountUp value={r.score} duration={1.6} delay={0.4} /></span>
        </motion.div>

        <dl className="statgrid">
          {stats.map(([label, value, fmt, text], i) => (
            <motion.div key={label} variants={fadeUp} initial="hidden" animate="show" custom={2 + i * 0.5}>
              <dt>{label}</dt>
              <dd>{text ?? <CountUp value={value} format={fmt} delay={0.6 + i * 0.08} />}</dd>
            </motion.div>
          ))}
        </dl>

        <div className="breakdown">
          {breakdown.map(([label, n, kind], i) => (
            <div key={label} className="brow">
              <span>{label}</span>
              <div className="bar"><motion.i className={kind} initial={{ scaleX: 0 }} animate={{ scaleX: n / maxKills }} transition={{ delay: 0.9 + i * 0.1, duration: 0.8, ease: easeOutExpo }} /></div>
              <b>{n}</b>
            </div>
          ))}
        </div>

        <motion.div className="btn-row" variants={fadeUp} initial="hidden" animate="show" custom={6}>
          <button className="btn" onClick={engine.retryMission}>Retry mission</button>
          <button className="btn ghost" onClick={engine.toTitle}>Main menu</button>
        </motion.div>
      </div>

      <motion.aside className="panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.7, ease: easeOutExpo }}>
        <ScoreEntry result={r} sfx={engine.sfx} />
        <p className="lifetime-line">Career: {r.lifetime.runs} runs · {r.lifetime.kills.toLocaleString()} kills</p>
      </motion.aside>
    </Overlay>
  );
}
