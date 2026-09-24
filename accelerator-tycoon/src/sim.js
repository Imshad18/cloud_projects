// Game engine: one plain JSON state object, advanced in small time steps (hours).
import { clamp, chance, spread, pick, rand } from './util.js';
import * as P from './physics.js';
import { FAULTS, LHC_UPGRADES, CUSTOM_UPGRADES, MD_UNLOCKS, MAGNETS, DETECTORS, powerPrice } from './data.js';

export const SECTORS = ['1-2', '2-3', '3-4', '4-5', '5-6', '6-7', '7-8', '8-1'];
export const BEAM_MODES = ['INJECTION', 'RAMP', 'FLAT TOP', 'ADJUST', 'STABLE BEAMS'];
const HPY = 8766; // hours per year
const HPM = HPY / 12;

export const date = S => new Date(S.t0 + S.t * 3600e3);
export const year = S => date(S).getUTCFullYear();
export const done = (S, id) => !!S.done[id];
export const isHadron = S => S.m.kind === 'hadron';
export const hasDet = (S, t) => S.m.ips.some(ip => ip.det === t);
export const upgrades = S => (S.mode === 'campaign' ? LHC_UPGRADES : CUSTOM_UPGRADES);

// ---------- capabilities: what the machine can do right now ----------
export function cap(S) {
  const M = S.m, d = id => !!S.done[id];
  const c = { Emax: M.Edesign * 1.08, Emin: M.Einj, crab: false };
  if (M.kind === 'hadron') {
    const modern = S.mode !== 'campaign';
    c.N = { 50: d('hl') ? 2.2e11 : d('liu') ? 1.9e11 : 1.6e11, 25: d('hl') ? 2.2e11 : d('liu') ? 1.8e11 : 1.15e11 };
    if (modern) c.N = { 50: 1.9e11, 25: 1.8e11 };
    c.eps = { 50: d('liu') || modern ? 1.9 : d('linac4') ? 2.1 : 2.4, 25: d('liu') || modern ? 2.1 : d('linac4') ? 2.5 : 3.0 };
    if (d('bcms')) { c.eps[25] *= 0.75; c.eps[50] *= 0.85; }
    c.nb = { 50: Math.floor(M.circ / 14.99 * 0.776), 25: Math.floor(M.circ / 7.495 * 0.79 * (d('bcms') ? 0.92 : 1)) };
    c.spacings = d('scrub') || modern ? [50, 25] : [50];
    c.b0 = d('hl') ? 0.15 : d('ats') ? 0.29 : 0.45;
    c.betaMin = E => Math.max(c.b0 * Math.sqrt(7000 / Math.max(E, 450)) * (M.circ > 30000 ? 1.4 : 1), d('hl') ? 0.15 : 0.2);
    c.storedLimit = modern ? M.storedLimit * (d('coll') ? 1.4 : 1) : d('hl') ? 700 : d('coll') ? 500 : 362;
    c.crab = d('hl');
    c.muGP = modern ? 1000 : d('phase2') ? 200 : d('phase1') ? 80 : 60;
    c.levelGP = d('hl') ? 5e34 : modern ? 3e35 : Infinity;
    c.levelB = modern ? 2e33 : d('phase1') ? 2e33 : 4e32;
    c.levelA = 1e31;
    c.ionA = modern || d('phase1') ? 6.4e27 : 1e27;
    if (S.mode === 'campaign' && M.splices !== 'ok') c.safeE = 4000;
    c.nbInj = S.nbCap || Infinity;
  } else if (M.kind === 'lepton') {
    c.Emax = M.Edesign;
    c.Emin = Math.min(45.6, M.Edesign);
  } else {
    c.Emax = M.Edesign; c.Emin = Math.min(45.6, M.Edesign);
  }
  if (S.eLimit) c.Emax = Math.min(c.Emax, S.eLimit);
  return c;
}

// Parameters for the next fill, clamped to what is allowed
export function planFill(S) {
  const c = cap(S), st = S.set, M = S.m;
  const E = clamp(st.E, c.Emin, c.Emax);
  if (M.kind !== 'hadron') return { E, ions: false };
  const ions = S.period === 'IONS';
  const sp = c.spacings.includes(st.spacing) ? st.spacing : c.spacings[c.spacings.length - 1];
  const N = st.auto ? c.N[sp] : Math.min(st.N, c.N[sp]);
  const eps = c.eps[sp];
  const bs = Math.max(st.auto ? 0 : st.betaStar, c.betaMin(E));
  const perBunchMJ = P.storedMJ(E, 1, N);
  const nbStored = Math.floor(Math.min(S.mp.allowed, c.storedLimit) / perBunchMJ);
  const nb = Math.max(1, Math.min(st.auto ? c.nb[sp] : st.nb, c.nb[sp], nbStored));
  return { E, sp, N, eps, betaStar: bs, nb, ions, N0: N, stored: P.storedMJ(E, nb, N) };
}

// ---------- luminosity ----------
export const rsTeV = (S, E, ions) => (S.m.kind === 'hadron' ? (ions ? (2 * E * 82 / 208) / 1000 : (2 * E) / 1000) : (2 * E) / 1000);
export function ipLumis(S, f) {
  const M = S.m, c = cap(S), out = [];
  if (M.kind === 'hadron') {
    if (f.ions) {
      const L0 = 6e27 * Math.pow(f.E / 6500, 2) * (done(S, 'liu') ? 1.1 : 1) * (f.ionDecay ?? 1) * (S.mode === 'campaign' ? clamp(0.12 + 0.3 * (S.ionRuns || 0), 0.12, 1) : 1);
      for (const ip of M.ips) out.push(ip.ready === false ? 0 : ip.det === 'ions' ? Math.min(L0, c.ionA) : ip.det === 'gp' ? L0 : 0);
      return out;
    }
    const Lpot = P.lumiHadron({ E: f.E, nb: f.nb, N: f.N, epsN: f.eps * 1e-6, betaStar: f.betaStar, circ: M.circ, crab: c.crab });
    const rs = rsTeV(S, f.E), lvlGP = Math.min(c.levelGP, P.lumiForPileup(c.muGP, rs, f.nb, M.circ));
    for (const ip of M.ips) out.push(ip.ready === false ? 0 : ip.det === 'gp' ? Math.min(Lpot, lvlGP) : ip.det === 'bphys' ? Math.min(Lpot, c.levelB) : Math.min(Lpot, c.levelA));
    f.Lpot = Lpot;
    return out;
  }
  if (M.kind === 'lepton') {
    const L = P.lumiLepton({ Ebeam: f.E, rho: M.rho, Psr: M.Psr, crabWaist: M.crabWaist }) * (f.decay ?? 1);
    return M.ips.map(ip => (ip.ready === false ? 0 : L));
  }
  return M.ips.map((ip, i) => (i === (S.pushPull || 0) && ip.ready !== false ? P.lumiLinear(M.Pwall) : 0)); // push-pull: one detector at a time
}

// ---------- power and money ----------
export function powerMW(S) {
  const M = S.m, mode = S.ops.mode;
  if (mode === 'CONSTRUCTION') return 5 + (S.build?.frac || 0) * 20;
  const shut = ['SHUTDOWN', 'REPAIR'].includes(mode);
  const mag = MAGNETS[M.magnet] || MAGNETS.nc;
  const dip = M.dipoleKm * 1000;
  const cryo = (mag.cryoKwPerM * dip) / 1000; // MW
  const beam = BEAM_MODES.includes(mode) || mode === 'COMMISSIONING';
  const E = S.ops.fill?.E || S.set.E;
  let rf = 8, ncMag = 0, sr = 0;
  const B = P.fieldForEnergy(E, M.rho || 1);
  if (mag.powerKwPerM && beam) ncMag = ((mag.powerKwPerM * dip) / 1000) * Math.pow(B / mag.B, 2);
  if (M.kind === 'lepton') rf = beam ? (2 * M.Psr) / 0.5 : 5;
  else if (M.kind === 'linear') rf = beam ? M.Pwall : 10;
  else if (beam && S.ops.fill) sr = (2 * P.U0(E, M.rho, 'p') * 1e9 * S.ops.fill.nb * S.ops.fill.N * 1.602e-19 * P.frev(M.circ) * 20) / 1e6;
  const base = 30 + 6 * M.ips.length;
  if (mode === 'SHUTDOWN' && S.period === 'LS') return base * 0.8;
  if (shut) return base + cryo * 0.35;
  return base + cryo + rf + ncMag + sr;
}
export function budgetPerYear(S) { return S.fund.base + (S.rep - 50) * S.fund.repBonus; }

// ---------- logging helpers ----------
function log(S, api, msg, kind = '') {
  const d = date(S);
  S.log.unshift({ t: S.t, msg, kind });
  if (S.log.length > 400) S.log.length = 400;
  api?.onLog?.(msg, kind, d);
}
export const say = log;
function comment(S, txt) { S.ops.comment = txt; }

// ---------- operations state machine ----------
function enter(S, mode, dur = 0, extra = {}) {
  const o = S.ops;
  o.mode = mode; o.t = 0; o.dur = dur; o.ready = false; Object.assign(o, extra);
}
const turnaroundGuess = S => { const c = S.done.combined ? 0.25 : 0.55; return 0.5 + 0.9 + rampHours(S, S.set.E) + c + 0.1 + 0.6 + 1.2; };
export function rampHours(S, E) { const M = S.m; if (M.kind !== 'hadron') return 0.2; return Math.max(0.08, 0.33 * (E - M.Einj) / (6500 - 450) * Math.max(1, M.Edesign / 7000) ** 0.3); }
function injHours(S, f) { return f.ions ? 1.6 : 0.3 + 0.6 * Math.min(1, f.nb / 2800); }

const NEXT = { 'NO BEAM': 'INJECTION', INJECTION: 'RAMP', RAMP: 'FLAT TOP', 'FLAT TOP': 'ADJUST', ADJUST: 'STABLE BEAMS', 'STABLE BEAMS': 'BEAM DUMP', 'BEAM DUMP': 'RAMP DOWN', 'RAMP DOWN': 'NO BEAM' };
export const OP_ACTIONS = { 'NO BEAM': 'Inject beam', INJECTION: 'Start the ramp', RAMP: 'Squeeze', 'FLAT TOP': 'Adjust: bring beams into collision', ADJUST: 'Declare STABLE BEAMS', 'STABLE BEAMS': 'Dump the beams', 'BEAM DUMP': 'Ramp down', 'RAMP DOWN': 'Precycle magnets' };

// Operator presses the next button (manual mode), or autopilot does it
export function advance(S, api, force = false) {
  const o = S.ops;
  if (!force && !o.ready && o.mode !== 'STABLE BEAMS') return false;
  const M = S.m;
  switch (o.mode) {
    case 'NO BEAM': {
      const f = planFill(S);
      S.fillNo++;
      o.fill = { ...f, no: S.fillNo, intL: 0, Lpeak: 0, tStable: 0, startT: S.t };
      if (f.stored > 1) comment(S, `Fill ${S.fillNo}: injecting ${f.nb} bunches of ${(f.N / 1e11).toFixed(2)}×10¹¹ ${f.ions ? 'lead ions' : M.species === 'e' ? 'electrons/positrons' : 'protons'}`);
      else comment(S, `Fill ${S.fillNo}: injecting beam`);
      enter(S, 'INJECTION', injHours(S, f));
      if (S.m.kind !== 'hadron') o.dur = 0.4;
      break;
    }
    case 'INJECTION': {
      S.flags.injected = true;
      if (M.kind !== 'hadron') { enter(S, 'RAMP', 0.2); break; }
      if (o.fill.E <= M.Einj * 1.001) { enter(S, 'ADJUST', 0.15); comment(S, 'Collisions at injection energy'); break; }
      // ramping: training quenches and (LHC 2008) splice risk
      if (rampChecks(S, api)) return true;
      enter(S, 'RAMP', rampHours(S, o.fill.E));
      comment(S, `Ramping to ${(o.fill.E / 1000).toFixed(2)} TeV`);
      break;
    }
    case 'RAMP': S.flags.maxE = Math.max(S.flags.maxE || 0, o.fill.E); enter(S, 'FLAT TOP', M.kind === 'hadron' ? (S.done.combined ? 0.08 : 0.33) : 0.05); comment(S, `Flat top ${(o.fill.E / 1000).toFixed(2)} TeV: squeezing β* to ${o.fill.betaStar ? (o.fill.betaStar * 100).toFixed(0) + ' cm' : '—'}`); break;
    case 'FLAT TOP': enter(S, 'ADJUST', 0.1); comment(S, 'Adjust: bringing beams into collision'); break;
    case 'ADJUST': enter(S, 'STABLE BEAMS', 0); o.fill.tStable = 0; S.flags.collided = true; if (!o.fill.ions) S.flags.stableE = Math.max(S.flags.stableE || 0, o.fill.E); comment(S, `STABLE BEAMS. Fill ${o.fill.no}. Experiments taking data.`); api?.onStable?.(); break;
    case 'STABLE BEAMS': endFill(S, api, 'Programmed dump'); enter(S, 'RAMP DOWN', S.done.combined ? 0.45 : 0.6); comment(S, `Beam dumped (end of fill ${o.fill?.no}). Ramping down.`); break;
    case 'BEAM DUMP': enter(S, 'RAMP DOWN', 0.6); break;
    case 'RAMP DOWN': enter(S, 'NO BEAM', 0.5); comment(S, 'Precycling magnets, preparing next fill'); break;
    default: return false;
  }
  return true;
}

function endFill(S, api, why) {
  const o = S.ops, f = o.fill;
  if (!f) return;
  S.fills.unshift({ no: f.no, t: f.startT, E: f.E, ions: f.ions, nb: f.nb, Lpeak: f.Lpeak, intL: f.intL, hours: f.tStable, why });
  if (S.fills.length > 150) S.fills.length = 150;
  // machine-protection intensity ramp-up: 3 clean fills at the current level allow the next step
  if (isHadron(S) && !f.ions && why === 'Programmed dump' && f.tStable > 1) {
    const c = cap(S), lim = c.storedLimit;
    if (f.stored >= 0.75 * Math.min(S.mp.allowed, lim)) {
      S.mp.clean++;
      if (S.mp.clean >= 3 && S.mp.allowed < lim) {
        S.mp.allowed = Math.min(lim, S.mp.allowed * 1.8); S.mp.clean = 0;
        log(S, api, `Machine protection: intensity step approved. Up to ${Math.round(S.mp.allowed)} MJ per beam.`, 'good');
      }
    }
  }
  o.fill = null;
}

function rampChecks(S, api) {
  const M = S.m, E = S.ops.fill.E, f = E / M.Edesign;
  // LHC 2008-2012: weak splices between magnets
  if (S.mode === 'campaign' && M.splices !== 'ok' && E > 4050) {
    const p = M.splices === 'unknown' ? 0.3 : 0.06 * (E - 4000) / 1000 * (S.done.nqps ? 0.35 : 1);
    if (chance(p)) { spliceIncident(S, api); return true; }
  }
  const tech = (MAGNETS[M.magnet]?.training || 1) * (M.trainTech || 1);
  const weak = M.trained.map((t, i) => [t, i]).filter(([t]) => t < f - 1e-4);
  if (weak.length && chance(Math.min(0.9, 0.45 + 0.1 * weak.length))) {
    const [, i] = pick(weak);
    M.trained[i] = trainStep(M.trained[i], tech);
    fault(S, api, 'quench', `Training quench in sector ${SECTORS[i]} during the ramp to ${(E / 1000).toFixed(2)} TeV. The magnets learn: sector now holds ${(M.trained[i] * M.Edesign / 1000).toFixed(2)} TeV.`);
    return true;
  }
  return false;
}
export function trainStep(fr, tech) { // one more quench → higher trained field
  const q = P.trainingQuenches(Math.max(fr, 0.86), tech) + 1;
  return 0.86 + 0.05 * Math.log(q / (2 * tech));
}
export function trainingNeeded(S, Etarget) {
  const M = S.m, tech = (MAGNETS[M.magnet]?.training || 1) * (M.trainTech || 1), f = Etarget / M.Edesign;
  let q = 0;
  for (const t of M.trained) if (t < f) q = Math.max(q, P.trainingQuenches(f, tech) - P.trainingQuenches(Math.max(t, 0.86), tech));
  return { quenches: Math.ceil(q), total: Math.ceil(M.trained.reduce((a, t) => a + (t < f ? P.trainingQuenches(f, tech) - P.trainingQuenches(Math.max(t, 0.86), tech) : 0), 0)), days: Math.ceil(q * 14 / 24) + (q > 0 ? 5 : 0) };
}

function spliceIncident(S, api) {
  const o = S.ops;
  if (o.fill) endFill(S, api, 'Incident');
  S.m.splices = 'weak';
  S.money -= 40; S.rep = Math.max(0, S.rep - 12);
  S.block = { until: S.t + 14 * HPM, label: 'Repairing sector 3-4 after the splice incident' };
  S.flags.incident = true;
  enter(S, 'REPAIR', 14 * HPM);
  comment(S, 'Sector 3-4: electrical arc at a busbar splice. Helium release, 53 magnets damaged.');
  log(S, api, 'INCIDENT: a faulty splice between two magnets melted and arced. Six tonnes of helium escaped, displacing 53 magnets. Repair: about 14 months and 40 MCHF. (This happened on 19 September 2008.)', 'bad');
  api?.onIncident?.();
}

// ---------- faults ----------
function faultRate(S, beam) {
  const d = id => S.done[id], c = cap(S), lvl = S.ops.fill ? (S.ops.lastL || 0) : 0;
  const w = {};
  const age = clamp((S.t - (S.eraStart || 0)) / (HPY * 1.5), 0, 1);
  w.cryo = FAULTS.cryo.w * (d('cryo') ? 0.5 : 1);
  w.rf = FAULTS.rf.w;
  w.power = FAULTS.power.w;
  w.network = FAULTS.network.w * ([5, 6, 7].includes(date(S).getUTCMonth()) ? 2.5 : 0.6);
  w.vacuum = FAULTS.vacuum.w;
  if (beam) {
    w.seu = FAULTS.seu.w * (d('r2e') ? 0.2 : 1) * clamp(lvl / 1e34, 0.1, 3);
    w.ufo = FAULTS.ufo.w * (1.6 - age);
    w.losses = FAULTS.losses.w * (S.ops.fill?.stored > 200 ? 1.4 : 1);
    w.protect = FAULTS.protect.w * (1.3 - 0.5 * age);
    if (S.ops.mode === 'INJECTION') w.injector = FAULTS.injector.w * 3;
  }
  const base = beam ? 0.075 : 0.02;
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  const lam = base * sum / 1.0 * (S.m.reliability || 1) * (S.mode === 'campaign' ? 1 : 1.1);
  void c;
  return { lam, w };
}
function randomFault(S, api, beam, dt) {
  const { lam, w } = faultRate(S, beam);
  if (!chance(lam * dt)) return false;
  let x = Math.random() * Object.values(w).reduce((a, b) => a + b, 0), key = 'rf';
  for (const [k, v] of Object.entries(w)) { x -= v; if (x <= 0) { key = k; break; } }
  fault(S, api, key);
  return true;
}
export function fault(S, api, key, extra) {
  const o = S.ops, F = FAULTS[key];
  const hadBeam = BEAM_MODES.includes(o.mode);
  if (hadBeam && o.fill) endFill(S, api, F.name);
  let rep = spread(F.rep, 2.2);
  if (key === 'quench' && S.done.nqps) rep *= 0.8;
  const sector = pick(SECTORS);
  enter(S, 'FAULT', rep, { faultKey: key, faultName: F.name });
  S.stats.faults = (S.stats.faults || 0) + 1;
  S.stats.byFault[key] = (S.stats.byFault[key] || 0) + rep;
  S.faultSector = SECTORS.indexOf(sector);
  comment(S, `${F.name}${key === 'quench' ? '' : ` (${sector === '3-4' || key === 'network' ? 'site-wide' : 'sector ' + sector})`}. Estimated recovery ${rep < 1 ? Math.round(rep * 60) + ' min' : rep.toFixed(1) + ' h'}.`);
  log(S, api, `${hadBeam ? 'Beam dumped: ' : ''}${extra || F.name + '. ' + F.text} Recovery ≈ ${rep < 1 ? Math.round(rep * 60) + ' min' : rep.toFixed(1) + ' h'}.`, 'warn');
}

// ---------- calendar ----------
export function periodAt(S, t) {
  if (S.ops.mode === 'CONSTRUCTION' || S.ops.mode === 'HW COMMISSIONING') return 'BUILD';
  if (S.block && t >= (S.block.from || 0) && t < S.block.until) return 'BLOCK';
  for (const ls of S.sched.ls) if (t >= ls.start && t < ls.end) return 'LS';
  const d = new Date(S.t0 + t * 3600e3), m = d.getUTCMonth(), day = d.getUTCDate(), y = d.getUTCFullYear();
  if (S.sched.yets && ((m === 11 && day >= 10) || m === 0 || (m === 1 && day < 25))) return 'YETS';
  if (isHadron(S) && S.sched.ions[y] && ((m === 10 && day >= 5) || (m === 11 && day < 10))) return 'IONS';
  return 'PHYSICS';
}
export const currentLS = S => S.sched.ls.find(ls => S.t >= ls.start && S.t < ls.end);

function calendar(S, api) {
  const prev = S.period, now = periodAt(S, S.t);
  if (prev === now) return;
  S.period = now;
  const o = S.ops;
  const off = ['LS', 'YETS', 'BLOCK'].includes(now);
  if (off) {
    if (o.fill) endFill(S, api, 'End of run');
    const label = now === 'LS' ? currentLS(S).name : now === 'YETS' ? 'Year-end technical stop' : S.block.label;
    enter(S, now === 'BLOCK' ? 'REPAIR' : 'SHUTDOWN', 0, { label });
    comment(S, label);
    if (now === 'LS') {
      log(S, api, `${label} begins. Magnets warm up to room temperature; installation work starts.`, 'info');
      S.m.trained = S.m.trained.map(t => Math.max(0.86, t - 0.035)); // thermal cycle: some training is lost
    } else if (now === 'YETS') log(S, api, 'Year-end technical stop: maintenance until late February.', 'info');
    return;
  }
  if (now === 'IONS' && prev === 'PHYSICS') {
    if (o.fill) { endFill(S, api, 'Switch to ions'); enter(S, 'RAMP DOWN', 0.6); }
    S.ionRuns = (S.ionRuns || 0) + 1;
    log(S, api, 'Heavy-ion run: the LHC switches to lead nuclei (²⁰⁸Pb⁸²⁺) for four weeks.', 'info');
    return;
  }
  if (now === 'PHYSICS' && prev === 'IONS') { if (o.fill) { endFill(S, api, 'End of ion run'); enter(S, 'RAMP DOWN', 0.6); } return; }
  // coming back from a stop: recommission with beam, intensity ramp-up starts low again
  if (['LS', 'YETS', 'BLOCK', 'BUILD', undefined].includes(prev) && (now === 'PHYSICS' || now === 'IONS')) {
    const days = prev === 'LS' ? 50 : prev === 'BLOCK' ? 30 : prev === 'BUILD' ? 90 : 18;
    if (prev === 'LS' || prev === 'BLOCK') S.eraStart = S.t;
    S.mp.allowed = Math.max(1.5, S.mp.allowed * (prev === 'YETS' ? 0.15 : 0.05)); S.mp.clean = 0;
    if (prev !== undefined) {
      enter(S, 'COMMISSIONING', days * 24, { label: 'Beam commissioning' });
      comment(S, 'Beam commissioning: optics, collimators and protection systems are set up again with low-intensity beam');
      log(S, api, `Beam commissioning (${days} days) before physics can restart. The intensity is then raised in steps.`, 'info');
    } else enter(S, 'NO BEAM', 0.5);
  }
}

// ---------- projects ----------
export function startProject(S, api, id) {
  const U = upgrades(S).find(u => u.id === id);
  const p = S.proj[id];
  if (!U || (p && !U.repeat) || (p && p.state !== 'done')) return 'Already started';
  for (const n of U.needs) if (!S.done[n]) return `Needs ${upgrades(S).find(u => u.id === n)?.name || n} first`;
  S.proj[id] = { state: U.prep ? 'prep' : 'ready', left: U.prep, inst: U.install, paidLeft: U.cost, level: (p?.level || 0) };
  log(S, api, `Project started: ${U.name} (${U.cost} MCHF${U.prep ? `, ${U.prep} months of preparation` : ''}).`, 'info');
  if (!U.prep) progressProjects(S, api, 0);
  return null;
}
function finishProject(S, api, U) {
  const p = S.proj[U.id];
  if (U.repeat) { p.level = (p.level || 0) + 1; p.state = 'done'; S.gridLevel = (S.gridLevel || 0) + 1; }
  else { p.state = 'done'; S.done[U.id] = S.t; }
  if (U.id === 'splices') S.m.splices = 'ok';
  if (U.id === 'hl' || U.id === 'coll') S.mp.allowed = Math.max(S.mp.allowed, 5);
  log(S, api, `Completed: ${U.name}. ${U.effect}`, 'good');
  S.rep = Math.min(100, S.rep + 1);
  api?.onProject?.(U);
}
function progressProjects(S, api, dt) {
  const inLS = S.period === 'LS';
  for (const U of upgrades(S)) {
    const p = S.proj[U.id]; if (!p || p.state === 'done') continue;
    const months = dt / HPM;
    if (p.state === 'prep') {
      const pay = Math.min(p.paidLeft, U.cost * months / Math.max(1, U.prep));
      S.money -= pay; p.paidLeft -= pay; S.spent.upgrades += pay;
      p.left -= months;
      if (p.left <= 0) { p.state = 'ready'; if (U.install) log(S, api, `${U.name} is ready. It will be installed during the next long shutdown (${U.install} months of work).`, 'info'); }
    }
    if (p.state === 'ready') {
      if (p.paidLeft > 0) { S.money -= p.paidLeft; S.spent.upgrades += p.paidLeft; p.paidLeft = 0; }
      if (!U.install) finishProject(S, api, U);
      else if (inLS) p.state = 'install';
    }
    if (p.state === 'install') {
      if (!inLS) continue;
      p.inst -= months * (S.covidSlow && S.t < S.covidSlow ? 0.3 : 1);
      if (p.inst <= 0) finishProject(S, api, U);
    }
  }
}
export function scheduleLS(S, api, startT, months, name) {
  const ls = { start: startT, end: startT + months * HPM, name: name || `Long Shutdown ${S.sched.ls.length + 1}` };
  S.sched.ls.push(ls); S.sched.ls.sort((a, b) => a.start - b.start);
  log(S, api, `${ls.name} scheduled: ${months} months.`, 'info');
  return ls;
}
export function startTraining(S, api, Etarget) {
  const need = trainingNeeded(S, Etarget);
  if (!need.quenches) return 'Already trained for that energy';
  if (BEAM_MODES.includes(S.ops.mode) && S.ops.fill) endFill(S, api, 'Training campaign');
  enter(S, 'TRAINING', need.days * 24, { trainTarget: Etarget / S.m.Edesign, label: `Magnet training to ${(Etarget / 1000).toFixed(2)} TeV` });
  comment(S, `Magnet training campaign: ${need.total} quenches expected across 8 sectors`);
  log(S, api, `Magnet training campaign to ${(Etarget / 1000).toFixed(2)} TeV: about ${need.total} quenches, ${need.days} days.`, 'info');
  return null;
}

// ---------- physics bookkeeping ----------
function record(S, api, dtH) {
  const o = S.ops, f = o.fill, M = S.m;
  const Ls = ipLumis(S, f);
  const tot = Ls.reduce((a, b) => a + b, 0);
  o.lastL = Ls[0] || 0; o.lumis = Ls;
  const sec = dtH * 3600, eff = 0.93;
  const rs = rsTeV(S, f.E, f.ions);
  const y = year(S);
  M.ips.forEach((ip, i) => {
    const dL = (Ls[i] * sec) / 1e39 * eff; // fb⁻¹
    if (!dL) return;
    S.lumiIP[i] = (S.lumiIP[i] || 0) + dL;
    if (f.ions) S.ionLumi[i] = (S.ionLumi[i] || 0) + dL;
    const bucket = S.data[ip.det] || (S.data[ip.det] = {});
    for (const p of P.PROCESSES) {
      const beamOK = f.ions ? p.beam === 'ions' : p.beam === (M.kind === 'hadron' ? 'pp' : 'ee');
      if (!beamOK) continue;
      const dx = f.ions ? dL * 1e6 : dL * P.procXS(p, rs); // ions in nb⁻¹
      if (dx > 0) bucket[p.k] = (bucket[p.k] || 0) + dx;
    }
    if (ip.det === 'gp' || ip.det === 'ee' || (M.kind === 'linear' && i === 0)) {
      const key = f.ions ? 'ions' : 'main';
      S.yearLumi[y] = S.yearLumi[y] || { main: 0, ions: 0 };
      S.yearLumi[y][key] += dL / Math.max(1, M.ips.filter(q => q.det === ip.det).length);
      if (!f.ions) {
        S.rec += dL / Math.max(1, M.ips.filter(q => q.det === ip.det).length);
        const reach = P.searchReach(rs, S.lumiIP[i]);
        if (M.kind === 'hadron' && reach > (S.reach || 0)) S.reach = reach;
        S.lumiAt[Math.round(rs * 10) / 10] = (S.lumiAt[Math.round(rs * 10) / 10] || 0) + dL / Math.max(1, M.ips.filter(q => q.det === ip.det).length);
      }
    }
  });
  f.intL += (Ls[0] * sec) / 1e39;
  f.Lpeak = Math.max(f.Lpeak, Ls[0] || 0);
  f.tStable += dtH;
  f.intLh = (f.intLh || 0) + (Ls[0] || 0) * dtH;
  // beam evolution
  if (M.kind === 'hadron') {
    if (f.ions) f.ionDecay = (f.ionDecay ?? 1) * Math.exp(-dtH / 4.2);
    else {
      const lossPerBunch = (P.sigmaTot(rs) * tot * sec) / f.nb * (S.done.blevel ? 0.9 : 1);
      f.N = Math.max(0, f.N - lossPerBunch - f.N * dtH / 150);
      const tSR = P.dampingHours(f.E, M.rho, M.circ, 'p');
      f.eps = Math.max(0.6 * f.eps, f.eps * (1 + dtH * (1 / 32 - 1 / tSR)));
    }
  } else if (M.kind === 'lepton' && !M.topUp) f.decay = (f.decay ?? 1) * Math.exp(-dtH / 4);
  return tot;
}

function autoDump(S) {
  const o = S.ops, f = o.fill, M = S.m;
  if (M.kind === 'linear' || (M.kind === 'lepton' && M.topUp)) return false;
  if (S.set.fillHours > 0) return f.tStable >= S.set.fillHours;
  if (f.tStable < 1) return false;
  const T = turnaroundGuess(S);
  const L = o.lastL || 0;
  return L * (f.tStable + T) < f.intLh || (f.N && f.N < 0.15 * f.N0) || f.tStable > 30;
}

// ---------- main step ----------
export function step(S, dtTotal, api) {
  let left = dtTotal;
  while (left > 1e-9) {
    const dt = Math.min(left, 1 / 30);
    left -= dt;
    tick(S, dt, api);
    if (S.paused) break;
  }
}
function tick(S, dt, api) {
  const before = date(S);
  S.t += dt;
  const after = date(S);
  const o = S.ops;
  o.t += dt;
  // money: staff + maintenance continuously, electricity by use
  const mw = powerMW(S);
  S.powerNow = mw;
  const elec = (mw * dt * powerPrice(after.getUTCFullYear())) / 1e6 * (S.fund.elecFactor || 1);
  const fixed = (S.fund.fixed * dt) / HPY;
  S.money -= elec + fixed; S.spent.power += elec; S.spent.staff += fixed;
  S.energyMWh += mw * dt;
  if (Math.floor(S.t * 4) !== Math.floor((S.t - dt) * 4)) { S.trace.push([S.t, S.ops.mode === 'STABLE BEAMS' ? S.ops.lastL || 0 : 0]); if (S.trace.length > 700) S.trace.shift(); }
  if (S.ops.mode === 'CONSTRUCTION' || S.ops.mode === 'HW COMMISSIONING') api?.construct?.(S, dt);
  else {
    calendar(S, api);
    progressProjects(S, api, dt);
    ops(S, dt, api);
  }
  // new day / new year hooks
  if (after.getUTCDate() !== before.getUTCDate()) api?.daily?.(S);
  if (after.getUTCFullYear() !== before.getUTCFullYear()) newYear(S, api, before.getUTCFullYear());
}

function ops(S, dt, api) {
  const o = S.ops, M = S.m;
  const scheduled = S.period === 'PHYSICS' || S.period === 'IONS';
  if (scheduled) S.stats.sched += dt;
  switch (o.mode) {
    case 'SHUTDOWN': case 'REPAIR': return;
    case 'COMMISSIONING':
      S.mdXP += dt / 168 * 0.3;
      if (o.t >= o.dur) { enter(S, 'NO BEAM', 0.5); comment(S, 'Beam commissioning complete. Ready for physics.'); log(S, api, 'Beam commissioning complete: physics can start.', 'good'); }
      return;
    case 'TRAINING': {
      if (o.t >= o.dur) {
        M.trained = M.trained.map(t => Math.max(t, o.trainTarget + 0.002));
        enter(S, 'NO BEAM', 0.5);
        log(S, api, `Magnet training complete: all sectors hold ${(o.trainTarget * M.Edesign / 1000).toFixed(2)} TeV.`, 'good');
        comment(S, 'Training complete');
      }
      return;
    }
    case 'FAULT':
      if (o.t >= o.dur) { enter(S, 'NO BEAM', 0.4); comment(S, `${o.faultName} fixed. Preparing next fill.`); }
      else if (!scheduled) { /* keep */ }
      return;
  }
  if (!scheduled) return;
  // random faults
  const beam = BEAM_MODES.includes(o.mode);
  if (randomFault(S, api, beam, dt)) return;
  // machine development time: a share of beam time goes to studies
  if (beam) S.mdXP += (dt / 168) * S.sched.mdFrac * 2.2;
  if (o.mode === 'STABLE BEAMS') {
    record(S, api, dt * (1 - S.sched.mdFrac));
    S.stats.stable += dt;
    if (S.set.autopilot && autoDump(S)) { advance(S, api, true); return; }
  } else {
    o.lastL = 0; o.lumis = null;
    if (o.t >= o.dur && o.mode !== 'STABLE BEAMS') {
      if (S.set.autopilot) advance(S, api, true);
      else o.ready = true;
    }
  }
  checkUnlocks(S, api);
}

function checkUnlocks(S, api) {
  for (const u of MD_UNLOCKS) if (!S.done[u.id] && S.mdXP >= u.xp && isHadron(S)) { S.done[u.id] = S.t; log(S, api, `Machine development result: ${u.name}. ${u.effect}`, 'good'); api?.onUnlock?.(u); }
}

function newYear(S, api, oldYear) {
  const b = budgetPerYear(S);
  S.money += b;
  const sched = S.stats.sched, av = sched > 100 ? S.stats.stable / sched : null;
  S.history.push({ year: oldYear, lumi: S.yearLumi[oldYear]?.main || 0, ions: S.yearLumi[oldYear]?.ions || 0, stableFrac: av, money: S.money, rep: S.rep, spentPower: S.spent.power, energyGWh: S.energyMWh / 1000 });
  if (av != null) { if (av > 0.45) S.rep = Math.min(100, S.rep + 2); else if (av < 0.25) S.rep = Math.max(0, S.rep - 2); }
  S.stats.lastAvail = av;
  S.stats.sched = 0; S.stats.stable = 0; S.stats.byFault = {};
  S.energyMWh = 0; S.spent = { power: 0, staff: 0, upgrades: 0, build: 0 };
  log(S, api, `New year ${oldYear + 1}: budget ${Math.round(b)} MCHF received.${av != null ? ` Last year ${Math.round(av * 100)}% of scheduled physics time was spent in stable beams.` : ''}`, 'info');
  if (S.money < -150) {
    S.debtYears = (S.debtYears || 0) + 1;
    if (S.debtYears >= 2 && !S.sandbox) api?.gameOver?.('The funding council has lost confidence: two years deep in debt. The programme is cancelled, like the SSC in 1993.');
  } else S.debtYears = 0;
  // computing: analysis capacity refills each year
  api?.yearly?.(S, oldYear);
}

// Analysis capacity (fb⁻¹ per year the grid can process)
export const gridCapacity = S => S.gridBase * Math.pow(1.6, S.gridLevel || 0);
export function analyse(S, dtDays) {
  const cap = gridCapacity(S) * dtDays / 365.25;
  S.ana = Math.min(S.rec, (S.ana || 0) + cap);
  return S.rec > 0 ? S.ana / S.rec : 1;
}
export function significance(S, p) {
  const frac = S.rec > 0 ? clamp(S.ana / S.rec, 0, 1) : 1;
  const data = S.data;
  let N = (data[p.det]?.[p.k] || 0);
  if (p.gpWeight && data.gp?.[p.k]) N += data.gp[p.k] * p.gpWeight;
  if (p.beam !== 'ions') N *= frac;
  return P.signif(N, p.n5);
}
export function availableProcesses(S) {
  const M = S.m, dets = new Set(M.ips.map(i => i.det));
  return P.PROCESSES.filter(p => {
    if (M.kind === 'hadron') { if (p.beam === 'ee') return false; if (p.beam === 'ions') return dets.has(p.det) || (p.det === 'ions' && dets.has('gp')); return dets.has(p.det) || (p.gpWeight && dets.has('gp')); }
    return p.beam === 'ee';
  });
}

// ---------- operator helpers for UI ----------
export function dumpNow(S, api) { if (S.ops.mode === 'STABLE BEAMS' || BEAM_MODES.includes(S.ops.mode)) { if (S.ops.mode !== 'STABLE BEAMS') { endFill(S, api, 'Operator dump'); enter(S, 'RAMP DOWN', 0.6); } else advance(S, api, true); comment(S, 'Operator dumped the beams'); return true; } return false; }
export function detectorName(det) { return DETECTORS[det]?.like || det; }

export function newState({ mode, m, t0, money, rep = 50, fund, set, sched }) {
  return {
    v: 1, mode, m, t0, t: 0, money, rep, fund,
    set: { autopilot: true, auto: true, E: m.Edesign, spacing: 25, nb: 2808, N: 1.15e11, betaStar: 0.55, fillHours: 0, ...set },
    sched: { ls: [], ions: {}, mdFrac: 0.05, yets: true, ...sched },
    ops: { mode: 'NO BEAM', t: 0, dur: 0.5, ready: false, fill: null, comment: '' },
    mp: { allowed: 2, clean: 0 },
    done: {}, proj: {}, flags: {}, events: {}, missions: {}, disc: {},
    data: {}, lumiIP: [], ionLumi: [], lumiAt: {}, yearLumi: {}, rec: 0, ana: 0, gridBase: 20, gridLevel: 0, reach: 0,
    fills: [], log: [], trace: [], history: [], stats: { sched: 0, stable: 0, faults: 0, byFault: {} },
    spent: { power: 0, staff: 0, upgrades: 0, build: 0 }, energyMWh: 0,
    fillNo: 0, mdXP: 0, period: undefined, 
  };
}
export { rand };
