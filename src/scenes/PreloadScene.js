// Loads every asset with a progress bar, generates the shaded ball textures
// and helper gradients, then hands over to the menu (or straight into the
// game for ?autostart=1 test runs).
import { LAYOUT, FONTS, COLOR_TINTS, HEART_TINT, BOMB_TINT, STAR_TINT } from '../config.js';
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

    for (const name of INDUSTRIAL) this.load.image(`i-${name}`, `assets/industrial/${name}.png`);
    for (const name of PARTICLES) this.load.image(`p-${name}`, `assets/particles/${name}.png`);
    this.load.image('ui-button', 'assets/ui/button.png');
    this.load.image('ui-button-flat', 'assets/ui/button_flat.png');
    this.load.image('ui-button-active', 'assets/ui/button_active.png');
    this.load.image('ui-star', 'assets/ui/star.png');
    for (const name of SOUNDS) this.load.audio(name, `assets/audio/${name}.ogg`);
  }

  create() {
    this.makeBallTextures();
    this.makeGeneratedTextures();
    const params = this.game.registry.get('params') ?? {};
    if (params.lang) setLang(params.lang);
    if (params.mute) this.sound.mute = true;
    // A game stashed before an orientation-change reload resumes directly.
    let hasResume = false;
    try {
      hasResume = Boolean(sessionStorage.getItem('swing.resume'));
    } catch { /* ignore */ }
    if (hasResume) {
      this.scene.start('Game', {});
      return;
    }
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

  // Soft radial shadow and a vertical light beam, both drawn at runtime so we
  // need no extra image assets.
  makeGeneratedTextures() {
    // Circular soft blob; sprites squash it into an ellipse via displaySize.
    const shadow = this.textures.createCanvas('soft-shadow', 128, 128);
    const sctx = shadow.getContext();
    const grad = sctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    shadow.refresh();

    const beam = this.textures.createCanvas('light-beam', 64, 512);
    const bctx = beam.getContext();
    const bgrad = bctx.createLinearGradient(0, 0, 0, 512);
    bgrad.addColorStop(0, 'rgba(255,240,200,0.55)');
    bgrad.addColorStop(0.5, 'rgba(255,240,200,0.22)');
    bgrad.addColorStop(1, 'rgba(255,240,200,0)');
    bctx.fillStyle = bgrad;
    bctx.fillRect(0, 0, 64, 512);
    // soften the beam's vertical edges
    const edge = bctx.createLinearGradient(0, 0, 64, 0);
    edge.addColorStop(0, 'rgba(0,0,0,1)');
    edge.addColorStop(0.25, 'rgba(0,0,0,0)');
    edge.addColorStop(0.75, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,1)');
    bctx.globalCompositeOperation = 'destination-out';
    bctx.fillStyle = edge;
    bctx.fillRect(0, 0, 64, 512);
    bctx.globalCompositeOperation = 'source-over';
    beam.refresh();
  }

  // Shaded sphere textures for every ball type, plus the specular dot and
  // the rotating surface-band layer. All drawn at runtime — no image assets.
  makeBallTextures() {
    COLOR_TINTS.forEach((color, i) => makeShadedBall(this, `ball3d-c${i}`, color));
    makeShadedBall(this, 'ball3d-heart', HEART_TINT);
    makeShadedBall(this, 'ball3d-bomb', BOMB_TINT);
    makeShadedBall(this, 'ball3d-star', STAR_TINT);
    makeShadedBall(this, 'ball3d-joker', 0xcccccc, { rainbow: true });
    makeSpecTexture(this);
    makeBandTexture(this);
  }
}

const BALL_TEX_SIZE = 256;
const BALL_TEX_R = 122;

const cssColor = (color) => `#${color.toString(16).padStart(6, '0')}`;

// A convincing 2D sphere: flat base color, a radial shading pass with the
// light baked straight above (the dynamic specular wanders around it), a
// dark occluded rim and a faint bounce light along the bottom edge.
function makeShadedBall(scene, key, color, { rainbow = false } = {}) {
  const S = BALL_TEX_SIZE;
  const C = S / 2;
  const R = BALL_TEX_R;
  const canvas = scene.textures.createCanvas(key, S, S);
  const ctx = canvas.getContext();
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, R, 0, Math.PI * 2);
  ctx.clip();

  if (rainbow && ctx.createConicGradient) {
    const conic = ctx.createConicGradient(-Math.PI / 2, C, C);
    const stops = ['#ff4b4b', '#ffae30', '#ffe93a', '#4fdc51', '#33c5ff', '#8a5cff', '#ff4bd8', '#ff4b4b'];
    stops.forEach((s, i) => conic.addColorStop(i / (stops.length - 1), s));
    ctx.fillStyle = conic;
  } else if (rainbow) {
    const lin = ctx.createLinearGradient(0, 0, S, S);
    const stops = ['#ff4b4b', '#ffae30', '#ffe93a', '#4fdc51', '#33c5ff', '#8a5cff', '#ff4bd8'];
    stops.forEach((s, i) => lin.addColorStop(i / (stops.length - 1), s));
    ctx.fillStyle = lin;
  } else {
    ctx.fillStyle = cssColor(color);
  }
  ctx.fillRect(0, 0, S, S);

  const shade = ctx.createRadialGradient(C, C - R * 0.52, R * 0.12, C, C + R * 0.12, R * 1.12);
  shade.addColorStop(0, 'rgba(255,255,255,0.58)');
  shade.addColorStop(0.3, 'rgba(255,255,255,0.14)');
  shade.addColorStop(0.6, 'rgba(0,0,0,0)');
  shade.addColorStop(0.87, 'rgba(0,0,0,0.30)');
  shade.addColorStop(1, 'rgba(0,0,0,0.52)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, S, S);

  // bounce light: thin bright arc along the lower rim
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(C, C, R - 10, Math.PI * 0.3, Math.PI * 0.7);
  ctx.stroke();

  ctx.restore();
  canvas.refresh();
}

function makeSpecTexture(scene) {
  const canvas = scene.textures.createCanvas('ball-spec', 64, 64);
  const ctx = canvas.getContext();
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  canvas.refresh();
}

// Faint latitude bands + speckles; rotating this layer while the shading and
// specular stay put reads as the ball rolling under a fixed light.
function makeBandTexture(scene) {
  const S = BALL_TEX_SIZE;
  const C = S / 2;
  const R = BALL_TEX_R;
  const canvas = scene.textures.createCanvas('ball-band', S, S);
  const ctx = canvas.getContext();
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, R - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.ellipse(C, C - R * 0.3, R * 0.86, R * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(C, C + R * 0.42, R * 0.78, R * 0.26, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (const [dx, dy, r] of [[-0.45, 0.1, 9], [0.35, -0.5, 7], [0.5, 0.42, 8]]) {
    ctx.beginPath();
    ctx.arc(C + dx * R, C + dy * R, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  canvas.refresh();
}
