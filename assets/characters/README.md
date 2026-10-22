# Custom character art

The game draws every character with code (SVG). To use your own illustration instead:

1. Save a PNG with a transparent background, portrait orientation (about 400×560 ratio,
   e.g. 1200×1680), head near the top, cropped at the chest. Name it after the character id:
   `aoi.png`, `sakura.png`, `luna.png` or `hikari.png`.
2. Put it in this folder.
3. Add the id to `custom.json`, e.g. `["aoi", "luna"]`.

Reload the game; menus, cut-ins, the intro and the music player will all use your art.
