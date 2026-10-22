# Character art

Each character is drawn with code (SVG) until you add a real illustration for her.
See `PROMPTS.md` for ready-made ChatGPT prompts (Chinese and English) for all eight characters.

To add an illustration:

1. Make a vertical 2:3 picture (for example 1024×1536) of the whole character in her scene, as in PROMPTS.md.
   It does not need a transparent background; the game shows it as a framed card and blurs it for the stage.
2. Convert it to WebP named after the character id (`yuexian.webp`, `qingdai.webp`, `shuanglan.webp`, `zidie.webp`,
   `sakumi.webp`, `feiwu.webp`, `moyu.webp`, `fenghua.webp`), about quality 86 (~550 KB each), put it here and add the id
   to `custom.json`. Keep the full-size PNG originals in `/art-src` (git-ignored).

The game then uses it everywhere: character select, main menu, opening, combo cut-ins, results,
music player disc and as a soft blurred background while playing.
