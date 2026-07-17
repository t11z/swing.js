// Entry point: reads URL params, picks the layout for the current
// orientation, boots Phaser with all scenes.
import { LAYOUT, initLayout } from './config.js';
import { setLang } from './i18n.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { HighscoreScene } from './scenes/HighscoreScene.js';

const q = new URLSearchParams(window.location.search);
const params = {
  seed: q.has('seed') ? Number(q.get('seed')) : undefined,
  autostart: q.get('autostart') === '1',
  difficulty: q.get('difficulty') || undefined,
  extras: q.has('extras') ? q.get('extras') !== '0' : undefined,
  lang: q.get('lang') || undefined,
  mute: q.get('mute') === '1',
};

if (params.lang) setLang(params.lang);

const bootPortrait = window.innerHeight > window.innerWidth;
initLayout(bootPortrait);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: LAYOUT.W,
  height: LAYOUT.H,
  backgroundColor: '#171310',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: { createContainer: true }, // native <input> overlay for name entry
  scene: [PreloadScene, MainMenuScene, GameScene, GameOverScene, HighscoreScene],
});
game.registry.set('params', params);

// Orientation change: stash a running game's state (the GameScene provides
// the hook), then reload so the matching layout boots. The stash is restored
// seamlessly on the other side.
let reloading = false;
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const nowPortrait = window.innerHeight > window.innerWidth;
    if (nowPortrait !== bootPortrait && !reloading) {
      reloading = true;
      window.__SWING__?.stash?.();
      window.location.reload();
    }
  }, 250);
});

// The GameScene replaces this with the live hooks once it is running.
window.__SWING__ = { game, isReady: () => false };
