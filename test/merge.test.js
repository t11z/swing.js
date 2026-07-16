import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMerge } from '../src/core/match.js';
import { ball, buildCore, byType, one } from './helpers.js';

test('five stacked same-colored balls merge into one with the summed weight', () => {
  // col2 has 4 reds (w4); col3 g4+g1 (w5). Dropping r1 balances the seesaw
  // (5 vs 5) and completes the 5-stack; no horizontal match exists.
  const core = buildCore({
    columns: [[], [], ['r1', 'r1', 'r1', 'r1'], ['g4', 'g1']],
    current: 'r1',
    queue: ['g1'],
  });
  const events = core.drop(2);
  const merge = one(events, 'merge');
  assert.equal(merge.col, 2);
  assert.equal(merge.ball.weight, 5);
  assert.equal(merge.removed.length, 5);
  assert.equal(core.columns[2].length, 1);
  assert.equal(core.columns[2][0].weight, 5);
  assert.equal(core.columns[2][0].color, 1);
});

test('matches take precedence over merges', () => {
  // Dropping r1 on col2 completes BOTH a 5-stack in col2 and (after the tilt
  // shift) a horizontal red row col0-col2. The match must win and flood-fill
  // eats the whole red stack.
  const core = buildCore({
    columns: [['r2'], ['r2'], ['r1', 'r1', 'r1', 'r1'], ['g4']],
    current: 'r1',
    queue: ['g1'],
  });
  const events = core.drop(2);
  assert.equal(byType(events, 'merge').length, 0);
  const match = one(events, 'match');
  assert.equal(match.cells.length, 7); // 2 + 5 connected reds
  assert.equal(core.columns[2].length, 0);
});

test('findMerge only accepts five consecutive normal balls of one color', () => {
  const columns = [
    ['r1', 'r1', 'r1', 'r1', 'g1'],
    ['r1', 'r1', 'J', 'r1', 'r1'],
    ['g1', 'g1', 'g1', 'g1', 'g1'],
    [], [], [], [], [],
  ].map((col) => col.map(ball));
  const merge = findMerge(columns);
  assert.equal(merge.col, 2);
  assert.equal(merge.start, 0);
});
