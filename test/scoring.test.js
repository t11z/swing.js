import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCore, byType, one } from './helpers.js';

test('match points follow weightSum x count x 5 x level x difficulty x multiplier', () => {
  const core = buildCore({
    columns: [[], [], ['r2'], ['r2'], [], ['g2']],
    current: 'r2',
    queue: ['g1'],
    level: 2,
    multiplier: 2,
    difficulty: 'hard', // factor 3
    bonusExpiresAt: 1e12, // keep the multiplier from decaying at now=0
  });
  const events = core.drop(4);
  const match = one(events, 'match');
  assert.equal(match.points, 6 * 3 * 5 * 2 * 3 * 2); // 1080
  assert.equal(match.scoreAfter, 1080);
  assert.equal(core.score, 1080);
});

test('two match groups in one drop cascade the multiplier', () => {
  // Cols 2-4 hold red (row 1) over green (row 2); everything balanced.
  // A neutral drop into col6 triggers both rows at once.
  const core = buildCore({
    columns: [
      [], [],
      ['r2', 'g2'], ['r2', 'g2'], ['r2', 'g2'], ['y2', 'b2'],
      [], [],
    ],
    current: 'b1',
    queue: ['g1'],
  });
  const events = core.drop(6);
  const matches = byType(events, 'match');
  assert.equal(matches.length, 2);
  assert.equal(matches[0].multiplier, 1);
  assert.equal(matches[1].multiplier, 2);
  assert.equal(matches[0].points, 6 * 3 * 5 * 1 * 2 * 1); // 180 (reds)
  assert.equal(matches[1].points, 6 * 3 * 5 * 1 * 2 * 2); // 360 (greens)
  assert.equal(core.score, 540);
  assert.equal(core.multiplier, 3);
});

test('bonus multiplier decays stepwise over time', () => {
  const core = buildCore({ multiplier: 3, bonusExpiresAt: 1000 });
  assert.equal(core.updateBonus(999).length, 0);
  assert.equal(core.multiplier, 3);
  const events = core.updateBonus(1000);
  assert.equal(one(events, 'bonusLamp').multiplier, 2);
  const events2 = core.updateBonus(4000);
  assert.equal(one(events2, 'bonusLamp').multiplier, 1);
  assert.equal(core.updateBonus(99999).length, 0); // already at x1
});

test('merge bonus is 10 points per merged weight unit', () => {
  const core = buildCore({
    columns: [[], [], ['r1', 'r1', 'r1', 'r1'], ['g4', 'g1']],
    current: 'r1',
    queue: ['g1'],
  });
  const events = core.drop(2);
  assert.equal(one(events, 'merge').points, 50);
});
