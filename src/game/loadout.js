// Loadout data: pilots, pilot sidearms, mechs (frames), mech weapons and paint schemes.
// `unlock` = number of campaign missions that must be cleared before the item can be equipped.

// ----------------------------------------------------------------------------- pilots
// Each pilot has a passive perk that applies to whatever mech they drive, plus on-foot stats used in Phase 4.
export const PILOTS = {
  mercer: {
    id: 'mercer', name: 'Cole Mercer', callsign: 'HAMMER', kind: 'Male', role: 'Salvage veteran',
    bio: 'Twenty years hauling wrecks out of Sector 9. Has been shot at more than anyone on the crew and is still standing.',
    perk: { label: 'Hardened', text: '+15 max hull on any mech', hull: 15 },
    foot: { hp: 100, speed: 7 },
    look: { skin: '#c69a72', hair: '#3b2a1f', suit: '#4c5a3d', accent: '#d96a1f' },
  },
  reyes: {
    id: 'reyes', name: 'Ana Reyes', callsign: 'VESPER', kind: 'Female', role: 'Test pilot',
    bio: 'Flew prototype frames before the uprising. Runs every system past its rated limit and gets away with it.',
    perk: { label: 'Overclock', text: 'Mech skill recharges 25% faster', skillCooldown: 0.75 },
    foot: { hp: 90, speed: 8.2 },
    look: { skin: '#a8755a', hair: '#1d1714', suit: '#2f4a5c', accent: '#7fd6e2' },
  },
  tinker: {
    id: 'tinker', name: 'TK-9 "Tinker"', callsign: 'TINKER', kind: 'Android', role: 'Repair synthetic',
    bio: 'A maintenance android that rewired itself for combat. It patches the frame while it fights.',
    perk: { label: 'Field repair', text: 'Repairs 2 hull per second after 4 s without taking damage', regen: 2, regenDelay: 4 },
    foot: { hp: 120, speed: 6.5 },
    look: { skin: '#b9c2c7', hair: '#3a4248', suit: '#3a3f45', accent: '#ffb020' },
  },
};

// ----------------------------------------------------------------------------- pilot sidearms (used on foot, Phase 4)
export const SIDEARMS = {
  pistol: {
    id: 'pistol', name: 'P9 Marksman', type: 'Pistol',
    blurb: 'Accurate semi-auto. Every round goes exactly where you aim.',
    damage: 14, rate: 4, spread: 0.01, pellets: 1, range: 40,
    rating: { damage: 0.45, rate: 0.35, range: 1 },
  },
  smg: {
    id: 'smg', name: 'Vespa SMG', type: 'SMG',
    blurb: 'Fast and forgiving. Sprays down anything at close and mid range.',
    damage: 6, rate: 14, spread: 0.08, pellets: 1, range: 26,
    rating: { damage: 0.25, rate: 1, range: 0.6 },
  },
  shotgun: {
    id: 'shotgun', name: 'Breacher-6', type: 'Shotgun',
    blurb: 'Six pellets per pump. Clears corridors, useless across a hangar.',
    damage: 9, rate: 1.4, spread: 0.22, pellets: 6, range: 12,
    rating: { damage: 1, rate: 0.15, range: 0.25 },
  },
};

// ----------------------------------------------------------------------------- mechs
// skill: active ability on R (touch: SKILL). weakness: the trade-off. hardpoints: which weapons the frame can mount.
// stock: the loadout fitted when you pick this mech. firepower multiplies all weapon damage. heat multiplies weapon heat.
export const CHASSIS = {
  warden: {
    id: 'warden', name: 'Warden-7', cls: 'Medium frame', unlock: 0,
    blurb: 'Balanced salvage frame. Mounts every weapon in the hangar.',
    hull: 100, walkSpeed: 11, jetAccel: 64, jetBurn: 34, dashCooldown: 1.1, armor: 1, firepower: 1, heat: 1.1, stomp: 1, scale: 1,
    skill: { id: 'surge', name: 'Reactor Surge', text: 'For 6 s your weapons build no heat and fire 25% faster.', duration: 6, cooldown: 22 },
    weakness: { label: 'Runs hot', text: 'Weapons build 10% more heat.' },
    hardpoints: { primary: ['chaingun', 'scatter', 'rail'], secondary: ['seeker', 'mortar', 'barrier'] },
    stock: { primary: 'chaingun', secondary: 'seeker' },
  },
  striker: {
    id: 'striker', name: 'Kestrel-3', cls: 'Light frame', unlock: 1,
    blurb: 'Stripped-down scout. Fastest on the ground and in the air.',
    hull: 75, walkSpeed: 14, jetAccel: 76, jetBurn: 26, dashCooldown: 0.7, armor: 1.15, firepower: 0.85, heat: 1, stomp: 0.7, scale: 0.9,
    skill: { id: 'afterburner', name: 'Afterburner', text: 'For 4 s your jets never run dry and dash recharges almost instantly.', duration: 4, cooldown: 16 },
    weakness: { label: 'Paper plating', text: 'Takes 15% more damage. Too light for the railgun or mortar.' },
    hardpoints: { primary: ['chaingun', 'scatter'], secondary: ['seeker', 'barrier'] },
    stock: { primary: 'scatter', secondary: 'seeker' },
  },
  bulwark: {
    id: 'bulwark', name: 'Bastion-9', cls: 'Heavy frame', unlock: 2,
    blurb: 'Walking bunker. Hits hardest and lands like an earthquake.',
    hull: 150, walkSpeed: 8.5, jetAccel: 54, jetBurn: 44, dashCooldown: 1.6, armor: 0.85, firepower: 1.2, heat: 1, stomp: 1.6, scale: 1.12,
    skill: { id: 'fortify', name: 'Fortify', text: 'Plant for 5 s: take 60% less damage and deal 30% more, but you cannot move.', duration: 5, cooldown: 20 },
    weakness: { label: 'Lumbering', text: 'Slowest walk, shortest jet burn and the longest dash recharge. No shield emitter.' },
    hardpoints: { primary: ['chaingun', 'scatter', 'rail'], secondary: ['seeker', 'mortar'] },
    stock: { primary: 'chaingun', secondary: 'mortar' },
  },
  spectre: {
    id: 'spectre', name: 'Spectre-2', cls: 'Recon frame', unlock: 3,
    blurb: 'Electronic-warfare frame built around a long-range rail.',
    hull: 70, walkSpeed: 12.5, jetAccel: 70, jetBurn: 30, dashCooldown: 0.9, armor: 1.1, firepower: 0.9, heat: 1, stomp: 0.8, scale: 0.95,
    skill: { id: 'cloak', name: 'Ghost Cloak', text: 'For 4.5 s enemies lose your lock: aimed shots go wide and missiles stop homing.', duration: 4.5, cooldown: 20 },
    weakness: { label: 'Glass frame', text: 'Lowest hull and takes 10% more damage. No mortar or scattergun.' },
    hardpoints: { primary: ['rail', 'chaingun'], secondary: ['barrier', 'seeker'] },
    stock: { primary: 'rail', secondary: 'barrier' },
  },
};

export const PRIMARIES = {
  chaingun: {
    id: 'chaingun', name: 'M-40 Rotary', type: 'Chaingun', unlock: 0,
    blurb: 'Spins up and shreds everything. Overheats if you never let go of the trigger.',
    fire: 'auto', spinup: true, rate: 13, heat: 4.1, damage: 7, spread: 0.035, speed: 150, pellets: 1, life: 0.5,
    rating: { damage: 0.35, rate: 1, range: 0.75 },
  },
  scatter: {
    id: 'scatter', name: 'Breach-12', type: 'Scattergun', unlock: 1,
    blurb: 'Eight heavy slugs per blast. Brutal up close, falls off fast at range.',
    fire: 'auto', spinup: false, rate: 2.1, heat: 15, damage: 8, spread: 0.2, speed: 110, pellets: 8, life: 0.26,
    rating: { damage: 0.85, rate: 0.3, range: 0.3 },
  },
  rail: {
    id: 'rail', name: 'Lance Railgun', type: 'Railgun', unlock: 3,
    blurb: 'Instant hyper-velocity slug that punches through every target in its path.',
    fire: 'rail', spinup: false, rate: 1.25, heat: 30, damage: 75, range: 90,
    rating: { damage: 1, rate: 0.15, range: 1 },
  },
};

export const SECONDARIES = {
  seeker: {
    id: 'seeker', name: 'Seeker Pod', type: 'Homing rockets', unlock: 0,
    blurb: 'Four rockets that steer toward the target nearest your reticle.',
    cooldown: 5,
  },
  mortar: {
    id: 'mortar', name: 'Hammer Mortar', type: 'Artillery', unlock: 2,
    blurb: 'Lobs three heavy shells at your reticle. Huge blast radius, slow to reload.',
    cooldown: 6.5,
  },
  barrier: {
    id: 'barrier', name: 'Aegis Barrier', type: 'Energy shield', unlock: 3,
    blurb: 'Projects a frontal wall that absorbs all incoming fire for four seconds.',
    cooldown: 11, duration: 4,
  },
};

export const PAINTS = {
  salvage: { id: 'salvage', name: 'Salvage', hull: 0xc9bc9f, accent: 0xd96a1f, glow: 0xffa040 },
  whiteout: { id: 'whiteout', name: 'Whiteout', hull: 0xdfe3e6, accent: 0x2f8fb0, glow: 0x7fd6e2 },
  canopy: { id: 'canopy', name: 'Canopy', hull: 0x6d7553, accent: 0xc9a227, glow: 0xffd060 },
  nightshift: { id: 'nightshift', name: 'Nightshift', hull: 0x3b3f45, accent: 0xb8322a, glow: 0xff4a3a },
};

export const DEFAULT_LOADOUT = { pilot: 'mercer', sidearm: 'pistol', chassis: 'warden', primary: 'chaingun', secondary: 'seeker', paint: 'salvage' };

// ----------------------------------------------------------------------------- helpers
// Normalised 0..1 ratings for the mech select bars and comparison table. Pilot hull perk is included when given.
export function mechRatings(c, pilot) {
  const hull = c.hull + (pilot?.perk.hull || 0);
  return {
    hull: hull / 165,
    speed: c.walkSpeed / 14,
    armor: (hull / c.armor) / (165 / 0.85),
    firepower: c.firepower / 1.2,
    jets: (c.jetAccel / c.jetBurn) / (76 / 26),
    dash: 0.7 / c.dashCooldown,
  };
}

export const isUnlocked = (item, cleared) => !!item && item.unlock <= cleared;
export const canMount = (chassisId, slot, weaponId) => !!CHASSIS[chassisId]?.hardpoints[slot].includes(weaponId);

// Weapons fitted when switching to a mech: its stock pick if unlocked, otherwise the first unlocked hardpoint.
export function stockLoadout(chassisId, cleared) {
  const c = CHASSIS[chassisId] || CHASSIS.warden;
  const pick = (slot, table) => {
    const stock = c.stock[slot];
    if (isUnlocked(table[stock], cleared)) return stock;
    return c.hardpoints[slot].find((id) => isUnlocked(table[id], cleared)) || c.hardpoints[slot][0];
  };
  return { primary: pick('primary', PRIMARIES), secondary: pick('secondary', SECONDARIES) };
}

// Repairs any saved or requested loadout so it only contains valid, unlocked, mountable parts.
export function sanitizeLoadout(l, cleared) {
  const chassis = isUnlocked(CHASSIS[l?.chassis], cleared) ? l.chassis : 'warden';
  const stock = stockLoadout(chassis, cleared);
  const fit = (slot, table) => {
    const id = l?.[slot];
    return isUnlocked(table[id], cleared) && canMount(chassis, slot, id) ? id : stock[slot];
  };
  return {
    pilot: PILOTS[l?.pilot] ? l.pilot : 'mercer',
    sidearm: SIDEARMS[l?.sidearm] ? l.sidearm : 'pistol',
    chassis,
    primary: fit('primary', PRIMARIES),
    secondary: fit('secondary', SECONDARIES),
    paint: PAINTS[l?.paint] ? l.paint : 'salvage',
  };
}

// Items that become available when `cleared` goes from n-1 to n
export function unlocksAt(n) {
  const out = [];
  for (const [kind, table] of [['Mech', CHASSIS], ['Primary', PRIMARIES], ['Secondary', SECONDARIES]]) {
    for (const item of Object.values(table)) if (item.unlock === n) out.push({ kind, name: item.name, type: item.cls || item.type });
  }
  return out;
}
