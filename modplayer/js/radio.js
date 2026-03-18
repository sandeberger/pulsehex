"use strict";

import state from './state.js';
import { ModParser } from './mod-parser.js';
import { getRandomModule } from './mod-archive.js';
import { showStatus, uiUpdateSampleList, uiUpdateOrderList, uiUpdate, uiRenderPattern } from './ui.js';

const MAX_RETRIES = 5;
let active = false;
let retryCount = 0;

export function isActive() { return active; }

export function toggle() {
  if (active) stop(); else start();
}

export async function start() {
  active = true;
  retryCount = 0;
  updateButton();
  showStatus('RADIO ON', '#0f0');
  if (state.player) {
    state.player.onSongEnd = () => next();
  }
  await next();
}

export function stop() {
  active = false;
  retryCount = 0;
  if (state.player) {
    state.player.onSongEnd = null;
    state.player.stop();
  }
  updateButton();
  showStatus('RADIO OFF', '#88bbee');
}

async function next() {
  if (!active) return;

  showStatus('RADIO: LOADING...', '#ff0');
  updateButton();

  try {
    const data = await getRandomModule();
    if (!data.modules.length) throw new Error('No module returned');

    const mod = data.modules[0];
    const url = mod.url || `https://api.modarchive.org/downloads.php?moduleid=${mod.id}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const parsed = new ModParser(await resp.arrayBuffer()).parse();

    state.tracker.mod = parsed;
    state.tracker.orderIdx = 0;
    if (state.player) state.player.load(parsed);
    document.getElementById('songTitleInput').value = parsed.songName;
    uiUpdateSampleList(); uiUpdateOrderList(); uiUpdate(); uiRenderPattern();
    if (state.smpEditor) state.smpEditor.select(state.editor.currentSample - 1);

    // Ensure the callback is set after load
    if (state.player) state.player.onSongEnd = () => next();

    const title = (mod.title || mod.filename || parsed.songName).substring(0, 20).toUpperCase();
    const artist = mod.artist ? ` - ${mod.artist.substring(0, 12).toUpperCase()}` : '';
    showStatus(`RADIO: ${title}${artist}`, '#0f0');

    retryCount = 0;
    if (state.player) state.player.play();

  } catch (e) {
    console.warn('Radio skip:', e.message);
    retryCount++;
    if (retryCount >= MAX_RETRIES) {
      showStatus('RADIO: TOO MANY ERRORS', '#f00');
      stop();
      return;
    }
    showStatus('RADIO: SKIPPING...', '#f80');
    // Brief pause before retrying to avoid hammering the API
    setTimeout(() => { if (active) next(); }, 500);
  }
}

function updateButton() {
  const btn = document.getElementById('btnRadio');
  if (!btn) return;
  if (active) {
    btn.classList.add('active');
    btn.textContent = '■ RADIO';
  } else {
    btn.classList.remove('active');
    btn.textContent = 'RADIO';
  }
}
