// 3D event display: CMS-like cylindrical detector, helical tracks in a 3.8 T solenoid field.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const B = 3.8; // tesla
const R_TRK = 1.2, R_ECAL = 1.29, R_ECAL2 = 1.8, R_HCAL2 = 2.9, R_MAG = 3.2, R_MU = 7.0, Z_HALF = 3.0, Z_MU = 10.5;
const COL = { mu: 0xff4d5e, e: 0x6ee7a8, gamma: 0xffe066, trkp: 0x8fd2ff, trkn: 0xffc478, jet: 0xffb347, bjet: 0xff8a3d, nu: 0xb388ff, tau: 0xff79c6 };

export class Detector3D {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', touchAction: 'none' });
    container.append(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x050507, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
    this.camera.position.set(11, 6, 13);
    this.controls = new OrbitControls(this.camera, this.canvas);
    Object.assign(this.controls, { zoomToCursor: true, enableDamping: true, autoRotate: true, autoRotateSpeed: 0.6, minDistance: 1.5, maxDistance: 60 });
    this.buildDetector();
    this.event = new THREE.Group(); this.scene.add(this.event);
    this.tracks = []; this.t = 0; this.raf = 0; this.last = 0;
    this.loop = this.loop.bind(this);
  }
  buildDetector() {
    const g = new THREE.Group();
    const shell = (r, len, color, opacity) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 64, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = Math.PI / 2; g.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(r, r, len, 32, 1, true)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(1, opacity * 3) }));
      e.rotation.x = Math.PI / 2; g.add(e);
    };
    shell(R_TRK, Z_HALF * 2 * 0.9, 0x6ee7a8, 0.035);
    shell(R_ECAL2, Z_HALF * 2, 0x5cc8f0, 0.04);
    shell(R_HCAL2, Z_HALF * 2 * 1.05, 0x5c7cf0, 0.035);
    shell(R_MAG, Z_HALF * 2 * 1.1, 0xa0a0b0, 0.06);
    for (const r of [4.2, 5.4, 6.6]) shell(r, Z_MU * 1.3, 0xff6b7d, 0.025);
    // beam pipe
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x888899, transparent: true, opacity: 0.35 }));
    pipe.rotation.x = Math.PI / 2; g.add(pipe);
    this.scene.add(g);
    this.flash = new THREE.PointLight(0xffffff, 0, 10); this.scene.add(this.flash);
    const dot = document.createElement('canvas'); dot.width = dot.height = 64;
    const x = dot.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(dot), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.scene.add(this.glow);
  }
  // particles: {type, q, px, py, pz, E, soft}
  show(scene) {
    this.event.clear(); this.tracks = []; this.t = 0;
    if (!scene || scene.kind !== 'detector') return;
    const beamAxis = new THREE.Vector3(0, 0, 1);
    for (const p of scene.particles) {
      const pt = Math.hypot(p.px, p.py) || 1e-6, ptot = Math.hypot(pt, p.pz);
      const charged = p.q && (p.type === 'trk' || p.type === 'mu' || p.type === 'e' || p.type === 'tau');
      if (charged) {
        const R = pt / (0.3 * B); // metres
        const tanL = p.pz / pt, phi0 = Math.atan2(p.py, p.px), q = p.q;
        const maxR = p.type === 'mu' ? R_MU : p.type === 'e' ? R_ECAL : R_TRK;
        const pts = [];
        const steps = 220, sMax = Math.min(40, (maxR * 2.4) * Math.sqrt(1 + tanL * tanL));
        for (let i = 0; i <= steps; i++) {
          const s = (i / steps) * sMax / Math.sqrt(1 + tanL * tanL); // transverse path length
          let x, y;
          if (p.type === 'mu' && i > 0) { // bends one way inside the solenoid, the other way in the return yoke
            const sIn = Math.min(s, R_MAG);
            const a = -q * sIn / R;
            x = R * q * (Math.sin(phi0) - Math.sin(phi0 + a)); y = R * q * (Math.cos(phi0 + a) - Math.cos(phi0));
            if (s > R_MAG) { const dirA = phi0 + a; x += Math.cos(dirA) * (s - R_MAG); y += Math.sin(dirA) * (s - R_MAG); }
          } else {
            const a = -q * s / R;
            x = R * q * (Math.sin(phi0) - Math.sin(phi0 + a)); y = R * q * (Math.cos(phi0 + a) - Math.cos(phi0));
          }
          const z = s * tanL;
          if (Math.hypot(x, y) > maxR || Math.abs(z) > (p.type === 'mu' ? Z_MU : Z_HALF)) break;
          pts.push(new THREE.Vector3(x, y, z));
        }
        if (pts.length < 2) continue;
        const color = p.type === 'mu' ? COL.mu : p.type === 'e' ? COL.e : p.type === 'tau' ? COL.tau : q > 0 ? COL.trkp : COL.trkn;
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: p.soft ? 0.55 : 1 }));
        geo.setDrawRange(0, 0);
        this.event.add(line); this.tracks.push({ geo, n: pts.length });
        if (p.type === 'e') this.tower(pts[pts.length - 1], 0x6ee7a8, Math.min(1, p.E / 50), R_ECAL, R_ECAL2);
        if (p.type === 'mu' && !p.soft) for (const r of [4.2, 5.4, 6.6]) { const hit = pts.find(v => Math.hypot(v.x, v.y) > r); if (hit) this.hit(hit, 0xff4d5e); }
      } else if (p.type === 'gamma' || p.type === 'nh') {
        const dir = new THREE.Vector3(p.px, p.py, p.pz).normalize();
        const rIn = p.type === 'gamma' ? R_ECAL : R_ECAL2, rOut = p.type === 'gamma' ? R_ECAL2 : R_HCAL2;
        const tHit = Math.min(rIn / (Math.hypot(dir.x, dir.y) || 1e-6), Z_HALF / (Math.abs(dir.z) || 1e-6));
        const end = dir.clone().multiplyScalar(tHit);
        if (p.type === 'gamma' && !p.soft) {
          const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), end]);
          const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: COL.gamma, dashSize: 0.12, gapSize: 0.08 }));
          line.computeLineDistances(); geo.setDrawRange(0, 0); this.event.add(line); this.tracks.push({ geo, n: 2 });
        }
        this.tower(end, p.type === 'gamma' ? 0x6ee7a8 : 0x5cc8f0, Math.min(1, pt / (p.soft ? 6 : 40)), rIn, rOut);
      } else if (p.type === 'jet' || p.type === 'bjet') {
        const dir = new THREE.Vector3(p.px, p.py, p.pz).normalize();
        const len = 2.6, ang = 0.2;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(len * Math.tan(ang), len, 24, 1, true), new THREE.MeshBasicMaterial({ color: p.type === 'bjet' ? COL.bjet : COL.jet, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
        cone.geometry.translate(0, -len / 2, 0); cone.geometry.rotateX(Math.PI);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        this.event.add(cone);
        this.tower(dir.clone().multiplyScalar(R_ECAL2 / Math.max(0.2, Math.hypot(dir.x, dir.y))), 0x5cc8f0, Math.min(1, pt / 60), R_ECAL2, R_HCAL2);
      } else if (p.type === 'nu') {
        const d = new THREE.Vector3(p.px, p.py, 0).normalize().multiplyScalar(R_MU);
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), d]);
        const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: COL.nu, dashSize: 0.3, gapSize: 0.2 }));
        line.computeLineDistances(); this.event.add(line);
      }
    }
    void beamAxis;
    this.flash.intensity = 40;
  }
  tower(at, color, f, r0, r1) {
    const dir = new THREE.Vector3(at.x, at.y, 0); const rho = dir.length() || 1; dir.normalize();
    const len = (r1 - r0) * Math.max(0.12, f);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, len), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    m.position.set(dir.x * (r0 + len / 2), dir.y * (r0 + len / 2), at.z * (r0 / rho));
    m.lookAt(0, 0, m.position.z);
    this.event.add(m);
  }
  hit(at, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.05), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    m.position.copy(at); m.lookAt(0, 0, at.z); this.event.add(m);
  }
  resize() {
    const r = this.container.getBoundingClientRect();
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = (r.width / r.height) || 1; this.camera.updateProjectionMatrix();
  }
  start() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.loop); } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  loop(ts) {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.canvas.offsetParent) return;
    const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000); this.last = ts; this.t += dt;
    const r = this.container.getBoundingClientRect();
    if (Math.abs(this.canvas.width - r.width * this.renderer.getPixelRatio()) > 2) this.resize();
    const f = Math.min(1, this.t / 1.1);
    for (const tr of this.tracks) tr.geo.setDrawRange(0, Math.max(2, Math.floor(tr.n * f)));
    this.flash.intensity *= 0.9;
    this.glow.scale.setScalar(Math.max(0.01, 1.4 * (1 - this.t * 1.5)));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
