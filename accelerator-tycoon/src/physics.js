// Accelerator and collider physics used by the game. Formulas are the standard textbook ones;
// numbers in the tables are published measurements or official projections (sources in comments).
import { loglog } from './util.js';

export const C = 299792458; // m/s
export const MP = 0.938272; // proton mass, GeV
export const ME = 0.000511; // electron mass, GeV
export const HOUR = 3600;

// Magnetic rigidity: p [GeV/c] = 0.2998 · B [T] · ρ [m]
export const energyFromField = (B, rho) => 0.2998 * B * rho;
export const fieldForEnergy = (E, rho) => E / (0.2998 * rho);
export const frev = circ => C / circ;

// Synchrotron radiation loss per turn (GeV): U0 = Cγ E⁴ / ρ, Cγ = 8.85e-5 m/GeV³ (e), 7.78e-18 (p)
export const U0 = (E, rho, sp) => (sp === 'e' ? 8.846e-5 : 7.783e-18) * Math.pow(E, 4) / rho;
// Transverse emittance damping time from synchrotron radiation (hours)
export const dampingHours = (E, rho, circ, sp) => (E * (circ / C)) / Math.max(1e-30, U0(E, rho, sp)) / HOUR;

// Total and inelastic pp cross sections (mb): TOTEM, ATLAS-ALFA, Auger extrapolation
const SIG_INEL = [[0.9, 52.5], [2.76, 62.1], [7, 73.2], [8, 74.7], [13, 79.5], [13.6, 80], [14, 80.5], [27, 88], [100, 108]];
const SIG_TOT = [[0.9, 70], [2.76, 84.7], [7, 98.3], [8, 101.5], [13, 110.6], [13.6, 111.5], [14, 112], [27, 125], [100, 152]];
export const sigmaInel = rs => loglog(SIG_INEL, Math.max(0.2, rs)) * 1e-27; // cm²
export const sigmaTot = rs => loglog(SIG_TOT, Math.max(0.2, rs)) * 1e-27;

// Crossing-angle (Piwinski) reduction factor. Beams cross at ~10σ separation,
// so θσz/(2σ*) = 10·σz/(2β*). Crab cavities tilt the bunches and recover most of it.
export function geomFactor(betaStar, sigmaZ = 0.0755, crab = false) {
  const phi = 10 * sigmaZ / (2 * betaStar);
  const F = 1 / Math.sqrt(1 + phi * phi);
  return crab ? Math.max(F, 0.92) : F;
}

// Round-beam luminosity: L = γ f nb N² F / (4π εn β*)   (cm⁻² s⁻¹)
export function lumiHadron({ E, nb, N, epsN, betaStar, circ, crab, mass = MP }) {
  if (!nb || !N) return 0;
  const gamma = E / mass;
  return (gamma * frev(circ) * nb * N * N * geomFactor(betaStar, 0.0755, crab)) / (4 * Math.PI * epsN * betaStar) * 1e-4;
}
export const pileup = (L, rs, nb, circ) => (nb ? (L * sigmaInel(rs)) / (nb * frev(circ)) : 0);
export const lumiForPileup = (mu, rs, nb, circ) => (mu * nb * frev(circ)) / sigmaInel(rs);

// e+e− rings are limited by the synchrotron power they can feed. For a beam-beam limited ring
// L ∝ P_SR · ρ / E³ (per beam). Calibrated on FCC-ee at the Z (1.4e36 at 45.6 GeV, 50 MW, ρ = 10.76 km).
// Without the crab-waist scheme and top-up injection (LEP style) it is ~100× lower.
export function lumiLepton({ Ebeam, rho, Psr, crabWaist }) {
  const L = 1.4e36 * (Psr / 50) * (rho / 10760) * Math.pow(45.6 / Ebeam, 3);
  return crabWaist ? L : L / 120;
}
// Linear colliders: L ≈ 1.35e34 × P_wall / 111 MW (ILC-250 and CLIC-3000 both follow it within ~20%)
export const lumiLinear = Pwall => 1.35e34 * Pwall / 111;

// Stored energy per beam (MJ)
export const storedMJ = (E, nb, N) => (E * 1e9 * 1.602e-19 * nb * N) / 1e6;

// ---------- cross sections (fb) vs √s (TeV) ----------
// LHC Higgs XS WG (N3LO ggF + VBF + VH + ttH), top++ NNLO, FCC CDR for 100 TeV
const XS = {
  H: [[1.96, 1100], [7, 17500], [8, 22300], [13, 55100], [13.6, 59800], [14, 62100], [27, 180000], [100, 800000]],
  tt: [[1.96, 7200], [7, 177000], [8, 253000], [13, 832000], [13.6, 924000], [14, 985000], [27, 4.6e6], [100, 3.47e7]],
  ttH: [[1.96, 5], [7, 86], [8, 130], [13, 507], [13.6, 570], [14, 611], [27, 2900], [100, 34000]],
  HH: [[1.96, 0.1], [7, 6], [8, 8.5], [13, 31], [13.6, 34], [14, 37], [27, 140], [100, 1200]],
  tttt: [[1.96, 0.001], [7, 0.8], [8, 1.3], [13, 12], [13.6, 13.4], [14, 15.8], [27, 190], [100, 4600]],
  WZ: [[0.5, 2e6], [1.96, 3e6], [7, 1.15e7], [8, 1.3e7], [13, 2.2e7], [14, 2.3e7], [100, 1.5e8]], // W,Z → leptons
  bb: [[0.5, 5], [1.96, 50], [7, 280], [8, 300], [13, 500], [13.6, 515], [14, 530], [100, 2000]], // µb
};
const xs = (k, rs, thr = 0) => (rs < thr ? 0 : loglog(XS[k], rs));

// e+e− cross sections (fb) vs √s (GeV)
function sigmaZpole(rsGeV) { // Breit-Wigner, peak 41.5 nb hadronic
  const M = 91.1876, G = 2.4952, s = rsGeV * rsGeV;
  return 41.5e6 * (s * G * G) / (Math.pow(s - M * M, 2) + (s * s * G * G) / (M * M));
}
const sigmaWW = r => (r < 161 ? 0 : 17000 * Math.min(1, Math.pow((r - 161) / 30, 0.8)) * Math.pow(Math.max(r, 200) / 200, -1.2));
const sigmaZH = r => (r < 216.4 ? 0 : 230 * Math.min(1, Math.pow((r - 216.4) / 30, 0.9)) * Math.pow(Math.max(r, 250) / 250, -2));
const sigmaTTee = r => (r < 345 ? 0 : 550 * Math.min(1, Math.pow((r - 345) / 30, 0.8)) * Math.pow(Math.max(r, 500) / 500, -2));
const sigmaZHH = r => (r < 341 ? 0 : 0.18 * Math.min(1, Math.pow((r - 341) / 150, 1.2)) * Math.pow(Math.max(r, 550) / 550, -1));

// Physics programme. `n5`: events (summed over detectors of the right kind) for a 5σ result,
// calibrated on the real observation named in `ref`. Units: events, except where `unit` says otherwise.
export const PROCESSES = [
  // proton-proton
  { k: 'wz', beam: 'pp', det: 'gp', name: 'W and Z bosons', n5: 1000, xs: rs => xs('WZ', rs, 0.35), ref: 'UA1/UA2 1983; rediscovered at the LHC in 2010 with 0.3 pb⁻¹', text: 'The carriers of the weak force. First seen at CERN in 1983; every new hadron collider "rediscovers" them to calibrate its detectors.' },
  { k: 'ridge', beam: 'pp', det: 'gp', name: 'The "ridge" in busy proton collisions', n5: 1000, xs: rs => (rs >= 5 ? 1e6 : 0), ref: 'CMS 2010, 0.98 pb⁻¹ at 7 TeV', text: 'Particles in rare, very busy proton collisions line up in angle, like in the quark-gluon plasma. Found by CMS in 2010.' },
  { k: 'top', beam: 'pp', det: 'gp', name: 'Top quark', n5: 500, xs: rs => xs('tt', rs, 0.4), ref: 'CDF and DØ, Tevatron 1995; CMS/ATLAS 2010 with 3 pb⁻¹', text: 'The heaviest known particle, as heavy as a gold atom. Discovered at Fermilab\'s Tevatron in 1995.' },
  { k: 'higgs', beam: 'pp', det: 'gp', name: 'Higgs boson', n5: 2.2e5, xs: rs => xs('H', rs, 0.3), ref: 'ATLAS and CMS, 4 July 2012, ~10 fb⁻¹ at 7–8 TeV each', text: 'The particle of the field that gives mass to W, Z, quarks and leptons. Nobel Prize 2013 for Englert and Higgs.' },
  { k: 'htt', beam: 'pp', det: 'gp', name: 'Higgs → τ τ', n5: 2.5e6, xs: rs => xs('H', rs, 0.3), ref: 'CMS 2017, 36 fb⁻¹ at 13 TeV + Run 1', text: 'First proof that the Higgs gives mass to leptons, not only to bosons.' },
  { k: 'tth', beam: 'pp', det: 'gp', name: 'Higgs made with top quarks (ttH)', n5: 3.6e4, xs: rs => xs('ttH', rs, 0.5), ref: 'ATLAS and CMS 2018, ~80 fb⁻¹', text: 'Measures directly how strongly the Higgs pulls on the top quark, the strongest coupling in nature.' },
  { k: 'hbb', beam: 'pp', det: 'gp', name: 'Higgs → b b̄', n5: 5e6, xs: rs => xs('H', rs, 0.3), ref: 'ATLAS and CMS 2018, ~80 fb⁻¹', text: 'The Higgs\' most common decay (58%), buried under huge backgrounds. Seen at last in 2018.' },
  { k: 'tttt', beam: 'pp', det: 'gp', name: 'Four top quarks at once', n5: 2000, xs: rs => xs('tttt', rs, 0.7), ref: 'ATLAS and CMS 2023, 140 fb⁻¹', text: 'One of the rarest processes ever seen: four top quarks in one collision.' },
  { k: 'hmm', beam: 'pp', det: 'gp', name: 'Higgs → μ μ', n5: 2.25e7, xs: rs => xs('H', rs, 0.3), ref: '3σ evidence by CMS 2020 with 139 fb⁻¹; 5σ expected at HL-LHC', text: 'Would show the Higgs gives mass to second-generation particles too.' },
  { k: 'hh', beam: 'pp', det: 'gp', name: 'Higgs pairs (Higgs self-coupling)', n5: 4.8e5, xs: rs => xs('HH', rs, 0.5), ref: 'HL-LHC projection: ~3.4σ with 3000 fb⁻¹ per experiment', text: 'Two Higgs bosons at once measure the shape of the Higgs potential, which decides the fate of the vacuum.' },
  { k: 'bsmm', beam: 'pp', det: 'bphys', unit: 'bb', gpWeight: 0.066, name: 'Bs → μ μ (a one-in-300-million decay)', n5: 648, xs: rs => xs('bb', rs, 0.2), ref: 'LHCb 2017, 4.4 fb⁻¹; CMS+LHCb 2015', text: 'A rare decay predicted precisely by the Standard Model; new particles would change its rate.' },
  { k: 'penta', beam: 'pp', det: 'bphys', unit: 'bb', name: 'Pentaquarks', n5: 272, xs: rs => xs('bb', rs, 0.2), ref: 'LHCb 2015, 3 fb⁻¹ at 7–8 TeV', text: 'Particles made of five quarks, predicted in 1964 and finally found in 2015.' },
  { k: 'tetra', beam: 'pp', det: 'bphys', unit: 'bb', gpWeight: 0.3, name: 'Tetraquark X(6900)', n5: 3700, xs: rs => xs('bb', rs, 0.2), ref: 'LHCb 2020, 9 fb⁻¹', text: 'Four charm quarks bound together, seen as a bump in pairs of J/ψ particles.' },
  // heavy ions (units: nb⁻¹ of Pb-Pb)
  { k: 'jetq', beam: 'ions', det: 'gp', unit: 'ion', name: 'Jet quenching in quark-gluon plasma', n5: 0.0017, ref: 'ATLAS and CMS 2010, 1.7 µb⁻¹', text: 'Jets lose energy crossing the drop of quark-gluon plasma, the state of the universe a microsecond after the Big Bang.' },
  { k: 'ups', beam: 'ions', det: 'gp', unit: 'ion', name: 'Υ melting in the plasma', n5: 0.15, ref: 'CMS 2011, 150 µb⁻¹', text: 'Bound bottom-quark states "melt" one after another in the hot plasma, like a thermometer.' },
  { k: 'lbyl', beam: 'ions', det: 'gp', unit: 'ion', name: 'Light scattering off light', n5: 0.7, ref: 'ATLAS 2017–2019, 0.5–2.2 nb⁻¹', text: 'Two photons bouncing off each other, forbidden in classical physics, allowed in quantum electrodynamics.' },
  { k: 'qgpflow', beam: 'ions', det: 'ions', unit: 'ion', name: 'Perfect-liquid flow of quark-gluon plasma', n5: 0.002, ref: 'ALICE 2010', text: 'The plasma flows with almost no viscosity: the most perfect liquid known.' },
  // electron-positron (√s in GeV)
  { k: 'zpole', beam: 'ee', det: 'ee', name: 'Z lineshape: exactly three neutrino families', n5: 2e4, xsGeV: sigmaZpole, ref: 'LEP 1989: ALEPH, DELPHI, L3, OPAL', text: 'The width of the Z peak counts how many light neutrinos exist: 2.984 ± 0.008. Three.' },
  { k: 'ww', beam: 'ee', det: 'ee', name: 'W pairs: the W mass at threshold', n5: 1e4, xsGeV: sigmaWW, ref: 'LEP2 1996–2000', text: 'W bosons made in pairs pin down their mass and test the gauge structure of the weak force.' },
  { k: 'zh', beam: 'ee', det: 'ee', name: 'Higgs via recoil (e⁺e⁻ → ZH)', n5: 100, xsGeV: sigmaZH, ref: 'Projection (FCC-ee, CEPC, ILC)', text: 'The Higgs is seen without looking at it: only the Z is measured and the Higgs appears as the missing mass.' },
  { k: 'tthr', beam: 'ee', det: 'ee', name: 'Top quark threshold scan', n5: 1000, xsGeV: sigmaTTee, ref: 'Projection (FCC-ee, ILC, CLIC)', text: 'Scanning the energy where top pairs switch on gives the top mass to about 20 MeV.' },
  { k: 'zhh', beam: 'ee', det: 'ee', name: 'e⁺e⁻ → ZHH (Higgs self-coupling)', n5: 600, xsGeV: sigmaZHH, ref: 'Projection (ILC-500, CLIC)', text: 'Needs a high-energy linear collider.' },
];
export const procByKey = Object.fromEntries(PROCESSES.map(p => [p.k, p]));
// Cross section of a process for a given collision energy (TeV): fb, or µb for bb, or 1 for ion processes
export function procXS(p, rsTeV) {
  if (p.xsGeV) return p.xsGeV(rsTeV * 1000);
  if (p.unit === 'ion') return 1;
  return p.xs(rsTeV);
}
// Significance from events: Z = 5 √(N / N5)
export const signif = (N, n5) => (N > 0 ? 5 * Math.sqrt(N / n5) : 0);

// How far a search for a new heavy particle (Z′-like) reaches with a given energy and data (TeV).
// Fits the LHC (13 TeV, 139 fb⁻¹ → ~5 TeV) and FCC-hh projections within ~25%.
export const searchReach = (rs, fb) => (fb < 1e-3 ? 0 : Math.max(0, 0.38 * rs * (0.22 * Math.log10(fb) + 0.55)));

// Quenches needed per sector to train dipoles up to a fraction f of their design field
// (LHC: ~8 per sector for 6.5 TeV, ~35 for 7 TeV)
export const trainingQuenches = (f, tech = 1) => (f <= 0.86 ? 0 : f > 1.08 ? Infinity : 2 * Math.exp((f - 0.86) / 0.05) * tech);
