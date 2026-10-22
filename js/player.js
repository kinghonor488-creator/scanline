// Music player: plays the song library like a normal music app, with a spinning disc,
// circular visualizer, queue, shuffle/repeat, seek, a mini player in the menu and
// lock-screen controls through the Media Session API.

import { portraitNow, faceCrop } from './characters.js';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const $ = (id) => document.getElementById(id);

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zM9.5 12L18 6v12z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18V6l8.5 6z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M4 7h3.5l7 10H20M4 17h3.5l2.2-3.1M14.3 10.1 16.5 7H20M17 4l3 3-3 3M17 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="M5 11V9a3 3 0 0 1 3-3h11M16 3l3 3-3 3M19 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export class Player {
  constructor(music, { songs, getBuffer, character, onPlayGame, toast, crossfade }) {
    this.music = music;
    this.songs = songs;
    this.getBuffer = getBuffer;
    this.character = character;
    this.onPlayGame = onPlayGame;
    this.toast = toast;
    this.crossfade = crossfade || (() => 0);
    this.xfStarted = false;
    this.current = null;
    this.playing = false;
    this.pausedAt = 0;
    this.shuffle = false;
    this.repeat = 'all'; // all | one | off
    this.loadToken = 0;
    this.angle = 0;
    this.viz = $('player-viz');
    this.vg = this.viz.getContext('2d');

    $('pl-prev').innerHTML = ICON.prev;
    $('pl-next').innerHTML = ICON.next;
    $('pl-shuffle').innerHTML = ICON.shuffle;
    $('pl-repeat').innerHTML = ICON.repeat;
    $('pl-play').addEventListener('click', () => this.toggle());
    $('mini-play').addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });
    $('pl-prev').addEventListener('click', () => this.prev());
    $('pl-next').addEventListener('click', () => this.next());
    $('pl-shuffle').addEventListener('click', () => { this.shuffle = !this.shuffle; this.syncButtons(); });
    $('pl-repeat').addEventListener('click', () => {
      this.repeat = { all: 'one', one: 'off', off: 'all' }[this.repeat];
      this.syncButtons();
    });
    $('pl-game').addEventListener('click', () => { if (this.current) this.onPlayGame(this.current); });
    const seek = $('np-seek');
    seek.addEventListener('input', () => { this.seeking = true; });
    seek.addEventListener('change', () => {
      this.seeking = false;
      if (this.current) this.seek((seek.value / 1000) * this.current.duration);
    });

    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession;
      const on = (a, f) => { try { ms.setActionHandler(a, f); } catch { /* unsupported action */ } };
      on('play', () => this.resume());
      on('pause', () => this.pause());
      on('previoustrack', () => this.prev());
      on('nexttrack', () => this.next());
      on('seekto', (d) => this.seek(d.seekTime));
    }
    this.syncButtons();
  }

  setCharacter(ch) {
    this.character = ch;
  }

  list() {
    return this.songs().filter((s) => s.analysis);
  }

  position() {
    if (!this.current) return 0;
    return this.playing ? this.music.trackPosition() : this.pausedAt;
  }

  async play(song, offset = 0, fade = 0.06) {
    const token = ++this.loadToken;
    this.xfStarted = false;
    this.current = song;
    this.pausedAt = offset;
    this.renderQueue();
    this.syncNowPlaying();
    let buf;
    try {
      buf = await this.getBuffer(song);
    } catch (err) {
      this.toast(`Couldn't load "${song.title}": ${err.message}`);
      return;
    }
    if (token !== this.loadToken) return;
    this.music.playTrack(buf, offset, () => this.onEnded(), fade);
    this.playing = true;
    this.syncButtons();
    this.updateMediaSession();
  }

  onEnded() {
    this.playing = false;
    if (this.repeat === 'one') this.play(this.current);
    else this.next(true);
  }

  pause() {
    if (!this.playing) return;
    this.pausedAt = this.music.trackPosition();
    this.playing = false;
    this.music.stop(0.12);
    this.syncButtons();
  }

  resume() {
    if (this.playing) return;
    if (!this.current) {
      const first = this.list()[0];
      if (first) this.play(first);
      return;
    }
    this.play(this.current, this.pausedAt, 0.12);
  }

  toggle() {
    if (this.playing) this.pause();
    else this.resume();
  }

  // Stops playback because something else (the game, calibration) needs the audio.
  halt() {
    if (this.playing) {
      this.pausedAt = this.music.trackPosition();
      this.playing = false;
    }
    this.loadToken++;
    this.syncButtons();
  }

  seek(t) {
    if (!this.current) return;
    if (this.playing) this.play(this.current, t, 0.04);
    else {
      this.pausedAt = t;
      this.syncNowPlaying();
    }
  }

  next(auto = false, fade = 0.25) {
    const list = this.list();
    if (!list.length) return;
    let i = list.indexOf(this.current);
    if (this.shuffle && list.length > 1) {
      let j = i;
      while (j === i) j = Math.floor(Math.random() * list.length);
      i = j;
    } else {
      i += 1;
      if (i >= list.length) {
        if (auto && this.repeat === 'off') {
          this.pausedAt = 0;
          this.syncButtons();
          return;
        }
        i = 0;
      }
    }
    this.play(list[i], 0, fade);
  }

  prev() {
    const list = this.list();
    if (!list.length) return;
    if (this.position() > 3) {
      this.seek(0);
      return;
    }
    const i = list.indexOf(this.current);
    this.play(list[(i - 1 + list.length) % list.length], 0, 0.25);
  }

  // ---------------------------------------------------------------- UI

  syncButtons() {
    const icon = this.playing ? ICON.pause : ICON.play;
    $('pl-play').innerHTML = icon;
    $('mini-play').innerHTML = icon;
    $('pl-play').setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
    $('pl-shuffle').classList.toggle('on', this.shuffle);
    $('pl-repeat').classList.toggle('on', this.repeat !== 'off');
    $('pl-repeat').dataset.mode = this.repeat;
    $('pl-repeat').setAttribute('aria-label', `Repeat: ${this.repeat}`);
    $('mini-player').classList.toggle('hidden', !this.current);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
    this.renderQueue();
  }

  syncNowPlaying() {
    const s = this.current;
    $('np-title').textContent = s ? s.title : 'Nothing playing';
    $('np-artist').textContent = s ? s.artist || 'Unknown artist' : 'Pick a song from the list';
    $('mini-title').textContent = s ? s.title : '';
    $('pl-game').disabled = !s;
    $('np-dur').textContent = s ? fmt(s.duration) : '0:00';
  }

  updateMediaSession() {
    if (!('mediaSession' in navigator) || !this.current || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: this.current.title,
      artist: this.current.artist || 'SCANLINE',
      album: 'SCANLINE',
    });
  }

  renderQueue() {
    const ol = $('pl-queue');
    const list = this.list();
    if (ol.childElementCount !== list.length || ol.dataset.cur !== (this.current && this.current.id) || ol.dataset.playing !== String(this.playing)) {
      ol.replaceChildren();
      ol.dataset.cur = this.current ? this.current.id : '';
      ol.dataset.playing = String(this.playing);
      list.forEach((s, i) => {
        const li = document.createElement('li');
        li.className = `pl-item${s === this.current ? ' current' : ''}`;
        li.tabIndex = 0;
        const num = document.createElement('span');
        num.className = 'pl-num';
        num.textContent = s === this.current && this.playing ? '♪' : String(i + 1);
        const info = document.createElement('span');
        info.className = 'pl-info';
        const t = document.createElement('b');
        t.textContent = s.title;
        const a = document.createElement('small');
        a.textContent = `${s.artist || 'Unknown artist'} · ${fmt(s.duration)}`;
        info.append(t, a);
        li.append(num, info);
        const go = () => this.play(s);
        li.addEventListener('click', go);
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        ol.append(li);
      });
    }
  }

  // Called every animation frame while the player screen or mini player is visible.
  frame(visible) {
    const pos = this.position();
    const dur = this.current ? this.current.duration : 0;
    // Start the next song early so the two overlap for the crossfade.
    const xf = this.crossfade();
    if (this.playing && xf > 0 && !this.xfStarted && dur > xf * 3 && dur - pos <= xf) {
      const list = this.list();
      const last = !this.shuffle && list.indexOf(this.current) === list.length - 1;
      if (!(last && this.repeat === 'off')) {
        this.xfStarted = true;
        if (this.repeat === 'one') this.play(this.current, 0, xf);
        else this.next(true, xf);
      }
    }
    if (!this.seeking) $('np-seek').value = dur ? Math.round((pos / dur) * 1000) : 0;
    $('np-pos').textContent = fmt(pos);
    $('mini-bar').style.width = `${dur ? (pos / dur) * 100 : 0}%`;
    if (visible) this.drawViz();
  }

  drawViz() {
    const c = this.viz;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = c.clientWidth;
    if (!size) return;
    if (c.width !== Math.round(size * dpr)) {
      c.width = Math.round(size * dpr);
      c.height = Math.round(size * dpr);
    }
    const g = this.vg;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const cx = size / 2;
    const R = size * 0.3;
    const col = this.character.colors;
    const spec = this.music.spectrum();

    // circular spectrum
    const bars = 72;
    g.lineCap = 'round';
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const idx = Math.floor((i < bars / 2 ? i : bars - i) / (bars / 2) * spec.length * 0.7);
      const v = this.playing ? spec[idx] / 255 : 0.04;
      const len = 4 + v * v * size * 0.17;
      g.strokeStyle = i % 2 ? col.primary : col.secondary;
      g.globalAlpha = 0.55 + v * 0.45;
      g.lineWidth = Math.max(2, size / 140);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R + 8), cx + Math.sin(a) * (R + 8));
      g.lineTo(cx + Math.cos(a) * (R + 8 + len), cx + Math.sin(a) * (R + 8 + len));
      g.stroke();
    }
    g.globalAlpha = 1;

    // spinning disc
    if (this.playing) this.angle += 0.008;
    g.save();
    g.translate(cx, cx);
    g.rotate(this.angle);
    const hue = this.current ? this.current.hue : 200;
    const disc = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    disc.addColorStop(0, `hsl(${hue} 60% 22%)`);
    disc.addColorStop(1, `hsl(${(hue + 50) % 360} 70% 10%)`);
    g.fillStyle = disc;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.lineWidth = 1;
    for (let r = R * 0.45; r < R; r += 5) {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, R * 0.8, -0.4, 0.3);
    g.stroke();
    // centre label: the selected character
    g.save();
    g.beginPath();
    g.arc(0, 0, R * 0.42, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = col.primary;
    g.fillRect(-R, -R, R * 2, R * 2);
    const pic = portraitNow(this.character);
    if (pic && pic.custom) {
      const c = faceCrop(pic);
      const s = R * 0.95;
      g.drawImage(pic.img, c.sx, c.sy, c.sw, c.sw, -s / 2, -s * 0.42, s, s);
    } else if (pic) {
      const h = R * 1.6;
      const w = (h * pic.img.width) / pic.img.height;
      g.drawImage(pic.img, -w / 2, -h * 0.3, w, h);
    }
    g.restore();
    g.restore();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cx, R * 0.42, 0, Math.PI * 2);
    g.stroke();
  }
}
