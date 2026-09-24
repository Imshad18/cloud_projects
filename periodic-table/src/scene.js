import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ELEMENTS } from './store.js';
import { SOURCES, SOURCE_ORDER } from './data/origins.js';
import { easeInOut, h, reducedMotion } from './util.js';

const TW = 140, TH = 180;

export class TableScene {
  constructor({ onSelect, onHover }) {
    this.onSelect = onSelect; this.onHover = onHover;
    this.objects = []; this.tiles = []; this.labels = [];
    this.targets = {}; this.layout = 'table';
    this.tweens = []; this.bursts = [];
    this.active = true; this.cssDirty = true;

    const W = innerWidth, H = innerHeight;
    this.camera = new THREE.PerspectiveCamera(40, W / H, 1, 40000);
    this.camera.position.set(0, 0, 3200);
    this.scene = new THREE.Scene();   // CSS3D scene
    this.bg = new THREE.Scene();      // WebGL scene

    this.gl = new THREE.WebGLRenderer({ canvas: document.getElementById('bg'), antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.gl.setSize(W, H, false);
    this.gl.setClearColor(0x06070f, 1);

    this.css = new CSS3DRenderer();
    this.css.setSize(W, H);
    document.getElementById('css3d').append(this.css.domElement);

    this.controls = new OrbitControls(this.camera, this.css.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.5, zoomSpeed: 0.9, minDistance: 300, maxDistance: 12000, screenSpacePanning: true });
    this.controls.addEventListener('change', () => { this.cssDirty = true; });

    this.buildStars();
    this.buildTiles();
    this.buildLayouts();
    this.bindPointer();
    this.fitCamera(true);
    addEventListener('resize', () => this.resize());

    // Start scattered, then fly into the table.
    for (const o of this.objects) {
      o.position.set((Math.random() - 0.5) * 6000, (Math.random() - 0.5) * 6000, (Math.random() - 0.5) * 6000);
      o.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    }
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  // ---------- background ----------
  buildStars() {
    const N = 5000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
    const tint = [[1, 1, 1], [0.7, 0.8, 1], [1, 0.85, 0.6], [1, 0.7, 0.6], [0.8, 0.9, 1]];
    for (let i = 0; i < N; i++) {
      const r = 7000 + Math.random() * 12000, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3);
      const t = tint[(Math.random() * tint.length) | 0];
      col.set(t, i * 3);
      size[i] = Math.pow(Math.random(), 3) * 3 + 0.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    this.starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: this.gl.getPixelRatio() } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; varying float vT; uniform float uTime; uniform float uScale;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0);
        vT=0.65+0.35*sin(uTime*1.5+position.x*0.013+position.y*0.007);
        gl_PointSize=size*uScale*2.0; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vT; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(vC*vT, a*vT); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(g, this.starMat);
    this.bg.add(this.stars);

    // Nebula clouds from soft canvas textures.
    this.nebulae = new THREE.Group();
    const cols = ['#5b3cc4', '#c23f8b', '#2a6fdb', '#ff7a3d', '#3aa6a0'];
    for (let i = 0; i < 9; i++) {
      const tex = this.cloudTexture(cols[i % cols.length]);
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
      const s = new THREE.Sprite(m);
      const r = 9000, th = Math.random() * Math.PI * 2, ph = Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      s.position.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th) - 3000);
      const sc = 7000 + Math.random() * 7000; s.scale.set(sc, sc * 0.7, 1);
      this.nebulae.add(s);
    }
    this.bg.add(this.nebulae);

    // Burst particle system.
    const BN = 1500;
    const bg = new THREE.BufferGeometry();
    this.bPos = new Float32Array(BN * 3); this.bCol = new Float32Array(BN * 3); this.bVel = new Float32Array(BN * 3); this.bLife = new Float32Array(BN);
    bg.setAttribute('position', new THREE.BufferAttribute(this.bPos, 3));
    bg.setAttribute('color', new THREE.BufferAttribute(this.bCol, 3));
    this.bGeo = bg; this.bNext = 0;
    const bm = new THREE.PointsMaterial({ size: 9, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, map: this.dotTexture(), sizeAttenuation: true });
    this.burstPts = new THREE.Points(bg, bm);
    this.burstPts.frustumCulled = false;
    this.bg.add(this.burstPts);
  }
  cloudTexture(color) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const px = 128 + (Math.random() - 0.5) * 120, py = 128 + (Math.random() - 0.5) * 100, r = 40 + Math.random() * 80;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, color + '55'); g.addColorStop(1, color + '00');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  dotTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  burst(obj, color = '#ffffff', n = 140) {
    if (reducedMotion()) return;
    const c = new THREE.Color(color), p = obj.position;
    for (let i = 0; i < n; i++) {
      const k = this.bNext; this.bNext = (this.bNext + 1) % this.bLife.length;
      this.bPos.set([p.x, p.y, p.z + 10], k * 3);
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), s = 200 + Math.random() * 700;
      this.bVel.set([s * Math.sin(ph) * Math.cos(th), s * Math.sin(ph) * Math.sin(th), s * Math.cos(ph)], k * 3);
      this.bCol.set([c.r, c.g, c.b], k * 3);
      this.bLife[k] = 1;
    }
    this.burstActive = true;
  }

  // ---------- tiles ----------
  buildTiles() {
    for (const e of ELEMENTS) {
      const stripe = h('div', { class: 'stripe' }, e.origin.map(o => h('i', { style: { width: o.pct + '%', background: SOURCES[o.src].color } })));
      const val = h('div', { class: 'val' });
      const tile = h('div', { class: 'tile', 'data-sym': e.sym, role: 'button', 'aria-label': `${e.name}, ${e.n}` },
        h('div', { class: 'z' }, String(e.n)),
        h('div', { class: 'm' }, e.mass >= 100 ? e.mass.toFixed(1) : e.mass.toFixed(2)),
        h('div', { class: 's' }, e.sym),
        h('div', { class: 'nm' }, e.name),
        val, stripe);
      tile._el = e; tile._val = val;
      const o = new CSS3DObject(tile);
      o._el = e;
      this.scene.add(o);
      this.objects.push(o); this.tiles.push(tile);
      tile.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') this.onHover?.(e, ev); });
      tile.addEventListener('pointerleave', () => this.onHover?.(null));
    }
  }

  bindPointer() {
    const dom = this.css.domElement;
    let down = null;
    dom.addEventListener('pointerdown', ev => {
      const t = ev.target.closest && ev.target.closest('.tile');
      down = { x: ev.clientX, y: ev.clientY, t: performance.now(), tile: t };
      this.onHover?.(null);
    }, true);
    addEventListener('pointerup', ev => {
      if (!down) return;
      const d = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
      if (down.tile && d < 8 && performance.now() - down.t < 700) {
        // The browser fires a click after a touch; keep it from landing on the panel that opens.
        if (ev.pointerType !== 'mouse') this.noClickUntil = performance.now() + 450;
        this.onSelect?.(down.tile._el);
      }
      down = null;
    });
    addEventListener('click', ev => { if (performance.now() < (this.noClickUntil || 0)) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  }

  // ---------- layouts ----------
  buildLayouts() {
    const mk = () => new THREE.Object3D();
    const N = ELEMENTS.length;
    // Table
    this.targets.table = ELEMENTS.map(e => {
      const o = mk();
      o.position.set((e.x - 9.5) * TW, -(e.y - 5.3) * TH - (e.y >= 9 ? 50 : 0), 0);
      return o;
    });
    // Sphere
    const v = new THREE.Vector3();
    this.targets.sphere = ELEMENTS.map((e, i) => {
      const o = mk();
      const phi = Math.acos(-1 + (2 * i) / N), th = Math.sqrt(N * Math.PI) * phi;
      o.position.setFromSphericalCoords(900, phi, th);
      v.copy(o.position).multiplyScalar(2); o.lookAt(v);
      return o;
    });
    // Helix (double)
    this.targets.helix = ELEMENTS.map((e, i) => {
      const o = mk();
      const th = i * 0.175 + Math.PI, y = -(i * 8) + 470;
      o.position.setFromCylindricalCoords(900, th, y);
      v.set(o.position.x * 2, o.position.y, o.position.z * 2); o.lookAt(v);
      return o;
    });
    // Grid
    this.targets.grid = ELEMENTS.map((e, i) => {
      const o = mk();
      o.position.set((i % 5) * 400 - 800, -(Math.floor(i / 5) % 5) * 400 + 800, Math.floor(i / 25) * 1000 - 2000);
      return o;
    });
    // By origin: clusters of tiles grouped by main source.
    const groups = {};
    for (const [i, e] of ELEMENTS.entries()) (groups[e.dom] ||= []).push(i);
    const order = SOURCE_ORDER.filter(k => groups[k]);
    this.targets.origins = new Array(N);
    const colsW = [], rows = 2, perRow = Math.ceil(order.length / rows);
    const clusterInfo = order.map(k => { const n = groups[k].length, c = Math.ceil(Math.sqrt(n * 1.3)); return { k, n, c, r: Math.ceil(n / c) }; });
    for (let row = 0; row < rows; row++) {
      const items = clusterInfo.slice(row * perRow, row * perRow + perRow);
      const widths = items.map(it => it.c * TW + 160);
      let x = -widths.reduce((a, b) => a + b, 0) / 2;
      items.forEach((it, j) => {
        const cx = x + widths[j] / 2; x += widths[j];
        const cy = row === 0 ? 700 : -700;
        const cz = (j % 2 ? -250 : 150);
        groups[it.k].forEach((idx, m) => {
          const o = mk();
          o.position.set(cx + ((m % it.c) - (it.c - 1) / 2) * TW, cy - (Math.floor(m / it.c) - (it.r - 1) / 2) * TH, cz);
          this.targets.origins[idx] = o;
        });
        colsW.push({ k: it.k, x: cx, y: cy + (it.r / 2) * TH + 90, z: cz });
      });
    }
    for (const c of colsW) {
      const s = SOURCES[c.k];
      const lbl = h('div', { class: 'cluster-label', style: { color: s.color } }, s.name, h('small', {}, `${groups[c.k].length} elements`));
      const o = new CSS3DObject(lbl); o.position.set(c.x, c.y, c.z); o._layout = 'origins';
      this.scene.add(o); this.labels.push(o);
    }
    // Discovery timeline
    const buckets = {};
    this.targets.timeline = ELEMENTS.map(e => {
      const o = mk();
      let col;
      if (e.year < 1650) col = -1; else col = Math.round((e.year - 1650) / 376 * 20);
      const k = buckets[col] = (buckets[col] || 0) + 1;
      o.position.set(col === -1 ? -1750 + ((k - 1) % 2) * TW : -1400 + col * TW, -900 + (col === -1 ? Math.floor((k - 1) / 2) : k - 1) * TH, 0);
      return o;
    });
    for (const [label, yr] of [['Ancient', null], ['1700', 1700], ['1800', 1800], ['1900', 1900], ['2000', 2000]]) {
      const x = yr == null ? -1680 : -1400 + Math.round((yr - 1650) / 376 * 20) * TW;
      const lbl = h('div', { class: 'cluster-label', style: { color: '#ffd27a' } }, label);
      const o = new CSS3DObject(lbl); o.position.set(x, -1080, 0); o._layout = 'timeline';
      this.scene.add(o); this.labels.push(o);
    }
  }

  setLayout(name, dur = 1.4) {
    this.layout = name;
    const tg = this.targets[name];
    const now = performance.now() / 1000;
    this.tweens = this.objects.map((o, i) => ({
      o, t0: now + (reducedMotion() ? 0 : Math.random() * dur * 0.35), d: reducedMotion() ? 0.01 : dur,
      p0: o.position.clone(), p1: tg[i].position.clone(), q0: o.quaternion.clone(), q1: tg[i].quaternion.clone(),
    }));
    for (const l of this.labels) l.element.classList.toggle('on', l._layout === name);
    this.fitCamera();
  }

  setInsets(top, bottom) {
    const changed = Math.abs((this.insets?.top || 0) - top) > 2 || Math.abs((this.insets?.bottom || 0) - bottom) > 2;
    this.insets = { top, bottom };
    if (changed) this.fitCamera(!this.fitted);
    this.fitted = true;
  }

  // Fit the current layout into the part of the screen not covered by the UI.
  fitCamera(instant = false) {
    const W = innerWidth, H = innerHeight, { top = 60, bottom = 120 } = this.insets || {};
    const freeH = Math.max(120, H - top - bottom), freeW = Math.max(200, W - 24);
    const vf = THREE.MathUtils.degToRad(this.camera.fov), tv = Math.tan(vf / 2);
    const sizes = { table: [2650, 1900], origins: [3300, 3000], timeline: [4000, 2500], sphere: [2100, 2100], helix: [2200, 1500], grid: [2000, 2000] };
    const [w, hh] = sizes[this.layout] || [2600, 2000];
    // world height visible at distance d is 2 d tan(vf/2); map the free pixels onto the layout size
    let dist = Math.max(hh / (2 * tv) * (H / freeH), w / (2 * tv * (W / H)) * (W / freeW));
    if (this.layout === 'grid') dist += 2000; else if (this.layout === 'sphere' || this.layout === 'helix') dist += 900;
    dist = Math.min(dist, 14000);
    const worldPerPx = (2 * dist * tv) / H;
    const lift = ((bottom - top) / 2) * worldPerPx; // shift the view so the layout centres in the free band
    const from = this.camera.position.clone(), fromT = this.controls.target.clone();
    const to = new THREE.Vector3(0, -lift, dist), toT = new THREE.Vector3(0, -lift, 0);
    if (instant) { this.camera.position.copy(to); this.controls.target.copy(toT); this.controls.update(); this.cssDirty = true; return; }
    this.camTween = { t0: performance.now() / 1000, d: 1.2, from, to, fromT, toT };
  }

  resize() {
    const W = innerWidth, H = innerHeight;
    this.camera.aspect = W / H; this.camera.updateProjectionMatrix();
    this.gl.setSize(W, H, false); this.css.setSize(W, H);
    this.cssDirty = true;
    clearTimeout(this.rt); this.rt = setTimeout(() => this.fitCamera(), 200);
  }

  // ---------- appearance ----------
  applyMode(mode) {
    for (const t of this.tiles) {
      const c = mode.color(t._el);
      t.style.setProperty('--c', c || '#3a3f58');
      t._val.textContent = mode.value ? mode.value(t._el) : '';
    }
  }
  applyFilter(match, ghost) {
    for (const t of this.tiles) {
      t.classList.toggle('ghost', !!ghost && ghost(t._el));
      t.classList.toggle('dim', !!match && !match(t._el));
    }
  }
  tileOf(e) { return this.tiles[e.n - 1]; }
  objOf(e) { return this.objects[e.n - 1]; }
  select(e) {
    for (const t of this.tiles) t.classList.remove('sel');
    if (e) { this.tileOf(e).classList.add('sel'); }
  }
  flash(e, cls) {
    const t = this.tileOf(e);
    t.classList.remove(cls); void t.offsetWidth; t.classList.add(cls);
    setTimeout(() => t.classList.remove(cls), 1100);
  }
  setActive(on) {
    this.active = on;
    document.getElementById('stage').style.visibility = on ? '' : 'hidden';
    if (on) { this.cssDirty = true; requestAnimationFrame(this.animate); }
  }

  animate() {
    if (!this.active) return;
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05), now = performance.now() / 1000;
    // tile tweens
    if (this.tweens.length) {
      let alive = false;
      for (const tw of this.tweens) {
        const k = Math.min(1, Math.max(0, (now - tw.t0) / tw.d));
        if (k < 1) alive = true;
        const e = easeInOut(k);
        tw.o.position.lerpVectors(tw.p0, tw.p1, e);
        tw.o.quaternion.slerpQuaternions(tw.q0, tw.q1, e);
      }
      if (!alive) this.tweens = [];
      this.cssDirty = true;
    }
    if (this.camTween) {
      const c = this.camTween, k = Math.min(1, (now - c.t0) / c.d), e = easeInOut(k);
      this.camera.position.lerpVectors(c.from, c.to, e);
      this.controls.target.lerpVectors(c.fromT, c.toT, e);
      if (k >= 1) this.camTween = null;
      this.cssDirty = true;
    }
    this.controls.update();
    // bursts
    if (this.burstActive) {
      let any = false;
      for (let i = 0; i < this.bLife.length; i++) {
        if (this.bLife[i] <= 0) continue;
        any = true;
        this.bLife[i] -= dt * 0.8;
        const f = Math.max(0, this.bLife[i]);
        for (let a = 0; a < 3; a++) { this.bPos[i * 3 + a] += this.bVel[i * 3 + a] * dt; this.bVel[i * 3 + a] *= 0.97; }
        if (f <= 0) { this.bPos[i * 3 + 2] = -1e6; }
        this.bCol[i * 3] *= 0.985; this.bCol[i * 3 + 1] *= 0.985; this.bCol[i * 3 + 2] *= 0.985;
      }
      this.bGeo.attributes.position.needsUpdate = true; this.bGeo.attributes.color.needsUpdate = true;
      this.burstActive = any;
    }
    this.starMat.uniforms.uTime.value = now;
    this.stars.rotation.y += dt * 0.004;
    this.nebulae.rotation.y += dt * 0.002;
    this.gl.render(this.bg, this.camera);
    if (this.cssDirty) { this.css.render(this.scene, this.camera); this.cssDirty = false; }
  }
}
