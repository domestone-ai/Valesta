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
// Interface languages beyond Italian, English and Spanish: packs in src/js/lang-ui (drafts), labels of the modules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I18N = require('../src/js/i18n.js');
const UI = require('../src/js/ui_i18n.js');
const UiStrings = require('../tools/ui_strings.js');

const PACK_DIR = path.join(__dirname, '..', 'src', 'js', 'lang-ui');
const PACKS = fs.existsSync(PACK_DIR) ? fs.readdirSync(PACK_DIR).filter((f) => /^ui\.[a-z]{2}\.js$/.test(f)).map((f) => f.slice(3, 5)).sort() : [];
const holes = (s) => (String(s).match(/\{[a-z0-9]+\}/gi) || []).sort();

test('a pack extends the interface over English and translates the labels of the modules', () => {
  UI.extend('xx', () => ({ strings: { bNew: 'XX new', orient: { N: 'xN' } }, labels: { Comparables: 'XX comparables', 'Ask the AI: “{0}”': 'XX ask: {0}' } }));
  assert.equal(UI.xx.bNew, 'XX new');
  assert.equal(UI.xx.bSave, UI.en.bSave, 'a missing text is in English');
  assert.equal(UI.xx.orient.N, 'xN');
  assert.equal(UI.xx.orient.S, UI.en.orient.S, 'also inside a group');
  const comps = { en: 'Comparables', es: 'Testigos', it: 'Comparabili' };
  assert.equal(UI.text(comps, 'xx'), 'XX comparables');
  assert.equal(UI.text(comps, 'it'), 'Comparabili');
  assert.equal(UI.text({ en: 'Not translated', es: 'x', it: 'y' }, 'xx'), 'Not translated');
  assert.equal(UI.text({ en: 'Ask the AI: “hi”', es: '-', it: '-', _tpl: 'Ask the AI: “{0}”', _args: ['hi'] }, 'xx'), 'XX ask: hi');
  assert.equal(UI.text('plain', 'xx'), 'plain');
  assert.equal(UI.text(null, 'xx'), '');
});

test('plural forms follow the rules of each language', () => {
  const forms = { one: 'one', few: 'few', many: 'many', other: 'other' };
  const pl = UI.helpers('pl').pl;
  assert.deepEqual([1, 3, 5, 22, 1.5].map((n) => pl(n, forms)), ['one', 'few', 'many', 'few', 'other']);
  assert.equal(UI.helpers('fr').pl(0, { one: 'one', other: 'other' }), 'one', 'French: zero is singular');
  assert.equal(UI.helpers('de').pl(2, { one: 'one' }), 'one', 'a missing form falls back to the last one given');
});

test('the label extractor finds the labels of the modules, with placeholders for values', () => {
  const labels = UiStrings.labels();
  for (const s of ['Apartment in a multi-dwelling building', 'Identification', 'Cadastral conformity', 'Property address',
    'Italian cadastre (Agenzia delle Entrate)', 'Ask the AI: “{0}”']) assert.ok(labels.includes(s), s);
  assert.equal(labels.filter((s) => s.includes('${')).length, 0, 'no label keeps a JavaScript placeholder');
  assert.ok(labels.length > 240, String(labels.length));
});

test('every interface pack has all the texts of English, in the same form, and every label', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? [p + k + (Array.isArray(v) ? `[${v.length}]` : '')].concat(keys(v, p + k + '.')) : [p + k]));
  const labels = UiStrings.labels();
  for (const code of PACKS) {
    assert.ok(I18N.DRAFT.includes(code), `${code} is a draft language of the report`);
    const pack = UI.packs[code];
    assert.ok(pack && pack.strings && pack.labels, `${code}: pack registered`);
    assert.deepEqual(keys(pack.strings).sort(), keys(UI.en).sort(), `${code}: same texts as English`);
    const walk = (en, tr, p) => {
      for (const [k, v] of Object.entries(en)) {
        const x = tr[k];
        const at = `${code} ${p}${k}`;
        if (typeof v === 'function') {
          assert.equal(typeof x, 'function', at);
          assert.equal(x.length, v.length, `${at}: arguments`);
          const out = x(...Array.from({ length: v.length }, (_, i) => (i ? 'X' : 2)));
          assert.ok(typeof out === 'string' && out.trim(), `${at}: text`);
        } else if (v && typeof v === 'object') walk(v, x, `${p}${k}.`);
        else {
          assert.equal(typeof x, typeof v, at);
          if (typeof v === 'string') {
            assert.ok(!v.trim() || x.trim(), `${at}: empty`);
            assert.equal(x.includes('¤'), v.includes('¤'), `${at}: currency sign ¤`);
            assert.ok(!x.includes('€'), `${at}: no fixed euro sign`);
          }
        }
      }
    };
    walk(UI.en, pack.strings, '');
    const missing = labels.filter((s) => pack.labels[s] == null);
    assert.deepEqual(missing, [], `${code}: labels missing`);
    const stale = Object.keys(pack.labels).filter((s) => !labels.includes(s));
    assert.deepEqual(stale, [], `${code}: labels no longer used`);
    for (const s of labels) {
      const tr = pack.labels[s];
      if (typeof tr === 'string') assert.deepEqual(holes(tr), holes(s), `${code} label “${s}”: placeholders`);
      else assert.equal(typeof tr, 'function', `${code} label “${s}”`);
    }
  }
});

test('every language of the report has its interface: one pack per draft language, so the app speaks all 17', () => {
  assert.deepEqual(PACKS, [...I18N.DRAFT].sort(), 'one pack per draft language in src/js/lang-ui');
  for (const code of I18N.LANGS) assert.ok(UI[code] && typeof UI[code].newValuation === 'string', `${code}: interface texts loaded`);
});
