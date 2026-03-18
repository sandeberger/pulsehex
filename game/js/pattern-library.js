"use strict";

import { TAU, normalizeAngle, angleDiff } from './math.js';
import { ObstacleType } from './obstacles.js';

export const patterns = {
  'gap-wall-single': {
    type: ObstacleType.GAP_WALL,
    gaps: 1,
    gapHalfWidth: 0.50,
    thickness: 8
  },
  'gap-wall-double': {
    type: ObstacleType.GAP_WALL,
    gaps: 2,
    gapHalfWidth: 0.35,
    thickness: 8
  },
  'gap-wall-narrow': {
    type: ObstacleType.GAP_WALL,
    gaps: 1,
    gapHalfWidth: 0.32,
    thickness: 10
  },
  'pulse-ring-easy': {
    type: ObstacleType.PULSE_RING,
    safeZones: 2,
    safeHalfWidth: 0.50,
    thickness: 6
  },
  'pulse-ring-hard': {
    type: ObstacleType.PULSE_RING,
    safeZones: 1,
    safeHalfWidth: 0.35,
    thickness: 8
  },
  'sweep-beam-slow': {
    type: ObstacleType.SWEEP_BEAM,
    beamAngularSpeed: TAU * 0.15,
    beamHalfWidth: 0.1
  },
  'sweep-beam-fast': {
    type: ObstacleType.SWEEP_BEAM,
    beamAngularSpeed: TAU * 0.3,
    beamHalfWidth: 0.08
  },

  // --- Rotating Gates ---
  'rotating-gate-slow': {
    type: ObstacleType.ROTATING_GATE,
    gaps: 1,
    gapHalfWidth: 0.50,
    gateRotationSpeed: TAU * 0.08,
    thickness: 8
  },
  'rotating-gate-fast': {
    type: ObstacleType.ROTATING_GATE,
    gaps: 1,
    gapHalfWidth: 0.45,
    gateRotationSpeed: TAU * 0.18,
    thickness: 8
  },
  'rotating-gate-reverse': {
    type: ObstacleType.ROTATING_GATE,
    gaps: 2,
    gapHalfWidth: 0.38,
    gateRotationSpeed: -TAU * 0.12,
    thickness: 8
  },

  // --- Orbit Blockers ---
  'orbit-blocker-short': {
    type: ObstacleType.ORBIT_BLOCKER,
    blockerHalfArc: 0.4,
    blockerLifetime: 3.0,
    thickness: 12
  },
  'orbit-blocker-wide': {
    type: ObstacleType.ORBIT_BLOCKER,
    blockerHalfArc: 0.7,
    blockerLifetime: 4.0,
    thickness: 12
  },

  // --- Offset Double Walls (spawner pairs them) ---
  'double-wall-offset': {
    type: ObstacleType.GAP_WALL,
    gaps: 1,
    gapHalfWidth: 0.45,
    thickness: 8,
    _paired: true,
    _pairDelayBeats: 2,
    _pairAngleShift: Math.PI
  },

  // --- Alternating Safe Lanes ---
  'alt-lane-A': {
    type: ObstacleType.GAP_WALL,
    gaps: 1,
    gapHalfWidth: 0.50,
    thickness: 8,
    _fixedGapAngle: 0
  },
  'alt-lane-B': {
    type: ObstacleType.GAP_WALL,
    gaps: 1,
    gapHalfWidth: 0.50,
    thickness: 8,
    _fixedGapAngle: Math.PI
  },

  // --- Pressure Patterns (visually aggressive, mechanically generous) ---
  'pressure-wall': {
    type: ObstacleType.GAP_WALL,
    gaps: 2,
    gapHalfWidth: 0.55,
    thickness: 14,
    pressure: true
  },
  'pressure-ring': {
    type: ObstacleType.PULSE_RING,
    safeZones: 3,
    safeHalfWidth: 0.50,
    thickness: 12,
    pressure: true
  }
};

let _lastGapAngle = 0;

/**
 * Place gap/safe-zone angles so that at least the first one is always
 * reachable by the player given their current position and movement budget.
 *
 * @param {number} count          – how many gaps / safe-zones
 * @param {number} [minSeparation] – min angular distance between gaps (default π/2)
 * @param {number} [playerAngle]  – player's current angle on the orbit
 * @param {number} [maxReach]     – max radians the player can traverse before the
 *                                   obstacle arrives (angularSpeed × travelTime)
 */
export function randomizeGapAngles(count, minSeparation, playerAngle, maxReach) {
  minSeparation = minSeparation || (Math.PI / 2);
  const angles = [];

  for (let i = 0; i < count; i++) {
    let a;
    let attempts = 0;

    // First gap MUST be reachable – constrain to player's reachable arc
    const constrain = (i === 0 && playerAngle != null && maxReach != null);
    // 90% safety margin so the player doesn't need frame-perfect input
    const reach = constrain ? maxReach * 0.9 : 0;

    do {
      if (constrain) {
        // Random angle within [-reach, +reach] of the player
        a = normalizeAngle(playerAngle + (Math.random() * 2 - 1) * reach);
      } else {
        a = Math.random() * TAU;
      }
      attempts++;
    } while (
      attempts < 30 &&
      (Math.abs(angleDiff(a, _lastGapAngle)) < minSeparation ||
       angles.some(prev => Math.abs(angleDiff(a, prev)) < minSeparation))
    );
    angles.push(a);
  }
  _lastGapAngle = angles[angles.length - 1];
  return angles;
}

export function resetLastGap() {
  _lastGapAngle = 0;
}
