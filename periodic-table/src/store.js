import { ELEMENTS } from './data/elements.js';
import { NUCLIDES } from './data/nuclides.js';
import { originOf, dominant, ORIGIN_NOTES } from './data/origins.js';
import { YEAR, INFO, ABUNDANCE, BODY } from './data/extras.js';

export const CATEGORIES = {
  'alkali metal': { label: 'Alkali metals', color: '#ff7a6b' },
  'alkaline earth metal': { label: 'Alkaline earth metals', color: '#ffb35c' },
  'transition metal': { label: 'Transition metals', color: '#f2d45c' },
  'post-transition metal': { label: 'Post-transition metals', color: '#9fd66b' },
  'metalloid': { label: 'Metalloids', color: '#5fd4a8' },
  'reactive nonmetal': { label: 'Reactive nonmetals', color: '#5cc8f0' },
  'noble gas': { label: 'Noble gases', color: '#8a9dff' },
  'lanthanide': { label: 'Lanthanides', color: '#d88bf5' },
  'actinide': { label: 'Actinides', color: '#f58bc4' },
  'unknown': { label: 'Unknown properties', color: '#9aa2b8' },
};

export const bySym = {};
export const byZ = [];
export const bySymLower = {};

for (const e of ELEMENTS) {
  e.year = YEAR[e.sym];
  const info = INFO[e.sym] || ['', ''];
  e.uses = info[0]; e.etym = info[1];
  e.origin = originOf(e);
  e.dom = dominant(e);
  e.originNote = ORIGIN_NOTES[e.sym];
  e.abund = ABUNDANCE[e.sym];
  e.body = BODY[e.sym];
  e.isotopes = [];
  bySym[e.sym] = e; byZ[e.n] = e; bySymLower[e.sym.toLowerCase()] = e;
}

export const nucByKey = {};
for (const r of NUCLIDES) {
  r.n = r.a - r.z;
  r.key = `${r.z}-${r.a}${r.iso || ''}`;
  r.sym = byZ[r.z].sym;
  r.label = `${r.sym}-${r.a}${r.iso || ''}`;
  nucByKey[r.key] = r;
  byZ[r.z].isotopes.push(r);
}
for (const e of ELEMENTS) {
  const stable = e.isotopes.filter(i => i.hl === -1);
  e.stableCount = stable.length;
  const withHl = e.isotopes.filter(i => i.hl > 0);
  e.longest = withHl.sort((a, b) => b.hl - a.hl)[0];
  e.radioactive = stable.length === 0;
  // Most abundant isotope, or the longest-lived one for radioactive elements.
  e.mainIso = e.isotopes.filter(i => !i.iso).sort((a, b) => b.ab - a.ab)[0];
  if (!e.mainIso.ab && e.longest) e.mainIso = e.longest;
}
export const NUCS = NUCLIDES;
export { ELEMENTS };

// Parse "U-235", "u235", "235U", "Tc-99m", "n", "p", "d", "t", "alpha".
const ALIAS = { p: [1, 1], d: [1, 2], t: [1, 3], alpha: [2, 4], a: [2, 4], α: [2, 4] };
export function findNuclide(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (ALIAS[s.toLowerCase()]) { const [z, a] = ALIAS[s.toLowerCase()]; return nucByKey[`${z}-${a}`]; }
  let m = s.match(/^([A-Za-z]{1,2})[- ]?(\d{1,3})(m?)$/) || null;
  let sym, a, iso;
  if (m) { [, sym, a, iso] = m; } else {
    m = s.match(/^(\d{1,3})(m?)[- ]?([A-Za-z]{1,2})$/);
    if (!m) return null;
    [, a, iso, sym] = m;
  }
  const el = bySymLower[sym.toLowerCase()];
  if (!el) return null;
  return nucByKey[`${el.n}-${+a}${iso || ''}`] || null;
}
export const nuc = (z, a, iso = '') => nucByKey[`${z}-${a}${iso}`];
export function nucFromLabel(label) { return findNuclide(label); }

export function searchElements(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  if (/^\d+$/.test(q)) { const e = byZ[+q]; return e ? [e] : []; }
  const out = [];
  for (const e of ELEMENTS) {
    const name = e.name.toLowerCase(), sym = e.sym.toLowerCase();
    let score = 0;
    if (sym === q) score = 100;
    else if (name === q) score = 95;
    else if (name.startsWith(q)) score = 80;
    else if (sym.startsWith(q)) score = 70;
    else if (name.includes(q)) score = 50;
    else if ((e.etym || '').toLowerCase().includes(q) || (e.uses || '').toLowerCase().includes(q)) score = 20;
    if (score) out.push([score, e]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, 8).map(x => x[1]);
}
