// Every tuning number and colour for Silent Stacks, in one place.
//
// The playfield is a fixed 1280x720 logical area. The renderer scales it to fit the
// browser window, so no rule below depends on the screen size. All movement speeds are
// pixels per second, all detection rates are meter points per second.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sneakSpeed: 96,
  /** Noise radius while walking; guards inside it turn toward the sound. */
  walkNoise: 95,
  /** Noise radius while sneaking (holding Shift). */
  sneakNoise: 34,
  /** Seconds of continuous visibility before the detection meter starts rising. */
  graceSeconds: 0.35,
};

export const GUARD = {
  radius: 14,
  /** How far a guard can see, in pixels. */
  sightRange: 235,
  /** Half of the vision cone's angle, in radians. */
  sightHalfAngle: 0.62,
  /** Speeds by state; each level multiplies patrol and chase speed (see LEVELS). */
  patrolSpeed: 72,
  investigateSpeed: 104,
  chaseSpeed: 152,
  /** Seconds a guard stares at the spot where it last saw you before giving up. */
  stareSeconds: 1.4,
  /** Seconds of lost sight while chasing before the guard falls back to investigating. */
  chaseMemorySeconds: 2.6,
  /** Distance at which a chasing guard catches you. */
  catchDistance: 27,
};

/** Detection meter 0..100. 35 = suspicious, 100 = alerted (chase). */
export const DETECTION = {
  suspiciousAt: 35,
  alertedAt: 100,
  /** Base rise while fully seen at close range; distance scales it down toward half. */
  risePerSecond: 78,
  /** Meter lost per second while unseen. */
  decayPerSecond: 26,
  /** Multiplier while the player stands in a lamp's light pool. */
  litMultiplier: 1.5,
  /** Multiplier while the player stands in a shadow patch. */
  shadowMultiplier: 0.45,
  /** Extra meter added by a near miss: seen, then gone again inside the grace window. */
  nearMissPenalty: 12,
};

export const LIVES = 3;

export const SCORE = {
  seal: 150,
  levelClear: 300,
  /** Time bonus on clearing a level: max(0, base - seconds * perSecond). */
  timeBonusBase: 600,
  timeBonusPerSecond: 5,
  /** Bonus for clearing a level without ever being chased. */
  ghostBonus: 400,
};

/** The seed every run uses, so the same load always plays the same game. */
export const FIXED_SEED = 20261121;

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'silent-stacks.best';

export const PALETTE = {
  backdrop: '#0b0d12',
  floor: '#232833',
  floorDark: '#1b1f29',
  floorTile: '#262c3a',
  wall: '#3a4152',
  wallTop: '#4d566b',
  shelf: '#5a4632',
  shelfTop: '#7a6248',
  crate: '#6b543a',
  crateTop: '#8a6f4d',
  lampLight: 'rgba(255, 196, 110, 0.13)',
  shadow: 'rgba(6, 8, 14, 0.45)',
  player: '#7fe0a8',
  playerRing: '#d8ffe9',
  guard: '#e5534b',
  guardDark: '#a8322b',
  coneCalm: 'rgba(255, 214, 90, 0.27)',
  coneSuspicious: 'rgba(255, 150, 60, 0.38)',
  coneAlerted: 'rgba(255, 60, 50, 0.46)',
  seal: '#ffd94a',
  sealGlow: 'rgba(255, 217, 74, 0.30)',
  exitLocked: '#8b93a3',
  exitOpen: '#58e08a',
  exitGlow: 'rgba(88, 224, 138, 0.30)',
  meterLow: '#7fe0a8',
  meterMid: '#ffc857',
  meterHigh: '#ff5a4e',
  panel: '#171b25',
  panelEdge: '#2c3345',
  text: '#eef1f5',
  muted: '#9aa3b5',
  gold: '#ffd94a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
