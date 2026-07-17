// The main play scene: owns the SwingCore, renders the playfield and HUD,
// takes input and replays core events through the EventPlayer.
import { SwingCore } from '../core/swingCore.js';
import { capacity, NUM_COLS } from '../core/match.js';
import { LAYOUT, TIMINGS, FONTS, colX, ballY } from '../config.js';
import { BallSprite } from '../view/BallSprite.js';
import { t } from '../i18n.js';
import { loadScores, loadName } from '../highscore.js';
import { SeesawView } from '../view/SeesawView.js';
import { ClawView } from '../view/ClawView.js';
import { QueueView } from '../view/QueueView.js';
import { EventPlayer } from '../view/EventPlayer.js';
import { ambientDust, fxOk } from '../view/effects.js';


export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    // A pending orientation-change stash wins over fresh-start data.
    this.resume = null;
    try {
      const raw = sessionStorage.getItem('swing.resume');
      if (raw) {
        sessionStorage.removeItem('swing.resume');
        this.resume = JSON.parse(raw);
      }
    } catch { /* corrupt stash -> fresh game */ }
    this.settings = this.resume?.settings ?? {
      seed: data.seed ?? ((Math.random() * 2 ** 31) | 0),
      difficulty: data.difficulty ?? 'normal',
      extras: data.extras ?? true,
      playerName: data.playerName || loadName() || 'Player 1',
    };
  }

  create() {
    this.core = this.resume
      ? SwingCore.fromSnapshot(this.resume.snapshot)
      : new SwingCore(this.settings);
    this.sprites = new Map();
    this.busy = false;
    this.paused = false;
    this.playMs = this.resume?.playMs ?? 0;

    this.playfield = this.add.container(0, 0);
    this.buildLayout();
    // Spotlight beam from the claw onto the aimed column (moveClaw/doDrop)
    this.aimMarker = this.add.image(colX(3), LAYOUT.CLAW_Y - 24, 'light-beam')
      .setOrigin(0.5, 0)
      .setDisplaySize(LAYOUT.COL_W - 6, LAYOUT.FLOOR_Y - LAYOUT.CLAW_Y + 14)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5)
      .setDepth(1);
    this.seesaws = [0, 1, 2, 3].map((s) => new SeesawView(this, s, this.playfield));
    ambientDust(this, LAYOUT.PLAYFIELD_X, LAYOUT.CLAW_Y + 60,
      LAYOUT.COL_W * NUM_COLS, LAYOUT.FLOOR_Y - LAYOUT.CLAW_Y - 220);
    if (fxOk(this)) this.cameras.main.postFX.addVignette(0.5, 0.5, 0.86, 0.38);
    this.queueView = new QueueView(this);
    this.claw = new ClawView(this);
    this.eventPlayer = new EventPlayer(this);
    this.buildHud();
    this.setupInput();

    this.renderExistingField();
    if (this.core.current) {
      this.claw.hold(this.core.current);
      if (this.claw.heldSprite) this.sprites.set(this.core.current.id, this.claw.heldSprite);
    }
    this.queueView.render(this.core.queue);
    this.refreshHud();

    // Hook for the Playwright smoke test (and curious consoles).
    window.__SWING__ = {
      game: this.game,
      drop: (col) => this.doDrop(col),
      isReady: () => !this.busy && !this.paused && this.core.phase !== 'gameover',
      snapshot: () => this.core.snapshot(),
      core: this.core,
      clawCol: () => this.claw.col,
      layout: LAYOUT,
      stash: () => this.stash(),
    };
  }

  // Draw a restored (or initially empty) field: seesaw tilts, ball stacks and
  // the event player's view mirror, all without animation.
  renderExistingField() {
    this.core.tilts.forEach((tilt, s) => this.seesaws[s].setTiltInstant(tilt));
    this.eventPlayer.viewTilts = [...this.core.tilts];
    this.core.columns.forEach((column, c) => {
      column.forEach((ball, si) => {
        const sprite = new BallSprite(this, ball, colX(c), ballY(c, si, this.core.tilts));
        sprite.setDepth(10);
        this.sprites.set(ball.id, sprite);
        this.eventPlayer.viewCols[c].push(ball.id);
      });
    });
  }

  // Called right before an orientation-change reload.
  stash() {
    if (this.core.phase === 'gameover') return;
    try {
      sessionStorage.setItem('swing.resume', JSON.stringify({
        snapshot: this.core.snapshot(),
        settings: this.settings,
        playMs: this.playMs,
      }));
    } catch { /* storage full/unavailable -> the reload starts fresh */ }
  }

  // --- static layout ---------------------------------------------------------

  buildLayout() {
    const pf = this.playfield;
    const { W: LW, H: LH } = LAYOUT;
    const fieldW = LAYOUT.COL_W * NUM_COLS;
    pf.add(this.add.rectangle(LW / 2, LH / 2, LW, LH, 0x171310));

    // Dark channel behind each seesaw pair
    const chTop = LAYOUT.CLAW_Y + 30;
    const chBottom = LAYOUT.FLOOR_Y + 20;
    for (let s = 0; s < 4; s++) {
      const cx = (colX(s * 2) + colX(s * 2 + 1)) / 2;
      pf.add(this.add.rectangle(cx, (chTop + chBottom) / 2, LAYOUT.COL_W * 2 - 10, chBottom - chTop, 0x0e0b09));
    }

    // Side panels with a flickering light bar (landscape only — portrait has
    // no room next to the field)
    for (const px of LAYOUT.portrait ? [] : [150, LW - 150]) {
      pf.add(this.add.image(px, 590, 'i-panel_dark').setDisplaySize(272, 640).setTint(0x54422f));
      pf.add(this.add.rectangle(px, 292, 240, 22, 0x3a2d20));
      const bar = this.add.rectangle(px, 292, 220, 10, 0xe8dc82);
      pf.add(bar);
      const glow = this.add.image(px, 302, 'light-beam')
        .setOrigin(0.5, 0).setDisplaySize(230, 190)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.4);
      pf.add(glow);
      this.tweens.add({
        targets: bar,
        alpha: { from: 1, to: 0.66 },
        duration: 1800 + px, // slightly out of phase left vs right
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.4, to: 0.2 },
        duration: 1800 + px,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      const label = this.add.text(px, 560, 'SWING', {
        fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: '42px',
        color: '#6e5a35',
      }).setOrigin(0.5).setAngle(-8).setAlpha(0.55);
      pf.add(label);
    }

    // Floor: hazard stripe over a dark base
    pf.add(this.add.rectangle(LW / 2, LAYOUT.FLOOR_Y + 24, fieldW + 60, 70, 0x241c14));
    pf.add(this.add.image(LW / 2, LAYOUT.FLOOR_Y + 4, 'i-hazard_long').setDisplaySize(fieldW + 40, 16));

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
    pf.add(this.add.image(LW / 2, LAYOUT.CLAW_Y - 52, 'i-beam').setDisplaySize(fieldW + 60, 14).setTint(0x6e6258));
  }

  buildHud() {
    const mkLabel = (x, y, text, size = 20, color = '#d8cf7a', origin = 0) =>
      this.add.text(x, y, text, {
        fontFamily: FONTS.UI, fontStyle: 'bold', fontSize: `${size}px`, color,
        stroke: '#241c10', strokeThickness: 3,
      }).setOrigin(origin, 0).setDepth(40);

    const { W, H, portrait } = LAYOUT;
    const top = loadScores()[0];
    const topLine = top ? `${top.name}  ${top.score.toLocaleString()}` : '—';

    // Header: player name + difficulty (identical in both layouts)
    this.add.image(W / 2, 24, 'i-panel_dark')
      .setDisplaySize(Math.min(W - 40, 560), 34).setTint(0x6e6258).setDepth(39);
    mkLabel(W / 2 - 260, 12, `${t('playerName')}:`, 18);
    mkLabel(W / 2 - 130, 12, this.settings.playerName, 18, '#f0ead8');
    mkLabel(W / 2 + 60, 12, `${t('difficulty')}:`, 18);
    mkLabel(W / 2 + 190, 12, t(`difficulty.${this.settings.difficulty}`), 18, '#f0ead8');

    this.lamps = [];
    const makeLamps = (x0, y, spacing, size) => {
      for (let i = 0; i < 4; i++) {
        const x = x0 + i * spacing;
        const lamp = this.add.image(x, y, 'i-lamp_orange').setDisplaySize(size, size).setDepth(40);
        if (fxOk(this)) lamp.preFX.setPadding(12);
        mkLabel(x, y + size / 2 + 1, `x${i + 1}`, 15, '#c9bfa4', 0.5).setOrigin(0.5, 0);
        this.lamps.push(lamp);
      }
    };

    if (portrait) {
      // Left of the queue: level ball + drop counter, lamps below
      this.add.image(64, 118, 'ball3d-c0').setDisplaySize(56, 56).setDepth(40);
      this.levelText = mkLabel(64, 104, '1', 26, '#ffffff', 0.5).setOrigin(0.5, 0);
      mkLabel(64, 150, t('level'), 16, '#d8cf7a', 0.5).setOrigin(0.5, 0);
      this.add.image(134, 106, 'i-claw_prongs').setDisplaySize(26, 26).setTint(0x9a8d7c).setDepth(40);
      this.counterText = mkLabel(134, 118, '0', 20, '#f0ead8', 0.5).setOrigin(0.5, 0);
      makeLamps(46, 206, 46, 30);
      // Right of the queue: highscore (compact), score, bonus bar
      this.highscoreText = mkLabel(W - 16, 52, `🏆 ${topLine}`, 14, '#9fdcC8', 1).setOrigin(1, 0);
      mkLabel(W - 166, 76, t('score'), 18);
      this.scoreText = mkLabel(W - 16, 100, '0', 28, '#c8f5df', 1).setOrigin(1, 0);
      mkLabel(W - 166, 148, t('bonus'), 16);
      this.bonusBarWidth = 150;
      this.add.rectangle(W - 91, 186, 158, 20, 0x3d1620).setDepth(40);
      this.bonusFill = this.add.rectangle(W - 166, 186, 0, 14, 0xe05572).setOrigin(0, 0.5).setDepth(41);
      // Bottom strip: timer left, buttons right (below the readouts)
      this.timerText = mkLabel(28, H - 40, '00:00', 22, '#f0ead8');
      this.makeIconButton(W - 118, H - 30, '⏸', () => this.togglePause(), 88, 56);
      this.muteIcon = this.makeIconButton(W - 44, H - 30, this.sound.mute ? '🔇' : '🔊', () => {
        this.sound.mute = !this.sound.mute;
        this.muteIcon.setText(this.sound.mute ? '🔇' : '🔊');
      }, 88, 56);
    } else {
      // Left cluster: level ball, ball counter, bonus lamps
      this.add.image(64, 64, 'ball3d-c0').setDisplaySize(56, 56).setDepth(40);
      this.levelText = mkLabel(64, 50, '1', 26, '#ffffff', 0.5).setOrigin(0.5, 0);
      mkLabel(64, 96, t('level'), 18, '#d8cf7a', 0.5).setOrigin(0.5, 0);
      this.add.image(150, 52, 'i-claw_prongs').setDisplaySize(30, 30).setTint(0x9a8d7c).setDepth(40);
      this.counterText = mkLabel(150, 64, '0', 22, '#f0ead8', 0.5).setOrigin(0.5, 0);
      makeLamps(44, 148, 58, 34);
      // Right cluster: highscore, score, bonus bar
      mkLabel(1020, 14, t('highscore'), 22);
      this.highscoreText = mkLabel(1258, 40, topLine, 20, '#9fdcC8', 1).setOrigin(1, 0);
      mkLabel(1020, 78, t('score'), 22);
      this.scoreText = mkLabel(1258, 104, '0', 30, '#c8f5df', 1).setOrigin(1, 0);
      mkLabel(1020, 150, t('bonus'), 22);
      this.bonusBarWidth = 220;
      this.add.rectangle(1132, 196, 228, 22, 0x3d1620).setDepth(40);
      this.bonusFill = this.add.rectangle(1022, 196, 0, 16, 0xe05572).setOrigin(0, 0.5).setDepth(41);
      this.timerText = mkLabel(36, H - 44, '00:00', 24, '#f0ead8');
      this.makeIconButton(1146, H - 76, '⏸', () => this.togglePause());
      this.muteIcon = this.makeIconButton(1226, H - 76, this.sound.mute ? '🔇' : '🔊', () => {
        this.sound.mute = !this.sound.mute;
        this.muteIcon.setText(this.sound.mute ? '🔇' : '🔊');
      });
    }
  }

  makeIconButton(x, y, icon, onTap, hitW = 112, hitH = 112) {
    const hit = this.add.rectangle(x, y, hitW, hitH, 0x000000, 0)
      .setDepth(46).setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, icon, {
      fontFamily: FONTS.UI, fontSize: '40px',
    }).setOrigin(0.5).setDepth(45).setAlpha(0.85);
    hit.on('pointerdown', () => {
      this.sfx('click', 0.35);
      onTap();
    });
    return label;
  }

  // --- input -----------------------------------------------------------------

  setupInput() {
    this.input.on('pointermove', (p) => {
      const col = this.colAt(p.x, p.y);
      if (col !== null) this.moveClaw(col);
    });
    // Mouse: hover aims, click drops. Touch: tap aims, tap on the aimed
    // column drops; dragging aims without dropping.
    this.input.on('pointerdown', (p) => {
      this.tapStartCol = this.claw.col;
      if (p.wasTouch) return; // touch commits on pointerup
      const col = this.colAt(p.x, p.y);
      if (col !== null) this.doDrop(col);
    });
    this.input.on('pointerup', (p) => {
      if (!p.wasTouch) return;
      const col = this.colAt(p.x, p.y);
      if (col === null) return;
      const dragged = Phaser.Math.Distance.Between(p.downX, p.downY, p.x, p.y) > 24;
      if (dragged) return; // drag = aim only
      if (col === this.tapStartCol) this.doDrop(col);
      else this.moveClaw(col);
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

  // Only the playfield area (below the queue, above the readouts) aims/drops,
  // so taps on HUD elements never throw a ball.
  colAt(x, y) {
    if (y < LAYOUT.CLAW_Y - 70 || y > LAYOUT.FLOOR_Y + 44) return null;
    const c = Math.floor((x - LAYOUT.PLAYFIELD_X) / LAYOUT.COL_W);
    return c >= 0 && c < NUM_COLS ? c : null;
  }

  moveClaw(col) {
    if (this.busy || this.paused) return;
    if (col !== this.claw.col) {
      this.claw.moveTo(col);
      this.aimMarker.x = colX(col);
    }
  }

  async doDrop(col) {
    if (this.busy || this.paused || this.core.phase === 'gameover' || !this.core.current) return false;
    if (this.time.now < (this.resumeGuardUntil ?? 0)) return false;
    this.aimMarker.x = colX(col);
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
      const { W, H } = LAYOUT;
      this.pauseOverlay = this.add.container(0, 0).setDepth(80);
      const veil = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6)
        .setInteractive(); // tap anywhere to resume
      veil.on('pointerdown', () => this.togglePause());
      this.pauseOverlay.add(veil);
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
      // The resuming tap must not immediately drop a ball.
      this.resumeGuardUntil = this.time.now + 300;
    }
  }

  // --- HUD refresh -----------------------------------------------------------

  // Roll the displayed score toward the real one with a little pop.
  setScore(target, instant = false) {
    this.displayedScore ??= 0;
    if (instant || target === this.displayedScore) {
      this.displayedScore = target;
      this.scoreText.setText(target.toLocaleString());
      return;
    }
    this.scoreRoll?.remove();
    const proxy = { v: this.displayedScore };
    this.scoreRoll = this.tweens.add({
      targets: proxy,
      v: target,
      duration: 480,
      ease: 'Quad.easeOut',
      onUpdate: () => this.scoreText.setText(Math.round(proxy.v).toLocaleString()),
      onComplete: () => { this.displayedScore = target; },
    });
    this.scoreText.setScale(1.18);
    this.tweens.add({ targets: this.scoreText, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  onCoreEvent(ev) {
    if (ev.scoreAfter !== undefined) this.setScore(ev.scoreAfter);
    if (ev.type === 'bonusLamp' || ev.type === 'match') this.refreshLamps();
    if (ev.type === 'levelUp') this.levelText.setText(String(ev.level));
    if (['land', 'fling', 'settle', 'match', 'merge', 'explode', 'tilt'].includes(ev.type)) {
      this.refreshReadouts();
    }
    if (ev.type === 'spawn') this.counterText.setText(String(this.core.ballsDropped));
  }

  refreshHud() {
    this.setScore(this.core.score, true);
    this.levelText.setText(String(this.core.level));
    this.counterText.setText(String(this.core.ballsDropped));
    this.refreshLamps();
    this.refreshReadouts();
  }

  refreshLamps() {
    this.lamps.forEach((lamp, i) => {
      const lit = this.core.multiplier >= i + 1;
      lamp.setAlpha(lit ? 1 : 0.22);
      if (!fxOk(this)) return;
      if (lit && !lamp.glowFX) {
        lamp.glowFX = lamp.preFX.addGlow(0xffaa33, 3);
      } else if (!lit && lamp.glowFX) {
        lamp.preFX.remove(lamp.glowFX);
        lamp.glowFX = null;
      }
    });
  }

  refreshReadouts() {
    this.readoutTweens ??= new Array(NUM_COLS).fill(null);
    for (let c = 0; c < NUM_COLS; c++) {
      const w = this.core.weightOf(c);
      const len = this.core.columns[c].length;
      const cap = capacity(c, this.core.tilts);
      const danger = len >= cap - 1 && len > 0;
      this.readouts[c].setText(String(w));
      this.readouts[c].setColor(danger ? '#ff7f7f' : '#e8e2d4');
      if (danger && !this.readoutTweens[c]) {
        this.readoutTweens[c] = this.tweens.add({
          targets: this.readouts[c],
          alpha: 0.35,
          duration: 380,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else if (!danger && this.readoutTweens[c]) {
        this.readoutTweens[c].remove();
        this.readoutTweens[c] = null;
        this.readouts[c].setAlpha(1);
      }
    }
  }

  shakePlayfield(intensity = 4) {
    this.cameras.main.shake(140, intensity / 1000);
  }

  showBanner(key, vars) {
    const text = this.add.text(LAYOUT.W / 2, Math.round(LAYOUT.H * 0.45), t(key, vars), {
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
    this.seesaws.forEach((s) => s.update(delta));
    this.claw.update(time);
    // Keep every moving ball's specular pointed at the light source.
    for (const sprite of this.sprites.values()) sprite.updateLight?.();
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
    this.bonusFill.width = this.bonusBarWidth * Math.min(1, remain);
  }
}
