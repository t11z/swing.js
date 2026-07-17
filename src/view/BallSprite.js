// A ball on screen with a faked-3D look built from three layers:
//   base  — runtime-shaded sphere texture (light baked from straight above)
//   band  — faint surface markings; rotates while the ball flies, selling
//           the "rolling under a fixed light" illusion
//   spec  — specular dot pointing at the scene's light source, repositioned
//           dynamically as the ball moves (updateLight)
// The weight label and kind overlays stay upright at all times.
import { LAYOUT, LIGHT, FONTS } from '../config.js';

const TEXTURE_FOR = (ball) => {
  switch (ball.kind) {
    case 'joker': return 'ball3d-joker';
    case 'heart': return 'ball3d-heart';
    case 'bomb': return 'ball3d-bomb';
    case 'star': return 'ball3d-star';
    default: return `ball3d-c${ball.color}`;
  }
};

export class BallSprite extends Phaser.GameObjects.Container {
  constructor(scene, ball, x, y, diameter = LAYOUT.BALL_D) {
    super(scene, x, y);
    this.ballId = ball.id;
    this.kind = ball.kind;
    this.diameter = diameter;

    this.base = scene.add.image(0, 0, TEXTURE_FOR(ball)).setDisplaySize(diameter, diameter);
    this.band = scene.add.image(0, 0, 'ball-band')
      .setDisplaySize(diameter, diameter)
      .setAlpha(ball.kind === 'joker' ? 0.3 : 0.55)
      .setAngle(ball.id * 47 % 360); // vary the resting surface per ball
    this.spec = scene.add.image(0, 0, 'ball-spec')
      .setDisplaySize(diameter * 0.52, diameter * 0.52)
      .setAlpha(0.85);
    this.add([this.base, this.band, this.spec]);

    switch (ball.kind) {
      case 'normal':
        this.addLabel(scene, String(ball.weight), diameter);
        break;
      case 'heart':
        this.addLabel(scene, '♥', diameter, '#ffffff');
        break;
      case 'bomb': {
        const fuse = scene.add.image(diameter * 0.22, -diameter * 0.3, 'p-flame_01')
          .setDisplaySize(diameter * 0.34, diameter * 0.34)
          .setTint(0xffa030);
        this.add(fuse);
        scene.tweens.add({ targets: fuse, alpha: 0.4, duration: 180, yoyo: true, repeat: -1 });
        break;
      }
      case 'star': {
        const star = scene.add.image(0, 0, 'ui-star')
          .setDisplaySize(diameter * 0.55, diameter * 0.55)
          .setTint(0xffffff);
        this.add(star);
        break;
      }
      case 'joker':
        break; // the rainbow sphere speaks for itself
    }
    this.updateLight();
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

  // Point the specular highlight at the light source; called every frame for
  // moving balls, once at construction for static ones (queue, menu).
  updateLight() {
    if (!this.scene) return;
    const dx = LIGHT.x - this.x;
    const dy = LIGHT.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = this.diameter * 0.21;
    this.spec.setPosition((dx / len) * k, (dy / len) * k);
  }

  // Roll the surface layer (flight/catapult animation).
  spin(deg) {
    this.band.angle += deg;
  }
}
