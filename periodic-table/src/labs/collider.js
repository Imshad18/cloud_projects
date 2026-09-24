import { h, fmt, sci, fitCanvas, clamp, SCREEN, toast } from '../util.js';
import { findNuclide, byZ } from '../store.js';
import { nuclideLabelHTML } from '../nuclear.js';
import { nuclideButton } from '../chooser.js';
import { particle, kinematics, keFromBeta, machine, collision, outcome, whatIfFused, fmtE, OMG_MEV } from './colliderPhysics.js';
import { processes, softTracks, chargedMult, invMass, pT, poisson, expectedHist, gauss } from './events.js';
import { eventCanvas } from './eventView.js';
import { histChart, barChart } from './charts.js';
import { workspace, group, tabs } from './ui.js';

const MARKS = [
  ['Sun core', 1.3e-3], ['Rutherford 1909', 5], ['FRIB', 200], ['LHC proton', 6.8e6], ['Knee of cosmic rays', 3e9], ['OMG particle', OMG_MEV], ['10× OMG', OMG_MEV * 10],
];
const PRESETS = [
  { name: 'LHC proton collisions', sub: '6.8 + 6.8 TeV, 27 km ring', beam: 'p', target: 'p', mode: 'collider', type: 'ring', L: 26659, KE: 6.8e6 },
  { name: 'LHC lead-lead', sub: 'quark-gluon plasma, 2.68 TeV per nucleon', beam: 'Pb-208', target: 'Pb-208', mode: 'collider', type: 'ring', L: 26659, KEu: 2.68e6 },
  { name: 'Tevatron (top quark, 1995)', sub: 'proton on antiproton, 0.98 TeV each', beam: 'p', target: 'pbar', mode: 'collider', type: 'ring', L: 6280, KE: 9.8e5 },
  { name: 'LEP at the Z peak', sub: 'e⁺e⁻ at 45.6 GeV each', beam: 'e-', target: 'e+', mode: 'collider', type: 'ring', L: 26659, KE: 45594 },
  { name: 'Future Higgs factory', sub: 'e⁺e⁻ at 125 GeV each (FCC-ee)', beam: 'e-', target: 'e+', mode: 'collider', type: 'ring', L: 90700, KE: 125000 },
  { name: 'FCC-hh (100 TeV)', sub: 'proposed 91 km proton collider', beam: 'p', target: 'p', mode: 'collider', type: 'ring', L: 90700, KE: 5e7 },
  { name: 'SLAC finds quarks (1968)', sub: '20 GeV electrons on protons', beam: 'e-', target: 'p', mode: 'fixed', type: 'linac', L: 3200, KE: 20000 },
  { name: 'Making tennessine (2010)', sub: 'Ca-48 on berkelium-249', beam: 'Ca-48', target: 'Bk-249', mode: 'fixed', type: 'ring', L: 30, KEu: 5.3 },
  { name: 'Uranium on uranium (GSI)', sub: 'supercritical field search', beam: 'U-238', target: 'U-238', mode: 'fixed', type: 'ring', L: 216, KEu: 6 },
  { name: 'Rutherford\'s gold foil (1909)', sub: '5 MeV alpha particles on gold', beam: 'He-4', target: 'Au-197', mode: 'fixed', type: 'linac', L: 2, KE: 5 },
  { name: 'Splitting lithium (1932)', sub: '0.4 MeV protons on Li-7', beam: 'p', target: 'Li-7', mode: 'fixed', type: 'linac', L: 2, KE: 0.4 },
  { name: 'Neutron activation', sub: 'slow neutrons on cobalt-59', beam: 'n', target: 'Co-59', mode: 'fixed', type: 'linac', L: 10, KE: 0.025e-6 },
  { name: 'Spallation source', sub: '1 GeV protons on mercury', beam: 'p', target: 'Hg-202', mode: 'fixed', type: 'linac', L: 335, KE: 1000 },
  { name: 'OMG particle hits the air', sub: '3.2×10²⁰ eV proton on nitrogen', beam: 'p', target: 'N-14', mode: 'fixed', type: 'ring', L: 26659, KE: OMG_MEV },
  { name: 'Try for element 120', sub: 'Ti-50 on californium-249', beam: 'Ti-50', target: 'Cf-249', mode: 'fixed', type: 'ring', L: 60, KEu: 5.6 },
];
const SEARCHES = [
  ['Supersymmetric gluinos', '> 2.3 TeV'], ['Heavy Z′ bosons', '> 5.1 TeV'], ['Excited quarks', '> 6.7 TeV'], ['Leptoquarks', '> 1.8 TeV'],
  ['Microscopic black holes', '> 9 TeV'], ['Vector-like top partners', '> 1.5 TeV'], ['Extra charged Higgs bosons', 'excluded over wide ranges'], ['Dark matter mediators', 'depends on couplings'],
];
const DATA = [
  ['Proton-proton inelastic cross section', '13 TeV', '78.1 ± 2.9 mb', 'TOTEM 2019'],
  ['Proton-proton inelastic cross section', '57 TeV', '92 ± 14 mb', 'Pierre Auger (cosmic rays) 2012'],
  ['W → ℓν (W⁺ + W⁻)', '13 TeV', '20.6 nb', 'ATLAS 2016'],
  ['Z → ℓℓ', '13 TeV', '1.98 nb', 'ATLAS 2016'],
  ['Top quark pairs', '13 TeV', '830 ± 38 pb', 'ATLAS 2020'],
  ['Top quark pairs', '13.6 TeV', '850 ± 27 pb', 'ATLAS 2023'],
  ['Higgs boson, all production', '13 TeV', '55 ± 4 pb', 'ATLAS + CMS'],
  ['Four top quarks', '13 TeV', '22.5 fb (observed)', 'ATLAS 2023'],
  ['Higgs pairs', '13 TeV', '31 fb predicted, not yet seen', 'LHC Higgs WG'],
  ['H → γγ, H → ZZ* → 4ℓ branching', '—', '0.227%, 0.0125%', 'PDG / LHC Higgs WG'],
  ['Charged particles per unit η (pp)', '13 TeV', '6.46 ± 0.19', 'ALICE 2016'],
  ['Charged particles per unit η (central Pb-Pb)', '5.02 TeV', '1943 ± 54', 'ALICE 2016'],
  ['Masses: H, Z, W, top', '—', '125.1, 91.19, 80.37, 172.6 GeV', 'PDG'],
  ['X(3872) and Pc(4312) exotic hadrons', '7–13 TeV', 'observed', 'Belle 2003, LHCb 2019'],
];
const UNITS = [['eV', 1e-6], ['keV', 1e-3], ['MeV', 1], ['GeV', 1e3], ['TeV', 1e6], ['PeV', 1e9], ['EeV', 1e12], ['ZeV', 1e15]];

export function buildCollider(root, { openElement }) {
  const st = { beam: 'p', target: findNuclide('Au-197'), mode: 'fixed', type: 'linac', L: 100, KE: 85 };
  let res = null, kin = null, kT = null, col = null, P = null, T = null, kind = 'pp';

  const beamBtn = nuclideButton({ value: st.beam, title: 'Choose the projectile', particles: ['e-', 'e+', 'p', 'pbar', 'n'], onPick: v => { st.beam = v; update(); } });
  const tgtBtn = nuclideButton({ value: st.target, title: 'Choose the target', particles: ['e-', 'e+', 'p', 'pbar', 'n'], onPick: v => { st.target = v; update(); } });
  const modeSeg = seg([['fixed', 'Fixed target'], ['collider', 'Head-on']], st.mode, k => { st.mode = k; update(); });
  const typeSeg = seg([['linac', 'Linear'], ['ring', 'Ring']], st.type, k => { st.type = k; update(); });
  const lenS = h('input', { type: 'range', id: 'col-len', min: 0, max: 1600, value: 400 });
  const eS = h('input', { type: 'range', id: 'col-energy', min: 0, max: 2400, step: 1 });
  const lenV = h('b'), eV = h('b');
  const keIn = h('input', { type: 'number', id: 'col-ke', step: 'any', min: '0' });
  const keUnit = h('select', { id: 'col-ke-unit', style: { width: 'auto' } }, UNITS.map(([l, v]) => h('option', { value: v }, l)));
  const spIn = h('input', { type: 'text', id: 'col-speed', inputmode: 'decimal', placeholder: 'e.g. 99.9999' });
  const marks = h('div', { class: 'marks' }, MARKS.map(([l, v]) => h('button', { onclick: () => { st.KE = v; update(); } }, l)));
  lenS.addEventListener('input', () => { st.L = Math.pow(10, lenS.value / 200); update(); });
  eS.addEventListener('input', () => { st.KE = Math.pow(10, eS.value / 100 - 6); update(); });
  const applyKE = () => { const ke = +keIn.value * +keUnit.value; if (ke > 0) { st.KE = ke; update(true); } };
  keIn.addEventListener('change', applyKE); keUnit.addEventListener('change', applyKE);
  spIn.addEventListener('change', () => { const b = parseFloat(spIn.value) / 100; if (b > 0 && b < 1) { st.KE = keFromBeta(particleOf(st.beam), b); update(); } else toast('Enter a speed below 100% of light speed'); });
  const evSel = h('select', { id: 'col-evmode' });
  const puSel = h('select', { id: 'col-pu' }, [['auto', 'Automatic (LHC Run 3 at LHC energies)'], ['0', 'None: a single clean collision'], ['35', '35 (LHC Run 2)'], ['55', '55 (LHC Run 3)'], ['140', '140 (High-Luminosity LHC)']].map(([v, l]) => h('option', { value: v }, l)));
  const pileup = () => { if (kind !== 'pp' && kind !== 'ppbar') return 0; const v = puSel.value; if (v !== 'auto') return +v; return col.sqrtS >= 5e6 && st.mode === 'collider' ? 55 : 0; };

  const accCv = h('canvas', { 'aria-label': 'Accelerator animation' });
  const ev = eventCanvas({ aspect: 1.25, maxHeight: 620 });
  const viewSeg = seg([['rphi', 'End view (2D)'], ['rz', 'Side view (2D)'], ['3d', '3D']], 'rphi', k => ev.setView(k));
  const title = h('h2', { style: { fontSize: '24px' } });
  const text = h('p', { class: 'prose', style: { margin: 0 } });
  const evInfo = h('div', { class: 'stack', style: { gap: '8px' } });
  const beamStats = h('div', { class: 'stat-grid' }), machStats = h('div', { class: 'stat-grid' }), colStats = h('div', { class: 'stat-grid' });
  const chanBox = h('div', {}), prodBox = h('div', { class: 'stack', style: { gap: '8px' } }), whatIf = h('div', {});
  const warnBox = h('p', { class: 'warn', hidden: true }), noteBox = h('div', { class: 'note', hidden: true });
  const searchBox = h('div', { class: 'card stack', hidden: true }, h('h3', {}, 'What the LHC is searching for (not found yet)'),
    h('p', { class: 'hint-text', style: { margin: 0 } }, 'Real theories under test. None has been seen; the numbers are current lower limits on their mass. They are not produced here because nobody knows whether they exist.'),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', {}, 'Hypothetical particle'), h('th', {}, 'Excluded below'))), h('tbody', {}, SEARCHES.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b)))))));

  // ---------- session ----------
  const session = newSession();
  const sesInfo = h('div', { class: 'row', style: { gap: '18px' } });
  const charts = {
    proc: barChart({ title: 'Collisions by type' }),
    diphoton: histChart({ title: 'Two-photon mass (Higgs → γγ search)', xlabel: 'm(γγ) [GeV]', ylabel: 'Events / GeV' }),
    fourl: histChart({ title: 'Four-lepton mass (Higgs → ZZ* → 4ℓ)', xlabel: 'm(4ℓ) [GeV]', ylabel: 'Events / 3 GeV' }),
    dimuon: histChart({ title: 'Dimuon mass spectrum', xlabel: 'm(μμ) [GeV]', ylabel: 'Events / bin', logX: true, logY: true }),
    mult: histChart({ title: 'Charged particles per collision', xlabel: 'Number of charged particles', ylabel: 'Collisions', logY: true }),
    pt: histChart({ title: 'Transverse momentum of charged particles', xlabel: 'pT [GeV]', ylabel: 'Particles', logY: true }),
    angle: histChart({ title: 'Scattering angle (Rutherford)', xlabel: 'Angle [degrees]', ylabel: 'Nuclei', logY: true }),
    dijet: histChart({ title: 'Two-jet mass (up to your collision energy)', xlabel: 'm(jj) [GeV]', ylabel: 'Events / bin', logX: true, logY: true }),
  };
  const chartGrid = h('div', { class: 'chart-grid' });

  function particleOf(v) { return typeof v === 'string' ? particle(v) : particle('ion', v); }

  function update(fromKE) {
    P = particleOf(st.beam); T = particleOf(st.target);
    kin = kinematics(P, st.KE);
    // head-on: both beams at the same energy per nucleon (like the LHC)
    kT = st.mode === 'collider' ? kinematics(T, P.A && T.A ? (st.KE / P.A) * T.A : st.KE) : kinematics(T, 0);
    lenS.value = Math.round(Math.log10(st.L) * 200);
    eS.value = Math.round((Math.log10(st.KE) + 6) * 100);
    lenV.textContent = st.L >= 1000 ? `${fmt(st.L / 1000, 3)} km` : `${fmt(st.L, 3)} m`;
    eV.textContent = `${fmtE(kin.KE)}${P.A > 1 ? ` · ${fmtE(kin.KEperA)} per nucleon` : ''}`;
    if (!fromKE) { const [v, u] = bestUnit(kin.KE); keIn.value = v; keUnit.value = u; }
    spIn.value = pctC(kin);
    const M = machine(P, kin, st.type, st.L);
    col = collision(P, kin, T, kT, st.mode);
    res = outcome(P, kin, T, kT, st.mode, col);
    kind = P.lepton && T.lepton ? 'ee' : (P.lepton || T.lepton) ? 'ep' : (P.A > 1 || T.A > 1) ? 'AA' : (P.kind === 'pbar' || T.kind === 'pbar') ? 'ppbar' : 'pp';
    const procs = procList();
    const keep = evSel.value || 'trigger';
    evSel.replaceChildren(h('option', { value: 'typical' }, 'Typical collision (real rates)'), h('option', { value: 'trigger' }, 'Interesting collision (like the LHC trigger)'),
      ...procs.filter(p => p.key !== 'minbias').map(p => h('option', { value: p.key }, `Only ${p.label} (1 in ${oneIn(p.sigma, procs)})`)));
    evSel.value = [...evSel.options].some(o => o.value === keep) ? keep : 'trigger';
    evSel.disabled = !procs.length;

    beamStats.replaceChildren(
      s('Speed', `${pctC(kin)}% of c`), s('1 − v/c', kin.oneMinusBeta > 0.01 ? '—' : sci(kin.oneMinusBeta, 3)), s('Lorentz factor γ', fmt(kin.gamma, 5)),
      s('Kinetic energy', fmtE(kin.KE)), s('In joules', `${sci(kin.KE * 1.602176634e-13, 3)} J`), P.A > 1 ? s('Per nucleon', fmtE(kin.KEperA)) : s('Total energy', fmtE(kin.E)),
      s('Momentum', `${fmtE(kin.p)}/c`), s('Quantum wavelength', lamStr(kin.lambda)),
      s('Crossing the machine', timeStr(st.L / kin.v)), s('On its own clock', timeStr(st.L / kin.v / kin.gamma)));
    if (M.neutral) {
      machStats.replaceChildren(s('Accelerator', 'cannot push a neutral particle'));
      warnBox.hidden = false; warnBox.textContent = 'Neutrons have no charge, so no electric or magnetic field can accelerate them. Real neutron beams come from reactors or spallation sources; here the neutron simply gets the energy you chose.';
    } else {
      warnBox.hidden = M.ok !== false; warnBox.textContent = M.ok === false ? `Not buildable as set: ${M.feasible}. The collision still runs so you can see what would happen.` : '';
      machStats.replaceChildren(...(st.type === 'linac'
        ? [s('Total voltage', fmtV(M.voltage)), s('Field gradient', `${fmt(M.gradient, 3)} MV/m`), s('Technology', M.feasible)]
        : [s('Bending magnets', `${fmt(M.B, 3)} tesla`), s('Technology', M.feasible), s('Laps to reach energy', fmt(Math.round(M.turns), 4)), s('Time to accelerate', timeStr(M.time)), s('Radiation loss per lap', fmtE(M.u0))]),
        s('Ring needed with LHC magnets', distStr(M.ringNeeded)), s('Linac needed at 100 MV/m', distStr(M.linacNeeded)));
    }
    colStats.replaceChildren(
      s('Collision energy √s', fmtE(col.sqrtS)), s('Free energy (centre of mass)', fmtE(col.Ecm)),
      col.sqrtSNN ? s('Per nucleon pair √sNN', fmtE(col.sqrtSNN)) : s('Mode', st.mode === 'fixed' ? 'fixed target' : 'head-on'),
      s('Wasted by fixed target', st.mode === 'fixed' ? `${fmt(100 * (1 - col.Ecm / Math.max(kin.KE, 1e-12)), 3)}%` : '0%'),
      s('Collision energy vs the LHC', (() => { const x = col.sqrtS / 1.36e7; return x >= 1 ? `${x >= 1e4 ? sci(x, 2) : fmt(x, 3)}× the LHC` : `${x <= 1e-4 ? sci(1 / x, 2) : fmt(1 / x, 3)}× below the LHC`; })()));
    title.textContent = res.title; text.textContent = res.text;
    noteBox.hidden = !(kin.KE > 1e8);
    if (kin.KE > 1e8) noteBox.textContent = `Cosmic-ray scale. ${kin.KE >= OMG_MEV * 0.5 ? `This matches the Oh-My-God particle seen over Utah in 1991: ${sci(kin.KE * 1.602e-13, 2)} J in one subatomic particle, like a baseball thrown at about 90 km/h. ` : ''}Hitting the atmosphere it would start an air shower of roughly ${sci(Math.max(10, kin.KE / 1000), 1)} secondary particles spread over square kilometres.`;
    chanBox.replaceChildren(res.channels.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', {}, 'Quantity or process'), h('th', {}, 'Value'))),
      h('tbody', {}, res.channels.map(c => h('tr', {}, h('td', {}, c[0]), h('td', {}, c[2] || fmtE(c[1]))))))) : '');
    renderProducts(); renderWhatIf();
    const key = `${P.label}|${T.label}|${st.mode}|${Math.round(Math.log10(col.sqrtS) * 50)}`;
    if (session.key !== key) resetSession(key);
    phase = 'idle'; ev.show(null); evInfo.replaceChildren();
    renderCharts();
  }
  function sqGeV() { return (kind === 'AA' ? col.sqrtSNN : col.sqrtS) / 1000; }
  function procList() { return res.view === 'detector' && kind !== 'ep' ? processes(kind, sqGeV(), P.A || 1, T.A || 1) : []; }
  function renderProducts() {
    prodBox.replaceChildren();
    const prods = [...(res.product || []), ...(res.fragments || [])].filter(Boolean);
    if (!prods.length && !res.newElement) return;
    prodBox.append(h('h3', {}, 'What was made'));
    if (res.newElement) prodBox.append(h('div', { class: 'note' }, `Element ${res.newElement} does not exist yet. You would be its discoverer.`));
    for (const r of prods) prodBox.append(h('button', { class: 'src-btn', style: { '--c': r.hl === -1 ? '#8a8a92' : '#f2b84b' }, onclick: () => openElement(byZ[r.z]) },
      h('span', { class: 'dot' }), h('span', { html: `${nuclideLabelHTML(r)} <span class="muted" style="font-size:13px"> ${byZ[r.z].name}-${r.a}</span>` }), h('span', { class: 'n' }, r.hl === -1 ? 'stable' : r.hl ? `half-life ${hl(r.hl)}` : 'short-lived')));
    if (res.productLabels) prodBox.append(h('div', { class: 'small muted' }, `Products: ${res.productLabels.join(' + ')}`));
  }
  function renderWhatIf() {
    whatIf.replaceChildren();
    if (!(P.A && T.A) || col.Ecm > 5e4) return;
    const wf = whatIfFused(P, T, col.Ecm);
    if (!wf) return;
    whatIf.append(h('div', { class: 'card stack', style: { padding: '14px' } }, h('h3', {}, `What if they fused into ${wf.name}?`),
      h('div', { class: 'stat-grid' }, s('Energy from merging (Q)', `${wf.Q >= 0 ? '+' : ''}${fmt(wf.Q, 4)} MeV${wf.measured ? '' : ' (estimate)'}`), s('Excitation energy', `${fmt(wf.Ex, 4)} MeV`), s('Fissility Z²/A', wf.x.toFixed(3)), s('Fission barrier', `~${fmt(wf.Bf, 3)} MeV`)),
      h('p', { style: { margin: 0 } }, wf.fate)));
  }
  function renderCharts() {
    const nuclearView = res.view !== 'detector';
    const list = nuclearView ? [charts.proc, ...(res.anim === 'deflect' || res.anim === 'bounce' ? [charts.angle] : [])]
      : kind === 'ee' ? [charts.proc, charts.mult, charts.dimuon]
        : kind === 'ep' ? [charts.proc, charts.mult, charts.pt]
          : [charts.proc, charts.diphoton, charts.fourl, charts.dijet, charts.dimuon, charts.mult, charts.pt];
    if (chartGrid.children.length !== list.length || list.some((c, i) => chartGrid.children[i] !== c.root)) chartGrid.replaceChildren(...list.map(c => c.root));
    const colors = { minbias: '#6b6b73', Hgg: '#ff4d5e', H4l: '#ff4d5e', Hbb: '#ff4d5e', HH: '#ff79c6', tt: '#f2b84b', tttt: '#f2b84b', X3872: '#c79bff', Pc: '#c79bff', ee_ZH: '#ff4d5e' };
    charts.proc.set(Object.entries(session.counts).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => [session.labels[k] || k, v, colors[k] || '#5cc8f0']));
    const hs = session.hist;
    const expMsg = name => { const e1 = perCollision(name); if (!e1) return 'Not possible at this energy'; const e = session.n * e1; return `Expected so far: ${e < 0.01 ? sci(e, 2) : fmt(e, 3)} events. One needs ~${sci(1 / e1, 2)} collisions`; };
    charts.diphoton.set({ ...hs.diphoton, labels: [[125.1, 'Higgs', Math.max(...hs.diphoton.obs, 1)]], empty: expMsg('diphoton') });
    charts.fourl.set({ ...hs.fourl, labels: [[91.2, 'Z', 1], [125.1, 'H', 1]], empty: expMsg('fourl') });
    charts.dijet.set({ ...hs.dijet, empty: 'Two-jet collisions appear here' });
    charts.dimuon.set({ ...hs.dimuon, labels: [[0.78, 'ω', 1], [1.02, 'φ', 1], [3.1, 'J/ψ', 1], [9.46, 'Υ', 1], [91.2, 'Z', 1]] });
    charts.mult.set(hs.mult); charts.pt.set(hs.pt); charts.angle.set(hs.angle);
    const L = session.sigmaInel ? session.n / session.sigmaInel / 1000 : 0;
    sesInfo.replaceChildren(
      h('span', {}, 'Collisions: ', h('b', {}, session.n >= 1e6 ? sci(session.n, 3) : session.n.toLocaleString())),
      L && res.view === 'detector' && kind !== 'ee' && kind !== 'ep' ? h('span', {}, 'Integrated luminosity: ', h('b', {}, L < 1e-3 ? `${sci(L * 1000, 2)} pb⁻¹` : `${fmt(L, 3)} fb⁻¹`)) : '',
      session.higgs ? h('span', {}, 'Higgs bosons produced: ', h('b', {}, session.higgs >= 1e6 ? sci(session.higgs, 3) : Math.round(session.higgs).toLocaleString())) : '');
  }

  // ---------- one collision ----------
  function outcomeKey() { return res.anim === 'deflect' || res.anim === 'bounce' ? 'scatter' : (res.quasi ? 'quasi-fission' : res.productLabels?.[0] || res.product?.[0]?.label || res.anim); }
  function makeEvent() {
    if (res.view !== 'detector') {
      const k = outcomeKey();
      session.n++; session.sigmaInel = 0;
      session.labels[k] = k === 'scatter' ? 'Scattered (Rutherford)' : k; session.counts[k] = (session.counts[k] || 0) + 1;
      if (k === 'scatter') fillAngle(1);
      return { kind: 'nuclear', anim: res.anim, a1: P.A, a2: T.A, lepton1: !!P.lepton, lepton2: !!T.lepton, product: res.product, productLabels: res.productLabels, fragments: res.fragments, newElement: res.newElement, quasi: res.quasi, quasiLabels: res.quasiLabels, supercritical: res.supercritical, collider: st.mode === 'collider', label1: P.label, label2: T.label, closest: res.channels.find(c => c[0] === 'closest approach')?.[1] };
    }
    const sqG = sqGeV();
    let parts = [], proc = null, nSoft = 0;
    if (kind === 'ep') {
      const Q = Math.sqrt(col.sqrtS / 1000) * 3, a = Math.random() * Math.PI * 2;
      nSoft = Math.round(chargedMult(sqG) * 0.6);
      parts = [{ type: 'e', q: -1, px: Q * Math.cos(a), py: Q * Math.sin(a), pz: Q, E: Q * 1.5, m: 0 }, { type: 'jet', q: 0, px: -Q * Math.cos(a), py: -Q * Math.sin(a), pz: Q * 2, E: Q * 2.2, m: 0 }, ...softTracks(nSoft)];
      proc = { key: 'dis', label: 'Deep inelastic scattering: the electron hits a quark' };
    } else {
      const procs = procList();
      session.sigmaInel = kind === 'ee' ? procs.reduce((a, p) => a + p.sigma, 0) : procs.find(p => p.key === 'minbias')?.sigma || 1;
      const m = evSel.value;
      const pool = m === 'typical' ? procs : m === 'trigger' ? procs.filter(p => p.trigger) : procs.filter(p => p.key === m);
      proc = pickWeighted(pool.length ? pool : procs);
      parts = proc.gen(sqG);
      // underlying event: a hard collision is busier than an average one (about 1.5× the tracks)
      nSoft = proc.key === 'minbias' ? nbd(kind === 'AA' ? res.nch || chargedMult(sqG) : chargedMult(sqG)) : kind === 'ee' ? 0 : nbd(chargedMult(sqG) * 1.5);
      parts = [...parts, ...softTracks(Math.min(nSoft, 1400), kind === 'AA' ? 0.55 : 0.45)];
      const pu = pileup();
      let puTracks = 0;
      for (let i = 0; i < pu && puTracks < 2200; i++) { const vz = gauss() * 0.045, tr = softTracks(nbd(chargedMult(sqG))); for (const t of tr) { t.vz = vz; t.pileup = true; } puTracks += tr.length; parts.push(...tr); }
      session.pu = pu;
      if (kind === 'ee' && (proc.key === 'ee_had' || proc.key === 'ee_ups')) parts = [...parts, ...jetTracks(parts.filter(p => p.type === 'jet'), Math.round(chargedMult(sqG) * 0.8))];
    }
    fillEvent(parts, nSoft);
    session.n++;
    session.labels[proc.key] = proc.label; session.counts[proc.key] = (session.counts[proc.key] || 0) + 1;
    if (proc.key.startsWith('H') || proc.key === 'ee_ZH') session.higgs += proc.key === 'HH' ? 2 : 1;
    const lep = parts.filter(p => (p.type === 'mu' || p.type === 'e') && !p.soft), gam = parts.filter(p => p.type === 'gamma' && !p.soft);
    const recon = [];
    if (gam.length >= 2) recon.push(`m(γγ) = ${invMass(gam.slice(0, 2)).toFixed(1)} GeV`);
    if (lep.length >= 4) recon.push(`m(4ℓ) = ${invMass(lep.slice(0, 4)).toFixed(1)} GeV`);
    else if (lep.length >= 2) recon.push(`m(ℓℓ) = ${invMass(lep.slice(0, 2)).toFixed(2)} GeV`);
    const charged = parts.filter(p => p.q && (p.type === 'trk' || p.type === 'mu' || p.type === 'e')).length;
    const hard = parts.filter(p => !p.soft).sort((a, b) => pT(b) - pT(a)).slice(0, 10);
    evInfo.replaceChildren(
      h('div', { class: 'row' }, h('span', { class: 'chip' }, h('i', { style: { background: proc.key.startsWith('H') ? '#ff4d5e' : '#f2b84b' } }), proc.label)),
      h('div', { class: 'small' }, `${charged} charged tracks${session.pu ? ` (including ${session.pu} pile-up collisions in the same bunch crossing, drawn fainter)` : ''}${recon.length ? ' · ' + recon.join(' · ') : ''}${kind === 'AA' && res.nch ? ` · ${res.nch.toLocaleString()} charged particles in the full collision (${Math.min(nSoft, 900)} drawn)` : ''}`),
      hard.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Particle'), h('th', { class: 'num' }, 'pT (GeV)'), h('th', { class: 'num' }, 'η'), h('th', { class: 'num' }, 'Energy (GeV)'))),
        h('tbody', {}, hard.map(p => h('tr', {}, h('td', {}, NAMES[p.type] ? NAMES[p.type](p) : p.type), h('td', { class: 'num' }, pT(p).toFixed(1)), h('td', { class: 'num' }, etaOf(p).toFixed(2)), h('td', { class: 'num' }, p.E.toFixed(1))))))) : '');
    return { kind: 'detector', particles: parts, qgp: res.qgp, tag: recon[0] || '' };
  }
  function fillEvent(parts, nSoft) {
    const hs = session.hist;
    const gam = parts.filter(p => p.type === 'gamma' && !p.soft), lep = parts.filter(p => (p.type === 'mu' || p.type === 'e') && !p.soft), mu = parts.filter(p => p.type === 'mu' && !p.soft);
    if (gam.length >= 2) fill(hs.diphoton, invMass(gam.slice(0, 2)));
    if (lep.length >= 4) fill(hs.fourl, invMass(lep.slice(0, 4)));
    if (mu.length >= 2) fill(hs.dimuon, invMass(mu.slice(0, 2)));
    const jets = parts.filter(p => p.type === 'jet' || p.type === 'bjet').sort((a, b) => pT(b) - pT(a));
    if (jets.length >= 2) fill(hs.dijet, invMass(jets.slice(0, 2)));
    fill(hs.mult, Math.max(parts.filter(p => p.q && p.type === 'trk').length, nSoft));
    for (const p of parts) if (p.q && p.type === 'trk') fill(hs.pt, pT(p));
  }

  // ---------- many collisions ----------
  function runMany(N) {
    if (res.view !== 'detector') {
      const k = outcomeKey();
      if (res.anim === 'fuse' && res.productLabels && !res.quasi) { // neighbouring evaporation channels
        const m = res.productLabels[0].match(/^([A-Za-z]+)-(\d+)$/);
        if (m) for (const [d, w] of [[-1, 0.2], [0, 0.6], [1, 0.2]]) { const key = `${m[1]}-${+m[2] + d}`; session.labels[key] = key; session.counts[key] = (session.counts[key] || 0) + poisson(N * w); }
      } else { session.labels[k] = k === 'scatter' ? 'Scattered (Rutherford)' : k; session.counts[k] = (session.counts[k] || 0) + N; }
      if (k === 'scatter') fillAngle(N);
      session.n += N; renderCharts(); return;
    }
    const sqG = sqGeV();
    if (kind === 'ep') { session.counts.dis = (session.counts.dis || 0) + N; session.labels.dis = 'Deep inelastic scattering'; session.n += N; fillMult(N, chargedMult(sqG) * 0.6); fillPt(N * chargedMult(sqG) * 0.6); renderCharts(); return; }
    const procs = procList();
    const sig = kind === 'ee' ? procs.reduce((a, p) => a + p.sigma, 0) : procs.find(p => p.key === 'minbias').sigma;
    session.sigmaInel = sig;
    let others = 0;
    for (const p of procs) {
      if (p.key === 'minbias') continue;
      const mu = N * p.sigma / sig, k = poisson(mu); others += k;
      session.labels[p.key] = p.label; session.counts[p.key] = (session.counts[p.key] || 0) + k;
      if (p.key === 'Hgg') session.higgs += mu / 0.00227; // every Higgs made, not only the γγ ones
      if (p.key === 'ee_ZH') session.higgs += mu;
    }
    if (kind !== 'ee') { session.labels.minbias = procs[0].label; session.counts.minbias = (session.counts.minbias || 0) + Math.max(0, N - others); }
    session.n += N;
    const Lfb = N / sig / 1000;
    if (kind !== 'ee') {
      const scale = kind === 'AA' ? 0.3 * (P.A || 1) * (T.A || 1) : 1;
      for (const name of ['diphoton', 'fourl', 'dimuon']) {
        const e = expectedHist(name, Lfb * scale, sqG);
        const H0 = session.hist[name];
        H0.bkg = H0.bkg.map((v, i) => v + e.bkg[i]); H0.sig = H0.sig.map((v, i) => v + e.sig[i]);
        H0.obs = H0.obs.map((v, i) => v + poisson(e.bkg[i] + e.sig[i]));
      }
    } else {
      const add = poisson(N * (procs.find(p => p.key === 'ee_mm')?.sigma || 0) / sig), i = binOf(session.hist.dimuon, sqG);
      if (i >= 0) session.hist.dimuon.obs[i] += add;
    }
    const dj = procs.find(p => p.key === 'dijet');
    if (dj) { const mu = N * dj.sigma / sig, H0 = session.hist.dijet, sh = dijetShape(H0.edges, sqG); H0.bkg = H0.bkg.map((v, i) => v + mu * sh[i]); H0.obs = H0.obs.map((v, i) => v + poisson(mu * sh[i])); }
    const nch = kind === 'AA' ? (res.nch || chargedMult(sqG)) : chargedMult(sqG);
    fillMult(N, nch); fillPt(N * nch);
    renderCharts(); renderOdds();
  }
  function fillMult(N, mean) {
    const H0 = session.hist.mult;
    if (N <= 5000) { for (let i = 0; i < N; i++) fill(H0, nbd(mean)); return; }
    const k = 2, th = mean / k;
    H0.obs = H0.obs.map((v, i) => { const a = H0.edges[i], b = H0.edges[i + 1], c = (a + b) / 2; const pdf = Math.pow(c, k - 1) * Math.exp(-c / th) / (th * th); return v + poisson(N * pdf * (b - a)); });
  }
  function fillPt(Ntr) {
    const H0 = session.hist.pt, T0 = 0.15, n = 7, f = x => x * Math.pow(1 + x / (n * T0), -n);
    let norm = 0; for (let x = 0.005; x < 30; x += 0.01) norm += f(x) * 0.01;
    H0.obs = H0.obs.map((v, i) => { const a = H0.edges[i], b = H0.edges[i + 1]; return v + poisson(Ntr * f((a + b) / 2) * (b - a) / norm); });
  }
  function fillAngle(N) {
    const H0 = session.hist.angle, xmin = Math.sin((5 * Math.PI / 180) / 2) ** 2;
    if (N <= 20000) { for (let i = 0; i < N; i++) { const u = 1 + Math.random() * (1 / xmin - 1), th = 2 * Math.asin(Math.sqrt(1 / u)) * 180 / Math.PI; fill(H0, th); } }
    else H0.obs = H0.obs.map((v, i) => { const a = Math.max(H0.edges[i], 5), b = H0.edges[i + 1]; if (b <= 5) return v; const xa = Math.sin(a * Math.PI / 360) ** 2, xb = Math.sin(b * Math.PI / 360) ** 2; return v + poisson(N * (1 / xa - 1 / xb) / (1 / xmin - 1)); });
    const tot = session.counts.scatter || N;
    H0.bkg = H0.edges.slice(0, -1).map((a0, i) => { const a = Math.max(a0, 5), b = H0.edges[i + 1]; if (b <= 5) return 0; const xa = Math.sin(a * Math.PI / 360) ** 2, xb = Math.sin(b * Math.PI / 360) ** 2; return tot * (1 / xa - 1 / xb) / (1 / xmin - 1); });
  }
  function newSession() {
    const lin = (lo, hi, step) => { const e = []; for (let v = lo; v <= hi + 1e-9; v += step) e.push(+v.toFixed(6)); return e; };
    const logE = (lo, hi, n) => Array.from({ length: n + 1 }, (_, i) => lo * Math.pow(hi / lo, i / n));
    const mk = (edges, full) => ({ edges, obs: new Array(edges.length - 1).fill(0), bkg: full ? new Array(edges.length - 1).fill(0) : [], sig: full ? new Array(edges.length - 1).fill(0) : [] });
    return { key: '', n: 0, counts: {}, labels: {}, higgs: 0, sigmaInel: 0, hist: { dijet: mk(logE(100, 14000, 60), true), diphoton: mk(lin(100, 160, 1), true), fourl: mk(lin(70, 250, 3), true), dimuon: mk(logE(0.4, 150, 180), true), mult: mk(lin(0, 200, 5)), pt: mk(lin(0, 20, 0.5)), angle: mk(lin(0, 180, 5), true) } };
  }
  function resetSession(key) {
    Object.assign(session, newSession(), { key });
    const sq = col ? sqGeV() : 1;
    const mean = kind === 'AA' ? (res?.nch || chargedMult(sq)) : chargedMult(sq);
    const top = Math.max(20, Math.ceil(mean * 4 / 10) * 10), step = Math.max(1, Math.round(top / 50));
    session.hist.mult.edges = Array.from({ length: Math.ceil(top / step) + 1 }, (_, i) => i * step);
    session.hist.mult.obs = new Array(session.hist.mult.edges.length - 1).fill(0);
    const top2 = Math.max(1000, sq * 0.9); const n2 = 60;
    session.hist.dijet.edges = Array.from({ length: n2 + 1 }, (_, i) => 100 * Math.pow(top2 / 100, i / n2));
    session.hist.dijet.obs = new Array(n2).fill(0); session.hist.dijet.bkg = new Array(n2).fill(0); session.hist.dijet.sig = new Array(n2).fill(0);
    perCache = {};
  }
  let perCache = {};
  // expected events per collision in a plot (for the "expected so far" message)
  function perCollision(name) {
    if (perCache[name] != null) return perCache[name];
    if (res.view !== 'detector' || kind === 'ee' || kind === 'ep') return (perCache[name] = 0);
    const sig = procList().find(p => p.key === 'minbias')?.sigma; if (!sig) return (perCache[name] = 0);
    const e = expectedHist(name, 1 / sig / 1000 * (kind === 'AA' ? 0.3 * (P.A || 1) * (T.A || 1) : 1), sqGeV());
    return (perCache[name] = e.bkg.reduce((a, b) => a + b, 0) + e.sig.reduce((a, b) => a + b, 0));
  }
  function dijetShape(edges, sqG) { // falling QCD spectrum, cut off by the collision energy
    const f = m => (m < sqG ? Math.pow(m / 100, -4.5) * Math.pow(1 - m / sqG, 6) : 0);
    const w = edges.slice(0, -1).map((a, i) => f(Math.sqrt(a * edges[i + 1])) * (edges[i + 1] - a));
    const t = w.reduce((a, b) => a + b, 0) || 1; return w.map(x => x / t);
  }

  // ---------- animation: accelerate → bunches approach → impact ----------
  let raf = 0, last = 0, accT = 0, phaseT = 0, phase = 'idle';
  const auto = { left: 0, total: 0 };
  const speed = () => (auto.left > 0 ? { fast: [0.25, 0.25, 0.5], max: [0.05, 0.1, 0.15] }[autoSpeed.value] || [1.3, 0.7, 1.4] : [1.3, 0.7, 1.4]);
  function run() {
    phase = 'acc'; accT = 0; phaseT = 0;
    ev.show({ kind: 'approach', dur: 99, fixed: st.mode === 'fixed' });
    if (innerWidth <= 900 && auto.left <= 0) stageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!accCv.offsetParent) return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    const [tAcc, tApp, tHold] = speed();
    if (phase === 'acc') { accT += dt; if (accT > tAcc) { phase = 'approach'; phaseT = 0; ev.show({ kind: 'approach', dur: tApp, fixed: st.mode === 'fixed', c2: st.mode === 'fixed' ? '#ffffff' : '#ffb38a' }); } }
    else if (phase === 'approach') { phaseT += dt; if (phaseT > tApp) { phase = 'hit'; phaseT = 0; ev.show(makeEvent()); renderCharts(); renderOdds(); } }
    else if (phase === 'hit') { phaseT += dt; if (auto.left > 0 && phaseT > tHold) { auto.left--; autoUi(); if (auto.left > 0) run(); } }
    drawAcc(phase === 'acc' ? clamp(accT / tAcc, 0, 1) : phase === 'idle' ? 0 : 1);
  }
  function drawAcc(f) {
    const ctx = accCv.getContext('2d'); const { w, h: H } = fitCanvas(accCv, ctx);
    ctx.fillStyle = SCREEN(); ctx.fillRect(0, 0, w, H);
    const col0 = P?.q === 0 ? '#9aa2b8' : '#8fdcff';
    const font = '"Source Sans 3", system-ui, sans-serif';
    const x0 = 250, x1 = w - 40;
    if (st.type === 'linac') {
      const y = H / 2;
      ctx.fillStyle = 'rgba(166,176,200,.12)'; ctx.fillRect(x0, y - 10, x1 - x0, 20);
      for (let i = 0; i < 16; i++) { const x = x0 + (i + 0.5) * (x1 - x0) / 16; ctx.fillStyle = `rgba(242,184,75,${0.2 + 0.5 * ((Math.sin(accT * 20 - i) + 1) / 2) * (phase === 'acc' ? 1 : 0.3)})`; ctx.fillRect(x - 8, y - 14, 16, 28); }
      const px = x0 + (x1 - x0) * f * f;
      for (let k = 0; k < 8; k++) glowC(ctx, px - k * 6 * f, y, 8 - k * 0.8, col0, 1 - k * 0.12);
    } else {
      const cx = (x0 + x1) / 2, cy = H / 2, R = Math.min((x1 - x0) * 0.42, H * 0.36);
      ctx.strokeStyle = 'rgba(166,176,200,.35)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(cx, cy, R * 2.2, R, 0, 0, 7); ctx.stroke();
      const ang = phase === 'idle' ? 0 : accT * (1 + f * 12);
      for (let k = 0; k < 10; k++) glowC(ctx, cx + Math.cos(ang - k * 0.05) * R * 2.2, cy + Math.sin(ang - k * 0.05) * R, 7 - k * 0.5, col0, 1 - k * 0.09);
      if (st.mode === 'collider') for (let k = 0; k < 10; k++) glowC(ctx, cx + Math.cos(-ang + k * 0.05 + Math.PI) * R * 2.2, cy + Math.sin(-ang + k * 0.05 + Math.PI) * R, 7 - k * 0.5, '#ffb38a', 1 - k * 0.09);
    }
    const shown = kin && P ? kinematics(P, kin.KE * f * f) : null;
    ctx.textAlign = 'left';
    ctx.font = `600 12.5px ${font}`; ctx.fillStyle = 'rgba(220,220,230,.6)'; ctx.fillText(`${st.type === 'linac' ? 'Linear accelerator' : 'Ring'} · ${lenV.textContent}`, 16, 24);
    if (shown && f > 0) { ctx.font = `700 15px ${font}`; ctx.fillStyle = '#f2b84b'; ctx.fillText(`${pctC(shown)}% of c`, 16, H / 2 + 2); ctx.fillStyle = '#eee'; ctx.font = `600 13px ${font}`; ctx.fillText(`${fmtE(shown.KE)} · γ ${fmt(shown.gamma, 3)}`, 16, H / 2 + 22); }
  }

  // ---------- Higgs odds ----------
  const oddsBox = h('div', { class: 'stack', style: { gap: '10px' } });
  function renderOdds() {
    const procs = procList();
    const sig = kind === 'ee' ? procs.reduce((a, p) => a + p.sigma, 0) : procs.find(p => p.key === 'minbias')?.sigma || 0;
    const hgg = procs.find(p => p.key === 'Hgg'), zh = procs.find(p => p.key === 'ee_ZH');
    const sH = hgg ? hgg.sigma / 0.00227 : zh ? zh.sigma : 0;
    if (!sH || !sig) {
      const need = 125.1 + (kind === 'ee' ? 91.2 : 0);
      oddsBox.replaceChildren(h('p', { style: { margin: 0 } }, `No Higgs bosons possible here. Making one takes at least ${need.toFixed(0)} GeV of collision energy${kind === 'ee' ? ' (it is made together with a Z)' : ', and in practice a few TeV, because quarks and gluons carry only part of each proton\'s energy'}. You have ${fmtE(col.sqrtS)}.`));
      return;
    }
    const pH = sH / sig, pgg = hgg ? hgg.sigma / sig : pH;
    const N = Math.max(1, +autoN.value || 100);
    const atLeast = 1 - Math.exp(-N * pH);
    oddsBox.replaceChildren(
      h('div', { class: 'kpis' },
        h('div', {}, h('b', {}, `1 in ${oneInStr(1 / pH)}`), h('span', {}, 'collisions makes a Higgs')),
        hgg ? h('div', {}, h('b', {}, `1 in ${oneInStr(1 / pgg)}`), h('span', {}, 'gives Higgs → γγ')) : ''),
      h('p', { class: 'small', style: { margin: 0 } }, `Chance of at least one Higgs in your next ${N.toLocaleString()} collisions: ${atLeast < 1e-4 ? sci(atLeast * 100, 2) : fmt(atLeast * 100, 3)}%. So far this session made about ${Math.round(session.higgs).toLocaleString()}. The LHC makes roughly one Higgs per second, among a billion collisions per second.`));
  }
  function oneInStr(v) { return v >= 1e6 ? sci(v, 2) : Math.round(v).toLocaleString(); }

  // ---------- presets, runs, auto ----------
  function loadPreset(p) {
    const pick = v => (['e-', 'e+', 'p', 'pbar', 'n'].includes(v) ? v : findNuclide(v));
    st.beam = pick(p.beam); st.target = pick(p.target); st.mode = p.mode; st.type = p.type; st.L = p.L;
    beamBtn.set(st.beam); tgtBtn.set(st.target); setSeg(modeSeg, st.mode); setSeg(typeSeg, st.type);
    st.KE = p.KE != null ? p.KE : p.KEu * particleOf(st.beam).A;
    update(); run();
  }
  const presetSel = h('select', { id: 'col-preset', onchange: e => { const p = PRESETS[+e.target.value]; if (p) loadPreset(p); } }, h('option', { value: '' }, 'Choose a famous experiment…'), ...PRESETS.map((p, i) => h('option', { value: i }, `${p.name} · ${p.sub}`)));
  const presetGrid = h('div', { class: 'preset-grid' }, PRESETS.map(p => h('button', { class: 'src-btn', style: { '--c': '#5cc8f0' }, onclick: () => { loadPreset(p); tabsC.show('plots'); } }, h('span', { class: 'dot' }), h('span', {}, h('b', {}, p.name), h('span', {}, p.sub)), h('span', { class: 'n' }, '→'))));
  const lumiRun = L => {
    if (res.view !== 'detector' || kind === 'ee' || kind === 'ep') { toast('Luminosity runs apply to hadron colliders. Use the collision counts instead.'); return; }
    runMany(Math.round(L * 1000 * procList().find(p => p.key === 'minbias').sigma));
  };
  const autoN = h('input', { type: 'number', id: 'col-auto-n', value: 100, min: 1, max: 100000, step: 1 });
  const autoSpeed = h('select', { id: 'col-auto-speed', style: { width: 'auto' } }, h('option', { value: 'normal' }, 'Watch each one'), h('option', { value: 'fast', selected: true }, 'Fast'), h('option', { value: 'max' }, 'As fast as possible'));
  const autoBtn = h('button', { class: 'btn', onclick: () => { if (auto.left > 0) { auto.left = 0; autoUi(); return; } auto.total = auto.left = Math.max(1, Math.min(100000, +autoN.value || 1)); autoUi(); run(); } }, 'Start');
  const autoBar = h('i', {}), autoTxt = h('span', { class: 'small muted' });
  function autoUi() { const done = auto.total - auto.left; autoBtn.textContent = auto.left > 0 ? 'Stop' : 'Start'; autoBar.style.width = auto.total ? `${(done / auto.total) * 100}%` : '0'; autoTxt.textContent = auto.total ? `${done.toLocaleString()} of ${auto.total.toLocaleString()} collisions shown` : ''; }
  autoN.addEventListener('input', () => renderOdds());

  // ---------- layout ----------
  const stageEl = ev.root;
  stageEl.classList.add('stage', 'stage-tall');
  stageEl.style.aspectRatio = ''; stageEl.style.maxHeight = '';
  const accBox = h('div', { class: 'stage', style: { height: '96px' } }, accCv);
  const resultCard = h('div', { class: 'card result' }, title, text, noteBox, warnBox, evInfo, prodBox, whatIf);
  const tabsC = tabs([
    { key: 'plots', label: 'Session plots', body: h('div', { class: 'stack' }, h('div', { class: 'row' }, ...[[1, 'Collide once'], [100, '×100'], [1e4, '×10,000'], [1e6, '×1 million'], [1e9, '×1 billion']].map(([n, l]) => h('button', { class: `btn ${n === 1 ? 'primary' : ''}`, onclick: () => (n === 1 ? run() : runMany(n)) }, l))),
      h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Run a whole LHC dataset:'), ...[[1, '1 fb⁻¹'], [139, '139 fb⁻¹ (Run 2)'], [3000, '3000 fb⁻¹ (HL-LHC)']].map(([L, l]) => h('button', { class: 'btn small', onclick: () => lumiRun(L) }, l)), h('button', { class: 'btn small', onclick: () => { resetSession(session.key); renderCharts(); renderOdds(); } }, 'Reset session')),
      sesInfo, chartGrid,
      h('p', { class: 'hint-text', style: { margin: 0 } }, 'Every collision you run, one at a time or in bulk, is added here. Counts follow Poisson statistics from measured cross sections. The Higgs always shows up at 125 GeV whatever the beam energy, because that is its mass.')), onShow: () => renderCharts() },
    { key: 'numbers', label: 'Numbers', body: h('div', { class: 'cols' }, h('div', { class: 'card stack' }, h('h3', {}, 'Your beam'), beamStats), h('div', { class: 'card stack' }, h('h3', {}, 'Your machine'), machStats), h('div', { class: 'card stack' }, h('h3', {}, 'The collision'), colStats, chanBox)) },
    { key: 'experiments', label: 'Famous experiments', body: presetGrid },
    { key: 'data', label: 'Real data used', body: h('div', { class: 'stack' }, h('p', { class: 'hint-text', style: { margin: 0 } }, 'Rates, masses and particle counts come from these published results, interpolated between the energies where they were measured. Above 100 TeV, where no collider has been, the measured trends are extended, anchored by cosmic-ray data.'),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', {}, 'Quantity'), h('th', {}, 'Energy'), h('th', {}, 'Measured value'), h('th', {}, 'Source'))), h('tbody', {}, DATA.map(r => h('tr', {}, ...r.map(c => h('td', {}, c))))))), searchBox) },
  ]);
  searchBox.hidden = false;

  workspace(root, {
    eyebrow: 'Particle Collider', title: 'Smash anything', intro: 'Any particle or nucleus, any energy up to far beyond the most energetic particle ever detected. Rates come from real LHC measurements.',
    side: [
      group('Start from', presetSel),
      group('Collide', h('div', { class: 'field' }, h('label', {}, 'Projectile'), beamBtn.root), h('div', { class: 'field' }, h('label', {}, 'Target'), tgtBtn.root),
        h('div', { class: 'row', style: { gap: '12px' } }, h('div', { class: 'field' }, h('label', {}, 'Collision'), modeSeg), h('div', { class: 'field' }, h('label', {}, 'Machine'), typeSeg))),
      group('Energy', h('div', { class: 'field' }, h('label', { for: 'col-energy' }, 'Beam energy', eV), eS, marks),
        h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'col-ke' }, 'Exact'), h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, keIn, keUnit)), h('div', { class: 'field' }, h('label', { for: 'col-speed' }, 'Speed, % of c'), spIn)),
        h('div', { class: 'field' }, h('label', { for: 'col-len' }, 'Machine length', lenV), lenS)),
      group('Record', h('div', { class: 'field' }, h('label', { for: 'col-evmode' }, 'What to record'), evSel), h('div', { class: 'field' }, h('label', { for: 'col-pu' }, 'Pile-up (collisions per bunch crossing)'), puSel),
        h('button', { class: 'btn primary big', onclick: () => run() }, 'Accelerate & collide')),
      group('Automatic run', h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, h('div', { class: 'field', style: { flex: 1 } }, h('label', { for: 'col-auto-n' }, 'Collisions'), autoN), h('div', { class: 'field' }, h('label', { for: 'col-auto-speed' }, 'Speed'), autoSpeed)), h('div', { class: 'row' }, autoBtn, autoTxt), h('div', { class: 'progress' }, autoBar)),
      group('Chance of a Higgs', oddsBox),
    ],
    main: [accBox, h('div', { class: 'panel-title' }, viewSeg, h('div', { class: 'legend-inline' }, ...[['#ff4d5e', 'muon'], ['#6ee7a8', 'electron'], ['#ffe066', 'photon'], ['#ffb347', 'jet'], ['#b388ff', 'neutrino'], ['#8fd2ff', 'charged +'], ['#ffc478', 'charged −']].map(([c, l]) => h('span', {}, h('i', { style: { background: c } }), l)))),
      stageEl, resultCard, tabsC.root],
  });

  update(); renderOdds();
  return { show() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } ev.start(); }, hide() { cancelAnimationFrame(raf); raf = 0; ev.stop(); auto.left = 0; autoUi(); } };
}

const NAMES = { mu: p => `muon μ${p.q > 0 ? '⁺' : '⁻'}`, e: p => `electron e${p.q > 0 ? '⁺' : '⁻'}`, gamma: () => 'photon γ', jet: () => 'jet (quark or gluon)', bjet: () => 'b-quark jet', nu: () => 'neutrino (missing energy)', trk: p => `${p.name || 'π'}${p.q > 0 ? '⁺' : '⁻'}`, tau: p => `tau τ${p.q > 0 ? '⁺' : '⁻'}` };
function etaOf(p) { const pp = Math.hypot(p.px, p.py, p.pz); return 0.5 * Math.log((pp + p.pz + 1e-9) / (pp - p.pz + 1e-9)); }
function pickWeighted(list) { const tot = list.reduce((a, p) => a + p.sigma, 0); let r = Math.random() * tot; for (const p of list) { r -= p.sigma; if (r <= 0) return p; } return list[0]; }
function oneIn(sig, procs) { const tot = procs.find(p => p.key === 'minbias')?.sigma || procs.reduce((a, p) => a + p.sigma, 0); const v = tot / sig; return v < 1.5 ? '1' : v >= 1e6 ? sci(v, 2) : Math.round(v).toLocaleString(); }
function nbd(mean) { let x = 0; for (let i = 0; i < 2; i++) x -= Math.log(1 - Math.random() * 0.9999); return Math.max(0, Math.round(x * mean / 2)); }
function jetTracks(jets, n) {
  const out = [];
  for (let i = 0; i < n && jets.length; i++) {
    const j = jets[i % jets.length], per = n / jets.length;
    const phi = Math.atan2(j.py, j.px) + gauss() * 0.12, pt = (Math.hypot(j.px, j.py) / per) * (0.3 + Math.random() * 1.5);
    out.push({ type: 'trk', q: Math.random() < 0.5 ? 1 : -1, px: pt * Math.cos(phi), py: pt * Math.sin(phi), pz: j.pz / per, E: Math.hypot(pt, j.pz / per), m: 0.14, name: 'π' });
  }
  return out;
}
function fill(H0, v) { const i = binOf(H0, v); if (i >= 0) H0.obs[i]++; }
function binOf(H0, v) { const e = H0.edges; if (!(v >= e[0]) || v >= e[e.length - 1]) return -1; let lo = 0, hi = e.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (e[m] <= v) lo = m; else hi = m; } return lo; }
function seg(items, cur, on) { const el = h('div', { class: 'seg' }, items.map(([k, l]) => h('button', { 'data-k': k, class: k === cur ? 'on' : '', onclick: () => { setSeg(el, k); on(k); } }, l))); return el; }
function setSeg(el, k) { for (const b of el.children) b.classList.toggle('on', b.dataset.k === k); }
function s(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v' }, String(v))); }
function glowC(ctx, x, y, r, c, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
export function pctC(K) {
  if (K.beta < 0.999) return (K.beta * 100).toPrecision(4);
  const nines = Math.floor(-Math.log10(K.oneMinusBeta));
  if (nines > 14) return `99.${'9'.repeat(Math.min(nines - 2, 24))}…`;
  return (K.beta * 100).toFixed(Math.max(2, nines));
}
function bestUnit(mev) { let u = UNITS[0]; for (const x of UNITS) if (mev >= x[1]) u = x; return [+(mev / u[1]).toPrecision(5), u[1]]; }
function lamStr(fm) { if (!isFinite(fm)) return '∞'; if (fm < 1e-3) return `${sci(fm * 1e-15, 3)} m`; if (fm < 1e3) return `${fmt(fm, 3)} fm`; if (fm < 1e6) return `${fmt(fm / 1e3, 3)} pm`; return `${fmt(fm / 1e6, 3)} nm`; }
function timeStr(s0) { if (!isFinite(s0)) return '∞'; if (s0 < 1e-12) return `${sci(s0, 3)} s`; if (s0 < 1e-9) return `${fmt(s0 * 1e12, 3)} ps`; if (s0 < 1e-6) return `${fmt(s0 * 1e9, 3)} ns`; if (s0 < 1e-3) return `${fmt(s0 * 1e6, 3)} µs`; if (s0 < 1) return `${fmt(s0 * 1e3, 3)} ms`; if (s0 < 3600) return `${fmt(s0, 3)} s`; if (s0 < 86400 * 365) return `${fmt(s0 / 3600, 3)} h`; return `${fmt(s0 / 31557600, 3)} years`; }
function distStr(m) { if (!isFinite(m) || !m) return '—'; if (m < 1000) return `${fmt(m, 3)} m`; if (m < 1e8) return `${fmt(m / 1000, 3)} km`; if (m < 1e13) return `${fmt(m / 1.496e11, 3)} × Earth–Sun`; return `${fmt(m / 9.46e15, 3)} light-years`; }
function fmtV(mv) { return mv >= 1e6 ? `${fmt(mv / 1e6, 3)} TV` : mv >= 1e3 ? `${fmt(mv / 1e3, 3)} GV` : mv >= 1 ? `${fmt(mv, 3)} MV` : `${fmt(mv * 1e3, 3)} kV`; }
function hl(sec) { const y = sec / 31557600; return sec < 60 ? `${sec.toPrecision(2)} s` : sec < 86400 ? `${(sec / 3600).toPrecision(2)} h` : y < 1 ? `${(sec / 86400).toPrecision(2)} d` : y < 1e6 ? `${y.toPrecision(3)} y` : `${(y / 1e9).toPrecision(3)} Gy`; }
