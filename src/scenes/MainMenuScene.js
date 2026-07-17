// Title screen: start, difficulty, extras and language toggles, name entry,
// highscores. Settings persist in localStorage.
import { LAYOUT, FONTS, COLOR_TINTS, STORAGE } from '../config.js';
import { t, getLang, setLang } from '../i18n.js';
import { loadName, saveName } from '../highscore.js';
import { fxOk } from '../view/effects.js';

const DIFF_ORDER = ['easy', 'normal', 'hard'];

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.SETTINGS)) ?? {};
  } catch {
    return {};
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(s));
  } catch { /* ignore */ }
}

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const W = LAYOUT.W;
    const saved = loadSettings();
    this.difficulty = saved.difficulty ?? 'normal';
    this.extras = saved.extras ?? true;
    this.playerName = loadName() || 'Player 1';

    this.add.rectangle(W / 2, LAYOUT.H / 2, W, LAYOUT.H, 0x171310);

    // Slow rain of dim marbles behind the panel
    for (let i = 0; i < 6; i++) {
      const ball = this.add.image(0, 0, `ball3d-c${i % COLOR_TINTS.length}`)
        .setDisplaySize(30 + (i % 3) * 14, 30 + (i % 3) * 14)
        .setAlpha(0.16);
      this.spawnFallingBall(ball, true);
    }

    this.add.image(W / 2, 480, 'i-panel_dark').setDisplaySize(720, 780).setTint(0x54422f);
    this.add.image(W / 2, 130, 'i-hazard_long').setDisplaySize(660, 14);

    const title = this.add.text(W / 2, 190, t('title'), {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '110px',
      color: '#d8cf7a', stroke: '#241c10', strokeThickness: 10,
    }).setOrigin(0.5);
    if (fxOk(this)) {
      title.preFX.setPadding(24);
      const glow = title.preFX.addGlow(0xd8cf7a, 1);
      this.tweens.add({
        targets: glow, outerStrength: 4, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.cameras.main.postFX.addVignette(0.5, 0.5, 0.88, 0.34);
    }
    this.add.text(W / 2, 268, t('subtitle'), {
      fontFamily: FONTS.UI, fontSize: '22px', color: '#c9bfa4',
    }).setOrigin(0.5);

    // Decorative marbles under the title, gently bobbing out of phase
    COLOR_TINTS.forEach((tint, i) => {
      const marble = this.add.image(W / 2 + (i - 3) * 64, 330, `ball3d-c${i}`)
        .setDisplaySize(44, 44);
      this.tweens.add({
        targets: marble,
        y: 324,
        duration: 1200,
        delay: i * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    this.buttons = [];
    this.makeButton(W / 2, 420, t('start'), () => this.startGame(), { primary: true });
    this.diffButton = this.makeButton(W / 2, 502, '', () => this.cycleDifficulty());
    this.extrasButton = this.makeButton(W / 2, 574, '', () => this.toggleExtras());
    this.langButton = this.makeButton(W / 2, 646, '', () => this.toggleLang());
    this.makeButton(W / 2, 718, t('highscores'), () => this.scene.start('Highscore'));

    // Player name (tap to edit via a native input, so phone keyboards work)
    this.nameLabel = this.add.text(W / 2, 786, '', {
      fontFamily: FONTS.UI, fontSize: '22px', color: '#f0ead8',
      backgroundColor: '#241c10', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.nameLabel.on('pointerdown', () => this.editName());

    this.help = this.add.text(W / 2, 872, '', {
      fontFamily: FONTS.UI, fontSize: '17px', color: '#8d8272', align: 'center',
    }).setOrigin(0.5);

    this.renderTexts();
  }

  makeButton(x, y, label, onClick, { primary = false } = {}) {
    const img = this.add.image(x, y, primary ? 'ui-button-active' : 'ui-button')
      .setDisplaySize(380, 64).setInteractive({ useHandCursor: true });
    if (!primary) img.setTint(0xbfae98);
    const text = this.add.text(x, y - 4, label, {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '24px',
      color: primary ? '#3a2c10' : '#2c2418',
    }).setOrigin(0.5);
    const pop = (factor) => {
      this.tweens.add({
        targets: [img, text],
        scaleX: `*=${factor}`,
        scaleY: `*=${factor}`,
        duration: 110,
        ease: 'Quad.easeOut',
      });
    };
    img.on('pointerover', () => { img.setTint(primary ? 0xffe082 : 0xd8cf7a); pop(1.035); });
    img.on('pointerout', () => { img.setTint(primary ? 0xffffff : 0xbfae98); pop(1 / 1.035); });
    img.on('pointerdown', () => {
      this.sound.play('click', { volume: 0.5 });
      onClick();
    });
    this.buttons.push({ img, text });
    return { img, text };
  }

  spawnFallingBall(ball, randomizeY = false) {
    if (!ball.scene) return;
    ball.x = 80 + Math.random() * (LAYOUT.W - 160);
    ball.y = randomizeY ? Math.random() * LAYOUT.H : -60;
    this.tweens.add({
      targets: ball,
      y: LAYOUT.H + 60,
      angle: ball.angle + (Math.random() > 0.5 ? 180 : -180),
      duration: 14000 + Math.random() * 10000,
      ease: 'Linear',
      onComplete: () => this.spawnFallingBall(ball),
    });
  }

  renderTexts() {
    this.diffButton.text.setText(`${t('difficulty')}: ${t(`difficulty.${this.difficulty}`)}`);
    this.extrasButton.text.setText(`${t('extras')}: ${this.extras ? t('on') : t('off')}`);
    this.langButton.text.setText(`${t('language')}: ${getLang().toUpperCase()}`);
    this.nameLabel.setText(`${t('playerName')}: ${this.playerName}`);
    const controls = this.sys.game.device.input.touch ? t('touchControls') : t('controls');
    this.help.setText(`${t('helpSeesaw')}\n${t('helpWeight')}\n\n${controls}`);
  }

  editName() {
    if (this.nameEdit) return;
    this.nameLabel.setVisible(false);
    this.nameEdit = this.add.dom(LAYOUT.W / 2, 786, 'input', `
      width: 320px; font-size: 24px; padding: 8px 14px; text-align: center;
      background: #241c10; color: #ffe082; border: 2px solid #8d8478; border-radius: 10px;
      font-family: "Trebuchet MS", Verdana, sans-serif; font-weight: bold; outline: none;
      -webkit-user-select: text; user-select: text; touch-action: manipulation;
    `);
    const node = this.nameEdit.node;
    node.value = this.playerName;
    node.maxLength = 14;
    node.setAttribute('autocomplete', 'off');
    node.setAttribute('enterkeyhint', 'done');
    const done = () => {
      if (!this.nameEdit) return;
      this.playerName = node.value.trim() || 'Player 1';
      saveName(this.playerName);
      this.nameEdit.destroy();
      this.nameEdit = null;
      this.nameLabel.setVisible(true);
      this.renderTexts();
    };
    node.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter' || ev.key === 'Escape') done();
    });
    node.addEventListener('blur', done);
    node.focus();
    node.select();
  }

  cycleDifficulty() {
    const i = DIFF_ORDER.indexOf(this.difficulty);
    this.difficulty = DIFF_ORDER[(i + 1) % DIFF_ORDER.length];
    saveSettings({ difficulty: this.difficulty, extras: this.extras });
    this.renderTexts();
  }

  toggleExtras() {
    this.extras = !this.extras;
    saveSettings({ difficulty: this.difficulty, extras: this.extras });
    this.renderTexts();
  }

  toggleLang() {
    setLang(getLang() === 'de' ? 'en' : 'de');
    this.scene.restart();
  }

  startGame() {
    saveName(this.playerName);
    this.scene.start('Game', {
      difficulty: this.difficulty,
      extras: this.extras,
      playerName: this.playerName || 'Player 1',
    });
  }
}
