// One-shot particle effects. All emitters are created on demand and
// self-destruct, so callers can fire and forget.

// Phaser's built-in FX pipelines (glow, shine, vignette) are WebGL-only, and
// on software WebGL (SwiftShader/llvmpipe — headless test runs, GPU-blocklisted
// browsers) their fullscreen passes tank the frame rate. Skip them there;
// particles, shadows and beams are plain sprites and stay on everywhere.
let softwareGL = null;
export function fxOk(scene) {
  const renderer = scene.game.renderer;
  if (renderer.type !== Phaser.WEBGL) return false;
  if (softwareGL === null) {
    try {
      const gl = renderer.gl;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      softwareGL = /swiftshader|llvmpipe|software/i.test(String(name));
    } catch {
      softwareGL = false;
    }
  }
  return !softwareGL;
}

// Slowly rising embers/dust across the playfield — pure atmosphere.
export function ambientDust(scene, x, y, width, height) {
  return scene.add.particles(0, 0, 'p-light_01', {
    x: { min: x, max: x + width },
    y: { min: y, max: y + height },
    speedY: { min: -14, max: -5 },
    speedX: { min: -4, max: 4 },
    scale: { start: 0.05, end: 0.14 },
    alpha: { values: [0, 0.16, 0] },
    tint: [0xffd9a0, 0xffb060, 0x9fd8ff],
    lifespan: { min: 5000, max: 9000 },
    frequency: 900, // ~8 alive at a time
    blendMode: 'ADD',
  }).setDepth(3);
}

// Dust kicked up when a ball lands; strength scales with the fall.
export function landPuff(scene, x, y, strength = 1) {
  const puff = scene.add.particles(x, y, 'p-smoke_01', {
    speed: { min: 15, max: 45 + strength * 18 },
    angle: { min: 200, max: 340 },
    scale: { start: 0.1 + strength * 0.04, end: 0.24 },
    alpha: { start: 0.28, end: 0 },
    tint: 0xbfae98,
    lifespan: 420,
    quantity: 2 + Math.round(strength),
    emitting: false,
  }).setDepth(9);
  puff.explode(2 + Math.round(strength));
  scene.time.delayedCall(600, () => puff.destroy());
}

// Spark trail attached to a flying ball; caller stops it after the arc.
export function flingTrail(scene, sprite) {
  const trail = scene.add.particles(0, 0, 'p-spark_04', {
    follow: sprite,
    speed: { min: 5, max: 25 },
    scale: { start: 0.18, end: 0 },
    alpha: { start: 0.7, end: 0 },
    tint: [0xffd54f, 0xff9c50],
    lifespan: 320,
    frequency: 28,
    blendMode: 'ADD',
  }).setDepth(29);
  return () => {
    trail.stopFollow();
    trail.stop();
    scene.time.delayedCall(400, () => trail.destroy());
  };
}

// Expanding ring behind a match burn.
export function shockwave(scene, x, y, tint = 0xffc46b) {
  const ring = scene.add.image(x, y, 'p-circle_01')
    .setDisplaySize(30, 30).setTint(tint).setAlpha(0.55)
    .setBlendMode(Phaser.BlendModes.ADD).setDepth(48);
  scene.tweens.add({
    targets: ring,
    displayWidth: 240,
    displayHeight: 240,
    alpha: 0,
    duration: 450,
    ease: 'Quad.easeOut',
    onComplete: () => ring.destroy(),
  });
}

// Short star rain across the playfield when the star phase begins.
export function starRain(scene, x, width) {
  const rain = scene.add.particles(0, 0, 'p-star_05', {
    x: { min: x, max: x + width },
    y: -20,
    speedY: { min: 180, max: 320 },
    speedX: { min: -20, max: 20 },
    rotate: { min: 0, max: 360 },
    scale: { start: 0.22, end: 0.05 },
    alpha: { start: 0.9, end: 0 },
    tint: 0xffe082,
    lifespan: 2400,
    frequency: 45,
    blendMode: 'ADD',
  }).setDepth(55);
  scene.time.delayedCall(1600, () => {
    rain.stop();
    scene.time.delayedCall(2500, () => rain.destroy());
  });
}

export function fireBurst(scene, x, y) {
  const flames = scene.add.particles(x, y, 'p-flame_01', {
    speed: { min: 20, max: 70 },
    angle: { min: 230, max: 310 }, // mostly upward
    scale: { start: 0.3, end: 0 },
    alpha: { start: 0.85, end: 0 },
    tint: [0xff8a3c, 0xffb347, 0xe84a2e],
    lifespan: 450,
    blendMode: 'ADD',
    quantity: 6,
    emitting: false,
  }).setDepth(50);
  const sparks = scene.add.particles(x, y, 'p-spark_04', {
    speed: { min: 60, max: 150 },
    scale: { start: 0.22, end: 0 },
    tint: 0xffd54f,
    lifespan: 380,
    blendMode: 'ADD',
    quantity: 6,
    emitting: false,
  }).setDepth(50);
  flames.explode(6);
  sparks.explode(6);
  scene.time.delayedCall(650, () => { flames.destroy(); sparks.destroy(); });
}

export function explosion(scene, x, y) {
  const smoke = scene.add.particles(x, y, 'p-smoke_01', {
    speed: { min: 20, max: 80 },
    scale: { start: 0.6, end: 0.1 },
    alpha: { start: 0.7, end: 0 },
    lifespan: 700,
    quantity: 8,
    emitting: false,
  }).setDepth(49);
  const sparks = scene.add.particles(x, y, 'p-spark_04', {
    speed: { min: 120, max: 260 },
    scale: { start: 0.4, end: 0 },
    lifespan: 500,
    blendMode: 'ADD',
    quantity: 14,
    emitting: false,
  }).setDepth(50);
  smoke.explode(8);
  sparks.explode(14);
  scene.time.delayedCall(900, () => { smoke.destroy(); sparks.destroy(); });
}

export function starFlash(scene, x, y) {
  const stars = scene.add.particles(x, y, 'p-star_05', {
    speed: { min: 40, max: 140 },
    scale: { start: 0.45, end: 0 },
    lifespan: 500,
    blendMode: 'ADD',
    quantity: 10,
    emitting: false,
  }).setDepth(50);
  stars.explode(10);
  scene.time.delayedCall(700, () => stars.destroy());
}

export function floatText(scene, x, y, text, color = '#ffe082', size = 26) {
  const label = scene.add.text(x, y, text, {
    fontFamily: '"Trebuchet MS", Verdana, sans-serif',
    fontStyle: 'bold',
    fontSize: `${size}px`,
    color,
    stroke: '#1a120a',
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(60);
  scene.tweens.add({
    targets: label,
    y: y - 70,
    alpha: 0,
    duration: 900,
    ease: 'Quad.easeOut',
    onComplete: () => label.destroy(),
  });
}
