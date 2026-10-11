// Pause overlay: Resume, Restart (mission) and Quit (to main menu).
// Restart and Quit lose progress, so each asks for a second click to confirm.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { Overlay, StaggerWord, fadeUp } from '../ui/motion.jsx';
import Controls from '../ui/Controls.jsx';

const CONFIRM = {
  restart: { text: 'Restart this mission from the beginning? Your score goes back to what it was when the mission started.', action: 'Restart mission' },
  quit: { text: 'Quit to the main menu? Progress in this mission is lost. Missions you already cleared stay unlocked.', action: 'Quit to menu' },
};

export default function PauseMenu({ engine }) {
  const muted = useGame((s) => s.muted);
  const minimap = useGame((s) => s.minimap);
  const touch = useGame((s) => s.touch);
  const hud = useGame((s) => s.hud);
  const [confirm, setConfirm] = useState(null);

  // While a confirmation is open, Esc cancels it instead of resuming the game.
  useEffect(() => {
    if (!confirm) return undefined;
    const onKey = (e) => { if (e.code === 'Escape') { e.stopPropagation(); setConfirm(null); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [confirm]);

  const run = () => (confirm === 'restart' ? engine.retryMission() : engine.toTitle());

  return (
    <Overlay className="pause">
      <div className="card">
        <motion.div className="eyebrow" variants={fadeUp} initial="hidden" animate="show">Frame holding position · {hud.mission}</motion.div>
        <h2 className="h2"><StaggerWord text="PAUSED" /></h2>
        <motion.p className="lede" variants={fadeUp} initial="hidden" animate="show" custom={1}>
          {hud.waveLabel} · {hud.score.toLocaleString()} points · {hud.onFoot ? `pilot ${Math.ceil(hud.pilotHp)}/${hud.pilotMaxHp}` : `hull ${Math.ceil(hud.hull)}/${hud.maxHull}`}{hud.lives ? ` · ${hud.lives} extra ${hud.lives > 1 ? "lives" : "life"}` : ""}
        </motion.p>

        <AnimatePresence mode="wait">
          {confirm ? (
            <motion.div key="confirm" className="confirm" role="alertdialog" aria-labelledby="confirm-text" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
              <p id="confirm-text">{CONFIRM[confirm].text}</p>
              <div className="btn-row">
                <button className="btn danger" onClick={run} autoFocus>{CONFIRM[confirm].action}</button>
                <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="menu" className="pause-actions" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
              <div className="btn-row">
                <button className="btn" onClick={() => engine.setPaused(false)} autoFocus>Resume</button>
                <button className="btn ghost" onClick={() => setConfirm('restart')}>Restart</button>
                <button className="btn ghost" onClick={() => setConfirm('quit')}>Quit</button>
              </div>
              <div className="pause-toggles">
                <button className="toggle" aria-pressed={minimap} onClick={engine.toggleMinimap}>Mini map <b>{minimap ? 'On' : 'Off'}</b>{!touch && <kbd>M</kbd>}</button>
                <button className="toggle" aria-pressed={!muted} onClick={engine.toggleMute}>Sound <b>{muted ? 'Off' : 'On'}</b>{!touch && <kbd>N</kbd>}</button>
              </div>
              {!touch && <p className="hint">Press <kbd>P</kbd> or <kbd>Esc</kbd> to resume</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={2}><Controls touch={touch} /></motion.div>
      </div>
    </Overlay>
  );
}
