"use strict";

import { current as difficulty } from './difficulty.js';

/**
 * Auto-generates a playable chart from SongAnalyzer output.
 * Reads difficulty.intervalScale and difficulty.maxTier at generation time.
 */

// --- Pattern tiers (easiest → hardest) ---

const TIERS = [
  /* 1 */ [
    'gap-wall-single',
    'gap-wall-single',
    'pulse-ring-easy',
  ],
  /* 2 */ [
    'gap-wall-double',
    'rotating-gate-slow',
    'sweep-beam-slow',
    'pulse-ring-easy',
  ],
  /* 3 */ [
    'gap-wall-narrow',
    'rotating-gate-fast',
    'double-wall-offset',
    'orbit-blocker-short',
    'sweep-beam-slow',
  ],
  /* 4 */ [
    'rotating-gate-reverse',
    'sweep-beam-fast',
    'pulse-ring-hard',
    'orbit-blocker-wide',
    'pressure-wall',
    'rotating-gate-fast',
  ],
];

// Alternating lane pairs — injected as two events
const ALT_LANE_PAIR = ['alt-lane-A', 'alt-lane-B'];

// Section intensity thresholds (on the normalized 0–1 energy)
const QUIET_MAX   = 0.20;
const GROOVE_MAX  = 0.45;
const BUILD_MAX   = 0.70;

// Base beat intervals per intensity
const INTERVAL_QUIET  = 16;
const INTERVAL_GROOVE = 10;
const INTERVAL_BUILD  = 7;
const INTERVAL_PEAK   = 5;

// Smoothing window for energy (in rows)
const SMOOTH_WINDOW = 16;

// --- Helpers ---

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function smoothEnergy(raw, window) {
  const out = new Float32Array(raw.length);
  const half = Math.floor(window / 2);
  for (let i = 0; i < raw.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < raw.length) {
        sum += raw[j];
        count++;
      }
    }
    out[i] = sum / count;
  }
  return out;
}

function normalizeEnergy(arr) {
  let max = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  if (max === 0) return arr;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    out[i] = arr[i] / max;
  }
  return out;
}

function classifyEnergy(e) {
  if (e <= QUIET_MAX)  return 'quiet';
  if (e <= GROOVE_MAX) return 'groove';
  if (e <= BUILD_MAX)  return 'build';
  return 'peak';
}

function intervalForClass(cls) {
  const scale = difficulty.intervalScale || 1;
  switch (cls) {
    case 'quiet':  return Math.round(INTERVAL_QUIET  * scale);
    case 'groove': return Math.round(INTERVAL_GROOVE * scale);
    case 'build':  return Math.round(INTERVAL_BUILD  * scale);
    case 'peak':   return Math.round(INTERVAL_PEAK   * scale);
    default:       return Math.round(INTERVAL_GROOVE * scale);
  }
}

function tierForClass(cls) {
  const max = Math.min(difficulty.maxTier || 4, TIERS.length);
  let tierIdx;
  switch (cls) {
    case 'quiet':  tierIdx = 0; break;
    case 'groove': tierIdx = 1; break;
    case 'build':  tierIdx = 2; break;
    case 'peak':   tierIdx = 3; break;
    default:       tierIdx = 1;
  }
  // Clamp to the max tier allowed by difficulty
  tierIdx = Math.min(tierIdx, max - 1);
  return TIERS[tierIdx];
}

// --- Generator ---

export function generateChart(profile, modFile) {
  const leadBeats = difficulty.spawnLeadBeats || 6;
  const minSpacing = difficulty.minSpacing || 4;

  if (!profile || !profile.energyCurve || profile.energyCurve.length === 0) {
    return { modFile, bpmRef: 125, spawnLeadBeats: leadBeats, events: [] };
  }

  const raw = profile.energyCurve;
  const smoothed = smoothEnergy(raw, SMOOTH_WINDOW);
  const energy = normalizeEnergy(smoothed);
  const totalRows = energy.length;

  const events = [];
  let lastBeat = -minSpacing;
  let spiralCooldown = 0;
  let altLaneCooldown = 0;

  // Skip the first 8 rows (let music establish)
  const startRow = Math.min(8, Math.floor(totalRows * 0.02));

  let beat = startRow;

  while (beat < totalRows) {
    const e = energy[Math.min(beat, energy.length - 1)];
    const cls = classifyEnergy(e);
    const interval = intervalForClass(cls);

    // Enforce minimum spacing
    if (beat - lastBeat < minSpacing) {
      beat++;
      continue;
    }

    // Decide what to spawn
    let pattern = null;
    let extraEvents = null;

    // Occasional alt-lane pair during groove/build
    if (altLaneCooldown <= 0 && (cls === 'groove' || cls === 'build') && Math.random() < 0.15) {
      extraEvents = [
        { beat: beat, pattern: ALT_LANE_PAIR[0] },
        { beat: beat + 2, pattern: ALT_LANE_PAIR[1] },
      ];
      altLaneCooldown = 30;
    }
    // Occasional spiral during build/peak
    else if (spiralCooldown <= 0 && (cls === 'build' || cls === 'peak') && Math.random() < 0.10) {
      events.push({
        beat: beat,
        macro: 'spiral',
        direction: Math.random() < 0.5 ? 1 : -1,
        steps: cls === 'peak' ? 5 : 4,
        beatInterval: cls === 'peak' ? 2 : 3,
        stepAngle: 0.7
      });
      spiralCooldown = 40;
      lastBeat = beat;
      beat += interval;
      continue;
    }
    // Normal pattern from tier
    else {
      pattern = pick(tierForClass(cls));
    }

    if (extraEvents) {
      for (const ev of extraEvents) {
        events.push(ev);
      }
      lastBeat = extraEvents[extraEvents.length - 1].beat;
    } else if (pattern) {
      events.push({ beat, pattern });
      lastBeat = beat;
    }

    spiralCooldown -= interval;
    altLaneCooldown -= interval;

    // Advance by interval (with slight random jitter for musicality)
    const jitter = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
    beat += Math.max(minSpacing, interval + jitter);
  }

  // Sort by beat (alt-lane pairs and spirals may have shifted things)
  events.sort((a, b) => a.beat - b.beat);

  return {
    modFile: modFile || '',
    bpmRef: 125,
    spawnLeadBeats: leadBeats,
    events
  };
}
