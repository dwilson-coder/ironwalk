import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { loadScores, loadLifetime } from '../store/scores.js';
import { LEVELS } from '../game/levels.js';
import { Overlay, StaggerWord, fadeUp } from '../ui/motion.jsx';
import FitText from '../ui/FitText.jsx';
import Controls from '../ui/Controls.jsx';
import Leaderboard from './Leaderboard.jsx';

function formatTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function TitleScreen({ engine }) {
  const touch = useGame((s) => s.touch);
  const progress = useGame((s) => s.progress);
  const scores = useMemo(loadScores, []);
  const life = useMemo(loadLifetime, []);
  const cleared = progress.cleared;
  const hover = () => engine.sfx('ui');

  return (
    <Overlay className="title">
      <div className="title-main">
        <motion.div className="eyebrow" variants={fadeUp} initial="hidden" animate="show" custom={0}>
          Side-view mech combat · build 0.7
        </motion.div>
        <FitText as="h1" className="logo"><StaggerWord text="IRONWALK" outlineFrom={4} delay={0.15} /></FitText>
        <motion.p className="lede" variants={fadeUp} initial="hidden" animate="show" custom={2}>
          Four missions through Sector 9: a flooded freight yard, an underground foundry, a salt-flat relay and a reactor 400 m down.
          Refit your frame between sorties and bring down the boss at the end of each one.
        </motion.p>

        <motion.div className="menu" variants={fadeUp} initial="hidden" animate="show" custom={3}>
          <motion.button className="btn" whileHover={{ x: 4 }} whileTap={{ scale: 0.97 }} onMouseEnter={hover} onClick={engine.openMissions} autoFocus>
            Campaign
          </motion.button>
          <button className="btn ghost" onMouseEnter={hover} onClick={() => engine.openPilotSelect({ mode: 'endless' })}>Endless</button>
          <button className="btn ghost" onMouseEnter={hover} onClick={() => engine.openHangar(null)}>Hangar</button>
        </motion.div>

        <motion.div className="campaign-track" variants={fadeUp} initial="hidden" animate="show" custom={4} aria-label={`${cleared} of ${LEVELS.length} missions cleared`}>
          {LEVELS.map((l, i) => (
            <div key={l.id} className={`seg ${i < cleared ? 'done' : i === cleared ? 'next' : ''}`}>
              <i /><span>{l.code}</span>
            </div>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={5}>
          <Controls touch={touch} />
        </motion.div>
      </div>

      <motion.aside className="panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.7 }}>
        <h2 className="panel-title">Top pilots</h2>
        <Leaderboard scores={scores} limit={5} delay={0.7} />
        {life.runs > 0 && (
          <dl className="lifetime">
            <div><dt>Runs</dt><dd>{life.runs}</dd></div>
            <div><dt>Kills</dt><dd>{life.kills.toLocaleString()}</dd></div>
            <div><dt>Cleared</dt><dd>{cleared}/{LEVELS.length}</dd></div>
            <div><dt>Time</dt><dd>{formatTime(life.timePlayed)}</dd></div>
          </dl>
        )}
      </motion.aside>
    </Overlay>
  );
}
