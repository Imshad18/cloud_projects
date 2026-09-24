// Event generator for the collider lab.
// Cross sections are interpolated from published values (LHC Higgs WG, ATLAS/CMS, Tevatron, PDG).
// Kinematics are simplified but conserve momentum in each decay; masses and widths are PDG values.

export const M = { e: 0.000511, mu: 0.10566, tau: 1.777, pi: 0.13957, K: 0.4937, p: 0.93827, W: 80.37, Z: 91.188, H: 125.1, t: 172.6, b: 4.18, jpsi: 3.0969, psi2s: 3.6861, ups1: 9.4603, ups2: 10.0233, ups3: 10.3552, phi: 1.0195, omega: 0.7827 };
const WIDTH = { Z: 2.495, W: 2.085, H: 0.0041, t: 1.42 };

// sqrt(s) grid in TeV and cross sections in pb (proton-proton).
const GRID = [0.2, 0.5, 1.0, 1.96, 7, 8, 13, 13.6, 14, 27, 57, 100];
const PP = {
  inel: [4.2e+10, 4.8e+10, 5.5e+10, 6.1e+10, 7.3e+10, 7.47e+10, 7.81e+10, 7.95e+10, 8e+10, 8.6e+10, 9.2e+10, 1.05e+11],
  dijet: [2000, 60000, 400000, 1.6e+06, 2.4e+07, 2.9e+07, 6.5e+07, 7e+07, 7.4e+07, 2e+08, 5.01e+08, 1e+09], // two jets, pT > 50 GeV
  W: [60, 500, 1300, 2650, 10300, 12200, 20500, 21600, 21900, 38000, 69700, 110000], // W → ℓν per lepton flavour
  Z: [5, 60, 130, 250, 970, 1130, 1950, 2050, 2100, 3800, 6970, 11000], // Z → ℓℓ per flavour
  WW: [0.05, 0.8, 3, 12, 45, 54, 118, 125, 128, 290, 712, 1400],
  ZZ: [0.01, 0.15, 0.6, 1.4, 6.5, 7.7, 17, 18, 18.6, 45, 114, 230],
  H: [0, 0.002, 0.2, 1.1, 17.4, 22.3, 55.1, 59.8, 62.6, 169, 425, 850],
  tt: [0, 0, 0.6, 7.1, 177, 253, 830, 924, 985, 4600, 14600, 34700],
  HH: [0, 0, 0, 0.0001, 0.007, 0.009, 0.031, 0.034, 0.037, 0.14, 0.477, 1.2],
  tttt: [0, 0, 0, 0, 0.0006, 0.001, 0.0225, 0.025, 0.027, 0.18, 0.897, 3],
  jpsi: [400, 1500, 3000, 6000, 20000, 22000, 32000, 33000, 34000, 50000, 78400, 110000], // J/ψ → μμ (all rapidity, × BR)
  ups: [20, 70, 150, 300, 1000, 1150, 1700, 1750, 1800, 2700, 4260, 6000], // Υ(1S+2S+3S) → μμ
  X3872: [0, 0, 5, 20, 150, 170, 280, 290, 300, 480, 848, 1300], // X(3872) → J/ψ ππ → μμππ
  Pc: [0, 0, 0.5, 2, 18, 20, 35, 36, 37, 60, 105, 160], // pentaquarks → J/ψ p (LHCb 2015/2019)
};
const lerpLog = (xs, ys, x) => {
  if (x <= xs[0]) return ys[0] * Math.pow(Math.max(x, 1e-6) / xs[0], 4);
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1] * Math.pow(x / xs[xs.length - 1], 0.35); // beyond 100 TeV: extrapolated
  let i = 0; while (xs[i + 1] < x) i++;
  const [a, b, ya, yb] = [xs[i], xs[i + 1], ys[i], ys[i + 1]];
  if (ya <= 0 || yb <= 0) return ya + (yb - ya) * (x - a) / (b - a);
  return Math.exp(Math.log(ya) + (Math.log(yb) - Math.log(ya)) * (Math.log(x) - Math.log(a)) / (Math.log(b) - Math.log(a)));
};
// Kinematic threshold suppression (partons carry only part of the proton's energy).
const thr = (sqrtS, mass, f = 2.5) => Math.max(0, Math.min(1, (sqrtS - f * mass) / (f * mass)));

// ---------- process catalogue ----------
// Each process: key, label, sigma(sqrtS GeV) in pb, trigger (recorded by a typical trigger), gen(sqrtS) → particle list.
export function processes(kind, sqrtS, A1 = 1, A2 = 1) {
  const T = sqrtS / 1000;
  if (kind === 'ee') return eeProcesses(sqrtS);
  // Above 100 TeV the inelastic cross section keeps rising like ln²(s) (the Froissart-type growth seen from ISR to cosmic rays).
  const inel = T <= 100 ? lerpLog(GRID, PP.inel, T) : PP.inel[PP.inel.length - 1] * Math.pow(Math.log(T * T * 1e6) / Math.log(1e10), 2);
  const pp = k => (k === 'inel' ? inel : lerpLog(GRID, PP[k], T));
  const nColl = kind === 'AA' ? Math.pow(A1 * A2, 1) * 0.3 : 1; // hard processes scale with binary collisions
  const L = [
    { key: 'minbias', label: 'Soft collision (minimum bias)', sigma: pp('inel') * (kind === 'AA' ? 7.7 * Math.pow(A1 * A2, 0.33) / 5 : 1), trigger: false, gen: () => [] },
    { key: 'dijet', label: 'Two jets (quarks/gluons, pT > 50 GeV)', sigma: pp('dijet') * nColl * thr(sqrtS, 50, 2), trigger: true, gen: s => dijet(s) },
    { key: 'jpsi', label: 'J/ψ → μ⁺μ⁻ (charm quarkonium)', sigma: pp('jpsi') * nColl, trigger: true, gen: () => twoBody(M.jpsi, 0.00009, M.mu, M.mu, 'mu', 'mu', 5) },
    { key: 'ups', label: 'Υ → μ⁺μ⁻ (bottom quarkonium)', sigma: pp('ups') * nColl, trigger: true, gen: () => twoBody(pickUps(), 0.00005, M.mu, M.mu, 'mu', 'mu', 8) },
    { key: 'W', label: 'W boson → μ ν', sigma: pp('W') * nColl * thr(sqrtS, M.W, 1.6), trigger: true, gen: () => twoBody(M.W, WIDTH.W, M.mu, 0, 'mu', 'nu', 10) },
    { key: 'Zmm', label: 'Z boson → μ⁺μ⁻', sigma: pp('Z') * nColl * thr(sqrtS, M.Z, 1.6), trigger: true, gen: () => twoBody(M.Z, WIDTH.Z, M.mu, M.mu, 'mu', 'mu', 10) },
    { key: 'Zee', label: 'Z boson → e⁺e⁻', sigma: pp('Z') * nColl * thr(sqrtS, M.Z, 1.6), trigger: true, gen: () => twoBody(M.Z, WIDTH.Z, M.e, M.e, 'e', 'e', 10) },
    { key: 'WW', label: 'W⁺W⁻ pair → e μ ν ν', sigma: pp('WW') * 0.023 * nColl * thr(sqrtS, 2 * M.W, 1.5), trigger: true, gen: () => [...twoBody(M.W, WIDTH.W, M.e, 0, 'e', 'nu', 25), ...twoBody(M.W, WIDTH.W, M.mu, 0, 'mu', 'nu', 25)] },
    { key: 'tt', label: 'Top quark pair → ℓ + jets', sigma: pp('tt') * 0.29 * nColl * thr(sqrtS, 2 * M.t, 1.3), trigger: true, gen: () => ttbar() },
    { key: 'Hgg', label: 'Higgs boson → γγ', sigma: pp('H') * 0.00227 * nColl * thr(sqrtS, M.H, 1.5), trigger: true, gen: () => twoBody(M.H, WIDTH.H, 0, 0, 'gamma', 'gamma', 20) },
    { key: 'H4l', label: 'Higgs boson → ZZ* → 4 leptons', sigma: pp('H') * 0.000125 * nColl * thr(sqrtS, M.H, 1.5), trigger: true, gen: () => h4l() },
    { key: 'Hbb', label: 'Higgs boson → b b̄ (with a W)', sigma: pp('H') * 0.58 * 0.025 * nColl * thr(sqrtS, M.H + M.W, 1.5), trigger: true, gen: () => [...twoBody(M.H, WIDTH.H, M.b, M.b, 'bjet', 'bjet', 60), ...twoBody(M.W, WIDTH.W, M.mu, 0, 'mu', 'nu', 60)] },
    { key: 'ZZ', label: 'Z Z pair → 4 leptons', sigma: pp('ZZ') * 0.0045 * 4 * nColl * thr(sqrtS, 2 * M.Z, 1.5), trigger: true, gen: () => [...twoBody(M.Z, WIDTH.Z, M.mu, M.mu, 'mu', 'mu', 20), ...twoBody(M.Z, WIDTH.Z, M.e, M.e, 'e', 'e', 20)] },
    { key: 'HH', label: 'Higgs pair → b b̄ γγ (not yet observed)', sigma: pp('HH') * 0.0026 * nColl * thr(sqrtS, 2 * M.H, 1.5), trigger: true, gen: () => [...twoBody(M.H, WIDTH.H, M.b, M.b, 'bjet', 'bjet', 40), ...twoBody(M.H, WIDTH.H, 0, 0, 'gamma', 'gamma', 40)] },
    { key: 'tttt', label: 'Four top quarks (observed 2023)', sigma: pp('tttt') * nColl * thr(sqrtS, 4 * M.t, 1.2), trigger: true, gen: () => [...ttbar(), ...ttbar()] },
    { key: 'X3872', label: 'X(3872) tetraquark → J/ψ π⁺π⁻', sigma: pp('X3872') * 0.04 * nColl, trigger: true, gen: () => x3872() },
    { key: 'Pc', label: 'Pc(4312) pentaquark → J/ψ p', sigma: pp('Pc') * 0.06 * nColl, trigger: true, gen: () => pentaquark() },
  ];
  if (kind === 'ppbar') for (const p of L) if (['W', 'Zmm', 'Zee', 'tt'].includes(p.key)) p.sigma *= T < 3 ? 1.3 : 1; // valence antiquarks help at low energy
  return L.filter(p => p.sigma > 0);
}

function eeProcesses(sqrtS) {
  const s = sqrtS * sqrtS;
  const qed = 86800 / s; // σ(ee→μμ) in pb, QED
  const bw = (m, g, peak) => peak * (s * g * g) / ((s - m * m) ** 2 + (m * m * g * g)) * (m * m) / s;
  const zmm = sqrtS > 20 ? bw(M.Z, WIDTH.Z, 1990) : 0; // Z → μμ peak ~2 nb
  const zhad = sqrtS > 20 ? bw(M.Z, WIDTH.Z, 41500) : 0;
  const R = sqrtS < 3 ? 2 : sqrtS < 10 ? 3.3 : 3.7;
  const list = [
    { key: 'ee_mm', label: 'e⁺e⁻ → μ⁺μ⁻', sigma: (sqrtS > 2 * M.mu ? qed : 0) + zmm, trigger: true, gen: () => backToBack(sqrtS, 'mu', 'mu', M.mu) },
    { key: 'ee_had', label: 'e⁺e⁻ → quark jets (hadrons)', sigma: (sqrtS > 0.3 ? R * qed : 0) + zhad, trigger: true, gen: () => eeJets(sqrtS) },
    { key: 'ee_tt', label: 'e⁺e⁻ → τ⁺τ⁻', sigma: sqrtS > 2 * M.tau ? qed + zmm : 0, trigger: true, gen: () => backToBack(sqrtS, 'tau', 'tau', M.tau) },
    { key: 'ee_gg', label: 'e⁺e⁻ → γγ', sigma: 2 * qed * Math.log(Math.max(2, s / (M.e * M.e))) / 10, trigger: true, gen: () => backToBack(sqrtS, 'gamma', 'gamma', 0) },
    { key: 'ee_jpsi', label: 'J/ψ resonance', sigma: Math.abs(sqrtS - M.jpsi) < 0.01 ? 3e6 : 0, trigger: true, gen: () => backToBack(sqrtS, 'mu', 'mu', M.mu) },
    { key: 'ee_ups', label: 'Υ(1S) resonance', sigma: Math.abs(sqrtS - M.ups1) < 0.03 ? 2e4 : 0, trigger: true, gen: () => eeJets(sqrtS) },
    { key: 'ee_WW', label: 'W⁺W⁻ pair', sigma: sqrtS > 2 * M.W ? 17 * Math.sqrt(1 - (2 * M.W / sqrtS) ** 2) * Math.min(1, 200 / sqrtS) : 0, trigger: true, gen: () => { const [a, b] = pair(sqrtS, M.W, M.W); return [...decay(a, 0, 0, 'jet', 'jet'), ...decay(b, M.mu, 0, 'mu', 'nu')]; } },
    { key: 'ee_ZH', label: 'Z + Higgs boson (Higgs factory)', sigma: sqrtS > M.Z + M.H ? 0.24 * Math.sqrt(1 - ((M.Z + M.H) / sqrtS) ** 2) * (250 / sqrtS) ** 2 : 0, trigger: true, gen: () => { const [a, b] = pair(sqrtS, M.Z, M.H); return [...decay(a, M.mu, M.mu, 'mu', 'mu'), ...decay(b, M.b, M.b, 'bjet', 'bjet')]; } },
    { key: 'ee_top', label: 'Top quark pair', sigma: sqrtS > 2 * M.t ? 0.55 * Math.sqrt(1 - (2 * M.t / sqrtS) ** 2) : 0, trigger: true, gen: () => ttbar() },
  ];
  return list.filter(p => p.sigma > 0);
}

// ---------- kinematics helpers ----------
const rnd = Math.random;
function gauss() { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function breitWigner(m, g) { return g < 0.01 ? m : m + (g / 2) * Math.tan(Math.PI * (rnd() - 0.5)) * 0.7; }
function pickUps() { const r = rnd(); return r < 0.7 ? M.ups1 : r < 0.9 ? M.ups2 : M.ups3; }
function isoDir() { const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), r = Math.sqrt(1 - z * z); return [r * Math.cos(t), r * Math.sin(t), z]; }
// Boost 4-vector (E,px,py,pz) by velocity b = [bx,by,bz]
function boost(p, b) {
  const b2 = b[0] ** 2 + b[1] ** 2 + b[2] ** 2; if (b2 < 1e-12) return p;
  const g = 1 / Math.sqrt(1 - b2), bp = b[0] * p[1] + b[1] * p[2] + b[2] * p[3], g2 = (g - 1) / b2;
  return [g * (p[0] + bp), p[1] + g2 * bp * b[0] + g * b[0] * p[0], p[2] + g2 * bp * b[1] + g * b[1] * p[0], p[3] + g2 * bp * b[2] + g * b[2] * p[0]];
}
// Two particles of masses mA, mB produced back to back from a collision at rest.
function pair(sqrtS, mA, mB) {
  const pp = Math.sqrt(Math.max(0, (sqrtS * sqrtS - (mA + mB) ** 2) * (sqrtS * sqrtS - (mA - mB) ** 2))) / (2 * sqrtS), d = isoDir();
  return [[Math.hypot(mA, pp), d[0] * pp, d[1] * pp, d[2] * pp], [Math.hypot(mB, pp), -d[0] * pp, -d[1] * pp, -d[2] * pp]];
}
// Isotropic two-body decay of a 4-vector P into masses m1, m2.
function decay(P, m1, m2, t1, t2) {
  const M0 = Math.sqrt(Math.max(1e-6, P[0] ** 2 - P[1] ** 2 - P[2] ** 2 - P[3] ** 2)), b = [P[1] / P[0], P[2] / P[0], P[3] / P[0]];
  const pst = Math.sqrt(Math.max(0, (M0 * M0 - (m1 + m2) ** 2) * (M0 * M0 - (m1 - m2) ** 2))) / (2 * M0), d = isoDir();
  const a = boost([Math.hypot(m1, pst), d[0] * pst, d[1] * pst, d[2] * pst], b), c = boost([Math.hypot(m2, pst), -d[0] * pst, -d[1] * pst, -d[2] * pst], b);
  return [t1 === 'jet' || t1 === 'bjet' ? jetObj(a[0], norm(a), t1) : obj(t1, a, m1, 1), t2 === 'jet' || t2 === 'bjet' ? jetObj(c[0], norm(c), t2) : obj(t2, c, m2, -1)];
}
// Resonance of mass M (width g) produced with pT and rapidity, decaying to two particles.
export function twoBody(Mc, g, m1, m2, t1, t2, meanPt = 10, pzFix = null) {
  const mass = Math.max(m1 + m2 + 0.01, breitWigner(Mc, g));
  const pt = -Math.log(1 - rnd() * 0.999) * meanPt, phi = 2 * Math.PI * rnd();
  const y = pzFix == null ? gauss() * 1.2 : 0;
  const mT = Math.sqrt(mass * mass + pt * pt);
  const P = [mT * Math.cosh(y), pt * Math.cos(phi), pt * Math.sin(phi), pzFix == null ? mT * Math.sinh(y) : pzFix * 0];
  if (pzFix != null) { P[1] = 0; P[2] = 0; const dir = isoDir(); const pp = Math.abs(pzFix) * 0.6; P[1] = dir[0] * pp; P[2] = dir[1] * pp; P[3] = dir[2] * pp; P[0] = Math.sqrt(mass * mass + pp * pp); }
  const b = [P[1] / P[0], P[2] / P[0], P[3] / P[0]];
  const pstar = Math.sqrt(Math.max(0, (mass * mass - (m1 + m2) ** 2) * (mass * mass - (m1 - m2) ** 2))) / (2 * mass);
  const d = isoDir();
  const a = [Math.sqrt(m1 * m1 + pstar * pstar), d[0] * pstar, d[1] * pstar, d[2] * pstar];
  const c = [Math.sqrt(m2 * m2 + pstar * pstar), -d[0] * pstar, -d[1] * pstar, -d[2] * pstar];
  return [obj(t1, boost(a, b), m1, 1), obj(t2, boost(c, b), m2, -1)];
}
function obj(type, p, m, sign) {
  const q = type === 'mu' || type === 'e' || type === 'tau' ? sign : type === 'trk' ? sign : 0;
  return { type, E: p[0], px: p[1], py: p[2], pz: p[3], m, q };
}
function backToBack(sqrtS, t1, t2, m) {
  const d = isoDir(), pp = Math.sqrt(Math.max(0, (sqrtS / 2) ** 2 - m * m));
  return [obj(t1, [sqrtS / 2, d[0] * pp, d[1] * pp, d[2] * pp], m, 1), obj(t2, [sqrtS / 2, -d[0] * pp, -d[1] * pp, -d[2] * pp], m, -1)];
}
function jetObj(E, dir, type = 'jet') { return { type, E, px: dir[0] * E, py: dir[1] * E, pz: dir[2] * E, m: 0, q: 0 }; }
function dijet(sqrtS) {
  const pt = Math.min(sqrtS / 2.2, 50 * Math.pow(1 - rnd() * 0.999, -1 / 3.5));
  const phi = 2 * Math.PI * rnd(), y1 = gauss() * 1.3, y2 = gauss() * 1.3;
  return [{ type: 'jet', E: pt * Math.cosh(y1), px: pt * Math.cos(phi), py: pt * Math.sin(phi), pz: pt * Math.sinh(y1), m: 0, q: 0 },
    { type: 'jet', E: pt * Math.cosh(y2), px: -pt * Math.cos(phi), py: -pt * Math.sin(phi), pz: pt * Math.sinh(y2), m: 0, q: 0 }];
}
function eeJets(sqrtS) {
  const d = isoDir(), E = sqrtS / 2;
  if (rnd() < 0.12 && sqrtS > 10) { // three-jet event: a radiated gluon (discovered at PETRA, 1979)
    const a = 2 * Math.PI / 3;
    const u = [-d[1], d[0], 0], n = Math.hypot(...u) || 1; u[0] /= n; u[1] /= n;
    const dirs = [0, 1, 2].map(k => [d[0] * Math.cos(k * a) + u[0] * Math.sin(k * a), d[1] * Math.cos(k * a) + u[1] * Math.sin(k * a), d[2] * Math.cos(k * a)]);
    return dirs.map(v => jetObj(sqrtS / 3, v));
  }
  return [jetObj(E, d), jetObj(E, [-d[0], -d[1], -d[2]])];
}
function ttbar() {
  const out = [];
  for (const s of [1, -1]) {
    const [W, b] = twoBody(M.t, WIDTH.t, M.W, M.b, 'W', 'bjet', 60);
    out.push(b);
    const bW = [W.px / W.E, W.py / W.E, W.pz / W.E];
    const pst = M.W / 2, d = isoDir();
    const l1 = boost([pst, d[0] * pst, d[1] * pst, d[2] * pst], bW), l2 = boost([pst, -d[0] * pst, -d[1] * pst, -d[2] * pst], bW);
    if (s > 0) { out.push(obj('mu', l1, M.mu, 1), obj('nu', l2, 0, 0)); }
    else { out.push(jetObj(l1[0], norm(l1)), jetObj(l2[0], norm(l2))); }
  }
  return out;
}
function norm(p) { const n = Math.hypot(p[1], p[2], p[3]) || 1; return [p[1] / n, p[2] / n, p[3] / n]; }
function h4l() {
  const mH = breitWigner(M.H, WIDTH.H);
  const m2 = 12 + rnd() * 20, m1 = Math.min(M.Z + gauss() * 2, mH - m2 - 1);
  const [Z1, Z2] = twoBody(mH, 0, m1, m2, 'Z', 'Z', 20);
  const out = [];
  for (const [Z, t] of [[Z1, rnd() < 0.5 ? 'mu' : 'e'], [Z2, rnd() < 0.5 ? 'mu' : 'e']]) {
    const bZ = [Z.px / Z.E, Z.py / Z.E, Z.pz / Z.E], pst = Z.m / 2, d = isoDir();
    out.push(obj(t, boost([pst, d[0] * pst, d[1] * pst, d[2] * pst], bZ), 0, 1), obj(t, boost([pst, -d[0] * pst, -d[1] * pst, -d[2] * pst], bZ), 0, -1));
  }
  return out;
}
function x3872() {
  const [J, rho] = twoBody(3.8717, 0.001, M.jpsi, 0.5, 'J', 'rho', 12);
  const decay = (P, m1, m2, t, s) => { const b = [P.px / P.E, P.py / P.E, P.pz / P.E], M0 = Math.sqrt(Math.max(0.01, P.E ** 2 - P.px ** 2 - P.py ** 2 - P.pz ** 2)), pst = Math.sqrt(Math.max(0, (M0 * M0 - (m1 + m2) ** 2) * (M0 * M0 - (m1 - m2) ** 2))) / (2 * M0), d = isoDir(); return [obj(t, boost([Math.hypot(m1, pst), d[0] * pst, d[1] * pst, d[2] * pst], b), m1, s), obj(t, boost([Math.hypot(m2, pst), -d[0] * pst, -d[1] * pst, -d[2] * pst], b), m2, -s)]; };
  return [...decay(J, M.mu, M.mu, 'mu', 1), ...decay(rho, M.pi, M.pi, 'trk', 1)];
}
function pentaquark() {
  const [J, p] = twoBody(4.3119, 0.0098, M.jpsi, M.p, 'J', 'trk', 12);
  const b = [J.px / J.E, J.py / J.E, J.pz / J.E], pst = M.jpsi / 2, d = isoDir();
  p.q = 1; p.name = 'p';
  return [obj('mu', boost([pst, d[0] * pst, d[1] * pst, d[2] * pst], b), M.mu, 1), obj('mu', boost([pst, -d[0] * pst, -d[1] * pst, -d[2] * pst], b), M.mu, -1), p];
}

// Soft particles: the underlying event or a whole minimum-bias collision.
// Charged particles inside the tracker (|η| < 2.5) for one pp collision, from measured dN/dη
// (ALICE/CMS: 3.5 at 0.9 TeV, 5.9 at 7 TeV, 6.46 at 13 TeV) ≈ 0.98 s^0.1 per unit of η.
export function dNdEta(sqrtS) { return Math.max(0.8, 0.98 * Math.pow(sqrtS * sqrtS, 0.1)); }
export function chargedMult(sqrtS) { return Math.max(2, 5 * dNdEta(sqrtS)); }
// Central heavy-ion collisions (ALICE Pb-Pb 5.02 TeV: dN/dη = 1943; 2.76 TeV: 1601; RHIC Au-Au 200 GeV: 687).
export function dNdEtaAA(sqrtSNN, A1, A2) { const npart = 0.92 * (A1 + A2); return (npart / 2) * 10.1 * Math.pow(sqrtSNN / 5020, 0.31); }
export function softTracks(n, T = 0.45) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const pt = tsallis(T), phi = 2 * Math.PI * rnd(), eta = (rnd() * 2 - 1) * 2.5;
    const r = rnd(), m = r < 0.8 ? M.pi : r < 0.93 ? M.K : M.p;
    const pz = pt * Math.sinh(eta);
    out.push({ type: rnd() < 0.62 ? 'trk' : rnd() < 0.7 ? 'gamma' : 'nh', q: rnd() < 0.5 ? 1 : -1, px: pt * Math.cos(phi), py: pt * Math.sin(phi), pz, E: Math.sqrt(pt * pt + pz * pz + m * m), m, soft: true, name: m === M.pi ? 'π' : m === M.K ? 'K' : 'p' });
  }
  return out;
}
function tsallis(T) { // pT from a Tsallis-like spectrum: exponential core, power-law tail
  const u = rnd();
  if (u < 0.97) return -Math.log(1 - rnd() * 0.9999) * T * 0.9 + 0.05;
  return T * 3 * Math.pow(1 - rnd() * 0.999, -1 / 4);
}

// Invariant mass of a set of particles
export function invMass(list) {
  let E = 0, x = 0, y = 0, z = 0;
  for (const p of list) { E += p.E; x += p.px; y += p.py; z += p.pz; }
  return Math.sqrt(Math.max(0, E * E - x * x - y * y - z * z));
}
export const pT = p => Math.hypot(p.px, p.py);
export const eta = p => { const pp = Math.hypot(p.px, p.py, p.pz); return 0.5 * Math.log((pp + p.pz + 1e-9) / (pp - p.pz + 1e-9)); };

// ---------- Background and signal shapes for the physics plots (events per fb⁻¹ per GeV at 13 TeV) ----------
export const SHAPES = {
  diphoton: { lo: 100, hi: 160, bin: 1, bkg: m => 52 * Math.exp(-(m - 100) / 31), sig: { m: 125.1, s: 1.7, n: 50 }, scale: 'H', bkgScale: 'dijet' },
  fourl: { lo: 70, hi: 250, bin: 3, bkg: m => 0.004 + 0.8 * gaussPdf(m, 91.2, 2.6) * 0.9 + (m > 180 ? 0.07 * Math.exp(-(m - 185) / 90) * Math.min(1, (m - 180) / 8) : 0.0035 * (m > 100 ? 1 : 0)), sig: { m: 125.1, s: 1.6, n: 0.45 }, scale: 'H', bkgScale: 'Z' },
  dimuon: { lo: 0.4, hi: 150, log: true, bins: 180, bkg: m => 9e5 * Math.pow(m, -3.2) * (m < 1 ? m : 1), peaks: [[M.omega, 0.012, 1.4e5], [M.phi, 0.012, 1.8e5], [M.jpsi, 0.03, 3.2e6], [M.psi2s, 0.035, 1.1e5], [M.ups1, 0.09, 4.2e5], [M.ups2, 0.09, 1.3e5], [M.ups3, 0.09, 7e4], [M.Z, 2.2, 5.2e5]], scale: 'Z' },
};
function gaussPdf(x, m, s) { return Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)); }
export function shapeScale(key, sqrtS) { // relative to 13 TeV
  if (!key) return 1;
  const T = sqrtS / 1000, base = lerpLog(GRID, PP[key], 13);
  const massFor = { H: M.H, Z: M.Z, dijet: 50 };
  return base > 0 ? lerpLog(GRID, PP[key], T) / base * thr(sqrtS, massFor[key] || 1, 1.5) : 0;
}
export function expectedHist(name, lumiFb, sqrtS) {
  const S = SHAPES[name];
  const sS = shapeScale(S.scale, sqrtS), bS = shapeScale(S.bkgScale || S.scale, sqrtS);
  const edges = [];
  if (S.log) { const n = S.bins; for (let i = 0; i <= n; i++) edges.push(S.lo * Math.pow(S.hi / S.lo, i / n)); }
  else for (let m = S.lo; m <= S.hi + 1e-9; m += S.bin) edges.push(m);
  const bkg = [], sig = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i], b = edges[i + 1], c = (a + b) / 2, w = b - a;
    let B = S.bkg(c) * w * lumiFb * (S.log ? sS : bS);
    let Sg = 0;
    if (S.sig) Sg = S.sig.n * lumiFb * sS * (cdf((b - S.sig.m) / S.sig.s) - cdf((a - S.sig.m) / S.sig.s));
    if (S.peaks) for (const [m, s, n] of S.peaks) B += n * lumiFb * sS * (cdf((b - m) / s) - cdf((a - m) / s));
    bkg.push(B); sig.push(Sg);
  }
  return { edges, bkg, sig, log: !!S.log };
}
function cdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
export function poisson(mu) {
  if (mu <= 0) return 0;
  if (mu > 40) return Math.max(0, Math.round(mu + Math.sqrt(mu) * gauss()));
  const L = Math.exp(-mu); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}
export { gauss };
