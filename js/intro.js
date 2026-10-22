// Opening sequence: a ~10 second in-engine "anime OP" drawn on the game canvas with a synthesized
// soundtrack. Boot scan -> glitch logo -> one cut per character -> group shot -> menu.

import { CHARACTERS, portraitNow, drawPortrait } from './characters.js';
import { sceneFor } from './scenes.js';

const FONT = '"M PLUS Rounded 1c", "Avenir Next", "Segoe UI", system-ui, sans-serif';
const LOGO_AT = 1.4;
const CUTS_AT = 3.0;
const CUT_LEN = 0.9;
const FINALE_AT = CUTS_AT + CHARACTERS.length * CUT_LEN;
export const INTRO_LENGTH = FINALE_AT + 2.6;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;

export class Intro {
  constructor(music) {
    this.music = music;
    this.active = false;
  }

  start(onDone) {
    this.onDone = onDone;
    this.t0 = performance.now();
    this.active = true;
    this.playSoundtrack();
  }

  skip() {
    if (!this.active) return;
    this.active = false;
    if (this.out) {
      const g = this.out.gain;
      const now = this.music.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.3);
      setTimeout(() => this.out && this.out.disconnect(), 400);
    }
    this.onDone?.();
  }

  // ---------------------------------------------------------------- soundtrack
  playSoundtrack() {
    const ctx = this.music.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.55 * this.music.volume;
    out.connect(ctx.destination);
    this.out = out;
    const T = ctx.currentTime + 0.05;
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    const env = (gn, t, peak, a, d) => {
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(peak, t + a);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    };
    const kick = (t, v = 1) => {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      env(gn, t, v, 0.003, 0.4);
      o.connect(gn).connect(out);
      o.start(t);
      o.stop(t + 0.5);
    };
    const tone = (t, f, d, type, v, cutoff = 3000) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const fl = ctx.createBiquadFilter();
      fl.frequency.value = cutoff;
      const gn = ctx.createGain();
      env(gn, t, v, 0.01, d);
      o.connect(fl).connect(gn).connect(out);
      o.start(t);
      o.stop(t + d + 0.1);
    };
    const riser = (t, d) => {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      const fl = ctx.createBiquadFilter();
      fl.type = 'bandpass';
      fl.frequency.setValueAtTime(300, t);
      fl.frequency.exponentialRampToValueAtTime(6000, t + d);
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(0.35, t + d);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
      s.connect(fl).connect(gn).connect(out);
      s.start(t);
      s.stop(t + d + 0.1);
    };
    const pad = (t, freqs, d, v = 0.05) => {
      for (const f of freqs) for (const det of [-8, 8]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const fl = ctx.createBiquadFilter();
        fl.frequency.value = 1500;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(0.0001, t);
        gn.gain.exponentialRampToValueAtTime(v, t + 0.3);
        gn.gain.setValueAtTime(v, t + d - 0.3);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(fl).connect(gn).connect(out);
        o.start(t);
        o.stop(t + d + 0.05);
      }
    };

    riser(T, LOGO_AT);
    kick(T + LOGO_AT, 1);
    tone(T + LOGO_AT, 880, 1.2, 'triangle', 0.25);
    tone(T + LOGO_AT, 1320, 1.0, 'triangle', 0.15);
    pad(T + LOGO_AT, [220, 277.18, 329.63], CUTS_AT - LOGO_AT + 0.2);
    const chords = [[220, 277.18, 329.63], [185, 233.08, 277.18], [246.94, 311.13, 369.99], [207.65, 261.63, 311.13]];
    const step = CUT_LEN / 8;
    CHARACTERS.forEach((_, i) => {
      const t = T + CUTS_AT + i * CUT_LEN;
      kick(t, 1);
      kick(t + CUT_LEN / 2, 0.7);
      pad(t, chords[i % 4], CUT_LEN + 0.1, 0.04);
      for (let k = 0; k < 8; k++) tone(t + k * step, chords[i % 4][k % 3] * (k % 2 ? 4 : 2), step * 0.9, 'square', 0.05, 4000);
    });
    const tf = T + FINALE_AT;
    riser(tf - 0.6, 0.6);
    kick(tf, 1);
    pad(tf, [220, 277.18, 329.63, 440], 2.4, 0.05);
    tone(tf, 1760, 1.6, 'triangle', 0.12);
  }

  // ---------------------------------------------------------------- drawing
  draw(g, W, H) {
    const t = (performance.now() - this.t0) / 1000;
    if (t >= INTRO_LENGTH) {
      this.skip();
      return;
    }
    g.fillStyle = '#06030f';
    g.fillRect(0, 0, W, H);
    if (t < LOGO_AT) this.drawBoot(g, W, H, t);
    else if (t < CUTS_AT) this.drawLogo(g, W, H, t - LOGO_AT);
    else if (t < FINALE_AT) {
      const i = Math.floor((t - CUTS_AT) / CUT_LEN);
      this.drawCut(g, W, H, CHARACTERS[i], (t - CUTS_AT - i * CUT_LEN) / CUT_LEN, i);
    } else this.drawFinale(g, W, H, t - FINALE_AT);

    // White flash on every cut.
    const cuts = [LOGO_AT, ...CHARACTERS.map((_, i) => CUTS_AT + i * CUT_LEN), FINALE_AT];
    for (const c of cuts) {
      const d = t - c;
      if (d >= 0 && d < 0.18) {
        g.fillStyle = `rgba(255,255,255,${0.75 * (1 - d / 0.18)})`;
        g.fillRect(0, 0, W, H);
      }
    }
    // Fade out to the menu.
    const fade = clamp01((t - (INTRO_LENGTH - 0.5)) / 0.5);
    if (fade > 0) {
      g.fillStyle = `rgba(6,3,15,${fade})`;
      g.fillRect(0, 0, W, H);
    }
  }

  drawBoot(g, W, H, t) {
    const k = easeOut(t / LOGO_AT);
    const y = H * k;
    g.strokeStyle = 'rgba(120, 200, 255, 0.12)';
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 48) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, y); g.stroke();
    }
    for (let yy = 0; yy < y; yy += 48) {
      g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke();
    }
    const glow = g.createLinearGradient(0, y - 40, 0, y + 40);
    glow.addColorStop(0, 'rgba(79,216,255,0)');
    glow.addColorStop(0.5, 'rgba(79,216,255,0.5)');
    glow.addColorStop(1, 'rgba(79,216,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, y - 40, W, 80);
    g.fillStyle = '#ffffff';
    g.fillRect(0, y - 1.5, W, 3);
    const msg = 'SYSTEM // SCANLINE  ·  SYNCING HEARTBEAT...';
    g.font = `700 13px ${FONT}`;
    g.fillStyle = 'rgba(160, 220, 255, 0.8)';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(msg.slice(0, Math.floor(msg.length * clamp01(t / 1.1))), 24, H - 28);
  }

  logo(g, W, cy, size, jitter, alpha = 1) {
    g.save();
    g.globalAlpha = alpha;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `italic 900 ${size}px ${FONT}`;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = '#4fd8ff';
    g.fillText('SCANLINE', W / 2 - jitter, cy);
    g.fillStyle = '#ff5fb7';
    g.fillText('SCANLINE', W / 2 + jitter, cy);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#ffffff';
    g.fillText('SCANLINE', W / 2, cy);
    g.restore();
  }

  drawLogo(g, W, H, t) {
    const glow = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    glow.addColorStop(0, 'rgba(120, 80, 255, 0.45)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    const size = Math.min(W * 0.13, 120) * (1 + 0.15 * (1 - easeOut(t / 0.4)));
    const jitter = Math.max(0, 14 * (1 - t / 0.8)) * (Math.random() < 0.5 ? 1 : -1);
    // glitch slices
    this.logo(g, W, H / 2, size, jitter);
    if (t < 0.8 && Math.random() < 0.6) {
      const sy = H / 2 + (Math.random() - 0.5) * size;
      g.fillStyle = Math.random() < 0.5 ? 'rgba(79,216,255,0.35)' : 'rgba(255,95,183,0.35)';
      g.fillRect(W * 0.2 + (Math.random() - 0.5) * 40, sy, W * 0.6, 3 + Math.random() * 8);
    }
    g.globalAlpha = clamp01((t - 0.4) / 0.4);
    g.font = `800 ${Math.min(18, W * 0.035)}px ${FONT}`;
    g.fillStyle = '#d8ccff';
    g.textAlign = 'center';
    g.fillText('EVERY SONG BECOMES A STAGE', W / 2, H / 2 + size * 0.75);
    g.globalAlpha = 1;
  }

  drawCut(g, W, H, ch, k, i) {
    const c = ch.colors;
    // Character's own world in the background.
    const scene = sceneFor(ch);
    scene.resize(W, H, Math.min(window.devicePixelRatio || 1, 2));
    scene.draw(g, performance.now() / 1000, 0.5);
    g.fillStyle = 'rgba(10, 5, 25, 0.35)';
    g.fillRect(0, 0, W, H);
    // Diagonal colour band.
    const s = easeOut(k / 0.25);
    g.save();
    g.globalAlpha = 0.85;
    const band = g.createLinearGradient(0, 0, W, H);
    band.addColorStop(0, c.primary);
    band.addColorStop(1, c.secondary);
    g.fillStyle = band;
    const dir = i % 2 ? 1 : -1;
    g.beginPath();
    g.moveTo(W * (0.5 + dir * 0.15) - (1 - s) * W * dir, 0);
    g.lineTo(W * (0.5 + dir * 0.15) + W * 0.28 * dir * -1 - (1 - s) * W * dir, H);
    g.lineTo(dir > 0 ? 0 : W, H);
    g.lineTo(dir > 0 ? 0 : W, 0);
    g.closePath();
    g.fill();
    g.restore();
    // Speed lines.
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let n = 0; n < 18; n++) {
      const ly = (n * 97) % H;
      const lx = ((k * 3 + n * 0.37) % 1) * W * 1.6 - W * 0.3;
      g.fillRect(dir > 0 ? W - lx : lx, ly, 120 + (n % 5) * 40, 2);
    }
    // Portrait slides in from the opposite side and drifts.
    const portraitMode = H > W;
    const pic = portraitNow(ch);
    if (pic) {
      // Illustration cards float centred vertically; drawn busts stand on the bottom edge.
      const h = pic.custom ? (portraitMode ? H * 0.6 : H * 0.86) : portraitMode ? H * 0.68 : H * 1.02;
      const w = (h * pic.img.width) / pic.img.height;
      const enter = easeOut(k / 0.3);
      const x = dir > 0 ? W * 0.96 - w + (1 - enter) * W * 0.4 - k * 20 : W * 0.04 - (1 - enter) * W * 0.4 + k * 20;
      drawPortrait(g, pic, x, pic.custom ? (H - h) / 2 + (portraitMode ? H * 0.12 : 0) : H - h + 10, w, h);
    }
    // Name card.
    const tx = portraitMode ? W * 0.07 : dir > 0 ? W * 0.07 : W * 0.93 - Math.min(W * 0.45, 420);
    const nameY = portraitMode ? H * 0.24 : H * 0.62;
    const enterText = easeOut((k - 0.08) / 0.3);
    g.save();
    g.globalAlpha = enterText;
    g.translate((1 - enterText) * -60 * (dir > 0 ? 1 : -1), 0);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = `900 ${Math.min(W * 0.2, 180)}px ${FONT}`;
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillText(ch.name, tx, nameY - Math.min(W * 0.11, 92) * 0.8);
    g.font = `italic 900 ${Math.min(W * 0.11, 92)}px ${FONT}`;
    g.lineWidth = 8;
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(20,10,40,0.8)';
    g.strokeText(ch.en.toUpperCase(), tx, nameY);
    g.fillStyle = '#ffffff';
    g.fillText(ch.en.toUpperCase(), tx, nameY);
    g.font = `800 ${Math.min(W * 0.035, 22)}px ${FONT}`;
    g.fillStyle = c.accent === c.primary ? '#ffffff' : c.accent;
    g.fillText(ch.title.toUpperCase(), tx + 4, nameY + Math.min(W * 0.06, 40));
    g.restore();
  }

  drawFinale(g, W, H, t) {
    const glow = g.createLinearGradient(0, 0, 0, H);
    glow.addColorStop(0, '#1a0f3d');
    glow.addColorStop(1, '#3b1a5a');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    const n = CHARACTERS.length;
    // Fit the whole line-up across the screen, each figure overlapping the next a little.
    const aspect = 0.7;
    const h = Math.min(H * 0.6, (W * 0.94) / ((n - 1) * 0.72 + 1) / aspect);
    CHARACTERS.forEach((ch, i) => {
      const pic = portraitNow(ch);
      if (!pic) return;
      const w = (h * pic.img.width) / pic.img.height;
      const rise = easeOut((t - i * 0.08) / 0.5);
      const x = W / 2 + (i - (n - 1) / 2) * w * 0.72 - w / 2;
      g.globalAlpha = rise;
      drawPortrait(g, pic, x, H - h * rise - (pic.custom ? H * 0.06 : -6), w, h);
    });
    g.globalAlpha = 1;
    this.logo(g, W, H * 0.2, Math.min(W * 0.11, 96), 2 * Math.sin(t * 30), easeOut(t / 0.4));
    g.globalAlpha = clamp01((t - 0.6) / 0.4) * (0.6 + 0.4 * Math.sin(t * 6));
    g.font = `900 ${Math.min(W * 0.05, 30)}px ${FONT}`;
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.fillText('READY?', W / 2, H * 0.32);
    g.globalAlpha = 1;
  }
}
