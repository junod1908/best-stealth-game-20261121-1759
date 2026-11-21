// The screenshot scenes behind ?shot=title|play|alert|win. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a small autopilot:
// it finds a path around the shelves and crates (breadth-first search on a coarse grid),
// heads for the nearest seal (then the exit), waits when the next step would walk into a
// vision cone, and sneaks when a guard is close. The same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_WIN } from './world.js';
import { guardSees } from './guards.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 5;
const PLAY_SECONDS = 24;
const ALERT_LIMIT_SECONDS = 12;
const WIN_LIMIT_SECONDS = 600;

/** Coarse grid for the path search: 40 px cells over the 1280x720 field. */
const CELL = 40;
const COLS = FIELD.width / CELL;
const ROWS = FIELD.height / CELL;

function cellOf(x, y) {
  return {
    c: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))),
    r: Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL))),
  };
}

function cellCentre(c, r) {
  return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
}

/** True when the cell's centre is inside a solid, inflated by the player's size. */
function buildBlocked(level) {
  const blocked = new Array(COLS * ROWS).fill(false);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const centre = cellCentre(c, r);
      for (const solid of level.solids) {
        if (
          centre.x > solid.x - 16 && centre.x < solid.x + solid.w + 16 &&
          centre.y > solid.y - 16 && centre.y < solid.y + solid.h + 16
        ) {
          blocked[r * COLS + c] = true;
          break;
        }
      }
    }
  }
  return blocked;
}

/**
 * Breadth-first path from the start cell to the target cell (or the nearest free cell
 * to it, when the target itself sits inside a wall, as an exit door does). Returns the
 * waypoints as field points, start cell excluded.
 */
function findPath(blocked, from, to) {
  const start = from.r * COLS + from.c;
  // The target cell may be blocked (an exit in the wall): walk outward for a free one.
  let goal = to.r * COLS + to.c;
  if (blocked[goal]) {
    let found = -1;
    for (let ring = 1; ring < 6 && found === -1; ring += 1) {
      for (let r = to.r - ring; r <= to.r + ring && found === -1; r += 1) {
        for (let c = to.c - ring; c <= to.c + ring && found === -1; c += 1) {
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
          if (!blocked[r * COLS + c]) found = r * COLS + c;
        }
      }
    }
    if (found === -1) return [];
    goal = found;
  }
  if (start === goal) return [];
  const previous = new Array(COLS * ROWS).fill(-1);
  const queue = [start];
  previous[start] = start;
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === goal) break;
    const c = current % COLS;
    const r = Math.floor(current / COLS);
    const neighbours = [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ];
    for (const [nc, nr] of neighbours) {
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const index = nr * COLS + nc;
      if (blocked[index] || previous[index] !== -1) continue;
      previous[index] = current;
      queue.push(index);
    }
  }
  if (previous[goal] === -1) return [];
  const cells = [];
  let at = goal;
  while (at !== start) {
    cells.unshift(at);
    at = previous[at];
  }
  return cells.map((index) => cellCentre(index % COLS, Math.floor(index / COLS)));
}

/** The next thing to steal, or the door once every seal is taken. */
function nextTarget(state) {
  for (const seal of state.seals) {
    if (!seal.taken) return { x: seal.x, y: seal.y, key: `seal${seal.x},${seal.y}` };
  }
  const exit = state.level.exit;
  return {
    x: exit.x + exit.w / 2,
    y: exit.y + exit.h / 2,
    key: `exit${state.levelIndex}`,
  };
}

function nearestGuardDistance(state) {
  let best = Infinity;
  for (const guard of state.guards) {
    best = Math.min(best, Math.hypot(guard.x - state.player.x, guard.y - state.player.y));
  }
  return best;
}

function anyoneSeesNow(state) {
  for (const guard of state.guards) {
    if (guardSees(guard, state.player.x, state.player.y, state.level.solids)) return true;
  }
  return false;
}

/**
 * Steer one step. The pilot keeps a cached path and follows it waypoint by waypoint;
 * when the path runs out it steers straight at the target (the last stretch to a door
 * in the wall). It waits when the step ahead would be seen, unless it has been stuck
 * waiting for two seconds, when it pushes on regardless.
 */
function createAutopilot() {
  let path = [];
  let pathKey = '';
  let lastX = 0;
  let lastY = 0;
  let stallSteps = 0;
  let pushSteps = 0;
  let stepsSincePath = 0;

  return function autopilot(state) {
    const player = state.player;
    const target = nextTarget(state);
    const key = `${state.levelIndex}:${target.key}`;
    // Recompute regularly, not only when the target changes: a respawn teleports the
    // player, and a path computed from the old position leads into a wall.
    stepsSincePath += 1;
    if (key !== pathKey || stepsSincePath > 30) {
      pathKey = key;
      stepsSincePath = 0;
      path = findPath(buildBlocked(state.level), cellOf(player.x, player.y), cellOf(target.x, target.y));
      stallSteps = 0;
    }
    while (path.length > 0 && Math.hypot(path[0].x - player.x, path[0].y - player.y) < 16) {
      path.shift();
    }
    const goal = path.length > 0 ? path[0] : target;
    const dx = goal.x - player.x;
    const dy = goal.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 12) return { move: { x: 0, y: 0 }, sneak: false };

    if (Math.hypot(player.x - lastX, player.y - lastY) < 1.5) stallSteps += 1;
    else stallSteps = 0;
    lastX = player.x;
    lastY = player.y;
    if (stallSteps > 120) {
      pushSteps = 30;
      stallSteps = 0;
    }
    if (pushSteps > 0) pushSteps -= 1;

    const dirX = dx / distance;
    const dirY = dy / distance;
    const sneak = nearestGuardDistance(state) < 220;
    if (pushSteps === 0 && !anyoneSeesNow(state) && state.meter < 100) {
      const aheadX = player.x + dirX * 34;
      const aheadY = player.y + dirY * 34;
      for (const guard of state.guards) {
        if (guardSees(guard, aheadX, aheadY, state.level.solids)) {
          return { move: { x: 0, y: 0 }, sneak: true };
        }
        if (Math.hypot(guard.x - aheadX, guard.y - aheadY) < 44) {
          return { move: { x: 0, y: 0 }, sneak: true };
        }
      }
    }
    // The world normalises the direction, so hand it the true one: quantising the
    // axes to -1/0/1 can zero the sideways component on a shallow diagonal, which
    // wedges the player against a wall it should slide along.
    return { move: { x: dirX, y: dirY }, sneak };
  };
}

function runAutopilot(world, seconds) {
  const pilot = createAutopilot();
  let events = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const { move, sneak } = pilot(world.state);
    events = world.step(STEP, move, sneak);
    if (events & EVENT_WIN) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (title, play, alert or win; any other name is title)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'alert' && name !== 'win') {
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, false);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'alert') {
    // Stand the player still in the middle of the first guard's patrol, under a lamp:
    // the guard walks into range, grows suspicious and freezes to stare — and while
    // it stares the meter fills to full. The frame is taken just after the chase
    // begins, the guard still a little way off, its cone red.
    const guard = world.state.guards[0];
    const [ax, ay] = guard.waypoints[0];
    const [bx, by] = guard.waypoints[1] ?? guard.waypoints[0];
    world.state.player.x = (ax + bx) / 2;
    world.state.player.y = (ay + by) / 2;
    const limit = Math.floor(ALERT_LIMIT_SECONDS / STEP);
    let alertedFor = -1;
    for (let i = 0; i < limit; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, false);
      if (alertedFor === -1 && world.state.meter >= 100) alertedFor = 0;
      else if (alertedFor >= 0) {
        alertedFor += 1;
        if (alertedFor >= 10) break;
      }
      if (world.state.lives < 3) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    const events = runAutopilot(world, WIN_LIMIT_SECONDS);
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    return { screen: world.state.lives === 0 ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  runAutopilot(world, PLAY_SECONDS);
  return { screen: world.state.lives === 0 ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}

export { SCREEN_CLEAR };
