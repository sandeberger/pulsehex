"use strict";

export class Effects {
  constructor() {
    this.shatterParticles = [];
    this.nearMissFlash = 0;
    this.beatPulse = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeTime = 0;
  }

  triggerDeath(x, y) {
    this.shatterParticles.length = 0;
    const count = 14 + (Math.random() * 6) | 0;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.4;
      const speed = 100 + Math.random() * 200;
      this.shatterParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 12,
        size: 4 + Math.random() * 8,
        alpha: 1.0
      });
    }
    this.shakeTime = 0.2;
  }

  triggerNearMiss() {
    this.nearMissFlash = 0.05;
  }

  triggerBeat() {
    this.beatPulse = 0.05;
  }

  update(dt) {
    // Shatter particles
    for (let i = this.shatterParticles.length - 1; i >= 0; i--) {
      const p = this.shatterParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;
      p.alpha -= dt * 1.7;
      if (p.alpha <= 0) this.shatterParticles.splice(i, 1);
    }

    // Near-miss flash
    if (this.nearMissFlash > 0) this.nearMissFlash -= dt;

    // Beat pulse
    if (this.beatPulse > 0) this.beatPulse *= Math.exp(-dt * 12);
    if (this.beatPulse < 0.001) this.beatPulse = 0;

    // Screen shake
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const intensity = this.shakeTime * 40;
      this.shakeX = (Math.random() - 0.5) * intensity;
      this.shakeY = (Math.random() - 0.5) * intensity;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  get isShatterActive() {
    return this.shatterParticles.length > 0;
  }
}
