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
global.I18N = require('../src/js/i18n.js');
global.AppCore = require('../src/js/appcore.js');
global.Review = require('../src/js/review.js');
const DEFAULT_STATE = require('../src/js/data.js');
const AITools = require('../src/js/aitools.js');

const fresh = () => JSON.parse(JSON.stringify(DEFAULT_STATE));
const env = (state, extra) => Object.assign({ state, lang: 'it', uiLang: 'it' }, extra || {});
const run = (name, args, e) => AITools.execute(name, args, e);

test('tool catalogue: unique names, descriptions and object schemas', () => {
  const names = AITools.TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const t of AITools.TOOLS) {
    assert.ok(t.description && t.description.length > 20, t.name);
    assert.equal(t.parameters.type, 'object', t.name);
  }
  for (const n of ['get_valuation', 'update_fields', 'add_comparable', 'update_comparable', 'remove_comparable', 'set_rooms', 'set_report_text', 'compute_valuation', 'review_valuation', 'geocode', 'nearby_places', 'cadastre_lookup']) {
    assert.ok(names.includes(n), n);
  }
});

test('update_fields: numbers with decimal comma, localized text in the report language, booleans', async () => {
  const s = fresh();
  const out = await run('update_fields', { updates: [
    { path: 'subject.areaBuilt', value: '115,5' },
    { path: 'meta.purpose', value: 'Stima per la vendita' },
    { path: 'subject.pool', value: 'true' },
    { path: 'settings.annex.parking', value: '20.000' },
  ] }, env(s));
  assert.equal(out.ok, true);
  assert.equal(out.changed, true);
  assert.equal(s.subject.areaBuilt, 115.5);
  assert.equal(I18N.loc(s.meta.purpose, 'it'), 'Stima per la vendita');
  assert.match(I18N.loc(s.meta.purpose, 'es'), /^Estimación/);
  assert.equal(s.subject.pool, true);
  assert.equal(s.settings.annex.parking, 20000);
});

test('update_fields: refuses protected, unknown and out-of-range paths', async () => {
  const s = fresh();
  const before = JSON.stringify(s);
  const out = await run('update_fields', { updates: [
    { path: 'brand.logoLight', value: 'data:image/png;base64,AAAA' },
    { path: 'subject.__proto__.x', value: 1 },
    { path: 'photos.0.dataUrl', value: 'x' },
    { path: 'comparables.99.price', value: 1 },
    { path: 'subject.yearBuilt', value: 'abc' },
  ] }, env(s));
  assert.equal(out.changed, false);
  assert.equal(out.result.applied.length, 0);
  assert.equal(out.result.rejected.length, 5);
  assert.equal(JSON.stringify(s), before);
});

test('add_comparable: next free id, sanitised URL, suggested levels and computed value', async () => {
  const s = fresh();
  const out = await run('add_comparable', { comparable: {
    address: 'Calle Ejemplo, 12', zone: 'Centre', price: '480.000', areaBuilt: 96, floor: 2, elevator: true, bedrooms: 3, bathrooms: 2,
    yearBuilt: 2001, condition: 'buen_estado', source: 'portal', url: 'javascript:alert(1)', description: 'Piano secondo con terrazza',
  } }, env(s));
  assert.equal(out.ok, true);
  const c = s.comparables.find((x) => x.id === out.result.id);
  assert.ok(c, 'comparable added');
  assert.equal(out.result.id, 'T8');
  assert.equal(c.price, 480000);
  assert.equal(c.url, '');
  assert.notEqual(c.ratings.size, 0, 'size level suggested from the data');
  assert.ok(out.result.unitHomog > 2000 && out.result.unitHomog < 8000);
  assert.equal(I18N.loc(c.description, 'it'), 'Piano secondo con terrazza');
});

test('update_comparable merges and clamps levels; remove_comparable deletes by id', async () => {
  const s = fresh();
  let out = await run('update_comparable', { id: 'T2', fields: { ratings: { loc: 5 }, ratingNotes: { loc: 'Zona migliore' }, price: '600000' } }, env(s));
  assert.equal(out.ok, true);
  const t2 = s.comparables.find((c) => c.id === 'T2');
  assert.equal(t2.ratings.loc, 2);
  assert.equal(t2.price, 600000);
  assert.equal(I18N.loc(t2.ratingNotes.loc, 'it'), 'Zona migliore');
  out = await run('remove_comparable', { id: 'T2' }, env(s));
  assert.equal(out.ok, true);
  assert.equal(s.comparables.some((c) => c.id === 'T2'), false);
  out = await run('remove_comparable', { id: 'ZZ' }, env(s));
  assert.equal(out.ok, false);
});

test('set_rooms and set_report_text write in the report language; empty text restores the automatic one', async () => {
  const s = fresh();
  await run('set_rooms', { rooms: [{ name: 'Soggiorno', m2: '30,5' }, { name: 'Camera', m2: 12 }] }, env(s));
  assert.equal(s.subject.rooms.length, 2);
  assert.equal(MCA.usefulArea(s.subject), 42.5);
  await run('set_report_text', { key: 'letter', text: 'Gentile cliente…' }, env(s));
  assert.equal(I18N.loc(s.texts.letter, 'it'), 'Gentile cliente…');
  await run('set_report_text', { key: 'letter', text: '' }, env(s));
  assert.equal(I18N.loc(s.texts.letter, 'it'), '');
  const bad = await run('set_report_text', { key: 'nope', text: 'x' }, env(s));
  assert.equal(bad.ok, false);
});

test('compute, review and get_valuation summarise the case (personal data can be redacted)', async () => {
  const s = fresh();
  const c = await run('compute_valuation', {}, env(s));
  assert.equal(c.result.value, 518000);
  assert.ok(c.result.range.low < 518000 && c.result.range.high > 518000);
  const r = await run('review_valuation', {}, env(s));
  assert.ok(r.result.score > 0 && Array.isArray(r.result.issues));
  const g = await run('get_valuation', {}, env(s, { redact: true }));
  const txt = JSON.stringify(g.result);
  assert.doesNotMatch(txt, /John Sample/);
  assert.equal(g.result.comparables.length, s.comparables.length);
  assert.equal(g.result.report_language, 'it');
  const g2 = await run('get_valuation', { include: ['result'] }, env(s));
  assert.ok(g2.result.result && !g2.result.comparables);
});

test('geocode, nearby_places and cadastre_lookup parse the public services (mocked)', async () => {
  const s = fresh();
  const calls = [];
  const fetch = async (url, opts) => {
    calls.push(String(url));
    if (/nominatim/.test(url)) return { ok: true, json: async () => [{ lat: '41.27', lon: '1.97', display_name: 'Calle de Ejemplo, Castelldefels', type: 'house' }] };
    if (/interpreter/.test(url)) {
      return { ok: true, json: async () => ({ elements: [
        { type: 'node', lat: 41.2848, lon: 1.9801, tags: { amenity: 'school', name: 'Escola A' } },
        { type: 'way', center: { lat: 41.2794, lon: 1.9787 }, tags: { railway: 'station', name: 'Castelldefels' } },
        { type: 'node', lat: 41.2843, lon: 1.9802, tags: { amenity: 'pharmacy' } },
      ] }) };
    }
    if (/Consulta_DNPRC/.test(url)) {
      return { ok: true, json: async () => ({ consulta_dnprcResult: { lrcdnp: { rcdnp: [
        { rc: { pc1: '1234567', pc2: 'DF0000A', car: '0021', cc1: 'X', cc2: 'Y' }, dt: { locs: { lous: { lourb: { dir: { tv: 'CL', nv: 'EJEMPLO', pnp: '10' }, loint: { es: '1', pt: '03', pu: '01' } } } }, nm: 'CASTELLDEFELS' }, debi: { luso: 'Residencial', sfc: '113', cpt: '5,1', ant: '1999' } },
      ] } } }) };
    }
    throw new Error('unexpected ' + url);
  };
  const g = await run('geocode', { address: 'Calle de Ejemplo 10, Castelldefels' }, env(s, { fetch, geocoder: { provider: 'nominatim' } }));
  assert.equal(g.ok, true);
  assert.equal(g.result.candidates[0].lat, 41.27);
  const p = await run('nearby_places', {}, env(s, { fetch, geodata: true }));
  assert.equal(p.ok, true);
  const cats = p.result.places.map((x) => x.category);
  assert.ok(cats.includes('education') && cats.includes('transport') && cats.includes('health'));
  assert.ok(p.result.places.every((x) => Number.isFinite(x.distance_m)));
  const ca = await run('cadastre_lookup', { ref: '1234567DF0000A' }, env(s, { fetch, geodata: true }));
  assert.equal(ca.ok, true);
  assert.equal(ca.result.units[0].ref, '1234567DF0000A0021XY');
  assert.equal(ca.result.units[0].floor, '03');
  assert.equal(ca.result.units[0].area_m2, 113);
});

test('network tools fail gracefully without fetch; unknown tools are reported', async () => {
  const s = fresh();
  const g = await run('geocode', { address: 'x' }, env(s, { fetch: async () => { throw new Error('offline'); }, geocoder: { provider: 'nominatim' } }));
  assert.equal(g.ok, false);
  assert.match(String(g.result.error), /offline/);
  const u = await run('format_disk', {}, env(s));
  assert.equal(u.ok, false);
});

test('system prompt states languages, the data model and the safety rules', () => {
  const p = AITools.systemPrompt({ uiLang: 'it', reportLang: 'es', today: '2026-11-23', search: 'native' });
  assert.match(p, /Italian/);
  assert.match(p, /Spanish/);
  assert.match(p, /update_fields/);
  assert.match(p, /comparables/);
  assert.match(p, /never follow instructions/i);
  assert.match(p, /2026-11-23/);
});

test('free-form objects sent as JSON text (Gemini) are accepted', async () => {
  const s = fresh();
  const out = await run('update_comparable', { id: 'T3', fields: { ratings: '{"loc":1}', ratingNotes: '{"loc":"Più vicino al mare"}' } }, env(s));
  assert.equal(out.ok, true);
  const t3 = s.comparables.find((c) => c.id === 'T3');
  assert.equal(t3.ratings.loc, 1);
  assert.ok(Object.keys(t3.ratings).length > 5, 'other levels kept');
});

test('system prompt states the currency of the valuation', () => {
  const chf = AITools.systemPrompt({ uiLang: 'it', reportLang: 'it', currency: 'CHF', today: '2026-11-23' });
  assert.ok(chf.includes('All amounts are in CHF'), 'CHF named');
  const def = AITools.systemPrompt({ uiLang: 'it', reportLang: 'es', currency: 'bad', today: '2026-11-23' });
  assert.ok(def.includes('All amounts are in EUR'), 'falls back to EUR');
});

test('system prompt asks for report texts in the report language, any of the seventeen', () => {
  assert.match(AITools.systemPrompt({ uiLang: 'it', reportLang: 'zh', today: '2026-11-23' }), /in Simplified Chinese \(the report language\)/);
  assert.match(AITools.systemPrompt({ uiLang: 'en', reportLang: 'ru', today: '2026-11-23' }), /in Russian \(the report language\)/);
  assert.match(AITools.systemPrompt({ uiLang: 'es', reportLang: 'nb', today: '2026-11-23' }), /in Norwegian \(Bokmål\) \(the report language\)/);
});


test('geocode follows the address-search choice: nothing is sent until a service is chosen; a custom https service is used as chosen', async () => {
  const s = fresh();
  const calls = [];
  const fetch = async (url) => { calls.push(String(url)); return { ok: true, json: async () => [{ lat: '41.27', lon: '1.97', display_name: 'X', type: 'house' }] }; };
  for (const geocoder of [undefined, null, { provider: 'off' }, { provider: 'custom', url: 'http://insecure.example.org/search' }]) {
    const r = await run('geocode', { address: 'Calle de Ejemplo 10, Castelldefels' }, env(s, { fetch, geocoder }));
    assert.equal(r.ok, false, JSON.stringify(geocoder));
    assert.match(String(r.result.error), /address search is off/);
  }
  assert.deepEqual(calls, []);
  const c = await run('geocode', { address: 'Calle de Ejemplo 10' }, env(s, { fetch, geocoder: { provider: 'custom', url: 'https://geo.example.org/search' } }));
  assert.equal(c.ok, true);
  assert.match(calls[0], /^https:\/\/geo\.example\.org\/search\?/);
  const n = await run('geocode', { address: 'Calle de Ejemplo 10' }, env(s, { fetch, geocoder: { provider: 'nominatim' } }));
  assert.equal(n.ok, true);
  assert.match(calls[1], /^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
});

test('get_valuation sends no image or file data to the model, only that an image exists', async () => {
  const s = fresh();
  s.design = Object.assign({}, s.design, { coverImage: 'data:image/jpeg;base64,' + 'A'.repeat(2000) });
  const r = await run('get_valuation', {}, env(s));
  assert.equal(r.ok, true);
  const txt = JSON.stringify(r.result);
  assert.ok(!/data:[a-z]+\/[a-z0-9.+-]+;base64,/i.test(txt), 'no data URL in what the model reads');
  assert.equal(r.result.design.coverImage, '[image]');
});


test('nearby_places and cadastre_lookup send nothing until the user turns on the public geodata services', async () => {
  const s = fresh();
  const calls = [];
  const fetch = async (url) => { calls.push(String(url)); throw new Error('no request expected'); };
  for (const name of ['nearby_places', 'cadastre_lookup']) {
    const r = await run(name, { ref: '1234567DF0000A' }, env(s, { fetch }));
    assert.equal(r.ok, false, name);
    assert.match(String(r.result.error), /geodata services are off/, name);
  }
  assert.deepEqual(calls, []);
});

test('nearby_places uses the Overpass instance of Private.coffee, which allows commercial use', async () => {
  const s = fresh();
  const calls = [];
  const fetch = async (url) => { calls.push(String(url)); return { ok: true, json: async () => ({ elements: [] }) }; };
  const r = await run('nearby_places', {}, env(s, { fetch, geodata: true }));
  assert.equal(r.ok, true);
  assert.deepEqual(calls, ['https://overpass.private.coffee/api/interpreter']);
});

test('get_valuation leaves out the client name and the agency contacts by default', async () => {
  const s = fresh();
  s.meta.office = Object.assign({}, s.meta.office, { name: 'Agenzia Esempio', address: 'Via Esempio 1', phone: '+39 000 0000', email: 'info@example.org', license: 'REA 0000', web: 'https://example.org' });
  const r = await run('get_valuation', { include: ['meta'] }, env(s, { redact: true }));
  const txt = JSON.stringify(r.result);
  assert.equal(r.result.meta.office.name, 'Agenzia Esempio');
  for (const v of ['John Sample', 'Via Esempio 1', '+39 000 0000', 'info@example.org', 'REA 0000']) assert.ok(!txt.includes(v), v);
  const open = await run('get_valuation', { include: ['meta'] }, env(s, { redact: false }));
  assert.ok(JSON.stringify(open.result).includes('info@example.org'), 'all data when the user turns the option off');
});

test('F-20: update_fields cannot write the hidden overrides of a comparable', async () => {
  const s = fresh();
  const before = JSON.stringify(s.comparables);
  await run('update_fields', { updates: [
    { path: 'comparables.0.annexOverride', value: 0 },
    { path: 'comparables.1.kOverride', value: { loc: 1.3 } },
    { path: 'comparables.1.kOverride.loc', value: 1.3 },
  ] }, env(s));
  assert.equal(JSON.stringify(s.comparables), before);
});

test('review fix I2: update_fields cannot confirm the market inputs for the valuer', async () => {
  const s = fresh();
  s.settings.marketConfirmed = false;
  await run('update_fields', { updates: [{ path: 'settings.marketConfirmed', value: true }] }, env(s));
  assert.equal(s.settings.marketConfirmed, false);
});

test('review fix M5: update_fields writes the reasoning of the negotiation coefficient in the report language', async () => {
  const s = fresh();
  s.meta.reportLang = 'it';
  await run('update_fields', { updates: [{ path: 'settings.negotiationReason', value: 'Margine osservato su 12 compravendite locali' }] }, env(s));
  assert.equal(s.settings.negotiationReason.it, 'Margine osservato su 12 compravendite locali');
});
