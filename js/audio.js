// Audio: shared AudioContext, music playback, hit sounds and the synthesized demo song.

let ctx = null;

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
  }
  return ctx;
}

export async function resumeCtx() {
  const c = getCtx();
  if (c.state === 'suspended') {
    try { await c.resume(); } catch { /* ignored: resumed on next gesture */ }
  }
  return c;
}

// decodeAudioData detaches its input, so always hand it a copy.
export function decode(bytes) {
  const c = getCtx();
  const copy = bytes.slice(0);
  return new Promise((resolve, reject) => {
    const p = c.decodeAudioData(copy, resolve, reject);
    if (p && p.then) p.then(resolve, reject);
  });
}

// Seconds between scheduling audio and hearing it.
export function outputLatency() {
  const c = getCtx();
  return c.outputLatency || c.baseLatency || 0;
}

// ---------------------------------------------------------------------------
// Listening chain shared by the music player and gameplay:
//   voice (per-track loudness gain + fades) -> bus -> preamp -> 10-band EQ -> spatial
//   -> master volume -> limiter -> analyser -> speakers

export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_PRESETS = {
  flat: { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  anisong: { name: 'Anisong', gains: [3, 2, 0, -1, 0, 1, 2, 3, 3, 2] },
  pop: { name: 'Pop', gains: [-1, 0, 2, 3, 2, 0, -1, -1, 0, 1] },
  rock: { name: 'Rock', gains: [4, 3, 2, 0, -1, -1, 1, 2, 3, 3] },
  electronic: { name: 'Electronic', gains: [5, 4, 2, 0, -1, 1, 0, 1, 3, 4] },
  vocal: { name: 'Vocal', gains: [-2, -2, -1, 0, 2, 3, 3, 2, 1, 0] },
  bass: { name: 'Bass boost', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  acoustic: { name: 'Acoustic', gains: [2, 2, 1, 0, 1, 1, 2, 2, 2, 1] },
  night: { name: 'Late night', gains: [-2, -1, 0, 0, 0, 0, 0, -1, -2, -3] },
};
export const LOUDNESS_TARGET = -14; // LUFS, the common streaming reference level

export class Music {
  constructor() {
    const c = getCtx();
    this.ctx = c;
    // Upmix everything to stereo so mono files work with the stereo effects.
    this.bus = c.createGain();
    this.bus.channelCount = 2;
    this.bus.channelCountMode = 'explicit';
    this.bus.channelInterpretation = 'speakers';
    this.preamp = c.createGain();
    this.eq = EQ_BANDS.map((f, i) => {
      const b = c.createBiquadFilter();
      b.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
      b.frequency.value = f;
      b.Q.value = 1.1;
      b.gain.value = 0;
      return b;
    });
    this.spatialIn = c.createGain();
    this.spatialOut = c.createGain();
    this.gain = c.createGain();
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -1.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.2;
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.75;
    let node = this.bus.connect(this.preamp);
    for (const b of this.eq) node = node.connect(b);
    node.connect(this.spatialIn);
    this.spatialOut.connect(this.gain).connect(this.limiter).connect(this.analyser).connect(c.destination);
    // A finer analyser for the EQ panel (a tap only, it is not routed to the speakers).
    this.analyserHi = c.createAnalyser();
    this.analyserHi.fftSize = 4096;
    this.analyserHi.smoothingTimeConstant = 0.8;
    this.limiter.connect(this.analyserHi);
    this.freqHi = new Float32Array(this.analyserHi.frequencyBinCount);
    this.spatialNodes = [];
    this.spatial = 'off';
    this.setSpatial('off');

    this.sfx = c.createGain();
    this.sfx.gain.value = 0.55;
    this.sfx.connect(c.destination);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.voice = null;
    this.src = null;
    this.volume = 0.8;
    this.normalize = true;
    this.loudness = new WeakMap();
    this.hitSounds = true;
    this.tapBuf = makeTick(c, 2300, 0.05);
    this.flickBuf = makeTick(c, 3400, 0.07);
    this.chimeBuf = makeChime(c, [1568, 2349, 3136], 0.28);
    this.thudBuf = makeTick(c, 520, 0.08);
  }

  // ---- loudness normalization ----
  loudnessOf(buffer) {
    if (!this.loudness.has(buffer)) this.loudness.set(buffer, measureLoudness(buffer));
    return this.loudness.get(buffer);
  }

  normGainDb(buffer) {
    if (!this.normalize) return 0;
    const l = this.loudnessOf(buffer);
    if (!Number.isFinite(l)) return 0;
    return Math.max(-12, Math.min(8, LOUDNESS_TARGET - l));
  }

  setNormalize(on) {
    this.normalize = on;
    if (this.voice) this.voice.g.gain.setTargetAtTime(10 ** (this.normGainDb(this.voice.buffer) / 20), this.ctx.currentTime, 0.15);
  }

  // ---- voices ----
  startVoice(buffer, when, offset, fadeIn) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    src.connect(g).connect(this.bus);
    const target = 10 ** (this.normGainDb(buffer) / 20);
    const t0 = Math.max(when, c.currentTime);
    if (fadeIn > 0) {
      g.gain.value = 0;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(target, t0 + fadeIn);
    } else {
      g.gain.value = target;
    }
    src.start(when, Math.max(0, offset));
    return { src, g, buffer };
  }

  stopVoice(v, fade = 0) {
    if (!v) return;
    v.src.onended = null;
    const now = this.ctx.currentTime;
    const p = v.g.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    if (fade > 0) {
      p.linearRampToValueAtTime(0, now + fade);
      try { v.src.stop(now + fade + 0.02); } catch { /* not started */ }
    } else {
      try { v.src.stop(); } catch { /* already stopped */ }
    }
    setTimeout(() => { v.src.disconnect(); v.g.disconnect(); }, (fade + 0.2) * 1000);
  }

  // Gameplay playback, scheduled sample-accurately at `when`.
  play(buffer, when, offset = 0) {
    this.stop();
    this.voice = this.startVoice(buffer, when, offset, 0);
    this.src = this.voice.src;
  }

  stop(fade = 0) {
    this.stopVoice(this.voice, fade);
    this.voice = null;
    this.src = null;
  }

  fadeOut(sec) {
    if (!this.voice) return;
    const p = this.voice.g.gain;
    const now = this.ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(0, now + sec);
  }

  // Music-player playback; `fade` crossfades from whatever was playing.
  playTrack(buffer, offset, onEnded, fade = 0.05) {
    const c = this.ctx;
    this.stopVoice(this.voice, fade);
    const off = Math.max(0, Math.min(offset, buffer.duration - 0.05));
    const v = this.startVoice(buffer, c.currentTime, off, fade);
    v.src.onended = () => {
      if (this.voice === v) {
        this.voice = null;
        this.src = null;
        onEnded?.();
      }
    };
    this.voice = v;
    this.src = v.src;
    this.track = { buffer, start: c.currentTime - off };
  }

  trackPosition() {
    if (!this.track || !this.src) return 0;
    return Math.min(this.track.buffer.duration, this.ctx.currentTime - this.track.start);
  }

  setVolume(v) {
    this.volume = v;
    this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  // ---- EQ ----
  setEQ(gains) {
    const now = this.ctx.currentTime;
    gains.forEach((g, i) => this.eq[i].gain.setTargetAtTime(g, now, 0.03));
    // Pull the level down by most of the biggest boost so the limiter rarely has to work.
    const boost = Math.max(0, ...gains);
    this.preamp.gain.setTargetAtTime(10 ** ((-boost * 0.6) / 20), now, 0.03);
  }

  // Combined EQ response in dB at the given frequencies (for drawing the curve).
  eqResponse(freqs) {
    const n = freqs.length;
    const total = new Float32Array(n);
    const mag = new Float32Array(n);
    const ph = new Float32Array(n);
    for (const b of this.eq) {
      b.getFrequencyResponse(freqs, mag, ph);
      for (let i = 0; i < n; i++) total[i] += 20 * Math.log10(mag[i] || 1e-6);
    }
    return total;
  }

  // ---- spatial effects ----
  setSpatial(mode) {
    const c = this.ctx;
    this.spatial = mode;
    this.spatialIn.disconnect();
    for (const n of this.spatialNodes) n.disconnect();
    this.spatialNodes = [];
    const keep = (...ns) => { this.spatialNodes.push(...ns); return ns; };
    const inp = this.spatialIn;
    const out = this.spatialOut;

    if (mode === 'wide' || mode === 'headphone') {
      const split = c.createChannelSplitter(2);
      const merge = c.createChannelMerger(2);
      keep(split, merge);
      inp.connect(split);
      merge.connect(out);
      if (mode === 'wide') {
        // Mid/side widening: L' = aL + bR, R' = bL + aR.
        const w = 1.6, a = (1 + w) / 2, b = (1 - w) / 2;
        const ll = c.createGain(); ll.gain.value = a;
        const rl = c.createGain(); rl.gain.value = b;
        const lr = c.createGain(); lr.gain.value = b;
        const rr = c.createGain(); rr.gain.value = a;
        keep(ll, rl, lr, rr);
        split.connect(ll, 0); ll.connect(merge, 0, 0);
        split.connect(rl, 1); rl.connect(merge, 0, 0);
        split.connect(lr, 0); lr.connect(merge, 0, 1);
        split.connect(rr, 1); rr.connect(merge, 0, 1);
      } else {
        // Headphone crossfeed: each ear hears a delayed, low-passed hint of the other channel,
        // the way speakers would, which makes hard-panned mixes less tiring.
        for (const [from, to] of [[0, 0], [1, 1]]) {
          const d = c.createGain(); d.gain.value = 0.82;
          keep(d);
          split.connect(d, from); d.connect(merge, 0, to);
        }
        for (const [from, to] of [[0, 1], [1, 0]]) {
          const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
          const dl = c.createDelay(0.01); dl.delayTime.value = 0.0003;
          const g = c.createGain(); g.gain.value = 0.32;
          keep(lp, dl, g);
          split.connect(lp, from); lp.connect(dl).connect(g).connect(merge, 0, to);
        }
      }
    } else if (mode === 'hall') {
      const dry = c.createGain(); dry.gain.value = 0.9;
      const conv = c.createConvolver();
      conv.buffer = makeHallIR(c, 2.4);
      const wet = c.createGain(); wet.gain.value = 0.28;
      keep(dry, conv, wet);
      inp.connect(dry).connect(out);
      inp.connect(conv).connect(wet).connect(out);
    } else {
      inp.connect(out);
    }
  }

  // Layered hit sound: a click for every hit, a sparkle chime on top of perfects, a dull thud for bads.
  hit(kind = 'tap', res = 'perfect') {
    if (!this.hitSounds) return;
    const play = (buf, vol) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g).connect(this.sfx);
      src.start();
    };
    if (res === 'bad') {
      play(this.thudBuf, 0.8);
      return;
    }
    play(kind === 'flick' ? this.flickBuf : this.tapBuf, kind === 'drag' ? 0.5 : 1);
    if (res === 'perfect' && kind !== 'drag') play(this.chimeBuf, kind === 'flick' || kind === 'hold' ? 0.5 : 0.28);
  }

  // Fine spectrum in dB, for the EQ panel.
  spectrumHi() {
    this.analyserHi.getFloatFrequencyData(this.freqHi);
    return this.freqHi;
  }

  spectrum() {
    this.analyser.getByteFrequencyData(this.freq);
    return this.freq;
  }
}

function makeChime(c, freqs, len) {
  const n = Math.floor(c.sampleRate * len);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / c.sampleRate;
    let v = 0;
    freqs.forEach((f, k) => { v += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (14 + k * 6)) / (k + 1); });
    d[i] = v * 0.4 * Math.min(1, t * 400);
  }
  return buf;
}

function makeTick(c, freq, len) {
  const n = Math.floor(c.sampleRate * len);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / c.sampleRate;
    const body = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 60);
    const click = (Math.random() * 2 - 1) * Math.exp(-t * 900);
    d[i] = 0.5 * body + 0.35 * click;
  }
  return buf;
}

// Synthetic concert-hall impulse response: decorrelated stereo noise with an exponential tail.
function makeHallIR(c, seconds) {
  const n = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, n, c.sampleRate);
  const pre = Math.floor(c.sampleRate * 0.02);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / c.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.2) * (1 - Math.exp(-t * 60));
    }
  }
  return buf;
}

// Integrated loudness in LUFS following ITU-R BS.1770: K-weighting (high shelf + high pass),
// 400 ms blocks with 75% overlap, -70 LUFS absolute gate and -10 LU relative gate.
export function measureLoudness(buffer) {
  const fs = buffer.sampleRate;
  let K = Math.tan((Math.PI * 1681.974450955533) / fs);
  const Vh = 10 ** (3.999843853973347 / 20);
  const Vb = Vh ** 0.4996667741545416;
  let Q = 0.7071752369554196;
  let a0 = 1 + K / Q + K * K;
  const s1 = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0, b1: (2 * (K * K - Vh)) / a0, b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0,
  };
  K = Math.tan((Math.PI * 38.13547087602444) / fs);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  const s2 = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };

  const step = Math.floor(fs * 0.1);
  const nSub = Math.floor(buffer.length / step);
  if (nSub < 4) return -Infinity;
  const sub = new Float64Array(nSub);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const x = buffer.getChannelData(ch);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0;
    for (let b = 0; b < nSub; b++) {
      let acc = 0;
      const end = (b + 1) * step;
      for (let i = b * step; i < end; i++) {
        const v = x[i];
        const y = s1.b0 * v + s1.b1 * x1 + s1.b2 * x2 - s1.a1 * y1 - s1.a2 * y2;
        x2 = x1; x1 = v;
        const z = s2.b0 * y + s2.b1 * y1 + s2.b2 * y2 - s2.a1 * z1 - s2.a2 * z2;
        y2 = y1; y1 = y;
        z2 = z1; z1 = z;
        acc += z * z;
      }
      sub[b] += acc / step;
    }
  }
  const blocks = [];
  for (let b = 0; b + 3 < nSub; b++) blocks.push((sub[b] + sub[b + 1] + sub[b + 2] + sub[b + 3]) / 4);
  const lufs = (p) => -0.691 + 10 * Math.log10(p);
  const abs = blocks.filter((p) => lufs(p) > -70);
  if (!abs.length) return -Infinity;
  const rel = lufs(abs.reduce((a, p) => a + p, 0) / abs.length) - 10;
  const gated = abs.filter((p) => lufs(p) > rel);
  return lufs(gated.reduce((a, p) => a + p, 0) / gated.length);
}

// ---------------------------------------------------------------------------
// Demo song: a 60-second electronic track rendered offline, so the game is
// playable before anything is imported (and the analyzer has a known input).

export async function renderDemoSong() {
  const bpm = 128;
  const beat = 60 / bpm;
  const bars = 32;
  const sr = 44100;
  const length = Math.ceil((bars * 4 * beat + 2.5) * sr);
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new OC(2, length, sr);

  const comp = oc.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  const master = oc.createGain();
  master.gain.value = 0.7;
  master.connect(comp);
  comp.connect(oc.destination);

  const noise = oc.createBuffer(1, sr, sr);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const env = (g, t, peak, attack, decay) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };

  const kick = (t, v = 1) => {
    const o = oc.createOscillator();
    const g = oc.createGain();
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    env(g, t, v, 0.003, 0.34);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.4);
  };

  const noiseHit = (t, hp, peak, decay, offset = 0) => {
    const s = oc.createBufferSource();
    s.buffer = noise;
    const f = oc.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = oc.createGain();
    env(g, t, peak, 0.002, decay);
    s.connect(f).connect(g).connect(master);
    s.start(t, offset);
    s.stop(t + decay + 0.05);
  };

  const snare = (t, v = 0.5) => {
    noiseHit(t, 1400, v, 0.18, 0.3);
    const o = oc.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 190;
    const g = oc.createGain();
    env(g, t, v * 0.7, 0.002, 0.09);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.15);
  };

  const hat = (t, v = 0.12, open = false) => noiseHit(t, 7500, v, open ? 0.22 : 0.035, 0.6);
  const crash = (t) => noiseHit(t, 3500, 0.22, 1.6, 0.1);

  const tone = (t, freq, dur, type, vol, cutoff = 4000) => {
    const o = oc.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = oc.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(f).connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.1);
  };

  const pad = (t, freqs, dur, vol = 0.035) => {
    for (const fr of freqs) {
      for (const det of [-7, 0, 7]) {
        const o = oc.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = fr;
        o.detune.value = det;
        const f = oc.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1300;
        const g = oc.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.25);
        g.gain.setValueAtTime(vol, t + dur - 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
        o.connect(f).connect(g).connect(master);
        o.start(t);
        o.stop(t + dur + 0.5);
      }
    }
  };

  // Am - F - C - G
  const chords = [
    { root: 110.0, tones: [220.0, 261.63, 329.63] },
    { root: 87.31, tones: [174.61, 220.0, 261.63] },
    { root: 130.81, tones: [261.63, 329.63, 392.0] },
    { root: 98.0, tones: [196.0, 246.94, 293.66] },
  ];
  const melodyRhythm = [1, 0, 1, 0, 1, 1, 0, 1];
  const melodySteps = [2, 0, 1, 0, 2, 1, 0, 0];

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat;
    const ch = chords[bar % 4];
    const at = (b) => t0 + b * beat;

    if (bar < 8) {
      // Intro: pad, soft hats, plucked quarter notes, kicks join halfway.
      pad(t0, ch.tones, 4 * beat);
      for (let e = 0; e < 8; e++) hat(at(e / 2), e % 2 ? 0.05 : 0.08);
      for (let q = 0; q < 4; q++) tone(at(q), ch.tones[(q + bar) % 3] * 2, beat * 0.5, 'triangle', 0.16);
      if (bar >= 4) { kick(at(0), 0.8); kick(at(2), 0.7); }
    } else if (bar < 16) {
      // Build: four-on-the-floor, backbeat, bass and melody.
      for (let q = 0; q < 4; q++) kick(at(q));
      snare(at(1)); snare(at(3));
      for (let e = 0; e < 8; e++) hat(at(e / 2), e % 2 ? 0.07 : 0.11);
      for (let e = 0; e < 8; e++) tone(at(e / 2), ch.root, beat * 0.4, 'sawtooth', 0.12, 500);
      for (let e = 0; e < 8; e++) {
        if (melodyRhythm[e]) tone(at(e / 2), ch.tones[melodySteps[e]] * 2, beat * 0.45, 'square', 0.07, 2600);
      }
      if (bar === 15) for (let s = 0; s < 8; s++) snare(at(2 + s / 4), 0.2 + s * 0.05);
    } else if (bar < 28) {
      // Drop: everything, 16th arps, crashes every 4 bars.
      if (bar % 4 === 0) crash(at(0));
      for (let q = 0; q < 4; q++) kick(at(q));
      snare(at(1)); snare(at(3));
      for (let s = 0; s < 16; s++) hat(at(s / 4), s % 4 === 2 ? 0.1 : 0.05, s % 4 === 2);
      for (let e = 0; e < 8; e++) if (e % 2) tone(at(e / 2), ch.root, beat * 0.4, 'sawtooth', 0.14, 600);
      for (let s = 0; s < 16; s++) {
        const idx = [0, 1, 2, 1][s % 4];
        tone(at(s / 4), ch.tones[idx] * 4, beat * 0.2, 'square', 0.035, 3500);
      }
      // A long lead note on the first half of every other bar gives the chart some holds.
      if (bar % 2 === 0) tone(at(0), ch.tones[2] * 2, beat * 2, 'sawtooth', 0.08, 2200);
      else tone(at(2), ch.tones[1] * 2, beat * 1, 'sawtooth', 0.08, 2200);
    } else {
      // Outro.
      if (bar === 28) crash(at(0));
      pad(t0, ch.tones, 4 * beat, 0.04);
      kick(at(0), 0.9);
      if (bar < 31) kick(at(2), 0.6);
      for (let q = 0; q < 4; q++) tone(at(q), ch.tones[(3 - q + 3) % 3] * 2, beat * 0.6, 'triangle', 0.13);
    }
  }

  return oc.startRendering();
}
