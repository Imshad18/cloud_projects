// "Collide any two nuclei at any energy": shared by the Fusion lab.
import { h, fmt, sci, toast } from '../util.js';
import { byZ } from '../store.js';
import { nuclideLabelHTML, coulombBarrier } from '../nuclear.js';
import { nuclideButton } from '../chooser.js';
import { particle, kinematics, collision, outcome, whatIfFused, fmtE, OMG_MEV } from './colliderPhysics.js';
import { eventCanvas } from './eventView.js';

export function smashLab({ a, b, energy = 1, openElement }) {
  const st = { a, b, KE: energy };
  const ev = eventCanvas({ aspect: 1.6, maxHeight: 420 });
  const aBtn = nuclideButton({ value: a, title: 'Choose nucleus A (the projectile)', particles: ['p', 'n'], onPick: v => { st.a = v; update(); } });
  const bBtn = nuclideButton({ value: b, title: 'Choose nucleus B (the target)', particles: ['p', 'n'], onPick: v => { st.b = v; update(); } });
  const eS = h('input', { type: 'range', id: 'smash-e', min: 0, max: 2400, step: 1 });
  const eV = h('b');
  const eIn = h('input', { type: 'number', id: 'smash-ein', step: 'any', min: '0' });
  const eU = h('select', { id: 'smash-eu', style: { width: 'auto' } }, [['eV', 1e-6], ['keV', 1e-3], ['MeV', 1], ['GeV', 1e3], ['TeV', 1e6], ['PeV', 1e9], ['EeV', 1e12], ['ZeV', 1e15]].map(([l, v]) => h('option', { value: v }, l)));
  const title = h('h2', {}), text = h('p', { style: { margin: 0 } }), extra = h('div', { class: 'stack', style: { gap: '10px' } });
  const stats = h('div', { class: 'stat-grid' });
  const marks = h('div', { class: 'marks' });
  let res, P, T, col;
  const pOf = v => (typeof v === 'string' ? particle(v) : particle('ion', v));
  const setMarks = () => {
    const Vc = P.Z && T.Z && P.A && T.A ? coulombBarrier(P.Z, P.A, T.Z, T.A) * (P.A + T.A) / T.A : 0; // lab energy to reach the barrier
    const list = [['Sun core', 1.3e-3], ['ITER plasma', 0.015]];
    if (Vc) list.push(['Coulomb barrier', Vc], ['2× barrier', 2 * Vc]);
    list.push(['1 GeV per nucleon', 1000 * (P.A || 1)], ['LHC energy', 6.8e6 * (P.A || 1)], ['OMG particle', OMG_MEV], ['10× OMG', 10 * OMG_MEV]);
    marks.replaceChildren(...list.map(([l, v]) => h('button', { onclick: () => { st.KE = v; update(); run(); } }, l)));
  };
  function update(fromInput) {
    P = pOf(st.a); T = pOf(st.b);
    if (!P.A || !T.A) { toast('Pick nuclei or nucleons'); return; }
    const K = kinematics(P, st.KE), K0 = kinematics(T, 0);
    col = collision(P, K, T, K0, 'fixed');
    res = outcome(P, K, T, K0, 'fixed', col);
    eS.value = Math.round((Math.log10(st.KE) + 6) * 100);
    eV.textContent = `${fmtE(st.KE)} (${fmtE(col.Ecm)} in the centre of mass)`;
    if (!fromInput) { let u = 1e-6; for (const x of [1e-6, 1e-3, 1, 1e3, 1e6, 1e9, 1e12, 1e15]) if (st.KE >= x) u = x; eIn.value = +(st.KE / u).toPrecision(5); eU.value = u; }
    setMarks();
    const Vcm = P.Z && T.Z ? coulombBarrier(P.Z, P.A, T.Z, T.A) : 0;
    stats.replaceChildren(s('Collision energy (CM)', fmtE(col.Ecm)), s('Coulomb barrier', Vcm ? fmtE(Vcm) : 'none (neutral)'), s('Energy ÷ barrier', Vcm ? fmt(col.Ecm / Vcm, 3) : '—'), s('Speed of A', `${K.beta < 0.999 ? (K.beta * 100).toPrecision(4) : '99.9…'}% of c`), s('Temperature equivalent', `${sci(col.Ecm / 8.617e-11, 2)} K`));
    title.textContent = res.title; text.textContent = res.text;
    extra.replaceChildren();
    const prods = [...(res.product || []), ...(res.fragments || [])].filter(Boolean);
    if (prods.length) extra.append(h('div', { class: 'el-chips' }, prods.map(r => h('button', { class: 'el-chip', style: { '--c': '#f2b84b' }, onclick: () => openElement?.(byZ[r.z]) }, h('span', { html: nuclideLabelHTML(r) }), h('small', {}, r.hl === -1 ? 'stable' : r.hl ? 'radioactive' : 'short-lived')))));
    const wf = col.Ecm < 5e4 ? whatIfFused(P, T, col.Ecm) : null;
    if (wf) extra.append(h('div', { class: 'note' }, h('b', {}, `If they merged: ${wf.name}. `), `Merging ${wf.Q >= 0 ? 'releases' : 'costs'} ${fmt(Math.abs(wf.Q), 4)} MeV${wf.measured ? '' : ' (liquid-drop estimate)'}. ${wf.fate}`));
    if (st.KE > 1e8) extra.append(h('p', { class: 'hint-text', style: { margin: 0 } }, `At this energy the collision is far above nuclear scales: the nuclei dissolve into quarks and gluons and thousands of new particles. ${st.KE >= OMG_MEV * 0.5 ? 'This is the energy of the Oh-My-God cosmic ray (1991), the most energetic particle ever recorded.' : ''}`));
  }
  function run() {
    if (!res) return;
    const heavy = res.view === 'detector';
    ev.show(heavy
      ? { kind: 'nuclear', anim: st.KE > 1e8 ? 'shower' : 'shatter', a1: P.A, a2: T.A, fragments: res.fragments || [], caption: res.title, label1: P.label, label2: T.label }
      : { kind: 'nuclear', anim: res.anim, a1: P.A, a2: T.A, product: res.product, productLabels: res.productLabels, fragments: res.fragments, newElement: res.newElement, quasi: res.quasi, quasiLabels: res.quasiLabels, supercritical: res.supercritical, label1: P.label, label2: T.label, closest: res.channels.find(c => c[0] === 'closest approach')?.[1], caption: res.title });
  }
  eS.addEventListener('input', () => { st.KE = Math.pow(10, eS.value / 100 - 6); update(); });
  eS.addEventListener('change', run);
  const applyE = () => { const v = +eIn.value * +eU.value; if (v > 0) { st.KE = v; update(true); run(); } };
  eIn.addEventListener('change', applyE); eU.addEventListener('change', applyE);
  ev.root.classList.add('stage', 'stage-tall'); ev.root.style.aspectRatio = ''; ev.root.style.maxHeight = '';
  const stage = ev.root;
  const result = h('div', { class: 'card result' }, title, text, stats, extra);
  const controls = h('div', { class: 'stack', style: { gap: '12px' } },
    h('div', { class: 'field' }, h('label', {}, 'Nucleus A (moving)'), aBtn.root), h('div', { class: 'field' }, h('label', {}, 'Nucleus B (target)'), bBtn.root),
    h('div', { class: 'field' }, h('label', { for: 'smash-e' }, 'Energy of A', eV), eS, marks),
    h('div', { class: 'field' }, h('label', { for: 'smash-ein' }, 'Exact energy'), h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, eIn, eU)),
    h('button', { class: 'btn primary big', onclick: () => { run(); if (innerWidth <= 900) stage.scrollIntoView({ behavior: 'smooth' }); } }, 'Collide'));
  const root = h('div', {}, stage, result, controls);
  update();
  return {
    root, stage, result, controls, start: () => ev.start(), stop: () => ev.stop(), run,
    set(a1, b1, e1) { st.a = a1; st.b = b1; if (e1) st.KE = e1; aBtn.set(a1); bBtn.set(b1); update(); run(); },
    get a() { return st.a; }, get b() { return st.b; },
  };
}
function s(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v' }, String(v))); }
