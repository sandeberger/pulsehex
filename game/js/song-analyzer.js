"use strict";

export class SongAnalyzer {
  analyze(mod) {
    if (!mod) return null;

    const rowTimings = [];
    const sections = [];
    const energyCurve = [];

    let speed = 6;
    let bpm = 125;
    let orderIdx = 0;
    let row = 0;
    let time = 0;
    let lastPatternIdx = -1;
    let totalRows = 0;
    const maxRows = mod.songLen * 64;

    while (orderIdx < mod.songLen && totalRows < maxRows) {
      const pi = mod.patternOrder[orderIdx];
      const pat = mod.patterns[pi];

      if (pi !== lastPatternIdx) {
        sections.push({ order: orderIdx, pattern: pi, startTime: time, startRow: totalRows });
        lastPatternIdx = pi;
      }

      if (pat && pat[row]) {
        let noteOns = 0;
        let volSum = 0;

        for (const note of pat[row]) {
          // Check for speed/bpm changes
          if (note.effect === 0xF) {
            if (note.param < 32) speed = note.param || 1;
            else bpm = note.param;
          }

          // Count note activity
          if (note.period > 0 && note.sample > 0) {
            noteOns++;
            const smp = mod.samples[note.sample - 1];
            volSum += smp ? smp.vol : 64;
          }
        }

        const tickDuration = 2.5 / bpm;
        const rowDuration = tickDuration * speed;

        rowTimings.push({ order: orderIdx, row, time, duration: rowDuration });
        energyCurve.push(noteOns * (volSum / Math.max(1, noteOns)) / 64);

        time += rowDuration;
      }

      // Advance
      let doBreak = false;
      let nextOrd = orderIdx;
      let nextRow = row + 1;

      if (pat && pat[row]) {
        for (const note of pat[row]) {
          if (note.effect === 0xD) {
            doBreak = true;
            nextRow = (note.param >> 4) * 10 + (note.param & 0x0F);
            nextOrd = orderIdx + 1;
          }
          if (note.effect === 0xB) {
            doBreak = true;
            nextOrd = note.param;
            nextRow = 0;
          }
        }
      }

      if (doBreak) {
        orderIdx = nextOrd;
        row = nextRow;
      } else {
        row++;
        if (row >= 64) { row = 0; orderIdx++; }
      }

      totalRows++;
    }

    return {
      rowTimings,
      sections,
      energyCurve,
      durationMs: time * 1000
    };
  }
}
