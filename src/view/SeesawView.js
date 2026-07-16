// One seesaw: a central gear plus, per shell, a toothed rack pillar with a
// pedestal on top (like the original's rack-and-pinion look). setTilt()
// animates pedestals and gear; ball sprites are moved by the EventPlayer.
import { LAYOUT, TIMINGS, colX, rowY } from '../config.js';
import { tiltOffset, leftCol, rightCol } from '../core/match.js';

export class SeesawView {
  constructor(scene, index, container) {
    this.scene = scene;
    this.index = index;
    this.tilt = 0;
    const pivotX = (colX(leftCol(index)) + colX(rightCol(index))) / 2;

    this.gear = scene.add.image(pivotX, LAYOUT.FLOOR_Y - 26, 'i-gear_large')
      .setDisplaySize(52, 52).setTint(0xb9a894);
    container.add(this.gear);

    this.shells = [leftCol(index), rightCol(index)].map((col) => {
      const x = colX(col);
      // Rack: stretched pillar from the floor up to the pedestal.
      const rack = scene.add.image(x, LAYOUT.FLOOR_Y, 'i-pillar')
        .setOrigin(0.5, 1).setTint(0x9c8b7a);
      const pedestal = scene.add.image(x, 0, 'i-pedestal')
        .setDisplaySize(LAYOUT.COL_W - 8, 34).setOrigin(0.5, 0).setTint(0xcbb9a4);
      container.add(rack);
      container.add(pedestal);
      const shell = { col, rack, pedestal };
      this.positionShell(shell, tiltOffset(col, this.tiltsArray()));
      return shell;
    });
  }

  tiltsArray() {
    const t = [0, 0, 0, 0];
    t[this.index] = this.tilt;
    return t;
  }

  pedestalTopY(offset) {
    return rowY(offset) + LAYOUT.BALL_D / 2 - 6;
  }

  positionShell(shell, offset) {
    const top = this.pedestalTopY(offset);
    shell.pedestal.y = top;
    shell.rack.setDisplaySize(18, LAYOUT.FLOOR_Y - top - 20);
  }

  // Tween to a new tilt; returns a promise resolving when done.
  setTilt(tilt) {
    this.tilt = tilt;
    const promises = this.shells.map((shell) => {
      const offset = tiltOffset(shell.col, this.tiltsArray());
      const top = this.pedestalTopY(offset);
      return new Promise((resolve) => {
        this.scene.tweens.add({
          targets: shell.pedestal,
          y: top,
          duration: TIMINGS.TILT,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            shell.rack.setDisplaySize(18, Math.max(8, LAYOUT.FLOOR_Y - shell.pedestal.y - 20));
          },
          onComplete: resolve,
        });
      });
    });
    this.scene.tweens.add({
      targets: this.gear,
      angle: tilt * 45,
      duration: TIMINGS.TILT,
      ease: 'Sine.easeInOut',
    });
    return Promise.all(promises);
  }
}
