import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
    Object.assign(this.controls, { enableDamping: true, autoRotate: true, autoRotateSpeed: 0.8, enablePan: false, minDistance: 3, maxDistance: 80 });
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
