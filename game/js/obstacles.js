"use strict";

import { TAU, normalizeAngle } from './math.js';
import { current as difficulty } from './difficulty.js';

export const ObstacleType = {
  GAP_WALL: 0,
  PULSE_RING: 1,
  SWEEP_BEAM: 2,
  ROTATING_GATE: 3,
  ORBIT_BLOCKER: 4
};

const POOL_SIZE = 64;

export class ObstaclePool {
  constructor() {
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(this._create());
    }
  }

  _create() {
    return {
      active: false,
      type: 0,
      radius: 0,
      startRadius: 0,
      speed: 0,
      // GapWall / RotatingGate
      gapAngles: [0],
      gapHalfWidth: 0.3,
      thickness: 8,
      gateRotationSpeed: 0,
      // PulseRing
      safeAngles: [0],
      safeHalfWidth: 0.3,
      pulsePhase: 0,
      // SweepBeam
      beamAngle: 0,
      beamAngularSpeed: 0,
      beamHalfWidth: 0.08,
      // OrbitBlocker
      blockerAngle: 0,
      blockerHalfArc: 0.3,
      blockerLifetime: 3.0,
      blockerAge: 0,
      // Render hints
      pressure: false
    };
  }

  acquire(type) {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        const obs = this.pool[i];
        obs.active = true;
        obs.type = type;
        obs.radius = 0;
        obs.startRadius = 0;
        obs.speed = 0;
        obs.gapAngles = [0];
        obs.gapHalfWidth = 0.3;
        obs.thickness = 8;
        obs.gateRotationSpeed = 0;
        obs.safeAngles = [0];
        obs.safeHalfWidth = 0.3;
        obs.pulsePhase = 0;
        obs.beamAngle = 0;
        obs.beamAngularSpeed = 0;
        obs.beamHalfWidth = 0.08;
        obs.blockerAngle = 0;
        obs.blockerHalfArc = 0.3;
        obs.blockerLifetime = 3.0;
        obs.blockerAge = 0;
        obs.pressure = false;
        return obs;
      }
    }
    // Pool exhausted — expand
    const obs = this._create();
    obs.active = true;
    obs.type = type;
    this.pool.push(obs);
    return obs;
  }

  release(obs) {
    obs.active = false;
  }

  releaseAll() {
    for (let i = 0; i < this.pool.length; i++) this.pool[i].active = false;
  }

  updateAll(dt, killRadius, orbitRadius) {
    for (let i = 0; i < this.pool.length; i++) {
      const obs = this.pool[i];
      if (!obs.active) continue;

      // Ease-in: slow at outer edge → full speed at orbit
      const easeMin = difficulty.speedEaseMin || 0.25;
      const totalDist = obs.startRadius - orbitRadius;
      const progress = totalDist > 0
        ? 1 - (obs.radius - orbitRadius) / totalDist
        : 1;
      const speedFactor = easeMin + (1 - easeMin) * Math.min(Math.max(progress, 0), 1);
      obs.radius -= obs.speed * speedFactor * dt;

      if (obs.type === ObstacleType.SWEEP_BEAM) {
        obs.beamAngle = normalizeAngle(obs.beamAngle + obs.beamAngularSpeed * dt);
      }
      if (obs.type === ObstacleType.PULSE_RING) {
        obs.pulsePhase += dt * 3;
      }
      if (obs.type === ObstacleType.ROTATING_GATE) {
        for (let g = 0; g < obs.gapAngles.length; g++) {
          obs.gapAngles[g] = normalizeAngle(obs.gapAngles[g] + obs.gateRotationSpeed * dt);
        }
      }
      if (obs.type === ObstacleType.ORBIT_BLOCKER) {
        obs.blockerAge += dt;
        if (obs.blockerAge >= obs.blockerLifetime) {
          obs.active = false;
          continue;
        }
      }

      if (obs.radius < killRadius * 0.3 && obs.type !== ObstacleType.ORBIT_BLOCKER) {
        obs.active = false;
      }
    }
  }

  forEachActive(fn) {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) fn(this.pool[i]);
    }
  }
}
