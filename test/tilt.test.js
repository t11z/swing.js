import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiltOffset, capacity } from '../src/core/match.js';
import { buildCore, byType, one } from './helpers.js';

test('empty seesaws are balanced', () => {
  const core = buildCore({});
  assert.deepEqual(core.tilts, [0, 0, 0, 0]);
  for (let s = 0; s < 4; s++) assert.equal(core.computeTilt(s), 0);
});

test('tiltOffset and capacity follow the 8/7/6 rule', () => {
  // seesaw 0 tilted left-down: col0 down (offset 0, cap 8), col1 up (offset 2, cap 6)
  const tilts = [-1, 0, 1, 0];
  assert.equal(tiltOffset(0, tilts), 0);
  assert.equal(tiltOffset(1, tilts), 2);
  assert.equal(capacity(0, tilts), 8);
  assert.equal(capacity(1, tilts), 6);
  // balanced seesaw 1: both offset 1, cap 7
  assert.equal(tiltOffset(2, tilts), 1);
  assert.equal(tiltOffset(3, tilts), 1);
  assert.equal(capacity(2, tilts), 7);
  // seesaw 2 tilted right-down: col4 up, col5 down
  assert.equal(tiltOffset(4, tilts), 2);
  assert.equal(tiltOffset(5, tilts), 0);
});

test('heavier side goes down on drop', () => {
  const core = buildCore({ current: 'r3', queue: ['g1'] });
  const events = core.drop(0);
  const tilt = one(events, 'tilt');
  assert.equal(tilt.seesaw, 0);
  assert.equal(tilt.from, 0);
  assert.equal(tilt.to, -1);
  assert.deepEqual(core.tilts, [-1, 0, 0, 0]);
});

test('a heavy drop flips a seesaw straight from -1 to +1', () => {
  const core = buildCore({
    columns: [['r1'], []],
    current: 'g4',
    queue: ['g1'],
  });
  assert.equal(core.tilts[0], -1);
  const events = core.drop(1);
  const tilt = one(events, 'tilt');
  assert.equal(tilt.from, -1);
  assert.equal(tilt.to, 1);
});
