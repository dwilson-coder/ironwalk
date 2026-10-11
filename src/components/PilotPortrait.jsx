// Code-drawn pilot portraits (placeholder art until real portraits exist).
// One component draws all three pilots; it's reused on the pilot select screen, the mech select pilot chip,
// and later in cutscenes. `animate` turns on blinking (humans) or the visor scan (android).
import { useId } from 'react';
import { motion } from 'framer-motion';

function Eyes({ y, gap = 15, big = false, animate, color = '#1a1412' }) {
  const ry = big ? 3.6 : 3;
  const blink = animate ? { scaleY: [1, 1, 0.1, 1, 1] } : undefined;
  return (
    <motion.g style={{ transformOrigin: `100px ${y}px` }} animate={blink} transition={{ duration: 4.2, times: [0, 0.9, 0.93, 0.96, 1], repeat: Infinity }}>
      <ellipse cx={100 - gap} cy={y} rx="4.4" ry={ry} fill="#f2ece4" />
      <ellipse cx={100 + gap} cy={y} rx="4.4" ry={ry} fill="#f2ece4" />
      <circle cx={100 - gap + 0.6} cy={y} r="2.3" fill={color} />
      <circle cx={100 + gap + 0.6} cy={y} r="2.3" fill={color} />
    </motion.g>
  );
}

function Headset({ accent }) {
  return (
    <g>
      <path d="M62 92 C 62 52, 138 52, 138 92" fill="none" stroke="#1f2427" strokeWidth="6" strokeLinecap="round" />
      <rect x="54" y="86" width="14" height="26" rx="5" fill="#262b2e" />
      <rect x="57" y="92" width="8" height="14" rx="3" fill={accent} opacity=".85" />
      <path d="M61 110 C 64 128, 76 134, 90 134" fill="none" stroke="#262b2e" strokeWidth="3" strokeLinecap="round" />
      <circle cx="91" cy="134" r="3.2" fill="#262b2e" />
    </g>
  );
}

function Human({ pilot, animate, female }) {
  const { skin, hair, suit, accent } = pilot.look;
  return (
    <g>
      {female && <path d="M64 104 C 54 60, 90 42, 110 46 C 142 50, 150 84, 140 124 L 134 150 L 66 150 Z" fill={hair} />}
      {female && <circle cx="136" cy="56" r="13" fill={hair} />}
      <path d="M22 220 C 30 168, 62 152, 100 152 C 138 152, 170 168, 178 220 Z" fill={suit} />
      <path d="M76 156 L 100 188 L 124 156" fill="none" stroke={accent} strokeWidth="5" strokeLinejoin="round" />
      <rect x="86" y="122" width="28" height="36" rx="10" fill={skin} />
      <ellipse cx="100" cy="100" rx="33" ry="40" fill={skin} />
      {!female && <ellipse cx="100" cy="122" rx="26" ry="16" fill="#000" opacity=".12" />}
      {!female && <path d="M66 94 C 62 60, 84 50, 102 51 C 126 52, 140 66, 134 94 C 128 76, 116 70, 100 70 C 84 70, 72 78, 66 94 Z" fill={hair} />}
      {female && <path d="M67 96 C 66 64, 92 54, 112 58 C 128 62, 136 76, 133 94 C 122 80, 104 72, 84 80 C 76 84, 70 90, 67 96 Z" fill={hair} />}
      {female && <path d="M70 92 C 64 112, 66 132, 72 146 L 78 146 C 74 128, 74 110, 78 96 Z" fill={hair} />}
      <path d={female ? 'M79 88 Q 85 84 92 87 M108 87 Q 115 84 121 88' : 'M78 88 L 93 86 M107 86 L 122 88'} stroke={hair} strokeWidth={female ? 2.4 : 3.4} strokeLinecap="round" fill="none" />
      <Eyes y={96} big={female} animate={animate} />
      <path d="M100 100 L 97 112 L 102 113" fill="none" stroke="#000" strokeOpacity=".25" strokeWidth="1.6" strokeLinecap="round" />
      <path d={female ? 'M91 122 Q 100 127 109 122' : 'M90 121 Q 100 124 110 121'} fill="none" stroke={female ? '#8e4a44' : '#5a3a30'} strokeWidth={female ? 3 : 2.2} strokeLinecap="round" />
      {!female && <path d="M118 104 L 124 112" stroke="#8a5a48" strokeWidth="1.6" opacity=".7" />}
      <Headset accent={accent} />
    </g>
  );
}

function Android({ pilot, animate, gid }) {
  const { skin, suit, accent } = pilot.look;
  return (
    <g>
      <defs>
        <linearGradient id={`${gid}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e4e9ec" /><stop offset=".55" stopColor={skin} /><stop offset="1" stopColor="#6f7a80" />
        </linearGradient>
      </defs>
      <path d="M22 220 C 30 168, 62 152, 100 152 C 138 152, 170 168, 178 220 Z" fill={suit} />
      <path d="M60 176 H 140" stroke={accent} strokeWidth="4" />
      <rect x="88" y="120" width="24" height="38" fill="#4a5258" />
      {[128, 136, 144, 152].map((y) => <path key={y} d={`M88 ${y} H 112`} stroke="#2b3136" strokeWidth="1.5" />)}
      <path d="M68 78 C 68 54, 132 54, 132 78 L 134 112 C 132 130, 116 140, 100 140 C 84 140, 68 130, 66 112 Z" fill={`url(#${gid}-metal)`} />
      <path d="M100 56 V 84 M68 104 L 82 108 M132 104 L 118 108" stroke="#5c666c" strokeWidth="1.4" fill="none" />
      <circle cx="66" cy="98" r="8" fill="#3a4248" /><circle cx="66" cy="98" r="3.5" fill={accent} />
      <circle cx="134" cy="98" r="8" fill="#3a4248" />
      <rect x="72" y="88" width="56" height="14" rx="7" fill="#0b1418" />
      <rect x="74" y="90" width="52" height="10" rx="5" fill="#3fd6ff" opacity=".35" />
      <motion.rect y="90" width="12" height="10" rx="5" fill="#bff4ff" opacity=".9" initial={{ x: 74 }} animate={animate ? { x: [74, 114, 74] } : undefined} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} />
      {[116, 120, 124].map((y) => <path key={y} d={`M88 ${y} H 112`} stroke="#4b555b" strokeWidth="2" strokeLinecap="round" />)}
      <text x="112" y="76" fontFamily="JetBrains Mono, monospace" fontSize="7" fontWeight="600" fill="#4b555b">TK-9</text>
    </g>
  );
}

export default function PilotPortrait({ pilot, animate = true, className = '' }) {
  const gid = useId().replace(/:/g, '');
  const accent = pilot.look.accent;
  return (
    <svg className={`portrait ${className}`} viewBox="0 0 200 220" role="img" aria-label={`Portrait of ${pilot.name}`}>
      <defs>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141b20" /><stop offset="1" stopColor="#0b0f12" />
        </linearGradient>
        <pattern id={`${gid}-grid`} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#e2d8c3" strokeOpacity=".05" /></pattern>
      </defs>
      <rect width="200" height="220" fill={`url(#${gid}-bg)`} />
      <rect width="200" height="220" fill={`url(#${gid}-grid)`} />
      <circle cx="100" cy="104" r="78" fill={accent} opacity=".08" />
      {pilot.kind === 'Android' ? <Android pilot={pilot} animate={animate} gid={gid} /> : <Human pilot={pilot} animate={animate} female={pilot.kind === 'Female'} />}
      <text x="10" y="16" fontFamily="JetBrains Mono, monospace" fontSize="8" fontWeight="600" letterSpacing="1.5" fill={accent}>{pilot.callsign}</text>
    </svg>
  );
}
