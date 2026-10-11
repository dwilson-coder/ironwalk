import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { LEVELS, SIDE_OPS } from '../game/levels.js';
import { BOSSES } from '../game/bosses.js';
import { Overlay, StaggerWord, fadeUp, easeOutExpo } from '../ui/motion.jsx';

const skyCss = (stops) => `linear-gradient(180deg, ${stops.map(([at, c]) => `${c} ${Math.round(at * 100)}%`).join(', ')})`;

export default function MissionSelect({ engine }) {
  const { cleared, best } = useGame((s) => s.progress);

  return (
    <Overlay className="missions">
      <div className="missions-wrap">
        <div className="missions-head">
          <motion.div className="eyebrow" variants={fadeUp} initial="hidden" animate="show">Campaign · Sector 9</motion.div>
          <h2 className="h2"><StaggerWord text="MISSIONS" /></h2>
        </div>

        <div className="mission-grid">
          {LEVELS.map((l, i) => {
            const locked = i > cleared;
            const done = i < cleared;
            return (
              <motion.button
                key={l.id}
                className={`mission-card ${locked ? 'locked' : ''} ${done ? 'done' : ''}`}
                disabled={locked}
                onClick={() => engine.openPilotSelect({ mode: 'campaign', levelIndex: i })}
                onMouseEnter={() => !locked && engine.sfx('ui')}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.09, duration: 0.6, ease: easeOutExpo }}
                whileHover={locked ? undefined : { y: -6 }}
                autoFocus={i === Math.min(cleared, LEVELS.length - 1)}
              >
                <div className="mc-sky" style={{ background: skyCss(l.theme.sky) }}>
                  <span className="mc-code">{l.code}</span>
                  <span className={`mc-tag ${l.setting === 'Indoor' ? 'in' : 'out'}`}>{l.setting}</span>
                  {done && <span className="mc-done">Cleared</span>}
                </div>
                <div className="mc-body">
                  <h3>{l.name}</h3>
                  <p className="mc-loc">{l.location}</p>
                  <dl>
                    <div><dt>Conditions</dt><dd>{l.weather} · {l.time}</dd></div>
                    <div><dt>Waves</dt><dd>{l.waves.length} + boss</dd></div>
                    <div><dt>Boss</dt><dd className="boss-name">{BOSSES[l.boss].name}</dd></div>
                    <div><dt>Best</dt><dd>{best[l.id] ? best[l.id].toLocaleString() : '—'}</dd></div>
                  </dl>
                </div>
                {locked && <div className="mc-lock"><span>Clear {LEVELS[i - 1].code} to unlock</span></div>}
              </motion.button>
            );
          })}
        </div>

        {/* Side ops: optional pilot-only missions, fought on foot */}
        <div className="sideops">
          <div className="sideops-head">
            <h3 className="opt-title">Side ops</h3>
            <span className="hint">Pilot only · no frame · don't affect campaign progress</span>
          </div>
          {SIDE_OPS.map((l, i) => {
            const locked = cleared < l.unlock;
            return (
              <motion.button
                key={l.id}
                className={`sideop-card ${locked ? 'locked' : ''}`}
                disabled={locked}
                onClick={() => engine.openPilotSelect({ mode: 'sideop', levelId: l.id })}
                onMouseEnter={() => !locked && engine.sfx('ui')}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.09, duration: 0.6, ease: easeOutExpo }}
                whileHover={locked ? undefined : { y: -4 }}
              >
                <div className="so-sky" style={{ background: skyCss(l.theme.sky) }}>
                  <span className="mc-code">{l.code}</span>
                  <span className="mc-tag foot">On foot</span>
                </div>
                <div className="so-body">
                  <h3>{l.name}</h3>
                  <p className="mc-loc">{l.location}</p>
                  <p className="so-brief">{l.waves.length} waves · {l.secrets.length} secret areas · best {best[l.id] ? best[l.id].toLocaleString() : '—'}</p>
                </div>
                {locked && <div className="mc-lock"><span>Clear {LEVELS[l.unlock - 1].code} to unlock</span></div>}
              </motion.button>
            );
          })}
        </div>

        <motion.div className="btn-row" variants={fadeUp} initial="hidden" animate="show" custom={5}>
          <button className="btn ghost" onClick={engine.toTitle}>Back</button>
        </motion.div>
      </div>
    </Overlay>
  );
}
