// Shared gameplay numbers. Per-frame stats (hull, speed, jets) come from the chosen frame in loadout.js,
// weapon stats from loadout.js, and per-mission layout from levels.js.

export const PLAYER = {
  groundAccel: 70,
  airAccel: 30,
  gravity: 34,
  maxFall: 50,
  jumpVelocity: 14,
  jetMaxRise: 12,
  fuelRegenPerSec: 48,
  dashSpeed: 36,
  dashTime: 0.22,
  dashInvulnerable: 0.28,
  poundVelocity: -44,
  hardLandingVelocity: -26,
  stompRadius: 8,
  stompDamage: 55,
  height: 4.8,
};

export const GUN = { coolPerSec: 38, coolDelay: 0.3, ventTime: 1.7 };

export const ROCKETS = { perSalvo: 4, damage: 48, radius: 4.8, launchInterval: 0.08, turnRate: 7, maxSpeed: 58 };
export const MORTAR = { shells: 3, damage: 70, radius: 6.5, flightTime: 1.15, gravity: 30 };

export const ENEMIES = {
  drone: { hp: 28, hpPerLevel: 3, radius: 1.2, centerY: 0, boltSpeed: 22, boltDamage: 8, score: 100 },
  crawler: { hp: 70, hpPerLevel: 6, radius: 1.7, centerY: 1.1, boltSpeed: 25, boltDamage: 12, score: 150 },
};

export const WAVES = {
  repairOnClear: 25,
  breakSeconds: 3.6,
  clearBonus: 250, // × difficulty step
  bossSupplyEvery: 22, // seconds between supply drops during a boss fight
};

export const SCORING = {
  comboWindow: 3,
  killsPerStep: 3,
  stepSize: 0.5,
  maxMultiplier: 4,
  missionClearBonus: 2000,
  noDamageBossBonus: 1500,
};

// In-battle pickups. Each has its own colour and icon; `icon` is an SVG path (24×24 box, stroked) that is drawn
// both on the 3D crates (via Path2D) and in the HUD, so the two always match.
// kind: 'heal' | 'buff' (timed) | 'ammo' (weapon drop, fired with G) | 'shield' | 'life' | 'freeze'
export const PICKUPS = {
  repair: { label: 'Health', short: '+35 HEALTH', kind: 'heal', color: 0x6fe08a, css: '#6fe08a', weight: 4,
    icon: 'M12 4v16M4 12h16' },
  heat: { label: 'Heat-seeking rockets', short: '+6 HEAT-SEEKERS', kind: 'ammo', ammo: 6, color: 0xff4f3a, css: '#ff4f3a', weight: 2,
    icon: 'M4 19c2-7 6-11 13-13M17 6l-5-1M17 6l-1 5M19.5 17.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0' },
  turret: { label: 'Turret rockets', short: '+6 AIMED ROCKETS', kind: 'ammo', ammo: 6, color: 0xffc23a, css: '#ffc23a', weight: 2,
    icon: 'M12 3v5M12 16v5M3 12h5M16 12h5M17 12a5 5 0 1 1-10 0a5 5 0 1 1 10 0' },
  shield: { label: 'Force field cell', short: '+20% SHIELD', kind: 'shield', amount: 20, color: 0x3f8cff, css: '#3f8cff', weight: 2,
    icon: 'M12 3l7 3v6c0 4.5-3 7.5-7 9c-4-1.5-7-4.5-7-9V6z' },
  life: { label: 'Extra life', short: '+1 LIFE', kind: 'life', color: 0xff5fd2, css: '#ff5fd2', weight: 0.6,
    icon: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z' },
  freeze: { label: 'Freeze', short: 'ENEMIES FROZEN · 3s', kind: 'freeze', duration: 3, color: 0xd8f4ff, css: '#d8f4ff', weight: 1.2,
    icon: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2' },
  coolant: { label: 'Coolant flush', short: 'NO HEAT · 10s', kind: 'buff', color: 0x3fe0d0, css: '#3fe0d0', duration: 10, weight: 1.5,
    icon: 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z' },
  overdrive: { label: 'Overdrive', short: 'DAMAGE ×1.5 · 12s', kind: 'buff', color: 0xff8a2a, css: '#ff8a2a', duration: 12, weight: 1.5,
    icon: 'M13 2L5 14h6l-1 8l8-12h-6z' },
  munitions: { label: 'Munitions cache', short: 'SECONDARY RAPID · 10s', kind: 'buff', color: 0xb8f03a, css: '#b8f03a', duration: 10, weight: 1.5,
    icon: 'M7 20V9l1.5-3L10 9v11M14 20V9l1.5-3L17 9v11M5 20h14' },
  plating: { label: 'Reactive plating', short: 'DAMAGE −50% · 12s', kind: 'buff', color: 0xb9a6ff, css: '#b9a6ff', duration: 12, weight: 1,
    icon: 'M4 6h16v12H4zM7.5 9.5h.01M16.5 9.5h.01M7.5 14.5h.01M16.5 14.5h.01' },
};
export const BUFF_TYPES = Object.keys(PICKUPS).filter((k) => PICKUPS[k].kind === 'buff');
export const PICKUP_DROP_CHANCE = 0.1;
export const PICKUP_LIFETIME = 22;

// Shared player resources gathered from pickups (Phase 3)
export const SUPPORT = {
  shieldPerUse: 20, // F spends this much of the meter…
  shieldTime: 3, // …for this many seconds of invulnerability
  maxLives: 3,
  maxAmmo: 12,
  continueInvulnerable: 3, // seconds of protection after an extra life is used
};

// Pilot on foot and mech replacement (Phase 4)
export const PILOT = {
  height: 1.9, halfWidth: 0.45, gravity: 30, jumpVelocity: 11.5, climbSpeed: 5, maxFall: 40,
  rollSpeed: 15, rollTime: 0.32, rollCooldown: 0.9, bulletSpeed: 110,
  ejectVelocity: 13, autoEjectHealth: 0.5, // auto-ejecting from an exploding mech leaves the pilot at 50% health
  boardRange: 2.6,
};
export const MECH_REPLACEMENT_SECONDS = 25;
export const SECRET_BONUS = 500;
