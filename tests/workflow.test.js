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
const DEFAULT_STATE = require('../src/js/data.js');
const AppCore = require('../src/js/appcore.js');
const Review = require('../src/js/review.js');
const Workflow = require('../src/js/workflow.js');

const fresh = () => JSON.parse(JSON.stringify(DEFAULT_STATE));
const status = (st) => { const res = MCA.compute(st); return Workflow.stepStatus(st, res, Review.run(st, res)); };

test('four phases with the steps of the design', () => {
  assert.deepEqual(Workflow.PHASES.map((p) => p.id), ['property', 'market', 'analysis', 'report']);
  assert.deepEqual(Workflow.PHASES.map((p) => p.steps.length), [4, 3, 4, 3], 'other approaches step in the analysis');
  assert.equal(new Set(Workflow.PHASES.flatMap((p) => p.steps)).size, 14);
  assert.equal(Workflow.phaseOf('comps').id, 'market');
  assert.deepEqual(Workflow.position('result'), { phase: 'analysis', n: 3, of: 4 });
  assert.equal(Workflow.stepLabel('comps', 'it'), 'Comparabili');
  assert.equal(Workflow.phaseLabel('report', 'es'), 'Informe');
});

test('every tab named by the review checks and the assistant leads to a step', () => {
  for (const tab of ['pratica', 'immobile', 'superfici', 'comparabili', 'omog', 'mercato', 'risultato', 'foto', 'testi', 'design', 'agenzia']) {
    assert.ok(Workflow.PHASES.some((p) => p.steps.includes(Workflow.stepForTab(tab))), tab);
  }
  assert.equal(Workflow.stepForTab('comparabili'), 'comps');
  assert.equal(Workflow.stepForTab('comps'), 'comps');
  assert.equal(Workflow.stepForTab('nope'), null);
});

test('the demo valuation is almost complete and shows how many comparables are used', () => {
  const s = status(fresh());
  assert.match(s.byStep.comps.badge, /^\d+\/\d+$/);
  assert.notEqual(s.byStep.result.status, 'todo');
  assert.ok(s.completeness >= 70 && s.completeness <= 100, String(s.completeness));
});

test('a blank valuation starts low and the steps fill in as data arrive', () => {
  const st = AppCore.blankState(DEFAULT_STATE);
  const s0 = status(st);
  assert.equal(s0.byStep.areas.status, 'todo');
  assert.equal(s0.byStep.comps.status, 'todo');
  assert.ok(s0.completeness < 40, String(s0.completeness));
  st.subject.areaBuilt = 95;
  assert.notEqual(status(st).byStep.areas.status, 'todo');
});

test('problems found by the review turn their step orange with a count', () => {
  const st = fresh();
  st.subject.address = '';
  const s = status(st);
  assert.equal(s.byStep.features.status, 'warn');
  assert.ok(s.byStep.features.issues >= 1);
  assert.ok(s.issues.some((i) => i.step === 'features' && i.level === 'error'));
});

test('command bar: steps, actions and a free question for the AI', () => {
  const all = Workflow.commands('', 'it');
  assert.ok(all.some((c) => c.id === 'go:comps'));
  assert.ok(all.some((c) => c.id === 'act:export-pdf'));
  assert.equal(Workflow.commands('compar', 'it')[0].id, 'go:comps');
  assert.equal(Workflow.commands('esporta', 'it')[0].group, 'export');
  const ask = Workflow.commands('trova 6 comparabili vicini', 'it');
  assert.equal(ask[0].id, 'ai:ask');
  assert.equal(ask[0].text, 'trova 6 comparabili vicini');
  assert.equal(Workflow.commands('ríveDi', 'it').find((c) => c.ai && c.id !== 'ai:ask').group, 'ai');
});

test('the checks step is complete when every applicable check has a status', () => {
  const s = fresh();
  s.checks = [];
  assert.equal(status(s).byStep.checks.status, 'opt');
  s.checks = [{ topic: 'title', status: 'verified' }];
  assert.equal(status(s).byStep.checks.status, 'warn');
  s.checks = ['title', 'easements', 'planning', 'cadastral', 'occupancy_permit', 'seismic', 'energy', 'installations', 'condominium', 'tenancy'].map((topic) => ({ topic, status: 'not_verified' }));
  assert.equal(status(s).byStep.checks.status, 'ok');
});

test('every changed value leads to the step where it is edited', () => {
  const cases = { 'subject.yearBuilt': 'features', 'subject.areaBuilt': 'areas', 'subject.rooms': 'areas', 'subject.cadastralRef': 'areas', 'subject.propertyType': 'identity',
    'comparables#T1': 'comps', comparables: 'comps', 'market.references': 'sources', 'market.cityAvg': 'marketdata', 'texts.letter': 'content', 'meta.visitDate': 'identity',
    'settings.negotiationDefault': 'result', factors: 'adjust', 'design.sections.market': 'content', 'design.coverStyle': 'style', 'brand.name': 'style', checks: 'checks' };
  for (const [path, step] of Object.entries(cases)) assert.equal(Workflow.stepForPath(path), step, path);
});

test('the other approaches have their own optional step', () => {
  assert.equal(Workflow.stepForPath('approaches.income.capRate'), 'methods');
  assert.deepEqual(Workflow.PHASES.find((p) => p.id === 'analysis').steps, ['adjust', 'methods', 'result', 'checks']);
  assert.equal(Workflow.stepLabel('methods', 'it'), 'Altri metodi');
});
