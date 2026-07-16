import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCore, byType, one } from './helpers.js';

test('a normal ball flung off the field wraps around as a heart', () => {
  // seesaw 0: col0 = [r3], col1 = [g1] -> tilt -1. Dropping g4 on col1 flips
  // it; r3 is flung 2 columns left off the edge and re-enters at col6.
  const core = buildCore({
    columns: [['r3'], ['g1']],
    current: 'g4',
    queue: ['g1'],
  });
  const events = core.drop(1);
  const fling = one(events, 'fling');
  assert.equal(fling.wrapped, true);
  assert.equal(fling.distance, 2);
  assert.equal(fling.to, 6);
  assert.equal(fling.transform, 'heart');
  assert.equal(core.columns[0].length, 0);
  assert.equal(core.columns[6].length, 1);
  assert.equal(core.columns[6][0].kind, 'heart');
  assert.equal(core.columns[6][0].weight, 0); // specials are weightless
});

test('a special ball flung off the field becomes a bomb and explodes on landing', () => {
  // Top of col0 is a joker; it wraps to col6 as a bomb and blasts the two
  // yellow balls sitting within one row/column of the impact.
  const core = buildCore({
    columns: [['r3', 'J'], ['g1'], [], [], [], ['y2', 'y2']],
    current: 'g4',
    queue: ['g1'],
  });
  const events = core.drop(1);
  const fling = one(events, 'fling');
  assert.equal(fling.transform, 'bomb');
  assert.equal(fling.to, 6);
  const explode = one(events, 'explode');
  assert.equal(explode.removed.length, 3); // bomb + two yellows
  assert.equal(explode.points, 4 * 10 * 2 * 1); // weight 4, factor 2, x1
  assert.equal(core.columns[5].length, 0);
  assert.equal(core.columns[6].length, 0);
});

test('fling distances beyond the field width wrap around via modulo', () => {
  // An artificial heavy (merged) ball creates a distance-9 fling from col0:
  // raw target -9 wraps to col7.
  const core = buildCore({
    columns: [['r4'], []],
    current: 'g13',
    queue: ['g1'],
  });
  const events = core.drop(1);
  const fling = one(events, 'fling');
  assert.equal(fling.distance, 9);
  assert.equal(fling.to, 7);
  assert.equal(fling.wrapped, true);
  assert.equal(core.columns[7][0].kind, 'heart');
});
