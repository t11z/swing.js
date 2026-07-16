// A ball on screen: tinted marble + weight number, plus overlays for the
// special kinds. Pure display object; all movement is tweened from outside.
import { LAYOUT, COLOR_TINTS, HEART_TINT, BOMB_TINT, STAR_TINT, FONTS } from '../config.js';

export class BallSprite extends Phaser.GameObjects.Container {
  constructor(scene, ball, x, y, diameter = LAYOUT.BALL_D) {
    super(scene, x, y);
    this.ballId = ball.id;
    this.kind = ball.kind;
    this.diameter = diameter;

    const texKey = ball.kind === 'joker' ? 'ball-joker' : 'ball';
    this.base = scene.add.image(0, 0, texKey);
    this.base.setDisplaySize(diameter, diameter);
    this.add(this.base);

    switch (ball.kind) {
      case 'normal':
        this.base.setTint(COLOR_TINTS[ball.color]);
        this.addLabel(scene, String(ball.weight), diameter);
        break;
      case 'heart':
        this.base.setTint(HEART_TINT);
        this.addLabel(scene, '♥', diameter, '#ffffff');
        break;
      case 'bomb': {
        this.base.setTint(BOMB_TINT);
        const fuse = scene.add.image(diameter * 0.22, -diameter * 0.3, 'p-flame_01')
          .setDisplaySize(diameter * 0.34, diameter * 0.34)
          .setTint(0xffa030);
        this.add(fuse);
        scene.tweens.add({ targets: fuse, alpha: 0.4, duration: 180, yoyo: true, repeat: -1 });
        break;
      }
      case 'star': {
        this.base.setTint(STAR_TINT);
        const star = scene.add.image(0, 0, 'ui-star')
          .setDisplaySize(diameter * 0.55, diameter * 0.55)
          .setTint(0xffffff);
        this.add(star);
        break;
      }
      case 'joker':
        break; // rainbow texture speaks for itself
    }
    scene.add.existing(this);
  }

  addLabel(scene, text, diameter, color = '#ffffff') {
    this.label = scene.add.text(0, 0, text, {
      fontFamily: FONTS.UI,
      fontStyle: 'bold',
      fontSize: `${Math.round(diameter * 0.42)}px`,
      color,
      stroke: '#1c1c24',
      strokeThickness: Math.max(3, diameter * 0.08),
    }).setOrigin(0.5);
    this.add(this.label);
  }

  // Used after a wrap-around transform or a merge weight change.
  setWeightLabel(weight) {
    if (this.label) this.label.setText(String(weight));
  }
}
