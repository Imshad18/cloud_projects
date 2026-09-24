import { h, fmt, sci, fmtTime, fitCanvas, clamp, rand, SCREEN } from '../util.js';
import { findNuclide, nuc, byZ } from '../store.js';
import { decayChain, nuclideLabelHTML, atomicMass, sepN, M_N, U } from '../nuclear.js';
import { bindingCurve, J_PER_MEV, KG_PER_U } from './shared.js';
import { nuclideButton } from '../chooser.js';
import { fissionBarrier, fmtE, OMG_MEV } from './colliderPhysics.js';
import { eventCanvas } from './eventView.js';

const FUELS = [
  { l: 'U-235', split: [36, 92, 3], E: 2.5e-8, note: 'The fuel of most power reactors: 0.72% of natural uranium. Slow (thermal) neutrons split it.' },
  { l: 'Pu-239', split: [40, 103, 3], E: 2.5e-8, note: 'Bred from U-238 inside reactors. By the end of a fuel cycle it makes about a third of the energy.' },
  { l: 'U-233', split: [36, 93, 3], E: 2.5e-8, note: 'Bred from thorium-232 in thorium reactors.' },
  { l: 'U-238', split: [36, 92, 3], E: 2, note: 'Splits only with fast neutrons above about 1 MeV. Slow neutrons are captured and breed plutonium.' },
  { l: 'Th-232', split: [36, 90, 3], E: 2, note: 'Fertile: it captures a neutron and becomes fissile U-233.' },
  { l: 'Cf-252', split: [42, 104, 4], E: 0, sf: true, note: 'Splits on its own in 3% of decays, a neutron source used to start reactors.' },
  { l: 'Pb-208', split: [41, 102, 3], E: 60, note: 'Lead is doubly magic and very stable. It fissions only when hit hard, around 30 MeV and above.' },
  { l: 'Fe-56', split: [13, 27, 2], E: 200, note: 'Iron is at the top of the binding energy curve: splitting it always costs energy.' },
];
const E_MARKS = [['Thermal (0.025 eV)', 2.5e-8], ['Fission neutron (2 MeV)', 2], ['14 MeV (fusion neutron)', 14], ['100 MeV', 100], ['1 GeV (spallation)', 1000], ['LHC energy', 6.8e6], ['OMG particle', OMG_MEV], ['10× OMG', OMG_MEV * 10]];

// Fission yield vs fragment mass: two humps for actinides, one symmetric hump for lighter nuclei.
function yieldCurve(A, Ac) {
  const g = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
  if (Ac >= 225) { const l = 95 + (Ac - 236) * 0.9, hv = 138 + (Ac - 236) * 0.1; return 6.5 * (g(A, l, 5.5) + g(A, hv, 5.5)) + 0.02; }
  return 9 * g(A, Ac / 2, Ac * 0.06) + 0.02;
}

export function buildFission(root, { openElement } = {}) {
  const st = { target: findNuclide('U-235'), sf: false, E: 2.5e-8, zl: 36, al: 92, nn: 3, forced: false };
  const ev = eventCanvas({ aspect: 1.9, maxHeight: 360 });
  const curve = bindingCurve({ height: 240 });
  const eq = h('div', { class: 'eq' });
  const title = h('h3', { style: { fontSize: '21px' } }), text = h('p', { style: { margin: 0 } });
  const stats = h('div', { class: 'stat-grid' });
  const frags = h('div', { class: 'grid2', style: { gap: '10px' } });
  const zS = h('input', { type: 'range', id: 'fis-z', min: 1, max: 46 });
  const aS = h('input', { type: 'range', id: 'fis-a', min: 1, max: 200 });
  const nS = h('input', { type: 'range', id: 'fis-n', min: 0, max: 10 });
  const eS = h('input', { type: 'range', id: 'fis-e', min: 0, max: 2400 });
  const zV = h('b'), aV = h('b'), nV = h('b'), eV = h('b');
  const yieldCv = h('canvas', {});
  const tBtn = nuclideButton({ value: st.target, title: 'Choose the nucleus to split', onPick: r => { if (typeof r === 'string') return; st.target = r; autoSplit(); update(); run(); } });
  const modeSeg = h('div', { class: 'seg' }, h('button', { 'data-k': 'n', class: 'on', onclick: () => setMode(false) }, 'Hit by a neutron'), h('button', { 'data-k': 'sf', onclick: () => setMode(true) }, 'Spontaneous'));
  const forceBtn = h('button', { class: 'btn', onclick: () => { st.forced = true; update(); run(); } }, 'Force it to split anyway');
  const note = h('div', { class: 'note', hidden: true });
  let R = null;

  function setMode(sf) { st.sf = sf; for (const b of modeSeg.children) b.classList.toggle('on', (b.dataset.k === 'sf') === sf); autoSplit(); update(); run(); }
  const compound = () => ({ z: st.target.z, a: st.target.a + (st.sf ? 0 : 1) });
  function autoSplit() { // a sensible default: near the peak of the yield curve
    const c = compound();
    st.nn = c.a > 200 ? 3 : c.a > 100 ? 2 : 1;
    const rest = c.a - st.nn;
    st.al = c.a >= 225 ? Math.round(95 + (c.a - 236) * 0.9) : Math.floor(rest / 2);
    st.zl = Math.max(1, Math.round(st.al * c.z / c.a));
  }
  function update() {
    const c = compound();
    zS.max = Math.max(1, Math.floor(c.z / 2)); st.zl = clamp(st.zl, 1, +zS.max);
    nS.max = Math.min(10, Math.max(0, c.a - c.z - 1));
    st.nn = clamp(st.nn, 0, +nS.max);
    const zh = c.z - st.zl;
    aS.min = st.zl; aS.max = Math.max(st.zl, c.a - st.nn - zh);
    st.al = clamp(st.al, +aS.min, +aS.max);
    zS.value = st.zl; aS.value = st.al; nS.value = st.nn; eS.value = Math.round((Math.log10(Math.max(st.E, 1e-8)) + 8) * 100);
    const ah = c.a - st.nn - st.al;
    zV.textContent = `${st.zl} (${byZ[st.zl]?.name || ''})`; aV.textContent = String(st.al); nV.textContent = String(st.nn);
    eV.textContent = st.sf ? 'none (spontaneous)' : fmtE(st.E);
    // masses (measured, or liquid-drop estimate for unknown nuclei)
    const mT = atomicMass(st.target.z, st.target.a), mL = atomicMass(st.zl, st.al), mH = atomicMass(zh, ah);
    const measured = mT.measured && mL.measured && mH.measured;
    const Q = ((mT.m + (st.sf ? 0 : M_N)) - mL.m - mH.m - st.nn * M_N) * U;
    const Sn = st.sf ? 0 : sepN(c.z, c.a);
    const Ex = Sn + (st.sf ? 0 : st.E);
    const Bf = fissionBarrier(c.z, c.a);
    const L = nuc(st.zl, st.al), Hh = nuc(zh, ah);
    const labL = L ? L.label : `${byZ[st.zl].sym}-${st.al}`, labH = zh >= 1 && byZ[zh] ? (Hh ? Hh.label : `${byZ[zh].sym}-${ah}`) : '?';
    eq.innerHTML = (st.sf ? '' : 'n <span class="op">+</span> ') + nuclideLabelHTML(st.target) + ' <span class="op">→</span> ' + (L ? nuclideLabelHTML(L) : labL) + ' <span class="op">+</span> ' + (Hh ? nuclideLabelHTML(Hh) : labH) + (st.nn ? ` <span class="op">+</span> ${st.nn} n` : '') + ` <span class="q">${Q >= 0 ? '+' : ''}${Q.toFixed(1)} MeV</span>`;
    const coul = 1.44 * st.zl * zh / (1.2 * (Math.cbrt(st.al) + Math.cbrt(Math.max(ah, 1))) + 2);
    const perKg = Q * J_PER_MEV / (mT.m * KG_PER_U);
    // what happens
    let anim = 'fission', t0, x0, caption = '';
    const E = st.sf ? 0 : st.E;
    if (E > 1e5) { anim = 'shower'; t0 = 'Hadronic cascade'; x0 = `At ${fmtE(E)} the neutron does not split the nucleus neatly: it smashes through it, knocking out protons, neutrons and pions that hit more nuclei in a growing cascade. ${E > 1e8 ? 'In the atmosphere, cosmic rays of this energy make air showers of billions of particles.' : ''}`; caption = 'cascade of secondary particles'; }
    else if (E > 150) { anim = 'shatter'; t0 = 'Spallation with fission'; x0 = `At ${fmtE(E)} the neutron knocks out about ${Math.round(Math.min(40, st.target.a * 0.1))} nucleons (spallation). The hot remnant then often fissions. Spallation sources use exactly this to make neutrons.`; caption = 'spallation'; }
    else if (st.sf) {
      const sfBranch = st.target.dm?.includes('SF');
      if (Bf < 0.5) { t0 = 'Splits instantly'; x0 = 'There is no fission barrier: the nucleus cannot hold together and falls apart immediately.'; }
      else if (sfBranch || st.forced) { t0 = sfBranch ? 'Spontaneous fission' : 'Forced split'; x0 = sfBranch ? `${st.target.label} really does split on its own by quantum tunnelling through its ~${Bf.toFixed(1)} MeV barrier.` : `In reality ${st.target.label} never splits on its own: it would have to tunnel through a ~${Bf.toFixed(0)} MeV barrier. If it did, the energy balance would be ${Q >= 0 ? 'a release of' : 'a cost of'} ${Math.abs(Q).toFixed(1)} MeV.`; }
      else { anim = 'none'; t0 = 'It does not split on its own'; x0 = `A ~${Bf.toFixed(0)} MeV fission barrier holds ${st.target.label} together; tunnelling through it would take far longer than the age of the universe. Press "Force it to split anyway" to see the split.`; }
    } else if (Ex >= Bf || st.forced) {
      t0 = st.forced && Ex < Bf ? 'Forced split' : 'Fission';
      x0 = `The neutron adds ${Ex.toFixed(1)} MeV of excitation (${Sn.toFixed(1)} MeV binding plus its ${fmtE(E)} of motion)${Ex >= Bf ? `, above the ~${Bf.toFixed(1)} MeV fission barrier, so the nucleus stretches and splits` : `, below the ~${Bf.toFixed(1)} MeV barrier. It would really just capture the neutron; this is what a forced split would look like`}. ${Q >= 0 ? `It releases ${Q.toFixed(1)} MeV.` : `Splitting costs ${Math.abs(Q).toFixed(1)} MeV: only possible with enough energy brought in.`}`;
    } else {
      anim = 'capture'; t0 = 'Neutron capture, no fission';
      x0 = `The neutron brings only ${Ex.toFixed(1)} MeV of excitation, below the ~${Bf.toFixed(1)} MeV fission barrier. The nucleus absorbs it and becomes ${byZ[c.z].sym}-${c.a}, releasing a gamma ray. About ${Math.max(0, Bf - Sn).toFixed(1)} MeV of neutron energy would be needed to split it.`;
    }
    title.textContent = t0; text.textContent = x0;
    st.forced = false;
    const fuel = FUELS.find(f => f.l === st.target.label);
    note.hidden = !fuel; if (fuel) note.textContent = fuel.note;
    stats.replaceChildren(
      s('Energy of the split (Q)', `${Q >= 0 ? '+' : ''}${Q.toFixed(1)} MeV${measured ? '' : ' (estimate)'}`), s('Excitation energy', st.sf ? '—' : `${Ex.toFixed(2)} MeV`), s('Fission barrier', `~${Bf.toFixed(1)} MeV`),
      s('Fissility Z²/A', ((c.z * c.z / c.a) / 50.88).toFixed(3)), s('Coulomb push at split', `${coul.toFixed(0)} MeV`), s('Per kg of fuel', Q > 0 ? `${sci(perKg, 3)} J` : '—'), s('Equal to TNT', Q > 0 ? `${fmt(perKg / 4.184e12, 3)} kt per kg` : '—'));
    frags.replaceChildren(fragCard(L, labL), fragCard(Hh, labH));
    drawYield();
    curve.mark([{ label: st.target.label, color: '#8fdcff' }, ...(L ? [{ label: L.label, color: '#7cf29a' }] : []), ...(Hh ? [{ label: Hh.label, color: '#7cf29a' }] : [])]);
    R = { anim, L: { a: st.al, label: labL }, H: { a: ah, label: labH }, caption };
  }
  function run() {
    if (!R) return;
    const c = compound();
    if (R.anim === 'none') { ev.show({ kind: 'nuclear', anim: 'bounce', a1: 1, a2: st.target.a, label2: st.target.label, lepton1: false }); return; }
    if (R.anim === 'capture') { ev.show({ kind: 'nuclear', anim: 'capture', a1: 1, a2: st.target.a, product: [{ a: c.a, label: `${byZ[c.z].sym}-${c.a}` }], productLabels: [`${byZ[c.z].sym}-${c.a}`], label1: 'n', label2: st.target.label }); return; }
    if (R.anim === 'shower' || R.anim === 'shatter') { ev.show({ kind: 'nuclear', anim: R.anim, a1: 1, a2: st.target.a, fragments: [R.L, R.H].filter(x => x.a > 0), caption: R.caption, label1: 'n', label2: st.target.label }); return; }
    ev.show({ kind: 'nuclear', anim: 'fission', a1: st.sf ? st.target.a : 1, a2: st.target.a, product: [R.L, R.H], nFree: st.nn, caption: `${R.L.label} + ${R.H.label} + ${st.nn} n`, label1: st.sf ? '' : 'n', label2: st.target.label });
  }
  function fragCard(r, lab) {
    if (!r) return h('div', { class: 'card stack', style: { padding: '12px', gap: '6px' } }, h('b', {}, lab), h('div', { class: 'small muted' }, 'Never observed: too far from stability to exist, so its mass is a liquid-drop estimate.'));
    const ch = decayChain(r), steps = ch.length - 1, end = ch[ch.length - 1].r;
    const txt = r.hl === -1 ? 'Stable fragment.' : r.hl == null ? 'Very short-lived: beta-decays within a fraction of a second. Neutron-rich fragments are why spent fuel is so radioactive.' : `${steps} decay${steps === 1 ? '' : 's'} to stable ${end?.label || '?'}.`;
    return h('button', { class: 'card stack', style: { padding: '12px', gap: '6px', textAlign: 'left', color: 'inherit', cursor: 'pointer' }, onclick: () => openElement?.(byZ[r.z]) },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { style: { fontSize: '24px' }, html: nuclideLabelHTML(r) }), h('b', {}, r.hl === -1 ? 'stable' : r.hl == null ? '< 1 s' : fmtTime(r.hl))),
      h('div', { class: 'small muted' }, txt),
      h('div', { class: 'small muted' }, ch.slice(0, 7).map(x => x.r?.label || 'SF').join(' → ') + (ch.length > 7 ? ' → …' : '')));
  }
  function drawYield() {
    const ctx = yieldCv.getContext('2d'); const { w, h: H } = fitCanvas(yieldCv, ctx);
    ctx.fillStyle = SCREEN(); ctx.fillRect(0, 0, w, H);
    const c = compound(), lo = Math.floor(c.a * 0.2), hi = Math.ceil(c.a * 0.8);
    const X = A => 38 + (A - lo) / Math.max(1, hi - lo) * (w - 50), Y = y => H - 24 - (Math.log10(y) + 2) / 3 * (H - 38);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = 'rgba(210,210,220,.7)'; ctx.font = '600 11px "Source Sans 3", system-ui, sans-serif';
    for (const y of [0.01, 0.1, 1, 10]) { ctx.beginPath(); ctx.moveTo(38, Y(y)); ctx.lineTo(w, Y(y)); ctx.stroke(); ctx.fillText(y + '%', 2, Y(y) + 4); }
    const step = Math.max(5, Math.round((hi - lo) / 6 / 5) * 5);
    for (let A = Math.ceil(lo / step) * step; A <= hi; A += step) ctx.fillText(String(A), X(A) - 8, H - 7);
    ctx.strokeStyle = '#6ee7a8'; ctx.lineWidth = 2; ctx.beginPath();
    for (let A = lo; A <= hi; A++) { const y = Y(yieldCurve(A, c.a)); A === lo ? ctx.moveTo(X(A), y) : ctx.lineTo(X(A), y); }
    ctx.stroke(); ctx.lineWidth = 1;
    for (const A of [st.al, c.a - st.al - st.nn]) { ctx.fillStyle = '#f2b84b'; ctx.beginPath(); ctx.arc(X(A), Y(yieldCurve(A, c.a)), 5, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(210,210,220,.8)'; ctx.fillText('How often each fragment mass appears', 42, 14);
  }
  zS.addEventListener('input', () => { st.zl = +zS.value; const c = compound(); st.al = Math.round(st.zl * c.a / c.z); update(); });
  aS.addEventListener('input', () => { st.al = +aS.value; update(); });
  nS.addEventListener('input', () => { st.nn = +nS.value; update(); });
  for (const x of [zS, aS, nS]) x.addEventListener('change', run);
  eS.addEventListener('input', () => { st.E = Math.pow(10, eS.value / 100 - 8); update(); });
  eS.addEventListener('change', run);

  const fuelTabs = h('div', { class: 'tabs' }, FUELS.map((f, i) => h('button', { class: i ? '' : 'on', onclick: e => { for (const b of fuelTabs.children) b.classList.remove('on'); e.currentTarget.classList.add('on'); st.target = findNuclide(f.l); tBtn.set(st.target); st.sf = !!f.sf; for (const b of modeSeg.children) b.classList.toggle('on', (b.dataset.k === 'sf') === st.sf); st.E = f.E || st.E; [st.zl, st.al, st.nn] = f.split; update(); run(); } }, f.l)));
  const marks = h('div', { class: 'marks' }, E_MARKS.map(([l, v]) => h('button', { onclick: () => { st.E = v; update(); run(); } }, l)));
  const reactor = chainReactor();

  root.append(h('div', { class: 'lab' },
    h('div', { class: 'lab-head' }, h('div', {},
      h('div', { class: 'eyebrow' }, 'Fission Lab'),
      h('h1', {}, 'Split any nucleus'),
      h('p', {}, 'In 1938 Hahn, Strassmann, Meitner and Frisch found that uranium hit by a neutron splits in two. Here you can try any element, any isotope, any neutron energy and any way of splitting it. Energies come from measured masses, or from the liquid-drop model for nuclei never observed.'))),
    h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Quick picks:'), fuelTabs),
    h('div', { class: 'grid2' },
      h('div', { class: 'stack' }, ev.root, h('div', { class: 'card stack' }, eq, title, text, note, stats, frags)),
      h('div', { class: 'stack mobile-first' },
        h('div', { class: 'card stack' }, h('h3', {}, 'Your experiment'),
          h('div', { class: 'field' }, h('label', {}, 'Nucleus to split'), tBtn.root),
          h('div', { class: 'field' }, h('label', {}, 'How'), modeSeg),
          h('div', { class: 'field' }, h('label', { for: 'fis-e' }, 'Neutron energy', eV), eS, marks),
          h('div', { class: 'field' }, h('label', { for: 'fis-z' }, 'Light fragment: protons', zV), zS),
          h('div', { class: 'field' }, h('label', { for: 'fis-a' }, 'Light fragment: mass number', aV), aS),
          h('div', { class: 'field' }, h('label', { for: 'fis-n' }, 'Free neutrons released', nV), nS),
          h('div', { class: 'row' }, h('button', { class: 'btn primary big', onclick: run }, 'Split it'), forceBtn),
          h('div', { class: 'canvas-box', style: { height: '160px' } }, yieldCv)),
        h('div', { class: 'card stack' }, h('h3', {}, 'Binding energy'), curve.root))),
    h('div', { class: 'card stack' }, h('h3', {}, 'Chain reaction reactor'), reactor.root)));

  update();
  return {
    show() { ev.start(); run(); requestAnimationFrame(() => { curve.draw(); drawYield(); }); reactor.start(); },
    hide() { ev.stop(); reactor.stop(); },
  };
}

function s(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v)); }
const st = s;

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
    g.fillStyle = SCREEN(); g.fillRect(0, 0, G.w, G.h);
    const mx = Math.max(10, ...hist);
    g.strokeStyle = '#ffd27a'; g.lineWidth = 2; g.beginPath();
    hist.forEach((v, i) => { const x = (i / 300) * G.w, y = G.h - 16 - (v / mx) * (G.h - 26); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.fillStyle = '#8f97ba'; g.font = '10px "Source Sans 3", system-ui, sans-serif'; g.fillText('fissions per second', 6, 12);
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
