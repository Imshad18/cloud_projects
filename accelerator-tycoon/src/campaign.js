// The LHC campaign: September 2008 to the end of the HL-LHC, following real history.
import { newState, say, startProject, scheduleLS, significance, fault, date, SECTORS } from './sim.js';
import { procByKey } from './physics.js';
import { chance } from './util.js';

const HPM = 8766 / 12;
export const LHC_POINTS = [
  { p: 1, name: 'ATLAS', det: 'gp', where: 'Meyrin (CH)' },
  { p: 2, name: 'ALICE', det: 'ions', where: 'St-Genis (F)' },
  { p: 3, name: 'Collimation', where: 'Crozet (F)' },
  { p: 4, name: 'RF', where: 'Echenevex (F)' },
  { p: 5, name: 'CMS', det: 'gp', where: 'Cessy (F)' },
  { p: 6, name: 'Beam dump', where: 'Versonnex (F)' },
  { p: 7, name: 'Collimation', where: 'Ornex (F)' },
  { p: 8, name: 'LHCb', det: 'bphys', where: 'Ferney (F)' },
];

export function makeLHC() {
  return {
    name: 'LHC', kind: 'hadron', species: 'p', site: 'geneva', circ: 26659, rho: 2803.95, dipoleKm: 17.6,
    magnet: 'nbti19', Bdesign: 8.33, Edesign: 7000, Einj: 450, trainTech: 1.8,
    trained: SECTORS.map(() => 0.857 + Math.random() * 0.01),
    ips: LHC_POINTS.filter(p => p.det).map(p => ({ name: p.name, det: p.det, p: p.p })),
    points: LHC_POINTS, center: [-4.5, 3.4], splices: 'unknown', storedLimit: 362,
  };
}
const T0 = Date.UTC(2008, 8, 8, 7);
const at = (y, m, d = 1) => (Date.UTC(y, m - 1, d) - T0) / 3600e3;

export function newCampaign() {
  const S = newState({
    mode: 'campaign', m: makeLHC(), t0: T0, money: 120, rep: 50,
    fund: { base: 265, repBonus: 2.2, fixed: 125 },
    set: { autopilot: false, E: 450, spacing: 50, nb: 1, N: 1.1e11, betaStar: 11 },
    sched: {
      ls: [
        { start: at(2013, 2, 14), end: at(2015, 1, 5), name: 'Long Shutdown 1' },
        { start: at(2018, 12, 10), end: at(2022, 3, 1), name: 'Long Shutdown 2' },
        { start: at(2026, 7, 1), end: at(2030, 3, 1), name: 'Long Shutdown 3' },
      ],
      ions: { 2010: true, 2011: true, 2015: true, 2018: true, 2023: true, 2024: true, 2025: true, 2031: true, 2033: true },
    },
  });
  S.eLimit = 450; // hardware commissioning for higher energy not done yet
  S.mp.allowed = 0.01;
  S.gridBase = 15;
  S.ops.comment = 'Hardware commissioning complete at injection energy. Waiting for first beam.';
  return S;
}

// ---------- missions ----------
const gp = S => S.rec || 0;
const lumiAbove = (S, rs) => Object.entries(S.lumiAt).reduce((a, [k, v]) => a + (+k >= rs ? v : 0), 0);
export const CAMPAIGN_MISSIONS = [
  { id: 'firstbeam', title: 'First beam', text: 'Inject beam 1 and send it around the 27 km ring.', hint: 'Open the Control Room and press “Inject beam”. The autopilot is off so you can do it yourself.', done: S => S.flags.injected, reward: { rep: 5 }, by: '2008-09-10' },
  { id: 'hwc', title: 'Power the magnets for 5 TeV', text: 'Finish hardware commissioning of all eight sectors so beams can go above injection energy.', hint: 'An engineering decision will reach you in mid-September.', done: S => S.flags.hwcDone, reward: { rep: 3 } },
  { id: 'collide', title: 'First collisions', text: 'Bring the two beams into collision and declare STABLE BEAMS.', hint: 'Sequence: Inject → Ramp → Squeeze → Adjust → Stable beams. You can switch the autopilot on at any time.', done: S => S.flags.collided, reward: { money: 10, rep: 4 }, by: '2009-11-23' },
  { id: 'record', title: 'World record energy', text: 'Accelerate beyond the Tevatron\'s 0.98 TeV per beam.', hint: 'Set the fill energy above 980 GeV in the Control Room.', done: S => (S.flags.maxE || 0) > 980, reward: { rep: 5 }, by: '2009-11-30' },
  { id: 'e35', title: '7 TeV collisions', text: 'Collide at 3.5 TeV per beam, 3.5 times the Tevatron.', hint: 'Remember the splices: above 4 TeV per beam there is a risk until they are consolidated.', done: S => (S.flags.stableE || 0) >= 3500, reward: { money: 10, rep: 5 }, by: '2010-03-30' },
  { id: 'fb1', title: 'Deliver 1 fb⁻¹', text: 'Record 1 fb⁻¹ of proton collisions in ATLAS and CMS.', hint: 'Raise the intensity: every 3 clean fills let machine protection approve the next step.', done: S => gp(S) >= 1, reward: { money: 15, rep: 4 }, by: '2011-06-17' },
  { id: 'higgs', title: 'Discover the Higgs boson', text: 'Collect enough collisions for a 5σ Higgs signal.', hint: 'You need about 10 fb⁻¹ at 7–8 TeV. Watch the Physics tab. Energy helps: 8 TeV makes 27% more Higgs than 7 TeV.', done: S => S.disc.higgs, reward: { money: 40, rep: 15 }, by: '2012-07-04' },
  { id: 'ls1', title: 'Fix the splices', text: 'Consolidate all 10,000 splices so the LHC can run near design energy.', hint: 'Machine tab → start “Splice consolidation”. It is installed during Long Shutdown 1.', done: S => S.done.splices, reward: { rep: 5 }, by: '2015-04-05' },
  { id: 'e13', title: '13 TeV collisions', text: 'Collide at 6.5 TeV per beam.', hint: 'Magnets lose some training during a long shutdown: train them to 6.5 TeV (Machine tab).', done: S => (S.flags.stableE || 0) >= 6500, reward: { money: 15, rep: 6 }, by: '2015-06-03' },
  { id: 'run2', title: 'Run 2: 150 fb⁻¹ at 13 TeV', text: 'Record 150 fb⁻¹ at 13 TeV or more.', hint: 'Unlock 25 ns spacing (scrubbing), BCMS and ATS optics with machine-development time.', done: S => lumiAbove(S, 12.9) >= 150, reward: { money: 30, rep: 8 }, by: '2018-12-03' },
  { id: 'hbb', title: 'Higgs couplings', text: 'Observe H → bb̄ and ttH production.', hint: 'Both need about 80 fb⁻¹ at 13 TeV.', done: S => S.disc.hbb && S.disc.tth, reward: { money: 20, rep: 8 }, by: '2018-08-28' },
  { id: 'ls2', title: 'New injectors and detectors', text: 'Complete Linac4, the LHC Injectors Upgrade and the Phase-1 detector upgrades.', hint: 'They need years of preparation: start them early.', done: S => S.done.linac4 && S.done.liu && S.done.phase1, reward: { rep: 6 }, by: '2022-04-22' },
  { id: 'e136', title: 'Run 3 at 13.6 TeV', text: 'Collide at 6.8 TeV per beam.', hint: 'Train the magnets to 6.8 TeV.', done: S => (S.flags.stableE || 0) >= 6800, reward: { money: 15, rep: 5 }, by: '2022-07-05' },
  { id: 'run3', title: '450 fb⁻¹ in total', text: 'Reach 450 fb⁻¹ recorded per experiment.', hint: 'Detectors limit pile-up: luminosity is levelled at the μ limit.', done: S => gp(S) >= 450, reward: { money: 30, rep: 6 }, by: '2026-06-30' },
  { id: 'hl', title: 'Build the High-Luminosity LHC', text: 'Complete HL-LHC and the Phase-2 detectors.', hint: 'HL-LHC needs 8 years of preparation and a 3-year shutdown.', done: S => S.done.hl && S.done.phase2, reward: { rep: 8 }, by: '2030-06-30' },
  { id: 'hlrun', title: 'HL-LHC: 3000 fb⁻¹', text: 'Reach 3000 fb⁻¹ per experiment, ten times Runs 1–3.', hint: 'Levelled at 5×10³⁴ with pile-up up to 140–200.', done: S => gp(S) >= 3000, reward: { money: 50, rep: 10 }, by: '2041-12-31' },
  { id: 'hh', title: 'Evidence for Higgs pairs', text: 'Reach 3σ for Higgs pair production: the first look at the Higgs self-coupling.', hint: 'The final goal of the LHC programme.', done: S => significance(S, procByKey.hh) >= 3, reward: { money: 50, rep: 15 }, by: '2041-12-31' },
];
export const SIDE_MISSIONS = [
  { id: 'ions', title: 'Quark-gluon plasma', text: 'Run lead ions and observe jet quenching.', hint: 'Schedule tab: switch on a heavy-ion run for the year.', done: S => S.disc.jetq, reward: { rep: 5 } },
  { id: 'penta', title: 'Exotic hadrons', text: 'LHCb observes pentaquarks.', hint: 'LHCb needs about 3 fb⁻¹.', done: S => S.disc.penta, reward: { rep: 4 } },
  { id: 'avail', title: 'Reliable machine', text: 'Spend 45% of scheduled physics time in stable beams in one year (the LHC managed ~50% in 2016–2018).', hint: 'Reliability upgrades (R2E, cryogenics) and fewer risky settings help.', done: S => (S.stats.lastAvail || 0) >= 0.45, reward: { money: 10, rep: 4 } },
  { id: 'grid', title: 'Keep up with the data', text: 'Have every recorded collision analysed (no backlog) with more than 50 fb⁻¹ recorded.', hint: 'Buy computing grid expansions.', done: S => S.rec > 50 && S.ana >= S.rec * 0.999, reward: { rep: 3 } },
];

// ---------- scripted history ----------
export function campaignDaily(S, api) {
  const d = date(S), ymd = d.toISOString().slice(0, 10), E = S.events;
  const once = (id, cond, fn) => { if (!E[id] && cond) { E[id] = true; fn(); } };
  once('welcome', true, () => api.modal({
    title: 'Welcome to CERN, 8 September 2008', kicker: 'LHC campaign',
    body: ['You run the Large Hadron Collider: 27 km of superconducting magnets 100 m under the French-Swiss border, cooled to 1.9 K, colder than outer space.',
      'Your job: get beams around, bring them into collision, deliver data to the four experiments, keep the machine healthy, manage the budget and plan the upgrades, all the way to the High-Luminosity LHC.',
      'First task: on 10 September 2008 the world is watching. Inject the first beam yourself in the Control Room.'],
    choices: [{ label: 'Go to the Control Room', primary: true, run: () => api.tab('control') }],
  }));
  once('hwc-decision', ymd >= '2008-09-15' && S.flags.injected, () => api.modal({
    title: 'Sector 3-4: powering to 9.3 kA', kicker: 'Engineering decision',
    body: ['The last sector must be powered to 9.3 kA, enough for 5 TeV beams. The world\'s press is still here after first beam day.',
      'An engineer points out that the 10,000 superconducting splices between magnets have never all been measured at room temperature. Measuring them would take weeks.',
      'Each splice carries up to 11,850 A. A bad one could heat up and arc.'],
    choices: [
      { label: 'Continue the powering tests now', run: () => { S.flags.hwcRisk = true; say(S, api, 'Decision: sector 3-4 powering continues on schedule.', 'info'); } },
      { label: 'Stop and measure every splice first (8 weeks)', primary: true, run: () => {
        S.block = { until: S.t + 8 * 168, label: 'Splice resistance survey' };
        S.m.splices = 'weak'; S.flags.hwcDone = true; S.eLimit = 5000; S.rep += 3;
        say(S, api, 'Splice survey: several joints show resistances of tens of nΩ instead of < 1 nΩ. They are repaired, but many more are suspect. Advice: stay at or below 4 TeV per beam until all splices are consolidated.', 'good');
      } },
    ],
  }));
  if (S.flags.hwcRisk && !S.flags.hwcDone && ymd >= '2008-09-19') {
    S.flags.hwcDone = true; S.eLimit = 5000;
    if (chance(0.85)) {
      S.m.splices = 'weak'; S.money -= 40; S.rep = Math.max(0, S.rep - 12); S.flags.incident = true;
      S.block = { until: S.t + 14 * HPM, label: 'Repairing sector 3-4 after the splice incident' };
      say(S, api, '19 September 2008, 11:18: a splice between a dipole and a quadrupole in sector 3-4 melted at 8.7 kA. An electrical arc punctured the helium enclosure; 6 tonnes of helium escaped and the pressure wave tore 53 magnets from their supports. Repair: ~14 months, 40 MCHF.', 'bad');
      api.modal({ title: 'The 19 September incident', kicker: 'Sector 3-4', body: ['A single faulty splice, with a resistance of about 220 nΩ instead of 0.35 nΩ, overheated during the powering test. The arc and the helium blast damaged 53 magnets over 700 m.', 'This is what really happened to the LHC nine days after first beam. The machine will be down until late 2009.', 'The repair team proposes a new quench protection system (nQPS) able to spot bad splices. And until all splices are fixed, the LHC should stay at or below 4 TeV per beam.'], choices: [{ label: 'Start the nQPS project (40 MCHF)', primary: true, run: () => startProject(S, api, 'nqps') }, { label: 'Not now', run: () => {} }] });
    } else say(S, api, 'Sector 3-4 reached 9.3 kA without trouble. Lucky: later measurements would show several bad splices.', 'good');
  }
  once('firstbeam-news', S.flags.injected, () => say(S, api, 'First beam went around the LHC. An estimated billion people followed the news. (Real date: 10 September 2008, 10:28.)', 'good'));
  once('tevatron-hint', ymd >= '2012-07-02' && !S.disc.higgs, () => api.modal({ title: 'News from Fermilab', kicker: '2 July 2012', body: ['CDF and DØ at the Tevatron report a 3σ excess of Higgs-like events decaying to b quarks, with a mass between 115 and 135 GeV.', 'The race is on. The world expects the LHC to settle it.'], choices: [{ label: 'Back to work', primary: true, run: () => {} }] }));
  once('nobel', S.disc.higgs && d.getUTCMonth() === 9 && d.getUTCDate() >= 8 && S.t - S.disc.higgs > 90 * 24, () => { S.rep = Math.min(100, S.rep + 6); api.modal({ title: 'Nobel Prize in Physics', kicker: 'Stockholm', body: ['François Englert and Peter Higgs receive the Nobel Prize "for the theoretical discovery of a mechanism that contributes to our understanding of the origin of mass of subatomic particles, and which recently was confirmed through the discovery of the predicted fundamental particle, by the ATLAS and CMS experiments at CERN\'s Large Hadron Collider".', '(Real prize: 8 October 2013.)'], choices: [{ label: 'Celebrate', primary: true, run: () => {} }] }); });
  once('marten', ymd >= '2016-04-29' && ymd < '2016-06-01' && !S.done.fence && S.period === 'PHYSICS', () => {
    fault(S, api, 'power', 'A beech marten climbed into a 66 kV transformer at Point 8 and short-circuited it. (This really happened on 29 April 2016.)');
    S.ops.dur = 7 * 24; S.rep = Math.max(0, S.rep - 1);
  });
  once('covid', ymd >= '2020-03-16', () => {
    const ls = S.sched.ls.find(l => S.t >= l.start && S.t < l.end);
    if (ls) { ls.end += 3 * HPM; S.covidSlow = S.t + 3 * HPM; }
    else S.block = { until: S.t + 2.5 * HPM, label: 'COVID-19: site in safe mode' };
    api.modal({ title: 'COVID-19', kicker: 'March 2020', body: ['CERN goes into safe mode. Most work on site stops for two months, and installation slows for months after.', ls ? `${ls.name} is extended by about three months.` : 'The machine is put in a safe state.'], choices: [{ label: 'Understood', primary: true, run: () => {} }] });
  });
  once('energy-crisis', ymd >= '2022-09-20' && S.period !== 'LS', () => api.modal({
    title: 'European energy crisis', kicker: 'September 2022', body: ['Electricity prices have quadrupled. France asks large consumers to cut use this winter. The LHC draws about as much power as a city of 300,000 people.'],
    choices: [
      { label: 'End the run two weeks early and extend the winter stop (like CERN did)', primary: true, run: () => { S.block = { from: at(2022, 11, 28), until: at(2023, 3, 20), label: 'Energy savings: extended winter stop' }; S.rep += 2; say(S, api, 'The 2022 run will end on 28 November and the winter stop is extended.', 'info'); } },
      { label: 'Keep running as planned', run: () => { S.rep -= 3; say(S, api, 'Running on despite the crisis. The electricity bill will be very high.', 'warn'); } },
    ],
  }));
  once('triplet-leak', ymd >= '2023-07-17' && S.period === 'PHYSICS' && chance(0.6), () => {
    fault(S, api, 'vacuum', 'A helium leak opened in an inner-triplet magnet next to LHCb at Point 8 during a quench. (Real: 17 July 2023; it ended that year\'s proton run.)');
    S.ops.dur = Math.max(S.ops.dur, (at(2023, 9, 20) - S.t));
  });
  once('ls1-remind', ymd >= '2012-06-01' && !S.proj.splices, () => say(S, api, 'Reminder: Long Shutdown 1 starts in February 2013. Start “Splice consolidation” now so it is ready to install.', 'warn'));
  once('hl-remind', ymd >= '2019-01-01' && !S.proj.hl, () => say(S, api, 'Reminder: the High-Luminosity LHC takes about 8 years to prepare. Start it soon to install it in Long Shutdown 3.', 'warn'));
  if (!S.done.fence && ymd.slice(5) === '05-01' && chance(0.02) && S.period === 'PHYSICS' && ymd > '2016-06-01') fault(S, api, 'power', 'Another marten got into a substation.');
}

export function campaignScore(S) {
  return Math.round((S.rec || 0) * 2 + Object.keys(S.disc).length * 150 + S.rep * 10 + Math.max(0, S.money));
}
export { scheduleLS };
