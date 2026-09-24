import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { h, fmt, sci, clamp, easeInOut } from '../util.js';
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
const REGION_COLORS = { soft: '#e28c7a', skin: '#f0c7a0', bone: '#eeeadf', blood: '#e0303a', brain: '#f2a6c4', thyroid: '#ff9f40', liver: '#9c3b2a' };

// Stylised body: capsules [ax, ay, az, bx, by, bz, radius]
const PARTS = [
  [0, 1.62, 0, 0, 1.66, 0, 0.1], // head
  [0, 1.45, 0, 0, 1.55, 0, 0.055], // neck
  [0, 1.05, 0, 0, 1.38, 0, 0.16], // chest/abdomen
  [-0.11, 1.35, 0, 0.11, 1.35, 0, 0.1], // shoulders
  [0, 0.92, 0, 0, 1.0, 0, 0.15], // pelvis
  [-0.21, 1.36, 0, -0.27, 1.08, 0.02, 0.05], [0.21, 1.36, 0, 0.27, 1.08, 0.02, 0.05], // upper arms
  [-0.27, 1.07, 0.02, -0.3, 0.82, 0.08, 0.042], [0.27, 1.07, 0.02, 0.3, 0.82, 0.08, 0.042], // forearms
  [-0.3, 0.8, 0.08, -0.31, 0.72, 0.1, 0.035], [0.3, 0.8, 0.08, 0.31, 0.72, 0.1, 0.035], // hands
  [-0.09, 0.9, 0, -0.1, 0.5, 0, 0.075], [0.09, 0.9, 0, 0.1, 0.5, 0, 0.075], // thighs
  [-0.1, 0.48, 0, -0.1, 0.08, -0.01, 0.055], [0.1, 0.48, 0, 0.1, 0.08, -0.01, 0.055], // shins
  [-0.1, 0.04, 0.02, -0.1, 0.03, 0.13, 0.035], [0.1, 0.04, 0.02, 0.1, 0.03, 0.13, 0.035], // feet
];
const BONES = [
  [0, 1.0, -0.05, 0, 1.5, -0.05, 0.018], // spine
  [-0.09, 0.9, 0, -0.1, 0.5, 0, 0.02], [0.09, 0.9, 0, 0.1, 0.5, 0, 0.02], // femurs
  [-0.1, 0.48, 0, -0.1, 0.08, -0.01, 0.016], [0.1, 0.48, 0, 0.1, 0.08, -0.01, 0.016],
  [-0.21, 1.36, 0, -0.27, 1.08, 0.02, 0.014], [0.21, 1.36, 0, 0.27, 1.08, 0.02, 0.014],
  [-0.27, 1.07, 0.02, -0.3, 0.82, 0.08, 0.011], [0.27, 1.07, 0.02, 0.3, 0.82, 0.08, 0.011],
  [-0.2, 1.38, 0, 0.2, 1.38, 0, 0.012], // collarbones
  [-0.13, 0.95, 0, 0.13, 0.95, 0, 0.03], // pelvis
  [-0.1, 0.04, 0.02, -0.1, 0.03, 0.13, 0.012], [0.1, 0.04, 0.02, 0.1, 0.03, 0.13, 0.012],
];
const rnd = Math.random;
function inCapsule(c) { // random point inside a capsule
  for (;;) {
    const t = rnd(), [ax, ay, az, bx, by, bz, r] = c;
    const x = (rnd() * 2 - 1) * r, y = (rnd() * 2 - 1) * r, z = (rnd() * 2 - 1) * r * 0.8;
    if (x * x + y * y + z * z > r * r) continue;
    return [ax + (bx - ax) * t + x, ay + (by - ay) * t + y, az + (bz - az) * t + z];
  }
}
const vol = c => { const [ax, ay, az, bx, by, bz, r] = c; return r * r * (Math.hypot(bx - ax, by - ay, bz - az) + r); };
function pickPart(parts) { const tot = parts.reduce((a, c) => a + vol(c), 0); let x = rnd() * tot; for (const c of parts) { x -= vol(c); if (x <= 0) return c; } return parts[0]; }
function sampleRegion(region) {
  switch (region) {
    case 'bone': {
      if (rnd() < 0.18) { const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = 0.095; return [Math.sqrt(1 - u * u) * Math.cos(t) * r, 1.64 + u * r, Math.sqrt(1 - u * u) * Math.sin(t) * r * 0.95]; } // skull
      if (rnd() < 0.25) { const k = (rnd() * 10) | 0, a = rnd() * Math.PI * 1.7 - Math.PI * 0.85, y = 1.34 - k * 0.028; return [Math.sin(a) * 0.14, y, Math.cos(a) * 0.09 - 0.01]; } // ribs
      return inCapsule(pickPart(BONES));
    }
    case 'blood': {
      if (rnd() < 0.35) { const [x, y, z] = inCapsule([0.03, 1.22, 0.04, 0.03, 1.26, 0.04, 0.045]); return [x, y, z]; } // heart
      const b = pickPart(BONES.slice(1, 9)); const p = inCapsule(b); return [p[0] + 0.025, p[1], p[2] + 0.02];
    }
    case 'brain': { const p = inCapsule([0, 1.64, 0, 0, 1.68, 0, 0.075]); return p; }
    case 'thyroid': return inCapsule([-0.02, 1.47, 0.045, 0.02, 1.47, 0.045, 0.014]);
    case 'liver': return inCapsule([-0.05, 1.12, 0.03, 0.08, 1.13, 0.03, 0.06]);
    case 'skin': { const c = pickPart(PARTS); const p = inCapsule(c); const [ax, ay, az, bx, by, bz, r] = c; const t = clamp(((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay) + (p[2] - az) * (bz - az)) / ((bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2 || 1), 0, 1); const cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t, cz = az + (bz - az) * t; const d = Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz) || 1; return [cx + (p[0] - cx) / d * r, cy + (p[1] - cy) / d * r, cz + (p[2] - cz) / d * r * 0.8]; }
    default: return inCapsule(pickPart(PARTS));
  }
}

export function buildBody(root, { openElement }) {
  const N = 60000;
  const st = { color: 'element', count: 'atoms', focus: null, srcFocus: null, mass: 70, layers: { soft: true, skin: true, bone: true, blood: true, brain: true, thyroid: true, liver: true }, stars: false };
  // atoms per element (relative) for the "by atoms" view
  const atoms = BODY.map(([s, pct]) => pct / bySym[s].mass);
  const atomsTot = atoms.reduce((a, b) => a + b, 0);

  const canvas = h('canvas', { 'aria-label': '3D human body made of elements' });
  const labels = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
  const stage = h('div', { class: 'stage stage-tall body-stage' }, canvas, labels);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  camera.position.set(0, 1.05, 3.1);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { zoomToCursor: true, enableDamping: true, autoRotate: true, autoRotateSpeed: 1.2, minDistance: 0.4, maxDistance: 9 });
  controls.target.set(0, 0.95, 0);

  // Build the point cloud
  const pos = new Float32Array(N * 3), home = new Float32Array(N * 3), star = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const elIdx = new Uint8Array(N), region = [], srcOf = new Uint8Array(N);
  const REGIONS = Object.keys(REGION_COLORS);
  function build() {
    // points per element: proportional to atoms or mass, with a floor so trace elements are visible
    const w = BODY.map(([, pct], i) => (st.count === 'atoms' ? atoms[i] / atomsTot : pct / 100));
    const floor = 260, free = N - floor * BODY.length;
    const counts = w.map(x => floor + Math.round(x * free));
    let k = 0;
    const centers = SOURCE_ORDER.map((s0, i) => { const a = (i / SOURCE_ORDER.length) * Math.PI * 2; return [Math.cos(a) * 2.2, 1.0 + Math.sin(a) * 1.3, -0.6]; });
    BODY.forEach(([sym, , regs], i) => {
      const el = bySym[sym], regKeys = Object.keys(regs), regW = regKeys.map(r => regs[r]);
      for (let j = 0; j < counts[i] && k < N; j++, k++) {
        let x = rnd(), r = regKeys[0];
        for (let q = 0; q < regKeys.length; q++) { x -= regW[q]; if (x <= 0) { r = regKeys[q]; break; } }
        const p = sampleRegion(r);
        home.set(p, k * 3); pos.set(p, k * 3); elIdx[k] = i; region[k] = r;
        // cosmic source of this very atom, drawn from the element's origin mix
        let y = rnd() * 100, src = el.origin[0].src;
        for (const o of el.origin) { y -= o.pct; if (y <= 0) { src = o.src; break; } }
        const si = SOURCE_ORDER.indexOf(src); srcOf[k] = si;
        const c = centers[si], u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, rr = Math.cbrt(rnd()) * 0.42;
        star.set([c[0] + Math.sqrt(1 - u * u) * Math.cos(t) * rr, c[1] + u * rr, c[2] + Math.sqrt(1 - u * u) * Math.sin(t) * rr], k * 3);
      }
    });
    for (; k < N; k++) { home.set([0, -99, 0], k * 3); pos.set([0, -99, 0], k * 3); star.set([0, -99, 0], k * 3); elIdx[k] = 0; region[k] = 'soft'; }
    geo.attributes.position.needsUpdate = true;
    colorize();
    centersRef = centers;
  }
  let centersRef = [];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const mat = new THREE.PointsMaterial({ size: 0.011, vertexColors: true, map: dot, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  // Smooth glowing silhouette (fresnel rim light) around the atoms
  const shellMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#7fb8ff') }, uAlpha: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uColor * f, f * 0.55 * uAlpha); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const shell = new THREE.Group();
  for (const [ax, ay, az, bx, by, bz, r] of PARTS) {
    const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r * 1.05, len, 8, 24), shellMat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    if (len > 1e-6) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.scale.z = 0.8;
    shell.add(m);
  }
  scene.add(shell);
  const floor = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.42, 64), new THREE.MeshBasicMaterial({ color: 0x7fb8ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; scene.add(floor);
  const ELCOL = { H: '#e8f1ff', O: '#ff4d4d', C: '#9aa0a6', N: '#4f7dff', Ca: '#3ddc84', P: '#ff9f1a', K: '#b58cff', S: '#ffe14d', Na: '#9b6bff', Cl: '#4de0a0', Mg: '#7dff6b', Fe: '#ff7a1a', F: '#b0ff4d', Zn: '#8c9dff', Si: '#f0c89a', Cu: '#ff9966', I: '#c04dff', Se: '#ffa64d', Mn: '#a080ff', Mo: '#60d0c0', Co: '#ff80b0', Cr: '#90a0c0' };
  const tmp = new THREE.Color();
  function colorize() {
    for (let k = 0; k < N; k++) {
      const i = elIdx[k], sym = BODY[i][0];
      const visible = st.layers[region[k]] && (!st.focus || st.focus === sym) && (st.srcFocus == null || srcOf[k] === st.srcFocus);
      let c;
      if (st.color === 'element') c = ELCOL[sym] || CATEGORIES[bySym[sym].cat].color;
      else if (st.color === 'origin') c = SOURCES[SOURCE_ORDER[srcOf[k]]].color;
      else c = REGION_COLORS[region[k]];
      tmp.set(c);
      const hl = st.focus || st.srcFocus != null;
      const f = visible ? (hl ? 1 : 0.8) : (hl ? 0.035 : 0);
      col[k * 3] = tmp.r * f; col[k * 3 + 1] = tmp.g * f; col[k * 3 + 2] = tmp.b * f;
    }
    geo.attributes.color.needsUpdate = true;
    mat.size = st.focus || st.srcFocus != null ? 0.016 : 0.011;
  }

  // Animation between body and "back to the stars"
  let morph = 0, target = 0, raf = 0, last = 0;
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!canvas.offsetParent) return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    const r = stage.getBoundingClientRect();
    if (canvas.width !== Math.round(r.width * renderer.getPixelRatio())) { renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); }
    // move the camera so the whole scene stays in view (body close up, star clusters wide)
    const e0 = easeInOut(morph);
    if (camMove) {
      const want = new THREE.Vector3(0, 1.0 + e0 * 0.05, 3.1 + e0 * 5.2), wantT = new THREE.Vector3(0, 0.95 + e0 * 0.05, -0.6 * e0);
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
    controls.update();
    renderer.render(scene, camera);
    // source labels when exploded
    if (morph > 0.6 && centersRef.length) {
      labels.replaceChildren(...centersRef.map((c, i) => {
        const v = new THREE.Vector3(c[0], c[1] + 0.55, c[2]).project(camera);
        const s = SOURCES[SOURCE_ORDER[i]];
        return h('div', { style: { position: 'absolute', left: `${(v.x * 0.5 + 0.5) * 100}%`, top: `${(-v.y * 0.5 + 0.5) * 100}%`, transform: 'translate(-50%,-50%)', color: s.color, font: '700 14px var(--data)', textShadow: '0 1px 6px #000', whiteSpace: 'nowrap', opacity: morph } }, s.short);
      }));
    } else if (labels.childElementCount) labels.replaceChildren();
  }

  // ---------- UI ----------
  const colorSeg = seg([['element', 'Element'], ['origin', 'Cosmic origin'], ['region', 'Body part']], st.color, k => { st.color = k; colorize(); renderList(); });
  const countSeg = seg([['atoms', 'By number of atoms'], ['mass', 'By mass']], st.count, k => { st.count = k; build(); renderList(); });
  const massS = h('input', { type: 'range', id: 'body-mass', min: 3, max: 150, value: st.mass });
  const massV = h('b', {}, `${st.mass} kg`);
  massS.addEventListener('input', () => { st.mass = +massS.value; massV.textContent = `${st.mass} kg`; renderList(); renderInfo(); });
  const layerBox = h('div', { class: 'row' }, Object.keys(REGION_COLORS).map(r => h('label', { class: 'row small', style: { gap: '5px' } }, h('input', { type: 'checkbox', checked: true, onchange: e => { st.layers[r] = e.target.checked; colorize(); } }), h('span', { style: { width: '10px', height: '10px', borderRadius: '3px', background: REGION_COLORS[r], display: 'inline-block' } }), r === 'soft' ? 'muscle & organs' : r)));
  let camMove = false;
  const starBtn = h('button', { class: 'btn primary', onclick: () => { st.stars = !st.stars; target = st.stars ? 1 : 0; camMove = true; starBtn.textContent = st.stars ? 'Put me back together' : 'Send my atoms back to the stars'; controls.autoRotate = !st.stars; if (st.stars) { st.color = 'origin'; setSeg(colorSeg, 'origin'); colorize(); } } }, 'Send my atoms back to the stars');
  const rotBtn = h('button', { class: 'btn small', onclick: () => { controls.autoRotate = !controls.autoRotate; } }, 'Rotate on/off');
  const list = h('div', { class: 'el-list' });
  const info = h('div', { class: 'card stack' });
  const mix = h('div', { class: 'stack', style: { gap: '8px' } });

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
    const m = {}; let t = 0;
    for (let k = 0; k < N; k++) if (home[k * 3 + 1] > -50) { const src = SOURCE_ORDER[srcOf[k]]; m[src] = (m[src] || 0) + 1; t++; }
    // true atom-weighted mix (not the display-boosted one)
    const real = {}; let rt = 0;
    BODY.forEach(([sym], i) => { const wgt = st.count === 'atoms' ? atoms[i] : BODY[i][1]; for (const o of bySym[sym].origin) { real[o.src] = (real[o.src] || 0) + wgt * o.pct; rt += wgt * o.pct; } });
    const arr = SOURCE_ORDER.filter(k => real[k]).map(k => [k, real[k] / rt * 100]).sort((a, b) => b[1] - a[1]);
    const pickSrc = k => { const i = SOURCE_ORDER.indexOf(k); st.srcFocus = st.srcFocus === i ? null : i; if (st.srcFocus != null) { st.focus = null; st.color = 'origin'; setSeg(colorSeg, 'origin'); } colorize(); renderMix(); renderList(); };
    const onK = k => st.srcFocus === SOURCE_ORDER.indexOf(k);
    mix.replaceChildren(h('div', { class: 'origin-bar' }, arr.map(([k, p]) => h('button', { class: onK(k) ? 'on' : '', title: `${SOURCES[k].name} ${p.toFixed(1)}%`, style: { flex: p, background: SOURCES[k].color }, onclick: () => pickSrc(k) }))),
      h('div', { class: 'origin-legend' }, arr.map(([k, p]) => h('button', { class: onK(k) ? 'on' : '', onclick: () => pickSrc(k) }, h('span', { style: { width: '12px', height: '12px', borderRadius: '4px', background: SOURCES[k].color, display: 'block' } }), SOURCES[k].name, h('span', { class: 'pct' }, `${p < 0.1 && p > 0 ? p.toFixed(3) : p.toFixed(1)}%`)))),
      h('p', { class: 'hint-text', style: { margin: 0 } }, st.srcFocus != null ? `Showing only atoms made by ${SOURCES[SOURCE_ORDER[st.srcFocus]].name.toLowerCase()}. Tap it again to show everything.` : 'Tap a source to light up its atoms in the body.'),
      h('p', { class: 'hint-text', style: { margin: 0 } }, st.count === 'atoms' ? 'Counting atoms, most of you is Big Bang hydrogen, 13.8 billion years old.' : 'By mass, most of you is oxygen and carbon forged in stars.'));
    void m; void t;
  }

  workspace(root, {
    eyebrow: 'Human Body', title: 'The stardust you are made of', intro: 'Every glowing dot is a sample of your atoms, placed where that element really lives in the body.',
    side: [
      group('View', h('div', { class: 'field' }, h('label', {}, 'Colour by'), colorSeg), h('div', { class: 'field' }, h('label', {}, 'Count'), countSeg), h('div', { class: 'field' }, h('label', { for: 'body-mass' }, 'Body mass', massV), massS), h('div', { class: 'field' }, h('label', {}, 'Show'), layerBox)),
      group('Where your atoms were born', mix),
      group('Elements in you', list),
    ],
    main: [stage, h('div', { class: 'row' }, starBtn, rotBtn, h('span', { class: 'hint-text' }, 'Drag to rotate · scroll or pinch to zoom where you point')), info],
  });

  build(); renderList(); renderInfo(); renderMix();
  countSeg.addEventListener('click', () => renderMix());
  return { show() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }, hide() { cancelAnimationFrame(raf); raf = 0; } };
}
function seg(items, cur, on) { const el = h('div', { class: 'seg' }, items.map(([k, l]) => h('button', { 'data-k': k, class: k === cur ? 'on' : '', onclick: () => { setSeg(el, k); on(k); } }, l))); return el; }
function setSeg(el, k) { for (const b of el.children) b.classList.toggle('on', b.dataset.k === k); }
function s(k, v) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v' }, String(v))); }
