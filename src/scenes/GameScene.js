// The main play scene: owns the SwingCore, renders the playfield and HUD,
// takes input and replays core events through the EventPlayer.
import { SwingCore } from '../core/swingCore.js';
import { capacity, NUM_COLS } from '../core/match.js';
import { LAYOUT, TIMINGS, FONTS, colX } from '../config.js';
import { t } from '../i18n.js';
import { loadScores, loadName } from '../highscore.js';
import { SeesawView } from '../view/SeesawView.js';
import { ClawView } from '../view/ClawView.js';
import { QueueView } from '../view/QueueView.js';
import { EventPlayer } from '../view/EventPlayer.js';

const { W, H } = { W: LAYOUT.W, H: LAYOUT.H };

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.settings = {
      seed: data.seed ?? ((Math.random() * 2 ** 31) | 0),
      difficulty: data.difficulty ?? 'normal',
      extras: data.extras ?? true,
      playerName: data.playerName || loadName() || 'Player 1',
    };
  }

  create() {
    this.core = new SwingCore(this.settings);
    this.sprites = new Map();
    this.busy = false;
    this.paused = false;
    this.playMs = 0;

    this.playfield = this.add.container(0, 0);
    this.buildLayout();
    this.seesaws = [0, 1, 2, 3].map((s) => new SeesawView(this, s, this.playfield));
    this.queueView = new QueueView(this);
    this.claw = new ClawView(this);
    this.eventPlayer = new EventPlayer(this);
    this.buildHud();
    this.setupInput();

    this.claw.hold(this.core.current);
    if (this.claw.heldSprite) this.sprites.set(this.core.current.id, this.claw.heldSprite);
    this.queueView.render(this.core.queue);
    this.refreshHud();

    // Hook for the Playwright smoke test (and curious consoles).
    window.__SWING__ = {
      game: this.game,
      drop: (col) => this.doDrop(col),
      isReady: () => !this.busy && !this.paused && this.core.phase !== 'gameover',
      snapshot: () => this.core.snapshot(),
      core: this.core,
    };
  }

  // --- static layout ---------------------------------------------------------

  buildLayout() {
    const pf = this.playfield;
    pf.add(this.add.rectangle(W / 2, H / 2, W, H, 0x171310));

    // Dark channel behind each seesaw pair
    for (let s = 0; s < 4; s++) {
      const cx = (colX(s * 2) + colX(s * 2 + 1)) / 2;
      pf.add(this.add.rectangle(cx, 585, LAYOUT.COL_W * 2 - 10, 680, 0x0e0b09));
    }

    // Side panels with a light bar, echoing the original cabinet look
    for (const px of [150, W - 150]) {
      pf.add(this.add.image(px, 590, 'i-panel_dark').setDisplaySize(272, 640).setTint(0x54422f));
      pf.add(this.add.rectangle(px, 292, 240, 22, 0x3a2d20));
      pf.add(this.add.rectangle(px, 292, 220, 10, 0xe8dc82));
      const label = this.add.text(px, 560, 'SWING', {
        fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '42px',
        color: '#6e5a35',
      }).setOrigin(0.5).setAngle(-8).setAlpha(0.55);
      pf.add(label);
    }

    // Floor: hazard stripe over a dark base
    pf.add(this.add.rectangle(W / 2, LAYOUT.FLOOR_Y + 24, 700, 70, 0x241c14));
    pf.add(this.add.image(W / 2, LAYOUT.FLOOR_Y + 4, 'i-hazard_long').setDisplaySize(680, 16));

    // Weight readouts under each column
    this.readouts = [];
    for (let c = 0; c < NUM_COLS; c++) {
      pf.add(this.add.image(colX(c), LAYOUT.READOUT_Y, 'i-panel_screen').setDisplaySize(52, 34).setTint(0x8f8578));
      const text = this.add.text(colX(c), LAYOUT.READOUT_Y, '0', {
        fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '20px', color: '#e8e2d4',
      }).setOrigin(0.5);
      pf.add(text);
      this.readouts.push(text);
    }

    // Claw rail
    pf.add(this.add.image(W / 2, LAYOUT.CLAW_Y - 52, 'i-beam').setDisplaySize(700, 14).setTint(0x6e6258));
  }

  buildHud() {
    const mkLabel = (x, y, text, size = 20, color = '#d8cf7a', origin = 0) =>
      this.add.text(x, y, text, {
        fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: `${size}px`, color,
        stroke: '#241c10', strokeThickness: 3,
      }).setOrigin(origin, 0).setDepth(40);

    // Header: player name + difficulty
    this.add.image(W / 2, 24, 'i-panel_dark').setDisplaySize(560, 34).setTint(0x6e6258).setDepth(39);
    mkLabel(W / 2 - 260, 12, `${t('playerName')}:`, 18);
    mkLabel(W / 2 - 130, 12, this.settings.playerName, 18, '#f0ead8');
    mkLabel(W / 2 + 60, 12, `${t('difficulty')}:`, 18);
    mkLabel(W / 2 + 190, 12, t(`difficulty.${this.settings.difficulty}`), 18, '#f0ead8');

    // Left cluster: level ball, ball counter, bonus lamps
    this.add.image(64, 64, 'ball').setDisplaySize(56, 56).setTint(0x2fd4c7).setDepth(40);
    this.levelText = mkLabel(64, 50, '1', 26, '#ffffff', 0.5).setOrigin(0.5, 0);
    mkLabel(64, 96, t('level'), 18, '#d8cf7a', 0.5).setOrigin(0.5, 0);
    this.add.image(150, 52, 'i-claw_prongs').setDisplaySize(30, 30).setTint(0x9a8d7c).setDepth(40);
    this.counterText = mkLabel(150, 64, '0', 22, '#f0ead8', 0.5).setOrigin(0.5, 0);

    this.lamps = [];
    for (let i = 0; i < 4; i++) {
      const x = 44 + i * 58;
      const lamp = this.add.image(x, 148, 'i-lamp_orange').setDisplaySize(34, 34).setDepth(40);
      mkLabel(x, 166, `x${i + 1}`, 15, '#c9bfa4', 0.5).setOrigin(0.5, 0);
      this.lamps.push(lamp);
    }

    // Right cluster: highscore, score, bonus bar
    mkLabel(1020, 14, t('highscore'), 22);
    this.highscoreText = mkLabel(1258, 40, '—', 20, '#9fdcC8', 1).setOrigin(1, 0);
    const top = loadScores()[0];
    this.highscoreText.setText(top ? `${top.name}  ${top.score.toLocaleString()}` : '—');
    mkLabel(1020, 78, t('score'), 22);
    this.scoreText = mkLabel(1258, 104, '0', 30, '#c8f5df', 1).setOrigin(1, 0);
    mkLabel(1020, 150, t('bonus'), 22);
    this.add.rectangle(1132, 196, 228, 22, 0x3d1620).setDepth(40);
    this.bonusFill = this.add.rectangle(1022, 196, 0, 16, 0xe05572).setOrigin(0, 0.5).setDepth(41);

    // Timer bottom left (the controls hint lives in the menu and pause screen)
    this.timerText = mkLabel(36, H - 44, '00:00', 24, '#f0ead8');
  }

  // --- input -----------------------------------------------------------------

  setupInput() {
    this.input.on('pointermove', (p) => {
      const col = this.colAt(p.x);
      if (col !== null) this.moveClaw(col);
    });
    this.input.on('pointerdown', (p) => {
      const col = this.colAt(p.x);
      if (col !== null) this.doDrop(col);
    });
    const kb = this.input.keyboard;
    kb.on('keydown-LEFT', () => this.moveClaw(Math.max(0, this.claw.col - 1)));
    kb.on('keydown-RIGHT', () => this.moveClaw(Math.min(NUM_COLS - 1, this.claw.col + 1)));
    kb.on('keydown-SPACE', () => this.doDrop(this.claw.col));
    kb.on('keydown-DOWN', () => this.doDrop(this.claw.col));
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-M', () => { this.sound.mute = !this.sound.mute; });
  }

  colAt(x) {
    const c = Math.floor((x - LAYOUT.PLAYFIELD_X) / LAYOUT.COL_W);
    return c >= 0 && c < NUM_COLS ? c : null;
  }

  moveClaw(col) {
    if (this.busy || this.paused) return;
    if (col !== this.claw.col) this.claw.moveTo(col);
  }

  async doDrop(col) {
    if (this.busy || this.paused || this.core.phase === 'gameover' || !this.core.current) return false;
    this.busy = true;
    const events = this.core.drop(col, this.time.now);
    await this.eventPlayer.play(events);
    this.refreshHud();
    this.busy = false;
    if (this.core.phase === 'gameover') {
      this.time.delayedCall(800, () => this.endGame());
    }
    return true;
  }

  togglePause() {
    if (this.busy || this.core.phase === 'gameover') return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pauseOverlay = this.add.container(0, 0).setDepth(80);
      this.pauseOverlay.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6));
      this.pauseOverlay.add(this.add.text(W / 2, H / 2 - 20, t('pause'), {
        fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '64px', color: '#f0ead8',
      }).setOrigin(0.5));
      this.pauseOverlay.add(this.add.text(W / 2, H / 2 + 40, t('pauseHint'), {
        fontFamily: FONTS.UI, fontSize: '22px', color: '#c9bfa4',
      }).setOrigin(0.5));
      this.pauseOverlay.add(this.add.text(W / 2, H / 2 + 90, t('controls'), {
        fontFamily: FONTS.UI, fontSize: '17px', color: '#8d8272',
      }).setOrigin(0.5));
    } else {
      this.pauseOverlay?.destroy();
      this.pauseOverlay = null;
    }
  }

  // --- HUD refresh -----------------------------------------------------------

  onCoreEvent(ev) {
    if (ev.scoreAfter !== undefined) this.scoreText.setText(ev.scoreAfter.toLocaleString());
    if (ev.type === 'bonusLamp' || ev.type === 'match') this.refreshLamps();
    if (ev.type === 'levelUp') this.levelText.setText(String(ev.level));
    if (['land', 'fling', 'settle', 'match', 'merge', 'explode', 'tilt'].includes(ev.type)) {
      this.refreshReadouts();
    }
    if (ev.type === 'spawn') this.counterText.setText(String(this.core.ballsDropped));
  }

  refreshHud() {
    this.scoreText.setText(this.core.score.toLocaleString());
    this.levelText.setText(String(this.core.level));
    this.counterText.setText(String(this.core.ballsDropped));
    this.refreshLamps();
    this.refreshReadouts();
  }

  refreshLamps() {
    this.lamps.forEach((lamp, i) => {
      lamp.setAlpha(this.core.multiplier >= i + 1 ? 1 : 0.22);
    });
  }

  refreshReadouts() {
    for (let c = 0; c < NUM_COLS; c++) {
      const w = this.core.weightOf(c);
      const len = this.core.columns[c].length;
      const cap = capacity(c, this.core.tilts);
      this.readouts[c].setText(String(w));
      this.readouts[c].setColor(len >= cap - 1 ? '#ff7f7f' : '#e8e2d4');
    }
  }

  shakePlayfield(intensity = 4) {
    this.cameras.main.shake(140, intensity / 1000);
  }

  showBanner(key, vars) {
    const text = this.add.text(W / 2, 430, t(key, vars), {
      fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '58px',
      color: '#ffd54f', stroke: '#241c10', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(70).setScale(0);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: text,
        scale: 1,
        duration: 220,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: text,
            alpha: 0,
            delay: TIMINGS.BANNER,
            duration: 280,
            onComplete: () => { text.destroy(); resolve(); },
          });
        },
      });
    });
  }

  sfx(key, volume = 0.5) {
    try {
      this.sound.play(key, { volume });
    } catch { /* audio may be locked or unavailable; never break the game */ }
  }

  endGame() {
    this.scene.start('GameOver', {
      score: this.core.score,
      level: this.core.level,
      difficulty: this.settings.difficulty,
      playerName: this.settings.playerName,
      elapsed: this.playMs,
    });
  }

  update(time, delta) {
    if (!this.paused) this.playMs += delta;
    const total = Math.floor(this.playMs / 1000);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    this.timerText.setText(`${mm}:${ss}`);

    const decays = this.core.updateBonus(this.time.now);
    if (decays.length) this.refreshLamps();
    const remain = this.core.multiplier > 1
      ? Math.max(0, this.core.bonusExpiresAt - this.time.now) / 4000
      : 0;
    this.bonusFill.width = 220 * Math.min(1, remain);
  }
}
