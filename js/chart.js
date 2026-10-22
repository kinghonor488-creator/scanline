// Turns an analysis (onsets + tempo + energy) into a playable Cytus-style chart.
// Deterministic: the same song and difficulty always produce the same chart.

export const DIFFS = ['easy', 'hard', 'chaos'];

const CFG = {
  easy:  { grid: 1, minGap: 0.95, maxNps: 2.0, thresh: 0.36, page: 2.3, holdProb: 0.55, holdMin: 1.5, flickProb: 0.1,  doubleProb: 0,    dragGap: 0,    absGap: 0.3 },
  hard:  { grid: 2, minGap: 0.48, maxNps: 4.0, thresh: 0.3,  page: 2.0, holdProb: 0.5,  holdMin: 1.0, flickProb: 0.18, doubleProb: 0.25, dragGap: 0.5,  absGap: 0.16 },
  chaos: { grid: 4, minGap: 0.24, maxNps: 7.0, thresh: 0.18, page: 1.8, holdProb: 0.45, holdMin: 1.0, flickProb: 0.22, doubleProb: 0.45, dragGap: 0.5,  absGap: 0.09 },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateChart(analysis, diff, seedKey = '') {
  const cfg = CFG[diff];
  const rng = mulberry32(hashString(`${seedKey}:${diff}`));
  const rand = (a, b) => a + (b - a) * rng();
  const beat = 60 / analysis.bpm;
  const offset = analysis.beatOffset;
  const duration = analysis.duration;

  // ---- page timing: each page is one sweep of the scan line ----
  let bpp = 4;
  let bestErr = Infinity;
  for (const c of [2, 4, 8]) {
    const err = Math.abs(Math.log((c * beat) / cfg.page));
    if (err < bestErr) { bestErr = err; bpp = c; }
  }
  const pageDur = bpp * beat;
  const origin = offset - pageDur * Math.ceil(offset / pageDur);

  const energyAt = (t) => {
    const i = Math.round(t * analysis.energyRate);
    return analysis.energy[Math.max(0, Math.min(analysis.energy.length - 1, i))] || 0;
  };

  // ---- candidates: snap close onsets to the beat grid, score them ----
  const g = beat / cfg.grid;
  const onsets = analysis.onsets;
  const merged = new Map();
  for (const o of onsets) {
    if (o.t < 0.25 || o.t > duration - 0.25) continue;
    const gt = offset + Math.round((o.t - offset) / g) * g;
    const t = Math.abs(gt - o.t) < 0.05 ? gt : o.t;
    const key = Math.round(t * 1000);
    const prev = merged.get(key);
    if (!prev || prev.s < o.s) merged.set(key, { t, s: o.s, b: o.b });
  }
  const cands = [...merged.values()].sort((a, b) => a.t - b.t);

  // Blend global strength with strength relative to the surrounding 8 seconds so quiet sections still get notes.
  let lo = 0, hi = 0;
  const scored = [];
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    while (cands[lo].t < c.t - 4) lo++;
    while (hi < cands.length && cands[hi].t <= c.t + 4) hi++;
    let localMax = 0;
    for (let k = lo; k < hi; k++) localMax = Math.max(localMax, cands[k].s);
    const pos = (c.t - offset) / beat;
    const d = Math.abs(pos - Math.round(pos)) * beat;
    const dHalf = Math.abs(pos * 2 - Math.round(pos * 2)) * (beat / 2);
    const gridBonus = d < 0.03 ? 1.25 : dHalf < 0.03 ? 1.08 : 0.92;
    c.onBeat = d < 0.03;
    c.score = (0.5 * Math.min(c.s, 2.5) / 2.5 + 0.5 * (c.s / (localMax || 1))) * gridBonus;
    scored.push(c);
  }

  // ---- density-limited greedy selection, strongest first ----
  const minGap = Math.max(cfg.absGap, cfg.minGap * beat) - 0.01;
  const picked = [];
  const pickedTimes = [];
  const insertAt = (t) => {
    let a = 0, b = pickedTimes.length;
    while (a < b) {
      const m = (a + b) >> 1;
      if (pickedTimes[m] < t) a = m + 1; else b = m;
    }
    return a;
  };
  const byScore = scored.filter((c) => c.score >= cfg.thresh).sort((a, b) => b.score - a.score);
  for (const c of byScore) {
    const i = insertAt(c.t);
    if (i > 0 && c.t - pickedTimes[i - 1] < minGap) continue;
    if (i < pickedTimes.length && pickedTimes[i] - c.t < minGap) continue;
    let inSecond = 0;
    for (let k = i - 1; k >= 0 && pickedTimes[k] > c.t - 0.5; k--) inSecond++;
    for (let k = i; k < pickedTimes.length && pickedTimes[k] < c.t + 0.5; k++) inSecond++;
    if (inSecond + 1 > cfg.maxNps) continue;
    pickedTimes.splice(i, 0, c.t);
    picked.push(c);
  }
  picked.sort((a, b) => a.t - b.t);

  // ---- note types ----
  const notes = picked.map((c) => ({ t: c.t, type: 'tap', score: c.score, onBeat: c.onBeat, band: c.b }));
  const pageOf = (t) => Math.floor((t - origin) / pageDur + 1e-6);
  const pageEnd = (t) => origin + (pageOf(t) + 1) * pageDur;

  // Drag chains: runs of quick, weaker notes (hi-hat patterns) become slide chains.
  let chainId = 0;
  if (cfg.dragGap > 0) {
    let i = 0;
    while (i < notes.length) {
      let j = i;
      while (j + 1 < notes.length && notes[j + 1].t - notes[j].t <= cfg.dragGap * beat + 0.02) j++;
      // Long runs are cut into chains of at most 8 so they alternate with taps.
      for (let s = i; s <= j; s += 8) {
        const e = Math.min(j, s + 7);
        const len = e - s + 1;
        if (len < 4) continue;
        let avg = 0;
        for (let k = s; k <= e; k++) avg += notes[k].score;
        avg /= len;
        if (rng() < (avg < 0.62 ? 0.75 : 0.3)) {
          const id = ++chainId;
          for (let k = s; k <= e; k++) { notes[k].type = 'drag'; notes[k].chain = id; }
        }
      }
      i = j + 1;
    }
  }

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.type !== 'tap') continue;
    const prevGap = i > 0 ? n.t - notes[i - 1].t : 99;
    const nextGap = i + 1 < notes.length ? notes[i + 1].t - n.t : 99;

    // Holds: a sustained sound with room before the next note.
    if (nextGap >= cfg.holdMin * beat) {
      const e0 = energyAt(n.t + 0.05);
      const span = Math.min(nextGap, 4 * beat);
      let sum = 0, cnt = 0;
      for (let t = n.t + 0.1; t < n.t + span * 0.85; t += 0.05) { sum += energyAt(t); cnt++; }
      const sustained = cnt > 0 && sum / cnt > 0.7 * e0 && e0 > 0.25;
      if (sustained && rng() < cfg.holdProb) {
        const half = beat / 2;
        let dur = Math.floor((Math.min(nextGap, 4 * beat) - half * 0.9) / half) * half;
        dur = Math.min(dur, pageEnd(n.t) - n.t - 0.02);
        if (dur >= Math.max(half, 0.3)) {
          n.type = 'hold';
          n.dur = +dur.toFixed(4);
          continue;
        }
      }
    }
    // Flicks: accented hits with space around them.
    if (n.score > 0.72 && prevGap >= beat * 0.5 && nextGap >= beat && rng() < cfg.flickProb) n.type = 'flick';
  }

  // Dense charts rarely have a free beat, so on harder levels a sustained downbeat can become a hold
  // that the other hand plays over (the placement pass keeps notes clear of its tail).
  if (cfg.grid > 1) {
    let freeAt = -Infinity;
    for (const n of notes) {
      if (n.type === 'hold') freeAt = Math.max(freeAt, n.t + n.dur + beat);
      if (n.type !== 'tap' || !n.onBeat || n.score < 0.55 || n.t < freeAt) continue;
      const len = (rng() < 0.5 ? 1 : 2) * beat;
      const dur = Math.min(len, pageEnd(n.t) - n.t - 0.02);
      if (dur < Math.max(beat * 0.75, 0.3)) continue;
      const e0 = energyAt(n.t + 0.05);
      let sum = 0, cnt = 0;
      for (let t = n.t + 0.1; t < n.t + dur; t += 0.05) { sum += energyAt(t); cnt++; }
      if (e0 > 0.25 && cnt && sum / cnt > 0.75 * e0 && rng() < cfg.holdProb * 0.4) {
        n.type = 'hold';
        n.dur = +dur.toFixed(4);
        freeAt = n.t + dur + beat;
      }
    }
  }

  // Doubles: two simultaneous taps on strong downbeats.
  const extra = [];
  if (cfg.doubleProb > 0) {
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.type !== 'tap' || !n.onBeat || n.score < 0.8) continue;
      const prevGap = i > 0 ? n.t - notes[i - 1].t : 99;
      const nextGap = i + 1 < notes.length ? notes[i + 1].t - n.t : 99;
      if (prevGap < beat * 0.5 || nextGap < beat * 0.5) continue;
      if (rng() < cfg.doubleProb) {
        const d = { t: n.t, type: 'tap', score: n.score, partnerOf: n };
        n.partner = d;
        extra.push(d);
      }
    }
  }

  // ---- positions ----
  const all = notes.concat(extra).sort((a, b) => a.t - b.t || (a.partnerOf ? 1 : -1));
  for (const n of all) {
    const p = pageOf(n.t);
    const frac = (n.t - (origin + p * pageDur)) / pageDur;
    n.page = p;
    n.y = p % 2 === 0 ? 1 - frac : frac; // even pages sweep upward (0 = top, 1 = bottom)
    if (n.type === 'hold') {
      const f2 = (n.t + n.dur - (origin + p * pageDur)) / pageDur;
      n.y2 = p % 2 === 0 ? 1 - f2 : f2;
    }
  }

  const placed = [];
  const clearance = (x, n) => {
    let minD = Infinity;
    for (let k = placed.length - 1; k >= 0; k--) {
      const o = placed[k];
      if (n.t - o.t > pageDur * 1.1) break;
      const dx = x - o.x;
      const dy = (n.y - o.y) * 0.65;
      minD = Math.min(minD, Math.hypot(dx, dy));
      if (o.type === 'hold') {
        // keep clear of the whole hold tail
        const ylo = Math.min(o.y, o.y2), yhi = Math.max(o.y, o.y2);
        const cy = Math.max(ylo, Math.min(yhi, n.y));
        minD = Math.min(minD, Math.hypot(dx, (n.y - cy) * 0.65));
      }
    }
    return minD;
  };

  let lastX = 0.5, lastT = -10, chainDir = 1, curChain = 0;
  for (const n of all) {
    if (n.partnerOf) {
      const px = n.partnerOf.x;
      let x = 1 - px;
      if (Math.abs(x - px) < 0.35) x = px < 0.5 ? px + 0.42 : px - 0.42;
      n.x = Math.max(0.06, Math.min(0.94, x));
      placed.push(n);
      continue;
    }
    if (n.type === 'drag' && n.chain === curChain) {
      let x = lastX + chainDir * rand(0.045, 0.085);
      if (x < 0.07 || x > 0.93) { chainDir = -chainDir; x = lastX + chainDir * rand(0.045, 0.085); }
      n.x = x;
    } else {
      if (n.type === 'drag') { curChain = n.chain; chainDir = rng() < 0.5 ? -1 : 1; }
      const quick = n.t - lastT < 0.36;
      let bestX = 0.5, bestC = -1;
      for (let tries = 0; tries < 14; tries++) {
        let x;
        if (quick) x = lastX < 0.5 ? rand(0.55, 0.92) : rand(0.08, 0.45);
        else x = Math.max(0.08, Math.min(0.92, lastX + rand(-0.55, 0.55)));
        const c = clearance(x, n);
        if (c > bestC) { bestC = c; bestX = x; }
        if (c > 0.16) break;
      }
      n.x = bestX;
      if (n.type === 'drag') chainDir = n.x > 0.5 ? -1 : 1;
    }
    lastX = n.x;
    lastT = n.t;
    placed.push(n);
  }

  // ---- finalize ----
  const out = all.map((n, id) => ({
    id,
    t: +n.t.toFixed(4),
    type: n.type,
    x: +n.x.toFixed(4),
    y: +n.y.toFixed(4),
    page: n.page,
    ...(n.type === 'hold' ? { dur: n.dur, y2: +n.y2.toFixed(4) } : {}),
    ...(n.type === 'drag' ? { chain: n.chain } : {}),
  }));
  const lastIdxInChain = new Map();
  for (const n of out) {
    if (n.type !== 'drag') continue;
    const prevIdx = lastIdxInChain.get(n.chain);
    if (prevIdx !== undefined) out[prevIdx].next = n.id;
    lastIdxInChain.set(n.chain, n.id);
  }
  for (const n of out) {
    const twin = out.find((o) => o !== n && Math.abs(o.t - n.t) < 0.002 && o.type !== 'drag');
    if (twin && n.type !== 'drag') n.twin = twin.id;
  }

  const first = out.length ? out[0].t : 0;
  const lastEnd = out.reduce((m, n) => Math.max(m, n.t + (n.dur || 0)), 0);
  const span = Math.max(1, lastEnd - first);
  let peak = 0;
  for (let i = 0, j = 0; i < out.length; i++) {
    while (out[j].t < out[i].t - 2) j++;
    peak = Math.max(peak, (i - j + 1) / 2);
  }
  const avgNps = out.length / span;
  const level = Math.max(1, Math.min(15, Math.round(avgNps * 1.5 + peak * 0.55)));

  return {
    diff,
    bpm: analysis.bpm,
    beat,
    pageDur,
    origin,
    duration,
    notes: out,
    noteCount: out.length,
    level,
    endTime: Math.max(lastEnd + 0.5, Math.min(lastEnd + 2, duration + 0.3)),
  };
}
