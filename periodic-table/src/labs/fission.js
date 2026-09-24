import { h, fmt, sci, fmtTime, fitCanvas, clamp, rand } from '../util.js';
import { findNuclide, nuc, byZ } from '../store.js';
import { qValue, decayChain, nuclideLabelHTML } from '../nuclear.js';
import { bindingCurve, J_PER_MEV, KG_PER_U } from './shared.js';

const FUELS = [
  { l: 'U-235', split: [36, 92, 3], how: 'thermal neutron', note: 'The fuel of most power reactors. 0.72% of natural uranium.' },
  { l: 'Pu-239', split: [40, 103, 3], how: 'thermal neutron', note: 'Bred from U-238 inside reactors. Produces about a third of the energy in a typical reactor by the end of a fuel cycle.' },
  { l: 'U-233', split: [36, 93, 3], how: 'thermal neutron', note: 'Bred from thorium-232 in proposed thorium reactors.' },
  { l: 'Pu-241', split: [40, 102, 3], how: 'thermal neutron', note: 'Fissile plutonium isotope, half-life 14 years.' },
  { l: 'U-238', split: [36, 92, 3], how: 'fast neutron (>1 MeV)', note: 'Only fissions with fast neutrons. It mostly captures neutrons and turns into plutonium-239.' },
  { l: 'Th-232', split: [36, 90, 3], how: 'fast neutron', note: 'Fertile rather than fissile: it captures a neutron and becomes fissile U-233.' },
  { l: 'Cf-252', split: [42, 104, 4], how: 'spontaneous', note: 'Splits on its own (3% of decays), a strong neutron source used to start reactors.', sf: true },
];

// Typical fission product yield: two humps near A≈95 and A≈138 for U-235.
const yieldCurve = (A, Ac) => { const l = 95 + (Ac - 236) * 0.9, hv = 138 + (Ac - 236) * 0.1; const g = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s)); return 6.5 * (g(A, l, 5.5) + g(A, hv, 5.5)) + 0.02; };

export function buildFission(root) {
  let fuel = FUELS[0], compound, zl = 36, al = 92, nn = 3;
  const curve = bindingCurve({ height: 240 });
  const eq = h('div', { class: 'eq' });
  const stats = h('div', { class: 'stat-grid' });
  const frags = h('div', { class: 'grid2', style: { gap: '10px' } });
  const warn = h('p', { class: 'warn', hidden: true });
  const zS = h('input', { type: 'range', id: 'fis-z', min: 26, max: 46, value: zl });
  const aS = h('input', { type: 'range', id: 'fis-a', min: 70, max: 118, value: al });
  const nS = h('input', { type: 'range', id: 'fis-n', min: 0, max: 5, value: nn });
  const zV = h('b'), aV = h('b'), nV = h('b');
  const yieldCv = h('canvas', {});
  const splitCv = h('canvas', {});
  let splitT = 0;

  const fuelTabs = h('div', { class: 'tabs' }, FUELS.map((f, i) => h('button', { class: i ? '' : 'on', onclick: e => { fuel = f; for (const b of fuelTabs.children) b.classList.remove('on'); e.currentTarget.classList.add('on'); preset(); } }, f.l)));

  function preset() {
    const r = findNuclide(fuel.l);
    compound = fuel.sf ? r : nuc(r.z, r.a + 1);
    [zl, al, nn] = fuel.split; // a classic observed split
    zS.max = Math.floor(compound.z / 2); zS.value = zl; aS.value = al; nS.value = nn;
    update();
  }
  function update() {
    zl = +zS.value; al = +aS.value; nn = +nS.value;
    zV.textContent = `${zl} (${byZ[zl].name})`; aV.textContent = String(al); nV.textContent = String(nn);
    const zh = compound.z - zl, ah = compound.a - al - nn;
    const L = nuc(zl, al), Hh = nuc(zh, ah);
    const fuelR = findNuclide(fuel.l);
    const ins = fuel.sf ? [fuel.l] : ['n', fuel.l];
    if (!L || !Hh) {
      warn.hidden = false;
      warn.textContent = `${!L ? `${byZ[zl].sym}-${al}` : `${byZ[zh].sym}-${ah}`} is not a known nucleus. Move the sliders toward the middle of the ranges.`;
      eq.innerHTML = ''; stats.replaceChildren(); frags.replaceChildren(); return;
    }
    warn.hidden = true;
    const outs = [L.label, Hh.label, ...Array(nn).fill('n')];
    const q = qValue(ins, outs);
    eq.innerHTML = (fuel.sf ? '' : 'n <span class="op">+</span> ') + nuclideLabelHTML(fuelR) + ' <span class="op">→</span> ' + nuclideLabelHTML(L) + ' <span class="op">+</span> ' + nuclideLabelHTML(Hh) + (nn ? ` <span class="op">+</span> ${nn} n` : '') + ` <span class="q">${q >= 0 ? '+' : ''}${q.toFixed(1)} MeV</span>`;
    const coul = 1.44 * zl * zh / (1.2 * (Math.cbrt(al) + Math.cbrt(ah)) + 2);
    const perKg = q * J_PER_MEV / (fuelR.m * KG_PER_U);
    stats.replaceChildren(
      st('Energy released', `${q.toFixed(1)} MeV`), st('Coulomb push at split', `${coul.toFixed(0)} MeV`),
      st('Per kg of fuel', `${sci(perKg, 3)} J`), st('Equal to coal', `${fmt(perKg / 2.4e7 / 1000, 3)} tonnes/kg`),
      st('Equal to TNT', `${fmt(perKg / 4.184e9 / 1000, 3)} kt/kg`), st('Mass → energy', `${fmt(q / (fuelR.m * 931.494) * 100, 3)}%`));
    frags.replaceChildren(fragCard(L), fragCard(Hh));
    drawYield(); curve.mark([{ label: fuel.l, color: '#8fdcff' }, { label: L.label, color: '#7cf29a' }, { label: Hh.label, color: '#7cf29a' }]);
    splitT = 0;
  }
  function fragCard(r) {
    const ch = decayChain(r), steps = ch.length - 1, end = ch[ch.length - 1].r;
    const txt = r.hl === -1 ? 'Stable fragment.' : r.hl == null ? 'Extremely short-lived: it beta-decays within a fraction of a second. Neutron-rich fragments are why spent fuel is so radioactive.' : `${steps} decay${steps === 1 ? '' : 's'} to stable ${end?.label || '?'}. Neutron-rich fragments are why spent fuel stays radioactive.`;
    return h('div', { class: 'card stack', style: { padding: '12px', gap: '6px' } },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { style: { fontSize: '22px' }, html: nuclideLabelHTML(r) }), h('span', { class: 'mono small' }, r.hl === -1 ? 'stable' : r.hl == null ? '< 1 s' : fmtTime(r.hl))),
      h('div', { class: 'small muted' }, txt),
      h('div', { class: 'small mono muted' }, ch.slice(0, 7).map(c => c.r?.label || 'SF').join(' → ') + (ch.length > 7 ? ' → …' : '')));
  }
  function drawYield() {
    const ctx = yieldCv.getContext('2d'); const { w, h: H } = fitCanvas(yieldCv, ctx);
    ctx.fillStyle = '#030409'; ctx.fillRect(0, 0, w, H);
    const X = A => 30 + (A - 70) / 100 * (w - 40), Y = y => H - 22 - (Math.log10(y) + 2) / 3 * (H - 34);
    ctx.strokeStyle = 'rgba(170,185,255,.12)'; ctx.fillStyle = '#8f97ba'; ctx.font = '10px "IBM Plex Mono", monospace';
    for (const y of [0.01, 0.1, 1, 10]) { ctx.beginPath(); ctx.moveTo(30, Y(y)); ctx.lineTo(w, Y(y)); ctx.stroke(); ctx.fillText(y + '%', 0, Y(y) + 3); }
    for (let A = 80; A <= 160; A += 20) ctx.fillText(String(A), X(A) - 8, H - 6);
    ctx.strokeStyle = '#7cf29a'; ctx.lineWidth = 2; ctx.beginPath();
    for (let A = 70; A <= 170; A++) { const y = Y(yieldCurve(A, compound.a)); A === 70 ? ctx.moveTo(X(A), y) : ctx.lineTo(X(A), y); }
    ctx.stroke(); ctx.lineWidth = 1;
    const ah = compound.a - al - nn;
    for (const A of [al, ah]) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(X(A), Y(yieldCurve(A, compound.a)), 5, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#8f97ba'; ctx.fillText('fission yield vs. fragment mass A', 34, 12);
  }
  for (const s of [zS, aS, nS]) s.addEventListener('input', update);

  // Liquid-drop split animation
  let splitRaf = 0, lastS = 0;
  function splitFrame(ts) {
    splitRaf = requestAnimationFrame(splitFrame);
    if (!splitCv.offsetParent) return;
    const dt = Math.min(0.05, (ts - (lastS || ts)) / 1000); lastS = ts; splitT += dt;
    const ctx = splitCv.getContext('2d'); const { w, h: H } = fitCanvas(splitCv, ctx);
    ctx.fillStyle = '#030409'; ctx.fillRect(0, 0, w, H);
    const T = 4, k = splitT % T, cx = w / 2, cy = H / 2, R = Math.min(w, H) * 0.2;
    const blob = (x, y, r, c) => { const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#fff'); g.addColorStop(0.3, c); g.addColorStop(1, 'rgba(40,60,160,.3)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
    const rl = R * Math.cbrt(al / compound.a), rh = R * Math.cbrt((compound.a - al - nn) / compound.a);
    if (k < 0.8 && !fuel.sf) {
      const x = cx - w * 0.45 * (1 - k / 0.8);
      ctx.fillStyle = '#8aa4ff'; ctx.beginPath(); ctx.arc(x, cy, 5, 0, 7); ctx.fill();
      blob(cx, cy, R, '#ff9a6b');
    } else if (k < 2.0) {
      const f = clamp((k - 0.8) / 1.2, 0, 1), sep = f * (rl + rh) * 1.05;
      const wob = Math.sin(k * 30) * (1 - f) * 3;
      blob(cx - sep * 0.5, cy, R * (1 - f) + rl * f + wob, '#ff9a6b');
      blob(cx + sep * 0.5, cy, R * (1 - f) + rh * f - wob, '#ff9a6b');
      ctx.fillStyle = 'rgba(255,154,107,.55)'; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1, sep * 0.5), Math.max(1, (1 - f) * R * 0.75), 0, 0, 7); ctx.fill();
    } else {
      const f = k - 2.0, d = f * w * 0.18;
      if (f < 0.3) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.5); g.addColorStop(0, `rgba(255,255,255,${1 - f / 0.3})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, H); }
      blob(cx - (rl + rh) * 0.55 - d, cy, rl, '#7cf29a'); blob(cx + (rl + rh) * 0.55 + d * (al / (compound.a - al)), cy, rh, '#ffd27a');
      for (let i = 0; i < nn; i++) { const a = (i / Math.max(1, nn)) * Math.PI * 2 + 0.6; ctx.fillStyle = '#8aa4ff'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d * 2.2, cy + Math.sin(a) * d * 2.2, 4, 0, 7); ctx.fill(); }
      ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#e9ecf8';
      const L = nuc(zl, al), Hh = nuc(compound.z - zl, compound.a - al - nn);
      if (L) ctx.fillText(L.label, cx - (rl + rh) * 0.55 - d, cy - rl - 8);
      if (Hh) ctx.fillText(Hh.label, cx + (rl + rh) * 0.55 + d * (al / (compound.a - al)), cy - rh - 8);
      ctx.textAlign = 'left';
    }
  }

  // ----- Chain reaction reactor -----
  const reactor = chainReactor();

  root.append(h('div', { class: 'lab' },
    h('div', { class: 'lab-head' }, h('div', {},
      h('div', { class: 'eyebrow' }, 'Fission Lab'),
      h('h1', {}, 'Split the heaviest nuclei'),
      h('p', {}, 'In 1938 Otto Hahn, Fritz Strassmann, Lise Meitner and Otto Frisch found that uranium hit by a neutron splits in two. Choose the fuel and the fragments; the energy comes from the measured masses.'))),
    fuelTabs,
    h('div', { class: 'grid2' },
      h('div', { class: 'stack' },
        h('div', { class: 'canvas-box', style: { height: '220px' } }, splitCv),
        h('div', { class: 'card stack' }, eq, warn, stats, frags)),
      h('div', { class: 'stack' },
        h('div', { class: 'card stack' }, h('h3', {}, 'Choose the split'),
          h('div', { class: 'field' }, h('label', { for: 'fis-z' }, 'Light fragment protons', zV), zS),
          h('div', { class: 'field' }, h('label', { for: 'fis-a' }, 'Light fragment mass A', aV), aS),
          h('div', { class: 'field' }, h('label', { for: 'fis-n' }, 'Free neutrons released', nV), nS),
          h('div', { class: 'canvas-box', style: { height: '150px' } }, yieldCv),
          h('p', { class: 'hint-text', style: { margin: 0 } }, 'Uranium rarely splits evenly. Fragments cluster in two humps; the gold dots are your fragments.')),
        h('div', { class: 'card stack' }, h('h3', {}, 'Binding energy'), curve.root))),
    h('div', { class: 'card stack' }, h('h3', {}, 'Chain reaction reactor'), reactor.root)));

  preset();
  return {
    show() { if (!splitRaf) { lastS = 0; splitRaf = requestAnimationFrame(splitFrame); } requestAnimationFrame(() => { curve.draw(); drawYield(); }); reactor.start(); },
    hide() { cancelAnimationFrame(splitRaf); splitRaf = 0; reactor.stop(); },
  };
}

function st(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v', style: { fontSize: '14px' } }, v)); }

function chainReactor() {
  const cv = h('canvas', { 'aria-label': 'Chain reaction simulation' });
  const graph = h('canvas', {});
  const enr = h('input', { type: 'range', id: 'rx-enr', min: 0, max: 100, value: 30 });
  const rods = h('input', { type: 'range', id: 'rx-rods', min: 0, max: 100, value: 40 });
  const modC = h('input', { type: 'checkbox', id: 'rx-mod', checked: true });
  const enrV = h('b'), rodsV = h('b');
  const status = h('span', { class: 'status sub' }, 'idle');
  const read = h('div', { class: 'stat-grid' });
  let nuclei = [], neutrons = [], flashes = [], raf = 0, last = 0, W = 600, H = 320;
  let fissions = 0, energy = 0, born = 0, lost = 0, hist = [], win = [], bred = 0, t = 0;
  const cols = 26, rows = 13;
  function load() {
    const e = +enr.value / 100;
    nuclei = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) nuclei.push({ i, j, k: Math.random() < e ? 5 : 8, cool: 0 });
    neutrons = []; fissions = 0; energy = 0; hist = []; win = []; bred = 0; t = 0;
  }
  const pos = n => [W * (0.04 + 0.92 * (n.i + 0.5) / cols), H * (0.06 + 0.88 * (n.j + 0.5) / rows)];
  const rodXs = () => [0.2, 0.4, 0.6, 0.8].map(f => W * f);
  function fire(x = 10, y = H / 2, n = 6) { for (let i = 0; i < n; i++) { const a = rand(-0.6, 0.6); neutrons.push({ x, y: y + rand(-40, 40), vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, fast: true, age: 0 }); } }
  function step(dt) {
    t += dt;
    const rodDepth = +rods.value / 100 * H, mod = modC.checked, rx = rodXs();
    const R = Math.min(W / cols, H / rows) * 0.42;
    const next = [];
    for (const n of neutrons) {
      n.x += n.vx * dt; n.y += n.vy * dt; n.age += dt;
      if (mod && n.fast && n.age > 0.18) { n.fast = false; const s = 90 / Math.hypot(n.vx, n.vy); n.vx *= s; n.vy *= s; }
      if (n.x < 0 || n.y < 0 || n.x > W || n.y > H) { lost++; continue; }
      if (rx.some(x => Math.abs(n.x - x) < 5) && n.y < rodDepth) { lost++; continue; }
      let dead = false;
      const ci = Math.floor(((n.x / W) - 0.04) / 0.92 * cols), cj = Math.floor(((n.y / H) - 0.06) / 0.88 * rows);
      const u = nuclei[ci * rows + cj];
      if (u && ci >= 0 && ci < cols && cj >= 0 && cj < rows && u.k && !u.cool) {
        const [ux, uy] = pos(u);
        if ((n.x - ux) ** 2 + (n.y - uy) ** 2 < R * R) {
          const fissile = u.k === 5 || u.k === 9;
          const p = fissile ? (n.fast ? 0.12 : 0.55) : (n.fast ? 0.03 : 0.08);
          if (Math.random() < p * dt * 60) {
            dead = true; lost++;
            if (fissile) {
              u.k = 0; u.cool = 1; fissions++; energy += 200;
              const m = Math.random() < 0.43 ? 3 : 2; born += m; win.push(t);
              for (let k = 0; k < m; k++) { const a = rand(0, Math.PI * 2); next.push({ x: ux, y: uy, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, fast: true, age: 0 }); }
              flashes.push({ x: ux, y: uy, t: 0 });
            } else { u.k = 9; bred++; } // U-238 + n → U-239 → Np-239 → Pu-239
          }
        }
      }
      if (!dead) next.push(n);
    }
    neutrons = next;
    if (neutrons.length > 900) { rods.value = 100; rodsV.textContent = '100%'; neutrons = neutrons.slice(0, 300); status.className = 'status sup'; status.textContent = 'SCRAM! runaway stopped'; }
    for (const u of nuclei) if (u.cool) { u.cool -= dt * 0.25; if (u.cool <= 0) u.cool = 0; }
    win = win.filter(x => t - x < 1);
    hist.push(win.length); if (hist.length > 300) hist.shift();
    // auto source keeps a trickle so the reactor never fully stops
    if (Math.random() < dt * 2) fire(10, rand(20, H - 20), 1);
  }
  function draw() {
    const ctx = cv.getContext('2d'); const d = fitCanvas(cv, ctx); W = d.w; H = d.h;
    ctx.fillStyle = modC.checked ? '#04101a' : '#030409'; ctx.fillRect(0, 0, W, H);
    const R = Math.min(W / cols, H / rows) * 0.36;
    for (const u of nuclei) {
      const [x, y] = pos(u);
      ctx.fillStyle = u.k === 5 ? '#6ee7a8' : u.k === 8 ? '#4a506e' : u.k === 9 ? '#c9a2ff' : `rgba(255,154,107,${0.15 + u.cool * 0.5})`;
      ctx.beginPath(); ctx.arc(x, y, u.k ? R : R * 0.5, 0, 7); ctx.fill();
    }
    const rodDepth = +rods.value / 100 * H;
    ctx.fillStyle = '#9aa2b8'; for (const x of rodXs()) ctx.fillRect(x - 4, 0, 8, rodDepth);
    ctx.globalCompositeOperation = 'lighter';
    for (const f of flashes) { const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 30); g.addColorStop(0, `rgba(255,220,150,${1 - f.t * 2})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - 30, f.y - 30, 60, 60); f.t += 0.016; }
    flashes = flashes.filter(f => f.t < 0.5);
    for (const n of neutrons) { ctx.fillStyle = n.fast ? '#ffffff' : '#8fdcff'; ctx.fillRect(n.x - 1.5, n.y - 1.5, 3, 3); }
    ctx.globalCompositeOperation = 'source-over';
    // graph
    const g = graph.getContext('2d'); const G = fitCanvas(graph, g);
    g.fillStyle = '#030409'; g.fillRect(0, 0, G.w, G.h);
    const mx = Math.max(10, ...hist);
    g.strokeStyle = '#ffd27a'; g.lineWidth = 2; g.beginPath();
    hist.forEach((v, i) => { const x = (i / 300) * G.w, y = G.h - 16 - (v / mx) * (G.h - 26); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.fillStyle = '#8f97ba'; g.font = '10px "IBM Plex Mono", monospace'; g.fillText('fissions per second', 6, 12);
    const k = lost ? born / lost : 0;
    const kk = win.length;
    if (status.textContent.startsWith('SCRAM') && neutrons.length > 60) { /* keep message */ }
    else if (kk > 25 && neutrons.length > 150) { status.className = 'status sup'; status.textContent = 'supercritical: power rising'; }
    else if (kk > 3) { status.className = 'status crit'; status.textContent = 'near critical: steady chain'; }
    else { status.className = 'status sub'; status.textContent = 'subcritical: chain dies out'; }
    read.replaceChildren(st('Neutrons in flight', neutrons.length), st('Fissions', fissions), st('Neutron economy k', k ? k.toFixed(2) : '—'),
      st('Energy released', `${sci(energy * 1.602e-13, 3)} J`), st('Pu-239 bred', bred));
    if (lost > 4000) { born *= 0.5; lost *= 0.5; }
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!cv.offsetParent) return;
    const dt = Math.min(0.033, (ts - (last || ts)) / 1000); last = ts;
    step(dt); draw();
  }
  enr.addEventListener('input', () => { enrV.textContent = `${enr.value}%`; });
  rods.addEventListener('input', () => { rodsV.textContent = `${rods.value}%`; });
  enr.addEventListener('change', load);
  enrV.textContent = `${enr.value}%`; rodsV.textContent = `${rods.value}%`;
  load();
  const root = h('div', { class: 'grid2' },
    h('div', { class: 'stack' },
      h('div', { class: 'canvas-box', style: { height: 'min(46vh, 380px)' } }, cv),
      h('div', { class: 'legend-inline' }, h('span', {}, h('i', { style: { background: '#6ee7a8' } }), 'U-235 (fissile)'), h('span', {}, h('i', { style: { background: '#4a506e' } }), 'U-238'), h('span', {}, h('i', { style: { background: '#c9a2ff' } }), 'bred Pu-239 (fissile)'), h('span', {}, h('i', { style: { background: '#ff9a6b' } }), 'split'), h('span', {}, h('i', { style: { background: '#fff' } }), 'fast neutron'), h('span', {}, h('i', { style: { background: '#8fdcff' } }), 'slow neutron'), h('span', {}, h('i', { style: { background: '#9aa2b8' } }), 'control rods'))),
    h('div', { class: 'stack' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, status, h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => fire() }, 'Fire neutrons'), h('button', { class: 'btn', onclick: () => load() }, 'Refuel'), h('button', { class: 'btn', onclick: () => { rods.value = 100; rodsV.textContent = '100%'; } }, 'SCRAM'))),
      h('div', { class: 'field' }, h('label', { for: 'rx-enr' }, 'Fuel enrichment (U-235)', enrV), enr),
      h('div', { class: 'field' }, h('label', { for: 'rx-rods' }, 'Control rods inserted', rodsV), rods),
      h('label', { class: 'row small', for: 'rx-mod' }, modC, 'Water moderator: slows neutrons so U-235 catches them'),
      h('div', { class: 'canvas-box', style: { height: '110px' } }, graph), read,
      h('p', { class: 'hint-text', style: { margin: 0 } }, 'Each fission frees 2 or 3 neutrons. If on average exactly one of them causes another fission, the reaction is critical and steady, like a power plant. Real reactors use 3 to 5% enrichment.')));
  return { root, start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }, stop() { cancelAnimationFrame(raf); raf = 0; } };
}
