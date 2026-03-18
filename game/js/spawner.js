"use strict";

import { TAU, normalizeAngle, angleDiff } from './math.js';
import { ObstacleType } from './obstacles.js';
import { patterns, randomizeGapAngles, resetLastGap } from './pattern-library.js';
import { current as difficulty } from './difficulty.js';

// Safety margin — player shouldn't need pixel-perfect timing
const SAFETY = 0.85;

/**
 * Find the shortest angular travel between two sets of gaps, accounting
 * for gap widths and player hitbox.
 *
 * Returns { dist, idxA, idxB } where dist is the minimum angular distance
 * the player's center must travel, and idxA/idxB are the best gap pair.
 */
function shortestGapTravel(anglesA, halfWidthA, anglesB, halfWidthB, hitbox) {
  let best = Infinity;
  let idxA = 0, idxB = 0;

  for (let a = 0; a < anglesA.length; a++) {
    for (let b = 0; b < anglesB.length; b++) {
      const raw = Math.abs(angleDiff(anglesA[a], anglesB[b]));
      // Player is safe within (halfWidth + hitbox) of gap center on each side
      const effective = Math.max(0, raw - (halfWidthA + hitbox) - (halfWidthB + hitbox));
      if (effective < best) {
        best = effective;
        idxA = a;
        idxB = b;
      }
    }
  }

  return { dist: best, idxA, idxB };
}

/**
 * Nudge gapAngles[idx] toward targetAngle until the travel distance
 * is within the player's budget.
 */
function nudgeGap(gapAngles, idx, targetAngle, maxTravel, halfWidthSrc, halfWidthDst, hitbox) {
  const current = gapAngles[idx];
  const diff = angleDiff(current, targetAngle);
  const rawDist = Math.abs(diff);
  const effectiveDist = Math.max(0, rawDist - (halfWidthSrc + hitbox) - (halfWidthDst + hitbox));

  if (effectiveDist <= maxTravel) return; // already reachable

  // Move gap toward target so effective distance = maxTravel
  const overshoot = effectiveDist - maxTravel;
  const dir = diff > 0 ? 1 : -1;
  gapAngles[idx] = normalizeAngle(current + dir * overshoot);
}

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

    // Track last gap-based obstacle for reachability validation
    this._lastGapInfo = null; // { angles, halfWidth, beat }

    this._onRow = this._onRow.bind(this);
    adapter.on('row', this._onRow);
  }

  loadChart(chart) {
    this.chart = chart;
    // Use chart's lead beats, but allow difficulty to override
    this.spawnLeadBeats = difficulty.spawnLeadBeats || chart.spawnLeadBeats || 6;
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
    const angularSpeed = this.player ? this.player.angularSpeed : TAU * 0.75;
    const hitbox = this.player ? this.player.hitboxHalfArc : 0.05;
    const maxReach = angularSpeed * travelTime;

    const gs = difficulty.gapScale || 1;

    const obs = this.pool.acquire(pat.type);
    obs.radius = this.arena.outerRadius;
    obs.startRadius = this.arena.outerRadius;
    obs.speed = speed;
    obs.thickness = pat.thickness || 8;
    obs.pressure = pat.pressure || false;

    if (pat.type === ObstacleType.GAP_WALL) {
      if (pat._fixedGapAngle != null) {
        obs.gapAngles = [pat._fixedGapAngle];
      } else {
        obs.gapAngles = randomizeGapAngles(pat.gaps || 1, undefined, playerAngle, maxReach);
      }
      obs.gapHalfWidth = (pat.gapHalfWidth || 0.3) * gs;

      // --- Reachability check against previous gap-obstacle ---
      this._validateReachability(obs.gapAngles, obs.gapHalfWidth, angularSpeed, hitbox);

      // Schedule paired second wall if defined
      if (pat._paired && !(overrides && overrides._skipPair)) {
        const shiftedAngle = normalizeAngle(
          obs.gapAngles[0] + (pat._pairAngleShift || Math.PI)
        );
        this._pendingSpawns.push({
          beat: this.beatCount + (pat._pairDelayBeats || 2),
          pattern: patternName,
          overrides: {
            gapAngles: [shiftedAngle],
            _skipPair: true
          }
        });
      }

      // Update tracker
      this._lastGapInfo = {
        angles: obs.gapAngles.slice(),
        halfWidth: obs.gapHalfWidth,
        beat: this.beatCount
      };

    } else if (pat.type === ObstacleType.ROTATING_GATE) {
      obs.gapAngles = randomizeGapAngles(pat.gaps || 1, undefined, playerAngle, maxReach);
      obs.gapHalfWidth = (pat.gapHalfWidth || 0.4) * gs;
      obs.gateRotationSpeed = pat.gateRotationSpeed || TAU * 0.1;

      this._validateReachability(obs.gapAngles, obs.gapHalfWidth, angularSpeed, hitbox);

      this._lastGapInfo = {
        angles: obs.gapAngles.slice(),
        halfWidth: obs.gapHalfWidth,
        beat: this.beatCount
      };

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
      obs.safeHalfWidth = (pat.safeHalfWidth || 0.3) * gs;

      this._validateReachability(obs.safeAngles, obs.safeHalfWidth, angularSpeed, hitbox);

      this._lastGapInfo = {
        angles: obs.safeAngles.slice(),
        halfWidth: obs.safeHalfWidth,
        beat: this.beatCount
      };

    } else if (pat.type === ObstacleType.SWEEP_BEAM) {
      obs.beamAngle = Math.random() * Math.PI * 2;
      obs.beamAngularSpeed = pat.beamAngularSpeed || 1;
      obs.beamHalfWidth = pat.beamHalfWidth || 0.08;
    }

    if (overrides) {
      if (overrides._skipPair) {
        delete overrides._skipPair;
      }
      Object.assign(obs, overrides);
    }
  }

  /**
   * Check if the new obstacle's gaps are reachable from the previous
   * obstacle's gaps within the available time. If not, nudge the
   * closest gap of the new obstacle to make it reachable.
   */
  _validateReachability(newAngles, newHalfWidth, angularSpeed, hitbox) {
    if (!this._lastGapInfo) return; // first obstacle — already validated vs player

    const prev = this._lastGapInfo;
    const deltaBeat = this.beatCount - prev.beat;
    if (deltaBeat <= 0) return;

    const timeAvailable = deltaBeat * this._secsPerBeat;
    const maxTravel = angularSpeed * timeAvailable * SAFETY;

    const { dist, idxA, idxB } = shortestGapTravel(
      prev.angles, prev.halfWidth,
      newAngles, newHalfWidth,
      hitbox
    );

    if (dist <= maxTravel) return; // reachable — all good

    // Not reachable — nudge the new gap toward the closest previous gap
    nudgeGap(
      newAngles, idxB,
      prev.angles[idxA],
      maxTravel,
      prev.halfWidth, newHalfWidth,
      hitbox
    );
  }

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
    this._lastGapInfo = null;
    resetLastGap();
  }

  destroy() {
    this.adapter.off('row', this._onRow);
  }
}
