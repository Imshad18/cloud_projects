export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk === '--c') setColorVars(e, sv); else if (sk.startsWith('--')) e.style.setProperty(sk, sv); else e.style[sk] = sv; } }
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const rand = (a, b) => a + Math.random() * (b - a);

export function fmt(v, d = 3) {
  if (v == null || Number.isNaN(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) return sci(v, d);
  return (+v.toPrecision(d + 1)).toLocaleString('en-US', { maximumFractionDigits: 6 });
}
export function sci(v, d = 3) {
  const e = Math.floor(Math.log10(Math.abs(v)));
  const m = v / Math.pow(10, e);
  return `${(+m.toPrecision(d)).toString()}×10${sup(e)}`;
}
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = n => String(n).split('').map(c => SUP[c] ?? c).join('');

const YEAR_S = 31557600;
export function fmtTime(s) {
  if (s == null) return 'unknown';
  if (s < 0) return 'stable';
  if (s < 1e-9) return `${fmt(s * 1e12, 2)} ps`;
  if (s < 1e-6) return `${fmt(s * 1e9, 2)} ns`;
  if (s < 1e-3) return `${fmt(s * 1e6, 2)} µs`;
  if (s < 1) return `${fmt(s * 1e3, 2)} ms`;
  if (s < 120) return `${fmt(s, 2)} s`;
  if (s < 7200) return `${fmt(s / 60, 2)} min`;
  if (s < 172800) return `${fmt(s / 3600, 2)} h`;
  if (s < YEAR_S * 2) return `${fmt(s / 86400, 2)} days`;
  const y = s / YEAR_S;
  if (y < 1e6) return `${fmt(y, 2)} years`;
  if (y < 1e9) return `${fmt(y / 1e6, 2)} million years`;
  if (y < 1e12) return `${fmt(y / 1e9, 2)} billion years`;
  return `${sci(y, 2)} years`;
}

export function fmtEnergy(mev) {
  const a = Math.abs(mev);
  if (a >= 1e6) return `${fmt(mev / 1e6, 3)} TeV`;
  if (a >= 1e3) return `${fmt(mev / 1e3, 3)} GeV`;
  if (a >= 1) return `${fmt(mev, 3)} MeV`;
  if (a >= 1e-3) return `${fmt(mev * 1e3, 3)} keV`;
  return `${fmt(mev * 1e6, 3)} eV`;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

// Perceptual sequential ramp (deep indigo → magenta → amber → pale yellow).
const RAMP = ['#1d1a4a', '#3b2a8a', '#7a2fa0', '#c23f8b', '#f06a5a', '#fca24a', '#fde68a'];
export function ramp(t) {
  t = clamp(t, 0, 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(t), RAMP.length - 2), f = t - i;
  const a = hexToRgb(RAMP[i]), b = hexToRgb(RAMP[i + 1]);
  return `rgb(${a.map((v, k) => Math.round(lerp(v, b[k], f))).join(',')})`;
}
export const RAMP_CSS = `linear-gradient(90deg, ${RAMP.join(',')})`;

// Wavelength (nm) to visible RGB.
export function wavelengthRGB(w) {
  let r = 0, g = 0, b = 0;
  if (w >= 380 && w < 440) { r = -(w - 440) / 60; b = 1; }
  else if (w < 490) { g = (w - 440) / 50; b = 1; }
  else if (w < 510) { g = 1; b = -(w - 510) / 20; }
  else if (w < 580) { r = (w - 510) / 70; g = 1; }
  else if (w < 645) { r = 1; g = -(w - 645) / 65; }
  else if (w <= 780) { r = 1; }
  let f = 1;
  if (w < 420) f = 0.3 + 0.7 * (w - 380) / 40; else if (w > 700) f = 0.3 + 0.7 * (780 - w) / 80;
  const c = x => Math.round(255 * Math.pow(x * f, 0.8));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

export function fitCanvas(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height, dpr };
}

export function storeGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }
export function storeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }

export const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Animation loop that only runs while `isActive()` is true.
export function loop(fn, isActive = () => true) {
  let raf = 0, last = 0, running = false;
  const tick = t => {
    if (!running) return;
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    if (isActive()) fn(dt, t / 1000);
    raf = requestAnimationFrame(tick);
  };
  return {
    start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(tick); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    get running() { return running; },
  };
}

export function toast(msg, ms = 2400) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

// Theme-aware colours for canvases. Screens stay dark in every theme, tinted to match it.
let _screen = null;
export function SCREEN() {
  if (_screen == null) _screen = getComputedStyle(document.documentElement).getPropertyValue('--screen').trim() || '#050506';
  return _screen;
}
export function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
export function themeChanged() { _screen = null; }
export const FONT = '"Source Sans 3", system-ui, sans-serif';

// Sets --c plus translucent variants (--c15, --c30, --c60) without relying on CSS color-mix().
export function setColorVars(el, c) {
  el.style.setProperty('--c', c);
  let r = 128, g = 128, b = 128;
  const m = String(c).match(/^#([0-9a-f]{6})$/i), m2 = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) { const n = parseInt(m[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; } else if (m2) { r = +m2[1]; g = +m2[2]; b = +m2[3]; }
  for (const a of [15, 30, 60]) el.style.setProperty(`--c${a}`, `rgba(${r},${g},${b},${a / 100})`);
}
