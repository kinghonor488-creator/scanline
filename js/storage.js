// Persistence: IndexedDB for imported songs and best scores, localStorage for settings.
// Every call falls back to in-memory storage if IndexedDB is unavailable (private mode etc).

const DB_NAME = 'scanline';
const DB_VERSION = 1;
let dbPromise = null;
const memory = { songs: new Map(), audio: new Map(), best: new Map() };

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('best')) db.createObjectStore('best', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return openDB().then((db) => {
    if (!db) return fn(null);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const os = tx.objectStore(store);
      const req = fn(os);
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

export async function saveSong(meta, bytes) {
  const db = await openDB();
  if (!db) {
    memory.songs.set(meta.id, meta);
    memory.audio.set(meta.id, { id: meta.id, bytes });
    return;
  }
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['songs', 'audio'], 'readwrite');
    tx.objectStore('songs').put(meta);
    tx.objectStore('audio').put({ id: meta.id, bytes });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listSongs() {
  const all = await run('songs', 'readonly', (os) => (os ? os.getAll() : null));
  const songs = all || [...memory.songs.values()];
  return songs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadAudioBytes(id) {
  const rec = await run('audio', 'readonly', (os) => (os ? os.get(id) : null));
  return (rec || memory.audio.get(id) || {}).bytes || null;
}

export async function deleteSong(id) {
  const db = await openDB();
  memory.songs.delete(id);
  memory.audio.delete(id);
  if (!db) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['songs', 'audio', 'best'], 'readwrite');
    tx.objectStore('songs').delete(id);
    tx.objectStore('audio').delete(id);
    // Covers the original charts and every regenerated variant (keys look like `${id}:hard:v123`).
    tx.objectStore('best').delete(IDBKeyRange.bound(`${id}:`, `${id}:\uffff`));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBest(id, diff) {
  const key = `${id}:${diff}`;
  const rec = await run('best', 'readonly', (os) => (os ? os.get(key) : null));
  return rec || memory.best.get(key) || null;
}

// Stores the record only if it beats the previous best; returns true when it did.
export async function submitBest(id, diff, result) {
  const prev = await getBest(id, diff);
  if (prev && prev.score >= result.score) return false;
  const rec = { key: `${id}:${diff}`, score: result.score, tp: result.tp, fc: result.fullCombo, ap: result.allPerfect };
  memory.best.set(rec.key, rec);
  await run('best', 'readwrite', (os) => (os ? os.put(rec) : null));
  return true;
}

const SETTINGS_KEY = 'scanline.settings';
export const defaultSettings = {
  offsetMs: 0, approach: 1, spawn: 'single', volume: 0.8, hitSounds: true, shake: true, intro: true,
  fx: { preset: 'flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], normalize: true, spatial: 'off', crossfade: 3 },
};

const freshFx = (saved) => ({ ...defaultSettings.fx, ...(saved || {}), gains: [...((saved && saved.gains) || defaultSettings.fx.gains)] });

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return { ...defaultSettings, ...saved, fx: freshFx(saved.fx) };
  } catch {
    return { ...defaultSettings, fx: freshFx() };
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}
