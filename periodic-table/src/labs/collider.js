import { h, fmt, sci, fitCanvas, clamp, rand } from '../util.js';
import { findNuclide, byZ } from '../store.js';
import { nuclideLabelHTML } from '../nuclear.js';
import { nucleus } from '../originAnim.js';
import { nuclidePicker } from './shared.js';
import { particle, kinematics, sliderToBeta, betaToSlider, betaFromKE, machine, collision, outcome, fmtE, C } from './colliderPhysics.js';

const KINDS = [['e-', 'e⁻'], ['e+', 'e⁺'], ['p', 'p'], ['pbar', 'p̄'], ['n', 'n'], ['ion', 'Nucleus']];

const PRESETS = [
  { name: 'LHC proton collisions', sub: '6.8 TeV + 6.8 TeV, 27 km ring', beam: 'p', target: 'p', mode: 'collider', type: 'ring', L: 26659, KE: 6.8e6 },
  { name: 'LHC lead-lead', sub: 'quark-gluon plasma, 2.68 TeV/nucleon', beam: 'ion', bn: 'Pb-208', target: 'ion', tn: 'Pb-208', mode: 'collider', type: 'ring', L: 26659, KEu: 2.68e6 },
  { name: 'RHIC gold-gold', sub: '100 GeV/nucleon, 3.8 km ring', beam: 'ion', bn: 'Au-197', target: 'ion', tn: 'Au-197', mode: 'collider', type: 'ring', L: 3834, KEu: 1e5 },
  { name: 'LEP Z factory', sub: 'e⁺e⁻ at the Z boson peak', beam: 'e-', target: 'e+', mode: 'collider', type: 'ring', L: 26659, KE: 45594 },
  { name: 'SLAC finds quarks (1968)', sub: '20 GeV electrons on protons', beam: 'e-', target: 'p', mode: 'fixed', type: 'linac', L: 3200, KE: 20000 },
  { name: 'Making tennessine (2010)', sub: 'Ca-48 beam on berkelium-249', beam: 'ion', bn: 'Ca-48', target: 'ion', tn: 'Bk-249', mode: 'fixed', type: 'ring', L: 30, KEu: 5.3 },
  { name: 'Rutherford\'s gold foil (1909)', sub: '5 MeV alpha particles on gold', beam: 'ion', bn: 'He-4', target: 'ion', tn: 'Au-197', mode: 'fixed', type: 'linac', L: 2, KE: 5 },
  { name: 'Splitting lithium (1932)', sub: '0.4 MeV protons on Li-7', beam: 'p', target: 'ion', tn: 'Li-7', mode: 'fixed', type: 'linac', L: 2, KE: 0.4 },
  { name: 'Neutron activation', sub: 'slow neutrons on cobalt-59', beam: 'n', target: 'ion', tn: 'Co-59', mode: 'fixed', type: 'linac', L: 10, KE: 0.025e-6 },
  { name: 'Spallation source', sub: '1 GeV protons on mercury', beam: 'p', target: 'ion', tn: 'Hg-202', mode: 'fixed', type: 'linac', L: 335, KE: 1000 },
  { name: 'Antiproton annihilation', sub: 'p̄ on protons, 100 MeV', beam: 'pbar', target: 'p', mode: 'fixed', type: 'ring', L: 188, KE: 100 },
  { name: 'Try for element 120', sub: 'Ti-50 on californium-249', beam: 'ion', bn: 'Ti-50', target: 'ion', tn: 'Cf-249', mode: 'fixed', type: 'ring', L: 60, KEu: 5.6 },
];

export function buildCollider(root, { openElement }) {
  const st = { beam: 'p', target: 'ion', bn: findNuclide('Pb-208'), tn: findNuclide('Au-197'), mode: 'fixed', type: 'linac', L: 100, beta: 0.4 };
  let result = null, kin = null;

  const beamSeg = seg(KINDS, st.beam, k => { st.beam = k; bPick.root.hidden = k !== 'ion'; update(); });
  const tgtSeg = seg(KINDS, st.target, k => { st.target = k; tPick.root.hidden = k !== 'ion'; update(); });
  const modeSeg = seg([['fixed', 'Fixed target'], ['collider', 'Head-on collider']], st.mode, k => { st.mode = k; update(); });
  const typeSeg = seg([['linac', 'Linear (straight)'], ['ring', 'Ring (synchrotron)']], st.type, k => { st.type = k; update(); });
  const bPick = nuclidePicker('col-beam-nuc', st.bn.label, r => { st.bn = r; update(); });
  const tPick = nuclidePicker('col-tgt-nuc', st.tn.label, r => { st.tn = r; update(); });
  bPick.root.hidden = true;
  const lenS = h('input', { type: 'range', id: 'col-len', min: 0, max: 1000, value: 400 });
  const spdS = h('input', { type: 'range', id: 'col-speed', min: 0, max: 1000, value: betaToSlider(st.beta) });
  const lenV = h('b'), spdV = h('b');
  const keIn = h('input', { type: 'number', id: 'col-ke', step: 'any', min: '0' });
  const keUnit = h('select', { id: 'col-ke-unit', style: { width: 'auto' } }, [['eV', 1e-6], ['keV', 1e-3], ['MeV', 1], ['GeV', 1e3], ['TeV', 1e6]].map(([l, v]) => h('option', { value: v, selected: l === 'MeV' }, l)));
  lenS.addEventListener('input', () => { st.L = Math.pow(10, lenS.value / 200); update(); });
  spdS.addEventListener('input', () => { st.beta = sliderToBeta(+spdS.value); update(); });
  const applyKE = () => { const P = beamP(); const ke = +keIn.value * +keUnit.value; if (ke > 0) { st.beta = Math.min(1 - 1e-15, betaFromKE(P, ke)); spdS.value = betaToSlider(st.beta); update(true); } };
  keIn.addEventListener('change', applyKE); keUnit.addEventListener('change', applyKE);

  const accCv = h('canvas', { 'aria-label': 'Accelerator animation' });
  const evCv = h('canvas', { 'aria-label': 'Collision event display' });
  const title = h('h2', { style: { fontSize: '20px' } });
  const text = h('p', { class: 'prose', style: { margin: 0 } });
  const beamStats = h('div', { class: 'stat-grid' });
  const machStats = h('div', { class: 'stat-grid' });
  const colStats = h('div', { class: 'stat-grid' });
  const chanBox = h('div', {});
  const prodBox = h('div', { class: 'stack', style: { gap: '8px' } });
  const readout = h('div', {});
  const warnBox = h('p', { class: 'warn', hidden: true });
  const goBtn = h('button', { class: 'btn primary', style: { fontSize: '15px', padding: '10px 18px' }, onclick: () => run() }, '⚡ Accelerate & collide');

  const beamP = () => particle(st.beam, st.bn);
  const tgtP = () => particle(st.target, st.tn);

  function update(fromKE) {
    const P = beamP(), T = tgtP();
    kin = kinematics(P, st.beta);
    const kT = st.mode === 'collider' ? kinematics(T, st.beta) : kinematics(T, 0);
    lenS.value = Math.round(Math.log10(st.L) * 200);
    lenV.textContent = st.L >= 1000 ? `${fmt(st.L / 1000, 3)} km` : `${fmt(st.L, 3)} m`;
    spdV.textContent = `${pctC(st.beta)} of light speed`;
    if (!fromKE) { const [v, u] = bestUnit(kin.KE); keIn.value = v; keUnit.value = u; }
    const M = machine(P, kin, st.type, st.L);
    const col = collision(P, kin, T, kT, st.mode);
    result = outcome(P, kin, T, kT, st.mode, col);
    result.P = P; result.T = T; result.col = col; result.M = M;

    beamStats.replaceChildren(
      s('Speed', `${pctC(st.beta)} c`), s('Speed', `${sci(kin.v, 4)} m/s`), s('Lorentz factor γ', fmt(kin.gamma, 5)),
      s('Kinetic energy', fmtE(kin.KE)), P.A > 1 ? s('Per nucleon', fmtE(kin.KEperA)) : s('Total energy', fmtE(kin.E)),
      s('Momentum', `${fmtE(kin.p)}/c`), s('Quantum wavelength', lamStr(kin.lambda)),
      s('Time to cross machine', timeStr(st.L / kin.v)), s('Its own clock (time dilation)', timeStr(st.L / kin.v / kin.gamma)),
      s('Mass increase', `${fmt(kin.gamma, 4)}× rest mass`));
    if (M.neutral) {
      machStats.replaceChildren(s('Accelerator', 'cannot push a neutral particle'));
      warnBox.hidden = false;
      warnBox.textContent = `${P.name}s have no electric charge, so no electric or magnetic field can accelerate or steer them. Real neutron beams come from reactors or spallation sources, then are slowed or selected by speed. We simply give the neutron the speed you chose.`;
    } else {
      warnBox.hidden = !(M.ok === false);
      warnBox.textContent = M.ok === false ? `Not buildable as set: ${M.feasible}. Try a longer machine or a lower speed.` : '';
      machStats.replaceChildren(...(st.type === 'linac'
        ? [s('Total voltage', `${fmtV(M.voltage)}`), s('Field gradient', `${fmt(M.gradient, 3)} MV/m`), s('Technology', M.feasible), s('Particle charge', `${P.q > 0 ? '+' : ''}${P.q}`)]
        : [s('Ring circumference', `${fmt(st.L, 4)} m`), s('Bending magnets', `${fmt(M.B, 3)} tesla`), s('Technology', M.feasible), s('Laps to reach speed', fmt(Math.round(M.turns), 4)), s('Time to accelerate', timeStr(M.time)), s('One lap takes', timeStr(M.rev)), s('Laps per second', fmt(1 / M.rev, 4)), s('Radiation loss per lap', fmtE(M.u0))]));
    }
    colStats.replaceChildren(
      s('Collision energy √s', fmtE(col.sqrtS)), s('Free energy (CM)', fmtE(col.Ecm)),
      col.sqrtSNN ? s('Per nucleon pair √sNN', fmtE(col.sqrtSNN)) : s('Mode', st.mode === 'fixed' ? 'fixed target' : 'head-on'),
      s('Energy wasted in fixed target', st.mode === 'fixed' ? `${fmt(100 * (1 - col.Ecm / Math.max(kin.KE, 1e-12)), 3)}%` : '0% (head-on)'));
    title.textContent = result.title;
    text.textContent = result.text;
    chanBox.replaceChildren(result.channels.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', {}, 'Quantity / process'), h('th', {}, 'Value'))),
      h('tbody', {}, result.channels.map(c => h('tr', {}, h('td', {}, c[0]), h('td', { class: 'mono' }, c[2] || fmtE(c[1]))))))) : '');
    prodBox.replaceChildren();
    const prods = result.product || [];
    if (prods.length || result.fragments?.length || result.newElement) {
      prodBox.append(h('h3', {}, 'What was made'));
      if (result.newElement) prodBox.append(h('div', { class: 'note' }, `Element ${result.newElement} does not exist yet. You would be the discoverer!`));
      for (const r of [...prods, ...(result.fragments || [])]) {
        prodBox.append(h('button', { class: 'src-btn', style: { '--c': r.hl === -1 ? '#e9ecf8' : '#ffd27a' }, onclick: () => openElement(byZ[r.z]) },
          h('span', { class: 'dot' }), h('span', { html: `${nuclideLabelHTML(r)} <span class="muted" style="font-size:12px">${byZ[r.z].name}-${r.a}</span>` }),
          h('span', { class: 'n' }, r.hl === -1 ? 'stable' : r.hl ? `t½ ${hl(r.hl)}` : 'short-lived')));
      }
      if (result.productLabels) prodBox.append(h('div', { class: 'mono small muted' }, `Products: ${result.productLabels.join(' + ')}`));
    }
    readout.replaceChildren();
    if (result.view === 'detector') buildEvent();
    evT = 0; accT = 0; phase = 'idle';
  }

  // ----- event generation -----
  let tracks = [], evT = 0, accT = 0, phase = 'idle';
  function buildEvent() {
    const r = result, n = Math.min(r.nch || 0, 380);
    tracks = [];
    const species = [['π', 0.1396, 0.78], ['K', 0.4937, 0.12], ['p', 0.938, 0.07], ['e', 0.000511, 0.02], ['μ', 0.1057, 0.01]];
    for (let i = 0; i < n; i++) {
      let x = Math.random(), sp = species[0];
      for (const s0 of species) { if (x < s0[2]) { sp = s0; break; } x -= s0[2]; }
      const pt = -Math.log(1 - Math.random() * 0.999) * (r.qgp ? 0.6 : 0.45) + 0.05;
      tracks.push({ kind: 'trk', q: Math.random() < 0.5 ? 1 : -1, pt, phi: rand(0, Math.PI * 2), eta: rand(-2.5, 2.5), name: sp[0], m: sp[1] });
    }
    const nNeutral = Math.round(n * 0.4);
    for (let i = 0; i < Math.min(nNeutral, 120); i++) tracks.push({ kind: Math.random() < 0.7 ? 'gam' : 'nh', pt: -Math.log(Math.random()) * 0.4 + 0.1, phi: rand(0, Math.PI * 2), eta: rand(-2.5, 2.5), name: 'γ' });
    const sq = r.col.sqrtS / 1000;
    const hard = r.hard || [];
    let phi0 = rand(0, Math.PI * 2);
    hard.forEach((k, i) => {
      const phi = phi0 + (i % 2 ? Math.PI + rand(-0.3, 0.3) : rand(-0.3, 0.3)) + Math.floor(i / 2) * 1.3;
      const pt = Math.min(sq / 2.2, 20 + Math.random() * Math.min(80, sq / 4));
      if (k === 'mu') tracks.push({ kind: 'mu', q: i % 2 ? 1 : -1, pt, phi, eta: rand(-1, 1), name: 'μ', m: 0.1057 });
      if (k === 'e') tracks.push({ kind: 'trk', q: -1, pt, phi, eta: rand(-1, 1), name: 'e', m: 0.000511, hard: true });
      if (k === 'gamma') tracks.push({ kind: 'gam', pt: Math.max(30, pt), phi, eta: rand(-1, 1), name: 'γ', hard: true });
      if (k === 'jet') {
        tracks.push({ kind: 'jet', pt, phi, eta: rand(-1.5, 1.5), name: 'jet' });
        for (let j = 0; j < 8; j++) tracks.push({ kind: 'trk', q: Math.random() < 0.5 ? 1 : -1, pt: pt / 8 * rand(0.5, 1.5), phi: phi + rand(-0.15, 0.15), eta: 0, name: 'π', m: 0.1396 });
      }
    });
    const top = tracks.filter(t => t.kind !== 'nh').sort((a, b) => b.pt - a.pt).slice(0, 12);
    const nAll = (r.nch || 0);
    readout.replaceChildren(
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', {}, 'Detector readout'), h('span', { class: 'mono small muted' }, `${nAll.toLocaleString()} charged tracks${nAll > n ? ` (${n} drawn)` : ''}`)),
      top.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Particle'), h('th', { class: 'num' }, 'Charge'), h('th', { class: 'num' }, 'pT (GeV/c)'), h('th', { class: 'num' }, 'η'), h('th', { class: 'num' }, 'φ (°)'), h('th', { class: 'num' }, 'Energy (GeV)'))),
        h('tbody', {}, top.map(t => {
          const p = t.pt * Math.cosh(t.eta), E = Math.sqrt(p * p + (t.m || 0) ** 2);
          return h('tr', {}, h('td', {}, t.kind === 'jet' ? 'jet (quark/gluon)' : t.kind === 'gam' ? 'photon γ' : t.kind === 'mu' ? `muon μ${t.q > 0 ? '⁺' : '⁻'}` : `${t.name}${t.q > 0 ? '⁺' : '⁻'}`),
            h('td', { class: 'num' }, t.q ? (t.q > 0 ? '+1' : '−1') : '0'), h('td', { class: 'num' }, t.pt.toFixed(2)), h('td', { class: 'num' }, t.eta.toFixed(2)), h('td', { class: 'num' }, ((t.phi * 180 / Math.PI) % 360).toFixed(0)), h('td', { class: 'num' }, E.toFixed(2)));
        })))) : h('p', { class: 'muted small' }, 'Only photons: nothing charged to track.'),
      ...(result.notes || []).map(n0 => h('p', { class: 'hint-text' }, n0)),
      h('p', { class: 'hint-text', style: { margin: 0 } }, 'Simulated event with realistic scales: charged tracks curl in a 3.8 tesla field (like CMS), photons deposit energy in the electromagnetic calorimeter, muons pierce everything. Individual particles are randomly generated.'));
  }

  // ----- animations -----
  let raf = 0, last = 0;
  function run() { phase = 'acc'; accT = 0; evT = 0; if (innerWidth < 1000) accCv.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!accCv.offsetParent) return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    if (phase === 'acc') { accT += dt; if (accT > 2.6) { phase = 'hit'; evT = 0; } }
    else if (phase === 'hit') evT += dt;
    drawAcc(dt); drawEvent(dt);
  }
  function drawAcc() {
    const ctx = accCv.getContext('2d'); const { w, h: H } = fitCanvas(accCv, ctx);
    ctx.fillStyle = '#030409'; ctx.fillRect(0, 0, w, H);
    const f = phase === 'acc' ? clamp(accT / 2.4, 0, 1) : phase === 'hit' ? 1 : 0;
    const b = phase === 'idle' ? 0 : f * st.beta, g = 1 / Math.sqrt(1 - b * b);
    const col = result?.P?.q === 0 ? '#9aa2b8' : '#8fdcff';
    if (st.type === 'linac') {
      const y = H / 2, x0 = 30, x1 = w - 60;
      ctx.fillStyle = 'rgba(166,176,200,.12)'; ctx.fillRect(x0, y - 14, x1 - x0, 28);
      for (let i = 0; i < 14; i++) { const x = x0 + (i + 0.5) * (x1 - x0) / 14; ctx.fillStyle = `rgba(255,210,122,${0.25 + 0.5 * ((Math.sin(accT * 20 - i) + 1) / 2) * (phase === 'acc' ? 1 : 0.3)})`; ctx.fillRect(x - 10, y - 18, 20, 36); }
      const px = x0 + (x1 - x0) * Math.pow(f, 2);
      for (let k = 0; k < 8; k++) glow(ctx, px - k * 6 * f, y, 9 - k, col, 1 - k * 0.12);
      ctx.fillStyle = '#e9ecf8'; ctx.fillRect(x1 + 10, y - 22, 8, 44);
      label(ctx, st.mode === 'fixed' ? 'target' : 'collision point', x1 + 14, y + 38);
      label(ctx, `linac · ${lenV.textContent}`, 30 + 60, 20);
    } else {
      const cx = w / 2, cy = H / 2 + 6, R = Math.min(w * 0.4, H * 0.36);
      ctx.strokeStyle = 'rgba(166,176,200,.35)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; ctx.fillStyle = 'rgba(92,200,240,.6)'; ctx.fillRect(cx + Math.cos(a) * R - 5, cy + Math.sin(a) * R - 5, 10, 10); }
      const ang = phase === 'idle' ? 0 : accT * (1 + f * 10);
      for (let k = 0; k < 10; k++) glow(ctx, cx + Math.cos(ang - k * 0.05) * R, cy + Math.sin(ang - k * 0.05) * R, 8 - k * 0.6, col, 1 - k * 0.09);
      if (st.mode === 'collider') for (let k = 0; k < 10; k++) glow(ctx, cx + Math.cos(-ang + k * 0.05 + Math.PI) * R, cy + Math.sin(-ang + k * 0.05 + Math.PI) * R, 8 - k * 0.6, '#ffb38a', 1 - k * 0.09);
      label(ctx, `ring · ${lenV.textContent}`, cx, cy + 4);
      if (result?.M?.turns && phase !== 'idle') label(ctx, `lap ${Math.round(f * result.M.turns).toLocaleString()}`, cx, cy + 22);
    }
    ctx.font = '600 13px "IBM Plex Mono", monospace'; ctx.fillStyle = '#ffd27a'; ctx.textAlign = 'left';
    ctx.fillText(`v = ${pctC(b)} c`, 12, H - 30);
    ctx.fillStyle = '#e9ecf8'; ctx.fillText(`γ = ${fmt(g, 4)}   E = ${fmtE((g - 1) * (result?.P?.mass || 1))}`, 12, H - 12);
  }
  function drawEvent() {
    const ctx = evCv.getContext('2d'); const { w, h: H } = fitCanvas(evCv, ctx);
    ctx.fillStyle = '#030409'; ctx.fillRect(0, 0, w, H);
    if (!result) return;
    if (phase !== 'hit') {
      ctx.font = '13px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#5b6284'; ctx.textAlign = 'center';
      ctx.fillText(phase === 'acc' ? 'accelerating…' : 'Press “Accelerate & collide”', w / 2, H / 2); ctx.textAlign = 'left';
      if (result.view === 'detector') drawDetector(ctx, w, H, 0);
      return;
    }
    if (result.view === 'detector') drawDetector(ctx, w, H, evT); else drawNuclear(ctx, w, H, evT);
  }
  function drawDetector(ctx, w, H, t) {
    const cx = w / 2, cy = H / 2, R = Math.min(w, H) * 0.47;
    const ring = (r0, r1, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, R * r1, 0, 7); ctx.arc(cx, cy, R * r0, 0, 7, true); ctx.fill(); };
    ring(0.5, 0.6, 'rgba(110,231,168,.08)'); ring(0.62, 0.8, 'rgba(92,200,240,.08)'); ring(0.81, 0.83, 'rgba(154,162,184,.25)');
    for (let i = 0; i < 12; i++) { ctx.strokeStyle = 'rgba(255,107,125,.2)'; ctx.lineWidth = R * 0.05; ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, i / 12 * Math.PI * 2 + 0.05, (i + 1) / 12 * Math.PI * 2 - 0.05); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(170,185,255,.12)'; ctx.lineWidth = 1; for (const r of [0.15, 0.3, 0.45]) { ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, 7); ctx.stroke(); }
    ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillStyle = '#5b6284';
    ctx.fillText('tracker', cx + 4, cy - R * 0.46); ctx.fillText('EM calorimeter', cx + 4, cy - R * 0.55); ctx.fillText('hadron calorimeter', cx + 4, cy - R * 0.72); ctx.fillText('muon chambers', cx + 4, cy - R * 0.95);
    if (!t) return;
    const grow = clamp(t / 0.8, 0, 1);
    if (t < 0.3) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.3); g.addColorStop(0, `rgba(255,255,255,${1 - t / 0.3})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, H); }
    const trackR = R * 0.5, scale = trackR / 1.2; // px per metre, tracker = 1.2 m
    ctx.lineWidth = 1.2;
    for (const tr of tracks) {
      if (tr.kind === 'trk' || tr.kind === 'mu') {
        const rad = (tr.pt / (0.3 * 3.8)) * scale; // radius of curvature in px
        const maxLen = tr.kind === 'mu' ? R * 0.98 : trackR;
        ctx.strokeStyle = tr.kind === 'mu' ? '#ff5f6d' : tr.hard ? '#ffffff' : tr.q > 0 ? 'rgba(143,220,255,.75)' : 'rgba(255,210,122,.75)';
        if (tr.kind === 'mu' || tr.hard) ctx.lineWidth = 2.4; else ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        const steps = 60; let x = cx, y = cy, phi = tr.phi;
        const ds = (maxLen * 1.6) / steps;
        for (let i = 0; i < steps * grow; i++) {
          phi += tr.q * ds / rad;
          x += Math.cos(phi) * ds; y += Math.sin(phi) * ds;
          const d = Math.hypot(x - cx, y - cy);
          if (tr.kind === 'trk' && d > trackR) break;
          if (d > maxLen) break;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (tr.kind === 'trk' && grow >= 1 && Math.hypot(x - cx, y - cy) > trackR * 0.95) { ctx.fillStyle = 'rgba(110,231,168,.7)'; const a = Math.atan2(y - cy, x - cx); ctx.fillRect(cx + Math.cos(a) * R * 0.52 - 2, cy + Math.sin(a) * R * 0.52 - 2, 4, 4); }
      } else if (tr.kind === 'gam') {
        ctx.setLineDash([3, 4]); ctx.strokeStyle = tr.hard ? '#ffe98a' : 'rgba(255,233,138,.25)'; ctx.lineWidth = tr.hard ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(tr.phi) * R * 0.5 * grow, cy + Math.sin(tr.phi) * R * 0.5 * grow); ctx.stroke(); ctx.setLineDash([]);
        if (grow >= 1) tower(ctx, cx, cy, R * 0.5, R * 0.6, tr.phi, Math.min(1, tr.pt / 40), '#6ee7a8');
      } else if (tr.kind === 'nh') {
        if (grow >= 1) tower(ctx, cx, cy, R * 0.62, R * 0.8, tr.phi, Math.min(1, tr.pt / 10), '#5cc8f0');
      } else if (tr.kind === 'jet') {
        ctx.fillStyle = 'rgba(255,210,122,.12)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 0.8 * grow, tr.phi - 0.25, tr.phi + 0.25); ctx.closePath(); ctx.fill();
        if (grow >= 1) tower(ctx, cx, cy, R * 0.62, R * 0.8, tr.phi, Math.min(1, tr.pt / 60), '#5cc8f0');
      }
    }
    if (result.qgp && t < 2) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.25); g.addColorStop(0, `rgba(255,120,60,${0.6 * (1 - t / 2)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, H); }
  }
  function tower(ctx, cx, cy, r0, r1, phi, f, c) {
    ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.globalAlpha = 0.3 + f * 0.7;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(phi) * r0, cy + Math.sin(phi) * r0); ctx.lineTo(cx + Math.cos(phi) * (r0 + (r1 - r0) * Math.max(0.15, f)), cy + Math.sin(phi) * (r0 + (r1 - r0) * Math.max(0.15, f))); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function drawNuclear(ctx, w, H, t) {
    const r = result, cx = w / 2, cy = H / 2, S = Math.min(w, H) * 0.03;
    const A1 = r.P.A || 1, A2 = r.T.A || 1;
    const draw1 = (x, y) => { if (r.P.lepton) { glow(ctx, x, y, 8, '#8fdcff', 1); } else if (A1 === 1) nucleus(ctx, x, y, 1, S * 0.9, r.P.q ? 2 : 3); else nucleus(ctx, x, y, Math.min(A1, 90), S * 0.9, 5); };
    const draw2 = (x, y) => { if (r.T.lepton) glow(ctx, x, y, 8, '#ffb38a', 1); else nucleus(ctx, x, y, Math.min(A2, 90), S * 0.9, 9); };
    const T0 = 1.0, k = Math.min(1, t / T0);
    const tx = r.T.lepton ? cx + 30 : cx;
    const approach = cx - w * 0.42 * (1 - k);
    const lbl = (s0, x, y) => label(ctx, s0, x, y);
    if (r.anim === 'deflect' || r.anim === 'bounce') {
      draw2(tx, cy);
      if (t < T0) { draw1(approach, cy - S * 3); }
      else {
        const f = t - T0, ang = r.anim === 'bounce' ? Math.PI * 0.7 : 0.9;
        draw1(cx + Math.cos(Math.PI - ang) * -f * w * 0.3, cy - S * 3 - Math.sin(ang) * f * H * 0.3);
        lbl(r.anim === 'bounce' ? 'bounces off' : 'deflected by repulsion', cx, H - 14);
      }
      return;
    }
    if (t < T0) { draw1(approach, cy); if (r.anim !== 'capture' || true) draw2(tx + (r.T.A && st.mode === 'collider' ? w * 0.42 * (1 - k) : 0), cy); return; }
    const f = t - T0;
    if (f < 0.35) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, H) * 0.35); g.addColorStop(0, `rgba(255,240,200,${1 - f / 0.35})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, H); }
    if (r.anim === 'fuse' || r.anim === 'capture') {
      const prods = r.productLabels || (r.product || []).map(p => p.label);
      const main = r.product?.[0];
      if (main) nucleus(ctx, cx, cy, Math.min(main.a, 90), S * 0.9, 13); else nucleus(ctx, cx, cy, Math.min(A1 + A2, 90), S * 0.9, 13);
      lbl(r.newElement ? `element ${r.newElement}?` : (main ? main.label : ''), cx, cy - S * Math.cbrt(Math.min(90, A1 + A2)) - 12);
      const extras = prods.slice(1);
      extras.forEach((p, i) => { const a = (i / Math.max(1, extras.length)) * Math.PI * 2 + 0.5, d = Math.min(w * 0.45, f * w * 0.25); const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.7; glow(ctx, x, y, 7, p === 'n' ? '#8aa4ff' : p === 'e+' ? '#ff6b8a' : '#ffd27a', 1); lbl(p, x, y - 10); });
      if (r.anim === 'capture' || prods.length <= 1) { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 40; i++) { const x = cx + 20 + f * w * 0.3 + i; const y = cy - 20 - (f * H * 0.2) + Math.sin(i * 0.8 + t * 20) * 4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); lbl('γ', cx + 40 + f * w * 0.3, cy - 30 - f * H * 0.2); }
    } else if (r.anim === 'fission') {
      const d = Math.min(w * 0.35, f * w * 0.2);
      nucleus(ctx, cx - d, cy, 45, S * 0.8, 17); nucleus(ctx, cx + d, cy, 60, S * 0.8, 19);
      (r.product || []).forEach((p, i) => lbl(p.label, i ? cx + d : cx - d, cy - S * 4.5));
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.8; glow(ctx, cx + Math.cos(a) * d * 1.8, cy + Math.sin(a) * d * 1.8, 6, '#8aa4ff', 1); }
      lbl('≈ 200 MeV released', cx, H - 14);
    } else if (r.anim === 'shatter') {
      const frs = r.fragments?.length ? r.fragments : [];
      const n = frs.length || 6;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + 0.3, d = Math.min(w * 0.42, f * w * 0.22 * (1 + (i % 3) * 0.3));
        const fr = frs[i];
        nucleus(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75, fr ? Math.min(fr.a, 50) : 4, S * 0.7, i + 3);
        if (fr) lbl(fr.label, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75 - 18);
      }
      for (let i = 0; i < 24; i++) { const a = i * 2.39, d = Math.min(w * 0.5, f * w * (0.3 + (i % 5) * 0.08)); glow(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75, 4, i % 2 ? '#ff5d5d' : '#8aa4ff', 0.9); }
    }
  }

  const presetList = h('div', { class: 'src-list' }, PRESETS.map(p => h('button', { class: 'src-btn', style: { '--c': '#8fdcff' }, onclick: () => loadPreset(p) }, h('span', { class: 'dot' }), h('span', {}, h('b', {}, p.name), h('span', {}, p.sub)), h('span', { class: 'n' }, '→'))));
  function loadPreset(p) {
    st.beam = p.beam; st.target = p.target; st.mode = p.mode; st.type = p.type; st.L = p.L;
    if (p.bn) { st.bn = findNuclide(p.bn); bPick.set(p.bn); }
    if (p.tn) { st.tn = findNuclide(p.tn); tPick.set(p.tn); }
    bPick.root.hidden = st.beam !== 'ion'; tPick.root.hidden = st.target !== 'ion';
    setSeg(beamSeg, st.beam); setSeg(tgtSeg, st.target); setSeg(modeSeg, st.mode); setSeg(typeSeg, st.type);
    const P = beamP();
    const ke = p.KE != null ? p.KE : p.KEu * P.A;
    st.beta = Math.min(1 - 1e-15, betaFromKE(P, ke)); spdS.value = betaToSlider(st.beta);
    update(); run();
    root.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  root.append(h('div', { class: 'lab' },
    h('div', { class: 'lab-head' }, h('div', {},
      h('div', { class: 'eyebrow' }, 'Particle Collider'),
      h('h1', {}, 'Build an accelerator, smash anything'),
      h('p', {}, 'Choose a projectile and a target, set the speed and the size of your machine, then collide. Kinematics are exact special relativity; outcomes follow a simplified physics model.'))),
    h('div', { class: 'grid2' },
      h('div', { class: 'stack' },
        h('div', { class: 'canvas-box', style: { height: '200px' } }, accCv),
        h('div', { class: 'canvas-box', style: { aspectRatio: '1.35', maxHeight: '560px' } }, evCv),
        h('div', { class: 'card stack' }, title, text, warnBox, prodBox, chanBox),
        h('div', { class: 'card stack' }, readout)),
      h('div', { class: 'stack mobile-first' },
        h('div', { class: 'card stack' },
          h('div', { class: 'field' }, h('label', {}, 'Projectile'), beamSeg, bPick.root),
          h('div', { class: 'field' }, h('label', {}, 'Target'), tgtSeg, tPick.root),
          h('div', { class: 'field' }, h('label', {}, 'Collision'), modeSeg),
          h('div', { class: 'field' }, h('label', {}, 'Machine'), typeSeg),
          h('div', { class: 'field' }, h('label', { for: 'col-len' }, 'Length', lenV), lenS),
          h('div', { class: 'field' }, h('label', { for: 'col-speed' }, 'Speed', spdV), spdS),
          h('div', { class: 'field' }, h('label', { for: 'col-ke' }, 'or kinetic energy'), h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, keIn, keUnit)),
          goBtn),
        h('div', { class: 'card' }, h('h3', {}, 'Famous experiments'), presetList),
        h('div', { class: 'card stack' }, h('h3', {}, 'Your beam'), beamStats),
        h('div', { class: 'card stack' }, h('h3', {}, 'Your machine'), machStats),
        h('div', { class: 'card stack' }, h('h3', {}, 'The collision'), colStats)))));

  update();
  return { show() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }, hide() { cancelAnimationFrame(raf); raf = 0; } };
}

function seg(items, cur, on) {
  const el = h('div', { class: 'seg' }, items.map(([k, l]) => h('button', { 'data-k': k, class: k === cur ? 'on' : '', onclick: () => { setSeg(el, k); on(k); } }, l)));
  return el;
}
function setSeg(el, k) { for (const b of el.children) b.classList.toggle('on', b.dataset.k === k); }
function s(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v', style: { fontSize: '14px' } }, String(v))); }
function glow(ctx, x, y, r, c, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
function label(ctx, t, x, y) { ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.fillStyle = '#e9ecf8'; ctx.textAlign = 'center'; ctx.fillText(t, x, y); ctx.textAlign = 'left'; }
function pctC(b) {
  if (b < 0.999) return `${(b * 100).toPrecision(4)}%`;
  const nines = Math.min(15, Math.floor(-Math.log10(1 - b)));
  return `${(b * 100).toFixed(Math.max(2, nines))}%`;
}
function bestUnit(mev) {
  const u = mev >= 1e6 ? 1e6 : mev >= 1e3 ? 1e3 : mev >= 1 ? 1 : mev >= 1e-3 ? 1e-3 : 1e-6;
  return [+(mev / u).toPrecision(5), u];
}
function lamStr(fm) {
  if (!isFinite(fm)) return '∞';
  if (fm < 1e3) return `${fmt(fm, 3)} fm`;
  if (fm < 1e6) return `${fmt(fm / 1e3, 3)} pm`;
  return `${fmt(fm / 1e6, 3)} nm`;
}
function timeStr(s) {
  if (!isFinite(s)) return '∞';
  if (s < 1e-9) return `${fmt(s * 1e12, 3)} ps`;
  if (s < 1e-6) return `${fmt(s * 1e9, 3)} ns`;
  if (s < 1e-3) return `${fmt(s * 1e6, 3)} µs`;
  if (s < 1) return `${fmt(s * 1e3, 3)} ms`;
  if (s < 3600) return `${fmt(s, 3)} s`;
  return `${fmt(s / 3600, 3)} h`;
}
function fmtV(mv) { return mv >= 1e6 ? `${fmt(mv / 1e6, 3)} TV` : mv >= 1e3 ? `${fmt(mv / 1e3, 3)} GV` : mv >= 1 ? `${fmt(mv, 3)} MV` : `${fmt(mv * 1e3, 3)} kV`; }
function hl(sec) { const y = sec / 31557600; return sec < 60 ? `${sec.toPrecision(2)} s` : sec < 86400 ? `${(sec / 3600).toPrecision(2)} h` : y < 1 ? `${(sec / 86400).toPrecision(2)} d` : y < 1e6 ? `${y.toPrecision(3)} y` : `${(y / 1e9).toPrecision(3)} Gy`; }
void C;
