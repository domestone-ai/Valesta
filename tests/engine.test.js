/*
 * Copyright (C) 2026 Domestone S.r.l.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const MCA = require('../src/js/engine.js');
const DEFAULT_STATE = require('../src/js/data.js');

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b} (±${tol})`);

function baseState() {
  return {
    meta: { valuationDate: '2026-11-22' },
    subject: {
      areaBuilt: 113, rooms: [{ name: 'x', m2: 85.6 }], parking: true, storage: true, floor: 3, elevator: true,
      yearBuilt: 1999, condition: 'muy_bueno', orientation: 'SE', bedrooms: 4, bathrooms: 2,
      terraceM2: 4, galleryM2: 4, ac: true, heating: true, pool: false, garden: false,
    },
    settings: {
      scalePreset: 'weighted', negotiationDefault: 0.94, annex: { parking: 18000, storage: 4000 },
      estimator: 'weighted', trimPct: 0.1, rounding: 1000, listingMarginPct: 5,
      timeAdjust: true, timeTrendAnnual: 0.081, areaBasis: 'built',
    },
    factors: MCA.FACTORS.map((f) => ({ ...f })),
    comparables: [],
  };
}
function comp(o) {
  return Object.assign({ id: 'T', include: true, source: 'portal', date: '2026-11-22', price: 495000, areaBuilt: 110, parking: true, storage: true, ratings: {} }, o);
}

test('unit base deducts annexes after negotiation', () => {
  const s = baseState();
  s.comparables = [comp({})];
  const r = MCA.compute(s);
  close(r.comps[0].unitBase, (495000 * 0.94 - 22000) / 110, 1e-9);
  close(r.comps[0].unitBase, 4030, 0.01);
});

test('weighted preset multiplies factor coefficients', () => {
  const s = baseState();
  s.comparables = [comp({ ratings: { loc: 1, floor: 1, orient: 1, clim: 1 } })];
  const r = MCA.compute(s);
  close(r.comps[0].kTotal, 1.075 * 1.03 * 1.02 * 1.02);
});

test('uniform10 preset uses 10% per level', () => {
  const s = baseState();
  s.settings.scalePreset = 'uniform10';
  s.comparables = [comp({ ratings: { cond: 1 } })];
  const r = MCA.compute(s);
  const f = r.comps[0].factors.find((x) => x.id === 'cond');
  close(f.k, 1.1);
  close(r.comps[0].kTotal, 1.1);
});

test('excluded comparables stay out of statistics', () => {
  const s = baseState();
  s.comparables = [comp({ id: 'A' }), comp({ id: 'B', include: false })];
  const r = MCA.compute(s);
  assert.equal(r.stats.n, 1);
});

test('comparables without price or area are ignored with a warning', () => {
  const s = baseState();
  s.comparables = [comp({ id: 'A', price: null }), comp({ id: 'B', areaBuilt: 0 }), comp({ id: 'C' })];
  const r = MCA.compute(s);
  assert.equal(r.stats.n, 1);
  assert.equal(r.comps[0].valid, false);
  assert.ok(r.warnings.some((w) => w.code === 'invalid_comp' && w.compId === 'A'));
  for (const c of r.comps) assert.ok(!Number.isNaN(c.weight));
});

test('fewer than two comparables flags insufficient sample and no CI', () => {
  const s = baseState();
  s.comparables = [comp({})];
  const r = MCA.compute(s);
  assert.equal(r.stats.ciLow, null);
  assert.equal(r.rangeLow, null);
  assert.ok(r.warnings.some((w) => w.code === 'insufficient'));
});

test('total adds annexes and rounds to the rounding step', () => {
  const s = baseState();
  s.comparables = [comp({})];
  const r = MCA.compute(s);
  const expected = Math.round((r.unitValue * 113 + 22000) / 1000) * 1000;
  assert.equal(r.total, expected);
  assert.equal(r.annexValue, 22000);
  assert.equal(r.refArea, 113);
});

test('time adjustment compounds the annual trend', () => {
  const s = baseState();
  s.comparables = [comp({ date: '2025-11-22' })];
  const r = MCA.compute(s);
  close(r.comps[0].kTime, 1.081, 0.001);
});

test('weight is source reliability times similarity', () => {
  const s = baseState();
  s.comparables = [comp({ ratings: { lift: 2 } })];
  const r = MCA.compute(s);
  close(r.comps[0].grossAdj, 0.1);
  close(r.comps[0].similarity, 0.9);
  close(r.comps[0].weight, 0.85 * 0.9);
});

test('weighted estimator is the weight-averaged homogenized unit price', () => {
  const s = baseState();
  s.comparables = [comp({ id: 'A' }), comp({ id: 'B', price: 600000, ratings: { lift: 2, cond: -1 } })];
  const r = MCA.compute(s);
  const [a, b] = r.comps;
  close(r.unitValue, (a.unitHomog * a.weight + b.unitHomog * b.weight) / (a.weight + b.weight));
});

test('CI uses Student t with n-1 degrees of freedom', () => {
  const s = baseState();
  s.comparables = [comp({ id: 'A' }), comp({ id: 'B', price: 520000 }), comp({ id: 'C', price: 470000 })];
  const r = MCA.compute(s);
  close(r.stats.tCrit, 4.303);
  close(r.stats.ciHigh - r.unitValue, 4.303 * r.stats.std / Math.sqrt(3), 1e-6);
});

test('ciLevel 0.80 uses the 80% two-sided Student t', () => {
  const s = baseState();
  s.settings.ciLevel = 0.8;
  s.comparables = [comp({ id: 'A' }), comp({ id: 'B', price: 520000 }), comp({ id: 'C', price: 470000 })];
  const r = MCA.compute(s);
  close(r.stats.tCrit, 1.886);
  assert.equal(r.stats.ciLevel, 0.8);
});

test('distanceKm is the haversine distance', () => {
  close(MCA.util.distanceKm(41.2831, 1.9814, 41.2829, 1.9792), 0.185, 0.005);
  assert.equal(MCA.util.distanceKm(null, 1, 2, 3), null);
});

test('compute exposes the distance of each comparable to the subject', () => {
  const s = baseState();
  s.subject.lat = 41.2831; s.subject.lon = 1.9814;
  s.comparables = [comp({ lat: 41.2829, lon: 1.9792 }), comp({ id: 'B', lat: null, lon: null })];
  const r = MCA.compute(s);
  close(r.comps[0].distanceKm, 0.185, 0.005);
  assert.equal(r.comps[1].distanceKm, null);
});

test('DEFAULT_STATE: every comparable has coordinates and points of interest are listed', () => {
  for (const c of DEFAULT_STATE.comparables) assert.ok(typeof c.lat === 'number' && typeof c.lon === 'number', c.id);
  assert.ok(DEFAULT_STATE.subject.pois.length >= 4);
});

test('trimmed mean and quartiles follow Excel semantics', () => {
  close(MCA.util.trimmedMean([1, 2, 3, 4, 100], 0.4), 3);
  close(MCA.util.trimmedMean([1, 2, 3, 4, 100], 0.1), 22);
  close(MCA.util.median([5, 1, 3, 2]), 2.5);
  close(MCA.util.quantileInc([1, 2, 3, 4], 0.25), 1.75);
});

test('suggestRatings: lift +2 for a 3rd floor without lift', () => {
  const s = baseState();
  const r = MCA.suggestRatings(s.subject, comp({ floor: 3, elevator: false }), s.settings);
  assert.equal(r.lift, 2);
});

test('suggestRatings: size rating follows the area ratio', () => {
  const s = baseState();
  assert.equal(MCA.suggestRatings(s.subject, comp({ areaBuilt: 94 }), s.settings).size, -1);
  assert.equal(MCA.suggestRatings(s.subject, comp({ areaBuilt: 140 }), s.settings).size, 1);
  assert.equal(MCA.suggestRatings(s.subject, comp({ areaBuilt: 110 }), s.settings).size, 0);
});

test('suggestRatings: new build comparable gives age -2 and loc is never suggested', () => {
  const s = baseState();
  const r = MCA.suggestRatings(s.subject, comp({ newBuild: true }), s.settings);
  assert.equal(r.age, -2);
  assert.ok(!('loc' in r));
});

test('DEFAULT_STATE: references R1 and R2 excluded, at least 6 included, plausible value', () => {
  const st = JSON.parse(JSON.stringify(DEFAULT_STATE));
  const r = MCA.compute(st);
  const byId = (id) => r.comps.find((c) => c.id === id);
  assert.equal(byId('R1').include, false);
  assert.equal(byId('R2').include, false);
  assert.ok(r.stats.n >= 6, `n=${r.stats.n}`);
  assert.ok(r.total >= 450000 && r.total <= 600000, `total=${r.total}`);
  assert.equal(r.refArea, 113);
  assert.ok(r.rangeLow < r.total && r.total < r.rangeHigh);
});

test('every factor, level, source and condition is labelled in it/en/es', () => {
  for (const f of MCA.FACTORS) for (const k of ['label_it', 'label_en', 'label_es', 'desc_it', 'desc_en', 'desc_es']) assert.ok(f[k], `${f.id}.${k}`);
  for (const l of MCA.LEVELS) for (const k of ['it', 'en', 'es']) assert.ok(l[k], `level ${l.v}.${k}`);
  for (const [id, s] of Object.entries(MCA.SOURCES)) for (const k of ['it', 'en', 'es']) assert.ok(s[k], `source ${id}.${k}`);
  for (const [id, c] of Object.entries(MCA.CONDITIONS)) for (const k of ['it', 'en', 'es']) assert.ok(c[k], `condition ${id}.${k}`);
});

test('warnings are available in it/en/es', () => {
  const s = baseState();
  s.comparables = [comp({ id: 'A', price: null })];
  const r = MCA.compute(s);
  for (const w of r.warnings) for (const k of ['it', 'en', 'es']) assert.ok(w[k], `${w.code}.${k}`);
});

test('deductions for regularisation costs lower the value and its range', () => {
  const st = JSON.parse(JSON.stringify(DEFAULT_STATE));
  const a = MCA.compute(st);
  st.technical = { deductions: [{ label: 'DiRi impianto elettrico', amount: 1500 }, { label: 'x', amount: 'abc' }] };
  const b = MCA.compute(st);
  const step = Number(st.settings.rounding) || 1000;
  assert.equal(b.deductions, 1500);
  assert.equal(b.total, MCA.util.roundTo(a.totalRaw - 1500, step));
  assert.ok(b.rangeLow < a.rangeLow || a.rangeLow == null);
  assert.equal(MCA.compute(JSON.parse(JSON.stringify(DEFAULT_STATE))).deductions, 0);
});

test('income approach: capitalisation of the net operating income', () => {
  const r = MCA.approaches.income({ rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 5 });
  assert.equal(r.gross, 18000);
  close(r.effective, 17100);
  close(r.noi, 14535);
  close(r.value, 290700);
  assert.equal(MCA.approaches.income({ rentMonthly: 1500 }), null, 'no rate, no value');
});

test('cost approach: depreciated replacement cost plus land', () => {
  const r = MCA.approaches.cost({ landValue: 80000, unitCost: 1500, area: 100, fees: 10, depreciation: 20 });
  close(r.costNew, 150000);
  close(r.value, 212000);
  assert.equal(MCA.approaches.cost({ landValue: 80000 }), null);
});

test('residual approach: development value less costs, finance and profit', () => {
  const r = MCA.approaches.residual({ sellArea: 1000, unitPrice: 3000, buildCost: 1500000, fees: 10, finance: 5, profit: 15, saleCosts: 3 });
  close(r.gdv, 3000000);
  close(r.value, 727500);
});

test('reconciliation weights the approaches and moves the final value', () => {
  const st = JSON.parse(JSON.stringify(DEFAULT_STATE));
  const base = MCA.compute(st);
  const step = Number(st.settings.rounding) || 1000;
  st.approaches = { income: { on: true, rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 5 }, weights: { market: 60, income: 40 } };
  const r = MCA.compute(st);
  const want = 0.6 * base.totalRaw + 0.4 * 290700;
  close(r.approaches.reconciled.value, want, 0.01);
  assert.equal(r.total, MCA.util.roundTo(want, step));
  assert.equal(r.marketTotal, base.total);
  st.approaches.income.on = false;
  assert.equal(MCA.compute(st).total, base.total, 'switched off: market value only');
});


test('key numbers out of range are bounded: factor weights, overrides, negotiation, time trend, rounding', () => {
  const base = JSON.parse(JSON.stringify(DEFAULT_STATE));
  const r0 = MCA.compute(base);
  for (const delta of [Infinity, 1e15, -5]) {
    const st = JSON.parse(JSON.stringify(DEFAULT_STATE));
    st.factors = st.factors.map((f) => Object.assign({}, f, { delta }));
    const r = MCA.compute(st);
    assert.ok(Number.isFinite(r.total) && r.total > r0.total / 4 && r.total < r0.total * 4, `delta ${delta}: total ${r.total}`);
    r.comps.forEach((c) => c.factors.forEach((f) => assert.ok(f.k >= 0.5 && f.k <= 1.5, `k ${f.k}`)));
  }
  const ov = JSON.parse(JSON.stringify(DEFAULT_STATE));
  ov.comparables[0].kOverride = { loc: 50 };
  assert.ok(MCA.compute(ov).comps[0].factors.find((f) => f.id === 'loc').k <= 1.5, 'override bounded');
  const neg = JSON.parse(JSON.stringify(DEFAULT_STATE));
  neg.comparables.forEach((c) => { c.negotiation = -1; });
  assert.ok(MCA.compute(neg).comps.every((c) => c.kSource > 0), 'negative negotiation ignored');
  const tr = JSON.parse(JSON.stringify(DEFAULT_STATE));
  tr.settings = Object.assign({}, tr.settings, { timeTrendAnnual: 1e15, timeAdjust: true });
  const rt = MCA.compute(tr);
  assert.ok(Number.isFinite(rt.total) && rt.total < r0.total * 4, `trend: total ${rt.total}`);
  const rd = JSON.parse(JSON.stringify(DEFAULT_STATE));
  rd.settings = Object.assign({}, rd.settings, { rounding: 0.0001 });
  assert.equal(MCA.compute(rd).total % 1, 0, 'rounding to whole amounts at least');
});

test('a subject area that is zero or negative gives no value and a warning, not a wrong figure', () => {
  for (const v of [-1, 0]) {
    const st = JSON.parse(JSON.stringify(DEFAULT_STATE));
    st.subject.areaBuilt = v; st.subject.areaBuiltCommon = v; st.subject.areaUseful = v; st.subject.rooms = [];
    const r = MCA.compute(st);
    assert.equal(r.total, null, `area ${v}: total ${r.total}`);
    assert.ok(r.warnings.some((w) => w.code === 'invalid_area'), 'warning invalid_area');
  }
});

test('distances need coordinates on the globe', () => {
  assert.equal(MCA.util.distanceKm(45, 12, 45, 1e15), null);
  assert.equal(MCA.util.distanceKm(95, 12, 45, 12), null);
  assert.ok(MCA.util.distanceKm(45, 12, 45.01, 12) > 1);
});


test('the confidence interval of the weighted estimator uses the weighted deviation and the effective sample size', () => {
  const s = baseState();
  s.comparables = [comp({ id: 'A' }), comp({ id: 'B', price: 520000 }), comp({ id: 'C', price: 470000 }), comp({ id: 'D', price: 610000, ratings: { loc: 2, size: -1 } })];
  const r = MCA.compute(s);
  const used = r.comps.filter((c) => c.include);
  const w = used.map((c) => c.weight);
  const x = used.map((c) => c.unitHomog);
  assert.ok(Math.max(...w) - Math.min(...w) > 0.01, 'weights differ');
  const sw = w.reduce((a, b) => a + b, 0);
  const sw2 = w.reduce((a, b) => a + b * b, 0);
  const m = x.reduce((a, v, i) => a + v * w[i], 0) / sw;
  const nEff = (sw * sw) / sw2;
  const sdw = Math.sqrt(x.reduce((a, v, i) => a + w[i] * (v - m) ** 2, 0) / (sw - sw2 / sw));
  const df = Math.max(1, Math.floor(nEff - 1));
  close(r.unitValue, m, 1e-9);
  close(r.stats.nEff, nEff, 1e-9);
  close(r.stats.stdWeighted, sdw, 1e-9);
  close(r.stats.ciHigh - r.unitValue, MCA.util.tCrit(df, r.stats.ciLevel) * sdw / Math.sqrt(nEff), 1e-6);
  close(r.unitValue - r.stats.ciLow, r.stats.ciHigh - r.unitValue, 1e-9);
  s.settings.estimator = 'mean';
  const rm = MCA.compute(s);
  close(rm.stats.ciHigh - rm.unitValue, MCA.util.tCrit(3, rm.stats.ciLevel) * rm.stats.std / 2, 1e-6);
});

// ---- Valesta 1.1: engine fixes (docs/methodology/6-code-findings.md) ----
const demo = () => JSON.parse(JSON.stringify(DEFAULT_STATE));
const incomeOnly = { on: true, rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 4.5 };

test('F-01: negotiationDefault accepts only (0, 1.5], else 1', () => {
  assert.equal(MCA.negotiationDefault({ negotiationDefault: 0.94 }), 0.94);
  assert.equal(MCA.negotiationDefault({ negotiationDefault: 0 }), 1);
  assert.equal(MCA.negotiationDefault({ negotiationDefault: 2 }), 1);
  assert.equal(MCA.negotiationDefault({}), 1);
  assert.equal(MCA.negotiationDefault(undefined), 1);
});

test('F-01: without the setting, the simulation is centred on the value the engine computes', () => {
  const s = demo();
  delete s.settings.negotiationDefault;
  const r = MCA.compute(s);
  const rob = MCA.robustness(s, { n: 200, seed: 1 });
  assert.ok(Math.abs(rob.mc.p50 - r.totalRaw) / r.totalRaw < 0.01, `P50 ${rob.mc.p50} vs value ${r.totalRaw}`);
});

test('F-23: an unknown estimator falls back to the weighted mean', () => {
  assert.deepEqual(MCA.ESTIMATORS, ['weighted', 'mean', 'median', 'trimmed']);
  const s = demo();
  const w = MCA.compute(s).total;
  s.settings.estimator = 'max';
  const r = MCA.compute(s);
  assert.equal(r.estimator, 'weighted');
  assert.equal(r.total, w);
});

test('F-21: no range when the sales comparison has weight 0', () => {
  const s = demo();
  s.approaches = { income: incomeOnly, weights: { market: 0, income: 100 } };
  const r = MCA.compute(s);
  assert.equal(r.total, 323000);
  assert.equal(r.rangeLow, null);
  assert.equal(r.rangeHigh, null);
});

test('F-21: missing area with another approach: value from the other approaches, explicit warning', () => {
  const s = demo();
  s.subject.areaBuilt = 0;
  s.approaches = { income: incomeOnly, weights: { market: 100, income: 100 } };
  const r = MCA.compute(s);
  assert.equal(r.total, 323000);
  assert.equal(r.rangeLow, null);
  const w = r.warnings.find((x) => x.code === 'invalid_area');
  assert.ok(w && /other approaches/.test(w.en), w && w.en);
});

test('F-21: one comparable gives a value without range, and the warning says so', () => {
  const s = demo();
  s.comparables.forEach((c, i) => { if (i > 0) c.include = false; });
  const r = MCA.compute(s);
  assert.ok(r.total > 0);
  assert.equal(r.rangeLow, null);
  const w = r.warnings.find((x) => x.code === 'insufficient');
  assert.ok(w && /no range/i.test(w.en), w && w.en);
});

test('F-08: the listing price step scales with the rounding step', () => {
  assert.equal(MCA.listingStep({ rounding: 1000 }), 5000);
  assert.equal(MCA.listingStep({ rounding: 100000 }), 500000);
  assert.equal(MCA.listingStep({}), 5000);
  const s = demo();
  s.settings.rounding = 100000;
  const r = MCA.compute(s);
  assert.equal(r.listingPrice % 500000, 0);
});

test('F-24: a new-build comparable against a new-build subject gets age 0', () => {
  assert.equal(MCA.suggestRatings({ yearBuilt: 2026, condition: 'nuevo' }, { newBuild: true }, {}).age, 0);
  assert.equal(MCA.suggestRatings({ newBuild: true }, { newBuild: true }, {}).age, 0);
  assert.equal(MCA.suggestRatings({ yearBuilt: 1990, condition: 'buen_estado' }, { newBuild: true }, {}).age, -2);
});

test('F-18: national energy classes are scored on the A–G scale', () => {
  const e = (a, b) => MCA.suggestRatings({ energyCert: a }, { energyCert: b }, {}).energy;
  assert.equal(e('A4', 'A'), 0);
  assert.equal(e('A1', 'C'), 1);
  assert.equal(e('A+', 'E'), 2);
  assert.equal(e('A0', 'A'), 0);
  assert.equal(e('G', 'H'), 0);
  assert.equal(e('E', 'H'), 1);
});

test('D4: the origin of a factor weight is default or valuer', () => {
  assert.equal(MCA.factorOrigin({ id: 'loc', delta: 0.075 }), 'default');
  assert.equal(MCA.factorOrigin({ id: 'loc', delta: 0.08 }), 'valuer');
  assert.equal(MCA.factorOrigin({ id: 'custom', delta: 0.05 }), 'valuer');
});

test('F-09: the small-sample warning names the Spanish rule as such', () => {
  const s = demo();
  s.comparables.forEach((c, i) => { if (i > 2) c.include = false; });
  const w = MCA.compute(s).warnings.find((x) => x.code === 'small_sample');
  assert.ok(w && !/best practice \(ECO\/805\)/.test(w.en) && /Orden ECO\/805\/2003/.test(w.en), w && w.en);
});
