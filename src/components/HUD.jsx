import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/gameStore.js';
import { SpringNumber, easeOutExpo } from '../ui/motion.jsx';
import PickupIcon from './PickupIcon.jsx';
import { PICKUPS, SUPPORT } from '../game/config.js';

function Gauge({ label, value, max = 100, text, tone, ticks }) {
  return (
    <div className={`gauge ${tone || ''}`}>
      <span className="g-label">{label}</span>
      <div className={`track ${ticks ? 'ticks' : ''}`}><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, value / max))})` }} /></div>
      <output>{text}</output>
    </div>
  );
}

// Health bar with the force field meter (5 cells of 20%) and extra lives shown on it (Phase 3)
function HealthBar({ label, value, max, low, shield, shieldOn, lives }) {
  const cells = [0, 1, 2, 3, 4];
  return (
    <div className={`healthbar ${low ? 'low' : ''} ${shieldOn ? 'shielded' : ''}`}>
      <div className="gauge">
        <span className="g-label">{label}</span>
        <div className="track ticks"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, value / max))})` }} /></div>
        <output>{Math.ceil(value)}</output>
      </div>
      <div className="hb-row">
        <span className="g-label sh">FIELD</span>
        <div className="shield-cells" title={`Force field ${Math.round(shield)}%`}>
          {cells.map((c) => (
            <span key={c} className={shield >= (c + 1) * 20 - 0.01 ? 'full' : ''}>
              <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, (shield - c * 20) / 20))})` }} />
            </span>
          ))}
        </div>
        <span className="lives" aria-label={`${lives} extra lives`}>
          {Array.from({ length: SUPPORT.maxLives }, (_, i) => (
            <svg key={i} viewBox="0 0 24 24" className={i < lives ? 'on' : ''}><path d={PICKUPS.life.icon} /></svg>
          ))}
        </span>
      </div>
    </div>
  );
}

export default function HUD({ engine }) {
  const h = useGame((s) => s.hud);
  const muted = useGame((s) => s.muted);
  const minimap = useGame((s) => s.minimap);
  const touch = useGame((s) => s.touch);
  const hullLow = h.hull < h.maxHull * 0.3;
  const heatHot = h.heat > 75 || h.venting;
  const secReady = h.secReady >= 1;
  const skillReady = h.skillReady >= 1 && h.skillActive <= 0;
  const foot = h.onFoot;
  const pilotLow = h.pilotHp < h.pilotMaxHp * 0.3;
  const shieldReady = h.shield >= SUPPORT.shieldPerUse - 0.01;
  const frameLine = h.mechMode === 'destroyed' ? `Replacement in ${Math.ceil(h.replaceT)}s`
    : h.mechMode === 'dropping' ? 'Replacement inbound'
    : h.mechMode === 'parked' ? `${h.mechName} · auto-defend · ${Math.ceil(h.hull)} hull` : null;

  return (
    <motion.div className="hud" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <motion.div className="gauges" initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, ease: easeOutExpo }}>
        <div className="frame-id">
          <span>{foot ? `${h.callsign} · on foot` : h.callsign ? `${h.callsign} · ${h.mechName}` : h.mechName || 'Frame'}</span>
          <motion.span key={h.status} className={h.status === 'Online' || h.status === 'On foot' ? '' : 'alert'} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{h.status}</motion.span>
        </div>
        {foot ? (
          <>
            <HealthBar label="PILOT" value={h.pilotHp} max={h.pilotMaxHp} low={pilotLow} shield={h.shield} shieldOn={h.shieldT > 0 || h.contT > 0} lives={h.lives} />
            {frameLine && (
              <div className={`frame-status ${h.mechMode}`}>
                <span>{frameLine}</span>
                {h.mechMode === 'destroyed' && <div className="track"><i style={{ transform: `scaleX(${1 - h.replaceT / 25})` }} /></div>}
              </div>
            )}
          </>
        ) : (
          <>
            <HealthBar label="HULL" value={h.hull} max={h.maxHull} low={hullLow} shield={h.shield} shieldOn={h.shieldT > 0 || h.contT > 0} lives={h.lives} />
            <Gauge label="HEAT" value={h.heat} text={h.venting ? 'VENT' : Math.round(h.heat)} tone={heatHot ? 'hot' : 'heat'} />
            <Gauge label="JETS" value={h.fuel} text={Math.round(h.fuel)} tone="fuel" />
          </>
        )}
        {(foot ? pilotLow : hullLow) && <motion.div className="critical" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />}
      </motion.div>

      <div className="buffs">
        <AnimatePresence>
          {h.buffs.map((b) => (
            <motion.div key={b.id} className="buff" style={{ '--c': b.color }} initial={{ opacity: 0, x: -20, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }} layout>
              <span>{b.label}</span><b>{Math.ceil(b.t)}s</b>
              <div className="buff-bar"><i style={{ transform: `scaleX(${b.t / b.max})` }} /></div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Pause and mini map buttons: the only way to pause on touch screens */}
      <div className="hud-buttons">
        <button className="hud-btn" aria-pressed={minimap} onClick={engine.toggleMinimap} title="Toggle mini map (M)">
          MAP{!touch && <kbd>M</kbd>}
        </button>
        <button className="hud-btn" onClick={() => engine.setPaused(true)} aria-label="Pause game" title="Pause (P or Esc)">
          <span className="bars" aria-hidden="true"><i /><i /></span>
          PAUSE{!touch && <kbd>P</kbd>}
        </button>
      </div>

      <motion.div className="tally" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, ease: easeOutExpo }}>
        <span className="lbl">{h.mission}</span>
        <AnimatePresence mode="popLayout">
          <motion.span key={h.waveLabel} className="num small" initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }}>
            {h.waveLabel}
          </motion.span>
        </AnimatePresence>
        <span className="lbl gap">SCORE</span>
        <span className="num"><SpringNumber value={h.score} /></span>

        <AnimatePresence>
          {h.combo >= 2 && (
            <motion.div className="combo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <div className="combo-row">
                <motion.span key={h.combo} className="combo-count" initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>{h.combo}</motion.span>
                <span className="combo-word">chain</span>
                {h.multiplier > 1 && (
                  <motion.span key={h.multiplier} className="mult" initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 14 }}>×{h.multiplier}</motion.span>
                )}
              </div>
              <div className="combo-timer"><i style={{ transform: `scaleX(${h.comboTime})` }} /></div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div className="loadout" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: easeOutExpo }}>
        {foot ? (
          <>
            <div className="slot wide ready">
              <span className="s-label">SIDEARM <b>{h.sidearm.toUpperCase()}</b></span>
              <div className="track"><i style={{ transform: 'scaleX(1)' }} /></div>
            </div>
            <div className="slot ready">
              <span className="s-label">ROLL <b>{touch ? 'ROLL' : 'SHIFT'}</b></span>
              <div className="track"><i style={{ transform: 'scaleX(1)' }} /></div>
            </div>
          </>
        ) : (<>
        <div className={`slot wide skill ${skillReady ? 'ready' : ''} ${h.skillActive > 0 ? 'active' : ''}`}>
          <span className="s-label">{h.skillName.toUpperCase()} <b>{h.skillActive > 0 ? `${h.skillActive.toFixed(1)}s` : skillReady ? (touch ? 'READY' : 'READY · R') : `${Math.ceil(h.skillCooldown)}s`}</b></span>
          <div className="track"><i style={{ transform: `scaleX(${h.skillActive > 0 ? 1 : h.skillReady})` }} /></div>
        </div>
        <div className={`slot wide ${secReady ? 'ready' : ''} ${h.barrier > 0 ? 'active' : ''}`}>
          <span className="s-label">{h.secondary.toUpperCase()} <b>{h.barrier > 0 ? `${h.barrier.toFixed(1)}s` : secReady ? 'READY' : `${h.secCooldown.toFixed(1)}s`}</b></span>
          <div className="track"><i style={{ transform: `scaleX(${h.barrier > 0 ? 1 : h.secReady})` }} /></div>
        </div>
        <div className={`slot ${h.dashReady >= 1 ? 'ready' : ''}`}>
          <span className="s-label">DASH <b>{h.dashReady >= 1 ? 'READY' : '—'}</b></span>
          <div className="track"><i style={{ transform: `scaleX(${h.dashReady})` }} /></div>
        </div>
        </>)}
        {/* force field: F spends 20% of the meter */}
        <div className={`slot field ${shieldReady ? 'ready' : ''} ${h.shieldT > 0 ? 'active' : ''}`}>
          <span className="s-label"><PickupIcon type="shield" size={12} /> FIELD <b>{h.shieldT > 0 ? `${h.shieldT.toFixed(1)}s` : shieldReady ? (touch ? 'READY' : 'F') : `${Math.round(h.shield)}%`}</b></span>
          <div className="track"><i style={{ transform: `scaleX(${h.shieldT > 0 ? h.shieldT / SUPPORT.shieldTime : Math.min(1, h.shield / SUPPORT.shieldPerUse)})` }} /></div>
        </div>
        {/* weapon-drop rockets */}
        <AnimatePresence>
          {h.ammo > 0 && (
            <motion.div key={h.ammoType} className="slot special ready" style={{ '--c': h.ammoColor }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <span className="s-label"><PickupIcon type={h.ammoType} size={12} /> {h.ammoType === 'heat' ? 'SEEKERS' : 'TURRET'} <b>×{h.ammo}{touch ? '' : ' · G'}</b></span>
              <div className="track"><i style={{ transform: `scaleX(${h.ammo / SUPPORT.maxAmmo})` }} /></div>
            </motion.div>
          )}
        </AnimatePresence>
        {muted && <span className="muted-tag">MUTED</span>}
      </motion.div>

      {/* context prompt: board the frame, climb a ladder */}
      <AnimatePresence>
        {h.prompt && (
          <motion.div key={h.prompt.text} className="prompt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            <kbd>{h.prompt.key}</kbd>{h.prompt.text}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {h.boss && (
          <motion.div className={`boss ${h.boss.phase === 2 ? 'enraged' : ''}`} initial={{ opacity: 0, y: -20, scaleX: 0.6 }} animate={{ opacity: 1, y: 0, scaleX: 1 }} exit={{ opacity: 0, scaleX: 0.4 }} transition={{ duration: 0.5, ease: easeOutExpo }}>
            <div className="boss-head">
              <span className="boss-label">{h.boss.name}</span>
              <span className="boss-title">{h.boss.phase === 2 ? 'Enraged' : h.boss.title}</span>
            </div>
            <div className="track boss-track"><i style={{ transform: `scaleX(${h.boss.hp})` }} /><span className="notch" /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
