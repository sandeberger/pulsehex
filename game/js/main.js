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
import { PRESETS, current as difficulty, setDifficulty } from './difficulty.js';
import { Haptics } from './haptics.js';
import { Save } from './save.js';

// --- Constants ---
const FIXED_DT = 1 / 120;
const MAX_FRAME_DT = 0.05;
const DEAD_DURATION = 0.8;

// --- State machine ---
const State = {
  MENU: 'MENU',
  TRACK_SELECT: 'TRACK_SELECT',
  LOADING: 'LOADING',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
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
let selectedDiffIdx = 1;
let currentTrack = null;
let isNewBest = false;

// --- Bootstrap ---
window.addEventListener('DOMContentLoaded', init);

function init() {
  Haptics.init();

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

  window.addEventListener('resize', () => arena.updateFromViewport(viewport));

  // Music events → gameplay + haptics
  adapter.on('patternChange', () => {
    sectionIdx++;
    palette.setSection(sectionIdx);
    score.addSectionClear();
    Haptics.sectionClear();
  });

  adapter.on('row', () => {
    effects.triggerBeat();
    Haptics.beat();
  });

  // Input handlers
  window.addEventListener('keydown', onKeyAction);
  window.addEventListener('touchstart', onTapAction, { passive: false });
  window.addEventListener('click', onTapAction);

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
      Haptics.uiTap();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      selectedTrackIdx = (selectedTrackIdx + 1) % tracks.length;
      Haptics.uiTap();
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      selectedDiffIdx = (selectedDiffIdx - 1 + PRESETS.length) % PRESETS.length;
      setDifficulty(PRESETS[selectedDiffIdx]);
      Haptics.uiTap();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      selectedDiffIdx = (selectedDiffIdx + 1) % PRESETS.length;
      setDifficulty(PRESETS[selectedDiffIdx]);
      Haptics.uiTap();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      startLoading(tracks[selectedTrackIdx]);
    }

  } else if (state === State.PLAYING) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      pause();
    }

  } else if (state === State.PAUSED) {
    e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyQ') {
      quitToSelect();
    } else {
      resume();
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
  } else if (state === State.PAUSED) {
    e.preventDefault();
    // Top 20% of screen = quit, rest = resume
    const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    if (y < viewport.height * 0.3) {
      quitToSelect();
    } else {
      resume();
    }
  } else if (state === State.RESULT) {
    e.preventDefault();
    restartGame();
  }
}

function handleTrackSelectTap(e) {
  const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
  const x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  const h = viewport.height;
  const w = viewport.width;

  if (y < h * 0.22) {
    const zone = Math.floor(x / (w / 3));
    if (zone >= 0 && zone < PRESETS.length) {
      selectedDiffIdx = zone;
      setDifficulty(PRESETS[selectedDiffIdx]);
      Haptics.uiTap();
    }
    return;
  }

  const listTop = h * 0.25;
  const rowHeight = h * 0.10;
  const idx = Math.floor((y - listTop) / rowHeight);
  if (idx >= 0 && idx < tracks.length) {
    selectedTrackIdx = idx;
    startLoading(tracks[selectedTrackIdx]);
  }
}

// --- Pause / Resume ---

function pause() {
  if (state !== State.PLAYING) return;
  state = State.PAUSED;
  adapter.stop();
}

function resume() {
  if (state !== State.PAUSED) return;
  state = State.PLAYING;
  adapter.play();
  lastTime = performance.now() / 1000;
  accumulator = 0;
}

function quitToSelect() {
  adapter.stop();
  player.reset();
  pool.releaseAll();
  spawner.reset();
  score.reset();
  effects.shatterParticles.length = 0;
  effects.shakeTime = 0;
  sectionIdx = 0;
  palette.setSection(0);
  state = State.TRACK_SELECT;
}

// --- Loading ---

async function startLoading(track) {
  state = State.LOADING;
  currentTrack = track;
  isNewBest = false;
  try {
    await adapter.init();
    await adapter.loadFromUrl(track.modFile);

    profile = analyzer.analyze(adapter.mod);

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
  isNewBest = false;
  adapter.restart();
  state = State.PLAYING;
}

// --- Main loop ---
function frame(timestamp) {
  const now = timestamp / 1000;
  let dt = clamp(now - lastTime, 0, MAX_FRAME_DT);
  lastTime = now;

  accumulator += dt;

  while (accumulator >= FIXED_DT) {
    input.poll();
    update(FIXED_DT);
    accumulator -= FIXED_DT;
  }

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

    const hit = checkCollisions(player, pool, arena.orbitRadius);
    if (hit === HitResult.HIT) {
      die();
    } else if (hit === HitResult.NEAR_MISS) {
      score.addNearMiss();
      effects.triggerNearMiss();
      Haptics.nearMiss();
    }
  } else if (state === State.DEAD) {
    deadTimer += dt;
    if (deadTimer >= DEAD_DURATION && !effects.isShatterActive) {
      // Submit score and transition to result
      if (currentTrack) {
        isNewBest = Save.submit(
          currentTrack.id, difficulty.id,
          score.current, score.nearMissCount
        );
      }
      state = State.RESULT;
    }
  }
}

function die() {
  state = State.DEAD;
  player.alive = false;
  deadTimer = 0;
  adapter.stop();
  Haptics.death();

  const px = arena.centerX + Math.cos(player.angle) * arena.orbitRadius;
  const py = arena.centerY + Math.sin(player.angle) * arena.orbitRadius;
  effects.triggerDeath(px, py);
}

function render(alpha) {
  const saved = currentTrack
    ? Save.get(currentTrack.id, difficulty.id)
    : null;

  renderer.draw(state, player, pool, score, alpha, {
    tracks, selectedTrackIdx, currentTrack,
    difficulty, selectedDiffIdx, presets: PRESETS,
    isNewBest, saved,
    diffIds: PRESETS.map(p => p.id)
  });
}
