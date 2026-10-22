// Screen flow, song library, importing, settings and test hooks.

import { getCtx, resumeCtx, decode, Music, renderDemoSong } from './audio.js';
import { analyzeBuffer } from './analyzer.js';
import { generateChart, DIFFS, hashString } from './chart.js';
import { Game } from './game.js';
import { Calibrator } from './calibrate.js';
import { CHARACTERS, byId, applyTheme, preloadPortraits, characterSVG, portraitImage } from './characters.js';
import { Player } from './player.js';
import { Intro } from './intro.js';
import { SoundPanel } from './soundpanel.js';
import * as store from './storage.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['title', 'menu', 'chars', 'player', 'import', 'diff', 'pause', 'results', 'settings', 'calib', 'sound'];

function show(...names) {
  for (const s of SCREENS) $(`screen-${s}`).classList.toggle('hidden', !names.includes(s));
}
const visible = () => SCREENS.filter((s) => !$(`screen-${s}`).classList.contains('hidden'));

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let toastTimer = 0;
function toast(msg, ms = 4000) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ setup

const settings = store.loadSettings();
const music = new Music();
const game = new Game($('game'), music, {
  onEnd: showResults,
  onPause: () => {
    $('pause-btn').classList.add('hidden');
    show('pause');
    $('pause-resume').focus();
  },
});

let character = byId((() => { try { return localStorage.getItem('scanline.character'); } catch { return null; } })());
let player = null;

// Custom PNG art is shown as an image; otherwise the drawn SVG is inlined so it can blink and breathe.
async function portraitInto(node, ch) {
  const token = (node.dataset.token = String(Math.random()));
  const p = await portraitImage(ch);
  if (node.dataset.token !== token) return;
  node.classList.toggle('is-card', p.custom);
  if (p.custom) {
    const img = el('img');
    img.src = p.img.src;
    img.alt = ch.name;
    node.replaceChildren(img);
  } else {
    node.innerHTML = characterSVG(ch, { animated: true });
  }
}

function setCharacter(ch) {
  character = ch;
  try { localStorage.setItem('scanline.character', ch.id); } catch { /* storage blocked */ }
  applyTheme(ch);
  game.setCharacter(ch);
  if (player) player.setCharacter(ch);
  portraitInto($('menu-portrait'), ch);
  $('menu-char-name').textContent = `${ch.name}  ${ch.en}`;
  $('menu-char-title').textContent = ch.title.toUpperCase();
  for (const card of $('char-grid').children) card.classList.toggle('selected', card.dataset.id === ch.id);
}
preloadPortraits();

let bubbleTimer = 0;
function say(line) {
  const b = $('menu-bubble');
  b.textContent = line;
  b.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove('show'), 3200);
}
$('menu-portrait').addEventListener('click', () => {
  say(character.lines[Math.floor(Math.random() * character.lines.length)]);
});

// ------------------------------------------------------------------ character select

for (const ch of CHARACTERS) {
  const card = el('button', 'char-card');
  card.dataset.id = ch.id;
  card.style.setProperty('--c1', ch.colors.primary);
  const art = el('div', 'art');
  portraitInto(art, ch);
  card.append(art, el('div', 'jp', ch.en.toUpperCase()), el('div', 'nm', ch.name), el('div', 'tt', ch.title.toUpperCase()), el('div', 'bl', ch.blurb), el('span', 'tag', 'PARTNER'));
  card.addEventListener('click', () => {
    setCharacter(ch);
    say(ch.lines[0]);
  });
  $('char-grid').append(card);
}
setCharacter(character);
$('chars-btn').addEventListener('click', () => {
  show('menu', 'chars');
  $('chars-close').focus();
});
$('chars-close').addEventListener('click', () => show('menu'));

function applySettings() {
  music.setVolume(settings.volume);
  music.setEQ(settings.fx.gains);
  if (music.normalize !== settings.fx.normalize) music.setNormalize(settings.fx.normalize);
  if (music.spatial !== settings.fx.spatial) music.setSpatial(settings.fx.spatial);
  music.hitSounds = settings.hitSounds;
  game.settings = { offsetMs: settings.offsetMs, approach: settings.approach, spawn: settings.spawn, shake: settings.shake };
}
applySettings();

const library = [];
const bufferCache = new Map();
const demo = {
  id: 'demo',
  title: 'Neon Pulse',
  artist: 'SCANLINE demo track',
  builtIn: true,
  hue: 190,
  bpm: 128,
  duration: 62,
  analysis: null,
};

const demoReady = (async () => {
  const buf = await renderDemoSong();
  bufferCache.set('demo', buf);
  demo.analysis = await analyzeBuffer(buf);
  demo.bpm = demo.analysis.bpm;
  demo.duration = buf.duration;
  renderList();
  return demo;
})().catch((err) => {
  console.error(err);
  toast('Could not build the demo song in this browser.');
});

store.listSongs().then((songs) => {
  library.push(...songs);
  renderList();
}).catch((err) => console.error(err));

// ------------------------------------------------------------------ song list

async function renderList() {
  if (player) player.renderQueue();
  const ul = $('song-list');
  ul.replaceChildren();
  for (const s of [demo, ...library]) {
    const li = el('li', 'song');
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    const sw = el('div', 'swatch');
    sw.style.background = `linear-gradient(135deg, hsl(${s.hue} 85% 58%), hsl(${(s.hue + 70) % 360} 70% 32%))`;
    const info = el('div', 'info');
    info.append(el('div', 'title', s.title));
    const meta = s.analysis
      ? `${s.artist ? `${s.artist} · ` : ''}${Math.round(s.bpm)} BPM · ${fmtTime(s.duration)}`
      : 'Preparing…';
    info.append(el('div', 'meta', meta));
    const best = el('div', 'best');
    li.append(sw, info, best);
    if (!s.builtIn) {
      const del = el('button', 'del', '×');
      del.title = 'Delete song';
      del.setAttribute('aria-label', `Delete ${s.title}`);
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${s.title}" from your library?`)) return;
        await store.deleteSong(s.id);
        library.splice(library.indexOf(s), 1);
        bufferCache.delete(s.id);
        renderList();
      });
      li.append(del);
    }
    li.addEventListener('click', () => openSong(s));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSong(s); }
    });
    ul.append(li);
    Promise.all(DIFFS.map((d) => store.getBest(s.id, bestKey(d, variantFor(s.id, d))))).then((recs) => {
      recs.forEach((r, i) => {
        if (!r) return;
        const line = el('div');
        line.append(`${DIFFS[i]} `, el('b', '', String(r.score).padStart(7, '0')));
        best.append(line);
      });
    });
  }
}

// ------------------------------------------------------------------ difficulty select

let currentSong = null;
let charts = null;
let selectedDiff = (() => {
  try { return localStorage.getItem('scanline.diff') || 'easy'; } catch { return 'easy'; }
})();

// Each song + difficulty remembers which chart variant was picked (0 = the original).
const variantKey = (id, d) => `scanline.variant.${id}.${d}`;
function variantFor(id, d) {
  try { return +localStorage.getItem(variantKey(id, d)) || 0; } catch { return 0; }
}
function saveVariant(id, d, v) {
  try {
    if (v) localStorage.setItem(variantKey(id, d), String(v));
    else localStorage.removeItem(variantKey(id, d));
  } catch { /* storage blocked */ }
}
// Best scores are kept per chart, so a regenerated chart starts with a clean record.
const bestKey = (d, v) => (v ? `${d}:v${v}` : d);
const chartName = (v) => (v ? `Chart #${v}` : 'Original chart');

async function openSong(s) {
  if (!s.analysis) {
    toast('Still preparing this song, one moment…', 2000);
    return;
  }
  currentSong = s;
  charts = Object.fromEntries(DIFFS.map((d) => [d, generateChart(s.analysis, d, s.id, variantFor(s.id, d))]));
  $('diff-title').textContent = s.title;
  $('diff-meta').textContent = `${s.artist ? `${s.artist} · ` : ''}${Math.round(s.bpm)} BPM · ${fmtTime(s.duration)}`;
  renderDiffCards();
  selectDiff(selectedDiff);
  show('menu', 'diff');
  $('diff-play').focus();
}

function renderDiffCards(flash) {
  const s = currentSong;
  const list = $('diff-list');
  list.replaceChildren();
  for (const d of DIFFS) {
    const c = charts[d];
    const b = el('button', `diff ${d}${d === flash ? ' rerolled' : ''}${d === selectedDiff ? ' selected' : ''}`);
    b.dataset.diff = d;
    b.append(el('div', 'name', d.toUpperCase()), el('div', 'lv', String(c.level)), el('div', 'sub', `${c.noteCount} notes`));
    const bestLine = el('div', 'sub', c.variant ? `#${c.variant}` : '—');
    b.append(bestLine);
    store.getBest(s.id, bestKey(d, c.variant)).then((r) => {
      if (r) bestLine.textContent = `Best ${String(r.score).padStart(7, '0')}`;
    });
    b.addEventListener('click', () => selectDiff(d));
    b.addEventListener('dblclick', () => { selectDiff(d); startPlay(); });
    list.append(b);
  }
}

function selectDiff(d) {
  selectedDiff = d;
  try { localStorage.setItem('scanline.diff', d); } catch { /* storage blocked */ }
  for (const b of $('diff-list').children) b.classList.toggle('selected', b.dataset.diff === d);
  const v = charts ? charts[d].variant : 0;
  $('chart-label').textContent = `${d.toUpperCase()} · ${chartName(v)}`;
  $('chart-original').disabled = !v;
}

function setChartVariant(v) {
  const s = currentSong;
  const d = selectedDiff;
  saveVariant(s.id, d, v);
  charts[d] = generateChart(s.analysis, d, s.id, v);
  renderDiffCards(d);
  selectDiff(d);
}

$('chart-reroll').addEventListener('click', () => {
  const cur = charts[selectedDiff].variant;
  let v = cur;
  while (v === cur) v = 1 + Math.floor(Math.random() * 9999);
  setChartVariant(v);
});
$('chart-original').addEventListener('click', () => setChartVariant(0));

async function getBuffer(s) {
  if (bufferCache.has(s.id)) return bufferCache.get(s.id);
  const bytes = await store.loadAudioBytes(s.id);
  if (!bytes) throw new Error('Audio data is missing for this song.');
  const buf = await decode(bytes);
  bufferCache.set(s.id, buf);
  trimCache();
  return buf;
}

function trimCache() {
  const keys = [...bufferCache.keys()].filter((k) => k !== 'demo');
  while (keys.length > 3) bufferCache.delete(keys.shift());
}

async function startPlay() {
  if (!currentSong) return;
  const s = currentSong;
  await resumeCtx();
  player.halt();
  let buf;
  try {
    if (!bufferCache.has(s.id)) toast('Loading audio…', 1500);
    buf = await getBuffer(s);
  } catch (err) {
    console.error(err);
    toast(`Couldn't load this song: ${err.message}`);
    return;
  }
  show();
  $('pause-btn').classList.remove('hidden');
  applySettings();
  game.start(charts[selectedDiff], buf, s, { autoplay: $('autoplay-toggle').checked });
}

// ------------------------------------------------------------------ results

const rankFor = (score) =>
  score >= 1000000 ? 'MM' : score >= 950000 ? 'S' : score >= 900000 ? 'A' : score >= 800000 ? 'B' : score >= 700000 ? 'C' : 'D';

const RESULT_LINES = {
  allPerfect: ['Flawless! I\'m framing this one.', 'Every single note. Perfect!'],
  fullCombo: ['Full combo! You didn\'t drop a beat.', 'Not one miss. Nice!'],
  good: ['That was fun! Again?', 'Nice run! One more?'],
  low: ['Don\'t worry, let\'s try once more together.', 'Shake it off. You\'ve got this!'],
};

async function showResults(r) {
  $('pause-btn').classList.add('hidden');
  portraitInto($('res-portrait'), character);
  const pool = r.allPerfect ? RESULT_LINES.allPerfect : r.fullCombo ? RESULT_LINES.fullCombo : r.score >= 800000 ? RESULT_LINES.good : RESULT_LINES.low;
  $('res-line').textContent = `${character.name}: “${pool[Math.floor(Math.random() * pool.length)]}”`;
  const variant = charts[r.diff].variant;
  $('res-song').textContent = `${currentSong.title} · ${r.diff.toUpperCase()} ${charts[r.diff].level} · ${chartName(variant)}${r.autoplay ? ' · AUTO PLAY' : ''}`;
  $('res-rank').textContent = rankFor(r.score);
  $('res-score').textContent = String(r.score).padStart(7, '0');
  $('res-tp').textContent = `TP ${r.tp.toFixed(2)}`;
  $('res-perfect').textContent = r.perfect;
  $('res-good').textContent = r.good;
  $('res-bad').textContent = r.bad;
  $('res-miss').textContent = r.miss;
  $('res-combo').textContent = `${r.maxCombo} / ${r.total}`;
  $('res-el').textContent = `${r.early} / ${r.late}`;
  let badge = r.allPerfect ? 'ALL PERFECT' : r.fullCombo ? 'FULL COMBO' : '';
  $('res-badge').textContent = badge;
  show('results');
  $('res-retry').focus();
  if (!r.autoplay) {
    const isBest = await store.submitBest(r.songId, bestKey(r.diff, variant), r).catch(() => false);
    if (isBest) {
      badge = badge ? `${badge} · NEW BEST` : 'NEW BEST';
      $('res-badge').textContent = badge;
    }
  }
}

// ------------------------------------------------------------------ import

function isAudio(f) {
  return (f.type && f.type.startsWith('audio/')) || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i.test(f.name);
}

function parseName(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
  const i = base.indexOf(' - ');
  if (i > 0) return { artist: base.slice(0, i).trim(), title: base.slice(i + 3).trim() || base };
  return { artist: '', title: base || 'Untitled' };
}

function setProgress(frac, stage) {
  $('import-bar').style.width = `${Math.round(frac * 100)}%`;
  if (stage) $('import-stage').textContent = stage;
}

let importing = false;
async function importFiles(fileList) {
  if (importing || game.state !== 'idle') return;
  const files = [...fileList].filter(isAudio);
  if (!files.length) {
    toast('Those files don’t look like audio. Try MP3, WAV, OGG, M4A or FLAC.');
    return;
  }
  importing = true;
  getCtx();
  show('menu', 'import');
  let added = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    $('import-title').textContent = f.name;
    $('import-queue').textContent = files.length > 1 ? `File ${i + 1} of ${files.length}` : '';
    setProgress(0.02, 'Reading file');
    try {
      const bytes = await f.arrayBuffer();
      setProgress(0.04, 'Decoding audio');
      const buf = await decode(bytes);
      if (buf.duration < 10) throw new Error('it is shorter than 10 seconds');
      const analysis = await analyzeBuffer(buf, setProgress);
      if (analysis.onsets.length < 20) throw new Error('no clear beats were found');
      const { title, artist } = parseName(f.name);
      const meta = {
        id: `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        artist,
        duration: buf.duration,
        bpm: analysis.bpm,
        hue: hashString(f.name) % 360,
        createdAt: Date.now(),
        analysis,
      };
      await store.saveSong(meta, bytes);
      library.unshift(meta);
      bufferCache.set(meta.id, buf);
      trimCache();
      added++;
    } catch (err) {
      console.error(err);
      toast(`Couldn't import "${f.name}": ${err && err.message ? err.message : 'unsupported format'}.`, 6000);
    }
  }
  importing = false;
  show('menu');
  renderList();
  if (added) toast(`Imported ${added} song${added > 1 ? 's' : ''}. Pick one to play!`, 3000);
}

$('file-input').addEventListener('change', (e) => {
  importFiles(e.target.files);
  e.target.value = '';
});

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files') || game.state !== 'idle') return;
  e.preventDefault();
  dragDepth++;
  $('drop-overlay').classList.remove('hidden');
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $('drop-overlay').classList.add('hidden');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('drop-overlay').classList.add('hidden');
  if (e.dataTransfer && e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
});

// ------------------------------------------------------------------ settings

function syncSettingsUI() {
  $('set-offset').value = settings.offsetMs;
  $('offset-val').textContent = `${settings.offsetMs > 0 ? '+' : ''}${settings.offsetMs} ms`;
  $('set-approach').value = settings.approach;
  $('approach-val').textContent = `${(+settings.approach).toFixed(1)}×`;
  $('set-volume').value = settings.volume;
  $('vol-val').textContent = `${Math.round(settings.volume * 100)}%`;
  $('set-hitsound').checked = settings.hitSounds;
  $('set-shake').checked = settings.shake;
  $('set-intro').checked = settings.intro;
  for (const b of $('set-spawn').children) b.classList.toggle('on', b.dataset.mode === settings.spawn);
  $('pl-volume').value = settings.volume;
}

function bindSetting(id, key, parse) {
  $(id).addEventListener('input', (e) => {
    settings[key] = parse(e.target);
    store.saveSettings(settings);
    applySettings();
    syncSettingsUI();
  });
}
bindSetting('set-offset', 'offsetMs', (t) => +t.value);
bindSetting('set-approach', 'approach', (t) => +t.value);
bindSetting('set-volume', 'volume', (t) => +t.value);
bindSetting('set-hitsound', 'hitSounds', (t) => t.checked);
bindSetting('set-shake', 'shake', (t) => t.checked);
bindSetting('set-intro', 'intro', (t) => t.checked);
for (const b of $('set-spawn').children) {
  b.addEventListener('click', () => {
    settings.spawn = b.dataset.mode;
    store.saveSettings(settings);
    applySettings();
    syncSettingsUI();
  });
}
bindSetting('pl-volume', 'volume', (t) => +t.value);
$('intro-replay').addEventListener('click', () => playIntro());

$('settings-btn').addEventListener('click', () => {
  syncSettingsUI();
  show('menu', 'settings');
  $('settings-close').focus();
});
$('settings-close').addEventListener('click', () => show('menu'));

// ------------------------------------------------------------------ offset calibration

const calib = new Calibrator(music);

function renderCalibDots() {
  const dots = $('calib-dots');
  dots.replaceChildren();
  for (let i = 0; i < calib.needed; i++) {
    const d = el('i');
    if (i < calib.taps.length) d.className = 'on';
    dots.append(d);
  }
}

function resetCalibUI() {
  calib.stop();
  calib.reset();
  $('calib-pad-label').textContent = 'Start';
  $('calib-status').textContent = 'Press Start, then tap along.';
  $('calib-retry').disabled = true;
  $('calib-apply').disabled = true;
  renderCalibDots();
}

async function startCalib() {
  await resumeCtx();
  player.halt();
  music.stop();
  calib.start();
  $('calib-pad-label').textContent = 'Tap';
  $('calib-status').textContent = 'Warm-up… start tapping on the clicks.';
  $('calib-retry').disabled = false;
  $('calib-apply').disabled = true;
  renderCalibDots();
}

function calibPress(stamp) {
  if (calib.active) {
    if (calib.tap(stamp)) {
      renderCalibDots();
      $('calib-status').textContent = `${calib.taps.length} / ${calib.needed} taps`;
      if (!calib.active) showCalibResult();
    }
  } else if (!calib.result && $('calib-pad-label').textContent === 'Start') {
    startCalib();
  }
}

function showCalibResult() {
  if (calib.active) calib.finish();
  const r = calib.result;
  $('calib-pad-label').textContent = r ? `${r.offsetMs > 0 ? '+' : ''}${r.offsetMs} ms` : 'Retry';
  if (r) {
    const uneven = r.spreadMs > 35 ? ' Your taps were quite uneven, so you may want to try again.' : '';
    $('calib-status').textContent =
      `Measured offset ${r.offsetMs > 0 ? '+' : ''}${r.offsetMs} ms (taps varied by about ±${r.spreadMs} ms).${uneven}`;
  } else {
    $('calib-status').textContent = 'Not enough taps landed near the clicks. Press Try again.';
  }
  $('calib-apply').disabled = !r;
  $('calib-retry').disabled = false;
}

function closeCalib() {
  calib.stop();
  syncSettingsUI();
  show('menu', 'settings');
  $('calib-open').focus();
}

$('calib-open').addEventListener('click', () => {
  resetCalibUI();
  show('menu', 'calib');
  $('calib-pad').focus();
});
$('calib-pad').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  calibPress(e.timeStamp);
});
$('calib-cancel').addEventListener('click', closeCalib);
$('calib-retry').addEventListener('click', () => { resetCalibUI(); startCalib(); });
$('calib-apply').addEventListener('click', () => {
  if (!calib.result) return;
  settings.offsetMs = calib.result.offsetMs;
  store.saveSettings(settings);
  applySettings();
  closeCalib();
  toast(`Audio offset set to ${settings.offsetMs > 0 ? '+' : ''}${settings.offsetMs} ms.`, 2500);
});

function updateCalibPad() {
  if ($('screen-calib').classList.contains('hidden')) return;
  const ph = calib.phase();
  $('calib-pad').style.setProperty('--pulse', ph >= 0 ? ((1 - ph) ** 4).toFixed(3) : '0');
  if (calib.expired) showCalibResult();
}

// ------------------------------------------------------------------ music player

player = new Player(music, {
  songs: () => [demo, ...library],
  getBuffer,
  character,
  toast,
  crossfade: () => settings.fx.crossfade,
  onPlayGame: (s) => {
    show('menu');
    openSong(s);
  },
});
function openPlayer() {
  syncSettingsUI();
  show('player');
  player.syncNowPlaying();
  player.renderQueue();
  $('pl-play').focus();
}
$('player-btn').addEventListener('click', openPlayer);
$('mini-player').addEventListener('click', openPlayer);
$('mini-player').addEventListener('keydown', (e) => { if (e.key === 'Enter') openPlayer(); });
$('player-back').addEventListener('click', () => show('menu'));

// ------------------------------------------------------------------ sound panel

const sound = new SoundPanel(music, settings, () => {
  store.saveSettings(settings);
  $('pl-fxinfo').textContent = sound.summary();
});
$('pl-fxinfo').textContent = sound.summary();
let soundReturn = ['menu'];
function openSound() {
  soundReturn = visible().filter((s) => s !== 'sound');
  show(...soundReturn, 'sound');
  sound.sync();
  $('eq-canvas').focus();
}
function closeSound() {
  show(...soundReturn);
}
$('pl-sound').addEventListener('click', openSound);
$('pl-fxinfo').addEventListener('click', openSound);
$('fx-open').addEventListener('click', openSound);
$('sound-close').addEventListener('click', closeSound);

// ------------------------------------------------------------------ title & opening

const intro = new Intro(music);

function playIntro() {
  player.halt();
  music.stop();
  show();
  $('intro-skip').classList.remove('hidden');
  intro.start(() => {
    $('intro-skip').classList.add('hidden');
    show('menu');
    say(character.lines[0]);
  });
}
$('intro-skip').addEventListener('click', () => intro.skip());

async function leaveTitle() {
  await resumeCtx();
  // Android honours an orientation lock in fullscreen; iOS ignores it and relies on the rotate prompt.
  screen.orientation?.lock?.('landscape').catch(() => {});
  // Ask the browser not to evict imported songs when the device is low on space.
  navigator.storage?.persist?.().catch(() => {});
  if (settings.intro) playIntro();
  else {
    show('menu');
    say(character.lines[0]);
  }
}
$('title-start').addEventListener('click', leaveTitle);
$('screen-title').addEventListener('click', (e) => { if (e.target === e.currentTarget) leaveTitle(); });

// ------------------------------------------------------------------ buttons

$('diff-back').addEventListener('click', () => show('menu'));
$('diff-play').addEventListener('click', startPlay);
$('pause-btn').addEventListener('click', () => game.pause());
$('pause-resume').addEventListener('click', resumeGame);
$('pause-retry').addEventListener('click', () => { game.stop(); startPlay(); });
$('pause-quit').addEventListener('click', backToMenu);
$('res-retry').addEventListener('click', () => { game.stop(); startPlay(); });
$('res-back').addEventListener('click', backToMenu);

function resumeGame() {
  show();
  $('pause-btn').classList.remove('hidden');
  game.resume();
}

function backToMenu() {
  game.stop();
  $('pause-btn').classList.add('hidden');
  show('menu');
  renderList();
}

// ------------------------------------------------------------------ keyboard

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

const isHitKey = (e) =>
  !e.metaKey && !e.ctrlKey && !e.altKey &&
  ((e.code.startsWith('Key') && e.code !== 'KeyF' && e.code !== 'KeyP') || e.code.startsWith('Digit') || e.code === 'Space');

window.addEventListener('keydown', (e) => {
  const open = visible();
  if (intro.active) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.code === 'Space') intro.skip();
    return;
  }
  if (open.includes('sound')) {
    if (e.key === 'Escape') closeSound();
    return;
  }
  if (open.includes('title') && (e.key === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    leaveTitle();
    return;
  }
  if (open.includes('calib')) {
    if (e.key === 'Escape') closeCalib();
    else if (isHitKey(e) && !e.repeat) {
      e.preventDefault();
      calibPress(e.timeStamp);
    }
    return;
  }
  if (game.state === 'playing' && isHitKey(e)) {
    e.preventDefault();
    game.keyDown(e);
    return;
  }
  if (e.code === 'KeyF' && !e.metaKey && !e.ctrlKey) {
    toggleFullscreen();
    return;
  }
  if (e.key === 'Escape' || e.code === 'KeyP') {
    if (game.state === 'playing') game.pause();
    else if (open.includes('pause')) resumeGame();
    else if (open.includes('diff') || open.includes('settings') || open.includes('chars') || open.includes('player')) show('menu');
    else if (open.includes('results')) backToMenu();
  }
});
window.addEventListener('keyup', (e) => game.keyUp(e));

// Turning a phone upright mid-song brings up the rotate prompt, so pause underneath it.
const portraitTouch = matchMedia('(orientation: portrait) and (pointer: coarse)');
portraitTouch.addEventListener?.('change', (e) => {
  if (e.matches && game.state === 'playing' && !game.manual) game.pause();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing' && !game.manual) game.pause();
});

// ------------------------------------------------------------------ loop & test hooks

function loop() {
  if (intro.active) {
    const g = game.g;
    g.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    intro.draw(g, game.W, game.H);
  } else {
    game.frame();
  }
  updateCalibPad();
  const open = visible();
  if (open.includes('player') || open.includes('menu')) player.frame(open.includes('player'));
  if (open.includes('sound')) sound.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.render_game_to_text = () => {
  const screens = visible();
  const payload = { screens, ...game.textState() };
  if (screens.includes('menu')) payload.songs = [demo, ...library].map((s) => ({ id: s.id, title: s.title, ready: !!s.analysis }));
  if (screens.includes('diff')) {
    payload.selectedDiff = selectedDiff;
    payload.charts = DIFFS.map((d) => {
      const c = charts[d];
      const types = {};
      for (const n of c.notes) types[n.type] = (types[n.type] || 0) + 1;
      return { diff: d, variant: c.variant, level: c.level, notes: c.noteCount, types };
    });
  }
  if (intro.active) payload.intro = true;
  if (player.current) payload.player = { song: player.current.title, playing: player.playing, pos: +player.position().toFixed(2), shuffle: player.shuffle, repeat: player.repeat };
  if (screens.includes('sound')) payload.sound = { ...settings.fx, chain: { spatial: music.spatial, normalize: music.normalize, preamp: +music.preamp.gain.value.toFixed(3) } };
  if (screens.includes('calib')) payload.calib = { active: calib.active, taps: calib.taps.length, result: calib.result, offsetMs: settings.offsetMs };
  return JSON.stringify(payload);
};
window.advanceTime = (ms) => game.advanceTime(ms);
window.__scanline = { getCharts: () => charts, game, calib, player, intro, sound, music, settings, playIntro, demo, setCharacter, CHARACTERS, demoReady, generateChart, analyzeBuffer };

// Offline / installable app. Skipped on localhost (unless ?sw=1) so development always loads fresh files.
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!local || new URLSearchParams(location.search).has('sw'))) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker not registered', err));
}

// Deep link for quick testing: ?play=demo&diff=hard&autoplay=1
const params = new URLSearchParams(location.search);
if (params.get('play') || params.get('notitle')) show('menu');
else show('title');
if (params.get('play') === 'demo') {
  demoReady.then(() => {
    selectedDiff = DIFFS.includes(params.get('diff')) ? params.get('diff') : 'easy';
    $('autoplay-toggle').checked = params.get('autoplay') === '1';
    openSong(demo).then(startPlay);
  });
}
