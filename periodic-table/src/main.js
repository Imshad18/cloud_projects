import { $, $$, h, toast, storeGet, storeSet, themeChanged } from './util.js';
import { ELEMENTS, byZ, bySym, searchElements, CATEGORIES } from './store.js';
import { SOURCES } from './data/origins.js';
import { TableScene } from './scene.js';
import { buildModes } from './colormodes.js';
import { Panel } from './panel.js';
import { Quiz, showCompare } from './quiz.js';

const state = { mode: storeGet('pt.mode2', 'origin'), T: 298, year: 2026, focus: null, view: 'table', compareFrom: null };
const modes = buildModes(() => state.T);
if (!modes[state.mode]) state.mode = 'category';

const scene = new TableScene({ onSelect: select, onHover: hover });
const panel = new Panel({
  onNav: d => { const e = panel.el; if (e) select(byZ[((e.n - 1 + d + 118) % 118) + 1]); },
  onClose: () => { panel.close(); scene.select(null); },
  onCompare: e => { state.compareFrom = e; panel.close(); scene.select(e); toast(`Tap another element to compare with ${e.name}`); },
  onIsotope: r => openView('isotopes', v => v.open(r)),
  onOriginSource: src => { openView('table'); setMode('origin'); state.focus = src; refilter(); renderLegend(); panel.close(); },
});
const quiz = new Quiz({ scene, onEnd: () => { setNav('table'); layoutChrome(); }, onStart: () => layoutChrome() });

// ---------- selection ----------
function select(e) {
  if (!e) return;
  if (quiz.active) { quiz.answer(e); return; }
  if (state.compareFrom && state.compareFrom !== e) { showCompare(state.compareFrom, e); state.compareFrom = null; return; }
  state.compareFrom = null;
  scene.select(e);
  scene.burst(scene.objOf(e), SOURCES[e.dom].color);
  panel.show(e);
  hover(null);
  try { history.replaceState(null, '', '#' + e.sym); } catch { /* sandboxed */ }
}
function hover(e, ev) {
  const tip = $('#tooltip');
  if (!e) { tip.hidden = true; return; }
  const m = modes[state.mode];
  tip.replaceChildren(h('b', {}, `${e.n} · ${e.name}`), h('div', { class: 'muted' }, `${m.label}: ${m.value(e)}`), h('div', { class: 'muted' }, `Born in: ${e.origin.map(o => `${SOURCES[o.src].short} ${o.pct}%`).join(', ')}`));
  tip.hidden = false;
  const x = Math.min(innerWidth - 270, ev.clientX + 14), y = Math.min(innerHeight - 90, ev.clientY + 14);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

// ---------- colour modes, legend, filters ----------
function setMode(k) {
  state.mode = k; state.focus = null; storeSet('pt.mode2', k);
  $('#colorby').value = k;
  $('#temp-row').hidden = k !== 'state';
  layoutChrome();
  scene.applyMode(modes[k]); renderLegend(); refilter();
}
function refilter() {
  const m = modes[state.mode];
  let match = null;
  if (state.focus && m.legend.type === 'cats') { const it = m.legend.items.find(i => i.key === state.focus); if (it) match = it.match; }
  const ghost = state.year < 2026 ? e => e.year > state.year : null;
  scene.applyFilter(match, ghost);
}
function renderLegend() {
  const m = modes[state.mode], L = m.legend, box = $('#legend');
  const kids = [];
  if (L.type === 'cats') {
    kids.push(h('div', { class: 'items' }, L.items.map(it => h('button', { class: `item ${state.focus && state.focus !== it.key ? 'off' : ''}`, onclick: () => { state.focus = state.focus === it.key ? null : it.key; refilter(); renderLegend(); } }, h('span', { class: 'dot', style: { background: it.color } }), it.label))));
  } else {
    kids.push(h('div', { class: 'rampbox' }, h('div', { class: 'eyebrow' }, m.label || ''), h('div', { class: 'bar', style: { background: L.css } }), h('div', { class: 'ends' }, h('span', {}, L.min), h('span', {}, L.max))));
    if (L.extra) kids.push(h('div', { class: 'items' }, L.extra.map(x => h('span', { class: 'item' }, h('span', { class: 'dot', style: { background: x.color } }), x.label))));
  }
  if (m.note) kids.push(h('div', { class: 'lnote' }, m.note));
  box.replaceChildren(...kids);
  layoutChrome();
}
// Keep the legend above the toolbar and tell the 3D camera how much screen is free.
function layoutChrome() {
  requestAnimationFrame(() => {
    if (state.view !== 'table') return;
    const dockEl = $('#dock'), leg = $('#legend'), narrow = innerWidth <= 720;
    const dock = dockEl.getBoundingClientRect();
    if (!narrow && dock.height) leg.style.setProperty('--legend-bottom', `${innerHeight - dock.top + 8}px`);
    const lr = leg.getBoundingClientRect(), hud = $('#quiz-hud');
    let top = $('#topbar').getBoundingClientRect().bottom;
    if (narrow && lr.height) top = Math.max(top, lr.bottom);
    if (!hud.hidden) top = Math.max(top, hud.getBoundingClientRect().bottom);
    let bottom = dock.height ? innerHeight - dock.top : 20;
    if (!narrow && lr.height && lr.top > innerHeight * 0.4) bottom = Math.max(bottom, innerHeight - lr.top);
    scene.setInsets(top + 8, bottom + 8);
  });
}
addEventListener('resize', layoutChrome);
try { const ro = new ResizeObserver(() => layoutChrome()); ro.observe($('#dock')); ro.observe($('#legend')); } catch { /* old browser */ }
document.fonts?.ready?.then(() => layoutChrome());

// ---------- views ----------
const views = {};
const builders = {
  origins: () => import('./labs/origins.js').then(m => m.buildOrigins($('#view-origins'), { openElement: openFromLab, highlightSource: src => { openView('table'); setMode('origin'); state.focus = src; refilter(); renderLegend(); } })),
  isotopes: () => import('./labs/isotopes.js').then(m => m.buildIsotopes($('#view-isotopes'), { openElement: openFromLab })),
  fusion: () => import('./labs/fusion.js').then(m => m.buildFusion($('#view-fusion'), { openElement: openFromLab })),
  fission: () => import('./labs/fission.js').then(m => m.buildFission($('#view-fission'), { openElement: openFromLab })),
  body: () => import('./labs/body.js').then(m => m.buildBody($('#view-body'), { openElement: openFromLab })),
  collider: () => import('./labs/collider.js').then(m => m.buildCollider($('#view-collider'), { openElement: openFromLab })),
};
function openFromLab(e) { openView('table'); select(e); }
function setNav(v) { for (const b of $$('#nav button')) b.classList.toggle('on', b.dataset.view === v); }
async function openView(v, then) {
  if (v === 'quiz') { openView('table'); setNav('quiz'); panel.close(); scene.select(null); quiz.start(); return; }
  if (quiz.active && v !== 'table') quiz.stop();
  for (const [k, inst] of Object.entries(views)) if (k !== v) inst?.hide?.();
  for (const s of $$('.view')) s.hidden = s.id !== `view-${v}`;
  state.view = v; setNav(v);
  const onTable = v === 'table';
  scene.setActive(onTable);
  if (onTable) layoutChrome();
  $('#dock').hidden = !onTable; $('#legend').hidden = !onTable;
  if (!onTable) { panel.close(); scene.select(null); $('#tooltip').hidden = true; }
  if (!onTable) {
    if (!views[v]) views[v] = await builders[v]();
    views[v].show?.();
    then?.(views[v]);
    try { history.replaceState(null, '', '#' + v); } catch { /* sandboxed */ }
  } else if (!panel.open) { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* sandboxed */ } }
}
$('#nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) openView(b.dataset.view); });
$('#brand').addEventListener('click', () => openView('table'));

// ---------- dock ----------
$('#layouts').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  for (const x of $$('#layouts button')) x.classList.toggle('on', x === b);
  scene.setLayout(b.dataset.layout);
  if (b.dataset.layout === 'origins' && state.mode === 'category') setMode('origin');
});
$('#colorby').addEventListener('change', e => setMode(e.target.value));
$('#reset-view').addEventListener('click', () => scene.fitCamera());
const temp = $('#temp');
const setT = T => { state.T = T; temp.value = T; $('#temp-val').textContent = `${T} K (${Math.round(T - 273.15)} °C)`; if (state.mode === 'state') { scene.applyMode(modes.state); refilter(); } };
temp.addEventListener('input', () => setT(+temp.value));
for (const b of $$('#temp-row .marks button')) b.addEventListener('click', () => setT(+b.dataset.t));
const year = $('#year');
year.addEventListener('input', () => {
  state.year = +year.value;
  const n = ELEMENTS.filter(e => e.year <= state.year).length;
  $('#year-val').textContent = state.year >= 2026 ? 'today' : `${state.year === 1650 ? 'antiquity' : state.year} · ${n} known`;
  refilter();
});
const dock = $('#dock'), dt = $('#dock-toggle');
dt.addEventListener('click', () => { dock.classList.toggle('collapsed'); dt.setAttribute('aria-expanded', !dock.classList.contains('collapsed')); layoutChrome(); });
if (innerWidth < 720) { dock.classList.add('collapsed'); dt.setAttribute('aria-expanded', 'false'); }

// ---------- search ----------
const search = $('#search'), results = $('#search-results');
let hl = 0, found = [];
function renderResults() {
  results.replaceChildren(...found.map((e, i) => h('button', { class: i === hl ? 'hl' : '', onmousedown: ev => { ev.preventDefault(); go(e); } },
    h('span', { class: 'sym', style: { '--c': CATEGORIES[e.cat].color } }, e.sym), h('span', {}, h('b', {}, e.name), h('div', { class: 'small muted' }, `${e.n} · ${SOURCES[e.dom].short}`)))));
  results.hidden = !found.length;
}
function go(e) { search.value = ''; found = []; results.hidden = true; search.blur(); openView('table'); select(e); }
search.addEventListener('input', () => { found = searchElements(search.value); hl = 0; renderResults(); });
search.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { hl = Math.min(found.length - 1, hl + 1); renderResults(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); renderResults(); e.preventDefault(); }
  else if (e.key === 'Enter' && found[hl]) go(found[hl]);
  else if (e.key === 'Escape') { search.blur(); results.hidden = true; }
});
search.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 150));

// ---------- keyboard ----------
addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.key === '/') { e.preventDefault(); search.focus(); return; }
  if (!$('#chooser').hidden) return;
  if (e.key === 'Escape') {
    if (!$('#settings').hidden) { $('#settings').hidden = true; return; }
    if (!$('#lightbox').hidden) { $('#lightbox').hidden = true; return; }
    if (!$('#compare').hidden) { $('#compare').hidden = true; return; }
    if (panel.open) { panel.close(); scene.select(null); return; }
    if (state.view !== 'table') openView('table');
    return;
  }
  if (state.view !== 'table') return;
  if (panel.open && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    const c = panel.el; let n = null;
    if (e.key === 'ArrowLeft') n = byZ[c.n - 1]; if (e.key === 'ArrowRight') n = byZ[c.n + 1];
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const dy = e.key === 'ArrowUp' ? -1 : 1; n = ELEMENTS.find(x => x.x === c.x && x.y === c.y + dy); }
    if (n) { e.preventDefault(); select(n); }
    return;
  }
  const lay = ['table', 'sphere', 'helix', 'grid', 'origins', 'timeline'][+e.key - 1];
  if (lay) $(`#layouts button[data-layout="${lay}"]`).click();
});

// ---------- appearance ----------
const look = { theme: storeGet('pt.theme', 'dark'), bg: storeGet('pt.bg', 'stars'), motion: storeGet('pt.motion', true) };
function applyLook() {
  if (look.theme === 'dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = look.theme;
  themeChanged();
  for (const b of $$('#theme-seg button')) b.classList.toggle('on', b.dataset.theme === look.theme);
  for (const b of $$('#bg-seg button')) b.classList.toggle('on', b.dataset.bg === look.bg);
  $('#motion-toggle').checked = look.motion;
  scene.setAppearance(look);
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim();
  storeSet('pt.theme', look.theme); storeSet('pt.bg', look.bg); storeSet('pt.motion', look.motion);
}
$('#settings-btn').addEventListener('click', e => { e.stopPropagation(); const p = $('#settings'); p.hidden = !p.hidden; $('#settings-btn').setAttribute('aria-expanded', String(!p.hidden)); });
addEventListener('click', e => { const p = $('#settings'); if (!p.hidden && !p.contains(e.target) && e.target !== $('#settings-btn')) p.hidden = true; });
$('#theme-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { look.theme = b.dataset.theme; applyLook(); } });
$('#bg-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { look.bg = b.dataset.bg; applyLook(); } });
$('#motion-toggle').addEventListener('change', e => { look.motion = e.target.checked; applyLook(); });
applyLook();

// ---------- boot ----------
$('#colorby').value = state.mode;
setMode(state.mode);
setTimeout(() => scene.setLayout('table', 2.2), 150);
setTimeout(() => $('#loader').classList.add('gone'), 450);
setTimeout(() => $('#loader').remove(), 1200);
const hash = decodeURIComponent(location.hash.slice(1));
if (hash) {
  if (builders[hash] || hash === 'quiz') setTimeout(() => openView(hash), 500);
  else if (bySym[hash]) setTimeout(() => select(bySym[hash]), 1600);
}
