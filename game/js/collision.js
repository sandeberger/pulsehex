"use strict";

import { normalizeAngle, angleDiff } from './math.js';
import { ObstacleType } from './obstacles.js';

const NEAR_MISS_MULT = 3.0;

export const HitResult = {
  NONE: 0,
  HIT: 1,
  NEAR_MISS: 2
};

export function checkCollisions(player, pool, orbitRadius) {
  let result = HitResult.NONE;

  pool.forEachActive(obs => {
    // Only check obstacles near orbit radius
    const dist = Math.abs(obs.radius - orbitRadius);
    if (dist > obs.thickness * 2 + 20) return;

    const isAtOrbit = dist <= obs.thickness * 0.5 + 4;
    const isNearOrbit = dist <= obs.thickness * NEAR_MISS_MULT;

    if (!isAtOrbit && !isNearOrbit) return;

    let inDanger = false;

    if (obs.type === ObstacleType.GAP_WALL || obs.type === ObstacleType.ROTATING_GATE) {
      inDanger = true;
      for (let i = 0; i < obs.gapAngles.length; i++) {
        const diff = Math.abs(angleDiff(player.angle, obs.gapAngles[i]));
        if (diff < obs.gapHalfWidth + player.hitboxHalfArc) {
          inDanger = false;
          break;
        }
      }
    } else if (obs.type === ObstacleType.ORBIT_BLOCKER) {
      // Blocker sits on orbit — only dangerous during active phase
      const fadeIn = 0.3;
      const fadeOut = 0.5;
      const active = obs.blockerAge >= fadeIn &&
                     obs.blockerAge <= obs.blockerLifetime - fadeOut;
      if (active) {
        const diff = Math.abs(angleDiff(player.angle, obs.blockerAngle));
        inDanger = diff < obs.blockerHalfArc + player.hitboxHalfArc;
      }
    } else if (obs.type === ObstacleType.PULSE_RING) {
      inDanger = true;
      for (let i = 0; i < obs.safeAngles.length; i++) {
        const diff = Math.abs(angleDiff(player.angle, obs.safeAngles[i]));
        if (diff < obs.safeHalfWidth + player.hitboxHalfArc) {
          inDanger = false;
          break;
        }
      }
    } else if (obs.type === ObstacleType.SWEEP_BEAM) {
      const diff = Math.abs(angleDiff(player.angle, obs.beamAngle));
      inDanger = diff < obs.beamHalfWidth + player.hitboxHalfArc;
    }

    if (inDanger) {
      if (isAtOrbit) {
        result = HitResult.HIT;
      } else if (isNearOrbit && result === HitResult.NONE) {
        result = HitResult.NEAR_MISS;
      }
    }
  });

  return result;
}
