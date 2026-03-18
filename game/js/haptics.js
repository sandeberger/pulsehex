"use strict";

/**
 * Haptic feedback via Vibration API.
 * Gracefully no-ops on unsupported devices (iOS Safari, desktop).
 */

let _enabled = true;

function vib(pattern) {
  if (!_enabled) return;
  if (navigator.vibrate) navigator.vibrate(pattern);
}

export const Haptics = {
  /** Short tick on strong beats */
  beat()        { vib(8); },

  /** Medium pulse on near miss */
  nearMiss()    { vib(25); },

  /** Section clear — double tap */
  sectionClear(){ vib([15, 40, 15]); },

  /** Death — strong snap */
  death()       { vib([40, 20, 80]); },

  /** UI feedback — light tap */
  uiTap()       { vib(5); },

  get enabled() { return _enabled; },

  setEnabled(on) {
    _enabled = on;
    try { localStorage.setItem('pulsehex_haptics', on ? '1' : '0'); } catch(e) {}
  },

  /** Load preference from storage */
  init() {
    try {
      const stored = localStorage.getItem('pulsehex_haptics');
      if (stored !== null) _enabled = stored === '1';
    } catch(e) {}
  }
};
