// Relativistic kinematics and a simplified outcome model for the collider lab.
import { findNuclide, byZ, nuc } from '../store.js';
import { U, ME_MEV, MP_MEV, MN_MEV, M_E, coulombBarrier, atomicMass, sepN, fusionChannels, radius } from '../nuclear.js';

export const C = 299792458;
export const HC = 1239.84198; // MeV fm

export const PARTICLE_TYPES = {
  'e-': { label: 'Electron', sym: 'e⁻', mass: ME_MEV, q: -1, lepton: true },
  'e+': { label: 'Positron', sym: 'e⁺', mass: ME_MEV, q: 1, lepton: true, anti: true },
  p: { label: 'Proton', sym: 'p', mass: MP_MEV, q: 1, hadron: true, nucleons: 1 },
  pbar: { label: 'Antiproton', sym: 'p̄', mass: MP_MEV, q: -1, hadron: true, anti: true, nucleons: 1 },
  n: { label: 'Neutron', sym: 'n', mass: MN_MEV, q: 0, hadron: true, nucleons: 1 },
  ion: { label: 'Atomic nucleus', sym: '', mass: 0, q: 0 },
};

export function particle(kind, nucl) {
  if (kind !== 'ion') { const t = PARTICLE_TYPES[kind]; return { kind, ...t, label: kind === 'p' ? 'H-1' : t.sym, A: t.nucleons || 0, Z: kind === 'p' ? 1 : 0, name: t.label }; }
  const r = nucl;
  const mass = r.m * U - r.z * ME_MEV; // bare nucleus
  return { kind, label: r.label, sym: r.label, name: `${byZ[r.z].name}-${r.a}`, mass, q: r.z, A: r.a, Z: r.z, r, nucleus: true };
}

export function kinematics(P, beta) {
  const g = 1 / Math.sqrt(1 - beta * beta);
  const E = g * P.mass, KE = (g - 1) * P.mass, p = g * beta * P.mass;
  return { beta, gamma: g, E, KE, p, v: beta * C, lambda: p > 0 ? HC / p : Infinity, KEperA: P.A ? KE / P.A : null };
}

// Speed slider: 0..1000 → β from 1% c to 1 - 10⁻¹²
export function sliderToBeta(s) {
  if (s <= 500) return 0.01 + (s / 500) * 0.89;
  return 1 - 0.1 * Math.pow(10, -((s - 500) / 500) * 11);
}
export function betaToSlider(b) {
  if (b <= 0.9) return Math.round(((b - 0.01) / 0.89) * 500);
  return Math.round(500 + (-Math.log10((1 - b) / 0.1) / 11) * 500);
}
export function betaFromKE(P, KE) { const g = 1 + KE / P.mass; return Math.sqrt(1 - 1 / (g * g)); }

export function machine(P, K, type, length) {
  const rfPerTurn = P.lepton ? 3500 : 16; // MV per lap: LEP-style RF for electrons, LHC-style for hadrons
  const out = { type, length, rf: rfPerTurn };
  if (P.q === 0) { out.neutral = true; return out; }
  const q = Math.abs(P.q);
  if (type === 'linac') {
    out.voltage = K.KE / q; // MV
    out.gradient = out.voltage / length; // MV/m
    out.time = length / (K.v * 0.5 + 1e-9 * C); // rough (average speed)
    out.feasible = out.gradient < 50 ? 'realistic (radio-frequency cavities)' : out.gradient < 150 ? 'record-breaking cavities' : out.gradient < 1e5 ? 'needs plasma wakefield acceleration' : 'beyond any known technology';
    out.ok = out.gradient < 1e5;
  } else {
    const rho = length / (2 * Math.PI) * 0.66;
    out.rho = rho;
    out.B = (K.p / 1000) / (0.299792458 * q * rho);
    out.turns = Math.max(1, K.KE / (q * rfPerTurn));
    out.rev = K.v > 0 ? length / K.v : 0;
    out.time = out.turns * (length / (0.5 * (K.v + 0.01 * C)));
    // synchrotron radiation energy loss per turn (MeV)
    const Egev = K.E / 1000;
    out.u0 = 0.08846 * Math.pow(Egev, 4) / rho * Math.pow(ME_MEV / P.mass, 4) * q * q;
    out.feasible = out.B < 2 ? 'normal iron magnets' : out.B < 9 ? 'superconducting magnets (like the LHC)' : out.B < 16 ? 'next-generation superconducting magnets' : out.B < 50 ? 'beyond current magnet technology' : 'impossible with any known magnet';
    out.ok = out.B < 50 && out.u0 < q * rfPerTurn;
    if (out.u0 >= q * rfPerTurn) out.feasible = `synchrotron radiation loss (${out.u0.toExponential(2)} MeV/turn) exceeds RF power: make the ring bigger`;
  }
  return out;
}

// Invariant mass of the collision.
export function collision(P1, K1, P2, K2, mode) {
  const m1 = P1.mass, m2 = P2.mass;
  let s;
  if (mode === 'fixed') s = m1 * m1 + m2 * m2 + 2 * K1.E * m2;
  else s = m1 * m1 + m2 * m2 + 2 * (K1.E * K2.E + K1.p * K2.p);
  const sqrtS = Math.sqrt(s);
  const Ecm = sqrtS - m1 - m2; // kinetic energy available in the CM frame
  // per nucleon pair
  let sqrtSNN = null;
  if (P1.A && P2.A) {
    const mN = 931.494;
    const e1 = K1.E / P1.A, p1 = K1.p / P1.A;
    if (mode === 'fixed') sqrtSNN = Math.sqrt(2 * mN * mN + 2 * e1 * mN);
    else { const e2 = K2.E / P2.A, p2 = K2.p / P2.A; sqrtSNN = Math.sqrt(2 * mN * mN + 2 * (e1 * e2 + p1 * p2)); }
  }
  return { s, sqrtS, Ecm, sqrtSNN };
}

const PM = { pi: 139.57, pi0: 134.98, K: 493.68, p: 938.27, n: 939.57, mu: 105.66, tau: 1776.9, jpsi: 3096.9, ups: 9460.3, W: 80369, Z: 91188, H: 125100, top: 172570, lambda: 1115.7 };

function chargedMultiplicity(sqrtSGeV) {
  const s = sqrtSGeV * sqrtSGeV;
  return Math.max(0, -4.2 + 4.69 * Math.pow(s, 0.155));
}

// Decide what happens. Returns a description plus particles for the event display.
export function outcome(P1, K1, P2, K2, mode, col) {
  const res = { channels: [], products: [], notes: [], view: 'detector', hard: [] };
  const kinds = [P1.kind, P2.kind];
  const has = k => kinds.includes(k);
  const sGeV = col.sqrtS / 1000;
  const lep = P1.lepton && P2.lepton;

  // Electron-positron annihilation
  if (lep && P1.q + P2.q === 0) {
    res.view = 'detector';
    res.title = 'Matter meets antimatter: annihilation';
    const open = [['2 photons', 0, 'e⁺e⁻ → γγ']];
    if (col.sqrtS > 2 * PM.mu) open.push(['muon pair', 2 * PM.mu, 'e⁺e⁻ → μ⁺μ⁻']);
    if (col.sqrtS > 2 * PM.pi) open.push(['pions (hadrons)', 2 * PM.pi, 'e⁺e⁻ → π⁺π⁻…']);
    if (Math.abs(col.sqrtS - PM.jpsi) < 60) open.push(['J/ψ resonance', PM.jpsi, 'charm quark + anti-charm bound state (Nobel 1976)']);
    if (col.sqrtS > 2 * PM.tau) open.push(['tau pair', 2 * PM.tau, 'e⁺e⁻ → τ⁺τ⁻']);
    if (Math.abs(col.sqrtS - PM.ups) < 150) open.push(['Υ (upsilon) resonance', PM.ups, 'bottom quark bound state']);
    if (Math.abs(col.sqrtS - PM.Z) < 3000) open.push(['Z boson', PM.Z, 'on the Z peak: the LEP collider made 17 million of these']);
    if (col.sqrtS > 2 * PM.W) open.push(['W⁺W⁻ pair', 2 * PM.W, 'carriers of the weak force']);
    if (col.sqrtS > PM.Z + PM.H) open.push(['Higgs boson + Z', PM.Z + PM.H, 'a proposed "Higgs factory" process']);
    if (col.sqrtS > 2 * PM.top) open.push(['top quark pair', 2 * PM.top, 'the heaviest known particle']);
    res.channels = open;
    const main = open[open.length - 1][0];
    res.text = `The electron and positron destroy each other, turning ${fmtE(col.sqrtS)} of mass-energy into new particles. Highest-energy process open here: ${main}.`;
    res.hard = main.startsWith('Z') ? ['mu', 'mu'] : main.startsWith('Higgs') ? ['gamma', 'gamma', 'jet', 'jet'] : main.startsWith('W') ? ['jet', 'jet', 'mu'] : main.startsWith('top') ? ['jet', 'jet', 'jet', 'jet', 'mu'] : main.startsWith('muon') ? ['mu', 'mu'] : main.startsWith('2 photons') ? ['gamma', 'gamma'] : ['jet', 'jet'];
    res.nch = main.startsWith('2 photons') || main.startsWith('muon') ? 0 : Math.round(chargedMultiplicity(sGeV) * 0.8);
    return res;
  }
  // Leptons scattering on something
  if (P1.lepton || P2.lepton) {
    const L = P1.lepton ? P1 : P2, T = P1.lepton ? P2 : P1, KL = P1.lepton ? K1 : K2;
    if (T.lepton) { res.title = 'Electron-electron scattering'; res.text = 'Two electrons repel through their electric fields and fly apart (Møller scattering). No new particles unless the energy is enormous.'; res.view = 'nuclear'; res.anim = 'bounce'; return res; }
    const R = T.A ? radius(T.A) : 0.84;
    const pcm = KL.p;
    const lam = HC / pcm;
    res.channels.push(['wavelength of the probe', lam, `${lam.toPrecision(3)} fm vs target radius ${R.toPrecision(3)} fm`]);
    if (lam > 4 * R) {
      res.title = 'Elastic scattering: the target looks like a point';
      res.text = `The ${L.name.toLowerCase()}'s quantum wavelength (${lam.toPrecision(3)} fm) is much larger than the target (${R.toPrecision(3)} fm), so it bounces off the whole charge without seeing any structure.`;
      res.view = 'nuclear'; res.anim = 'deflect';
    } else if (col.sqrtS < 3000 || lam > 0.3) {
      res.title = 'Measuring the size of the nucleus';
      res.text = `The probe wavelength (${lam.toPrecision(3)} fm) is comparable to the target size, so the scattering pattern shows the nuclear charge distribution. Robert Hofstadter won the 1961 Nobel Prize for measuring nuclei this way.`;
      res.view = 'nuclear'; res.anim = 'deflect';
    } else {
      res.title = 'Deep inelastic scattering: hitting a quark';
      res.text = `At ${fmtE(col.sqrtS)} the ${L.name.toLowerCase()} resolves ${lam.toPrecision(2)} fm, far inside a proton. It knocks out a single quark, which becomes a jet of particles. SLAC discovered quarks this way in 1968.`;
      res.hard = ['e', 'jet'];
      res.nch = Math.round(chargedMultiplicity(sGeV) * 0.6);
    }
    return res;
  }
  // Antiproton annihilation
  if (has('pbar') && (has('p') || has('n') || P1.nucleus || P2.nucleus)) {
    res.title = 'Antiproton annihilation';
    res.text = `The antiproton and a proton or neutron annihilate, converting at least 1.88 GeV of mass into a burst of about five pions${sGeV > 300 ? '. At this energy, quark-antiquark collisions can even make top quarks, as at Fermilab\'s Tevatron (1995)' : ''}.`;
    res.nch = Math.max(4, Math.round(chargedMultiplicity(sGeV) + 3));
    if (sGeV > 400) res.hard = ['jet', 'jet', 'jet', 'jet', 'mu'];
    return res;
  }
  // Neutron + nucleus (or proton)
  const N = P1.kind === 'n' ? P1 : P2.kind === 'n' ? P2 : null;
  if (N) {
    const T = N === P1 ? P2 : P1, KN = N === P1 ? K1 : K2;
    const E = mode === 'fixed' ? KN.KE : col.Ecm;
    if (T.kind === 'n') { res.title = 'Neutron-neutron scattering'; res.text = 'Two neutrons bounce off each other through the strong force. There is no bound di-neutron.'; res.view = 'nuclear'; res.anim = 'bounce'; return res; }
    const tz = T.Z, ta = T.A;
    const fissile = ['U-235', 'U-233', 'Pu-239', 'Pu-241'].includes(T.label) || (['U-238', 'Th-232', 'Np-237'].includes(T.label) && E > 1.2);
    if (fissile && E < 50) {
      res.title = 'Neutron-induced fission';
      res.text = `The ${T.label} nucleus absorbs the neutron, wobbles and splits into two fragments plus 2 to 3 new neutrons, releasing about 200 MeV. This is how nuclear reactors work.`;
      res.view = 'nuclear'; res.anim = 'fission'; res.product = [nuc(36, 92), nuc(56, 141)].filter(Boolean);
      return res;
    }
    if (E < 20) {
      const prod = nuc(tz, ta + 1), sn = sepN(tz, ta + 1);
      res.title = 'Neutron capture';
      res.text = `No electric repulsion stops a neutron, so even a slow one is absorbed. ${T.label} becomes ${byZ[tz].sym}-${ta + 1}, releasing a ${sn.toFixed(2)} MeV gamma ray. ${prod ? (prod.hl === -1 ? 'The product is stable.' : `The product is radioactive (half-life ${fmtHL(prod.hl)}). This is neutron activation, used to make medical isotopes.`) : ''}`;
      res.view = 'nuclear'; res.anim = 'capture'; res.product = prod ? [prod] : [];
      res.channels.push(['energy released as gamma rays', sn, `${sn.toFixed(2)} MeV`]);
      return res;
    }
    res.title = 'Spallation';
    res.text = 'The fast neutron knocks many nucleons out of the nucleus, leaving a lighter residue and a spray of protons and neutrons.';
    res.view = 'nuclear'; res.anim = 'shatter'; return res;
  }
  // Nucleus / proton on nucleus / proton
  const z1 = P1.Z, z2 = P2.Z, a1 = P1.A, a2 = P2.A;
  const Vc = coulombBarrier(z1, a1, z2, a2);
  const Ecm = col.Ecm;
  if (P1.kind === 'p' && P2.kind === 'p' && col.sqrtS < 2 * PM.p + PM.pi0) {
    res.title = 'Proton meets proton: the Sun\'s first step';
    res.text = `Two protons ${Ecm < Vc ? 'tunnel through their electric repulsion' : 'touch'}, but there is no stable helium-2. Only if the weak force turns one proton into a neutron at that instant do they stick as deuterium, emitting a positron and a neutrino. That is so unlikely that a proton in the Sun waits about 9 billion years for it.`;
    res.channels.push(['Coulomb barrier', Vc, fmtE(Vc)]);
    res.view = 'nuclear'; res.anim = 'fuse'; res.product = [nuc(1, 2)]; res.productLabels = ['H-2', 'e+', 'ν'];
    return res;
  }
  const perA = col.sqrtSNN ? (col.sqrtSNN - 2 * 931.494) : 0; // CM kinetic energy per nucleon pair
  res.channels.push(['Coulomb barrier', Vc, `${fmtE(Vc)} (energy available: ${fmtE(Ecm)})`]);
  if (Ecm < Vc && perA < 30) {
    const mu = a1 * a2 / (a1 + a2);
    const gamow = 31.29 * z1 * z2 * Math.sqrt(mu / (Ecm * 1000));
    const P = Math.exp(-gamow);
    if (P > 1e-7 && Ecm > 0.05 * Vc) {
      res.title = 'Fusion by quantum tunneling';
      res.text = `Classically the nuclei cannot touch (barrier ${fmtE(Vc)}), but quantum tunneling lets them through with probability about ${P.toExponential(1)} per collision. This is how the Sun fuses hydrogen at "only" 15 million K. Cockcroft and Walton split lithium this way in 1932.`;
      res.channels.push(['tunneling probability', P, P.toExponential(2)]);
      return fuse(res, P1, P2, Ecm, true);
    }
    const d = 1.44 * z1 * z2 / Ecm;
    res.title = 'Rutherford scattering';
    res.text = `The nuclei repel before touching: closest approach ${d.toPrecision(3)} fm, while their surfaces are ${(radius(a1) + radius(a2)).toPrecision(3)} fm apart when touching. In 1909 this bounce-back of alpha particles from gold revealed the atomic nucleus.`;
    res.channels.push(['closest approach', d, `${d.toPrecision(3)} fm`]);
    res.view = 'nuclear'; res.anim = 'deflect';
    return res;
  }
  if (perA < 15) return fuse(res, P1, P2, Ecm, false);
  if (perA < 250) {
    res.title = 'Fragmentation';
    res.text = `At ${perA.toFixed(0)} MeV per nucleon the nuclei shatter into lighter fragments, free protons and neutrons. Facilities like FRIB and GSI use this to make thousands of exotic isotopes never seen in nature.`;
    res.view = 'nuclear'; res.anim = 'shatter';
    res.fragments = fragments(P1, P2, perA);
    return res;
  }
  const heavy = a1 >= 16 && a2 >= 16;
  const sNN = (col.sqrtSNN || col.sqrtS) / 1000;
  const npart = (a1 || 1) + (a2 || 1);
  if (heavy) {
    res.title = sNN > 10 ? 'Quark-gluon plasma' : 'Hot, dense nuclear matter';
    res.text = sNN > 10
      ? `The nuclei melt into a droplet of quark-gluon plasma at over 2 trillion K, the state of the whole universe a microsecond after the Big Bang. It behaves as a nearly perfect liquid and cools into ${Math.round(npart / 2 * chargedMultiplicity(sNN) * (1 + 0.15 * Math.log(Math.max(1, sNN / 10)))).toLocaleString()} charged particles.`
      : 'The nuclei pile up into matter several times denser than a normal nucleus, like the inside of a neutron star, boiling off pions and kaons.';
    res.nch = Math.round(npart / 2 * chargedMultiplicity(sNN) * (1 + 0.15 * Math.log(Math.max(1, sNN / 10))));
    if (sNN > 100) res.hard = ['jet', 'jet'];
    res.qgp = sNN > 10;
    return res;
  }
  // proton-proton or proton-nucleus at high energy
  const ch = [];
  if (col.sqrtS > 2 * PM.p + PM.pi0) ch.push(['pion production', 2 * PM.p + PM.pi0, 'p p → p p π⁰']);
  if (col.sqrtS > PM.p + PM.lambda + PM.K) ch.push(['strange particles (kaons)', PM.p + PM.lambda + PM.K, 'p p → p Λ K⁺']);
  if (col.sqrtS > 4 * PM.p) ch.push(['antiprotons', 4 * PM.p, 'p p → p p p p̄ (discovered this way, 1955)']);
  if (col.sqrtS > 3 * PM.jpsi) ch.push(['J/ψ (charm)', PM.jpsi, 'rare']);
  if (col.sqrtS > 5 * PM.W) ch.push(['W and Z bosons', PM.W, 'discovered at CERN in 1983']);
  if (col.sqrtS > 15 * PM.H) ch.push(['Higgs boson', PM.H, 'about 1 in a billion collisions (discovered 2012)']);
  if (col.sqrtS > 15 * PM.top) ch.push(['top quarks', 2 * PM.top, 'heaviest elementary particle']);
  res.channels.push(...ch);
  if (!ch.length || col.sqrtS < 2 * PM.p + PM.pi0) {
    res.title = 'Elastic nuclear collision';
    res.text = 'Above the Coulomb barrier but below the pion threshold, protons mostly bounce or knock nucleons loose.';
    res.view = 'nuclear'; res.anim = 'bounce'; return res;
  }
  if (!(P1.kind === 'p' && P2.kind === 'p') && sNN < 5) {
    res.title = 'Spallation';
    res.text = `The proton smashes into the nucleus and knocks out ${Math.round(Math.min(40, (P1.A + P2.A) * 0.12))} or so neutrons. Spallation sources such as SNS and ESS use GeV protons on heavy metal to make intense neutron beams.`;
    res.view = 'nuclear'; res.anim = 'shatter'; res.fragments = fragments(P1, P2, 400); return res;
  }
  const last = ch[ch.length - 1][0];
  res.title = sGeV > 1000 ? 'High-energy proton collision' : 'Particle production';
  res.text = `${fmtE(col.sqrtS)} is available. E = mc² turns kinetic energy into new particles: about ${Math.round(chargedMultiplicity(sNN) * (1 + (npart > 2 ? 0.2 * Math.log(npart) : 0)))} charged particles per collision. Heaviest thing it can make: ${last}.`;
  res.nch = Math.round(chargedMultiplicity(sNN) * (npart > 2 ? 1 + 0.2 * Math.log(npart) : 1));
  res.hard = last === 'Higgs boson' || last === 'top quarks' ? ['gamma', 'gamma', 'jet', 'jet'] : last.startsWith('W') ? ['mu', 'jet'] : sGeV > 20 ? ['jet', 'jet'] : [];
  if (last === 'Higgs boson' || last === 'top quarks') res.notes.push('Displayed event: a Higgs boson decaying into two photons, the "golden" discovery channel.');
  return res;
}

function fuse(res, P1, P2, Ecm, tunnel) {
  const Z = P1.Z + P2.Z, A = P1.A + P2.A;
  const m1 = atomicMass(P1.Z, P1.A), m2 = atomicMass(P2.Z, P2.A), mc = atomicMass(Z, A);
  const Qf = (m1.m + m2.m - mc.m) * U;
  let Ex = Ecm + Qf;
  res.view = 'nuclear'; res.anim = 'fuse';
  const compoundLabel = `${byZ[Z] ? byZ[Z].sym : `E${Z}`}-${A}`;
  res.channels.push(['compound nucleus', A, `${compoundLabel}${mc.measured ? '' : ' (mass estimated)'}`], ['excitation energy', Ex, `${fmtE(Ex)}`]);
  if (Z > 118) {
    res.title = `Attempt at element ${Z}`;
    res.text = `No element beyond 118 has ever been made. The compound nucleus would have ${Z} protons and ${Ex.toFixed(0)} MeV of excess energy. Labs in Japan, Russia and the USA are trying right now with titanium and chromium beams; each successful atom may take months of beam time.`;
    res.product = []; res.newElement = Z; return res;
  }
  // Light systems: best two-body exit channel from real masses
  if (Z <= 12) {
    const r1 = findNuclide(P1.label), r2 = findNuclide(P2.label);
    if (r1 && r2) {
      const ch = fusionChannels(r1, r2).filter(c => c.q + Ecm > 0);
      if (ch.length) {
        const c = ch[0];
        res.title = tunnel ? res.title : 'Nuclear fusion';
        if (!tunnel) res.text = `The nuclei overcome their repulsion and fuse into ${compoundLabel}, which immediately breaks up: ${c.text}. Q = ${c.q.toFixed(2)} MeV.`;
        else res.text += ` Products: ${c.products.join(' + ')}, Q = ${c.q.toFixed(2)} MeV.`;
        res.product = c.products.map(p => findNuclide(p)).filter(Boolean);
        res.productLabels = c.products;
        return res;
      }
    }
  }
  // Heavy systems: evaporate neutrons until too cold.
  let a = A, x = 0;
  while (x < 12) { const sn = sepN(Z, a); if (!(Ex > sn + 2)) break; Ex -= sn + 2; a--; x++; }
  const prod = nuc(Z, a);
  const sup = Z >= 104;
  res.title = sup ? `Superheavy element synthesis: ${byZ[Z].name}` : 'Fusion-evaporation';
  const base = `The nuclei fuse into hot ${compoundLabel}${mc.measured ? '' : ' (mass from the liquid-drop model)'}, which cools by boiling off ${x} neutron${x === 1 ? '' : 's'} and a gamma ray, leaving ${byZ[Z].sym}-${a}.`;
  const tail = prod ? (prod.hl === -1 ? ' The result is stable.' : prod.hl ? ` It is radioactive with a half-life of ${fmtHL(prod.hl)}.` : ' Its half-life is too short to be in our dataset.') : ' This isotope has never been observed.';
  res.text = (tunnel ? res.text + ' ' : '') + base + tail + (sup ? ' Superheavy fusion almost always ends in fission instead: the chance of making one atom is about 1 in 10¹⁸ collisions.' : '');
  if (!tunnel) res.title = res.title;
  res.product = prod ? [prod] : [];
  res.productLabels = [`${byZ[Z].sym}-${a}`, ...Array(x).fill('n')];
  return res;
}

// Heavy residue close to the bigger nucleus, plus light fragments and free nucleons.
function fragments(P1, P2, perA = 50) {
  const big = P1.A >= P2.A ? P1 : P2, small = big === P1 ? P2 : P1;
  const lost = Math.max(2, Math.min(big.A - 6, Math.round(big.A * Math.min(0.55, 0.04 + perA / 500))));
  const out = [];
  const near = (z, a) => { for (const [dz, da] of [[0, 0], [0, 1], [0, -1], [-1, 0], [1, 0], [0, 2], [0, -2], [-1, -1], [1, 1]]) { const r = nuc(z + dz, a + da); if (r && r.hl != null) return r; } return null; };
  const ra = big.A - lost, rz = Math.round(ra * big.Z / big.A);
  const res = near(rz, ra); if (res) out.push(res);
  if (small.A >= 4) { const pr = near(Math.round(small.Z * 0.8), Math.round(small.A * 0.8)); if (pr && pr.a >= 4) out.push(pr); }
  const light = ['He-4', 'Li-7', 'He-4', 'Be-9', 'C-12', 'He-3', 'H-2', 'B-11', 'He-4', 'H-3'];
  let pool = lost, i = 0;
  while (pool > 12 && out.length < 8) { const r = findNuclide(light[i++ % light.length]); out.push(r); pool -= r.a * 2; }
  return out;
}

export function fmtE(mev) {
  const a = Math.abs(mev);
  if (a >= 1e6) return `${(mev / 1e6).toPrecision(3)} TeV`;
  if (a >= 1e3) return `${(mev / 1e3).toPrecision(3)} GeV`;
  if (a >= 1) return `${mev.toPrecision(3)} MeV`;
  if (a >= 1e-3) return `${(mev * 1e3).toPrecision(3)} keV`;
  return `${(mev * 1e6).toPrecision(3)} eV`;
}
function fmtHL(s) {
  const y = s / 31557600;
  if (s < 1) return `${(s * 1000).toPrecision(2)} ms`;
  if (s < 120) return `${s.toPrecision(2)} s`;
  if (s < 7200) return `${(s / 60).toPrecision(2)} min`;
  if (s < 172800) return `${(s / 3600).toPrecision(2)} h`;
  if (y < 2) return `${(s / 86400).toPrecision(2)} days`;
  if (y < 1e6) return `${y.toPrecision(3)} years`;
  return `${(y / 1e9).toPrecision(3)} billion years`;
}
export { M_E };
