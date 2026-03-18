"use strict";

// Shared mutable application state — no project imports to avoid circular dependencies.
const state = {
  audioCtx: null,
  player: null,
  editor: null,
  undoMgr: null,
  clipboard: null,
  smpEditor: null,
  tracker: { mod: null, orderIdx: 0 },
  canvas: null,
  ctx: null,
  vuLevels: [],
  vuBufs: [],
};

export default state;
