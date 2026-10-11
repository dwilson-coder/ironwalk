export const KEYBOARD_CONTROLS = [
  [['A', 'D'], 'Walk'],
  [['Space'], 'Jump, hold for jets'],
  [['Mouse'], 'Aim'],
  [['LMB'], 'Primary weapon'],
  [['RMB', 'Q'], 'Secondary system'],
  [['R'], 'Mech skill'],
  [['Shift'], 'Boost dash'],
  [['S'], 'Slam down / drop'],
  [['G'], 'Fire pickup rockets'],
  [['F'], 'Force field (20% charge)'],
  [['X'], 'Eject from the mech'],
  [['E'], 'Board a parked mech'],
  [['W', 'S'], 'On foot: climb ladders'],
  [['Shift'], 'On foot: roll'],
  [['P', 'Esc'], 'Pause'],
  [['M'], 'Mini map'],
  [['N'], 'Mute'],
];

export const TOUCH_CONTROLS = [
  [['◀', '▶'], 'Walk'],
  [['JETS'], 'Jump and hover'],
  [['FIRE'], 'Primary, auto-aims'],
  [['ALT'], 'Secondary system'],
  [['SKILL'], 'Mech skill'],
  [['DASH'], 'Boost dash / roll on foot'],
  [['RKT'], 'Fire pickup rockets'],
  [['FIELD'], 'Force field'],
  [['MECH'], 'Eject / board'],
  [['▲', '▼'], 'On foot: climb, drop'],
  [['PAUSE'], 'Pause (top right)'],
  [['MAP'], 'Mini map (top right)'],
];

export default function Controls({ touch }) {
  const list = touch ? TOUCH_CONTROLS : KEYBOARD_CONTROLS;
  return (
    <ul className="keys">
      {list.map(([caps, label]) => (
        <li key={label}>
          <span className="caps">{caps.map((c) => <kbd key={c}>{c}</kbd>)}</span>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
