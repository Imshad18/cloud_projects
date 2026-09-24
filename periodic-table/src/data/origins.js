// Cosmic origin of the elements in the Solar System.
// Fractions follow the nucleosynthesis periodic table by Jennifer Johnson (Ohio State, 2019/2020 update),
// rounded to whole percent. They are estimates; the r-process sites in particular are still debated.

export const SOURCES = {
  BB: {
    name: 'Big Bang', short: 'Big Bang', color: '#8fd3ff',
    when: '3 to 20 minutes after the beginning, 13.8 billion years ago',
    where: 'The whole universe, while it was hotter than a star core',
    process: 'Big Bang nucleosynthesis',
    text: 'In the first minutes the entire universe was a hot, dense soup of protons and neutrons. As it expanded and cooled below about a billion kelvin, neutrons and protons fused into deuterium, then helium-4, with traces of helium-3 and lithium-7. After about 20 minutes the universe was too cool and thin to fuse anything heavier. Almost every hydrogen atom in your body was made here.',
    journey: ['Quark-gluon plasma cools into protons and neutrons (first microsecond)', 'Neutrons and protons fuse into deuterium, then helium (3 minutes)', 'Expansion freezes the mix: ~75% H, ~25% He by mass (20 minutes)', 'Atoms capture electrons and light escapes: the cosmic microwave background (380,000 years)', 'Gas collapses into the first stars and galaxies (~200 million years)'],
    delay: 'Instant: the first nuclei ever made',
  },
  CR: {
    name: 'Cosmic ray fission', short: 'Cosmic rays', color: '#c9a2ff',
    when: 'Continuously, for the whole life of the galaxy',
    where: 'Interstellar space',
    process: 'Cosmic-ray spallation',
    text: 'Cosmic rays are atomic nuclei accelerated to nearly the speed of light by supernova shock waves. When one smashes into a carbon, nitrogen or oxygen nucleus drifting in space, it chips it into smaller pieces. This spallation is the main source of the fragile elements lithium, beryllium and boron, which stars destroy rather than make.',
    journey: ['Supernova shock waves accelerate protons and nuclei to near light speed', 'Cosmic rays cross the galaxy for millions of years', 'A high-energy proton hits a C, N or O nucleus in interstellar gas', 'The nucleus shatters into Li, Be and B fragments', 'Fragments mix into gas clouds that later form stars and planets'],
    delay: 'Ongoing, slowly building up over billions of years',
  },
  LM: {
    name: 'Dying low-mass stars', short: 'Low-mass stars', color: '#ffb347',
    when: 'From a few hundred million years after the Big Bang, still happening',
    where: 'Red giant and AGB stars 1 to 8 times the mass of the Sun',
    process: 's-process (slow neutron capture) and shell burning',
    text: 'Stars like the Sun end their lives as swollen red giants. Deep inside, pulses of helium burning release neutrons that are captured slowly, one every few years, walking nuclei up the valley of stability. This slow process builds half the elements heavier than iron, like barium, lead and strontium. The star then puffs its outer layers into space as a planetary nebula, leaving a white dwarf.',
    journey: ['A Sun-like star burns hydrogen for billions of years', 'The core runs out of hydrogen and the star swells into a red giant', 'Helium shell flashes release neutrons; iron seeds capture them slowly (s-process)', 'Convection dredges the new elements to the surface', 'Stellar winds and a planetary nebula return them to space; a white dwarf remains'],
    delay: 'Hundreds of millions to billions of years after star birth',
  },
  MS: {
    name: 'Exploding massive stars', short: 'Massive stars', color: '#ff6b5e',
    when: 'From ~100 million years after the Big Bang, still happening',
    where: 'Stars more than 8 times the mass of the Sun',
    process: 'Fusion burning stages and core-collapse supernovae',
    text: 'Massive stars fuse hydrogen to helium, then helium to carbon and oxygen, then neon, magnesium, silicon and finally iron, in layers like an onion. Iron cannot release energy by fusion, so the core collapses in less than a second into a neutron star or black hole. The rebound shock blasts the star apart and forges more elements in the explosion. Most of the oxygen you breathe came from these supernovae.',
    journey: ['A star 8 to 100 times the Sun burns fuel in onion-like shells', 'Silicon burning builds an iron core in about a day', 'The iron core collapses at a quarter of the speed of light', 'A shock wave and neutrinos blow the star apart (core-collapse supernova)', 'Oxygen, silicon, calcium and more enrich the galaxy; a neutron star or black hole remains'],
    delay: 'Only a few million years after the star forms',
  },
  WD: {
    name: 'Exploding white dwarfs', short: 'White dwarfs', color: '#fff08a',
    when: 'From about a billion years after the Big Bang, still happening',
    where: 'White dwarfs in binary star systems',
    process: 'Type Ia supernova (thermonuclear explosion)',
    text: 'A white dwarf is the carbon-oxygen core left by a Sun-like star. If it steals matter from a companion star or merges with another white dwarf and approaches 1.4 solar masses, carbon ignites everywhere at once and the whole star detonates. No remnant is left. These thermonuclear supernovae make most of the iron-peak elements: iron, manganese, nickel and chromium.',
    journey: ['A white dwarf orbits a companion star', 'It steals gas from its companion, or two white dwarfs spiral together', 'Near 1.4 solar masses carbon fusion runs away in seconds', 'The star is completely destroyed in a Type Ia supernova', 'About 0.6 solar masses of radioactive nickel-56 decays into iron'],
    delay: 'Usually a billion years or more after the stars formed',
  },
  NS: {
    name: 'Merging neutron stars', short: 'Neutron stars', color: '#ff5fd2',
    when: 'Rare events, from roughly 10 million years after star formation onward',
    where: 'Binary neutron stars that spiral together',
    process: 'r-process (rapid neutron capture) in a kilonova',
    text: 'When two neutron stars spiral together and collide, they fling out neutron-rich debris. Nuclei in it capture neutrons so fast that they grow far beyond stability before decaying, forming the heaviest elements such as gold, platinum, europium and uranium. In 2017 the merger GW170817 was seen in both gravitational waves and light, and its glowing kilonova showed freshly made heavy elements. Rare kinds of supernovae may also contribute.',
    journey: ['Two neutron stars orbit each other, radiating gravitational waves', 'The orbit shrinks until they collide at a third of light speed', 'Neutron-rich matter is ejected at 10 to 30% of light speed', 'Nuclei capture neutrons in under a second (r-process), then decay toward stability', 'The radioactive glow of a kilonova lights up for days'],
    delay: 'Millions to billions of years after the stars form',
  },
  HS: {
    name: 'Made by humans', short: 'Human-made', color: '#a6b0c8',
    when: 'Since 1937 (technetium)',
    where: 'Nuclear reactors and particle accelerators',
    process: 'Neutron capture in reactors, heavy-ion fusion in accelerators',
    text: 'These elements have no stable isotopes and any primordial atoms decayed long ago, so almost all of them on Earth were made in laboratories. Reactors bombard uranium with neutrons to build up neptunium, plutonium and beyond. For the heaviest elements, accelerators smash beams of ions such as calcium-48 into heavy targets and detect a handful of atoms that live for milliseconds.',
    journey: ['A heavy target (uranium, curium, berkelium...) is prepared', 'A reactor floods it with neutrons, or an accelerator fires a beam of ions at it', 'Rarely, two nuclei fuse into a new, heavier one', 'Detectors track its alpha-decay chain to identify it', 'Discovery is confirmed by IUPAC and the element is named'],
    delay: 'Made in the 20th and 21st centuries',
  },
  RD: {
    name: 'Radioactive decay', short: 'Decay', color: '#7cf29a',
    when: 'Continuously, inside rocks on Earth today',
    where: 'Decay chains of uranium and thorium',
    process: 'Alpha and beta decay chains',
    text: 'These short-lived elements exist in nature only because uranium and thorium, made billions of years ago in neutron star mergers, keep decaying through long chains. Every atom of radium, radon or polonium on Earth was born recently in such a chain inside a rock.',
    journey: ['Uranium and thorium are forged in the r-process', 'They are locked into Earth as it forms 4.6 billion years ago', 'They slowly decay, with half-lives of billions of years', 'Each decay chain passes through Ra, Rn, Po and more', 'Chains end at stable lead'],
    delay: 'Being made right now inside the ground',
  },
};

export const SOURCE_ORDER = ['BB', 'CR', 'LM', 'MS', 'WD', 'NS', 'HS', 'RD'];

const RAW = `H BB100|He BB93 LM4 MS3|Li BB10 CR30 LM60|Be CR100|B CR90 MS10|C LM55 MS45|N LM65 MS35|O MS95 LM5|F MS50 LM50|Ne MS95 LM5|Na MS95 LM5|Mg MS100|Al MS95 LM5|Si MS80 WD20|P MS100|S MS70 WD30|Cl MS75 WD25|Ar MS70 WD30|K MS80 WD20|Ca MS65 WD35|Sc MS90 WD10|Ti MS60 WD40|V MS50 WD50|Cr MS40 WD60|Mn MS25 WD75|Fe MS40 WD60|Co MS55 WD45|Ni MS40 WD60|Cu MS75 LM25|Zn MS80 LM20|Ga MS55 LM45|Ge MS50 LM50|As MS55 LM30 NS15|Se MS50 LM30 NS20|Br MS40 LM25 NS35|Kr MS35 LM45 NS20|Rb MS30 LM45 NS25|Sr LM75 MS15 NS10|Y LM70 MS10 NS20|Zr LM70 MS10 NS20|Nb LM65 NS35|Mo LM50 MS20 NS30|Tc HS100|Ru LM30 NS70|Rh LM20 NS80|Pd LM45 NS55|Ag LM20 NS80|Cd LM50 NS50|In LM35 NS65|Sn LM60 NS40|Sb LM25 NS75|Te LM20 NS80|I LM5 NS95|Xe LM20 NS80|Cs LM15 NS85|Ba LM85 NS15|La LM75 NS25|Ce LM80 NS20|Pr LM50 NS50|Nd LM55 NS45|Pm HS100|Sm LM30 NS70|Eu LM5 NS95|Gd LM15 NS85|Tb LM7 NS93|Dy LM12 NS88|Ho LM8 NS92|Er LM17 NS83|Tm LM13 NS87|Yb LM33 NS67|Lu LM20 NS80|Hf LM55 NS45|Ta LM60 NS40|W LM55 NS45|Re LM10 NS90|Os LM10 NS90|Ir LM2 NS98|Pt LM5 NS95|Au LM6 NS94|Hg LM60 NS40|Tl LM75 NS25|Pb LM80 NS20|Bi LM20 NS80|Po RD100|At RD100|Rn RD100|Fr RD100|Ra RD100|Ac RD100|Th NS100|Pa RD100|U NS100`;

export const ORIGIN = {};
for (const row of RAW.split('|')) {
  const [sym, ...parts] = row.trim().split(' ');
  ORIGIN[sym] = parts.map(p => ({ src: p.slice(0, 2), pct: +p.slice(2) }));
}
// Everything from neptunium up is made by humans.
export function originOf(el) {
  return ORIGIN[el.sym] || [{ src: 'HS', pct: 100 }];
}
export function dominant(el) {
  return originOf(el).reduce((a, b) => (b.pct > a.pct ? b : a)).src;
}

// Element-specific origin stories.
export const ORIGIN_NOTES = {
  H: 'Hydrogen nuclei (protons) are older than any other nucleus. The hydrogen in a glass of water is about 13.8 billion years old.',
  He: 'About 25% of all normal matter by mass became helium in the first 20 minutes. Stars have only added a few percent since. It was discovered in the Sun\'s spectrum in 1868, before it was found on Earth.',
  Li: 'The "cosmological lithium problem": Big Bang models predict about three times more lithium-7 than we see in old stars. Most lithium in your phone battery was made later, probably in novae and giant stars.',
  Be: 'Stars destroy beryllium at just a few million kelvin, so almost every beryllium atom was chipped off a heavier nucleus by a cosmic ray.',
  B: 'Like beryllium, boron is made when cosmic rays shatter carbon and oxygen. Neutrinos from supernovae also knock out a little boron-11.',
  C: 'Carbon forms by the triple-alpha process: three helium nuclei fuse. It works only because carbon-12 has an energy level at exactly the right place, the "Hoyle state", predicted by Fred Hoyle in 1953.',
  N: 'Most nitrogen comes from the CNO cycle in stars, where carbon acts as a catalyst for turning hydrogen into helium and slowly converts to nitrogen-14.',
  O: 'Oxygen is the third most common element in the universe and is made almost entirely in massive stars, then released by core-collapse supernovae.',
  Ne: 'Made by helium capture onto oxygen and by carbon burning in massive stars.',
  Mg: 'Magnesium-24 comes from carbon and neon burning in massive stars. The radioactive isotope aluminium-26 decays to magnesium-26 and helped heat the first asteroids.',
  Si: 'Oxygen burning in massive stars creates silicon, which later becomes the fuel for the star\'s final day of life.',
  Ti: 'Radioactive titanium-44 glows in young supernova remnants like Cassiopeia A, a direct fingerprint of fresh nucleosynthesis.',
  Fe: 'Iron-56 sits near the peak of nuclear binding energy, so fusion stops there. Most iron is made as radioactive nickel-56 which decays to cobalt-56 and then iron-56. That decay powers the light of supernovae for months.',
  Ni: 'Nickel-62 has the highest binding energy per nucleon of any nucleus. Radioactive nickel-56 is the main product of Type Ia supernovae.',
  Co: 'Cobalt-56 (half-life 77 days) sets the fading rate of supernova light curves before it decays into iron.',
  Mn: 'Manganese is a signature of exploding white dwarfs; its abundance in old stars helps tell which kinds of supernovae enriched them.',
  Sr: 'In 2019 astronomers identified strontium in the spectrum of kilonova AT2017gfo, the first heavy element seen forming in a neutron star merger.',
  Tc: 'Technetium has no stable isotopes, yet in 1952 Paul Merrill found it in the spectra of red giant stars. Since it decays in millions of years, this was proof that stars are making elements right now. On Earth it is made in reactors.',
  Ba: 'Barium is a classic s-process element. "Barium stars" received it from a companion that went through its red-giant phase.',
  Eu: 'Europium is almost pure r-process, so astronomers use it to trace neutron star mergers through galactic history.',
  Pm: 'Promethium has no stable isotope. Tiny amounts form in uranium ores by spontaneous fission; nearly all of it is made in reactors.',
  Pt: 'Platinum and iridium are almost entirely r-process. The iridium-rich layer at the dinosaur-extinction boundary came from an asteroid carrying this ancient stardust.',
  Au: 'The kilonova GW170817 (2017) made an estimated several Earth masses of gold. The gold in jewelry was forged in collisions like that before the Sun formed.',
  Pb: 'Lead is the end of the s-process: neutron capture on lead-208 and bismuth-209 cycles back to lead. Lead is also the final product of uranium and thorium decay chains.',
  Bi: 'Bismuth-209 was thought to be stable until 2003, when its half-life was measured at 2 x 10^19 years, a billion times the age of the universe.',
  Po: 'Every polonium atom on Earth was born in a uranium decay chain. Marie and Pierre Curie discovered it in 1898 in uranium ore.',
  Rn: 'Radon seeps out of the ground as uranium in rocks decays. It is the largest natural source of radiation exposure for most people.',
  Th: 'Thorium-232 has a half-life of 14 billion years, so most thorium made before the Sun formed is still here. It is used to date ancient stars.',
  U: 'Uranium-238 (4.5 billion years) and uranium-235 (700 million years) were forged by the r-process. Two billion years ago, U-235 was abundant enough that natural nuclear reactors ran at Oklo, Gabon.',
  Np: 'Trace neptunium forms naturally when uranium captures neutrons in ore, but practically all of it is made in reactors.',
  Pu: 'A few atoms of plutonium-244 from recent r-process events have been found in deep-sea crust, raining onto Earth from space.',
  Og: 'Oganesson was made in 2002 by firing calcium-48 at californium-249. Only a handful of atoms have ever existed, each lasting less than a millisecond.',
};
