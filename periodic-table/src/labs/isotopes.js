import { h, fmt, fmtTime, fitCanvas, ramp, RAMP_CSS, clamp, sci, SCREEN } from '../util.js';
import { NUCS, byZ, findNuclide } from '../store.js';
import { nuclideButton } from '../chooser.js';
import { bePerNucleon, bindingEnergy, decayChain, modeColor, modeText, MODE_INFO, nuclideLabelHTML, U } from '../nuclear.js';

const MAGIC = [2, 8, 20, 28, 50, 82, 126];
const GROUND = NUCS.filter(r => !r.iso);
const YEAR = 31557600;

function hlColor(r) {
  if (r.hl === -1) return '#f4f4f8';
  if (r.hl == null) return '#23273d';
  return ramp(clamp((Math.log10(r.hl) + 9) / 27, 0, 1));
}
const MODES_VIEW = {
  halflife: { label: 'Half-life', color: hlColor },
  decay: { label: 'Decay mode', color: r => (r.hl === -1 ? '#f4f4f8' : r.dm ? modeColor(r.dm) : '#23273d') },
  binding: { label: 'Binding energy per nucleon', color: r => (r.a < 2 ? '#23273d' : ramp(clamp((bePerNucleon(r) - 5) / 3.8, 0, 1))) },
  abundance: { label: 'Natural abundance', color: r => (r.ab > 0 ? ramp(0.15 + 0.85 * clamp((Math.log10(r.ab) + 5) / 5, 0, 1)) : '#23273d') },
};

export function buildIsotopes(root, { openElement }) {
  let sel = findNuclide('U-238'), mode = 'halflife', hover = null;
  const view = { s: 5, ox: 20, oy: 20 };
  const canvas = h('canvas', { 'aria-label': 'Chart of nuclides: neutrons across, protons up' });
  const box = h('div', { class: 'canvas-box', style: { height: 'min(62vh, 620px)' } }, canvas);
  const ctx = canvas.getContext('2d');
  const info = h('div', { class: 'stack' });
  const chainBox = h('div', { class: 'stack' });
  const legend = h('div', { class: 'stack' });
  const search = h('input', { type: 'text', id: 'iso-search', placeholder: 'e.g. C-14, U-235, Tc-99m', autocomplete: 'off' });
  const modeTabs = h('div', { class: 'tabs' }, Object.entries(MODES_VIEW).map(([k, m]) => h('button', { class: k === mode ? 'on' : '', 'data-k': k, onclick: () => { mode = k; for (const b of modeTabs.children) b.classList.toggle('on', b.dataset.k === k); drawLegend(); draw(); } }, m.label)));
  let chain = [];

  function fit() {
    const r = canvas.getBoundingClientRect();
    view.s = Math.min((r.width - 40) / 178, (r.height - 40) / 119);
    view.ox = 30; view.oy = r.height - 24;
    if (r.width < 600 && sel) focus(sel, 7); // phones: start zoomed in around the selected nucleus
  }
  const toScreen = (n, z) => [view.ox + n * view.s, view.oy - (z + 1) * view.s];
  const toCell = (x, y) => [Math.floor((x - view.ox) / view.s), Math.floor((view.oy - y) / view.s)];

  function draw() {
    const { w, h: H } = fitCanvas(canvas, ctx);
    ctx.fillStyle = SCREEN(); ctx.fillRect(0, 0, w, H);
    const s = view.s, col = MODES_VIEW[mode].color;
    // magic numbers
    ctx.strokeStyle = 'rgba(255,210,122,.18)'; ctx.lineWidth = 1; ctx.font = '10px "Source Sans 3", system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,210,122,.55)';
    let lastX = -99, lastY = 1e9;
    for (const m of MAGIC) {
      const [x] = toScreen(m, 0); const [, y] = toScreen(0, m);
      if (m <= 177) { ctx.beginPath(); ctx.moveTo(x + s / 2, 0); ctx.lineTo(x + s / 2, H); ctx.stroke(); if (x - lastX > 44) { ctx.fillText(`N=${m}`, x + 3, 12); lastX = x; } }
      if (m <= 118) { ctx.beginPath(); ctx.moveTo(0, y + s / 2); ctx.lineTo(w, y + s / 2); ctx.stroke(); if (lastY - y > 16) { ctx.fillText(`Z=${m}`, 4, y - 2); lastY = y; } }
    }
    // N = Z line
    const [a0, b0] = toScreen(0, 0), [a1, b1] = toScreen(118, 118);
    ctx.strokeStyle = 'rgba(143,151,186,.25)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(a0 + s / 2, b0 + s / 2); ctx.lineTo(a1 + s / 2, b1 + s / 2); ctx.stroke(); ctx.setLineDash([]);
    const gap = s > 6 ? 1 : 0;
    for (const r of GROUND) {
      const [x, y] = toScreen(r.n, r.z);
      if (x < -s || y < -s || x > w || y > H) continue;
      ctx.fillStyle = col(r);
      ctx.fillRect(x, y, s - gap, s - gap);
    }
    if (s > 22) {
      ctx.textAlign = 'center'; ctx.fillStyle = '#0b0d1c';
      for (const r of GROUND) {
        const [x, y] = toScreen(r.n, r.z);
        if (x < -s || y < -s || x > w || y > H) continue;
        ctx.font = `600 ${Math.min(13, s * 0.3)}px "Source Sans 3", system-ui, sans-serif`;
        ctx.fillStyle = r.hl == null ? '#8f97ba' : '#0b0d1c';
        ctx.fillText(`${r.sym}${r.a}`, x + s / 2, y + s * 0.45);
        if (s > 44 && r.hl != null) { ctx.font = `${Math.min(10, s * 0.2)}px "Source Sans 3", system-ui, sans-serif`; ctx.fillText(r.hl === -1 ? 'stable' : fmtTime(r.hl).replace(' years', ' y').replace(' million', 'M').replace(' billion', 'G'), x + s / 2, y + s * 0.75); }
      }
      ctx.textAlign = 'left';
    }
    // decay chain path
    if (chain.length > 1) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath();
      chain.forEach((c, i) => { if (!c.r) return; const [x, y] = toScreen(c.r.n, c.r.z); i ? ctx.lineTo(x + s / 2, y + s / 2) : ctx.moveTo(x + s / 2, y + s / 2); });
      ctx.stroke();
    }
    for (const [r, c] of [[hover, 'rgba(255,255,255,.7)'], [sel, '#ffd27a']]) {
      if (!r) continue;
      const [x, y] = toScreen(r.n, r.z);
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(x - 2, y - 2, s + 3, s + 3);
    }
    if (hover) {
      const [x, y] = toScreen(hover.n, hover.z);
      const t = `${hover.label}  ${hover.hl === -1 ? 'stable' : fmtTime(hover.hl)}`;
      ctx.font = '12px "Source Sans 3", system-ui, sans-serif'; const tw = ctx.measureText(t).width + 14;
      const bx = clamp(x + s + 8, 4, w - tw - 4), by = clamp(y - 30, 4, H - 28);
      ctx.fillStyle = 'rgba(14,17,34,.95)'; ctx.fillRect(bx, by, tw, 24); ctx.strokeStyle = 'rgba(170,185,255,.3)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, tw, 24);
      ctx.fillStyle = '#e9ecf8'; ctx.fillText(t, bx + 7, by + 16);
    }
    ctx.fillStyle = '#8f97ba'; ctx.font = '11px "Source Sans 3", system-ui, sans-serif';
    ctx.fillText('neutrons (N) →', w - 120, H - 8);
    ctx.save(); ctx.translate(12, 120); ctx.rotate(-Math.PI / 2); ctx.fillText('protons (Z) →', 0, 0); ctx.restore();
  }

  function cellAt(ev) {
    const r = canvas.getBoundingClientRect();
    const [n, z] = toCell(ev.clientX - r.left, ev.clientY - r.top);
    return GROUND.find(x => x.n === n && x.z === z) || null;
  }

  // Pan, zoom, pinch, tap
  const pts = new Map(); let moved = 0, pinch0 = null;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch0 = { d: Math.hypot(p[0] - q[0], p[1] - q[1]), s: view.s }; } });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) { const c = cellAt(e); if (c !== hover) { hover = c; draw(); } return; }
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch0) {
      const [p, q] = [...pts.values()]; const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      const r = canvas.getBoundingClientRect(); zoomAt((p[0] + q[0]) / 2 - r.left, (p[1] + q[1]) / 2 - r.top, (pinch0.s * d / pinch0.d) / view.s);
      moved += 10; return;
    }
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; moved += Math.abs(dx) + Math.abs(dy);
    view.ox += dx; view.oy += dy; draw();
  });
  const up = e => {
    if (pts.size === 1 && moved < 6) { const c = cellAt(e); if (c) select(c); }
    pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch0 = null; });
  canvas.addEventListener('pointerleave', () => { if (hover) { hover = null; draw(); } });
  canvas.addEventListener('wheel', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  function zoomAt(x, y, f) {
    const ns = clamp(view.s * f, 2, 90); f = ns / view.s;
    view.ox = x - (x - view.ox) * f; view.oy = y - (y - view.oy) * f; view.s = ns; draw();
  }
  function focus(r, s = 34) {
    const b = canvas.getBoundingClientRect();
    view.s = s; view.ox = b.width / 2 - (r.n + 0.5) * s; view.oy = b.height / 2 + (r.z + 0.5) * s; draw();
  }

  function select(r, zoom = false) {
    sel = r; chain = decayChain(r); pickBtn?.set?.(r);
    renderInfo(); renderChain(); sim.set(r);
    if (zoom) focus(r); else draw();
  }

  function renderInfo() {
    const r = sel, el = byZ[r.z];
    const be = r.a > 1 ? bindingEnergy(r) : 0;
    info.replaceChildren(
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'start' } },
        h('div', {}, h('div', { class: 'big-num', html: nuclideLabelHTML(r).replace('class="nl"', 'class="nl" style="font-size:44px"') }), h('div', { class: 'muted' }, `${el.name}-${r.a}${r.iso ? ' (metastable)' : ''}`)),
        h('button', { class: 'btn', onclick: () => openElement(el) }, `Open ${el.name} →`)),
      h('div', { class: 'stat-grid' },
        st('Protons', r.z), st('Neutrons', r.n), st('Mass', `${r.m.toFixed(6)} u`),
        st('Half-life', r.hl === -1 ? 'stable' : fmtTime(r.hl)),
        st('Natural abundance', r.ab ? `${fmt(r.ab * 100, 4)}%` : '0 (not natural)'),
        st('Binding energy', r.a > 1 ? `${fmt(be, 5)} MeV` : '—'),
        st('Per nucleon', r.a > 1 ? `${bePerNucleon(r).toFixed(3)} MeV` : '—'),
        st('Mass excess', `${fmt((r.m - r.a) * U, 5)} MeV`)),
      r.dm?.length ? h('div', { class: 'stack', style: { gap: '6px' } }, r.dm.map((m, i) => h('div', { class: 'row small' }, h('span', { class: 'pill', style: { background: modeColor([m]) } }, `${m} ${r.bf?.[i] != null ? fmt(r.bf[i] * 100, 3) + '%' : ''}`), h('span', { class: 'muted' }, modeText(m))))) : '',
      r.hl == null ? h('p', { class: 'hint-text' }, 'This isotope is extremely short-lived or its half-life is not in the ICRP-107 dataset.') : '');
  }

  function renderChain() {
    if (chain.length < 2) { chainBox.replaceChildren(h('h3', {}, 'Decay chain'), h('p', { class: 'muted small' }, sel.hl === -1 ? 'Stable: this nucleus never decays.' : 'No decay data for this nuclide.')); return; }
    const end = chain[chain.length - 1];
    chainBox.replaceChildren(
      h('h3', {}, `Decay chain · ${chain.length - 1} step${chain.length > 2 ? 's' : ''}`),
      h('p', { class: 'muted small', style: { margin: 0 } }, end.sf ? 'Ends in spontaneous fission.' : end.r?.hl === -1 ? `Ends at stable ${end.r.label}.` : 'Most probable path shown.'),
      h('div', { class: 'stack', style: { gap: '4px' } }, chain.map((c, i) => c.sf
        ? h('div', { class: 'row small' }, h('span', { class: 'pill', style: { background: MODE_INFO.SF.color } }, 'SF'), 'splits into two fragments')
        : h('button', { class: 'src-btn', style: { '--c': i === 0 ? '#ffd27a' : modeColor([chain[i].mode]) }, onclick: () => select(c.r, true) },
          h('span', { class: 'dot' }),
          h('span', { html: `${nuclideLabelHTML(c.r)} <span class="muted" style="font-size:12px"> ${c.mode ? `via ${c.mode}` : 'start'}</span>` }),
          h('span', { class: 'n' }, c.r.hl === -1 ? 'stable' : fmtTime(c.r.hl))))));
  }

  // Decay simulator
  const sim = decaySim();

  // Half-life calculator
  const calcT = h('input', { type: 'number', id: 'calc-t', value: '5730', min: '0' });
  const calcU = h('select', { id: 'calc-u' }, [['s', 1], ['min', 60], ['h', 3600], ['days', 86400], ['years', YEAR]].map(([l, v]) => h('option', { value: v, selected: l === 'years' }, l)));
  const calcF = h('input', { type: 'number', id: 'calc-f', value: '25', min: '0.0001', max: '100', step: 'any' });
  const calcOut = h('div', { class: 'stack', style: { gap: '6px' } });
  function calc() {
    if (!(sel.hl > 0)) { calcOut.replaceChildren(h('p', { class: 'muted small' }, 'Pick a radioactive isotope to use the calculator.')); return; }
    const t = +calcT.value * +calcU.value, left = Math.pow(0.5, t / sel.hl);
    const f = clamp(+calcF.value / 100, 1e-12, 1), age = sel.hl * Math.log2(1 / f);
    calcOut.replaceChildren(
      h('div', {}, h('span', { class: 'muted' }, 'After that time: '), h('b', { class: 'mono' }, `${left < 1e-4 ? sci(left * 100, 3) : fmt(left * 100, 4)}% remains`), h('span', { class: 'muted' }, ` (${fmt(t / sel.hl, 3)} half-lives)`)),
      h('div', {}, h('span', { class: 'muted' }, 'A sample with that % left is '), h('b', { class: 'mono' }, fmtTime(age).replace('years', 'years old')), h('span', { class: 'muted' }, ' (radiometric dating)')));
  }
  for (const x of [calcT, calcU, calcF]) x.addEventListener('input', calc);

  function drawLegend() {
    const items = mode === 'decay'
      ? [['stable', '#f4f4f8'], ...Object.entries(MODE_INFO).filter(([k]) => ['α', 'β-', 'β+', 'EC', 'IT', 'SF'].includes(k)).map(([k, v]) => [k, v.color]), ['no data', '#23273d']]
      : null;
    legend.replaceChildren(items
      ? h('div', { class: 'legend-inline' }, items.map(([l, c]) => h('span', {}, h('i', { style: { background: c } }), l)))
      : h('div', { class: 'stack', style: { gap: '4px' } },
        h('div', { style: { height: '8px', borderRadius: '4px', background: RAMP_CSS } }),
        h('div', { class: 'row small muted', style: { justifyContent: 'space-between' } }, ...({ halflife: ['1 ns', '1 s', '30 000 y', '10¹⁸ s+'], binding: ['5 MeV', '8.8 MeV (Fe/Ni peak)'], abundance: ['0.001%', '100%'] }[mode] || []).map(t => h('span', {}, t))),
        mode === 'halflife' ? h('div', { class: 'legend-inline' }, h('span', {}, h('i', { style: { background: '#f4f4f8' } }), 'stable'), h('span', {}, h('i', { style: { background: '#23273d' } }), 'no data')) : null));
  }

  search.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const r = findNuclide(search.value);
    if (r) select(r, true); else search.style.borderColor = 'var(--bad)';
  });
  search.addEventListener('input', () => { search.style.borderColor = ''; });

  const pickBtn = nuclideButton({ value: sel, title: 'Pick any nucleus', onPick: r => { if (typeof r !== 'string') select(r, true); } });
  const famous = ['H-3', 'C-14', 'K-40', 'Co-60', 'Sr-90', 'Tc-99m', 'I-131', 'Cs-137', 'Rn-222', 'Ra-226', 'U-235', 'U-238', 'Pu-239', 'Am-241', 'Bi-209', 'Fe-56'];

  root.append(h('div', { class: 'lab' },
    h('div', { class: 'lab-head' }, h('div', {},
      h('div', { class: 'eyebrow' }, 'Isotope Lab'),
      h('h1', {}, 'The chart of nuclides'),
      h('p', {}, `All ${GROUND.length.toLocaleString()} known nuclei, one square each: protons up, neutrons across. The pale line of stable nuclei is the valley of stability. Drag to pan, scroll or pinch to zoom, tap a square.`))),
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, modeTabs,
      h('div', { class: 'row' }, h('div', { style: { width: '230px' } }, pickBtn.root), h('div', { class: 'field', style: { width: '190px' } }, search), h('button', { class: 'btn', onclick: () => { fit(); draw(); } }, 'Reset view'))),
    h('div', { class: 'grid2' },
      h('div', { class: 'stack' }, box, legend,
        h('div', { class: 'row small' }, h('span', { class: 'muted' }, 'Famous isotopes:'), famous.map(f => h('button', { class: 'el-chip', style: { '--c': '#ffd27a' }, onclick: () => select(findNuclide(f), true) }, h('b', {}, f))))),
      h('div', { class: 'stack' }, h('div', { class: 'card stack' }, info), h('div', { class: 'card stack' }, chainBox))),
    h('div', { class: 'grid2' },
      h('div', { class: 'card stack' }, h('h3', {}, 'Half-life simulator'), sim.root),
      h('div', { class: 'card stack' }, h('h3', {}, 'Half-life & dating calculator'),
        h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'calc-t' }, 'Time elapsed'), calcT), h('div', { class: 'field' }, h('label', { for: 'calc-u' }, 'Unit'), calcU), h('div', { class: 'field' }, h('label', { for: 'calc-f' }, '% of parent left'), calcF)),
        calcOut,
        h('p', { class: 'hint-text' }, 'Carbon-14 dating: living things keep a steady C-14 level; after death it halves every 5,730 years. Uranium-lead dating uses U-238 (4.47 billion years) to date the oldest rocks and meteorites.')))));

  let first = true;
  return {
    show() { requestAnimationFrame(() => { if (first) { fit(); first = false; select(sel); } else draw(); calc(); drawLegend(); sim.resume(); }); },
    hide() { sim.pause(); },
    open(r) { requestAnimationFrame(() => { if (first) { fit(); first = false; } select(r, true); calc(); drawLegend(); }); },
    selectedChanged: calc,
  };

  function st(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v', style: { fontSize: '14px' } }, String(v))); }

  // ----- Monte Carlo decay of 400 atoms -----
  function decaySim() {
    const N = 400;
    let atoms = new Uint8Array(N), t = 0, running = false, speed = 1, r0 = null, hist = [], raf = 0, last = 0;
    const cv = h('canvas', { style: { width: '100%', height: '100%' } });
    const graph = h('canvas', { style: { width: '100%', height: '100%' } });
    const status = h('div', { class: 'row mono small', style: { justifyContent: 'space-between' } });
    const play = h('button', { class: 'btn primary', onclick: () => (running ? pause() : resume(true)) }, 'Start');
    const speedSel = h('select', { id: 'sim-speed', style: { width: 'auto' }, onchange: () => { speed = +speedSel.value; } }, [['0.5×', 0.5], ['1×', 1], ['2×', 2], ['4×', 4]].map(([l, v]) => h('option', { value: v, selected: v === 1 }, l)));
    const rootEl = h('div', { class: 'stack' },
      h('p', { class: 'hint-text', style: { margin: 0 } }, 'Each dot is one atom. Every atom has the same chance to decay each moment; nobody can say which one goes next, yet half are always gone after one half-life.'),
      h('div', { class: 'grid2', style: { gap: '10px' } },
        h('div', { class: 'canvas-box', style: { aspectRatio: '1', maxWidth: '320px' } }, cv),
        h('div', { class: 'canvas-box', style: { height: '220px' } }, graph)),
      status, h('div', { class: 'row' }, play, h('button', { class: 'btn', onclick: () => reset() }, 'Reset'), speedSel));
    function set(r) { r0 = r; reset(); }
    function reset() { atoms = new Uint8Array(N); t = 0; hist = [[0, N]]; pause(); drawSim(); }
    function resume(user) { if (!r0 || !(r0.hl > 0)) return; if (!user && !running) return; running = true; play.textContent = 'Pause'; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(step); }
    function pause() { running = false; play.textContent = 'Start'; cancelAnimationFrame(raf); }
    function step(ts) {
      if (!running) return;
      const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
      const dth = dt * speed / 2; // 1 half-life = 2 s at 1×
      const p = 1 - Math.pow(0.5, dth);
      let alive = 0;
      for (let i = 0; i < N; i++) { if (!atoms[i] && Math.random() < p) atoms[i] = 1; if (!atoms[i]) alive++; }
      t += dth; hist.push([t, alive]);
      drawSim();
      if (t > 8 || alive === 0) { pause(); return; }
      raf = requestAnimationFrame(step);
    }
    function drawSim() {
      const ok = r0 && r0.hl > 0;
      const c = cv.getContext('2d'); const { w, h: H } = fitCanvas(cv, c);
      c.fillStyle = SCREEN(); c.fillRect(0, 0, w, H);
      const cols = 20, s = Math.min(w, H) / cols;
      const d = chain[1]?.r;
      for (let i = 0; i < N; i++) {
        const x = (i % cols) * s + s / 2, y = Math.floor(i / cols) * s + s / 2;
        c.fillStyle = atoms[i] ? '#5b6284' : '#ffd27a';
        c.beginPath(); c.arc(x, y, s * (atoms[i] ? 0.22 : 0.36), 0, Math.PI * 2); c.fill();
      }
      const g = graph.getContext('2d'); const G = fitCanvas(graph, g);
      g.fillStyle = SCREEN(); g.fillRect(0, 0, G.w, G.h);
      const px = tt => 34 + (tt / 8) * (G.w - 44), py = n => 10 + (1 - n / N) * (G.h - 34);
      g.strokeStyle = 'rgba(170,185,255,.12)'; g.fillStyle = '#8f97ba'; g.font = '10px "Source Sans 3", system-ui, sans-serif';
      for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(px(k), 10); g.lineTo(px(k), G.h - 24); g.stroke(); if (k % 2 === 0) g.fillText(`${k}`, px(k) - 3, G.h - 10); }
      for (const f of [1, 0.5, 0.25, 0.125]) { g.beginPath(); g.moveTo(px(0), py(N * f)); g.lineTo(px(8), py(N * f)); g.stroke(); g.fillText(`${f * 100}%`, 2, py(N * f) + 3); }
      g.fillText('half-lives →', G.w - 76, G.h - 10);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([3, 3]); g.beginPath();
      for (let k = 0; k <= 80; k++) { const tt = k / 10; k ? g.lineTo(px(tt), py(N * Math.pow(0.5, tt))) : g.moveTo(px(tt), py(N)); }
      g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#ffd27a'; g.lineWidth = 2; g.beginPath();
      hist.forEach(([tt, n], i) => (i ? g.lineTo(px(tt), py(n)) : g.moveTo(px(tt), py(n)))); g.stroke(); g.lineWidth = 1;
      const alive = hist[hist.length - 1][1];
      status.replaceChildren(
        h('span', {}, ok ? `${r0.label}: ${alive} left` : 'Pick a radioactive isotope'),
        h('span', {}, d ? `${N - alive} became ${d.label}` : `${N - alive} decayed`),
        h('span', {}, ok ? `elapsed ${fmtTime(t * r0.hl)}` : ''));
      play.disabled = !ok;
    }
    return { root: rootEl, set, pause, resume: () => {}, draw: drawSim };
  }
}
