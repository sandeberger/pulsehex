"use strict";

import { ModParser } from '../../modplayer/js/mod-parser.js';
import { EventBus } from './event-bus.js';
import { GamePlayer } from './game-player.js';

export class ModAdapter {
  constructor() {
    this.bus = new EventBus();
    this.ctx = null;
    this.player = null;
    this.mod = null;
    this._vuBuf = null;
  }

  async init() {
    this.ctx = new AudioContext();
    this.player = new GamePlayer(this.ctx, this.bus);
    this.player.onSongEnd = () => this.bus.emit('songEnd');
  }

  async loadFromUrl(url) {
    const resp = await fetch(url);
    const buf = await resp.arrayBuffer();
    return this.loadFromBuffer(buf);
  }

  loadFromBuffer(buf) {
    const parser = new ModParser(buf);
    this.mod = parser.parse();
    this.player.load(this.mod);
    this.bus.emit('loaded', { name: this.mod.songName, channels: this.mod.channels });
    return this.mod;
  }

  play() {
    if (!this.player) return;
    this.player.play();
  }

  stop() {
    if (!this.player) return;
    this.player.stop();
  }

  restart() {
    this.stop();
    this.play();
  }

  get isPlaying() { return this.player ? this.player.isPlaying : false; }
  get currentRow() { return this.player ? this.player.row : 0; }
  get currentOrder() { return this.player ? this.player.orderIdx : 0; }
  get bpm() { return this.player ? this.player.bpm : 125; }
  get speed() { return this.player ? this.player.speed : 6; }
  get channelCount() { return this.mod ? this.mod.channels : 0; }

  getChannelLevel(ch) {
    if (!this.player || !this.player.analysers[ch]) return 0;
    const analyser = this.player.analysers[ch];
    if (!this._vuBuf || this._vuBuf.length !== analyser.fftSize) {
      this._vuBuf = new Float32Array(analyser.fftSize);
    }
    analyser.getFloatTimeDomainData(this._vuBuf);
    let sum = 0;
    for (let i = 0; i < this._vuBuf.length; i++) sum += this._vuBuf[i] * this._vuBuf[i];
    return Math.sqrt(sum / this._vuBuf.length);
  }

  on(event, fn) { this.bus.on(event, fn); }
  off(event, fn) { this.bus.off(event, fn); }
  once(event, fn) { this.bus.once(event, fn); }
}
