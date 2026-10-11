// The same SVG icon that is painted on the pickup crates in the 3D scene (see PICKUPS in config.js).
import { PICKUPS } from '../game/config.js';

export default function PickupIcon({ type, size = 16, className = '' }) {
  const def = PICKUPS[type];
  if (!def) return null;
  return (
    <svg className={`pk-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={def.icon} fill="none" stroke={def.css} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
