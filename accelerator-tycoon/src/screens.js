// Start screen and collider designer
import { h, fmt, sci, money, lumiStr, clamp } from './util.js';
import { SITES, MAGNETS, LINACS, DETECTORS } from './data.js';
import { evaluate, layout, SCENARIOS, DEFAULT_DESIGN } from './custom.js';
import { createMap } from './map.js';
import { card, kv, field } from './ui.js';

export function startScreen(root, { hasSave, saveInfo, onContinue, onCampaign, onDesign }) {
  const ring = h('canvas', { class: 'hero-ring', 'aria-hidden': 'true' });
  root.replaceChildren(h('div', { class: 'start' },
    h('div', { class: 'hero' }, ring,
      h('div', { class: 'hero-text' }, h('div', { class: 'eyebrow' }, 'Build · Operate · Discover'), h('h1', {}, 'Accelerator Tycoon'),
        h('p', {}, 'Run the Large Hadron Collider from first beam in 2008 to the High-Luminosity era, or design your own collider anywhere on Earth. Real magnet physics, real luminosity formulas, real LHC history.'),
        h('div', { class: 'row' }, hasSave ? h('button', { class: 'btn primary big', onclick: onContinue }, `Continue: ${saveInfo}`) : '', h('button', { class: `btn ${hasSave ? '' : 'primary'} big`, onclick: onCampaign }, 'Run the LHC (2008 →)'), h('button', { class: 'btn big', onclick: () => onDesign({}) }, 'Build your own collider')))),
    h('section', { class: 'modes' },
      h('article', { class: 'mode', onclick: onCampaign }, h('b', {}, 'LHC campaign'), h('p', {}, 'Start on 8 September 2008. Get first beam, survive the splice incident (or avoid it), find the Higgs, plan three long shutdowns and build the HL-LHC. 17 main missions against the real timeline.'), h('span', { class: 'go' }, 'Play →')),
      h('article', { class: 'mode', onclick: () => onDesign({}) }, h('b', {}, 'Design your own'), h('p', {}, 'Pick a site, the particles, the size and the magnet technology. See the energy, luminosity, power and cost update live, then build it: tunnel-boring machines, magnet factories, funding reviews.'), h('span', { class: 'go' }, 'Design →'))),
    h('h2', { class: 'sec-title' }, 'Scenarios'),
    h('div', { class: 'scen' }, SCENARIOS.map(sc => h('button', { class: 'scard', onclick: () => onDesign(sc.d, sc) }, h('b', {}, sc.name), h('span', {}, sc.sub)))),
    h('section', { class: 'howto' }, h('h2', { class: 'sec-title' }, 'How it works'),
      h('div', { class: 'cols3' },
        h('div', {}, h('b', {}, 'Operate'), h('p', {}, 'Each fill goes Injection → Ramp → Squeeze → Adjust → Stable beams → Dump. Luminosity comes from L = γ f n_b N² F / (4π ε β*). Protons burn off, so you choose when to refill. Faults, quenches and "UFOs" interrupt you, like the real machine.')),
        h('div', {}, h('b', {}, 'Manage'), h('p', {}, 'Budget, electricity bills, reputation. Plan long shutdowns and ion runs, train magnets, spend beam time on machine development, start upgrades years ahead, and keep the computing grid big enough to analyse your data.')),
        h('div', {}, h('b', {}, 'Discover'), h('p', {}, 'W, Z, top, Higgs and its couplings, pentaquarks, quark-gluon plasma. Each needs the real number of events: significance grows as √N. New physics beyond that is not faked: you push the search reach instead.'))))));
  // spinning hero ring
  const ctx = ring.getContext('2d'); let t = 0, raf = 0;
  const loop = () => {
    if (!ring.isConnected) { cancelAnimationFrame(raf); return; }
    raf = requestAnimationFrame(loop); t += 0.016;
    const r = ring.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    if (ring.width !== Math.round(r.width * dpr)) { ring.width = r.width * dpr; ring.height = r.height * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const w = r.width, H = r.height; ctx.clearRect(0, 0, w, H);
    const cx = w * 0.72, cy = H * 0.5, R = Math.min(w * 0.3, H * 0.42);
    ctx.strokeStyle = 'rgba(90,180,255,.18)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,180,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    for (const [dir, c] of [[1, '90,170,255'], [-1, '255,90,100']]) for (let i = 0; i < 40; i++) { const a = dir * t * 0.7 + (i / 40) * Math.PI * 2 * 0.92; ctx.fillStyle = `rgba(${c},.9)`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R + dir * 3), cy + Math.sin(a) * (R + dir * 3), 2, 0, Math.PI * 2); ctx.fill(); }
    for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, p = (t * 1.5 + k * 0.25) % 1; ctx.strokeStyle = `rgba(255,210,120,${1 - p})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 6 + p * 22, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
  };
  loop();
}

export function designer(root, { preset = {}, scenario, onBack, onBuild }) {
  const d = { ...DEFAULT_DESIGN, ...preset, dets: { ...DEFAULT_DESIGN.dets, ...(preset.dets || {}) } };
  const mapCv = h('canvas', { class: 'map' });
  const map = createMap(mapCv);
  const summary = h('div', { class: 'stack' });
  const form = h('div', { class: 'stack' });
  root.replaceChildren(h('header', { class: 'topbar' }, h('button', { class: 'brand', onclick: onBack }, h('span', { class: 'logo' }), h('span', {}, h('b', {}, 'Accelerator Tycoon'), h('small', {}, scenario ? `Scenario: ${scenario.name}` : 'Collider designer'))), h('div', { style: { flex: 1 } }), h('button', { class: 'btn ghost', onclick: onBack }, '← Back')),
    h('main', { class: 'game designer' }, h('section', { class: 'right' }, form), h('section', { class: 'left' }, h('div', { class: 'mapbox' }, mapCv), summary)));
  let raf = 0, last = 0, preview = null;
  const loop = ts => { if (!mapCv.isConnected) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; if (preview) { map.setState(preview); map.draw(dt); } };
  raf = requestAnimationFrame(loop);

  const seg = (items, key, on) => h('div', { class: 'seg' }, items.map(([v, l]) => h('button', { class: d[key] === v ? 'on' : '', onclick: () => { d[key] = v; on?.(); build(); } }, l)));
  const range = (id, label, key, min, max, step, fmtv) => { const v = h('b', {}, fmtv(d[key])); const r = h('input', { type: 'range', id, min, max, step, value: d[key] }); r.addEventListener('input', () => { d[key] = +r.value; v.textContent = fmtv(d[key]); refresh(); }); return field(label, v, r); };
  const counter = t => { const v = h('b', {}, d.dets[t] || 0); return h('div', { class: 'counter' }, h('span', {}, h('i', { class: 'dot', style: { background: DETECTORS[t].color } }), ` ${DETECTORS[t].name}`, h('small', {}, ` ${DETECTORS[t].like}-style · ${DETECTORS[t].cost} MCHF`)), h('button', { class: 'btn small', onclick: () => { d.dets[t] = Math.max(0, (d.dets[t] || 0) - 1); v.textContent = d.dets[t]; refresh(); } }, '−'), v, h('button', { class: 'btn small', onclick: () => { d.dets[t] = Math.min(4, (d.dets[t] || 0) + 1); v.textContent = d.dets[t]; refresh(); } }, '+')); };

  function build() {
    const name = h('input', { type: 'text', id: 'd-name', value: d.name, maxlength: 40 }); name.addEventListener('input', () => { d.name = name.value || 'My Collider'; refresh(); });
    const site = h('select', { id: 'd-site' }, Object.entries(SITES).map(([k, s]) => h('option', { value: k, selected: d.site === k }, s.name))); site.addEventListener('change', () => { d.site = site.value; build(); });
    const S0 = SITES[d.site];
    const kindSeg = seg([['hadron', 'Proton ring'], ['lepton', 'Electron–positron ring'], ['linear', 'Linear e⁺e⁻']], 'kind');
    const parts = [card('Name and site', field('Name', '', name), field('Site', '', site), h('p', { class: 'hint', style: { margin: 0 } }, S0.text), h('p', { class: 'hint', style: { margin: 0 } }, `Rock: ${S0.rock}. Tunnel ≈ ${S0.tunnelPerKm} MCHF/km. Injectors: ${S0.injector.name}.`)),
      card('Machine', kindSeg,
        d.kind !== 'linear' ? range('d-circ', 'Circumference', 'circKm', 3, 150, 0.1, v => `${fmt(v, 4)} km`) : range('d-len', 'Total length', 'lengthKm', 3, 60, 0.5, v => `${fmt(v, 3)} km`),
        d.kind === 'hadron' ? h('div', { class: 'opts' }, Object.entries(MAGNETS).map(([k, m]) => h('button', { class: `opt ${d.magnet === k ? 'on' : ''}`, onclick: () => { d.magnet = k; build(); } }, h('b', {}, `${m.name}`), h('span', {}, `${m.B} T · ${m.like} · ${m.costPerM * 1000} kCHF/m`), h('small', {}, m.text)))) : '',
        d.kind === 'lepton' ? [range('d-E', 'Maximum beam energy', 'Ebeam', 45, 250, 0.5, v => `${fmt(v, 4)} GeV (√s ${fmt(2 * v, 4)} GeV)`), range('d-psr', 'Synchrotron radiation power per beam', 'Psr', 5, 100, 1, v => `${v} MW`),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: d.topUp, onchange: e => { d.topUp = e.target.checked; refresh(); } }), h('span', {}, 'Top-up injection (full-energy booster ring in the same tunnel)')),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: d.crabWaist, onchange: e => { d.crabWaist = e.target.checked; refresh(); } }), h('span', {}, 'Crab-waist collisions (×100 luminosity; needs top-up)'))] : '',
        d.kind === 'linear' ? [h('div', { class: 'opts' }, Object.entries(LINACS).map(([k, L]) => h('button', { class: `opt ${d.linac === k ? 'on' : ''}`, onclick: () => { d.linac = k; build(); } }, h('b', {}, L.name), h('span', {}, `${L.like} · ${L.costPerKm} MCHF/km`), h('small', {}, L.text)))), range('d-pw', 'Wall-plug power for the beams', 'Pwall', 30, 600, 5, v => `${v} MW`)] : ''),
      card('Detectors', ...(d.kind === 'hadron' ? ['gp', 'bphys', 'ions'] : ['ee']).map(counter), h('p', { class: 'hint', style: { margin: 0 } }, d.kind === 'linear' ? 'A linear collider has one collision point; two detectors can share it (push-pull).' : 'Up to four collision points.')),
      card('Construction', range('d-tbm', 'Tunnel-boring machines', 'tbm', 1, 12, 1, v => `${v} (15 MCHF each)`), range('d-lines', d.kind === 'linear' ? 'Cavity production lines' : 'Magnet production lines', 'lines', 1, 10, 1, v => `${v} (20 MCHF each)`),
        range('d-year', 'Start year', 'startYear', 1980, 2060, 1, v => String(v)),
        h('div', { class: 'field' }, h('label', {}, 'Funding'), seg([['realistic', 'Realistic: reviews, overruns, cancellation'], ['sandbox', 'Sandbox: unlimited money']], 'difficulty')))];
    form.replaceChildren(...parts.flat());
    refresh();
  }
  function refresh() {
    const ev = evaluate(d);
    layout(ev);
    const m = ev.m;
    preview = { m, ops: { mode: 'STABLE BEAMS', fill: { nb: 600, E: m.Edesign }, lumis: m.ips.map(() => 1) }, flags: {}, build: null, faultSector: -1 };
    const { cost, info, warn } = ev;
    const hadron = d.kind === 'hadron';
    const tooBig = d.difficulty === 'realistic' && cost.total > 30000;
    const bars = Object.entries(cost).filter(([k]) => k !== 'total' && cost[k] > 0).sort((a, b) => b[1] - a[1]);
    const names = { tunnel: 'Tunnel', magnets: 'Magnets', cryo: 'Cryogenics', rf: 'RF system', injector: 'Injectors', detectors: 'Detectors', caverns: 'Caverns and shafts', infra: 'Infrastructure', tbm: 'Tunnel-boring machines', lines: 'Production lines', booster: 'Booster ring', linac: 'Main linacs', rings: 'Damping rings, sources' };
    summary.replaceChildren(
      card(d.name,
        h('div', { class: 'bigkpis' },
          h('div', {}, h('b', {}, hadron ? `${fmt(info.rs, 3)} TeV` : `${fmt(info.rs * 1000, 4)} GeV`), h('span', {}, 'collision energy √s')),
          h('div', {}, h('b', {}, sci(info.L, 2)), h('span', {}, 'luminosity cm⁻²s⁻¹')),
          h('div', {}, h('b', {}, money(cost.total)), h('span', {}, 'construction cost')),
          h('div', {}, h('b', {}, `${fmt(info.months / 12, 2)} yr`), h('span', {}, 'to build')),
          h('div', {}, h('b', {}, `${Math.round(info.power)} MW`), h('span', {}, `power, ~${money(info.elecYear)}/yr`))),
        h('div', { class: 'kv' },
          hadron ? kv('Beam energy', `${fmt(info.Edesign / 1000, 3)} TeV = 0.3 × ${info.B} T × ${fmt(m.rho / 1000, 3)} km`) : kv('Beam energy', `${fmt(info.Edesign, 4)} GeV`),
          hadron ? kv('Pile-up at that luminosity', fmt(info.mu, 3)) : '', hadron ? kv('Stored energy per beam', `${fmt(info.stored, 3)} MJ`) : '',
          d.kind !== 'linear' ? kv('Synchrotron loss per turn', `${fmt(info.U0, 3)} keV`) : '', info.V ? kv('RF voltage needed', `${fmt(info.V, 3)} GV`) : '',
          kv('Injection', info.injector), kv('Data per year per detector', lumiStr(info.fbPerYear)), hadron ? kv('Search reach after ~10 years', `${fmt(info.searchReach, 3)} TeV`) : '',
          info.points ? kv('Luminosity at Z / WW / ZH / tt̄', info.points.map(([e, L]) => `${fmt(2 * e, 4)} GeV: ${sci(L, 1)}`).join(' · ')) : ''),
        warn.length ? h('div', { class: 'warns' }, warn.map(w => h('p', { class: 'warn' }, '⚠ ', w))) : '',
        tooBig ? h('p', { class: 'warn' }, 'No funding agency will approve more than 30 BCHF. Shrink it, or switch to Sandbox.') : '',
        h('button', { class: 'btn primary big', disabled: tooBig || !ev.dets.length, onclick: () => onBuild({ ...d }) }, `Approve and start construction (${d.startYear})`)),
      card('Cost breakdown', ...bars.map(([k, v]) => h('div', { class: 'costbar' }, h('span', {}, names[k] || k), h('div', { class: 'track' }, h('i', { style: { width: `${clamp(v / bars[0][1], 0, 1) * 100}%` } })), h('b', {}, money(v))))),
      card('Physics reach', info.reach.length ? h('div', { class: 'stack' }, info.reach.sort((a, b) => a.years - b.years).map(r => h('div', { class: 'kvr' }, h('span', {}, r.p.name + (d.kind === 'hadron' ? '' : ` (at ${fmt(r.at, 4)} GeV)`)), h('b', { class: r.years > 25 ? 'muted' : '' }, r.years < 0.1 ? 'weeks' : r.years > 60 ? 'out of reach' : `~${fmt(r.years, 2)} years to 5σ`)))) : h('p', { class: 'muted' }, 'Add detectors to see what it can find.')));
  }
  build();
}
