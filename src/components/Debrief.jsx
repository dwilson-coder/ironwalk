// Mission complete: mission stats, boss result, newly unlocked hardware, and what to do next.
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { LEVELS } from '../game/levels.js';
import { CountUp, Overlay, StaggerWord, fadeUp, easeOutExpo } from '../ui/motion.jsx';
import { fmtTime, fmtPct } from './GameOver.jsx';
import ScoreEntry from './ScoreEntry.jsx';

const round = (v) => Math.round(v);

export default function Debrief({ engine }) {
  const d = useGame((s) => s.debrief);
  if (!d) return null;
  const next = d.sideOp ? null : LEVELS[d.levelIndex + 1];

  const stats = [
    ['Mission time', d.time, fmtTime],
    ['Kills', d.kills, round],
    ['Accuracy', d.accuracy, fmtPct],
    ['Caches', d.pickups, round],
    ['Damage taken', d.damageTaken, round],
    ['Secrets found', d.secretsFound, (v) => `${round(v)} / ${d.secretsTotal}`],
    ['Frames lost', d.framesLost, round],
    ['Clear bonus', d.clearBonus, (v) => `+${round(v).toLocaleString()}`],
  ];

  return (
    <Overlay className="debrief">
      <div className="over-main">
        <motion.div className="eyebrow" variants={fadeUp} initial="hidden" animate="show">{d.code} · {d.name}</motion.div>
        <h2 className="h2"><StaggerWord text={d.isFinal ? 'CAMPAIGN CLEAR' : d.sideOp ? 'SIDE OP CLEAR' : 'MISSION CLEAR'} /></h2>

        <motion.div className="final" variants={fadeUp} initial="hidden" animate="show" custom={1}>
          <span className="lbl">Mission score {d.newBest && <em className="best-tag">New best</em>}</span>
          <span className="final-num"><CountUp value={d.missionScore} duration={1.5} delay={0.4} /></span>
          <span className="lbl">Run total · <CountUp value={d.totalScore} duration={1.5} delay={0.5} /></span>
        </motion.div>

        {d.boss && (
          <motion.div className="boss-result" variants={fadeUp} initial="hidden" animate="show" custom={2}>
            <span className="br-name">{d.boss.name}</span>
            <span>destroyed in {fmtTime(d.boss.time)}</span>
            {d.boss.flawless && <span className="flawless">Flawless · +1,500</span>}
          </motion.div>
        )}

        <dl className="statgrid">
          {stats.map(([label, value, fmt], i) => (
            <motion.div key={label} variants={fadeUp} initial="hidden" animate="show" custom={3 + i * 0.4}>
              <dt>{label}</dt>
              <dd><CountUp value={value} format={fmt} delay={0.7 + i * 0.08} /></dd>
            </motion.div>
          ))}
        </dl>

        <motion.div className="btn-row" variants={fadeUp} initial="hidden" animate="show" custom={6}>
          {!d.isFinal && next && <button className="btn" onClick={engine.nextMission} autoFocus>Next: {next.name}</button>}
          {!d.isFinal && next && <button className="btn ghost" onClick={() => engine.openHangar({ mode: 'campaign', levelIndex: d.levelIndex + 1, keepRun: true })}>Refit first</button>}
          {d.sideOp && <button className="btn" onClick={engine.nextMission} autoFocus>Mission select</button>}
          <button className={d.isFinal ? 'btn' : 'btn ghost'} onClick={engine.toTitle}>Main menu</button>
        </motion.div>
      </div>

      <motion.aside className="panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.7, ease: easeOutExpo }}>
        {d.unlocked.length > 0 && (
          <div className="unlocks">
            <h3 className="panel-title signal">New hardware</h3>
            {d.unlocked.map((u, i) => (
              <motion.div key={u.name} className="unlock" initial={{ opacity: 0, x: 30, clipPath: 'inset(0 100% 0 0)' }} animate={{ opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0)' }} transition={{ delay: 1 + i * 0.25, duration: 0.6, ease: easeOutExpo }}>
                <span className="u-kind">{u.kind}</span>
                <b>{u.name}</b>
                <span className="u-type">{u.type}</span>
              </motion.div>
            ))}
          </div>
        )}
        {d.isFinal && d.result ? (
          <ScoreEntry result={d.result} sfx={engine.sfx} />
        ) : (
          <p className="board-empty">{next ? `Next sortie: ${next.code} ${next.name}. ${next.setting} map, ${next.weather.toLowerCase()}.` : d.sideOp ? 'Side ops pay score but do not change campaign progress.' : ''}</p>
        )}
      </motion.aside>
    </Overlay>
  );
}
