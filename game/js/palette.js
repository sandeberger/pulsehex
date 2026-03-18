"use strict";

import { lerp } from './math.js';

const PALETTES = [
  { bg: [10, 10, 20], ring: [40, 60, 100], obstacle: [0, 200, 255], player: [255, 100, 50], glow: [0, 150, 255] },
  { bg: [15, 8, 20], ring: [80, 40, 100], obstacle: [200, 50, 255], player: [255, 200, 50], glow: [180, 50, 255] },
  { bg: [5, 15, 10], ring: [30, 80, 50], obstacle: [50, 255, 120], player: [255, 80, 80], glow: [50, 200, 100] },
  { bg: [20, 10, 5], ring: [100, 50, 30], obstacle: [255, 120, 30], player: [100, 200, 255], glow: [255, 100, 30] },
];

export class Palette {
  constructor() {
    this.currentIdx = 0;
    this.targetIdx = 0;
    this.transition = 1;
    this.transitionSpeed = 2.0;
    this.bg = [10, 10, 20];
    this.ring = [40, 60, 100];
    this.obstacle = [0, 200, 255];
    this.player = [255, 100, 50];
    this.glow = [0, 150, 255];
    this._apply(PALETTES[0]);
  }

  setSection(idx) {
    const newIdx = idx % PALETTES.length;
    if (newIdx !== this.targetIdx) {
      this.currentIdx = this.targetIdx;
      this.targetIdx = newIdx;
      this.transition = 0;
    }
  }

  update(dt) {
    if (this.transition >= 1) return;
    this.transition = Math.min(1, this.transition + dt * this.transitionSpeed);
    const from = PALETTES[this.currentIdx];
    const to = PALETTES[this.targetIdx];
    this._lerpPalette(from, to, this.transition);
  }

  _lerpPalette(from, to, t) {
    for (let i = 0; i < 3; i++) {
      this.bg[i] = lerp(from.bg[i], to.bg[i], t) | 0;
      this.ring[i] = lerp(from.ring[i], to.ring[i], t) | 0;
      this.obstacle[i] = lerp(from.obstacle[i], to.obstacle[i], t) | 0;
      this.player[i] = lerp(from.player[i], to.player[i], t) | 0;
      this.glow[i] = lerp(from.glow[i], to.glow[i], t) | 0;
    }
  }

  _apply(p) {
    this.bg = [...p.bg];
    this.ring = [...p.ring];
    this.obstacle = [...p.obstacle];
    this.player = [...p.player];
    this.glow = [...p.glow];
  }

  rgb(arr) { return `rgb(${arr[0]},${arr[1]},${arr[2]})`; }
  rgba(arr, a) { return `rgba(${arr[0]},${arr[1]},${arr[2]},${a})`; }
}
