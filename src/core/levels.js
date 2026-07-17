// Difficulty table and level progression.
export const DIFFICULTIES = {
  easy:   { factor: 1, startColors: 3, ballsPerLevel: 25 },
  normal: { factor: 2, startColors: 4, ballsPerLevel: 30 },
  hard:   { factor: 3, startColors: 5, ballsPerLevel: 35 },
};

export const MAX_COLORS = 7;

// One extra color every two levels, capped at MAX_COLORS.
export function colorCount(startColors, level) {
  return Math.min(startColors + Math.floor((level - 1) / 2), MAX_COLORS);
}

export const JOKER_CHANCE = 0.03;
export const JOKER_MIN_LEVEL = 2;
export const STARS_PER_PHASE = 8;
export const QUEUE_SIZE = 16;
