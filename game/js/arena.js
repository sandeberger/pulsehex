"use strict";

import { TAU } from './math.js';

export class Arena {
  constructor() {
    this.centerX = 0;
    this.centerY = 0;
    this.orbitRadius = 0;
    this.outerRadius = 0;
    this.innerRadius = 0;
    this.killRadius = 0;
    this.polygonSides = 6;
    this.polygonVertexAngles = [];
    this._calcVertices();
  }

  updateFromViewport(vp) {
    this.centerX = vp.centerX;
    this.centerY = vp.centerY;
    this.orbitRadius = vp.orbitRadius;
    this.outerRadius = vp.outerRadius;
    this.innerRadius = vp.innerRadius;
    this.killRadius = this.orbitRadius * 0.9;
    this._calcVertices();
  }

  _calcVertices() {
    this.polygonVertexAngles = [];
    for (let i = 0; i < this.polygonSides; i++) {
      this.polygonVertexAngles.push((TAU / this.polygonSides) * i - Math.PI / 2);
    }
  }
}
