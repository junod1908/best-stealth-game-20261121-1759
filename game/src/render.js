// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Flat shapes and canvas text: floor tiles, lamp light and shadow patches, shelves
// and crates, vision cones, guards, the player, seals and the exit door, then the HUD or a
// panel for the screen the game is on. Cones are painted before the solids, so a wall hides
// the part of a cone that falls behind it.

import { DETECTION, FIELD, FONT, GUARD, LIVES, PALETTE } from './config.js';
import { GUARD_ALERTED, GUARD_SUSPICIOUS } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 118, line: 32, bottom: 76 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const timeLabel = cachedLabel('');
  const sealsLabel = cachedLabel('');
  const bestLabel = cachedLabel('Best ');
  const finalLabel = cachedLabel('Score ');
  const levelLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  /** Convert a point in canvas pixels to field coordinates (for click-to-move). */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1)),
      y: (clientY - rect.top - view.y / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1)),
    };
  }

  function drawFloor(state) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Faint checker tiles so motion reads at a glance.
    context.fillStyle = PALETTE.floorTile;
    const tile = 80;
    for (let y = 0; y < FIELD.height; y += tile) {
      for (let x = ((y / tile) % 2) * tile; x < FIELD.width; x += tile * 2) {
        context.fillRect(x, y, tile, tile);
      }
    }
    // Shadow patches: dark, safe ground.
    for (const shadow of state.level.shadows) {
      context.fillStyle = PALETTE.shadow;
      context.fillRect(shadow.x, shadow.y, shadow.w, shadow.h);
    }
    // Lamp light pools: warm, dangerous ground.
    for (const lamp of state.level.lamps) {
      const gradient = context.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, lamp.r);
      gradient.addColorStop(0, 'rgba(255, 205, 120, 0.20)');
      gradient.addColorStop(1, 'rgba(255, 205, 120, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd27a';
      context.beginPath();
      context.arc(lamp.x, lamp.y, 6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawSolid(solid) {
    if (solid.kind === 'wall') {
      context.fillStyle = PALETTE.wall;
      context.fillRect(solid.x, solid.y, solid.w, solid.h);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(solid.x, solid.y, solid.w, 4);
      return;
    }
    if (solid.kind === 'shelf') {
      context.fillStyle = PALETTE.shelf;
      context.fillRect(solid.x, solid.y, solid.w, solid.h);
      context.fillStyle = PALETTE.shelfTop;
      context.fillRect(solid.x, solid.y, solid.w, 5);
      // Book spines: short vertical ticks along the shelf.
      context.fillStyle = 'rgba(255, 220, 160, 0.35)';
      const horizontal = solid.w > solid.h;
      const length = horizontal ? solid.w : solid.h;
      for (let offset = 8; offset < length - 6; offset += 12) {
        if (horizontal) context.fillRect(solid.x + offset, solid.y + 8, 3, solid.h - 16);
        else context.fillRect(solid.x + 8, solid.y + offset, solid.w - 16, 3);
      }
      return;
    }
    context.fillStyle = PALETTE.crate;
    context.fillRect(solid.x, solid.y, solid.w, solid.h);
    context.fillStyle = PALETTE.crateTop;
    context.fillRect(solid.x, solid.y, solid.w, 5);
    context.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    context.lineWidth = 2;
    context.strokeRect(solid.x + 3, solid.y + 3, solid.w - 6, solid.h - 6);
  }

  function drawSeals(state, time) {
    for (const seal of state.seals) {
      if (seal.taken) continue;
      const pulse = 0.5 + 0.2 * Math.sin(time * 3 + seal.x);
      context.fillStyle = PALETTE.sealGlow;
      context.beginPath();
      context.arc(seal.x, seal.y, 22 + 4 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.seal;
      context.beginPath();
      context.moveTo(seal.x, seal.y - 11);
      context.lineTo(seal.x + 9, seal.y);
      context.lineTo(seal.x, seal.y + 11);
      context.lineTo(seal.x - 9, seal.y);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff6c8';
      context.beginPath();
      context.arc(seal.x, seal.y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawExit(state) {
    const exit = state.level.exit;
    const open = state.exitOpen;
    context.fillStyle = open ? PALETTE.exitOpen : PALETTE.exitLocked;
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    if (open) {
      context.fillStyle = PALETTE.exitGlow;
      context.beginPath();
      context.arc(exit.x + exit.w / 2, exit.y + exit.h / 2, 52, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0b0d12';
      text('EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 + 5, 13, '#0b0d12', 'center', 'middle');
    } else {
      // Chain bars across a locked door, with its name so the goal reads at a glance.
      context.strokeStyle = '#d8dde6';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(exit.x, exit.y + exit.h / 3);
      context.lineTo(exit.x + exit.w, exit.y + exit.h / 3);
      context.moveTo(exit.x, exit.y + (2 * exit.h) / 3);
      context.lineTo(exit.x + exit.w, exit.y + (2 * exit.h) / 3);
      context.stroke();
      context.save();
      context.translate(exit.x + exit.w / 2, exit.y + exit.h / 2);
      context.rotate(exit.w < exit.h ? -Math.PI / 2 : 0);
      text('EXIT', 0, 5, 12, '#c8cfdb', 'center', 'middle');
      context.restore();
    }
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const color = guard.state === GUARD_ALERTED
        ? PALETTE.coneAlerted
        : guard.state === GUARD_SUSPICIOUS ? PALETTE.coneSuspicious : PALETTE.coneCalm;
      const gradient = context.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, GUARD.sightRange);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.arc(guard.x, guard.y, GUARD.sightRange, guard.facing - GUARD.sightHalfAngle, guard.facing + GUARD.sightHalfAngle);
      context.closePath();
      context.fill();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      // Body: a red warden, bright against the floor, with a facing tick. The size
      // comes from config: the guard object itself carries no radius.
      const radius = GUARD.radius;
      context.fillStyle = PALETTE.guardDark;
      context.beginPath();
      context.arc(guard.x, guard.y, radius + 2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ffd9d4';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.facing) * (radius + 7), guard.y + Math.sin(guard.facing) * (radius + 7));
      context.stroke();
      if (guard.state === GUARD_SUSPICIOUS) {
        text('?', guard.x, guard.y - radius - 8, 22, '#ffc857', 'center');
      } else if (guard.state === GUARD_ALERTED) {
        text('!', guard.x, guard.y - radius - 8, 24, '#ff5a4e', 'center');
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    // A pale ring always marks the player against the dark floor; sneaking widens it.
    context.strokeStyle = PALETTE.playerRing;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(player.x, player.y, player.radius + (player.sneaking ? 6 : 3), 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#0b0d12';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(player.x + Math.cos(player.facing) * (player.radius + 5), player.y + Math.sin(player.facing) * (player.radius + 5));
    context.stroke();
  }

  function drawRipples(state) {
    const step = state.lastStep;
    if (step === null) return;
    const progress = step.age / 0.6;
    context.strokeStyle = `rgba(214, 226, 255, ${0.5 * (1 - progress)})`;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(step.x, step.y, 6 + step.radius * progress, 0, Math.PI * 2);
    context.stroke();
  }

  function meterColor(meter) {
    if (meter >= DETECTION.alertedAt) return PALETTE.meterHigh;
    if (meter >= DETECTION.suspiciousAt) return PALETTE.meterMid;
    return PALETTE.meterLow;
  }

  function meterWord(meter) {
    if (meter >= DETECTION.alertedAt) return 'HUNTED';
    if (meter >= DETECTION.suspiciousAt) return 'SUSPICIOUS';
    if (meter > 0) return 'GLIMPSED';
    return 'UNSEEN';
  }

  function formatTime(seconds) {
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function drawHud(state, screen) {
    const level = state.level;
    const taken = state.seals.filter((seal) => seal.taken).length;
    context.textBaseline = 'top';
    text(levelLabel(`${state.levelIndex + 1} · ${level.name}`), 24, 18, 22, PALETTE.text, 'left', 'top');
    text(sealsLabel(`Seals ${taken}/${state.seals.length}${state.exitOpen ? ' · door open' : ''}`), 24, 46, 17, state.exitOpen ? PALETTE.exitOpen : PALETTE.muted, 'left', 'top');
    // Detection meter, centre top.
    const meterWidth = 230;
    const meterX = FIELD.width / 2 - meterWidth / 2;
    text(meterWord(state.meter), FIELD.width / 2, 14, 16, meterColor(state.meter), 'center', 'top');
    context.fillStyle = '#10131a';
    context.fillRect(meterX, 36, meterWidth, 12);
    context.fillStyle = meterColor(state.meter);
    context.fillRect(meterX, 36, meterWidth * (state.meter / 100), 12);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(meterX, 36, meterWidth, 12);
    // Score, time and lives, right top.
    text(scoreLabel(state.score), FIELD.width - 24, 18, 22, PALETTE.text, 'right', 'top');
    text(timeLabel(formatTime(state.time)), FIELD.width - 24, 46, 17, PALETTE.muted, 'right', 'top');
    for (let life = 0; life < LIVES; life += 1) {
      context.fillStyle = life < state.lives ? '#ff6b81' : '#2a3040';
      context.beginPath();
      context.arc(FIELD.width - 24 - life * 24 - 8, 84, 7, 0, Math.PI * 2);
      context.fill();
    }
    if (screen === SCREEN_PLAY && state.meter >= DETECTION.suspiciousAt) {
      text('Break line of sight to cool down', FIELD.width / 2, FIELD.height - 30, 16, meterColor(state.meter), 'center', 'top');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    text(title, FIELD.width / 2, y + 72, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Three seals are missing from the Grand Archive.',
    'Slip past the wardens, take them back, and leave unseen.',
    'Move with WASD or arrows · hold Shift to sneak',
    'Shelves and crates block sight. Lamplight betrays; shadow hides.',
    '',
  ];
  const PAUSED_LINES = ['The wardens wait for no one. Well — right now they do.'];
  const CLEAR_LINES = ['', ''];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawSeals(state, state.time);
    drawExit(state);
    drawCones(state);
    for (const solid of state.level.solids) drawSolid(solid);
    drawGuards(state);
    drawPlayer(state);
    drawRipples(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('SILENT STACKS', TITLE_LINES, 'Press Space or click to begin');
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_CLEAR) {
      CLEAR_LINES[0] = finalLabel(state.score);
      CLEAR_LINES[1] = `Level ${state.levelIndex} cleared — the next wing awaits.`;
      drawPanel('Wing cleared', CLEAR_LINES, 'Press Space to continue');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('Caught', OVER_LINES, 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = bestLabel(best);
      drawPanel('Gone like a shadow', WIN_LINES, 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
