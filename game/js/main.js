"use strict";

import { clamp } from './math.js';
import { ModAdapter } from './mod-adapter.js';
import { SongAnalyzer } from './song-analyzer.js';
import { Viewport } from './viewport.js';
import { Input } from './input.js';
import { Arena } from './arena.js';
import { Player } from './player.js';
import { ObstaclePool } from './obstacles.js';
import { Spawner } from './spawner.js';
import { checkCollisions, HitResult } from './collision.js';
import { Renderer } from './renderer.js';
import { Palette } from './palette.js';
import { Effects } from './effects.js';
import { Score } from './score.js';
import { tracks } from './tracks.js';
import { generateChart } from './chart-generator.js';

// --- Constants ---
const FIXED_DT = 1 / 120; // 120 Hz logic
const MAX_FRAME_DT = 0.05; // 50ms cap
const DEAD_DURATION = 0.8;

// --- State machine ---
const State = {
  MENU: 'MENU',
  TRACK_SELECT: 'TRACK_SELECT',
  LOADING: 'LOADING',
  PLAYING: 'PLAYING',
  DEAD: 'DEAD',
  RESULT: 'RESULT'
};

// --- Game globals ---
let state = State.MENU;
let canvas, viewport, input, arena, player, pool, adapter, spawner;
let renderer, palette, effects, score, analyzer;
let accumulator = 0;
let lastTime = 0;
let deadTimer = 0;
let sectionIdx = 0;
let profile = null;
let selectedTrackIdx = 0;

// --- Bootstrap ---
window.addEventListener('DOMContentLoaded', init);

function init() {
  canvas = document.getElementById('gameCanvas');
  viewport = new Viewport(canvas);
  input = new Input(viewport);
  arena = new Arena();
  arena.updateFromViewport(viewport);
  player = new Player();
  pool = new ObstaclePool();
  palette = new Palette();
  effects = new Effects();
  score = new Score();
  adapter = new ModAdapter();
  spawner = new Spawner(pool, arena, adapter, player);
  renderer = new Renderer(canvas, viewport, arena, palette, effects);
  analyzer = new SongAnalyzer();

  // Listen to resize
  window.addEventListener('resize', () => arena.updateFromViewport(viewport));

  // Listen for pattern changes to switch palette sections
  adapter.on('patternChange', () => {
    sectionIdx++;
    palette.setSection(sectionIdx);
    score.addSectionClear();
  });

  // Beat pulse on each row
  adapter.on('row', () => {
    effects.triggerBeat();
  });

  // Input handlers
  window.addEventListener('keydown', onKeyAction);
  window.addEventListener('touchstart', onTapAction, { passive: false });
  window.addEventListener('click', onTapAction);

  // Kick off loop
  lastTime = performance.now() / 1000;
  requestAnimationFrame(frame);
}

// --- Input handling per state ---

function onKeyAction(e) {
  if (state === State.MENU) {
    e.preventDefault();
    state = State.TRACK_SELECT;
  } else if (state === State.TRACK_SELECT) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      selectedTrackIdx = (selectedTrackIdx - 1 + tracks.length) % tracks.length;
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      selectedTrackIdx = (selectedTrackIdx + 1) % tracks.length;
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      startLoading(tracks[selectedTrackIdx]);
    }
  } else if (state === State.RESULT) {
    if (e.code === 'Escape' || e.code === 'KeyQ') {
      e.preventDefault();
      state = State.TRACK_SELECT;
    } else {
      e.preventDefault();
      restartGame();
    }
  }
}

function onTapAction(e) {
  if (state === State.MENU) {
    e.preventDefault();
    state = State.TRACK_SELECT;
  } else if (state === State.TRACK_SELECT) {
    e.preventDefault();
    handleTrackSelectTap(e);
  } else if (state === State.RESULT) {
    e.preventDefault();
    restartGame();
  }
}

function handleTrackSelectTap(e) {
  // Figure out which track was tapped based on Y position
  const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
  const h = viewport.height;
  const listTop = h * 0.25;
  const rowHeight = h * 0.10;

  const idx = Math.floor((y - listTop) / rowHeight);
  if (idx >= 0 && idx < tracks.length) {
    selectedTrackIdx = idx;
    startLoading(tracks[selectedTrackIdx]);
  }
}

// --- Loading ---

let currentTrack = null;

async function startLoading(track) {
  state = State.LOADING;
  currentTrack = track;
  try {
    await adapter.init();
    await adapter.loadFromUrl(track.modFile);

    // Pre-analyze
    profile = analyzer.analyze(adapter.mod);

    // Use handcoded chart if available, otherwise auto-generate
    const chart = track.chart || generateChart(profile, track.modFile);
    spawner.loadChart(chart);

    state = State.PLAYING;
    adapter.play();
  } catch (err) {
    console.error('Failed to load MOD:', err);
    state = State.TRACK_SELECT;
  }
}

function restartGame() {
  player.reset();
  pool.releaseAll();
  spawner.reset();
  score.reset();
  effects.shatterParticles.length = 0;
  effects.shakeTime = 0;
  sectionIdx = 0;
  palette.setSection(0);
  deadTimer = 0;
  adapter.restart();
  state = State.PLAYING;
}

// --- Main loop ---
function frame(timestamp) {
  const now = timestamp / 1000;
  let dt = clamp(now - lastTime, 0, MAX_FRAME_DT);
  lastTime = now;

  accumulator += dt;

  // Fixed-step update
  while (accumulator >= FIXED_DT) {
    input.poll();
    update(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  // Render with interpolation alpha
  const alpha = accumulator / FIXED_DT;
  render(alpha);

  requestAnimationFrame(frame);
}

function update(dt) {
  palette.update(dt);
  effects.update(dt);

  if (state === State.PLAYING) {
    player.update(dt, input.direction);
    pool.updateAll(dt, arena.killRadius, arena.orbitRadius);
    score.update(dt);

    // Collision
    const hit = checkCollisions(player, pool, arena.orbitRadius);
    if (hit === HitResult.HIT) {
      die();
    } else if (hit === HitResult.NEAR_MISS) {
      score.addNearMiss();
      effects.triggerNearMiss();
    }
  } else if (state === State.DEAD) {
    deadTimer += dt;
    if (deadTimer >= DEAD_DURATION && !effects.isShatterActive) {
      state = State.RESULT;
    }
  }
}

function die() {
  state = State.DEAD;
  player.alive = false;
  deadTimer = 0;
  adapter.stop();

  const px = arena.centerX + Math.cos(player.angle) * arena.orbitRadius;
  const py = arena.centerY + Math.sin(player.angle) * arena.orbitRadius;
  effects.triggerDeath(px, py);
}

function render(alpha) {
  renderer.draw(state, player, pool, score, alpha, { tracks, selectedTrackIdx, currentTrack });
}
