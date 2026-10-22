Original prompt: in this folder ,I want to make a game that is similar to "Cytus II",u can search this music game and u'll know its feature and the basic gaming methods and then what I want to innovate is that people can import the songs they love and play those songs,u know what I mean?

# SCANLINE — progress notes

## Concept
- Browser rhythm game in the style of Cytus II: a scan line sweeps up/down the screen one "page" at a time;
  notes are tapped/held/dragged/flicked as the line crosses them.
- The new idea: players import any audio file; the game analyzes it (onset detection + BPM/phase estimation)
  and auto-generates charts for Easy / Hard / Chaos.

## Layout
- `index.html`, `css/style.css` — DOM menus over a single full-window canvas.
- `js/main.js` — screen flow (menu → difficulty → play → results), import, settings, test hooks.
- `js/audio.js` — AudioContext, music playback, hit sounds, procedurally synthesized demo song.
- `js/analyzer.js` — STFT spectral flux, onset picking, tempo + beat phase, energy envelope.
- `js/chart.js` — deterministic chart generator (seeded RNG) from analysis + difficulty.
- `js/game.js` — gameplay: clock, scan line, rendering, input, judgments, scoring, autoplay.
- `js/fx.js` — particles, rings, floating judgement text, screen shake.
- `js/storage.js` — IndexedDB for imported songs (original bytes + analysis) and best scores.
- `js/calibrate.js` — tap-along metronome (100 BPM, 4 warm-up + 16 measured taps) -> median audio offset.
- `js/characters.js` — 4 original anime characters (Aoi, Sakura, Luna, Hikari) drawn as layered SVG from one
  template; theme colours; optional PNG override via `assets/characters/custom.json`.
- `js/scenes.js` — per-character animated backgrounds (neon city / sakura / starry sea / synthwave sunset).
- `js/player.js` — music player screen, mini player, Media Session controls.
- `js/soundpanel.js` — Sound panel: draggable 10-band EQ over a live spectrum, presets, loudness, spatial, crossfade.
- `js/intro.js` — ~10 s in-engine opening with synthesized soundtrack (skippable, toggle in Settings).

## Running
- `python3 -m http.server 8000` from this folder, then open http://localhost:8000 (ES modules need http).

## Log
- 2026-10-21: Built v1. Verified with Playwright (scripts kept outside the repo):
  - Demo song: analyzer finds 128 BPM; chart notes on the true grid; autoplay = 1,000,000 / ALL PERFECT.
  - Imported 97 BPM WAV (beats start at 1.37 s): BPM exact, onset error mean -0.25 ms / max 5 ms after
    parabolic peak interpolation + 6 ms flux-latency correction + median beat-phase nudge.
  - Manual mouse play (hard) and keyboard play (chaos): only deliberate skips missed; pause freezes time,
    resume does a 3 s countdown; import -> reload persistence -> delete; non-audio and corrupt files show toasts.
  - Mobile 390x844: no overflow, notes in bounds; combo moves under the top row on narrow screens.
- 2026-10-21: Added Settings -> "Calibrate by tapping". Uses the same heard-time model as the game clock
  (currentTime - outputLatency). Simulated taps at +30/-45 ms measured +35/-40 ms (timer jitter); no-tap run
  times out with Apply disabled; applied offset persists across reloads.
- 2026-10-21: Anime overhaul: title screen (also unlocks iOS audio) -> opening -> menu with animated character,
  character select, per-character stage + note colours + portrait in gameplay, combo cut-ins (25, then every 50),
  glossy sprite notes, layered hit feedback (flash, ghost pop, rings, sparkle stars, streak, camera punch,
  judgement-dependent chime/thud, vibrate on Android), miss vignette + BREAK, music player.
  Fixed during testing: modal z-index under menu, duplicate SVG gradient ids rendering transparent hair,
  miss vignette code landing in tick() (crashed on first miss). All earlier tests re-run clean.
- 2026-10-21: Listening upgrade. Chain: voice gain (BS.1770 loudness normalization to -14 LUFS, clamp -12..+8 dB,
  plus fades) -> bus (forced stereo) -> preamp (-60% of max EQ boost) -> 10 biquads -> spatial (stereo / M-S wide /
  headphone crossfeed / convolver hall) -> volume -> limiter (-1.5 dB) -> analysers. Meter verified against
  BS.1770 reference values (-20.00 / -3.01 LUFS). Player crossfade (0-10 s), click-free pause/seek.
  Calibration clicks now go through the same chain so the limiter's lookahead is included in the offset.
- 2026-10-21: Offline PWA: manifest + icons, subset self-hosted fonts (OFL), `sw.js` precache + stale-while-revalidate,
  storage.persist() on start, safe-area insets in the canvas layout. Published to GitHub Pages.
- 2026-10-21: Landscape-only on touch devices: manifest orientation landscape, rotate-device overlay for portrait
  (pointer: coarse), game auto-pauses when turned upright, short-landscape layout pass for every screen. sw v2.

## Deploying
- Push to `main`; GitHub Pages serves the repo root. Bump `VERSION` in `sw.js` whenever files are added or renamed
  (the precache list must match). Changed files reach installed phones on the launch after next (stale-while-revalidate).

## Gotchas
- Mouse is a single pointer: hard/chaos can put a hold over other notes, so mouse-only players will drop
  some of those (touch or keyboard handles it). Keyboard: any letter/Space = next note, hold key for holds.
- The demo song uses Math.random noise, so its chart varies by a note or two between page loads.
- Tests: load with `?notitle=1` (or `?play=demo&diff=hard&autoplay=1`) to skip the title screen.
- The service worker only registers off-localhost (or with `?sw=1`), so local dev never serves stale cached files.
- `advanceTime` switches the game to a manual clock and silences the music (test-only path).

## TODO / ideas
- Tempo changes: analysis assumes one BPM; notes still follow real onsets when off-grid, but pages won't.
- Long holds spanning pages, click-drag heads (Cytus II note types not yet implemented).
- Run the analyzer in a Web Worker for very long files (currently chunked on the main thread).
- Optional chart editor / per-song manual BPM override.
- Real illustrated character art (PNG) would lift quality most; the SVG portraits are flat placeholders.
- Voice lines / character-specific hit sounds; unlockables per character.
