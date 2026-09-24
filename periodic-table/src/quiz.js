import { h, $, storeGet, storeSet } from './util.js';
import { ELEMENTS, CATEGORIES, bySym } from './store.js';
import { SOURCES } from './data/origins.js';

const TRICKY = ['Fe', 'Au', 'Ag', 'Pb', 'W', 'K', 'Na', 'Hg', 'Sn', 'Sb', 'Cu'];

function question() {
  const pick = a => a[(Math.random() * a.length) | 0];
  const r = Math.random();
  if (r < 0.25) { const e = pick(ELEMENTS.slice(0, 86)); return { q: `Find ${e.name}`, ok: x => x === e, answer: e }; }
  if (r < 0.4) { const e = bySym[pick(TRICKY)]; return { q: `Which element has the symbol ${e.sym}?`, ok: x => x === e, answer: e }; }
  if (r < 0.55) { const e = pick(ELEMENTS.slice(0, 56)); return { q: `Tap atomic number ${e.n}`, ok: x => x === e, answer: e }; }
  if (r < 0.75) {
    const src = pick(['BB', 'CR', 'NS', 'WD', 'LM', 'MS', 'RD']);
    const s = SOURCES[src];
    const ex = ELEMENTS.filter(e => e.dom === src);
    return { q: `Tap an element made mostly by ${s.name.toLowerCase()}`, ok: x => x.dom === src, answer: ex[0], origin: src };
  }
  if (r < 0.88) {
    const c = pick(['noble gas', 'alkali metal', 'lanthanide', 'metalloid', 'alkaline earth metal']);
    return { q: `Tap any ${CATEGORIES[c].label.toLowerCase().replace(/s$/, '')}`, ok: x => x.cat === c, answer: ELEMENTS.find(e => e.cat === c) };
  }
  const e = pick(ELEMENTS.filter(x => x.uses && x.n < 90));
  return { q: `Which element is used for: ${e.uses.split(',')[0].toLowerCase()}?`, ok: x => x === e, answer: e };
}

export class Quiz {
  constructor({ scene, onEnd, onStart }) {
    this.scene = scene; this.onEnd = onEnd; this.onStart = onStart; this.hud = $('#quiz-hud');
  }
  get active() { return !this.hud.hidden; }
  start() {
    this.round = 0; this.score = 0; this.streak = 0; this.total = 10;
    this.best = storeGet('pt.quizBest', 0);
    this.hud.hidden = false;
    this.next();
    this.onStart?.();
  }
  next() {
    if (this.round >= this.total) return this.finish();
    this.round++; this.q = question(); this.t0 = performance.now(); this.tries = 0;
    this.render();
    cancelAnimationFrame(this.raf);
    const tick = () => { const f = Math.max(0, 1 - (performance.now() - this.t0) / 20000); if (this.bar) this.bar.style.width = f * 100 + '%'; if (f > 0 && this.active) this.raf = requestAnimationFrame(tick); else if (this.active && f === 0) this.reveal(); };
    this.raf = requestAnimationFrame(tick);
  }
  render(msg) {
    this.bar = h('i', {});
    this.hud.replaceChildren(
      h('div', { class: 'meta' }, h('span', {}, `Question `, h('b', {}, `${this.round}/${this.total}`)), h('span', {}, 'Score ', h('b', {}, this.score)), h('span', {}, 'Streak ', h('b', {}, this.streak)), h('span', {}, 'Best ', h('b', {}, this.best)),
        h('span', { style: { marginLeft: 'auto', display: 'flex', gap: '6px' } }, h('button', { class: 'btn', onclick: () => this.reveal() }, 'Skip'), h('button', { class: 'btn', onclick: () => this.stop() }, 'Quit'))),
      h('div', { class: 'q' }, this.q.q),
      msg ? h('div', { class: 'small', style: { color: msg.ok ? 'var(--good)' : 'var(--bad)' } }, msg.text) : '',
      h('div', { class: 'timer' }, this.bar));
  }
  answer(e) {
    if (this.q.ok(e)) {
      const bonus = Math.max(0, Math.round(10 - (performance.now() - this.t0) / 2000));
      const pts = 10 + bonus + this.streak * 2;
      this.score += pts; this.streak++;
      this.scene.flash(e, 'ok'); this.scene.burst(this.scene.objOf(e), '#6ee7a8', 200);
      this.render({ ok: true, text: `Correct! ${e.name}. +${pts}` });
      cancelAnimationFrame(this.raf);
      setTimeout(() => this.next(), 900);
    } else {
      this.streak = 0; this.tries++;
      this.scene.flash(e, 'bad');
      this.render({ ok: false, text: `That's ${e.name}. ${this.tries >= 2 ? 'Showing the answer.' : 'Try again.'}` });
      if (this.tries >= 2) this.reveal();
    }
  }
  reveal() {
    cancelAnimationFrame(this.raf);
    const a = this.q.answer;
    if (a) { this.scene.flash(a, 'hint'); }
    this.streak = 0;
    setTimeout(() => this.next(), 1400);
  }
  finish() {
    cancelAnimationFrame(this.raf);
    if (this.score > this.best) { this.best = this.score; storeSet('pt.quizBest', this.score); }
    this.hud.replaceChildren(h('div', { class: 'q' }, `Final score: ${this.score}`), h('div', { class: 'meta' }, `Best: ${this.best}`),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => this.start() }, 'Play again'), h('button', { class: 'btn', onclick: () => this.stop() }, 'Done')));
  }
  stop() { cancelAnimationFrame(this.raf); this.hud.hidden = true; this.onEnd?.(); }
}

export function showCompare(a, b) {
  const box = $('#compare');
  const rows = [['Atomic number', 'n', ''], ['Atomic mass', 'mass', ' u'], ['Density', 'density', ' g/cm³'], ['Melting point', 'melt', ' K'], ['Boiling point', 'boil', ' K'], ['Electronegativity', 'en', ''], ['1st ionization', 'ie', ' kJ/mol'], ['Discovered', 'year', ''], ['Stable isotopes', 'stableCount', '']];
  const col = e => CATEGORIES[e.cat].color;
  box.replaceChildren(h('div', { class: 'box' },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h2', { style: { fontSize: '18px' } }, `${a.name} vs ${b.name}`), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => { box.hidden = true; } }, '✕')),
    h('div', { class: 'cmp-row' }, h('div', { class: 'l', style: { font: '800 34px var(--display)', color: col(a) } }, a.sym), h('div', { class: 'k' }, 'vs'), h('div', { class: 'r', style: { font: '800 34px var(--display)', color: col(b) } }, b.sym)),
    ...rows.map(([k, key, u]) => {
      const va = a[key], vb = b[key], mx = Math.max(Math.abs(va || 0), Math.abs(vb || 0)) || 1;
      const bar = (v, c) => h('span', { class: 'cmp-bar', style: { width: `${v == null ? 0 : Math.max(2, Math.abs(v) / mx * 100)}%`, background: c } });
      const f = v => (v == null ? '—' : key === 'year' && v < 0 ? `${-v} BCE` : `${+(+v).toPrecision(5)}${u}`);
      return h('div', { class: 'cmp-row' }, h('div', { class: 'l' }, f(va), bar(va, col(a))), h('div', { class: 'k' }, k), h('div', { class: 'r' }, f(vb), bar(vb, col(b))));
    }),
    h('div', { class: 'cmp-row' }, h('div', { class: 'l small' }, a.origin.map(o => `${SOURCES[o.src].short} ${o.pct}%`).join(', ')), h('div', { class: 'k' }, 'Origin'), h('div', { class: 'r small' }, b.origin.map(o => `${SOURCES[o.src].short} ${o.pct}%`).join(', ')))));
  box.hidden = false;
  box.onclick = e => { if (e.target === box) box.hidden = true; };
}
