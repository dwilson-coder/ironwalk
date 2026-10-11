import { motion } from 'framer-motion';
import { easeOutExpo } from '../ui/motion.jsx';

export default function Leaderboard({ scores, highlightId, limit = 10, delay = 0 }) {
  const rows = scores.slice(0, limit);
  if (!rows.length) {
    return <p className="board-empty">No runs logged yet. Finish a run and your score lands here.</p>;
  }
  return (
    <ol className="board">
      <li className="board-head" aria-hidden="true"><span>#</span><span>Pilot</span><span>Reached</span><span className="r">Score</span></li>
      {rows.map((e, i) => (
        <motion.li
          key={e.id}
          className={e.id === highlightId ? 'me' : undefined}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + i * 0.05, duration: 0.45, ease: easeOutExpo }}
        >
          <span className="rank">{String(i + 1).padStart(2, '0')}</span>
          <span className="pilot">{e.initials}</span>
          <span className="reached">{e.reached || `Wave ${e.wave}`}</span>
          <span className="r score">{e.score.toLocaleString()}</span>
        </motion.li>
      ))}
    </ol>
  );
}
