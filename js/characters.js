// Original anime-style characters, drawn as layered SVG from a shared template.
// Each character has her own palette, hairstyle, accessory, outfit and background scene.
// Drop a PNG at assets/characters/<id>.png to replace a drawn portrait with your own art.

export const CHARACTERS = [
  {
    id: 'yuexian', name: '月弦', en: 'Yuexian', title: 'Moonlit Violinist',
    blurb: 'A silver-haired violinist who plays duets with the moon.',
    scene: 'stars', hair: 'longwave', acc: 'stars', outfit: 'dress', mouth: 'smile',
    colors: {
      primary: '#7aa6ff', secondary: '#ff8a6b', accent: '#ffd27a',
      hair: '#dfe3f2', hairLight: '#ffffff', hairShade: '#9aa1c8',
      eye: '#7aa0ff', eyeDark: '#2b3f8f', outfit: '#1f2f6b', outfit2: '#ff8a6b',
    },
    lines: ['Shall we play this one together?', 'The moon is keeping time for us tonight.', 'Every string remembers the song.'],
  },
  {
    id: 'qingdai', name: '青黛', en: 'Qingdai', title: 'Jade Apothecary',
    blurb: 'A herbalist who brews melodies by lantern light.',
    scene: 'pavilion', hair: 'long', acc: 'flower', outfit: 'dress', mouth: 'smile',
    colors: {
      primary: '#5fd6a8', secondary: '#f2d48a', accent: '#c8f5e0',
      hair: '#2b2a3a', hairLight: '#5f5f80', hairShade: '#15141f',
      eye: '#9a7bd6', eyeDark: '#3a2a6b', outfit: '#2f7a5a', outfit2: '#f3ecd8',
    },
    lines: ['A pinch of rhythm, a spoonful of melody.', 'The lanterns are lit. Ready?', 'Breathe in, then follow the beat.'],
  },
  {
    id: 'shuanglan', name: '霜蓝', en: 'Shuanglan', title: 'Frost Rose',
    blurb: 'A quiet girl in lace who guards a castle of blue roses.',
    scene: 'castle', hair: 'bob', acc: 'ribbon', outfit: 'dress', mouth: 'smile',
    colors: {
      primary: '#7fb2ff', secondary: '#c9a8ff', accent: '#ffffff',
      hair: '#6b9cff', hairLight: '#bcd6ff', hairShade: '#3a5fc0',
      eye: '#4f8cff', eyeDark: '#1f3c8f', outfit: '#1c1a2e', outfit2: '#3a3a60',
    },
    lines: ['The roses bloom when you keep the beat.', 'Please... play with me a little longer.', 'Frost melts for a perfect combo.'],
  },
  {
    id: 'zidie', name: '紫蝶', en: 'Zidie', title: 'Butterfly Blade',
    blurb: 'A swordswoman whose cloak scatters butterflies on every cut.',
    scene: 'wisteria', hair: 'long', acc: 'flower', outfit: 'hoodie', mouth: 'smile',
    colors: {
      primary: '#b98cff', secondary: '#7ff0c8', accent: '#ff9ad5',
      hair: '#4a2a6b', hairLight: '#9a6bd6', hairShade: '#2a1640',
      eye: '#b06bff', eyeDark: '#4a1f8f', outfit: '#3a2a5a', outfit2: '#e8d8ff',
    },
    lines: ['Light steps, sharp timing.', 'The butterflies follow your rhythm.', 'One clean cut per beat.'],
  },
  {
    id: 'sakumi', name: '樱见', en: 'Sakumi', title: 'Spring Harbor',
    blurb: 'A schoolgirl who walks the harbour road every spring.',
    scene: 'sakura', hair: 'long', acc: 'none', outfit: 'sailor', mouth: 'open',
    colors: {
      primary: '#ff8fbf', secondary: '#7fb8ff', accent: '#ffe0ec',
      hair: '#3b2420', hairLight: '#7a4a40', hairShade: '#1e1210',
      eye: '#7a5a9a', eyeDark: '#2a1a40', outfit: '#26305e', outfit2: '#2f8a6a',
    },
    lines: ['Petals are falling. Let\'s go!', 'Same time tomorrow, after school?', 'That was so much fun!'],
  },
  {
    id: 'feiwu', name: '绯舞', en: 'Feiwu', title: 'Desert Dancer',
    blurb: 'A dancer whose silk ribbons trace the beat across the dunes.',
    scene: 'dunes', hair: 'longwave', acc: 'flower', outfit: 'dress', mouth: 'smile',
    colors: {
      primary: '#ff6b5e', secondary: '#3fc6b8', accent: '#ffd27a',
      hair: '#3a2418', hairLight: '#6a4430', hairShade: '#1e120c',
      eye: '#c8783a', eyeDark: '#5a2a10', outfit: '#b8322e', outfit2: '#ffd27a',
    },
    lines: ['Follow my steps across the sand.', 'The oasis sings when you dance.', 'Spin, sway... and strike!'],
  },
  {
    id: 'moyu', name: '墨羽', en: 'Moyu', title: 'Ink Swordswoman',
    blurb: 'A wandering swordswoman painted in ink and mountain mist.',
    scene: 'ink', hair: 'long', acc: 'none', outfit: 'cyber', mouth: 'smile',
    colors: {
      primary: '#4fb8c8', secondary: '#9a7bff', accent: '#e8dcc8',
      hair: '#2a2230', hairLight: '#5a4a60', hairShade: '#120e16',
      eye: '#4a8a9a', eyeDark: '#1a3a44', outfit: '#1e2a44', outfit2: '#4fb8c8',
    },
    lines: ['Draw your blade with the downbeat.', 'Still water, swift sword.', 'The mountains are listening.'],
  },
  {
    id: 'fenghua', name: '枫华', en: 'Fenghua', title: 'Crimson Maple',
    blurb: 'An autumn spirit dressed in maple red and falling gold.',
    scene: 'maple', hair: 'longwave', acc: 'flower', outfit: 'dress', mouth: 'smile',
    colors: {
      primary: '#ff5a4a', secondary: '#ffb84a', accent: '#ffe0a0',
      hair: '#2a1a18', hairLight: '#5a3a30', hairShade: '#120a08',
      eye: '#c04a3a', eyeDark: '#4a1410', outfit: '#a8241e', outfit2: '#ffcf6b',
    },
    lines: ['Every leaf falls right on the beat.', 'Autumn is short. Let\'s play.', 'Red as the maple, bright as your combo.'],
  },
];

export const byId = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

const LINE = '#2a1c33';
const SKIN = '#ffe6d8';
const SKIN_SHADE = '#f3b8a6';

// Mirror an SVG path across the vertical centre line (x -> 400 - x).
const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${400 - +x},${y}`);

function backHair(style) {
  switch (style) {
    case 'twintails': {
      const tail = 'M146,150 C84,150 46,250 54,350 C60,430 34,492 50,556 C88,500 106,440 104,360 C102,284 114,214 156,186 Z';
      return [
        'M128,192 C118,252 124,302 140,322 L260,322 C276,302 282,252 272,192 C282,108 118,108 128,192 Z',
        tail,
        mirror(tail),
      ];
    }
    case 'bob':
      return ['M122,192 C106,262 112,326 134,350 C170,358 230,358 266,350 C288,326 294,262 278,192 C288,106 112,106 122,192 Z'];
    case 'longwave':
      return ['M124,188 C94,280 122,360 98,440 C86,500 118,540 128,558 L272,558 C282,540 314,500 302,440 C278,360 306,280 276,188 C286,104 114,104 124,188 Z'];
    default:
      return ['M124,188 C102,282 98,430 116,556 L284,556 C302,430 298,282 276,188 C286,104 114,104 124,188 Z'];
  }
}

function bangsPath() {
  const pts = [
    [276, 216], [258, 182], [250, 224], [236, 178], [226, 220], [214, 172], [203, 228],
    [192, 174], [180, 220], [168, 178], [156, 224], [144, 184], [124, 216],
  ];
  let d = 'M124,216 C110,100 290,100 276,216';
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const cx = (px + x) / 2 + (x > 200 ? 5 : -5);
    const cy = (py + y) / 2 + 6;
    d += ` Q${cx},${cy} ${x},${y}`;
  }
  return `${d} Z`;
}

function sideLock(style) {
  const long = style === 'bob' ? 352 : style === 'twintails' ? 300 : 468;
  const left = `M134,196 C120,252 124,${long - 46} 140,${long} C148,${long - 40} 152,252 156,208 Z`;
  return [left, mirror(left)];
}

function eye(cx, cy, c, id, flip) {
  const s = flip ? -1 : 1;
  const lash = `M${cx - 21 * s},${cy - 3} Q${cx - 2 * s},${cy - 29} ${cx + 19 * s},${cy - 9} Q${cx},${cy - 20} ${cx - 21 * s},${cy - 3} Z`;
  const wing = `M${cx - 19 * s},${cy - 5} L${cx - 27 * s},${cy - 10} L${cx - 21 * s},${cy} Z`;
  return `
    <ellipse cx="${cx}" cy="${cy + 1}" rx="16" ry="18.5" fill="#fff"/>
    <ellipse cx="${cx}" cy="${cy + 3}" rx="12.5" ry="16" fill="url(#${id}-iris)" stroke="${c.eyeDark}" stroke-width="1.5"/>
    <ellipse cx="${cx}" cy="${cy + 4}" rx="5.5" ry="8" fill="#1b1030"/>
    <ellipse cx="${cx}" cy="${cy + 11}" rx="7" ry="3.5" fill="${c.eye}" opacity="0.7"/>
    <ellipse cx="${cx + 4}" cy="${cy - 5}" rx="4.6" ry="5.6" fill="#fff"/>
    <circle cx="${cx - 5}" cy="${cy + 9}" r="2.2" fill="#fff" opacity="0.9"/>
    <path d="${lash}" fill="${LINE}"/>
    <path d="${wing}" fill="${LINE}"/>
    <path d="M${cx - 8},${cy + 18} Q${cx},${cy + 20} ${cx + 8},${cy + 18}" stroke="${LINE}" stroke-width="1.4" fill="none" opacity="0.55"/>
    <ellipse class="lid" cx="${cx}" cy="${cy}" rx="19" ry="21" fill="${SKIN}"/>
  `;
}

function mouth(kind) {
  if (kind === 'open') {
    return '<path d="M190,288 Q200,302 211,288 Q200,292 190,288 Z" fill="#e2647f" stroke="#a83a55" stroke-width="2" stroke-linejoin="round"/>';
  }
  if (kind === 'cat') {
    return '<path d="M188,288 Q194,295 200,288 Q206,295 212,288" stroke="#a83a55" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  }
  return '<path d="M190,288 Q200,296 211,287" stroke="#a83a55" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
}

function outfit(kind, c, id) {
  const body = `<path d="M58,560 C62,474 96,424 148,406 C170,398 186,392 200,392 C214,392 230,398 252,406 C304,424 338,474 342,560 Z" fill="url(#${id}-outfit)" stroke="${LINE}" stroke-width="2.5"/>`;
  switch (kind) {
    case 'sailor':
      return `${body}
        <path d="M126,404 L200,474 L274,404 L304,436 L200,528 L96,436 Z" fill="${c.outfit2}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M114,432 L200,510 L286,432" stroke="#fff" stroke-width="4" fill="none"/>
        <path d="M200,474 L164,500 L172,530 Z M200,474 L236,500 L228,530 Z" fill="${c.primary}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="200" cy="476" r="8" fill="${c.primary}" stroke="${LINE}" stroke-width="2"/>`;
    case 'cyber':
      return `${body}
        <path d="M164,382 L236,382 L242,408 L158,408 Z" fill="#11152a" stroke="${LINE}" stroke-width="2.5"/>
        <path d="M162,404 L238,404" stroke="${c.outfit2}" stroke-width="3"/>
        <path d="M132,428 L172,468 L172,560 M268,428 L228,468 L228,560" stroke="${c.outfit2}" stroke-width="3.5" fill="none" opacity="0.9"/>
        <path d="M110,470 L140,500 M290,470 L260,500" stroke="${c.accent}" stroke-width="3" opacity="0.8"/>
        <circle cx="200" cy="452" r="7" fill="${c.outfit2}"/>`;
    case 'dress':
      return `${body}
        <path d="M150,392 Q200,446 250,392 Q226,390 200,388 Q174,390 150,392 Z" fill="${SKIN}" stroke="${LINE}" stroke-width="2"/>
        <path d="M144,396 Q200,462 256,396" stroke="#fff" stroke-width="7" fill="none" stroke-dasharray="2 9" stroke-linecap="round"/>
        <path d="M200,452 l6,12 l13,2 l-10,9 l3,13 l-12,-7 l-12,7 l3,-13 l-10,-9 l13,-2 Z" fill="${c.accent}" stroke="${LINE}" stroke-width="1.5"/>`;
    default: // hoodie
      return `<path d="M104,426 C112,368 288,368 296,426 Z" fill="${c.outfit2}" stroke="${LINE}" stroke-width="2.5"/>
        ${body}
        <path d="M200,392 L200,560" stroke="#000" stroke-width="2" opacity="0.4"/>
        <path d="M178,400 L172,470 M222,400 L228,470" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
        <circle cx="172" cy="474" r="5" fill="${c.outfit2}"/><circle cx="228" cy="474" r="5" fill="${c.outfit2}"/>
        <path d="M120,520 L160,520 M240,520 L280,520" stroke="${c.outfit2}" stroke-width="4" opacity="0.8"/>`;
  }
}

function accessory(kind, c) {
  switch (kind) {
    case 'headphones':
      return `
        <path d="M116,206 C104,82 296,82 284,206" stroke="#eef6ff" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M116,206 C104,82 296,82 284,206" stroke="${LINE}" stroke-width="2" fill="none" opacity="0.5"/>
        <rect x="100" y="182" width="32" height="62" rx="14" fill="#1d2440" stroke="${LINE}" stroke-width="2.5"/>
        <rect x="107" y="194" width="7" height="38" rx="3.5" fill="${c.primary}"/>
        <rect x="268" y="182" width="32" height="62" rx="14" fill="#1d2440" stroke="${LINE}" stroke-width="2.5"/>
        <rect x="286" y="194" width="7" height="38" rx="3.5" fill="${c.primary}"/>`;
    case 'ribbon': {
      const bow = (x, y) => `
        <path d="M${x},${y} C${x - 34},${y - 26} ${x - 38},${y + 20} ${x},${y} Z M${x},${y} C${x + 34},${y - 26} ${x + 38},${y + 20} ${x},${y} Z"
          fill="${c.accent}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M${x - 3},${y + 4} L${x - 12},${y + 30} M${x + 3},${y + 4} L${x + 12},${y + 30}" stroke="${c.accent}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="${x}" cy="${y}" r="7" fill="#fff" stroke="${LINE}" stroke-width="2"/>`;
      return bow(140, 150) + bow(260, 150);
    }
    case 'stars': {
      const star = (x, y, r) => {
        let d = '';
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? r * 0.45 : r;
          d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)} `;
        }
        return `<path d="${d}Z" fill="${c.accent}" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round"/>`;
      };
      return `${star(262, 160, 15)}${star(246, 132, 9)}
        <path d="M140,140 A18,18 0 1 0 160,168 A14,14 0 1 1 140,140 Z" fill="#fff6c2" stroke="${LINE}" stroke-width="1.8"/>`;
    }
    case 'catears': {
      const ear = 'M118,150 L128,78 L174,118 Z';
      const inner = 'M128,138 L134,98 L160,120 Z';
      return `
        <path d="M116,206 C104,82 296,82 284,206" stroke="#2c1d38" stroke-width="9" fill="none" stroke-linecap="round"/>
        <path d="${ear}" fill="#2c1d38" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="${inner}" fill="${c.primary}"/>
        <path d="${mirror(ear)}" fill="#2c1d38" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="${mirror(inner)}" fill="${c.primary}"/>
        <rect x="104" y="188" width="28" height="50" rx="12" fill="#2c1d38" stroke="${LINE}" stroke-width="2.5"/>
        <rect x="268" y="188" width="28" height="50" rx="12" fill="#2c1d38" stroke="${LINE}" stroke-width="2.5"/>
        <circle cx="118" cy="213" r="6" fill="${c.primary}"/><circle cx="282" cy="213" r="6" fill="${c.primary}"/>
        <path d="M272,232 C266,276 236,292 220,292" stroke="#2c1d38" stroke-width="3" fill="none"/>
        <circle cx="218" cy="292" r="4.5" fill="${c.primary}"/>`;
    }
    case 'flower': {
      const bloom = (x, y, r, col) => {
        let out = '';
        for (let k = 0; k < 5; k++) {
          const ang = (k / 5) * Math.PI * 2;
          out += `<circle cx="${(x + Math.cos(ang) * r * 0.6).toFixed(1)}" cy="${(y + Math.sin(ang) * r * 0.6).toFixed(1)}" r="${(r * 0.55).toFixed(1)}" fill="${col}" stroke="${LINE}" stroke-width="1.4"/>`;
        }
        return `${out}<circle cx="${x}" cy="${y}" r="${(r * 0.35).toFixed(1)}" fill="${c.accent}"/>`;
      };
      return bloom(258, 150, 16, c.primary) + bloom(276, 176, 10, c.secondary) + bloom(242, 128, 9, '#ffffff');
    }
    default:
      return '';
  }
}

// Returns a standalone SVG string. `animated` adds blink/breath classes for DOM use.
// Every SVG gets its own id prefix: the same character can be on the page several times, and a
// gradient referenced from a hidden duplicate would not render.
let svgSeq = 0;

export function characterSVG(ch, { animated = false } = {}) {
  const c = ch.colors;
  const id = `ch-${ch.id}-${++svgSeq}`;
  const bangs = bangsPath();
  const style = animated
    ? `<style>
        .lid{transform-box:fill-box;transform-origin:50% 0;transform:scaleY(0);animation:${id}-blink 4.2s infinite}
        @keyframes ${id}-blink{0%,92%,100%{transform:scaleY(0)}95%{transform:scaleY(1)}}
        .breath{animation:${id}-breath 3.6s ease-in-out infinite;transform-origin:200px 560px}
        @keyframes ${id}-breath{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px) scale(1.004)}}
        .sway{animation:${id}-sway 4.8s ease-in-out infinite;transform-origin:200px 120px}
        @keyframes ${id}-sway{0%,100%{transform:rotate(0)}50%{transform:rotate(1.2deg)}}
      </style>`
    : '<style>.lid{display:none}</style>';
  const ahoge = ch.hair === 'bob' || ch.hair === 'long'
    ? `<path d="M198,132 C202,98 228,84 242,92 C226,98 214,110 206,134 Z" fill="url(#${id}-hair)" stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="400" height="560">
  ${style}
  <defs>
    <linearGradient id="${id}-hair" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.hairLight}"/>
      <stop offset="0.35" stop-color="${c.hair}"/>
      <stop offset="1" stop-color="${c.hairShade}"/>
    </linearGradient>
    <linearGradient id="${id}-back" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.hair}"/>
      <stop offset="1" stop-color="${c.hairShade}"/>
    </linearGradient>
    <linearGradient id="${id}-iris" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.eyeDark}"/>
      <stop offset="0.55" stop-color="${c.eye}"/>
      <stop offset="1" stop-color="#ffffff"/>
    </linearGradient>
    <linearGradient id="${id}-outfit" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.outfit}"/>
      <stop offset="1" stop-color="${c.outfit}" stop-opacity="0.85"/>
    </linearGradient>
    <clipPath id="${id}-face"><path d="M138,196 C136,262 168,302 200,318 C232,302 264,262 262,196 C262,140 138,140 138,196 Z"/></clipPath>
  </defs>
  <g class="breath">
    <g class="sway">
      ${backHair(ch.hair).map((d) => `<path d="${d}" fill="url(#${id}-back)" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>`).join('')}
    </g>
    ${outfit(ch.outfit, c, id)}
    <path d="M184,298 L184,350 C190,362 210,362 216,350 L216,298 Z" fill="${SKIN}" stroke="${LINE}" stroke-width="2"/>
    <path d="M184,300 C192,320 208,320 216,300 L216,326 C208,334 192,334 184,326 Z" fill="${SKIN_SHADE}"/>
    <path d="M138,196 C136,262 168,302 200,318 C232,302 264,262 262,196 C262,140 138,140 138,196 Z" fill="${SKIN}" stroke="${LINE}" stroke-width="2.5"/>
    <g clip-path="url(#${id}-face)">
      <path d="${bangs}" fill="${SKIN_SHADE}" opacity="0.6" transform="translate(0,11)"/>
    </g>
    <ellipse cx="160" cy="276" rx="13" ry="6" fill="#ff8aa6" opacity="0.38"/>
    <ellipse cx="240" cy="276" rx="13" ry="6" fill="#ff8aa6" opacity="0.38"/>
    <path d="M154,278 l4,-6 M160,278 l4,-6 M166,278 l4,-6 M234,278 l4,-6 M240,278 l4,-6 M246,278 l4,-6" stroke="#ff7895" stroke-width="1.4" opacity="0.55"/>
    ${eye(172, 244, c, id, false)}
    ${eye(228, 244, c, id, true)}
    <path d="M200,266 Q202,270 199,272" stroke="${SKIN_SHADE}" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${mouth(ch.mouth)}
    <g class="sway">
      ${sideLock(ch.hair).map((d) => `<path d="${d}" fill="url(#${id}-hair)" stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round"/>`).join('')}
      ${ahoge}
      <path d="${bangs}" fill="url(#${id}-hair)" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M154,154 Q200,132 246,154" stroke="${c.hairLight}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.85"/>
      <path d="M168,168 l6,-8 M230,162 l6,8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      ${accessory(ch.acc, c)}
    </g>
  </g>
</svg>`;
}

// ---- image cache for canvas drawing ----
const images = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Custom art (assets/characters/<id>.png) wins over the drawn portrait when present.
// assets/characters/custom.json lists the ids that have a PNG, so nothing 404s when there are none.
let customList = null;
function customIds() {
  if (!customList) {
    customList = fetch('assets/characters/custom.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return customList;
}

export async function portraitImage(ch) {
  if (images.has(ch.id)) return images.get(ch.id);
  const p = customIds()
    .then((ids) => {
      if (!ids.includes(ch.id)) throw new Error('no custom art');
      return loadImage(`assets/characters/${ch.id}.png`);
    })
    .then((img) => ({ img, custom: true }))
    .catch(() => {
      const url = URL.createObjectURL(new Blob([characterSVG(ch)], { type: 'image/svg+xml' }));
      return loadImage(url).then((img) => ({ img, custom: false }));
    });
  images.set(ch.id, p);
  return p;
}

export function preloadPortraits() {
  return Promise.all(CHARACTERS.map(portraitImage));
}

// Synchronous access once loaded (null until then).
const ready = new Map();
export function portraitNow(ch) {
  if (ready.has(ch.id)) return ready.get(ch.id);
  portraitImage(ch).then((p) => ready.set(ch.id, p));
  return null;
}

// Source rectangle for the face and upper body. Drawn busts use the whole picture; full
// illustration cards (custom art) are cropped to the top of the figure.
export function faceCrop(pic) {
  const w = pic.img.naturalWidth || pic.img.width;
  const h = pic.img.naturalHeight || pic.img.height;
  if (!pic.custom) return { sx: 0, sy: 0, sw: w, sh: h };
  const sw = w * 0.62;
  return { sx: (w - sw) / 2, sy: h * 0.07, sw, sh: sw * 1.15 };
}

// A soft, blurred cover-fit copy of the art for backgrounds. Halving the image a few times and
// doubling it back up gives a smooth blur that works everywhere (canvas filters are missing in
// some Safari versions).
const blurCache = new Map();
export function blurredCover(pic, W, H) {
  const key = `${pic.img.src}|${Math.round(W)}x${Math.round(H)}`;
  if (blurCache.has(key)) return blurCache.get(key);
  const canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(4, Math.round(w));
    c.height = Math.max(4, Math.round(h));
    return c;
  };
  const iw = pic.img.naturalWidth || pic.img.width;
  const ih = pic.img.naturalHeight || pic.img.height;
  let cur = canvas(W / 2, H / 2);
  let g = cur.getContext('2d');
  const k = Math.max(cur.width / iw, cur.height / ih);
  g.drawImage(pic.img, (cur.width - iw * k) / 2, (cur.height - ih * k) / 2, iw * k, ih * k);
  const steps = [];
  for (let i = 0; i < 4; i++) {
    const next = canvas(cur.width / 2, cur.height / 2);
    const ng = next.getContext('2d');
    ng.imageSmoothingQuality = 'high';
    ng.drawImage(cur, 0, 0, next.width, next.height);
    steps.push(cur);
    cur = next;
  }
  while (steps.length) {
    const up = steps.pop();
    const ug = up.getContext('2d');
    ug.imageSmoothingQuality = 'high';
    ug.clearRect(0, 0, up.width, up.height);
    ug.drawImage(cur, 0, 0, up.width, up.height);
    cur = up;
  }
  if (blurCache.size > 6) blurCache.delete(blurCache.keys().next().value);
  blurCache.set(key, cur);
  return cur;
}

// Draws a character: an illustration card gets a rounded white frame, a drawn bust is drawn as is.
export function drawPortrait(g, pic, x, y, w, h) {
  if (!pic.custom) {
    g.drawImage(pic.img, x, y, w, h);
    return;
  }
  const r = Math.min(w, h) * 0.05;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowBlur = 24;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(x - 4, y - 4, w + 8, h + 8, r + 4);
  g.fill();
  g.restore();
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.clip();
  g.drawImage(pic.img, x, y, w, h);
  g.restore();
}

export function applyTheme(ch) {
  const r = document.documentElement.style;
  r.setProperty('--cyan', ch.colors.primary);
  r.setProperty('--pink', ch.colors.secondary);
  r.setProperty('--accent', ch.colors.accent);
}
