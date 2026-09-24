// Hydrogen-like orbitals with Slater effective charges, sampled as probability clouds.
const L_LETTER = 'spdf';

export function parseConfig(config) {
  const out = [];
  for (const m of (config || '').matchAll(/(\d)([spdf])(\d+)/g)) out.push({ n: +m[1], l: L_LETTER.indexOf(m[2]), e: +m[3], name: m[1] + m[2] });
  return out;
}

// Slater's rules for the effective nuclear charge felt by an electron in subshell s.
export function slaterZeff(Z, subs, s) {
  const group = x => (x.l <= 1 ? `${x.n}sp` : `${x.n}${L_LETTER[x.l]}`);
  const order = x => (x.l <= 1 ? x.n * 10 : x.n * 10 + x.l * 2 + 1); // groups ordered (1s)(2sp)(3sp)(3d)(4sp)(4d)(4f)...
  const g = group(s);
  let S = 0;
  for (const o of subs) {
    const same = group(o) === g;
    const count = same ? o.e - (o === s ? 1 : 0) : o.e;
    if (!count) continue;
    if (same) { S += count * (s.n === 1 ? 0.3 : 0.35); continue; }
    if (order(o) > order(s)) continue; // outer electrons do not shield
    if (s.l >= 2) S += count; // d and f: everything inside shields fully
    else if (o.n === s.n - 1) S += count * 0.85;
    else if (o.n < s.n - 1) S += count;
    else S += count; // inner d/f of same n
  }
  return Math.max(1, Z - S);
}

// Real spherical harmonics (unnormalised shapes) for l = 0..3, given a unit vector.
const HARM = [
  [['s', () => 1]],
  [['p_x', (x) => x], ['p_y', (x, y) => y], ['p_z', (x, y, z) => z]],
  [['d_xy', (x, y) => x * y], ['d_yz', (x, y, z) => y * z], ['d_z²', (x, y, z) => 3 * z * z - 1], ['d_xz', (x, y, z) => x * z], ['d_x²−y²', (x, y) => x * x - y * y]],
  [['f_y(3x²−y²)', (x, y) => y * (3 * x * x - y * y)], ['f_xyz', (x, y, z) => x * y * z], ['f_yz²', (x, y, z) => y * (5 * z * z - 1)], ['f_z³', (x, y, z) => z * (5 * z * z - 3)],
    ['f_xz²', (x, y, z) => x * (5 * z * z - 1)], ['f_z(x²−y²)', (x, y, z) => z * (x * x - y * y)], ['f_x(x²−3y²)', (x, y) => x * (x * x - 3 * y * y)]],
];
// Fill order within a subshell for Hund's rule: m = 0 first for readability, then ±1, ±2...
const M_ORDER = [[0], [2, 0, 1], [2, 1, 3, 0, 4], [3, 2, 4, 1, 5, 0, 6]];

function laguerre(k, a, x) {
  if (k === 0) return 1;
  let L0 = 1, L1 = 1 + a - x;
  for (let i = 2; i <= k; i++) { const L2 = ((2 * i - 1 + a - x) * L1 - (i - 1 + a) * L0) / i; L0 = L1; L1 = L2; }
  return L1;
}
function radial(n, l, Z, r) { // hydrogenic R_nl (unnormalised), r in Bohr radii
  const rho = 2 * Z * r / n;
  return Math.pow(rho, l) * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
}

// Returns [{ name, n, l, e, zeff, rmean, orbitals: [{ label, occ, points: Float32Array(xyz), sign: Int8Array }] }]
export function sampleAtom(el, budget = 26000) {
  const subs = parseConfig(el.config);
  const total = subs.reduce((a, s) => a + s.e, 0) || 1;
  return subs.map(s => {
    const zeff = slaterZeff(el.n, subs, s);
    const rmax = (s.n * s.n * 3.2 + 6) / zeff;
    // radial CDF from r² R²
    const N = 800, cdf = new Float64Array(N + 1);
    let acc = 0, mean = 0;
    for (let i = 1; i <= N; i++) { const r = (i / N) * rmax, R = radial(s.n, s.l, zeff, r), p = r * r * R * R; acc += p; mean += p * r; cdf[i] = acc; }
    for (let i = 0; i <= N; i++) cdf[i] /= acc;
    const rmean = mean / acc;
    const sampleR = () => { const u = Math.random(); let lo = 0, hi = N; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid; else hi = mid; } return ((lo + Math.random()) / N) * rmax; };
    // occupancy per orbital (Hund)
    const nOrb = 2 * s.l + 1, occ = new Array(nOrb).fill(0);
    const ord = M_ORDER[s.l];
    for (let k = 0; k < s.e; k++) occ[ord[k % nOrb]]++;
    const pts = Math.max(900, Math.round((budget * s.e) / total));
    const orbitals = [];
    HARM[s.l].forEach(([label, f], m) => {
      if (!occ[m]) return;
      // max |Y|² by probing directions
      let mx = 0;
      for (let i = 0; i < 1500; i++) { const [x, y, z] = randDir(); const v = f(x, y, z); if (v * v > mx) mx = v * v; }
      const count = Math.round((pts * occ[m]) / s.e);
      const P = new Float32Array(count * 3), sign = new Int8Array(count);
      for (let i = 0; i < count; i++) {
        let x, y, z, v;
        do { [x, y, z] = randDir(); v = f(x, y, z); } while (Math.random() * mx > v * v);
        const r = sampleR();
        P[i * 3] = x * r; P[i * 3 + 1] = z * r; P[i * 3 + 2] = y * r; // z up
        sign[i] = Math.sign(v * radial(s.n, s.l, zeff, r)) || 1;
      }
      orbitals.push({ label: `${s.n}${label}`, occ: occ[m], points: P, sign });
    });
    return { name: s.name, n: s.n, l: s.l, e: s.e, zeff, rmean, orbitals };
  });
}
function randDir() {
  const z = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return [r * Math.cos(t), r * Math.sin(t), z];
}
export const L_COLORS = ['#6fc3ff', '#ff8a5c', '#6ee7a8', '#c79bff'];
