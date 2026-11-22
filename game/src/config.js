// IRONVEIL — The Meridian Vault Heist. Every tuning number, colour and the whole
// floor plan in one place. The playfield is a fixed 1280x720 logical area; the
// renderer scales it to the window, so no rule depends on the screen size.
// One floor, five rooms, all visible in a single frame: the Gallery, the Lobby,
// the Atrium, the Vault Hall and the Server Room.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How much loot value the thief must carry before the exit opens. */
export const LOOT_TARGET = 40000;

/** Alarm 0..100; at 100 the vault locks down and the run is lost. */
export const ALARM_MAX = 100;

export const THIEF = {
  radius: 11,
  speed: 175,
  sneakSpeed: 88,
  catchDistance: 19,
};

export const GUARD = {
  radius: 12,
  patrolSpeed: 72,
  chaseSpeed: 165,
  searchSpeed: 110,
  visionRange: 185,
  visionHalfAngle: 0.55,
  suspicionPerSecond: 55,
  suspicionDecay: 14,
  chaseMemory: 3,
  searchTime: 4,
};

export const CAMERA = {
  range: 205,
  halfAngle: 0.45,
  sweepSpeed: 0.55,
  sweepArc: 0.9,
  alarmPerSecond: 9,
};

export const LASER = { alarmTrip: 18, onSeconds: 2.2, offSeconds: 1.4 };

/** Noise radius by floor type while walking (halved while sneaking). */
export const FLOOR_NOISE = { carpet: 34, tile: 58, marble: 95 };

export const PALETTE = {
  backdrop: '#0b0e14',
  carpet: '#23202e',
  carpetAlt: '#262335',
  tile: '#1d2733',
  tileAlt: '#212c3a',
  marble: '#2b2b33',
  marbleAlt: '#30303a',
  wall: '#4a5468',
  wallTop: '#6b7a94',
  door: '#8a6d3b',
  gold: '#f2c94c',
  goldDim: '#a8842c',
  text: '#eef1f5',
  muted: '#9aa3b2',
  thief: '#39d98a',
  thiefDark: '#1e7a4c',
  guard: '#e5534b',
  guardCone: 'rgba(229, 83, 75, 0.20)',
  guardConeEdge: 'rgba(229, 83, 75, 0.55)',
  camera: '#f2994a',
  cameraCone: 'rgba(242, 153, 74, 0.20)',
  laser: '#ff4d6d',
  laserOff: 'rgba(255, 77, 109, 0.18)',
  alarm: '#ff5c5c',
  alarmOk: '#39d98a',
  panel: 'rgba(16, 20, 30, 0.88)',
  panelEdge: '#39415a',
  loot: '#f2c94c',
  exit: '#39d98a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'ironveil.best';

/** Walls as {x, y, w, h}. The outer shell is 16 thick; door gaps are left open. */
export const WALLS = [
  { x: 0, y: 0, w: 1280, h: 16 },
  { x: 0, y: 704, w: 1280, h: 16 },
  { x: 0, y: 0, w: 16, h: 720 },
  { x: 1264, y: 0, w: 16, h: 720 },
  // x=420 divider: Gallery/Lobby (left) vs Atrium (right); door gap y 300..390.
  { x: 420, y: 16, w: 16, h: 284 },
  { x: 420, y: 390, w: 16, h: 314 },
  // x=860 divider: Atrium vs Vault Hall / Server Room; door gaps y 280..340 and y 340..420.
  { x: 860, y: 16, w: 16, h: 264 },
  { x: 860, y: 420, w: 16, h: 284 },
  // y=330 divider: Gallery (top-left) vs Lobby (bottom-left); door gap x 200..260.
  { x: 16, y: 330, w: 184, h: 16 },
  { x: 260, y: 330, w: 160, h: 16 },
  // y=360 divider: Vault Hall (top-right) vs Server Room (bottom-right); door gap x 1020..1080.
  { x: 876, y: 360, w: 144, h: 16 },
  { x: 1080, y: 360, w: 184, h: 16 },
  // Atrium pillars.
  { x: 600, y: 190, w: 42, h: 42 },
  { x: 600, y: 480, w: 42, h: 42 },
];

/**
 * Floor inlays in the Vault Hall: brass-trimmed display stands for the Diamond
 * and the Mask. They are drawn on the floor, never walls: a low case must not
 * trap a chase the way a wall does (a guard sliding along one stalls 27 px
 * short of the thief and the catch never happens).
 */
export const DECOR = [
  { x: 1105, y: 140, w: 90, h: 22, label: 'MERIDIAN' },
  { x: 905, y: 318, w: 90, h: 22, label: 'AURUM' },
];

/** Floor zones: name, rect, type (drives noise) and label. */
export const ROOMS = [
  { name: 'GALLERY', x: 16, y: 16, w: 404, h: 314, floor: 'carpet', label: 'GALLERY — quiet carpet' },
  { name: 'LOBBY', x: 16, y: 346, w: 404, h: 358, floor: 'marble', label: 'LOBBY — loud marble' },
  { name: 'ATRIUM', x: 436, y: 16, w: 424, h: 688, floor: 'tile', label: 'ATRIUM' },
  { name: 'VAULT', x: 876, y: 16, w: 388, h: 344, floor: 'marble', label: 'VAULT HALL — lasers live' },
  { name: 'SERVER', x: 876, y: 376, w: 388, h: 328, floor: 'carpet', label: 'SERVER ROOM — quiet carpet' },
];

/** Door markers drawn on the floor where the gaps are. */
export const DOORS = [
  { x: 420, y: 300, w: 16, h: 90 },
  { x: 860, y: 280, w: 16, h: 140 },
  { x: 200, y: 330, w: 60, h: 16 },
  { x: 1020, y: 360, w: 60, h: 16 },
];

/** The exit: bottom-left corner of the Lobby. Opens once LOOT_TARGET is carried. */
export const EXIT = { x: 20, y: 664, w: 96, h: 36, label: 'EXIT' };

export const THIEF_START = { x: 64, y: 690 };

/** Named loot: the Meridian Diamond is the big prize, in the Vault Hall. */
export const LOOT = [
  { name: 'Meridian Diamond', value: 25000, x: 1150, y: 120 },
  { name: 'Aurum Death Mask', value: 12000, x: 950, y: 300 },
  { name: 'Sapphire Tiara', value: 8000, x: 120, y: 90 },
  { name: 'Jade Falcon', value: 7000, x: 330, y: 250 },
  { name: 'Cipher Drive', value: 9000, x: 1180, y: 620 },
  { name: 'Gilded Ledger', value: 5000, x: 90, y: 620 },
];

/** Named guards with patrol loops. */
export const GUARDS = [
  { name: 'ROOK', waypoints: [[500, 120], [790, 120], [790, 600], [500, 600]] },
  { name: 'VERA', waypoints: [[100, 100], [340, 100], [340, 620], [100, 620]] },
  { name: 'MOSS', waypoints: [[920, 80], [1200, 80], [1200, 300], [920, 300]] },
  { name: 'IRIS', waypoints: [[900, 450], [1200, 450], [1200, 650], [900, 650]] },
];

/** CCTV cameras: fixed position, sweeping cone. */
export const CAMERAS = [
  { name: 'CAM-1', x: 640, y: 40, baseAngle: Math.PI / 2 },
  { name: 'CAM-2', x: 1240, y: 370, baseAngle: Math.PI },
  { name: 'CAM-3', x: 40, y: 350, baseAngle: 0 },
];

/** Laser beams across the Vault Hall, cycling on/off. */
export const LASERS = [
  { x1: 880, y1: 180, x2: 1260, y2: 180, phase: 0 },
  { x1: 880, y1: 240, x2: 1260, y2: 240, phase: 1.8 },
  { x1: 1080, y1: 40, x2: 1080, y2: 340, phase: 3.6 },
];

export const STORY = {
  title: 'IRONVEIL',
  subtitle: 'The Meridian Vault Heist',
  brief: 'One thief. One night. The Meridian Diamond sits in the Vault Hall — lift $40,000 of loot and slip out the Lobby exit before the alarm hits 100.',
};
