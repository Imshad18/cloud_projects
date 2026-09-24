import { h, fitCanvas, SCREEN } from '../util.js';

const INK = 'rgba(240,240,245,.92)', MUTED = 'rgba(200,200,210,.6)', GRID = 'rgba(255,255,255,.08)';
const FONT = '"Source Sans 3", system-ui, sans-serif';

// Histogram in the style of LHC papers: observed counts with √N error bars,
// expected background (filled) and expected signal (stacked line).
export function histChart({ title, xlabel, ylabel = 'Events', logY = false, logX = false }) {
  const cv = h('canvas', {});
  const root = h('div', { class: 'chart' }, cv);
  let data = null;
  function draw() {
    const ctx = cv.getContext('2d'); const { w, h: H } = fitCanvas(cv, ctx);
    ctx.fillStyle = SCREEN(); ctx.fillRect(0, 0, w, H);
    const L = 58, R = 14, T = 52, B = 42;
    ctx.fillStyle = INK; ctx.font = `700 15px ${FONT}`; ctx.fillText(title, L, 22);
    if (!data || !data.edges.length) return;
    const { edges, obs, bkg = [], sig = [] } = data;
    const n = edges.length - 1;
    const tot = i => (bkg[i] || 0) + (sig[i] || 0);
    let ymax = 1;
    for (let i = 0; i < n; i++) ymax = Math.max(ymax, obs[i] + Math.sqrt(obs[i]), tot(i));
    const ymin = logY ? Math.max(0.5, Math.min(...obs.filter(v => v > 0), ...bkg.filter(v => v > 0).map(v => v * 0.5), ymax / 1e6) || 0.5) : 0;
    const X = logX ? v => L + (Math.log(v / edges[0]) / Math.log(edges[n] / edges[0])) * (w - L - R) : v => L + ((v - edges[0]) / (edges[n] - edges[0])) * (w - L - R);
    const top = logY ? ymax * 3 : ymax * 1.15;
    const Y = logY ? v => T + (1 - (Math.log10(Math.max(v, ymin)) - Math.log10(ymin)) / (Math.log10(top) - Math.log10(ymin))) * (H - T - B) : v => T + (1 - v / top) * (H - T - B);
    // grid & axes
    ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.font = `600 12px ${FONT}`; ctx.fillStyle = MUTED; ctx.textAlign = 'right';
    const yt = logY ? decades(ymin, top) : niceTicks(0, top, 5);
    for (const v of yt) { const y = Y(v); if (y < T - 1 || y > H - B + 1) continue; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke(); ctx.fillText(fmtTick(v), L - 6, y + 4); }
    ctx.textAlign = 'center';
    const xt = logX ? decades(edges[0], edges[n], [1, 2, 5]) : niceTicks(edges[0], edges[n], 6);
    for (const v of xt) { const x = X(v); if (x < L - 1 || x > w - R + 1) continue; ctx.fillText(fmtTick(v), x, H - B + 16); }
    ctx.fillText(xlabel, (L + w - R) / 2, H - 6);
    ctx.save(); ctx.translate(14, (T + H - B) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(ylabel, 0, 0); ctx.restore();
    ctx.textAlign = 'left';
    // background fill
    if (bkg.length) {
      ctx.fillStyle = 'rgba(120,160,255,.28)'; ctx.strokeStyle = 'rgba(120,160,255,.8)'; ctx.beginPath(); ctx.moveTo(X(edges[0]), Y(ymin || 0));
      for (let i = 0; i < n; i++) { ctx.lineTo(X(edges[i]), Y(bkg[i])); ctx.lineTo(X(edges[i + 1]), Y(bkg[i])); }
      ctx.lineTo(X(edges[n]), Y(ymin || 0)); ctx.closePath(); ctx.fill();
    }
    if (sig.some(v => v > 0)) {
      ctx.strokeStyle = '#ff5f6d'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < n; i++) { const y = Y(tot(i)); i ? ctx.lineTo(X(edges[i]), y) : ctx.moveTo(X(edges[i]), y); ctx.lineTo(X(edges[i + 1]), y); }
      ctx.stroke(); ctx.lineWidth = 1;
    }
    // observed points
    ctx.fillStyle = INK; ctx.strokeStyle = INK;
    for (let i = 0; i < n; i++) {
      if (!obs[i]) continue;
      const x = (X(edges[i]) + X(edges[i + 1])) / 2, y = Y(obs[i]), e = Math.sqrt(obs[i]);
      ctx.beginPath(); ctx.moveTo(x, Y(obs[i] + e)); ctx.lineTo(x, Y(Math.max(obs[i] - e, logY ? ymin : 0))); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, n > 120 ? 1.6 : 2.6, 0, 7); ctx.fill();
    }
    // legend
    const total = obs.reduce((a, b) => a + b, 0);
    ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'left';
    let lx = L;
    const item = (t, c) => { ctx.fillStyle = c; ctx.fillText(t, lx, 40); lx += ctx.measureText(t).width + 14; };
    item(`● Your data: ${total >= 1e7 ? total.toExponential(2) : total.toLocaleString()} events`, INK);
    if (bkg.some(v => v > 0)) item('■ Expected background', 'rgba(150,185,255,1)');
    if (sig.some(v => v > 0)) item('— Expected with signal', '#ff7a86');
    for (const lab of data.labels || []) { const x = X(lab[0]); if (x < L || x > w - R) continue; ctx.fillStyle = '#ffd27a'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(lab[1], x, Math.max(T + 12, Y(lab[2]) - 10)); ctx.textAlign = 'left'; }
    if (!total) { ctx.fillStyle = MUTED; ctx.font = `600 14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(data.empty || 'No events yet', (L + w - R) / 2, (T + H - B) / 2); ctx.textAlign = 'left'; }
  }
  new ResizeObserver(() => draw()).observe(root);
  return { root, set(d) { data = d; draw(); }, draw };
}

// Horizontal bar chart (log scale) for process counts.
export function barChart({ title }) {
  const cv = h('canvas', {});
  const root = h('div', { class: 'chart', style: { height: '330px' } }, cv);
  let rows = [];
  function draw() {
    const ctx = cv.getContext('2d'); const { w, h: H } = fitCanvas(cv, ctx);
    ctx.fillStyle = SCREEN(); ctx.fillRect(0, 0, w, H);
    ctx.fillStyle = INK; ctx.font = `700 15px ${FONT}`; ctx.fillText(title, 14, 22);
    if (!rows.length) return;
    const L = Math.min(270, w * 0.5), T = 36, rowH = Math.min(24, (H - T - 12) / rows.length);
    const fmtN = v => (v >= 1e7 ? v.toExponential(2).replace('e+', '×10^') : v.toLocaleString());
    const mx = Math.max(10, ...rows.map(r => r[1]));
    const X = v => L + (v > 0 ? Math.log10(v + 1) / Math.log10(mx + 1) : 0) * (w - L - 90);
    rows.forEach(([label, v, c], i) => {
      const y = T + i * rowH;
      ctx.fillStyle = MUTED; ctx.font = `600 12.5px ${FONT}`; ctx.textAlign = 'right';
      let lab = label; while (lab.length > 4 && ctx.measureText(lab).width > L - 24) lab = lab.slice(0, -2);
      ctx.fillText(lab === label ? lab : lab + '…', L - 8, y + rowH * 0.68);
      ctx.fillStyle = c || '#f2b84b'; ctx.fillRect(L, y + 4, Math.max(v ? 2 : 0, X(v) - L), rowH - 8);
      ctx.fillStyle = INK; ctx.textAlign = 'left'; const t = fmtN(v); ctx.fillText(t, Math.min(X(v) + 6, w - ctx.measureText(t).width - 6), y + rowH * 0.68);
    });
  }
  new ResizeObserver(() => draw()).observe(root);
  return { root, set(r) { rows = r; draw(); } };
}

function niceTicks(a, b, n) {
  const span = b - a, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), f = step0 / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toPrecision(10));
  return out;
}
function decades(a, b, mult = [1]) {
  const out = [];
  for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) for (const m of mult) { const v = m * Math.pow(10, e); if (v >= a * 0.999 && v <= b * 1.001) out.push(v); }
  return out;
}
function fmtTick(v) {
  if (v === 0) return '0';
  if (Math.abs(v) >= 1e4 || Math.abs(v) < 0.01) { const e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e); return `${m === 1 ? '' : +m.toFixed(1) + '×'}10${String(e).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? '⁻').join('')}`; }
  return String(+v.toPrecision(4));
}
