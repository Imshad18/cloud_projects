import { ELEMENTS, CATEGORIES } from './store.js';
import { SOURCES, SOURCE_ORDER } from './data/origins.js';
import { ramp, RAMP_CSS, fmt, fmtTime } from './util.js';

const STATE_COL = { solid: '#8fb3ff', liquid: '#4fe0c0', gas: '#ffb35c', unknown: '#6b7390' };
const BLOCK_COL = { s: '#ff7a6b', p: '#5cc8f0', d: '#f2d45c', f: '#d88bf5' };

export function stateAt(e, T) {
  if (e.melt == null) return 'unknown';
  if (T < e.melt) return 'solid';
  if (e.boil == null) return T < e.melt ? 'solid' : 'unknown';
  return T < e.boil ? 'liquid' : 'gas';
}

function numeric(key, get, { log = false, unit = '', label, note } = {}) {
  const vals = ELEMENTS.map(get).filter(v => v != null && !Number.isNaN(v) && (!log || v > 0));
  let min = Math.min(...vals), max = Math.max(...vals);
  const tf = v => (log ? Math.log10(v) : v);
  const lo = tf(min), hi = tf(max);
  return {
    key, label, note,
    color: e => { const v = get(e); if (v == null || (log && v <= 0)) return null; return ramp((tf(v) - lo) / (hi - lo || 1)); },
    value: e => { const v = get(e); return v == null ? '—' : `${fmt(v, 3)}${unit}`; },
    legend: { type: 'ramp', css: RAMP_CSS, min: `${fmt(min, 3)}${unit}`, max: `${fmt(max, 3)}${unit}` },
  };
}

export function buildModes(getT) {
  return {
    category: {
      label: 'Category',
      color: e => CATEGORIES[e.cat].color,
      value: e => e.cat,
      legend: { type: 'cats', items: Object.entries(CATEGORIES).map(([k, v]) => ({ key: k, label: v.label, color: v.color, match: e => e.cat === k })) },
    },
    origin: {
      label: 'Cosmic origin',
      color: e => SOURCES[e.dom].color,
      value: e => `${SOURCES[e.dom].short} ${e.origin.find(o => o.src === e.dom).pct}%`,
      note: 'Colour shows the main source; the stripe at the bottom of each tile shows the full mix. Tap a source to highlight it.',
      legend: { type: 'cats', items: SOURCE_ORDER.map(k => ({ key: k, label: SOURCES[k].short, color: SOURCES[k].color, match: e => e.origin.some(o => o.src === k) })) },
    },
    state: {
      label: 'State',
      color: e => STATE_COL[stateAt(e, getT())],
      value: e => stateAt(e, getT()),
      note: 'Drag the temperature slider to melt and boil the table.',
      legend: { type: 'cats', items: ['solid', 'liquid', 'gas', 'unknown'].map(k => ({ key: k, label: k[0].toUpperCase() + k.slice(1), color: STATE_COL[k], match: e => stateAt(e, getT()) === k })) },
    },
    halflife: {
      label: 'Longest half-life',
      color: e => (e.stableCount ? '#e9ecf8' : e.longest ? ramp(Math.max(0, (Math.log10(e.longest.hl) + 4) / 22)) : '#3a3f58'),
      value: e => (e.stableCount ? `${e.stableCount} stable` : e.longest ? fmtTime(e.longest.hl) : '—'),
      note: 'White tiles have at least one stable isotope. Others are coloured by their longest-lived isotope.',
      legend: { type: 'ramp', css: RAMP_CSS, min: '< 1 ms', max: '> 10¹⁰ years', extra: [{ label: 'Has a stable isotope', color: '#e9ecf8' }] },
    },
    abund: numeric('abund', e => (e.abund != null ? Math.pow(10, e.abund - 12) : null), { log: true, label: 'Atoms per hydrogen atom', note: 'Solar System abundance on a log scale, relative to hydrogen. Grey: not measured.' }),
    en: numeric('en', e => e.en, { label: 'Pauling' }),
    mass: numeric('mass', e => e.mass, { unit: ' u' }),
    density: numeric('density', e => e.density, { log: true, unit: ' g/cm³' }),
    melt: numeric('melt', e => e.melt, { unit: ' K' }),
    boil: numeric('boil', e => e.boil, { unit: ' K' }),
    ie: numeric('ie', e => e.ie, { unit: ' kJ/mol' }),
    year: {
      label: 'Discovery year',
      color: e => (e.year < 1650 ? '#fde68a' : ramp(1 - (e.year - 1650) / 376)),
      value: e => (e.year < 0 ? `${-e.year} BCE` : e.year < 1650 ? `${e.year} CE` : `${e.year}`),
      note: 'Pale gold elements were known in antiquity.',
      legend: { type: 'ramp', css: RAMP_CSS.replace('90deg', '270deg'), min: '1650', max: '2010', extra: [{ label: 'Ancient', color: '#fde68a' }] },
    },
    block: {
      label: 'Block',
      color: e => BLOCK_COL[e.block] || '#888',
      value: e => `${e.block}-block`,
      legend: { type: 'cats', items: Object.entries(BLOCK_COL).map(([k, c]) => ({ key: k, label: `${k}-block`, color: c, match: e => e.block === k })) },
    },
    body: {
      label: 'Human body',
      color: e => (e.body ? ramp(0.15 + 0.85 * (Math.log10(e.body) + 6) / 7.8) : null),
      value: e => (e.body ? `${fmt(e.body, 2)}% of body` : '—'),
      note: 'Share of your body mass. Oxygen, carbon, hydrogen and nitrogen make up 96%.',
      legend: { type: 'ramp', css: RAMP_CSS, min: 'trace', max: '65% (O)' },
    },
  };
}
