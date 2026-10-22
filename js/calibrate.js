// Tap-along offset calibration: plays a metronome and measures how far the player's taps land
// from the clicks, using the same "heard time" model as the game clock (currentTime - output latency).

import { outputLatency } from './audio.js';

const BPM = 100;
const BEATS = 24;
const WARMUP = 4;
const TARGET_TAPS = 16;

export class Calibrator {
  constructor(music) {
    this.music = music;
    this.active = false;
    this.sources = [];
    this.reset();
  }

  reset() {
    this.taps = [];
    this.result = null;
    this.beatTimes = [];
  }

  start() {
    this.stop();
    this.reset();
    const ctx = this.music.ctx;
    const beat = 60 / BPM;
    const t0 = ctx.currentTime + 0.8;
    for (let i = 0; i < BEATS; i++) {
      const when = t0 + i * beat;
      this.beatTimes.push(when);
      const src = ctx.createBufferSource();
      src.buffer = i % 4 === 0 ? this.music.flickBuf : this.music.tapBuf;
      src.connect(this.music.bus);
      src.start(when);
      this.sources.push(src);
    }
    this.beat = beat;
    this.active = true;
  }

  stop() {
    for (const s of this.sources) {
      try { s.stop(); } catch { /* already finished */ }
    }
    this.sources = [];
    this.active = false;
  }

  // Context time the player was hearing when the event happened.
  heardTime(eventStamp) {
    const ctx = this.music.ctx;
    const age = eventStamp ? Math.max(0, (performance.now() - eventStamp) / 1000) : 0;
    return ctx.currentTime - Math.min(age, 0.2) - outputLatency();
  }

  // Phase 0..1 within the current beat of what is being heard (for the pulsing pad), or -1 before start.
  phase() {
    if (!this.active || !this.beatTimes.length) return -1;
    const t = this.music.ctx.currentTime - outputLatency() - this.beatTimes[0];
    if (t < 0) return -1;
    return (t / this.beat) % 1;
  }

  heardBeatIndex() {
    if (!this.beatTimes.length) return -1;
    const t = this.music.ctx.currentTime - outputLatency() - this.beatTimes[0];
    return Math.floor(t / this.beat);
  }

  // Returns true once enough taps were collected.
  tap(eventStamp) {
    if (!this.active) return false;
    const t = this.heardTime(eventStamp);
    const k = Math.round((t - this.beatTimes[0]) / this.beat);
    if (k < WARMUP || k >= BEATS) return false;
    const delta = t - this.beatTimes[k];
    if (Math.abs(delta) > this.beat * 0.4) return false;
    if (this.taps.some((x) => x.k === k)) return false;
    this.taps.push({ k, delta });
    if (this.taps.length >= TARGET_TAPS) this.finish();
    return true;
  }

  // Ends the run; computes a result if there were enough usable taps.
  finish() {
    this.stop();
    if (this.taps.length < 8) {
      this.result = null;
      return null;
    }
    const d = this.taps.map((x) => x.delta).sort((a, b) => a - b);
    const median = d[d.length >> 1];
    const dev = d.map((x) => Math.abs(x - median)).sort((a, b) => a - b)[d.length >> 1];
    const ms = Math.max(-200, Math.min(200, Math.round((median * 1000) / 5) * 5));
    this.result = { offsetMs: ms, spreadMs: Math.round(dev * 1000), taps: d.length };
    return this.result;
  }

  get needed() {
    return TARGET_TAPS;
  }

  // True once every click has been heard (the run timed out without enough taps).
  get expired() {
    return this.active && this.heardBeatIndex() >= BEATS + 1;
  }
}
