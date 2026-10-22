// "Sound" panel: draggable 10-band EQ curve over a live spectrum, presets, loudness normalization,
// spatial mode and crossfade length. Settings live in settings.fx and persist via onChange.

import { EQ_BANDS, EQ_PRESETS, LOUDNESS_TARGET } from './audio.js';

const $ = (id) => document.getElementById(id);
const MIN_F = 20;
const MAX_F = 20000;
const RANGE = 12;
const SPATIAL_NAMES = { off: 'Stereo', wide: 'Wide', headphone: 'Headphone', hall: 'Live hall' };
const fmtF = (f) => (f >= 1000 ? `${f / 1000}k` : String(f));

export class SoundPanel {
  constructor(music, settings, onChange) {
    this.music = music;
    this.settings = settings;
    this.onChange = onChange;
    this.canvas = $('eq-canvas');
    this.g = this.canvas.getContext('2d');
    this.sel = 5;
    this.drag = false;
    this.freqs = new Float32Array(240);
    for (let i = 0; i < this.freqs.length; i++) this.freqs[i] = MIN_F * (MAX_F / MIN_F) ** (i / (this.freqs.length - 1));

    const chips = $('eq-presets');
    for (const [key, p] of Object.entries(EQ_PRESETS)) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.preset = key;
      b.textContent = p.name;
      b.addEventListener('click', () => this.setPreset(key));
      chips.append(b);
    }
    $('fx-normalize').addEventListener('change', (e) => { this.fx.normalize = e.target.checked; this.commit(); });
    for (const b of $('fx-spatial').children) {
      b.addEventListener('click', () => { this.fx.spatial = b.dataset.mode; this.commit(); });
    }
    $('fx-xfade').addEventListener('input', (e) => { this.fx.crossfade = +e.target.value; this.commit(); });
    $('eq-reset').addEventListener('click', () => this.setPreset('flat'));

    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      c.focus();
      c.setPointerCapture(e.pointerId);
      this.drag = true;
      this.sel = this.nearestBand(e);
      this.dragTo(e);
    });
    c.addEventListener('pointermove', (e) => { if (this.drag) this.dragTo(e); });
    const end = () => { this.drag = false; };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') this.sel = Math.max(0, Math.min(9, this.sel + (k === 'ArrowLeft' ? -1 : 1)));
      else if (k === 'ArrowUp' || k === 'ArrowDown') this.setBand(this.sel, this.fx.gains[this.sel] + (k === 'ArrowUp' ? 0.5 : -0.5));
      else return;
      e.preventDefault();
    });
  }

  get fx() {
    return this.settings.fx;
  }

  apply() {
    const m = this.music;
    m.setEQ(this.fx.gains);
    if (m.normalize !== this.fx.normalize) m.setNormalize(this.fx.normalize);
    if (m.spatial !== this.fx.spatial) m.setSpatial(this.fx.spatial);
  }

  commit() {
    this.apply();
    this.sync();
    this.onChange();
  }

  setPreset(key) {
    this.fx.preset = key;
    this.fx.gains = [...EQ_PRESETS[key].gains];
    this.commit();
  }

  setBand(i, db) {
    this.fx.gains[i] = Math.round(Math.max(-RANGE, Math.min(RANGE, db)) * 2) / 2;
    this.fx.preset = 'custom';
    this.commit();
  }

  summary() {
    const p = EQ_PRESETS[this.fx.preset];
    return `${p ? p.name : 'Custom EQ'} · ${SPATIAL_NAMES[this.fx.spatial]}${this.fx.normalize ? ' · Normalized' : ''}`;
  }

  sync() {
    for (const b of $('eq-presets').children) b.classList.toggle('on', b.dataset.preset === this.fx.preset);
    $('fx-normalize').checked = this.fx.normalize;
    for (const b of $('fx-spatial').children) b.classList.toggle('on', b.dataset.mode === this.fx.spatial);
    $('fx-xfade').value = this.fx.crossfade;
    $('xfade-val').textContent = this.fx.crossfade ? `${this.fx.crossfade} s` : 'Off';
    const v = this.music.voice;
    if (v && this.fx.normalize) {
      const l = this.music.loudnessOf(v.buffer);
      const gdb = this.music.normGainDb(v.buffer);
      $('fx-loud').textContent = Number.isFinite(l)
        ? `This song: ${l.toFixed(1)} LUFS → ${gdb >= 0 ? '+' : ''}${gdb.toFixed(1)} dB (target ${LOUDNESS_TARGET} LUFS)`
        : '';
    } else {
      $('fx-loud').textContent = `Every song is levelled to ${LOUDNESS_TARGET} LUFS.`;
    }
  }

  // ---------------------------------------------------------------- drawing & hit-testing

  layout() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { w, h, l: 34, r: w - 10, t: 12, b: h - 22 };
  }

  xOf(f, L) {
    return L.l + ((L.r - L.l) * Math.log(f / MIN_F)) / Math.log(MAX_F / MIN_F);
  }

  yOf(db, L) {
    return L.t + ((L.b - L.t) * (RANGE - db)) / (2 * RANGE);
  }

  nearestBand(e) {
    const L = this.layout();
    const x = e.clientX - this.canvas.getBoundingClientRect().left;
    let best = 0, bd = Infinity;
    EQ_BANDS.forEach((f, i) => {
      const d = Math.abs(this.xOf(f, L) - x);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  dragTo(e) {
    const L = this.layout();
    const y = e.clientY - this.canvas.getBoundingClientRect().top;
    this.setBand(this.sel, RANGE - ((y - L.t) / (L.b - L.t)) * 2 * RANGE);
  }

  draw() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const L = this.layout();
    if (!L.w) return;
    if (c.width !== Math.round(L.w * dpr) || c.height !== Math.round(L.h * dpr)) {
      c.width = Math.round(L.w * dpr);
      c.height = Math.round(L.h * dpr);
    }
    const g = this.g;
    const css = getComputedStyle(document.documentElement);
    const c1 = css.getPropertyValue('--cyan').trim() || '#4fd8ff';
    const c2 = css.getPropertyValue('--pink').trim() || '#9b7bff';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    g.beginPath();
    g.roundRect(0, 0, L.w, L.h, 14);
    g.fill();

    // Live spectrum behind the curve: one bar per 3 px, taking the loudest bin under each bar.
    const spec = this.music.spectrumHi();
    const binHz = this.music.ctx.sampleRate / 2 / spec.length;
    g.fillStyle = c2;
    g.globalAlpha = 0.22;
    for (let x = L.l; x < L.r; x += 3) {
      const f0 = MIN_F * (MAX_F / MIN_F) ** ((x - L.l) / (L.r - L.l));
      const f1 = MIN_F * (MAX_F / MIN_F) ** ((x + 3 - L.l) / (L.r - L.l));
      let db = -Infinity;
      for (let k = Math.floor(f0 / binHz); k <= Math.ceil(f1 / binHz) && k < spec.length; k++) db = Math.max(db, spec[k]);
      const v = Math.max(0, Math.min(1, (db + 95) / 75));
      const hgt = v * (L.b - L.t);
      g.fillRect(x, L.b - hgt, 2, hgt);
    }
    g.globalAlpha = 1;

    // grid
    g.font = '600 10px "M PLUS Rounded 1c", system-ui, sans-serif';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (const db of [12, 6, 0, -6, -12]) {
      const y = this.yOf(db, L);
      g.strokeStyle = db === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(L.l, y); g.lineTo(L.r, y); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillText(`${db > 0 ? '+' : ''}${db}`, L.l - 6, y);
    }
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    for (const f of EQ_BANDS) {
      const x = this.xOf(f, L);
      g.strokeStyle = 'rgba(255,255,255,0.06)';
      g.beginPath(); g.moveTo(x, L.t); g.lineTo(x, L.b); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillText(fmtF(f), x, L.h - 6);
    }

    // response curve
    const resp = this.music.eqResponse(this.freqs);
    const grad = g.createLinearGradient(L.l, 0, L.r, 0);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    g.beginPath();
    for (let i = 0; i < this.freqs.length; i++) {
      const x = this.xOf(this.freqs[i], L);
      const y = this.yOf(Math.max(-RANGE, Math.min(RANGE, resp[i])), L);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.strokeStyle = grad;
    g.lineWidth = 3;
    g.stroke();
    g.lineTo(L.r, this.yOf(0, L));
    g.lineTo(L.l, this.yOf(0, L));
    g.closePath();
    g.globalAlpha = 0.18;
    g.fillStyle = grad;
    g.fill();
    g.globalAlpha = 1;

    // band handles
    EQ_BANDS.forEach((f, i) => {
      const x = this.xOf(f, L);
      const y = this.yOf(this.fx.gains[i], L);
      const on = i === this.sel;
      g.fillStyle = on ? '#ffffff' : '#1d1440';
      g.strokeStyle = on ? c1 : '#ffffff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, on ? 7 : 5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (on) {
        const v = this.fx.gains[i];
        g.fillStyle = '#ffffff';
        g.font = '800 11px "M PLUS Rounded 1c", system-ui, sans-serif';
        g.fillText(`${fmtF(f)}Hz ${v > 0 ? '+' : ''}${v.toFixed(1)}dB`, Math.max(L.l + 40, Math.min(L.r - 40, x)), y < L.t + 24 ? y + 22 : y - 12);
      }
    });
  }
}
