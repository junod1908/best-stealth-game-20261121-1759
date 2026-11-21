// The player: Wren, the night archivist. Movement with wall collision, footsteps that
// guards can hear, and the seal pickups. Nothing here knows about guards or the screen:
// it moves the player and reports what happened, as bit flags.

import { FIELD, PLAYER } from './config.js';

export const EVENT_SEAL = 1;
export const EVENT_EXIT = 2;
export const EVENT_STEP = 4;

function circleHitsRect(x, y, radius, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

/** Push the circle out of every solid it overlaps, axis by axis. */
function resolveSolids(player, solids) {
  for (let i = 0; i < solids.length; i += 1) {
    const rect = solids[i];
    if (!circleHitsRect(player.x, player.y, player.radius, rect)) continue;
    // Push out along the smallest overlap.
    const left = player.x - rect.x + player.radius;
    const right = rect.x + rect.w - player.x + player.radius;
    const top = player.y - rect.y + player.radius;
    const bottom = rect.y + rect.h - player.y + player.radius;
    const smallest = Math.min(left, right, top, bottom);
    if (smallest === left) player.x = rect.x - player.radius;
    else if (smallest === right) player.x = rect.x + rect.w + player.radius;
    else if (smallest === top) player.y = rect.y - player.radius;
    else player.y = rect.y + rect.h + player.radius;
  }
}

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    radius: PLAYER.radius,
    facing: -Math.PI / 2,
    sneaking: false,
    moving: false,
    /** Pixels walked since the last footstep sound. */
    stepDistance: 0,
    /** Radius of the noise the last footstep made, for guards to hear. */
    lastNoiseRadius: 0,
    noiseX: start.x,
    noiseY: start.y,
  };
}

/**
 * Move the player one step. `move` is { x, y } of -1/0/1 each, `sneak` holds Shift.
 * Returns EVENT_* flags. `seals` and `exit` come from the level; `exitOpen` says the
 * door is unlocked. Footsteps fire EVENT_STEP every ~46 px walked.
 */
export function stepPlayer(player, dt, move, sneak, solids, seals, exit, exitOpen) {
  let events = 0;
  const speed = sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const length = Math.hypot(move.x, move.y);
  player.sneaking = sneak && length > 0;
  player.moving = length > 0;
  if (length > 0) {
    const nx = move.x / length;
    const ny = move.y / length;
    player.x += nx * speed * dt;
    player.y += ny * speed * dt;
    player.facing = Math.atan2(ny, nx);
    player.stepDistance += speed * dt;
    player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(FIELD.height - player.radius, player.y));
    resolveSolids(player, solids);
    if (player.stepDistance >= 46) {
      player.stepDistance = 0;
      player.lastNoiseRadius = sneak ? PLAYER.sneakNoise : PLAYER.walkNoise;
      player.noiseX = player.x;
      player.noiseY = player.y;
      events |= EVENT_STEP;
    }
  } else {
    player.stepDistance = 0;
  }

  for (let i = 0; i < seals.length; i += 1) {
    const seal = seals[i];
    if (seal.taken) continue;
    if (Math.hypot(player.x - seal.x, player.y - seal.y) < player.radius + 16) {
      seal.taken = true;
      events |= EVENT_SEAL;
    }
  }

  if (exitOpen) {
    const cx = Math.max(exit.x, Math.min(player.x, exit.x + exit.w));
    const cy = Math.max(exit.y, Math.min(player.y, exit.y + exit.h));
    const dx = player.x - cx;
    const dy = player.y - cy;
    if (dx * dx + dy * dy < (player.radius + 6) * (player.radius + 6)) {
      events |= EVENT_EXIT;
    }
  }
  return events;
}

/** True when the point stands inside any lamp's light pool. */
export function isLit(x, y, lamps) {
  for (let i = 0; i < lamps.length; i += 1) {
    const lamp = lamps[i];
    if (Math.hypot(x - lamp.x, y - lamp.y) < lamp.r) return true;
  }
  return false;
}

/** True when the point stands inside a shadow patch. */
export function isShadowed(x, y, shadows) {
  for (let i = 0; i < shadows.length; i += 1) {
    const s = shadows[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}
