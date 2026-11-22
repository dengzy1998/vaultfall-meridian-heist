// VAULTFALL — The Meridian Heist: central tuning and palette.
// One job: every number the rest of the game agrees on lives here.
export const CONFIG = {
  canvasWidth: 1280,
  canvasHeight: 720,
  hudHeight: 48,
  tile: 32,
  cols: 40,
  rows: 21,

  // Player movement (pixels per second).
  walkSpeed: 168,
  sneakSpeed: 96,
  // Alarm: 0..100. Fills while any cone holds the thief, drains when hidden.
  alarmFillGuard: 46,
  alarmFillCamera: 34,
  alarmFillLaser: 55,
  alarmDecay: 13,
  alarmStrikeReset: 35,
  // Vision cones.
  guardRange: 205,
  guardHalfAngle: 0.61, // ~35 degrees
  cameraRange: 265,
  cameraHalfAngle: 0.44, // ~25 degrees
  bossRange: 235,
  // Guards.
  guardWalk: 56,
  guardChase: 118,
  guardCatchRadius: 26,
  // Vault cracking (seconds of held Space, before relic modifiers).
  crackSeconds: 3.6,
  crownCrackSeconds: 5.2,
  // Tools.
  empSeconds: 6,
  smokeSeconds: 5,
  smokeRadius: 74,
  decoyLureRadius: 190,
  decoyInvestigateSeconds: 3.2,
  toolPrice: 150,
  // Loot values (before Lucky Coin / Fence Network modifiers).
  lootValue: { gem: 120, painting: 200, cash: 80, gold: 150 },
  vaultBonus: 500,
  crownBonus: 1500,
  floorBonus: 250,
  // Hideout perk prices (banked loot, persistent across runs).
  perkPrice: { stash: 500, insider: 1200, fence: 2500 },
  maxStrikes: 3,
};

export const COLORS = {
  bg: '#0b0e1a',
  floorA: '#171c2e',
  floorB: '#141828',
  floorLine: '#1f2540',
  wall: '#2c3352',
  wallTop: '#4a5480',
  desk: '#6b4a2f',
  deskTop: '#8a6238',
  vault: '#c9a227',
  vaultDark: '#7a5c0e',
  exit: '#2fd47a',
  exitLocked: '#3a4a42',
  lootGem: '#4dd7ff',
  lootPainting: '#ff7ad9',
  lootCash: '#7dff8a',
  lootGold: '#ffd94d',
  player: '#e8ecff',
  playerCloak: '#39406e',
  guard: '#ff5a5a',
  guardSuit: '#7a1f2b',
  camera: '#ffb347',
  coneGuard: 'rgba(255, 90, 90, 0.20)',
  coneGuardEdge: 'rgba(255, 90, 90, 0.55)',
  coneCamera: 'rgba(255, 179, 71, 0.20)',
  coneCameraEdge: 'rgba(255, 179, 71, 0.55)',
  coneBoss: 'rgba(190, 90, 255, 0.22)',
  coneBossEdge: 'rgba(190, 90, 255, 0.6)',
  laser: 'rgba(255, 60, 90, 0.85)',
  smoke: 'rgba(200, 205, 220, 0.35)',
  alarmLow: '#2fd47a',
  alarmMid: '#ffb347',
  alarmHigh: '#ff4d4d',
  text: '#e8ecff',
  textDim: '#9aa3c7',
  gold: '#ffd94d',
  panel: 'rgba(10, 13, 26, 0.92)',
  panelEdge: '#3a4370',
};

// Tile glyphs used by the ASCII floor plans in levels.js.
export const TILE = {
  wall: '#',
  floor: '.',
  desk: 'D',
  vault: 'V',
  exit: 'X',
  start: 'P',
  guard: 'G',
  waypoint: 'g',
  camera: 'C',
  loot: 'L',
};
