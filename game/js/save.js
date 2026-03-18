"use strict";

/**
 * Persistent highscore storage via localStorage.
 * Key format: pulsehex_{trackId}_{difficultyId}
 */

const PREFIX = 'pulsehex_';

function key(trackId, diffId) {
  return PREFIX + trackId + '_' + diffId;
}

function load(k) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch(e) {
    return null;
  }
}

function store(k, data) {
  try {
    localStorage.setItem(k, JSON.stringify(data));
  } catch(e) {}
}

export const Save = {
  /**
   * Get saved data for a track + difficulty.
   * Returns { bestScore, bestNearMiss, plays } or null.
   */
  get(trackId, diffId) {
    return load(key(trackId, diffId));
  },

  /**
   * Submit a run result. Returns true if it's a new best score.
   */
  submit(trackId, diffId, finalScore, nearMissCount) {
    const k = key(trackId, diffId);
    const existing = load(k) || { bestScore: 0, bestNearMiss: 0, plays: 0 };

    existing.plays++;
    const isNewBest = finalScore > existing.bestScore;

    if (isNewBest) {
      existing.bestScore = Math.floor(finalScore);
      existing.bestNearMiss = nearMissCount;
    }

    store(k, existing);
    return isNewBest;
  },

  /**
   * Get best score for a track across all difficulties.
   * Returns { score, diffId } or null.
   */
  getBestForTrack(trackId, diffIds) {
    let best = null;
    for (const d of diffIds) {
      const data = load(key(trackId, d));
      if (data && data.bestScore > 0) {
        if (!best || data.bestScore > best.score) {
          best = { score: data.bestScore, diffId: d };
        }
      }
    }
    return best;
  }
};
