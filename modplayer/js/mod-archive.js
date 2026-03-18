"use strict";

import { getApiKey } from './api-key.js';

const API_BASE = 'https://modarchive.org/data/xml-tools.php';

function buildUrl(request, params = {}) {
  const url = new URL(API_BASE);
  url.searchParams.set('key', getApiKey());
  url.searchParams.set('request', request);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

function parseModules(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const error = doc.querySelector('error');
  if (error) throw new Error(error.textContent);

  const totalResults = doc.querySelector('results')?.textContent || '0';
  const totalPages = doc.querySelector('totalpages')?.textContent || '1';

  const modules = [];
  for (const mod of doc.querySelectorAll('module')) {
    modules.push({
      id: mod.querySelector('id')?.textContent || '',
      filename: mod.querySelector('filename')?.textContent || '',
      title: mod.querySelector('songtitle')?.textContent || 'Untitled',
      url: mod.querySelector('url')?.textContent || '',
      size: parseInt(mod.querySelector('bytes')?.textContent || '0', 10),
      genre: mod.querySelector('genretext')?.textContent || '',
      artist: mod.querySelector('artist_info artist alias')?.textContent || '',
      format: mod.querySelector('format')?.textContent || '',
      channels: mod.querySelector('channels')?.textContent || '',
    });
  }

  return { modules, totalResults: parseInt(totalResults, 10), totalPages: parseInt(totalPages, 10) };
}

function parseArtists(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const error = doc.querySelector('error');
  if (error) throw new Error(error.textContent);

  const totalResults = doc.querySelector('total_results')?.textContent || '0';
  const totalPages = doc.querySelector('totalpages')?.textContent || '1';

  const artists = [];
  for (const item of doc.querySelectorAll('item')) {
    artists.push({
      id: item.querySelector('id')?.textContent || '',
      alias: item.querySelector('alias')?.textContent || '',
    });
  }

  return { artists, totalResults: parseInt(totalResults, 10), totalPages: parseInt(totalPages, 10) };
}

// Search modules by title/filename — always filtered to MOD format
export async function searchModules(query, page = 1) {
  const params = { query, type: 'filename_or_songtitle', page, format: 'MOD' };
  const url = buildUrl('search', params);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return parseModules(await resp.text());
}

// Get a random MOD module
export async function getRandomModule() {
  const url = buildUrl('random', { format: 'MOD' });
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return parseModules(await resp.text());
}

// Get a specific module by ID
export async function getModuleById(moduleId) {
  const url = buildUrl('view_by_moduleid', { query: moduleId });
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return parseModules(await resp.text());
}

// Search for artists by name
export async function searchArtists(query, page = 1) {
  const url = buildUrl('search_artist', { query, page });
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return parseArtists(await resp.text());
}

// Get MOD modules by artist ID
export async function getModulesByArtist(artistId, page = 1) {
  const url = buildUrl('view_modules_by_artistid', { query: artistId, page, format: 'MOD' });
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return parseModules(await resp.text());
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
