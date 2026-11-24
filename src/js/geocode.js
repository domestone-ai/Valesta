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
/* Geocode — address search with a service chosen by the user. The public Nominatim service of the OpenStreetMap
 * Foundation is used only after the user turns it on, and within its usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/): searches started by the user only, no suggestions while
 * typing, at most one request per second, results cached, attribution shown, the service can be changed at any time.
 * Only the address fields are sent, never names of people. A Nominatim-compatible service at another https address
 * (own server or a provider with a key) can be set instead. No DOM. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Geocode = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  const POLICY = 'https://operations.osmfoundation.org/policies/nominatim/';
  const ATTRIBUTION = '© OpenStreetMap contributors · ODbL · Nominatim';
  const CACHE_KEY = 'valesta-geocache';
  const GAP = 1100; // ms between two requests
  let lastAt = -Infinity;

  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  // Address of the property as typed: street and number, postcode and town, province. Nothing else is sent.
  function queryFor(s) {
    s = s || {};
    const town = [clean(s.postalCode), clean(s.municipality)].filter(Boolean).join(' ');
    return [clean(s.address), town, clean(s.province)].filter(Boolean).join(', ');
  }
  function baseUrl(cfg) {
    if (!cfg || cfg.provider === 'off') return null;
    if (cfg.provider === 'nominatim') return NOMINATIM;
    if (cfg.provider === 'custom') {
      const u = String(cfg.url || '').trim();
      return /^https:\/\/[^\s]+$/i.test(u) ? u : null;
    }
    return null;
  }
  function searchUrl(cfg, query, opts) {
    const base = baseUrl(cfg);
    if (!base || !clean(query)) return null;
    opts = opts || {};
    const p = [['format', 'jsonv2'], ['addressdetails', '1'], ['limit', '5'], ['q', clean(query)]];
    if (opts.country) p.push(['countrycodes', String(opts.country).toLowerCase()]);
    if (opts.lang) p.push(['accept-language', opts.lang]);
    if (opts.near && isFinite(opts.near.lat) && isFinite(opts.near.lon)) {
      const d = opts.radius || 0.04;
      p.push(['viewbox', [opts.near.lon - d, opts.near.lat + d, opts.near.lon + d, opts.near.lat - d].map((v) => v.toFixed(5)).join(',')], ['bounded', '1']);
    }
    return base + (base.includes('?') ? '&' : '?') + p.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  }
  // Nominatim results → { lat, lon, label, address: { street, postalCode, municipality, province, region, country } }
  function parse(json) {
    return (Array.isArray(json) ? json : []).map((r) => {
      const a = r.address || {};
      const iso = a['ISO3166-2-lvl6'] || '';
      const street = [a.road || a.pedestrian || a.square || '', a.house_number || ''].filter(Boolean).join(' ');
      return {
        lat: parseFloat(r.lat), lon: parseFloat(r.lon), label: clean(r.display_name),
        address: {
          street, postalCode: a.postcode || '', municipality: a.city || a.town || a.village || a.municipality || a.hamlet || '',
          province: /^IT-[A-Z]{2}$/.test(iso) ? iso.slice(3) : a.province || a.county || '', region: a.state || a.region || '',
          zone: a.suburb || a.quarter || a.neighbourhood || '', country: (a.country_code || '').toUpperCase(),
        },
      };
    }).filter((r) => isFinite(r.lat) && isFinite(r.lon));
  }
  // Completes the empty address fields of the property; returns the names of the fields filled.
  function fill(subject, address) {
    const map = { address: 'street', postalCode: 'postalCode', municipality: 'municipality', province: 'province', region: 'region', zone: 'zone' };
    const done = [];
    Object.keys(map).forEach((k) => {
      const v = address && address[map[k]];
      if (v && !clean(subject[k])) { subject[k] = v; done.push(k); }
    });
    return done;
  }
  const delayBefore = (last, now) => Math.max(0, last + GAP - now);
  function cacheGet(storage, key) {
    try { const c = JSON.parse(storage.getItem(CACHE_KEY) || '{}'); return c[key] || null; } catch (e) { return null; }
  }
  function cachePut(storage, key, value) {
    try {
      const c = JSON.parse(storage.getItem(CACHE_KEY) || '{}');
      c[key] = value;
      const keys = Object.keys(c);
      if (keys.length > 200) keys.slice(0, keys.length - 200).forEach((k) => delete c[k]);
      storage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) { /* cache is optional */ }
  }
  // deps: { fetch, storage, now, wait } (browser defaults)
  async function search(cfg, query, opts, deps) {
    deps = deps || {};
    const f = deps.fetch || (typeof fetch === 'function' ? fetch.bind(null) : null);
    const storage = deps.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const now = deps.now || (() => Date.now());
    const wait = deps.wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
    const url = searchUrl(cfg, query, opts);
    if (!url || !f) throw new Error('geocoder-off');
    const hit = storage && cacheGet(storage, url);
    if (hit) return hit;
    const d = delayBefore(lastAt, now());
    if (d) await wait(d);
    lastAt = now();
    const res = await f(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('geocoder-' + res.status);
    const out = parse(await res.json());
    if (storage) cachePut(storage, url, out);
    return out;
  }

  return { NOMINATIM, POLICY, ATTRIBUTION, queryFor, searchUrl, parse, fill, delayBefore, search };
});
