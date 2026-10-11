import { useState } from 'react';
import { useGame } from '../store/gameStore.js';

// [input name, label, aria label]. The engine reads touch.<name> (held) and the t_<name> edge (tapped).
const LEFT = [['left', '◀', 'Move left'], ['right', '▶', 'Move right']];
const CLIMB = [['up', '▲', 'Climb up'], ['down', '▼', 'Climb down or drop']];

function TouchButton({ name, label, aria, input, small }) {
  const [on, setOn] = useState(false);
  const down = (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); input.setTouch(name, true); setOn(true); };
  const up = () => { input.setTouch(name, false); setOn(false); };
  return (
    <button className={`tb ${small ? 'sm' : ''} ${on ? 'on' : ''}`} aria-label={aria || label} onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
      {label}
    </button>
  );
}

export default function TouchControls({ input }) {
  const onFoot = useGame((s) => s.hud.onFoot);
  const pilotOnly = useGame((s) => s.hud.pilotOnly);
  const right = onFoot
    ? [['special', 'RKT', 'Fire pickup rockets'], ['shield', 'FIELD', 'Force field'], ['jet', 'JUMP'], ['fire', 'FIRE'], ['dash', 'ROLL']]
    : [['skill', 'SKILL', 'Mech skill'], ['rocket', 'ALT', 'Secondary system'], ['special', 'RKT', 'Fire pickup rockets'], ['shield', 'FIELD', 'Force field'], ['jet', 'JETS'], ['fire', 'FIRE'], ['dash', 'DASH']];
  return (
    <div className="touch">
      <div className="grp">
        {LEFT.map(([n, l, a]) => <TouchButton key={n} name={n} label={l} aria={a} input={input} />)}
        {onFoot && <div className="climb">{CLIMB.map(([n, l, a]) => <TouchButton key={n} name={n} label={l} aria={a} input={input} small />)}</div>}
      </div>
      <div className="grp right">
        {!pilotOnly && <TouchButton name="mech" label={onFoot ? 'BOARD' : 'EJECT'} aria="Eject or board the mech" input={input} small />}
        {right.map(([n, l, a]) => <TouchButton key={n} name={n} label={l} aria={a} input={input} />)}
      </div>
    </div>
  );
}
