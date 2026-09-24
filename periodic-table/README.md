# Stardust: 3D periodic table & nuclear physics lab

An interactive, touch-friendly 3D periodic table where every element tells you **where in the universe its atoms were made**, plus hands-on labs for isotopes, half-lives, fusion, fission and a particle collider.

Open `index.html` in any modern browser (desktop or phone). No install or server needed.

## What's inside

### 3D periodic table
- All 118 elements as 3D tiles over a live starfield. Drag to orbit, pinch or scroll to zoom, tap an element.
- Six shapes: **Table, Sphere, Helix, Grid, By origin** (clustered by cosmic birthplace) and **Discovery** (a timeline by year).
- Colour by category, **cosmic origin**, state at any temperature (0–6000 K slider), longest half-life, Solar System abundance, electronegativity, mass, density, melting/boiling point, ionization energy, discovery year, block, or share of the human body.
- **Time machine** slider: watch the table fill in from antiquity to today.
- Every tile carries a stripe showing its full origin mix.
- Tap a legend entry to highlight just that group.

### Element details (tap any element)
- **Overview:** real photo of the element plus a gallery (live from Wikimedia Commons), live Wikipedia summary, discovery, name origin, uses, read-aloud.
- **Origin:** animated scene of the cosmic factory that made it (Big Bang, cosmic rays, dying low-mass stars, exploding massive stars, exploding white dwarfs, merging neutron stars/kilonovae, human-made, radioactive decay), percentages, step-by-step journey and element-specific stories.
- **Isotopes:** every isotope with natural abundance, half-life, decay modes and binding energy.
- **Atom:** 3D model with the real number of protons and neutrons, orbiting electrons per shell, switchable isotopes, electron configuration.
- **Properties:** ranked bars against the whole table and a solid/liquid/gas temperature chart.
- **Spectrum:** emission and absorption lines, flame-test colour, and the spectrum turned into sound.
- Compare any two elements side by side.

### Labs
- **Cosmic Origins:** the eight element factories, animated, with every element each one made, a cosmic timeline from the Big Bang to today, and what your body is made of by birthplace.
- **Isotope Lab:** zoomable chart of all 3,351 known nuclides (half-life, decay mode, binding energy or abundance), magic numbers, decay chains to stability, a Monte Carlo half-life simulator and a radiometric dating calculator.
- **Fusion Lab:** build any reaction from two nuclei; Q-values from real atomic masses, Coulomb barrier, energy per kg vs petrol and TNT, famous reactions (D-T, p-p chain, triple-alpha, CNO, carbon to silicon burning), the binding energy curve, stellar burning stages and a Lawson-criterion calculator.
- **Fission Lab:** choose fuel (U-235, Pu-239, U-233, Pu-241, U-238, Th-232, Cf-252) and the exact split; energy from masses, fragment decay chains, fission-yield curve, and a live **chain-reaction reactor** with enrichment, control rods, moderator, SCRAM and plutonium breeding.
- **Particle Collider:** pick any projectile (electron, positron, proton, antiproton, neutron or any nucleus) and any target, set speed and machine length, choose linac or ring and fixed-target or head-on. Get exact relativistic data (γ, energy, momentum, wavelength, time dilation), what the machine needs (voltage gradient or magnet field, laps, synchrotron losses) and the collision outcome: Rutherford scattering, tunneling fusion, fusion-evaporation (superheavy elements), neutron capture and activation, fission, fragmentation, spallation, antimatter annihilation, deep inelastic scattering, W/Z/Higgs/top production or quark-gluon plasma, with a detector event display. Includes presets such as LHC, RHIC, LEP, SLAC 1968, Rutherford 1909, Cockcroft-Walton 1932 and the tennessine discovery.
- **Quiz:** timed questions answered by tapping the 3D table, with streaks and a saved best score.

Keyboard: `/` search, `1`–`6` shapes, arrow keys move between elements, `Esc` closes.

## Data sources
- Element properties and photo links: [Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON) (CC BY-SA 3.0). Photos are from Wikimedia Commons, mostly by [images-of-elements.com](https://images-of-elements.com) (CC BY 3.0).
- Isotope masses and abundances: [all-isotopes](https://www.npmjs.com/package/all-isotopes) (MIT).
- Half-lives, decay modes and chains: ICRP Publication 107 via [radioactivedecay](https://github.com/radioactivedecay/radioactivedecay). Superheavy half-lives are approximate literature values.
- Cosmic origins: the nucleosynthesis periodic table by Jennifer Johnson (Ohio State University), rounded. The r-process sites are still an active research question.
- Solar System abundances: Asplund et al. (2009).
- Collider outcomes use exact kinematics with a simplified outcome model meant for learning, not research.

Photos and live summaries need an internet connection; everything else works offline.

## Development
```bash
npm install
npm run build      # bundles src/ into dist/app.js
npm run dev        # rebuild on change and serve at http://localhost:8000
npm run data       # regenerate src/data from tools/ (needs: pip install radioactivedecay)
```
Built with [three.js](https://threejs.org) and plain JavaScript modules bundled by esbuild.
