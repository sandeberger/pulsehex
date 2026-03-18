"use strict";

export class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    (this._listeners[event] || (this._listeners[event] = [])).push(fn);
  }

  off(event, fn) {
    const list = this._listeners[event];
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
  }

  once(event, fn) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      fn(data);
    };
    this.on(event, wrapper);
  }

  emit(event, data) {
    const list = this._listeners[event];
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](data);
  }
}
