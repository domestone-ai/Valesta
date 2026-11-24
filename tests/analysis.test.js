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
global.MCA = MCA;
const Review = require('../src/js/review.js');
const AppCore = require('../src/js/appcore.js');

const fresh = () => JSON.parse(JSON.stringify(DEFAULT_STATE));
const byId = (rv, id) => rv.checks.find((c) => c.id === id);

// ---------- robustness ----------
test('robustness: leave-one-out covers every comparable used in the calculation', () => {
  const s = fresh();
  const base = MCA.compute(s);
  const r = MCA.robustness(s, { n: 300, seed: 7 });
  assert.equal(r.loo.length, base.stats.n);
  r.loo.forEach((x) => {
    assert.ok(typeof x.id === 'string' && x.id);
    assert.ok(Number.isFinite(x.total) && x.total > 0);
    assert.ok(Math.abs(x.delta - (x.total - base.total) / base.total) < 1e-9);
  });
  assert.ok(r.loo.some((x) => x.total !== base.total), 'removing a comparable must move the value');
  assert.ok(r.looMaxAbs >= Math.max(...r.loo.map((x) => Math.abs(x.delta))) - 1e-12);
});

test('robustness: Monte Carlo is reproducible and centred on the adopted value', () => {
  const s = fresh();
  const base = MCA.compute(s);
  const a = MCA.robustness(s, { n: 400, seed: 11 });
  const b = MCA.robustness(s, { n: 400, seed: 11 });
  assert.deepEqual(a.mc, b.mc);
  const m = a.mc;
  assert.equal(m.n, 400);
  assert.ok(m.p05 <= m.p10 && m.p10 <= m.p50 && m.p50 <= m.p90 && m.p90 <= m.p95);
  assert.ok(Math.abs(m.p50 - base.totalRaw) / base.totalRaw < 0.04, `p50 ${m.p50} vs ${base.totalRaw}`);
  assert.ok(m.p90 > m.p10);
  assert.equal(m.hist.reduce((t, h) => t + h.count, 0), 400);
  assert.ok(m.hist.every((h) => h.x1 > h.x0));
});

test('robustness: returns null when there is no value to analyse', () => {
  const s = fresh();
  s.comparables = [];
  assert.equal(MCA.robustness(s, { n: 50 }), null);
});

// ---------- review ----------
test('review: the example valuation scores well and flags the missing photos', () => {
  const s = fresh();
  const rv = Review.run(s, MCA.compute(s));
  assert.ok(rv.score >= 70 && rv.score <= 100, `score ${rv.score}`);
  assert.ok(['A', 'B', 'C'].includes(rv.grade));
  assert.equal(byId(rv, 'sample-size').level, 'ok');
  assert.equal(byId(rv, 'subject-photos').level, 'warn');
  assert.equal(byId(rv, 'report-advisor').level, 'ok');
  for (const c of rv.checks) {
    for (const l of ['it', 'en', 'es']) assert.ok(c.title[l] && typeof c.title[l] === 'string', `${c.id} title ${l}`);
    assert.ok(['ok', 'info', 'warn', 'error'].includes(c.level));
    assert.ok(['data', 'sample', 'method', 'report'].includes(c.area));
  }
});

test('review: a blank valuation is graded poorly with blocking errors', () => {
  const blank = AppCore.blankState(DEFAULT_STATE, fresh());
  const rv = Review.run(blank, MCA.compute(blank));
  assert.ok(rv.score < 50, `score ${rv.score}`);
  assert.equal(byId(rv, 'sample-size').level, 'error');
  assert.equal(byId(rv, 'subject-address').level, 'error');
  assert.ok(rv.counts.error >= 2);
});

test('review: stale comparables and heavy adjustments are reported by id', () => {
  const s = fresh();
  s.comparables[0].date = '2025-01-10';
  s.comparables[1].ratings.loc = 2;
  s.comparables[1].ratings.cond = 2;
  s.comparables[1].ratings.age = 2;
  s.comparables[1].ratings.size = 2;
  const rv = Review.run(s, MCA.compute(s));
  const rec = byId(rv, 'sample-recency');
  assert.notEqual(rec.level, 'ok');
  assert.match(rec.detail.it, new RegExp(s.comparables[0].id));
  const gross = byId(rv, 'sample-gross');
  assert.notEqual(gross.level, 'ok');
  assert.match(gross.detail.en, new RegExp(s.comparables[1].id));
});

test('review: every check that is not ok points to a tab of the editor', () => {
  const blank = AppCore.blankState(DEFAULT_STATE, fresh());
  const rv = Review.run(blank, MCA.compute(blank));
  const tabs = ['pratica', 'immobile', 'superfici', 'comparabili', 'omog', 'mercato', 'risultato', 'foto', 'testi', 'agenzia', 'design'];
  rv.checks.filter((c) => c.level !== 'ok').forEach((c) => assert.ok(c.fix && tabs.includes(c.fix.tab), `${c.id} → ${c.fix && c.fix.tab}`));
});

// ---- Valesta 1.1: review checks ----
test('D2: the review asks to confirm unconfirmed market inputs', () => {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  s.settings.marketConfirmed = false;
  const c = byId(Review.run(s, MCA.compute(s)), 'method-market');
  assert.ok(c, 'check present');
  assert.equal(c.level, 'warn');
  s.settings.marketConfirmed = true;
  assert.equal(byId(Review.run(s, MCA.compute(s)), 'method-market'), undefined);
});

test('F-20: the review lists comparables with overrides', () => {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  s.comparables[0].annexOverride = 0;
  s.comparables[1].kOverride = { loc: 1.3 };
  const c = byId(Review.run(s, MCA.compute(s)), 'method-overrides');
  assert.ok(c, 'check present');
  assert.equal(c.level, 'info');
  assert.match(c.detail.en, /T1/);
  assert.match(c.detail.en, /T2/);
});

test('F-17: the sources check follows the engine: agency mandates and missing sources are asking prices', () => {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  s.comparables.forEach((c) => { c.source = 'mandato'; });
  assert.equal(byId(Review.run(s, MCA.compute(s)), 'sample-sources').level, 'info');
  s.comparables.forEach((c) => { delete c.source; });
  assert.equal(byId(Review.run(s, MCA.compute(s)), 'sample-sources').level, 'info');
  s.comparables[0].source = 'registro';
  assert.equal(byId(Review.run(s, MCA.compute(s)), 'sample-sources').level, 'ok');
});

test('F-14: the review asks for the reasoning when another approach is reconciled', () => {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  s.approaches = { income: { on: true, rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 4.5 }, weights: { market: 80, income: 20 } };
  assert.equal(byId(Review.run(s, MCA.compute(s)), 'method-reconciliation').level, 'warn');
  s.approaches.reason = 'Thin rental evidence.';
  assert.equal(byId(Review.run(s, MCA.compute(s)), 'method-reconciliation').level, 'ok');
  delete s.approaches;
  assert.equal(byId(Review.run(s, MCA.compute(s)), 'method-reconciliation'), undefined);
});

test('F-09 and F-16: review texts are not Spain-specific outside Spain and cite no unverified chapters', () => {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  s.meta.country = 'IT';
  s.subject.cadastralRef = '';
  s.subject.energyCert = '';
  s.photos = [];
  s.meta.purpose = '';
  const rv = Review.run(s, MCA.compute(s));
  assert.ok(!/Spanish|Spain/.test(byId(rv, 'subject-cadastre').detail.en));
  assert.ok(!/Spain/.test(byId(rv, 'subject-energy').detail.en));
  assert.ok(!/IVS 106/.test(byId(rv, 'subject-photos').detail.en));
  assert.ok(!/VPS 1/.test(byId(rv, 'report-purpose').detail.en));
});

test('F-10: the negotiation check claims no normal range', () => {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  s.settings.negotiationDefault = 0.7;
  assert.ok(!/1–12%/.test(byId(Review.run(s, MCA.compute(s)), 'method-negotiation').detail.en));
});

test('review fix I4: the confirmation covers the negotiation coefficient, valuations made from the 1.0 demo are asked to confirm, and asking prices need the reasoning of the coefficient', () => {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  s.settings.marketConfirmed = false;
  const c = byId(Review.run(s, MCA.compute(s)), 'method-market');
  assert.match(JSON.stringify(c), /negotiation coefficient/i);
  const old = JSON.parse(JSON.stringify(DEFAULT_STATE));   // a 1.0 file: no flag, the demo's market inputs
  delete old.settings.marketConfirmed;
  assert.ok(byId(Review.run(old, MCA.compute(old)), 'method-market'), '1.0 file with the demo inputs');
  old.settings.timeTrendAnnual = 0.03;
  assert.equal(byId(Review.run(old, MCA.compute(old)), 'method-market'), undefined, '1.0 file with its own inputs');
  const r = JSON.parse(JSON.stringify(DEFAULT_STATE));
  r.settings.negotiationReason = '';
  const why = byId(Review.run(r, MCA.compute(r)), 'method-negotiation-reason');
  assert.ok(why, 'asking prices without reasoning');
  assert.equal(why.level, 'info');
  r.comparables.forEach((x) => { x.source = 'registro'; });
  assert.equal(byId(Review.run(r, MCA.compute(r)), 'method-negotiation-reason'), undefined, 'closing prices only');
});
