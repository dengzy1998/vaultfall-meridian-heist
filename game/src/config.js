// VAULTFALL config: every tuning number the heist agrees on lives here,
// so one pass can rebalance the whole game without touching the systems.
export const TILE = 32;
export const COLS = 40;
export const ROWS = 20;
export const HUD_H = 80;
export const W = 1280;
export const H = 720;
export const PLAY_Y = HUD_H; // playfield top edge in canvas pixels

export const PLAYER_SPEED = 175;
export const PLAYER_SNEAK_SPEED = 98;
export const PLAYER_RADIUS = 12;

export const GUARD_PATROL_SPEED = 72;
export const GUARD_ALERT_SPEED = 132;
export const GUARD_CHASE_SPEED = 152;
export const GUARD_RADIUS = 13;

export const VISION_RANGE = 215;
export const VISION_HALF_ANGLE = 0.62; // radians either side of facing
export const SNEAK_VISION_RANGE = 150; // sneaking shrinks how far you are seen

export const ALARM_FILL_RATE = 46; // per second while spotted by a guard
export const ALARM_DECAY_RATE = 20; // per second while unseen
export const ALARM_CAMERA_FILL = 26; // cameras fill slower than guards
export const MAX_STRIKES = 3;

export const VAULT_CRACK_SECONDS = 3.0;
export const EMP_SECONDS = 6;
export const SMOKE_SECONDS = 5;
export const SMOKE_RADIUS = 95;
export const DECOY_RADIUS = 260; // guards within this hear the coin

export const TOOL_PRICE = 150;
export const START_DECOYS = 2;
export const START_EMPS = 1;
export const START_SMOKES = 1;

export const LOOT_VALUES = { gem: 220, painting: 180, cash: 90, gold: 140, scrip: 60 };
export const FLOOR_BONUS = [0, 400, 800, 1200, 2000]; // clearing bonus per floor

// Palette: safe cover is deep teal, danger is hot amber/red, loot is gold.
export const COLORS = {
  floor: '#171a26', floorAlt: '#1a1d2b', wall: '#2c3150', wallTop: '#3a4066',
  desk: '#274b4a', deskTop: '#35706b', vault: '#c9a227', vaultDark: '#8a6d1a',
  exit: '#2fbf71', lootGem: '#59d6ff', lootPainting: '#ff7ad9', lootCash: '#7dff8a',
  lootGold: '#ffd94d', lootScrip: '#c9a0ff',
  cone: 'rgba(255, 190, 60, 0.20)', coneAlert: 'rgba(255, 60, 60, 0.30)',
  coneCamera: 'rgba(255, 120, 220, 0.16)', laser: '#ff3b5c',
  player: '#e8ecff', playerCloak: '#232946', guard: '#ff5a4e', guardSuit: '#3a1d24',
  camera: '#ff8ad8', hud: '#0d0f1a', text: '#e8ecff', dim: '#9aa3c0',
  alarm: '#ff453a', alarmBg: '#3a1420', gold: '#ffd94d',
};
