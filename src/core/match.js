// Board geometry and match/merge detection.
//
// The playfield is 8 columns forming 4 seesaws (columns 2s and 2s+1).
// A seesaw's tilt is -1 (left side down), 0 (balanced) or +1 (right side down).
//
// Height model: each tilt step moves a shell by exactly one ball height, so
// balls always sit on an integer row grid. tiltOffset is 0 for a shell that is
// down, 1 balanced, 2 up; the visible row of a ball is tiltOffset + stackIndex.
// This reproduces the original's capacity rule (8 balls down / 7 balanced /
// 6 up) and makes "horizontally adjacent" a pure integer comparison.

import { colorClassOf } from './ball.js';

export const NUM_COLS = 8;
export const NUM_SEESAWS = 4;
export const BASE_CAPACITY = 8;

export const seesawOf = (col) => col >> 1;
export const leftCol = (s) => s * 2;
export const rightCol = (s) => s * 2 + 1;

export function tiltOffset(col, tilts) {
  const t = tilts[col >> 1];
  const isLeft = col % 2 === 0;
  const down = isLeft ? t === -1 : t === 1;
  const up = isLeft ? t === 1 : t === -1;
  return down ? 0 : up ? 2 : 1;
}

export function capacity(col, tilts) {
  return BASE_CAPACITY - tiltOffset(col, tilts);
}

export function rowIndex(col, stackIndex, tilts) {
  return tiltOffset(col, tilts) + stackIndex;
}

export function columnWeight(column) {
  return column.reduce((sum, b) => sum + b.weight, 0);
}

// ---------------------------------------------------------------------------
// Match detection: 3+ balls of one color class in a horizontal row (jokers are
// wildcards), then flood-filled to all connected balls of that class.
// Returns disjoint groups: [{ classes:Set, cells:[{ball,col,stackIndex,row}] }]
export function findMatches(columns, tilts) {
  // Sparse grid: grid[row][col] = { ball, stackIndex }
  const grid = [];
  for (let c = 0; c < NUM_COLS; c++) {
    const off = tiltOffset(c, tilts);
    columns[c].forEach((ball, si) => {
      const r = off + si;
      (grid[r] ||= [])[c] = { ball, stackIndex: si };
    });
  }

  // Scan each row for runs; jokers extend any run.
  const seeds = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    let run = [];
    let runClass = null; // null while the run is all jokers
    const close = () => {
      if (run.length >= 3) seeds.push({ cls: runClass, cells: run.slice() });
    };
    for (let c = 0; c < NUM_COLS; c++) {
      const cell = row[c];
      const ball = cell?.ball;
      if (!ball || ball.kind === 'bomb') {
        close();
        run = [];
        runClass = null;
        continue;
      }
      const entry = { ball, col: c, stackIndex: cell.stackIndex, row: r };
      const isJoker = ball.kind === 'joker';
      const cls = colorClassOf(ball);
      if (run.length === 0) {
        run = [entry];
        runClass = isJoker ? null : cls;
      } else if (isJoker) {
        run.push(entry);
      } else if (runClass === null) {
        runClass = cls;
        run.push(entry);
      } else if (cls === runClass) {
        run.push(entry);
      } else {
        // Color break: close the run, restart from its trailing jokers.
        close();
        const trail = [];
        for (let i = run.length - 1; i >= 0 && run[i].ball.kind === 'joker'; i--) {
          trail.unshift(run[i]);
        }
        run = [...trail, entry];
        runClass = cls;
      }
    }
    close();
  }
  if (!seeds.length) return [];

  // Flood fill each seed over 4-neighbors (vertical: same column stack +-1,
  // horizontal: neighbor column same row), collecting the seed's class + jokers.
  const groups = seeds.map((seed) => floodFill(seed, columns, tilts));

  // Union groups sharing any ball (a joker can bridge two colors).
  const merged = [];
  for (const g of groups) {
    const overlapping = merged.filter((m) => [...g.ids].some((id) => m.ids.has(id)));
    if (!overlapping.length) {
      merged.push(g);
      continue;
    }
    const target = overlapping[0];
    for (const other of overlapping.slice(1)) {
      merged.splice(merged.indexOf(other), 1);
      absorb(target, other);
    }
    absorb(target, g);
  }
  return merged.map(({ classes, cells }) => ({ classes, cells }));
}

function absorb(target, other) {
  for (const cell of other.cells) {
    if (!target.ids.has(cell.ball.id)) {
      target.ids.add(cell.ball.id);
      target.cells.push(cell);
    }
  }
  for (const cls of other.classes) target.classes.add(cls);
}

function floodFill(seed, columns, tilts) {
  const ids = new Set();
  const cells = [];
  const classes = new Set(seed.cls === null ? [] : [seed.cls]);
  const matches = (ball) =>
    ball.kind === 'joker' ||
    (seed.cls !== null && ball.kind !== 'bomb' && colorClassOf(ball) === seed.cls);
  const stack = [];
  for (const cell of seed.cells) {
    if (!ids.has(cell.ball.id)) {
      ids.add(cell.ball.id);
      cells.push(cell);
      stack.push(cell);
    }
  }
  while (stack.length) {
    const { col, stackIndex } = stack.pop();
    const row = rowIndex(col, stackIndex, tilts);
    const neighbors = [
      { col, stackIndex: stackIndex - 1 },
      { col, stackIndex: stackIndex + 1 },
      ...[col - 1, col + 1]
        .filter((c) => c >= 0 && c < NUM_COLS)
        .map((c) => ({ col: c, stackIndex: row - tiltOffset(c, tilts) })),
    ];
    for (const n of neighbors) {
      const ball = columns[n.col]?.[n.stackIndex];
      if (!ball || ids.has(ball.id) || !matches(ball)) continue;
      ids.add(ball.id);
      const cell = { ball, col: n.col, stackIndex: n.stackIndex, row: rowIndex(n.col, n.stackIndex, tilts) };
      cells.push(cell);
      stack.push(cell);
    }
  }
  return { ids, cells, classes };
}

// ---------------------------------------------------------------------------
// Merge detection: exactly 5 consecutive normal balls of one color stacked in
// a single column fuse into one ball carrying the summed weight. Returns the
// bottom-most candidate (lowest column first) or null.
export function findMerge(columns) {
  for (let c = 0; c < NUM_COLS; c++) {
    const col = columns[c];
    for (let i = 0; i + 5 <= col.length; i++) {
      const first = col[i];
      if (first.kind !== 'normal') continue;
      let ok = true;
      for (let j = 1; j < 5; j++) {
        const b = col[i + j];
        if (b.kind !== 'normal' || b.color !== first.color) {
          ok = false;
          break;
        }
      }
      if (ok) return { col: c, start: i, balls: col.slice(i, i + 5) };
    }
  }
  return null;
}
