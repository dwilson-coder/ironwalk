// Boss entrance: letterbox bars close in, hazard tape slides across and the boss name is revealed.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { easeOutExpo } from '../ui/motion.jsx';

export default function BossIntro() {
  const intro = useGame((s) => s.bossIntro);
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!intro) { setShown(null); return undefined; }
    setShown(intro);
    const t = setTimeout(() => setShown(null), 3000);
    return () => clearTimeout(t);
  }, [intro]);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div key={shown.id} className="boss-intro" aria-live="assertive" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}>
          <motion.div className="lb top" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} transition={{ duration: 0.45, ease: easeOutExpo }} />
          <motion.div className="lb bottom" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} transition={{ duration: 0.45, ease: easeOutExpo }} />
          <div className="bi-center">
            <motion.div className="tape" initial={{ x: '-110%' }} animate={{ x: '0%' }} transition={{ delay: 0.15, duration: 0.6, ease: easeOutExpo }}>
              <span>Warning · large contact · warning · large contact · warning</span>
            </motion.div>
            <motion.div className="bi-name" initial={{ clipPath: 'inset(0 50% 0 50%)', letterSpacing: '0.5em' }} animate={{ clipPath: 'inset(0 0% 0 0%)', letterSpacing: '0.08em' }} transition={{ delay: 0.45, duration: 0.8, ease: easeOutExpo }}>
              {shown.name}
            </motion.div>
            <motion.div className="bi-title" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
              {shown.title}{shown.sub ? ` · ${shown.sub}` : ''}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
