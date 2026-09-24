import { h, fitCanvas, clamp, rand } from '../util.js';
import { NUCS, byZ, findNuclide, ELEMENTS } from '../store.js';
import { bePerNucleon, resolve } from '../nuclear.js';
import { nucleus } from '../originAnim.js';

// Binding energy per nucleon curve for the most abundant (or longest-lived) isotope of every element.
export function bindingCurve({ height = 280 } = {}) {
  const pts = ELEMENTS.map(e => e.mainIso).filter(r => r && r.a > 1).map(r => ({ r, a: r.a, b: bePerNucleon(r) }));
  // add light stars of the show
  for (const l of ['H-2', 'H-3', 'He-3', 'Li-6', 'Fe-56', 'Ni-62', 'U-235']) { const r = findNuclide(l); if (r && !pts.some(p => p.r === r)) pts.push({ r, a: r.a, b: bePerNucleon(r) }); }
  pts.sort((a, b) => a.a - b.a);
  let marks = [], hover = null;
  const cv = h('canvas', { 'aria-label': 'Binding energy per nucleon versus mass number' });
  const box = h('div', { class: 'canvas-box', style: { height: height + 'px' } }, cv);
  const ctx = cv.getContext('2d');
  const X = (a, w) => 40 + (a / 260) * (w - 54), Y = (b, H) => 14 + (1 - b / 9.2) * (H - 44);
  function draw() {
    const { w, h: H } = fitCanvas(cv, ctx);
    ctx.fillStyle = '#030409'; ctx.fillRect(0, 0, w, H);
    ctx.fillStyle = 'rgba(92,200,240,.07)'; ctx.fillRect(X(0, w), 0, X(56, w) - X(0, w), H - 30);
    ctx.fillStyle = 'rgba(124,242,154,.07)'; ctx.fillRect(X(56, w), 0, X(260, w) - X(56, w), H - 30);
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8fdcff'; ctx.fillText('← fusion releases energy', X(62, w) - 170 < 44 ? 46 : X(8, w), Y(2.2, H));
    ctx.fillStyle = '#7cf29a'; ctx.textAlign = 'right'; ctx.fillText('fission releases energy →', X(250, w), Y(6.9, H)); ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(170,185,255,.12)'; ctx.fillStyle = '#8f97ba';
    for (let b = 0; b <= 9; b += 1) { ctx.beginPath(); ctx.moveTo(X(0, w), Y(b, H)); ctx.lineTo(X(260, w), Y(b, H)); ctx.stroke(); if (b % 2 === 1 || b === 0) ctx.fillText(String(b), 12, Y(b, H) + 4); }
    for (let a = 0; a <= 200; a += 50) ctx.fillText(String(a), X(a, w) - 8, H - 12);
    ctx.fillText('MeV per nucleon', 44, 12); ctx.textAlign = 'right'; ctx.fillText('mass number A', w - 12, H - 12); ctx.textAlign = 'left';
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.5; ctx.beginPath();
    pts.filter(p => p.a > 4).forEach((p, i) => (i ? ctx.lineTo(X(p.a, w), Y(p.b, H)) : ctx.moveTo(X(p.a, w), Y(p.b, H)))); ctx.stroke();
    for (const p of pts) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(X(p.a, w), Y(p.b, H), 2.2, 0, 7); ctx.fill(); }
    const peak = pts.find(p => p.r.label === 'Ni-62'), fe = pts.find(p => p.r.label === 'Fe-56');
    if (fe) { ctx.fillStyle = '#fff'; ctx.fillText(fe.r.label, X(fe.a, w) - 20, Y(fe.b, H) - 8); }
    if (peak) { ctx.fillStyle = '#fff'; ctx.fillText(peak.r.label, X(peak.a, w) + 4, Y(peak.b, H) + 16); }
    for (const m of marks) {
      const r = findNuclide(m.label); if (!r || r.a < 2) continue;
      const x = X(r.a, w), y = Y(bePerNucleon(r), H);
      ctx.strokeStyle = m.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.stroke();
      ctx.fillStyle = m.color; ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.fillText(r.label, x + 9, y + 14);
    }
    if (hover) {
      const x = X(hover.a, w), y = Y(hover.b, H), t = `${hover.r.label}: ${hover.b.toFixed(3)} MeV`;
      ctx.font = '12px "IBM Plex Mono", monospace'; const tw = ctx.measureText(t).width + 12;
      const bx = clamp(x + 10, 4, w - tw - 4);
      ctx.fillStyle = 'rgba(14,17,34,.95)'; ctx.fillRect(bx, y - 30, tw, 22); ctx.fillStyle = '#e9ecf8'; ctx.fillText(t, bx + 6, y - 15);
    }
  }
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(), w = r.width, H = r.height, mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 400;
    for (const p of pts) { const d = (X(p.a, w) - mx) ** 2 + (Y(p.b, H) - my) ** 2; if (d < bd) { bd = d; best = p; } }
    if (best !== hover) { hover = best; draw(); }
  });
  cv.addEventListener('pointerleave', () => { hover = null; draw(); });
  return { root: box, draw, mark(list) { marks = list; draw(); } };
}

// Reaction animation: inputs collide, flash, outputs fly apart.
export function reactionAnim({ height = 240 } = {}) {
  const cv = h('canvas', { 'aria-label': 'Reaction animation' });
  const box = h('div', { class: 'canvas-box', style: { height: height + 'px' } }, cv);
  const ctx = cv.getContext('2d');
  let ins = [], outs = [], t = 0, raf = 0, last = 0, q = 0, flashColor = '#ffffff';
  function drawParticle(p, x, y, S) {
    if (p.tok === 'γ') { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 30; i++) { const xx = x - 15 + i; const yy = y + Math.sin(i * 0.9 + t * 20) * 4; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); label(p.label, x, y - 12); return; }
    if (p.tok === 'ν') { ctx.fillStyle = '#9aa2b8'; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); label('ν', x, y - 8); return; }
    if (p.tok === 'e+') { ctx.fillStyle = '#ff6b8a'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); label('e⁺', x, y - 9); return; }
    if (p.tok === 'n') { nucleusN(x, y, 0, 1, S); label('n', x, y - 12); return; }
    nucleusN(x, y, p.z, p.a, S);
    label(p.label, x, y - Math.max(12, S * Math.cbrt(Math.min(p.a, 70)) * 0.95 + 6));
  }
  function nucleusN(x, y, z, a, S) {
    const n = Math.min(a, 70);
    if (n === 1) { const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, S); g.addColorStop(0, '#fff'); g.addColorStop(0.4, z ? '#ff5d5d' : '#8aa4ff'); g.addColorStop(1, z ? 'rgba(255,93,93,.5)' : 'rgba(138,164,255,.5)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, S, 0, 7); ctx.fill(); return; }
    nucleus(ctx, x, y, n, S, z * 31 + a);
  }
  function label(t0, x, y) { ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.fillStyle = '#e9ecf8'; ctx.textAlign = 'center'; ctx.fillText(t0, x, y); ctx.textAlign = 'left'; }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!cv.offsetParent) return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; t += dt;
    const { w, h: H } = fitCanvas(cv, ctx);
    ctx.fillStyle = '#030409'; ctx.fillRect(0, 0, w, H);
    const S = Math.min(w, H) * 0.028, cx = w / 2, cy = H / 2, T = 4, k = t % T;
    if (k < 1.3) {
      const f = k / 1.3, e = f * f;
      ins.forEach((p, i) => {
        const ang = Math.PI + (i - (ins.length - 1) / 2) * (ins.length > 2 ? 2.1 : Math.PI);
        const d = (1 - e) * w * 0.38 + 6;
        drawParticle(p, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.35, S);
      });
    } else {
      const f = k - 1.3;
      ctx.globalCompositeOperation = 'lighter';
      if (f < 0.6) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, H) * 0.4 * (0.3 + f)); g.addColorStop(0, `rgba(255,255,255,${1 - f / 0.6})`); g.addColorStop(0.4, flashColor.replace('1)', `${0.6 * (1 - f / 0.6)})`)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, H); }
      ctx.globalCompositeOperation = 'source-over';
      outs.forEach((p, i) => {
        const ang = outs.length === 1 ? 0 : (i / outs.length) * Math.PI * 2 + 0.4;
        const sp = p.a <= 1 ? 1.8 : 1 / Math.sqrt(Math.max(1, p.a / 4));
        const d = Math.min(w * 0.45, f * sp * w * 0.22);
        drawParticle(p, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.6, S);
      });
      if (f > 0.4) { ctx.font = '600 16px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = q >= 0 ? '#ffd27a' : '#ff6b7d'; ctx.fillText(`${q >= 0 ? '+' : ''}${q.toFixed(2)} MeV`, cx, H - 16); ctx.textAlign = 'left'; }
    }
  }
  return {
    root: box,
    set(i, o, qv, color = 'rgba(255,210,122,1)') { ins = i.map(resolve).filter(Boolean); outs = o.map(resolve).filter(Boolean); q = qv; t = 0; flashColor = color; },
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}

// Text input with nuclide autocomplete.
export function nuclidePicker(id, value, onPick, { filter } = {}) {
  const input = h('input', { type: 'text', id, value, autocomplete: 'off', spellcheck: 'false' });
  const list = h('div', { class: 'picker-list', hidden: true });
  const wrap = h('div', { class: 'picker' }, input, list);
  const pool = NUCS.filter(r => !r.iso && (r.hl === -1 || r.hl > 1e-3) && (!filter || filter(r)));
  function show() {
    const q = input.value.trim().toLowerCase().replace(/\s+/g, '');
    const m = q.match(/^([a-z]+)-?(\d*)$/);
    let res = [];
    if (m) {
      const [, s, a] = m;
      res = pool.filter(r => (r.sym.toLowerCase() === s || byZ[r.z].name.toLowerCase().startsWith(s)) && (!a || String(r.a).startsWith(a)));
    } else { const r = findNuclide(q); if (r) res = [r]; }
    res = res.sort((a, b) => b.ab - a.ab || (b.hl === -1) - (a.hl === -1)).slice(0, 12);
    list.replaceChildren(...res.map(r => h('button', { type: 'button', onmousedown: e => { e.preventDefault(); input.value = r.label; list.hidden = true; onPick(r); } }, h('b', {}, r.label), h('span', {}, byZ[r.z].name), h('small', {}, r.ab ? `${(r.ab * 100).toPrecision(3)}%` : r.hl === -1 ? 'stable' : 'radioactive'))));
    list.hidden = !res.length;
  }
  input.addEventListener('input', show);
  input.addEventListener('focus', () => { input.select(); show(); });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { const r = findNuclide(input.value); if (r) { list.hidden = true; onPick(r); } } });
  return { root: wrap, input, set(v) { input.value = v; } };
}

export const K_B = 8.617333e-11; // MeV per kelvin
export const J_PER_MEV = 1.602176634e-13;
export const KG_PER_U = 1.66053906660e-27;
export { rand };
