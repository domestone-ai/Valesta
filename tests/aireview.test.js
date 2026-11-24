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
const AIReview = require('../src/js/aireview.js');

const base = () => ({
  meta: { id: 'v1', visitDate: '2026-11-13', purpose: { it: 'Vendita', en: 'Sale' } },
  subject: { yearBuilt: null, rooms: [{ name: 'Sala', m2: 20 }] },
  comparables: [{ id: 'T1', price: 100 }, { id: 'T2', price: 200 }],
  texts: {}, aiLog: [], photos: [{ id: 'p', dataUrl: 'x' }],
});
const clone = (o) => JSON.parse(JSON.stringify(o));

test('diff lists the changed values, comparables by id and nothing else', () => {
  const before = base();
  const after = clone(before);
  after.subject.yearBuilt = 1999;
  after.meta.purpose.it = 'Vendita della casa';
  after.comparables[0].price = 120;
  after.comparables.splice(1, 1);
  after.comparables.push({ id: 'T3', price: 300 });
  after.texts.letter = { it: 'Gentile cliente' };
  after.photos = [];
  after.aiLog.push({ id: 'x' });
  const d = AIReview.diff(before, after);
  const byPath = (p) => d.filter((c) => c.path === p);
  assert.equal(byPath('subject.yearBuilt')[0].after, 1999);
  assert.deepEqual(byPath('meta.purpose')[0].before, { it: 'Vendita', en: 'Sale' });
  assert.equal(byPath('texts.letter')[0].before, undefined);
  assert.deepEqual(d.filter((c) => c.kind === 'comp-replace').map((c) => c.id), ['T1']);
  assert.deepEqual(d.filter((c) => c.kind === 'comp-remove').map((c) => [c.id, c.index]), [['T2', 1]]);
  assert.deepEqual(d.filter((c) => c.kind === 'comp-add').map((c) => c.id), ['T3']);
  assert.ok(!d.some((c) => /^(photos|aiLog|meta\.id)/.test(c.path)));
  assert.equal(AIReview.diff(base(), base()).length, 0);
});

test('rejecting a proposal restores the previous values but keeps what the user changed afterwards', () => {
  const before = base();
  const st = clone(before);
  st.subject.yearBuilt = 1999;
  st.meta.visitDate = '2026-11-20';
  st.comparables.push({ id: 'T3', price: 300 });
  const e = AIReview.entry({ request: 'compila', changes: AIReview.diff(before, st), at: '2026-11-23T10:00:00Z' });
  st.aiLog.push(e);
  st.meta.visitDate = '2026-11-21';
  const r = AIReview.reject(st, st.aiLog, e.id);
  assert.equal(st.subject.yearBuilt, null);
  assert.equal(st.meta.visitDate, '2026-11-21', 'edited by the user afterwards: kept');
  assert.ok(!st.comparables.some((c) => c.id === 'T3'));
  assert.equal(r.conflicts, 1);
  assert.equal(st.aiLog[0].status, 'rejected');
});

test('accepting, editing a field or accepting all close the proposals', () => {
  const st = base();
  const after = clone(st);
  after.subject.yearBuilt = 1999;
  after.meta.visitDate = '2026-11-20';
  const e1 = AIReview.entry({ changes: AIReview.diff(st, after) });
  const e2 = AIReview.entry({ changes: [{ path: 'texts.letter', kind: 'value', before: undefined, after: { it: 'x' } }] });
  const log = [e1, e2];
  assert.deepEqual([...AIReview.openPaths(log)].sort(), ['meta.visitDate', 'subject.yearBuilt', 'texts.letter']);
  AIReview.touch(log, 'subject.yearBuilt');
  assert.equal(log[0].status, 'open');
  AIReview.touch(log, 'meta.visitDate');
  assert.equal(log[0].status, 'accepted', 'all its fields confirmed by editing');
  AIReview.acceptAll(log);
  assert.equal(log[1].status, 'accepted');
  assert.deepEqual(AIReview.counts(log), { open: 0, accepted: 2, rejected: 0 });
});

test('the report declares the use of AI, in the report language', () => {
  assert.equal(AIReview.statement([], 'it'), null);
  const log = [Object.assign(AIReview.entry({ changes: [{ path: 'subject.yearBuilt', kind: 'value', before: null, after: 1 }], provider: 'Anthropic' }), { status: 'accepted' })];
  for (const lang of ['it', 'en', 'es']) {
    const s = AIReview.statement(log, lang);
    assert.ok(s.title && s.text.length > 80, lang);
    assert.match(s.text, /Anthropic/);
  }
  assert.match(AIReview.statement(log, 'it').text, /rivist/);
});

test('changes made by an assistant through MCP become a proposal to review', () => {
  const synced = base();
  const next = clone(synced);
  next.subject.yearBuilt = 1987;
  next.comparables[0].price = 120;
  const e = AIReview.fromExternal(synced, next, { provider: 'MCP', summary: 'Changes from the connected assistant' });
  assert.equal(e.status, 'open');
  assert.equal(e.provider, 'MCP');
  assert.ok(e.changes.some((c) => c.path === 'comparables#T1' && c.kind === 'comp-replace'), 'comparable changed');
  assert.ok(e.changes.some((c) => c.path === 'subject.yearBuilt' && c.after === 1987));
  assert.equal(AIReview.fromExternal(synced, clone(synced), {}), null, 'nothing changed, no proposal');
  const own = clone(synced);
  own.aiLog = [{ id: 'x', status: 'open', changes: [] }];
  assert.equal(AIReview.fromExternal(synced, own, {}), null, 'the review log itself is not a change');
});
