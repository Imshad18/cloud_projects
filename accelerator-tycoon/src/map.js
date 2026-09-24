// Top-down map of the site and the machine
import { SITES, DETECTORS } from './data.js';
import { fitCanvas, clamp } from './util.js';
import { BEAM_MODES, SECTORS } from './sim.js';

const FONT = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

export function createMap(canvas, { onHover } = {}) {
  const ctx = canvas.getContext('2d');
  let S = null, phase = 0, hover = null, view = null, points = [];
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 18;
    for (const p of points) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    hover = best; onHover?.(best, x, y);
  });
  canvas.addEventListener('pointerleave', () => { hover = null; onHover?.(null); });

  function geometry(w, H) {
    const M = S.m, c = M.center || [0, 0];
    const R = M.kind === 'linear' ? M.lengthKm / 2 : M.circ / 1000 / (2 * Math.PI);
    const span = Math.max(R * 1.45, 7.5);
    const scale = Math.min(w, H) / (2 * span);
    const X = x => w / 2 + (x - c[0]) * scale, Y = y => H / 2 - (y - c[1]) * scale;
    return { R, scale, X, Y, c };
  }

  function draw(dt) {
    if (!S) return;
    phase += dt;
    const { w, h: H } = fitCanvas(canvas, ctx);
    const M = S.m, site = SITES[M.site], g = geometry(w, H);
    view = g;
    // land
    const bg = ctx.createRadialGradient(w * 0.45, H * 0.4, 10, w / 2, H / 2, Math.max(w, H) * 0.8);
    bg.addColorStop(0, '#16201c'); bg.addColorStop(1, '#0c1210');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, H);
    // grid (1 km or 10 km)
    const step = g.scale * (g.R > 20 ? 10 : g.R > 6 ? 5 : 1);
    ctx.strokeStyle = 'rgba(160,200,180,.05)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = (w / 2) % step; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = (H / 2) % step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    features(site.features || {}, g, w, H);
    if (M.kind === 'linear') linear(g, w, H); else ring(g, w, H);
    // scale bar and north
    const km = g.R > 20 ? 20 : g.R > 6 ? 5 : 2;
    ctx.strokeStyle = 'rgba(230,240,235,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, H - 18); ctx.lineTo(16 + km * g.scale, H - 18); ctx.stroke();
    ctx.fillStyle = 'rgba(230,240,235,.8)'; ctx.font = `600 11px ${FONT}`; ctx.fillText(`${km} km`, 16, H - 24);
    ctx.save(); ctx.translate(w - 22, 30); ctx.fillStyle = 'rgba(230,240,235,.75)'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 6); ctx.lineTo(0, 2); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.fillText('N', -4, 20); ctx.restore();
    ctx.fillStyle = 'rgba(230,240,235,.55)'; ctx.font = `600 11px ${FONT}`; ctx.fillText(`${site.name} · ${site.rock.split(':')[0]}`, 16, 20);
  }

  function features(F, g, w, H) {
    ctx.save();
    for (const r of F.ridges || []) {
      ctx.strokeStyle = 'rgba(120,110,90,.35)'; ctx.lineWidth = Math.max(10, g.scale * 2.2); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); r.pts.forEach(([x, y], i) => (i ? ctx.lineTo(g.X(x), g.Y(y)) : ctx.moveTo(g.X(x), g.Y(y)))); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,190,160,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
      const m = r.pts[Math.floor(r.pts.length / 2)];
      ctx.fillStyle = 'rgba(210,200,170,.55)'; ctx.font = `italic 500 11px ${FONT}`; ctx.fillText(r.name, g.X(m[0]) + 8, g.Y(m[1]) - 8);
    }
    for (const r of F.rivers || []) { ctx.strokeStyle = 'rgba(80,150,210,.45)'; ctx.lineWidth = 2; ctx.beginPath(); r.forEach(([x, y], i) => (i ? ctx.lineTo(g.X(x), g.Y(y)) : ctx.moveTo(g.X(x), g.Y(y)))); ctx.stroke(); }
    for (const l of F.lakes || []) {
      ctx.fillStyle = 'rgba(40,100,160,.55)'; ctx.beginPath(); ctx.ellipse(g.X(l.x), g.Y(l.y), l.rx * g.scale, l.ry * g.scale, -(l.rot || 0), 0, Math.PI * 2); ctx.fill();
      if (l.name) { ctx.fillStyle = 'rgba(160,210,255,.7)'; ctx.font = `italic 500 11px ${FONT}`; ctx.fillText(l.name, g.X(l.x) - 30, g.Y(l.y) + 4); }
    }
    if (F.border) { ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1; ctx.beginPath(); F.border.forEach(([x, y], i) => (i ? ctx.lineTo(g.X(x), g.Y(y)) : ctx.moveTo(g.X(x), g.Y(y)))); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.font = `500 10px ${FONT}`; const b = F.border[F.border.length - 1]; ctx.fillText('FR | CH', g.X(b[0]) - 20, g.Y(b[1])); }
    for (const r of F.rings || []) { ctx.strokeStyle = 'rgba(200,210,220,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.X(r.x), g.Y(r.y), r.r * g.scale, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(200,210,220,.6)'; ctx.font = `600 10px ${FONT}`; ctx.fillText(r.name, g.X(r.x) - 10, g.Y(r.y) + 3); }
    for (const [x, y, n] of F.cities || []) {
      const px = g.X(x), py = g.Y(y); if (px < -40 || px > w + 40 || py < -20 || py > H + 20) continue;
      ctx.fillStyle = 'rgba(240,220,170,.8)'; ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
      ctx.fillStyle = 'rgba(240,230,200,.75)'; ctx.font = `500 11px ${FONT}`; ctx.fillText(n, px + 6, py + 4);
    }
    ctx.restore();
  }

  const pointAngle = p => ((-95 - 45 * (p - 1)) * Math.PI) / 180;
  function ring(g, w, H) {
    const M = S.m, o = S.ops, cx = g.X(g.c[0]), cy = g.Y(g.c[1]), R = g.R * g.scale;
    const building = o.mode === 'CONSTRUCTION';
    const B = S.build;
    // tunnel band
    ctx.lineWidth = Math.max(6, R * 0.035);
    if (building) {
      ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(200,210,220,.25)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      // bored from 8 shafts in both directions
      for (let k = 0; k < 8; k++) {
        const a = pointAngle(k + 1), half = (Math.PI / 8) * B.tunnel, inst = (Math.PI / 8) * B.install;
        ctx.strokeStyle = 'rgba(170,180,190,.75)'; ctx.beginPath(); ctx.arc(cx, cy, R, -a - half, -a + half); ctx.stroke();
        if (inst > 0) { ctx.strokeStyle = 'rgba(90,180,255,.85)'; ctx.lineWidth = Math.max(3, R * 0.015); ctx.beginPath(); ctx.arc(cx, cy, R, -a - inst, -a + inst); ctx.stroke(); ctx.lineWidth = Math.max(6, R * 0.035); }
        if (B.tunnel < 1 && B.month > 12) for (const s of [-1, 1]) { const ang = -a + s * half; const tx = cx + Math.cos(ang) * R, ty = cy + Math.sin(ang) * R; ctx.fillStyle = `rgba(255,200,60,${0.6 + 0.4 * Math.sin(phase * 6 + k)})`; ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fill(); }
      }
    } else {
      ctx.strokeStyle = 'rgba(120,135,150,.35)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      // sectors: coloured by state
      const f = o.fill?.E ? o.fill.E / M.Edesign : 0;
      for (let k = 0; k < 8; k++) {
        const a0 = pointAngle(k + 1), a1 = pointAngle(k + 2);
        let col = 'rgba(90,180,255,.55)';
        if (['SHUTDOWN', 'REPAIR'].includes(o.mode)) col = o.label?.startsWith('Long') || o.mode === 'REPAIR' ? 'rgba(230,140,60,.5)' : 'rgba(120,135,150,.5)';
        if (o.mode === 'FAULT' && S.faultSector === k) col = `rgba(255,70,80,${0.5 + 0.4 * Math.sin(phase * 8)})`;
        if (o.mode === 'REPAIR' && S.flags.incident && k === 2 && S.block?.label?.includes('3-4')) col = `rgba(255,70,80,${0.5 + 0.4 * Math.sin(phase * 4)})`;
        if (o.mode === 'TRAINING') col = `rgba(255,190,60,${0.4 + 0.3 * Math.sin(phase * 3 + k)})`;
        if (BEAM_MODES.includes(o.mode) && M.trained && M.trained[k] < f - 1e-4) col = 'rgba(255,190,60,.7)';
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, R * 0.018); ctx.beginPath(); ctx.arc(cx, cy, R, -a0 + 0.02, -a1 - 0.02, false); ctx.stroke();
      }
      // beams
      if (BEAM_MODES.includes(o.mode) && o.fill) {
        const nb = o.fill.nb || 1, dots = Math.min(90, Math.max(1, Math.round(nb / 35)) + (nb > 1 ? 6 : 0));
        const spd = o.mode === 'STABLE BEAMS' || o.mode === 'FLAT TOP' || o.mode === 'ADJUST' ? 0.9 : o.mode === 'RAMP' ? 0.6 + 0.3 * clamp(o.t / (o.dur || 1), 0, 1) : 0.5;
        for (const [dir, colr, off] of [[1, '90,170,255', 0], [-1, '255,90,100', 0.013]]) {
          for (let i = 0; i < dots; i++) {
            const gap = i / Math.max(dots, 1) * Math.PI * 2 * (nb > 1 ? 0.9 : 1);
            const a = dir * (phase * spd) - dir * gap + off;
            const x = cx + Math.cos(a) * (R + dir * 1.8), y = cy + Math.sin(a) * (R + dir * 1.8);
            ctx.fillStyle = `rgba(${colr},${nb > 1 ? 0.85 : 1})`; ctx.beginPath(); ctx.arc(x, y, nb > 1 ? 1.8 : 3, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
    // points
    points = [];
    for (const pt of M.points || []) {
      const a = pointAngle(pt.p), x = cx + Math.cos(a) * R, y = cy - Math.sin(a) * R;
      const ipIdx = M.ips.findIndex(ip => ip.p === pt.p);
      const ip = M.ips[ipIdx];
      if (ip) {
        const colr = DETECTORS[ip.det]?.color || '#fff';
        const L = o.lumis?.[ipIdx] || 0;
        if (L > 0) { const pulse = (phase * 2 + pt.p) % 1; ctx.strokeStyle = colr; ctx.globalAlpha = 1 - pulse; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 8 + pulse * 16, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.fillStyle = ip.ready === false ? 'rgba(120,120,130,.9)' : colr; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0c1210'; ctx.lineWidth = 2; ctx.stroke();
      } else { ctx.fillStyle = 'rgba(210,220,230,.7)'; ctx.fillRect(x - 3, y - 3, 6, 6); }
      const lx = x + Math.cos(a) * 16, ly = y - Math.sin(a) * 16;
      ctx.font = `${ip ? 700 : 500} ${ip ? 12 : 10}px ${FONT}`; ctx.textAlign = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center';
      ctx.fillStyle = ip ? '#f0f4f8' : 'rgba(200,210,220,.6)';
      ctx.fillText(ip ? ip.name : `P${pt.p} ${pt.name}`, lx, ly + (Math.sin(a) < -0.3 ? 10 : Math.sin(a) > 0.3 ? -2 : 4));
      ctx.textAlign = 'left';
      points.push({ x, y, pt, ip, ipIdx });
    }
    // sector labels (inside)
    if (!building && R > 90) { ctx.fillStyle = 'rgba(200,210,220,.35)'; ctx.font = `500 10px ${MONO}`; for (let k = 0; k < 8; k++) { const a = (pointAngle(k + 1) + pointAngle(k + 2)) / 2; ctx.fillText(SECTORS[k], cx + Math.cos(a) * (R - 22) - 10, cy - Math.sin(a) * (R - 22) + 3); } }
  }

  function linear(g, w, H) {
    const M = S.m, o = S.ops, cx = g.X(g.c[0]), cy = g.Y(g.c[1]), L = g.R * g.scale;
    const building = o.mode === 'CONSTRUCTION', B = S.build;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(120,135,150,.35)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx, cy - L); ctx.lineTo(cx, cy + L); ctx.stroke();
    if (building) { ctx.strokeStyle = 'rgba(170,180,190,.8)'; ctx.beginPath(); ctx.moveTo(cx, cy - L * B.tunnel); ctx.lineTo(cx, cy + L * B.tunnel); ctx.stroke(); ctx.strokeStyle = 'rgba(90,180,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - L * B.install); ctx.lineTo(cx, cy + L * B.install); ctx.stroke(); }
    else {
      ctx.strokeStyle = 'rgba(90,180,255,.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy - L); ctx.lineTo(cx, cy - 10); ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + L); ctx.stroke();
      for (const s of [-1, 1]) { ctx.strokeStyle = 'rgba(160,170,190,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx + 26, cy + s * L * 0.15, 14, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(200,210,220,.55)'; ctx.font = `500 10px ${FONT}`; ctx.fillText('damping rings', cx + 44, cy + 4);
      if (BEAM_MODES.includes(o.mode)) for (const [s, colr] of [[-1, '90,170,255'], [1, '255,90,100']]) for (let i = 0; i < 8; i++) { const f = ((phase * 1.2 + i / 8) % 1); ctx.fillStyle = `rgba(${colr},.9)`; ctx.beginPath(); ctx.arc(cx, cy + s * L * (1 - f), 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    points = [];
    M.ips.forEach((ip, i) => {
      const x = cx + (i === 0 ? 0 : 18), y = cy;
      const active = i === (S.pushPull || 0);
      ctx.fillStyle = ip.ready === false ? 'rgba(120,120,130,.9)' : DETECTORS[ip.det].color; ctx.globalAlpha = active ? 1 : 0.5; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#f0f4f8'; ctx.font = `700 12px ${FONT}`; ctx.fillText(ip.name + (active ? '' : ' (parked)'), x + 14, y + (i ? 16 : -6));
      points.push({ x, y, ip, ipIdx: i, pt: { p: 1, name: ip.name } });
    });
  }

  return { setState(s) { S = s; }, draw, get hover() { return hover; } };
}
