// Playwright smoke test: boots the real game in headless Chromium, drops a
// handful of balls deterministically and checks that nothing errored.
//
// Run with: npm run test:e2e   (requires `npm install` for playwright)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
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
  page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
});

after(async () => {
  await browser?.close();
  server?.close();
});

test('game boots, accepts drops and keeps a consistent ball count', async () => {
  const port = server.address().port;
  await page.goto(`http://127.0.0.1:${port}/?seed=42&autostart=1&difficulty=normal&mute=1`);
  await page.waitForFunction(() => window.__SWING__?.isReady?.(), null, { timeout: 20000 });

  const moves = [3, 4, 3, 2, 5, 4];
  for (const col of moves) {
    await page.evaluate((c) => window.__SWING__.drop(c), col);
    await page.waitForFunction(() => window.__SWING__.isReady(), null, { timeout: 20000 });
  }

  const snap = await page.evaluate(() => window.__SWING__.snapshot());
  assert.equal(snap.phase, 'playing');
  assert.equal(snap.ballsDropped, moves.length);
  const onField = snap.columns.flat().length;
  assert.ok(onField > 0 && onField <= moves.length, `unexpected ball count ${onField}`);
  assert.ok(snap.score >= 0);

  await mkdir(new URL('./artifacts', import.meta.url), { recursive: true });
  await page.screenshot({ path: new URL('./artifacts/smoke.png', import.meta.url).pathname });

  assert.deepEqual(errors, [], `browser errors:\n${errors.join('\n')}`);
});
