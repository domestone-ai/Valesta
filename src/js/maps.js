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
/* Maps — base maps for the app and the report: open national services (checked 2026-11-23), each with its credit and
 * licence, web mercator helpers and the address of each tile. Tiles of tile.openstreetmap.org are not used: the
 * OpenStreetMap Foundation tile policy forbids distributing an app that uses them. A tile address set by the user
 * ({z}/{x}/{y}) is accepted as a custom provider. Pure data and functions, no DOM. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Maps = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TILE = 256;

  // ---------- web mercator (256-pixel tiles) ----------
  // Any longitude is brought back to −180…180 and the latitude to the Mercator limits, so tile indices stay small
  // (beyond 2^53 a loop counter stops increasing). Non-numbers give NaN: callers then draw no tiles.
  const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
  function project(z, lat, lon) {
    const s = TILE * Math.pow(2, z);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [NaN, NaN];
    const sin = Math.min(Math.max(Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180), -0.9999), 0.9999);
    return [((wrapLon(lon) + 180) / 360) * s, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s];
  }
  function unproject(z, x, y) {
    const s = TILE * Math.pow(2, z);
    const n = Math.PI - (2 * Math.PI * y) / s;
    return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lon: (x / s) * 360 - 180 };
  }
  const tileOf = (z, lat, lon) => project(z, lat, lon).map((v) => Math.floor(v / TILE));

  // ---------- providers ----------
  const xyz = (fn) => fn;
  const wms = (base, params) => (z, x, y) => {
    const nw = unproject(z, x * TILE, y * TILE);
    const se = unproject(z, (x + 1) * TILE, (y + 1) * TILE);
    // WMS 1.3.0 with a geographic CRS: axis order latitude, longitude.
    return `${base}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${params.layers}&STYLES=&CRS=${params.crs}` +
      `&BBOX=${se.lat},${nw.lon},${nw.lat},${se.lon}&WIDTH=${params.px || TILE}&HEIGHT=${params.px || TILE}&FORMAT=${params.format || 'image/png'}&TRANSPARENT=FALSE`;
  };
  const PROVIDERS = {
    'it-cadastre': {
      label: { it: 'Catasto (Agenzia delle Entrate)', en: 'Italian cadastre (Agenzia delle Entrate)', es: 'Catastro italiano (Agenzia delle Entrate)' }, role: 'cadastre', countries: ['IT'], minZoom: 5, maxZoom: 20, report: { micro: 17, overview: 16 },
      tile: wms('https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php',
        { layers: 'CP.CadastralParcel,fabbricati,strade,acque,vestizioni,codice_plla', crs: 'EPSG:4258', px: 512 }),
      attribution: '© Agenzia delle Entrate · cartografia catastale · CC BY 4.0', licence: 'CC BY 4.0',
      terms: 'https://www.agenziaentrate.gov.it/portale/web/guest/schede/fabbricatiterreni/consultazione-cartografia-catastale',
      noteBelow: 17, note: { it: 'Particelle e fabbricati visibili da vicino (zoom 17 e oltre).', en: 'Parcels and buildings show when zoomed in (zoom 17 and more).', es: 'Parcelas y edificios visibles de cerca (zoom 17 o más).' },
    },
    'es-ign': {
      label: 'IGN · Mapa base', role: 'national', countries: ['ES', 'AD'], minZoom: 5, maxZoom: 19,
      tile: xyz((z, x, y) => `https://www.ign.es/wmts/ign-base?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=IGNBaseTodo&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=image/jpeg`),
      attribution: '© Instituto Geográfico Nacional de España (IGN) · CC BY 4.0', licence: 'CC BY 4.0', terms: 'https://www.ign.es/web/ign/portal/licencias',
    },
    'fr-ign': {
      label: 'Plan IGN', role: 'national', countries: ['FR', 'MC'], minZoom: 5, maxZoom: 19,
      tile: xyz((z, x, y) => `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=image/png`),
      attribution: '© IGN · Plan IGN · Licence Ouverte Etalab 2.0', licence: 'Etalab 2.0', terms: 'https://geoservices.ign.fr/cgu-licences',
    },
    'ch-swisstopo': {
      label: 'swisstopo · carte nazionali', role: 'national', countries: ['CH', 'LI'], minZoom: 5, maxZoom: 18,
      tile: xyz((z, x, y) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/${z}/${x}/${y}.jpeg`),
      attribution: '© swisstopo', licence: 'OGD swisstopo', terms: 'https://www.geo.admin.ch/en/general-terms-of-use-fsdi',
    },
    'nl-pdok': {
      label: 'PDOK · BRT Achtergrondkaart', role: 'national', countries: ['NL'], minZoom: 5, maxZoom: 19,
      tile: xyz((z, x, y) => `https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/${z}/${x}/${y}.png`),
      attribution: '© Kadaster / PDOK · CC BY 4.0', licence: 'CC BY 4.0', terms: 'https://www.pdok.nl/',
    },
    'at-basemap': {
      label: 'basemap.at', role: 'national', countries: ['AT'], minZoom: 5, maxZoom: 19,
      tile: xyz((z, x, y) => `https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857/${z}/${y}/${x}.png`),
      attribution: 'Datenquelle: basemap.at · CC BY 4.0', licence: 'CC BY 4.0', terms: 'https://basemap.at/',
    },
    'no-kartverket': {
      label: 'Kartverket · Topografisk', role: 'national', countries: ['NO'], minZoom: 5, maxZoom: 18,
      tile: xyz((z, x, y) => `https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/${z}/${y}/${x}.png`),
      attribution: '© Kartverket · CC BY 4.0', licence: 'CC BY 4.0', terms: 'https://www.kartverket.no/',
    },
    // Europe-wide street map of the German Federal Agency for Cartography and Geodesy (BKG), free of charge under the
    // Datenlizenz Deutschland – Namensnennung 2.0 (commercial use allowed) with the credit below.
    'eu-topplus': {
      label: { it: 'Mappa stradale (BKG TopPlusOpen)', en: 'Street map (BKG TopPlusOpen)', es: 'Mapa de calles (BKG TopPlusOpen)' }, role: 'europe', countries: ['*'], minZoom: 3, maxZoom: 19, maxNative: 16,
      tile: xyz((z, x, y) => `https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/${z}/${y}/${x}.png`),
      get attribution() { return `© BKG (${new Date().getFullYear()}) dl-de/by-2-0 · Datenquellen: sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_topplusopen.html`; },
      get links() { return [[`© BKG (${new Date().getFullYear()})`, 'https://www.bkg.bund.de'], ['dl-de/by-2-0', 'https://www.govdata.de/dl-de/by-2-0'], ['Datenquellen', 'https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_topplusopen.html']]; },
      licence: 'dl-de/by-2-0', terms: 'https://sg.geodatenzentrum.de/web_public/gdz/lizenz/deu/nutzungsbedingungen_topplusopen.pdf',
    },
  };
  // Italy: the street map from afar, the cadastral map (parcels and buildings) from zoom 17.
  PROVIDERS['it-hybrid'] = {
    label: { it: 'Mappa + Catasto da vicino', en: 'Street map + cadastre close up', es: 'Mapa + catastro de cerca' }, role: 'hybrid', countries: ['IT'],
    minZoom: 3, maxZoom: 20, report: { micro: 16, overview: 15 },
    tile: (z, x, y) => (z >= 17 ? PROVIDERS['it-cadastre'].tile(z, x, y) : PROVIDERS['eu-topplus'].tile(z, x, y)),
    get attribution() { return `${PROVIDERS['eu-topplus'].attribution} · ${PROVIDERS['it-cadastre'].attribution}`; },
    get links() { return PROVIDERS['eu-topplus'].links.concat([['© Agenzia delle Entrate · CC BY 4.0', PROVIDERS['it-cadastre'].terms]]); },
    creditAt: (z) => (z >= 17 ? PROVIDERS['it-cadastre'].attribution : PROVIDERS['eu-topplus'].attribution),
    licence: 'dl-de/by-2-0 · CC BY 4.0', terms: PROVIDERS['it-cadastre'].terms, noteBelow: 17,
    note: { it: 'Avvicinati per vedere particelle e fabbricati del Catasto (zoom 17 e oltre).', en: 'Zoom in to see cadastral parcels and buildings (zoom 17 and more).', es: 'Acércate para ver parcelas y edificios del catastro (zoom 17 o más).' },
  };
  Object.keys(PROVIDERS).forEach((id) => { PROVIDERS[id].id = id; });
  // Country where each service is run (shown to the user before tiles are allowed).
  const SEATS = { 'it-cadastre': 'IT', 'es-ign': 'ES', 'fr-ign': 'FR', 'ch-swisstopo': 'CH', 'nl-pdok': 'NL', 'at-basemap': 'AT', 'no-kartverket': 'NO', 'eu-topplus': 'DE', 'it-hybrid': 'DE · IT' };
  Object.keys(PROVIDERS).forEach((id) => { PROVIDERS[id].seat = SEATS[id]; });
  // Outside tiles are loaded only once the user allows them on this device (MCP server: --maps). Each tile request sends
  // the IP address, browser data and the area shown to the mapping service; without them maps are drawn as a schematic.
  let allowed = false;
  const setAllowed = (on) => { allowed = !!on; return allowed; };
  const isAllowed = () => allowed;
  const NONE = { id: 'none', label: '—', countries: [], minZoom: 3, maxZoom: 20, tile: null, attribution: '' };

  const get = (id) => PROVIDERS[id] || null;
  const labelOf = (id, lang) => { const l = (PROVIDERS[id] || {}).label; return l && typeof l === 'object' ? l[lang] || l.en : l || id; };
  // Maps offered for a country: its national service, the European street map, then its cadastral map.
  const ofRole = (cc, role) => Object.keys(PROVIDERS).filter((id) => PROVIDERS[id].role === role && PROVIDERS[id].countries.includes(cc));
  const forCountry = (cc) => ofRole(cc, 'national').concat(ofRole(cc, 'hybrid'), ['eu-topplus'], ofRole(cc, 'cadastre'));
  const defaultFor = (cc) => forCountry(cc)[0];
  // A tile address chosen by the user: https only, with {z}, {x} and {y}.
  function custom(o) {
    const url = String((o && o.url) || '').trim();
    if (!/^https:\/\/[^\s]+$/i.test(url) || !/\{z\}/.test(url) || !/\{x\}/.test(url) || !/\{y\}/.test(url)) return null;
    return {
      id: 'custom', label: (o && o.label) || 'Custom', countries: [], minZoom: 3, maxZoom: Math.min(22, +(o && o.maxZoom) || 19),
      tile: (z, x, y) => url.replace('{z}', z).replace('{x}', x).replace('{y}', y), attribution: String((o && o.attribution) || '').slice(0, 200),
    };
  }
  // Provider of a valuation: its own choice (state.map.base) or the default of its country.
  function resolve(state, customCfg) {
    if (!allowed) return NONE;
    const m = (state && state.map) || {};
    const cc = (state && state.meta && state.meta.country) || 'ES';
    if (m.base === 'custom') return custom(customCfg) || NONE;
    if (m.base === 'none') return NONE;
    return get(m.base) || get(defaultFor(cc)) || NONE;
  }

  return { TILE, project, unproject, tileOf, PROVIDERS, NONE, get, labelOf, forCountry, defaultFor, custom, resolve, setAllowed, isAllowed };
});
