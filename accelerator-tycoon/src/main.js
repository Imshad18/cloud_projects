import { $, h, storeGet, storeSet, toast, dateStr } from './util.js';
import * as Sim from './sim.js';
import { newCampaign, campaignDaily, CAMPAIGN_MISSIONS, SIDE_MISSIONS } from './campaign.js';
import { newCustom, construct, customDaily, customMissionsFor } from './custom.js';
import { buildGame, SPEEDS } from './ui.js';
import { startScreen, designer } from './screens.js';

const KEY = 'acc-tycoon-save-v1';
const app = $('#app');
let S = null, ui = null, speedIdx = 0, raf = 0, last = 0, lastSave = 0, missionCache = null;
const modalQueue = [];
let modalEl = null;

const api = {
  onLog(msg, kind) { ui?.logAdded(); if (kind === 'bad') toast(msg, 'bad'); },
  modal(o) { modalQueue.push(o); if (!modalEl) nextModal(); },
  tab(k) { ui?.show(k); },
  gameOver(msg) { if (S.over) return; S.over = true; api.modal({ title: 'Programme cancelled', kicker: 'Game over', body: [msg, 'You can keep playing in sandbox mode (no more cancellations), or go back to the menu.'], choices: [{ label: 'Keep playing (sandbox)', primary: true, run: () => { S.sandbox = true; S.over = false; } }, { label: 'Main menu', run: () => home() }] }); },
  construct(s, dt) { construct(s, dt, api); },
  daily() { daily(); },
  onProject(U) { toast(`Completed: ${U.name}`, 'good'); },
  onUnlock(u) { toast(`Unlocked: ${u.name}`, 'good'); },
};

function missions() {
  if (S.mode === 'campaign') return { main: CAMPAIGN_MISSIONS, side: SIDE_MISSIONS };
  if (!missionCache) missionCache = { main: customMissionsFor(S), side: [] };
  return missionCache;
}

function daily() {
  if (S.mode === 'campaign') campaignDaily(S, api); else customDaily(S, api);
  Sim.analyse(S, 1);
  // discoveries
  for (const p of Sim.availableProcesses(S)) {
    const z = Sim.significance(S, p);
    S.evid = S.evid || {};
    if (z >= 3 && !S.evid[p.k]) { S.evid[p.k] = S.t; Sim.say(S, api, `Evidence (3σ): ${p.name}.`, 'good'); }
    if (z >= 5 && !S.disc[p.k]) {
      S.disc[p.k] = S.t;
      S.rep = Math.min(100, S.rep + (p.k === 'higgs' ? 12 : 5)); S.money += p.k === 'higgs' ? 20 : 8;
      Sim.say(S, api, `DISCOVERY (5σ): ${p.name}.`, 'good');
      const d = Sim.date(S);
      api.modal({
        kicker: '5σ observation', title: p.name,
        body: [p.text, `Real-world observation: ${p.ref}.`, `You: ${dateStr(d)}.`,
          p.k === 'higgs' ? 'At the real seminar on 4 July 2012 the CERN auditorium erupted, and Peter Higgs, in the audience, wiped away a tear. "I think we have it," said the Director-General.' : ''],
        choices: [{ label: 'Publish!', primary: true, run: () => {} }],
      });
    }
  }
  // missions
  const all = missions();
  for (const m of [...all.main, ...(all.side || [])]) {
    if (S.missions[m.id] || !m.done(S)) continue;
    S.missions[m.id] = S.t;
    const r = m.reward || {};
    S.money += r.money || 0; S.rep = Math.min(100, S.rep + (r.rep || 0));
    const ahead = m.by && Sim.date(S).toISOString().slice(0, 10) <= m.by;
    if (ahead) { S.rep = Math.min(100, S.rep + 3); S.money += 10; }
    Sim.say(S, api, `Mission complete: ${m.title}.${ahead ? ' Ahead of history! +10 MCHF, +3 reputation.' : ''}`, 'good');
    toast(`✓ ${m.title}${ahead ? ' (ahead of history)' : ''}`, 'good');
  }
  const now = performance.now();
  if (now - lastSave > 4000) { save(); lastSave = now; }
}

function save() { if (S) storeSet(KEY, S); }
function nextModal() {
  const o = modalQueue.shift();
  if (!o) { modalEl = null; return; }
  modalEl = h('div', { class: 'modal-wrap' }, h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    o.kicker ? h('div', { class: 'eyebrow' }, o.kicker) : '', h('h2', {}, o.title),
    ...(o.body || []).filter(Boolean).map(t => h('p', {}, t)), o.extra || '',
    h('div', { class: 'row' }, (o.choices || [{ label: 'OK', primary: true }]).map(c => h('button', { class: `btn ${c.primary ? 'primary' : ''}`, onclick: () => { modalEl.remove(); c.run?.(); nextModal(); ui?.refresh(); } }, c.label)))));
  document.body.append(modalEl);
  modalEl.querySelector('button')?.focus({ preventScroll: true });
}

function setSpeed(i) { speedIdx = i; }
function loop(ts) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts;
  if (!S || !ui) return;
  if (!modalEl && speedIdx > 0 && !S.over) Sim.step(S, SPEEDS[speedIdx][0] * dt, api);
  ui.frame(dt, ts);
}

function play(state, speed) {
  S = state; missionCache = null;
  document.body.classList.add('in-game');
  ui = buildGame(app, { S: () => S, api, setSpeed, speed: () => speedIdx, missions, menu });
  speedIdx = speed ?? speedIdx;
  if (!raf) raf = requestAnimationFrame(loop);
  if (!S.log.length) { S.t0 && daily(); }
  save();
}

function menu() {
  const prev = speedIdx; speedIdx = 0;
  api.modal({
    kicker: 'Menu', title: S.m.name,
    body: [`${S.mode === 'campaign' ? 'LHC campaign' : 'Custom machine'} · ${dateStr(Sim.date(S))} · ${Sim.year(S) - new Date(S.t0).getUTCFullYear()} years played.`, 'The game saves automatically in this browser.'],
    extra: h('div', { class: 'stack' }, h('p', { class: 'hint' }, 'Shortcuts: Space or 0 pauses, keys 1–4 set the speed.'), h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => { save(); toast('Saved', 'good'); } }, 'Save now'),
      h('button', { class: 'btn', onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })), download: `accelerator-tycoon-${S.m.name.replace(/\W+/g, '-')}-${Sim.year(S)}.json` }); document.body.append(a); a.click(); a.remove(); } }, 'Export save file'))),
    choices: [{ label: 'Resume', primary: true, run: () => { speedIdx = prev || 1; } }, { label: 'Main menu', run: () => home() }],
  });
}

function home() {
  save(); ui = null; document.body.classList.remove('in-game');
  const saved = storeGet(KEY, null);
  startScreen(app, {
    hasSave: !!saved, saveInfo: saved ? `${saved.m?.name} · ${new Date(saved.t0 + saved.t * 3600e3).getUTCFullYear()}` : '',
    onContinue: () => play(saved, 0),
    onCampaign: () => { if (saved && !confirm('Start a new LHC campaign? Your saved game will be replaced.')) return; play(newCampaign(), 1); },
    onDesign: (preset, scenario) => designer(app, { preset, scenario, onBack: home, onBuild: d => { if (saved && !confirm('Start construction? Your saved game will be replaced.')) return; const s = newCustom(d, api); play(s, 4); Sim.say(s, api, `Construction of ${d.name} approved: ${Math.round(s.build.approved)} MCHF.`, 'good'); } }),
  });
}

addEventListener('keydown', e => {
  if (!ui || modalEl || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); speedIdx = speedIdx ? 0 : 1; }
  if (/^[0-4]$/.test(e.key)) speedIdx = +e.key;
});
addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
home();
