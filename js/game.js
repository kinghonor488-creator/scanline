// Gameplay: audio-synced clock, scan line, notes, input, judgement, scoring and rendering.

import { FX } from './fx.js';
import { outputLatency } from './audio.js';
import { sceneFor } from './scenes.js';
import { portraitNow } from './characters.js';

export const WIN = { perfect: 0.07, good: 0.13, bad: 0.18 };
const NOTE_SCALE = 2.25;
const TP_EXACT = 0.04;
const COLOR = {
  perfect: '#ffe27a',
  good: '#7dffa8',
  bad: '#ff9f5e',
  miss: '#8ea3b8',
};
const DIFF_COLOR = { easy: '#7dd8ff', hard: '#ff9f5e', chaos: '#d36bff' };
const FONT = '"M PLUS Rounded 1c", "Avenir Next", "Segoe UI", system-ui, sans-serif';
const SEVERITY = ['perfect', 'good', 'bad', 'miss'];

const mod = (a, n) => ((a % n) + n) % n;
const easeOutBack = (x) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;

function classify(dt) {
  const a = Math.abs(dt);
  if (a <= WIN.perfect) return 'perfect';
  if (a <= WIN.good) return 'good';
  if (a <= WIN.bad) return 'bad';
  return 'miss';
}
const worse = (a, b) => (SEVERITY.indexOf(a) > SEVERITY.indexOf(b) ? a : b);

let insetProbe = null;
function safeInsets() {
  if (!insetProbe) {
    insetProbe = document.createElement('div');
    insetProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.append(insetProbe);
  }
  const cs = getComputedStyle(insetProbe);
  return { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
}

// Blend two #rrggbb colours.
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function glowDisk(g, r, color, alpha) {
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = alpha;
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

function diamond(g, s) {
  g.beginPath();
  g.moveTo(0, -s);
  g.lineTo(s * 0.8, 0);
  g.lineTo(0, s);
  g.lineTo(-s * 0.8, 0);
  g.closePath();
  g.fill();
}

// Glossy note art, rendered once per colour/type into a sprite.
function drawNoteArt(g, type, color, R) {
  const light = mix(color, '#ffffff', 0.6);
  const dark = mix(color, '#100820', 0.45);
  if (type === 'drag') {
    const r = R * 0.5;
    glowDisk(g, r * 2.3, color, 0.5);
    g.save();
    g.rotate(Math.PI / 4);
    const gr = g.createLinearGradient(-r, -r, r, r);
    gr.addColorStop(0, light);
    gr.addColorStop(1, dark);
    g.fillStyle = gr;
    g.fillRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
    g.lineWidth = 2.5;
    g.strokeStyle = '#ffffff';
    g.strokeRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
    g.restore();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    g.fill();
    return;
  }
  glowDisk(g, R * 1.55, color, 0.55);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(0, 0, R * 0.98, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1a1230';
  g.beginPath();
  g.arc(0, 0, R * 0.87, 0, Math.PI * 2);
  g.fill();
  const gr = g.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.08, 0, 0, R * 0.8);
  gr.addColorStop(0, light);
  gr.addColorStop(0.55, color);
  gr.addColorStop(1, dark);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, R * 0.76, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.3)';
  g.beginPath();
  g.ellipse(0, -R * 0.36, R * 0.48, R * 0.22, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  if (type === 'hold') {
    for (const y of [-R * 0.2, R * 0.08]) {
      g.beginPath();
      g.roundRect(-R * 0.34, y, R * 0.68, R * 0.13, R * 0.06);
      g.fill();
    }
  } else {
    diamond(g, R * 0.3);
  }
  if (type === 'flick') {
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.moveTo(sd * R * 1.18, -R * 0.5);
      g.lineTo(sd * R * 1.72, 0);
      g.lineTo(sd * R * 1.18, R * 0.5);
      g.lineTo(sd * R * 1.34, 0);
      g.closePath();
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = color;
      g.stroke();
    }
  }
}

export class Game {
  constructor(canvas, music, hooks) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.music = music;
    this.hooks = hooks;
    this.fx = new FX();
    this.state = 'idle'; // idle | playing | paused | resume | ending | ended
    this.settings = { offsetMs: 0, approach: 1, shake: true };
    this.pointers = new Map();
    this.keys = new Map();
    this.manual = false;
    this.manualTime = 0;
    this.lastFrame = performance.now();
    this.chart = null;
    this.colors = { up: '#5ef2ff', down: '#ff6fb5' };
    this.character = null;
    this.scene = null;
    this.sprites = null;
    this.camPunch = 0;
    this.missFlash = 0;
    this.breakT = 0;
    this.lineHit = 0;
    this.cutin = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.onDown(e), opts);
    canvas.addEventListener('pointermove', (e) => this.onMove(e), opts);
    canvas.addEventListener('pointerup', (e) => this.onUp(e), opts);
    canvas.addEventListener('pointercancel', (e) => this.onUp(e), opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.dpr = dpr;
    this.W = W;
    this.H = H;
    // Note radius (also sets the touch area, which reaches 1.75x this).
    this.r = NOTE_SCALE * Math.max(18, Math.min(40, Math.min(W, H) * 0.045));
    // Keep the field and HUD clear of the notch / home indicator on phones.
    const safe = (this.safe = safeInsets());
    const mx = Math.max(this.r * 1.6, W * 0.07);
    this.area = {
      left: mx + safe.left,
      right: W - mx - safe.right,
      top: Math.max(78 + this.r, H * 0.17) + safe.top,
      bottom: H - Math.max(this.r * 1.4, H * 0.08) - safe.bottom,
    };
    if (this.scene) this.scene.resize(W, H, dpr);
    this.sprites = null;
  }

  setCharacter(ch) {
    this.character = ch;
    this.colors = { up: ch.colors.primary, down: ch.colors.secondary };
    this.scene = sceneFor(ch);
    this.scene.resize(this.W, this.H, this.dpr);
    this.sprites = null;
  }

  sprite(type, side) {
    if (!this.sprites) {
      this.sprites = {};
      for (const sd of ['up', 'down']) {
        for (const tp of ['tap', 'hold', 'flick', 'drag']) {
          const S = Math.ceil(this.r * (tp === 'flick' ? 4.2 : 3.4));
          const c = document.createElement('canvas');
          c.width = c.height = Math.ceil(S * this.dpr);
          const g = c.getContext('2d');
          g.scale(this.dpr, this.dpr);
          g.translate(S / 2, S / 2);
          drawNoteArt(g, tp, this.colors[sd], this.r);
          this.sprites[`${tp}-${sd}`] = { c, S };
        }
      }
    }
    return this.sprites[`${type}-${side}`];
  }

  noteSide(n) {
    return mod(n.page, 2) === 0 ? 'up' : 'down';
  }

  // ---------------------------------------------------------------- lifecycle

  start(chart, buffer, meta, { autoplay = false } = {}) {
    this.chart = chart;
    this.buffer = buffer;
    this.meta = meta;
    this.autoplay = autoplay;
    this.notes = chart.notes.map((n) => ({ ...n, done: false, result: null, holding: false, headDt: 0, flickBy: null, armed: false }));
    this.cursor = 0;
    this.stats = { perfect: 0, good: 0, bad: 0, miss: 0, early: 0, late: 0 };
    this.combo = 0;
    this.maxCombo = 0;
    this.tpSum = 0;
    this.judgedCount = 0;
    this.comboPop = 0;
    this.lineFlash = 0;
    this.lastCombo = 0;
    this.cutin = null;
    this.missFlash = 0;
    this.breakT = 0;
    this.banner = null;
    this.pointers.clear();
    this.keys.clear();
    this.fx.clear();
    this.fx.shakeEnabled = this.settings.shake;
    this.approach = Math.max(0.8, Math.min(2.4, chart.pageDur)) * this.settings.approach;
    // Furthest ahead of its hit time any note can appear (group mode shows a whole page early).
    this.maxLead = this.settings.spawn === 'group' ? chart.pageDur * 2 + 0.05 : this.approach;
    this.lead = 2.2;
    this.clockReady = false;
    this.state = 'playing';
    if (this.manual) {
      this.manualTime = -this.lead;
    } else {
      this.startCtx = this.music.ctx.currentTime + this.lead;
      this.music.play(buffer, this.startCtx, 0);
      this.syncClock();
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    const t = this.now();
    this.frozen = t;
    for (const n of this.notes) if (n.holding) this.releaseHold(n, t);
    this.pointers.clear();
    this.keys.clear();
    this.state = 'paused';
    if (!this.manual) this.music.ctx.suspend();
    this.hooks.onPause?.();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'resume';
    this.resumeLeft = 3;
  }

  finishResume() {
    this.state = 'playing';
    if (!this.manual) {
      this.music.ctx.resume();
      this.clockReady = false;
    }
  }

  stop() {
    this.state = 'idle';
    this.music.stop();
    if (this.music.ctx.state === 'suspended') this.music.ctx.resume();
    this.pointers.clear();
    this.keys.clear();
    this.fx.clear();
  }

  finish() {
    const N = this.notes.length;
    this.state = 'ending';
    this.endLeft = 1.8;
    if (!this.manual) this.music.fadeOut(1.2);
    if (N > 0 && this.stats.perfect === N) this.banner = 'ALL PERFECT';
    else if (N > 0 && this.stats.bad + this.stats.miss === 0) this.banner = 'FULL COMBO';
    else this.banner = 'TRACK COMPLETE';
    this.bannerT = 0;
  }

  result() {
    const N = this.notes.length;
    return {
      songId: this.meta.id,
      diff: this.chart.diff,
      score: this.score,
      tp: +this.tp.toFixed(2),
      ...this.stats,
      maxCombo: this.maxCombo,
      total: N,
      fullCombo: N > 0 && this.stats.bad + this.stats.miss === 0,
      allPerfect: N > 0 && this.stats.perfect === N,
      autoplay: this.autoplay,
    };
  }

  get score() {
    const N = this.notes.length || 1;
    const s = this.stats;
    return Math.round((900000 * (s.perfect + 0.7 * s.good + 0.3 * s.bad)) / N + (100000 * this.maxCombo) / N);
  }

  get tp() {
    return this.judgedCount ? (this.tpSum / this.judgedCount) * 100 : 100;
  }

  // ---------------------------------------------------------------- clock

  audioTime() {
    return this.music.ctx.currentTime - this.startCtx - outputLatency() - this.settings.offsetMs / 1000;
  }

  // Song time follows the audio clock, smoothed with performance.now() so it advances every frame.
  syncClock() {
    if (this.manual) return;
    const target = this.audioTime();
    const p = performance.now();
    if (!this.clockReady) {
      this.perf0 = p;
      this.song0 = target;
      this.clockReady = true;
      return;
    }
    const est = this.song0 + (p - this.perf0) / 1000;
    const err = target - est;
    if (Math.abs(err) > 0.05) {
      this.perf0 = p;
      this.song0 = target;
    } else {
      this.song0 += err * 0.03;
    }
  }

  now() {
    if (this.manual) return this.manualTime;
    if (!this.clockReady) return -this.lead;
    if (this.state !== 'playing' && this.state !== 'ending') return this.frozen;
    return this.song0 + (performance.now() - this.perf0) / 1000;
  }

  eventTime(e) {
    if (this.manual || !this.clockReady) return this.now();
    let ts = e && e.timeStamp;
    if (!ts || Math.abs(ts - performance.now()) > 1000) ts = performance.now();
    return this.song0 + (ts - this.perf0) / 1000;
  }

  // Switches to a deterministic clock driven by advanceTime() (used by automated tests).
  setManual() {
    if (this.manual) return;
    const t = this.chart && this.state !== 'idle' ? this.now() : 0;
    this.manual = true;
    this.manualTime = t;
    this.music.stop();
  }

  // ---------------------------------------------------------------- loop

  frame() {
    const p = performance.now();
    const dt = Math.min(0.05, (p - this.lastFrame) / 1000);
    this.lastFrame = p;
    if (!this.manual) this.tick(dt);
    this.render();
  }

  advanceTime(ms) {
    this.setManual();
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) this.tick(1 / 60);
    this.render();
  }

  tick(dt) {
    if (this.state === 'resume') {
      this.resumeLeft -= dt;
      if (this.resumeLeft <= 0) this.finishResume();
    }
    if (this.state === 'playing' || this.state === 'ending') {
      if (this.manual) this.manualTime += dt;
      else this.syncClock();
      this.update(this.now());
    }
    if (this.state === 'ending') {
      this.endLeft -= dt;
      this.bannerT += dt;
      if (this.endLeft <= 0) {
        this.frozen = this.now();
        this.state = 'ended';
        this.music.stop();
        this.hooks.onEnd?.(this.result());
      }
    }
    this.fx.update(dt);
    this.comboPop = Math.max(0, this.comboPop - dt * 5);
    this.lineFlash = Math.max(0, this.lineFlash - dt * 2.5);
    this.camPunch = Math.max(0, this.camPunch - dt * 9);
    this.missFlash = Math.max(0, this.missFlash - dt * 4);
    this.breakT = Math.max(0, this.breakT - dt * 1.4);
    this.lineHit = Math.max(0, this.lineHit - dt * 8);
    if (this.cutin) {
      this.cutin.t += dt;
      if (this.cutin.t > 1.4) this.cutin = null;
    }
  }

  update(t) {
    const notes = this.notes;
    while (this.cursor < notes.length && notes[this.cursor].done) this.cursor++;
    const anyKey = this.keys.size > 0;
    for (let i = this.cursor; i < notes.length; i++) {
      const n = notes[i];
      if (n.t - this.maxLead > t) break;
      if (n.done) continue;
      if (n.holding) {
        if (t >= n.t + n.dur) this.finishHold(n);
        continue;
      }
      if (this.autoplay) {
        if (t >= n.t) {
          if (n.type === 'hold') this.beginHold(n, 0);
          else this.judgeAs(n, 'perfect', 0);
        }
        continue;
      }
      if (n.type === 'drag') {
        if (t >= n.t - WIN.good && (anyKey || this.touching(n))) n.armed = true;
        if (n.armed && t >= n.t) this.judgeAs(n, 'perfect', 0);
        else if (t > n.t + WIN.good) this.judgeAs(n, 'miss', 0);
        continue;
      }
      if (t > n.t + WIN.bad) this.judgeAs(n, 'miss', 0);
    }
    if (this.state === 'playing' && t >= this.chart.endTime) this.finish();
  }

  // ---------------------------------------------------------------- judging

  beginHold(n, dt) {
    n.holding = true;
    n.headDt = dt;
    this.music.hit('tap');
    const p = this.posAt(n.x, n.y);
    this.fx.ring(p.x, p.y, COLOR[classify(dt)], this.r * 0.8, this.r * 1.7, 0.3, 3);
  }

  finishHold(n) {
    this.judgeAs(n, classify(n.headDt), n.headDt, this.posAt(n.x, n.y2));
  }

  releaseHold(n, t) {
    if (t >= n.t + n.dur - 0.12) {
      this.finishHold(n);
      return;
    }
    const ratio = (t - n.t) / n.dur;
    const res = ratio > 0.6 ? worse(classify(n.headDt), 'good') : 'bad';
    const y = n.y + (n.y2 - n.y) * Math.max(0, Math.min(1, ratio));
    this.judgeAs(n, res, n.headDt, this.posAt(n.x, y));
  }

  judgeAs(n, res, dt, pos) {
    n.done = true;
    n.holding = false;
    n.flickBy = null;
    n.result = res;
    this.stats[res]++;
    this.judgedCount++;
    if (res === 'perfect' || res === 'good') {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboPop = 1;
      if (this.combo === 25 || this.combo % 50 === 0) {
        this.lineFlash = 1;
        this.fx.shake(3, 0.18);
        this.cutin = { t: 0, combo: this.combo };
      }
    } else {
      this.combo = 0;
    }
    if (res === 'perfect') this.tpSum += Math.abs(dt) <= TP_EXACT ? 1 : 0.7;
    else if (res === 'good') this.tpSum += 0.3;
    if (res === 'good' || res === 'bad') {
      if (dt < 0) this.stats.early++;
      else this.stats.late++;
    }

    const p = pos || this.posAt(n.x, n.y);
    const c = COLOR[res];
    const r = this.r;
    const nc = this.noteColor(n);
    if (res === 'miss') {
      this.fx.judge(p.x, p.y - r * 1.4, 'miss', n.type === 'drag');
      this.missFlash = 1;
      if (this.lastCombo >= 10) this.breakT = 1;
      this.lastCombo = 0;
      return;
    }
    this.lastCombo = this.combo;
    this.music.hit(n.type, res);
    try { navigator.vibrate?.(res === 'perfect' ? 12 : 6); } catch { /* unsupported */ }
    this.lineHit = 1;
    const big = res === 'perfect';
    if (n.type === 'drag') {
      this.fx.ring(p.x, p.y, nc, r * 0.4, r * 1.4, 0.25, 2.5);
      this.fx.stars(p.x, p.y, 3, '#ffffff', r);
      this.fx.burst(p.x, p.y, nc, 4, 200, 3);
      return;
    }
    this.fx.flash(p.x, p.y, r * (big ? 2 : 1.5));
    if (n.type !== 'hold') this.fx.ghost(this.sprite(n.type, this.noteSide(n)), p.x, p.y);
    this.fx.ring(p.x, p.y, c, r * 0.9, r * (big ? 2.9 : 2.1), big ? 0.45 : 0.32, big ? 5 : 3);
    this.fx.ring(p.x, p.y, nc, r * 0.6, r * (big ? 2 : 1.5), 0.3, 2.5);
    this.fx.stars(p.x, p.y, big ? 8 : 4, big ? '#fff3b0' : '#ffffff', r);
    this.fx.burst(p.x, p.y, nc, big ? 14 : 7, big ? 420 : 260);
    if (big) this.fx.streak(p.x, p.y, nc, r * 4);
    this.fx.judge(p.x, p.y - r * 1.6, res);
    if (n.type === 'flick' || n.type === 'hold' || n.twin !== undefined) {
      this.camPunch = big ? 1 : 0.5;
      if (n.type === 'flick') this.fx.shake(4, 0.14);
    }
  }

  // ---------------------------------------------------------------- input

  hitCandidate(t, x, y) {
    let best = null;
    let bestKey = Infinity;
    const reach = this.r * 1.75;
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t > t + WIN.bad) break;
      if (n.done || n.holding || n.flickBy !== null || n.type === 'drag') continue;
      const dt = t - n.t;
      if (Math.abs(dt) > WIN.bad) continue;
      let d = 0;
      if (x !== null) {
        const p = this.posAt(n.x, n.y);
        d = Math.hypot(p.x - x, p.y - y);
        if (d > reach) continue;
      }
      const key = Math.abs(dt) + d * 0.0005;
      if (key < bestKey) {
        bestKey = key;
        best = n;
      }
    }
    return best;
  }

  press(id, x, y, t, isKey) {
    const ptr = { id, x, y, sx: x, sy: y, hold: null, flick: null };
    const n = this.hitCandidate(t, isKey ? null : x, isKey ? null : y);
    if (!n) {
      if (!isKey) this.fx.ring(x, y, 'rgba(255,255,255,0.6)', 4, this.r * 0.9, 0.2, 2);
      return ptr;
    }
    const dt = t - n.t;
    if (n.type === 'hold') {
      this.beginHold(n, dt);
      ptr.hold = n;
    } else if (n.type === 'flick' && !isKey) {
      n.flickBy = id;
      ptr.flick = { note: n, dt };
    } else {
      this.judgeAs(n, classify(dt), dt);
    }
    return ptr;
  }

  touching(n) {
    const p = this.posAt(n.x, n.y);
    for (const ptr of this.pointers.values()) {
      if (Math.abs(ptr.x - p.x) <= this.r * 2 && Math.abs(ptr.y - p.y) <= this.r * 2.5) return true;
    }
    return false;
  }

  onDown(e) {
    if (this.state !== 'playing') return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const ptr = this.press(e.pointerId, e.clientX, e.clientY, this.eventTime(e), false);
    this.pointers.set(e.pointerId, ptr);
  }

  onMove(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    e.preventDefault();
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    if (ptr.flick && !ptr.flick.note.done && Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy) >= this.r * 0.7) {
      const { note, dt } = ptr.flick;
      ptr.flick = null;
      this.judgeAs(note, classify(dt), dt);
    }
  }

  onUp(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    this.pointers.delete(e.pointerId);
    if (this.state !== 'playing') return;
    if (ptr.hold && !ptr.hold.done) this.releaseHold(ptr.hold, this.eventTime(e));
    if (ptr.flick && !ptr.flick.note.done) ptr.flick.note.flickBy = null;
  }

  // Keyboard assist: any key hits the next note in time, regardless of position.
  keyDown(e) {
    if (this.state !== 'playing') return false;
    const id = `key:${e.code}`;
    if (e.repeat || this.keys.has(id)) return true;
    this.keys.set(id, this.press(id, null, null, this.eventTime(e), true));
    return true;
  }

  keyUp(e) {
    const id = `key:${e.code}`;
    const ptr = this.keys.get(id);
    if (!ptr) return;
    this.keys.delete(id);
    if (this.state === 'playing' && ptr.hold && !ptr.hold.done) this.releaseHold(ptr.hold, this.eventTime(e));
  }

  // ---------------------------------------------------------------- geometry

  posAt(x01, y01) {
    const a = this.area;
    return { x: a.left + x01 * (a.right - a.left), y: a.top + y01 * (a.bottom - a.top) };
  }

  scanAt(t) {
    const c = this.chart;
    const pos = (t - c.origin) / c.pageDur;
    const page = Math.floor(pos);
    const frac = pos - page;
    const up = mod(page, 2) === 0;
    return { page, frac, up, y01: up ? 1 - frac : frac };
  }

  // ---------------------------------------------------------------- rendering

  render() {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.chart || this.state === 'idle') {
      this.drawIdle(g);
      return;
    }
    const t = this.now();
    const beatPhase = mod((t - this.chart.origin) / this.chart.beat, 1);
    const pulse = (1 - beatPhase) ** 3;
    this.drawBackground(g, pulse);
    this.drawCutin(g);
    const sh = this.fx.offset();
    g.save();
    const z = 1 + this.camPunch * 0.012;
    g.translate(this.W / 2 + sh.x, this.H / 2 + sh.y);
    g.scale(z, z);
    g.translate(-this.W / 2, -this.H / 2);
    this.drawField(g, pulse);
    this.drawNotes(g, t);
    this.drawScanLine(g, t, pulse);
    this.fx.draw(g);
    g.restore();
    this.drawHUD(g, t);
    this.drawOverlay(g, t);
  }

  drawBackground(g, pulse = 0) {
    const { W, H } = this;
    const now = performance.now() / 1000;
    if (this.scene) this.scene.draw(g, now, pulse);
    else {
      g.fillStyle = '#070a12';
      g.fillRect(0, 0, W, H);
    }
    // Dim the scene so notes stay readable; the glow grows with the combo.
    g.fillStyle = 'rgba(8, 6, 22, 0.55)';
    g.fillRect(0, 0, W, H);
    const aura = Math.min(1, (this.combo || 0) / 120);
    if (aura > 0) {
      const gr = g.createLinearGradient(0, H, 0, H * 0.55);
      gr.addColorStop(0, this.colors.up);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.12 + aura * 0.18 + pulse * 0.08;
      g.fillStyle = gr;
      g.fillRect(0, H * 0.55, W, H * 0.45);
      g.globalAlpha = 1;
    }
    const pic = this.character && portraitNow(this.character);
    if (pic) {
      const h = H * 0.95;
      const w = (h * pic.img.width) / pic.img.height;
      const bob = Math.sin(now * 1.6) * 4 - pulse * 3;
      g.globalAlpha = 0.2 + pulse * 0.05 + aura * 0.08;
      g.drawImage(pic.img, W - w * 0.92, H - h + 10 + bob, w, h);
      g.globalAlpha = 1;
    }
  }

  // Combo milestone cut-in: the character slides in behind the play field.
  drawCutin(g) {
    if (!this.cutin) return;
    const { W, H } = this;
    const k = this.cutin.t / 1.4;
    const slide = k < 0.14 ? 1 - (1 - k / 0.14) ** 3 : k > 0.78 ? Math.max(0, 1 - (k - 0.78) / 0.22) : 1;
    const y0 = H * 0.3;
    const bh = H * 0.34;
    g.save();
    g.globalAlpha = 0.55 * slide;
    const band = g.createLinearGradient(0, 0, W, 0);
    band.addColorStop(0, this.colors.down);
    band.addColorStop(1, this.colors.up);
    g.fillStyle = band;
    g.beginPath();
    g.moveTo(-40 + (1 - slide) * W, y0 + 30);
    g.lineTo(W + 40, y0);
    g.lineTo(W + 40, y0 + bh - 30);
    g.lineTo(-40 + (1 - slide) * W, y0 + bh);
    g.closePath();
    g.fill();
    g.clip();
    g.globalAlpha = 0.5 * slide;
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) {
      const ly = y0 + ((i * 53) % bh);
      const lx = W - ((this.cutin.t * 2200 + i * 211) % (W * 1.4));
      g.fillRect(lx, ly, 80 + (i % 4) * 40, 2);
    }
    const pic = this.character && portraitNow(this.character);
    if (pic) {
      const h = bh * 2.1;
      const w = (h * pic.img.width) / pic.img.height;
      g.globalAlpha = slide;
      g.drawImage(pic.img, W - w * 0.95 + (1 - slide) * 200, y0 - h * 0.12, w, h);
    }
    g.restore();
    g.save();
    g.globalAlpha = slide;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = `italic 900 ${Math.min(64, W * 0.11)}px ${FONT}`;
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(20,10,40,0.8)';
    const tx = W * 0.08 + (1 - slide) * -120;
    g.strokeText(`${this.cutin.combo}`, tx, y0 + bh * 0.42);
    g.fillStyle = '#ffffff';
    g.fillText(`${this.cutin.combo}`, tx, y0 + bh * 0.42);
    g.font = `italic 800 ${Math.min(24, W * 0.05)}px ${FONT}`;
    g.strokeText('COMBO!', tx + 4, y0 + bh * 0.72);
    g.fillStyle = COLOR.perfect;
    g.fillText('COMBO!', tx + 4, y0 + bh * 0.72);
    g.restore();
  }

  drawIdle(g) {
    const { W, H } = this;
    if (this.scene) {
      this.scene.draw(g, performance.now() / 1000, 0);
      // Darker on the left where the menu text sits.
      const shade = g.createLinearGradient(0, 0, W, 0);
      shade.addColorStop(0, 'rgba(10, 6, 28, 0.62)');
      shade.addColorStop(Math.min(0.9, 700 / W), 'rgba(10, 6, 28, 0.25)');
      shade.addColorStop(1, 'rgba(10, 6, 28, 0.1)');
      g.fillStyle = shade;
      g.fillRect(0, 0, W, H);
      return;
    }
    g.fillStyle = '#070a12';
    g.fillRect(0, 0, W, H);
  }

  drawField(g, pulse) {
    const { W, H, area } = this;
    g.strokeStyle = 'rgba(160, 220, 255, 0.07)';
    g.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const x = area.left + ((area.right - area.left) * i) / 8;
      g.beginPath(); g.moveTo(x, area.top - this.r); g.lineTo(x, area.bottom + this.r); g.stroke();
    }
    g.strokeStyle = 'rgba(160, 220, 255, 0.18)';
    for (const y of [area.top, area.bottom]) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    // Music visualizer along the bottom edge.
    const spec = this.manual ? null : this.music.spectrum();
    if (spec) {
      const n = 48;
      const bw = W / n;
      g.fillStyle = `rgba(94, 242, 255, ${0.07 + pulse * 0.05})`;
      for (let i = 0; i < n; i++) {
        const v = spec[Math.floor((i / n) * spec.length * 0.85)] / 255;
        const h = v * v * H * 0.22;
        g.fillRect(i * bw + 1, H - h, bw - 2, h);
      }
    }
  }

  drawScanLine(g, t, pulse) {
    const { W, area } = this;
    const s = this.scanAt(t);
    const y = area.top + s.y01 * (area.bottom - area.top);
    const color = s.up ? this.colors.up : this.colors.down;
    const glowH = 26 + pulse * 10 + this.lineFlash * 30 + this.lineHit * 8;
    const glow = g.createLinearGradient(0, y - glowH, 0, y + glowH);
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(0.5, color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.22 + pulse * 0.1 + this.lineFlash * 0.4;
    g.fillStyle = glow;
    g.fillRect(0, y - glowH, W, glowH * 2);
    g.globalAlpha = 1;
    g.fillStyle = '#ffffff';
    const th = 2 + pulse * 1.5 + this.lineFlash * 2 + this.lineHit * 1.5;
    g.fillRect(0, y - th / 2, W, th);
    // direction chevrons at both ends
    g.fillStyle = color;
    const dir = s.up ? -1 : 1;
    for (const x of [14, W - 14]) {
      g.beginPath();
      g.moveTo(x - 7, y - dir * 4);
      g.lineTo(x + 7, y - dir * 4);
      g.lineTo(x, y + dir * 8);
      g.closePath();
      g.fill();
    }
  }

  // When a note shows up: one approach ahead on its own, or in "group" mode all of a page's notes
  // flash in together as the sweep before that page begins (Cytus II's Group option).
  spawnAt(n) {
    if (this.settings.spawn === 'group') {
      const pageStart = this.chart.origin + n.page * this.chart.pageDur;
      return Math.min(n.t - 0.4, pageStart - this.chart.pageDur);
    }
    return n.t - this.approach;
  }

  drawNotes(g, t) {
    const vis = [];
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - this.maxLead > t) break;
      if (!n.done && t >= this.spawnAt(n)) vis.push(n);
    }
    const curPage = this.scanAt(t).page;

    // Links: drag chains and simultaneous notes.
    g.lineWidth = 3;
    for (const n of vis) {
      if (n.type === 'drag' && n.next !== undefined) {
        const m = this.notes[n.next];
        if (!m.done && t >= this.spawnAt(m)) {
          const a = this.posAt(n.x, n.y);
          const b = this.posAt(m.x, m.y);
          g.globalAlpha = this.appearAlpha(m, t, curPage) * 0.7;
          g.strokeStyle = this.noteColor(m);
          g.setLineDash([6, 6]);
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
          g.setLineDash([]);
        }
      }
      if (n.twin !== undefined && n.twin > n.id) {
        const m = this.notes[n.twin];
        if (!m.done) {
          const a = this.posAt(n.x, n.y);
          const b = this.posAt(m.x, m.y);
          g.globalAlpha = this.appearAlpha(n, t, curPage) * 0.35;
          g.strokeStyle = '#ffffff';
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
    for (let k = vis.length - 1; k >= 0; k--) this.drawNote(g, vis[k], t, curPage);
    g.globalAlpha = 1;
  }

  noteColor(n) {
    return this.colors[this.noteSide(n)];
  }

  appearAlpha(n, t, curPage) {
    const since = t - this.spawnAt(n);
    if (since < 0) return 0;
    // Pop in with a quick double blink rather than a slow fade.
    let alpha = since < 0.3 && Math.floor(since / 0.075) % 2 ? 0.35 : 1;
    if (n.page > curPage) alpha *= 0.8;
    if (t > n.t && !n.holding) alpha *= Math.max(0.2, 1 - (t - n.t) / WIN.bad);
    return Math.max(0, alpha);
  }

  drawNote(g, n, t, curPage) {
    const R = this.r;
    const p = this.posAt(n.x, n.y);
    const spawn = this.spawnAt(n);
    const since = t - spawn;
    const a = Math.max(0, Math.min(1, since / (n.t - spawn)));
    // Full size from the first frame, with a small kick as it flashes in (no slow growth).
    const scale = 1 + (since < 0.15 ? 0.14 * (1 - since / 0.15) : 0);
    const alpha = this.appearAlpha(n, t, curPage);
    const color = this.noteColor(n);
    g.globalAlpha = alpha;

    if (n.type === 'hold') {
      const p2 = this.posAt(n.x, n.y2);
      const w = R * 0.62;
      const top = Math.min(p.y, p2.y);
      const h = Math.abs(p2.y - p.y);
      const gr = g.createLinearGradient(0, p.y, 0, p2.y);
      gr.addColorStop(0, mix(color, '#100820', 0.3));
      gr.addColorStop(1, 'rgba(20,12,40,0.6)');
      g.fillStyle = gr;
      g.beginPath();
      g.roundRect(p.x - w / 2, top, w, h, w / 2);
      g.fill();
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.stroke();
      // chevrons pointing along the sweep
      const dir = p2.y > p.y ? 1 : -1;
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      for (let y = p.y + dir * R; dir > 0 ? y < p2.y - 6 : y > p2.y + 6; y += dir * R * 0.7) {
        g.beginPath();
        g.moveTo(p.x - w * 0.25, y - dir * 5);
        g.lineTo(p.x, y + dir * 2);
        g.lineTo(p.x + w * 0.25, y - dir * 5);
        g.stroke();
      }
      if (n.holding) {
        const prog = Math.max(0, Math.min(1, (t - n.t) / n.dur));
        const yProg = p.y + (p2.y - p.y) * prog;
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = color;
        g.beginPath();
        g.roundRect(p.x - w / 2 + 3, Math.min(p.y, yProg), w - 6, Math.abs(yProg - p.y), (w - 6) / 2);
        g.fill();
        g.restore();
        if (Math.random() < 0.6) {
          this.fx.burst(p.x, yProg, color, 1, 180, 3);
          if (Math.random() < 0.3) this.fx.stars(p.x, yProg, 1, '#ffffff', R * 0.6);
        }
      }
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(p2.x, p2.y, w * 0.42, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = color;
      g.beginPath();
      g.arc(p2.x, p2.y, w * 0.28, 0, Math.PI * 2);
      g.fill();
    }

    const near = 1 - Math.min(1, Math.abs(t - n.t) / 0.15);
    if (near > 0 && !n.holding && n.type !== 'drag') {
      g.strokeStyle = `rgba(255,255,255,${near * 0.9})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, R * 1.25, 0, Math.PI * 2);
      g.stroke();
    }
    if (n.holding) {
      // Clockwise timer around a held note; the white tip marks how far the hold has got.
      const prog = Math.max(0, Math.min(1, (t - n.t) / n.dur));
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * prog;
      g.lineCap = 'round';
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(255,255,255,0.15)';
      g.beginPath(); g.arc(p.x, p.y, R * 1.3, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = color;
      g.beginPath(); g.arc(p.x, p.y, R * 1.3, start, end); g.stroke();
      g.strokeStyle = '#ffffff';
      g.beginPath(); g.arc(p.x, p.y, R * 1.3, Math.max(start, end - 0.35), end); g.stroke();
      g.lineCap = 'butt';
    }
    const sp = this.sprite(n.type, this.noteSide(n));
    const S = sp.S * scale * (n.holding ? 1.08 : 1);
    g.drawImage(sp.c, p.x - S / 2, p.y - S / 2, S, S);

    // Like Cytus II, a note starts dim and lights up as the scan line closes in.
    const lit = n.holding || t >= n.t ? 1 : a ** 1.6;
    const bodyR = (n.type === 'drag' ? R * 0.62 : R * 0.99) * scale;
    if (lit < 1) {
      g.fillStyle = `rgba(10, 6, 24, ${0.62 * (1 - lit)})`;
      g.beginPath();
      if (n.type === 'drag') {
        const d = bodyR * 0.9;
        g.moveTo(p.x, p.y - d); g.lineTo(p.x + d, p.y); g.lineTo(p.x, p.y + d); g.lineTo(p.x - d, p.y);
      } else {
        g.arc(p.x, p.y, bodyR, 0, Math.PI * 2);
      }
      g.fill();
    }
    // Timing cue: a bright core grows from the centre and fills the note exactly on the beat.
    if (n.type !== 'drag' && !n.holding && t < n.t) {
      const fr = R * 0.74 * scale * a;
      g.fillStyle = mix(color, '#ffffff', 0.55);
      g.globalAlpha = alpha * (0.35 + 0.35 * a);
      g.beginPath(); g.arc(p.x, p.y, fr, 0, Math.PI * 2); g.fill();
      g.globalAlpha = alpha * 0.9;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.beginPath(); g.arc(p.x, p.y, fr, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = alpha;
    }
    // Spawn flash: a white burst the moment the note appears.
    if (since < 0.25) {
      const k = since / 0.25;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.85 * (1 - k) ** 1.5;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(p.x, p.y, bodyR * (0.9 + 0.2 * k), 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.9 * (1 - k);
      g.strokeStyle = color;
      g.lineWidth = 3;
      g.beginPath(); g.arc(p.x, p.y, bodyR * (1 + 0.8 * k), 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    // In the last stretch before the hit a halo swells around it.
    const glow = n.holding ? 0.7 : Math.max(0, (a - 0.6) / 0.4) ** 2;
    if (glow > 0 && n.type !== 'drag') {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const hr = R * scale * (1.3 + 0.5 * glow);
      const halo = g.createRadialGradient(p.x, p.y, R * scale * 0.5, p.x, p.y, hr);
      halo.addColorStop(0, color);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = alpha * 0.5 * glow;
      g.fillStyle = halo;
      g.beginPath();
      g.arc(p.x, p.y, hr, 0, Math.PI * 2);
      g.fill();
      // a soft white rim rather than a fill, so the note's icon stays readable
      g.globalAlpha = alpha * 0.6 * glow;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(p.x, p.y, R * scale * 0.82, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = alpha * 0.12 * glow;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(p.x, p.y, R * scale * 0.76, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  drawHUD(g, t) {
    const { W } = this;
    const { left: sl, right: sr, top: st } = this.safe;
    const c = this.chart;
    const prog = Math.max(0, Math.min(1, t / c.duration));
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, 0, W, 3);
    g.fillStyle = this.colors.up;
    g.fillRect(0, 0, W * prog, 3);

    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = '#e8f4ff';
    g.font = `600 14px ${FONT}`;
    const maxW = Math.max(60, W * 0.3 - 66);
    let title = this.meta.title;
    while (title.length > 3 && g.measureText(title).width > maxW) title = title.slice(0, -2);
    if (title !== this.meta.title) title += '…';
    g.fillText(title, 66 + sl, 27 + st);
    g.font = `800 12px ${FONT}`;
    g.fillStyle = DIFF_COLOR[c.diff];
    g.fillText(`${c.diff.toUpperCase()} ${c.level}${this.autoplay ? '  ·  AUTO' : ''}`, 66 + sl, 46 + st);

    g.textAlign = 'right';
    g.fillStyle = '#ffffff';
    const narrow = W < 560;
    g.font = `800 ${narrow ? 22 : 26}px ${FONT}`;
    g.fillText(String(this.score).padStart(7, '0'), W - 16 - sr, 28 + st);
    g.font = `600 13px ${FONT}`;
    g.fillStyle = '#8ea3b8';
    g.fillText(`TP ${this.tp.toFixed(2)}`, W - 16 - sr, 52 + st);

    // On phones the top row is full, so the combo sits just under it.
    const cy = (narrow ? 86 : 30) + st;
    if (this.breakT > 0 && this.combo < 3) {
      g.textAlign = 'center';
      g.globalAlpha = Math.min(1, this.breakT * 2);
      g.font = `italic 900 ${narrow ? 22 : 28}px ${FONT}`;
      g.fillStyle = '#ff6b8a';
      g.fillText('BREAK', W / 2 + Math.sin(this.breakT * 60) * 4 * this.breakT, cy);
      g.globalAlpha = 1;
    }
    if (this.combo >= 3) {
      const s = 1 + this.comboPop * 0.28;
      g.textAlign = 'center';
      const size = Math.round((narrow ? 26 : 34) * s);
      g.font = `italic 900 ${size}px ${FONT}`;
      const cg = g.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
      cg.addColorStop(0, '#ffffff');
      cg.addColorStop(1, this.combo >= 50 ? COLOR.perfect : this.colors.up);
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(20,10,40,0.7)';
      g.strokeText(String(this.combo), W / 2, cy);
      g.fillStyle = cg;
      g.fillText(String(this.combo), W / 2, cy);
      g.font = `700 10px ${FONT}`;
      g.fillStyle = '#8ea3b8';
      g.fillText('COMBO', W / 2, cy + (narrow ? 22 : 26));
    }
  }

  drawOverlay(g, t) {
    const { W, H } = this;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (this.state === 'playing' && t < -0.4) {
      const k = Math.min(1, (-0.4 - t) / 0.6);
      g.globalAlpha = k;
      g.fillStyle = '#ffffff';
      g.font = `800 ${Math.min(40, W * 0.08)}px ${FONT}`;
      g.fillText(this.meta.title, W / 2, H / 2 - 20, W - 40);
      g.font = `700 14px ${FONT}`;
      g.fillStyle = '#8ea3b8';
      g.fillText(`${Math.round(this.chart.bpm)} BPM  ·  READY`, W / 2, H / 2 + 18);
      g.globalAlpha = 1;
    }
    if (this.missFlash > 0) {
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(255,40,80,0)');
      v.addColorStop(1, `rgba(255,40,80,${0.35 * this.missFlash})`);
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
    }
    if (this.state === 'resume') {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffffff';
      g.font = `800 72px ${FONT}`;
      g.fillText(String(Math.ceil(this.resumeLeft)), W / 2, H / 2);
    }
    if ((this.state === 'ending' || this.state === 'ended') && this.banner) {
      const k = Math.min(1, this.bannerT / 0.35);
      g.globalAlpha = k;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, H / 2 - 50, W, 100);
      const s = 0.8 + 0.2 * easeOutBack(k);
      g.font = `900 ${Math.round(Math.min(48, W * 0.09) * s)}px ${FONT}`;
      g.fillStyle = this.banner === 'TRACK COMPLETE' ? '#ffffff' : COLOR.perfect;
      g.fillText(this.banner, W / 2, H / 2);
      g.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- test hook

  textState() {
    if (!this.chart || this.state === 'idle') return { state: this.state };
    const t = this.now();
    const s = this.scanAt(t);
    const notes = [];
    for (let i = this.cursor; i < this.notes.length && notes.length < 10; i++) {
      const n = this.notes[i];
      if (n.t - this.maxLead > t) break;
      if (n.done || t < this.spawnAt(n)) continue;
      const p = this.posAt(n.x, n.y);
      notes.push({
        id: n.id,
        type: n.type,
        x: Math.round(p.x),
        y: Math.round(p.y),
        hitIn: +(n.t - t).toFixed(3),
        ...(n.type === 'hold' ? { dur: n.dur, holding: n.holding } : {}),
      });
    }
    return {
      state: this.state,
      coords: 'canvas CSS px, origin top-left, +y down',
      t: +t.toFixed(3),
      page: s.page,
      scanY: Math.round(this.posAt(0, s.y01).y),
      scanDir: s.up ? 'up' : 'down',
      score: this.score,
      tp: +this.tp.toFixed(2),
      combo: this.combo,
      maxCombo: this.maxCombo,
      counts: { ...this.stats },
      judged: this.judgedCount,
      total: this.notes.length,
      autoplay: this.autoplay,
      notes,
    };
  }
}
