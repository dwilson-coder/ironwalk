import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { easeOutExpo } from '../ui/motion.jsx';

// Wave announcements: a signal-orange bar sweeps across, then the text slides out from behind it.
export default function Banner() {
  const banner = useGame((s) => s.banner);
  const [visible, setVisible] = useState(null);

  useEffect(() => {
    if (!banner) { setVisible(null); return undefined; }
    setVisible(banner);
    const t = setTimeout(() => setVisible(null), banner.ms);
    return () => clearTimeout(t);
  }, [banner]);

  return (
    <div className="banner-wrap" aria-live="polite">
      <AnimatePresence>
        {visible && (
          <motion.div key={visible.id} className="banner" exit={{ opacity: 0, y: -10, transition: { duration: 0.3 } }}>
            {visible.big && (
              <div className="banner-big-wrap">
                <motion.div className="sweep" initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: [0, 1, 1, 0], originX: [0, 0, 1, 1] }} transition={{ duration: 0.7, times: [0, 0.45, 0.55, 1], ease: 'easeInOut' }} />
                <motion.div className="big" initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ delay: 0.32, duration: 0.5, ease: easeOutExpo }}>
                  {visible.big}
                </motion.div>
              </div>
            )}
            <motion.div className="sub" initial={{ opacity: 0, letterSpacing: '0.6em' }} animate={{ opacity: 1, letterSpacing: '0.24em' }} transition={{ delay: visible.big ? 0.55 : 0, duration: 0.6, ease: easeOutExpo }}>
              {visible.sub}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
