// Game screen UI
import { h, fmt, sci, money, lumiStr, dur, dateStr, timeStr, fitCanvas, clamp, MONTHS, toast } from './util.js';
import * as Sim from './sim.js';
import * as P from './physics.js';
import { DETECTORS, MAGNETS, MD_UNLOCKS, FAULTS, SITES, powerPrice } from './data.js';
import { createMap } from './map.js';

const HPM = 8766 / 12;
export const SPEEDS = [[0, '❚❚', 'Pause'], [5 / 60, '▶', '5 minutes per second'], [1, '▶▶', '1 hour per second'], [12, '▶▶▶', '12 hours per second'], [72, '⏭', '3 days per second']];

export function buildGame(root, G) {
  // G: { S(), api, setSpeed(i), speed(), save(), menu() }
  root.replaceChildren();
  const S = () => G.S();
  // ---------- header ----------
  const dateEl = h('b', {}), timeEl = h('span', { class: 'mono' });
  const speedBar = h('div', { class: 'speed' }, SPEEDS.map(([, l, t], i) => h('button', { title: t, 'aria-label': t, onclick: () => G.setSpeed(i) }, l)));
  const moneyEl = h('b', {}), repBar = h('i', {}), repVal = h('b', {});
  const header = h('header', { class: 'topbar' },
    h('button', { class: 'brand', onclick: () => G.menu(), title: 'Menu' }, h('span', { class: 'logo' }), h('span', {}, h('b', {}, 'Accelerator Tycoon'), h('small', {}, S().m.name))),
    h('div', { class: 'clock' }, dateEl, timeEl), speedBar,
    h('div', { class: 'kpi money' }, h('small', {}, 'Budget'), moneyEl),
    h('div', { class: 'kpi rep' }, h('small', {}, 'Reputation'), h('div', { class: 'repbar' }, repBar), repVal),
    h('button', { class: 'btn ghost', onclick: () => G.menu() }, 'Menu'));

  // ---------- map + page 1 ----------
  const mapCv = h('canvas', { class: 'map', 'aria-label': 'Map of the accelerator' });
  const tip = h('div', { class: 'maptip', hidden: true });
  const map = createMap(mapCv, { onHover: (p, x, y) => { if (!p) { tip.hidden = true; return; } tip.hidden = false; tip.style.left = `${x + 14}px`; tip.style.top = `${y + 10}px`; tip.replaceChildren(...pointInfo(S(), p)); } });
  const page1 = h('div', { class: 'page1' });
  const left = h('section', { class: 'left' }, h('div', { class: 'mapbox' }, mapCv, tip), page1);

  // ---------- tabs ----------
  const tabDefs = [['control', 'Control room'], ['missions', 'Missions'], ['physics', 'Physics'], ['machine', 'Machine'], ['schedule', 'Schedule'], ['finance', 'Finance'], ['log', 'Logbook']];
  const tabBar = h('nav', { class: 'tabs', role: 'tablist' });
  const panel = h('div', { class: 'panel' });
  const right = h('section', { class: 'right' }, tabBar, panel);
  let cur = 'control', panes = {};
  const badge = {};
  for (const [k, l] of tabDefs) { badge[k] = h('i', { class: 'badge', hidden: true }); tabBar.append(h('button', { 'data-k': k, onclick: () => show(k) }, l, badge[k])); }
  function show(k) {
    cur = k;
    for (const b of tabBar.children) b.classList.toggle('on', b.dataset.k === k);
    if (k === 'log') badge.log.hidden = true;
    panes[k] = builders[k]();
    panel.replaceChildren(panes[k].el);
    panes[k].update?.();
  }
  root.append(header, h('main', { class: 'game' }, left, right));

  // ---------- builders ----------
  const builders = { control: controlTab, missions: missionsTab, physics: physicsTab, machine: machineTab, schedule: scheduleTab, finance: financeTab, log: logTab };

  function controlTab() {
    const s = S();
    if (s.ops.mode === 'CONSTRUCTION' || s.ops.mode === 'HW COMMISSIONING') return constructionPane();
    const M = s.m, hadron = M.kind === 'hadron';
    const chain = h('div', { class: 'chain' }, ['NO BEAM', 'INJECTION', 'RAMP', 'FLAT TOP', 'ADJUST', 'STABLE BEAMS', 'RAMP DOWN'].map(m => h('span', { 'data-m': m }, m === 'FLAT TOP' ? 'SQUEEZE' : m)));
    const phaseBar = h('div', { class: 'progress' }, h('i', {}));
    const phaseTxt = h('p', { class: 'small muted', style: { margin: 0 } });
    const nextBtn = h('button', { class: 'btn primary big', onclick: () => { if (!Sim.advance(S(), G.api, true)) toast('Not now'); update(); } });
    const dumpBtn = h('button', { class: 'btn danger', onclick: () => { Sim.dumpNow(S(), G.api); update(); } }, 'Dump beams');
    const auto = h('input', { type: 'checkbox', id: 'autopilot', onchange: e => { S().set.autopilot = e.target.checked; update(); } });
    const autoRow = h('label', { class: 'switch', for: 'autopilot' }, auto, h('span', {}), h('div', {}, h('b', {}, 'Autopilot'), h('small', {}, 'The operations crew runs fills around the clock. Switch off to press every button yourself.')));
    // fill settings
    const c = Sim.cap(s);
    const E = h('input', { type: 'range', id: 'set-E', min: c.Emin, max: c.Emax, step: hadron ? 50 : 0.5, value: s.set.E });
    const Ev = h('b', {});
    const Emarks = h('div', { class: 'marks' });
    E.addEventListener('input', () => { S().set.E = +E.value; update(); });
    const opPts = !hadron ? h('div', { class: 'seg' }, [[45.6, 'Z pole'], [80.4, 'WW'], [120, 'ZH (Higgs)'], [182.5, 'tt̄'], [250, '500 GeV']].filter(([e]) => e <= c.Emax + 0.01).map(([e, l]) => h('button', { onclick: () => { S().set.E = e; E.value = e; update(); } }, l))) : '';
    const optimise = h('input', { type: 'checkbox', id: 'set-auto', checked: s.set.auto, onchange: e => { S().set.auto = e.target.checked; show('control'); } });
    const spSeg = hadron ? h('div', { class: 'seg' }, [50, 25].map(v => h('button', { 'data-v': v, disabled: !c.spacings.includes(v), title: c.spacings.includes(v) ? '' : 'Needs scrubbing (machine-development result)', onclick: () => { S().set.spacing = v; update(); } }, `${v} ns`))) : '';
    const nb = h('input', { type: 'range', id: 'set-nb', min: 1, max: hadron ? c.nb[25] : 1, step: 1, value: s.set.nb }); const nbV = h('b', {});
    const N = h('input', { type: 'range', id: 'set-N', min: 0.3, max: hadron ? c.N[25] / 1e11 + 0.4 : 1, step: 0.05, value: s.set.N / 1e11 }); const NV = h('b', {});
    const bs = h('input', { type: 'range', id: 'set-bs', min: 0.1, max: 11, step: 0.05, value: s.set.betaStar }); const bsV = h('b', {});
    nb.addEventListener('input', () => { S().set.nb = +nb.value; update(); });
    N.addEventListener('input', () => { S().set.N = +N.value * 1e11; update(); });
    bs.addEventListener('input', () => { S().set.betaStar = +bs.value; update(); });
    const fillSel = h('select', { id: 'set-fill', onchange: e => { S().set.fillHours = +e.target.value; } }, [[0, 'Optimal: dump when the average rate peaks'], [4, '4 hours'], [8, '8 hours'], [12, '12 hours'], [16, '16 hours'], [24, '24 hours']].map(([v, l]) => h('option', { value: v, selected: s.set.fillHours === v }, l)));
    const predict = h('div', { class: 'kv' });
    const manualBox = h('div', { class: 'stack', hidden: s.set.auto || !hadron },
      field('Bunches', nbV, nb), field('Protons per bunch (×10¹¹)', NV, N), field('β* (focus at the collision point)', bsV, bs));
    const live = h('div', { class: 'kv' });
    const chart = h('canvas', { class: 'chart', 'aria-label': 'Luminosity over the last days' });
    const stats = h('div', { class: 'kv' });
    const lumiNote = h('p', { class: 'hint' });
    const el = h('div', { class: 'stack' },
      card('Operations', autoRow, chain, phaseBar, phaseTxt, h('div', { class: 'row' }, nextBtn, dumpBtn)),
      card('Next fill', field(hadron ? 'Energy per beam' : 'Beam energy (collision energy is twice this)', Ev, E), Emarks, opPts,
        hadron ? h('div', { class: 'field' }, h('label', {}, 'Bunch spacing'), spSeg) : '',
        hadron ? h('label', { class: 'check' }, optimise, h('span', {}, 'Let the crew choose the highest safe intensity and smallest β*')) : '',
        manualBox,
        M.kind === 'hadron' || (M.kind === 'lepton' && !M.topUp) ? field('Fill length', '', fillSel) : '',
        h('h4', {}, 'Prediction for this setting'), predict),
      card('Now', live, chart, lumiNote),
      card('This year', stats));
    function update() {
      const s = S(), o = s.ops, c = Sim.cap(s), f = Sim.planFill(s);
      auto.checked = s.set.autopilot;
      for (const sp of chain.children) sp.classList.toggle('on', sp.dataset.m === o.mode || (o.mode === 'BEAM DUMP' && sp.dataset.m === 'RAMP DOWN'));
      const busy = ['FAULT', 'SHUTDOWN', 'REPAIR', 'COMMISSIONING', 'TRAINING'].includes(o.mode);
      phaseBar.firstChild.style.width = `${o.dur ? clamp(o.t / o.dur, 0, 1) * 100 : o.mode === 'STABLE BEAMS' ? 100 : 0}%`;
      phaseBar.classList.toggle('bad', o.mode === 'FAULT');
      phaseTxt.textContent = busy ? `${o.mode === 'FAULT' ? o.faultName : o.label || o.mode}: ${o.dur ? dur(Math.max(0, o.dur - o.t)) + ' left' : ''}` : o.mode === 'STABLE BEAMS' ? `Stable beams for ${dur(o.fill?.tStable || 0)}` : o.ready ? `${o.mode} complete. Waiting for you.` : o.dur ? `${o.mode}: ${dur(Math.max(0, o.dur - o.t))} left` : '';
      const act = Sim.OP_ACTIONS[o.mode];
      nextBtn.textContent = act || 'Waiting';
      nextBtn.disabled = busy || !act || (!o.ready && o.mode !== 'STABLE BEAMS' && s.set.autopilot) || (!o.ready && o.mode !== 'STABLE BEAMS');
      nextBtn.classList.toggle('pulse', o.ready && !s.set.autopilot);
      dumpBtn.disabled = !Sim.BEAM_MODES.includes(o.mode);
      if (document.activeElement !== E) { E.min = c.Emin; E.max = c.Emax; E.value = clamp(s.set.E, c.Emin, c.Emax); }
      Ev.textContent = hadron ? `${fmt(f.E / 1000, 3)} TeV (√s = ${fmt(Sim.rsTeV(s, f.E), 3)} TeV)` : `${fmt(f.E, 4)} GeV (√s = ${fmt(2 * f.E, 4)} GeV)`;
      const tr = M.trained ? Math.min(...M.trained) * M.Edesign : 0;
      Emarks.replaceChildren(...(hadron ? [h('span', {}, `Magnets trained to ${fmt(tr / 1000, 3)} TeV`), c.safeE ? h('span', { class: 'warn' }, `Splices safe to ${c.safeE / 1000} TeV`) : '', s.eLimit ? h('span', { class: 'warn' }, `Commissioned to ${fmt(s.eLimit / 1000, 3)} TeV`) : ''] : [h('span', {}, `Design: ${fmt(M.Edesign, 4)} GeV per beam`)]));
      if (hadron) {
        for (const b of spSeg.children) b.classList.toggle('on', +b.dataset.v === f.sp);
        manualBox.hidden = s.set.auto;
        nb.max = c.nb[f.sp]; nbV.textContent = `${s.set.nb} (max ${c.nb[f.sp]})`;
        N.max = c.N[f.sp] / 1e11; NV.textContent = `${fmt(s.set.N / 1e11, 3)} (max ${fmt(c.N[f.sp] / 1e11, 3)})`;
        bs.min = Math.max(0.1, Math.floor(c.betaMin(f.E) * 100) / 100); bsV.textContent = `${fmt(s.set.betaStar, 3)} m (min ${fmt(c.betaMin(f.E), 2)} m)`;
        const Ls = Sim.ipLumis(s, { ...f }), Lp = P.lumiHadron({ E: f.E, nb: f.nb, N: f.N, epsN: f.eps * 1e-6, betaStar: f.betaStar, circ: M.circ, crab: c.crab });
        const mu = P.pileup(Math.max(...Ls), Sim.rsTeV(s, f.E), f.nb, M.circ);
        const limiter = f.stored >= Math.min(s.mp.allowed, c.storedLimit) * 0.95 ? (s.mp.allowed < c.storedLimit ? 'machine-protection ramp-up' : 'stored-energy limit') : f.nb >= c.nb[f.sp] ? 'bunches that fit in the ring' : 'your settings';
        predict.replaceChildren(
          kv('Bunches × intensity', `${f.nb} × ${fmt(f.N / 1e11, 3)}×10¹¹`), kv('β*', `${fmt(f.betaStar * 100, 3)} cm`), kv('Emittance', `${fmt(f.eps, 2)} µm`),
          kv('Stored energy per beam', `${fmt(f.stored, 3)} MJ`), kv('Allowed now', `${fmt(Math.min(s.mp.allowed, c.storedLimit), 3)} MJ${s.mp.allowed < c.storedLimit ? ` (next step after ${3 - s.mp.clean} clean fills)` : ' (full)'}`),
          kv('Peak luminosity', `${sci(Math.max(...Ls), 2)} cm⁻²s⁻¹`), kv('Without levelling', `${sci(Lp, 2)}`), kv('Pile-up μ', fmt(mu, 3)), kv('Limited by', limiter),
          f.ions ? kv('Ion run', 'lead-lead collisions') : '');
      } else {
        const Ls = Sim.ipLumis(s, { ...f });
        predict.replaceChildren(kv('Luminosity per detector', `${sci(Math.max(...Ls), 2)} cm⁻²s⁻¹`), kv('Per year (≈1.2×10⁷ s)', lumiStr((Math.max(...Ls) * 1.2e7) / 1e39)),
          ...P.PROCESSES.filter(p => p.beam === 'ee').map(p => kv(p.name.split(':')[0], P.procXS(p, (2 * f.E) / 1000) > 0 ? `${fmt((Math.max(...Ls) * 1.2e7 / 1e39) * P.procXS(p, (2 * f.E) / 1000), 3)} events/yr` : '—')));
      }
      const fl = o.fill;
      live.replaceChildren(kv('Beam mode', o.mode), kv('Fill', fl ? `#${fl.no}` : '—'), kv('Luminosity', o.lastL ? `${sci(o.lastL, 3)} cm⁻²s⁻¹` : '—'),
        kv('This fill', fl ? lumiStr(fl.intL) : '—'), kv('Power draw', `${Math.round(s.powerNow || 0)} MW`), kv('Recorded in total', lumiStr(s.rec)));
      lumiNote.textContent = o.mode === 'STABLE BEAMS' && fl && !fl.ions && hadron ? `Luminosity falls as protons burn off in collisions (σ ≈ ${Math.round(P.sigmaTot(Sim.rsTeV(s, fl.E)) * 1e27)} mb) and beams grow. The autopilot dumps and refills when that pays off.` : '';
      drawTrace(chart, s);
      const sch = s.stats.sched, av = sch > 0 ? s.stats.stable / sch : 0;
      const top = Object.entries(s.stats.byFault).sort((a, b) => b[1] - a[1]).slice(0, 3);
      stats.replaceChildren(kv('Stable beams', `${fmt(s.stats.stable, 3)} h of ${fmt(sch, 3)} h scheduled (${Math.round(av * 100)}%)`), kv('Delivered this year', lumiStr(s.yearLumi[Sim.year(s)]?.main || 0)),
        kv('Faults this year', `${Object.keys(s.stats.byFault).length ? top.map(([k, v]) => `${FAULTS[k].name} ${fmt(v, 2)} h`).join(', ') : 'none'}`), kv('Machine-development knowledge', `${fmt(s.mdXP, 2)} weeks`));
    }
    return { el, update };
  }

  function constructionPane() {
    const bars = h('div', { class: 'stack' }), money_ = h('div', { class: 'kv' }), dets = h('div', { class: 'stack' });
    const el = h('div', { class: 'stack' }, card('Construction', bars), card('Detectors', dets), card('Money', money_),
      card('How it works', h('p', { class: 'hint', style: { margin: 0 } }, 'Tunnel-boring machines start from the access shafts. Magnet factories start 18 months after approval; installation follows the tunnel. Detectors take 7–9 years. Speed the clock up with ⏭. Budget overruns trigger funding reviews.')));
    function update() {
      const s = S(), B = s.build;
      const bar = (l, v, sub) => h('div', { class: 'field' }, h('label', {}, l, h('b', {}, `${Math.round(v * 100)}%`)), h('div', { class: 'progress' }, h('i', { style: { width: `${v * 100}%` } })), sub ? h('small', { class: 'muted' }, sub) : '');
      bars.replaceChildren(
        h('p', { style: { margin: 0 } }, s.ops.comment),
        bar('Design and approvals', Math.min(1, B.month / 12)),
        bar(s.m.kind === 'linear' ? 'Tunnel' : 'Tunnel boring', B.tunnel, `${fmt(B.tunnel * B.len, 3)} of ${fmt(B.len, 3)} km`),
        bar(s.m.kind === 'linear' ? 'Accelerating structures built' : 'Magnets built', B.magnets, `${fmt(B.magnets * B.prodKm, 3)} of ${fmt(B.prodKm, 3)} km`),
        bar('Installed', B.install), bar('Cryogenics, power, controls', B.infra), bar('Hardware commissioning', B.hwc));
      dets.replaceChildren(...s.m.ips.map((ip, i) => bar(`${ip.name} (${DETECTORS[ip.det].like}-style)`, B.dets[i])));
      const spent = Object.values(B.comps).reduce((a, c) => a + c.spent, 0), est = Object.values(B.comps).reduce((a, c) => a + c.total, 0);
      money_.replaceChildren(kv('Approved', money(B.approved)), kv('Spent', money(spent)), kv('Estimate at completion', money(est)), kv('Capital left', money(B.capital)), kv('Time since approval', `${fmt(B.month / 12, 2)} years`),
        ...Object.entries(B.comps).map(([k, c]) => kv(`  ${k}`, `${money(c.spent)} / ${money(c.total)}`)));
    }
    return { el, update };
  }

  function missionsTab() {
    const list = h('div', { class: 'stack' });
    const el = h('div', { class: 'stack' }, list);
    function update() {
      const s = S(), all = G.missions();
      const main = all.main, side = all.side || [];
      const open = main.filter(m => !s.missions[m.id]);
      const doneM = main.filter(m => s.missions[m.id]);
      const row = (m, state) => h('div', { class: `mission ${state}` }, h('div', { class: 'mhead' }, h('b', {}, m.title), state === 'done' ? h('span', { class: 'tag good' }, `Done ${dateStr(new Date(s.t0 + s.missions[m.id] * 3600e3))}`) : m.by ? h('span', { class: 'tag' }, `History: ${m.by}`) : ''),
        h('p', {}, m.text), state !== 'done' && m.hint ? h('p', { class: 'hint' }, m.hint) : '', m.reward ? h('small', { class: 'muted' }, `Reward: ${[m.reward.money ? `${m.reward.money} MCHF` : '', m.reward.rep ? `+${m.reward.rep} reputation` : ''].filter(Boolean).join(', ')}${m.by ? ' (bonus if you beat history)' : ''}`) : '');
      list.replaceChildren(card('Current', ...open.slice(0, 3).map(m => row(m, 'open')), open.length > 3 ? h('p', { class: 'hint' }, `${open.length - 3} more after these.`) : '', !open.length ? h('p', {}, 'All main missions complete. Keep going for a higher score.') : ''),
        side.length ? card('Side missions', ...side.map(m => row(m, s.missions[m.id] ? 'done' : 'open'))) : '',
        doneM.length ? card(`Completed (${doneM.length})`, ...doneM.map(m => row(m, 'done'))) : '');
    }
    return { el, update };
  }

  function physicsTab() {
    const ipBox = h('div', { class: 'kv' }), procs = h('div', { class: 'procs' }), yearCv = h('canvas', { class: 'chart tall' }), fillTbl = h('div', { class: 'tbl' }), anaBox = h('div', { class: 'kv' });
    const el = h('div', { class: 'stack' }, card('Data recorded', ipBox), card('Discoveries and measurements', h('p', { class: 'hint', style: { margin: 0 } }, 'Significance grows with the square root of the number of events. 3σ is "evidence", 5σ is a discovery (a one-in-3.5-million fluke). Thresholds are calibrated on the real observations.'), procs),
      card('Analysis', anaBox), card('Luminosity per year', yearCv), card('Recent fills', fillTbl));
    function update() {
      const s = S(), M = s.m;
      ipBox.replaceChildren(...M.ips.map((ip, i) => kv(h('span', {}, h('i', { class: 'dot', style: { background: DETECTORS[ip.det].color } }), ` ${ip.name}`), `${lumiStr(s.lumiIP[i] || 0)}${s.ionLumi[i] ? ` · ions ${fmt((s.ionLumi[i] || 0) * 1e6, 3)} nb⁻¹` : ''}`)),
        M.kind === 'hadron' ? kv('Search reach for new heavy particles', s.reach ? `${fmt(s.reach, 3)} TeV (Z′-like)` : '—') : '',
        M.kind === 'hadron' ? h('p', { class: 'hint', style: { margin: 0 } }, 'No new particle is handed out as a reward: nobody knows what lies beyond the Standard Model. The reach says how heavy a new particle could be and still have been found.') : '');
      const list = Sim.availableProcesses(s);
      procs.replaceChildren(...list.map(p => {
        const z = Sim.significance(s, p), w = clamp(z / 6, 0, 1) * 100;
        const disc = s.disc[p.k];
        return h('details', { class: `proc ${disc ? 'found' : z >= 3 ? 'evid' : ''}` }, h('summary', {}, h('span', { class: 'pname' }, p.name), h('span', { class: 'sig' }, h('i', { style: { width: `${w}%` } }), h('em', { style: { left: '50%' } }), h('em', { class: 'five', style: { left: `${(5 / 6) * 100}%` } })), h('b', {}, disc ? '✓' : `${fmt(z, 2)}σ`)),
          h('p', {}, p.text), h('p', { class: 'hint' }, `Real observation: ${p.ref}.${disc ? ` You: ${dateStr(new Date(s.t0 + disc * 3600e3))}.` : ''}`));
      }));
      const cap = Sim.gridCapacity(s);
      anaBox.replaceChildren(kv('Recorded (per experiment)', lumiStr(s.rec)), kv('Analysed', `${lumiStr(s.ana)} (${s.rec ? Math.round((s.ana / s.rec) * 100) : 100}%)`), kv('Grid capacity', `${lumiStr(cap)} per year`), s.rec > s.ana * 1.05 ? h('p', { class: 'hint warn' }, 'Backlog: data you cannot process does not count yet. Buy a computing grid expansion (Machine tab).') : '');
      drawYears(yearCv, s);
      fillTbl.replaceChildren(h('table', {}, h('thead', {}, h('tr', {}, ...['Fill', 'Date', 'E (TeV)', 'Bunches', 'Peak L', 'Delivered', 'Stable', 'End'].map(t => h('th', {}, t)))),
        h('tbody', {}, s.fills.slice(0, 14).map(f => h('tr', {}, h('td', {}, f.no), h('td', {}, dateStr(new Date(s.t0 + f.t * 3600e3))), h('td', {}, M.kind === 'hadron' ? fmt(f.E / 1000, 3) + (f.ions ? ' Pb' : '') : fmt(f.E, 4)), h('td', {}, f.nb || '—'), h('td', {}, f.Lpeak ? sci(f.Lpeak, 2) : '—'), h('td', {}, lumiStr(f.intL)), h('td', {}, dur(f.hours)), h('td', {}, f.why))))));
    }
    return { el, update };
  }

  function machineTab() {
    const s0 = S(), M = s0.m, hadron = M.kind === 'hadron';
    const params = h('div', { class: 'kv' }), capBox = h('div', { class: 'kv' });
    const trainBars = h('div', { class: 'sectors' });
    const trainSel = h('select', { id: 'train-E' });
    if (hadron) for (let e = Math.ceil(M.Edesign * 0.86 / 100) * 100; e <= M.Edesign * 1.08; e += M.Edesign > 20000 ? 1000 : 100) trainSel.append(h('option', { value: e }, `${fmt(e / 1000, 3)} TeV`));
    const trainEst = h('small', { class: 'muted' });
    trainSel.addEventListener('change', () => update());
    const trainBtn = h('button', { class: 'btn', onclick: () => { const r = Sim.startTraining(S(), G.api, +trainSel.value); if (r) toast(r); update(); } }, 'Start training campaign');
    const md = h('div', { class: 'stack' }), ups = h('div', { class: 'ups' });
    const pp = M.kind === 'linear' && M.ips.length > 1 ? card('Push-pull', h('p', { class: 'hint', style: { margin: 0 } }, 'Two detectors share one collision point and swap places (takes a few days).'), h('div', { class: 'row' }, M.ips.map((ip, i) => h('button', { class: 'btn', onclick: () => { S().pushPull = i; Sim.fault(S(), G.api, 'vacuum', `Push-pull: moving ${ip.name} into the beam.`); S().ops.dur = 72; } }, `Move in ${ip.name}`)))) : '';
    const el = h('div', { class: 'stack' }, card(M.name, params), hadron ? card('Magnet training', h('p', { class: 'hint', style: { margin: 0 } }, 'Superconducting magnets "learn" to reach higher fields through quenches. After a long shutdown they forget a little. Ramping above the trained energy with beam risks a training quench.'), trainBars, h('div', { class: 'row' }, trainSel, trainBtn), trainEst) : '', pp,
      hadron ? card('Beam limits', capBox) : '', hadron ? card('Machine development', md) : '', card('Upgrade projects', h('p', { class: 'hint', style: { margin: 0 } }, 'Projects are prepared off-site first (money is spent then), and most are installed during a long shutdown (Schedule tab).'), ups));
    function update() {
      const s = S(), c = Sim.cap(s), E = s.set.E;
      params.replaceChildren(
        M.kind === 'linear' ? kv('Length', `${fmt(M.lengthKm, 3)} km`) : kv('Circumference', `${fmt(M.circ / 1000, 4)} km`),
        M.kind !== 'linear' ? kv('Bending radius', `${fmt(M.rho / 1000, 3)} km`) : kv('Accelerating structures', M.linac),
        hadron ? kv('Dipoles', `${MAGNETS[M.magnet].name}, design ${fmt(M.Bdesign, 3)} T`) : '',
        hadron ? kv('Field at this energy', `${fmt(P.fieldForEnergy(E, M.rho), 3)} T (p = 0.3·B·ρ)`) : '',
        kv('Design energy', hadron ? `${fmt(M.Edesign / 1000, 3)} TeV per beam` : `${fmt(M.Edesign, 4)} GeV per beam`),
        M.kind !== 'linear' ? kv('Revolution frequency', `${fmt(P.frev(M.circ), 5)} Hz`) : '',
        M.kind !== 'linear' ? kv('Synchrotron loss per turn', `${fmt(P.U0(E, M.rho, M.species) * 1e6, 3)} keV`) : '',
        s.mode === 'campaign' ? kv('Splices', M.splices === 'ok' ? 'Consolidated' : M.splices === 'weak' ? 'Weak: stay ≤ 4 TeV per beam' : 'Never measured') : '',
        kv('Injection energy', hadron ? `${fmt(M.Einj, 4)} GeV` : `${fmt(M.Einj, 3)} GeV`));
      if (hadron) {
        trainBars.replaceChildren(...M.trained.map((t, i) => h('div', { class: 'sec' }, h('div', { class: 'col' }, h('i', { style: { height: `${clamp((t - 0.8) / 0.28, 0, 1) * 100}%` } })), h('small', {}, Sim.SECTORS[i]), h('b', {}, fmt((t * M.Edesign) / 1000, 3)))));
        const need = Sim.trainingNeeded(s, +trainSel.value || E);
        trainEst.textContent = need.quenches ? `About ${need.total} quenches in total, ~${need.days} days without beam.` : 'Already trained for this energy.';
        trainBtn.disabled = !need.quenches || ['TRAINING', 'CONSTRUCTION', 'HW COMMISSIONING'].includes(s.ops.mode);
        capBox.replaceChildren(kv('Max protons per bunch', `${fmt(c.N[25] / 1e11, 3)}×10¹¹ (25 ns), ${fmt(c.N[50] / 1e11, 3)}×10¹¹ (50 ns)`), kv('Emittance from injectors', `${fmt(c.eps[25], 2)} µm`), kv('Smallest β* at this energy', `${fmt(c.betaMin(E) * 100, 3)} cm`),
          kv('Stored energy limit', `${c.storedLimit} MJ per beam`), kv('Approved by machine protection', `${fmt(Math.min(s.mp.allowed, c.storedLimit), 3)} MJ`), kv('Detector pile-up limit', `μ ≈ ${c.muGP}`), c.levelGP < Infinity ? kv('Levelling target', sci(c.levelGP, 2)) : '', kv('Crab cavities', c.crab ? 'Yes' : 'No'));
        const next = MD_UNLOCKS.find(u => !s.done[u.id]);
        md.replaceChildren(h('p', { class: 'hint', style: { margin: 0 } }, `About ${Math.round(s.sched.mdFrac * 100)}% of beam time goes to studies (set in Schedule). Knowledge: ${fmt(s.mdXP, 2)} weeks.`),
          next ? h('div', { class: 'progress' }, h('i', { style: { width: `${clamp(s.mdXP / next.xp, 0, 1) * 100}%` } })) : '',
          ...MD_UNLOCKS.map(u => h('div', { class: `unlock ${s.done[u.id] ? 'done' : ''}` }, h('b', {}, `${s.done[u.id] ? '✓ ' : ''}${u.name}`), h('small', {}, ` · ${u.xp} weeks · ${u.effect}`))));
      }
      ups.replaceChildren(...Sim.upgrades(s).map(U => {
        const p = s.proj[U.id], st = !p ? 'none' : p.state;
        const needs = U.needs.filter(n => !s.done[n]);
        const label = { none: 'Not started', prep: `Preparing: ${Math.max(0, Math.round(p?.left || 0))} months left`, ready: U.install ? 'Ready: waiting for a long shutdown' : 'Ready', install: `Installing: ${Math.max(0, Math.round(p?.inst || 0))} months left`, done: U.repeat ? `Level ${p?.level || 0}` : 'Done' }[st];
        const canStart = (st === 'none' || (U.repeat && st === 'done')) && !needs.length;
        return h('div', { class: `up ${st}` }, h('div', { class: 'mhead' }, h('b', {}, U.name), h('span', { class: `tag ${st === 'done' ? 'good' : ''}` }, label)),
          h('p', {}, U.text), h('p', { class: 'eff' }, U.effect),
          h('div', { class: 'row' }, h('small', { class: 'muted' }, `${U.cost} MCHF · ${U.prep} months preparation${U.install ? ` · ${U.install} months installation in a long shutdown` : ''}${U.year ? ` · real: ${U.year}` : ''}`),
            canStart ? h('button', { class: 'btn small', onclick: () => { const r = Sim.startProject(S(), G.api, U.id); if (r) toast(r); update(); } }, U.repeat && st === 'done' ? 'Expand again' : 'Start') : needs.length && st === 'none' ? h('small', { class: 'warn' }, `Needs: ${needs.join(', ')}`) : ''));
      }));
    }
    return { el, update };
  }

  function scheduleTab() {
    const grid = h('div', { class: 'cal' }), lsList = h('div', { class: 'stack' });
    const s0 = S();
    const y0 = Sim.year(s0);
    const ySel = h('select', { id: 'ls-year' }, Array.from({ length: 12 }, (_, i) => h('option', { value: y0 + i }, y0 + i)));
    const mSel = h('select', { id: 'ls-month' }, MONTHS.map((m, i) => h('option', { value: i, selected: i === 0 }, m)));
    const len = h('input', { type: 'range', id: 'ls-len', min: 3, max: 48, step: 1, value: 24 }); const lenV = h('b', {}, '24 months');
    len.addEventListener('input', () => { lenV.textContent = `${len.value} months`; });
    const mdS = h('input', { type: 'range', id: 'md-frac', min: 0, max: 15, step: 1, value: Math.round(s0.sched.mdFrac * 100) }); const mdV = h('b', {});
    mdS.addEventListener('input', () => { S().sched.mdFrac = +mdS.value / 100; update(); });
    const el = h('div', { class: 'stack' },
      card('Calendar', h('div', { class: 'legend' }, [['PHYSICS', 'Proton physics'], ['IONS', 'Heavy ions'], ['YETS', 'Winter stop'], ['LS', 'Long shutdown'], ['BLOCK', 'Repair / other']].map(([k, l]) => h('span', {}, h('i', { class: `c-${k}` }), l))), grid),
      card('Long shutdowns', lsList, h('div', { class: 'row' }, h('span', {}, 'New shutdown from'), mSel, ySel), field('Length', lenV, len), h('button', { class: 'btn', onclick: () => { const s = S(); const t = (Date.UTC(+ySel.value, +mSel.value, 1) - s.t0) / 3600e3; if (t < s.t) { toast('That date has passed'); return; } Sim.scheduleLS(s, G.api, t, +len.value); update(); } }, 'Schedule long shutdown')),
      S().m.kind === 'hadron' ? card('Machine development', field('Share of beam time for studies', mdV, mdS), h('p', { class: 'hint', style: { margin: 0 } }, 'Less physics now, better performance later: studies unlock 25 ns beams, brighter bunches, smaller β* and faster turnaround.')) : '');
    function update() {
      const s = S(), y1 = Sim.year(s);
      mdV.textContent = `${Math.round(s.sched.mdFrac * 100)}%`;
      grid.replaceChildren(...Array.from({ length: 8 }, (_, i) => y1 + i).map(y => h('div', { class: 'calrow' }, h('b', {}, y),
        h('div', { class: 'months' }, MONTHS.map((m, mi) => { const t = (Date.UTC(y, mi, 15) - s.t0) / 3600e3; const p = Sim.periodAt({ ...s, ops: { mode: 'x' } }, t); const now = y === y1 && mi === Sim.date(s).getUTCMonth(); return h('i', { class: `c-${p} ${now ? 'now' : ''}`, title: `${m} ${y}: ${p}` }, m[0]); })),
        s.m.kind === 'hadron' ? h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!s.sched.ions[y], onchange: e => { S().sched.ions[y] = e.target.checked; update(); } }), 'ions') : '')));
      lsList.replaceChildren(...s.sched.ls.map(ls => h('div', { class: 'lsrow' }, h('b', {}, ls.name), h('span', {}, `${dateStr(new Date(s.t0 + ls.start * 3600e3))} → ${dateStr(new Date(s.t0 + ls.end * 3600e3))}`),
        ls.start > s.t ? h('button', { class: 'btn small ghost', onclick: () => { S().sched.ls = S().sched.ls.filter(x => x !== ls); update(); } }, 'Cancel') : ls.end > s.t ? h('span', { class: 'tag' }, 'now') : h('span', { class: 'tag good' }, 'done'))),
        ...Sim.upgrades(s).filter(U => U.install && s.proj[U.id] && ['prep', 'ready', 'install'].includes(s.proj[U.id].state)).map(U => h('p', { class: 'hint', style: { margin: 0 } }, `${U.name}: ${s.proj[U.id].state === 'prep' ? `ready in ${Math.round(s.proj[U.id].left)} months, then` : s.proj[U.id].state === 'install' ? 'installing,' : ''} needs ${Math.max(0, Math.round(s.proj[U.id].inst))} months inside a shutdown.`)));
    }
    return { el, update };
  }

  function financeTab() {
    const top = h('div', { class: 'kv' }), hist = h('div', { class: 'tbl' });
    const el = h('div', { class: 'stack' }, card('Money', top), card('History', hist));
    function update() {
      const s = S(), y = Sim.year(s);
      top.replaceChildren(kv('Balance', money(s.money)), kv('Budget each January', money(Sim.budgetPerYear(s))), kv('  of which reputation bonus', money((s.rep - 50) * s.fund.repBonus)),
        kv('Staff and maintenance per year', money(s.fund.fixed)), kv('Electricity price', `${powerPrice(y)} CHF/MWh`), kv('Power draw now', `${Math.round(s.powerNow || 0)} MW`),
        kv('Energy this year', `${fmt(s.energyMWh / 1000, 3)} GWh`), kv('Spent this year on electricity', money(s.spent.power)), kv('Spent this year on staff and upkeep', money(s.spent.staff)), kv('Spent this year on upgrades', money(s.spent.upgrades)), s.build ? kv('Spent this year on construction', money(s.spent.build)) : '',
        s.money < 0 ? h('p', { class: 'hint warn' }, 'In debt. Two consecutive years below −150 MCHF and the council cancels the programme.') : '');
      hist.replaceChildren(h('table', {}, h('thead', {}, h('tr', {}, ...['Year', 'Luminosity', 'Ions', 'Stable beams', 'Energy', 'Electricity', 'Balance', 'Reputation'].map(t => h('th', {}, t)))),
        h('tbody', {}, s.history.slice().reverse().map(r => h('tr', {}, h('td', {}, r.year), h('td', {}, lumiStr(r.lumi)), h('td', {}, r.ions ? `${fmt(r.ions * 1e6, 3)} nb⁻¹` : '—'), h('td', {}, r.stableFrac != null ? `${Math.round(r.stableFrac * 100)}%` : '—'), h('td', {}, `${fmt(r.energyGWh, 3)} GWh`), h('td', {}, money(r.spentPower)), h('td', {}, money(r.money)), h('td', {}, Math.round(r.rep)))))));
    }
    return { el, update };
  }

  function logTab() {
    const list = h('div', { class: 'logl' });
    const el = h('div', { class: 'stack' }, card('Electronic logbook', list));
    function update() { const s = S(); list.replaceChildren(...s.log.slice(0, 200).map(e => h('div', { class: `le ${e.kind}` }, h('time', {}, `${dateStr(new Date(s.t0 + e.t * 3600e3))} ${timeStr(new Date(s.t0 + e.t * 3600e3))}`), h('span', {}, e.msg)))); }
    return { el, update };
  }

  // ---------- periodic refresh ----------
  let lastPanel = 0, lastHead = 0;
  function frame(dtReal, now) {
    const s = S();
    map.setState(s); map.draw(dtReal);
    if (now - lastHead > 120) {
      lastHead = now;
      const d = Sim.date(s);
      dateEl.textContent = dateStr(d); timeEl.textContent = timeStr(d);
      moneyEl.textContent = money(s.money); moneyEl.classList.toggle('neg', s.money < 0);
      repBar.style.width = `${clamp(s.rep, 0, 100)}%`; repVal.textContent = Math.round(s.rep);
      for (const [i, b] of [...speedBar.children].entries()) b.classList.toggle('on', i === G.speed());
      renderPage1(page1, s);
    }
    if (now - lastPanel > 400) {
      lastPanel = now;
      const a = document.activeElement;
      const typing = a && panel.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT') && a.type !== 'checkbox';
      if (!typing || cur === 'control') { if (cur === 'control' && ((S().ops.mode === 'CONSTRUCTION' || S().ops.mode === 'HW COMMISSIONING') !== !!panes.control?.isBuild)) { show('control'); panes.control.isBuild = S().ops.mode === 'CONSTRUCTION' || S().ops.mode === 'HW COMMISSIONING'; } panes[cur]?.update?.(); }
    }
  }
  function logAdded() { if (cur !== 'log') badge.log.hidden = false; }
  show('control');
  panes.control.isBuild = S().ops.mode === 'CONSTRUCTION' || S().ops.mode === 'HW COMMISSIONING';
  return { frame, show, logAdded, refresh: () => show(cur) };
}

// ---------- LHC "Page 1" style status display ----------
function renderPage1(el, s) {
  const o = s.ops, M = s.m, f = o.fill, d = Sim.date(s);
  const E = f ? (o.mode === 'RAMP' ? M.Einj + (f.E - M.Einj) * clamp(o.t / (o.dur || 1), 0, 1) : o.mode === 'INJECTION' || o.mode === 'NO BEAM' ? M.Einj : f.E) : M.Einj;
  const I = f && Sim.BEAM_MODES.includes(o.mode) ? (f.nb * f.N) / 1e14 : 0;
  const modeCls = o.mode === 'STABLE BEAMS' ? 'stable' : o.mode === 'FAULT' || o.mode === 'REPAIR' ? 'fault' : ['SHUTDOWN', 'CONSTRUCTION', 'HW COMMISSIONING'].includes(o.mode) ? 'off' : 'busy';
  const Ls = o.lumis || [];
  const hadron = M.kind === 'hadron';
  el.replaceChildren(
    h('div', { class: 'p1head' }, h('span', {}, `${M.name} Page 1`), h('span', {}, `Fill: ${f?.no || s.fillNo || '—'}`), h('span', {}, `E: ${hadron ? Math.round(E) : fmt(E, 4)} GeV`), h('span', {}, `${d.toISOString().slice(0, 10)} ${timeStr(d)}`)),
    h('div', { class: `p1mode ${modeCls}` }, o.mode === 'SHUTDOWN' ? (o.label || 'SHUTDOWN').toUpperCase() : o.mode === 'FAULT' ? `FAULT: ${o.faultName}`.toUpperCase() : o.mode + (f?.ions && Sim.BEAM_MODES.includes(o.mode) ? ' · IONS' : '')),
    h('div', { class: 'p1grid' },
      h('span', {}, 'I(B1)'), h('b', {}, I ? `${fmt(I, 3)}e14` : '0'), h('span', {}, 'I(B2)'), h('b', {}, I ? `${fmt(I, 3)}e14` : '0'),
      h('span', {}, 'β*'), h('b', {}, f?.betaStar && hadron ? `${Math.round(f.betaStar * 100)} cm` : '—'), h('span', {}, 'Bunches'), h('b', {}, f?.nb && hadron ? f.nb : '—')),
    M.ips.length ? h('div', { class: 'p1lumi' }, M.ips.map((ip, i) => h('div', {}, h('span', { style: { color: DETECTORS[ip.det].color } }, ip.name), h('b', {}, Ls[i] ? fmt(Ls[i] / 1e30, 4) : '0'), h('small', {}, '(µb·s)⁻¹')))) : '',
    h('div', { class: 'p1com' }, h('small', {}, 'Comments'), h('span', {}, o.comment || '')));
}

function pointInfo(s, p) {
  const out = [];
  if (p.ip) {
    const D = DETECTORS[p.ip.det];
    out.push(h('b', {}, p.ip.name), h('div', {}, `${D.name} (${D.like}-style)`), h('div', {}, `Recorded: ${lumiStr(s.lumiIP[p.ipIdx] || 0)}`));
    if (s.ops.lumis?.[p.ipIdx]) out.push(h('div', {}, `Luminosity now: ${sci(s.ops.lumis[p.ipIdx], 2)} cm⁻²s⁻¹`));
    if (p.ip.ready === false) out.push(h('div', { class: 'warn' }, 'Under construction'));
  } else out.push(h('b', {}, `Point ${p.pt.p}: ${p.pt.name}`), p.pt.where ? h('div', {}, p.pt.where) : '');
  return out;
}

// ---------- small helpers ----------
export function card(title, ...kids) { return h('section', { class: 'card' }, title ? h('h3', {}, title) : '', ...kids); }
export function kv(k, v) { return h('div', { class: 'kvr' }, h('span', {}, k), h('b', {}, v)); }
export function field(label, val, input) { return h('div', { class: 'field' }, h('label', { for: input?.id }, label, val), input); }

function drawTrace(cv, s) {
  const ctx = cv.getContext('2d'); const { w, h: H } = fitCanvas(cv, ctx);
  ctx.clearRect(0, 0, w, H);
  const tr = s.trace || [];
  ctx.fillStyle = 'rgba(160,170,190,.7)'; ctx.font = '11px "IBM Plex Sans", sans-serif';
  if (tr.length < 2) { ctx.fillText('Luminosity trace appears here once beams collide.', 8, H / 2); return; }
  const max = Math.max(1e30, ...tr.map(x => x[1]));
  const t0 = tr[0][0], t1 = tr[tr.length - 1][0] || t0 + 1;
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  for (let i = 0; i <= 4; i++) { const y = 8 + (H - 24) * i / 4; ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.fillText(sci(max, 1), 2, 12); ctx.fillText('0', 18, H - 14);
  const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, 'rgba(255,200,80,.5)'); grad.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.beginPath(); ctx.moveTo(30, H - 16);
  for (const [t, L] of tr) ctx.lineTo(30 + ((t - t0) / (t1 - t0 || 1)) * (w - 32), H - 16 - (L / max) * (H - 24));
  ctx.lineTo(w - 2, H - 16); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); tr.forEach(([t, L], i) => { const x = 30 + ((t - t0) / (t1 - t0 || 1)) * (w - 32), y = H - 16 - (L / max) * (H - 24); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = '#ffc850'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(160,170,190,.7)'; ctx.fillText(`last ${dur(t1 - t0)}`, w - 70, H - 2);
}
function drawYears(cv, s) {
  const ctx = cv.getContext('2d'); const { w, h: H } = fitCanvas(cv, ctx);
  ctx.clearRect(0, 0, w, H);
  const rows = [...s.history.map(r => [r.year, r.lumi]), [Sim.year(s), s.yearLumi[Sim.year(s)]?.main || 0]].slice(-16);
  const max = Math.max(1e-6, ...rows.map(r => r[1]));
  const bw = (w - 40) / Math.max(rows.length, 1);
  ctx.font = '11px "IBM Plex Sans", sans-serif';
  rows.forEach(([y, v], i) => {
    const bh = (v / max) * (H - 36), x = 34 + i * bw;
    ctx.fillStyle = i === rows.length - 1 ? 'rgba(255,200,80,.85)' : 'rgba(90,180,255,.75)';
    ctx.fillRect(x + 2, H - 20 - bh, bw - 4, bh);
    ctx.fillStyle = 'rgba(200,210,220,.75)'; ctx.fillText(String(y).slice(2), x + bw / 2 - 6, H - 6);
    if (v > 0 && bw > 26) ctx.fillText(v >= 1 ? fmt(v, 2) : fmt(v * 1000, 2) + 'p', x + 2, H - 24 - bh);
  });
  ctx.fillStyle = 'rgba(200,210,220,.6)'; ctx.fillText('fb⁻¹', 2, 12);
}
export { SITES };
