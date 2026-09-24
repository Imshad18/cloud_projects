export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Tiny DOM builder: h('div', { class: 'x', onclick }, child, [children], 'text')
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = c => { if (c == null || c === false || c === '') return; if (Array.isArray(c)) c.forEach(add); else el.append(c instanceof Node ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const chance = p => Math.random() < p;
export const pick = arr => arr[(Math.random() * arr.length) | 0];
// log-normal-ish random duration around a median, spread = factor
export const spread = (median, f = 2) => median * Math.pow(f, (Math.random() + Math.random() + Math.random()) / 1.5 - 1);

export function fmt(v, d = 3) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) return sci(v, d);
  const s = Number(v.toPrecision(d));
  return s.toLocaleString('en-US', { maximumFractionDigits: 6 });
}
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = n => String(n).split('').map(c => SUP[c] ?? c).join('');
export function sci(v, d = 3) {
  if (!v) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const m = v / Math.pow(10, e);
  return `${Number(m.toPrecision(d))}×10${sup(e)}`;
}
export const money = m => (Math.abs(m) >= 1000 ? `${fmt(m / 1000, 3)} BCHF` : `${fmt(Math.round(m * 10) / 10, 4)} MCHF`);
export function lumiStr(fb) { // integrated luminosity with sensible units
  if (fb >= 1000) return `${fmt(fb / 1000, 3)} ab⁻¹`;
  if (fb >= 1) return `${fmt(fb, 3)} fb⁻¹`;
  if (fb >= 1e-3) return `${fmt(fb * 1000, 3)} pb⁻¹`;
  if (fb >= 1e-6) return `${fmt(fb * 1e6, 3)} nb⁻¹`;
  return `${fmt(fb * 1e9, 3)} µb⁻¹`;
}
export function dur(hours) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${fmt(hours, 2)} h`;
  if (hours < 24 * 60) return `${Math.round(hours / 24)} days`;
  if (hours < 24 * 730) return `${Math.round(hours / 730)} months`;
  return `${fmt(hours / 8766, 2)} years`;
}
export function fitCanvas(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height };
}
export function toast(msg, kind = '') {
  const t = h('div', { class: `toast ${kind}` }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3600);
}
export function storeGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }
export function storeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dateStr = d => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const timeStr = d => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
// log-log interpolation in a table of [x, y]
export function loglog(table, x) {
  if (x <= table[0][0]) return x < table[0][0] * 0.999 && table[0][1] === 0 ? 0 : table[0][1] * Math.pow(x / table[0][0], 3);
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i - 1], [x2, y2] = table[i];
    if (x <= x2) { if (y1 <= 0) return y2 * Math.pow(x / x2, 6); return y1 * Math.pow(y2 / y1, Math.log(x / x1) / Math.log(x2 / x1)); }
  }
  const [x1, y1] = table[table.length - 2], [x2, y2] = table[table.length - 1];
  return y2 * Math.pow(y2 / y1, Math.log(x / x2) / Math.log(x2 / x1));
}
