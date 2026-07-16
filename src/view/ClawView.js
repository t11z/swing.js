// The dispenser claw riding above the playfield, holding the current ball.
import { LAYOUT, TIMINGS, colX } from '../config.js';
import { BallSprite } from './BallSprite.js';

export class ClawView {
  constructor(scene) {
    this.scene = scene;
    this.col = 3;
    this.container = scene.add.container(colX(this.col), LAYOUT.CLAW_Y);

    const arm = scene.add.image(0, -56, 'i-pillar').setDisplaySize(12, 40).setTint(0x8d8478);
    const body = scene.add.image(0, -34, 'i-panel_dark').setDisplaySize(66, 28).setTint(0x8d8478);
    const prongL = scene.add.image(-26, -8, 'i-claw_prongs').setDisplaySize(30, 30).setTint(0xa89c8c);
    const prongR = scene.add.image(26, -8, 'i-claw_prongs').setDisplaySize(30, 30).setTint(0xa89c8c);
    this.container.add(arm);
    this.prongs = [prongL, prongR];
    this.container.add([body, prongL, prongR]);
    this.heldSprite = null;
  }

  // The held ball is a world-level BallSprite (not a child) so releasing it
  // needs no reparenting gymnastics.
  hold(ball) {
    this.release();
    if (!ball) return;
    this.heldSprite = new BallSprite(this.scene, ball, this.container.x, LAYOUT.CLAW_Y + 26);
    this.pinch(true);
  }

  release() {
    const s = this.heldSprite;
    this.heldSprite = null;
    if (s) this.pinch(false);
    return s;
  }

  pinch(closed) {
    this.scene.tweens.add({
      targets: this.prongs[0], angle: closed ? 15 : 0, duration: 80,
    });
    this.scene.tweens.add({
      targets: this.prongs[1], angle: closed ? -15 : 0, duration: 80,
    });
  }

  moveTo(col, animate = true) {
    this.col = col;
    const x = colX(col);
    const targets = [this.container, this.heldSprite].filter(Boolean);
    if (!animate) {
      targets.forEach((t) => { t.x = x; });
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets,
        x,
        duration: TIMINGS.CLAW_MOVE,
        ease: 'Sine.easeOut',
        onComplete: resolve,
      });
    });
  }
}
