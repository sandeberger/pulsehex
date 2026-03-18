"use strict";

import state from './state.js';
import { ModParser } from './mod-parser.js';
import { searchModules, getRandomModule, searchArtists, getModulesByArtist, formatSize } from './mod-archive.js';
import { showStatus, uiUpdateSampleList, uiUpdateOrderList, uiUpdate, uiRenderPattern } from './ui.js';

let currentPage = 1;
let totalPages = 1;
let lastType = null;   // 'search' | 'random' | 'artist-list' | 'artist-modules'
let lastQuery = '';
let lastArtistId = '';

const overlay = () => document.getElementById('browseOverlay');
const resultsEl = () => document.getElementById('browseResults');
const statusEl = () => document.getElementById('browseStatus');
const pagerEl = () => document.getElementById('browsePager');
const pageInfoEl = () => document.getElementById('pageInfo');

function setStatus(msg) { statusEl().textContent = msg; }

function showPager(page, pages) {
  currentPage = page;
  totalPages = pages;
  if (pages <= 1) { pagerEl().style.display = 'none'; return; }
  pagerEl().style.display = 'flex';
  pageInfoEl().textContent = `${page} / ${pages}`;
  document.getElementById('pagePrev').disabled = page <= 1;
  document.getElementById('pageNext').disabled = page >= pages;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderModuleResults(data) {
  resultsEl().innerHTML = '';
  if (data.modules.length === 0) {
    setStatus('No modules found');
    showPager(1, 1);
    return;
  }
  setStatus(`${data.totalResults} module${data.totalResults !== 1 ? 's' : ''} found`);
  showPager(currentPage, data.totalPages);

  for (const mod of data.modules) {
    const row = document.createElement('div');
    row.className = 'browse-row';
    const fmt = mod.format ? `[${mod.format}]` : '';
    row.innerHTML =
      `<span class="browse-title" title="${escHtml(mod.filename)}">${escHtml(mod.title || mod.filename)} <span style="color:#4477aa;font-size:10px">${fmt}</span></span>` +
      `<span class="browse-artist">${escHtml(mod.artist || '-')}</span>` +
      `<span class="browse-genre">${escHtml(mod.genre || '-')}</span>` +
      `<span class="browse-size">${formatSize(mod.size)}</span>`;
    row.addEventListener('click', () => loadModule(mod, row));
    resultsEl().appendChild(row);
  }
}

function renderArtistResults(data) {
  resultsEl().innerHTML = '';
  if (data.artists.length === 0) {
    setStatus('No artists found');
    showPager(1, 1);
    return;
  }
  setStatus(`${data.totalResults} artist${data.totalResults !== 1 ? 's' : ''} found`);
  showPager(currentPage, data.totalPages);

  for (const artist of data.artists) {
    const row = document.createElement('div');
    row.className = 'browse-row';
    row.innerHTML =
      `<span class="browse-title">${escHtml(artist.alias)}</span>` +
      `<span class="browse-artist" style="color:var(--green)">ARTIST</span>` +
      `<span class="browse-genre">Click to browse</span>` +
      `<span class="browse-size"></span>`;
    row.addEventListener('click', () => doArtistModules(artist.id, artist.alias, 1));
    resultsEl().appendChild(row);
  }
}

async function loadModule(mod, row) {
  if (row) row.classList.add('loading');
  setStatus('LOADING: ' + (mod.title || mod.filename).substring(0, 30).toUpperCase() + '...');
  try {
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
    showStatus('LOADED: ' + parsed.songName.substring(0, 15).toUpperCase(), '#0f0');
    close();
    if (state.player) state.player.play();
  } catch (e) {
    showStatus('LOAD ERROR: ' + e.message, '#f00');
    console.error(e);
  } finally {
    if (row) row.classList.remove('loading');
  }
}

async function doSearch(page = 1) {
  const query = document.getElementById('browseSearch').value.trim();
  if (!query || query.length < 3) {
    setStatus('Min 3 characters to search');
    return;
  }
  const mode = document.getElementById('browseMode').value;
  if (mode === 'artist') {
    return doArtistSearch(query, page);
  }
  lastType = 'search'; lastQuery = query; currentPage = page;
  setStatus('SEARCHING...');
  resultsEl().innerHTML = '';
  try {
    const data = await searchModules(query, page);
    renderModuleResults(data);
  } catch (e) {
    setStatus('ERROR: ' + e.message);
    console.error(e);
  }
}

async function doArtistSearch(query, page = 1) {
  lastType = 'artist-list'; lastQuery = query; currentPage = page;
  setStatus('SEARCHING ARTISTS...');
  resultsEl().innerHTML = '';
  try {
    const data = await searchArtists(query, page);
    renderArtistResults(data);
  } catch (e) {
    setStatus('ERROR: ' + e.message);
    console.error(e);
  }
}

async function doArtistModules(artistId, artistName, page = 1) {
  lastType = 'artist-modules'; lastArtistId = artistId; lastQuery = artistName; currentPage = page;
  setStatus('LOADING MODULES BY ' + artistName.toUpperCase() + '...');
  resultsEl().innerHTML = '';
  try {
    const data = await getModulesByArtist(artistId, page);
    renderModuleResults(data);
    setStatus(`${data.totalResults} module${data.totalResults !== 1 ? 's' : ''} by ${artistName}`);
  } catch (e) {
    setStatus('ERROR: ' + e.message);
    console.error(e);
  }
}

async function doRandom() {
  lastType = 'random'; currentPage = 1;
  setStatus('FETCHING RANDOM MODULE...');
  resultsEl().innerHTML = '';
  try {
    const data = await getRandomModule();
    renderModuleResults(data);
    showPager(1, 1);
  } catch (e) {
    setStatus('ERROR: ' + e.message);
    console.error(e);
  }
}

async function goPage(delta) {
  const next = currentPage + delta;
  if (next < 1 || next > totalPages) return;
  switch (lastType) {
    case 'search': await doSearch(next); break;
    case 'artist-list': await doArtistSearch(lastQuery, next); break;
    case 'artist-modules': await doArtistModules(lastArtistId, lastQuery, next); break;
  }
}

export function open() {
  overlay().classList.add('open');
  document.getElementById('browseSearch').focus();
}

export function close() {
  overlay().classList.remove('open');
}

export function toggle() {
  overlay().classList.contains('open') ? close() : open();
}

export function initBrowseUI() {
  // Event listeners
  document.getElementById('browseSearchBtn').addEventListener('click', () => doSearch(1));
  document.getElementById('browseSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(1); }
    e.stopPropagation();
  });
  document.getElementById('browseSearch').addEventListener('keyup', e => e.stopPropagation());
  document.getElementById('browseSearch').addEventListener('keypress', e => e.stopPropagation());

  document.getElementById('browseRandomBtn').addEventListener('click', () => doRandom());
  document.getElementById('browseClose').addEventListener('click', close);

  document.getElementById('pagePrev').addEventListener('click', () => goPage(-1));
  document.getElementById('pageNext').addEventListener('click', () => goPage(1));

  // Close on Escape when overlay is open
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay().classList.contains('open')) {
      e.stopPropagation();
      close();
    }
  }, true);
}
