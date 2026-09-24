// Build your own collider: design model, construction and generated missions.
import { SITES, MAGNETS, LINACS, DETECTORS } from './data.js';
import * as P from './physics.js';
import { newState, say, SECTORS, significance, availableProcesses, date } from './sim.js';
import { chance, rand, clamp, pick, fmt, money } from './util.js';

const HPM = 8766 / 12;
export const DEFAULT_DESIGN = {
  name: 'My Collider', site: 'geneva', kind: 'hadron', circKm: 50, magnet: 'nb3sn', Ebeam: 120, Psr: 50, crabWaist: true, topUp: true,
  linac: 'srf', lengthKm: 20, Pwall: 120, dets: { gp: 2, bphys: 1, ions: 0, ee: 2 }, tbm: 4, lines: 4, difficulty: 'realistic', startYear: 2035,
};
export const SCENARIOS = [
  { id: 'fcchh', name: 'FCC-hh', sub: '91 km, 14 T Nb₃Sn magnets, ~85 TeV. CERN\'s proposed successor to the LHC.', d: { name: 'FCC-hh', site: 'geneva', kind: 'hadron', circKm: 90.7, magnet: 'nb3sn', dets: { gp: 2, bphys: 1, ions: 0, ee: 0 }, tbm: 8, lines: 8, startYear: 2045 } },
  { id: 'fccee', name: 'FCC-ee', sub: '91 km electron-positron Higgs, Z, W and top factory.', d: { name: 'FCC-ee', site: 'geneva', kind: 'lepton', circKm: 90.7, Ebeam: 182.5, Psr: 50, crabWaist: true, topUp: true, dets: { gp: 0, bphys: 0, ions: 0, ee: 4 }, tbm: 8, lines: 4, startYear: 2033 } },
  { id: 'ssc', name: 'SSC, Texas 1989', sub: '87 km, 20 TeV per beam. Can you keep Congress on board this time?', d: { name: 'Superconducting Super Collider', site: 'texas', kind: 'hadron', circKm: 87.1, magnet: 'nbti45', dets: { gp: 2, bphys: 0, ions: 0, ee: 0 }, tbm: 5, lines: 4, startYear: 1989, politics: 'ssc' } },
  { id: 'ilc', name: 'ILC, Japan', sub: '20.5 km linear collider, 250 GeV, superconducting RF.', d: { name: 'International Linear Collider', site: 'japan', kind: 'linear', linac: 'srf', lengthKm: 20.5, Pwall: 111, dets: { gp: 0, bphys: 0, ions: 0, ee: 2 }, tbm: 4, lines: 3, startYear: 2032 } },
  { id: 'cepc', name: 'CEPC, China', sub: '100 km Higgs factory at 240 GeV.', d: { name: 'CEPC', site: 'china', kind: 'lepton', circKm: 100, Ebeam: 120, Psr: 30, crabWaist: true, topUp: true, dets: { gp: 0, bphys: 0, ions: 0, ee: 2 }, tbm: 8, lines: 4, startYear: 2030 } },
  { id: 'lep', name: 'LEP, 1983', sub: '26.7 km electron-positron ring that later housed the LHC.', d: { name: 'LEP', site: 'geneva', kind: 'lepton', circKm: 26.7, Ebeam: 104.5, Psr: 11, crabWaist: false, topUp: false, dets: { gp: 0, bphys: 0, ions: 0, ee: 4 }, tbm: 3, lines: 3, startYear: 1983 } },
];
const RING_CENTER = { geneva: [5, -8], illinois: [0, 0], texas: [0, 0], china: [-4, 2], japan: [-2, 0] };
const PROD_RATE = { nc: 0.5, nbti45: 0.15, nbti19: 0.1, nb3sn: 0.05, hts: 0.02 }; // km of dipole per month per production line

// ---------- design model ----------
export function evaluate(d0) {
  const d = { ...DEFAULT_DESIGN, ...d0, dets: { ...DEFAULT_DESIGN.dets, ...(d0.dets || {}) } };
  const site = SITES[d.site], cost = {}, warn = [], info = {};
  let dets = [];
  const detTypes = d.kind === 'hadron' ? ['gp', 'bphys', 'ions'] : ['ee'];
  for (const t of detTypes) for (let i = 0; i < (d.dets[t] || 0); i++) dets.push(t);
  const maxIP = d.kind === 'linear' ? 2 : 4;
  if (dets.length > maxIP) { warn.push(`Only ${maxIP} ${d.kind === 'linear' ? 'detectors (push-pull at one interaction point)' : 'interaction points'}: extra detectors ignored.`); dets = dets.slice(0, maxIP); }
  if (!dets.length) warn.push('No detectors: nothing will be measured.');
  const labour = site.labour;
  let m;
  if (d.kind === 'hadron') {
    const mag = MAGNETS[d.magnet], fill = 0.66;
    const circ = d.circKm * 1000, rho = (circ * fill) / (2 * Math.PI);
    const E = P.energyFromField(mag.B, rho);
    const dipoleKm = d.circKm * fill;
    const needInj = E / 15;
    const newInj = site.injector.p < E / 25;
    const Einj = newInj ? needInj : site.injector.p;
    m = { name: d.name, kind: 'hadron', species: 'p', site: d.site, circ, rho, dipoleKm, magnet: d.magnet, Bdesign: mag.B, Edesign: E, Einj, trainTech: 1, storedLimit: 90 * d.circKm, reliability: d.magnet === 'hts' ? 1.4 : d.magnet === 'nb3sn' ? 1.1 : 1 };
    cost.tunnel = d.circKm * site.tunnelPerKm;
    cost.magnets = dipoleKm * 1000 * mag.costPerM * 1.3;
    cost.cryo = ((mag.cryoKwPerM * dipoleKm * 1000) / 1000) * 8;
    cost.rf = 60;
    cost.injector = newInj ? (100 + 3 * Math.pow(Einj, 0.85)) * labour : 0;
    info.injector = newInj ? `New injector chain to ${fmt(Einj / 1000, 3)} TeV (the ${site.injector.name.split(' (')[0] || 'site'} is too weak)` : site.injector.name;
    if (!mag.ready) warn.push(`${mag.name}: not yet proven in accelerator magnets. Expect delays and extra quenches.`);
    if (E / Einj > 25) warn.push('Injection energy too low for the field quality of the magnets.');
    info.Edesign = E; info.rs = (2 * E) / 1000;
    // luminosity estimate with modern beams, levelled for detectors
    const nb = Math.floor((circ / 7.495) * 0.79), N = 1.8e11;
    const nbStored = Math.floor(m.storedLimit / P.storedMJ(E, 1, N));
    const nbUse = Math.min(nb, nbStored);
    const bs = Math.max(0.29 * Math.sqrt(7000 / E) * (circ > 30000 ? 1.4 : 1), 0.2);
    const Lpot = P.lumiHadron({ E, nb: nbUse, N, epsN: 2.1e-6, betaStar: bs, circ });
    info.L = Math.min(Lpot, P.lumiForPileup(1000, info.rs, nbUse, circ));
    info.mu = P.pileup(info.L, info.rs, nbUse, circ);
    info.stored = P.storedMJ(E, nbUse, N);
    info.U0 = P.U0(E, rho, 'p') * 1e6; // keV
    info.B = mag.B;
    const Psr = (P.U0(E, rho, 'p') * 1e9 * nbUse * N * 1.602e-19 * P.frev(circ)) / 1e6;
    info.Psr = Psr;
    info.power = 30 + 6 * dets.length + (mag.cryoKwPerM * dipoleKm * 1000) / 1000 + 8 + 2 * Psr * 20 + (mag.powerKwPerM * dipoleKm * 1000) / 1000;
    m.trained = SECTORS.map(() => 0.86);
  } else if (d.kind === 'lepton') {
    const circ = d.circKm * 1000, rho = (circ * 0.75) / (2 * Math.PI);
    const E = d.Ebeam, U0 = P.U0(E, rho, 'e');
    const V = U0 * 1.25;
    const crabWaist = d.crabWaist && d.topUp;
    if (d.crabWaist && !d.topUp) warn.push('Crab-waist collisions burn beams in minutes: they need top-up injection.');
    m = { name: d.name, kind: 'lepton', species: 'e', site: d.site, circ, rho, dipoleKm: d.circKm * 0.75, magnet: 'nc', Bdesign: P.fieldForEnergy(E, rho), Edesign: E, Einj: d.topUp ? E : Math.min(20, E), Psr: d.Psr, crabWaist, topUp: d.topUp, reliability: 1, trained: SECTORS.map(() => 1.1) };
    cost.tunnel = d.circKm * site.tunnelPerKm;
    cost.magnets = m.dipoleKm * 1000 * 0.02 * 1.4;
    cost.rf = (60 + 90 * V) * labour;
    cost.booster = d.topUp ? (cost.magnets * 0.3 + cost.rf * 0.25) : 0;
    cost.injector = site.injector.e >= 20 ? 30 : 150 * labour;
    info.Edesign = E; info.rs = (2 * E) / 1000; info.U0 = U0 * 1e6; info.V = V;
    info.L = P.lumiLepton({ Ebeam: E, rho, Psr: d.Psr, crabWaist });
    info.power = 30 + 6 * dets.length + (2 * d.Psr) / 0.5 + 10;
    info.points = [45.6, 80, 120, 182.5].filter(e => e <= E + 0.1).map(e => [e, P.lumiLepton({ Ebeam: e, rho, Psr: d.Psr, crabWaist })]);
    info.injector = d.topUp ? 'Full-energy booster in the same tunnel (top-up injection)' : 'Injector linac and small booster';
    if (U0 > 12) warn.push(`Each electron radiates ${fmt(U0, 3)} GeV per turn: the RF system needs ${fmt(V, 3)} GV. Very costly.`);
  } else {
    const L = LINACS[d.linac];
    const E = (L.gradient * d.lengthKm * 1000 * 0.4) / 2 / 1000 * 2; // GeV per beam (40% active, two linacs)
    m = { name: d.name, kind: 'linear', species: 'e', site: d.site, circ: 0, rho: 1e12, dipoleKm: 0, magnet: 'nc', Edesign: E / 2, Einj: 5, Pwall: d.Pwall, linac: d.linac, lengthKm: d.lengthKm, reliability: d.linac === 'plasma' ? 1.5 : 1, trained: SECTORS.map(() => 1.1) };
    cost.tunnel = d.lengthKm * site.tunnelPerKm * 0.8;
    cost.linac = d.lengthKm * L.costPerKm * labour;
    cost.rings = 450 * labour; // damping rings and sources
    info.Edesign = E / 2; info.rs = E / 1000; info.L = P.lumiLinear(d.Pwall); info.power = d.Pwall + 20;
    info.injector = 'Electron and positron sources with damping rings';
    if (L.ready === false) warn.push(`${L.name}: beam quality not yet good enough for a collider.`);
  }
  if (d.kind !== 'linear' && d.circKm > site.maxCirc) warn.push(`${site.short}: a ring over ${site.maxCirc} km does not fit the geology and borders here.`);
  cost.caverns = (d.kind === 'linear' ? 1 : dets.length) * 120 * labour + (d.kind === 'linear' ? 100 : 8 * 25);
  cost.detectors = dets.reduce((a, t) => a + DETECTORS[t].cost, 0);
  cost.tbm = d.tbm * 15;
  cost.lines = d.kind === 'linear' ? 0 : d.lines * 20;
  const sub = Object.values(cost).reduce((a, b) => a + b, 0);
  cost.infra = sub * 0.12 * labour;
  cost.total = sub + cost.infra;
  // schedule (months)
  const len = d.kind === 'linear' ? d.lengthKm : d.circKm;
  const tunnelM = len / (d.tbm * 0.45);
  const rate = d.kind === 'linear' ? 0.25 * d.lines : (PROD_RATE[m.magnet] || 0.1) * d.lines;
  const prodKm = d.kind === 'linear' ? d.lengthKm * 0.4 : m.dipoleKm;
  const magM = prodKm / rate;
  const build = 12 + Math.max(tunnelM + 30, 6 + magM, ...dets.map(t => DETECTORS[t].build * 12 - 12)) + 6;
  info.months = build; info.tunnelM = tunnelM; info.magM = magM;
  info.elecYear = (info.power * 5500 * 85) / 1e6; // MCHF per year at ~5,500 h and 85 CHF/MWh
  info.dets = dets;
  // physics reach: years to 5σ for each process at design settings
  const fbPerYear = (info.L * 1.2e7) / 1e39 * 0.93;
  info.fbPerYear = fbPerYear;
  info.reach = [];
  for (const p of P.PROCESSES) {
    if (p.beam === 'ions') continue;
    if (d.kind === 'hadron' ? p.beam !== 'pp' : p.beam !== 'ee') continue;
    if (!dets.includes(p.det) && !(p.gpWeight && dets.includes('gp'))) continue;
    let best = Infinity, at = null;
    const energies = d.kind === 'hadron' ? [info.rs] : [...new Set([91.19, 161.5, 240, 250, 365, 500, info.rs * 1000].filter(e => e <= info.rs * 1000 + 0.01))];
    for (const rsx of energies) {
      const rsT = d.kind === 'hadron' ? rsx : rsx / 1000;
      const Lh = d.kind === 'lepton' ? P.lumiLepton({ Ebeam: rsT * 500, rho: m.rho, Psr: d.Psr, crabWaist: m.crabWaist }) : info.L;
      const fb = (Lh * 1.2e7) / 1e39 * 0.93;
      const nDet = dets.filter(t => t === p.det).length || (p.gpWeight ? dets.filter(t => t === 'gp').length * p.gpWeight : 0);
      const perYear = fb * P.procXS(p, rsT) * nDet;
      if (perYear > 0) { const y = p.n5 / perYear; if (y < best) { best = y; at = rsx; } }
    }
    if (isFinite(best)) info.reach.push({ p, years: best, at });
  }
  info.searchReach = d.kind === 'hadron' ? P.searchReach(info.rs, fbPerYear * 10) : 0;
  return { d, m, cost, info, warn, dets };
}

// Place interaction points and named points around the ring
export function layout(ev) {
  const { d, m, info } = ev;
  m.center = RING_CENTER[d.site] || [0, 0];
  m.ips = info.dets.map((t, i) => ({ name: detName(t, i, info.dets), det: t, p: [1, 5, 2, 8][i], ready: false }));
  m.points = m.kind === 'linear' ? [] : [1, 2, 3, 4, 5, 6, 7, 8].map(p => { const ip = m.ips.find(x => x.p === p); return { p, name: ip ? ip.name : p === 4 ? 'RF' : p === 6 ? 'Beam dump' : p === 3 || p === 7 ? 'Collimation' : 'Access', det: ip?.det }; });
  return m;
}

// ---------- start a custom game ----------
export function newCustom(d0, api) {
  const ev = evaluate(d0);
  const { d, m, cost, info } = ev;
  layout(ev);
  const t0 = Date.UTC(d.startYear, 0, 10);
  const sandbox = d.difficulty === 'sandbox';
  const approved = sandbox ? cost.total * 3 : cost.total * (d.politics === 'ssc' ? 1.0 : 1.1);
  const S = newState({
    mode: 'custom', m, t0, money: sandbox ? 5000 : 150, rep: 50,
    fund: { base: sandbox ? 3000 : 80 + cost.total * 0.035, repBonus: 3, fixed: 60 + cost.total * 0.012 },
    set: { autopilot: true, E: m.Edesign, spacing: 25 },
  });
  S.sandbox = sandbox; S.design = d; S.designCost = cost; S.designInfo = { L: info.L, rs: info.rs, fbPerYear: info.fbPerYear, months: info.months };
  S.gridBase = Math.max(20, info.fbPerYear * 1.2);
  const comps = {};
  for (const [k, v] of Object.entries(cost)) if (k !== 'total') comps[k] = { total: v, spent: 0 };
  S.build = { month: 0, tunnel: 0, magnets: 0, install: 0, infra: 0, hwc: 0, dets: info.dets.map(() => 0), comps, capital: approved, approved, estimate: cost.total, rateF: 1, prodF: 1, stopUntil: 0, reviews: 0, frac: 0, politics: d.politics || null, len: d.kind === 'linear' ? d.lengthKm : d.circKm, prodKm: d.kind === 'linear' ? d.lengthKm * 0.4 : m.dipoleKm };
  S.ops.mode = 'CONSTRUCTION'; S.ops.comment = 'Design and approvals';
  S.period = 'BUILD';
  return S;
}
function detName(det, i, all) {
  const n = all.slice(0, i).filter(t => t === det).length;
  const base = { gp: ['Hermes', 'Titan', 'Aurora', 'Vega'], bphys: ['Flavia'], ions: ['Plasma'], ee: ['Iris', 'Lyra', 'Orion', 'Nova'] }[det];
  return base[n % base.length];
}

// Monthly construction progress, called by the engine while CONSTRUCTION / HW COMMISSIONING
export function construct(S, dt, api) {
  const B = S.build, M = S.m, months = dt / HPM, d = S.design;
  B.month += months;
  const spend = (k, frac) => { const c = B.comps[k]; if (!c) return; const add = Math.max(0, Math.min(c.total, c.total * frac) - c.spent); c.spent += add; pay(S, api, add); };
  if (S.ops.mode === 'HW COMMISSIONING') {
    B.hwc += months / 6;
    S.ops.comment = `Hardware commissioning: powering circuits, cooling down (${Math.round(B.hwc * 100)}%)`;
    if (B.hwc >= 1) {
      S.ops.mode = 'NO BEAM'; S.ops.t = 0; S.ops.dur = 0.5; S.flags.built = true; S.period = undefined;
      say(S, api, `${M.name} is complete. Hardware commissioning done: ready for first beam!`, 'good');
      api?.modal?.({ title: `${M.name} is built`, kicker: 'Construction complete', body: [`After ${fmt(B.month / 12, 2)} years and ${money(totalSpent(S))}, the machine is ready.`, 'Now the real work starts: first beam, first collisions, then physics. Operations and upgrades work exactly like at the LHC.'], choices: [{ label: 'To the Control Room', primary: true, run: () => api.tab('control') }] });
    }
    dets(S, api, months);
    return;
  }
  // approvals and design
  if (B.month < 12) { spend('infra', 0.03 * B.month / 12); S.ops.comment = 'Design, environmental impact studies, approvals'; B.frac = B.month / 12 * 0.03; return; }
  const stopped = S.t < B.stopUntil;
  // tunnel boring
  if (B.tunnel < 1 && !stopped) {
    B.tunnel = Math.min(1, B.tunnel + (months * d.tbm * 0.45 * B.rateF) / B.len);
    spend('tunnel', B.tunnel); spend('tbm', 1); spend('caverns', Math.min(1, B.tunnel * 1.3));
  }
  // magnet/structure production
  if (B.month > 18 && B.magnets < 1 && !stopped) {
    const rate = M.kind === 'linear' ? 0.25 * d.lines : (PROD_RATE[M.magnet] || 0.1) * d.lines;
    B.magnets = Math.min(1, B.magnets + (months * rate * B.prodF) / B.prodKm);
    spend('lines', 1); spend(M.kind === 'linear' ? 'linac' : 'magnets', B.magnets); spend('rf', B.magnets); spend('booster', B.magnets); spend('rings', B.magnets); spend('injector', B.magnets);
  }
  // installation follows tunnel and magnets
  const canInst = Math.min(B.tunnel, B.magnets);
  if (B.install < canInst) B.install = Math.min(canInst, B.install + (months * 1.2) / Math.max(1, B.prodKm));
  if (B.tunnel >= 0.5) { B.infra = Math.min(1, B.infra + months / 30); spend('infra', 0.03 + 0.97 * B.infra); spend('cryo', B.infra); }
  dets(S, api, months);
  B.frac = (B.tunnel + B.magnets + B.install + B.infra) / 4;
  S.ops.comment = B.tunnel < 1 ? `Tunnel boring: ${fmt(B.tunnel * B.len, 3)} of ${fmt(B.len, 3)} km with ${d.tbm} tunnel-boring machines` : B.install < 1 ? `Installing ${M.kind === 'linear' ? 'accelerating structures' : 'magnets'}: ${Math.round(B.install * 100)}%` : `Cryogenics, power and controls: ${Math.round(B.infra * 100)}%`;
  if (B.install >= 1 && B.infra >= 1 && B.tunnel >= 1) { S.ops.mode = 'HW COMMISSIONING'; say(S, api, 'All components installed. Hardware commissioning begins.', 'good'); }
  // monthly random events
  if (Math.floor(B.month) !== Math.floor(B.month - months)) monthlyEvent(S, api);
}
function dets(S, api, months) {
  const B = S.build, M = S.m;
  M.ips.forEach((ip, i) => {
    if (B.dets[i] >= 1) return;
    const yrs = DETECTORS[ip.det].build;
    B.dets[i] = Math.min(1, B.dets[i] + months / (yrs * 12));
    const c = B.comps.detectors; const add = (DETECTORS[ip.det].cost * months) / (yrs * 12); c.spent = Math.min(c.total, c.spent + add); pay(S, api, add);
    if (B.dets[i] >= 1) { ip.ready = true; say(S, api, `Detector ${ip.name} is complete and installed.`, 'good'); }
  });
}
function pay(S, api, x) {
  const B = S.build;
  if (B.capital >= x) B.capital -= x; else { S.money -= x - B.capital; B.capital = 0; }
  S.spent.build += x;
}
export const totalSpent = S => Object.values(S.build.comps).reduce((a, c) => a + c.spent, 0);
export const estimateTotal = S => Object.values(S.build.comps).reduce((a, c) => a + c.total, 0);

function monthlyEvent(S, api) {
  const B = S.build, d = S.design, ssc = B.politics === 'ssc';
  const r = Math.random();
  const add = (k, f) => { if (B.comps[k]) B.comps[k].total *= 1 + f; };
  if (B.tunnel < 1 && r < 0.03) { B.rateF = 0.6; B.stopUntil = S.t + rand(1, 3) * HPM; add('tunnel', 0.04); say(S, api, 'Construction: water ingress in the tunnel face. Boring stops while the ground is grouted. Tunnel cost +4%.', 'warn'); setTimeout(() => {}, 0); }
  else if (B.tunnel < 1 && r < 0.05) { B.rateF = 0.8; add('tunnel', 0.03); say(S, api, 'Construction: harder rock than the surveys showed. Boring slows down.', 'warn'); }
  else if (B.tunnel < 1 && r < 0.07) { B.rateF = 1.1; say(S, api, 'Construction: a tunnel-boring machine sets a site record. The crews speed up.', 'good'); }
  else if (B.magnets < 1 && B.month > 18 && r < 0.09) { B.magnets = Math.max(0, B.magnets - 0.03); add(S.m.kind === 'linear' ? 'linac' : 'magnets', 0.04); say(S, api, `Construction: a batch of ${S.m.kind === 'linear' ? 'cavities' : 'magnets'} fails acceptance tests and must be rebuilt. Cost +4%.`, 'warn'); }
  else if (B.magnets < 1 && B.month > 18 && r < 0.1) { B.prodF = 0.5; say(S, api, 'Construction: a major supplier goes bankrupt. Production halves until a new firm is qualified.', 'bad'); }
  else if (r < 0.12) { for (const k of Object.keys(B.comps)) add(k, 0.015); say(S, api, 'Construction: inflation raises the cost of remaining work by 1.5%.', 'warn'); }
  if (B.prodF < 1 && chance(0.15)) { B.prodF = 1; say(S, api, 'Construction: magnet production is back to full speed.', 'good'); }
  if (B.rateF !== 1 && chance(0.3)) B.rateF = 1;
  if (ssc && chance(0.012 * (1 + B.month / 36))) for (const k of Object.keys(B.comps)) add(k, 0.05);
  // political reviews when the estimate runs over the approved budget
  const est = estimateTotal(S), over = est / B.approved;
  if (!S.sandbox && over > 1.2 + 0.2 * B.reviews && !S.pendingReview) review(S, api, over);
}
function review(S, api, over) {
  const B = S.build, ssc = B.politics === 'ssc';
  S.pendingReview = true;
  const dets = S.m.ips.filter((ip, i) => B.dets[i] < 1);
  const riskBase = ssc ? 0.55 : 0.25;
  api.modal({
    title: ssc ? 'Congress reviews the Super Collider' : 'Funding review', kicker: `Cost estimate +${Math.round((over - 1) * 100)}%`,
    body: [`The cost to complete has grown to ${money(estimateTotal(S))}, against ${money(B.approved)} approved.`, ssc ? 'In 1993 the House voted to cancel the SSC after its estimate rose from $4.4 to $11 billion. Convince them.' : 'The funding agencies want a plan.'],
    choices: [
      { label: 'Ask for more money', run: () => decide(S, api, riskBase + (over - 1) * 0.6 - (S.rep - 50) / 200, 0) },
      { label: 'Bring in international partners (6 months delay)', run: () => { B.stopUntil = S.t + 6 * HPM; decide(S, api, riskBase * 0.35 + (over - 1) * 0.3, 0.25); } },
      ...(dets.length > 1 ? [{ label: `Descope: cancel detector ${dets[dets.length - 1].name}`, run: () => { const ip = dets[dets.length - 1]; const i = S.m.ips.indexOf(ip); B.comps.detectors.total -= DETECTORS[ip.det].cost * (1 - B.dets[i]); S.m.ips.splice(i, 1); B.dets.splice(i, 1); decide(S, api, riskBase * 0.5 + (over - 1) * 0.4, 0); } }] : []),
    ],
  });
}
function decide(S, api, pCancel, partner) {
  const B = S.build;
  S.pendingReview = false; B.reviews++;
  if (chance(clamp(pCancel, 0.02, 0.9))) { api.gameOver?.(B.politics === 'ssc' ? 'Congress cancels the Superconducting Super Collider. 23 km of tunnel are left empty under Texas, as in October 1993.' : 'The funding agencies cancel the project.'); return; }
  const est = estimateTotal(S);
  const extra = est - B.approved;
  B.approved = est * (1 + partner);
  B.capital += extra + est * partner;
  S.rep = Math.max(0, S.rep - 4);
  say(S, api, `Funding review passed: approved budget raised to ${money(B.approved)}.`, 'good');
}

// ---------- missions for custom machines ----------
export function customMissionsFor(S) { return customMissions(S, evaluate(S.design)); }
function customMissions(S, ev) {
  const { m, info } = ev;
  const out = [
    { id: 'build', title: 'Build it', text: `Complete construction (${fmt(info.months / 12, 2)} years planned).`, hint: 'Watch the map: tunnel boring, then magnet installation.', done: S2 => S2.flags.built, reward: { rep: 8 } },
    { id: 'firstbeam', title: 'First beam', text: 'Inject and circulate the first beam.', hint: 'Control room → Inject beam, or leave the autopilot on.', done: S2 => S2.flags.injected, reward: { rep: 4 } },
    { id: 'collide', title: 'First collisions', text: 'Declare stable beams for the first time.', done: S2 => S2.flags.collided, reward: { rep: 5, money: 20 } },
  ];
  if (m.kind === 'hadron') out.push({ id: 'design', title: 'Design energy', text: `Collide at ${fmt(m.Edesign / 1000, 3)} TeV per beam.`, hint: 'Train the magnets (Machine tab).', done: S2 => (S2.flags.stableE || 0) >= m.Edesign * 0.995, reward: { rep: 6, money: 30 } });
  const target = Math.max(1e-3, info.fbPerYear * 3);
  out.push({ id: 'lumi', title: `Deliver ${fmtLumi(target)}`, text: 'About three good years of data per experiment.', done: S2 => S2.rec >= target, reward: { rep: 6, money: 40 } });
  for (const r of info.reach.filter(x => x.years < 25).sort((a, b) => a.years - b.years).slice(0, 6)) out.push({ id: 'disc-' + r.p.k, title: `Observe: ${r.p.name}`, text: `${r.p.text} Estimated ${fmt(r.years, 2)} years at design luminosity${m.kind === 'hadron' ? '' : ` at √s = ${fmt(r.at, 4)} GeV`}.`, done: S2 => !!S2.disc[r.p.k], reward: { rep: 8, money: 30 } });
  out.push({ id: 'avail', title: 'Reliable machine', text: 'Spend 45% of scheduled physics time in stable beams in one year.', done: S2 => (S2.stats.lastAvail || 0) >= 0.45, reward: { rep: 4 } });
  return out;
}
const fmtLumi = fb => (fb >= 1000 ? `${fmt(fb / 1000, 3)} ab⁻¹` : fb >= 1 ? `${fmt(fb, 3)} fb⁻¹` : `${fmt(fb * 1000, 3)} pb⁻¹`);
export function customDaily(S, api) {
  if (!S.flags.built) return;
  if (!S.done.fence && chance(0.02 / 365) && S.period === 'PHYSICS') S.events.marten = true;
  void significance; void availableProcesses; void date; void pick;
}
