// Game over: show the final score, take the player's name (native <input>
// so mobile keyboards work), store the highscore, then show the table.
import { LAYOUT, FONTS } from '../config.js';
import { t } from '../i18n.js';
import { addScore, loadName, saveName } from '../highscore.js';

const INPUT_STYLE = `
  width: 380px; font-size: 30px; padding: 10px 16px; text-align: center;
  background: #241c10; color: #ffe082; border: 2px solid #8d8478; border-radius: 10px;
  font-family: "Trebuchet MS", Verdana, sans-serif; font-weight: bold; outline: none;
  -webkit-user-select: text; user-select: text; touch-action: manipulation;
`;

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.result = data;
    this.done = false;
  }

  create() {
    const W = LAYOUT.W;
    this.add.rectangle(W / 2, LAYOUT.H / 2, W, LAYOUT.H, 0x171310);
    this.add.image(W / 2, 460, 'i-panel_dark').setDisplaySize(640, 500).setTint(0x54422f);

    this.add.text(W / 2, 290, t('gameOver'), {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '84px',
      color: '#e8404a', stroke: '#241c10', strokeThickness: 10,
    }).setOrigin(0.5);

    this.add.text(W / 2, 390, `${t('yourScore')}: ${this.result.score.toLocaleString()}   ·   ${t('level')} ${this.result.level}`, {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '30px', color: '#f0ead8',
    }).setOrigin(0.5);

    this.add.text(W / 2, 455, t('enterName'), {
      fontFamily: FONTS.UI, fontSize: '20px', color: '#c9bfa4',
    }).setOrigin(0.5);

    // Native input: brings up the on-screen keyboard on phones.
    this.nameInput = this.add.dom(W / 2, 520, 'input', INPUT_STYLE);
    const node = this.nameInput.node;
    node.value = this.result.playerName || loadName() || '';
    node.maxLength = 14;
    node.setAttribute('autocomplete', 'off');
    node.setAttribute('autocapitalize', 'words');
    node.setAttribute('enterkeyhint', 'done');
    node.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.confirm();
      }
    });
    node.addEventListener('focus', () => node.select());
    if (!this.sys.game.device.input.touch) node.focus();

    // Big friendly OK button (min. touch target size even at phone scale)
    const ok = this.add.image(W / 2, 620, 'ui-button-active')
      .setDisplaySize(240, 72).setInteractive({ useHandCursor: true });
    this.add.text(W / 2, 616, t('ok'), {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '30px', color: '#3a2c10',
    }).setOrigin(0.5);
    ok.on('pointerover', () => ok.setTint(0xffe082));
    ok.on('pointerout', () => ok.clearTint());
    ok.on('pointerdown', () => this.confirm());
  }

  confirm() {
    if (this.done) return;
    this.done = true;
    const name = (this.nameInput.node.value || '').trim() || '???';
    saveName(name);
    const rank = addScore({
      name,
      score: this.result.score,
      level: this.result.level,
      difficulty: this.result.difficulty,
    });
    this.sound.play('confirm', { volume: 0.5 });
    this.scene.start('Highscore', { highlightRank: rank });
  }
}
