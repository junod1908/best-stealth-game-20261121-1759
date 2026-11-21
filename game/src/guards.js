// The wardens: patrol waypoints, vision cones, and the three states of suspicion.
//
// A guard is calm while it walks its round, suspicious when it half-saw something (it
// stops, stares, then walks over to look), and alerted when the detection meter fills (it
// chases you). Losing sight while alerted sends it back to the last place it saw you,
// then to its round. Nothing here draws or listens to input: it only moves guards and
// reports what happened, as bit flags, so the caller can play sounds and update the HUD.

import { DETECTION, GUARD, STEP } from './config.js';

export const GUARD_CALM = 0;
export const GUARD_SUSPICIOUS = 1;
export const GUARD_ALERTED = 2;

export const EVENT_SPOTTED = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_LOST = 4;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** True when the segment (x1,y1)-(x2,y2) touches the rectangle. Slab method. */
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** True when nothing solid stands between the guard and the point. */
export function hasLineOfSight(guard, x, y, solids) {
  for (let i = 0; i < solids.length; i += 1) {
    if (segmentHitsRect(guard.x, guard.y, x, y, solids[i])) return false;
  }
  return true;
}

/**
 * True when the guard can see the point right now: inside range, inside the cone's
 * angle, and with a clear line of sight. `cone` is the guard's current half-angle.
 */
export function guardSees(guard, x, y, solids, range = GUARD.sightRange) {
  const d = dist(guard.x, guard.y, x, y);
  if (d > range) return false;
  if (d > 4) {
    let angle = Math.atan2(y - guard.y, x - guard.x) - guard.facing;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    if (Math.abs(angle) > GUARD.sightHalfAngle) return false;
  }
  return hasLineOfSight(guard, x, y, solids);
}

/**
 * A fresh guard at the first waypoint, facing along its round. `pauseJitter` (seconds,
 * fixed per guard) varies how long it lingers at each waypoint, so two guards on the
 * same round do not march in lockstep.
 */
export function createGuard(spec, speed, pauseJitter = 0) {
  const [x, y] = spec.waypoints[0];
  const [nx, ny] = spec.waypoints[1] ?? spec.waypoints[0];
  const guard = {
    x, y,
    facing: Math.atan2(ny - y, nx - x),
    waypoint: 1,
    pauseLeft: 0,
    state: GUARD_CALM,
    stateTime: 0,
    investigateX: x,
    investigateY: y,
    lastSeenX: x,
    lastSeenY: y,
    lostSightFor: 0,
    speed,
    pause: spec.pause,
    pauseJitter,
    waypoints: spec.waypoints,
  };
  return guard;
}

function moveToward(guard, tx, ty, speed, dt) {
  const d = dist(guard.x, guard.y, tx, ty);
  if (d < 0.5) return true;
  const step = Math.min(d, speed * dt);
  guard.x += ((tx - guard.x) / d) * step;
  guard.y += ((ty - guard.y) / d) * step;
  guard.facing = Math.atan2(ty - guard.y, tx - guard.x);
  return d - step < 0.5;
}

function turnToward(guard, tx, ty, dt) {
  const wanted = Math.atan2(ty - guard.y, tx - guard.x);
  let diff = wanted - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = 4.5 * dt;
  guard.facing += Math.max(-turn, Math.min(turn, diff));
}

/**
 * Advance one guard one step. `senses` carries what this guard knows about the player:
 * { seen, px, py, heard, hx, hy } — heard is a fresh footstep noise this step.
 * Returns EVENT_* flags. The shared detection meter lives in the caller.
 */
export function stepGuard(guard, dt, senses, levelSpeed) {
  let events = 0;
  guard.stateTime += dt;
  const patrol = GUARD.patrolSpeed * levelSpeed;
  const investigate = GUARD.investigateSpeed * levelSpeed;
  const chase = GUARD.chaseSpeed * levelSpeed;

  if (guard.state === GUARD_ALERTED) {
    if (senses.seen) {
      guard.lastSeenX = senses.px;
      guard.lastSeenY = senses.py;
      guard.lostSightFor = 0;
    } else {
      guard.lostSightFor += dt;
    }
    if (guard.lostSightFor > GUARD.chaseMemorySeconds) {
      guard.state = GUARD_SUSPICIOUS;
      guard.stateTime = 0;
      guard.investigateX = guard.lastSeenX;
      guard.investigateY = guard.lastSeenY;
      events |= EVENT_LOST;
    } else {
      moveToward(guard, guard.lastSeenX, guard.lastSeenY, chase, dt);
      if (dist(guard.x, guard.y, senses.px, senses.py) < GUARD.catchDistance) {
        events |= EVENT_CAUGHT;
      }
    }
    return events;
  }

  if (guard.state === GUARD_SUSPICIOUS) {
    if (senses.seen) {
      guard.lastSeenX = senses.px;
      guard.lastSeenY = senses.py;
      guard.lostSightFor = 0;
      return events;
    }
    // First stare at the spot, then walk over and look around.
    if (guard.stateTime < GUARD.stareSeconds) {
      turnToward(guard, guard.investigateX, guard.investigateY, dt);
      return events;
    }
    const arrived = moveToward(guard, guard.investigateX, guard.investigateY, investigate, dt);
    if (arrived) {
      if (guard.stateTime > GUARD.stareSeconds + 2.2) {
        guard.state = GUARD_CALM;
        guard.stateTime = 0;
      } else {
        // Look around while standing on the spot.
        guard.facing += dt * 1.8;
      }
    }
    return events;
  }

  // Calm: walk the round, pausing at each waypoint, and turn toward fresh noises.
  if (senses.heard) {
    guard.state = GUARD_SUSPICIOUS;
    guard.stateTime = 0;
    guard.investigateX = senses.hx;
    guard.investigateY = senses.hy;
    events |= EVENT_SPOTTED;
    return events;
  }
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    return events;
  }
  const target = guard.waypoints[guard.waypoint];
  const arrived = moveToward(guard, target[0], target[1], patrol, dt);
  if (arrived) {
    guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
    guard.pauseLeft = Math.max(0, guard.pause + guard.pauseJitter);
  }
  return events;
}

/** How fast the meter rises for this guard seeing the player, by distance and light. */
export function detectionRate(guard, px, py, lightMultiplier) {
  const d = dist(guard.x, guard.y, px, py);
  const closeness = 1 - (d / GUARD.sightRange) * 0.5;
  return DETECTION.risePerSecond * closeness * lightMultiplier;
}

export { STEP };
