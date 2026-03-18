"use strict";

export const TAU = Math.PI * 2;

export function normalizeAngle(a) {
  a = a % TAU;
  return a < 0 ? a + TAU : a;
}

export function angleDiff(a, b) {
  let d = normalizeAngle(b - a);
  if (d > Math.PI) d -= TAU;
  return d;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * t;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
