// Music analysis for auto-charting.
// 1. Mix to mono and downsample to ~22 kHz.
// 2. STFT -> log-magnitude spectral flux in three bands (low / mid / high) + RMS energy.
// 3. Onset strength envelope -> tempo by autocorrelation, then a fine comb search for BPM + beat phase.
// 4. Peak-pick onsets (time, strength, dominant band) and keep a 20 Hz energy envelope.

const N = 1024;
const HOP = 256;
const ENERGY_RATE = 20;

const tick = () => new Promise((r) => setTimeout(r, 0));

function makeFFT(n) {
  const bits = Math.log2(n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  return (re, im) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size *= 2) {
      const half = size / 2;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tre = re[l] * cos[k] + im[l] * sin[k];
          const tim = im[l] * cos[k] - re[l] * sin[k];
          re[l] = re[j] - tre;
          im[l] = im[j] - tim;
          re[j] += tre;
          im[j] += tim;
        }
      }
    }
  };
}

function percentile(arr, p) {
  const s = Float32Array.from(arr).sort();
  if (!s.length) return 0;
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
}

export async function analyzeBuffer(buffer, onProgress = () => {}) {
  // ---- 1. mono + downsample ----
  const factor = Math.max(1, Math.round(buffer.sampleRate / 22050));
  const sr = buffer.sampleRate / factor;
  const chans = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
  const len = Math.floor(buffer.length / factor);
  const x = new Float32Array(len);
  const norm = 1 / (factor * chans.length);
  for (let i = 0; i < len; i++) {
    let s = 0;
    const base = i * factor;
    for (const ch of chans) for (let k = 0; k < factor; k++) s += ch[base + k];
    x[i] = s * norm;
  }

  // ---- 2. STFT features ----
  const frames = Math.max(0, Math.floor((len - N) / HOP) + 1);
  const hopSec = HOP / sr;
  const fft = makeFFT(N);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const binHz = sr / N;
  const b1 = Math.max(2, Math.round(200 / binHz));
  const b2 = Math.round(2000 / binHz);
  const b3 = Math.min(N / 2, Math.round(Math.min(9000, sr / 2) / binHz));
  const fluxL = new Float32Array(frames);
  const fluxM = new Float32Array(frames);
  const fluxH = new Float32Array(frames);
  const rms = new Float32Array(frames);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let prev = new Float64Array(N / 2);
  let cur = new Float64Array(N / 2);

  for (let f = 0; f < frames; f++) {
    const off = f * HOP;
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = x[off + i];
      e += v * v;
      re[i] = v * win[i];
      im[i] = 0;
    }
    rms[f] = Math.sqrt(e / N);
    fft(re, im);
    let l = 0, m = 0, h = 0;
    for (let k = 1; k < b3; k++) {
      const mag = Math.log1p(Math.sqrt(re[k] * re[k] + im[k] * im[k]) * 4);
      cur[k] = mag;
      const d = mag - prev[k];
      if (d > 0) {
        if (k < b1) l += d;
        else if (k < b2) m += d;
        else h += d;
      }
    }
    fluxL[f] = l / b1;
    fluxM[f] = m / (b2 - b1);
    fluxH[f] = h / (b3 - b2);
    const t = prev; prev = cur; cur = t;
    if (f % 1500 === 0) {
      onProgress(0.05 + 0.75 * (f / frames), 'Listening for beats');
      await tick();
    }
  }
  fluxL[0] = fluxM[0] = fluxH[0] = 0;

  // ---- 3. onset envelope ----
  onProgress(0.82, 'Finding the tempo');
  await tick();
  const nL = 1 / (percentile(fluxL, 0.9) || 1);
  const nM = 1 / (percentile(fluxM, 0.9) || 1);
  const nH = 1 / (percentile(fluxH, 0.9) || 1);
  const raw = new Float32Array(frames);
  for (let f = 0; f < frames; f++) raw[f] = (fluxL[f] * nL * 1.2 + fluxM[f] * nM + fluxH[f] * nH * 0.8) / 3;
  const odf = new Float32Array(frames);
  for (let f = 1; f < frames - 1; f++) odf[f] = 0.25 * raw[f - 1] + 0.5 * raw[f] + 0.25 * raw[f + 1];
  const odfNorm = 1 / (percentile(odf, 0.95) || 1);
  for (let f = 0; f < frames; f++) odf[f] *= odfNorm;

  // Local-mean-removed novelty for tempo estimation.
  const W = Math.round(0.4 / hopSec);
  const nov = new Float32Array(frames);
  {
    let acc = 0;
    const q = [];
    for (let f = 0; f < frames; f++) {
      acc += odf[f];
      q.push(odf[f]);
      if (q.length > 2 * W + 1) acc -= q.shift();
      const c = f - W;
      if (c >= 0) nov[c] = Math.max(0, odf[c] - acc / q.length);
    }
  }

  const { bpm, offset } = estimateTempo(nov, hopSec, sr);

  // ---- 4. onset picking ----
  onProgress(0.92, 'Marking notes');
  await tick();
  const onsets = [];
  const pre = Math.round(0.1 / hopSec);
  const post = Math.round(0.05 / hopSec);
  const near = 3;
  const minGapFrames = Math.round(0.05 / hopSec);
  let lastF = -1e9;
  // Frame centre, plus a small measured correction: spectral flux peaks slightly before the audible attack.
  const centre = N / 2 / sr + 0.006;
  for (let f = near; f < frames - near; f++) {
    const v = odf[f];
    if (v < 0.12) continue;
    let isMax = true;
    for (let k = -near; k <= near; k++) if (odf[f + k] > v) { isMax = false; break; }
    if (!isMax) continue;
    let mean = 0, cnt = 0;
    for (let k = Math.max(0, f - pre); k <= Math.min(frames - 1, f + post); k++) { mean += odf[k]; cnt++; }
    mean /= cnt;
    if (v < mean * 1.25 + 0.06) continue;
    if (f - lastF < minGapFrames) continue;
    lastF = f;
    const bands = [fluxL[f] * nL, fluxM[f] * nM, fluxH[f] * nH];
    const b = bands.indexOf(Math.max(...bands));
    // Parabolic interpolation gives sub-frame peak timing.
    const pa = odf[f - 1], pc = odf[f + 1];
    const denom = pa - 2 * v + pc;
    const delta = denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (pa - pc)) / denom)) : 0;
    onsets.push({ t: +((f + delta) * hopSec + centre).toFixed(4), s: +Math.min(3, v).toFixed(3), b });
  }

  // Nudge the beat grid onto the median of the strong onsets near it.
  const beatLen = 60 / bpm;
  let beatOffset = offset;
  const resid = [];
  for (const o of onsets) {
    if (o.s < 0.8) continue;
    const k = (o.t - offset) / beatLen;
    const r = (k - Math.round(k)) * beatLen;
    if (Math.abs(r) < beatLen * 0.15) resid.push(r);
  }
  if (resid.length >= 8) {
    resid.sort((a, c) => a - c);
    beatOffset = (((offset + resid[resid.length >> 1]) % beatLen) + beatLen) % beatLen;
  }

  // ---- energy envelope ----
  const eStep = Math.max(1, Math.round(1 / ENERGY_RATE / hopSec));
  const energy = [];
  for (let f = 0; f < frames; f += eStep) {
    let s = 0, c = 0;
    for (let k = f; k < Math.min(frames, f + eStep); k++) { s += rms[k]; c++; }
    energy.push(s / c);
  }
  const eNorm = 1 / (percentile(energy, 0.95) || 1);
  for (let i = 0; i < energy.length; i++) energy[i] = +Math.min(1.5, energy[i] * eNorm).toFixed(3);

  onProgress(1, 'Done');
  return {
    version: 1,
    duration: buffer.duration,
    bpm: +bpm.toFixed(2),
    beatOffset: +beatOffset.toFixed(4),
    onsets,
    energy,
    energyRate: eStep * hopSec > 0 ? 1 / (eStep * hopSec) : ENERGY_RATE,
  };
}

// Autocorrelation picks a coarse tempo (biased towards ~120 BPM), then a comb search
// over period and phase refines BPM and finds where the beats fall.
function estimateTempo(nov, hopSec, sr) {
  const frames = nov.length;
  const lagFor = (bpm) => 60 / bpm / hopSec;
  const minLag = Math.floor(lagFor(200));
  const maxLag = Math.ceil(lagFor(60));
  const ac = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < frames; i++) s += nov[i] * nov[i + lag];
    ac[lag] = s / Math.max(1, frames - lag);
  }
  let best = minLag, bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = 60 / (lag * hopSec);
    const w = Math.exp(-0.5 * (Math.log2(bpm / 125) / 0.8) ** 2);
    // A real beat period also shows up at twice its lag.
    const harmonic = 2 * lag <= maxLag + 1 ? 0.5 * ac[2 * lag] : 0;
    const sc = (ac[lag] + harmonic) * w;
    if (sc > bestScore) { bestScore = sc; best = lag; }
  }
  let coarseBpm = 60 / (best * hopSec);
  while (coarseBpm < 80) coarseBpm *= 2;
  while (coarseBpm > 200) coarseBpm /= 2;

  const comb = (period) => {
    let bestPh = 0, bestV = -Infinity;
    const steps = Math.ceil(period);
    for (let ph = 0; ph < steps; ph++) {
      let v = 0, c = 0;
      for (let p = ph; p < frames - 1; p += period) {
        const i = Math.round(p);
        v += Math.max(nov[i], nov[i - 1] || 0, nov[i + 1] || 0);
        c++;
      }
      v /= c || 1;
      if (v > bestV) { bestV = v; bestPh = ph; }
    }
    return { v: bestV, ph: bestPh };
  };

  let bestBpm = coarseBpm, bestPh = 0, bestV = -Infinity;
  for (let bpm = coarseBpm * 0.985; bpm <= coarseBpm * 1.015; bpm += 0.05) {
    const r = comb(lagFor(bpm));
    if (r.v > bestV) { bestV = r.v; bestBpm = bpm; bestPh = r.ph; }
  }
  // Most produced music sits on a whole-number BPM.
  const rounded = Math.round(bestBpm);
  if (Math.abs(rounded - bestBpm) < 0.2) {
    bestBpm = rounded;
    bestPh = comb(lagFor(bestBpm)).ph;
  }
  const beat = 60 / bestBpm;
  let offset = bestPh * hopSec + N / 2 / sr + 0.006;
  offset %= beat;
  return { bpm: bestBpm, offset };
}
