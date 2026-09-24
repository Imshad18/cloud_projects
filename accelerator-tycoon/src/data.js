// Game data: sites, technologies, detectors, upgrades, faults. Money in MCHF (million Swiss francs).

// Sites. Map features are in km relative to the site centre (x east, y north).
export const SITES = {
  geneva: {
    name: 'Geneva basin (CERN)', short: 'Geneva', rock: 'Molasse sandstone: dry, soft, ideal for tunnelling', tunnelPerKm: 38, labour: 1,
    injector: { p: 450, e: 20, name: 'PS + SPS (existing, up to 450 GeV protons)' }, maxCirc: 100,
    text: 'Home of CERN since 1954. The existing injector chain saves billions, and the molasse rock under the plain is easy to bore.',
    features: {
      lakes: [{ x: 11, y: -6, rx: 5.5, ry: 2.2, rot: -0.55, name: 'Lake Geneva' }],
      ridges: [{ pts: [[-22, 4], [-12, 12], [-2, 19], [8, 26]], name: 'Jura mountains' }, { pts: [[6, -22], [18, -18], [30, -14]], name: 'Salève' }],
      cities: [[7, -3.5, 'Geneva'], [-6.2, -0.8, 'Meyrin'], [-9, 3.2, 'St-Genis'], [-3, 8.5, 'Gex'], [2.2, 3, 'Ferney'], [18, 5, 'Nyon']],
      rivers: [[[7, -4.4], [3, -6.5], [-4, -9.5], [-14, -12]]],
      rings: [{ x: -4.1, y: -1.5, r: 1.1, name: 'SPS' }],
      border: [[-20, -9], [-12, -6.5], [-5, -3.9], [-2, 1], [3, 5.5], [9, 12], [14, 20]],
    },
  },
  illinois: {
    name: 'Batavia, Illinois (Fermilab)', short: 'Illinois', rock: 'Glacial till over dolomite', tunnelPerKm: 44, labour: 1.1,
    injector: { p: 120, e: 0, name: 'Main Injector (existing, 120 GeV protons)' }, maxCirc: 120,
    text: 'Fermilab ran the Tevatron, the top-quark discoverer, until 2011. Flat prairie, but wet ground.',
    features: { lakes: [{ x: -14, y: 6, rx: 1.2, ry: 0.8, rot: 0, name: '' }], ridges: [], cities: [[6, 4, 'Batavia'], [15, -3, 'Naperville'], [-6, 10, 'St. Charles'], [30, 5, 'Chicago →']], rivers: [[[-3, 20], [-1, 8], [2, -4], [4, -20]]], rings: [{ x: 0, y: 0, r: 1.0, name: 'Tevatron' }] },
  },
  texas: {
    name: 'Ellis County, Texas (SSC site)', short: 'Texas', rock: 'Austin chalk: easy to bore', tunnelPerKm: 30, labour: 0.95,
    injector: { p: 0, e: 0, name: 'None: a full injector chain must be built' }, maxCirc: 140,
    text: 'The Superconducting Super Collider was being dug here: 87 km, 20 TeV per beam. Congress cancelled it in 1993 after costs doubled, with 23 km of tunnel bored.',
    features: { lakes: [{ x: 16, y: -12, rx: 3, ry: 1.2, rot: 0.3, name: 'Lake Waxahachie' }], ridges: [], cities: [[10, -6, 'Waxahachie'], [-12, 14, 'Midlothian'], [25, 22, 'Dallas →']], rivers: [[[-20, -20], [-5, -8], [8, 2], [22, 10]]], rings: [] },
  },
  china: {
    name: 'Qinhuangdao, China (CEPC site)', short: 'China', rock: 'Granite and limestone', tunnelPerKm: 24, labour: 0.6,
    injector: { p: 0, e: 0, name: 'None: a full injector chain must be built' }, maxCirc: 140,
    text: 'Proposed home of CEPC, a 100 km Higgs factory. Low construction costs, no existing accelerator.',
    features: { lakes: [{ x: 18, y: -18, rx: 20, ry: 5, rot: 0.2, name: 'Bohai Sea' }], ridges: [{ pts: [[-30, 10], [-15, 16], [0, 20], [15, 24]], name: 'Yan mountains' }], cities: [[12, -8, 'Qinhuangdao'], [-10, 4, 'Funing'], [25, 0, 'Shanhaiguan']], rivers: [], rings: [] },
  },
  japan: {
    name: 'Kitakami, Japan (ILC site)', short: 'Japan', rock: 'Granite: hard, very stable', tunnelPerKm: 60, labour: 1.2,
    injector: { p: 0, e: 5, name: 'None (linear colliders make their own beams)' }, maxCirc: 30, linearOnly: false,
    text: 'The chosen site for the International Linear Collider: a straight 20–50 km granite ridge in the Kitakami mountains.',
    features: { lakes: [{ x: 26, y: 0, rx: 4, ry: 20, rot: 0, name: 'Pacific Ocean' }], ridges: [{ pts: [[-4, -30], [-2, -10], [0, 10], [2, 30]], name: 'Kitakami range' }], cities: [[-14, 6, 'Ichinoseki'], [-12, 20, 'Oshu'], [18, -6, 'Kesennuma']], rivers: [[[-8, -30], [-9, 0], [-10, 30]]], rings: [] },
  },
};

// Dipole magnet technologies. costPerM: MCHF per metre of dipole. cryoKwPerM: wall-plug power per metre.
export const MAGNETS = {
  nc: { name: 'Normal-conducting (iron + copper)', like: 'SPS, LEP', B: 1.8, costPerM: 0.02, cryoKwPerM: 0, powerKwPerM: 2.2, training: 0, ready: true, text: 'Cheap and simple, but limited to ~2 T and it burns a lot of power.' },
  nbti45: { name: 'Nb-Ti superconductor at 4.5 K', like: 'Tevatron (4.4 T), SSC design (6.6 T)', B: 6.6, costPerM: 0.05, cryoKwPerM: 0.6, powerKwPerM: 0, training: 0.7, ready: true, text: 'Liquid-helium cooled. Proven since the Tevatron (1983).' },
  nbti19: { name: 'Nb-Ti superconductor at 1.9 K', like: 'LHC', B: 8.33, costPerM: 0.11, cryoKwPerM: 1.4, powerKwPerM: 0, training: 1, ready: true, text: 'Superfluid helium lets Nb-Ti reach 8.3 T. The LHC workhorse: 1,232 dipoles of 15 m.' },
  nb3sn: { name: 'Nb₃Sn superconductor at 1.9 K', like: 'HL-LHC triplets, FCC-hh', B: 14, costPerM: 0.2, cryoKwPerM: 1.6, powerKwPerM: 0, training: 1.6, ready: true, text: 'Brittle, needs careful heat treatment. HL-LHC uses it at 11.4 T; FCC-hh plans 14 T.' },
  hts: { name: 'High-temperature superconductor (REBCO) at 20 K', like: 'R&D only', B: 20, costPerM: 0.5, cryoKwPerM: 0.5, powerKwPerM: 0, training: 2.5, ready: false, text: 'Tapes that stay superconducting at 20 K and above 20 T. Short prototypes only: very risky and expensive today.' },
};
// Linear accelerating structures
export const LINACS = {
  srf: { name: 'Superconducting RF, 31.5 MV/m', like: 'ILC, European XFEL', gradient: 31.5, costPerKm: 370, text: 'Niobium cavities at 2 K, very efficient.' },
  xband: { name: 'Warm X-band RF, 100 MV/m', like: 'CLIC', gradient: 100, costPerKm: 520, text: 'A second "drive beam" powers copper structures: short but power hungry.' },
  plasma: { name: 'Plasma wakefield, 1 GV/m', like: 'AWAKE, FACET (R&D)', gradient: 1000, costPerKm: 900, ready: false, text: 'Rides the wake behind a laser or proton bunch in plasma. Beam quality is not yet good enough for a collider.' },
};

export const DETECTORS = {
  gp: { name: 'General-purpose detector', like: 'ATLAS, CMS', cost: 550, build: 9, color: '#5ab4ff', text: 'Hermetic detector for everything: Higgs, top, searches.', for: ['pp'] },
  bphys: { name: 'Flavour detector', like: 'LHCb', cost: 90, build: 7, color: '#f2b84b', text: 'Forward spectrometer for b and c quarks: rare decays, CP violation, exotic hadrons.', for: ['pp'] },
  ions: { name: 'Heavy-ion detector', like: 'ALICE', cost: 160, build: 8, color: '#ff7a8a', text: 'Tracks tens of thousands of particles per lead-lead collision to study quark-gluon plasma.', for: ['pp'] },
  ee: { name: 'e⁺e⁻ detector', like: 'ALEPH, OPAL, CLD, SiD', cost: 180, build: 7, color: '#6ee7a8', text: 'Precision detector for clean electron-positron collisions.', for: ['ee', 'linear'] },
};

// Faults. w: relative rate, rep: median repair (h). Weights are scaled by upgrades and conditions.
export const FAULTS = {
  quench: { name: 'Magnet quench', sys: 'Magnets', rep: 7, text: 'A superconducting magnet turned resistive. The energy is dumped safely; the sector must cool back to 1.9 K.' },
  cryo: { name: 'Cryogenics trip', sys: 'Cryogenics', rep: 9, w: 0.2, text: 'A helium compressor or cold box tripped. Magnets must be refilled with superfluid helium.' },
  rf: { name: 'RF cavity trip', sys: 'RF', rep: 1.5, w: 0.12, text: 'An accelerating cavity or its klystron tripped.' },
  power: { name: 'Power converter fault', sys: 'Power', rep: 2.5, w: 0.16, text: 'One of ~1,700 magnet power converters failed.' },
  seu: { name: 'Radiation hit electronics (SEU)', sys: 'Electronics', rep: 1.5, w: 0.1, text: 'Stray radiation flipped a bit in electronics near the tunnel, triggering a dump.' },
  ufo: { name: '"UFO": dust grain hit the beam', sys: 'Beam', rep: 1.2, w: 0.08, text: 'A micro-particle fell into the beam and caused fast losses. Real LHC phenomenon; they fade with running ("conditioning").' },
  losses: { name: 'Beam instability', sys: 'Beam', rep: 1.2, w: 0.1, text: 'Collective effects blew up the beam; losses triggered the dump.' },
  protect: { name: 'Machine protection dump', sys: 'Protection', rep: 0.8, w: 0.12, text: 'An interlock dumped the beam as a precaution. Better safe: each beam can melt 500 kg of copper.' },
  injector: { name: 'Injector fault', sys: 'Injectors', rep: 2, w: 0.14, text: 'A fault in the injector chain stops the refill.' },
  network: { name: 'Electrical network glitch', sys: 'Power grid', rep: 4, w: 0.06, text: 'A thunderstorm perturbed the 400 kV grid. Everything trips and must restart.' },
  vacuum: { name: 'Vacuum leak', sys: 'Vacuum', rep: 30, w: 0.02, text: 'Pressure rose in the beam pipe. A sector may need venting and pumping.' },
};

// Electricity price (CHF/MWh) paid by CERN, by year (approximate; 2022 energy crisis)
export const POWER_PRICE = { 2008: 55, 2010: 55, 2012: 52, 2015: 45, 2018: 50, 2020: 50, 2021: 80, 2022: 240, 2023: 160, 2024: 95, 2026: 85 };
export function powerPrice(year) {
  const ys = Object.keys(POWER_PRICE).map(Number).sort((a, b) => a - b);
  let p = POWER_PRICE[ys[0]];
  for (const y of ys) if (year >= y) p = POWER_PRICE[y];
  return year > 2026 ? 85 : p;
}

// LHC upgrade projects. prep: months of work off-site before installation; install: months inside a
// long shutdown (0 = can be done any time). needs: other projects that must be finished.
export const LHC_UPGRADES = [
  { id: 'nqps', name: 'New quench protection (nQPS)', cost: 40, prep: 4, install: 2, needs: [], year: 2009, text: 'Detects bad splices and quenches in 20 ms and protects the busbars. Installed in 2009 after the incident.', effect: 'Quench recovery faster; catastrophic splice failures far less likely.' },
  { id: 'splices', name: 'Splice consolidation (SMACC)', cost: 150, prep: 12, install: 20, needs: ['nqps'], year: 2013, text: '10,000 high-current splices between magnets opened, redone and fitted with copper shunts during Long Shutdown 1.', effect: 'Removes the energy limit of 4 TeV per beam.' },
  { id: 'r2e', name: 'Radiation to electronics (R2E)', cost: 60, prep: 12, install: 8, needs: [], year: 2013, text: 'Moves and hardens electronics that sat in radiation areas near the tunnel.', effect: 'Radiation-induced dumps ÷5.' },
  { id: 'cryo', name: 'Cryogenics consolidation', cost: 50, prep: 10, install: 6, needs: [], year: 2013, text: 'Overhaul of the 8 helium refrigerators (each 18 kW at 4.5 K).', effect: 'Cryogenics trips ÷2.' },
  { id: 'coll', name: 'Collimation upgrade', cost: 45, prep: 18, install: 6, needs: [], year: 2019, text: 'New collimators in the dispersion-suppressors catch protons knocked off the beam.', effect: 'Allowed stored energy +40%.' },
  { id: 'linac4', name: 'Linac4', cost: 90, prep: 60, install: 8, needs: [], year: 2020, text: 'A new 160 MeV linac replaces Linac2 (1978), injecting H⁻ ions into the PS Booster.', effect: 'Brighter beams: smaller emittance.' },
  { id: 'liu', name: 'LHC Injectors Upgrade (LIU)', cost: 320, prep: 48, install: 18, needs: ['linac4'], year: 2021, text: 'PS Booster to 2 GeV, new SPS RF amplifiers, e-cloud coatings.', effect: 'Bunch intensity up to 1.8×10¹¹ now, 2.3×10¹¹ with HL-LHC.' },
  { id: 'phase1', name: 'Detector upgrades, Phase 1', cost: 70, prep: 60, install: 18, needs: [], year: 2021, text: 'New muon wheels, faster triggers; LHCb Upgrade I (full software trigger); ALICE continuous readout.', effect: 'Detectors cope with pile-up 80; LHCb ×5 luminosity; ALICE ×50 ion rate.' },
  { id: 'hl', name: 'High-Luminosity LHC', cost: 950, prep: 96, install: 36, needs: ['liu', 'coll'], year: 2030, text: 'Nb₃Sn inner triplets (11.4 T), crab cavities, new superconducting links and collimators around ATLAS and CMS.', effect: 'β* down to 15 cm, crab crossing, levelled 5×10³⁴, stored energy limit 700 MJ.' },
  { id: 'phase2', name: 'Detector upgrades, Phase 2', cost: 300, prep: 90, install: 36, needs: ['phase1'], year: 2030, text: 'New all-silicon trackers, timing layers and triggers for 200 collisions per crossing.', effect: 'Detectors cope with pile-up 200.' },
  { id: 'grid', name: 'Computing grid expansion', cost: 25, prep: 6, install: 0, repeat: true, needs: [], year: 2010, text: 'More CPU and disk at the ~170 WLCG sites worldwide.', effect: 'Analysis capacity ×1.6. Data you cannot process does not count yet.' },
  { id: 'fence', name: 'Rodent-proof fencing', cost: 0.2, prep: 1, install: 0, needs: [], year: 2016, text: 'In April 2016 a beech marten chewed through a 66 kV cable at Point 8 and stopped the LHC for a week.', effect: 'No more marten incidents.' },
];
// Knowledge from machine-development (MD) time unlocks operational improvements
export const MD_UNLOCKS = [
  { id: 'scrub', xp: 2, name: 'Scrubbing for 25 ns beams', text: 'Deliberately intense beams "scrub" the beam screen, cutting the electron cloud.', effect: 'Enables 25 ns bunch spacing (up to ~2,800 bunches).' },
  { id: 'bcms', xp: 5, name: 'BCMS beams', text: 'Batch Compression, Merging and Splitting in the PS makes brighter bunches.', effect: 'Emittance 1.8 µm (−25%), 8% fewer bunches.' },
  { id: 'combined', xp: 7, name: 'Combined ramp and squeeze', text: 'Squeeze β* while ramping (2017).', effect: 'Turnaround −20 minutes.' },
  { id: 'ats', xp: 10, name: 'ATS optics', text: 'Achromatic Telescopic Squeeze: a cleverer optics that reaches smaller β*.', effect: 'Minimum β* −35%.' },
  { id: 'blevel', xp: 14, name: 'β* levelling', text: 'Level luminosity by squeezing during the fill (2018, standard in Run 3).', effect: 'Luminosity lifetime +10%.' },
];

// Upgrades for machines you design yourself
export const CUSTOM_UPGRADES = [
  { id: 'cryo', name: 'Cryogenics consolidation', cost: 80, prep: 12, install: 6, needs: [], text: 'Redundant compressors and cold boxes.', effect: 'Cryogenics trips ÷2.' },
  { id: 'r2e', name: 'Radiation-hard electronics', cost: 70, prep: 12, install: 6, needs: [], text: 'Moves electronics out of radiation areas.', effect: 'Radiation-induced dumps ÷5.' },
  { id: 'coll', name: 'Collimation upgrade', cost: 60, prep: 18, install: 6, needs: [], text: 'Better collimators and absorbers.', effect: 'Allowed stored energy +40%.' },
  { id: 'grid', name: 'Computing grid expansion', cost: 25, prep: 6, install: 0, repeat: true, needs: [], text: 'More CPU and disk for analysis.', effect: 'Analysis capacity ×1.6.' },
  { id: 'fence', name: 'Rodent-proof fencing', cost: 0.2, prep: 1, install: 0, needs: [], text: 'Keep martens out of the substations.', effect: 'No marten incidents.' },
];
