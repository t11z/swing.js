import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCore, byType, one } from './helpers.js';

test('overfilling a shell ends the game', () => {
  // col2 is down (cap 8) holding 8 balls; the 9th overflows.
  const core = buildCore({
    columns: [[], [], ['r1', 'g1', 'r1', 'g1', 'r1', 'g1', 'r1', 'g1'], ['b1']],
    current: 'y1',
    queue: ['g1'],
  });
  assert.equal(core.tilts[1], -1);
  const events = core.drop(2);
  const over = one(events, 'gameOver');
  assert.equal(over.reason, 'overflow');
  assert.equal(over.col, 2);
  assert.equal(core.phase, 'gameover');
  assert.deepEqual(core.drop(0), []); // dead cores don't play
});

test('a shell rising under a full stack shrinks capacity and can end the game', () => {
  // col0 is down with 8 balls (cap 8). Dropping b4 on col1 balances the
  // seesaw: col0 rises to cap 7 with 8 balls -> game over. No fling happens
  // on a swing to balanced, so nothing rescues the stack.
  const core = buildCore({
    columns: [['r1', 'g1', 'r1', 'g1', 'r1', 'g1', 'r1', 'g1'], ['g4']],
    current: 'b4',
    queue: ['g1'],
  });
  assert.equal(core.tilts[0], -1);
  const events = core.drop(1);
  assert.equal(one(events, 'tilt').to, 0);
  assert.equal(byType(events, 'fling').length, 0);
  const over = one(events, 'gameOver');
  assert.equal(over.col, 0);
  assert.equal(core.phase, 'gameover');
});
