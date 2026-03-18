"use strict";

import { TAU, lerpAngle } from './math.js';
import { ObstacleType } from './obstacles.js';

export class Renderer {
  constructor(canvas, viewport, arena, palette, effects) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d');
    this.viewport = viewport;
    this.arena = arena;
    this.palette = palette;
    this.effects = effects;
  }

  draw(state, player, pool, score, alpha, extras) {
    const c = this.ctx2d;
    const dpr = this.viewport.dpr;
    const w = this.viewport.width * dpr;
    const h = this.viewport.height * dpr;
    const cx = this.arena.centerX * dpr;
    const cy = this.arena.centerY * dpr;
    const pal = this.palette;

    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Apply screen shake
    if (this.effects.shakeTime > 0) {
      c.translate(this.effects.shakeX, this.effects.shakeY);
    }

    const acx = this.arena.centerX;
    const acy = this.arena.centerY;

    // === Layer 1: Background ===
    c.fillStyle = pal.rgb(pal.bg);
    c.fillRect(-20, -20, this.viewport.width + 40, this.viewport.height + 40);

    // Radial grid lines
    c.strokeStyle = pal.rgba(pal.ring, 0.15);
    c.lineWidth = 1;
    for (let i = 0; i < this.arena.polygonSides; i++) {
      const a = this.arena.polygonVertexAngles[i];
      c.beginPath();
      c.moveTo(acx, acy);
      c.lineTo(acx + Math.cos(a) * this.arena.outerRadius, acy + Math.sin(a) * this.arena.outerRadius);
      c.stroke();
    }

    // Center hub with beat pulse
    const hubRadius = this.arena.innerRadius * (1 + this.effects.beatPulse);
    c.beginPath();
    c.arc(acx, acy, hubRadius, 0, TAU);
    c.fillStyle = pal.rgba(pal.glow, 0.15);
    c.fill();
    c.strokeStyle = pal.rgba(pal.glow, 0.4);
    c.lineWidth = 1.5;
    c.stroke();

    // Orbit ring
    c.beginPath();
    c.arc(acx, acy, this.arena.orbitRadius, 0, TAU);
    c.strokeStyle = pal.rgba(pal.ring, 0.35);
    c.lineWidth = 1.5;
    c.stroke();

    // === Layer 2: Gameplay ===

    // Obstacles
    pool.forEachActive(obs => {
      this._drawObstacle(c, acx, acy, obs, pal);
    });

    // Player trail
    for (let i = 0; i < player.trail.length; i++) {
      const t = player.trail[i];
      if (t.alpha <= 0) continue;
      const tx = acx + Math.cos(t.angle) * this.arena.orbitRadius;
      const ty = acy + Math.sin(t.angle) * this.arena.orbitRadius;
      c.beginPath();
      c.arc(tx, ty, 3, 0, TAU);
      c.fillStyle = pal.rgba(pal.player, t.alpha * 0.5);
      c.fill();
    }

    // Player avatar (diamond shape)
    if (player.alive) {
      const pa = lerpAngle(player.prevAngle, player.angle, alpha);
      const px = acx + Math.cos(pa) * this.arena.orbitRadius;
      const py = acy + Math.sin(pa) * this.arena.orbitRadius;
      const size = 10;

      // Glow
      c.beginPath();
      c.arc(px, py, size * 1.8, 0, TAU);
      c.fillStyle = pal.rgba(pal.player, 0.2);
      c.fill();

      // Diamond
      c.save();
      c.translate(px, py);
      c.rotate(pa + Math.PI / 2);
      c.beginPath();
      c.moveTo(0, -size);
      c.lineTo(size * 0.6, 0);
      c.lineTo(0, size * 0.7);
      c.lineTo(-size * 0.6, 0);
      c.closePath();
      c.fillStyle = pal.rgb(pal.player);
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 1.5;
      c.stroke();
      c.restore();
    }

    // Shatter particles
    for (const p of this.effects.shatterParticles) {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.beginPath();
      c.moveTo(0, -p.size / 2);
      c.lineTo(p.size / 2, p.size / 2);
      c.lineTo(-p.size / 2, p.size / 2);
      c.closePath();
      c.fillStyle = pal.rgba(pal.player, p.alpha);
      c.fill();
      c.restore();
    }

    // Near-miss flash
    if (this.effects.nearMissFlash > 0) {
      c.fillStyle = `rgba(255,255,255,${this.effects.nearMissFlash * 8})`;
      c.fillRect(0, 0, this.viewport.width, this.viewport.height);
    }

    // === Layer 3: UI Overlays ===
    this._drawUI(c, state, score, extras);

    c.restore();
  }

  _drawObstacle(c, cx, cy, obs, pal) {
    const blur = obs.pressure ? 16 : 8;
    c.lineWidth = obs.thickness || 6;

    if (obs.type === ObstacleType.GAP_WALL) {
      c.strokeStyle = pal.rgb(pal.obstacle);
      c.shadowColor = pal.rgb(pal.glow);
      c.shadowBlur = blur;

      const gapArcs = this._getGapArcs(obs.gapAngles, obs.gapHalfWidth);
      for (const arc of gapArcs) {
        c.beginPath();
        c.arc(cx, cy, obs.radius, arc.start, arc.end);
        c.stroke();
      }
      c.shadowBlur = 0;

    } else if (obs.type === ObstacleType.ROTATING_GATE) {
      // Same as GAP_WALL but with a different color tint to telegraph rotation
      c.strokeStyle = pal.rgba([255, 180, 80], 0.9);
      c.shadowColor = pal.rgb([255, 140, 40]);
      c.shadowBlur = blur;

      const gapArcs = this._getGapArcs(obs.gapAngles, obs.gapHalfWidth);
      for (const arc of gapArcs) {
        c.beginPath();
        c.arc(cx, cy, obs.radius, arc.start, arc.end);
        c.stroke();
      }

      // Draw chevrons near each gap to show rotation direction
      const chevronDir = obs.gateRotationSpeed > 0 ? 1 : -1;
      for (let i = 0; i < obs.gapAngles.length; i++) {
        const ga = obs.gapAngles[i];
        for (let side = -1; side <= 1; side += 2) {
          const ca = ga + side * (obs.gapHalfWidth + 0.08);
          const gx = cx + Math.cos(ca) * obs.radius;
          const gy = cy + Math.sin(ca) * obs.radius;
          c.save();
          c.translate(gx, gy);
          c.rotate(ca + Math.PI / 2);
          c.fillStyle = pal.rgba([255, 200, 100], 0.7);
          c.beginPath();
          c.moveTo(0, -4 * chevronDir);
          c.lineTo(4, 4 * chevronDir);
          c.lineTo(-4, 4 * chevronDir);
          c.closePath();
          c.fill();
          c.restore();
        }
      }
      c.shadowBlur = 0;

    } else if (obs.type === ObstacleType.ORBIT_BLOCKER) {
      // Thick arc on the orbit ring with fade in/out
      const fadeIn = 0.3;
      const fadeOut = 0.5;
      let alpha = 1;
      if (obs.blockerAge < fadeIn) {
        alpha = obs.blockerAge / fadeIn;
      } else if (obs.blockerAge > obs.blockerLifetime - fadeOut) {
        alpha = (obs.blockerLifetime - obs.blockerAge) / fadeOut;
      }
      alpha = Math.max(0, Math.min(1, alpha));

      c.strokeStyle = pal.rgba([255, 60, 60], alpha * 0.9);
      c.shadowColor = pal.rgba([255, 30, 30], alpha);
      c.shadowBlur = 12;
      c.lineWidth = 12;
      c.beginPath();
      c.arc(cx, cy, this.arena.orbitRadius,
            obs.blockerAngle - obs.blockerHalfArc,
            obs.blockerAngle + obs.blockerHalfArc);
      c.stroke();

      // Inner warning pulse
      const pulse = 0.5 + 0.5 * Math.sin(obs.blockerAge * 6);
      c.strokeStyle = pal.rgba([255, 100, 100], alpha * pulse * 0.4);
      c.lineWidth = 18;
      c.shadowBlur = 0;
      c.beginPath();
      c.arc(cx, cy, this.arena.orbitRadius,
            obs.blockerAngle - obs.blockerHalfArc,
            obs.blockerAngle + obs.blockerHalfArc);
      c.stroke();
      c.shadowBlur = 0;

    } else if (obs.type === ObstacleType.PULSE_RING) {
      const pulseAlpha = 0.5 + 0.5 * Math.sin(obs.pulsePhase);
      c.strokeStyle = pal.rgba(pal.obstacle, pulseAlpha);
      c.shadowColor = pal.rgb(pal.glow);
      c.shadowBlur = blur;

      const gapArcs = this._getGapArcs(obs.safeAngles, obs.safeHalfWidth);
      for (const arc of gapArcs) {
        c.beginPath();
        c.arc(cx, cy, obs.radius, arc.start, arc.end);
        c.stroke();
      }
      c.shadowBlur = 0;

    } else if (obs.type === ObstacleType.SWEEP_BEAM) {
      c.save();
      c.strokeStyle = pal.rgb(pal.obstacle);
      c.shadowColor = pal.rgb(pal.glow);
      c.shadowBlur = 10;
      c.lineWidth = 3;
      c.beginPath();
      const bx1 = cx + Math.cos(obs.beamAngle) * this.arena.innerRadius;
      const by1 = cy + Math.sin(obs.beamAngle) * this.arena.innerRadius;
      const bx2 = cx + Math.cos(obs.beamAngle) * this.arena.outerRadius;
      const by2 = cy + Math.sin(obs.beamAngle) * this.arena.outerRadius;
      c.moveTo(bx1, by1);
      c.lineTo(bx2, by2);
      c.stroke();
      c.shadowBlur = 0;
      c.restore();
    }

    // Pressure overlay: extra glow pass
    if (obs.pressure && obs.radius > 0) {
      c.save();
      c.strokeStyle = pal.rgba(pal.glow, 0.15);
      c.lineWidth = (obs.thickness || 6) + 10;
      c.shadowBlur = 0;
      c.beginPath();
      c.arc(cx, cy, obs.radius, 0, TAU);
      c.stroke();
      c.restore();
    }
  }

  _getGapArcs(gapAngles, gapHalfWidth) {
    // Build sorted list of gap zones, then return the arcs between them
    if (!gapAngles || gapAngles.length === 0) {
      return [{ start: 0, end: TAU }];
    }

    const gaps = gapAngles.map(a => ({
      start: a - gapHalfWidth,
      end: a + gapHalfWidth
    })).sort((a, b) => a.start - b.start);

    const arcs = [];
    let cursor = gaps[gaps.length - 1].end;
    for (const gap of gaps) {
      if (gap.start > cursor) {
        arcs.push({ start: cursor, end: gap.start });
      }
      cursor = gap.end;
    }
    // Wrap-around arc
    if (cursor < gaps[0].start + TAU) {
      arcs.push({ start: cursor, end: gaps[0].start + TAU });
    }

    return arcs;
  }

  _drawUI(c, state, score, extras) {
    const w = this.viewport.width;
    const h = this.viewport.height;
    const pal = this.palette;

    c.textAlign = 'center';
    c.textBaseline = 'middle';

    if (state === 'MENU') {
      c.font = 'bold 42px monospace';
      c.fillStyle = '#fff';
      c.fillText('PULSEHEX', w / 2, h * 0.3);

      c.font = '18px monospace';
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillText('TAP TO START', w / 2, h * 0.6);

      c.font = '13px monospace';
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillText('Touch / drag or arrow keys to steer', w / 2, h * 0.67);

    } else if (state === 'TRACK_SELECT') {
      this._drawTrackSelect(c, w, h, extras, pal);

    } else if (state === 'LOADING') {
      c.font = '20px monospace';
      c.fillStyle = '#fff';
      c.fillText('LOADING...', w / 2, h / 2);

    } else if (state === 'PLAYING') {
      c.font = 'bold 24px monospace';
      c.fillStyle = '#fff';
      c.fillText(Math.floor(score.displayScore).toString(), w / 2, 40);

      if (score.multiplier > 1) {
        c.font = '14px monospace';
        c.fillStyle = 'rgba(255,200,50,0.8)';
        c.fillText('x' + score.multiplier.toFixed(2), w / 2, 62);
      }

      // Track name small at bottom
      if (extras && extras.currentTrack) {
        c.font = '11px monospace';
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillText(extras.currentTrack.title, w / 2, h - 20);
      }

    } else if (state === 'DEAD') {
      c.font = 'bold 36px monospace';
      c.fillStyle = '#fff';
      c.fillText('GAME OVER', w / 2, h * 0.35);

    } else if (state === 'RESULT') {
      c.font = 'bold 36px monospace';
      c.fillStyle = '#fff';
      c.fillText('GAME OVER', w / 2, h * 0.3);

      c.font = 'bold 28px monospace';
      c.fillText(Math.floor(score.current).toString(), w / 2, h * 0.4);

      if (score.nearMissCount > 0) {
        c.font = '14px monospace';
        c.fillStyle = 'rgba(255,200,50,0.7)';
        c.fillText('Near misses: ' + score.nearMissCount, w / 2, h * 0.47);
      }

      c.font = '18px monospace';
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillText('TAP TO RETRY', w / 2, h * 0.55);

      c.font = '13px monospace';
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillText('ESC for track select', w / 2, h * 0.62);
    }
  }

  _drawTrackSelect(c, w, h, extras, pal) {
    if (!extras || !extras.tracks) return;
    const trackList = extras.tracks;
    const sel = extras.selectedTrackIdx || 0;

    // Title
    c.font = 'bold 28px monospace';
    c.fillStyle = '#fff';
    c.fillText('SELECT TRACK', w / 2, h * 0.12);

    // Difficulty stars helper
    const stars = (n) => '\u2605'.repeat(n) + '\u2606'.repeat(3 - n);

    // Track list
    const listTop = h * 0.25;
    const rowH = h * 0.10;

    for (let i = 0; i < trackList.length; i++) {
      const t = trackList[i];
      const y = listTop + i * rowH;
      const isSelected = i === sel;

      // Selection highlight
      if (isSelected) {
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(w * 0.05, y - rowH * 0.4, w * 0.9, rowH * 0.85);

        // Side indicator
        c.fillStyle = pal.rgb(pal.player);
        c.fillRect(w * 0.05, y - rowH * 0.4, 3, rowH * 0.85);
      }

      // Track title
      c.textAlign = 'left';
      c.font = isSelected ? 'bold 16px monospace' : '15px monospace';
      c.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.6)';
      c.fillText(t.title, w * 0.10, y - 4);

      // Mood + difficulty
      c.font = '11px monospace';
      c.fillStyle = isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)';
      c.fillText(t.mood + '  ' + stars(t.difficulty), w * 0.10, y + 14);

      // Auto/curated badge
      c.textAlign = 'right';
      c.font = '10px monospace';
      c.fillStyle = t.chart
        ? 'rgba(100,255,150,0.5)'
        : 'rgba(255,200,80,0.5)';
      c.fillText(t.chart ? 'CURATED' : 'AUTO', w * 0.92, y - 4);

      c.textAlign = 'center';
    }

    // Instructions
    c.textAlign = 'center';
    c.font = '13px monospace';
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillText('Tap track or UP/DOWN + ENTER', w / 2, h * 0.88);
  }
}
