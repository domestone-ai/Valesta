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
const I18N = require('../src/js/i18n.js');

test('fmt groups thousands per language', () => {
  assert.equal(I18N.fmt(4572, 0, 'es'), '4.572');
  assert.equal(I18N.fmt(4572, 0, 'it'), '4.572');
  assert.equal(I18N.fmt(4572, 0, 'en'), '4,572');
  assert.equal(I18N.fmt(-1234.5, 1, 'en'), '−1,234.5');
  assert.equal(I18N.fmt(85.6, 2, 'es'), '85,60');
  assert.equal(I18N.fmt(null, 0, 'en'), '—');
});

test('money and unit prices follow each language convention', () => {
  assert.equal(I18N.money(518000, 'es'), '518.000 €');
  assert.equal(I18N.money(518000, 'it'), '518.000 €');
  assert.equal(I18N.money(518000, 'en'), '€518,000');
  assert.equal(I18N.perM2(4393, 'es'), '4.393 €/m²');
  assert.equal(I18N.perM2(4393, 'en'), '€4,393/m²');
  assert.equal(I18N.money(null, 'en'), '—');
});

test('dateLong writes long dates in each language', () => {
  assert.equal(I18N.dateLong('2026-11-22', 'es'), '22 de noviembre de 2026');
  assert.equal(I18N.dateLong('2026-11-22', 'it'), '22 novembre 2026');
  assert.equal(I18N.dateLong('2026-11-22', 'en'), '22 November 2026');
  assert.equal(I18N.dateLong('', 'it'), '—');
});

test('numberToWords: Spanish', () => {
  assert.equal(I18N.numberToWords(518000, 'es'), 'quinientos dieciocho mil');
  assert.equal(I18N.numberToWords(1250000, 'es'), 'un millón doscientos cincuenta mil');
  assert.equal(I18N.numberToWords(21, 'es'), 'veintiuno');
  assert.equal(I18N.numberToWords(101, 'es'), 'ciento uno');
  assert.equal(I18N.numberToWords(100, 'es'), 'cien');
  assert.equal(I18N.numberToWords(2000000, 'es'), 'dos millones');
  assert.equal(I18N.numberToWords(21000, 'es'), 'veintiún mil');
});

test('numberToWords: Italian', () => {
  assert.equal(I18N.numberToWords(518000, 'it'), 'cinquecentodiciottomila');
  assert.equal(I18N.numberToWords(545000, 'it'), 'cinquecentoquarantacinquemila');
  assert.equal(I18N.numberToWords(1250000, 'it'), 'un milione duecentocinquantamila');
  assert.equal(I18N.numberToWords(21, 'it'), 'ventuno');
  assert.equal(I18N.numberToWords(23, 'it'), 'ventitré');
  assert.equal(I18N.numberToWords(3, 'it'), 'tre');
  assert.equal(I18N.numberToWords(23000, 'it'), 'ventitremila');
  assert.equal(I18N.numberToWords(108, 'it'), 'centotto');
  assert.equal(I18N.numberToWords(180, 'it'), 'centottanta');
  assert.equal(I18N.numberToWords(1000, 'it'), 'mille');
  assert.equal(I18N.numberToWords(2000000, 'it'), 'due milioni');
});

test('numberToWords: English (UK style with "and")', () => {
  assert.equal(I18N.numberToWords(518000, 'en'), 'five hundred and eighteen thousand');
  assert.equal(I18N.numberToWords(545000, 'en'), 'five hundred and forty-five thousand');
  assert.equal(I18N.numberToWords(1250000, 'en'), 'one million two hundred and fifty thousand');
  assert.equal(I18N.numberToWords(21, 'en'), 'twenty-one');
  assert.equal(I18N.numberToWords(1005, 'en'), 'one thousand and five');
});

test('currencyWords appends the currency name per language', () => {
  assert.equal(I18N.currencyWords(518000, 'es'), 'quinientos dieciocho mil euros');
  assert.equal(I18N.currencyWords(518000, 'it'), 'cinquecentodiciottomila euro');
  assert.equal(I18N.currencyWords(518000, 'en'), 'five hundred and eighteen thousand euros');
});

test('loc resolves localized values with fallbacks', () => {
  assert.equal(I18N.loc('abc', 'en'), 'abc');
  assert.equal(I18N.loc({ es: 'a', it: 'b' }, 'it'), 'b');
  assert.equal(I18N.loc({ es: 'a' }, 'en'), 'a');
  assert.equal(I18N.loc({ _: 'u', it: 'x' }, 'en'), 'u');
  assert.equal(I18N.loc(null, 'es'), '');
  assert.equal(I18N.loc(undefined, 'es'), '');
});

test('setLoc keeps other languages when editing one', () => {
  const o = { a: 'texto', b: { es: 'uno', it: 'uno it' }, c: '' };
  I18N.setLoc(o, 'a', 'it', 'testo');
  I18N.setLoc(o, 'b', 'en', 'one');
  I18N.setLoc(o, 'c', 'en', 'new');
  assert.deepEqual(o.a, { _: 'texto', it: 'testo' });
  assert.deepEqual(o.b, { es: 'uno', it: 'uno it', en: 'one' });
  assert.equal(o.c, 'new');
  assert.equal(I18N.loc(o.a, 'es'), 'texto');
  assert.equal(I18N.loc(o.a, 'it'), 'testo');
});

test('UI and report dictionaries expose the same keys in every language', () => {
  const UI = require('../src/js/ui_i18n.js');
  const RI = require('../src/js/report_i18n.js');
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, p + k + '.') : [p + k])).sort();
  for (const l of ['en', 'es']) assert.deepEqual(keys(UI[l]), keys(UI.it), `UI ${l}`);
  for (const l of ['it', 'en']) assert.deepEqual(keys(RI[l]), keys(RI.es), `report ${l}`);
});

test('amounts follow the currency of the valuation, also in words', () => {
  const sp = I18N.money(1, 'es').slice(1, -1);
  try {
    I18N.setCurrency('GBP');
    assert.equal(I18N.money(518000, 'en'), '£518,000');
    assert.equal(I18N.money(518000, 'it'), '518.000' + sp + '£');
    assert.equal(I18N.perM2(4393, 'en'), '£4,393/m²');
    assert.equal(I18N.currencyWords(200000, 'es'), 'doscientas mil libras esterlinas');
    assert.equal(I18N.currencyWords(518000, 'en'), 'five hundred and eighteen thousand pounds sterling');
    I18N.setCurrency('CHF');
    assert.equal(I18N.money(1250000, 'en'), 'CHF' + sp + '1,250,000');
    assert.equal(I18N.money(1250000, 'es'), '1.250.000' + sp + 'CHF');
    assert.equal(I18N.perM2(9800, 'it'), '9.800' + sp + 'CHF/m²');
    assert.equal(I18N.sym(), 'CHF');
    assert.equal(I18N.currencyWords(300000, 'it'), 'trecentomila franchi svizzeri');
    I18N.setCurrency('EUR');
    assert.equal(I18N.currencyWords(2000000, 'es'), 'dos millones de euros');
    assert.equal(I18N.currencyWords(2000000, 'it'), 'due milioni di euro');
    assert.equal(I18N.currencyWords(518000, 'it'), 'cinquecentodiciottomila euro');
    I18N.setCurrency('nope');
    assert.equal(I18N.currency(), 'EUR');
  } finally { I18N.setCurrency('EUR'); }
});

test('withCurrency writes the currency of the valuation in place of ¤', () => {
  try {
    I18N.setCurrency('CHF');
    assert.equal(I18N.withCurrency('¤/m² omog.'), 'CHF/m² omog.');
    assert.equal(I18N.withCurrency('80 ¤/mese'), '80 CHF/mese');
    assert.equal(I18N.withCurrency('¤80/month'), 'CHF 80/month');
    I18N.setCurrency('EUR');
    assert.equal(I18N.withCurrency('¤80/month'), '€80/month');
    assert.equal(I18N.withCurrency('Base ¤/m²'), 'Base €/m²');
  } finally { I18N.setCurrency('EUR'); }
});

test('UI labels carry no fixed euro sign', () => {
  const UI = require('../src/js/ui_i18n.js');
  const strings = (o) => Object.values(o).flatMap((v) => (v && typeof v === 'object' ? strings(v) : typeof v === 'string' ? [v] : []));
  for (const l of ['it', 'en', 'es']) assert.deepEqual(strings(UI[l]).filter((s) => s.includes('€')), [], `UI ${l}`);
});

test('currencyName gives the plural name of the currency of the valuation', () => {
  try {
    I18N.setCurrency('CHF');
    assert.equal(I18N.currencyName('it'), 'franchi svizzeri');
    assert.equal(I18N.currencyName('en'), 'Swiss francs');
    I18N.setCurrency('EUR');
    assert.equal(I18N.currencyName('es'), 'euros');
    I18N.setCurrency('USD');
    assert.equal(I18N.currencyName('en'), 'USD');
  } finally { I18N.setCurrency('EUR'); }
});

test('report languages: seventeen, with local number and date formats', () => {
  assert.equal(I18N.LANGS.length, 17);
  for (const l of ['zh', 'ru', 'fr', 'de', 'pl', 'nb', 'hu', 'ro', 'hr', 'cs', 'da', 'sv', 'pt', 'nl']) assert.equal(I18N.norm(l), l, l);
  assert.equal(I18N.LANG_NAMES.zh, '中文');
  assert.equal(I18N.fmt(518000, 0, 'de'), '518.000');
  assert.equal(I18N.fmt(518000, 0, 'fr').replace(/\s/g, ' '), '518 000');
  assert.equal(I18N.money(518000, 'zh'), '€518,000');
  assert.equal(I18N.money(518000, 'de').replace(/\s/g, ' '), '518.000 €');
  assert.equal(I18N.dateLong('2026-11-23', 'de'), '23. November 2026');
  assert.equal(I18N.dateLong('2026-11-23', 'zh'), '2026年11月23日');
  assert.equal(I18N.currencyWords(518000, 'ru'), 'пятьсот восемнадцать тысяч евро');
  assert.equal(I18N.monthLong(10, 'fr'), 'novembre');
  assert.equal(I18N.loc({ en: 'Hello', fr: 'Bonjour' }, 'fr'), 'Bonjour');
});


test('amounts in words beyond a billion (Spanish, Italian, English)', () => {
  I18N.setCurrency('EUR');
  assert.equal(I18N.currencyWords(1234567890, 'en'), 'one billion two hundred and thirty-four million five hundred and sixty-seven thousand eight hundred and ninety euros');
  assert.equal(I18N.currencyWords(1234567890, 'es'), 'mil doscientos treinta y cuatro millones quinientos sesenta y siete mil ochocientos noventa euros');
  assert.equal(I18N.currencyWords(1234567890, 'it'), 'un miliardo duecentotrentaquattro milioni cinquecentosessantasettemilaottocentonovanta euro');
  assert.equal(I18N.currencyWords(1e9, 'es'), 'mil millones de euros');
  assert.equal(I18N.currencyWords(1e9, 'it'), 'un miliardo di euro');
  assert.equal(I18N.currencyWords(1e9, 'en'), 'one billion euros');
  assert.equal(I18N.numberToWords(21e9, 'es'), 'veintiún mil millones');
  assert.equal(I18N.numberToWords(3e9, 'it'), 'tre miliardi');
  assert.equal(I18N.numberToWords(2000000005, 'en'), 'two billion and five');
});

test('amounts too large for words are written in grouped digits, never as broken words', () => {
  I18N.setCurrency('EUR');
  for (const l of ['es', 'it', 'en']) {
    const w = I18N.numberToWords(1.5e12, l);
    assert.match(w, /^1\D500\D000\D000\D000$/, `${l}: ${w}`);
    const c = I18N.currencyWords(1.5e12, l);
    assert.ok(!/undefined|NaN/.test(c), `${l}: ${c}`);
  }
});


test('the languages translated from English are listed for the report, and the interface no longer flags them as drafts', () => {
  assert.deepEqual(I18N.DRAFT, ['fr', 'de', 'pt', 'nl', 'pl', 'cs', 'hu', 'ro', 'hr', 'da', 'sv', 'nb', 'zh', 'ru']);
  const UI = require('../src/js/ui_i18n.js');
  for (const l of I18N.LANGS) {
    assert.equal(UI[l].langDraftShort, undefined, `${l}: no draft label`);
    assert.equal(UI[l].dlvLangDraft, undefined, `${l}: no draft warning before sending`);
  }
});
