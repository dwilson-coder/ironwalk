// Initials entry for a qualifying run, then the leaderboard with the new row highlighted.
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { loadScores, qualifies, saveScore } from '../store/scores.js';
import Leaderboard from './Leaderboard.jsx';

export default function ScoreEntry({ result, sfx }) {
  const canLog = useMemo(() => qualifies(result.score), [result]);
  const [initials, setInitials] = useState(() => { try { return localStorage.getItem('ironwalk.initials') || ''; } catch { return ''; } });
  const [saved, setSaved] = useState(null);
  const scores = saved ? saved.list : loadScores();

  const submit = (e) => {
    e.preventDefault();
    const tag = (initials.trim() || 'ACE').toUpperCase().slice(0, 3);
    try { localStorage.setItem('ironwalk.initials', tag); } catch { /* ignore */ }
    setSaved(saveScore({ initials: tag, score: result.score, wave: result.wave, kills: result.totalKills, accuracy: result.accuracy, reached: result.reached, mode: result.mode }));
    sfx('clear');
  };

  return (
    <AnimatePresence mode="wait">
      {canLog && !saved ? (
        <motion.form key="entry" className="entry" onSubmit={submit} exit={{ opacity: 0, y: -10 }}>
          <h3 className="panel-title signal">New high score</h3>
          <label htmlFor="initials">Pilot initials</label>
          <div className="entry-row">
            <input
              id="initials"
              value={initials}
              onChange={(e) => setInitials(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3))}
              maxLength={3} autoComplete="off" spellCheck="false" autoFocus placeholder="ACE"
            />
            <button className="btn small" type="submit">Log score</button>
          </div>
        </motion.form>
      ) : (
        <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="panel-title">{saved ? `Logged at rank ${saved.rank}` : 'Top pilots'}</h3>
          <Leaderboard scores={scores} highlightId={saved?.id} delay={0.1} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
