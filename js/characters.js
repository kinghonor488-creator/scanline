// Original anime-style characters, drawn as layered SVG from a shared template.
// Each character has her own palette, hairstyle, accessory, outfit and background scene.
// Drop a PNG at assets/characters/<id>.png to replace a drawn portrait with your own art.

export const CHARACTERS = [
  {
    id: 'aoi',
    name: 'Aoi',
    jp: '葵',
    title: 'Neon Wanderer',
    blurb: 'A night-owl DJ who hears a beat in every city light.',
    scene: 'neon',
    hair: 'long',
    acc: 'headphones',
    outfit: 'cyber',
    mouth: 'smile',
    colors: {
      primary: '#4fd8ff', secondary: '#9b7bff', accent: '#ff5fb7',
      hair: '#3f6fe0', hairLight: '#8fc4ff', hairShade: '#253a92',
      eye: '#45e4ff', eyeDark: '#1b4592',
      outfit: '#1c2240', outfit2: '#4fd8ff',
    },
    lines: ['Ready when you are. Let the city keep time.', 'That last combo? The neon signs blinked along.', 'Headphones on. World off.'],
  },
  {
    id: 'sakura',
    name: 'Sakura',
    jp: '樱',
    title: 'Blossom Idol',
    blurb: 'A cheerful idol-in-training who dances through petal storms.',
    scene: 'sakura',
    hair: 'twintails',
    acc: 'ribbon',
    outfit: 'sailor',
    mouth: 'open',
    colors: {
      primary: '#ff6fae', secondary: '#ffb35e', accent: '#ff6fae',
      hair: '#ff9cc8', hairLight: '#ffd6ea', hairShade: '#d65c98',
      eye: '#ff5ea4', eyeDark: '#8a1f55',
      outfit: '#ffffff', outfit2: '#3c4c8f',
    },
    lines: ['Let\'s make this stage bloom!', 'Eeh?! Was that a full combo?!', 'Practice makes petals perfect~'],
  },
  {
    id: 'luna',
    name: 'Luna',
    jp: '露娜',
    title: 'Starlit Dreamer',
    blurb: 'A quiet stargazer who maps melodies onto constellations.',
    scene: 'stars',
    hair: 'longwave',
    acc: 'stars',
    outfit: 'dress',
    mouth: 'smile',
    colors: {
      primary: '#b39dff', secondary: '#6fe6ff', accent: '#ffe48a',
      hair: '#d8dbf4', hairLight: '#ffffff', hairShade: '#9497c8',
      eye: '#a084ff', eyeDark: '#36268f',
      outfit: '#2a2458', outfit2: '#b39dff',
    },
    lines: ['The stars are listening tonight.', 'Close your eyes... can you hear the next note?', 'Every song is a constellation.'],
  },
  {
    id: 'hikari',
    name: 'Hikari',
    jp: '光',
    title: 'Sunset Racer',
    blurb: 'A speed-loving gamer girl who never lets a beat get away.',
    scene: 'sunset',
    hair: 'bob',
    acc: 'catears',
    outfit: 'hoodie',
    mouth: 'cat',
    colors: {
      primary: '#ffad33', secondary: '#ff5c86', accent: '#ffe14d',
      hair: '#ff9440', hairLight: '#ffd28f', hairShade: '#c45a22',
      eye: '#ffb72e', eyeDark: '#8a3510',
      outfit: '#2c1d38', outfit2: '#ffad33',
    },
    lines: ['Faster! I want a harder chart!', 'Nyah~ that hit felt good.', 'Last one to a full combo buys snacks!'],
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

export function applyTheme(ch) {
  const r = document.documentElement.style;
  r.setProperty('--cyan', ch.colors.primary);
  r.setProperty('--pink', ch.colors.secondary);
  r.setProperty('--accent', ch.colors.accent);
}
