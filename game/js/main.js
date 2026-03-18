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
import { track01 } from './charts/track01.js';

// --- Constants ---
const FIXED_DT = 1 / 120; // 120 Hz logic
const MAX_FRAME_DT = 0.05; // 50ms cap
const DEAD_DURATION = 0.8;
const RESULT_DELAY = 0.6;

// --- State machine ---
const State = { MENU: 'MENU', LOADING: 'LOADING', PLAYING: 'PLAYING', DEAD: 'DEAD', RESULT: 'RESULT' };

// --- Game globals ---
let state = State.MENU;
let canvas, viewport, input, arena, player, pool, adapter, spawner;
let renderer, palette, effects, score, analyzer;
let accumulator = 0;
let lastTime = 0;
let deadTimer = 0;
let sectionIdx = 0;
let profile = null;

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
  adapter.on('patternChange', (data) => {
    sectionIdx++;
    palette.setSection(sectionIdx);
    score.addSectionClear();
  });

  // Beat pulse on each row
  adapter.on('row', () => {
    effects.triggerBeat();
  });

  // Song end → keep playing (loop)
  adapter.on('songEnd', () => {
    // Song loops automatically in the player
  });

  // Start/restart on input
  window.addEventListener('keydown', onAction);
  window.addEventListener('touchstart', onAction, { passive: false });
  window.addEventListener('click', onAction);

  // Kick off loop
  lastTime = performance.now() / 1000;
  requestAnimationFrame(frame);
}

function onAction(e) {
  if (state === State.MENU) {
    e.preventDefault();
    startLoading();
  } else if (state === State.RESULT) {
    e.preventDefault();
    restartGame();
  }
}

async function startLoading() {
  state = State.LOADING;
  try {
    await adapter.init();
    await adapter.loadFromUrl(track01.modFile);

    // Pre-analyze
    profile = analyzer.analyze(adapter.mod);

    spawner.loadChart(track01);
    state = State.PLAYING;
    adapter.play();
  } catch (err) {
    console.error('Failed to load MOD:', err);
    state = State.MENU;
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
  renderer.draw(state, player, pool, score, alpha);
}
