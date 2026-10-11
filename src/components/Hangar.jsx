// Deployment step 2: mech select. Each mech has its own stats, skill, weakness and hardpoints (allowed weapons).
// Hovering a mech previews its numbers against the one you have equipped; the table compares all of them.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { CHASSIS, PRIMARIES, SECONDARIES, PAINTS, PILOTS, mechRatings, canMount } from '../game/loadout.js';
import { LEVELS, resolveLevel } from '../game/levels.js';
import { easeOutExpo, fadeUp } from '../ui/motion.jsx';
import PilotPortrait from './PilotPortrait.jsx';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const lockText = (unlock) => (unlock > 0 ? `Clear ${LEVELS[unlock - 1].code}` : '');
const STAT_LABELS = [['hull', 'Hull'], ['armor', 'Armor'], ['speed', 'Speed'], ['firepower', 'Firepower'], ['jets', 'Jets'], ['dash', 'Dash']];

function StatBar({ label, value, base }) {
  const delta = base == null ? 0 : value - base;
  return (
    <div className="stat">
      <span>{label}</span>
      <div className="stat-track cmp">
        <motion.i initial={false} animate={{ scaleX: Math.max(0.04, Math.min(1, value)) }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} />
        {base != null && Math.abs(delta) > 0.005 && <span className="base-tick" style={{ left: `${Math.min(100, base * 100)}%` }} />}
      </div>
      <b className={delta > 0.005 ? 'up' : delta < -0.005 ? 'down' : ''}>
        {Math.round(value * 100)}{Math.abs(delta) > 0.005 && <small>{delta > 0 ? '+' : '−'}{Math.round(Math.abs(delta) * 100)}</small>}
      </b>
    </div>
  );
}

function OptionRow({ title, table, selected, reasonFor, onPick, sfx }) {
  const item = table[selected];
  return (
    <section className="opt-section">
      <h3 className="opt-title">{title}</h3>
      <div className="opt-row" role="radiogroup" aria-label={title}>
        {Object.values(table).map((o) => {
          const reason = reasonFor(o);
          const on = o.id === selected;
          return (
            <motion.button
              key={o.id} role="radio" aria-checked={on} disabled={!!reason}
              className={`opt ${on ? 'on' : ''} ${reason ? 'locked' : ''}`}
              onClick={() => { onPick(o.id); sfx('ui'); }}
              whileTap={reason ? undefined : { scale: 0.96 }}
            >
              {on && <motion.span layoutId={`sel-${title}`} className="opt-sel" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="opt-name">{o.name}</span>
              <span className="opt-type">{reason || o.type}</span>
            </motion.button>
          );
        })}
      </div>
      <motion.p key={item.id} className="opt-blurb" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>{item.blurb}</motion.p>
    </section>
  );
}

export default function Hangar({ engine }) {
  const loadout = useGame((s) => s.loadout);
  const pending = useGame((s) => s.pending);
  const { cleared } = useGame((s) => s.progress);
  const [preview, setPreview] = useState(null);
  if (!loadout) return null;

  const pilot = PILOTS[loadout.pilot];
  const current = CHASSIS[loadout.chassis];
  const shown = CHASSIS[preview] || current;
  const isPreview = shown.id !== current.id;
  const rs = mechRatings(shown, pilot), rc = mechRatings(current, pilot);
  const prim = PRIMARIES[loadout.primary], sec = SECONDARIES[loadout.secondary];
  const set = (k) => (v) => engine.setLoadout({ ...loadout, [k]: v });
  const target = pending ? resolveLevel(pending) : null;
  const back = () => (pending ? engine.openPilotSelect(pending) : engine.toTitle());
  const reasonFor = (slot) => (o) => (o.unlock > cleared ? lockText(o.unlock) : !canMount(current.id, slot, o.id) ? `Not on ${current.name}` : '');
  const skillCd = Math.round(shown.skill.cooldown * (pilot.perk.skillCooldown || 1));
  const mechs = Object.values(CHASSIS);

  // comparison table: real units, best value per row highlighted
  const rows = [
    ['Hull', (c) => c.hull + (pilot.perk.hull || 0), (v) => v, 'max'],
    ['Effective armor', (c) => Math.round((c.hull + (pilot.perk.hull || 0)) / c.armor), (v) => v, 'max'],
    ['Walk speed', (c) => c.walkSpeed, (v) => `${v} m/s`, 'max'],
    ['Firepower', (c) => c.firepower, (v) => `${Math.round(v * 100)}%`, 'max'],
    ['Jet burn', (c) => 100 / c.jetBurn, (v) => `${v.toFixed(1)} s`, 'max'],
    ['Dash recharge', (c) => c.dashCooldown, (v) => `${v} s`, 'min'],
  ];

  return (
    <motion.section className="hangar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
      <div className="hangar-tag">
        <motion.div className="eyebrow" variants={fadeUp} initial="hidden" animate="show">{pending ? 'Deployment · step 2 of 2' : 'Hangar bay 2 · refit'}</motion.div>
        <motion.h2 className="hangar-name" key={current.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: easeOutExpo }}>
          {current.name}
        </motion.h2>
        <div className="hangar-sub">{current.cls} · {prim.name} · {sec.name}</div>
        <button className="pilot-chip" onClick={() => engine.openPilotSelect(pending)}>
          <PilotPortrait pilot={pilot} animate={false} />
          <span><b>{pilot.name}</b><em>{pilot.perk.label} · change pilot</em></span>
        </button>
        {target && (
          <div className="hangar-target">
            <span className="lbl">Next sortie</span>
            <b>{target.code} · {target.name}</b>
          </div>
        )}
      </div>

      <motion.div className="hangar-panel" initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, ease: easeOutExpo }}>
        <div className="hangar-scroll">
          <section className="opt-section">
            <h3 className="opt-title">Mech</h3>
            <div className="mech-grid" role="radiogroup" aria-label="Mech">
              {mechs.map((c) => {
                const locked = c.unlock > cleared, on = c.id === current.id, r = mechRatings(c, pilot);
                return (
                  <button
                    key={c.id} role="radio" aria-checked={on} disabled={locked}
                    className={`mech-card ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => { engine.selectMech(c.id); engine.sfx('ui'); setPreview(null); }}
                    onMouseEnter={() => setPreview(c.id)} onMouseLeave={() => setPreview(null)}
                    onFocus={() => setPreview(c.id)} onBlur={() => setPreview(null)}
                  >
                    {on && <motion.span layoutId="mech-sel" className="opt-sel" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                    <span className="opt-name">{c.name}</span>
                    <span className="opt-type">{locked ? lockText(c.unlock) : c.cls}</span>
                    <span className="mini-bars" aria-hidden="true">
                      {['speed', 'armor', 'firepower'].map((k) => <i key={k} title={k}><b style={{ transform: `scaleX(${r[k]})` }} /></i>)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <motion.section key={shown.id} className="mech-detail" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <p className="opt-blurb">{shown.blurb}</p>
            <div className="skill-box">
              <div className="sb-head"><span>Skill</span><kbd>R</kbd></div>
              <b>{shown.skill.name}</b>
              <p>{shown.skill.text}</p>
              <span className="sb-meta">{shown.skill.duration} s active · {skillCd} s recharge{pilot.perk.skillCooldown ? ` (${pilot.perk.label})` : ''}</span>
            </div>
            <div className="weak-box">
              <div className="sb-head"><span>Weakness</span></div>
              <b>{shown.weakness.label}</b>
              <p>{shown.weakness.text}</p>
            </div>
            <p className="hardpoints">
              <span>Hardpoints</span>
              {shown.hardpoints.primary.map((id) => PRIMARIES[id].name).join(', ')} · {shown.hardpoints.secondary.map((id) => SECONDARIES[id].name).join(', ')}
            </p>
          </motion.section>

          <section className="opt-section stats">
            <h3 className="opt-title">{isPreview ? `${shown.name} vs ${current.name}` : 'Performance'}</h3>
            {STAT_LABELS.map(([k, label]) => <StatBar key={k} label={label} value={rs[k]} base={isPreview ? rc[k] : null} />)}
          </section>

          <section className="opt-section">
            <h3 className="opt-title">Compare mechs</h3>
            <div className="cmp-wrap">
              <table className="cmp-table">
                <thead>
                  <tr><th scope="col"><span className="sr">Stat</span></th>{mechs.map((c) => <th key={c.id} scope="col" className={c.id === current.id ? 'cur' : ''}>{c.name}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map(([label, get, fmt, better]) => {
                    const vals = mechs.map(get);
                    const best = better === 'max' ? Math.max(...vals) : Math.min(...vals);
                    return (
                      <tr key={label}>
                        <th scope="row">{label}</th>
                        {mechs.map((c, i) => <td key={c.id} className={`${vals[i] === best ? 'best' : ''} ${c.id === current.id ? 'cur' : ''} ${c.unlock > cleared ? 'dim' : ''}`}>{fmt(vals[i])}</td>)}
                      </tr>
                    );
                  })}
                  <tr><th scope="row">Skill</th>{mechs.map((c) => <td key={c.id} className={`skill ${c.id === current.id ? 'cur' : ''}`}>{c.skill.name}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </section>

          <OptionRow title="Primary" table={PRIMARIES} selected={loadout.primary} reasonFor={reasonFor('primary')} onPick={set('primary')} sfx={engine.sfx} />
          <OptionRow title="Secondary" table={SECONDARIES} selected={loadout.secondary} reasonFor={reasonFor('secondary')} onPick={set('secondary')} sfx={engine.sfx} />

          <section className="opt-section">
            <h3 className="opt-title">Paint</h3>
            <div className="swatches" role="radiogroup" aria-label="Paint">
              {Object.values(PAINTS).map((p) => (
                <button key={p.id} role="radio" aria-checked={loadout.paint === p.id} className={`swatch ${loadout.paint === p.id ? 'on' : ''}`} onClick={() => { set('paint')(p.id); engine.sfx('ui'); }} title={p.name}>
                  <span style={{ background: hex(p.hull) }} /><span style={{ background: hex(p.accent) }} /><span style={{ background: hex(p.glow) }} />
                  <em>{p.name}</em>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="hangar-actions">
          <button className="btn ghost" onClick={back}>Back</button>
          {pending ? (
            <motion.button className="btn" whileTap={{ scale: 0.97 }} onClick={() => engine.prepareMission(pending)} autoFocus>Launch</motion.button>
          ) : (
            <button className="btn" onClick={engine.toTitle}>Save loadout</button>
          )}
        </div>
      </motion.div>
    </motion.section>
  );
}
