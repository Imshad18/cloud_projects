import { SOURCES } from './data/origins.js';
import { fitCanvas, rand, rgba } from './util.js';

const TAU = Math.PI * 2;

function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.35, rgba(color, a * 0.45)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function ball(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, color); g.addColorStop(1, rgba(color, 0.6));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function label(ctx, text, x, y, color = '#e9ecf8', size = 12, align = 'center') {
  ctx.font = `500 ${size}px "IBM Plex Mono", monospace`;
  const maxW = ctx.canvas.clientWidth - 16;
  while (align === 'center' && size > 8 && ctx.measureText(text).width > maxW) { size -= 1; ctx.font = `500 ${size}px "IBM Plex Mono", monospace`; }
  ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(text, x, y);
}
// Small nucleus drawn as a cluster of protons and neutrons.
export function nucleus(ctx, x, y, n, r = 4, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const R = r * Math.cbrt(n) * 0.9;
  for (let i = 0; i < n; i++) {
    const rr = R * Math.cbrt((i + 0.5) / n), th = i * 2.39996, ph = Math.acos(1 - 2 * ((i + 0.5) / n));
    const px = x + rr * Math.sin(ph) * Math.cos(th), py = y + rr * Math.sin(ph) * Math.sin(th) * 0.9;
    ball(ctx, px, py, r, rnd() < 0.5 ? '#ff5d5d' : '#8aa4ff');
  }
}

export class OriginAnim {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.src = 'BB'; this.t = 0; this.stars = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random()]);
    this.parts = [];
    this.raf = 0; this.last = 0;
    this.tick = this.tick.bind(this);
  }
  set(src) { this.src = src; this.t = 0; this.parts = []; this.state = {}; }
  start() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tick); } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  tick(ts) {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.c.isConnected) { this.stop(); return; }
    if (!this.c.offsetParent) return;
    const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000); this.last = ts;
    this.t += dt;
    const { w, h } = fitCanvas(this.c, this.ctx);
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#030409'; ctx.fillRect(0, 0, w, h);
    for (const [sx, sy, sb] of this.stars) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + sb * 0.5 * (0.7 + 0.3 * Math.sin(this.t * 2 + sx * 50))})`;
      ctx.fillRect(sx * w, sy * h, sb > 0.8 ? 1.6 : 1, sb > 0.8 ? 1.6 : 1);
    }
    ctx.globalCompositeOperation = 'lighter';
    this[this.src]?.(ctx, w, h, dt);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Big Bang: flash, expansion, cooling, then H and He nuclei freeze out.
  BB(ctx, w, h, dt) {
    const T = 9, t = this.t % T, cx = w / 2, cy = h / 2, S = Math.min(w, h);
    if (t < dt * 1.5 || !this.parts.length) {
      this.parts = Array.from({ length: 260 }, (_, i) => ({ a: rand(0, TAU), v: rand(0.2, 1), he: i % 12 === 0 }));
    }
    if (t < 0.6) glow(ctx, cx, cy, S * (0.1 + t * 1.2), '#ffffff', 1 - t);
    const r = S * 0.62 * (1 - Math.exp(-t * 0.55));
    const temp = Math.max(0, 1 - t / 5);
    const col = temp > 0.66 ? '#fff6e0' : temp > 0.33 ? '#ffcf7a' : '#ff8a5a';
    for (const p of this.parts) {
      const d = r * p.v, x = cx + Math.cos(p.a + t * 0.05) * d, y = cy + Math.sin(p.a + t * 0.05) * d;
      if (t > 3 && p.he) { ball(ctx, x - 2, y, 2.6, '#ff5d5d'); ball(ctx, x + 2, y, 2.6, '#8aa4ff'); ball(ctx, x, y - 2.5, 2.6, '#8aa4ff'); ball(ctx, x, y + 2.5, 2.6, '#ff5d5d'); }
      else glow(ctx, x, y, t > 3 ? 4 : 6, t > 3 ? '#8fd3ff' : col, 0.9);
    }
    const stage = t < 0.6 ? 't = 0: hot, dense beginning' : t < 2 ? 't = 1 s: protons and neutrons' : t < 3 ? 't = 3 min: fusion begins' : t < 6 ? 't = 20 min: 75% H, 25% He, trace Li' : '13.8 billion years ago';
    label(ctx, stage, cx, h - 16, '#cfe8ff');
    if (t > 3) { label(ctx, '● H', 16, 22, '#8fd3ff', 12, 'left'); label(ctx, '●● He', 16, 40, '#ffb0b0', 12, 'left'); }
  }

  // Cosmic ray spallation.
  CR(ctx, w, h) {
    const T = 4, t = this.t % T, cx = w * 0.6, cy = h / 2, S = Math.min(w, h);
    for (let i = 0; i < 18; i++) {
      const y = ((i * 97) % 100) / 100 * h, x = ((this.t * 400 + i * 173) % (w + 200)) - 100;
      ctx.strokeStyle = rgba('#c9a2ff', 0.35); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 60, y); ctx.lineTo(x, y); ctx.stroke();
    }
    const hitT = 1.2;
    if (t < hitT) {
      const x = cx - (1 - t / hitT) * w * 0.6;
      ctx.strokeStyle = rgba('#e7d6ff', 0.8); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 90, cy); ctx.lineTo(x, cy); ctx.stroke();
      glow(ctx, x, cy, 10, '#ffffff'); ball(ctx, x, cy, 4, '#ff5d5d');
      nucleus(ctx, cx, cy, 16, S * 0.018, 7);
      label(ctx, 'fast proton → oxygen-16', cx, h - 16, '#e2d4ff');
    } else {
      const k = t - hitT;
      if (k < 0.3) glow(ctx, cx, cy, S * 0.25 * (1 - k / 0.3) + 10, '#ffffff', 1 - k / 0.3);
      const frags = [[-0.9, -0.6, 6, 'Li'], [0.8, -0.5, 7, 'Be'], [0.2, 0.9, 3, '']];
      frags.forEach(([dx, dy, n, lab], i) => {
        const d = k * S * 0.18;
        const x = cx + dx * d, y = cy + dy * d;
        nucleus(ctx, x, y, n, S * 0.018, 3 + i);
        if (lab) label(ctx, lab, x, y - S * 0.07, '#e2d4ff', 13);
      });
      label(ctx, 'spallation: the nucleus shatters into Li, Be, B', cx - w * 0.1, h - 16, '#e2d4ff');
    }
  }

  // Low-mass star: pulsating red giant, s-process neutron captures, shells puffed off.
  LM(ctx, w, h) {
    const cx = w / 2, cy = h / 2, S = Math.min(w, h), t = this.t;
    const R = S * 0.26 * (1 + 0.05 * Math.sin(t * 2.2));
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.35 + i / 4) % 1);
      ctx.strokeStyle = rgba(i % 2 ? '#4fe0c0' : '#ff7ab0', (1 - k) * 0.5); ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, R + k * S * 0.35, (R + k * S * 0.35) * 0.9, 0.3, 0, TAU); ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, 'rgba(255,230,180,0.9)'); g.addColorStop(0.5, 'rgba(255,140,60,0.7)'); g.addColorStop(1, 'rgba(200,50,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4 + t * 0.3, rr = R * (0.6 + 0.3 * Math.sin(i + t));
      glow(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, S * 0.05, '#ff9a4a', 0.25);
    }
    glow(ctx, cx, cy, S * 0.05, '#ffffff', 1);
    // neutrons captured slowly
    const k = (t * 0.8) % 1;
    const nx = cx + S * 0.15 * (1 - k), ny = cy - S * 0.08 * (1 - k);
    ball(ctx, nx, ny, 3.5, '#8aa4ff');
    label(ctx, 'n', nx + 8, ny - 6, '#b8c8ff', 11);
    label(ctx, 's-process: one neutron every few years; Sr, Ba, Pb build up', cx, h - 16, '#ffd9a8');
  }

  // Massive star: onion layers, core collapse, supernova, neutron star.
  MS(ctx, w, h) {
    const T = 8, t = this.t % T, cx = w / 2, cy = h / 2, S = Math.min(w, h);
    const layers = [['H', '#6fb6ff'], ['He', '#9fd3ff'], ['C', '#ffe08a'], ['O', '#ff9f6b'], ['Si', '#ff6b8a'], ['Fe', '#c9c9d6']];
    if (t < 3.2) {
      const shrink = t > 2.8 ? 1 - (t - 2.8) / 0.4 * 0.5 : 1;
      layers.forEach(([n, c], i) => {
        const r = S * 0.34 * (1 - i / layers.length) * (i === 5 ? shrink : 1);
        ctx.fillStyle = rgba(c, 0.18 + i * 0.03); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(c, 0.6); ctx.lineWidth = 1; ctx.stroke();
        label(ctx, n, cx + r - 12, cy + 4, c, 11);
      });
      glow(ctx, cx, cy, S * 0.45, '#6fb6ff', 0.15);
      label(ctx, t < 2.8 ? 'fusion shells: H → He → C → O → Si → Fe' : 'iron core collapses in 0.2 s', cx, h - 16, '#cfe0ff');
    } else {
      const k = t - 3.2;
      if (!this.state.debris || k < 0.02) this.state.debris = Array.from({ length: 220 }, () => ({ a: rand(0, TAU), v: rand(0.4, 1), c: ['#ff6b5e', '#ffb347', '#6fb6ff', '#ff9f6b', '#ffe08a'][(Math.random() * 5) | 0] }));
      if (k < 0.5) glow(ctx, cx, cy, S * (0.2 + k * 1.4), '#ffffff', 1 - k * 1.6);
      const R = S * 0.5 * (1 - Math.exp(-k * 0.9));
      for (const p of this.state.debris) {
        const d = R * p.v, x = cx + Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d;
        ctx.strokeStyle = rgba(p.c, 0.5 * Math.max(0, 1 - k / 5)); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(p.a) * d * 0.8, cy + Math.sin(p.a) * d * 0.8); ctx.lineTo(x, y); ctx.stroke();
        glow(ctx, x, y, 5, p.c, Math.max(0, 1 - k / 5));
      }
      const ang = k * 8;
      for (const s of [1, -1]) {
        ctx.strokeStyle = rgba('#8fd3ff', 0.6); ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * S * 0.2 * s, cy + Math.sin(ang) * S * 0.2 * s); ctx.stroke();
      }
      glow(ctx, cx, cy, 10, '#bfe6ff'); ball(ctx, cx, cy, 3, '#ffffff');
      label(ctx, 'core-collapse supernova → O, Mg, Si, Ca... and a neutron star', cx, h - 16, '#ffc9b8');
    }
  }

  // White dwarf in a binary: accretion, thermonuclear detonation.
  WD(ctx, w, h) {
    const T = 7, t = this.t % T, S = Math.min(w, h), cy = h / 2;
    const gx = w * 0.3, wx = w * 0.68;
    if (t < 4.5) {
      const g = ctx.createRadialGradient(gx, cy, 0, gx, cy, S * 0.22);
      g.addColorStop(0, 'rgba(255,200,150,.9)'); g.addColorStop(0.6, 'rgba(255,110,70,.5)'); g.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(gx + S * 0.02, cy, S * 0.24, S * 0.2, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 40; i++) {
        const k = ((this.t * 0.6 + i / 40) % 1);
        const x = gx + S * 0.2 + (wx - gx - S * 0.2) * k, y = cy - Math.sin(k * Math.PI) * S * 0.08 + Math.sin(k * 9 + i) * 2;
        glow(ctx, x, y, 3, '#ffb38a', 0.8);
      }
      ctx.strokeStyle = rgba('#fff08a', 0.5); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(wx, cy, S * 0.07, S * 0.02, 0, 0, TAU); ctx.stroke();
      const fill = Math.min(1, t / 4.5);
      glow(ctx, wx, cy, 14 + fill * 8, '#ffffff', 1);
      label(ctx, `white dwarf mass: ${(1.0 + fill * 0.38).toFixed(2)} M☉ (limit 1.4)`, w / 2, h - 16, '#fff6c2');
    } else {
      const k = t - 4.5;
      glow(ctx, gx, cy, S * 0.2, '#ff6e46', 0.4);
      if (k < 0.4) glow(ctx, wx, cy, S * (0.1 + k * 2), '#ffffff', 1 - k * 2);
      const R = S * 0.5 * (1 - Math.exp(-k * 1.2));
      for (let i = 0; i < 160; i++) {
        const a = i * 2.39996, v = 0.5 + ((i * 37) % 50) / 100;
        glow(ctx, wx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v, 5, i % 3 ? '#fff08a' : '#ffffff', Math.max(0, 1 - k / 2.5));
      }
      label(ctx, 'Type Ia supernova: nickel-56 → cobalt → iron', w / 2, h - 16, '#fff6c2');
    }
  }

  // Neutron star merger and kilonova.
  NS(ctx, w, h) {
    const T = 8, t = this.t % T, cx = w / 2, cy = h / 2, S = Math.min(w, h);
    const tm = 4.2;
    if (t < tm) {
      const k = t / tm, r = S * 0.28 * Math.pow(1 - k, 0.25) + 3;
      const phase = 18 * (1 - Math.pow(1 - k, 0.62)) * TAU / 2;
      for (let i = 0; i < 6; i++) {
        const rr = ((this.t * 60 * (1 + k * 3) + i * S * 0.12) % (S * 0.8));
        ctx.strokeStyle = rgba('#9aa7ff', 0.25 * (1 - rr / (S * 0.8))); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
      }
      for (const s of [0, Math.PI]) {
        const x = cx + Math.cos(phase + s) * r, y = cy + Math.sin(phase + s) * r * 0.55;
        glow(ctx, x, y, 18, '#bfe6ff'); ball(ctx, x, y, 5, '#ffffff');
      }
      label(ctx, 'two neutron stars spiral in, radiating gravitational waves', cx, h - 16, '#e2d8ff');
    } else {
      const k = t - tm;
      if (!this.state.ej || k < 0.02) this.state.ej = Array.from({ length: 240 }, () => ({ a: rand(0, TAU), v: rand(0.3, 1), g: Math.random() < 0.3 }));
      if (k < 0.4) glow(ctx, cx, cy, S * (0.15 + k * 1.5), '#ffffff', 1 - k * 2.2);
      const R = S * 0.45 * (1 - Math.exp(-k * 0.9));
      glow(ctx, cx, cy, R * 1.1, '#ff3c7a', 0.35 * Math.max(0.2, 1 - k / 4));
      for (const p of this.state.ej) {
        const d = R * p.v, x = cx + Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d * 0.8;
        const tw = 0.5 + 0.5 * Math.sin(this.t * 10 + p.a * 20);
        glow(ctx, x, y, p.g ? 5 : 4, p.g ? '#ffd27a' : '#ff5fd2', (p.g ? tw : 0.7) * Math.max(0.1, 1 - k / 4));
      }
      glow(ctx, cx, cy, 12, '#bfe6ff');
      label(ctx, 'kilonova: r-process forges gold, platinum, uranium', cx, h - 16, '#ffd0ec');
      if (k > 0.8) { label(ctx, 'Au', cx + R * 0.5, cy - R * 0.3, '#ffd27a', 14); label(ctx, 'Pt', cx - R * 0.55, cy + R * 0.2, '#e9ecf8', 14); label(ctx, 'U', cx + R * 0.1, cy + R * 0.55, '#7cf29a', 14); }
    }
  }

  // Accelerator: beam in a ring hits a target.
  HS(ctx, w, h) {
    const cx = w * 0.42, cy = h / 2, S = Math.min(w, h), R = S * 0.3, t = this.t;
    ctx.strokeStyle = rgba('#a6b0c8', 0.5); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba('#a6b0c8', 0.2); ctx.lineWidth = 16; ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.fillStyle = rgba('#5cc8f0', 0.5); ctx.fillRect(cx + Math.cos(a) * R - 5, cy + Math.sin(a) * R - 5, 10, 10); }
    const T = 3.2, k = t % T;
    if (k < 2.2) {
      const a = k * 6;
      for (let j = 0; j < 5; j++) glow(ctx, cx + Math.cos(a - j * 0.08) * R, cy + Math.sin(a - j * 0.08) * R, 8 - j, '#8fdcff', 1 - j * 0.18);
    } else {
      const f = (k - 2.2) / 1;
      const tx = cx + R + S * 0.35;
      glow(ctx, cx + R + (tx - cx - R) * Math.min(1, f * 2), cy, 8, '#8fdcff');
      if (f > 0.5) glow(ctx, tx, cy, S * 0.12 * (1 - (f - 0.5) * 2) + 6, '#ffffff', 1.2 - f);
    }
    const tx = cx + R + S * 0.35;
    nucleus(ctx, tx, cy, 20, S * 0.014, 11);
    label(ctx, 'target', tx, cy + S * 0.12, '#a6b0c8', 11);
    this.state.made = (this.state.made || 0) + (k < 0.02 ? 1 : 0);
    label(ctx, 'beams of ions fused with heavy targets, one atom at a time', w / 2, h - 16, '#dfe4f2');
  }

  // Radioactive decay chain.
  RD(ctx, w, h) {
    const cx = w * 0.4, cy = h / 2, S = Math.min(w, h), t = this.t;
    const chain = ['U-238', 'Th-234', 'Pa-234', 'U-234', 'Th-230', 'Ra-226', 'Rn-222', 'Po-218', 'Pb-214', 'Bi-214', 'Po-214', 'Pb-210', 'Bi-210', 'Po-210', 'Pb-206'];
    const step = Math.floor(t / 1.2) % chain.length, k = (t / 1.2) % 1;
    nucleus(ctx, cx, cy, 34, S * 0.02, step + 1);
    const alpha = ['U-238', 'U-234', 'Th-230', 'Ra-226', 'Rn-222', 'Po-218', 'Po-214', 'Po-210'].includes(chain[step]);
    if (step < chain.length - 1) {
      const d = k * S * 0.5;
      if (alpha) { nucleus(ctx, cx + d, cy - d * 0.4, 4, S * 0.02, 5); label(ctx, 'α', cx + d + 16, cy - d * 0.4 - 10, '#ffd166', 13); }
      else { glow(ctx, cx + d, cy + d * 0.3, 7, '#5cc8f0'); label(ctx, 'β⁻', cx + d + 14, cy + d * 0.3 - 8, '#5cc8f0', 13); }
    }
    ctx.globalCompositeOperation = 'source-over';
    const x0 = 14; let y = 20;
    ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
    chain.forEach((c, i) => {
      if (y > h - 10) return;
      ctx.fillStyle = i === step ? '#7cf29a' : i < step ? 'rgba(233,236,248,.35)' : 'rgba(233,236,248,.6)';
      ctx.fillText((i === step ? '▶ ' : '  ') + c, w - 110, y); y += Math.min(15, (h - 20) / chain.length);
    });
    label(ctx, chain[step], cx, cy + S * 0.16, '#7cf29a', 14);
    void x0;
  }
}

export function sourceColor(k) { return SOURCES[k].color; }
