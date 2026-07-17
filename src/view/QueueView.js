// Preview of the upcoming balls, two rows of eight, like the original.
import { LAYOUT, FONTS } from '../config.js';
import { BallSprite } from './BallSprite.js';

const SLOT = 42;
const MINI = 34;

export class QueueView {
  constructor(scene) {
    this.scene = scene;
    this.centerX = LAYOUT.W / 2;
    this.sprites = new Map(); // ball.id -> BallSprite
    scene.add.image(this.centerX, LAYOUT.QUEUE_Y - 4, 'i-panel_dark')
      .setDisplaySize(SLOT * 8 + 36, SLOT * 2 + 34).setTint(0x6e6258);
  }

  // queue[0] is next: bottom row left to right, then top row.
  slotPos(i) {
    const row = i < 8 ? 1 : 0;
    return {
      x: this.centerX + ((i % 8) - 3.5) * SLOT,
      y: LAYOUT.QUEUE_Y - 4 + (row === 1 ? SLOT / 2 : -SLOT / 2),
    };
  }

  // Sprites are recycled by ball id: survivors slide to their new slot,
  // newcomers fade in from the right, leavers vanish.
  render(queue) {
    const leftovers = new Map(this.sprites);
    const next = new Map();
    queue.slice(0, 16).forEach((ball, i) => {
      const { x, y } = this.slotPos(i);
      let sprite = leftovers.get(ball.id);
      if (sprite) {
        leftovers.delete(ball.id);
        this.scene.tweens.add({ targets: sprite, x, y, duration: 170, ease: 'Quad.easeOut' });
      } else {
        sprite = new BallSprite(this.scene, ball, x + 34, y, MINI);
        sprite.setAlpha(0);
        this.scene.tweens.add({ targets: sprite, x, alpha: 1, duration: 220, ease: 'Quad.easeOut' });
      }
      next.set(ball.id, sprite);
    });
    for (const sprite of leftovers.values()) sprite.destroy();
    this.sprites = next;
  }
}
