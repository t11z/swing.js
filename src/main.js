// Entry point: reads URL params, boots Phaser with all scenes.
import { LAYOUT } from './config.js';
import { t, setLang } from './i18n.js';
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

// Gentle landscape nudge on touch devices (CSS-positioned, non-blocking).
const rotateHint = document.getElementById('rotate-hint');
if (rotateHint && 'ontouchstart' in window) {
  rotateHint.textContent = t('rotateHint');
  const portrait = window.matchMedia('(orientation: portrait)');
  const update = () => { rotateHint.style.display = portrait.matches ? 'block' : 'none'; };
  portrait.addEventListener?.('change', update);
  update();
}

// The GameScene replaces this with the live hooks once it is running.
window.__SWING__ = { game, isReady: () => false };
