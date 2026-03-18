"use strict";

// Mouse drag constants (anchor-based, tighter than before)
const MOUSE_DEAD_ZONE = 4;    // pixels
const MOUSE_MAX_OFFSET = 40;  // full speed at this offset

// Touch constants (screen-position based)
const TOUCH_DEAD_ZONE = 12;       // pixels from screen center — "stop" zone
const TOUCH_FULL_SPEED_DIST = 60; // pixels from dead zone edge to full speed

function mouseAnalog(offset) {
  const abs = Math.abs(offset);
  if (abs < MOUSE_DEAD_ZONE) return 0;
  const sign = offset > 0 ? 1 : -1;
  const t = Math.min((abs - MOUSE_DEAD_ZONE) / (MOUSE_MAX_OFFSET - MOUSE_DEAD_ZONE), 1);
  return sign * t;
}

function touchAnalog(touchX, screenCenterX) {
  const offset = touchX - screenCenterX;
  const abs = Math.abs(offset);
  if (abs < TOUCH_DEAD_ZONE) return 0;
  const sign = offset > 0 ? 1 : -1;
  const t = Math.min((abs - TOUCH_DEAD_ZONE) / TOUCH_FULL_SPEED_DIST, 1);
  return sign * t;
}

export class Input {
  constructor(viewport) {
    this.viewport = viewport;
    this.direction = 0;
    this.anyDown = false;
    this.justPressed = false;
    this._prevDown = false;
    this._keyLeft = false;
    this._keyRight = false;

    // Touch state (screen-position based — no anchor)
    this._touchActive = false;
    this._touchDir = 0;

    // Mouse drag state (anchor-based but tighter)
    this._mouseActive = false;
    this._mouseStartX = 0;
    this._mouseDir = 0;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    window.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });

    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  // ---- Keyboard (digital -1 / 0 / 1) ----

  _onKeyDown(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this._keyLeft = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this._keyRight = true;
  }

  _onKeyUp(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this._keyLeft = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this._keyRight = false;
  }

  // ---- Touch (screen-position based — instant response) ----
  // Direction + speed = finger position relative to screen center.
  // Touch right of center → rotate right. Further from center → faster.
  // Change direction instantly by moving finger across center.

  _onTouchStart(e) {
    e.preventDefault();
    this._touchActive = true;
    this._touchDir = touchAnalog(e.touches[0].clientX, this.viewport.width / 2);
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (!this._touchActive) return;
    this._touchDir = touchAnalog(e.touches[0].clientX, this.viewport.width / 2);
  }

  _onTouchEnd(e) {
    e.preventDefault();
    if (e.touches.length === 0) {
      this._touchActive = false;
      this._touchDir = 0;
    } else {
      this._touchDir = touchAnalog(e.touches[0].clientX, this.viewport.width / 2);
    }
  }

  // ---- Mouse (anchor-based drag, tighter response) ----

  _onMouseDown(e) {
    if (e.button !== 0) return;
    this._mouseActive = true;
    this._mouseStartX = e.clientX;
    this._mouseDir = 0;
  }

  _onMouseMove(e) {
    if (!this._mouseActive) return;
    this._mouseDir = mouseAnalog(e.clientX - this._mouseStartX);
  }

  _onMouseUp(e) {
    if (e.button !== 0) return;
    this._mouseActive = false;
    this._mouseDir = 0;
  }

  // ---- Poll (called once per fixed-step tick) ----

  poll() {
    let dir = 0;

    // Keyboard: digital
    if (this._keyLeft) dir = -1;
    if (this._keyRight) dir = 1;

    // Touch: screen-position (wins over keyboard if active)
    if (this._touchActive) dir = this._touchDir;

    // Mouse drag: anchor-based (wins over keyboard if active)
    if (this._mouseActive && this._mouseDir !== 0) dir = this._mouseDir;

    this.direction = dir;
    this.anyDown = dir !== 0 || this._touchActive;
    this.justPressed = this.anyDown && !this._prevDown;
    this._prevDown = this.anyDown;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchend', this._onTouchEnd);
    window.removeEventListener('touchcancel', this._onTouchEnd);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
  }
}
