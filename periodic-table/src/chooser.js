import { h, $, fmtTime } from './util.js';
import { ELEMENTS, CATEGORIES, bySym, searchElements } from './store.js';
import { nuclideLabelHTML } from './nuclear.js';

const PARTICLE_NAMES = { p: 'Proton', n: 'Neutron', 'e-': 'Electron', 'e+': 'Positron', pbar: 'Antiproton', alpha: 'Alpha (He-4)' };
const PARTICLE_SYMS = { p: 'p', n: 'n', 'e-': 'e⁻', 'e+': 'e⁺', pbar: 'p̄', alpha: 'α' };

// A button that shows the chosen nucleus/particle and opens the chooser.
// value: nuclide record or particle key. particles: list of particle keys allowed.
export function nuclideButton({ value, onPick, particles = [], title = 'Choose a nucleus' }) {
  const btn = h('button', { type: 'button', class: 'nuc-btn' });
  let cur = value;
  const render = () => {
    if (typeof cur === 'string') btn.replaceChildren(h('span', { class: 'nl', style: { fontSize: '22px' } }, PARTICLE_SYMS[cur]), h('span', { class: 'nm' }, PARTICLE_NAMES[cur]), h('span', { class: 'chev' }, 'Change ▾'));
    else btn.replaceChildren(h('span', { html: nuclideLabelHTML(cur) }), h('span', { class: 'nm' }, `${bySym[cur.sym].name}-${cur.a}${cur.iso ? 'm' : ''}`), h('span', { class: 'chev' }, 'Change ▾'));
  };
  btn.addEventListener('click', () => openChooser({ title, current: cur, particles, onPick: v => { cur = v; render(); onPick(v); } }));
  render();
  return { root: btn, set(v) { cur = v; render(); }, get value() { return cur; } };
}

export function openChooser({ title, current, particles = [], onPick }) {
  const box = $('#chooser');
  let el = typeof current === 'object' && current ? bySym[current.sym] : bySym.U;
  const isoBox = h('div', { class: 'iso-list' });
  const elName = h('h3', {});
  const search = h('input', { type: 'search', placeholder: 'Search element: gold, Fe, 92…', 'aria-label': 'Search element', style: { width: '100%' } });
  const grid = h('div', { class: 'mini-pt' });
  const close = () => { box.hidden = true; document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const pick = v => { close(); onPick(v); };

  function showIsotopes() {
    elName.textContent = `${el.name} (${el.sym}, Z = ${el.n}): pick an isotope`;
    const list = el.isotopes.slice().sort((a, b) => a.a - b.a || (a.iso ? 1 : -1));
    isoBox.replaceChildren(...list.map(r => h('button', { class: r.hl === -1 ? 'stable' : '', title: r.hl === -1 ? 'stable' : r.hl ? `half-life ${fmtTime(r.hl)}` : 'very short-lived', onclick: () => pick(r) },
      h('span', { html: `${el.sym}-${r.a}${r.iso || ''}` }), h('small', {}, r.hl === -1 ? (r.ab ? `${+(r.ab * 100).toPrecision(3)}%` : 'stable') : r.hl ? fmtTime(r.hl).replace(' years', ' y').replace(' million', 'M').replace(' billion', 'G') : '< ms'))));
    for (const b of grid.querySelectorAll('button')) b.classList.toggle('on', b.dataset.sym === el.sym);
  }
  for (const e of ELEMENTS) {
    const b = h('button', { 'data-sym': e.sym, title: e.name, style: { '--c': CATEGORIES[e.cat].color, gridColumn: e.x, gridRow: e.y >= 9 ? e.y : e.y }, onclick: () => { el = e; showIsotopes(); } }, e.sym);
    grid.append(b);
  }
  grid.append(h('div', { class: 'gap', style: { gridRow: 8 } }));
  search.addEventListener('input', () => { const r = searchElements(search.value); if (r[0]) { el = r[0]; showIsotopes(); } });
  search.addEventListener('keydown', e => { if (e.key === 'Enter') { const r = searchElements(search.value); if (r[0]) { el = r[0]; showIsotopes(); } } });

  box.replaceChildren(h('div', { class: 'box', role: 'dialog', 'aria-label': title },
    h('div', { class: 'panel-title' }, h('h2', { style: { fontSize: '24px' } }, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, '✕')),
    particles.length ? h('div', { class: 'field' }, h('label', {}, 'Particles'), h('div', { class: 'parts-row' }, particles.map(p => h('button', { class: 'btn', onclick: () => pick(p) }, `${PARTICLE_SYMS[p]}  ${PARTICLE_NAMES[p]}`)))) : '',
    search,
    h('div', { class: 'field' }, h('label', {}, 'Tap an element'), grid),
    h('div', { class: 'field' }, elName, isoBox,
      h('button', { class: 'btn primary', style: { justifySelf: 'start' }, onclick: () => pick(el.mainIso) }, `Use the most common: ${el.sym}-${el.mainIso.a}`))));
  box.hidden = false;
  box.onclick = e => { if (e.target === box) close(); };
  showIsotopes();
  if (matchMedia('(pointer: fine)').matches) setTimeout(() => search.focus(), 50);
}
export { PARTICLE_NAMES, PARTICLE_SYMS };
