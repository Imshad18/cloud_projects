import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { h, fmt, sci, clamp, easeInOut, cssVar } from '../util.js';
import { bySym, CATEGORIES } from '../store.js';
import { SOURCES, SOURCE_ORDER } from '../data/origins.js';
import { workspace, group } from './ui.js';

// Mass fraction (%), where it lives, and what it does. Values: typical 70 kg adult.
const BODY = [
  ['O', 65, { soft: 0.93, blood: 0.05, brain: 0.02 }, 'Mostly in water, which is two thirds of you, and in every organic molecule.'],
  ['C', 18.5, { soft: 0.9, brain: 0.05, blood: 0.05 }, 'The backbone of proteins, fats, sugars and DNA. Fat tissue is especially rich in it.'],
  ['H', 9.5, { soft: 0.93, blood: 0.05, brain: 0.02 }, 'In water and all organic molecules. By number of atoms it is 62% of you.'],
  ['N', 3.2, { soft: 0.85, brain: 0.1, blood: 0.05 }, 'In every protein and in DNA. Muscles hold most of it.'],
  ['Ca', 1.5, { bone: 0.99, blood: 0.01 }, '99% is in bones and teeth as calcium phosphate. The rest controls muscle contraction and nerve signals.'],
  ['P', 1.0, { bone: 0.85, soft: 0.14, brain: 0.01 }, '85% in bones and teeth. The rest is in DNA, cell membranes and ATP, the energy currency of cells.'],
  ['K', 0.35, { soft: 0.9, brain: 0.05, blood: 0.05 }, 'Inside cells, mostly muscle. It sets the voltage that makes nerves fire. Some of it is radioactive K-40: about 4,000 decays per second in you.'],
  ['S', 0.25, { skin: 0.5, soft: 0.5 }, 'In the amino acids of keratin: hair, nails and skin.'],
  ['Na', 0.15, { blood: 0.5, soft: 0.4, bone: 0.1 }, 'In blood plasma and the fluid around cells. Nerve impulses are sodium rushing into cells.'],
  ['Cl', 0.15, { blood: 0.5, soft: 0.5 }, 'Partner of sodium in body fluids, and in stomach acid (HCl).'],
  ['Mg', 0.05, { bone: 0.6, soft: 0.4 }, 'About 60% in bone; the rest helps hundreds of enzymes and muscle relaxation.'],
  ['Fe', 0.006, { blood: 0.7, liver: 0.3 }, 'About 4 grams. 70% in hemoglobin, carrying oxygen in red blood cells; the rest stored in the liver.'],
  ['F', 0.0037, { bone: 1 }, 'Hardens tooth enamel and bone.'],
  ['Zn', 0.0032, { soft: 0.85, bone: 0.15 }, 'In muscles, bones and hundreds of enzymes, and in the eyes.'],
  ['Si', 0.002, { skin: 0.6, bone: 0.4 }, 'In connective tissue, hair and bone.'],
  ['Cu', 0.0001, { liver: 0.6, brain: 0.4 }, 'About 70 milligrams, in the liver and brain. Needed to make red blood cells.'],
  ['I', 0.00002, { thyroid: 1 }, 'About 15 milligrams, almost all in the thyroid gland, where it becomes thyroid hormone.'],
  ['Se', 0.00002, { soft: 0.6, liver: 0.4 }, 'In antioxidant enzymes.'],
  ['Mn', 0.00002, { bone: 0.5, liver: 0.5 }, 'In bones and liver enzymes.'],
  ['Mo', 0.00001, { liver: 1 }, 'In liver enzymes that process sulfur.'],
  ['Co', 0.000002, { liver: 1 }, 'At the heart of vitamin B12.'],
  ['Cr', 0.000002, { blood: 1 }, 'Traces help insulin work.'],
];
const REGION_COLORS = { soft: '#e28c7a', skin: '#f0c7a0', bone: '#eeeadf', blood: '#e0303a', brain: '#f2a6c4', lungs: '#f7b0b8', heart: '#c8102e', liver: '#9c3b2a', gut: '#e7a86c', kidneys: '#b0484a', thyroid: '#ff9f40' };
const REGION_NAMES = { soft: 'muscle & fat', skin: 'skin', bone: 'bone & marrow', blood: 'blood', brain: 'brain', lungs: 'lungs', heart: 'heart', liver: 'liver', gut: 'stomach & gut', kidneys: 'kidneys', thyroid: 'thyroid' };
// Where each element sits: region weights (typical 70 kg adult)
const W = {
  O: { soft: 0.78, blood: 0.05, brain: 0.02, lungs: 0.04, liver: 0.03, gut: 0.04, heart: 0.02, kidneys: 0.02 },
  C: { soft: 0.8, brain: 0.05, blood: 0.05, liver: 0.03, gut: 0.04, heart: 0.02, lungs: 0.01 },
  N: { soft: 0.78, brain: 0.08, blood: 0.05, liver: 0.03, heart: 0.03, gut: 0.03 },
  P: { bone: 0.85, soft: 0.12, brain: 0.02, liver: 0.01 },
  K: { soft: 0.82, brain: 0.05, blood: 0.04, heart: 0.03, liver: 0.03, kidneys: 0.03 },
  Na: { blood: 0.45, soft: 0.35, bone: 0.1, kidneys: 0.1 },
  Cl: { blood: 0.45, soft: 0.4, gut: 0.15 },
  Fe: { blood: 0.65, liver: 0.25, soft: 0.1 },
  Zn: { soft: 0.8, bone: 0.15, liver: 0.05 },
  Se: { soft: 0.5, liver: 0.3, kidneys: 0.2 },
  Mo: { liver: 0.7, kidneys: 0.3 },
};
W.H = W.O;
for (const b of BODY) if (W[b[0]]) b[2] = W[b[0]];

// Body shape. 'e' = ellipsoid [cx,cy,cz, rx,ry,rz]; 'c' = capsule [ax,ay,az, bx,by,bz, r] (flattened front-to-back)
const E = (cx, cy, cz, rx, ry, rz) => ({ t: 'e', c: [cx, cy, cz], r: [rx, ry, rz] });
const C = (ax, ay, az, bx, by, bz, r, fz = 0.85) => ({ t: 'c', a: [ax, ay, az], b: [bx, by, bz], r, fz });
const mirror = f => [f(1), f(-1)];
const PARTS = [
  E(0, 1.625, 0.005, 0.078, 0.105, 0.097), // cranium
  E(0, 1.55, 0.03, 0.058, 0.05, 0.062), // jaw
  C(0, 1.44, -0.01, 0, 1.53, 0, 0.047, 1), // neck
  E(0, 1.285, 0, 0.165, 0.17, 0.105), // chest
  E(0, 1.08, 0.012, 0.14, 0.15, 0.095), // abdomen
  E(0, 0.93, -0.005, 0.165, 0.1, 0.105), // hips
  ...mirror(s => E(s * 0.185, 1.39, -0.005, 0.062, 0.058, 0.06)), // shoulders
  ...mirror(s => C(s * 0.2, 1.37, 0, s * 0.235, 1.1, -0.01, 0.042)), // upper arms
  ...mirror(s => C(s * 0.235, 1.08, -0.01, s * 0.255, 0.84, 0.03, 0.033)), // forearms
  ...mirror(s => E(s * 0.262, 0.765, 0.04, 0.022, 0.068, 0.038)), // hands
  ...mirror(s => E(s * 0.09, 0.8, 0, 0.082, 0.14, 0.082)), // upper thighs
  ...mirror(s => C(s * 0.09, 0.84, 0, s * 0.095, 0.5, 0.005, 0.064, 1)), // thighs
  ...mirror(s => C(s * 0.095, 0.48, 0.005, s * 0.095, 0.08, -0.01, 0.045, 1)), // shins
  ...mirror(s => E(s * 0.095, 0.36, -0.02, 0.05, 0.1, 0.055)), // calves
  ...mirror(s => E(s * 0.095, 0.035, 0.04, 0.038, 0.03, 0.11)), // feet
];
const ORGANS = {
  brain: [E(0, 1.635, -0.005, 0.064, 0.072, 0.084)],
  lungs: mirror(s => E(s * 0.075, 1.31, -0.005, 0.064, 0.12, 0.074)),
  heart: [E(0.025, 1.24, 0.035, 0.045, 0.055, 0.04)],
  liver: [E(-0.06, 1.135, 0.03, 0.095, 0.05, 0.065)],
  gut: [E(0.06, 1.13, 0.045, 0.05, 0.045, 0.035), E(0, 1.0, 0.03, 0.11, 0.075, 0.06)],
  kidneys: mirror(s => E(s * 0.06, 1.06, -0.05, 0.024, 0.042, 0.02)),
  thyroid: [E(0, 1.465, 0.035, 0.022, 0.012, 0.01)],
};
const BONES = [
  C(0, 0.97, -0.065, 0, 1.53, -0.045, 0.017, 1), // spine
  C(0, 1.2, 0.093, 0, 1.38, 0.1, 0.012, 1), // sternum
  ...mirror(s => C(s * 0.02, 1.43, 0.065, s * 0.17, 1.445, 0, 0.009, 1)), // collarbones
  ...mirror(s => E(s * 0.1, 1.33, -0.092, 0.05, 0.07, 0.008)), // shoulder blades
  ...mirror(s => E(s * 0.085, 0.975, -0.015, 0.06, 0.055, 0.03)), // hip bones
  ...mirror(s => C(s * 0.2, 1.37, 0, s * 0.235, 1.1, -0.01, 0.013, 1)), // humerus
  ...mirror(s => C(s * 0.227, 1.08, -0.018, s * 0.247, 0.85, 0.022, 0.007, 1)), // ulna
  ...mirror(s => C(s * 0.243, 1.08, -0.002, s * 0.263, 0.85, 0.038, 0.007, 1)), // radius
  ...mirror(s => E(s * 0.262, 0.765, 0.04, 0.012, 0.055, 0.028)), // hand bones
  ...mirror(s => C(s * 0.085, 0.89, 0, s * 0.095, 0.5, 0.005, 0.016, 1)), // femur
  ...mirror(s => E(s * 0.095, 0.49, 0.045, 0.02, 0.022, 0.01)), // kneecap
  ...mirror(s => C(s * 0.095, 0.47, 0.01, s * 0.095, 0.07, -0.005, 0.013, 1)), // tibia
  ...mirror(s => C(s * 0.115, 0.46, -0.012, s * 0.112, 0.07, -0.02, 0.006, 1)), // fibula
  ...mirror(s => E(s * 0.095, 0.03, 0.035, 0.025, 0.018, 0.09)), // foot bones
];
const VESSELS = [
  C(0.02, 1.24, 0, 0, 1.37, -0.02, 0.012, 1), C(0, 1.35, -0.035, 0, 0.95, -0.035, 0.011, 1), // aorta
  C(-0.02, 1.25, 0, -0.02, 0.96, -0.02, 0.01, 1), // vena cava
  ...mirror(s => C(s * 0.025, 1.36, 0, s * 0.03, 1.58, 0.025, 0.006, 1)), // carotids
  ...mirror(s => C(s * 0.02, 1.37, 0, s * 0.2, 1.37, 0.01, 0.006, 1)),
  ...mirror(s => C(s * 0.205, 1.36, 0.012, s * 0.24, 1.1, 0.005, 0.005, 1)),
  ...mirror(s => C(s * 0.24, 1.08, 0.005, s * 0.26, 0.84, 0.045, 0.005, 1)),
  ...mirror(s => C(0, 0.95, -0.03, s * 0.08, 0.88, 0.02, 0.008, 1)), // iliac
  ...mirror(s => C(s * 0.08, 0.88, 0.022, s * 0.095, 0.5, 0.025, 0.007, 1)), // femoral
  ...mirror(s => C(s * 0.095, 0.48, -0.02, s * 0.1, 0.08, -0.03, 0.006, 1)),
];
const rnd = Math.random;
function inBall() { for (;;) { const x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1; if (x * x + y * y + z * z <= 1) return [x, y, z]; } }
function onSphere() { const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u); return [s * Math.cos(t), u, s * Math.sin(t)]; }
function inPart(p) {
  const [x, y, z] = inBall();
  if (p.t === 'e') return [p.c[0] + x * p.r[0], p.c[1] + y * p.r[1], p.c[2] + z * p.r[2]];
  const t = rnd(), { a, b, r, fz } = p;
  return [a[0] + (b[0] - a[0]) * t + x * r, a[1] + (b[1] - a[1]) * t + y * r, a[2] + (b[2] - a[2]) * t + z * r * fz];
}
function onPart(p) {
  const [x, y, z] = onSphere();
  if (p.t === 'e') return [p.c[0] + x * p.r[0], p.c[1] + y * p.r[1], p.c[2] + z * p.r[2]];
  // capsule surface: point on the axis plus a radial unit vector perpendicular-ish to it
  const t = rnd(), { a, b, r, fz } = p;
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, n = d.map(v => v / L);
  const dot = x * n[0] + y * n[1] + z * n[2], inCyl = rnd() < L / (L + 2 * r);
  const q = inCyl ? [x - dot * n[0], y - dot * n[1], z - dot * n[2]] : [x, y, z];
  const ql = Math.hypot(...q) || 1;
  const base = inCyl ? t : (dot > 0 ? 1 : 0);
  return [a[0] + d[0] * base + q[0] / ql * r, a[1] + d[1] * base + q[1] / ql * r, a[2] + d[2] * base + q[2] / ql * r * fz];
}
function inside(p, v, m = 0.96) {
  if (p.t === 'e') return ((v[0] - p.c[0]) / p.r[0]) ** 2 + ((v[1] - p.c[1]) / p.r[1]) ** 2 + ((v[2] - p.c[2]) / p.r[2]) ** 2 < m * m;
  const { a, b, r, fz } = p, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const t = clamp(((v[0] - a[0]) * d[0] + (v[1] - a[1]) * d[1] + (v[2] - a[2]) * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1), 0, 1);
  return Math.hypot(v[0] - a[0] - d[0] * t, v[1] - a[1] - d[1] * t, (v[2] - a[2] - d[2] * t) / fz) < r * m;
}
const vol = p => (p.t === 'e' ? 4.19 * p.r[0] * p.r[1] * p.r[2] : Math.PI * p.r * p.r * p.fz * (Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]) + 1.33 * p.r));
const area = p => Math.pow(vol(p), 2 / 3);
function pick(parts, f = vol) { const tot = parts.reduce((a, c) => a + f(c), 0); let x = rnd() * tot; for (const c of parts) { x -= f(c); if (x <= 0) return c; } return parts[0]; }
const RIB_N = 11;
function sampleRegion(region) {
  switch (region) {
    case 'bone': {
      const u = rnd();
      if (u < 0.15) { const [x, y, z] = onSphere(); return [x * 0.07, 1.628 + y * 0.096, 0.004 + z * 0.087]; } // skull
      if (u < 0.19) { const a = (rnd() - 0.5) * Math.PI * 1.1; return [Math.sin(a) * 0.05, 1.53 + Math.abs(Math.sin(a)) * 0.03, 0.02 + Math.cos(a) * 0.05]; } // jaw
      if (u < 0.42) { // ribs: arcs that curve from the spine around to the front
        const k = (rnd() * RIB_N) | 0, y0 = 1.42 - k * 0.026, a = (rnd() * 2 - 1) * Math.PI * (k < 7 ? 0.9 : 0.78);
        const rx = 0.1 + 0.05 * Math.sin(Math.min(1, (k + 1) / 4) * Math.PI / 2), rz = 0.085;
        return [Math.sin(a) * rx, y0 - (1 + Math.cos(a)) * 0.02, Math.cos(a) * rz - 0.005];
      }
      return inPart(pick(BONES));
    }
    case 'blood': {
      if (rnd() < 0.18) return inPart(ORGANS.heart[0]);
      if (rnd() < 0.3) return inPart(pick(PARTS)); // capillaries everywhere
      return inPart(pick(VESSELS));
    }
    case 'skin': {
      for (let i = 0; i < 40; i++) {
        const p = pick(PARTS, area), v = onPart(p);
        if (!PARTS.some(q => q !== p && inside(q, v))) return v;
      }
      return onPart(PARTS[0]);
    }
    case 'soft': {
      for (let i = 0; i < 20; i++) { // keep muscle out of the chest cavity and skull so organs read clearly
        const v = inPart(pick(PARTS));
        if (!inside(ORGANS.brain[0], v, 1.05) && !ORGANS.lungs.some(o => inside(o, v, 0.9))) return v;
      }
      return inPart(PARTS[3]);
    }
    default: return inPart(pick(ORGANS[region]));
  }
}

// ---------- Radiation: real reference values ----------
// ICRP 103 tissue weighting factors mapped onto the regions drawn here (sum = 1)
const WT = { bone: 0.13, lungs: 0.12, gut: 0.24, skin: 0.01, brain: 0.01, thyroid: 0.04, liver: 0.04, heart: 0.01, kidneys: 0.01, soft: 0.39, blood: 0 };
// How the absorbed dose spreads over regions for each kind of exposure (1 = the dose you set)
const RAD_TYPES = {
  gamma: { name: 'Gamma / X-rays, whole body', ray: 'gamma', wR: 1, rbe: 1, ext: true, spread: { soft: 1, skin: 1, bone: 1, blood: 1, brain: 1, lungs: 1, heart: 1, liver: 1, gut: 1, kidneys: 1, thyroid: 1 }, note: 'Penetrating photons pass through the whole body, like the A-bomb flash, a CT scan or a reactor accident.' },
  beta: { name: 'Beta, on the skin', ray: 'beta', wR: 1, rbe: 1, ext: true, spread: { skin: 1, soft: 0.02 }, note: 'Fast electrons stop within a few millimetres, so they burn the skin. Chernobyl firefighters had severe beta burns.' },
  radon: { name: 'Radon (alpha), breathed in', ray: 'alpha', wR: 20, rbe: 7, internal: 'lungs', spread: { lungs: 1 }, note: 'Radon daughters stick in the airways and fire alpha particles into lung cells. Radon is the second biggest cause of lung cancer after smoking.' },
  iodine: { name: 'Iodine-131, swallowed', ray: 'beta', wR: 1, rbe: 1, internal: 'thyroid', spread: { thyroid: 1, blood: 0.001, soft: 0.0005 }, note: 'The thyroid collects iodine, so almost all the dose lands there. This caused the thyroid cancers in children after Chernobyl.' },
  radium: { name: 'Radium (alpha), in bone', ray: 'alpha', wR: 20, rbe: 7, internal: 'bone', spread: { bone: 1, blood: 0.01 }, note: 'Radium behaves like calcium and settles in bone. The radium dial painters of the 1920s got bone cancers from it.' },
};
const SCENARIOS = [
  ['banana', 'Eating a banana (K-40)', 'gamma', 1e-7],
  ['dental', 'Dental X-ray', 'gamma', 5e-6],
  ['flight', 'Flight New York to Los Angeles', 'gamma', 4e-5],
  ['chest', 'Chest X-ray', 'gamma', 1e-4],
  ['bg', 'One year of natural background (world average)', 'gamma', 2.4e-3],
  ['radon', 'One year of radon at home (average)', 'radon', 5.4e-4],
  ['ct', 'CT scan of the chest', 'gamma', 7e-3],
  ['iss', 'Six months on the Space Station', 'gamma', 0.08],
  ['fuku', 'Highest Fukushima worker dose (2011)', 'gamma', 0.68],
  ['cherchild', 'Child\'s thyroid near Chernobyl (1986)', 'iodine', 1],
  ['cherfire', 'Chernobyl firefighter (1986)', 'gamma', 6],
  ['cherbeta', 'Chernobyl firefighter skin burns', 'beta', 20],
  ['dial', 'Radium dial painter (1920s)', 'radium', 20],
  ['rai', 'Radioiodine therapy for an overactive thyroid', 'iodine', 150],
  ['ouchi', 'Tokaimura criticality accident (1999)', 'gamma', 17],
  ['slotin', 'Louis Slotin, demon core (1946)', 'gamma', 21],
];
// Deterministic effects: [name, region, threshold (RBE-weighted Gy), onset (days), text]
const EFFECTS = [
  ['Lymphocytes fall', 'bone', 0.5, 1, 'White cells that are most sensitive to radiation start dying within a day. Doctors use this drop to estimate the dose.'],
  ['Nausea and vomiting', 'gut', 1, 0.08, 'The first sign of acute radiation syndrome. The higher the dose, the sooner it starts: under an hour above about 4 Gy.'],
  ['Skin reddening', 'skin', 2, 0.3, 'An early flush within hours, then the main reddening after about two weeks.'],
  ['Hair loss', 'skin', 3, 17, 'Hair roots divide fast, so they die. Hair falls out two to three weeks later; above about 7 Gy it does not grow back.'],
  ['Bone marrow failure', 'bone', 2, 20, 'The marrow stops making blood cells. Without white cells and platelets, infections and bleeding set in after two to four weeks.'],
  ['Half of people die without treatment', 'bone', 4, 30, 'LD50/60: about 4 Gy to the whole body kills half of those exposed within 60 days without medical care. Good care raises it to about 6–7 Gy.'],
  ['Gut lining destroyed', 'gut', 6, 5, 'Gastrointestinal syndrome: the intestinal lining is not replaced, causing severe diarrhoea, dehydration and infection. Usually fatal.'],
  ['Wet peeling skin', 'skin', 15, 28, 'Moist desquamation: the skin blisters and weeps, like a severe burn.'],
  ['Skin ulcers and dead tissue', 'skin', 25, 42, 'Skin and tissue underneath die (necrosis). Often needs surgery or amputation.'],
  ['Lung inflammation', 'lungs', 8, 75, 'Radiation pneumonitis, one to six months later, and scarring (fibrosis) after that.'],
  ['Brain and circulation collapse', 'brain', 20, 0.02, 'Neurovascular syndrome: confusion, collapse and shock within minutes to hours. Death follows within about three days.'],
  ['Underactive thyroid', 'thyroid', 10, 180, 'The thyroid stops making enough hormone. Radioiodine therapy uses this on purpose to treat an overactive thyroid.'],
  ['Temporary sterility (men)', 'soft', 0.15, 45, 'Sperm production pauses for months. Permanent above about 3.5–6 Gy.'],
  ['Cataracts (years later)', 'brain', 0.5, 1800, 'The lens of the eye clouds. ICRP threshold: 0.5 Gy.'],
];
// Stochastic (long-term) effects: [name, test(doses, eff Sv, type), onset days, text]
const LATE = [
  ['Leukaemia risk rises', d => d.bone >= 0.1, 730, 'Among Hiroshima and Nagasaki survivors, leukaemia peaked 6–8 years after the bombs.'],
  ['Solid cancer risk rises', (d, e) => e >= 0.1, 3650, 'Cancers of the lung, gut, breast and others appear 10 years or more after exposure.'],
  ['Thyroid cancer risk (children)', d => d.thyroid >= 0.05, 1500, 'Around 6,000 thyroid cancers followed Chernobyl among children who drank contaminated milk. Nearly all were cured.'],
  ['Lung cancer risk (radon)', (d, e, t) => t === 'radon' && e >= 1e-3, 5000, 'Radon causes 3–14% of lung cancers worldwide (WHO). The risk is much larger for smokers.'],
  ['Bone cancer (radium)', (d, e, t) => t === 'radium' && d.bone >= 10, 3650, 'Bone sarcomas appeared in dial painters whose skeletons took more than about 10 Gy of alpha dose.'],
];
const TIMES = [[0, 'At exposure'], [0.04, '1 hour'], [0.25, '6 hours'], [1, '1 day'], [2, '2 days'], [4, '4 days'], [7, '1 week'], [14, '2 weeks'], [21, '3 weeks'], [30, '1 month'], [45, '6 weeks'], [60, '2 months'], [90, '3 months'], [180, '6 months'], [365, '1 year'], [1825, '5 years'], [3650, '10 years'], [7300, '20 years']];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// Schematic blood counts (×10⁹ per litre) after whole-body exposure, following the dose patterns used in triage (lymphocyte depletion, neutrophil nadir)
function lymph(D, t) { const base = 2.5, v = base * Math.exp(-0.47 * D * Math.min(1, t / 2)); const rec = D < 6 ? smooth(30, 90, t) * clamp(1 - D / 6, 0, 1) : 0; return v + (base - v) * rec; }
function neut(D, t) {
  const base = 4.5, spike = D > 0.5 ? 2 * Math.min(D, 3) / 3 * Math.exp(-(((t - 1) / 1) ** 2)) : 0;
  const depth = 1 - Math.exp(-0.45 * D), tn = Math.max(6, 30 - 3 * D);
  const v = base * (1 - depth * smooth(2, tn, t)); const rec = D < 6 ? smooth(tn + 5, tn + 50, t) * clamp(1 - D / 6, 0, 1) : 0;
  return v + (base - v) * rec + spike;
}
const survival = (D, care) => { const ld = care ? 6.5 : 4, s = care ? 0.8 : 0.68; return 1 / (1 + Math.exp((D - ld) / s)); };
function fmtDose(v, u) {
  if (v === 0) return `0 ${u}`;
  if (v >= 1) return `${fmt(v, 3)} ${u}`;
  if (v >= 1e-3) return `${fmt(v * 1e3, 3)} m${u}`;
  if (v >= 1e-6) return `${fmt(v * 1e6, 3)} µ${u}`;
  return `${fmt(v * 1e9, 3)} n${u}`;
}

export function buildBody(root, { openElement }) {
  const N = 70000;
  const REGIONS = Object.keys(REGION_COLORS);
  const st = { color: 'element', count: 'atoms', focus: null, srcFocus: null, mass: 70, layers: Object.fromEntries(REGIONS.map(r => [r, true])), stars: false,
    rad: null, radType: 'gamma', dose: 1, ti: 0, playing: false };
  const atoms = BODY.map(([s, pct]) => pct / bySym[s].mass);
  const atomsTot = atoms.reduce((a, b) => a + b, 0);

  const canvas = h('canvas', { 'aria-label': '3D human body made of elements' });
  const labels = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
  const radBadge = h('div', { class: 'rad-badge', hidden: true });
  const stage = h('div', { class: 'stage stage-tall body-stage' }, canvas, labels, radBadge);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  camera.position.set(0, 0.95, 2.55);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { zoomToCursor: true, enableDamping: true, autoRotate: true, autoRotateSpeed: 1.2, minDistance: 0.3, maxDistance: 9 });
  controls.target.set(0, 0.88, 0);

  const pos = new Float32Array(N * 3), home = new Float32Array(N * 3), star = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const elIdx = new Uint8Array(N), regIdx = new Uint8Array(N), srcOf = new Uint8Array(N);
  let centersRef = [];
  function build() {
    const w = BODY.map(([, pct], i) => (st.count === 'atoms' ? atoms[i] / atomsTot : pct / 100));
    const floor = 300, free = N - floor * BODY.length;
    const counts = w.map(x => floor + Math.round(x * free));
    let k = 0;
    const centers = SOURCE_ORDER.map((s0, i) => { const a = (i / SOURCE_ORDER.length) * Math.PI * 2; return [Math.cos(a) * 2.2, 1.0 + Math.sin(a) * 1.3, -0.6]; });
    BODY.forEach(([sym, , regs], i) => {
      const el = bySym[sym], regKeys = Object.keys(regs), regW = regKeys.map(r => regs[r]);
      for (let j = 0; j < counts[i] && k < N; j++, k++) {
        let x = rnd(), r = regKeys[0];
        for (let q = 0; q < regKeys.length; q++) { x -= regW[q]; if (x <= 0) { r = regKeys[q]; break; } }
        const p = sampleRegion(r);
        home.set(p, k * 3); pos.set(p, k * 3); elIdx[k] = i; regIdx[k] = REGIONS.indexOf(r);
        let y = rnd() * 100, src = el.origin[0].src;
        for (const o of el.origin) { y -= o.pct; if (y <= 0) { src = o.src; break; } }
        const si = SOURCE_ORDER.indexOf(src); srcOf[k] = si;
        const c = centers[si], [ux, uy, uz] = onSphere(), rr = Math.cbrt(rnd()) * 0.42;
        star.set([c[0] + ux * rr, c[1] + uy * rr, c[2] + uz * rr], k * 3);
      }
    });
    for (; k < N; k++) { home.set([0, -99, 0], k * 3); pos.set([0, -99, 0], k * 3); star.set([0, -99, 0], k * 3); elIdx[k] = 0; regIdx[k] = 0; }
    if (morph) for (let q = 0; q < N * 3; q++) pos[q] = home[q] + (star[q] - home[q]) * easeInOut(morph);
    geo.attributes.position.needsUpdate = true;
    centersRef = centers;
    colorize();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const mat = new THREE.PointsMaterial({ size: 0.01, vertexColors: true, map: dot, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(geo, mat));
  // Smooth glowing silhouette (fresnel rim light)
  const shellMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#7fb8ff') }, uAlpha: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(uColor * f, f * 0.4 * uAlpha); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const shell = new THREE.Group();
  for (const p of PARTS) {
    let m;
    if (p.t === 'e') { m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), shellMat); m.position.set(...p.c); m.scale.set(p.r[0] * 1.03, p.r[1] * 1.03, p.r[2] * 1.03); }
    else {
      const a = new THREE.Vector3(...p.a), b = new THREE.Vector3(...p.b), len = a.distanceTo(b);
      m = new THREE.Mesh(new THREE.CapsuleGeometry(p.r * 1.03, len, 8, 24), shellMat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      if (len > 1e-6) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.scale.z = p.fz;
    }
    shell.add(m);
  }
  scene.add(shell);
  const floor = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.42, 64), new THREE.MeshBasicMaterial({ color: 0x7fb8ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; scene.add(floor);

  // Radiation tracks (line segments) and ionisation flashes
  const RAYS = 90, rayPos = new Float32Array(RAYS * 6), rayCol = new Float32Array(RAYS * 6);
  const rayGeo = new THREE.BufferGeometry();
  rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPos, 3)); rayGeo.setAttribute('color', new THREE.BufferAttribute(rayCol, 3));
  const rayLines = new THREE.LineSegments(rayGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(rayLines);
  const HITS = 500, hitPos = new Float32Array(HITS * 3), hitCol = new Float32Array(HITS * 3), hitLife = new Float32Array(HITS);
  const hitGeo = new THREE.BufferGeometry();
  hitGeo.setAttribute('position', new THREE.BufferAttribute(hitPos, 3)); hitGeo.setAttribute('color', new THREE.BufferAttribute(hitCol, 3));
  const hitPts = new THREE.Points(hitGeo, new THREE.PointsMaterial({ size: 0.028, vertexColors: true, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(hitPts);
  const rays = Array.from({ length: RAYS }, () => ({ on: false }));
  const RAYC = { alpha: new THREE.Color('#ff5a4a'), beta: new THREE.Color('#5ab4ff'), gamma: new THREE.Color('#ffe066') };
  const regionPoints = {};
  function exposedIdx() { // indices of points in regions that receive dose
    const T = RAD_TYPES[st.radType], key = st.radType;
    if (regionPoints[key]) return regionPoints[key];
    const w = REGIONS.map(r => T.spread[r] || 0), out = [];
    for (let k = 0; k < N; k++) if (home[k * 3 + 1] > -50 && w[regIdx[k]] >= 0.5) out.push(k);
    return (regionPoints[key] = out);
  }
  function spawnRay(r) {
    const T = RAD_TYPES[st.radType];
    r.on = true; r.kind = T.ray; r.age = 0;
    if (T.ext) {
      const y = 0.05 + rnd() * 1.65, x = (rnd() - 0.5) * 0.6;
      r.p = [x, y, 1.6]; r.d = [(rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.08, -1];
      r.speed = T.ray === 'gamma' ? 3.2 : 1.6; r.len = T.ray === 'gamma' ? 0.35 : 0.18;
      r.stopZ = T.ray === 'gamma' ? -1.6 : 0.09 + rnd() * 0.02; // beta stops in the skin
    } else {
      const idx = exposedIdx(); const k = idx[(rnd() * idx.length) | 0] ?? 0;
      r.p = [home[k * 3], home[k * 3 + 1], home[k * 3 + 2]]; r.d = onSphere();
      if (st.radType === 'iodine' && rnd() < 0.35) { r.kind = 'gamma'; r.speed = 2.5; r.len = 0.3; r.max = 1.4; } // I-131 also gives off gamma rays that leave the body
      else { r.speed = T.ray === 'alpha' ? 0.08 : 0.25; r.len = T.ray === 'alpha' ? 0.012 : 0.03; r.max = T.ray === 'alpha' ? 0.02 : 0.05; }
      r.stopZ = null; r.dist = 0;
    }
  }
  function flash(n) {
    const idx = exposedIdx(); if (!idx.length) return;
    for (let i = 0; i < n; i++) {
      const s = (rnd() * HITS) | 0, k = idx[(rnd() * idx.length) | 0];
      hitPos[s * 3] = home[k * 3]; hitPos[s * 3 + 1] = home[k * 3 + 1]; hitPos[s * 3 + 2] = home[k * 3 + 2]; hitLife[s] = 1;
    }
  }
  function stepRays(dt) {
    const active = st.rad && morph < 0.05;
    rayLines.visible = hitPts.visible = !!active;
    if (!active) return;
    const lg = Math.log10(st.dose / 1e-7); // 0 for a banana, 10 for 1000 Gy
    const want = Math.round(clamp(3 + lg * 8.5, 3, RAYS));
    const T = RAD_TYPES[st.radType], exposing = st.ti === 0;
    for (let i = 0; i < RAYS; i++) {
      const r = rays[i];
      if (!r.on) { if (exposing && i < want && rnd() < dt * 4) spawnRay(r); else { rayPos.fill(0, i * 6, i * 6 + 6); continue; } }
      const s = r.speed * dt;
      r.p[0] += r.d[0] * s; r.p[1] += r.d[1] * s; r.p[2] += r.d[2] * s; r.age += dt;
      if (r.stopZ != null) {
        const body = Math.abs(r.p[0]) < 0.2 && r.p[2] < 0.12 && r.p[2] > -0.12;
        if (body && rnd() < dt * 20) flash(1);
        if (r.p[2] < r.stopZ) { if (T.ray !== 'gamma') flash(2); r.on = false; }
      } else { r.dist += s; if (r.dist > r.max) { flash(1); r.on = false; } }
      const c = RAYC[r.kind];
      const tail = [r.p[0] - r.d[0] * r.len, r.p[1] - r.d[1] * r.len, r.p[2] - r.d[2] * r.len];
      rayPos.set(tail, i * 6); rayPos.set(r.p, i * 6 + 3);
      rayCol.set([c.r * 0.1, c.g * 0.1, c.b * 0.1, c.r, c.g, c.b], i * 6);
    }
    rayGeo.attributes.position.needsUpdate = true; rayGeo.attributes.color.needsUpdate = true;
    if (exposing) flash(Math.round(clamp(lg * 1.2, 0, 20) * dt * 30));
    for (let s = 0; s < HITS; s++) {
      hitLife[s] = Math.max(0, hitLife[s] - dt * 2.5);
      const v = hitLife[s], c = RAYC[T.ray];
      hitCol[s * 3] = (0.6 + c.r * 0.4) * v; hitCol[s * 3 + 1] = (0.6 + c.g * 0.4) * v; hitCol[s * 3 + 2] = (0.6 + c.b * 0.4) * v;
    }
    hitGeo.attributes.position.needsUpdate = true; hitGeo.attributes.color.needsUpdate = true;
  }

  const ELCOL = { H: '#e8f1ff', O: '#ff4d4d', C: '#9aa0a6', N: '#4f7dff', Ca: '#3ddc84', P: '#ff9f1a', K: '#b58cff', S: '#ffe14d', Na: '#9b6bff', Cl: '#4de0a0', Mg: '#7dff6b', Fe: '#ff7a1a', F: '#b0ff4d', Zn: '#8c9dff', Si: '#f0c89a', Cu: '#ff9966', I: '#c04dff', Se: '#ffa64d', Mn: '#a080ff', Mo: '#60d0c0', Co: '#ff80b0', Cr: '#90a0c0' };
  const tmp = new THREE.Color(), heat = new THREE.Color(), red = new THREE.Color('#ff2a1a');
  // colour for a dose in Gy: blue (harmless) through yellow to deep red (lethal)
  function heatColor(d, out) {
    const x = clamp((Math.log10(Math.max(d, 1e-9)) + 4) / 5.5, 0, 1); // 0.1 mGy → 0, ~30 Gy → 1
    const stops = ['#2a6cff', '#35d0c0', '#9be15d', '#ffd23f', '#ff7a1a', '#ff1f3d', '#ffffff'];
    const f = x * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f));
    return out.set(stops[i]).lerp(tmp.set(stops[i + 1]), f - i);
  }
  function colorize() {
    const radMode = st.color === 'dose' && st.rad;
    const doses = radMode ? regionDose() : null, t = TIMES[st.ti][0];
    const fx = radMode ? timeFx(doses, t) : null;
    const regCol = REGIONS.map(r => new THREE.Color(REGION_COLORS[r]));
    const regHeat = radMode ? REGIONS.map(r => heatColor(doses[r] || 0, new THREE.Color())) : null;
    for (let k = 0; k < N; k++) {
      const i = elIdx[k], sym = BODY[i][0], ri = regIdx[k], r = REGIONS[ri];
      const visible = st.layers[r] && (!st.focus || st.focus === sym) && (st.srcFocus == null || srcOf[k] === st.srcFocus);
      const hl = st.focus || st.srcFocus != null;
      let f = visible ? (hl ? 1 : 0.8) : (hl ? 0.035 : 0);
      if (radMode) {
        const d = doses[r] || 0;
        if (d > 0) tmp.copy(regHeat[ri]); else tmp.copy(regCol[ri]).multiplyScalar(0.25);
        // effects that develop over time
        if (r === 'blood') f *= fx.blood;
        if (r === 'bone') f *= 0.35 + 0.65 * fx.marrow;
        if (r === 'skin' && fx.skin > 0) tmp.lerp(red, fx.skin);
        if (fx.dead) f *= 0.35;
      } else if (st.color === 'element' || st.color === 'dose') tmp.set(ELCOL[sym] || CATEGORIES[bySym[sym].cat].color);
      else if (st.color === 'origin') tmp.set(SOURCES[SOURCE_ORDER[srcOf[k]]].color);
      else tmp.copy(regCol[ri]);
      col[k * 3] = tmp.r * f; col[k * 3 + 1] = tmp.g * f; col[k * 3 + 2] = tmp.b * f;
    }
    geo.attributes.color.needsUpdate = true;
    mat.size = st.focus || st.srcFocus != null ? 0.015 : 0.01;
  }

  // ---------- Radiation model ----------
  function regionDose() { const T = RAD_TYPES[st.radType]; return Object.fromEntries(REGIONS.map(r => [r, st.dose * (T.spread[r] || 0)])); }
  function detDose(doses) { const T = RAD_TYPES[st.radType]; return Object.fromEntries(REGIONS.map(r => [r, doses[r] * T.rbe])); } // RBE-weighted, for tissue damage
  function effective(doses) { const T = RAD_TYPES[st.radType]; return REGIONS.reduce((a, r) => a + WT[r] * T.wR * doses[r], 0); }
  function timeFx(doses, t) {
    const D = detDose(doses), Dm = D.bone, Ds = D.skin;
    const n = neut(Dm, t) / 4.5;
    const e1 = Ds >= 2 ? Math.min(1, Ds / 6) * Math.exp(-(((t - 0.7) / 0.8) ** 2)) * 0.6 : 0;
    const e2 = Ds >= 6 ? Math.min(1, (Ds - 4) / 10) * smooth(8, 14, t) * (Ds < 15 ? 1 - smooth(40, 120, t) * 0.7 : 1) : 0;
    const dead = (D.brain >= 20 && t >= 3) || (D.gut >= 10 && t >= 14) || (Dm >= 8 && t >= 30);
    return { blood: clamp(0.25 + 0.75 * Math.min(1, lymph(Dm, t) / 2.5 * 0.4 + n * 0.6), 0, 1), marrow: clamp(n, 0, 1), skin: clamp(Math.max(e1, e2), 0, 0.9), dead };
  }
  function stageText(D, t) {
    const Dm = D.bone;
    if (Dm < 0.5 && D.gut < 1 && D.brain < 20) return null;
    if (D.brain >= 20) return t < 0.1 ? 'Burning skin, confusion, vomiting and collapse within minutes.' : t < 3 ? 'Brief lucid phase, then circulatory collapse, coma and seizures.' : 'Death from brain swelling and shock, within about three days.';
    const onset = Dm >= 6 ? '10–30 minutes' : Dm >= 4 ? 'under an hour' : Dm >= 2 ? '1–2 hours' : 'a few hours';
    const latentEnd = Math.max(2, 21 - 3 * Dm);
    if (t < 2) return `Early phase: nausea and vomiting begin after ${onset}${Dm >= 2 ? ', with fatigue and fever' : ''}. Lymphocytes are already falling.`;
    if (t < latentEnd) return D.gut >= 6 ? 'The gut lining is failing: severe diarrhoea, fluid loss and infection.' : 'Latent phase: the person feels better, but bone marrow and gut cells are silently dying.';
    if (t < 60) {
      if (Dm < 1) return 'Blood counts dip slightly and recover. No symptoms.';
      return `Illness phase: ${D.gut >= 6 ? 'gut failure plus ' : ''}very low white cells and platelets, so infections, bleeding${D.skin >= 3 ? ', hair loss' : ''}. ${Dm >= 4 ? 'Needs intensive care; marrow transplants were tried after Chernobyl.' : 'Most recover with care.'}`;
    }
    if (t < 365) return survival(Dm, false) > 0.5 ? 'Recovery: blood counts return over weeks to months. Fatigue lasts.' : 'Those who survived are slowly recovering; many did not.';
    return 'Years later: raised risk of leukaemia and other cancers, and cataracts.';
  }

  // Animation between body and "back to the stars"
  let morph = 0, target = 0, raf = 0, last = 0, playAcc = 0, camMove = false;
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!canvas.offsetParent) return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    const r = stage.getBoundingClientRect();
    if (canvas.width !== Math.round(r.width * renderer.getPixelRatio())) { renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); }
    const e0 = easeInOut(morph);
    if (camMove) {
      const want = new THREE.Vector3(0, 0.95 + e0 * 0.1, 2.55 + e0 * 5.7), wantT = new THREE.Vector3(0, 0.88 + e0 * 0.12, -0.6 * e0);
      camera.position.lerp(want, Math.min(1, dt * 3)); controls.target.lerp(wantT, Math.min(1, dt * 3));
      if (camera.position.distanceTo(want) < 0.02) camMove = false;
    }
    shellMat.uniforms.uAlpha.value = 1 - e0; floor.material.opacity = 0.12 * (1 - e0);
    if (morph !== target) {
      morph = target > morph ? Math.min(target, morph + dt / 2.2) : Math.max(target, morph - dt / 2.2);
      const e = easeInOut(morph);
      for (let k = 0; k < N * 3; k++) pos[k] = home[k] + (star[k] - home[k]) * e;
      geo.attributes.position.needsUpdate = true;
    }
    if (st.playing) { playAcc += dt; if (playAcc > 0.7) { playAcc = 0; if (st.ti < TIMES.length - 1) setTime(st.ti + 1); else { st.playing = false; playBtn.textContent = '▶ Play'; } } }
    stepRays(dt);
    controls.update();
    renderer.render(scene, camera);
    if (morph > 0.6 && centersRef.length) {
      labels.replaceChildren(...centersRef.map((c, i) => {
        const v = new THREE.Vector3(c[0], c[1] + 0.55, c[2]).project(camera);
        const s = SOURCES[SOURCE_ORDER[i]];
        return h('div', { style: { position: 'absolute', left: `${(v.x * 0.5 + 0.5) * 100}%`, top: `${(-v.y * 0.5 + 0.5) * 100}%`, transform: 'translate(-50%,-50%)', color: s.color, font: '700 14px var(--data)', textShadow: '0 1px 6px #000', whiteSpace: 'nowrap', opacity: morph } }, s.short);
      }));
    } else if (labels.childElementCount) labels.replaceChildren();
  }

  // ---------- UI ----------
  const colorSeg = seg([['element', 'Element'], ['origin', 'Cosmic origin'], ['region', 'Body part'], ['dose', 'Radiation dose']], st.color, k => { st.color = k; if (k === 'dose' && !st.rad) setRad(true); colorize(); renderList(); });
  const countSeg = seg([['atoms', 'By number of atoms'], ['mass', 'By mass']], st.count, k => { st.count = k; for (const key in regionPoints) delete regionPoints[key]; build(); renderList(); renderMix(); });
  const massS = h('input', { type: 'range', id: 'body-mass', min: 3, max: 150, value: st.mass });
  const massV = h('b', {}, `${st.mass} kg`);
  massS.addEventListener('input', () => { st.mass = +massS.value; massV.textContent = `${st.mass} kg`; renderList(); renderInfo(); });
  const layerBox = h('div', { class: 'layer-grid' }, REGIONS.map(r => h('label', { class: 'row small', style: { gap: '5px' } }, h('input', { type: 'checkbox', checked: true, onchange: e => { st.layers[r] = e.target.checked; colorize(); } }), h('span', { style: { width: '10px', height: '10px', borderRadius: '3px', background: REGION_COLORS[r], display: 'inline-block', flex: 'none' } }), REGION_NAMES[r])));
  const starBtn = h('button', { class: 'btn primary', onclick: () => { st.stars = !st.stars; target = st.stars ? 1 : 0; camMove = true; starBtn.textContent = st.stars ? 'Put me back together' : 'Send my atoms back to the stars'; controls.autoRotate = !st.stars; if (st.stars) { st.color = 'origin'; setSeg(colorSeg, 'origin'); colorize(); } } }, 'Send my atoms back to the stars');
  const rotBtn = h('button', { class: 'btn small', onclick: () => { controls.autoRotate = !controls.autoRotate; } }, 'Rotate on/off');
  const list = h('div', { class: 'el-list' });
  const info = h('div', { class: 'card stack' });
  const mix = h('div', { class: 'stack', style: { gap: '8px' } });

  // Radiation controls
  const scenSel = h('select', { id: 'rad-scen', onchange: () => { const s = SCENARIOS.find(x => x[0] === scenSel.value); if (s) { st.radType = s[2]; st.dose = s[3]; typeSel.value = s[2]; syncDose(); setRad(true); } } },
    h('option', { value: '' }, 'Pick a real exposure…'), SCENARIOS.map(([k, name, , d]) => h('option', { value: k }, `${name} · ${fmtDose(d, SCENARIOS.find(x => x[0] === k)[2] === 'gamma' ? 'Sv' : 'Gy')}`)));
  const typeSel = h('select', { id: 'rad-type', onchange: () => { st.radType = typeSel.value; scenSel.value = ''; setRad(true); } }, Object.entries(RAD_TYPES).map(([k, T]) => h('option', { value: k }, T.name)));
  const doseS = h('input', { type: 'range', id: 'rad-dose', min: -7, max: 3, step: 0.01, value: 0 });
  const doseV = h('b', {});
  const syncDose = () => { doseS.value = Math.log10(st.dose); doseV.textContent = fmtDose(st.dose, 'Gy'); };
  doseS.addEventListener('input', () => { st.dose = Math.pow(10, +doseS.value); doseV.textContent = fmtDose(st.dose, 'Gy'); scenSel.value = ''; setRad(true); });
  const timeS = h('input', { type: 'range', id: 'rad-time', min: 0, max: TIMES.length - 1, step: 1, value: 0 });
  const timeV = h('b', {}, TIMES[0][1]);
  timeS.addEventListener('input', () => setTime(+timeS.value));
  const playBtn = h('button', { class: 'btn small', onclick: () => { if (!st.rad) setRad(true); st.playing = !st.playing; if (st.playing && st.ti === TIMES.length - 1) setTime(0); playBtn.textContent = st.playing ? '❚❚ Pause' : '▶ Play'; } }, '▶ Play');
  const radBtn = h('button', { class: 'btn primary', onclick: () => setRad(!st.rad) }, 'Expose');
  const radCard = h('div', { class: 'card stack rad-card', hidden: true });
  const bloodCv = h('canvas', { class: 'rad-blood', 'aria-label': 'Blood counts after exposure' });
  syncDose();

  function setTime(i) { st.ti = i; timeS.value = i; timeV.textContent = TIMES[i][1]; colorize(); renderRad(); }
  function setRad(on) {
    st.rad = on;
    radBtn.textContent = on ? 'Clear radiation' : 'Expose';
    if (on) { st.color = 'dose'; setSeg(colorSeg, 'dose'); controls.autoRotate = true; }
    else { st.playing = false; playBtn.textContent = '▶ Play'; if (st.color === 'dose') { st.color = 'element'; setSeg(colorSeg, 'element'); } }
    for (const r of rays) r.on = false; hitLife.fill(0);
    radCard.hidden = !on; radBadge.hidden = !on;
    colorize(); renderRad();
  }
  function renderRad() {
    if (!st.rad) return;
    const T = RAD_TYPES[st.radType], doses = regionDose(), D = detDose(doses), E = effective(doses), t = TIMES[st.ti][0];
    const risk = E * 0.055; // ICRP 103 nominal risk: 5.5% per sievert (linear no-threshold)
    const maxR = REGIONS.reduce((a, r) => (doses[r] > doses[a] ? r : a), 'soft');
    radBadge.replaceChildren(h('b', {}, fmtDose(E, 'Sv')), h('span', {}, `effective dose · ${TIMES[st.ti][1].toLowerCase()}`));
    const live = EFFECTS.filter(e => D[e[1]] >= e[2]);
    const late = LATE.filter(([, f]) => f(D, E, st.radType));
    const stage = stageText(D, t);
    const uniform = REGIONS.every(r => doses[r] === doses.soft);
    const organRows = uniform ? [h('div', { class: 'dose-row' }, h('span', { class: 'sw', style: { background: `#${heatColor(doses.soft, new THREE.Color()).getHexString()}` } }), h('span', {}, 'every organ, evenly'), h('b', {}, fmtDose(doses.soft, 'Gy')), h('small', {}, ''))] : REGIONS.filter(r => doses[r] > 0).sort((a, b) => doses[b] - doses[a]).map(r => h('div', { class: 'dose-row' }, h('span', { class: 'sw', style: { background: `#${heatColor(doses[r], new THREE.Color()).getHexString()}` } }), h('span', {}, REGION_NAMES[r]), h('b', {}, fmtDose(doses[r], 'Gy')), h('small', {}, T.wR > 1 ? `= ${fmtDose(doses[r] * T.wR, 'Sv')}` : '')));
    radCard.replaceChildren(
      h('div', { class: 'panel-title' }, h('h3', {}, 'Radiation effects'), h('span', { class: 'hint-text' }, T.name)),
      h('p', { style: { margin: 0 } }, T.note),
      h('div', { class: 'kpis' },
        h('div', {}, h('b', {}, fmtDose(doses[maxR], 'Gy')), h('span', {}, uniform ? 'absorbed, whole body' : `absorbed by ${REGION_NAMES[maxR]}`)),
        h('div', {}, h('b', {}, fmtDose(E, 'Sv')), h('span', {}, 'effective dose (whole-body risk)')),
        h('div', {}, h('b', {}, risk < 1e-4 ? `1 in ${fmt(1 / Math.max(risk, 1e-12), 2)}` : `+${fmt(Math.min(risk, 1) * 100, 2)}%`), h('span', {}, 'extra lifetime cancer risk')),
        D.bone >= 1 ? h('div', {}, h('b', {}, `${fmt(survival(D.bone, false) * 100, 2)}% / ${fmt(survival(D.bone, true) * 100, 2)}%`), h('span', {}, '60-day survival: no care / hospital care')) : ''),
      stage ? h('div', { class: 'rad-stage' }, h('b', {}, TIMES[st.ti][1]), ' ', stage) : h('div', { class: 'rad-stage ok' }, h('b', {}, 'No symptoms. '), E < 0.1 ? 'Below 100 mSv no health effects have ever been directly measured; any cancer risk is too small to see and is estimated by extrapolation.' : 'No acute illness at this dose, but the long-term cancer risk is raised.'),
      h('div', { class: 'cols' },
        h('div', { class: 'stack', style: { gap: '6px' } }, h('h4', {}, 'Dose by organ'), ...organRows, h('p', { class: 'hint-text', style: { margin: 0 } }, 'Gy (gray) = energy absorbed, joules per kg. Sv (sievert) = the same dose weighted by how harmful the radiation and the tissue are. Alpha particles count 20×.')),
        h('div', { class: 'stack', style: { gap: '6px' } }, h('h4', {}, 'Blood counts (whole-body dose)'), bloodCv, h('p', { class: 'hint-text', style: { margin: 0 } }, 'Schematic, following the patterns doctors use for triage. Lymphocytes (blue) drop in days; neutrophils (orange) bottom out in 1–4 weeks. Below the dashed line, infections become likely.'))),
      h('h4', {}, 'Effects at this dose'),
      live.length || late.length ? h('div', { class: 'fx-list' },
        ...live.map(([name, r, th, on, txt]) => h('div', { class: `fx ${t >= on ? 'now' : ''}` }, h('b', {}, name), h('small', {}, `${REGION_NAMES[r]} ≥ ${th} Gy · ${t >= on ? 'happening' : 'starts after ' + fmtOnset(on)}`), h('p', {}, txt))),
        ...late.map(([name, , on, txt]) => h('div', { class: `fx late ${t >= on ? 'now' : ''}` }, h('b', {}, name), h('small', {}, `long-term · ${t >= on ? 'risk window open' : 'after ' + fmtOnset(on)}`), h('p', {}, txt))))
        : h('p', { class: 'muted', style: { margin: 0 } }, 'None. The body repairs this much damage every day: natural background radiation causes about 15,000 DNA breaks per cell per year, and cells mend them.'),
      h('details', { class: 'guide' }, h('summary', {}, 'Where these numbers come from'), h('p', {}, 'Tissue weighting and the 5.5% per sievert cancer risk: ICRP Publication 103 (2007). Thresholds for tissue damage: ICRP 118 and IAEA emergency guidance, using RBE 7 for alpha particles in lung and bone. LD50/60 ≈ 4 Gy without treatment: data from Hiroshima, Nagasaki, Chernobyl and accidents. Everyday doses: UNSCEAR. The model is simplified: real doses are never perfectly even, and people differ.')),
    );
    requestAnimationFrame(() => drawBlood(D.bone, t));
  }
  function fmtOnset(d) { return d < 0.1 ? 'minutes' : d < 1 ? `${Math.round(d * 24)} hours` : d < 60 ? `${Math.round(d)} days` : d < 365 ? `${Math.round(d / 30)} months` : `${Math.round(d / 365)} years`; }
  function drawBlood(Dm, t) {
    const c = bloodCv, r = c.getBoundingClientRect(); if (!r.width) return;
    const dpr = Math.min(devicePixelRatio, 2); c.width = r.width * dpr; c.height = r.height * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const W = r.width, H = r.height, pl = 30, pb = 18, days = 60;
    const px = d => pl + d / days * (W - pl - 6), py = v => 6 + (1 - v / 7) * (H - pb - 6);
    x.font = '11px "Source Sans 3", sans-serif'; x.fillStyle = cssVar('--muted') || '#888'; x.strokeStyle = cssVar('--line') || '#444';
    x.beginPath(); x.moveTo(pl, 6); x.lineTo(pl, H - pb); x.lineTo(W - 6, H - pb); x.stroke();
    for (const d of [0, 15, 30, 45, 60]) x.fillText(`${d}d`, px(d) - 6, H - 4);
    for (const v of [0, 2, 4, 6]) x.fillText(v, pl - 12, py(v) + 4);
    x.setLineDash([4, 4]); x.beginPath(); x.moveTo(pl, py(0.5)); x.lineTo(W - 6, py(0.5)); x.stroke(); x.setLineDash([]);
    const line = (f, colr) => { x.strokeStyle = colr; x.lineWidth = 2; x.beginPath(); for (let d = 0; d <= days; d += 0.5) { const v = f(Dm, d); d ? x.lineTo(px(d), py(v)) : x.moveTo(px(d), py(v)); } x.stroke(); x.lineWidth = 1; };
    line(lymph, '#4f8dff'); line(neut, '#ff9a3c');
    if (t <= days) { x.strokeStyle = cssVar('--accent') || '#fff'; x.beginPath(); x.moveTo(px(t), 6); x.lineTo(px(t), H - pb); x.stroke(); }
  }

  function renderList() {
    const tot = st.count === 'atoms' ? atomsTot : 100;
    list.replaceChildren(...BODY.map(([sym, pct], i) => {
      const e = bySym[sym], share = st.count === 'atoms' ? atoms[i] / tot * 100 : pct;
      const grams = st.mass * 1000 * pct / 100;
      return h('button', { class: `el-row ${st.focus === sym ? 'on' : ''}`, style: { '--c': ELCOL[sym] }, onclick: () => { st.focus = st.focus === sym ? null : sym; st.srcFocus = null; renderMix(); colorize(); renderList(); renderInfo(); } },
        h('span', { class: 'sym' }, sym),
        h('span', {}, h('b', {}, e.name), h('div', { class: 'bar' }, h('i', { style: { width: `${Math.max(1, Math.log10(share * 1e6 + 1) / 8 * 100)}%`, background: ELCOL[sym] } }))),
        h('span', { class: 'v' }, grams >= 1000 ? `${fmt(grams / 1000, 3)} kg` : grams >= 1 ? `${fmt(grams, 3)} g` : `${fmt(grams * 1000, 3)} mg`, h('small', {}, `${share >= 0.01 ? fmt(share, 3) : sci(share, 2)}%${st.count === 'atoms' ? ' of atoms' : ''}`)));
    }));
  }
  function renderInfo() {
    if (!st.focus) {
      const totalAtoms = BODY.reduce((a, [sy, p]) => a + st.mass * 1000 * p / 100 / bySym[sy].mass * 6.022e23, 0);
      info.replaceChildren(h('h3', {}, 'You are made of stars'), h('p', { style: { margin: 0 } }, `A ${st.mass} kg person holds about ${sci(totalAtoms, 2)} atoms of ${BODY.length} elements. Tap an element to see where it sits in the body and where in the universe it was made. Tiny traces are shown larger than life so you can see them.`));
      return;
    }
    const row = BODY.find(b => b[0] === st.focus), e = bySym[st.focus], grams = st.mass * 1000 * row[1] / 100;
    const nAtoms = grams / e.mass * 6.022e23;
    info.replaceChildren(
      h('div', { class: 'panel-title' }, h('h3', {}, `${e.name} in your body`), h('button', { class: 'btn small', onclick: () => openElement(e) }, `Open ${e.name} →`)),
      h('div', { class: 'stat-grid' }, s('Mass', grams >= 1 ? `${fmt(grams, 3)} g` : `${fmt(grams * 1000, 3)} mg`), s('Atoms', sci(nAtoms, 2)), s('Share of mass', `${row[1]}%`)),
      h('p', { style: { margin: 0 } }, row[3]),
      h('div', { class: 'origin-bar' }, e.origin.map(o => h('button', { title: `${SOURCES[o.src].name} ${o.pct}%`, style: { flex: o.pct, background: SOURCES[o.src].color } }))),
      h('div', { class: 'small' }, `Made by: ${e.origin.map(o => `${SOURCES[o.src].name.toLowerCase()} ${o.pct}%`).join(', ')}.`));
  }
  function renderMix() {
    const real = {}; let rt = 0;
    BODY.forEach(([sym], i) => { const wgt = st.count === 'atoms' ? atoms[i] : BODY[i][1]; for (const o of bySym[sym].origin) { real[o.src] = (real[o.src] || 0) + wgt * o.pct; rt += wgt * o.pct; } });
    const arr = SOURCE_ORDER.filter(k => real[k]).map(k => [k, real[k] / rt * 100]).sort((a, b) => b[1] - a[1]);
    const pickSrc = k => { const i = SOURCE_ORDER.indexOf(k); st.srcFocus = st.srcFocus === i ? null : i; if (st.srcFocus != null) { st.focus = null; st.color = 'origin'; setSeg(colorSeg, 'origin'); } colorize(); renderMix(); renderList(); };
    const onK = k => st.srcFocus === SOURCE_ORDER.indexOf(k);
    mix.replaceChildren(h('div', { class: 'origin-bar' }, arr.map(([k, p]) => h('button', { class: onK(k) ? 'on' : '', title: `${SOURCES[k].name} ${p.toFixed(1)}%`, style: { flex: p, background: SOURCES[k].color }, onclick: () => pickSrc(k) }))),
      h('div', { class: 'origin-legend' }, arr.map(([k, p]) => h('button', { class: onK(k) ? 'on' : '', onclick: () => pickSrc(k) }, h('span', { style: { width: '12px', height: '12px', borderRadius: '4px', background: SOURCES[k].color, display: 'block' } }), SOURCES[k].name, h('span', { class: 'pct' }, `${p < 0.1 && p > 0 ? p.toFixed(3) : p.toFixed(1)}%`)))),
      h('p', { class: 'hint-text', style: { margin: 0 } }, st.srcFocus != null ? `Showing only atoms made by ${SOURCES[SOURCE_ORDER[st.srcFocus]].name.toLowerCase()}. Tap it again to show everything.` : 'Tap a source to light up its atoms in the body.'),
      h('p', { class: 'hint-text', style: { margin: 0 } }, st.count === 'atoms' ? 'Counting atoms, most of you is Big Bang hydrogen, 13.8 billion years old.' : 'By mass, most of you is oxygen and carbon forged in stars.'));
  }

  workspace(root, {
    eyebrow: 'Human Body', title: 'The stardust you are made of', intro: 'Every glowing dot is a sample of your atoms, placed where that element really lives: bones, blood, brain, lungs, heart, liver, gut, kidneys and thyroid.',
    side: [
      group('View', h('div', { class: 'field' }, h('label', {}, 'Colour by'), colorSeg), h('div', { class: 'field' }, h('label', {}, 'Count'), countSeg), h('div', { class: 'field' }, h('label', { for: 'body-mass' }, 'Body mass', massV), massS), h('div', { class: 'field' }, h('label', {}, 'Show'), layerBox)),
      group('Radiation exposure',
        h('div', { class: 'field' }, h('label', { for: 'rad-scen' }, 'Real-world exposure'), scenSel),
        h('div', { class: 'field' }, h('label', { for: 'rad-type' }, 'Kind of radiation'), typeSel),
        h('div', { class: 'field' }, h('label', { for: 'rad-dose' }, 'Absorbed dose', doseV), doseS, h('div', { class: 'range-ends' }, h('span', {}, '0.1 µGy'), h('span', {}, '1 Gy'), h('span', {}, '1000 Gy'))),
        h('div', { class: 'field' }, h('label', { for: 'rad-time' }, 'Time after exposure', timeV), timeS),
        h('div', { class: 'row' }, radBtn, playBtn)),
      group('Where your atoms were born', mix),
      group('Elements in you', list),
    ],
    main: [stage, h('div', { class: 'row' }, starBtn, rotBtn, h('span', { class: 'hint-text' }, 'Drag to rotate · scroll or pinch to zoom where you point')), radCard, info],
  });

  build(); renderList(); renderInfo(); renderMix();
  return { show() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }, hide() { cancelAnimationFrame(raf); raf = 0; } };
}
function seg(items, cur, on) { const el = h('div', { class: 'seg' }, items.map(([k, l]) => h('button', { 'data-k': k, class: k === cur ? 'on' : '', onclick: () => { setSeg(el, k); on(k); } }, l))); return el; }
function setSeg(el, k) { for (const b of el.children) b.classList.toggle('on', b.dataset.k === k); }
function s(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v' }, String(v))); }
