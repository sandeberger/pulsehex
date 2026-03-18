"use strict";

/**
 * Difficulty presets. Each parameter scales a different aspect of gameplay.
 *
 * gapScale       — multiplier on all gap/safe half-widths (bigger = easier)
 * spawnLeadBeats — beats for obstacle to travel outer→orbit (more = easier)
 * intervalScale  — multiplier on beat spacing between spawns (bigger = easier)
 * maxTier        — highest pattern tier used by auto-generator (1–4)
 * hitboxHalfArc  — player collision half-arc (smaller = more forgiving)
 * speedEaseMin   — obstacle speed ratio at outer edge (lower = slower start)
 * minSpacing     — minimum beats between obstacles
 */

export const EASY = {
  id: 'easy',
  label: 'EASY',
  gapScale:       1.45,
  spawnLeadBeats: 8,
  intervalScale:  1.6,
  maxTier:        2,
  hitboxHalfArc:  0.035,
  speedEaseMin:   0.15,
  minSpacing:     6,
};

export const NORMAL = {
  id: 'normal',
  label: 'NORMAL',
  gapScale:       1.2,
  spawnLeadBeats: 7,
  intervalScale:  1.25,
  maxTier:        3,
  hitboxHalfArc:  0.045,
  speedEaseMin:   0.20,
  minSpacing:     5,
};

export const HARD = {
  id: 'hard',
  label: 'HARD',
  gapScale:       1.0,
  spawnLeadBeats: 6,
  intervalScale:  1.0,
  maxTier:        4,
  hitboxHalfArc:  0.05,
  speedEaseMin:   0.25,
  minSpacing:     4,
};

export const PRESETS = [EASY, NORMAL, HARD];

/** Active difficulty — modules read from this at runtime */
export let current = NORMAL;

export function setDifficulty(preset) {
  current = preset;
}
