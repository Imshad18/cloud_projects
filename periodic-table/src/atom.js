import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { sampleAtom, L_COLORS } from './orbitals.js';

// One shared WebGL viewer, re-attached to whichever panel shows it.
let viewer = null;

export function atomViewer() {
  if (!viewer) viewer = new AtomViewer();
  return viewer;
}

class AtomViewer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(0, 6, 22);
    this.controls = new OrbitControls(this.camera, this.canvas);
    Object.assign(this.controls, { zoomToCursor: true, enableDamping: true, autoRotate: true, autoRotateSpeed: 0.8, enablePan: false, minDistance: 3, maxDistance: 80 });
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(5, 8, 10); this.scene.add(d);
    const p = new THREE.PointLight(0xffd27a, 30, 30); this.scene.add(p);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.speed = 1; this.electrons = [];
    this.glowTex = this.makeGlow();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
  }
  makeGlow() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(160,220,255,1)'); g.addColorStop(0.3, 'rgba(90,170,255,.5)'); g.addColorStop(1, 'rgba(60,120,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  mount(container) {
    container.prepend(this.canvas);
    this.container = container;
    this.resize();
    if (!this.running) { this.running = true; requestAnimationFrame(this.loop); }
  }
  resize() {
    const r = this.container.getBoundingClientRect();
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height || 1; this.camera.updateProjectionMatrix();
  }
  // Quantum mode: probability clouds for every occupied orbital.
  showOrbitals(el, { hidden = new Set(), color = 'type' } = {}) {
    this.group.clear(); this.electrons = [];
    if (this.cacheEl !== el) { this.cache = sampleAtom(el); this.cacheEl = el; }
    const subs = this.cache;
    const outer = Math.max(...subs.map(s => s.rmean)) || 1;
    const scale = 7 / (outer * 1.6);
    const dot = this.dotTex || (this.dotTex = this.makeDot());
    for (const s of subs) {
      if (hidden.has(s.name)) continue;
      s.orbitals.forEach((o, k) => {
        const n = o.sign.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        const base = new THREE.Color(L_COLORS[s.l]).offsetHSL((k - (s.orbitals.length - 1) / 2) * 0.05, 0, 0);
        const plus = new THREE.Color('#ff7a59'), minus = new THREE.Color('#4da3ff');
        for (let i = 0; i < n; i++) {
          pos[i * 3] = o.points[i * 3] * scale; pos[i * 3 + 1] = o.points[i * 3 + 1] * scale; pos[i * 3 + 2] = o.points[i * 3 + 2] * scale;
          const c = color === 'phase' ? (o.sign[i] > 0 ? plus : minus) : base;
          col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const m = new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.75, map: dot, blending: THREE.AdditiveBlending, depthWrite: false });
        this.group.add(new THREE.Points(g, m));
      });
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    this.group.add(core);
    this.camera.position.setLength(18);
    this.controls.update();
    return subs;
  }
  makeDot() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }
  show(el, iso) {
    this.group.clear(); this.electrons = [];
    const Z = el.n, A = iso ? iso.a : Math.round(el.mass), N = A - Z;
    // Nucleus: real proton and neutron counts, packed as a ball.
    const nucR = 0.42 * Math.cbrt(A);
    const sphere = new THREE.SphereGeometry(0.34, 14, 10);
    const pm = new THREE.MeshStandardMaterial({ color: 0xff4d5e, roughness: 0.35, metalness: 0.1, emissive: 0x330008 });
    const nm = new THREE.MeshStandardMaterial({ color: 0x7f9cff, roughness: 0.35, metalness: 0.1, emissive: 0x08102a });
    const protons = new THREE.InstancedMesh(sphere, pm, Z), neutrons = new THREE.InstancedMesh(sphere, nm, Math.max(N, 1));
    const ids = Array.from({ length: A }, (_, i) => i);
    for (let i = ids.length - 1; i > 0; i--) { const j = (i * 7919 + 13) % (i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const m = new THREE.Matrix4(); let pi = 0, ni = 0;
    for (let k = 0; k < A; k++) {
      const i = ids[k];
      const r = nucR * Math.cbrt((i + 0.5) / A), th = i * 2.39996323, ph = Math.acos(1 - 2 * ((i + 0.5) / A));
      m.makeTranslation(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
      if (pi < Z && (k % 2 === 0 || ni >= N)) protons.setMatrixAt(pi++, m); else if (ni < N) neutrons.setMatrixAt(ni++, m); else protons.setMatrixAt(pi++, m);
    }
    this.group.add(protons); if (N > 0) this.group.add(neutrons);
    // Electron shells.
    const shells = el.shells || [];
    const eGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const eMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff });
    shells.forEach((count, s) => {
      const R = nucR + 1.8 + s * 1.55;
      const tilt = new THREE.Group();
      tilt.rotation.set((s * 1.1) % Math.PI, (s * 0.7) % Math.PI, 0);
      const ringGeo = new THREE.TorusGeometry(R, 0.018, 6, 120);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x5f7cff, transparent: true, opacity: 0.35 }));
      tilt.add(ring);
      for (let k = 0; k < count; k++) {
        const e = new THREE.Mesh(eGeo, eMat);
        const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        g.scale.set(0.9, 0.9, 1); e.add(g);
        e.userData = { R, a: (k / count) * Math.PI * 2, w: 1.6 / Math.pow(s + 1, 1.2) };
        tilt.add(e); this.electrons.push(e);
      }
      this.group.add(tilt);
    });
    const outer = nucR + 1.8 + Math.max(0, shells.length - 1) * 1.55;
    this.camera.position.setLength(Math.max(9, outer * 3.1));
    this.controls.update();
  }
  loop() {
    if (!this.container || !this.canvas.isConnected) { this.running = false; return; }
    requestAnimationFrame(this.loop);
    if (!this.canvas.offsetParent) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    for (const e of this.electrons) {
      const u = e.userData; u.a += u.w * dt * this.speed;
      e.position.set(Math.cos(u.a) * u.R, Math.sin(u.a) * u.R, 0);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
