// All layout constants, colors and timings in one place.
import { tiltOffset } from './core/match.js';

export const LAYOUT = {
  W: 1280,
  H: 960,
  COL_W: 80,
  BALL_D: 64,
  PLAYFIELD_X: 320, // left edge of column 0
  BOTTOM_ROW_Y: 856, // center of a ball at rowIndex 0
  FLOOR_Y: 906,
  READOUT_Y: 934,
  CLAW_Y: 216,
  QUEUE_Y: 92,
};

export const colX = (c) => LAYOUT.PLAYFIELD_X + c * LAYOUT.COL_W + LAYOUT.COL_W / 2;
export const rowY = (r) => LAYOUT.BOTTOM_ROW_Y - r * LAYOUT.BALL_D;
export const ballY = (col, stackIndex, tilts) => rowY(tiltOffset(col, tilts) + stackIndex);

// Ball colors 0..6: teal, red, green, blue, yellow, purple, orange
export const COLOR_TINTS = [0x2fd4c7, 0xe8404a, 0x49b654, 0x3b6ff0, 0xf3c53d, 0xa85fe0, 0xf07f2e];

// Imaginary light source above the field; ball speculars point toward it.
export const LIGHT = { x: LAYOUT.W / 2, y: -260 };
export const HEART_TINT = 0xf06292;
export const BOMB_TINT = 0x4a4a52;
export const STAR_TINT = 0xf3c53d;

export const TIMINGS = {
  CLAW_MOVE: 90,
  FALL_PER_ROW: 45,
  FALL_MIN: 140,
  TILT: 240,
  FLING_PER_COL: 120,
  MATCH_BURN: 380,
  SETTLE: 160,
  MERGE: 240,
  EXPLODE: 420,
  BANNER: 1200,
};

export const STORAGE = {
  LANG: 'swing.lang',
  SCORES: 'swing.highscores',
  NAME: 'swing.playername',
  SETTINGS: 'swing.settings',
};

export const FONTS = {
  UI: '"Trebuchet MS", "Verdana", sans-serif',
};
