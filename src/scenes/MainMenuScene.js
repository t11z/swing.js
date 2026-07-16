// Title screen: start, difficulty, extras and language toggles, name entry,
// highscores. Settings persist in localStorage.
import { LAYOUT, FONTS, COLOR_TINTS, STORAGE } from '../config.js';
import { t, getLang, setLang } from '../i18n.js';
import { loadName, saveName } from '../highscore.js';

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
    this.editingName = false;

    this.add.rectangle(W / 2, LAYOUT.H / 2, W, LAYOUT.H, 0x171310);
    this.add.image(W / 2, 480, 'i-panel_dark').setDisplaySize(720, 780).setTint(0x54422f);
    this.add.image(W / 2, 130, 'i-hazard_long').setDisplaySize(660, 14);

    this.add.text(W / 2, 190, t('title'), {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '110px',
      color: '#d8cf7a', stroke: '#241c10', strokeThickness: 10,
    }).setOrigin(0.5);
    this.add.text(W / 2, 268, t('subtitle'), {
      fontFamily: FONTS.UI, fontSize: '22px', color: '#c9bfa4',
    }).setOrigin(0.5);

    // Decorative marbles under the title
    COLOR_TINTS.forEach((tint, i) => {
      this.add.image(W / 2 + (i - 3) * 64, 330, 'ball').setDisplaySize(44, 44).setTint(tint);
    });

    this.buttons = [];
    this.makeButton(W / 2, 420, t('start'), () => this.startGame(), { primary: true });
    this.diffButton = this.makeButton(W / 2, 500, '', () => this.cycleDifficulty());
    this.extrasButton = this.makeButton(W / 2, 570, '', () => this.toggleExtras());
    this.langButton = this.makeButton(W / 2, 640, '', () => this.toggleLang());
    this.makeButton(W / 2, 710, t('highscores'), () => this.scene.start('Highscore'));

    // Player name (click to edit)
    this.nameLabel = this.add.text(W / 2, 778, '', {
      fontFamily: FONTS.UI, fontSize: '22px', color: '#f0ead8',
      backgroundColor: '#241c10', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.nameLabel.on('pointerdown', () => { this.editingName = true; this.renderTexts(); });

    this.help = this.add.text(W / 2, 850, '', {
      fontFamily: FONTS.UI, fontSize: '17px', color: '#8d8272', align: 'center',
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown', (ev) => this.onKey(ev));
    this.renderTexts();
  }

  makeButton(x, y, label, onClick, { primary = false } = {}) {
    const img = this.add.image(x, y, primary ? 'ui-button-active' : 'ui-button')
      .setDisplaySize(340, 56).setInteractive({ useHandCursor: true });
    if (!primary) img.setTint(0xbfae98);
    const text = this.add.text(x, y - 4, label, {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '24px',
      color: primary ? '#3a2c10' : '#2c2418',
    }).setOrigin(0.5);
    img.on('pointerover', () => img.setTint(primary ? 0xffe082 : 0xd8cf7a));
    img.on('pointerout', () => img.setTint(primary ? 0xffffff : 0xbfae98));
    img.on('pointerdown', () => {
      this.sound.play('click', { volume: 0.5 });
      onClick();
    });
    this.buttons.push({ img, text });
    return { img, text };
  }

  renderTexts() {
    this.diffButton.text.setText(`${t('difficulty')}: ${t(`difficulty.${this.difficulty}`)}`);
    this.extrasButton.text.setText(`${t('extras')}: ${this.extras ? t('on') : t('off')}`);
    this.langButton.text.setText(`${t('language')}: ${getLang().toUpperCase()}`);
    this.nameLabel.setText(`${t('playerName')}: ${this.playerName}${this.editingName ? '_' : ''}`);
    this.help.setText(`${t('helpSeesaw')}\n${t('helpWeight')}\n\n${t('controls')}`);
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

  onKey(ev) {
    if (!this.editingName) return;
    if (ev.key === 'Enter' || ev.key === 'Escape') {
      this.editingName = false;
    } else if (ev.key === 'Backspace') {
      this.playerName = this.playerName.slice(0, -1);
    } else if (ev.key.length === 1 && this.playerName.length < 14) {
      this.playerName += ev.key;
    } else {
      return;
    }
    saveName(this.playerName);
    this.renderTexts();
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
