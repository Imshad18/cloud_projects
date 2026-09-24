import { h, fmt } from '../util.js';
import { ELEMENTS, bySym } from '../store.js';
import { SOURCES, SOURCE_ORDER } from '../data/origins.js';
import { BODY } from '../data/extras.js';
import { OriginAnim } from '../originAnim.js';
import { workspace, group, tabs } from './ui.js';

const EVENTS = [
  ['0', 'The Big Bang', 'Space, time and energy begin expanding from a hot, dense state 13.8 billion years ago.', 'BB'],
  ['1 µs', 'Protons and neutrons', 'The quark-gluon plasma cools enough for quarks to bind into protons and neutrons.', 'BB'],
  ['3 min', 'First nuclei', 'Big Bang nucleosynthesis fuses deuterium, helium and a trace of lithium in about 17 minutes.', 'BB'],
  ['380 kyr', 'First atoms', 'Nuclei capture electrons. Light streams free: we still see it as the cosmic microwave background.', 'BB'],
  ['~200 Myr', 'First stars', 'Giant stars of pure hydrogen and helium ignite, live a few million years and explode, seeding carbon, oxygen and iron.', 'MS'],
  ['~1 Gyr', 'White dwarfs explode', 'Type Ia supernovae begin adding most of the universe\'s iron, nickel and manganese.', 'WD'],
  ['~1 Gyr', 'Neutron stars collide', 'Kilonovae spray gold, platinum and uranium into galaxies. Europium in old stars traces them.', 'NS'],
  ['9.2 Gyr', 'Sun and Earth form', '4.6 billion years ago a gas cloud enriched by billions of years of stellar deaths collapses into our Solar System.', 'LM'],
  ['11.8 Gyr', 'Natural nuclear reactor', 'Two billion years ago, uranium ore at Oklo in Gabon ran as a natural fission reactor for hundreds of thousands of years.', 'RD'],
  ['1937', 'First human-made element', 'Technetium is identified in molybdenum bombarded in a cyclotron at Berkeley.', 'HS'],
  ['2017', 'Kilonova seen', 'GW170817: gravitational waves and light from a neutron star merger show heavy elements being made.', 'NS'],
  ['13.8 Gyr', 'Today', 'Stars keep forging elements. Every atom heavier than helium in your body was made inside a star.', 'LM'],
];

export function buildOrigins(root, { openElement, highlightSource }) {
  let cur = 'NS';
  const canvas = h('canvas', { 'aria-label': 'Animation of the selected source' });
  const anim = new OriginAnim(canvas);
  const title = h('h2', { style: { fontSize: '22px' } });
  const meta = h('div', { class: 'stat-grid' });
  const text = h('div', { class: 'prose' });
  const journey = h('ol', { class: 'journey' });
  const chips = h('div', { class: 'el-chips' });
  const chipTitle = h('h3', {});
  const list = h('div', { class: 'src-list' });

  const counts = {};
  for (const e of ELEMENTS) for (const o of e.origin) counts[o.src] = (counts[o.src] || 0) + 1;

  function render() {
    const s = SOURCES[cur];
    anim.set(cur); anim.start();
    title.textContent = s.name; title.style.color = s.color;
    meta.replaceChildren(stat('Process', s.process), stat('When', s.when), stat('Where', s.where));
    text.replaceChildren(h('p', {}, s.text));
    journey.style.setProperty('--c', s.color);
    journey.replaceChildren(...s.journey.map(j => h('li', {}, j)));
    const els = ELEMENTS.map(e => [e, e.origin.find(o => o.src === cur)]).filter(x => x[1]).sort((a, b) => b[1].pct - a[1].pct);
    chipTitle.textContent = `${els.length} elements with atoms from ${s.short.toLowerCase()}`;
    chips.replaceChildren(...els.map(([e, o]) => h('button', { class: 'el-chip', style: { '--c': s.color }, title: e.name, onclick: () => openElement(e) }, h('b', {}, e.sym), h('small', {}, `${o.pct}%`))));
    for (const b of list.children) b.classList.toggle('on', b.dataset.k === cur);
  }
  for (const k of SOURCE_ORDER) {
    const s = SOURCES[k];
    list.append(h('button', { class: 'src-btn', 'data-k': k, style: { '--c': s.color }, onclick: () => { cur = k; render(); } },
      h('span', { class: 'dot' }), h('span', {}, h('b', {}, s.name), h('span', {}, s.process)), h('span', { class: 'n' }, counts[k] || 0)));
  }

  // Timeline
  const detail = h('div', { class: 'tl-detail' });
  const axis = h('div', { class: 'axis' });
  const evs = EVENTS.map((ev, i) => {
    const b = h('button', { class: 'ev', title: ev[1], 'aria-label': ev[1], style: { left: `${(i / (EVENTS.length - 1)) * 100}%` }, onclick: () => pick(i) });
    axis.append(b); return b;
  });
  function pick(i) {
    const ev = EVENTS[i];
    evs.forEach((b, k) => b.classList.toggle('on', k === i));
    detail.replaceChildren(h('div', { class: 'eyebrow' }, `${ev[0]} after the Big Bang`.replace('2017 after the Big Bang', 'Year 2017').replace('1937 after the Big Bang', 'Year 1937')), h('b', {}, ev[1]), h('p', { class: 'muted', style: { margin: '4px 0 0' } }, ev[2]));
    cur = ev[3]; render();
  }

  // Body origin
  const mix = {};
  let total = 0;
  for (const [sym, pct] of Object.entries(BODY)) {
    total += pct;
    for (const o of bySym[sym].origin) mix[o.src] = (mix[o.src] || 0) + pct * o.pct / 100;
  }
  const mixArr = SOURCE_ORDER.filter(k => mix[k]).map(k => [k, mix[k] / total * 100]).sort((a, b) => b[1] - a[1]);
  const bodyBar = h('div', { class: 'origin-bar', style: { height: '34px' } }, mixArr.map(([k, p]) => h('button', { title: `${SOURCES[k].name}: ${fmt(p, 2)}%`, style: { flex: p, background: SOURCES[k].color }, onclick: () => { cur = k; render(); } })));
  const bodyLegend = h('div', { class: 'origin-legend' }, mixArr.map(([k, p]) => h('button', { onclick: () => { cur = k; render(); } },
    h('span', { style: { width: '12px', height: '12px', borderRadius: '4px', background: SOURCES[k].color, display: 'block' } }), h('span', {}, SOURCES[k].name), h('span', { class: 'pct' }, `${p.toFixed(1)}%`))));

  const t = tabs([
    { key: 'about', label: 'How it works', body: h('div', { class: 'cols' }, h('div', { class: 'card stack' }, title, text, meta), h('div', { class: 'card stack' }, h('h3', {}, 'Step by step'), journey)) },
    { key: 'made', label: 'Elements made', body: h('div', { class: 'card stack' }, chipTitle, chips, h('button', { class: 'btn primary', style: { alignSelf: 'start' }, onclick: () => highlightSource(cur) }, 'Light them up on the 3D table →')) },
    { key: 'timeline', label: 'Cosmic timeline', body: h('div', { class: 'card stack' }, h('div', { class: 'timeline' }, axis, h('div', { class: 'lbl' }, h('span', {}, 'Big Bang'), h('span', {}, 'Today'))), detail) },
    { key: 'body', label: 'Your body', body: h('div', { class: 'card stack' }, h('p', { class: 'muted', style: { margin: 0 } }, 'Your body mass, weighted by where each element was made. The hydrogen in your water is from the Big Bang; most of your oxygen and carbon came from dying stars.'), bodyBar, bodyLegend) },
  ]);
  workspace(root, {
    eyebrow: 'Cosmic Origins', title: 'Where every atom was born', intro: 'Eight cosmic factories made the elements. Pick one to watch it work and see everything it forged.',
    side: [group('Cosmic factories', list)],
    main: [h('div', { class: 'stage stage-tall' }, canvas), t.root],
  });
  pick(6);
  return { show() { anim.start(); render(); }, hide() { anim.stop(); } };
}

function stat(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v', style: { fontSize: '13px', fontFamily: 'var(--body)' } }, v)); }
