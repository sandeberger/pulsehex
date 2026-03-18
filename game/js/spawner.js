"use strict";

import { TAU, normalizeAngle } from './math.js';
import { ObstacleType } from './obstacles.js';
import { patterns, randomizeGapAngles, resetLastGap } from './pattern-library.js';

export class Spawner {
  constructor(pool, arena, adapter, player) {
    this.pool = pool;
    this.arena = arena;
    this.adapter = adapter;
    this.player = player;
    this.chart = null;
    this.spawnLeadBeats = 4;
    this.beatCount = 0;
    this.rowCount = 0;
    this._chartIdx = 0;
    this._secsPerBeat = 0.5;
    this._pendingSpawns = [];

    this._onRow = this._onRow.bind(this);
    adapter.on('row', this._onRow);
  }

  loadChart(chart) {
    this.chart = chart;
    this.spawnLeadBeats = chart.spawnLeadBeats || 4;
    this._chartIdx = 0;
  }

  _onRow(data) {
    this.rowCount++;
    const speed = this.adapter.speed || 6;
    const bpm = this.adapter.bpm || 125;
    this._secsPerBeat = (speed * 2.5) / bpm;

    this.beatCount++;

    // Fire any pending paired spawns
    for (let i = this._pendingSpawns.length - 1; i >= 0; i--) {
      const p = this._pendingSpawns[i];
      if (this.beatCount >= p.beat) {
        this._spawn(p.pattern, p.overrides);
        this._pendingSpawns.splice(i, 1);
      }
    }

    if (!this.chart) return;

    // Check chart for spawns
    while (this._chartIdx < this.chart.events.length) {
      const ev = this.chart.events[this._chartIdx];
      if (ev.beat > this.beatCount) break;

      // Macro expansion: spiral sequences
      if (ev.macro === 'spiral') {
        this._spawnSpiral(ev);
      } else {
        this._spawn(ev.pattern, ev.params);
      }
      this._chartIdx++;
    }
  }

  _spawn(patternName, overrides) {
    const pat = patterns[patternName];
    if (!pat) return;

    const travelDist = this.arena.outerRadius - this.arena.orbitRadius;
    const travelTime = this.spawnLeadBeats * this._secsPerBeat;
    const speed = travelDist / Math.max(0.1, travelTime);

    const playerAngle = this.player ? this.player.angle : null;
    const maxReach = this.player
      ? this.player.angularSpeed * travelTime
      : null;

    const obs = this.pool.acquire(pat.type);
    obs.radius = this.arena.outerRadius;
    obs.startRadius = this.arena.outerRadius;
    obs.speed = speed;
    obs.thickness = pat.thickness || 8;
    obs.pressure = pat.pressure || false;

    if (pat.type === ObstacleType.GAP_WALL) {
      // Fixed-angle patterns (alt-lanes) bypass randomization
      if (pat._fixedGapAngle != null) {
        obs.gapAngles = [pat._fixedGapAngle];
      } else {
        obs.gapAngles = randomizeGapAngles(pat.gaps || 1, undefined, playerAngle, maxReach);
      }
      obs.gapHalfWidth = pat.gapHalfWidth || 0.3;

      // Schedule paired second wall if defined
      if (pat._paired) {
        const shiftedAngle = normalizeAngle(
          obs.gapAngles[0] + (pat._pairAngleShift || Math.PI)
        );
        this._pendingSpawns.push({
          beat: this.beatCount + (pat._pairDelayBeats || 2),
          pattern: patternName,
          overrides: {
            gapAngles: [shiftedAngle],
            // Clear paired flag so second wall doesn't chain infinitely
            _skipPair: true
          }
        });
      }

    } else if (pat.type === ObstacleType.ROTATING_GATE) {
      obs.gapAngles = randomizeGapAngles(pat.gaps || 1, undefined, playerAngle, maxReach);
      obs.gapHalfWidth = pat.gapHalfWidth || 0.4;
      obs.gateRotationSpeed = pat.gateRotationSpeed || TAU * 0.1;

    } else if (pat.type === ObstacleType.ORBIT_BLOCKER) {
      obs.radius = this.arena.orbitRadius;
      obs.startRadius = this.arena.orbitRadius;
      obs.speed = 0;
      obs.blockerAngle = Math.random() * TAU;
      obs.blockerHalfArc = pat.blockerHalfArc || 0.3;
      obs.blockerLifetime = pat.blockerLifetime || 3.0;
      obs.blockerAge = 0;

    } else if (pat.type === ObstacleType.PULSE_RING) {
      obs.safeAngles = randomizeGapAngles(pat.safeZones || 1, undefined, playerAngle, maxReach);
      obs.safeHalfWidth = pat.safeHalfWidth || 0.3;

    } else if (pat.type === ObstacleType.SWEEP_BEAM) {
      obs.beamAngle = Math.random() * Math.PI * 2;
      obs.beamAngularSpeed = pat.beamAngularSpeed || 1;
      obs.beamHalfWidth = pat.beamHalfWidth || 0.08;
    }

    if (overrides) {
      // Apply overrides but respect _skipPair to prevent infinite chaining
      if (overrides._skipPair) {
        delete overrides._skipPair;
      }
      Object.assign(obs, overrides);
    }
  }

  /** Expand a spiral macro into a sequence of staggered gap-walls */
  _spawnSpiral(ev) {
    const steps = ev.steps || 5;
    const interval = ev.beatInterval || 2;
    const stepAngle = ev.stepAngle || (TAU / 8);
    const dir = ev.direction || 1;
    const baseAngle = this.player ? this.player.angle : 0;

    for (let i = 0; i < steps; i++) {
      const targetAngle = normalizeAngle(baseAngle + dir * stepAngle * (i + 1));
      this._pendingSpawns.push({
        beat: this.beatCount + interval * i,
        pattern: 'gap-wall-single',
        overrides: {
          gapAngles: [targetAngle]
        }
      });
    }
  }

  reset() {
    this.beatCount = 0;
    this.rowCount = 0;
    this._chartIdx = 0;
    this._pendingSpawns.length = 0;
    resetLastGap();
  }

  destroy() {
    this.adapter.off('row', this._onRow);
  }
}
