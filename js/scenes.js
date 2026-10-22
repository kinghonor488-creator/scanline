// Animated backgrounds, one per character. Static parts are pre-rendered to an offscreen canvas on
// resize; draw() adds the moving parts (rain, petals, stars, grid) every frame.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function vgrad(g, H, stops) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

function glow(g, x, y, r, color, alpha = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = alpha;
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
}

class Scene {
  constructor(theme) {
    this.theme = theme;
    this.W = 0;
    this.H = 0;
    this.layer = document.createElement('canvas');
  }

  resize(W, H, dpr) {
    if (W === this.W && H === this.H && dpr === this.dpr) return;
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.layer.width = Math.round(W * dpr);
    this.layer.height = Math.round(H * dpr);
    const g = this.layer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.paintStatic(g, W, H, rng(1234));
    this.setup(W, H, rng(99));
  }

  draw(g, t, pulse = 0) {
    g.drawImage(this.layer, 0, 0, this.W, this.H);
    this.drawDynamic(g, t, pulse);
  }

  paintStatic() {}
  setup() {}
  drawDynamic() {}
}

// ---------------------------------------------------------------- neon city (Aoi)
class NeonScene extends Scene {
  paintStatic(g, W, H, r) {
    g.fillStyle = vgrad(g, H, [[0, '#070a24'], [0.45, '#1c1048'], [0.72, '#47185e'], [1, '#0a0716']]);
    g.fillRect(0, 0, W, H);
    glow(g, W * 0.5, H * 0.72, Math.max(W, H) * 0.55, 'rgba(255, 70, 170, 0.35)');
    const horizon = H * 0.74;
    const layers = [
      { col: '#1d1a44', min: 0.12, max: 0.34, win: 0.25 },
      { col: '#0e0c26', min: 0.18, max: 0.5, win: 0.45 },
    ];
    for (const L of layers) {
      let x = -10;
      while (x < W + 10) {
        const w = 26 + r() * 60;
        const h = H * (L.min + r() * (L.max - L.min));
        g.fillStyle = L.col;
        g.fillRect(x, horizon - h, w, h + H);
        for (let wy = horizon - h + 8; wy < horizon - 6; wy += 9) {
          for (let wx = x + 5; wx < x + w - 6; wx += 8) {
            if (r() < L.win) {
              const c = r();
              g.fillStyle = c < 0.5 ? 'rgba(120,220,255,0.55)' : c < 0.8 ? 'rgba(255,120,210,0.5)' : 'rgba(255,230,140,0.5)';
              g.fillRect(wx, wy, 3, 4);
            }
          }
        }
        if (r() < 0.25) {
          g.fillStyle = r() < 0.5 ? this.theme.primary : this.theme.accent;
          g.globalAlpha = 0.8;
          g.fillRect(x + 4, horizon - h + 10 + r() * h * 0.3, w - 8, 3);
          g.globalAlpha = 1;
        }
        x += w + 2 + r() * 10;
      }
    }
    g.fillStyle = vgrad(g, H, [[0, 'rgba(0,0,0,0)'], [0.74, 'rgba(0,0,0,0)'], [0.75, 'rgba(30,10,50,0.9)'], [1, '#05040c']]);
    g.fillRect(0, 0, W, H);
  }

  setup(W, H, r) {
    this.rain = Array.from({ length: Math.round((W * H) / 9000) }, () => ({ x: r() * W, y: r() * H, v: 500 + r() * 400, l: 10 + r() * 16 }));
  }

  drawDynamic(g, t, pulse) {
    const { W, H } = this;
    // Reflections of the skyline on the wet street.
    g.globalAlpha = 0.18 + pulse * 0.1;
    for (let i = 0; i < 14; i++) {
      const y = H * 0.77 + i * 9;
      const x = ((i * 137 + t * 30) % (W + 200)) - 100;
      g.fillStyle = i % 2 ? this.theme.primary : this.theme.accent;
      g.fillRect(x, y, 60 + (i % 3) * 40, 2);
    }
    g.globalAlpha = 0.28;
    g.strokeStyle = '#9fd8ff';
    g.lineWidth = 1;
    g.beginPath();
    for (const d of this.rain) {
      const y = (d.y + t * d.v) % (H + 40) - 20;
      const x = (d.x + y * 0.18) % W;
      g.moveTo(x, y);
      g.lineTo(x - d.l * 0.18, y - d.l);
    }
    g.stroke();
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- sakura garden (Sakura)
class SakuraScene extends Scene {
  paintStatic(g, W, H, r) {
    g.fillStyle = vgrad(g, H, [[0, '#ffc6de'], [0.45, '#f6c9ef'], [0.75, '#cdb8ff'], [1, '#8f7ad6']]);
    g.fillRect(0, 0, W, H);
    glow(g, W * 0.72, H * 0.28, Math.max(W, H) * 0.35, 'rgba(255,255,240,0.9)');
    // Rolling hills.
    const hill = (base, amp, col, seed) => {
      const rr = rng(seed);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W + 40; x += 40) g.lineTo(x, base + Math.sin(x * 0.006 + rr() * 6) * amp + rr() * 8);
      g.lineTo(W, H);
      g.fill();
    };
    hill(H * 0.66, 30, 'rgba(180,140,230,0.55)', 3);
    hill(H * 0.76, 22, 'rgba(150,110,200,0.7)', 5);
    // Torii gate silhouette.
    const tx = W * 0.2, ty = H * 0.78, s = Math.min(W, H) * 0.0016;
    g.fillStyle = 'rgba(200,60,90,0.75)';
    g.fillRect(tx - 70 * s, ty - 150 * s, 12 * s, 150 * s);
    g.fillRect(tx + 58 * s, ty - 150 * s, 12 * s, 150 * s);
    g.fillRect(tx - 95 * s, ty - 160 * s, 190 * s, 14 * s);
    g.fillRect(tx - 80 * s, ty - 125 * s, 160 * s, 9 * s);
    // Blossom-heavy branches in the top corners.
    const branch = (x0, y0, dir) => {
      g.strokeStyle = 'rgba(110,60,80,0.85)';
      g.lineCap = 'round';
      const stack = [[x0, y0, dir * 0.35 + (dir > 0 ? 0.25 : Math.PI - 0.25), Math.min(W, H) * 0.22, 10]];
      while (stack.length) {
        const [x, y, a, len, w] = stack.pop();
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        g.lineWidth = w;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        for (let i = 0; i < 6; i++) {
          g.fillStyle = r() < 0.5 ? 'rgba(255,180,210,0.9)' : 'rgba(255,215,232,0.95)';
          g.beginPath();
          g.arc(x2 + (r() - 0.5) * 40, y2 + (r() - 0.5) * 30, 6 + r() * 9, 0, Math.PI * 2);
          g.fill();
        }
        if (w > 3) {
          stack.push([x2, y2, a + 0.35 + r() * 0.3, len * 0.7, w * 0.65]);
          stack.push([x2, y2, a - 0.35 - r() * 0.3, len * 0.7, w * 0.65]);
        }
      }
    };
    branch(-10, H * 0.04, 1);
    branch(W + 10, H * 0.1, -1);
  }

  setup(W, H, r) {
    this.petals = Array.from({ length: Math.round((W * H) / 16000) + 20 }, () => ({
      x: r() * W, y: r() * H, s: 4 + r() * 5, v: 30 + r() * 50, ph: r() * 6, spin: 1 + r() * 2,
    }));
  }

  drawDynamic(g, t) {
    const { W, H } = this;
    for (const p of this.petals) {
      const y = (p.y + t * p.v) % (H + 20) - 10;
      const x = (p.x + Math.sin(t * 0.8 + p.ph) * 30 + t * 20) % (W + 20) - 10;
      g.save();
      g.translate(x, y);
      g.rotate(t * p.spin + p.ph);
      g.scale(1, 0.55 + 0.45 * Math.sin(t * 2 + p.ph));
      g.fillStyle = 'rgba(255,170,205,0.9)';
      g.beginPath();
      g.ellipse(0, 0, p.s, p.s * 0.6, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
}

// ---------------------------------------------------------------- starry sea (Luna)
class StarScene extends Scene {
  paintStatic(g, W, H) {
    g.fillStyle = vgrad(g, H, [[0, '#050822'], [0.5, '#16114a'], [0.7, '#2c2272'], [0.71, '#0b0a26'], [1, '#04040f']]);
    g.fillRect(0, 0, W, H);
    glow(g, W * 0.5, H * 0.1, Math.max(W, H) * 0.6, 'rgba(110,80,220,0.25)');
    // Milky way band.
    g.save();
    g.translate(W * 0.5, H * 0.35);
    g.rotate(-0.35);
    const band = g.createLinearGradient(0, -H * 0.12, 0, H * 0.12);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.5, 'rgba(180,170,255,0.18)');
    band.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = band;
    g.fillRect(-W, -H * 0.12, W * 2, H * 0.24);
    g.restore();
    // Moon.
    const mx = W * 0.78, my = H * 0.22, mr = Math.min(W, H) * 0.08;
    glow(g, mx, my, mr * 4, 'rgba(255,245,210,0.35)');
    g.fillStyle = '#fff6d8';
    g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(220,210,180,0.5)';
    g.beginPath(); g.arc(mx - mr * 0.3, my + mr * 0.2, mr * 0.18, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(mx + mr * 0.35, my - mr * 0.3, mr * 0.12, 0, Math.PI * 2); g.fill();
    this.moon = { x: mx, r: mr };
  }

  setup(W, H, r) {
    this.stars = Array.from({ length: Math.round((W * H) / 3500) }, () => ({
      x: r() * W, y: r() * H * 0.7, s: r() < 0.1 ? 2.2 : 1.2, ph: r() * 6, sp: 1 + r() * 2,
    }));
  }

  drawDynamic(g, t, pulse) {
    const { W, H } = this;
    for (const s of this.stars) {
      g.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)) * (0.8 + pulse * 0.2);
      g.fillStyle = '#ffffff';
      g.fillRect(s.x, s.y, s.s, s.s);
    }
    // Shooting star every few seconds.
    const cyc = t % 7;
    if (cyc < 0.8) {
      const k = cyc / 0.8;
      const sx = W * (0.15 + 0.5 * ((Math.floor(t / 7) * 0.37) % 1)), sy = H * 0.1;
      const x = sx + k * W * 0.25, y = sy + k * H * 0.15;
      const gr = g.createLinearGradient(x - 90, y - 54, x, y);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(255,255,255,0.9)');
      g.globalAlpha = 1 - k;
      g.strokeStyle = gr;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - 90, y - 54); g.lineTo(x, y); g.stroke();
    }
    // Moon path shimmering on the sea.
    const top = H * 0.71;
    for (let i = 0; i < 16; i++) {
      const y = top + i * ((H - top) / 16);
      const w = this.moon.r * (0.6 + i * 0.12) * (0.7 + 0.3 * Math.sin(t * 2 + i));
      g.globalAlpha = 0.5 - i * 0.025;
      g.fillStyle = '#fff1c4';
      g.fillRect(this.moon.x - w / 2 + Math.sin(t * 1.5 + i * 0.7) * 6, y, w, 2);
    }
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- synthwave sunset (Hikari)
class SunsetScene extends Scene {
  paintStatic(g, W, H) {
    const hz = H * 0.62;
    this.hz = hz;
    g.fillStyle = vgrad(g, H, [[0, '#1f0b36'], [0.3, '#6a1a5c'], [0.52, '#e0486b'], [0.62, '#ffb04a'], [0.621, '#1a0826'], [1, '#090312']]);
    g.fillRect(0, 0, W, H);
    // Striped sun.
    const sr = Math.min(W, H) * 0.2, sx = W * 0.5, sy = hz - sr * 0.35;
    glow(g, sx, sy, sr * 2.5, 'rgba(255,170,80,0.45)');
    g.save();
    g.beginPath(); g.rect(0, 0, W, hz); g.clip();
    const sg = g.createLinearGradient(0, sy - sr, 0, sy + sr);
    sg.addColorStop(0, '#ffe36b');
    sg.addColorStop(1, '#ff3d7f');
    g.fillStyle = sg;
    g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) g.fillRect(sx - sr, sy + sr * (0.1 + i * 0.16), sr * 2, 2 + i * 1.6);
    g.restore();
    // Mountains.
    g.fillStyle = '#3a1450';
    g.beginPath();
    g.moveTo(0, hz);
    const r2 = rng(7);
    for (let x = 0; x <= W; x += W / 12) g.lineTo(x, hz - (20 + r2() * 70) * (Math.abs(x - W / 2) / W + 0.4));
    g.lineTo(W, hz);
    g.fill();
  }

  setup(W, H, r) {
    this.sparks = Array.from({ length: 40 }, () => ({ x: r() * W, y: r() * H, v: 20 + r() * 50, ph: r() * 6 }));
  }

  drawDynamic(g, t, pulse) {
    const { W, H, hz } = this;
    g.strokeStyle = `rgba(255, 80, 200, ${0.45 + pulse * 0.3})`;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = -14; i <= 14; i++) {
      g.moveTo(W / 2 + i * 12, hz);
      g.lineTo(W / 2 + i * W * 0.16, H);
    }
    const off = (t * 0.6) % 1;
    for (let k = 0; k < 12; k++) {
      const d = (k + off) / 12;
      const y = hz + (H - hz) * d * d;
      g.moveTo(0, y);
      g.lineTo(W, y);
    }
    g.stroke();
    for (const s of this.sparks) {
      const y = (s.y - t * s.v) % H;
      const yy = y < 0 ? y + H : y;
      g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + s.ph);
      g.fillStyle = '#ffd36b';
      g.fillRect(s.x + Math.sin(t + s.ph) * 10, yy, 2, 2);
    }
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- themed scenes (newer characters)
// One configurable scene: sky gradient, an optional moon, a skyline feature and a particle type.
const THEMES = {
  pavilion: { sky: ['#071a1c', '#123a36', '#1f4a40', '#0a1412'], moon: '#fff4d0', feature: 'pavilion', particle: 'lantern', tint: '#ffcf7a' },
  castle: { sky: ['#070b2a', '#1a2a6a', '#3a3f8a', '#0b0a20'], moon: '#f2f4ff', feature: 'castle', particle: 'petal', tint: '#cfdcff' },
  wisteria: { sky: ['#120a26', '#2e1a52', '#4a2a6a', '#0e0818'], moon: '#fff0ff', feature: 'wisteria', particle: 'butterfly', tint: '#d8b8ff' },
  dunes: { sky: ['#3a1a2a', '#a8483a', '#f0a050', '#2a140c'], moon: null, sun: '#ffe08a', feature: 'dunes', particle: 'sand', tint: '#ffd27a' },
  ink: { sky: ['#e8e0d0', '#d6d0c4', '#b8c4c4', '#7a8a90'], moon: '#f6f0e4', feature: 'ink', particle: 'butterfly', tint: '#ffffff' },
  maple: { sky: ['#2a0e0c', '#6a1a14', '#a8361e', '#1a0806'], moon: null, sun: '#ffd8a0', feature: 'maple', particle: 'maple', tint: '#ff7a4a' },
};

class ThemedScene extends Scene {
  constructor(theme, kind) {
    super(theme);
    this.cfg = THEMES[kind];
  }

  paintStatic(g, W, H, r) {
    const c = this.cfg;
    g.fillStyle = vgrad(g, H, [[0, c.sky[0]], [0.45, c.sky[1]], [0.72, c.sky[2]], [1, c.sky[3]]]);
    g.fillRect(0, 0, W, H);
    const S = Math.min(W, H);
    if (c.moon) {
      glow(g, W * 0.72, H * 0.24, S * 0.45, 'rgba(255,250,230,0.35)');
      g.fillStyle = c.moon;
      g.beginPath(); g.arc(W * 0.72, H * 0.24, S * 0.09, 0, Math.PI * 2); g.fill();
    }
    if (c.sun) glow(g, W * 0.5, H * 0.66, S * 0.6, c.sun);
    const base = H * 0.78;
    switch (c.feature) {
      case 'pavilion': {
        g.fillStyle = '#06110f';
        for (let i = 0; i < 4; i++) {
          const x = W * (0.08 + i * 0.27), w = S * (0.26 + r() * 0.1), h = S * (0.14 + r() * 0.12);
          g.fillRect(x, base - h, w, h + H);
          g.beginPath(); // curved eaves
          g.moveTo(x - w * 0.18, base - h);
          g.quadraticCurveTo(x + w / 2, base - h - S * 0.07, x + w * 1.18, base - h);
          g.lineTo(x + w, base - h + S * 0.02); g.lineTo(x, base - h + S * 0.02); g.closePath(); g.fill();
          for (let k = 0; k < 3; k++) glow(g, x + w * (0.2 + k * 0.3), base - h + S * 0.06, S * 0.05, 'rgba(255,190,100,0.6)');
        }
        break;
      }
      case 'castle': {
        g.fillStyle = '#0a0c2a';
        const cx = W * 0.5;
        for (const [dx, w, h] of [[-0.22, 0.08, 0.3], [-0.1, 0.1, 0.42], [0, 0.12, 0.52], [0.12, 0.1, 0.4], [0.24, 0.08, 0.28]]) {
          const x = cx + dx * W, ww = w * S, hh = h * S;
          g.fillRect(x - ww / 2, base - hh, ww, hh + H);
          g.beginPath(); g.moveTo(x - ww * 0.62, base - hh); g.lineTo(x, base - hh - ww * 1.3); g.lineTo(x + ww * 0.62, base - hh); g.fill();
          g.fillStyle = 'rgba(255,220,150,0.7)';
          g.fillRect(x - 3, base - hh * 0.6, 6, 10);
          g.fillStyle = '#0a0c2a';
        }
        g.fillRect(0, base, W, H);
        break;
      }
      case 'wisteria': {
        g.fillStyle = '#100820';
        g.fillRect(0, base, W, H);
        g.fillRect(W * 0.12, base - S * 0.2, S * 0.03, S * 0.2);
        g.fillRect(W * 0.12 - S * 0.03, base - S * 0.24, S * 0.09, S * 0.05);
        for (let i = 0; i < 26; i++) {
          const x = r() * W, len = S * (0.12 + r() * 0.22);
          for (let y = 0; y < len; y += 7) {
            g.fillStyle = `rgba(${190 + r() * 50},${140 + r() * 40},255,${0.55 - y / len * 0.4})`;
            g.beginPath(); g.arc(x + Math.sin(y * 0.05) * 4, y, 5 * (1 - y / len * 0.6), 0, Math.PI * 2); g.fill();
          }
        }
        break;
      }
      case 'dunes': {
        for (const [y0, col, amp] of [[0.68, 'rgba(160,80,50,0.75)', 26], [0.76, 'rgba(120,56,40,0.85)', 20], [0.86, '#3a1a10', 16]]) {
          g.fillStyle = col;
          g.beginPath(); g.moveTo(0, H);
          for (let x = 0; x <= W + 30; x += 30) g.lineTo(x, H * y0 + Math.sin(x * 0.008 + y0 * 10) * amp);
          g.lineTo(W, H); g.fill();
        }
        g.fillStyle = 'rgba(60,24,20,0.8)'; // distant domes
        for (const x of [0.28, 0.36]) {
          g.beginPath(); g.arc(W * x, H * 0.66, S * 0.05, Math.PI, 0); g.fill();
          g.fillRect(W * x - S * 0.05, H * 0.66, S * 0.1, S * 0.05);
        }
        break;
      }
      case 'ink': {
        for (const [y0, col, amp, f] of [[0.52, 'rgba(110,140,140,0.35)', 70, 0.006], [0.62, 'rgba(70,100,105,0.5)', 60, 0.009], [0.74, 'rgba(40,60,70,0.7)', 40, 0.013]]) {
          g.fillStyle = col;
          g.beginPath(); g.moveTo(0, H);
          for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, H * y0 - Math.abs(Math.sin(x * f + y0 * 7)) * amp - r() * 6);
          g.lineTo(W, H); g.fill();
        }
        const px = W * 0.8, py = H * 0.6; // pagoda
        g.fillStyle = 'rgba(30,40,50,0.75)';
        for (let k = 0; k < 4; k++) {
          const w = S * (0.08 - k * 0.012), y = py - k * S * 0.05;
          g.fillRect(px - w / 2, y, w, S * 0.04);
          g.beginPath(); g.moveTo(px - w * 0.8, y); g.lineTo(px + w * 0.8, y); g.lineTo(px, y - S * 0.025); g.fill();
        }
        g.fillStyle = vgrad(g, H, [[0, 'rgba(0,0,0,0)'], [0.7, 'rgba(232,224,208,0.35)'], [1, 'rgba(232,224,208,0.1)']]);
        g.fillRect(0, 0, W, H);
        break;
      }
      case 'maple': {
        g.fillStyle = '#1a0a08';
        g.beginPath(); // trunk on the right
        g.moveTo(W * 0.86, H); g.quadraticCurveTo(W * 0.8, H * 0.6, W * 0.9, H * 0.25);
        g.lineTo(W * 0.96, H * 0.25); g.quadraticCurveTo(W * 0.9, H * 0.6, W, H); g.fill();
        for (let i = 0; i < 160; i++) {
          const a = r() * Math.PI * 2, d = r() * S * 0.42;
          g.fillStyle = r() < 0.6 ? 'rgba(220,60,40,0.85)' : 'rgba(255,170,60,0.85)';
          g.beginPath(); g.arc(W * 0.86 + Math.cos(a) * d * 1.4, H * 0.22 + Math.sin(a) * d * 0.8, 6 + r() * 10, 0, Math.PI * 2); g.fill();
        }
        break;
      }
      default:
        break;
    }
  }

  setup(W, H, r) {
    const n = this.cfg.particle === 'sand' ? 90 : 46;
    this.parts = Array.from({ length: n }, () => ({ x: r() * W, y: r() * H, s: 3 + r() * 6, v: 20 + r() * 50, ph: r() * 6 }));
  }

  drawDynamic(g, t, pulse) {
    const { W, H } = this;
    const kind = this.cfg.particle;
    for (const p of this.parts) {
      let x, y;
      if (kind === 'lantern') {
        y = ((p.y - t * p.v * 0.5) % H + H) % H;
        x = p.x + Math.sin(t * 0.7 + p.ph) * 14;
        glow(g, x, y, p.s * 3.2, 'rgba(255,200,110,0.55)', 0.8);
        g.fillStyle = '#ffd690';
        g.fillRect(x - p.s * 0.4, y - p.s * 0.6, p.s * 0.8, p.s * 1.2);
        continue;
      }
      if (kind === 'sand') {
        x = ((p.x + t * p.v * 2) % W + W) % W;
        y = p.y + Math.sin(t + p.ph) * 6;
        g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3 + p.ph);
        g.fillStyle = '#ffd690';
        g.fillRect(x, y, 2, 2);
        continue;
      }
      y = (p.y + t * p.v) % (H + 20) - 10;
      x = (p.x + Math.sin(t * 0.8 + p.ph) * 30 + t * 14) % (W + 20) - 10;
      g.save();
      g.translate(x, y);
      if (kind === 'butterfly') {
        const flap = Math.abs(Math.sin(t * 8 + p.ph));
        g.globalAlpha = 0.75;
        g.fillStyle = this.cfg.tint;
        g.scale(flap * 0.8 + 0.2, 1);
        g.beginPath(); g.ellipse(-p.s * 0.6, 0, p.s * 0.7, p.s * 0.45, -0.4, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(p.s * 0.6, 0, p.s * 0.7, p.s * 0.45, 0.4, 0, Math.PI * 2); g.fill();
      } else if (kind === 'maple') {
        g.rotate(t * 1.5 + p.ph);
        g.fillStyle = p.ph > 3 ? '#e8452e' : '#ffae3a';
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 ? p.s * 0.45 : p.s * 1.2;
          const ang = (k / 10) * Math.PI * 2;
          g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        g.fill();
      } else {
        g.rotate(t * 1.2 + p.ph);
        g.fillStyle = this.cfg.tint;
        g.globalAlpha = 0.8;
        g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }
}

const KINDS = { neon: NeonScene, sakura: SakuraScene, stars: StarScene, sunset: SunsetScene };
const cache = new Map();

export function sceneFor(ch) {
  if (!cache.has(ch.id)) {
    cache.set(ch.id, KINDS[ch.scene] ? new KINDS[ch.scene](ch.colors) : new ThemedScene(ch.colors, ch.scene));
  }
  return cache.get(ch.id);
}
