// SwingCore: the complete game logic, free of any rendering concerns.
//
// One player move = core.drop(col, now). The core resolves everything that
// follows (landing, seesaw swings, catapulted balls, chain reactions, matches,
// merges, explosions, level progression) synchronously and returns an ordered
// event list. The renderer replays those events as animations; the core state
// is already final when drop() returns.

import { makeRng } from './rng.js';
import {
  DIFFICULTIES, colorCount, JOKER_CHANCE, JOKER_MIN_LEVEL,
  STARS_PER_PHASE, QUEUE_SIZE,
} from './levels.js';
import * as scoring from './scoring.js';
import {
  NUM_COLS, NUM_SEESAWS, leftCol, rightCol,
  tiltOffset, capacity, rowIndex, columnWeight, findMatches, findMerge,
} from './match.js';

const CHAIN_GUARD = 100;

export class SwingCore {
  constructor({ seed = 1, difficulty = 'normal', extras = true } = {}) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.difficulty = difficulty;
    this.diff = DIFFICULTIES[difficulty];
    this.extras = extras;
    this.nextId = 1;
    this.columns = Array.from({ length: NUM_COLS }, () => []);
    this.tilts = new Array(NUM_SEESAWS).fill(0);
    this.level = 1;
    this.score = 0;
    this.multiplier = 1;
    this.bonusExpiresAt = 0;
    this.ballsDropped = 0;
    this.starsLeft = 0;
    this.phase = 'playing'; // 'playing' | 'stars' | 'gameover'
    this.queue = Array.from({ length: QUEUE_SIZE }, () => this.spawnBall());
    this.current = this.spawnBall();
  }

  colorCount() {
    return colorCount(this.diff.startColors, this.level);
  }

  spawnBall() {
    if (this.extras && this.level >= JOKER_MIN_LEVEL && this.rng() < JOKER_CHANCE) {
      return { id: this.nextId++, kind: 'joker', color: null, weight: 0 };
    }
    const color = Math.floor(this.rng() * this.colorCount());
    const weight = 1 + Math.floor(this.rng() * 4);
    return { id: this.nextId++, kind: 'normal', color, weight };
  }

  spawnStar() {
    return { id: this.nextId++, kind: 'star', color: null, weight: 0 };
  }

  tiltOffsetOf(col) { return tiltOffset(col, this.tilts); }
  capacityOf(col) { return capacity(col, this.tilts); }
  rowIndexOf(col, stackIndex) { return rowIndex(col, stackIndex, this.tilts); }
  weightOf(col) { return columnWeight(this.columns[col]); }

  computeTilt(s) {
    const wl = this.weightOf(leftCol(s));
    const wr = this.weightOf(rightCol(s));
    return wl > wr ? -1 : wr > wl ? 1 : 0;
  }

  // Bonus lamps decay over time; called by drop() and every frame by the UI.
  updateBonus(now) {
    const events = [];
    if (this.multiplier > 1 && now >= this.bonusExpiresAt) {
      const steps = 1 + Math.floor((now - this.bonusExpiresAt) / scoring.BONUS_STEP_MS);
      const m = Math.max(1, this.multiplier - steps);
      if (m !== this.multiplier) {
        this.multiplier = m;
        this.bonusExpiresAt = now + scoring.BONUS_STEP_MS;
        events.push({ type: 'bonusLamp', multiplier: m });
      }
    }
    return events;
  }

  drop(col, now = 0) {
    if (this.phase === 'gameover' || !this.current) return [];
    if (col < 0 || col >= NUM_COLS) throw new Error(`invalid column ${col}`);
    const events = [...this.updateBonus(now)];
    const ball = this.current;
    this.current = null;
    events.push({ type: 'drop', ball: { ...ball }, col });
    this.resolve(ball, col, events, now);
    if (this.phase === 'gameover') return events;

    // Level progression
    if (this.phase === 'stars') {
      this.starsLeft--;
      if (this.starsLeft <= 0) {
        this.level++;
        this.ballsDropped = 0;
        this.phase = 'playing';
        this.queue = Array.from({ length: QUEUE_SIZE }, () => this.spawnBall());
        events.push({ type: 'levelUp', level: this.level, colorCount: this.colorCount() });
      }
    } else {
      this.ballsDropped++;
      if (this.ballsDropped >= this.diff.ballsPerLevel) {
        this.phase = 'stars';
        this.starsLeft = STARS_PER_PHASE;
        this.queue = Array.from({ length: STARS_PER_PHASE }, () => this.spawnStar());
        events.push({ type: 'starPhase', stars: STARS_PER_PHASE });
      }
    }

    // Advance the claw to the next ball.
    this.current = this.queue.shift() ?? (this.phase === 'playing' ? this.spawnBall() : null);
    if (this.phase === 'playing' && this.queue.length < QUEUE_SIZE) {
      this.queue.push(this.spawnBall());
    }
    events.push({
      type: 'spawn',
      current: this.current && { ...this.current },
      queue: this.queue.map((b) => ({ ...b })),
    });
    return events;
  }

  // -------------------------------------------------------------------------
  // Resolution loop: process landings one at a time (there is never more than
  // one ball in flight); when the air is clear, run matches, then merges,
  // until the field is stable.
  resolve(ball, col, events, now) {
    let landings = [{ ball, col }];
    let guard = 0;
    for (;;) {
      while (landings.length) {
        if (++guard > CHAIN_GUARD) {
          events.push({ type: 'chainBreak' });
          return;
        }
        const landing = landings.shift();
        this.columns[landing.col].push(landing.ball);
        events.push({
          type: 'land',
          ball: { ...landing.ball },
          col: landing.col,
          stackIndex: this.columns[landing.col].length - 1,
        });
        if (landing.ball.kind === 'bomb') {
          this.explode(landing.col, this.columns[landing.col].length - 1, events);
          landings.push(...this.rebalanceAll(events));
        } else {
          landings.push(...this.rebalance(landing.col >> 1, events));
        }
        if (this.checkOverflow(events)) return;
      }
      const matches = findMatches(this.columns, this.tilts);
      if (matches.length) {
        this.applyMatches(matches, events, now);
        landings.push(...this.rebalanceAll(events));
        continue;
      }
      const merge = findMerge(this.columns);
      if (merge) {
        // Merging keeps the column weight, so no rebalance — but the stack
        // shortens, which shifts rows above and can enable new matches.
        this.applyMerge(merge, events);
        continue;
      }
      return;
    }
  }

  // Recompute one seesaw. On a swing to a non-balanced position the top ball
  // of the rising side is catapulted outward by the weight difference.
  rebalance(s, events) {
    const old = this.tilts[s];
    const neu = this.computeTilt(s);
    if (neu === old) return [];
    this.tilts[s] = neu;
    const wl = this.weightOf(leftCol(s));
    const wr = this.weightOf(rightCol(s));
    events.push({ type: 'tilt', seesaw: s, from: old, to: neu, weights: [wl, wr] });
    if (neu === 0) return [];
    const riser = neu === -1 ? rightCol(s) : leftCol(s);
    if (!this.columns[riser].length) return [];
    const distance = Math.abs(wl - wr);
    const flung = this.columns[riser].pop();
    const dir = riser % 2 === 1 ? 1 : -1;
    const raw = riser + dir * distance;
    const wrapped = raw < 0 || raw >= NUM_COLS;
    const target = ((raw % NUM_COLS) + NUM_COLS) % NUM_COLS;
    let transform = null;
    if (wrapped) {
      // Leaving the field transforms the ball: normal -> heart, special -> bomb.
      if (flung.kind === 'normal') {
        Object.assign(flung, { kind: 'heart', color: null, weight: 0 });
      } else if (flung.kind !== 'bomb') {
        Object.assign(flung, { kind: 'bomb', color: null, weight: 0 });
      }
      transform = flung.kind;
    }
    events.push({
      type: 'fling',
      ball: { ...flung },
      from: riser,
      to: target,
      distance,
      dir,
      wrapped,
      transform,
    });
    return [{ ball: flung, col: target }];
  }

  rebalanceAll(events) {
    const landings = [];
    for (let s = 0; s < NUM_SEESAWS; s++) landings.push(...this.rebalance(s, events));
    return landings;
  }

  checkOverflow(events) {
    for (let c = 0; c < NUM_COLS; c++) {
      if (this.columns[c].length > this.capacityOf(c)) {
        this.phase = 'gameover';
        events.push({ type: 'gameOver', reason: 'overflow', col: c, scoreAfter: this.score });
        return true;
      }
    }
    return false;
  }

  applyMatches(matches, events, now) {
    const allIds = new Set();
    for (const group of matches) {
      let points;
      if (group.classes.has('star')) {
        points = scoring.starRowBonus(this.level, this.diff.factor);
      } else {
        const weightSum = group.cells.reduce((s, c) => s + scoring.effectiveWeight(c.ball), 0);
        points = scoring.matchPoints(
          weightSum, group.cells.length, this.level, this.diff.factor, this.multiplier,
        );
      }
      this.score += points;
      events.push({
        type: 'match',
        cells: group.cells.map((c) => ({ ballId: c.ball.id, col: c.col, stackIndex: c.stackIndex })),
        classes: [...group.classes],
        points,
        multiplier: this.multiplier,
        scoreAfter: this.score,
      });
      this.multiplier = Math.min(scoring.MAX_MULTIPLIER, this.multiplier + 1);
      this.bonusExpiresAt = now + scoring.BONUS_DECAY_MS;
      events.push({ type: 'bonusLamp', multiplier: this.multiplier });
      for (const c of group.cells) allIds.add(c.ball.id);
    }
    this.removeBalls(allIds, events);
  }

  applyMerge(merge, events) {
    const { col, start, balls } = merge;
    const weight = balls.reduce((s, b) => s + b.weight, 0);
    const merged = { id: this.nextId++, kind: 'normal', color: balls[0].color, weight };
    const column = this.columns[col];
    const movedAbove = column.slice(start + 5);
    column.splice(start, 5, merged);
    const points = scoring.mergeBonus(weight);
    this.score += points;
    events.push({
      type: 'merge',
      col,
      stackIndex: start,
      removed: balls.map((b) => b.id),
      ball: { ...merged },
      points,
      scoreAfter: this.score,
    });
    if (movedAbove.length) {
      events.push({
        type: 'settle',
        moves: movedAbove.map((b, i) => ({
          ballId: b.id, col, from: start + 5 + i, to: start + 1 + i,
        })),
      });
    }
  }

  // Bomb explosion: destroys everything within one column and one row of the
  // bomb (3x3 in row coordinates, so tilt alignment matters). Other bombs in
  // the blast chain-explode.
  explode(col, stackIndex, events) {
    const toRemove = new Map(); // id -> {ball,col,stackIndex}
    const pending = [[col, stackIndex]];
    const processed = new Set();
    while (pending.length) {
      const [bc, bs] = pending.shift();
      const bomb = this.columns[bc][bs];
      if (!bomb || processed.has(bomb.id)) continue;
      processed.add(bomb.id);
      const bombRow = this.rowIndexOf(bc, bs);
      for (let c = Math.max(0, bc - 1); c <= Math.min(NUM_COLS - 1, bc + 1); c++) {
        const off = this.tiltOffsetOf(c);
        this.columns[c].forEach((ball, si) => {
          if (Math.abs(off + si - bombRow) > 1 || toRemove.has(ball.id)) return;
          toRemove.set(ball.id, { ball, col: c, stackIndex: si });
          if (ball.kind === 'bomb' && !processed.has(ball.id)) pending.push([c, si]);
        });
      }
    }
    const removed = [...toRemove.values()];
    const weightSum = removed.reduce((s, r) => s + r.ball.weight, 0);
    const points = scoring.bombPoints(weightSum, this.diff.factor, this.multiplier);
    this.score += points;
    events.push({
      type: 'explode',
      col,
      stackIndex,
      removed: removed.map((r) => ({ ballId: r.ball.id, col: r.col, stackIndex: r.stackIndex })),
      points,
      scoreAfter: this.score,
    });
    this.removeBalls(new Set(toRemove.keys()), events);
  }

  // Remove balls by id; emit one settle event for every ball that slides down.
  removeBalls(ids, events) {
    const moves = [];
    for (let c = 0; c < NUM_COLS; c++) {
      const before = this.columns[c];
      const after = before.filter((b) => !ids.has(b.id));
      if (after.length === before.length) continue;
      after.forEach((b, newIndex) => {
        const oldIndex = before.indexOf(b);
        if (oldIndex !== newIndex) moves.push({ ballId: b.id, col: c, from: oldIndex, to: newIndex });
      });
      this.columns[c] = after;
    }
    if (moves.length) events.push({ type: 'settle', moves });
  }

  // -------------------------------------------------------------------------
  snapshot() {
    return structuredClone({
      seed: this.seed,
      rngState: this.rng.getState(),
      nextId: this.nextId,
      difficulty: this.difficulty,
      extras: this.extras,
      columns: this.columns,
      tilts: this.tilts,
      queue: this.queue,
      current: this.current,
      score: this.score,
      level: this.level,
      multiplier: this.multiplier,
      bonusExpiresAt: this.bonusExpiresAt,
      ballsDropped: this.ballsDropped,
      starsLeft: this.starsLeft,
      phase: this.phase,
    });
  }

  static fromSnapshot(snap) {
    const core = Object.create(SwingCore.prototype);
    const s = structuredClone(snap);
    core.seed = s.seed ?? 1;
    core.rng = makeRng(core.seed);
    if (s.rngState !== undefined) core.rng.setState(s.rngState);
    core.difficulty = s.difficulty ?? 'normal';
    core.diff = DIFFICULTIES[core.difficulty];
    core.extras = s.extras ?? true;
    core.nextId = s.nextId ?? 10000;
    core.columns = s.columns ?? Array.from({ length: NUM_COLS }, () => []);
    core.tilts = s.tilts ?? new Array(NUM_SEESAWS).fill(0);
    core.queue = s.queue ?? [];
    core.current = s.current ?? null;
    core.score = s.score ?? 0;
    core.level = s.level ?? 1;
    core.multiplier = s.multiplier ?? 1;
    core.bonusExpiresAt = s.bonusExpiresAt ?? 0;
    core.ballsDropped = s.ballsDropped ?? 0;
    core.starsLeft = s.starsLeft ?? 0;
    core.phase = s.phase ?? 'playing';
    return core;
  }
}

export { NUM_COLS, NUM_SEESAWS };
