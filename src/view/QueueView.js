// Preview of the upcoming balls, two rows of eight, like the original.
import { LAYOUT, FONTS } from '../config.js';
import { BallSprite } from './BallSprite.js';

const SLOT = 42;
const MINI = 34;

export class QueueView {
  constructor(scene) {
    this.scene = scene;
    this.centerX = LAYOUT.W / 2;
    this.sprites = [];
    scene.add.image(this.centerX, LAYOUT.QUEUE_Y - 4, 'i-panel_dark')
      .setDisplaySize(SLOT * 8 + 36, SLOT * 2 + 34).setTint(0x6e6258);
  }

  render(queue) {
    this.sprites.forEach((s) => s.destroy());
    this.sprites = [];
    // queue[0] is next: bottom row left to right, then top row.
    queue.slice(0, 16).forEach((ball, i) => {
      const row = i < 8 ? 1 : 0;
      const colIdx = i % 8;
      const x = this.centerX + (colIdx - 3.5) * SLOT;
      const y = LAYOUT.QUEUE_Y - 4 + (row === 1 ? SLOT / 2 : -SLOT / 2);
      this.sprites.push(new BallSprite(this.scene, ball, x, y, MINI));
    });
  }
}
