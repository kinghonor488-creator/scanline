// Hit feedback: particles, sparkle stars, rings, flashes, note "pop" ghosts, scan-line streaks,
// styled judgement text and screen shake. Purely visual: nothing here touches timing or scoring.

const FONT = '"M PLUS Rounded 1c", "Avenir Next", "Segoe UI", system-ui, sans-serif';
const JUDGE_STYLE = {
  perfect: { label: 'PERFECT', top: '#fffbe0', bottom: '#ffc93d', size: 20 },
  good: { label: 'GOOD', top: '#e6fff0', bottom: '#56f09a', size: 18 },
  bad: { label: 'BAD', top: '#ffe9dc', bottom: '#ff8a4c', size: 17 },
  miss: { label: 'MISS', top: '#d9e1ea', bottom: '#7f8b99', size: 16 },
};

export class FX {
  constructor() {
    this.items = [];
    this.shakeT = 0;
    this.shakeDur = 0;
    this.shakeMag = 0;
    this.shakeEnabled = true;
  }

  clear() {
    this.items.length = 0;
    this.shakeT = 0;
  }

  add(o) {
    o.age = 0;
    this.items.push(o);
  }

  burst(x, y, color, count, speed, size = 4) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.add({ k: 'part', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.3, color, size: size * (0.6 + Math.random() * 0.7) });
    }
  }

  stars(x, y, count, color, dist) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const v = dist * (2.2 + Math.random() * 1.6);
      this.add({ k: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.45 + Math.random() * 0.2, color, size: 5 + Math.random() * 5, rot: Math.random() * 3 });
    }
  }

  ring(x, y, color, r0, r1, life = 0.35, width = 3) {
    this.add({ k: 'ring', x, y, color, r0, r1, life, width });
  }

  flash(x, y, r, color = '#ffffff') {
    this.add({ k: 'flash', x, y, r, color, life: 0.14 });
  }

  ghost(sprite, x, y) {
    if (sprite) this.add({ k: 'ghost', sprite, x, y, life: 0.2 });
  }

  streak(x, y, color, width) {
    this.add({ k: 'streak', x, y, color, width, life: 0.28 });
  }

  judge(x, y, res, small = false) {
    this.add({ k: 'judge', x, y, res, small, life: 0.6 });
  }

  text(x, y, str, color, size = 18) {
    this.add({ k: 'text', x, y, str, color, size, life: 0.6 });
  }

  shake(mag, dur = 0.15) {
    if (!this.shakeEnabled) return;
    this.shakeMag = Math.max(this.shakeMag * (this.shakeT / (this.shakeDur || 1)), mag);
    this.shakeDur = dur;
    this.shakeT = dur;
  }

  offset() {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const k = this.shakeMag * (this.shakeT / this.shakeDur);
    return { x: (Math.random() * 2 - 1) * k, y: (Math.random() * 2 - 1) * k };
  }

  update(dt) {
    this.shakeT = Math.max(0, this.shakeT - dt);
    for (const o of this.items) {
      o.age += dt;
      if (o.k === 'part' || o.k === 'star') {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        const drag = o.k === 'star' ? 6 : 4;
        o.vx *= 1 - drag * dt;
        o.vy *= 1 - drag * dt;
        if (o.k === 'star') o.rot += dt * 6;
      } else if (o.k === 'judge' || o.k === 'text') {
        o.y -= 34 * dt;
      }
    }
    this.items = this.items.filter((o) => o.age < o.life);
  }

  draw(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const o of this.items) {
      const k = o.age / o.life;
      switch (o.k) {
        case 'ring': {
          const e = 1 - (1 - k) ** 3;
          g.globalAlpha = (1 - k) * 0.95;
          g.strokeStyle = o.color;
          g.lineWidth = o.width * (1 - k * 0.6);
          g.beginPath();
          g.arc(o.x, o.y, o.r0 + (o.r1 - o.r0) * e, 0, Math.PI * 2);
          g.stroke();
          break;
        }
        case 'flash': {
          const gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * (0.7 + k * 0.6));
          gr.addColorStop(0, o.color);
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.globalAlpha = 1 - k;
          g.fillStyle = gr;
          g.beginPath();
          g.arc(o.x, o.y, o.r * (0.7 + k * 0.6), 0, Math.PI * 2);
          g.fill();
          break;
        }
        case 'streak': {
          const w = o.width * (0.3 + 0.7 * (1 - (1 - k) ** 2));
          const gr = g.createLinearGradient(o.x - w, 0, o.x + w, 0);
          gr.addColorStop(0, 'rgba(255,255,255,0)');
          gr.addColorStop(0.5, o.color);
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.globalAlpha = 1 - k;
          g.fillStyle = gr;
          g.fillRect(o.x - w, o.y - 3 * (1 - k) - 1, w * 2, 6 * (1 - k) + 2);
          break;
        }
        case 'part': {
          g.globalAlpha = 1 - k;
          g.fillStyle = o.color;
          const s = o.size * (1 - k * 0.5);
          g.fillRect(o.x - s / 2, o.y - s / 2, s, s);
          break;
        }
        case 'star': {
          g.globalAlpha = 1 - k;
          g.fillStyle = o.color;
          const s = o.size * (1 - k * 0.4);
          g.save();
          g.translate(o.x, o.y);
          g.rotate(o.rot);
          g.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            const r = i % 2 ? s * 0.28 : s;
            g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          g.closePath();
          g.fill();
          g.restore();
          break;
        }
        default:
          break;
      }
    }
    g.globalCompositeOperation = 'source-over';
    for (const o of this.items) {
      const k = o.age / o.life;
      if (o.k === 'ghost') {
        const s = o.sprite.S * (1 + k * 0.6);
        g.globalAlpha = (1 - k) * 0.8;
        g.drawImage(o.sprite.c, o.x - s / 2, o.y - s / 2, s, s);
      } else if (o.k === 'judge') {
        const st = JUDGE_STYLE[o.res];
        const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.6);
        const size = Math.round(st.size * (o.small ? 0.8 : 1) * pop);
        g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
        g.font = `italic 900 ${size}px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(20, 10, 40, 0.85)';
        g.strokeText(st.label, o.x, o.y);
        const gr = g.createLinearGradient(0, o.y - size / 2, 0, o.y + size / 2);
        gr.addColorStop(0, st.top);
        gr.addColorStop(1, st.bottom);
        g.fillStyle = gr;
        g.fillText(st.label, o.x, o.y);
      } else if (o.k === 'text') {
        g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
        g.font = `italic 900 ${o.size}px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(20, 10, 40, 0.85)';
        g.strokeText(o.str, o.x, o.y);
        g.fillStyle = o.color;
        g.fillText(o.str, o.x, o.y);
      }
    }
    g.restore();
  }
}
