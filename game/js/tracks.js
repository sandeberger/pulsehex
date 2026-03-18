"use strict";

import { track01 } from './charts/track01.js';

/**
 * Track catalog — each entry can have a handcoded chart or rely on auto-generation.
 * If `chart` is null the game will auto-generate from the MOD analysis.
 */
export const tracks = [
  {
    id: 'space_debris',
    title: 'Space Debris',
    modFile: '/mods/space_debris (2).mod',
    chart: track01,       // handcoded chart
    difficulty: 2,
    mood: 'chill / dreamy',
  },
  {
    id: 'addicti',
    title: 'Addicti',
    modFile: '/mods/addicti.mod',
    chart: null,           // auto-generated
    difficulty: 2,
    mood: 'groovy / upbeat',
  },
  {
    id: 'chuckrock',
    title: 'Chuck Rock',
    modFile: '/mods/chuckrock (1).mod',
    chart: null,
    difficulty: 3,
    mood: 'energetic / playful',
  },
  {
    id: 'lastninja2',
    title: 'Last Ninja 2 – The Street',
    modFile: '/mods/lastninja2_the_street_loader.mod',
    chart: null,
    difficulty: 3,
    mood: 'dark / intense',
  },
  {
    id: 'popcorn',
    title: 'Popcorn Remix',
    modFile: '/mods/popcorn_remix.mod',
    chart: null,
    difficulty: 1,
    mood: 'classic / fun',
  },
];
