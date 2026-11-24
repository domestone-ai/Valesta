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
const Geocode = require('../src/js/geocode.js');

const SAMPLE = [{
  lat: '45.2961021', lon: '12.0350200', display_name: 'Piazza Matteotti, Quartiere Sant\'Anna, Piove di Sacco, Padova, Veneto, 35028, Italia',
  address: { road: 'Piazza Matteotti', town: 'Piove di Sacco', county: 'Padova', 'ISO3166-2-lvl6': 'IT-PD', state: 'Veneto', postcode: '35028', country: 'Italia', country_code: 'it' },
}];

test('the query uses only the address fields of the property', () => {
  const q = Geocode.queryFor({ address: 'Via Roma 10', postalCode: '35028', municipality: 'Piove di Sacco', province: 'PD', floorDoor: '2°', notes: 'secret' });
  assert.equal(q, 'Via Roma 10, 35028 Piove di Sacco, PD');
});

test('Nominatim request: search only, country, language, near a point for places of interest', () => {
  const u = Geocode.searchUrl({ provider: 'nominatim' }, 'Via Roma 10, Piove di Sacco', { country: 'IT', lang: 'it' });
  assert.ok(u.startsWith('https://nominatim.openstreetmap.org/search?'), u);
  for (const p of ['format=jsonv2', 'addressdetails=1', 'limit=5', 'countrycodes=it', 'accept-language=it', 'q=Via%20Roma%2010%2C%20Piove%20di%20Sacco']) assert.ok(u.includes(p), p);
  const near = Geocode.searchUrl({ provider: 'nominatim' }, 'stazione', { near: { lat: 45.3, lon: 12.03 } });
  assert.ok(near.includes('viewbox=') && near.includes('bounded=1'), near);
  const c = Geocode.searchUrl({ provider: 'custom', url: 'https://geo.example.org/v1/search?key=abc' }, 'x', {});
  assert.ok(c.startsWith('https://geo.example.org/v1/search?key=abc&'), c);
  assert.equal(Geocode.searchUrl({ provider: 'custom', url: 'http://insecure.example.org' }, 'x', {}), null);
  assert.equal(Geocode.searchUrl({ provider: 'off' }, 'x', {}), null);
});

test('results become positions and address parts', () => {
  const r = Geocode.parse(SAMPLE);
  assert.equal(r.length, 1);
  assert.equal(r[0].lat, 45.2961021);
  assert.equal(r[0].address.municipality, 'Piove di Sacco');
  assert.equal(r[0].address.province, 'PD');
  assert.equal(r[0].address.region, 'Veneto');
  assert.equal(r[0].address.postalCode, '35028');
});

test('only empty address fields are completed', () => {
  const s = { address: 'Via Roma 10', municipality: '', province: 'Padova', postalCode: '' };
  const filled = Geocode.fill(s, Geocode.parse(SAMPLE)[0].address);
  assert.deepEqual(filled.sort(), ['municipality', 'postalCode', 'region']);
  assert.equal(s.province, 'Padova');
  assert.equal(s.municipality, 'Piove di Sacco');
});

test('one request per second at most, and repeated searches come from the cache', async () => {
  let calls = 0;
  const store = new Map();
  const deps = {
    fetch: async () => { calls++; return { ok: true, json: async () => SAMPLE }; },
    storage: { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) },
    now: (() => { let t = 0; return () => (t += 10); })(),
    wait: async () => {},
  };
  const cfg = { provider: 'nominatim' };
  const a = await Geocode.search(cfg, 'Piazza Matteotti, Piove di Sacco', { country: 'IT' }, deps);
  const b = await Geocode.search(cfg, 'Piazza Matteotti, Piove di Sacco', { country: 'IT' }, deps);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  assert.ok(Geocode.delayBefore(1000, 1500) >= 600 && Geocode.delayBefore(1000, 3000) === 0);
});
