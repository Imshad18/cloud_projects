import { h, $, fmt, fmtTime, sci, fitCanvas, wavelengthRGB, rgba, storeGet, storeSet, SCREEN } from './util.js';
import { ELEMENTS, byZ, CATEGORIES } from './store.js';
import { SOURCES } from './data/origins.js';
import { SPECTRA, FLAME } from './data/extras.js';
import { OriginAnim } from './originAnim.js';
import { atomViewer } from './atom.js';
import { bePerNucleon, modeColor, modeText } from './nuclear.js';

const TABS = [['overview', 'Overview'], ['origin', 'Origin'], ['isotopes', 'Isotopes'], ['atom', 'Atom'], ['props', 'Properties'], ['spectrum', 'Spectrum']];
const wikiCache = {}, mediaCache = {};

async function wiki(path) {
  if (wikiCache[path]) return wikiCache[path];
  const p = fetch(`https://en.wikipedia.org/api/rest_v1/page/${path}`, { headers: { accept: 'application/json' } }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  wikiCache[path] = p; return p;
}

export class Panel {
  constructor({ onNav, onClose, onCompare, onIsotope, onOriginSource }) {
    this.root = $('#panel');
    this.onNav = onNav; this.onClose = onClose; this.onCompare = onCompare; this.onIsotope = onIsotope; this.onOriginSource = onOriginSource;
    this.tab = storeGet('pt.tab', 'overview');
    this.anim = null;
    this.bindSwipe();
  }
  get open() { return !this.root.hidden; }
  close() { this.root.hidden = true; this.el = null; this.anim?.stop(); speechSynthesis?.cancel?.(); }

  show(el) {
    this.el = el; this.root.hidden = false;
    this.anim?.stop();
    const c = CATEGORIES[el.cat].color;
    const head = h('div', { class: 'p-head' },
      h('div', { class: 'p-sym', style: { '--c': c } }, h('small', {}, el.n), el.sym),
      h('div', { class: 'p-title' },
        h('h2', {}, el.name),
        h('div', { class: 'sub mono' }, `${fmt(el.mass, 5)} u · period ${el.period}${el.group ? ` · group ${el.group}` : ''} · ${el.block}-block`),
        h('div', { class: 'row', style: { marginTop: '6px', gap: '4px' } },
          h('span', { class: 'chip' }, h('i', { style: { background: c } }), CATEGORIES[el.cat].label.replace(/s$/, '')),
          h('span', { class: 'chip' }, h('i', { style: { background: SOURCES[el.dom].color } }), SOURCES[el.dom].short),
          el.radioactive ? h('span', { class: 'chip' }, '☢ radioactive') : null)),
      h('div', { class: 'p-actions' },
        h('button', { class: 'icon-btn', title: 'Previous element (←)', 'aria-label': 'Previous element', onclick: () => this.onNav(-1) }, '‹'),
        h('button', { class: 'icon-btn', title: 'Next element (→)', 'aria-label': 'Next element', onclick: () => this.onNav(1) }, '›'),
        h('button', { class: 'icon-btn', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => this.onClose() }, '✕')));
    const tabs = h('div', { class: 'p-tabs', role: 'tablist' }, TABS.map(([k, l]) =>
      h('button', { role: 'tab', class: k === this.tab ? 'on' : '', 'aria-selected': k === this.tab, onclick: () => { this.tab = k; storeSet('pt.tab', k); this.show(el); } }, l)));
    this.body = h('div', { class: 'p-body' });
    this.root.replaceChildren(head, tabs, this.body);
    this[this.tab](el);
    this.body.scrollTop = 0;
  }

  // ---------- Overview ----------
  overview(el) {
    const photo = h('div', { class: 'photo' });
    const img = h('img', { alt: el.img.title || el.name, loading: 'eager', referrerpolicy: 'no-referrer' });
    const cap = h('div', { class: 'cap' }, el.img.title || el.name);
    const setNone = () => photo.replaceChildren(h('div', { class: 'none' }, el.n > 100 ? `Only a few atoms of ${el.name} have ever existed. No photograph is possible.` : 'The photo could not load. Photos come live from Wikimedia Commons.'));
    if (el.img.url) {
      img.src = el.img.url;
      img.onerror = async () => {
        const s = await wiki(`summary/${el.wiki}`);
        if (s?.thumbnail?.source && img.src !== s.thumbnail.source) img.src = s.thumbnail.source; else setNone();
      };
      photo.append(img, cap);
      photo.onclick = () => lightbox(img.src, el.img.credit || el.img.title);
    } else setNone();
    const gallery = h('div', { class: 'gallery' });
    this.loadGallery(el, gallery);

    const facts = h('dl', { class: 'facts' },
      fact('Phase at 20 °C', el.phase || '—'),
      fact('Discovered', el.year < 0 ? `c. ${-el.year} BCE` : el.year < 1650 ? `c. ${el.year}` : String(el.year)),
      fact('Discovered by', el.discoveredBy || 'Unknown (ancient)'),
      fact('Stable isotopes', el.stableCount ? String(el.stableCount) : 'None'),
      fact('Name origin', el.etym, true),
      fact('Uses', el.uses, true),
      fact('Appearance', el.appearance || '—', true),
      el.body ? fact('In your body', `${fmt(el.body, 2)}% of body mass`) : null,
      el.abund != null ? fact('Cosmic abundance', `${sci(Math.pow(10, el.abund - 12), 2)} per H atom`) : null,
    );
    const live = h('div', { class: 'prose' }, h('p', {}, el.summary));
    wiki(`summary/${el.wiki}`).then(s => {
      if (s?.extract && this.el === el) live.replaceChildren(h('p', {}, s.extract), h('p', { class: 'small muted' }, 'Live from ', h('a', { href: `https://en.wikipedia.org/wiki/${el.wiki}`, target: '_blank', rel: 'noopener' }, 'Wikipedia')));
    });
    const tools = h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => this.speak(el) }, '🔊 Read aloud'),
      h('button', { class: 'btn', onclick: () => this.onCompare(el) }, '⇄ Compare'),
      h('button', { class: 'btn', onclick: () => { this.tab = 'origin'; this.show(el); } }, '✦ Where it was born'));
    this.body.append(photo, gallery, tools, live, facts);
  }
  async loadGallery(el, box) {
    const data = mediaCache[el.wiki] || (mediaCache[el.wiki] = wiki(`media-list/${el.wiki}`));
    const d = await data;
    if (!d?.items || this.el !== el) return;
    const imgs = d.items.filter(i => i.type === 'image' && i.srcset?.length && !/\.svg$/i.test(i.title) && !/(icon|logo|symbol|diagram|flag|map|chart|table|spectrum|shell|lattice|structure)/i.test(i.title)).slice(0, 10);
    for (const it of imgs) {
      const src = 'https:' + it.srcset[0].src;
      const cap = it.caption?.text || it.title.replace(/^File:/, '');
      const im = h('img', { src, alt: cap, loading: 'lazy', referrerpolicy: 'no-referrer', title: cap });
      im.onerror = () => im.remove();
      im.onclick = () => lightbox(src.replace(/\/\d+px-[^/]+$/, m => m), cap);
      box.append(im);
    }
  }
  speak(el) {
    try {
      speechSynthesis.cancel();
      const o = el.origin.map(x => `${x.pct} percent ${SOURCES[x.src].name.toLowerCase()}`).join(', ');
      const u = new SpeechSynthesisUtterance(`${el.name}. Atomic number ${el.n}. ${el.summary} Its atoms were made by: ${o}. ${el.originNote || ''}`);
      u.rate = 1.02; speechSynthesis.speak(u);
    } catch { /* speech unsupported */ }
  }

  // ---------- Origin ----------
  origin(el) {
    let cur = el.dom;
    const canvas = h('canvas', { 'aria-label': 'Animation of the cosmic source' });
    const tag = h('div', { class: 'tag' });
    const box = h('div', { class: 'anim-box' }, canvas, tag);
    this.anim = new OriginAnim(canvas);
    const bar = h('div', { class: 'origin-bar', role: 'group', 'aria-label': 'Origin mix' });
    const legend = h('div', { class: 'origin-legend' });
    const story = h('div', { class: 'sec' });
    const render = () => {
      const s = SOURCES[cur];
      tag.textContent = s.name; tag.style.color = s.color;
      this.anim.set(cur); this.anim.start();
      bar.replaceChildren(...el.origin.map(o => h('button', { class: o.src === cur ? 'on' : '', title: `${SOURCES[o.src].name} ${o.pct}%`, style: { flex: o.pct, background: SOURCES[o.src].color }, onclick: () => { cur = o.src; render(); } })));
      legend.replaceChildren(...el.origin.map(o => h('button', { class: o.src === cur ? 'on' : '', onclick: () => { cur = o.src; render(); } },
        h('span', { class: 'dot', style: { width: '12px', height: '12px', borderRadius: '4px', background: SOURCES[o.src].color, display: 'block' } }),
        h('span', {}, SOURCES[o.src].name), h('span', { class: 'pct' }, `${o.pct}%`))));
      story.replaceChildren(
        h('h3', {}, `${s.process}`),
        h('dl', { class: 'facts' }, fact('When', s.when), fact('Where', s.where), fact('Time after star birth', s.delay, true)),
        h('div', { class: 'prose' }, h('p', {}, s.text)),
        h('h3', {}, 'The journey'),
        h('ol', { class: 'journey', style: { '--c': s.color } }, s.journey.map(j => h('li', {}, j))),
        h('button', { class: 'btn', onclick: () => this.onOriginSource(cur) }, `Show every element from ${s.short.toLowerCase()} →`));
    };
    const intro = h('div', { class: 'sec' },
      h('div', { class: 'eyebrow' }, 'Where the atoms in the Solar System came from'),
      bar, legend);
    this.body.append(box, intro);
    if (el.originNote) this.body.append(h('div', { class: 'note' }, el.originNote));
    this.body.append(story);
    render();
  }

  // ---------- Isotopes ----------
  isotopes(el) {
    const list = el.isotopes.filter(i => i.hl === -1 || i.hl > 0 || i.ab > 0).sort((a, b) => a.a - b.a || (a.iso ? 1 : -1));
    const others = el.isotopes.length - list.length;
    const maxAb = Math.max(...list.map(i => i.ab), 0.0001);
    const rows = list.map(i => h('tr', { class: 'click', onclick: () => this.onIsotope(i) },
      h('td', { html: `<b>${el.sym}-${i.a}${i.iso || ''}</b>` }),
      h('td', { class: 'num' }, String(i.n)),
      h('td', { class: 'num' }, i.ab ? h('span', {}, h('span', { class: 'abar', style: { width: `${Math.max(3, 40 * i.ab / maxAb)}px` } }), `${fmt(i.ab * 100, 3)}%`) : '—'),
      h('td', {}, i.hl === -1 ? h('span', { class: 'pill', style: { background: '#e9ecf8' } }, 'stable') : fmtTime(i.hl)),
      h('td', {}, (i.dm || []).map(m => h('span', { class: 'pill', title: modeText(m), style: { background: modeColor([m]), marginRight: '3px' } }, m))),
      h('td', { class: 'num' }, i.a > 1 ? bePerNucleon(i).toFixed(3) : '—')));
    const s = el.stableCount;
    const summary = s ? `${el.name} has ${s} stable isotope${s > 1 ? 's' : ''}.` : el.longest ? `${el.name} has no stable isotopes. Its longest-lived isotope, ${el.sym}-${el.longest.a}, has a half-life of ${fmtTime(el.longest.hl)}.` : `${el.name} has no stable isotopes.`;
    this.body.append(
      h('div', { class: 'prose' }, h('p', {}, `${summary} Isotopes of an element share the same ${el.n} protons but differ in their number of neutrons.`)),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Isotope'), h('th', { class: 'num' }, 'N'), h('th', { class: 'num' }, 'Natural'), h('th', {}, 'Half-life'), h('th', {}, 'Decay'), h('th', { class: 'num' }, 'BE/A MeV'))),
        h('tbody', {}, rows))),
      h('p', { class: 'hint-text' }, `${others > 0 ? `Plus ${others} more very short-lived isotopes. ` : ''}Tap an isotope to open it in the Isotope Lab with its decay chain.`),
      h('button', { class: 'btn primary', onclick: () => this.onIsotope(el.mainIso) }, 'Open in the Isotope Lab →'));
  }

  // ---------- Atom ----------
  atom(el) {
    const box = h('div', { class: 'atom-box' });
    const viewer = atomViewer();
    const isoSel = h('select', { id: 'atom-iso', 'aria-label': 'Isotope' }, el.isotopes.filter(i => !i.iso && (i.hl === -1 || i.hl > 0 || i.ab > 0)).map(i => h('option', { value: i.a, selected: i === el.mainIso }, `${el.sym}-${i.a}  (${i.a - el.n} neutrons)`)));
    const tag = h('div', { class: 'tag' });
    let iso = el.mainIso;
    const mode = { m: storeGet('pt.atomMode', 'bohr'), color: 'type', hidden: new Set() };
    const speedCtl = h('div', { class: 'atom-ctl' },
      h('button', { class: 'icon-btn', title: 'Slower electrons', onclick: () => { viewer.speed = Math.max(0.1, viewer.speed / 2); } }, '−'),
      h('button', { class: 'icon-btn', title: 'Faster electrons', onclick: () => { viewer.speed = Math.min(16, viewer.speed * 2); } }, '+'));
    box.append(tag, speedCtl);
    const modeSeg = h('div', { class: 'seg' },
      h('button', { 'data-m': 'bohr', onclick: () => setMode('bohr') }, 'Planetary model'),
      h('button', { 'data-m': 'orb', onclick: () => setMode('orb') }, 'Quantum orbitals'));
    const orbCtl = h('div', { class: 'sec' });
    const bohrCtl = h('div', { class: 'field' }, h('label', { for: 'atom-iso' }, 'Isotope shown'), isoSel);
    this.body.append(modeSeg, box, bohrCtl, orbCtl);
    viewer.mount(box);
    const render = () => {
      for (const b of modeSeg.children) b.classList.toggle('on', b.dataset.m === mode.m);
      speedCtl.hidden = mode.m !== 'bohr'; bohrCtl.hidden = mode.m !== 'bohr'; orbCtl.hidden = mode.m !== 'orb';
      if (mode.m === 'bohr') { viewer.show(el, iso); tag.textContent = `${el.n} protons · ${iso.a - el.n} neutrons · ${el.n} electrons`; return; }
      const subs = viewer.showOrbitals(el, mode);
      tag.textContent = 'Each dot is a place the electron could be found';
      orbCtl.replaceChildren(
        h('div', { class: 'panel-title' }, h('h3', {}, 'Orbitals'), h('div', { class: 'seg' },
          h('button', { class: mode.color === 'type' ? 'on' : '', onclick: () => { mode.color = 'type'; render(); } }, 'Colour by type'),
          h('button', { class: mode.color === 'phase' ? 'on' : '', onclick: () => { mode.color = 'phase'; render(); } }, 'Colour by phase'))),
        h('div', { class: 'orb-chips' },
          h('button', { onclick: () => { mode.hidden = new Set(); render(); } }, 'All'),
          h('button', { onclick: () => { const top = Math.max(...subs.map(x => x.n)); mode.hidden = new Set(subs.filter(x => x.n < top && !(x.l >= 2 && x.n >= top - 2 && x.e < 4 * x.l + 2)).map(x => x.name)); render(); } }, 'Outer only'),
          ...subs.map(x => h('button', { class: mode.hidden.has(x.name) ? 'off' : '', title: `Z_eff ≈ ${x.zeff.toFixed(2)}`, onclick: () => { mode.hidden.has(x.name) ? mode.hidden.delete(x.name) : mode.hidden.add(x.name); render(); } },
            h('i', { style: { background: ['#6fc3ff', '#ff8a5c', '#6ee7a8', '#c79bff'][x.l] } }), `${x.name}`, h('sup', {}, String(x.e))))),
        h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Subshell'), h('th', { class: 'num' }, 'Electrons'), h('th', {}, 'Orbitals filled'), h('th', { class: 'num' }, 'Effective charge'))),
          h('tbody', {}, subs.map(x => h('tr', {}, h('td', {}, h('b', {}, x.name)), h('td', { class: 'num' }, String(x.e)), h('td', {}, x.orbitals.map(o => `${o.label.slice(1)}${o.occ === 2 ? '↑↓' : '↑'}`).join('  ')), h('td', { class: 'num' }, x.zeff.toFixed(2))))))),
        h('p', { class: 'hint-text' }, 'Real orbitals are clouds of probability, computed here from the hydrogen-like Schrödinger solutions with effective nuclear charges (Slater\'s rules). s orbitals are spheres, p are dumbbells, d are four-leaf clovers and f are more complex. "Phase" shows the sign of the wavefunction: nodes are where it changes colour. Drag to rotate, scroll or pinch to zoom where you point.'));
    };
    const setMode = m => { mode.m = m; storeSet('pt.atomMode', m); render(); };
    isoSel.onchange = () => { const a = +isoSel.value; iso = el.isotopes.find(i => i.a === a && !i.iso); render(); };
    render();
    const cfg = (el.configS || '').replace(/([spdf])(\d+)/g, '$1<sup>$2</sup>');
    const valence = el.shells?.[el.shells.length - 1];
    this.body.append(
      h('div', { class: 'sec' }, h('h3', {}, 'Electron configuration'), h('div', { class: 'cfg', html: cfg }), h('div', { class: 'cfg small muted', html: (el.config || '').replace(/([spdf])(\d+)/g, '$1<sup>$2</sup>') })),
      h('div', { class: 'sec' }, h('h3', {}, 'Electrons per shell'), h('div', { class: 'shells' }, (el.shells || []).map((n, i) => h('span', {}, `${'KLMNOPQ'[i]}: ${n}`))),
        h('p', { class: 'hint-text' }, `${valence} electron${valence === 1 ? '' : 's'} in the outer shell. In the planetary model the nucleus is not to scale: it is really about 100,000 times smaller than the atom.`)));
  }

  // ---------- Properties ----------
  props(el) {
    const P = [
      ['Atomic mass', 'mass', ' u'], ['Density', 'density', ' g/cm³'], ['Melting point', 'melt', ' K'], ['Boiling point', 'boil', ' K'],
      ['Electronegativity', 'en', ''], ['Electron affinity', 'ea', ' kJ/mol'], ['1st ionization', 'ie', ' kJ/mol'], ['Molar heat', 'molarHeat', ' J/(mol·K)'],
    ];
    const bars = h('div', { class: 'propbars' });
    for (const [label, key, unit] of P) {
      const vals = ELEMENTS.map(e => e[key]).filter(v => v != null);
      const v = el[key];
      const max = Math.max(...vals), rank = v == null ? null : vals.filter(x => x > v).length + 1;
      const pct = v == null ? 0 : Math.max(2, (v / max) * 100);
      bars.append(h('div', { class: 'propbar' },
        h('span', { class: 'k' }, label), h('span', { class: 'v' }, v == null ? 'unknown' : `${fmt(v, 4)}${unit}`),
        h('div', { class: 'track' }, h('i', { style: { width: pct + '%', background: CATEGORIES[el.cat].color } })),
        rank ? h('span', { class: 'rank' }, `#${rank} of ${vals.length} known`) : null));
    }
    const cv = h('canvas', { style: { width: '100%', height: '120px', display: 'block' } });
    this.body.append(h('div', { class: 'sec' }, h('h3', {}, 'Solid, liquid, gas'), h('div', { class: 'canvas-box', style: { height: '120px' } }, cv),
      h('p', { class: 'hint-text' }, 'Temperature on a log scale. Markers show room temperature, boiling water and the surface of the Sun.')), bars);
    requestAnimationFrame(() => drawPhase(cv, el));
    if (el.cpk) this.body.append(h('div', { class: 'row small muted' }, h('span', { style: { width: '14px', height: '14px', borderRadius: '50%', background: '#' + el.cpk, display: 'inline-block' } }), `CPK colour used in molecule models: #${el.cpk}`));
  }

  // ---------- Spectrum ----------
  spectrum(el) {
    let lines = SPECTRA[el.sym];
    if (el.sym === 'H') lines = [3, 4, 5, 6, 7, 8].map(n => [1e9 / (10967758 * (1 / 4 - 1 / (n * n))), [1, .6, .4, .3, .2, .15][n - 3]]);
    let absorb = false;
    const cv = h('canvas', { class: 'spectrum', 'aria-label': 'Emission spectrum' });
    const draw = () => drawSpectrum(cv, lines || [], absorb);
    const flame = FLAME[el.sym];
    this.body.append(h('div', { class: 'sec' },
      h('h3', {}, 'Light fingerprint'),
      lines ? cv : h('p', { class: 'muted' }, 'No strong visible lines in this dataset. Many heavy elements have thousands of faint lines, or emit mostly in the ultraviolet.'),
      lines ? h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: e => { absorb = !absorb; e.target.textContent = absorb ? 'Show emission' : 'Show absorption'; draw(); } }, 'Show absorption'),
        h('button', { class: 'btn', onclick: () => playSpectrum(lines) }, '♪ Hear the spectrum')) : null,
      h('p', { class: 'hint-text' }, 'Every element emits and absorbs light at its own exact wavelengths. Astronomers read these lines in starlight to find which elements a star contains. Helium was discovered this way in the Sun in 1868.')));
    if (lines) {
      requestAnimationFrame(draw);
      this.body.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', {}, 'Colour'), h('th', { class: 'num' }, 'Wavelength'), h('th', { class: 'num' }, 'Strength'))),
        h('tbody', {}, lines.slice().sort((a, b) => a[0] - b[0]).map(([w, s]) => h('tr', {}, h('td', {}, h('span', { style: { display: 'inline-block', width: '28px', height: '10px', borderRadius: '3px', background: wavelengthRGB(w) } })), h('td', { class: 'num' }, `${w.toFixed(1)} nm`), h('td', { class: 'num' }, `${Math.round(s * 100)}%`)))))));
    }
    if (flame) this.body.append(h('div', { class: 'sec' }, h('h3', {}, 'Flame test'), h('div', { class: 'flame' },
      h('div', { class: 'f', style: { background: `radial-gradient(ellipse at 50% 80%, #fff 0%, ${flame[0]} 35%, ${rgba(flame[0], 0)} 70%)` } }),
      h('div', {}, h('b', {}, flame[1]), h('div', { class: 'hint-text' }, `Salts of ${el.name.toLowerCase()} colour a flame ${flame[1]}. Fireworks use this.`)))));
  }

  bindSwipe() {
    let y0 = null;
    this.root.addEventListener('touchstart', e => { if (e.target.closest('.p-head')) y0 = e.touches[0].clientY; }, { passive: true });
    this.root.addEventListener('touchmove', e => { if (y0 != null) { const d = e.touches[0].clientY - y0; if (d > 0) this.root.style.transform = `translateY(${d}px)`; } }, { passive: true });
    this.root.addEventListener('touchend', e => {
      if (y0 == null) return;
      const d = e.changedTouches[0].clientY - y0; y0 = null; this.root.style.transform = '';
      if (d > 110) this.onClose();
    });
  }
}

function fact(k, v, wide) { return h('div', { class: wide ? 'wide' : '' }, h('dt', {}, k), h('dd', {}, v || '—')); }

export function lightbox(src, caption) {
  const lb = $('#lightbox');
  lb.replaceChildren(h('div', { style: { display: 'grid', gap: '10px', justifyItems: 'center' } }, h('img', { src, alt: caption || '', referrerpolicy: 'no-referrer' }), caption ? h('p', {}, caption) : null));
  lb.hidden = false;
  lb.onclick = () => { lb.hidden = true; };
}

function drawPhase(cv, el) {
  const ctx = cv.getContext('2d'); const { w, h: H } = fitCanvas(cv, ctx);
  const x = T => 10 + (Math.log10(Math.max(T, 1)) / 4) * (w - 20);
  ctx.fillStyle = SCREEN(); ctx.fillRect(0, 0, w, H);
  const y = 40, bh = 26;
  const seg = (a, b, c, t) => { ctx.fillStyle = c; ctx.fillRect(x(a), y, Math.max(1, x(b) - x(a)), bh); if (x(b) - x(a) > 40) { ctx.fillStyle = '#0b0d1c'; ctx.font = '600 11px "Source Sans 3", system-ui, sans-serif'; ctx.fillText(t, x(a) + 6, y + 17); } };
  if (el.melt == null) { ctx.fillStyle = '#8f97ba'; ctx.font = '12px "Source Sans 3", system-ui, sans-serif'; ctx.fillText('Melting and boiling points unknown', 12, y + 17); }
  else {
    seg(1, el.melt, '#8fb3ff', 'solid');
    if (el.boil) { seg(el.melt, el.boil, '#4fe0c0', 'liquid'); seg(el.boil, 10000, '#ffb35c', 'gas'); }
    else seg(el.melt, 10000, 'rgba(79,224,192,.4)', 'liquid →');
  }
  ctx.font = '10px "Source Sans 3", system-ui, sans-serif'; ctx.fillStyle = '#8f97ba'; ctx.textAlign = 'center';
  for (const T of [1, 10, 100, 1000, 10000]) ctx.fillText(T + ' K', Math.min(w - 20, Math.max(16, x(T))), H - 8);
  for (const [T, l] of [[293, 'room'], [373, 'water boils'], [5778, 'Sun']]) {
    ctx.strokeStyle = 'rgba(255,210,122,.8)'; ctx.beginPath(); ctx.moveTo(x(T), y - 8); ctx.lineTo(x(T), y + bh + 6); ctx.stroke();
    ctx.fillStyle = '#ffd27a'; ctx.fillText(l, x(T), y - 12);
  }
  ctx.textAlign = 'left';
}

function drawSpectrum(cv, lines, absorb) {
  const ctx = cv.getContext('2d'); const { w, h: H } = fitCanvas(cv, ctx);
  const x = l => ((l - 380) / (750 - 380)) * w;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, H);
  if (absorb) { for (let i = 0; i < w; i++) { ctx.fillStyle = wavelengthRGB(380 + (i / w) * 370); ctx.fillRect(i, 0, 1, H - 16); } }
  for (const [l, s] of lines) {
    if (l < 380 || l > 750) continue;
    ctx.fillStyle = absorb ? `rgba(0,0,0,${0.5 + s * 0.5})` : wavelengthRGB(l);
    ctx.globalAlpha = absorb ? 1 : 0.35 + s * 0.65;
    ctx.fillRect(x(l) - 1.2, 0, 2.4, H - 16);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#8f97ba'; ctx.font = '10px "Source Sans 3", system-ui, sans-serif';
  for (const l of [400, 450, 500, 550, 600, 650, 700]) ctx.fillText(l + ' nm', x(l) - 14, H - 4);
}

let audio;
function playSpectrum(lines) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const now = audio.currentTime;
    const master = audio.createGain(); master.gain.setValueAtTime(0.0001, now); master.gain.exponentialRampToValueAtTime(0.25, now + 0.08); master.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    master.connect(audio.destination);
    // Map light frequency down ~40 octaves into hearing range.
    for (const [l, s] of lines) {
      const f = (299792458 / (l * 1e-9)) / Math.pow(2, 40);
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f; g.gain.value = s / lines.length * 2;
      o.connect(g).connect(master); o.start(now); o.stop(now + 2.7);
    }
  } catch { /* audio unsupported */ }
}
