"use strict";

// XOR-obfuscated API key — not stored in plaintext.
const _d = 'KhhEPgdDERIeGysrKXhIEiZfACERWQQfXkZnNCUuCAc3CgI=';
const _k = 'Pr0Tr4ck3rJS_M0d';

export function getApiKey() {
  const raw = atob(_d);
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(raw.charCodeAt(i) ^ _k.charCodeAt(i % _k.length));
  }
  return out;
}
