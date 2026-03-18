"use strict";

export class Score {
  constructor() {
    this.current = 0;
    this.multiplier = 1.0;
    this.displayScore = 0;
    this.nearMissCount = 0;
  }

  update(dt) {
    this.current += dt * 100 * this.multiplier;
    // Smooth display score toward actual
    this.displayScore += (this.current - this.displayScore) * Math.min(1, dt * 10);
  }

  addNearMiss() {
    this.nearMissCount++;
    this.current += 50 * this.multiplier;
  }

  addSectionClear() {
    this.multiplier += 0.25;
  }

  reset() {
    this.current = 0;
    this.displayScore = 0;
    this.multiplier = 1.0;
    this.nearMissCount = 0;
  }
}
