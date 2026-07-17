import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMatches } from '../src/core/match.js';
import { buildCore, byType, one } from './helpers.js';

const BALANCED = [0, 0, 0, 0];

test('three same-colored balls in one row match', () => {
  const core = buildCore({ columns: [[], [], ['r2'], ['r2'], ['r2'], ['g2']] });
  const groups = findMatches(core.columns, BALANCED);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].cells.length, 3);
  assert.deepEqual([...groups[0].classes], [1]); // red
});

test('same stackIndex but different tiltOffset does not match', () => {
  // col1 sits down (offset 0), cols 2+3 balanced (offset 1): rows differ
  const core = buildCore({ columns: [[], ['r2'], ['r2'], ['r2']] });
  assert.deepEqual(core.tilts, [1, 0, 0, 0]);
  assert.equal(findMatches(core.columns, core.tilts).length, 0);
});

test('a tilt shift creates the match (signature mechanic)', () => {
  // Same field as above; dropping b2 into col0 levels seesaw 0,
  // lifting col1 to offset 1 and aligning the three reds.
  const core = buildCore({
    columns: [[], ['r2'], ['r2'], ['r2']],
    current: 'b2',
    queue: ['g1'],
  });
  const events = core.drop(0);
  const match = one(events, 'match');
  assert.equal(match.cells.length, 3); // the three reds, now aligned on one row
  assert.equal(core.columns[1].length, 0);
  assert.equal(core.columns[0].length, 1); // the blue ball stays
});

test('flood fill removes connected same-colored balls', () => {
  const core = buildCore({
    columns: [[], [], ['r2'], ['r2'], ['r2', 'r3'], []],
  });
  const groups = findMatches(core.columns, BALANCED);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].cells.length, 4); // the r3 stacked on col4 joins
});

test('jokers are wildcards inside runs', () => {
  const core = buildCore({ columns: [[], [], ['r2'], ['J'], ['r2']] });
  const groups = findMatches(core.columns, BALANCED);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].cells.length, 3);
});

test('a run restarts from trailing jokers after a color break', () => {
  const core = buildCore({ columns: [[], ['g2'], ['J'], ['r2'], ['r2']] });
  const groups = findMatches(core.columns, BALANCED);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].cells.length, 3); // J, r, r
  assert.deepEqual([...groups[0].classes], [1]);
});

test('three jokers match on their own', () => {
  const core = buildCore({ columns: [[], [], ['J'], ['J'], ['J']] });
  const groups = findMatches(core.columns, BALANCED);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].cells.length, 3);
});

test('hearts form their own color class', () => {
  const core = buildCore({ columns: [[], [], ['H'], ['H'], ['J']] });
  const groups = findMatches(core.columns, BALANCED);
  assert.equal(groups.length, 1);
  assert.deepEqual([...groups[0].classes], ['heart']);
});

test('bombs never take part in matches', () => {
  const core = buildCore({ columns: [[], [], ['r2'], ['B'], ['r2']] });
  assert.equal(findMatches(core.columns, BALANCED).length, 0);
});
