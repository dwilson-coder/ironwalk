import { useEffect, useRef } from 'react';
import { useGame } from '../store/gameStore.js';

// Custom crosshair. Position is written straight to the DOM on pointermove (no React re-render).
export default function Reticle() {
  const ref = useRef(null);
  const venting = useGame((s) => s.hud.venting);
  useEffect(() => {
    const move = (e) => { if (ref.current) ref.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; };
    addEventListener('pointermove', move);
    return () => removeEventListener('pointermove', move);
  }, []);
  return (
    <div ref={ref} className={`reticle ${venting ? 'hot' : ''}`} style={{ transform: 'translate(-100px, -100px)' }} aria-hidden="true">
      <i />
    </div>
  );
}
