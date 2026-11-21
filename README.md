# Silent Stacks

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/junod1908/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/junod1908/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

A top-down stealth game for the [best stealth game bounty](https://make.fun/bounty/best-stealth-game-20261121-1759) on make.fun.

You are Wren, the night archivist of the Grand Archive. Three seals are missing.
Slip past the wardens, take them back, and leave unseen.

## How to play

- **Move:** WASD or arrow keys — or click anywhere to walk there.
- **Sneak:** hold Shift — slower, quieter, harder to hear.
- **Goal:** collect all three seals on a wing, then slip out the exit door.
- **Wardens:** each one sweeps a vision cone along its patrol. Shelves and crates
  block their sight. Lamplight betrays you (seen faster); shadow hides you
  (seen slower).
- **Detection:** a glimpse fills the meter after a short grace; a near miss still
  raises it a little. Break line of sight to cool down. At full meter a warden
  chases you — get caught and you lose a life and restart the wing.
- **Sound:** footsteps, alert stings and pickup chimes are synthesised live
  with WebAudio. M mutes.

Three hand-made wings, rising difficulty: The Reading Room, The Gallery,
The Vault Wing. Seals, a time bonus and a ghost bonus (never chased) make the
score; the best score is kept in the browser.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request: `game/` is plain static files. Screenshots are
real renders of the game's own code, staged deterministically with `?shot=`:

- `?shot=title` — title screen over the patrolling archive
- `?shot=play` — mid-game, cones sweeping, seals waiting
- `?shot=alert` — spotted, a warden giving chase
- `?shot=win` — all three wings cleared

## Layout

- `game/index.html` — the page, canvas only
- `game/src/config.js` — every tuning number and colour
- `game/src/levels.js` — the three hand-made wings
- `game/src/guards.js` — patrols, vision cones, calm / suspicious / alerted
- `game/src/player.js` — movement, collision, footsteps, seals, exit
- `game/src/world.js` — the rules: detection meter, score, lives, wings
- `game/src/render.js` — all canvas drawing: floor, light, cones, HUD, panels
- `game/src/audio.js` — WebAudio synthesis, no audio files
- `game/src/input.js` — keyboard, sneak, click-to-walk
- `game/src/shots.js` — staged screenshot scenes with a small autopilot
- `game/src/main.js` — boot and the fixed-step loop
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`
- `serve.ts` — a tiny static server for local play
