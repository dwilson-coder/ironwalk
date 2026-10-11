// Deployment step 1: choose a pilot (passive perk + on-foot stats) and their sidearm for on-foot combat.
import { motion } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { PILOTS, SIDEARMS } from '../game/loadout.js';
import { resolveLevel } from '../game/levels.js';
import { StaggerWord, fadeUp, easeOutExpo } from '../ui/motion.jsx';
import PilotPortrait from './PilotPortrait.jsx';

function Bar({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <div className="stat-track"><motion.i initial={false} animate={{ scaleX: Math.max(0.04, value) }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} /></div>
      <b>{Math.round(value * 100)}</b>
    </div>
  );
}

export default function PilotSelect({ engine }) {
  const loadout = useGame((s) => s.loadout);
  const pending = useGame((s) => s.pending);
  if (!loadout) return null;

  const set = (patch) => { engine.setLoadout({ ...loadout, ...patch }); engine.sfx('ui'); };
  const side = SIDEARMS[loadout.sidearm];
  const target = pending ? resolveLevel(pending) : null;
  const pilotOnly = !!target?.pilotOnly; // side ops are on foot: no mech step
  const back = () => ((pending?.mode === 'campaign' && !pending.keepRun) || pending?.mode === 'sideop' ? engine.openMissions() : engine.toTitle());

  return (
    <motion.section className="pilot-select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
      <div className="ps-wrap">
        <header className="ps-head">
          <motion.div className="eyebrow" variants={fadeUp} initial="hidden" animate="show">
            {pilotOnly ? 'Pilot-only operation' : 'Deployment · step 1 of 2'}{target ? ` · ${target.code} ${target.name}` : ''}
          </motion.div>
          <h2 className="h2"><StaggerWord text="PILOT" /></h2>
        </header>

        <div className="pilot-grid" role="radiogroup" aria-label="Pilot">
          {Object.values(PILOTS).map((p, i) => {
            const on = loadout.pilot === p.id;
            return (
              <motion.button
                key={p.id}
                role="radio"
                aria-checked={on}
                className={`pilot-card ${on ? 'on' : ''}`}
                onClick={() => set({ pilot: p.id })}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.6, ease: easeOutExpo }}
                whileHover={{ y: -4 }}
              >
                {on && <motion.span layoutId="pilot-sel" className="pilot-sel" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                <PilotPortrait pilot={p} animate={on} />
                <div className="pc-body">
                  <div className="pc-top"><h3>{p.name}</h3><span className="chip">{p.kind}</span></div>
                  <p className="pc-role">{p.role}</p>
                  <p className="pc-bio">{p.bio}</p>
                  <div className="perk"><span>{p.perk.label}</span>{p.perk.text}</div>
                  <dl className="pc-foot">
                    <div><dt>On-foot health</dt><dd>{p.foot.hp}</dd></div>
                    <div><dt>On-foot speed</dt><dd>{p.foot.speed} m/s</dd></div>
                  </dl>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.section className="sidearms" variants={fadeUp} initial="hidden" animate="show" custom={4}>
          <div className="sa-head">
            <h3 className="opt-title">Sidearm</h3>
            <span className="hint">Carried by the pilot and used when you leave the mech</span>
          </div>
          <div className="sa-row">
            <div className="opt-row" role="radiogroup" aria-label="Sidearm">
              {Object.values(SIDEARMS).map((w) => {
                const on = loadout.sidearm === w.id;
                return (
                  <button key={w.id} role="radio" aria-checked={on} className={`opt ${on ? 'on' : ''}`} onClick={() => set({ sidearm: w.id })}>
                    {on && <motion.span layoutId="sel-sidearm" className="opt-sel" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                    <span className="opt-name">{w.name}</span>
                    <span className="opt-type">{w.type}</span>
                  </button>
                );
              })}
            </div>
            <div className="sa-detail">
              <motion.p key={side.id} className="opt-blurb" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{side.blurb}</motion.p>
              <Bar label="Damage" value={side.rating.damage} />
              <Bar label="Fire rate" value={side.rating.rate} />
              <Bar label="Range" value={side.rating.range} />
            </div>
          </div>
        </motion.section>

        <div className="ps-actions">
          <button className="btn ghost" onClick={back}>Back</button>
          {pilotOnly
            ? <motion.button className="btn" whileTap={{ scale: 0.97 }} onClick={() => engine.prepareMission(pending)} autoFocus>Launch on foot</motion.button>
            : <motion.button className="btn" whileTap={{ scale: 0.97 }} onClick={() => engine.openHangar(pending)} autoFocus>Choose mech</motion.button>}
        </div>
      </div>
    </motion.section>
  );
}
