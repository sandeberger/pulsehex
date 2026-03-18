"use strict";

// Chart for: space_debris (2).mod
// BPM ~125, Speed 6 → one row ≈ 120ms
// Handcurated obstacle timeline with all obstacle families

export const track01 = {
  modFile: '/mods/space_debris (2).mod',
  bpmRef: 125,
  spawnLeadBeats: 6,
  events: [
    // === Intro (gentle warmup — single gaps only) ===
    { beat: 16,  pattern: 'gap-wall-single' },
    { beat: 32,  pattern: 'gap-wall-single' },
    { beat: 48,  pattern: 'gap-wall-single' },
    { beat: 60,  pattern: 'gap-wall-double' },

    // === Section A (introduce new families gradually) ===
    { beat: 72,  pattern: 'gap-wall-single' },
    { beat: 80,  pattern: 'rotating-gate-slow' },       // first rotating gate
    { beat: 88,  pattern: 'pulse-ring-easy' },
    { beat: 96,  pattern: 'gap-wall-double' },
    { beat: 102, pattern: 'alt-lane-A' },                // alternating lanes intro
    { beat: 104, pattern: 'alt-lane-B' },
    { beat: 112, pattern: 'sweep-beam-slow' },
    { beat: 120, pattern: 'rotating-gate-slow' },
    { beat: 128, pattern: 'pulse-ring-easy' },

    // === Section B (main groove — full mix) ===
    { beat: 136, pattern: 'gap-wall-double' },
    { beat: 142, pattern: 'rotating-gate-fast' },        // faster rotation
    { beat: 148, pattern: 'sweep-beam-slow' },
    { beat: 154, pattern: 'orbit-blocker-short' },       // first orbit blocker
    { beat: 156, pattern: 'gap-wall-narrow' },
    { beat: 162, pattern: 'alt-lane-A' },                // alternating lane sequence
    { beat: 164, pattern: 'alt-lane-B' },
    { beat: 166, pattern: 'alt-lane-A' },
    { beat: 168, pattern: 'double-wall-offset' },        // paired walls
    { beat: 176, pattern: 'gap-wall-single' },
    { beat: 182, pattern: 'sweep-beam-fast' },
    { beat: 188, pattern: 'rotating-gate-reverse' },     // counter-clockwise gate
    { beat: 196, pattern: 'pulse-ring-hard' },

    // === Section C (peak — pressure + all types) ===
    { beat: 204, pattern: 'pressure-wall' },             // first pressure pattern
    { beat: 210, pattern: 'sweep-beam-fast' },
    { beat: 214, pattern: 'orbit-blocker-wide' },        // wide blocker
    { beat: 216, pattern: 'rotating-gate-fast' },
    { beat: 220, pattern: 'gap-wall-narrow' },
    { beat: 224, pattern: 'alt-lane-B' },
    { beat: 226, pattern: 'alt-lane-A' },
    { beat: 228, pattern: 'alt-lane-B' },
    { beat: 232, pattern: 'pressure-ring' },             // pressure pulse ring
    { beat: 236, pattern: 'double-wall-offset' },
    { beat: 240, pattern: 'rotating-gate-reverse' },
    { beat: 244, pattern: 'gap-wall-narrow' },
    { beat: 248, pattern: 'pulse-ring-hard' },
    // Spiral sequence: drives player clockwise over 5 beats
    { beat: 252, macro: 'spiral', direction: 1, steps: 5, beatInterval: 2, stepAngle: 0.7 },
    { beat: 264, pattern: 'sweep-beam-slow' },

    // === Section D (outro / cooldown loop) ===
    { beat: 276, pattern: 'gap-wall-double' },
    { beat: 284, pattern: 'rotating-gate-slow' },
    { beat: 292, pattern: 'pulse-ring-easy' },
    { beat: 300, pattern: 'gap-wall-single' },
    { beat: 308, pattern: 'alt-lane-A' },
    { beat: 310, pattern: 'alt-lane-B' },
    { beat: 318, pattern: 'sweep-beam-slow' },
    { beat: 326, pattern: 'gap-wall-double' },
    { beat: 334, pattern: 'rotating-gate-slow' },
    { beat: 342, pattern: 'pulse-ring-easy' },
    { beat: 350, pattern: 'gap-wall-single' },
    { beat: 360, pattern: 'gap-wall-single' },
    { beat: 370, pattern: 'sweep-beam-slow' },
    { beat: 380, pattern: 'gap-wall-double' },
    { beat: 390, pattern: 'rotating-gate-slow' },
    { beat: 400, pattern: 'gap-wall-single' },
  ]
};
