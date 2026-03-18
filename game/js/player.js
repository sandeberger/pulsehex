"use strict";

import { TAU, normalizeAngle } from './math.js';
import { current as difficulty } from './difficulty.js';

const TRAIL_LENGTH = 20;

export class Player {
  constructor() {
    this.angle = 0;
    this.prevAngle = 0;
    this.angularSpeed = TAU * 0.75;
    this.hitboxHalfArc = 0.05;
    this.trail = [];
    this.alive = true;
  }

  update(dt, direction) {
    this.prevAngle = this.angle;
    this.angle = normalizeAngle(this.angle + direction * this.angularSpeed * dt);

    if (direction !== 0) {
      this.trail.push({ angle: this.angle, alpha: 1.0 });
      if (this.trail.length > TRAIL_LENGTH) this.trail.shift();
    }
    for (let i = 0; i < this.trail.length; i++) {
      this.trail[i].alpha -= dt * 3;
    }
    while (this.trail.length > 0 && this.trail[0].alpha <= 0) this.trail.shift();
  }

  reset() {
    this.angle = 0;
    this.prevAngle = 0;
    this.trail.length = 0;
    this.alive = true;
    this.hitboxHalfArc = difficulty.hitboxHalfArc || 0.05;
  }
}
