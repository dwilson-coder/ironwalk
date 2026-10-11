// Player resources gathered from pickups that work the same in the mech and on foot (Phase 3):
//   · force field meter (shown on the health bar): each cell +20%, F spends 20% for 3 s of invulnerability
//   · extra lives (shown on the health bar): when the pilot is killed the run auto-continues
//   · weapon-drop rockets (heat-seeking / turret-aimed), fired with G
//   · freeze: every enemy on screen stops for 3 s
// State lives in ctx.R so the HUD, tests and other systems can read it.
import * as THREE from 'three';
import { PICKUPS, SUPPORT } from './config.js';
import { rand } from './util.js';
import { events } from '../store/gameStore.js';

export function createSupport(ctx) {
  const R = (ctx.R = { shield: 0, shieldT: 0, ammoType: null, ammo: 0, contT: 0, fireT: 0 });

  // force field bubble around whatever the player controls
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0x3f8cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), bubbleMat);
  bubble.visible = false; ctx.scene.add(bubble);

  function reset({ keepLives = false } = {}) {
    Object.assign(R, { shield: 0, shieldT: 0, ammoType: null, ammo: 0, contT: 0, fireT: 0 });
    if (!keepLives) ctx.run.lives = 0;
    bubble.visible = false;
  }

  const invulnerable = () => R.shieldT > 0 || R.contT > 0;

  function popup(text, color) {
    const T = ctx.T;
    events.emit('popup', { ...ctx.toScreen(T.x, T.y + T.h + 1.5), text, kind: 'pickup', color });
  }

  // Called by pickups.apply for every non-heal, non-buff pickup
  function collect(type) {
    const def = PICKUPS[type];
    switch (def.kind) {
      case 'ammo':
        // a different rocket type replaces what you carry; the same type stacks
        if (R.ammoType === type) R.ammo = Math.min(SUPPORT.maxAmmo, R.ammo + def.ammo);
        else { R.ammoType = type; R.ammo = def.ammo; }
        ctx.banner('', `${def.label} · press G to fire`, 1300);
        break;
      case 'shield':
        if (R.shield >= 100) { ctx.score.add(100); popup('+100 · SHIELD FULL', def.css); }
        R.shield = Math.min(100, R.shield + def.amount);
        break;
      case 'life':
        if (ctx.run.lives < SUPPORT.maxLives) { ctx.run.lives++; ctx.audio.sfx('life'); }
        else { ctx.score.add(1000); popup('+1,000 · LIVES FULL', def.css); }
        break;
      case 'freeze': {
        const v = ctx.camView();
        const n = ctx.director.freezeInView(v.x, v.half, def.duration);
        ctx.audio.sfx('freeze');
        ctx.banner('', n ? `${n} hostile${n > 1 ? 's' : ''} frozen` : 'Freeze pulse · nothing in range', 1300);
        ctx.fx.flash(ctx.T.x, ctx.T.y + 2, 4, 30, 0.35, def.color);
        break;
      }
      default: break;
    }
  }

  function activateShield() {
    if (R.shieldT > 0) return false;
    if (R.shield < SUPPORT.shieldPerUse - 0.01) { ctx.audio.sfx('ui'); ctx.banner('', 'Force field needs 20% charge', 900); return false; }
    R.shield -= SUPPORT.shieldPerUse;
    R.shieldT = SUPPORT.shieldTime;
    ctx.audio.sfx('shield');
    return true;
  }

  function fireSpecial() {
    if (R.ammo <= 0 || R.fireT > 0) return false;
    const m = ctx.avatarMuzzle();
    const mult = ctx.P.buffs && ctx.P.buffs.overdrive > 0 ? 1.5 : 1;
    if (!ctx.weapons.launchSpecial(R.ammoType, m, m.face, mult)) return false;
    R.ammo--; R.fireT = 0.2;
    if (R.ammo === 0) R.ammoType = null;
    return true;
  }

  // Continue protection after an extra life is used
  function grantContinue() { R.contT = SUPPORT.continueInvulnerable; }

  function update(dt) {
    const { pressed, edge } = ctx.input;
    const P = ctx.P, T = ctx.T;
    // timed pickup buffs tick whether you are in the mech or on foot
    if (P.buffs) for (const k in P.buffs) P.buffs[k] = Math.max(0, P.buffs[k] - dt);
    R.shieldT = Math.max(0, R.shieldT - dt);
    R.contT = Math.max(0, R.contT - dt);
    R.fireT = Math.max(0, R.fireT - dt);
    if (!T.dead) {
      if (pressed('KeyF') || pressed('t_shield')) activateShield();
      // G everywhere; on foot the pilot has no secondary so RMB / Q fire rockets too
      const fire = pressed('KeyG') || pressed('t_special') || (T.onFoot && (edge.rocket || pressed('KeyQ')));
      if (fire) fireSpecial();
    }
    bubble.visible = invulnerable() && !T.dead;
    if (bubble.visible) {
      const t = ctx.G.time, fading = Math.max(R.shieldT, R.contT) < 0.6;
      bubble.position.set(T.x, T.y + T.h * 0.5, 0.4);
      bubble.scale.set(T.w * 2.2 + 0.6, T.h * 0.62 + 0.3, 2);
      bubbleMat.color.setHex(R.shieldT > 0 ? 0x3f8cff : 0xff5fd2);
      bubbleMat.opacity = (0.16 + Math.sin(t * 12) * 0.04) * (fading && Math.sin(t * 30) < 0 ? 0.3 : 1);
      if (Math.random() < dt * 10) ctx.fx.emit(ctx.fx.FX, { x: T.x + rand(-T.w, T.w), y: T.y + rand(0, T.h), z: 0.8, vy: rand(0.5, 2), life: 0.4, s0: 0.4, s1: 0.1, c: R.shieldT > 0 ? 0x7fb8ff : 0xff9fe2 });
    }
  }

  return { reset, collect, update, invulnerable, activateShield, fireSpecial, grantContinue, state: R };
}
