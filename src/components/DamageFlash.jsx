import { useEffect } from 'react';
import { useAnimate } from 'framer-motion';
import { events } from '../store/gameStore.js';

// Red edge vignette when the frame takes a hit; heavier hits flash harder.
export default function DamageFlash() {
  const [scope, animate] = useAnimate();
  useEffect(() => events.on('hurt', ({ amount }) => {
    if (!scope.current) return;
    const peak = Math.min(1, 0.45 + amount / 30);
    animate(scope.current, { opacity: [peak, 0] }, { duration: 0.45, ease: 'easeOut' });
  }), [animate, scope]);
  return <div ref={scope} className="damage" aria-hidden="true" />;
}
