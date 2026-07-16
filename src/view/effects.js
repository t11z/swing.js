// One-shot particle effects. All emitters are created on demand and
// self-destruct, so callers can fire and forget.

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
