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
const fs = require('node:fs');
const path = require('node:path');
const MCA = require('../src/js/engine.js');
global.MCA = MCA;
global.Charts = require('../src/js/charts.js');
global.ASSETS = require('../src/js/assets.js');
const DEFAULT_STATE = require('../src/js/data.js');
const References = require('../src/js/references.js');
const Report = require('../src/js/report.js');

test('every reference has a key, a text, a link or identifier, a status and a date', () => {
  assert.ok(References.REFERENCES.length >= 70);
  for (const r of References.REFERENCES) {
    assert.match(r.key, /^[A-Z][A-Z0-9]*-[A-Z0-9-]+$/, r.key);
    assert.ok(r.text && r.text.length > 10, r.key);
    assert.ok(r.url || /ISBN|doi:/.test(r.text), r.key);
    assert.ok(['content', 'bibliographic', 'tbv'].includes(r.status), r.key);
    assert.ok(r.status === 'tbv' || /^20\d\d-\d\d-\d\d$/.test(r.date), r.key);
  }
});

test('the references are the entries of docs/methodology/5-bibliography.md', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'methodology', '5-bibliography.md'), 'utf8');
  const keys = [...md.matchAll(/^- \*\*\[([A-Z][A-Z0-9]*-[A-Z0-9-]+)\]\*\*/gm)].map((m) => m[1]).sort();
  assert.deepEqual(References.REFERENCES.map((r) => r.key).sort(), keys);
});

test('references by country, EU rules and international standards', () => {
  assert.ok(References.byCountry('ES').some((r) => r.key === 'ES-ECO805'));
  assert.ok(References.byCountry('DE').some((r) => r.key === 'DE-IMMOWERTV'));
  assert.equal(References.byCountry('XX').length, 0);
  assert.ok(References.international().some((r) => r.key === 'IVSC-2025'));
  assert.ok(References.euRules('IT').some((r) => r.key === 'EU-CRR'));
  assert.equal(References.euRules('CH').length, 0);
});

test('the sources chapter lists the methodological references with their status', () => {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  s.meta.reportLang = 'en';
  const html = Report.render(s, MCA.compute(s));
  assert.ok(html.includes('Methodological references'));
  assert.ok(html.includes('Orden ECO/805/2003'));
  assert.ok(html.includes('International Valuation Standards'));
  assert.ok(/verified 2026-11-24/.test(html));
});
