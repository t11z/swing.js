import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCore, byType, one } from './helpers.js';

test('swing catapults the top ball of the rising side by the weight difference', () => {
  // seesaw 1: col2 = [r4, r1] (w5, top r1), col3 = [g2] (w2) -> tilt -1
  const core = buildCore({
    columns: [[], [], ['r4', 'r1'], ['g2']],
    current: 'b4',
    queue: ['g1'],
  });
  assert.equal(core.tilts[1], -1);
  const events = core.drop(3); // w3 becomes 6 > 5 -> flips to +1
  const fling = one(events, 'fling');
  assert.equal(fling.from, 2);
  assert.equal(fling.distance, 1); // |5 - 6|, flung ball still counted
  assert.equal(fling.dir, -1); // left shell flings outward to the left
  assert.equal(fling.to, 1);
  assert.equal(fling.wrapped, false);
  assert.equal(byType(events, 'land').length, 2); // drop + fling landing
  assert.equal(core.columns[1].length, 1);
  assert.equal(core.columns[1][0].weight, 1);
  assert.equal(core.columns[2].length, 1); // r4 stays
});

test('event order: land before tilt before fling', () => {
  const core = buildCore({
    columns: [[], [], ['r4', 'r1'], ['g2']],
    current: 'b4',
    queue: ['g1'],
  });
  const types = core.drop(3).map((e) => e.type);
  const land = types.indexOf('land');
  const tilt = types.indexOf('tilt');
  const fling = types.indexOf('fling');
  assert.ok(land < tilt && tilt < fling, `bad order: ${types}`);
});

test('swinging to balanced never flings', () => {
  // seesaw 2: col4 = [r2] vs col5 empty -> tilt -1; drop g2 on col5 -> balanced
  const core = buildCore({
    columns: [[], [], [], [], ['r2'], []],
    current: 'g2',
    queue: ['g1'],
  });
  assert.equal(core.tilts[2], -1);
  const events = core.drop(5);
  assert.equal(one(events, 'tilt').to, 0);
  assert.equal(byType(events, 'fling').length, 0);
});

test('no fling when the rising shell is empty', () => {
  const core = buildCore({ current: 'r3', queue: ['g1'] });
  const events = core.drop(0); // tips seesaw 0, col1 is empty
  assert.equal(one(events, 'tilt').to, -1);
  assert.equal(byType(events, 'fling').length, 0);
});

test('right shell flings outward to the right', () => {
  // seesaw 1: col2 = [r1], col3 = [g4] -> tilt +1; drop b4 on col2 flips it
  const core = buildCore({
    columns: [[], [], ['r1'], ['g4']],
    current: 'b4',
    queue: ['g1'],
  });
  assert.equal(core.tilts[1], 1);
  const events = core.drop(2); // w2 = 5 > 4 -> tilt -1, riser col3
  const fling = one(events, 'fling');
  assert.equal(fling.from, 3);
  assert.equal(fling.dir, 1);
  assert.equal(fling.to, 4);
});
