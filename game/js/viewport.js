"use strict";

export class Viewport {
  constructor(canvas) {
    this.canvas = canvas;
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.gameRadius = 0;
    this.orbitRadius = 0;
    this.outerRadius = 0;
    this.innerRadius = 0;
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  _onResize() {
    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    this.centerX = this.width / 2;
    this.centerY = this.height * 0.45;
    this.gameRadius = Math.min(this.width * 0.46, this.height * 0.38);
    this.orbitRadius = this.gameRadius * 0.55;
    this.outerRadius = this.gameRadius * 1.05;
    this.innerRadius = this.gameRadius * 0.15;
  }

  get safeTop() { return this.height * 0.08; }
  get safeBottom() { return this.height * 0.92; }

  destroy() {
    window.removeEventListener('resize', this._onResize);
  }
}
