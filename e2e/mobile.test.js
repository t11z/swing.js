// Touch smoke test: emulates a phone (landscape, touch, 3x DPR) and drives
// the game purely via taps — menu, aim, drop, game over, native name input.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './serve.js';

let server;
let browser;
let page;
const errors = [];

before(async () => {
  ({ server } = await startServer(0));
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 874, height: 402 }, // iPhone Pro-class, landscape
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
  });
  page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
});

after(async () => {
  await browser?.close();
  server?.close();
});

// Tap a point given in game coordinates, mapped through the letterboxed
// canvas rect (works for both the 1280x960 and the 720x1280 layout).
async function gameTap(p, gx, gy) {
  const m = await p.evaluate(() => {
    const { width, height } = window.__SWING__.game.scale.gameSize;
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height, gw: width, gh: height };
  });
  await p.touchscreen.tap(m.left + (gx / m.gw) * m.w, m.top + (gy / m.gh) * m.h);
}

test('phone: menu, tap-aim, tap-drop and native name entry all work by touch', async () => {
  const port = server.address().port;
  await page.goto(`http://127.0.0.1:${port}/?seed=11&mute=1&lang=de`);

  // Start the game from the menu by tapping the start button.
  await page.waitForFunction(() => window.__SWING__?.game?.scene?.isActive('Menu'), null, { timeout: 20000 });
  await gameTap(page, 640, 420);
  await page.waitForFunction(() => window.__SWING__?.isReady?.(), null, { timeout: 20000 });
  const colCenter = (c) => 320 + c * 80 + 40; // landscape playfield

  // First tap on a far column only aims (claw starts on column 3)...
  await gameTap(page, colCenter(6), 600);
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.__SWING__.clawCol()), 6);
  assert.equal(await page.evaluate(() => window.__SWING__.core.ballsDropped), 0, 'first tap must not drop');

  // ...the second tap on the same column drops.
  await gameTap(page, colCenter(6), 600);
  await page.waitForFunction(() => window.__SWING__.isReady(), null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.__SWING__.core.ballsDropped), 1);

  // Taps on HUD areas (queue panel) must never drop.
  await gameTap(page, 640, 90);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__SWING__.core.ballsDropped), 1);

  // Fast-forward to game over via the test hook.
  for (let i = 0; i < 25; i++) {
    const phase = await page.evaluate(() => window.__SWING__.core.phase);
    if (phase === 'gameover') break;
    await page.evaluate(() => window.__SWING__.drop(0));
    await page.waitForFunction(
      () => window.__SWING__.isReady() || window.__SWING__.core.phase === 'gameover',
      null, { timeout: 30000 },
    );
  }
  assert.equal(await page.evaluate(() => window.__SWING__.core.phase), 'gameover');

  // Native input appears; type via the (virtual) keyboard path and tap OK.
  await page.waitForSelector('input', { timeout: 20000 });
  await page.fill('input', 'Sabine');
  await gameTap(page, 640, 620);
  await page.waitForFunction(() => window.__SWING__.game.scene.isActive('Highscore'), null, { timeout: 20000 });
  const topEntry = await page.evaluate(() => JSON.parse(localStorage.getItem('swing.highscores'))[0]);
  assert.equal(topEntry.name, 'Sabine');

  assert.deepEqual(errors, [], `browser errors:\n${errors.join('\n')}`);
});

test('phone portrait: dedicated 720x1280 layout, and rotation keeps the game', async () => {
  const port = server.address().port;
  const context = await browser.newContext({
    viewport: { width: 402, height: 874 }, // iPhone Pro-class, portrait
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const p = await context.newPage();
  const localErrors = [];
  p.on('pageerror', (err) => localErrors.push(`pageerror: ${err.message}`));
  await p.goto(`http://127.0.0.1:${port}/?seed=21&autostart=1&mute=1&lang=de`);
  await p.waitForFunction(() => window.__SWING__?.isReady?.(), null, { timeout: 20000 });

  // Portrait boots the tall layout.
  const size = await p.evaluate(() => ({
    w: window.__SWING__.game.scale.gameSize.width,
    h: window.__SWING__.game.scale.gameSize.height,
  }));
  assert.deepEqual(size, { w: 720, h: 1280 });

  // Touch aiming works with portrait playfield coordinates.
  const colCenterP = (c) => 40 + c * 80 + 40;
  await gameTap(p, colCenterP(6), 800);
  await p.waitForTimeout(350);
  assert.equal(await p.evaluate(() => window.__SWING__.clawCol()), 6);
  assert.equal(await p.evaluate(() => window.__SWING__.core.ballsDropped), 0);
  await gameTap(p, colCenterP(6), 800);
  await p.waitForFunction(() => window.__SWING__.isReady(), null, { timeout: 20000 });
  assert.equal(await p.evaluate(() => window.__SWING__.core.ballsDropped), 1);
  const scoreBefore = await p.evaluate(() => window.__SWING__.core.score);

  // Rotate to landscape: the page reloads into the wide layout with the
  // exact same game state restored.
  await p.setViewportSize({ width: 874, height: 402 });
  await p.waitForFunction(
    () => window.__SWING__?.isReady?.() && window.__SWING__.game.scale.gameSize.width === 1280,
    null, { timeout: 20000 },
  );
  assert.equal(await p.evaluate(() => window.__SWING__.core.ballsDropped), 1);
  assert.equal(await p.evaluate(() => window.__SWING__.core.score), scoreBefore);
  assert.equal(await p.evaluate(() => window.__SWING__.core.phase), 'playing');
  assert.equal(await p.evaluate(() => window.__SWING__.core.columns.flat().length > 0), true);

  assert.deepEqual(localErrors, [], `browser errors:\n${localErrors.join('\n')}`);
  await context.close();
});
