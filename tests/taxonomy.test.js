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
const Taxonomy = require('../src/js/taxonomy.js');

test('property types: 48 codes in 9 categories, labelled in English, Spanish and Italian', () => {
  assert.equal(Taxonomy.TYPES.length, 48);
  assert.equal(Taxonomy.CATEGORIES.length, 9);
  for (const t of Taxonomy.TYPES) {
    const cat = Taxonomy.CATEGORIES.find((c) => c.id === t.category);
    assert.ok(cat, `category of ${t.code}`);
    assert.ok(t.code.startsWith(cat.prefix + '.'), `${t.code} starts with ${cat.prefix}`);
    for (const l of ['en', 'es', 'it']) assert.ok(t.label[l], `${t.code} label ${l}`);
    assert.ok(t.approaches.length > 0);
  }
  assert.equal(Taxonomy.typeLabel('RES.APARTMENT', 'it'), 'Appartamento in condominio');
  assert.equal(Taxonomy.typeLabel('NOPE', 'it'), '');
  assert.equal(Taxonomy.categoryOf('IND.LOGISTICS').id, 'industrial');
});

test('describing the property suggests a type in Italian, Spanish or English', () => {
  const c = (s) => (Taxonomy.classifyType(s) || {}).code;
  assert.equal(c('capannone di 2.000 m² con uffici'), 'IND.PRODUCTION');
  assert.equal(c('B&B con 8 camere'), 'HOS.BED_AND_BREAKFAST');
  assert.equal(c('Negozio con due vetrine su strada'), 'RET.HIGH_STREET_SHOP');
  assert.equal(c('negozio al piano terra con 4 appartamenti'), 'SPC.MIXED_USE');
  assert.equal(c('magazzino con vendita all’ingrosso'), 'WHO.WHOLESALE_WAREHOUSE');
  assert.equal(c('Piso de 3 habitaciones en Castelldefels'), 'RES.APARTMENT');
  assert.equal(c('Ático con terraza'), 'RES.PENTHOUSE');
  assert.equal(c('Detached house with garden'), 'RES.DETACHED_HOUSE');
  assert.equal(c('plaza de garaje'), 'ACC.PARKING_SPACE');
  assert.equal(c('terreno agricolo di 3 ettari'), 'LND.AGRICULTURAL');
  assert.equal(c('xyz'), undefined);
  assert.equal(c(''), undefined);
});

test('countries: the 19 country packs, sorted by name in the interface language', () => {
  assert.equal(Taxonomy.COUNTRIES.length, 19);
  const codes = Taxonomy.COUNTRIES.map((c) => c.code).sort();
  assert.deepEqual(codes, ['AT', 'BE', 'CH', 'CZ', 'DE', 'DK', 'ES', 'FR', 'GB', 'HR', 'HU', 'IE', 'IT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE']);
  for (const c of Taxonomy.COUNTRIES) {
    assert.match(c.currency, /^[A-Z]{3}$/);
    assert.ok(c.std && c.area && c.docs.length >= 3, c.code);
    for (const l of ['en', 'es', 'it']) assert.ok(c.reserved[l], `${c.code} reserved ${l}`);
  }
  assert.equal(Taxonomy.countryName('ES', 'it'), 'Spagna');
  assert.equal(Taxonomy.countryName('GB', 'it'), 'Inghilterra');
  assert.equal(Taxonomy.countryName('GB', 'en'), 'England');
  assert.equal(Taxonomy.countryName('CZ', 'it'), 'Repubblica Ceca');
  const it = Taxonomy.countries('it').map((c) => c.code);
  assert.equal(it[0], 'AT');
  assert.ok(it.indexOf('IT') < it.indexOf('ES'), 'Italia before Spagna in Italian');
  assert.equal(Taxonomy.country('XX'), null);
});

test('purposes, with labels', () => {
  assert.equal(Taxonomy.PURPOSES.length, 10);
  assert.equal(Taxonomy.purposeLabel('loan_security', 'it'), 'Garanzia di un mutuo');
  assert.equal(Taxonomy.approachLabel('sales_comparison', 'en'), 'Sales comparison');
});

test('currency and the phrase "in <country>" follow the country pack', () => {
  assert.equal(Taxonomy.currencyOf({ meta: { country: 'CH' } }), 'CHF');
  assert.equal(Taxonomy.currencyOf({ meta: { country: 'CH', currency: 'EUR' } }), 'EUR');
  assert.equal(Taxonomy.currencyOf({}), 'EUR');
  assert.equal(Taxonomy.countryIn('NL', 'it'), 'nei Paesi Bassi');
  assert.equal(Taxonomy.countryIn('ES', 'es'), 'en España');
  assert.equal(Taxonomy.countryIn('CZ', 'en'), 'in the Czech Republic');
  assert.equal(Taxonomy.countryIn('IT', 'en'), 'in Italy');
  assert.equal(Taxonomy.country('ES').law, 'Orden ECO/805/2003');
  assert.ok(Taxonomy.COUNTRIES.every((c) => c.docs.every((d) => !d.includes('('))), 'document names read well inside a sentence');
});

test('country packs: documents for the checks keep planning documents only', () => {
  assert.equal(Taxonomy.country('CH').checkDocs[1], '');
  assert.equal(Taxonomy.country('CH').checkDocs[2], 'GEAK / CECB');
  assert.equal(Taxonomy.country('IT').checkDocs[1], 'Stato legittimo urbanistico · conformità catastale');
  assert.equal(Taxonomy.country('BE').checkDocs.length, 4);
});
