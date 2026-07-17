import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SwingCore } from '../src/core/swingCore.js';
import { colorCount } from '../src/core/levels.js';
import { buildCore, byType, one } from './helpers.js';

test('colorCount grows every two levels up to the cap', () => {
  assert.equal(colorCount(4, 1), 4);
  assert.equal(colorCount(4, 2), 4);
  assert.equal(colorCount(4, 3), 5);
  assert.equal(colorCount(4, 5), 6);
  assert.equal(colorCount(4, 99), 7);
});

test('the star phase starts after ballsPerLevel drops', () => {
  const core = buildCore({
    ballsDropped: 29, // normal difficulty: 30 per level
    current: 'r1',
    queue: ['g1', 'b2'],
  });
  const events = core.drop(0);
  one(events, 'starPhase');
  assert.equal(core.phase, 'stars');
  assert.equal(core.current.kind, 'star');
  assert.equal(core.queue.length, 7);
  assert.ok(core.queue.every((b) => b.kind === 'star'));
});

test('a row of three stars pays the star bonus', () => {
  const core = buildCore({
    columns: [[], [], ['S'], ['S']],
    current: 'S',
    queue: ['S', 'S'],
    phase: 'stars',
    starsLeft: 5,
  });
  const events = core.drop(4);
  const match = one(events, 'match');
  assert.deepEqual(match.classes, ['star']);
  assert.equal(match.points, 500 * 1 * 2); // level 1, normal
  assert.equal(core.starsLeft, 4);
  assert.equal(core.phase, 'stars');
});

test('dropping the last star levels up and refills the queue', () => {
  const core = buildCore({
    phase: 'stars',
    starsLeft: 1,
    current: 'S',
    queue: [],
    level: 1,
  });
  const events = core.drop(0);
  const up = one(events, 'levelUp');
  assert.equal(up.level, 2);
  assert.equal(core.phase, 'playing');
  assert.equal(core.ballsDropped, 0);
  assert.equal(core.queue.length, 16);
  assert.ok(core.current);
  assert.notEqual(core.current.kind, 'star');
});

test('same seed, same moves -> identical games', () => {
  const a = new SwingCore({ seed: 42 });
  const b = new SwingCore({ seed: 42 });
  const moves = [0, 3, 5, 2, 7, 4, 1, 6, 0, 3];
  const eventsA = moves.flatMap((c) => a.drop(c, 0).map((e) => e.type));
  const eventsB = moves.flatMap((c) => b.drop(c, 0).map((e) => e.type));
  assert.deepEqual(eventsA, eventsB);
  assert.deepEqual(a.snapshot(), b.snapshot());
});
