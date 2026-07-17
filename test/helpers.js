// Fixture helpers: build exact core states from a compact notation.
//
//   ball('r3')  -> normal red ball, weight 3
//   ball('J')   -> joker      ball('H') -> heart
//   ball('S')   -> star       ball('B') -> bomb
//
// Colors: t(eal)=0 r(ed)=1 g(reen)=2 b(lue)=3 y(ellow)=4 p(urple)=5 o(range)=6

import { SwingCore } from '../src/core/swingCore.js';

export const COLOR_LETTERS = { t: 0, r: 1, g: 2, b: 3, y: 4, p: 5, o: 6 };
const KIND_LETTERS = { J: 'joker', H: 'heart', S: 'star', B: 'bomb' };

let nextId = 1000;

export function ball(spec) {
  if (typeof spec === 'object') return spec;
  if (KIND_LETTERS[spec[0]]) {
    return { id: nextId++, kind: KIND_LETTERS[spec[0]], color: null, weight: 0 };
  }
  const color = COLOR_LETTERS[spec[0]];
  if (color === undefined) throw new Error(`bad ball spec: ${spec}`);
  return { id: nextId++, kind: 'normal', color, weight: Number(spec.slice(1) || 1) };
}

// buildCore({ columns: [['r1','r2'], [], ['g3']], current: 'b2', ... })
// Tilts are derived from the column weights unless given explicitly.
export function buildCore({ columns = [], tilts, current = null, queue = [], ...rest } = {}) {
  const cols = Array.from({ length: 8 }, (_, c) => (columns[c] || []).map(ball));
  const core = SwingCore.fromSnapshot({
    columns: cols,
    current: current ? ball(current) : null,
    queue: queue.map(ball),
    ...rest,
  });
  core.tilts = tilts ?? [0, 1, 2, 3].map((s) => core.computeTilt(s));
  return core;
}

export const byType = (events, type) => events.filter((e) => e.type === type);
export const one = (events, type) => {
  const list = byType(events, type);
  if (list.length !== 1) {
    throw new Error(`expected exactly one ${type} event, got ${list.length}: ${JSON.stringify(events.map((e) => e.type))}`);
  }
  return list[0];
};
