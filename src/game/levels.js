// Campaign missions. Each one has its own map (indoor or outdoor), weather, layout, waves and boss.
// platforms: [x, deckHeight, width]   caches: [x, y, pickupType] (weapons caches placed at mission start)
// secrets: pilot-only areas ('rooftop' ledge with ladder, or 'tunnel' crawlspace a mech can't enter)
// secretLoot: [x, y, pickupType] stashes that only the pilot on foot can collect

const YARD_THEME = {
  sky: [[0, '#0a1015'], [0.42, '#1d2226'], [0.66, '#4b3326'], [0.78, '#8a4a26'], [0.86, '#3a2820'], [1, '#171312']],
  fog: [0x3b2a22, 34, 190],
  hemi: [0x8fa6b2, 0x2a1c14, 0.62],
  sun: [0xffb27a, 1.7], sunOffset: [-30, 42, 26],
  rim: [0x7fd6e2, 0.65],
  exposure: 1.15,
};

export const LEVELS = [
  {
    id: 'yard', index: 0, code: 'S9-01', name: 'Freight Yard', map: 'yard',
    location: 'Sector 9 · flooded rail terminal', setting: 'Outdoor', weather: 'Rain', time: 'Dusk',
    brief: 'Drone patrols have taken the old rail terminal. Clear the yard, then break the siege walker holding the gantry.',
    intel: 'Crawler cannons cannot elevate far. Fight from the catwalks when the ground gets crowded.',
    theme: YARD_THEME, rain: true,
    arena: 128, ceiling: null,
    platforms: [[-96, 6, 14], [-62, 9, 10], [-30, 5.5, 14], [4, 8.5, 12], [38, 5.5, 14], [72, 9, 10], [104, 6, 14]],
    caches: [[4, 8.5, 'overdrive'], [-62, 9, 'repair']],
    secrets: [{ type: 'rooftop', x: -114, w: 8, h: 13, ladderX: -109.6 }, { type: 'tunnel', x: 56, w: 10 }],
    secretLoot: [[-114, 13, 'shield'], [-116, 13, 'turret'], [56, 0, 'life']],
    waves: [{ drone: 3, crawler: 1 }, { drone: 4, crawler: 2 }, { drone: 5, crawler: 2 }],
    boss: 'anvil',
  },
  {
    id: 'foundry', index: 1, code: 'S9-02', name: 'Foundry 7', map: 'foundry',
    location: 'Underground smelting hall', setting: 'Indoor', weather: 'Embers', time: 'Interior',
    brief: 'The hostiles are refitting crawlers inside the old smelter. Low ceiling, tight walls, molten channels. Shut it down.',
    intel: 'The ceiling caps your jets. Mortar shells from the boss are marked on the floor before they land.',
    theme: {
      sky: [[0, '#0d0b0a'], [0.5, '#1a1310'], [1, '#2a1a12']],
      fog: [0x24160f, 26, 120],
      hemi: [0xb08060, 0x1a0e08, 0.5],
      sun: [0xffc090, 1.15], sunOffset: [-12, 30, 22],
      rim: [0xff7a30, 0.9],
      exposure: 1.2,
    },
    arena: 78, ceiling: 17,
    platforms: [[-58, 6, 12], [-30, 9.5, 10], [0, 5.5, 14], [30, 9.5, 10], [58, 6, 12]],
    caches: [[0, 5.5, 'coolant'], [-30, 9.5, 'repair']],
    secrets: [{ type: 'rooftop', x: -71, w: 7, h: 12, ladderX: -67.2 }, { type: 'tunnel', x: 44, w: 9 }],
    secretLoot: [[-71, 12, 'heat'], [44, 0, 'shield'], [46, 0, 'freeze']],
    waves: [{ drone: 2, crawler: 3 }, { drone: 3, crawler: 3 }, { drone: 3, crawler: 4 }],
    boss: 'crucible',
  },
  {
    id: 'flats', index: 2, code: 'S9-03', name: 'Salt Flats Relay', map: 'flats',
    location: 'Dry lakebed uplink station', setting: 'Outdoor', weather: 'Dust storm', time: 'Midday',
    brief: 'The relay towers out on the flats are calling in air support. Hold the station and bring down their gunship.',
    intel: 'Wide open ground means drones swarm from every side. The gunship telegraphs its bombing runs with a siren.',
    theme: {
      sky: [[0, '#5d7f96'], [0.45, '#a9bcc4'], [0.62, '#e2d6bf'], [0.7, '#d9c6a2'], [1, '#b7a07c']],
      fog: [0xd3c4a6, 40, 230],
      hemi: [0xdfe8ee, 0x8a7458, 0.85],
      sun: [0xfff1d8, 2.2], sunOffset: [20, 60, 30],
      rim: [0xffe2b0, 0.4],
      exposure: 1.0,
    },
    arena: 140, ceiling: null,
    platforms: [[-100, 7, 12], [-60, 11, 10], [-20, 6, 14], [20, 10, 10], [60, 6, 14], [100, 11, 10]],
    caches: [[20, 10, 'munitions'], [-60, 11, 'plating']],
    secrets: [{ type: 'rooftop', x: 124, w: 9, h: 14, ladderX: 119.2 }, { type: 'tunnel', x: 80, w: 11 }],
    secretLoot: [[124, 14, 'life'], [80, 0, 'turret'], [82, 0, 'repair']],
    waves: [{ drone: 5, crawler: 1 }, { drone: 6, crawler: 2 }, { drone: 7, crawler: 2 }],
    boss: 'harrier',
  },
  {
    id: 'core', index: 3, code: 'S9-04', name: 'Sublevel Reactor', map: 'core',
    location: 'Geothermal reactor, 400 m down', setting: 'Indoor', weather: 'Coolant steam', time: 'Interior',
    brief: 'The rogue heavy frame behind the uprising is dug in at the reactor. Fight down to the core and end it.',
    intel: 'The boss mirrors your moveset: jets, dash, rockets. When it turns red, it will call in drones.',
    theme: {
      sky: [[0, '#05080b'], [0.5, '#0a1218'], [1, '#0d1a20']],
      fog: [0x08141a, 24, 115],
      hemi: [0x6fa8c0, 0x05080a, 0.45],
      sun: [0xa8e6ff, 1.0], sunOffset: [-14, 34, 24],
      rim: [0x3fd6ff, 1.1],
      exposure: 1.25,
    },
    arena: 86, ceiling: 20,
    platforms: [[-62, 7, 12], [-34, 11, 10], [0, 7, 16], [34, 11, 10], [62, 7, 12]],
    caches: [[0, 7, 'overdrive'], [34, 11, 'repair'], [-34, 11, 'plating']],
    secrets: [{ type: 'rooftop', x: -78, w: 7, h: 14, ladderX: -74.2 }, { type: 'tunnel', x: 48, w: 9 }],
    secretLoot: [[-78, 14, 'freeze'], [48, 0, 'life'], [50, 0, 'heat']],
    waves: [{ drone: 4, crawler: 3 }, { drone: 5, crawler: 4 }, { drone: 6, crawler: 4 }],
    boss: 'revenant',
  },
];

// Side ops: optional pilot-only missions. No mech is deployed; you fight on foot with your sidearm.
// They unlock after `unlock` campaign missions and don't affect campaign progress.
export const SIDE_OPS = [
  {
    id: 'tunnels', index: -2, sideOp: true, pilotOnly: true, unlock: 1, difficultyBase: 0,
    code: 'S9-1B', name: 'Service Tunnels', map: 'tunnels',
    location: 'Under the Sector 9 rail terminal', setting: 'Indoor', weather: 'Damp', time: 'Interior',
    brief: 'A drone nest in the old service tunnels is jamming the uplink. The passages are too tight for a frame: go in on foot, clear the nest and take whatever the salvage crews left behind.',
    intel: 'You cannot jet on foot. Climb the ladders to the gantries, and roll (Shift) through incoming fire.',
    theme: {
      sky: [[0, '#07090a'], [0.5, '#0d1113'], [1, '#141a1c']],
      fog: [0x0c1012, 14, 80],
      hemi: [0x9aaab0, 0x0a0b0b, 0.55],
      sun: [0xd6dee2, 0.85], sunOffset: [-10, 30, 20],
      rim: [0x7fd6e2, 0.5],
      exposure: 1.3,
    },
    arena: 60, ceiling: 8.5,
    platforms: [[-40, 4.2, 10], [-12, 4.2, 12], [18, 4.2, 10], [44, 4.2, 10]],
    caches: [[-12, 4.2, 'heat'], [44, 4.2, 'repair']],
    secrets: [{ type: 'rooftop', x: -54, w: 7, h: 5, ladderX: -50.2 }, { type: 'tunnel', x: 30, w: 8 }],
    secretLoot: [[-54, 5, 'shield'], [30, 0, 'life']],
    waves: [{ drone: 3, crawler: 0 }, { drone: 4, crawler: 1 }, { drone: 6, crawler: 1 }],
    boss: null,
  },
];

// Endless mode reuses the Freight Yard map with procedurally growing waves and a boss every 5th wave.
export const ENDLESS = {
  ...LEVELS[0],
  id: 'endless', index: -1, code: 'S9-∞', name: 'Endless Siege',
  brief: 'No extraction. Waves keep coming, and every fifth wave a boss drops in. See how long the frame holds.',
  intel: 'Supply drops arrive at the start of every wave. Bosses rotate in order of the campaign.',
  waves: null, bossEvery: 5, bossRotation: ['anvil', 'crucible', 'harrier', 'revenant'],
  caches: [[4, 8.5, 'repair']],
  secretLoot: [[-114, 13, 'shield'], [56, 0, 'life']],
};

// Finds the mission a menu / briefing refers to: { mode: 'campaign' | 'endless' | 'sideop', levelIndex, levelId }
export function resolveLevel({ mode = 'campaign', levelIndex = 0, levelId = null } = {}) {
  if (mode === 'endless') return ENDLESS;
  if (mode === 'sideop') return SIDE_OPS.find((l) => l.id === levelId) || SIDE_OPS[0];
  return (levelId && LEVELS.find((l) => l.id === levelId)) || LEVELS[levelIndex] || LEVELS[0];
}

export function endlessWave(n) {
  return { drone: 2 + n, crawler: 1 + Math.floor(n / 2) };
}
