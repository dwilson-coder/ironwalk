import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { events } from '../store/gameStore.js';

let nextId = 0;

// Floating "+150" numbers that rise from each destroyed enemy, projected from 3D to screen space.
export default function ScorePopups() {
  const [items, setItems] = useState([]);

  useEffect(() => events.on('popup', (p) => {
    const id = ++nextId;
    setItems((list) => [...list.slice(-14), { ...p, id }]);
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), 1200);
  }), []);

  return (
    <div className="popups" aria-hidden="true">
      <AnimatePresence>
        {items.map((p) => (
          <motion.div
            key={p.id}
            className={`popup ${p.kind}`}
            style={{ left: p.x, top: p.y, color: p.color }}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -46, scale: p.kind === 'boss' ? 1.8 : p.kind === 'pickup' ? 0.9 : 1 }}
            exit={{ opacity: 0, y: -80, transition: { duration: 0.35 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          >
            {p.text}
            {p.mult > 1 && <small>×{p.mult}</small>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
