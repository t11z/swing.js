// Plays the ordered event list returned by SwingCore.drop() as animations.
// The core's state is already final when playback starts, so the player keeps
// its own mirror of column contents and tilts to know where sprites are
// mid-animation.
import { LAYOUT, TIMINGS, colX, rowY } from '../config.js';
import { tiltOffset, NUM_COLS } from '../core/match.js';
import { BallSprite } from './BallSprite.js';
import { fireBurst, explosion, starFlash, floatText } from './effects.js';

export class EventPlayer {
  constructor(scene) {
    this.scene = scene;
    this.viewTilts = [0, 0, 0, 0];
    this.viewCols = Array.from({ length: NUM_COLS }, () => []);
    this.playing = false;
  }

  yFor(col, stackIndex) {
    return rowY(tiltOffset(col, this.viewTilts) + stackIndex);
  }

  tween(config) {
    return new Promise((resolve) => {
      this.scene.tweens.add({ ...config, onComplete: resolve });
    });
  }

  wait(ms) {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  async play(events) {
    this.playing = true;
    for (const ev of events) {
      const handler = this[`on_${ev.type}`];
      if (handler) await handler.call(this, ev);
      this.scene.onCoreEvent(ev);
    }
    this.playing = false;
  }

  // --- event handlers -------------------------------------------------------

  async on_drop(ev) {
    await this.scene.claw.moveTo(ev.col);
    const sprite = this.scene.claw.release();
    if (sprite) this.scene.sprites.set(ev.ball.id, sprite);
    this.scene.sfx('drop', 0.4);
  }

  async on_land(ev) {
    let sprite = this.scene.sprites.get(ev.ball.id);
    if (!sprite) {
      sprite = new BallSprite(this.scene, ev.ball, colX(ev.col), LAYOUT.CLAW_Y);
      this.scene.sprites.set(ev.ball.id, sprite);
    }
    this.viewCols[ev.col].push(ev.ball.id);
    const targetY = this.yFor(ev.col, ev.stackIndex);
    const rows = Math.max(1, Math.abs(targetY - sprite.y) / LAYOUT.BALL_D);
    sprite.setDepth(20);
    await this.tween({
      targets: sprite,
      x: colX(ev.col),
      y: targetY,
      duration: Math.max(TIMINGS.FALL_MIN, rows * TIMINGS.FALL_PER_ROW),
      ease: 'Quad.easeIn',
    });
    sprite.setDepth(10);
    this.scene.sfx(`land_${ev.ball.id % 3}`, 0.5);
    // little squash on impact
    await this.tween({
      targets: sprite, scaleY: 0.88, duration: 55, yoyo: true, ease: 'Quad.easeOut',
    });
  }

  async on_tilt(ev) {
    this.viewTilts[ev.seesaw] = ev.to;
    const seesawView = this.scene.seesaws[ev.seesaw];
    const moves = [seesawView.setTilt(ev.to)];
    for (const col of [ev.seesaw * 2, ev.seesaw * 2 + 1]) {
      this.viewCols[col].forEach((id, si) => {
        const sprite = this.scene.sprites.get(id);
        if (sprite) {
          moves.push(this.tween({
            targets: sprite,
            y: this.yFor(col, si),
            duration: TIMINGS.TILT,
            ease: 'Sine.easeInOut',
          }));
        }
      });
    }
    this.scene.sfx('tilt_0', 0.35);
    await Promise.all(moves);
  }

  async on_fling(ev) {
    const colArr = this.viewCols[ev.from];
    const idx = colArr.lastIndexOf(ev.ball.id);
    if (idx >= 0) colArr.splice(idx, 1);
    let sprite = this.scene.sprites.get(ev.ball.id);
    this.scene.sfx('fling', 0.5);
    if (!ev.wrapped) {
      const x1 = colX(ev.to);
      const hoverY = this.yFor(ev.to, this.viewCols[ev.to].length) - LAYOUT.BALL_D;
      await this.arc(sprite, x1, hoverY, ev.distance);
      return;
    }
    // Wrap-around: fly off the edge, transform, re-enter from the other side.
    const offX = ev.dir === 1 ? LAYOUT.W + 80 : -80;
    await this.arc(sprite, offX, sprite.y - 120, Math.max(2, ev.distance / 2), { fade: true });
    this.scene.sprites.delete(ev.ball.id);
    sprite.destroy();
    const inX = ev.dir === 1 ? -80 : LAYOUT.W + 80;
    const hoverY = this.yFor(ev.to, this.viewCols[ev.to].length) - LAYOUT.BALL_D;
    sprite = new BallSprite(this.scene, ev.ball, inX, hoverY - 60);
    sprite.setAlpha(0);
    sprite.setDepth(20);
    this.scene.sprites.set(ev.ball.id, sprite);
    starFlash(this.scene, colX(ev.to), hoverY - 40);
    await this.tween({
      targets: sprite,
      x: colX(ev.to),
      y: hoverY,
      alpha: 1,
      duration: 260,
      ease: 'Quad.easeOut',
    });
  }

  arc(sprite, x1, y1, distance, { fade = false } = {}) {
    const x0 = sprite.x;
    const y0 = sprite.y;
    const height = 90 + distance * 30;
    const proxy = { t: 0 };
    sprite.setDepth(30);
    return this.tween({
      targets: proxy,
      t: 1,
      duration: Math.max(240, distance * TIMINGS.FLING_PER_COL),
      ease: 'Linear',
      onUpdate: () => {
        const { t } = proxy;
        sprite.x = x0 + (x1 - x0) * t;
        sprite.y = y0 + (y1 - y0) * t - height * 4 * t * (1 - t);
        sprite.angle += 7;
        if (fade && t > 0.7) sprite.setAlpha(1 - (t - 0.7) / 0.3);
      },
    }).then(() => sprite.setAngle(0));
  }

  async on_match(ev) {
    this.scene.sfx('match', 0.6);
    let cx = 0;
    let cy = 0;
    for (const cell of ev.cells) {
      const sprite = this.scene.sprites.get(cell.ballId);
      if (sprite) {
        cx += sprite.x;
        cy += sprite.y;
        fireBurst(this.scene, sprite.x, sprite.y);
        this.scene.tweens.add({
          targets: sprite, scale: 0, alpha: 0, duration: TIMINGS.MATCH_BURN, ease: 'Quad.easeIn',
          onComplete: () => sprite.destroy(),
        });
        this.scene.sprites.delete(cell.ballId);
      }
      const arr = this.viewCols[cell.col];
      const idx = arr.indexOf(cell.ballId);
      if (idx >= 0) arr.splice(idx, 1);
    }
    if (ev.cells.length) {
      floatText(this.scene, cx / ev.cells.length, cy / ev.cells.length - 30,
        `+${ev.points}`, ev.multiplier > 1 ? '#ffd54f' : '#ffe082', 26 + ev.multiplier * 3);
    }
    await this.wait(TIMINGS.MATCH_BURN);
  }

  async on_settle(ev) {
    const moves = ev.moves.map((m) => {
      const sprite = this.scene.sprites.get(m.ballId);
      if (!sprite) return Promise.resolve();
      return this.tween({
        targets: sprite,
        y: this.yFor(m.col, m.to),
        duration: TIMINGS.SETTLE,
        ease: 'Bounce.easeOut',
      });
    });
    await Promise.all(moves);
  }

  async on_merge(ev) {
    this.scene.sfx('confirm', 0.5);
    const targetY = this.yFor(ev.col, ev.stackIndex);
    const x = colX(ev.col);
    const moves = ev.removed.map((id, i) => {
      const sprite = this.scene.sprites.get(id);
      if (!sprite) return Promise.resolve();
      return this.tween({
        targets: sprite, x, y: targetY, scale: 0.6, alpha: 0.7,
        duration: TIMINGS.MERGE, delay: i * 30, ease: 'Quad.easeIn',
      }).then(() => { sprite.destroy(); this.scene.sprites.delete(id); });
    });
    await Promise.all(moves);
    const arr = this.viewCols[ev.col];
    for (const id of ev.removed) {
      const idx = arr.indexOf(id);
      if (idx >= 0) arr.splice(idx, 1);
    }
    arr.splice(ev.stackIndex, 0, ev.ball.id);
    const merged = new BallSprite(this.scene, ev.ball, x, targetY);
    merged.setScale(0);
    this.scene.sprites.set(ev.ball.id, merged);
    starFlash(this.scene, x, targetY);
    floatText(this.scene, x, targetY - 50, `+${ev.points}`, '#b2dfdb', 20);
    await this.tween({
      targets: merged, scale: 1.15, duration: 140, ease: 'Back.easeOut',
    });
    merged.setScale(1);
  }

  async on_explode(ev) {
    const x = colX(ev.col);
    const y = this.yFor(ev.col, ev.stackIndex);
    explosion(this.scene, x, y);
    this.scene.sfx('explosion', 0.65);
    this.scene.shakePlayfield();
    for (const r of ev.removed) {
      const sprite = this.scene.sprites.get(r.ballId);
      if (sprite) {
        this.scene.tweens.add({
          targets: sprite, scale: 0, alpha: 0, duration: 200, onComplete: () => sprite.destroy(),
        });
        this.scene.sprites.delete(r.ballId);
      }
      const arr = this.viewCols[r.col];
      const idx = arr.indexOf(r.ballId);
      if (idx >= 0) arr.splice(idx, 1);
    }
    if (ev.points) floatText(this.scene, x, y - 40, `+${ev.points}`, '#ffab91', 24);
    await this.wait(TIMINGS.EXPLODE);
  }

  async on_spawn(ev) {
    if (ev.current) {
      this.scene.claw.hold(ev.current);
      if (this.scene.claw.heldSprite) {
        this.scene.sprites.set(ev.current.id, this.scene.claw.heldSprite);
      }
    }
    this.scene.queueView.render(ev.queue);
  }

  async on_starPhase() {
    this.scene.sfx('levelup', 0.6);
    await this.scene.showBanner('starPhase');
  }

  async on_levelUp(ev) {
    this.scene.sfx('levelup', 0.7);
    await this.scene.showBanner('levelUp', { level: ev.level });
  }

  async on_gameOver() {
    this.scene.sfx('gameover', 0.8);
    this.scene.shakePlayfield(10);
    await this.wait(500);
  }
}
