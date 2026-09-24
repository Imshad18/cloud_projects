import { h } from '../util.js';

// Consistent lab layout: controls in a fixed sidebar, the visual and results in the main area.
export function workspace(view, { eyebrow, title, intro, side, main }) {
  view.classList.add('ws');
  const sideEl = h('aside', { class: 'ws-side' }, h('div', { class: 'ws-title' }, h('div', { class: 'eyebrow' }, eyebrow), h('h1', {}, title), intro ? h('p', {}, intro) : ''), ...side);
  const mainEl = h('div', { class: 'ws-main' }, ...main);
  view.append(h('div', { class: 'workspace' }, sideEl, mainEl));
  return { side: sideEl, main: mainEl };
}
export function group(title, ...kids) { return h('section', { class: 'ws-group' }, title ? h('h3', {}, title) : '', ...kids); }

// Tabs: [{ key, label, body: Node, onShow? }]
export function tabs(defs, initial) {
  const bar = h('div', { class: 'tabbar', role: 'tablist' });
  const panels = h('div', {});
  const map = {};
  for (const d of defs) {
    const b = h('button', { role: 'tab', 'data-k': d.key, onclick: () => show(d.key) }, d.label);
    const p = h('div', { class: 'tabpanel', role: 'tabpanel', hidden: true }, d.body);
    bar.append(b); panels.append(p); map[d.key] = { b, p, d };
  }
  let cur = null;
  function show(k) {
    cur = k;
    for (const [key, x] of Object.entries(map)) { x.b.classList.toggle('on', key === k); x.b.setAttribute('aria-selected', key === k); x.p.hidden = key !== k; }
    requestAnimationFrame(() => map[k]?.d.onShow?.());
  }
  show(initial || defs[0].key);
  return { root: h('div', { class: 'tabs-wrap' }, bar, panels), show, get current() { return cur; } };
}
