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
const Maps = require('../src/js/maps.js');

const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b} (±${tol})`);

test('web mercator pixels go back and forth', () => {
  const p = Maps.project(16, 45.2975, 12.0367);
  const q = Maps.unproject(16, p[0], p[1]);
  close(q.lat, 45.2975, 1e-9);
  close(q.lon, 12.0367, 1e-9);
  const t = Maps.tileOf(16, 45.2975, 12.0367);
  assert.deepEqual(t, [Math.floor(p[0] / 256), Math.floor(p[1] / 256)]);
});

test('each country gets its open base map, others a schematic map', () => {
  assert.equal(Maps.defaultFor('ES'), 'es-ign');
  assert.equal(Maps.defaultFor('CH'), 'ch-swisstopo');
  assert.equal(Maps.defaultFor('GB'), 'eu-topplus', 'European street map where no national service is set');
  assert.ok(Maps.forCountry('IT').includes('it-cadastre') && Maps.forCountry('IT').includes('eu-topplus'), 'Italy: street map and cadastre');
  assert.equal(Maps.defaultFor('IT'), 'it-hybrid', 'Italy: street map, cadastre close up');
  assert.ok(Maps.get('it-hybrid').tile(16, 1, 1).includes('geodatenzentrum') && Maps.get('it-hybrid').tile(17, 1, 1).includes('agenziaentrate'));
  assert.ok(Maps.get('it-hybrid').creditAt(16).includes('BKG') && !Maps.get('it-hybrid').creditAt(16).includes('Entrate'));
  assert.ok(/© BKG \(\d{4}\) dl-de\/by-2-0/.test(Maps.get('eu-topplus').attribution), Maps.get('eu-topplus').attribution);
  for (const id of Maps.forCountry('FR')) assert.ok(Maps.get(id).attribution, id);
  assert.ok(Maps.get('it-cadastre').attribution.includes('CC BY 4.0'));
});

test('tile addresses for tiled and WMS services', () => {
  const ch = Maps.get('ch-swisstopo').tile(16, 34322, 22952);
  assert.ok(ch.includes('/3857/16/34322/22952.jpeg'), ch);
  const it = Maps.get('it-cadastre').tile(17, 70482, 46047);
  assert.ok(it.includes('CRS=EPSG:4258') && it.includes('REQUEST=GetMap'), it);
  const bbox = /BBOX=([^&]+)/.exec(it)[1].split(',').map(Number);
  const nw = Maps.unproject(17, 70482 * 256, 46047 * 256);
  const se = Maps.unproject(17, 70483 * 256, 46048 * 256);
  close(bbox[0], se.lat, 1e-9);
  close(bbox[1], nw.lon, 1e-9);
  close(bbox[2], nw.lat, 1e-9);
  close(bbox[3], se.lon, 1e-9);
});

test('a tile address set by the user becomes a provider', () => {
  const p = Maps.custom({ url: 'https://tiles.example.org/{z}/{x}/{y}.png', attribution: '© Example' });
  assert.equal(p.tile(3, 4, 5), 'https://tiles.example.org/3/4/5.png');
  assert.equal(p.attribution, '© Example');
  assert.equal(Maps.custom({ url: 'not a url' }), null);
});


test('projection keeps any longitude on the map and leaves non-numbers as NaN', () => {
  const a = Maps.project(16, 45, 10);
  const b = Maps.project(16, 45, 370);
  close(b[0], a[0], 1e-6);
  const p = Maps.project(16, 45, -1e15);
  assert.ok(Number.isFinite(p[0]) && p[0] >= 0 && p[0] <= 256 * 2 ** 16, `x ${p[0]}`);
  const q = Maps.project(16, 95, 10);
  assert.ok(Number.isFinite(q[1]) && q[1] >= 0, 'latitude clamped');
  assert.ok(Number.isNaN(Maps.project(16, NaN, 10)[0]) || Number.isNaN(Maps.project(16, NaN, 10)[1]));
});


test('outside map tiles are used only after they are allowed on this device', () => {
  const st = { meta: { country: 'ES' }, map: {} };
  try {
    Maps.setAllowed(false);
    assert.equal(Maps.isAllowed(), false);
    assert.equal(Maps.resolve(st, null).tile, null);
    Maps.setAllowed(true);
    assert.equal(Maps.resolve(st, null).id, 'es-ign');
  } finally { Maps.setAllowed(false); }
});

test('every map service states the country where it is run', () => {
  Object.keys(Maps.PROVIDERS).forEach((id) => assert.match(String(Maps.PROVIDERS[id].seat || ''), /^[A-Z]{2}( · [A-Z]{2})?$/, id));
});
