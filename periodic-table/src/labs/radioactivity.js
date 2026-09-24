import { h, fmt, sci, clamp, fitCanvas, SCREEN, FONT } from '../util.js';
import { bySym } from '../store.js';
import { workspace, group, tabs } from './ui.js';

// ---------- Real sources ----------
// activity in Bq, half-life in seconds, emissions per decay, energies in MeV,
// gamma dose-rate constant (µSv·m²/h per MBq, approximate published values)
const YEAR = 3.156e7, DAY = 86400;
const SOURCES = [
  { k: 'am241', name: 'Smoke detector', nuc: 'Am-241', sym: 'Am', A: 37e3, hl: 432.2 * YEAR, em: { alpha: 1, gamma: 0.36 }, E: { alpha: 5.49, gamma: 0.0595 }, G: 0.0031, text: 'A button of americium-241 ionises the air in the chamber. Smoke blocks the current and the alarm sounds. About 1 µCi (37 kBq).' },
  { k: 'po210', name: 'Anti-static brush', nuc: 'Po-210', sym: 'Po', A: 18.5e6, hl: 138.4 * DAY, em: { alpha: 1 }, E: { alpha: 5.3 }, G: 0, text: 'Polonium-210 alpha particles ionise the air to discharge static on film and records. Pure alpha: harmless outside the body, deadly if swallowed.' },
  { k: 'sr90', name: 'School beta source', nuc: 'Sr-90 / Y-90', sym: 'Sr', A: 74e3, hl: 28.8 * YEAR, em: { beta: 2 }, E: { beta: 2.28 }, G: 0, text: 'Strontium-90 and its daughter yttrium-90 each emit a beta particle. Used in school labs to show beta absorption in aluminium.' },
  { k: 'cs137', name: 'School gamma source', nuc: 'Cs-137', sym: 'Cs', A: 185e3, hl: 30.08 * YEAR, em: { beta: 1, gamma: 0.85 }, E: { beta: 0.51, gamma: 0.662 }, G: 0.078, text: 'Caesium-137 is the main long-lived contaminant after Chernobyl and Fukushima. Its 662 keV gamma ray is the most-used calibration line in the world.' },
  { k: 'co60', name: 'Cobalt-60 check source', nuc: 'Co-60', sym: 'Co', A: 37e3, hl: 5.27 * YEAR, em: { beta: 1, gamma: 2 }, E: { beta: 0.32, gamma: 1.25 }, G: 0.305, text: 'Two strong gamma rays per decay. Big cobalt-60 sources sterilise a large share of the world\'s single-use medical equipment.' },
  { k: 'k40', name: 'A banana', nuc: 'K-40', sym: 'K', A: 15, hl: 1.25e9 * YEAR, em: { beta: 0.89, gamma: 0.107 }, E: { beta: 1.31, gamma: 1.46 }, G: 0.0078, text: 'A banana holds about half a gram of potassium, 0.012% of it radioactive K-40: about 15 decays per second. Your body keeps its potassium level constant, so eating bananas does not build up a dose.' },
  { k: 'tc99m', name: 'Patient after a bone scan', nuc: 'Tc-99m', sym: 'Tc', A: 740e6, hl: 6.0 * 3600, em: { gamma: 0.89 }, E: { gamma: 0.14 }, G: 0.0141, text: 'Technetium-99m is injected for about 40 million scans a year. Its 6-hour half-life means the patient is back to normal within a couple of days.' },
  { k: 'uglass', name: 'Uranium glass', nuc: 'U-238 + daughters', sym: 'U', A: 3e3, hl: 4.468e9 * YEAR, em: { alpha: 1, beta: 0.6, gamma: 0.1 }, E: { alpha: 4.2, beta: 2.2, gamma: 0.09 }, G: 0.002, text: 'Glass coloured with a few percent uranium, popular in the 1800s. It glows green under ultraviolet light and clicks gently on a Geiger counter.' },
];
const SHIELDS = [
  ['none', 'Nothing'],
  ['paper', 'A sheet of paper'],
  ['al', 'Aluminium, 3 mm'],
  ['pb1', 'Lead, 1 cm'],
  ['pb5', 'Lead, 5 cm'],
  ['conc', 'Concrete, 30 cm'],
];
// Gamma half-value layers (cm) by photon energy (MeV), from NIST XCOM attenuation data
const HVL = {
  energies: [0.06, 0.14, 0.662, 1.25, 1.46],
  pb: [0.012, 0.03, 0.56, 1.1, 1.2],
  al: [0.6, 1.9, 3.4, 4.5, 4.8],
  conc: [0.85, 2.3, 3.8, 5.0, 5.4],
};
function hvl(mat, E) {
  const es = HVL.energies, v = HVL[mat];
  if (E <= es[0]) return v[0];
  for (let i = 1; i < es.length; i++) if (E <= es[i]) { const t = Math.log(E / es[i - 1]) / Math.log(es[i] / es[i - 1]); return v[i - 1] * Math.pow(v[i] / v[i - 1], t); }
  return v[v.length - 1];
}
// Beta range in aluminium (cm) from the Katz–Penfold relation (range in g/cm², ÷ 2.7 g/cm³)
function betaRangeAl(E) { const n = 1.265 - 0.0954 * Math.log(E); return (0.412 * Math.pow(E, n)) / 2.7; }
// Alpha range in air (cm), Geiger's rule R ≈ 0.318 E^1.5
const alphaRangeAir = E => 0.318 * Math.pow(E, 1.5);
function transmission(src, type, shield, dCm) {
  const E = src.E[type];
  if (type === 'alpha') return shield === 'none' && dCm < alphaRangeAir(E) ? 1 : 0;
  if (type === 'beta') {
    const airR = 400 * E; // about 4 m per MeV in air
    const air = clamp(1 - dCm / airR, 0, 1);
    if (shield === 'none') return air;
    if (shield === 'paper') return air * 0.9;
    if (shield === 'al') { const R = betaRangeAl(E); return air * clamp(1 - 0.3 / R, 0, 1) ** 2; }
    return 0;
  }
  const thick = { none: 0, paper: 0, al: 0.3, pb1: 1, pb5: 5, conc: 30 }[shield];
  const mat = shield === 'al' ? 'al' : shield === 'conc' ? 'conc' : 'pb';
  return thick ? Math.pow(0.5, thick / hvl(mat, E)) : 1;
}
const EFF = { alpha: 0.15, beta: 0.3, gamma: 0.006 }; // pancake Geiger tube, typical
const WINDOW = 15; // cm²
const BG_CPS = 0.8, BG_USVH = 0.1, DEAD = 1e-4;

const TYPES = [
  ['α', 'Alpha', 'Two protons and two neutrons: a helium-4 nucleus, ejected at about 5% of light speed.', '+2', '6,645 × electron', '4–9 MeV', '3–5 cm', 'Paper, or the dead outer layer of your skin', 'Harmless outside, very dangerous inside: 20× more damaging per gray than gamma rays.'],
  ['β⁻', 'Beta minus', 'An electron made when a neutron turns into a proton. An antineutrino (ν̄) leaves with it.', '−1', '1 electron', '0.02–3 MeV (a spread)', 'up to ~10 m', 'A few mm of aluminium or plastic', 'Burns skin and eyes from outside; dangerous inside.'],
  ['β⁺', 'Beta plus (positron)', 'An anti-electron made when a proton turns into a neutron. It meets an electron and both vanish into two 511 keV gamma rays: this is how PET scans see.', '+1', '1 electron', '0.2–2 MeV', 'about 1 mm, then annihilates', 'Same as beta, then lead for the gammas', 'Used in medicine (fluorine-18).'],
  ['γ', 'Gamma ray', 'A high-energy photon released as the new nucleus settles down.', '0', '0 (light)', '0.01–10 MeV', 'hundreds of metres', 'Only reduced, never stopped: thick lead, concrete or water', 'Passes through the body; the main external hazard.'],
  ['n', 'Neutron', 'Neutral particle freed by fission or some decays.', '0', '1,839 × electron', '0.025 eV–10 MeV', 'hundreds of metres', 'Water, concrete, plastic (hydrogen stops them best)', 'Makes other materials radioactive (activation).'],
  ['X', 'X-ray', 'A photon from the electron cloud, not the nucleus. Also made by electrons braking (bremsstrahlung).', '0', '0 (light)', '1–150 keV', 'metres', 'A few mm of lead', 'Medical imaging.'],
];
const GLOSSARY = [
  ['Radioactive', 'An unstable nucleus that changes by itself into another one, throwing out energy as radiation.'],
  ['Isotope', 'Atoms of the same element with different numbers of neutrons. Carbon-12 is stable, carbon-14 is radioactive.'],
  ['Half-life (t½)', 'The time for half of the atoms to decay. You cannot tell when one atom will go, only how fast a large number will.'],
  ['Becquerel (Bq)', 'Activity: one decay per second. A banana is about 15 Bq; your body about 8,000 Bq.'],
  ['Curie (Ci)', 'Old unit: 37 billion Bq, the activity of 1 g of radium.'],
  ['Gray (Gy)', 'Absorbed dose: 1 joule of radiation energy per kilogram of matter.'],
  ['Sievert (Sv)', 'Dose weighted by harm: alpha counts 20×, and sensitive organs count more. 1 mSv = a thousandth of a sievert; 1 µSv = a millionth.'],
  ['Ionising', 'Energetic enough to knock electrons off atoms, breaking chemical bonds such as DNA. Light, radio and microwaves are not ionising.'],
  ['Decay chain', 'A series of decays, one after another, until a stable nucleus is reached. U-238 takes 14 steps to become lead-206.'],
  ['Contamination vs exposure', 'Exposure: radiation hits you. Contamination: radioactive material is on or in you, and keeps irradiating you until removed.'],
  ['α β γ symbols', 'Rutherford named the rays after the first Greek letters, in order of how easily they are stopped: α (alpha) first, then β (beta), then γ (gamma).'],
  ['cpm / cps', 'Counts per minute or second: clicks on a Geiger counter. Not a dose: it depends on the detector.'],
];
const HISTORY = [
  [1896, 'Henri Becquerel', 'Uranium salts fog a wrapped photographic plate in a dark drawer. Radioactivity is discovered by accident.', 'Henri_Becquerel'],
  [1898, 'Marie and Pierre Curie', 'Working through tonnes of pitchblende, they find polonium and radium, and coin the word "radioactivity".', 'Marie_Curie'],
  [1899, 'Rutherford names α and β', 'Ernest Rutherford finds two kinds of rays: one stopped by paper (alpha), one far more penetrating (beta).', 'Ernest_Rutherford'],
  [1900, 'Villard finds gamma rays', 'Paul Villard sees a third, even more penetrating radiation from radium that magnets do not bend.', 'Paul_Ulrich_Villard'],
  [1902, 'Elements transmute', 'Rutherford and Soddy show that radioactive atoms turn into other elements: the alchemists\' dream, happening naturally.', 'Frederick_Soddy'],
  [1908, 'Alpha is helium', 'Rutherford and Royds trap alpha particles in a glass tube and see the light of helium.', 'Rutherford–Royds_experiment'],
  [1909, 'The gold foil experiment', 'Geiger and Marsden fire alphas at gold leaf; 1 in 8,000 bounce back. Atoms have a tiny nucleus.', 'Geiger–Marsden_experiments'],
  [1911, 'The cloud chamber', 'C.T.R. Wilson makes particle tracks visible as trails of mist in supersaturated vapour.', 'Cloud_chamber'],
  [1912, 'Cosmic rays', 'Victor Hess takes an electroscope up in a balloon to 5 km: radiation increases with height. It comes from space.', 'Victor_Francis_Hess'],
  [1920, 'The Radium Girls', 'Factory workers painting watch dials with radium lick their brushes. Their bone cancers lead to worker safety laws.', 'Radium_Girls'],
  [1928, 'The Geiger–Müller counter', 'Hans Geiger and Walther Müller build the clicking detector still used today.', 'Geiger_counter'],
  [1932, 'The neutron', 'James Chadwick identifies the neutral particle knocked out of beryllium by alpha rays.', 'James_Chadwick'],
  [1934, 'Artificial radioactivity', 'Irène and Frédéric Joliot-Curie make radioactive phosphorus by bombarding aluminium with alphas.', 'Irène_Joliot-Curie'],
  [1938, 'Nuclear fission', 'Hahn and Strassmann find barium after hitting uranium with neutrons; Meitner and Frisch explain the nucleus split.', 'Lise_Meitner'],
  [1942, 'Chicago Pile-1', 'Fermi\'s team runs the first human-made nuclear chain reaction under a Chicago stadium.', 'Chicago_Pile-1'],
  [1949, 'Carbon dating', 'Willard Libby shows that carbon-14 dates things that were once alive, up to about 50,000 years back.', 'Radiocarbon_dating'],
  [1972, 'Oklo natural reactor', 'French scientists find uranium that ran as a natural fission reactor in Gabon two billion years ago.', 'Natural_nuclear_fission_reactor'],
  [1986, 'Chernobyl', 'Reactor 4 explodes. 134 workers get acute radiation syndrome; 28 die within months. Iodine-131 in milk causes thousands of child thyroid cancers.', 'Chernobyl_disaster'],
  [1987, 'Goiânia accident', 'Scavengers open an abandoned cancer-therapy unit in Brazil and share glowing caesium-137 powder. Four people die.', 'Goiânia_accident'],
  [2011, 'Fukushima Daiichi', 'A tsunami disables cooling at three reactors. No deaths from radiation so far; about 2,000 from the evacuation itself.', 'Fukushima_nuclear_accident'],
];
// UNSCEAR 2008: world average annual dose, mSv
const ANNUAL = [['Radon (breathed in)', 1.26, '#b58cff'], ['Medical (X-rays, CT, nuclear medicine)', 0.6, '#5cc8f0'], ['Rocks and soil (gamma)', 0.48, '#e0a060'], ['Cosmic rays', 0.39, '#6aa0ff'], ['Food and water (K-40, C-14, Po-210)', 0.29, '#3ddc84'], ['Weapons test fallout', 0.005, '#ff7a5a'], ['Chernobyl (world average)', 0.002, '#ff4d5e'], ['Nuclear power', 0.0002, '#f2b84b']];
const LADDER = [
  [1e-7, 'Eating a banana'], [5e-6, 'Dental X-ray'], [1e-5, 'A day of natural background'], [4e-5, 'Flight New York to Los Angeles'], [1e-4, 'Chest X-ray'],
  [4e-4, 'Mammogram'], [2.4e-3, 'A year of natural background (world average)'], [7e-3, 'CT scan of the chest'], [2e-2, 'Yearly limit for radiation workers (ICRP, averaged)'],
  [0.1, 'Lowest dose with a measured cancer increase'], [0.26, 'Yearly dose in the highest-background homes, Ramsar, Iran'], [1, 'Radiation sickness begins'], [4, 'Half of people die without treatment'], [8, 'Death likely even with care'], [50, 'Death within about two days'],
];
const USES = [
  ['Medical imaging', 'Tc', 'Technetium-99m: 40 million scans a year of bone, heart and more. Fluorine-18 in PET scans lights up tumours that burn sugar.'],
  ['Cancer treatment', 'Lu', 'Radiotherapy beams (linacs, cobalt-60, protons) and injected isotopes like lutetium-177 and radium-223 kill tumour cells.'],
  ['Thyroid therapy', 'I', 'Iodine-131 goes straight to the thyroid and destroys overactive or cancerous tissue from the inside.'],
  ['Smoke detectors', 'Am', 'Americium-241 in hundreds of millions of homes.'],
  ['Dating the past', 'C', 'Carbon-14 (5,730 years) dates bones, wood and cloth; uranium-lead dates the oldest rocks, 4.4 billion years.'],
  ['Power in deep space', 'Pu', 'Plutonium-238 heat powers Voyager (still working since 1977), Curiosity and Perseverance.'],
  ['Sterilisation', 'Co', 'Cobalt-60 gamma rays sterilise syringes, gloves and implants inside their sealed packaging, and some foods.'],
  ['Nuclear power', 'U', 'Uranium-235 fission makes about 9% of the world\'s electricity with almost no CO₂.'],
  ['Industry', 'Ir', 'Iridium-192 X-rays welds for cracks; radioactive gauges control paper and steel thickness.'],
];
// Uranium-238 series. Half-lives from NUBASE / ENSDF.
const CHAIN = [
  ['U-238', 'U', '4.47 billion y', 'α'], ['Th-234', 'Th', '24.1 d', 'β⁻'], ['Pa-234m', 'Pa', '1.17 min', 'β⁻'], ['U-234', 'U', '245,500 y', 'α'], ['Th-230', 'Th', '75,400 y', 'α'],
  ['Ra-226', 'Ra', '1,600 y', 'α'], ['Rn-222', 'Rn', '3.82 d', 'α'], ['Po-218', 'Po', '3.10 min', 'α'], ['Pb-214', 'Pb', '26.8 min', 'β⁻'], ['Bi-214', 'Bi', '19.9 min', 'β⁻'],
  ['Po-214', 'Po', '164 µs', 'α'], ['Pb-210', 'Pb', '22.2 y', 'β⁻'], ['Bi-210', 'Bi', '5.01 d', 'β⁻'], ['Po-210', 'Po', '138 d', 'α'], ['Pb-206', 'Pb', 'stable', ''],
];
const COL = { alpha: '#ff5a4a', beta: '#5ab4ff', gamma: '#ffd84a', neutron: '#c8c8d0', muon: '#9be15d' };

export function buildRadioactivity(root, { openElement }) {
  const st = { src: SOURCES[3], shield: 'none', dist: 5, view: 'chamber', sound: false, t: 0 };
  const cv = h('canvas', { 'aria-label': 'Radioactivity animation' });
  const hud = h('div', { class: 'rad-hud' });
  const stage = h('div', { class: 'stage stage-tall' }, cv, hud);
  const ctx = cv.getContext('2d');

  // ---- controls ----
  const srcList = h('div', { class: 'src-list' }, SOURCES.map(s => h('button', { class: 'src-btn', 'data-k': s.k, style: { '--c': s.em.alpha ? COL.alpha : s.em.beta ? COL.beta : COL.gamma }, onclick: () => { st.src = s; reset(); sync(); } },
    h('span', { class: 'dot' }), h('span', {}, h('b', {}, s.name), h('span', {}, `${s.nuc} · ${Object.keys(s.em).map(k => ({ alpha: 'α', beta: 'β', gamma: 'γ' })[k]).join(' ')}`)), h('span', { class: 'n' }, fmtBq(s.A)))));
  const shieldSel = h('select', { id: 'ra-shield', onchange: () => { st.shield = shieldSel.value; sync(); } }, SHIELDS.map(([k, l]) => h('option', { value: k }, l)));
  const distS = h('input', { type: 'range', id: 'ra-dist', min: 0, max: 300, value: 70 });
  const distV = h('b', {});
  distS.addEventListener('input', () => { st.dist = Math.pow(10, distS.value / 100); sync(); });
  const soundBtn = h('button', { class: 'btn small', onclick: () => { st.sound = !st.sound; soundBtn.textContent = st.sound ? 'Sound on' : 'Sound off'; if (st.sound) audio(); } }, 'Sound off');
  const viewSeg = h('div', { class: 'seg' }, [['chamber', 'Cloud chamber'], ['geiger', 'Geiger counter'], ['shield', 'What stops it'], ['decay', 'Half-life']].map(([k, l]) => h('button', { 'data-k': k, class: k === st.view ? 'on' : '', onclick: () => { st.view = k; for (const b of viewSeg.children) b.classList.toggle('on', b.dataset.k === k); reset(); sync(); } }, l)));
  const srcInfo = h('div', { class: 'card stack' });
  const readout = h('div', { class: 'kpis' });

  // ---- physics of the setup ----
  function rates() {
    const s = st.src, d = st.dist, geo = Math.min(0.5, WINDOW / (4 * Math.PI * d * d));
    const per = {};
    let cps = BG_CPS;
    for (const [type, n] of Object.entries(s.em)) { const r = s.A * n * geo * transmission(s, type, st.shield, d) * EFF[type]; per[type] = r; cps += r; }
    const trueCps = cps; cps = cps / (1 + cps * DEAD); // the tube is blind for ~100 µs after each click
    const tg = s.em.gamma ? transmission(s, 'gamma', st.shield, d) : 0;
    const usvh = BG_USVH + s.G * (s.A / 1e6) / Math.pow(d / 100, 2) * tg;
    return { cps, per, usvh, trueCps };
  }
  function sync() {
    for (const b of srcList.children) b.classList.toggle('on', b.dataset.k === st.src.k);
    distV.textContent = st.dist >= 100 ? `${fmt(st.dist / 100, 3)} m` : `${fmt(st.dist, 2)} cm`;
    const s = st.src, R = rates(), el = bySym[s.sym];
    srcInfo.replaceChildren(
      h('div', { class: 'panel-title' }, h('h3', {}, `${s.name}: ${s.nuc}`), el ? h('button', { class: 'btn small', onclick: () => openElement(el) }, `Open ${el.name} →`) : ''),
      h('p', { style: { margin: 0 } }, s.text),
      h('div', { class: 'stat-grid' }, stat('Activity', fmtBq(s.A)), stat('In curies', `${sci(s.A / 3.7e10, 2)} Ci`), stat('Half-life', fmtT(s.hl)), stat('Per decay', Object.entries(s.em).map(([k, n]) => `${({ alpha: 'α', beta: 'β', gamma: 'γ' })[k]} ${fmtMeV(s.E[k])}${n !== 1 ? ` ×${fmt(n, 2)}` : ''}`).join(' · ')),
        stat('Alpha range in air', s.E.alpha ? `${fmt(alphaRangeAir(s.E.alpha), 2)} cm` : '—'), stat('Beta range in aluminium', s.E.beta ? `${fmt(betaRangeAl(s.E.beta) * 10, 2)} mm` : '—'), stat('Gamma half-value layer in lead', s.E.gamma ? `${fmt(hvl('pb', s.E.gamma) * 10, 2)} mm` : '—')));
    const pct = type => (R.per[type] != null ? `${fmt(transmission(s, type, st.shield, st.dist) * 100, 3)}%` : '—');
    readout.replaceChildren(
      kpi(`${fmt(R.cps * 60, 3)} cpm`, R.trueCps > R.cps * 1.1 ? `Geiger reading (${fmt((1 - R.cps / R.trueCps) * 100, 2)}% lost to dead time)` : 'Geiger counter reading'), kpi(`${fmt(R.usvh, 3)} µSv/h`, 'dose rate, incl. background 0.1'),
      kpi(pct('alpha'), 'alpha getting through'), kpi(pct('beta'), 'beta getting through'), kpi(pct('gamma'), 'gamma getting through'));
  }

  // ---- animation state ----
  let tracks = [], atoms = [], decayLog = [], counts = [], clickFlash = 0, raf = 0, last = 0, acc = 0, lanes = [];
  function reset() {
    tracks = []; decayLog = []; counts = []; acc = 0; st.t = 0; lanes = [];
    if (st.view === 'decay') { atoms = Array.from({ length: 400 }, () => ({ alive: true, flash: 0 })); decayLog = [[0, 400]]; }
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!cv.offsetParent) return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; st.t += dt;
    const { w, h: H } = fitCanvas(cv, ctx);
    ctx.fillStyle = SCREEN(); ctx.fillRect(0, 0, w, H);
    if (st.view === 'chamber') chamber(dt, w, H);
    else if (st.view === 'geiger') geiger(dt, w, H);
    else if (st.view === 'shield') shieldLab(dt, w, H);
    else decay(dt, w, H);
  }

  // Cloud chamber: tracks condense as trails of mist and slowly drift and fade
  function chamber(dt, w, H) {
    const s = st.src, sx = 40, sy = H * 0.55, pxPerCm = Math.min(w, 900) / 30;
    // source emits into the chamber: we show a reduced rate so tracks stay readable (a real 37 kBq source would fill it)
    const vis = clamp(Math.log10(s.A) * 1.2, 0.5, 12);
    for (const [type, n] of Object.entries(s.em)) {
      let rate = vis * n * (type === 'gamma' ? 0.15 : 1);
      if (type === 'alpha' || type === 'beta') rate *= transmission(s, type, st.shield === 'paper' || st.shield === 'al' ? st.shield : 'none', 0.1) > 0 ? 1 : 0;
      if (Math.random() < rate * dt) tracks.push(makeTrack(type, sx, sy, s.E[type], pxPerCm, w, H, true));
    }
    // background: cosmic muons (~1 per cm² per minute at sea level) and radon alphas
    if (Math.random() < dt * 0.9) tracks.push(makeTrack('muon', 0, 0, 0, pxPerCm, w, H));
    if (Math.random() < dt * 0.25) tracks.push(makeTrack('alpha', 0, 0, 5.5, pxPerCm, w, H));
    if (Math.random() < dt * 0.4) tracks.push(makeTrack('beta', 0, 0, 0.5, pxPerCm, w, H));
    // vapour haze
    const g = ctx.createRadialGradient(w / 2, H / 2, 10, w / 2, H / 2, Math.max(w, H) * 0.7);
    g.addColorStop(0, 'rgba(90,110,130,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, H);
    ctx.lineCap = 'round';
    tracks = tracks.filter(t => (t.age += dt) < t.life);
    for (const t of tracks) {
      const grow = clamp(t.age / 0.12, 0, 1), fade = 1 - t.age / t.life, drift = t.age * 6;
      const n = Math.max(2, Math.round(t.pts.length * grow));
      ctx.strokeStyle = `rgba(235,240,250,${0.85 * fade})`; ctx.lineWidth = t.width * (1 + t.age * 1.5);
      ctx.shadowColor = t.col; ctx.shadowBlur = 6 * fade;
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const [x, y] = t.pts[i]; const wob = Math.sin(i * 0.12 + t.seed) * t.age * 0.8; i ? ctx.lineTo(x + wob, y + drift) : ctx.moveTo(x + wob, y + drift); }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // source holder and shield
    ctx.fillStyle = '#6b6b73'; ctx.fillRect(sx - 30, sy - 10, 30, 20);
    ctx.fillStyle = COL[s.em.alpha ? 'alpha' : s.em.beta ? 'beta' : 'gamma']; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
    if (st.shield === 'paper' || st.shield === 'al') { ctx.fillStyle = st.shield === 'paper' ? 'rgba(240,235,220,.85)' : 'rgba(180,190,200,.9)'; ctx.fillRect(sx + 10, sy - 60, st.shield === 'paper' ? 2 : 5, 120); }
    legend([['alpha', 'α: short, thick, straight'], ['beta', 'β: thin, long, wiggly'], ['gamma', 'γ: via knocked-out electrons'], ['muon', 'cosmic muon: crosses the whole chamber']], w);
    scale(pxPerCm, w, H);
    hud.textContent = 'Cloud chamber: charged particles leave trails of alcohol mist. Tracks on the left come from the source; the rest is natural background, cosmic rays and radon, always around you.';
  }
  function makeTrack(type, sx, sy, E, ppc, w, H, fromSrc) {
    let x = sx, y = sy, a;
    if (!fromSrc) { x = Math.random() * w; y = Math.random() * H; }
    a = fromSrc ? (Math.random() - 0.5) * Math.PI * 0.9 : Math.random() * Math.PI * 2;
    const pts = [[x, y]];
    let len, width, life, curl = 0;
    if (type === 'alpha') { len = alphaRangeAir(E) * ppc * (0.95 + Math.random() * 0.1); width = 4.2; life = 2.4; }
    else if (type === 'beta') { len = Math.min(w * 0.9, (60 + Math.random() * 200) * Math.min(E, 2.5)); width = 1.3; life = 2.0; curl = 0.25; }
    else if (type === 'gamma') { // Compton electron somewhere along the photon's path
      const d = 60 + Math.random() * w * 0.8; x += Math.cos(a) * d; y += Math.sin(a) * d; pts[0] = [x, y]; a = Math.random() * Math.PI * 2;
      len = 20 + Math.random() * 60; width = 1.1; life = 1.8; curl = 0.5;
    } else { // muon crosses the chamber
      x = Math.random() * w; y = -10; a = Math.PI / 2 + (Math.random() - 0.5) * 1.2; len = H * 1.6; width = 1.1; life = 1.6; curl = 0.01;
      pts[0] = [x, y];
    }
    const step = 4, n = Math.ceil(len / step);
    for (let i = 0; i < n; i++) { a += (Math.random() - 0.5) * curl * (type === 'beta' ? 1 + i / n * 2 : 1); x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push([x, y]); }
    return { pts, width, life, age: 0, col: COL[type === 'muon' ? 'muon' : type], seed: Math.random() * 10 };
  }

  // Geiger counter with the real count rate (clicks are Poisson-random)
  function geiger(dt, w, H) {
    const s = st.src, R = rates();
    const sx = 70, dx = 70 + clamp(Math.log10(st.dist) / 3, 0.05, 1) * (w - 260), cy = H * 0.45;
    // particles flying (visual only, capped)
    for (const [type, n] of Object.entries(s.em)) if (Math.random() < dt * clamp(Math.log10(s.A) * n, 0.3, 14)) tracks.push({ type, x: sx, y: cy, a: (Math.random() - 0.5) * 0.8, v: type === 'gamma' ? 700 : type === 'beta' ? 420 : 160, age: 0, T: transmission(s, type, st.shield, st.dist), dead: false });
    const slabX = (sx + dx) / 2;
    tracks = tracks.filter(p => p.age < 3 && p.x < w + 20 && !p.dead);
    for (const p of tracks) {
      const nx = p.x + Math.cos(p.a) * p.v * dt;
      if (p.type === 'alpha' && (nx - sx) / Math.max(1, dx - sx) > alphaRangeAir(s.E.alpha) / st.dist) { p.dead = true; continue; }
      if (st.shield !== 'none' && p.x < slabX && nx >= slabX && Math.random() > (p.type === 'alpha' ? 0 : transmission(s, p.type, st.shield, 0.1))) { p.dead = true; continue; }
      p.x = nx; p.y += Math.sin(p.a) * p.v * dt; p.age += dt;
      ctx.fillStyle = COL[p.type]; ctx.beginPath(); ctx.arc(p.x, p.y, p.type === 'alpha' ? 3.5 : 2, 0, Math.PI * 2); ctx.fill();
    }
    // counts
    acc += dt;
    const n = poisson(R.cps * dt);
    if (n > 0) { clickFlash = 1; if (st.sound) for (let i = 0; i < Math.min(n, 6); i++) click(i * 0.004); }
    counts.push(n);
    if (counts.length > 600) counts.shift();
    clickFlash = Math.max(0, clickFlash - dt * 8);
    // drawing: source, shield, tube
    ctx.fillStyle = '#6b6b73'; ctx.fillRect(sx - 40, cy - 14, 40, 28);
    ctx.fillStyle = COL[s.em.alpha ? 'alpha' : s.em.beta ? 'beta' : 'gamma']; ctx.beginPath(); ctx.arc(sx, cy, 7, 0, Math.PI * 2); ctx.fill();
    if (st.shield !== 'none') {
      const sh = { paper: ['rgba(240,235,220,.9)', 3], al: ['#b4bec8', 8], pb1: ['#5a6070', 16], pb5: ['#4a5060', 34], conc: ['#8a8a82', 50] }[st.shield];
      ctx.fillStyle = sh[0]; ctx.fillRect(slabX - sh[1] / 2, cy - 90, sh[1], 180);
    }
    ctx.fillStyle = `rgba(255,220,120,${0.25 + clickFlash * 0.7})`; ctx.fillRect(dx, cy - 26, 150, 52);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.strokeRect(dx, cy - 26, 150, 52);
    ctx.fillStyle = '#111'; ctx.font = `700 14px ${FONT}`; ctx.fillText('Geiger tube', dx + 36, cy + 5);
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(sx, cy + 44); ctx.lineTo(dx, cy + 44); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(240,240,245,.8)'; ctx.font = `600 13px ${FONT}`; ctx.fillText(distV.textContent, (sx + dx) / 2 - 20, cy + 62);
    // count-rate strip: counts per second over the last 10 s
    const bins = []; for (let i = 0; i < counts.length; i += 60) bins.push(counts.slice(i, i + 60).reduce((a, b) => a + b, 0));
    const bx = 24, by = H - 72, bw = w - 48, bh = H * 0.2, mx = Math.max(5, ...bins);
    ctx.fillStyle = 'rgba(240,240,245,.7)'; ctx.fillText('Counts per second, last 10 s', bx, by - bh - 22);
    bins.forEach((v, i) => { const x = bx + i * bw / 10; ctx.fillStyle = COL.gamma; ctx.fillRect(x + 3, by - v / mx * bh, bw / 10 - 6, v / mx * bh); ctx.fillStyle = 'rgba(240,240,245,.8)'; ctx.fillText(v, x + bw / 20 - 4, by - v / mx * bh - 4); });
    hud.textContent = `Reading ${fmt(R.cps * 60, 3)} counts per minute (background alone is about ${BG_CPS * 60}). Each click is one particle; they arrive at random, which is why the bars jump around.`;
  }

  // Classic "what stops it" lanes: alpha, beta, gamma, neutron vs paper, aluminium, lead, water
  function shieldLab(dt, w, H) {
    const types = ['alpha', 'beta', 'gamma', 'neutron'], names = ['α alpha', 'β beta', 'γ gamma', 'n neutron'];
    const walls = [['Paper', 0.3, 'rgba(240,235,220,.9)', 4], ['Aluminium 5 mm', 0.48, '#b4bec8', 10], ['Lead 2 cm', 0.66, '#5a6070', 22], ['Water 50 cm', 0.84, 'rgba(90,150,230,.6)', 40]];
    // chance to pass each wall: alpha 0 at paper; beta stopped by aluminium; gamma (1 MeV) halves per ~1 cm lead; neutron slowed and absorbed by water
    const pass = { alpha: [0, 0, 0, 0], beta: [0.9, 0.02, 0, 0], gamma: [1, 0.97, 0.28, 0.5], neutron: [1, 0.99, 0.9, 0.08] };
    const top = 40, laneH = (H - top - 80) / 4;
    ctx.font = `700 14px ${FONT}`;
    for (const [name, fx, c, ww] of walls) { ctx.fillStyle = c; ctx.fillRect(fx * w - ww / 2, top - 8, ww, H - top - 70); ctx.fillStyle = 'rgba(240,240,245,.85)'; ctx.textAlign = 'center'; ctx.fillText(name, fx * w, top - 16); }
    ctx.textAlign = 'left';
    types.forEach((t, i) => {
      const y = top + laneH * (i + 0.5);
      ctx.fillStyle = COL[t]; ctx.fillText(names[i], 12, y + 5);
      if (Math.random() < dt * 6) tracks.push({ t, x: 110, y: y + (Math.random() - 0.5) * laneH * 0.5, wall: 0, v: t === 'alpha' ? 180 : t === 'beta' ? 300 : t === 'gamma' ? 420 : 260, dead: 0 });
    });
    tracks = tracks.filter(p => p.x < w + 10 && p.dead < 1);
    for (const p of tracks) {
      if (p.dead) { p.dead += dt * 3; ctx.fillStyle = `rgba(255,255,255,${1 - p.dead})`; ctx.beginPath(); ctx.arc(p.x, p.y, 5 * (1 + p.dead), 0, Math.PI * 2); ctx.fill(); continue; }
      const nx = p.x + p.v * dt;
      if (p.wall < 4 && nx >= walls[p.wall][1] * w - walls[p.wall][3] / 2) { if (Math.random() > pass[p.t][p.wall]) { p.dead = 0.01; continue; } p.wall++; }
      p.x = nx;
      ctx.fillStyle = COL[p.t]; ctx.beginPath();
      if (p.t === 'gamma') { ctx.strokeStyle = COL.gamma; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 14; k++) { const xx = p.x - k * 2, yy = p.y + Math.sin((p.x - k * 2) * 0.35) * 4; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
      else { ctx.arc(p.x, p.y, p.t === 'alpha' ? 5 : p.t === 'neutron' ? 4 : 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    hud.textContent = 'Alpha stops in paper. Beta stops in a few millimetres of aluminium. Gamma rays are only thinned out: every ~1 cm of lead halves a 1 MeV beam. Neutrons pass lead but are stopped by the hydrogen in water.';
  }

  // Half-life: 400 atoms, each decays at random; the half-life is shown as 4 seconds
  function decay(dt, w, H) {
    const s = st.src, T = 4, lam = Math.LN2 / T;
    const alive = atoms.filter(a => a.alive).length;
    const gw = Math.min(w * 0.45, H - 120), cell = gw / 20, gx = 30, gy = 36;
    if (alive) for (const a of atoms) if (a.alive && Math.random() < lam * dt) { a.alive = false; a.flash = 1; }
    const nowAlive = atoms.filter(a => a.alive).length;
    if (!decayLog.length || st.t - decayLog[decayLog.length - 1][0] > 0.1) decayLog.push([st.t, nowAlive]);
    atoms.forEach((a, i) => {
      const x = gx + (i % 20) * cell + cell / 2, y = gy + ((i / 20) | 0) * cell + cell / 2;
      a.flash = Math.max(0, a.flash - dt * 2);
      ctx.fillStyle = a.alive ? '#ff9f40' : '#4a5a70';
      ctx.beginPath(); ctx.arc(x, y, cell * 0.36, 0, Math.PI * 2); ctx.fill();
      if (a.flash) { ctx.strokeStyle = `rgba(255,255,200,${a.flash})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, cell * (0.4 + (1 - a.flash) * 0.8), 0, Math.PI * 2); ctx.stroke(); }
    });
    // curve
    const px = gx + gw + 50, pw = w - px - 36, py = gy, ph = gw, tmax = 5 * T;
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.strokeRect(px, py, pw, ph);
    ctx.font = `600 12px ${FONT}`; ctx.fillStyle = 'rgba(240,240,245,.75)';
    for (let k = 0; k <= 5; k++) { const x = px + k / 5 * pw; ctx.fillText(k ? `${k} t½` : '0', x - 8, py + ph + 16); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py + ph); ctx.stroke(); }
    for (const f of [1, 0.5, 0.25, 0.125]) { const y = py + (1 - f) * ph; ctx.fillText(`${f * 400}`, px - 30, y + 4); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.setLineDash([5, 5]); ctx.beginPath();
    for (let t = 0; t <= tmax; t += 0.1) { const x = px + t / tmax * pw, y = py + (1 - Math.exp(-lam * t)) * ph; t ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#ff9f40'; ctx.lineWidth = 2.5; ctx.beginPath();
    decayLog.forEach(([t, n], i) => { const x = px + Math.min(t, tmax) / tmax * pw, y = py + (1 - n / 400) * ph; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,240,245,.9)'; ctx.font = `700 14px ${FONT}`;
    ctx.fillText(`${nowAlive} of 400 ${s.nuc} atoms left`, px, py - 12);
    const real = st.t / T * s.hl;
    hud.textContent = `Every 4 seconds here is one real half-life of ${s.nuc}: ${fmtT(s.hl)}. Elapsed real time: ${fmtT(real)}. No one can predict which atom goes next, but the dashed curve (N = N₀ · ½^(t/t½)) predicts how many.`;
    if (st.t > tmax + 2) reset();
  }

  function legend(items, w) {
    ctx.font = `600 12px ${FONT}`; let y = 18;
    for (const [k, l] of items) { const x0 = w - 20 - Math.max(...items.map(i => ctx.measureText(i[1]).width)) - 16; ctx.fillStyle = COL[k]; ctx.fillRect(x0, y - 8, 10, 10); ctx.fillStyle = 'rgba(240,240,245,.85)'; ctx.fillText(l, x0 + 16, y + 1); y += 18; }
  }
  function scale(ppc, w, H) { ctx.strokeStyle = 'rgba(240,240,245,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w - 20 - ppc * 5, H - 16); ctx.lineTo(w - 20, H - 16); ctx.stroke(); ctx.fillStyle = 'rgba(240,240,245,.8)'; ctx.font = `600 12px ${FONT}`; ctx.fillText('5 cm', w - 20 - ppc * 2.5 - 12, H - 22); }

  // sound: short noise burst like a real Geiger click
  let actx = null;
  function audio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume?.(); } catch { actx = null; } }
  function click(delay) {
    if (!actx) return;
    const t0 = actx.currentTime + delay, len = 0.004, buf = actx.createBuffer(1, Math.ceil(actx.sampleRate * len), actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = actx.createBufferSource(), g = actx.createGain(); g.gain.value = 0.5; src.buffer = buf; src.connect(g).connect(actx.destination); src.start(t0);
  }

  // ---------- tabs ----------
  const typeTable = h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, ...['Symbol', 'Radiation', 'What it is', 'Charge', 'Mass', 'Energy', 'Range in air', 'Stopped by', 'Hazard'].map(t => h('th', {}, t)))),
    h('tbody', {}, TYPES.map(r => h('tr', {}, h('td', { style: { font: '700 20px var(--display)' } }, r[0]), ...r.slice(1).map(c => h('td', {}, c)))))));
  const gloss = h('dl', { class: 'gloss' }, GLOSSARY.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
  const decayEq = h('div', { class: 'cols' },
    eqCard('Alpha decay', '(A, Z) → (A − 4, Z − 2) + ⁴He', 'The nucleus loses 2 protons and 2 neutrons. Example: ²³⁸U → ²³⁴Th + α', COL.alpha),
    eqCard('Beta-minus decay', 'n → p + e⁻ + ν̄', 'A neutron becomes a proton: Z goes up by one. Example: ¹⁴C → ¹⁴N + e⁻ + ν̄', COL.beta),
    eqCard('Beta-plus decay', 'p → n + e⁺ + ν', 'A proton becomes a neutron: Z goes down by one. Example: ¹⁸F → ¹⁸O + e⁺ + ν', COL.beta),
    eqCard('Gamma emission', 'X* → X + γ', 'An excited nucleus (*) drops to a lower energy. Nothing changes but energy. Example: ⁹⁹ᵐTc → ⁹⁹Tc + γ (140 keV)', COL.gamma));

  const histGrid = h('div', { class: 'history-grid' }, HISTORY.map(([y, t, txt, wiki]) => {
    const img = h('img', { alt: t, loading: 'lazy' }); const ph = h('div', { class: 'hphoto' }, h('span', { class: 'ph-year' }, y), img);
    img.onload = () => ph.classList.add('loaded'); img.onerror = () => ph.classList.add('none');
    photo(wiki).then(src => { if (src) img.src = src; else ph.classList.add('none'); });
    return h('article', { class: 'hcard' }, ph, h('div', { class: 'hbody' }, h('span', { class: 'year' }, y), h('b', {}, t), h('p', {}, txt), h('a', { href: `https://en.wikipedia.org/wiki/${wiki}`, target: '_blank', rel: 'noopener' }, 'Read more →')));
  }));

  const maxA = Math.max(...ANNUAL.map(a => a[1])), totA = ANNUAL.reduce((a, b) => a + b[1], 0);
  const annual = h('div', { class: 'stack', style: { gap: '8px' } },
    h('div', { class: 'origin-bar', style: { height: '30px' } }, ANNUAL.map(([n, v, c]) => h('span', { title: `${n}: ${v} mSv`, style: { flex: v, background: c } }))),
    ...ANNUAL.map(([n, v, c]) => h('div', { class: 'hbar' }, h('span', {}, n), h('div', { class: 'track' }, h('i', { style: { width: `${Math.max(0.5, v / maxA * 100)}%`, background: c } })), h('b', {}, `${v} mSv`))),
    h('p', { class: 'hint-text', style: { margin: 0 } }, `World average ${fmt(totA, 3)} mSv per person per year (UNSCEAR 2008). Radon alone is about half. Countries vary: about 6 mSv in the USA (lots of CT scans), 7 mSv in Finland (radon).`));
  const aroundCards = h('div', { class: 'cols' },
    info('Inside you', 'About 4,400 Bq of potassium-40 and 3,700 Bq of carbon-14: roughly 8,000 atoms decaying every second in a 70 kg adult. You give a partner a tiny dose when you share a bed.'),
    info('Brazil nuts', 'The most radioactive common food: 40–260 Bq/kg of radium, pulled from the soil by the tree\'s deep roots.'),
    info('Granite', 'Contains uranium and thorium. Grand Central Terminal in New York, built of granite, gives a higher dose than most nuclear plants\' fence lines.'),
    info('Flying', 'At 11 km, less air shields you from cosmic rays: about 3–5 µSv per hour. Aircrew are among the most exposed workers.'),
    info('High-background places', 'Ramsar in Iran (up to 260 mSv/year), Guarapari beaches in Brazil and Kerala in India (thorium sands). Studies have not found clear health effects.'),
    info('Tobacco', 'Polonium-210 sticks to tobacco leaves. A pack a day gives the lungs a dose many times the yearly background.'));

  const lmin = -7.5, lmax = 2;
  const ladder = h('div', { class: 'ladder' }, LADDER.map(([v, l]) => h('div', { class: `rung ${v >= 1 ? 'lv-danger' : v >= 0.1 ? 'lv-warn' : ''}` },
    h('div', { class: 'lbar' }, h('i', { style: { width: `${(Math.log10(v) - lmin) / (lmax - lmin) * 100}%` } })), h('b', {}, fmtSv(v)), h('span', {}, l))));
  const usesGrid = h('div', { class: 'cols' }, USES.map(([t, sym, txt]) => h('button', { class: 'card stack use-card', onclick: () => bySym[sym] && openElement(bySym[sym]) }, h('div', { class: 'row' }, h('span', { class: 'mini-sym' }, sym), h('b', {}, t)), h('p', { style: { margin: 0 } }, txt))));
  const chain = h('div', { class: 'chain' }, CHAIN.map(([n, sym, hl, mode], i) => [
    h('button', { class: `chain-step ${hl === 'stable' ? 'stable' : ''}`, onclick: () => bySym[sym] && openElement(bySym[sym]) }, h('b', {}, n), h('small', {}, hl)),
    i < CHAIN.length - 1 ? h('span', { class: `chain-arrow ${mode === 'α' ? 'a' : 'b'}` }, mode) : '',
  ]).flat());

  const t = tabs([
    { key: 'what', label: 'What is it?', body: h('div', { class: 'stack' }, h('div', { class: 'card stack' }, h('h3', {}, 'Four ways a nucleus lets go'), decayEq, h('p', { class: 'hint-text', style: { margin: 0 } }, 'How to read the symbols: the big letter is the element, the top-left number is A (protons + neutrons), the bottom-left is Z (protons). e⁻ electron, e⁺ positron, ν neutrino, ν̄ antineutrino, γ gamma photon, * excited nucleus, m metastable (long-lived excited state).')), h('div', { class: 'card stack' }, h('h3', {}, 'Words and units'), gloss)) },
    { key: 'types', label: 'Types of radiation', body: h('div', { class: 'card stack' }, typeTable) },
    { key: 'history', label: 'History & experiments', body: histGrid },
    { key: 'around', label: 'Around you', body: h('div', { class: 'stack' }, h('div', { class: 'card stack' }, h('h3', {}, 'Where your yearly dose comes from'), annual), aroundCards) },
    { key: 'doses', label: 'Dose scale', body: h('div', { class: 'card stack' }, h('h3', {}, 'From a banana to lethal: effective dose in sieverts (log scale)'), ladder, h('p', { class: 'hint-text', style: { margin: 0 } }, 'Each step of the bar is 10× the one before. Values: UNSCEAR, ICRP, US NRC, WHO. Try any of these on the Human Body page.')) },
    { key: 'chain', label: 'Decay chain', body: h('div', { class: 'card stack' }, h('h3', {}, 'Uranium-238 to lead-206: 14 decays'), h('p', { style: { margin: 0 } }, 'Every uranium atom in the ground slowly walks this path. Radon-222, a gas, is the step that escapes from rock into homes. Tap a step to open the element.'), chain, h('p', { class: 'hint-text', style: { margin: 0 } }, 'Red arrows: alpha decay (mass −4). Blue arrows: beta decay (mass unchanged). Half-lives from NUBASE and ENSDF.')) },
    { key: 'uses', label: 'Uses', body: usesGrid },
  ]);

  workspace(root, {
    eyebrow: 'Radioactivity', title: 'Unstable atoms', intro: 'Real sources, real counts and real shielding data. Pick a source, move the detector, add a shield.',
    side: [
      group('Show', viewSeg),
      group('Source', srcList),
      group('Setup', h('div', { class: 'field' }, h('label', { for: 'ra-shield' }, 'Shield'), shieldSel), h('div', { class: 'field' }, h('label', { for: 'ra-dist' }, 'Distance to detector', distV), distS), h('div', { class: 'row' }, soundBtn, h('span', { class: 'hint-text' }, 'Geiger clicks'))),
    ],
    main: [stage, readout, srcInfo, t.root],
  });
  st.dist = Math.pow(10, distS.value / 100);
  reset(); sync();
  return { show() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }, hide() { cancelAnimationFrame(raf); raf = 0; } };
}

const photoCache = {};
function photo(page) {
  if (!(page in photoCache)) photoCache[page] = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`, { headers: { accept: 'application/json' } }).then(r => (r.ok ? r.json() : null)).then(j => j?.thumbnail?.source || null).catch(() => null);
  return photoCache[page];
}
function poisson(mu) { if (mu > 30) return Math.max(0, Math.round(mu + Math.sqrt(mu) * gauss())); let L = Math.exp(-mu), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
function gauss() { return Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random()); }
function stat(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v', style: { fontSize: '14px' } }, v)); }
function kpi(v, l) { return h('div', {}, h('b', {}, v), h('span', {}, l)); }
function info(t, txt) { return h('div', { class: 'card stack' }, h('h3', {}, t), h('p', { style: { margin: 0 } }, txt)); }
function eqCard(t, eq, txt, c) { return h('div', { class: 'eq-card', style: { borderColor: c } }, h('b', {}, t), h('div', { class: 'eq' }, eq), h('p', {}, txt)); }
function fmtBq(a) { return a >= 1e9 ? `${fmt(a / 1e9, 3)} GBq` : a >= 1e6 ? `${fmt(a / 1e6, 3)} MBq` : a >= 1e3 ? `${fmt(a / 1e3, 3)} kBq` : `${fmt(a, 3)} Bq`; }
function fmtMeV(e) { return e >= 1 ? `${fmt(e, 3)} MeV` : `${fmt(e * 1000, 3)} keV`; }
function fmtSv(v) { return v >= 1 ? `${fmt(v, 3)} Sv` : v >= 1e-3 ? `${fmt(v * 1e3, 3)} mSv` : `${fmt(v * 1e6, 3)} µSv`; }
function fmtT(s) {
  if (s < 60) return `${fmt(s, 3)} s`;
  if (s < 3600) return `${fmt(s / 60, 3)} min`;
  if (s < DAY) return `${fmt(s / 3600, 3)} h`;
  if (s < YEAR) return `${fmt(s / DAY, 3)} days`;
  if (s < 1e6 * YEAR) return `${fmt(s / YEAR, 4)} years`;
  if (s < 1e9 * YEAR) return `${fmt(s / YEAR / 1e6, 3)} million years`;
  return `${fmt(s / YEAR / 1e9, 3)} billion years`;
}
