// The three hand-made levels of Silent Stacks.
//
// Every level is drawn on the same 1280x720 field. `solids` block both movement and sight:
// kind "wall" is the archive's stone, "shelf" is a tall bookcase, "crate" is a stack of boxes.
// Guards walk straight lines between their waypoints, so each patrol segment was laid out to
// clear every solid. Lamps paint light pools (seen faster there); shadows paint dark patches
// (seen slower there). Seals must all be collected before the exit door opens.

function border() {
  return [
    { x: 0, y: 0, w: 1280, h: 24, kind: 'wall' },
    { x: 0, y: 696, w: 1280, h: 24, kind: 'wall' },
    { x: 0, y: 0, w: 24, h: 720, kind: 'wall' },
    { x: 1256, y: 0, w: 24, h: 720, kind: 'wall' },
  ];
}

export const LEVELS = [
  {
    name: 'The Reading Room',
    subtitle: 'Two wardens. Learn their rounds, then move.',
    speed: 1.0,
    solids: [
      ...border(),
      { x: 300, y: 150, w: 36, h: 260, kind: 'shelf' },
      { x: 620, y: 330, w: 260, h: 36, kind: 'shelf' },
      { x: 920, y: 140, w: 64, h: 64, kind: 'crate' },
      { x: 996, y: 140, w: 64, h: 64, kind: 'crate' },
      { x: 180, y: 520, w: 72, h: 56, kind: 'crate' },
      { x: 1060, y: 520, w: 84, h: 56, kind: 'crate' },
    ],
    lamps: [
      { x: 640, y: 170, r: 150 },
      { x: 1020, y: 460, r: 140 },
    ],
    shadows: [
      { x: 150, y: 300, w: 220, h: 170 },
      { x: 880, y: 60, w: 220, h: 110 },
    ],
    guards: [
      { waypoints: [[150, 100], [1150, 100]], pause: 1.2 },
      { waypoints: [[1000, 260], [1000, 640]], pause: 1.6 },
    ],
    playerStart: { x: 70, y: 640 },
    seals: [
      { x: 1200, y: 70 },
      { x: 420, y: 650 },
      { x: 700, y: 250 },
    ],
    exit: { x: 1256, y: 600, w: 24, h: 72 },
  },
  {
    name: 'The Gallery',
    subtitle: 'Three wardens, crossing rounds. The lit floor is the trap.',
    speed: 1.12,
    solids: [
      ...border(),
      { x: 420, y: 90, w: 36, h: 200, kind: 'shelf' },
      { x: 820, y: 430, w: 36, h: 200, kind: 'shelf' },
      { x: 560, y: 330, w: 240, h: 36, kind: 'shelf' },
      { x: 150, y: 150, w: 64, h: 64, kind: 'crate' },
      { x: 1050, y: 120, w: 72, h: 56, kind: 'crate' },
      { x: 180, y: 560, w: 84, h: 56, kind: 'crate' },
      { x: 1080, y: 540, w: 64, h: 64, kind: 'crate' },
    ],
    lamps: [
      { x: 640, y: 480, r: 160 },
      { x: 300, y: 200, r: 130 },
      { x: 1100, y: 300, r: 130 },
    ],
    shadows: [
      { x: 60, y: 480, w: 200, h: 160 },
      { x: 950, y: 500, w: 220, h: 140 },
    ],
    guards: [
      { waypoints: [[120, 405], [1160, 405]], pause: 1.0 },
      { waypoints: [[950, 90], [950, 300]], pause: 1.4 },
      { waypoints: [[300, 620], [300, 340]], pause: 1.4 },
    ],
    playerStart: { x: 70, y: 70 },
    seals: [
      { x: 1200, y: 650 },
      { x: 640, y: 120 },
      { x: 110, y: 640 },
    ],
    exit: { x: 600, y: 696, w: 72, h: 24 },
  },
  {
    name: 'The Vault Wing',
    subtitle: 'Four wardens, faster rounds, nowhere to linger.',
    speed: 1.25,
    solids: [
      ...border(),
      { x: 330, y: 80, w: 36, h: 230, kind: 'shelf' },
      { x: 920, y: 410, w: 36, h: 230, kind: 'shelf' },
      { x: 520, y: 200, w: 36, h: 260, kind: 'shelf' },
      { x: 700, y: 470, w: 260, h: 36, kind: 'shelf' },
      { x: 150, y: 300, w: 64, h: 64, kind: 'crate' },
      { x: 1120, y: 150, w: 64, h: 64, kind: 'crate' },
      { x: 640, y: 600, w: 72, h: 56, kind: 'crate' },
    ],
    lamps: [
      { x: 480, y: 120, r: 140 },
      { x: 800, y: 300, r: 150 },
      { x: 1100, y: 560, r: 130 },
    ],
    shadows: [
      { x: 80, y: 120, w: 180, h: 140 },
      { x: 980, y: 80, w: 200, h: 110 },
      { x: 400, y: 540, w: 200, h: 120 },
    ],
    guards: [
      { waypoints: [[120, 60], [1180, 60]], pause: 0.9 },
      { waypoints: [[660, 90], [660, 580]], pause: 1.2 },
      { waypoints: [[150, 680], [1150, 680]], pause: 0.9 },
      { waypoints: [[1150, 250], [1150, 620]], pause: 1.3 },
    ],
    playerStart: { x: 70, y: 360 },
    seals: [
      { x: 1200, y: 90 },
      { x: 120, y: 640 },
      { x: 860, y: 300 },
    ],
    exit: { x: 1256, y: 60, w: 24, h: 72 },
  },
];
