# LUMEN DRIFT — hold the light

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ChristaNavisa/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ChristaNavisa/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A top-down arena shooter about an orb of light outlasting the dark. Built
from scratch for make.fun's best-game-01: plain HTML, CSS and ES modules,
no build step, no network, no libraries. All art is drawn in code and all
sound is synthesized with WebAudio.

## How to play

Open `game/index.html` in desktop Chrome (or serve the folder with any
static server, e.g. `node serve.ts`).

- **WASD / arrow keys** — move
- **Mouse** — aim
- **Hold click** — fire
- **Shift / Space / right click** — dash (briefly invulnerable, 1.4 s cooldown)
- **P** — pause, **M** — mute, **R** — restart after game over

## The loop

Shadow wisps drift in from the edges in waves. Blast them and gather the
embers they drop — each ember is worth 10 points times your combo, and
kills chained within 3 seconds raise the combo up to ×8. Clearing a wave
pays a bonus of 50 × the wave number, then offers three upgrade cards —
pick one (keys 1/2/3 or click) and the next wave comes in thicker. Your
build is yours: rapid fire, heavy rounds, split shot, an extra heart, a
quicker dash, a wider ember vacuum or more speed, stacking wave after wave.

- **Wisp** — drifts toward you.
- **Spitter** — keeps its distance and fires bolts.
- **Splitter** — breaks into two minis when destroyed.
- **Dasher** — drifts in, flashes a warning, then lunges at you in a burst.
- **Brute** — slow, tough, worth the most.

Dropped pickups: **heart** (restore 1 HP, up to 5), **spread shot**
(three-way fire for 10 s), **shield** (absorbs one hit), **magnet**
(pulls embers to you for 8 s). You have 3 HP; a hit costs one and grants
1.2 s of invulnerability. Survive as long as you can — the best score is
kept in `localStorage`.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game in
Chromium, taken deterministically with `?seed=1`:

1. `1-start.jpg` — title screen (`?shot=start&seed=1`)
2. `2-play.jpg` — wave 3 in progress (`?shot=play&seed=1`)
3. `3-end.jpg` — game over screen, score 5390 at wave 6 (`?shot=end&seed=1`)
4. `4-upgrade.jpg` — the upgrade choice after clearing wave 1 (`?shot=upgrade&seed=1`)

`?shot=` runs the game headlessly with a built-in autopilot and sets
`window.__shotReady` when the frame is ready, so the same seed always
produces the same frame. The end scene's pilot is deliberately clumsy —
it shoots but never dashes and drifts at half speed — so it is caught out
once the waves thicken.

## Source layout

```
game/
  index.html      page shell, canvas, HUD text
  src/
    config.js     tuning: field, player, enemies, waves, pickups, combo
    random.js     seeded mulberry32 RNG
    input.js      keyboard + mouse state
    audio.js      synthesized WebAudio effects
    entities.js   factories for player, enemies, bullets, pickups, shards
    upgrades.js   the between-wave upgrade pool, card layout and applying a pick
    world.js      the rules: waves, spawning, kills, combo, scoring, pickups
    render.js     all drawing: background, enemies, player, HUD, screens
    shots.js      autopilot + deterministic screenshot scenes
    main.js       boot, fixed-step loop, screens, pause, best score
```

`main.ts` (root) copies `game/` and `screenshots/` to `/output` and
writes `/output/dossier.json` with `buildDossier` from
`vendor/makefun-game.ts`, exactly as the kit's starter does.
`vendor/makefun-game.ts` is the kit's copy, unchanged. License: MIT.
