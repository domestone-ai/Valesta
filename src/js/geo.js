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
/* Geo — coordinate systems used to place a property: WGS84 (decimal degrees, degrees-minutes-seconds), Gauss-Boaga
 * Roma40 West and East zones (EPSG:3003, 3004) and UTM on ETRS89 (EPSG:25828–25835, within a metre of WGS84).
 * Transverse Mercator with the Krüger series (6th order); Roma40 → WGS84 with the EPSG 7-parameter Helmert sets
 * (position vector): mainland 1660, Sardinia 1661, Sicily 1662, accuracy of a few metres. Pure functions, no DOM. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Geo = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  const AS2R = Math.PI / 648000;
  const ELL = { wgs84: { a: 6378137, invf: 298.257223563 }, intl: { a: 6378388, invf: 297 } };

  // ---------- Transverse Mercator (Krüger series) ----------
  const setups = new Map();
  function tmSetup(ell) {
    const key = ell.a + '/' + ell.invf;
    if (setups.has(key)) return setups.get(key);
    const f = 1 / ell.invf;
    const n = f / (2 - f);
    const n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
    const S = {
      A: (ell.a / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256),
      e: Math.sqrt(f * (2 - f)),
      alpha: [0,
        n / 2 - (2 * n2) / 3 + (5 * n3) / 16 + (41 * n4) / 180 - (127 * n5) / 288 + (7891 * n6) / 37800,
        (13 * n2) / 48 - (3 * n3) / 5 + (557 * n4) / 1440 + (281 * n5) / 630 - (1983433 * n6) / 1935360,
        (61 * n3) / 240 - (103 * n4) / 140 + (15061 * n5) / 26880 + (167603 * n6) / 181440,
        (49561 * n4) / 161280 - (179 * n5) / 168 + (6601661 * n6) / 7257600,
        (34729 * n5) / 80640 - (3418889 * n6) / 1995840,
        (212378941 * n6) / 319334400],
      beta: [0,
        n / 2 - (2 * n2) / 3 + (37 * n3) / 96 - n4 / 360 - (81 * n5) / 512 + (96199 * n6) / 604800,
        n2 / 48 + n3 / 15 - (437 * n4) / 1440 + (46 * n5) / 105 - (1118711 * n6) / 3870720,
        (17 * n3) / 480 - (37 * n4) / 840 - (209 * n5) / 4480 + (5569 * n6) / 90720,
        (4397 * n4) / 161280 - (11 * n5) / 504 - (830251 * n6) / 7257600,
        (4583 * n5) / 161280 - (108847 * n6) / 3991680,
        (20648693 * n6) / 638668800],
    };
    setups.set(key, S);
    return S;
  }
  function xiEta(phi, dl, S) {
    const s = Math.sin(phi);
    const t = Math.sinh(Math.atanh(s) - S.e * Math.atanh(S.e * s));
    const xi1 = Math.atan2(t, Math.cos(dl));
    const eta1 = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
    let xi = xi1, eta = eta1;
    for (let j = 1; j <= 6; j++) {
      xi += S.alpha[j] * Math.sin(2 * j * xi1) * Math.cosh(2 * j * eta1);
      eta += S.alpha[j] * Math.cos(2 * j * xi1) * Math.sinh(2 * j * eta1);
    }
    return [xi, eta];
  }
  // o: { ell, lat0, lon0, k0, fe, fn } (degrees, metres)
  function tmForward(lat, lon, o) {
    const S = tmSetup(o.ell);
    const xe = xiEta(lat * D2R, (lon - o.lon0) * D2R, S);
    const xi0 = o.lat0 ? xiEta(o.lat0 * D2R, 0, S)[0] : 0;
    return { e: o.fe + o.k0 * S.A * xe[1], n: o.fn + o.k0 * S.A * (xe[0] - xi0) };
  }
  function tmInverse(E, N, o) {
    const S = tmSetup(o.ell);
    const xi0 = o.lat0 ? xiEta(o.lat0 * D2R, 0, S)[0] : 0;
    const xi = (N - o.fn) / (o.k0 * S.A) + xi0;
    const eta = (E - o.fe) / (o.k0 * S.A);
    let xi1 = xi, eta1 = eta;
    for (let j = 1; j <= 6; j++) {
      xi1 -= S.beta[j] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
      eta1 -= S.beta[j] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    }
    const chi = Math.asin(Math.sin(xi1) / Math.cosh(eta1));
    let phi = chi;
    for (let i = 0; i < 15; i++) {
      const es = S.e * Math.sin(phi);
      const next = 2 * Math.atan(Math.tan(Math.PI / 4 + chi / 2) * Math.pow((1 + es) / (1 - es), S.e / 2)) - Math.PI / 2;
      const done = Math.abs(next - phi) < 1e-15;
      phi = next;
      if (done) break;
    }
    return { lat: phi * R2D, lon: o.lon0 + Math.atan2(Math.sinh(eta1), Math.cos(xi1)) * R2D };
  }

  // ---------- datums ----------
  function toXYZ(lat, lon, h, ell) {
    const f = 1 / ell.invf, e2 = f * (2 - f);
    const p = lat * D2R, l = lon * D2R;
    const N = ell.a / Math.sqrt(1 - e2 * Math.sin(p) ** 2);
    return [(N + h) * Math.cos(p) * Math.cos(l), (N + h) * Math.cos(p) * Math.sin(l), (N * (1 - e2) + h) * Math.sin(p)];
  }
  function fromXYZ(v, ell) {
    const f = 1 / ell.invf, e2 = f * (2 - f);
    const p = Math.hypot(v[0], v[1]);
    let lat = Math.atan2(v[2], p * (1 - e2));
    let h = 0;
    for (let i = 0; i < 12; i++) {
      const N = ell.a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
      h = p / Math.cos(lat) - N;
      const next = Math.atan2(v[2], p * (1 - (e2 * N) / (N + h)));
      const done = Math.abs(next - lat) < 1e-15;
      lat = next;
      if (done) break;
    }
    return { lat: lat * R2D, lon: Math.atan2(v[1], v[0]) * R2D, h };
  }
  // Helmert, position vector convention (EPSG 9606): rotations in arc-seconds, scale in ppm. inverse: parameters negated.
  function helmert(v, p, inverse) {
    const k = inverse ? -1 : 1;
    const rx = k * p.rx * AS2R, ry = k * p.ry * AS2R, rz = k * p.rz * AS2R, s = 1 + k * p.ds * 1e-6;
    const X = v[0], Y = v[1], Z = v[2];
    return [k * p.tx + s * (X - rz * Y + ry * Z), k * p.ty + s * (rz * X + Y - rx * Z), k * p.tz + s * (-ry * X + rx * Y + Z)];
  }
  const ROMA40 = {
    mainland: { tx: -104.1, ty: -49.1, tz: -9.9, rx: 0.971, ry: -2.917, rz: 0.714, ds: -11.68 },
    sardinia: { tx: -168.6, ty: -34.0, tz: 38.6, rx: -0.374, ry: -0.679, rz: -1.379, ds: -9.48 },
    sicily: { tx: -50.2, ty: -50.4, tz: 84.8, rx: -0.690, ry: -2.012, rz: 0.459, ds: -28.08 },
  };
  function romaSet(lat, lon) {
    if (lat > 38.8 && lat < 41.4 && lon > 8.0 && lon < 9.9) return ROMA40.sardinia;
    if (lat > 36.4 && lat < 38.35 && lon > 12.2 && lon < 15.7 && (lon < 15.62 || lat < 37.9)) return ROMA40.sicily;
    return ROMA40.mainland;
  }

  // ---------- coordinate reference systems ----------
  const CRS = {
    'gb-ovest': { epsg: 3003, datum: 'roma40', tm: { ell: ELL.intl, lat0: 0, lon0: 9, k0: 0.9996, fe: 1500000, fn: 0 } },
    'gb-est': { epsg: 3004, datum: 'roma40', tm: { ell: ELL.intl, lat0: 0, lon0: 15, k0: 0.9996, fe: 2520000, fn: 0 } },
  };
  for (let z = 28; z <= 35; z++) CRS['utm' + z] = { epsg: 25800 + z, zone: z, datum: 'wgs84', tm: { ell: ELL.wgs84, lat0: 0, lon0: z * 6 - 183, k0: 0.9996, fe: 500000, fn: 0 } };
  const isProjected = (crs) => !!CRS[crs];
  const utmZone = (lon) => Math.min(35, Math.max(28, Math.floor((lon + 180) / 6) + 1));

  function fromWgs84(crs, lat, lon) {
    if (!isFinite(lat) || !isFinite(lon)) return null;
    if (crs === 'wgs84' || crs === 'dms') return { lat, lon };
    const c = CRS[crs];
    if (!c) return null;
    let la = lat, lo = lon;
    if (c.datum === 'roma40') {
      const g = fromXYZ(helmert(toXYZ(lat, lon, 0, ELL.wgs84), romaSet(lat, lon), true), ELL.intl);
      la = g.lat;
      lo = g.lon;
    }
    return tmForward(la, lo, c.tm);
  }
  function toWgs84(crs, e, n) {
    const c = CRS[crs];
    if (!c || !isFinite(e) || !isFinite(n)) return null;
    const g = tmInverse(e, n, c.tm);
    if (c.datum !== 'roma40') return g;
    const w = fromXYZ(helmert(toXYZ(g.lat, g.lon, 0, ELL.intl), romaSet(g.lat, g.lon)), ELL.wgs84);
    return { lat: w.lat, lon: w.lon };
  }

  // ---------- parsing and formatting ----------
  const num = (x) => parseFloat(String(x).replace(',', '.'));
  const valid = (lat, lon) => isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const DMS_RE = /(-?\d+(?:[.,]\d+)?)\s*[°º]\s*(?:(\d+(?:[.,]\d+)?)\s*['’′]\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:["”″]|'')\s*)?([NSEWO])?/gi;
  // Accepts "45.2975, 12.0367", "45,2975 12,0367", 45°17'51"N 12°02'12"E, Gauss-Boaga "1738512 5019033" (zone from the
  // easting: 1… West, 2… East) and UTM "738512 5019033" (zone from opts.utmZone, default 32). Returns null if unclear.
  function parse(text, opts) {
    opts = opts || {};
    const s = String(text || '').trim();
    if (!s) return null;
    const dms = Array.from(s.matchAll(DMS_RE));
    if (dms.length === 2) {
      const val = (m) => {
        const d = num(m[1]);
        const v = Math.abs(d) + (m[2] ? num(m[2]) / 60 : 0) + (m[3] ? num(m[3]) / 3600 : 0);
        const h = (m[4] || '').toUpperCase();
        return (d < 0 || h === 'S' || h === 'W' || h === 'O' ? -1 : 1) * v;
      };
      let a = val(dms[0]), b = val(dms[1]);
      if (/^[EWO]$/i.test(dms[0][4] || '')) { const x = a; a = b; b = x; }
      return valid(a, b) ? { crs: 'wgs84', lat: a, lon: b } : null;
    }
    const tokens = (x) => (x.match(/-?\d+(?:[.,]\d+)?/g) || []).map(num);
    let nums = tokens(s);
    if (nums.length !== 2) {
      nums = tokens(s.replace(/\b\d{1,3}(?:\.\d{3}){2,}\b/g, (m) => m.replace(/\./g, '')).replace(/(\d)['’ ](?=\d{3}(?!\d))/g, '$1'));
    }
    if (nums.length !== 2) return null;
    const x = nums[0], y = nums[1];
    if (valid(x, y) && Math.abs(x) <= 90) return { crs: 'wgs84', lat: x, lon: y };
    const e = Math.min(x, y), n = Math.max(x, y);
    if (n < 1e6) return null;
    if (e >= 1e6 && e < 2e6) return { crs: 'gb-ovest', e, n };
    if (e >= 2e6 && e < 3e6) return { crs: 'gb-est', e, n };
    if (e >= 1e5 && e < 1e6) return { crs: 'utm' + (opts.utmZone || 32), e, n };
    return null;
  }
  // Position of a parsed value in WGS84, or null.
  function toLatLon(p) {
    if (!p) return null;
    const r = p.crs === 'wgs84' ? { lat: p.lat, lon: p.lon } : toWgs84(p.crs, p.e, p.n);
    return r && valid(r.lat, r.lon) ? r : null;
  }
  function dmsText(v, pos, neg) {
    const a = Math.abs(v);
    let d = Math.floor(a);
    let m = Math.floor((a - d) * 60);
    let s = Math.round(((a - d) * 60 - m) * 600) / 10;
    if (s >= 60) { s = 0; m += 1; }
    if (m >= 60) { m = 0; d += 1; }
    return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}"${v < 0 ? neg : pos}`;
  }
  function format(crs, lat, lon) {
    if (!isFinite(lat) || !isFinite(lon)) return '';
    if (crs === 'wgs84') return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    if (crs === 'dms') return `${dmsText(lat, 'N', 'S')} ${dmsText(lon, 'E', 'W')}`;
    const p = fromWgs84(crs, lat, lon);
    return p ? `E ${Math.round(p.e)} · N ${Math.round(p.n)}` : '';
  }
  // Systems offered for a country (and the position, for the UTM zone).
  function systemsFor(country, lon) {
    const base = ['wgs84', 'dms'];
    if (country === 'IT') return base.concat(['gb-ovest', 'gb-est', 'utm32', 'utm33', 'utm34']);
    if (country === 'ES') return base.concat(['utm28', 'utm29', 'utm30', 'utm31']);
    return base.concat(['utm' + utmZone(isFinite(lon) ? lon : 10)]);
  }
  const LABELS = {
    wgs84: { it: 'WGS84 · gradi decimali', en: 'WGS84 · decimal degrees', es: 'WGS84 · grados decimales' },
    dms: { it: 'WGS84 · gradi, primi, secondi', en: 'WGS84 · degrees, minutes, seconds', es: 'WGS84 · grados, minutos, segundos' },
    'gb-ovest': { it: 'Gauss-Boaga Roma40 · fuso Ovest (EPSG:3003)', en: 'Gauss-Boaga Roma40 · West zone (EPSG:3003)', es: 'Gauss-Boaga Roma40 · huso Oeste (EPSG:3003)' },
    'gb-est': { it: 'Gauss-Boaga Roma40 · fuso Est (EPSG:3004)', en: 'Gauss-Boaga Roma40 · East zone (EPSG:3004)', es: 'Gauss-Boaga Roma40 · huso Este (EPSG:3004)' },
  };
  function label(crs, lang) {
    const l = lang === 'en' || lang === 'es' ? lang : 'it';
    if (LABELS[crs]) return LABELS[crs][l];
    const c = CRS[crs];
    if (!c) return crs;
    return { it: `UTM ETRS89 · fuso ${c.zone} (EPSG:${c.epsg})`, en: `UTM ETRS89 · zone ${c.zone} (EPSG:${c.epsg})`, es: `UTM ETRS89 · huso ${c.zone} (EPSG:${c.epsg})` }[l];
  }

  return { tmForward, tmInverse, helmert, fromWgs84, toWgs84, parse, toLatLon, format, systemsFor, label, utmZone, isProjected, CRS };
});
