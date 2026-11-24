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
const Checks = require('../src/js/checks.js');

const ES_DOCS = ['Nota simple (Registro de la Propiedad)', 'Certificado catastral · cédula de habitabilidad', 'Certificado de eficiencia energética'];
const st = (code, checks) => ({ subject: { propertyType: { code } }, meta: { country: 'ES' }, checks: checks || [] });
const topics = (code) => Checks.applicable(Checks.categoryOfCode(code)).map((c) => c.topic);

test('the list of checks follows the property type', () => {
  const flat = topics('RES.APARTMENT');
  for (const tp of ['title', 'easements', 'planning', 'cadastral', 'occupancy_permit', 'energy', 'installations', 'condominium', 'tenancy']) assert.ok(flat.includes(tp), tp);
  assert.ok(!flat.includes('environmental'));
  const land = topics('LND.AGRICULTURAL');
  for (const tp of ['energy', 'installations', 'condominium', 'occupancy_permit']) assert.ok(!land.includes(tp), tp);
  assert.ok(land.includes('environmental'));
  assert.ok(topics('IND.PRODUCTION').includes('environmental'));
  assert.equal(Checks.categoryOfCode('XYZ'), 'residential');
});

test('progress counts the applicable checks that have a status', () => {
  assert.deepEqual(Checks.progress(st('RES.APARTMENT')), { done: 0, total: 10 }, 'seismic safety included');
  const s = st('RES.APARTMENT', [{ topic: 'title', status: 'verified' }, { topic: 'energy', status: 'not_verified' }, { topic: 'environmental', status: 'verified' }]);
  assert.deepEqual(Checks.progress(s), { done: 2, total: 10 });
});

test('the report says what was verified and recommends the rest with a positive tone', () => {
  const s = st('RES.APARTMENT', [
    { topic: 'title', status: 'not_verified' },
    { topic: 'cadastral', status: 'verified', source: 'Certificado catastral', date: '2026-11-10' },
    { topic: 'energy', status: 'to_investigate' },
    { topic: 'condominium', status: 'not_applicable' },
  ]);
  const b = Checks.reportBlock(s, 'it', ES_DOCS);
  assert.equal(b.verified.length, 1);
  assert.match(b.verified[0].text, /Conformità catastale/);
  assert.match(b.verified[0].text, /Certificado catastral/);
  assert.ok(b.advice.some((a) => a.topic === 'title' && a.text.includes('Nota simple (Registro de la Propiedad)')));
  assert.ok(b.advice.some((a) => a.topic === 'energy' && a.deep));
  assert.ok(!b.advice.some((a) => a.topic === 'condominium'));
  assert.ok(!b.advice.some((a) => a.topic === 'title' && /non |nessun/i.test(a.text.slice(0, 3))));
  for (const lang of ['en', 'es', 'it']) {
    const x = Checks.reportBlock(s, lang, ES_DOCS);
    assert.ok(x.title && x.verifiedTitle && x.adviceTitle, lang);
    assert.ok(x.advice.every((a) => a.text.length > 40), lang);
  }
});

test('no statuses, no block: the report is unchanged until the checks are used', () => {
  assert.equal(Checks.reportBlock(st('RES.APARTMENT'), 'it', ES_DOCS), null);
});

test('energy advice claims no legal duty outside Spain', () => {
  const ch = { subject: { propertyType: { code: 'RES.APARTMENT' } }, meta: { country: 'CH' }, checks: [{ topic: 'title', status: 'verified' }, { topic: 'energy', status: 'not_verified' }] };
  const e = Checks.reportBlock(ch, 'en', ['Grundbuchauszug', '', 'GEAK / CECB']).advice.find((a) => a.topic === 'energy').text;
  assert.ok(e.includes('GEAK / CECB'), 'document named');
  assert.ok(!e.includes('normally required'), 'no duty claimed');
  const es = Checks.reportBlock(st('RES.APARTMENT', [{ topic: 'title', status: 'verified' }, { topic: 'energy', status: 'not_verified' }]), 'es', ES_DOCS);
  assert.ok(es.advice.find((a) => a.topic === 'energy').text.includes('suele exigirse'), 'Spain keeps it');
});

test('seismic safety is a check of its own, for buildings', () => {
  const topics = Checks.applicable(Checks.categoryOfCode('RES.APARTMENT')).map((c) => c.topic);
  assert.ok(topics.includes('seismic'));
  assert.ok(!Checks.applicable(Checks.categoryOfCode('LND.AGRICULTURAL')).map((c) => c.topic).includes('seismic'));
  assert.ok(Checks.GROUPS.some((g) => g.id === 'structure'));
});
