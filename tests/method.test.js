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
global.MCA = MCA;
global.Charts = require('../src/js/charts.js');
global.ASSETS = require('../src/js/assets.js');
const DEFAULT_STATE = require('../src/js/data.js');
const AppCore = require('../src/js/appcore.js');
const Method = require('../src/js/method.js');
const Report = require('../src/js/report.js');

const fresh = () => JSON.parse(JSON.stringify(DEFAULT_STATE));
const pageWith = (h, text) => {
  const i = h.indexOf(text);
  return i < 0 ? '' : h.slice(h.lastIndexOf('<section', i), h.indexOf('</section>', i));
};

test('facts: sources mix, dates, negotiation, origin of δ, estimator, interval and simulation', () => {
  const s = fresh();
  s.factors[0].delta = 0.09;
  s.factors[0].source = 'Local study 2026';
  const res = MCA.compute(s);
  const f = Method.facts(s, res, MCA.robustness(s, { n: 200 }));
  const used = res.comps.filter((r) => r.include).length;
  assert.equal(f.evidence.used, used);
  assert.equal(f.evidence.total, s.comparables.length);
  assert.equal(Object.values(f.evidence.bySource).reduce((a, b) => a + b, 0), used);
  assert.match(f.evidence.dateFrom, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(f.evidence.dateFrom <= f.evidence.dateTo);
  assert.equal(f.evidence.negotiation.value, 0.94);
  const loc = f.adjustment.factors.find((x) => x.id === s.factors[0].id);
  assert.equal(loc.origin, 'valuer');
  assert.equal(loc.source, 'Local study 2026');
  assert.equal(f.adjustment.valuer, 1);
  assert.equal(f.weights.floor, 0.2);
  assert.equal(f.weights.estimator, 'weighted');
  assert.equal(f.ci.level, 0.8);
  assert.ok(f.ci.low < f.ci.high);
  assert.equal(f.ci.approx, false);
  assert.equal(f.mc.n, 200);
  assert.ok(f.loo.maxAbs > 0 && f.loo.id);
});

test('facts: the interval of the median is an approximation (F-07); no simulation without its result', () => {
  const s = fresh();
  s.settings.estimator = 'median';
  const f = Method.facts(s, MCA.compute(s), null);
  assert.equal(f.ci.approx, true);
  assert.equal(f.mc, null);
  assert.equal(f.loo, null);
});

test('technical report: the method chapter shows the method applied in this valuation', () => {
  const s = fresh();
  s.meta.reportLang = 'en';
  const h = Report.render(s, MCA.compute(s));
  const page = pageWith(h, 'Method applied in this valuation');
  assert.ok(page, 'page present');
  for (const x of ['Sales comparison with homogenisation coefficients', 'Property portal', 'Negotiation coefficient', 'Origin of δ',
    'Weighted mean', '80%', 'not the range of prices', 'Leave-one-out', 'Limits', 'docs/methodology']) assert.ok(page.includes(x), x);
  assert.ok(h.includes('max(0.2, 1 − Σ'), 'the weight formula shows the floor of 0.2');
});

test('client report: a short method chapter with approach, evidence, interval and uncertainty', () => {
  const s = fresh();
  s.meta.reportLang = 'en';
  s.design = { preset: 'client', sections: Object.assign({}, Report.DEFAULT_DESIGN.sections, Report.PRESETS.client) };
  const h = Report.render(s, MCA.compute(s));
  const i = h.indexOf('data-sections="method"');
  assert.ok(i > 0, 'method page present');
  const page = h.slice(i, h.indexOf('</section>', i));
  for (const x of ['Sales comparison with homogenisation coefficients', 'Comparables', 'Confidence interval', 'Monte Carlo']) assert.ok(page.includes(x), x);
  assert.ok(!page.includes('Origin of δ'), 'no factor detail');
  assert.ok(!h.includes('Method applied in this valuation'), 'no technical page');
});

test('the valuer’s reason for the negotiation coefficient is printed (F-10) and is not carried into a new valuation', () => {
  const s = fresh();
  s.meta.reportLang = 'en';
  s.settings.negotiationReason = 'Margin observed in 12 local closings';
  assert.ok(Report.render(s, MCA.compute(s)).includes('Margin observed in 12 local closings'));
  assert.equal(AppCore.newValuation(DEFAULT_STATE, s, { country: 'IT' }).settings.negotiationReason, '');
});

test('method explanations exist for adjusted price, weight, unit value, range and P10–P90, in every interface language', () => {
  const list = Method.explain({ estimator: 'weighted' });
  assert.deepEqual(list.map((x) => x.id), ['adjusted', 'weight', 'unit', 'range', 'p10p90']);
  for (const x of list) {
    assert.ok(x.formula, x.id);
    assert.match(x.doc, /^(1-sales-comparison|2-uncertainty)\.md §\d\.\d+$/, x.id);
  }
  assert.match(list.find((x) => x.id === 'weight').formula, /max\(0\.2, 1 − Σ\|k − 1\|\)/);
  assert.match(Method.explain({ estimator: 'median' }).find((x) => x.id === 'unit').formula, /median/);
  assert.match(Method.explain({ estimator: 'mean' }).find((x) => x.id === 'range').formula, /√n$/);
  const UI = require('../src/js/ui_i18n.js');
  for (const l of ['en', 'es', 'it']) for (const x of list) assert.ok(UI[l].mx[x.id], `${l}: mx.${x.id}`);
});

test('country sources view: standards, the country’s references with their status, EU rules for member states, literature', () => {
  const it = Method.sources('IT');
  assert.ok(it.standards.some((r) => r.key === 'IVSC-2025'));
  assert.ok(it.country.some((r) => r.key === 'IT-UNI11612' && r.status));
  assert.ok(it.eu.some((r) => r.key === 'EU-CRR'));
  assert.ok(it.method.length >= 8);
  assert.equal(Method.sources('CH').eu.length, 0);
  assert.ok(Method.sources('GB').country.some((r) => r.key === 'RICS-RB-UK'));
});

test('F-13: the method chapter names the usual approaches of the property type that Valesta does not compute', () => {
  const s = fresh();
  s.meta.reportLang = 'en';
  s.subject.propertyType = { code: 'RET.HIGH_STREET_SHOP', description: '' };
  const res = MCA.compute(s);
  assert.deepEqual(Method.facts(s, res, null).approach.notComputed, ['discounted_cash_flow']);
  const page = pageWith(Report.render(s, res), 'Method applied in this valuation');
  assert.ok(page.includes('Discounted cash flow'), 'named in the report');
  const a = fresh();
  assert.deepEqual(Method.facts(a, MCA.compute(a), null).approach.notComputed, []);
});

test('review fix M4: the method page states n for unweighted estimators, keeps the default factors and drops the interval without a sales-comparison basis', () => {
  const s = fresh();
  s.settings.estimator = 'mean';
  const res = MCA.compute(s);
  assert.equal(Method.facts(s, res, null).ci.nEff, res.stats.n);
  const nof = fresh();
  delete nof.factors;
  assert.equal(Method.facts(nof, MCA.compute(nof), null).adjustment.factors.length, MCA.FACTORS.length);
  const inc = fresh();
  inc.approaches = { income: { on: true, rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 4.5 }, weights: { market: 0, income: 100 } };
  assert.equal(Method.facts(inc, MCA.compute(inc), null).ci, null);
});
