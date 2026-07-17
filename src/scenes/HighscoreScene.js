// Top-10 table from localStorage.
import { LAYOUT, FONTS } from '../config.js';
import { t } from '../i18n.js';
import { loadScores } from '../highscore.js';
import { fxOk } from '../view/effects.js';

export class HighscoreScene extends Phaser.Scene {
  constructor() {
    super('Highscore');
  }

  init(data) {
    this.highlightRank = data?.highlightRank ?? null;
  }

  create() {
    const W = LAYOUT.W;
    this.add.rectangle(W / 2, LAYOUT.H / 2, W, LAYOUT.H, 0x171310);
    if (fxOk(this)) this.cameras.main.postFX.addVignette(0.5, 0.5, 0.88, 0.34);
    this.add.image(W / 2, 490, 'i-panel_dark').setDisplaySize(760, 700).setTint(0x54422f);

    this.add.text(W / 2, 170, t('highscores'), {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '64px',
      color: '#d8cf7a', stroke: '#241c10', strokeThickness: 8,
    }).setOrigin(0.5);

    const scores = loadScores();
    if (!scores.length) {
      this.add.text(W / 2, 460, t('noScores'), {
        fontFamily: FONTS.UI, fontSize: '26px', color: '#c9bfa4',
      }).setOrigin(0.5);
    }
    scores.forEach((entry, i) => {
      const y = 260 + i * 52;
      const highlight = this.highlightRank === i + 1;
      const color = highlight ? '#ffe082' : '#f0ead8';
      const style = { fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '26px', color };
      this.add.text(W / 2 - 330, y, `${i + 1}.`, style);
      this.add.text(W / 2 - 260, y, entry.name, style);
      this.add.text(W / 2 + 330, y, entry.score.toLocaleString(), style).setOrigin(1, 0);
      this.add.text(W / 2 + 120, y + 4, `${t('level')} ${entry.level} · ${t(`difficulty.${entry.difficulty}`) ?? ''}`, {
        fontFamily: FONTS.UI, fontSize: '18px', color: '#8d8272',
      }).setOrigin(0, 0);
      if (highlight) {
        this.add.rectangle(W / 2, y + 14, 700, 44, 0xd8cf7a, 0.12);
      }
    });

    const back = this.add.text(W / 2, 880, `⟵ ${t('back')}`, {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '28px', color: '#d8cf7a',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Menu'));
    this.input.keyboard.once('keydown', () => this.scene.start('Menu'));
  }
}
