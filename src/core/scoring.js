// Scoring formulas. The original manual lists the factors of a match score as
// weight sum x ball count x level x bonus x difficulty; the exact constants
// are our own tuning.

export const BONUS_DECAY_MS = 4000; // lamps stay lit this long after a match
export const BONUS_STEP_MS = 1500;  // then decay one multiplier step per interval
export const MAX_MULTIPLIER = 4;

// Specials are weightless on the seesaw but still worth something in a match.
export function effectiveWeight(ball) {
  return ball.kind === 'normal' ? ball.weight : 2;
}

export function matchPoints(weightSum, count, level, factor, multiplier) {
  return weightSum * count * 5 * level * factor * multiplier;
}

export function starRowBonus(level, factor) {
  return 500 * level * factor;
}

export function bombPoints(weightSum, factor, multiplier) {
  return weightSum * 10 * factor * multiplier;
}

export function mergeBonus(weight) {
  return weight * 10;
}
