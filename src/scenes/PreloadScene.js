// Loads every asset with a progress bar, generates the joker's rainbow
// texture, then hands over to the menu (or straight into the game for
// ?autostart=1 test runs).
import { LAYOUT, FONTS } from '../config.js';
import { setLang } from '../i18n.js';

const INDUSTRIAL = [
  'panel_metal', 'panel_dark', 'panel_screen', 'panel_controls',
  'beam', 'beam_short', 'beam_small', 'pillar', 'pillar_wide', 'pedestal',
  'gear_large', 'gear_small', 'lamp_blue', 'lamp_yellow', 'lamp_green', 'lamp_orange',
  'hazard', 'hazard_long', 'claw_prongs',
];
const PARTICLES = [
  'fire_01', 'fire_02', 'flame_01', 'flame_02', 'star_04', 'star_05', 'star_06',
  'smoke_01', 'smoke_02', 'spark_04', 'spark_05', 'light_01', 'circle_01', 'magic_01',
];
const SOUNDS = [
  'land_0', 'land_1', 'land_2', 'land_heavy', 'tilt_0', 'tilt_1', 'tilt_heavy',
  'fling', 'match', 'explosion', 'click', 'confirm', 'levelup', 'back', 'drop', 'gameover',
];

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const cx = LAYOUT.W / 2;
    const cy = LAYOUT.H / 2;
    this.add.text(cx, cy - 60, 'SWING', {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '64px', color: '#d8cf7a',
    }).setOrigin(0.5);
    this.add.rectangle(cx, cy + 20, 420, 26, 0x0e0b09).setStrokeStyle(2, 0x6e6258);
    const fill = this.add.rectangle(cx - 206, cy + 20, 0, 18, 0xd8cf7a).setOrigin(0, 0.5);
    this.load.on('progress', (v) => { fill.width = 412 * v; });

    this.load.image('ball', 'assets/balls/ball.png');
    this.load.image('ball-plain', 'assets/balls/ball_plain.png');
    for (const name of INDUSTRIAL) this.load.image(`i-${name}`, `assets/industrial/${name}.png`);
    for (const name of PARTICLES) this.load.image(`p-${name}`, `assets/particles/${name}.png`);
    this.load.image('ui-button', 'assets/ui/button.png');
    this.load.image('ui-button-flat', 'assets/ui/button_flat.png');
    this.load.image('ui-button-active', 'assets/ui/button_active.png');
    this.load.image('ui-star', 'assets/ui/star.png');
    for (const name of SOUNDS) this.load.audio(name, `assets/audio/${name}.ogg`);
  }

  create() {
    this.makeJokerTexture();
    const params = this.game.registry.get('params') ?? {};
    if (params.lang) setLang(params.lang);
    if (params.mute) this.sound.mute = true;
    if (params.autostart) {
      this.scene.start('Game', {
        seed: params.seed,
        difficulty: params.difficulty,
        extras: params.extras,
      });
    } else {
      this.scene.start('Menu');
    }
  }

  // The joker is a rainbow ball: multiply a diagonal rainbow over the grey
  // marble, then clip back to the marble's alpha.
  makeJokerTexture() {
    const src = this.textures.get('ball').getSourceImage();
    const { width, height } = src;
    const canvas = this.textures.createCanvas('ball-joker', width, height);
    const ctx = canvas.getContext();
    ctx.drawImage(src, 0, 0);
    const grad = ctx.createLinearGradient(0, 0, width, height);
    const stops = ['#ff5050', '#ffae30', '#ffe939', '#4fdc51', '#33c5ff', '#8a5cff', '#ff4bd8'];
    stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    canvas.refresh();
  }
}
