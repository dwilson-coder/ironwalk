# IRONWALK

A side-view mech combat game for the browser. Pilot a customizable salvage mech through a four-mission campaign across indoor and outdoor maps. Each mission ends in a boss fight, and an Endless mode is unlocked from the start.

- **Engine:** three.js (plain JavaScript modules) with real-time shadows, ACES tone mapping, pooled particles and weather
- **UI:** React 18
- **Motion graphics:** Framer Motion
- **Build tool:** Vite
- **Assets:** none. Every texture, model and sound is generated in code, so there are no art files to license.

All characters, names and designs are original.

---

## Quick start

You need Node.js 18 or newer.

```bash
npm install
npm run dev        # local dev server, usually http://localhost:5173
npm run build      # static site in /dist (works on itch.io, GitHub Pages, Netlify, Vercel)
npm run preview    # serve /dist locally
npm run sim        # headless playtest: plays every mission, boss, weapon and menu flow (see Testing)
```

---

## Controls

**In the mech**

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Walk | A / D or ← → | ◀ ▶ |
| Jump, hold for jump jets | Space / W / ↑ | JETS |
| Aim | Mouse | Auto-aim |
| Primary weapon | Left mouse / J | FIRE |
| Secondary system | Right mouse / Q | ALT |
| Mech skill | R | SKILL |
| Boost dash | Shift | DASH |
| Slam down / drop through a catwalk | S / ↓ | — |
| Fire pickup rockets (heat-seeking / turret) | G | RKT |
| Force field (spends 20% of the meter, 3 s) | F | FIELD |
| Eject | X | EJECT |

**On foot (pilot)**

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Run | A / D or ← → | ◀ ▶ |
| Jump | Space | JUMP |
| Climb ladders | W / S or ↑ ↓ | ▲ ▼ |
| Drop through a catwalk | S / ↓ (away from a ladder) | ▼ |
| Sidearm | Left mouse / J | FIRE |
| Fire pickup rockets | G, right mouse or Q | RKT |
| Force field | F | FIELD |
| Roll (brief invulnerability) | Shift | ROLL |
| Board a parked mech | E (stand beside it) | BOARD |

**Anywhere**

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Pause (Resume · Restart · Quit) | P / Esc, or the PAUSE button | PAUSE button (top right) |
| Mini map on/off | M, or the MAP button | MAP button (top right) |
| Mute | N | Pause menu → Sound |
| Deploy from the briefing screen | Enter / Space | Deploy button |

## Game flow

```
Boot loader → Title ─┬─ Campaign → Mission select → Pilot select → Mech select → Briefing loader → Mission → Debrief ─→ next mission
                     │            └─ Side op → Pilot select ──────────────→ Briefing loader → On foot → Debrief → Mission select
                     ├─ Endless ─────────────────→ Pilot select → Mech select → Briefing loader → Endless run → Game over
                     └─ Hangar (mech select / refit, pilot chip to change pilot)
```

- **Boot loading screen:** the engine boots in 8 real stages while a blueprint of the mech draws itself.
- **Mission loading screen (briefing):** while the map builds and its shaders compile, the screen shows the mission name, conditions, objectives, expected enemies, an intel tip, and a tactical map that draws in the catwalks, cache locations, deploy point and boss position. The Deploy button pulses once everything is ready; Enter or Space also deploys.
- **Debrief:** mission score (and whether it's a new best), the boss result (with a bonus for beating it without taking damage), accuracy, caches collected, and any new hardware you unlocked.

## Campaign maps

| # | Mission | Setting | Weather | Layout | Boss |
|---|---|---|---|---|---|
| S9-01 | Freight Yard | Outdoor, dusk | Rain | ±128 m lane, 7 catwalks | **ANVIL**, siege walker |
| S9-02 | Foundry 7 | Indoor smelting hall | Embers | ±78 m, 17 m ceiling, molten channel, swinging crane hooks | **CRUCIBLE**, siege tank |
| S9-03 | Salt Flats Relay | Outdoor, midday | Dust storm | ±140 m, relay towers, mesas | **HARRIER**, strike gunship |
| S9-04 | Sublevel Reactor | Indoor reactor | Coolant steam | ±86 m, 20 m ceiling, pulsing reactor core | **REVENANT**, rogue heavy mech |

Indoor maps have a ceiling that caps your jets (and the drones). Each map is built in `src/game/world.js` from the data in `src/game/levels.js`. To add a mission, add an entry to `LEVELS` and a `map` branch in `buildLevel()`.

## Boss fights (`src/game/bosses.js`)

Every boss gets a cinematic intro (black letterbox bars, warning tape and a name reveal) and a health bar with a marker at 50%. At half health each boss switches to a harder phase two.

| Boss | Phase one | Phase two |
|---|---|---|
| ANVIL | Drops from orbit, burst fire, shoulder-charge | 5-round bursts, charges more often, every charge ends in a shockwave |
| CRUCIBLE | Rolls in from the edge of the hall, crushes you with its treads, mortar volleys with landing markers on the floor, twin-cannon bursts | 5-shell volleys, launches drones from its furnace |
| HARRIER | Fires a fan of shots from a hover, then flies bombing runs announced by a siren | Faster runs, homing missiles |
| REVENANT | Uses your own moves: jump jets, dashes, burst fire, seeker rockets | Turns red, calls in drones at 50% and 25% health, everything faster |

Beating a boss without taking any damage adds +1,500 points.

## Mech customization (`src/game/loadout.js`)

The hangar shows your mech in the 3D scene, close up. It updates the moment you change a part, and comparison bars show the difference. Items unlock as you clear campaign missions.

| Slot | Options (unlock) |
|---|---|
| Frame | **Warden-7** medium (start) · **Kestrel-3** light, fast, long jets (after S9-01) · **Bastion-9** heavy, 150 hull, −15% damage taken, bigger stomp (after S9-02) |
| Primary | **M-40 Rotary** chaingun (start) · **Breach-12** 8-slug scattergun (after S9-01) · **Lance Railgun**, instant shot that pierces every enemy in line (after S9-03) |
| Secondary | **Seeker Pod**, 4 homing rockets (start) · **Hammer Mortar**, 3 shells lobbed at your reticle (after S9-02) · **Aegis Barrier**, frontal shield that blocks all incoming fire for 4 s (after S9-03) |
| Paint | Salvage · Whiteout · Canopy · Nightshift |

Each frame and weapon changes the mech's 3D model, not just its stats: the light frame has fins and a raked cockpit, the heavy frame has armor plating and shin guards, and each gun and secondary has its own model.

## Pilots (`PILOTS` in `src/game/loadout.js`)

| Pilot | Type | Perk | On foot (Phase 4) |
|---|---|---|---|
| Cole Mercer "HAMMER" | Male | **Hardened**: +15 max hull on any mech | 100 health · 7 m/s |
| Ana Reyes "VESPER" | Female | **Overclock**: mech skill recharges 25% faster | 90 health · 8.2 m/s |
| TK-9 "Tinker" | Android | **Field repair**: +2 hull/s after 4 s without taking damage | 120 health · 6.5 m/s |

Each pilot has a code-drawn portrait (`src/components/PilotPortrait.jsx`) and picks a sidearm for on-foot combat: **P9 Marksman** pistol, **Vespa SMG** or **Breacher-6** shotgun (`SIDEARMS`).

## Mechs (`CHASSIS` in `src/game/loadout.js`)

| Mech | Unlock | Hull | Speed | Firepower | Skill (R) | Weakness | Hardpoints |
|---|---|---|---|---|---|---|---|
| Warden-7 | start | 100 | 11 | 100% | **Reactor Surge**: 6 s no heat, +25% fire rate | Runs hot (+10% heat) | everything |
| Kestrel-3 | S9-01 | 75 | 14 | 85% | **Afterburner**: 4 s infinite jets, near-instant dash | Takes 15% more damage | chaingun, scattergun · seekers, barrier |
| Bastion-9 | S9-02 | 150 | 8.5 | 120% | **Fortify**: 5 s planted, −60% damage taken, +30% dealt | Slowest, shortest jets | chaingun, scattergun, railgun · seekers, mortar |
| Spectre-2 | S9-03 | 70 | 12.5 | 90% | **Ghost Cloak**: 4.5 s, aimed shots go wide, missiles lose lock | Glass frame (+10% damage taken) | railgun, chaingun · barrier, seekers |

Picking a mech fits its stock weapons, and the hangar only lets you mount weapons its hardpoints accept. Hovering a mech previews its stats against your current one, and a table compares all four in real units.

## In-battle pickups (`src/game/pickups.js`)

Pickups show up three ways: **weapons caches** placed on catwalks at the start of each mission, **supply drops** that parachute in during waves and boss fights, and occasional loot from destroyed enemies. Each crate has a colored beacon so you can spot it, and it blinks before it expires.

| Pickup | Effect |
|---|---|
| Repair kit | +35 hull (drops more often when your hull is low) |
| Coolant flush | No weapon heat for 10 s |
| Overdrive | ×1.5 damage for 12 s |
| Munitions cache | Secondary reloaded instantly, and recharges 65% faster for 10 s |
| Reactive plating | −50% damage taken for 12 s |

Active pickups show in the HUD as colored chips with a countdown bar.

Phase 3 added weapon drops and support pickups. Every pickup has its own color and icon; the same SVG icon is painted on the crate and shown in the HUD.

| Pickup | Color | Effect |
|---|---|---|
| Health | green | +35 health to whatever you control (frame or pilot) |
| Heat-seeking rockets | red | +6 rockets on G. Each one locks the nearest enemy and re-acquires a new target if it dies |
| Turret rockets | amber | +6 rockets on G. They fly at the reticle and keep steering toward it, then detonate there |
| Force field cell | blue | +20% to the force field meter on the health bar. F spends 20% for 3 s of invulnerability |
| Extra life | pink | +1 life (max 3), shown as hearts on the health bar. When the pilot is killed you auto-continue in a fresh frame with 3 s of protection |
| Freeze | ice white | Every enemy on screen stops for 3 s (off-screen enemies are unaffected) |

Carrying a different rocket type replaces the old one; the same type stacks to 12.

## Pilot on foot (Phase 4)

- **Eject** with X at any time. The frame parks and auto-defends: it tracks the nearest hostile within 34 m and fires short bursts. Walk back to it and press E to board.
- **Frame destroyed:** the pilot auto-ejects with at most 50% health, and a replacement frame drops in after **25 seconds** (the HUD counts down). It lands, parks and covers you until you climb in. Ejecting before the frame blows keeps your full pilot health.
- The pilot has **their own health bar** (from the pilot's on-foot stats), uses the **sidearm** chosen at pilot select, can **roll** through fire and **collects pickups**.
- **Ladders** lead up to every catwalk. **Rooftop ledges** (dashed on the mini map) only hold a pilot; a frame falls through them. **Crawlspaces** have a 2.6 m roof that a frame can't fit under.
- **Secret areas** (one rooftop + one crawlspace per mission, marked `?` on the briefing map and mini map): entering one pays +500, and each hides pilot-only stashes.
- **Side ops:** pilot-only missions with no frame. *S9-1B Service Tunnels* unlocks after the first campaign mission, pays score and doesn't change campaign progress.

## Score tracking

- Kills made within 3 seconds of each other build a chain, and every 3 kills in a chain raise the multiplier by 0.5, up to ×4. Bonuses for clearing waves, clearing missions and beating bosses without damage.
- Your score carries across the whole campaign. Retrying a mission restores the score you had when that mission started.
- Each mission's best score is saved, along with which missions you've cleared and your loadout (`src/store/progress.js`).
- The top 10 leaderboard records initials and how far you got (e.g. `S9-03 · W2`, `Wave 14` or `Campaign clear`) (`src/store/scores.js`).

---

## Project structure

```
src/
  App.jsx                    switches between screens by phase
  styles.css                 design tokens and all UI styling
  store/
    gameStore.js             store + event bus linking the engine to React
    scores.js                leaderboard and career stats
    progress.js              campaign progress, saved loadout, per-mission bests
  game/
    Engine.js                renderer, shared context (ctx), screen flow, camera, main loop
    levels.js                campaign missions + endless definition
    world.js                 builds each map (yard / foundry / flats / core) as a swappable group
    loadout.js               frames, primaries, secondaries, paints, unlock rules
    player.js                movement, weapons, pickup effects, barrier
    weapons.js               bullets, railgun beams, rockets, mortars, enemy fire, explosions
    enemies.js               drone + crawler models and AI, enemy director (spawn/hurt/kill)
    bosses.js                ANVIL, CRUCIBLE, HARRIER, REVENANT
    pickups.js               caches, supply drops, loot, pilot-only stashes
    support.js               force field meter, extra lives, pickup rockets, freeze (Phase 3)
    pilot.js                 pilot on foot: movement, ladders, roll, sidearm, secrets (Phase 4)
    waves.js                 mission director: waves → boss → victory, endless generator
    scoring.js               run stats, chains, popups
    mech.js                  procedural mech model with frame/weapon variants, walk cycle
    effects.js · textures.js · audio.js · input.js · config.js · util.js
  components/                Loading, Title, MissionSelect, Hangar, Briefing, HUD, BossIntro,
                             Banner, ScorePopups, PauseMenu, Debrief, GameOver, ScoreEntry…
scripts/sim/                 headless playtest (three.js replaced by a lightweight stand-in)
```

Gameplay systems never import each other directly. They share one `ctx` object (`ctx.player`, `ctx.weapons`, `ctx.director`, `ctx.pickups`, `ctx.waves`, `ctx.score`), so each one can be swapped out or tested on its own.

## Testing

`npm run sim` runs the real game logic in Node with three.js replaced by a lightweight stand-in. A scripted bot:

- plays all four campaign missions, including each boss fight through phase two
- checks that the ceilings, weapons caches, supply drops, debriefs, unlocks and saved progress all behave correctly
- fires all 27 combinations of frame, primary and secondary
- applies every pickup and tests the barrier from the front and from behind
- Phase 3: every pickup type, rocket stacking, heat-seekers vs turret rockets, force field timing and cost, extra lives, freeze (on-screen only)
- Phase 4: eject / board, pilot health, sidearm, roll, parked auto-defend, ladders, pilot-only ledges, crawlspace blocking, secrets, the 25 s replacement drop, auto-continue, game over on foot, and the Service Tunnels side op
- plays Endless up to wave 11, then tests pause, death, retry and returning to the menu

The run fails on any exception or invalid (NaN) position. It's a quick way to catch regressions after you change gameplay code.

## Tuning

| Want | Where |
|---|---|
| Frame feel (speed, jets, hull) | `CHASSIS` in `loadout.js` |
| Weapon damage, rate of fire, heat | `PRIMARIES` / `SECONDARIES` in `loadout.js`, `ROCKETS` / `MORTAR` in `config.js` |
| Wave sizes per mission | `waves` in `levels.js` |
| Boss health and score | top of each boss in `bosses.js` |
| Pickup drop rate and effects | `PICKUPS`, `PICKUP_DROP_CHANCE` in `config.js` |
| Force field, lives, rocket cap | `SUPPORT` in `config.js` |
| Pilot movement, eject, replacement timer, secret bonus | `PILOT`, `MECH_REPLACEMENT_SECONDS`, `SECRET_BONUS` in `config.js` |
| Scoring | `SCORING` in `config.js` |

## License

The code is yours to use and change. Fonts come from Fontsource and use the SIL Open Font License.

## Changelog

**0.8 · Phases 3 + 4: pickups and the pilot on foot**
- Six new pickups with distinct colors and icons: Health, Heat-seeking rockets, Turret rockets, Force field cell, Extra life, Freeze (kept the four existing buffs).
- Force field meter and extra lives shown on the health bar; F for 3 s of invulnerability, G for pickup rockets.
- Pilot on foot with their own health bar, sidearm, roll, ladders and pickups. Eject (X) / board (E); parked frames auto-defend.
- Frame destroyed → auto-eject, survive 25 s, replacement frame drops in.
- Ladders on every catwalk, pilot-only rooftop ledges and crawlspaces, two secret areas per map with stashes and a +500 bonus.
- Side op S9-1B Service Tunnels: a pilot-only indoor mission.
- Enemies, bosses and pickups target "whatever you control" (`ctx.T`), so everything works the same in or out of the frame.

**0.7 · Phase 2: pilots and mech select**
- Pilot select screen with three pilots (male, female, android), code-drawn animated portraits, a passive perk each, and on-foot stats.
- Pilot sidearm choice (pistol, SMG, shotgun), stored now and used on foot from Phase 4.
- Mech select replaces the old hangar: four mechs (new: Spectre-2), each with a skill on R, a weakness, a firepower rating and hardpoints that limit which weapons it can mount. Includes preview-vs-current stat bars and a comparison table.
- HUD skill slot, touch SKILL button, `npm run sim` now covers pilots, hardpoints and all four skills.

**0.6 · Phase 1: quick fixes and core controls**
- Renamed to IRONWALK. Old `ironwake.*` saves (scores, progress, initials) are copied to `ironwalk.*` on first launch (`src/store/storage.js`).
- The title and loading-screen logo stay on one line at every screen size: they're sized to their container (`cqi`), with `src/ui/FitText.jsx` shrinking the text if it still overflows.
- On-screen PAUSE button, plus P / Esc. The pause overlay has Resume, Restart and Quit, and Restart and Quit ask you to confirm.
- Mini map (`src/components/Minimap.jsx`) toggled with M or the MAP button. It shows the whole lane, catwalks, ceiling, enemies, the boss, pickups, your camera view and you. It's drawn on a canvas at 20 fps, and its on/off state is remembered.
- Mute moved from M to N. Mute and mini map settings persist across sessions.
