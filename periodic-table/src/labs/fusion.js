import { h, fmt, sci, fmtEnergy } from '../util.js';
import { findNuclide } from '../store.js';
import { qValue, resolve, coulombBarrier, fusionChannels, nuclideLabelHTML } from '../nuclear.js';
import { bindingCurve, reactionAnim, K_B, J_PER_MEV, KG_PER_U } from './shared.js';
import { nuclideButton } from '../chooser.js';
import { smashLab } from './smash.js';
import { particle, whatIfFused } from './colliderPhysics.js';

const PRESETS = [
  { name: 'Deuterium + tritium', where: 'ITER, NIF and future power plants', ins: ['H-2', 'H-3'], outs: ['He-4', 'n'], note: 'The easiest fusion reaction to ignite on Earth. NIF achieved more fusion energy out than laser energy in for the first time in December 2022.' },
  { name: 'Proton-proton', where: 'Core of the Sun, step 1', ins: ['H-1', 'H-1'], outs: ['H-2', 'e+', 'ν'], note: 'So slow (it needs the weak force) that an average proton in the Sun waits billions of years. That is why the Sun lasts 10 billion years.' },
  { name: 'Helium-3 + helium-3', where: 'Core of the Sun, final pp-chain step', ins: ['He-3', 'He-3'], outs: ['He-4', 'H-1', 'H-1'], note: 'The pp chain as a whole turns four protons into helium-4, releasing 26.7 MeV.' },
  { name: 'Deuterium + deuterium', where: 'Fusion experiments', ins: ['H-2', 'H-2'], outs: ['He-3', 'n'], note: 'Half the time it makes helium-3 and a neutron, the other half tritium and a proton.' },
  { name: 'Deuterium + helium-3', where: 'Proposed neutron-free reactors', ins: ['H-2', 'He-3'], outs: ['He-4', 'H-1'], note: 'Releases no neutrons, but helium-3 is rare on Earth. The Moon\'s soil has some, deposited by the solar wind.' },
  { name: 'Proton + boron-11', where: 'Aneutronic fusion research', ins: ['H-1', 'B-11'], outs: ['He-4', 'He-4', 'He-4'], note: 'Makes three helium nuclei and no neutrons, but needs temperatures around a billion kelvin.' },
  { name: 'Triple-alpha', where: 'Red giant cores, 100 million K', ins: ['He-4', 'He-4', 'He-4'], outs: ['C-12', 'γ'], note: 'Three helium nuclei make carbon via a short-lived beryllium-8. The source of the carbon in every living thing.' },
  { name: 'CNO cycle step', where: 'Stars heavier than the Sun', ins: ['N-14', 'H-1'], outs: ['O-15', 'γ'], note: 'The slowest step of the carbon-nitrogen-oxygen cycle, which is why stars pile up nitrogen.' },
  { name: 'Carbon + helium', where: 'Helium burning in stars', ins: ['C-12', 'He-4'], outs: ['O-16', 'γ'], note: 'Decides how much carbon versus oxygen a star makes. Its rate is one of the most important numbers in astrophysics.' },
  { name: 'Carbon burning', where: 'Massive stars, 600 million K', ins: ['C-12', 'C-12'], outs: ['Ne-20', 'He-4'], note: 'Lasts only a few hundred years in a 25-solar-mass star.' },
  { name: 'Neon burning', where: 'Massive stars, 1.5 billion K', ins: ['Ne-20', 'He-4'], outs: ['Mg-24', 'γ'], note: 'Gamma rays knock alpha particles off neon; other neon nuclei capture them to make magnesium. Lasts about a year.' },
  { name: 'Oxygen burning', where: 'Massive stars, 2 billion K', ins: ['O-16', 'O-16'], outs: ['Si-28', 'He-4'], note: 'Lasts about six months.' },
  { name: 'Silicon burning (net)', where: 'The final day of a massive star', ins: ['Si-28', 'Si-28'], outs: ['Ni-56', 'γ'], note: 'Really a network of photodisintegration and alpha captures. Builds nickel-56, which decays into iron.' },
  { name: 'Iron + iron', where: 'Nowhere: it costs energy', ins: ['Fe-56', 'Fe-56'], outs: ['Te-112', 'γ'], note: 'Iron sits at the top of the binding energy curve, so fusing it absorbs energy. This is why massive star cores collapse once they are iron.' },
];

const STAGES = [
  ['Hydrogen', '38 million K', '7 million years', '#6fb6ff', 1],
  ['Helium', '180 million K', '700,000 years', '#9fd3ff', 6],
  ['Carbon', '800 million K', '300 years', '#ffe08a', 9],
  ['Neon', '1.6 billion K', '1 year', '#ffb347', 10],
  ['Oxygen', '2 billion K', '6 months', '#ff9f6b', 11],
  ['Silicon', '3.3 billion K', '1 day', '#ff6b8a', 12],
];

export function buildFusion(root, { openElement } = {}) {
  const smash = smashLab({ a: findNuclide('H-2'), b: findNuclide('H-3'), energy: 0.1, openElement });
  const anim = reactionAnim({ height: 260 });
  const curve = bindingCurve({ height: 280 });
  const eq = h('div', { class: 'eq' });
  const stats = h('div', { class: 'stat-grid' });
  const note = h('div', { class: 'note' });
  const channels = h('div', { class: 'stack', style: { gap: '6px' } });
  let A = findNuclide('H-2'), B = findNuclide('H-3');
  const pa = nuclideButton({ value: A, title: 'Nucleus A', particles: ['p', 'n'], onPick: r => { A = typeof r === 'string' ? findNuclide(r === 'p' ? 'H-1' : 'H-1') : r; if (r === 'n') A = null; custom(r === 'n'); } });
  const pb = nuclideButton({ value: B, title: 'Nucleus B', onPick: r => { B = r; custom(); } });

  function show(ins, outs, text, where) {
    const q = qValue(ins, outs);
    const I = ins.map(resolve), O = outs.map(resolve);
    eq.innerHTML = I.map(p => (p.nuc ? nuclideLabelHTML(p.nuc) : p.label)).join(' <span class="op">+</span> ') + ' <span class="op">→</span> ' + O.map(p => (p.nuc ? nuclideLabelHTML(p.nuc) : p.label)).join(' <span class="op">+</span> ') + ` <span class="q">${q >= 0 ? '+' : ''}${q.toFixed(3)} MeV</span>`;
    const nuclei = I.filter(p => p.nuc);
    const barrier = nuclei.length >= 2 ? coulombBarrier(nuclei[0].z, nuclei[0].a, nuclei[1].z, nuclei[1].a) : 0;
    const massIn = I.reduce((s, p) => s + p.m, 0), massOut = O.reduce((s, p) => s + p.m, 0);
    const jPerKg = q * J_PER_MEV / (massIn * KG_PER_U);
    stats.replaceChildren(
      st('Energy released (Q)', fmtEnergy(q)),
      st('Mass turned into energy', `${fmt(((massIn - massOut) / massIn) * 100, 3)}%`),
      st('Coulomb barrier', barrier ? fmtEnergy(barrier) : '—'),
      st('Barrier as temperature', barrier ? `${sci(barrier / K_B, 2)} K` : '—'),
      st('Energy per kg of fuel', q > 0 ? `${sci(jPerKg, 3)} J` : '—'),
      st('vs. burning petrol', q > 0 ? `${sci(jPerKg / 4.6e7, 2)}×` : 'absorbs energy'),
      st('vs. TNT', q > 0 ? `${sci(jPerKg / 4.184e6, 2)}×` : '—'),
      st('Where', where || '—'));
    note.textContent = text || '';
    note.hidden = !text;
    anim.set(ins, outs, q, q >= 0 ? 'rgba(242,184,75,1)' : 'rgba(255,107,107,1)');
    curve.mark([...ins.map(l => ({ label: l, color: '#8fdcff' })), ...outs.map(l => ({ label: l, color: '#7cf29a' }))]);
  }
  function custom(neutron) {
    if (neutron) { channels.replaceChildren(h('p', { class: 'hint-text' }, 'For neutrons use the collider above or the Fission lab.')); return; }
    if (!A || !B) return;
    const ch = fusionChannels(A, B);
    if (!ch.length) {
      const wf = whatIfFused(particle('ion', A), particle('ion', B), 0);
      channels.replaceChildren(h('div', { class: 'note' }, h('b', {}, `${A.label} + ${B.label} → ${wf.name}. `), `No such nucleus has ever been observed, so the energy comes from the liquid-drop model: merging would ${wf.Q >= 0 ? 'release' : 'cost'} ${fmt(Math.abs(wf.Q), 4)} MeV. ${wf.fate} Use "Collide any two nuclei" above to see what actually happens at each energy.`));
      smash.set(A, B);
      return;
    }
    const pick = i => {
      const c = ch[i];
      show([A.label, B.label], c.products, `Compound nucleus ${ch[0].products[0]} forms, then ${c.text}. ${c.q < 0 ? 'Negative Q: this reaction needs energy put in.' : ''}`, 'Custom reaction');
      [...channels.children].forEach((b, k) => b.classList.toggle('on', k === i));
    };
    channels.replaceChildren(...ch.map((c, i) => h('button', { class: 'src-btn', style: { '--c': c.q >= 0 ? '#ffd27a' : '#ff6b7d' }, onclick: () => pick(i) },
      h('span', { class: 'dot' }), h('span', { html: `→ ${c.products.map(p => { const r = findNuclide(p); return r ? nuclideLabelHTML(r) : p; }).join(' + ')} <span class="muted" style="font-size:12px">${c.text}</span>` }), h('span', { class: 'n' }, `${c.q >= 0 ? '+' : ''}${c.q.toFixed(2)} MeV`))));
    pick(0);
    smash.set(A, B);
  }

  const presetBtns = h('div', { class: 'src-list' }, PRESETS.map((p, i) => h('button', { class: 'src-btn', style: { '--c': i === PRESETS.length - 1 ? '#ff6b6b' : '#f2b84b' }, onclick: e => { for (const b of presetBtns.children) b.classList.remove('on'); e.currentTarget.classList.add('on'); show(p.ins, p.outs, p.note, p.where); if (p.ins.length === 2) { const a = findNuclide(p.ins[0]), b = findNuclide(p.ins[1]); A = a; B = b; pa.set(a); pb.set(b); smash.set(a, b); } } },
    h('span', { class: 'dot' }), h('span', {}, h('b', {}, p.name), h('span', {}, p.where)), h('span', { class: 'n' }, `${qValue(p.ins, p.outs).toFixed(1)}`))));

  const stageList = h('div', { class: 'src-list' }, STAGES.map(([n, T, dur, c, pi]) => h('button', { class: 'src-btn', style: { '--c': c }, onclick: () => { const p = PRESETS[pi]; show(p.ins, p.outs, p.note, p.where); } },
    h('span', { class: 'dot' }), h('span', {}, h('b', {}, `${n} burning`), h('span', {}, `${T}`)), h('span', { class: 'n' }, dur))));

  // Lawson criterion calculator
  const ln = h('input', { type: 'number', id: 'law-n', value: '1e20', step: 'any' });
  const lt = h('input', { type: 'number', id: 'law-t', value: '15', step: 'any' });
  const ltau = h('input', { type: 'number', id: 'law-tau', value: '3', step: 'any' });
  const lout = h('div', {});
  const law = () => {
    const p = +ln.value * +lt.value * +ltau.value, need = 3e21, r = p / need;
    lout.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between' } },
      h('span', { class: 'mono' }, `n·T·τ = ${sci(p, 3)} keV·s/m³`),
      h('span', { class: `status ${r >= 1 ? 'crit' : 'sub'}` }, r >= 1 ? 'Ignition: the plasma heats itself' : `${fmt(r * 100, 3)}% of ignition`)));
  };
  for (const x of [ln, lt, ltau]) x.addEventListener('input', law);
  law();

  root.append(h('div', { class: 'lab' },
    h('div', { class: 'lab-head' }, h('div', {},
      h('div', { class: 'eyebrow' }, 'Fusion Lab'),
      h('h1', {}, 'Squeeze nuclei together'),
      h('p', {}, 'Light nuclei release energy when they fuse, because the product is more tightly bound. Energies are computed from measured atomic masses using E = mc².'))),
    smash.root,
    h('h2', { style: { fontSize: '26px', marginTop: '10px' } }, 'Energy released, from the masses'),
    h('div', { class: 'grid2' },
      h('div', { class: 'stack' }, anim.root, h('div', { class: 'card stack' }, eq, stats, note)),
      h('div', { class: 'stack' },
        h('div', { class: 'card stack' }, h('h3', {}, 'Build your own reaction'),
          h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', {}, 'Nucleus A'), pa.root), h('div', { class: 'field' }, h('label', {}, 'Nucleus B'), pb.root)),
          h('p', { class: 'hint-text', style: { margin: 0 } }, 'Any element, any isotope. The ways the new nucleus can break up are ranked by the energy they release.'),
          channels),
        h('div', { class: 'card' }, h('h3', {}, 'Famous reactions'), presetBtns))),
    h('div', { class: 'grid2' },
      h('div', { class: 'card stack' }, h('h3', {}, 'The binding energy curve'), curve.root,
        h('p', { class: 'hint-text', style: { margin: 0 } }, 'The higher a nucleus sits, the more tightly its protons and neutrons are held. Moving up the curve releases energy: fusion climbs from the left, fission from the right. The summit is iron-56 and nickel-62. Blue rings: reactants. Green rings: products.')),
      h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('h3', {}, 'Inside a 25-solar-mass star'), stageList, h('p', { class: 'hint-text' }, 'Each stage burns hotter and faster. The last, silicon, lasts a single day, then the iron core collapses.')),
        h('div', { class: 'card stack' }, h('h3', {}, 'Lawson criterion (D-T reactor)'),
          h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'law-n' }, 'Density n (m⁻³)'), ln), h('div', { class: 'field' }, h('label', { for: 'law-t' }, 'Temperature (keV)'), lt), h('div', { class: 'field' }, h('label', { for: 'law-tau' }, 'Confinement τ (s)'), ltau)),
          lout, h('p', { class: 'hint-text', style: { margin: 0 } }, '1 keV ≈ 11.6 million K. Tokamaks aim for ~15 keV (170 million K), ten times hotter than the Sun\'s core.'))))));

  show(PRESETS[0].ins, PRESETS[0].outs, PRESETS[0].note, PRESETS[0].where);
  presetBtns.children[0].classList.add('on');
  custom();
  show(PRESETS[0].ins, PRESETS[0].outs, PRESETS[0].note, PRESETS[0].where);
  return { show() { anim.start(); smash.start(); smash.run(); requestAnimationFrame(() => curve.draw()); }, hide() { anim.stop(); smash.stop(); } };
}

function st(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v', style: { fontSize: '14px' } }, v)); }
