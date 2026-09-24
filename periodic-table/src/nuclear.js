import { nucByKey, byZ, findNuclide, nuc } from './store.js';

export const U = 931.49410242;          // MeV per atomic mass unit
export const M_N = 1.00866491595;       // neutron mass (u)
export const M_H = 1.00782503223;       // hydrogen-1 atom (u)
export const M_E = 0.000548579909;      // electron (u)
export const ME_MEV = 0.51099895;
export const MP_MEV = 938.27208816;
export const MN_MEV = 939.56542052;
export const C = 299792458;
export const MEV_J = 1.602176634e-13;
export const HBARC = 197.3269804;       // MeV fm
export const AVOGADRO = 6.02214076e23;

export function bindingEnergy(r) {
  return (r.z * M_H + r.n * M_N - r.m) * U;
}
export const bePerNucleon = r => (r.a > 1 ? bindingEnergy(r) / r.a : 0);

// Particles usable in reactions, with their mass in the neutral-atom bookkeeping used by Q values.
export const PARTICLES = {
  n: { label: 'n', name: 'neutron', z: 0, a: 1, m: M_N, charge: 0 },
  'e+': { label: 'e⁺', name: 'positron', z: -1, a: 0, m: 2 * M_E, charge: 1, lepton: true },
  ν: { label: 'ν', name: 'neutrino', z: 0, a: 0, m: 0, charge: 0 },
  γ: { label: 'γ', name: 'gamma ray', z: 0, a: 0, m: 0, charge: 0 },
};

// A reaction side is a list of tokens: nuclide labels ("H-2"), or particle keys ("n", "γ").
export function resolve(tok) {
  if (PARTICLES[tok]) return { ...PARTICLES[tok], tok };
  const r = findNuclide(tok);
  if (!r) return null;
  return { label: r.label, name: `${byZ[r.z].name}-${r.a}`, z: r.z, a: r.a, m: r.m, charge: r.z, nuc: r, tok };
}

export function qValue(ins, outs) {
  const I = ins.map(resolve), O = outs.map(resolve);
  if (I.includes(null) || O.includes(null)) return null;
  const sum = arr => arr.reduce((s, x) => s + x.m, 0);
  return (sum(I) - sum(O)) * U;
}

export function radius(a) { return 1.2 * Math.cbrt(a); } // fm

// Coulomb barrier between two nuclei (MeV), touching-spheres estimate.
export function coulombBarrier(z1, a1, z2, a2) {
  if (!z1 || !z2) return 0;
  const R = 1.44 * (Math.cbrt(a1) + Math.cbrt(a2)) + 0.5; // slightly larger r0 for barrier position
  return 1.44 * z1 * z2 / R;
}

// Fusion of two nuclides: compound nucleus and exit channels, sorted by Q.
export function fusionChannels(r1, r2) {
  const Z = r1.z + r2.z, A = r1.a + r2.a;
  const cands = [
    { out: [[Z, A], 'γ'], text: 'γ (radiative capture)' },
    { out: [[Z, A - 1], 'n'], text: 'neutron emitted' },
    { out: [[Z - 1, A - 1], [1, 1]], text: 'proton emitted' },
    { out: [[Z - 2, A - 4], [2, 4]], text: 'alpha emitted' },
    { out: [[Z, A - 2], 'n', 'n'], text: 'two neutrons emitted' },
  ];
  const res = [];
  for (const c of cands) {
    const products = [];
    let ok = true;
    for (const o of c.out) {
      if (typeof o === 'string') products.push(o);
      else { const r = nuc(o[0], o[1]); if (!r || o[0] < 1 || o[1] < 1 || r.hl == null) { ok = false; break; } products.push(r.label); }
    }
    if (!ok) continue;
    const q = qValue([r1.label, r2.label], products);
    if (q == null) continue;
    res.push({ products, q, text: c.text });
  }
  return res.sort((a, b) => b.q - a.q);
}

// Follow the most probable decay path until a stable nuclide.
export function decayChain(r, max = 30) {
  const chain = [{ r, mode: null }];
  let cur = r;
  for (let i = 0; i < max; i++) {
    if (!cur || cur.hl == null || cur.hl < 0 || !cur.pr || !cur.pr.length) break;
    let best = 0;
    for (let k = 1; k < cur.pr.length; k++) if ((cur.bf[k] || 0) > (cur.bf[best] || 0)) best = k;
    const next = cur.pr[best];
    if (next === 'SF') { chain.push({ sf: true, mode: 'SF', bf: cur.bf[best] }); break; }
    const nr = findNuclide(next);
    if (!nr) break;
    chain.push({ r: nr, mode: cur.dm[best], bf: cur.bf[best], branches: cur.pr.length });
    cur = nr;
  }
  return chain;
}

export const MODE_INFO = {
  'α': { color: '#ffd166', text: 'alpha decay: emits a helium-4 nucleus (2 protons + 2 neutrons)' },
  'β-': { color: '#5cc8f0', text: 'beta-minus decay: a neutron turns into a proton, emitting an electron and antineutrino' },
  'β+': { color: '#ff6b8a', text: 'beta-plus decay: a proton turns into a neutron, emitting a positron and neutrino' },
  'EC': { color: '#ff9f6b', text: 'electron capture: the nucleus absorbs an inner electron, turning a proton into a neutron' },
  'β+&EC': { color: '#ff8a7a', text: 'positron emission or electron capture' },
  'IT': { color: '#c9a2ff', text: 'isomeric transition: an excited nucleus releases a gamma ray' },
  'SF': { color: '#7cf29a', text: 'spontaneous fission: the nucleus splits by itself' },
  'n': { color: '#9aa2b8', text: 'neutron emission' },
  'p': { color: '#f5a3a3', text: 'proton emission' },
};
export function modeColor(dm) {
  if (!dm || !dm.length) return '#6b7390';
  const m = dm[0];
  if (MODE_INFO[m]) return MODE_INFO[m].color;
  if (m.startsWith('β+') || m === 'EC') return MODE_INFO['β+'].color;
  if (m.startsWith('β-')) return MODE_INFO['β-'].color;
  if (m.startsWith('α')) return MODE_INFO['α'].color;
  return '#9aa2b8';
}
export function modeText(m) {
  if (MODE_INFO[m]) return MODE_INFO[m].text;
  if (m.startsWith('β-')) return MODE_INFO['β-'].text + ` (${m})`;
  if (m.startsWith('β+') || m.includes('EC')) return MODE_INFO['β+&EC'].text;
  return m;
}

export function nuclideLabelHTML(r) {
  if (!r) return '';
  return `<span class="nl"><span class="ms"><span>${r.a}${r.iso || ''}</span><span>${r.z}</span></span>${r.sym}</span>`;
}
export { nucByKey };

// Semi-empirical (liquid drop) binding energy, MeV. Used for nuclei missing from the mass table.
export function semfBinding(z, a) {
  const n = a - z;
  let d = 0;
  if (z % 2 === 0 && n % 2 === 0) d = 11.18 / Math.sqrt(a); else if (z % 2 === 1 && n % 2 === 1) d = -11.18 / Math.sqrt(a);
  return 15.75 * a - 17.8 * Math.pow(a, 2 / 3) - 0.711 * z * (z - 1) / Math.cbrt(a) - 23.7 * (a - 2 * z) ** 2 / a + d;
}
// Atomic mass in u: measured when available, otherwise liquid-drop estimate.
export function atomicMass(z, a) {
  const r = nuc(z, a);
  if (r) return { m: r.m, measured: true, r };
  return { m: z * M_H + (a - z) * M_N - semfBinding(z, a) / U, measured: false, r: null };
}
// Neutron separation energy (MeV).
export function sepN(z, a) { return (atomicMass(z, a - 1).m + M_N - atomicMass(z, a).m) * U; }
