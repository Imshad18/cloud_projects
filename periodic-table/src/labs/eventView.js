import { h, fitCanvas, clamp, SCREEN } from '../util.js';
import { nucleus } from '../originAnim.js';
import { pT, eta } from './events.js';
import { Detector3D } from './detector3d.js';

const FONT = '"Source Sans 3", system-ui, sans-serif';
const COL = { mu: '#ff4d5e', e: '#6ee7a8', gamma: '#ffe066', jet: '#ffb347', bjet: '#ff8a3d', nu: '#b388ff', trk: 'rgba(143,210,255,.8)', trkneg: 'rgba(255,196,120,.8)', tau: '#ff79c6', nh: '#5cc8f0' };

function glow(ctx, x, y, r, c, a = 1) { const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
function label(ctx, t, x, y, c = '#f0f0f5', size = 13) { ctx.font = `700 ${size}px ${FONT}`; ctx.fillStyle = c; ctx.textAlign = 'center'; ctx.fillText(t, x, y); ctx.textAlign = 'left'; }

// Canvas that animates either a detector event or a nuclear-scale collision.
export function eventCanvas({ aspect = 1.35, maxHeight = 600 } = {}) {
  const cv = h('canvas', { 'aria-label': 'Collision display' });
  const root = h('div', { class: 'canvas-box', style: { aspectRatio: String(aspect), maxHeight: maxHeight + 'px' } }, cv);
  let scene = null, t = 0, raf = 0, last = 0, mode = 'rphi', det = null;
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!cv.offsetParent) return;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; t += dt;
    const ctx = cv.getContext('2d'); const { w, h: H } = fitCanvas(cv, ctx);
    ctx.fillStyle = SCREEN(); ctx.fillRect(0, 0, w, H);
    if (mode === '3d' && (!scene || scene.kind === 'detector') && det) return;
    if (!scene) { label(ctx, 'Press collide', w / 2, H / 2, '#8a8a92', 15); return; }
    if (scene.kind === 'detector') detector(ctx, w, H, t, scene, mode); else nuclear(ctx, w, H, t, scene);
  }
  const sync = () => {
    const use3d = mode === '3d' && (!scene || scene.kind === 'detector');
    if (use3d && !det) det = new Detector3D(root);
    cv.style.visibility = use3d ? 'hidden' : '';
    if (det) { det.canvas.style.display = use3d ? 'block' : 'none'; if (use3d) { det.show(scene); if (raf) det.start(); } else det.stop(); }
  };
  return {
    root,
    show(s) { scene = s; t = 0; sync(); },
    setView(m) { mode = m; sync(); },
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } if (det && mode === '3d') det.start(); },
    stop() { cancelAnimationFrame(raf); raf = 0; det?.stop(); },
  };
}

// ---------- detector (CMS-like, 3.8 T) ----------
function detector(ctx, w, H, t, s, mode) {
  const cx = w / 2, cy = H / 2, R = Math.min(w, H) * 0.47;
  const ring = (r0, r1, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, R * r1, 0, 7); ctx.arc(cx, cy, R * r0, 0, 7, true); ctx.fill(); };
  if (mode === '3d') mode = 'rphi';
  if (mode === 'rphi') {
    ring(0.5, 0.6, 'rgba(110,231,168,.08)'); ring(0.62, 0.8, 'rgba(92,200,240,.08)'); ring(0.81, 0.83, 'rgba(160,160,170,.25)');
    for (let i = 0; i < 12; i++) { ctx.strokeStyle = 'rgba(255,107,125,.18)'; ctx.lineWidth = R * 0.05; ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, i / 12 * Math.PI * 2 + 0.05, (i + 1) / 12 * Math.PI * 2 - 0.05); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; for (const r of [0.15, 0.3, 0.45]) { ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, 7); ctx.stroke(); }
  } else {
    const x0 = w * 0.05, x1 = w * 0.95, hh = R;
    const box = (a, b, c) => { ctx.fillStyle = c; ctx.fillRect(x0, cy - hh * b, x1 - x0, hh * (b - a)); ctx.fillRect(x0, cy + hh * a, x1 - x0, hh * (b - a)); };
    box(0.5, 0.6, 'rgba(110,231,168,.08)'); box(0.62, 0.8, 'rgba(92,200,240,.08)'); box(0.86, 0.95, 'rgba(255,107,125,.12)');
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x0, cy - 1, x1 - x0, 2);
  }
  ctx.font = `600 11px ${FONT}`; ctx.fillStyle = 'rgba(200,200,210,.5)';
  if (mode === 'rphi') { ctx.fillText('tracker', cx + 4, cy - R * 0.46); ctx.fillText('EM calorimeter', cx + 4, cy - R * 0.55); ctx.fillText('hadron calorimeter', cx + 4, cy - R * 0.72); ctx.fillText('muon chambers', cx + 4, cy - R * 0.95); }
  const grow = clamp(t / 0.9, 0, 1);
  if (t < 0.35) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.35); g.addColorStop(0, `rgba(255,255,255,${1 - t / 0.35})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, H); }
  if (s.qgp && t < 2.5) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.25); g.addColorStop(0, `rgba(255,120,60,${0.7 * (1 - t / 2.5)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, H); }
  const trackR = R * 0.5, scale = trackR / 1.2;
  const project = p => {
    if (mode === 'rphi') return [p.px, p.py];
    return [p.pz, p.py]; // side view: beam axis horizontal
  };
  for (const p of s.particles) {
    const [ux, uy] = project(p), pt = Math.hypot(ux, uy) || 1e-6, phi = Math.atan2(uy, ux);
    const type = p.type;
    if (type === 'trk' || type === 'mu' || type === 'e' || type === 'tau') {
      const rad = (pT(p) / (0.3 * 3.8)) * scale;
      const maxLen = type === 'mu' ? R * 0.98 : trackR;
      const hard = !p.soft;
      ctx.strokeStyle = type === 'mu' ? COL.mu : type === 'e' ? COL.e : type === 'tau' ? COL.tau : p.q > 0 ? COL.trk : COL.trkneg;
      ctx.lineWidth = hard && type !== 'trk' ? 2.6 : 1.1;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      const steps = 70; let x = cx, y = cy, a = phi;
      const ds = (maxLen * 1.7) / steps;
      const curv = mode === 'rphi' ? (p.q || 0) / rad : 0;
      for (let i = 0; i < steps * grow; i++) {
        a += curv * ds; x += Math.cos(a) * ds; y -= Math.sin(a) * ds;
        const d = mode === 'rphi' ? Math.hypot(x - cx, y - cy) : Math.abs(y - cy) + (Math.abs(x - cx) > w * 0.45 ? 1e9 : 0);
        if ((type === 'trk' || type === 'e') && d > trackR) break;
        if (d > maxLen) break;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (type === 'e' && grow >= 1) tower(ctx, cx, cy, R * 0.5, R * 0.6, phi, Math.min(1, p.E / 50), COL.e, mode, w);
    } else if (type === 'gamma') {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = p.soft ? 'rgba(255,224,102,.22)' : COL.gamma; ctx.lineWidth = p.soft ? 1 : 2.4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(phi) * R * 0.5 * grow, cy - Math.sin(phi) * R * 0.5 * grow); ctx.stroke(); ctx.setLineDash([]);
      if (grow >= 1) tower(ctx, cx, cy, R * 0.5, R * 0.6, phi, Math.min(1, pt / 40), '#6ee7a8', mode, w);
    } else if (type === 'nh') {
      if (grow >= 1) tower(ctx, cx, cy, R * 0.62, R * 0.8, phi, Math.min(1, pt / 8), COL.nh, mode, w);
    } else if (type === 'jet' || type === 'bjet') {
      ctx.fillStyle = type === 'bjet' ? 'rgba(255,138,61,.2)' : 'rgba(255,179,71,.16)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 0.8 * grow, -phi - 0.22, -phi + 0.22); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 7; k++) { const a = phi + (k - 3) * 0.05; ctx.strokeStyle = 'rgba(255,200,120,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * trackR * grow, cy - Math.sin(a) * trackR * grow); ctx.stroke(); }
      if (grow >= 1) { tower(ctx, cx, cy, R * 0.5, R * 0.6, phi, Math.min(1, pt / 80), '#6ee7a8', mode, w); tower(ctx, cx, cy, R * 0.62, R * 0.8, phi, Math.min(1, pt / 60), COL.nh, mode, w); }
      if (grow >= 1 && type === 'bjet') label(ctx, 'b', cx + Math.cos(phi) * R * 0.84, cy - Math.sin(phi) * R * 0.84 + 4, '#ff8a3d', 13);
    } else if (type === 'nu') {
      if (grow >= 1) { ctx.strokeStyle = COL.nu; ctx.lineWidth = 2.5; ctx.setLineDash([8, 5]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(phi) * R * 0.95, cy - Math.sin(phi) * R * 0.95); ctx.stroke(); ctx.setLineDash([]); label(ctx, 'missing energy (ν)', cx + Math.cos(phi) * R * 0.7, cy - Math.sin(phi) * R * 0.7 - 8, COL.nu, 11); }
    }
  }
  // beam remnants along the beam axis in side view
  if (mode === 'rz' && grow > 0.3) { for (const d of [-1, 1]) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + d * w * 0.45 * grow, cy); ctx.stroke(); } }
  if (grow >= 1 && s.tag) { ctx.font = `700 14px ${FONT}`; ctx.fillStyle = '#ffd27a'; ctx.fillText(s.tag, 12, H - 14); }
}
function tower(ctx, cx, cy, r0, r1, phi, f, c, mode, w) {
  ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.globalAlpha = 0.35 + f * 0.65;
  const r = r0 + (r1 - r0) * Math.max(0.15, f);
  ctx.beginPath(); ctx.moveTo(cx + Math.cos(phi) * r0, cy - Math.sin(phi) * r0); ctx.lineTo(cx + Math.cos(phi) * r, cy - Math.sin(phi) * r); ctx.stroke();
  ctx.globalAlpha = 1;
  void mode; void w;
}

// ---------- nuclear scale ----------
// scene: { kind: 'nuclear', anim, a1, a2, lepton1, lepton2, product, productLabels, fragments, newElement, super: bool, collider: bool }
function nuclear(ctx, w, H, t, r) {
  const cx = w / 2, cy = H / 2, S = Math.min(w, H) * 0.028;
  const A1 = r.a1 || 1, A2 = r.a2 || 1;
  const draw1 = (x, y) => { if (r.lepton1) glow(ctx, x, y, 7, '#8fdcff'); else nucleus(ctx, x, y, Math.min(A1, 120), S * 0.85, 5); };
  const draw2 = (x, y) => { if (r.lepton2) glow(ctx, x, y, 7, '#ffb38a'); else nucleus(ctx, x, y, Math.min(A2, 120), S * 0.85, 9); };
  const T0 = 1.0, k = Math.min(1, t / T0);
  const approach = cx - w * 0.42 * (1 - k);
  const tx = r.collider ? cx + w * 0.42 * (1 - k) : cx;
  if (r.label1 && t < T0) label(ctx, r.label1, approach, cy - S * Math.cbrt(Math.min(A1, 120)) - 12);
  if (r.label2 && t < T0) label(ctx, r.label2, tx, cy + S * Math.cbrt(Math.min(A2, 120)) + 22);
  if (r.anim === 'deflect' || r.anim === 'bounce') {
    const dmin = r.closest ? clamp(r.closest / 60, 0.08, 0.4) * w : S * 4;
    if (t < T0) { draw2(tx, cy); draw1(approach, cy - dmin * 0.3); return; }
    const f = t - T0, ang = r.anim === 'bounce' ? 2.3 : 0.9;
    draw2(r.collider ? cx + f * w * 0.2 : cx, cy);
    draw1(cx - Math.cos(ang) * f * w * 0.35, cy - dmin * 0.3 - Math.sin(ang) * f * H * 0.35);
    label(ctx, r.anim === 'bounce' ? 'bounces off' : 'deflected by electric repulsion', cx, H - 14, '#cfcfd6');
    return;
  }
  if (t < T0) { draw1(approach, cy); draw2(tx, cy); return; }
  const f = t - T0;
  if (f < 0.4) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, H) * 0.4); g.addColorStop(0, `rgba(255,240,200,${1 - f / 0.4})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, H); }
  if (r.supercritical && f < 3) { // spontaneous positron emission in a supercritical field
    for (let i = 0; i < 10; i++) { const a = i * 0.63 + f, d = f * w * 0.25; glow(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 4, '#ff6b8a', 1 - f / 3); }
    if (f < 2) label(ctx, 'e⁺  e⁺  e⁺  (vacuum decay)', cx, cy - S * 7, '#ff9aae', 13);
  }
  if (r.anim === 'fuse' || r.anim === 'capture') {
    const prods = r.productLabels || (r.product || []).map(p => p.label);
    const mainA = r.product?.[0]?.a || A1 + A2;
    if (r.quasi && f > 0.8) { // stick, then split again (quasi-fission)
      const d = Math.min(w * 0.35, (f - 0.8) * w * 0.22);
      nucleus(ctx, cx - d, cy, Math.min(120, Math.round(mainA * 0.45)), S * 0.85, 17); nucleus(ctx, cx + d, cy, Math.min(120, Math.round(mainA * 0.55)), S * 0.85, 19);
      (r.quasiLabels || []).forEach((l, i) => label(ctx, l, i ? cx + d : cx - d, cy - S * 5.5));
      label(ctx, 'quasi-fission: the giant nucleus splits apart in ~10⁻²¹ s', cx, H - 14, '#cfcfd6');
      return;
    }
    nucleus(ctx, cx, cy, Math.min(mainA, 140), S * 0.85, 13);
    label(ctx, r.newElement ? `Z = ${r.newElement}` : (prods[0] || ''), cx, cy - S * Math.cbrt(Math.min(140, mainA)) - 14);
    const extras = prods.slice(1);
    extras.forEach((p, i) => { const a = (i / Math.max(1, extras.length)) * Math.PI * 2 + 0.5, d = Math.min(w * 0.45, f * w * 0.25); const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.7; glow(ctx, x, y, 7, p === 'n' ? '#8aa4ff' : p === 'e+' ? '#ff6b8a' : '#ffd27a'); label(ctx, p, x, y - 11); });
    if (r.anim === 'capture' || prods.length <= 1) { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 40; i++) { const x = cx + 20 + f * w * 0.3 + i, y = cy - 20 - f * H * 0.2 + Math.sin(i * 0.8 + t * 20) * 4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); label(ctx, 'γ', cx + 44 + f * w * 0.3, cy - 30 - f * H * 0.2); }
  } else if (r.anim === 'fission') {
    const d = Math.min(w * 0.35, f * w * 0.2);
    const [fa, fb] = r.product?.length === 2 ? r.product : [{ a: 95, label: '' }, { a: 140, label: '' }];
    nucleus(ctx, cx - d, cy, Math.min(fa.a, 120), S * 0.8, 17); nucleus(ctx, cx + d, cy, Math.min(fb.a, 120), S * 0.8, 19);
    label(ctx, fa.label || '', cx - d, cy - S * 5); label(ctx, fb.label || '', cx + d, cy - S * 5);
    for (let i = 0; i < (r.nFree ?? 3); i++) { const a = i * 2.1 + 0.8; glow(ctx, cx + Math.cos(a) * d * 1.8, cy + Math.sin(a) * d * 1.8, 6, '#8aa4ff'); }
    if (r.caption) label(ctx, r.caption, cx, H - 14, '#cfcfd6');
  } else if (r.anim === 'shatter') {
    const frs = r.fragments?.length ? r.fragments : [];
    const n = Math.max(frs.length, 6);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + 0.3, d = Math.min(w * 0.42, f * w * 0.22 * (1 + (i % 3) * 0.3)), fr = frs[i];
      nucleus(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75, fr ? Math.min(fr.a, 60) : 4, S * 0.7, i + 3);
      if (fr) label(ctx, fr.label, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75 - 18);
    }
    for (let i = 0; i < 30; i++) { const a = i * 2.39, d = Math.min(w * 0.5, f * w * (0.3 + (i % 5) * 0.08)); glow(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75, 4, i % 2 ? '#ff5d5d' : '#8aa4ff', 0.9); }
    if (r.caption) label(ctx, r.caption, cx, H - 14, '#cfcfd6');
  } else if (r.anim === 'shower') { // cosmic-ray air shower style cascade
    const gens = Math.min(9, Math.floor(f * 3) + 1);
    ctx.lineWidth = 1;
    for (let g = 0; g < gens; g++) for (let i = 0; i < Math.pow(2, g) && i < 256; i++) {
      const x0 = cx + (i - Math.pow(2, g) / 2 + 0.5) * (w * 0.8 / Math.pow(2, g)), y0 = H * 0.12 + g * H * 0.09;
      const x1 = cx + (2 * i - Math.pow(2, g + 1) / 2 + 0.5) * (w * 0.8 / Math.pow(2, g + 1)), y1 = y0 + H * 0.09;
      ctx.strokeStyle = g % 3 === 0 ? 'rgba(255,210,120,.6)' : g % 3 === 1 ? 'rgba(143,210,255,.55)' : 'rgba(255,120,140,.5)';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - (x1 - x0) * 0.5, y1); ctx.moveTo(x0, y0); ctx.lineTo(x1 + (x1 - x0) * 0.5 + w * 0.8 / Math.pow(2, g + 1), y1); ctx.stroke();
    }
    label(ctx, r.caption || 'particle cascade', cx, H - 14, '#cfcfd6');
  }
}
export { COL };
export { eta };
