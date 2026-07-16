// Game over: show the final score, take the player's name, store the
// highscore, then move on to the highscore table.
import { LAYOUT, FONTS } from '../config.js';
import { t } from '../i18n.js';
import { addScore, loadName, saveName } from '../highscore.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.result = data;
  }

  create() {
    const W = LAYOUT.W;
    this.name = this.result.playerName || loadName() || '';
    this.add.rectangle(W / 2, LAYOUT.H / 2, W, LAYOUT.H, 0x171310);
    this.add.image(W / 2, 460, 'i-panel_dark').setDisplaySize(640, 460).setTint(0x54422f);

    this.add.text(W / 2, 300, t('gameOver'), {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '84px',
      color: '#e8404a', stroke: '#241c10', strokeThickness: 10,
    }).setOrigin(0.5);

    this.add.text(W / 2, 400, `${t('yourScore')}: ${this.result.score.toLocaleString()}   ·   ${t('level')} ${this.result.level}`, {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '30px', color: '#f0ead8',
    }).setOrigin(0.5);

    this.add.text(W / 2, 470, t('enterName'), {
      fontFamily: FONTS.UI, fontSize: '20px', color: '#c9bfa4',
    }).setOrigin(0.5);

    this.nameText = this.add.text(W / 2, 530, '', {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '34px', color: '#ffe082',
      backgroundColor: '#241c10', padding: { x: 18, y: 8 },
    }).setOrigin(0.5);
    this.renderName();

    this.input.keyboard.on('keydown', (ev) => this.onKey(ev));
  }

  renderName() {
    this.nameText.setText(`${this.name}_`);
  }

  onKey(ev) {
    if (ev.key === 'Enter') {
      this.confirm();
    } else if (ev.key === 'Backspace') {
      this.name = this.name.slice(0, -1);
      this.renderName();
    } else if (ev.key.length === 1 && this.name.length < 14) {
      this.name += ev.key;
      this.renderName();
    }
  }

  confirm() {
    const name = this.name.trim() || '???';
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
