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
const Geo = require('../src/js/geo.js');

const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b} (±${tol})`);

test('Transverse Mercator matches the EPSG guidance example (British National Grid)', () => {
  const o = { ell: { a: 6377563.396, invf: 299.3249646 }, lat0: 49, lon0: -2, k0: 0.9996012717, fe: 400000, fn: -100000 };
  const p = Geo.tmForward(50.5, 0.5, o);
  close(p.e, 577274.99, 0.02);
  close(p.n, 69740.50, 0.02);
  const q = Geo.tmInverse(p.e, p.n, o);
  close(q.lat, 50.5, 1e-9);
  close(q.lon, 0.5, 1e-9);
});

test('Helmert position vector transformation matches the EPSG guidance example', () => {
  const r = Geo.helmert([3657660.66, 255768.55, 5201382.11], { tx: 0, ty: 0, tz: 4.5, rx: 0, ry: 0, rz: 0.554, ds: 0.219 });
  close(r[0], 3657660.78, 0.02);
  close(r[1], 255778.43, 0.02);
  close(r[2], 5201387.75, 0.02);
});

test('UTM zone 32 on its central meridian at 45°N', () => {
  const p = Geo.fromWgs84('utm32', 45, 9);
  close(p.e, 500000, 0.001);
  close(p.n, 4982950.40, 0.02);
});

test('Gauss-Boaga West and East go back and forth with WGS84', () => {
  const gb = Geo.fromWgs84('gb-ovest', 45.2975, 12.0367);
  assert.ok(gb.e > 1.70e6 && gb.e < 1.78e6 && gb.n > 5.0e6 && gb.n < 5.04e6, JSON.stringify(gb));
  const u = Geo.fromWgs84('utm32', 45.2975, 12.0367);
  assert.ok(Math.abs(gb.e - (u.e + 1e6)) < 400 && Math.abs(gb.n - u.n) < 400, 'close to UTM 32 + 1,000 km');
  const back = Geo.toWgs84('gb-ovest', gb.e, gb.n);
  close(back.lat, 45.2975, 1e-7);
  close(back.lon, 12.0367, 1e-7);
  const est = Geo.fromWgs84('gb-est', 41.9, 12.5);
  assert.ok(est.e > 2.3e6 && est.e < 2.4e6, JSON.stringify(est));
  const b2 = Geo.toWgs84('gb-est', est.e, est.n);
  close(b2.lat, 41.9, 1e-7);
  close(b2.lon, 12.5, 1e-7);
});

test('parses coordinates typed in common formats', () => {
  const a = Geo.parse('45.2975, 12.0367');
  assert.equal(a.crs, 'wgs84');
  close(a.lat, 45.2975, 1e-9);
  close(a.lon, 12.0367, 1e-9);
  const b = Geo.parse('45,2975 12,0367');
  close(b.lat, 45.2975, 1e-9);
  close(b.lon, 12.0367, 1e-9);
  const d = Geo.parse('45°17\'51.0"N 12°02\'12.1"E');
  close(d.lat, 45.2975, 1e-4);
  close(d.lon, 12.03669, 1e-4);
  const w = Geo.parse('40°25\'0"N 3°42\'0"O');
  close(w.lon, -3.7, 1e-9);
  const g = Geo.parse('1738512 5019033');
  assert.equal(g.crs, 'gb-ovest');
  assert.equal(Geo.parse('2312000 4640000').crs, 'gb-est');
  const u = Geo.parse('738512 5019033', { utmZone: 33 });
  assert.equal(u.crs, 'utm33');
  close(u.e, 738512, 1e-9);
  assert.equal(Geo.parse('hello'), null);
});

test('formats a position in the chosen system', () => {
  assert.equal(Geo.format('wgs84', 45.2975, 12.0367), '45.297500, 12.036700');
  assert.equal(Geo.format('dms', 45.2975, 12.0367), '45°17\'51.0"N 12°02\'12.1"E');
  assert.match(Geo.format('gb-ovest', 45.2975, 12.0367), /^E 17\d{5} · N 50\d{5}$/);
});
