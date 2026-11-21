// The game's rules and state, with no drawing and no browser in it: the level, the
// player, the guards, the detection meter, seals, score, lives and time. step() advances
// one fixed step and returns what happened as bit flags, so the caller can play sounds
// and change screens without the world knowing about them. Levels are hand-made and the
// seed is fixed, so the same load always plays the same game.

import { DETECTION, FIELD, FIXED_SEED, GUARD, LIVES, PLAYER, SCORE } from './config.js';
import { LEVELS } from './levels.js';
import { createRandom } from './random.js';
import { createGuard, detectionRate, GUARD_ALERTED, GUARD_CALM, GUARD_SUSPICIOUS, guardSees, stepGuard } from './guards.js';
import { createPlayer, EVENT_EXIT as PLAYER_EXIT, EVENT_SEAL as PLAYER_SEAL, EVENT_STEP as PLAYER_STEP, isLit, isShadowed, stepPlayer } from './player.js';

// The world's own event flags. They deliberately differ from the player module's
// (SEAL 1, EXIT 2, STEP 4): a footstep must never read as a win.
export const EVENT_SEAL = 1;
export const EVENT_CLEAR = 2;
export const EVENT_WIN = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_OVER = 16;
export const EVENT_ALERT = 32;
export const EVENT_SUSPICIOUS = 64;
export const EVENT_STEP = 128;
export const EVENT_LOST = 256;

export function createWorld(seed = FIXED_SEED) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    guards: [],
    seals: [],
    player: null,
    meter: 0,
    score: 0,
    lives: LIVES,
    time: 0,
    levelTime: 0,
    exitOpen: false,
    /** True until any guard is alerted on this level (the ghost bonus). */
    ghost: true,
    /** The last footstep's noise, for the renderer to draw as a ripple. */
    lastStep: null,
  };
  let clickTarget = null;

  function freshGuards() {
    // One seeded roll per guard, so the same seed always gives the same patrols.
    const random = createRandom(seed + state.levelIndex * 7919);
    return state.level.guards.map((spec) => {
      const guard = createGuard(spec, state.level.speed, random() * 0.6 - 0.3);
      guard.seenFor = 0;
      guard.nearMissed = false;
      return guard;
    });
  }

  function loadLevel(index) {
    state.levelIndex = index;
    state.level = LEVELS[index];
    state.guards = freshGuards();
    state.seals = state.level.seals.map((seal) => ({ x: seal.x, y: seal.y, taken: false }));
    state.player = createPlayer(state.level.playerStart);
    state.meter = 0;
    state.levelTime = 0;
    state.exitOpen = false;
    state.ghost = true;
    state.lastStep = null;
    clickTarget = null;
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.time = 0;
    loadLevel(0);
  }

  function respawn() {
    state.player = createPlayer(state.level.playerStart);
    state.guards = freshGuards();
    state.meter = 0;
    clickTarget = null;
  }

  function setClickTarget(point) {
    clickTarget = point;
  }

  /**
   * One fixed step. `move` is { x, y } of -1/0/1 each from the held keys; `sneak`
   * holds Shift. With no keys held, a click target steers the player instead.
   */
  function step(dt, move, sneak) {
    let events = 0;
    const level = state.level;
    const player = state.player;
    state.time += dt;
    state.levelTime += dt;

    let steer = move;
    if (move.x === 0 && move.y === 0 && clickTarget !== null) {
      const dx = clickTarget.x - player.x;
      const dy = clickTarget.y - player.y;
      if (Math.hypot(dx, dy) < 10) {
        clickTarget = null;
      } else {
        steer = { x: Math.abs(dx) > 4 ? Math.sign(dx) : 0, y: Math.abs(dy) > 4 ? Math.sign(dy) : 0 };
      }
    }

    const playerEvents = stepPlayer(player, dt, steer, sneak, level.solids, state.seals, level.exit, state.exitOpen);
    if (playerEvents & PLAYER_SEAL) {
      state.score += SCORE.seal;
      events |= EVENT_SEAL;
      if (state.seals.every((seal) => seal.taken)) state.exitOpen = true;
    }
    if (playerEvents & PLAYER_STEP) {
      events |= EVENT_STEP;
      state.lastStep = { x: player.x, y: player.y, radius: player.lastNoiseRadius, age: 0 };
    }
    if (playerEvents & PLAYER_EXIT) {
      const timeBonus = Math.max(0, SCORE.timeBonusBase - Math.floor(state.levelTime) * SCORE.timeBonusPerSecond);
      state.score += SCORE.levelClear + timeBonus + (state.ghost ? SCORE.ghostBonus : 0);
      if (state.levelIndex + 1 >= LEVELS.length) {
        events |= EVENT_WIN;
      } else {
        loadLevel(state.levelIndex + 1);
        events |= EVENT_CLEAR;
      }
      return events;
    }

    // Light and shadow where the player stands decide how fast the meter moves.
    const lit = isLit(player.x, player.y, level.lamps);
    const shadowed = isShadowed(player.x, player.y, level.shadows);
    const lightMultiplier = lit ? DETECTION.litMultiplier : shadowed ? DETECTION.shadowMultiplier : 1;

    // Detection: each guard that sees the player fills the meter after a short grace;
    // a glimpse cut short inside the grace window is a near miss and still raises it.
    let anyoneSees = false;
    let wasAlerted = state.meter >= DETECTION.alertedAt;
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      const seen = guardSees(guard, player.x, player.y, level.solids);
      if (seen) {
        anyoneSees = true;
        guard.seenFor += dt;
        guard.nearMissed = false;
        if (guard.seenFor > PLAYER.graceSeconds) {
          const before = state.meter;
          state.meter = Math.min(DETECTION.alertedAt, state.meter + detectionRate(guard, player.x, player.y, lightMultiplier) * dt);
          if (before < DETECTION.suspiciousAt && state.meter >= DETECTION.suspiciousAt && !wasAlerted) {
            events |= EVENT_SUSPICIOUS;
          }
        }
      } else {
        if (guard.seenFor > 0 && guard.seenFor <= PLAYER.graceSeconds && !guard.nearMissed) {
          guard.nearMissed = true;
          state.meter = Math.min(DETECTION.alertedAt, state.meter + DETECTION.nearMissPenalty);
          if (state.meter >= DETECTION.suspiciousAt && !wasAlerted) events |= EVENT_SUSPICIOUS;
        }
        guard.seenFor = 0;
      }
    }
    if (!anyoneSees) {
      state.meter = Math.max(0, state.meter - DETECTION.decayPerSecond * dt);
    }

    if (state.meter >= DETECTION.alertedAt && !wasAlerted) {
      events |= EVENT_ALERT;
      state.ghost = false;
      for (let i = 0; i < state.guards.length; i += 1) {
        const guard = state.guards[i];
        guard.state = GUARD_ALERTED;
        guard.stateTime = 0;
        guard.lastSeenX = player.x;
        guard.lastSeenY = player.y;
        guard.lostSightFor = 0;
      }
    }

    // Guards move. A fresh footstep is heard by calm guards inside its noise radius.
    const stepped = Boolean(playerEvents & PLAYER_STEP);
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      const seen = guardSees(guard, player.x, player.y, level.solids);
      let heard = false;
      let hx = 0;
      let hy = 0;
      if (stepped && guard.state === GUARD_CALM) {
        const d = Math.hypot(guard.x - player.x, guard.y - player.y);
        if (d < player.lastNoiseRadius) {
          heard = true;
          hx = player.x;
          hy = player.y;
        }
      }
      const guardEvents = stepGuard(guard, dt, { seen, px: player.x, py: player.y, heard, hx, hy }, level.speed);
      if (guardEvents & 1) events |= EVENT_SUSPICIOUS;
      if (guardEvents & 2) {
        // Caught.
        state.lives -= 1;
        events |= EVENT_CAUGHT;
        if (state.lives <= 0) {
          events |= EVENT_OVER;
          return events;
        }
        respawn();
        return events;
      }
      if (guardEvents & 4) events |= EVENT_LOST;
      // A guard that half-saw you turns suspicious on its own: point it at you.
      if (guard.state === GUARD_CALM && state.meter >= DETECTION.suspiciousAt && state.meter < DETECTION.alertedAt) {
        guard.state = GUARD_SUSPICIOUS;
        guard.stateTime = 0;
        guard.investigateX = player.x;
        guard.investigateY = player.y;
      }
    }

    if (state.lastStep !== null) {
      state.lastStep.age += dt;
      if (state.lastStep.age > 0.6) state.lastStep = null;
    }
    return events;
  }

  reset();
  return { state, reset, step, loadLevel, setClickTarget };
}

export { FIELD, GUARD };
