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

// Tap a point given in game coordinates (1280x960), mapped through the
// letterboxed canvas rect.
async function gameTap(gx, gy) {
  const r = await page.evaluate(() => {
    const { left, top, width, height } = document.querySelector('canvas').getBoundingClientRect();
    return { left, top, width, height };
  });
  await page.touchscreen.tap(r.left + (gx / 1280) * r.width, r.top + (gy / 960) * r.height);
}

const colCenter = (c) => 320 + c * 80 + 40;

test('phone: menu, tap-aim, tap-drop and native name entry all work by touch', async () => {
  const port = server.address().port;
  await page.goto(`http://127.0.0.1:${port}/?seed=11&mute=1&lang=de`);

  // Start the game from the menu by tapping the start button.
  await page.waitForFunction(() => window.__SWING__?.game?.scene?.isActive('Menu'), null, { timeout: 20000 });
  await gameTap(640, 420);
  await page.waitForFunction(() => window.__SWING__?.isReady?.(), null, { timeout: 20000 });

  // First tap on a far column only aims (claw starts on column 3)...
  await gameTap(colCenter(6), 600);
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.__SWING__.clawCol()), 6);
  assert.equal(await page.evaluate(() => window.__SWING__.core.ballsDropped), 0, 'first tap must not drop');

  // ...the second tap on the same column drops.
  await gameTap(colCenter(6), 600);
  await page.waitForFunction(() => window.__SWING__.isReady(), null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.__SWING__.core.ballsDropped), 1);

  // Taps on HUD areas (queue panel) must never drop.
  await gameTap(640, 90);
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
  await gameTap(640, 620);
  await page.waitForFunction(() => window.__SWING__.game.scene.isActive('Highscore'), null, { timeout: 20000 });
  const topEntry = await page.evaluate(() => JSON.parse(localStorage.getItem('swing.highscores'))[0]);
  assert.equal(topEntry.name, 'Sabine');

  assert.deepEqual(errors, [], `browser errors:\n${errors.join('\n')}`);
});
