// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, wing cleared, game over
// and win. Sounds fire from the world's event flags, never from the drawing code.
//
// ?seed=N fixes the random seed (the levels are hand-made, so the seed only steadies the
// few remaining rolls). ?shot=title|play|alert|win (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, FIXED_SEED, STEP } from './config.js';
import { createWorld, EVENT_ALERT, EVENT_CAUGHT, EVENT_CLEAR, EVENT_LOST, EVENT_OVER, EVENT_SEAL, EVENT_STEP, EVENT_SUSPICIOUS, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : FIXED_SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing ${world.state.level.name}. Collect ${world.state.seals.length} seals, then reach the exit unseen.`);
  }

  function finishRun(win) {
    screen = win ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(win
      ? `You slipped away unseen. Final score ${world.state.score}. Best ${best}.`
      : `Caught. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_CLEAR) {
      screen = SCREEN_PLAY;
      announce(`Playing ${world.state.level.name}.`);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    const click = input.takeClickTarget();
    if (click !== null && screen === SCREEN_PLAY) {
      audio.unlock();
      world.setClickTarget(renderer.toField(click.x, click.y));
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false);
      return;
    }
    const keys = input.keys();
    const events = world.step(STEP, keys, input.isSneaking());
    if (events & EVENT_STEP) audio.footstep(input.isSneaking(), 0);
    if (events & EVENT_SEAL) {
      audio.pickup();
      const left = world.state.seals.filter((seal) => !seal.taken).length;
      announce(left === 0 ? 'All seals taken. The exit door is open.' : `Seal taken. ${left} left.`);
    }
    if (events & EVENT_SUSPICIOUS) audio.suspicious();
    if (events & EVENT_ALERT) {
      audio.alert();
      announce('Spotted! A warden is chasing you. Break line of sight!');
    }
    if (events & EVENT_LOST) announce('The warden lost you. Stay out of sight.');
    if (events & EVENT_CAUGHT) audio.caught();
    if (events & EVENT_CLEAR) {
      audio.levelClear();
      screen = SCREEN_CLEAR;
      announce(`${world.state.level.name} cleared. Score ${world.state.score}.`);
    } else if (events & EVENT_WIN) {
      audio.levelClear();
      finishRun(true);
    } else if (events & EVENT_OVER) {
      audio.gameOver();
      finishRun(false);
    } else if (events & EVENT_CAUGHT) {
      announce(`Caught! ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left. Back to the start of the wing.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting wardens close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Silent Stacks. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
