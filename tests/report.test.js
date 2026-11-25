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
const Charts = require('../src/js/charts.js');
const ASSETS = require('../src/js/assets.js');
const DEFAULT_STATE = require('../src/js/data.js');
global.MCA = MCA;
global.Charts = Charts;
global.ASSETS = ASSETS;
const Report = require('../src/js/report.js');

// These tests check the Spanish report (the demo now defaults to English: see profiles.test.js).
const fresh = () => { const s = JSON.parse(JSON.stringify(DEFAULT_STATE)); s.meta.reportLang = 'es'; return s; };
const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b} (±${tol})`);
const count = (s, re) => (s.match(re) || []).length;
const noData = (s) => s.replace(/data:[a-z]+\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+/g, 'DATA'); // base64 may contain 'NaN' by chance

// ---------- charts ----------
test('Charts.fmt uses Spanish grouping and decimal comma', () => {
  assert.equal(Charts.fmt(4572), '4.572');
  assert.equal(Charts.fmt(518000), '518.000');
  assert.equal(Charts.fmt(-1234.5, 1), '−1.234,5');
  assert.equal(Charts.fmt(null), '—');
});

test('Charts.hbars draws one bar per item and a reference line', () => {
  const svg = Charts.hbars({ items: [{ label: 'T1', value: 4000 }, { label: 'T2', value: 4500 }, { label: 'T3', value: 5000 }], ref: { value: 4400, label: 'Valor' } });
  assert.equal(count(svg, /<path d="M/g), 3);
  assert.ok(svg.includes('Valor'));
  assert.ok(!/NaN|undefined/.test(svg));
});

test('Charts.map renders every embedded tile and skips points without coordinates', () => {
  const svg = Charts.map(ASSETS.maps.micro, [
    { lat: 41.2831, lon: 1.9814, kind: 'subject', label: 'Inmueble' },
    { lat: null, lon: null, kind: 'comp', label: 'X' },
  ]);
  assert.equal(count(svg, /<image /g), ASSETS.maps.micro.tiles.length);
  assert.ok(svg.includes('Inmueble'));
  assert.ok(!svg.includes('>X<'));
  assert.ok(!/NaN|undefined/.test(noData(svg)));
});

test('embedded map tiles are IGN JPEGs and maps credit the IGN, never OpenStreetMap', () => {
  for (const m of [ASSETS.maps.micro, ASSETS.maps.overview]) {
    for (const t of m.tiles) assert.ok(t.d.startsWith('data:image/jpeg;base64,'), 'tile is not an IGN JPEG');
  }
  const svg = Charts.map(ASSETS.maps.micro, [{ lat: 41.2831, lon: 1.9814, kind: 'subject', label: 'Inmueble' }]);
  assert.ok(svg.includes('Instituto Geográfico Nacional'));
  assert.ok(!/(?:href|src)="https?:/.test(Charts.map({ z: 16, center: [41.2831, 1.9814], w: 300, h: 200 }, [])), 'no outside tiles without a service');
  const online = Charts.map({ z: 16, center: [41.2831, 1.9814], w: 300, h: 200 }, [], { provider: require('../src/js/maps.js').get('es-ign') });
  assert.ok(online.includes('www.ign.es/wmts/ign-base'));
  const st = fresh();
  assert.ok(!Report.render(st, MCA.compute(st)).includes('OpenStreetMap'));
});

test('Charts.map crops to the requested aspect and keeps scale bar and credits inside the view', () => {
  const svg = Charts.map(ASSETS.maps.micro, [{ lat: 41.2831, lon: 1.9814, kind: 'subject', label: 'Inmueble' }], { aspect: 1.2 });
  const vb = /viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/.exec(svg).slice(1).map(Number);
  close(vb[2] / vb[3], 1.2, 0.01);
  const sb = /class="scalebar" transform="translate\(([\d.-]+),([\d.-]+)\)"/.exec(svg);
  assert.ok(sb, 'scale bar missing');
  assert.ok(+sb[1] >= vb[0] && +sb[1] <= vb[0] + vb[2], 'scale bar outside the visible window');
  const at = /class="credits" x="([\d.-]+)"/.exec(svg);
  assert.ok(at && +at[1] <= vb[0] + vb[2] && +at[1] >= vb[0], 'credits outside the visible window');
});

test('Charts.line and dumbbell produce finite geometry', () => {
  const l = Charts.line({ points: [{ label: 'a', v: 1 }, { label: 'b', v: 3 }, { label: 'c', v: 2 }], unit: '€/m²' });
  const d = Charts.dumbbell({ items: [{ label: 'T1', from: 4000, to: 4300 }, { label: 'T2', from: 5000, to: 4700 }], ref: { value: 4400, label: 'p*' } });
  assert.ok(!/NaN|undefined|Infinity/.test(l + d));
});

test('Charts.segBar sizes parts by share and labels only parts that fit', () => {
  const svg = Charts.segBar({ parts: [{ label: 'Día', value: 37.5 }, { label: 'Noche', value: 32.5 }, { label: 'Baños', value: 7.6 }, { label: 'Paso', value: 0 }], width: 600 });
  assert.equal(count(svg, /<rect /g), 3); // zero part draws nothing
  assert.ok(svg.includes('48%'));
  assert.ok(!/NaN|undefined/.test(svg));
});

// ---------- report helpers ----------
test('numberToWords writes Spanish amounts', () => {
  assert.equal(Report.numberToWords(518000), 'quinientos dieciocho mil');
  assert.equal(Report.numberToWords(1250000), 'un millón doscientos cincuenta mil');
  assert.equal(Report.numberToWords(21), 'veintiuno');
  assert.equal(Report.numberToWords(101), 'ciento uno');
  assert.equal(Report.numberToWords(100), 'cien');
  assert.equal(Report.numberToWords(2000000), 'dos millones');
  assert.equal(Report.numberToWords(545000), 'quinientos cuarenta y cinco mil');
});

test('dateEs formats long Spanish dates', () => {
  assert.equal(Report.dateEs('2026-11-22'), '22 de noviembre de 2026');
  assert.equal(Report.dateEs('2026-01-05'), '5 de enero de 2026');
  assert.equal(Report.dateEs(''), '—');
});

// ---------- full report ----------
test('report renders the default valuation without NaN or undefined', () => {
  const st = fresh();
  const res = MCA.compute(st);
  const html = Report.render(st, res);
  assert.ok(!/NaN|undefined|\[object Object\]/.test(noData(html)), 'contains NaN/undefined');
  assert.ok(html.includes('518.000 €'));
  assert.ok(html.includes('quinientos dieciocho mil euros'));
  const pages = count(html, /<section class="page/g);
  assert.ok(pages >= 13 && pages <= 20, `pages=${pages}`);   // 20 with the pages of the method applied and of the methodological references
});

test('photo section is omitted without photos and rendered with photos', () => {
  const st = fresh();
  const res = MCA.compute(st);
  assert.ok(!Report.render(st, res).includes('Reportaje fotográfico'));
  st.photos = [{ id: 'p1', dataUrl: 'data:image/jpeg;base64,AAAA', caption: 'Salón-comedor', cover: false }];
  const html = Report.render(st, res);
  assert.ok(html.includes('Reportaje fotográfico'));
  assert.ok(html.includes('Salón-comedor'));
});

test('excluded comparables are documented with their reason', () => {
  const st = fresh();
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('Obra nueva (mercado primario'));
  assert.ok(html.includes('ocupada ilegalmente'));
});

test('table of contents page numbers match the rendered pages', () => {
  const st = fresh();
  const html = Report.render(st, MCA.compute(st));
  const toc = [...html.matchAll(/data-toc-target="([\w-]+)"[^>]*>\s*<span class="toc-n">(\d+)<\/span>/g)];
  assert.ok(toc.length >= 8, `toc entries=${toc.length}`);
  for (const [, target, n] of toc) {
    const re = new RegExp(`<section class="page[^"]*" data-page="${n}"[^>]*data-sections="[^"]*\\b${target}\\b`);
    assert.ok(re.test(html), `section ${target} not on page ${n}`);
  }
});

test('many comparables paginate into extra card pages instead of overflowing', () => {
  const st = fresh();
  const base = st.comparables[3];
  for (let i = 0; i < 9; i++) st.comparables.push(Object.assign({}, base, { id: 'X' + i }));
  const html = Report.render(st, MCA.compute(st));
  const cardPages = count(html, /data-sections="[^"]*\bcards\b/g);
  assert.ok(cardPages >= 3, `card pages=${cardPages}`);
  for (const m of html.matchAll(/<div class="card-grid">([\s\S]*?)<\/div><!--grid-->/g)) {
    assert.ok(count(m[1], /class="comp-card/g) <= 6);
  }
});

test('Charts.hbars dot mode draws dots instead of bars', () => {
  const svg = Charts.hbars({ mode: 'dot', items: [{ label: 'T1', value: 4000 }, { label: 'T2', value: 4500 }], ref: { value: 4300, label: 'p*' } });
  assert.equal(count(svg, /<path d="M/g), 0);
  assert.ok(count(svg, /<circle /g) >= 2);
});

test('Charts.treemap tiles the whole area with one rect per item', () => {
  const items = [{ label: 'Salón', value: 26, group: 0 }, { label: 'Cocina', value: 11.5, group: 0 }, { label: 'Dorm. 1', value: 8.3, group: 1 }, { label: 'Baño', value: 3.5, group: 2 }];
  const svg = Charts.treemap({ items, width: 600, height: 300 });
  const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => ({ w: +m[3], h: +m[4] }));
  assert.equal(rects.length, 4);
  const area = rects.reduce((s, r) => s + r.w * r.h, 0);
  assert.ok(Math.abs(area - 600 * 300) / (600 * 300) < 0.06, `area ${area}`);
  assert.ok(!/NaN|undefined/.test(svg));
});

test('result page includes a sensitivity analysis on estimator and negotiation', () => {
  const st = fresh();
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('Análisis de sensibilidad'));
  for (const k of [0.92, 0.96]) {
    const alt = fresh();
    alt.settings.negotiationDefault = k;
    assert.ok(html.includes(Charts.fmt(MCA.compute(alt).total) + ' €'), `missing scenario ${k}`);
  }
});

test('hypotheses start with a capital letter after the bold label', () => {
  const st = fresh();
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('<strong>Superficies.</strong> La superficie'));
});

test('location text measures Barcelona from Plaça de Catalunya, not the airport', () => {
  const st = fresh();
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('a unos 20 km en línea recta del centro de Barcelona'));
});

test('en-suite bathroom is grouped with bathrooms and a glossary closes the report', () => {
  const st = fresh();
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('Baños · 7,60 m²'));
  assert.ok(html.includes('Glosario'));
});

test('documentHtml wraps the pages in a standalone, script-free A4 document', () => {
  const st = fresh();
  const pages = Report.render(st, MCA.compute(st));
  const doc = Report.documentHtml(pages, '.page{color:red}', 'Informe de valoración');
  assert.ok(doc.startsWith('<!doctype html>'));
  assert.ok(doc.includes('<html lang="es">'));
  assert.ok(doc.includes('<title>Informe de valoración</title>'));
  assert.ok(doc.includes('.page{color:red}'));
  assert.ok(doc.includes('<main class="report">'));
  assert.equal(count(doc, /<section class="page/g), count(pages, /<section class="page/g));
  assert.ok(!/<script/i.test(doc));
});

test('documentTitle names the report after the property', () => {
  assert.equal(Report.documentTitle(fresh()), 'Informe de valoración · Calle de Ejemplo, 10, 3º · Castelldefels');
});

test('report never claims to be an official ECO/805 appraisal', () => {
  const st = fresh();
  const html = Report.render(st, MCA.compute(st));
  assert.ok(/no constituye una tasación oficial/i.test(html));
});

// ---------- languages ----------
const LEAK_ES = ['Síntesis de la valoración', 'Glosario', 'Testigos homogeneizados', 'Localización y entorno', 'Puntos fuertes', 'Fecha de valoración'];
test('report renders in Italian with Italian labels and amounts', () => {
  const st = fresh();
  st.meta.reportLang = 'it';
  const html = noData(Report.render(st, MCA.compute(st)));
  for (const s of ['Sintesi della valutazione', 'Valore di mercato', 'cinquecentodiciottomila euro', '518.000 €', 'Glossario']) assert.ok(html.includes(s), `missing: ${s}`);
  for (const s of LEAK_ES) assert.ok(!html.includes(s), `Spanish leak: ${s}`);
  assert.ok(!/NaN|undefined|\[object Object\]/.test(html));
});

test('report renders in English with English labels and amounts', () => {
  const st = fresh();
  st.meta.reportLang = 'en';
  const html = noData(Report.render(st, MCA.compute(st)));
  for (const s of ['Valuation summary', 'Market value', 'five hundred and eighteen thousand euros', '€518,000', 'Glossary']) assert.ok(html.includes(s), `missing: ${s}`);
  for (const s of LEAK_ES) assert.ok(!html.includes(s), `Spanish leak: ${s}`);
  assert.ok(!/NaN|undefined|\[object Object\]/.test(html));
});

test('demo free texts follow the report language', () => {
  const st = fresh();
  st.meta.reportLang = 'en';
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('New build (primary market'), 'R1 exclusion reason in English');
  assert.ok(html.includes('Bedroom 1'), 'room names in English');
  for (const c of DEFAULT_STATE.comparables) for (const l of ['es', 'it', 'en']) assert.ok(c.description[l], `${c.id}.description.${l}`);
});

test('documentHtml and documentTitle follow the report language', () => {
  const st = fresh();
  st.meta.reportLang = 'en';
  assert.equal(Report.documentTitle(st), 'Valuation report · Calle de Ejemplo, 10, 3º · Castelldefels');
  assert.ok(Report.documentHtml('<section class="page"></section>', '', 't', 'it').includes('<html lang="it">'));
});

// ---------- branding ----------
test('brandCss derives the palette from the primary colour', () => {
  const st = fresh();
  assert.ok(Report.brandCss(st).includes('--brand:#0e5a4e'));
  st.brand.primary = '#C0392B';
  const css = Report.brandCss(st);
  assert.ok(css.includes('--brand:#c0392b'));
  assert.ok(/--brand-deep:#[0-9a-f]{6}/.test(css));
});

test('custom logo replaces the built-in logo and the agency data are printed', () => {
  const st = fresh();
  st.brand.logoMode = 'custom';
  st.brand.logoLight = 'data:image/png;base64,iVBORw0KGgo=';
  st.brand.name = 'Inmobiliaria Sol';
  st.meta.office.name = 'Inmobiliaria Sol Sitges';
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('data:image/png;base64,iVBORw0KGgo='));
  assert.ok(!/class="wordmark wordmark--head"/.test(html), 'the uploaded logo replaces the wordmark in the page header');
  assert.ok(html.includes('Inmobiliaria Sol Sitges'));
});

test('text logo mode prints the agency name as a wordmark', () => {
  const st = fresh();
  st.brand.logoMode = 'text';
  st.brand.name = 'Casa Mía';
  const html = Report.render(st, MCA.compute(st));
  assert.ok(/class="wordmark[ "]/.test(html), 'wordmark element missing');
  assert.ok(html.includes('Casa Mía'));
  assert.ok(!html.includes('M336.6,110.7'));
});

// ---------- design customisation ----------
const pageOf = (html, sec) => html.split('<section ').find((p) => new RegExp(`data-sections="[^"]*\\b${sec}\\b`).test(p)) || '';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('design variables drive fonts, text size, spacing, corners and ink', () => {
  const st = fresh();
  st.design = { fontHead: 'Literata', fontBody: 'Open Sans', textScale: 1.05, density: 'compact', radius: 'square', ink: '#222222' };
  const css = Report.brandCss(st);
  assert.match(css, /--serif:'Literata'/);
  assert.match(css, /--sans:'Open Sans'/);
  assert.match(css, /--ts:1\.05/);
  assert.match(css, /--sp:0\.8/);
  assert.match(css, /--lh:1\.42/);
  assert.match(css, /--rf:0[;}]/);
  assert.match(css, /--ink:#222222/);
  assert.deepEqual(Report.usedFonts(st).sort(), ['Literata', 'Open Sans']);
  st.design = { fontHead: 'Georgia', fontBody: 'Helvetica' };
  assert.deepEqual(Report.usedFonts(st), []);
});

test('filterFontCss keeps only the font families used by the report', () => {
  const css = "/* a */\n@font-face {\n  font-family: 'Inter';\n  src: url(x);\n}\n/* b */\n@font-face {\n  font-family: 'Literata';\n  src: url(y);\n}\n";
  const out = Report.filterFontCss(css, ['Literata']);
  assert.match(out, /'Literata'/);
  assert.doesNotMatch(out, /'Inter'/);
});

test('switching a chapter off removes its pages, renumbers chapters and the TOC', () => {
  const st = fresh();
  st.design = { sections: { market: false } };
  const html = Report.render(st, MCA.compute(st));
  assert.equal(pageOf(html, 'market'), '');
  assert.match(pageOf(html, 'method'), /<span class="sec-num">04<\/span>/);
  assert.doesNotMatch(pageOf(html, 'toc'), /data-toc-target="market"/);
  assert.match(pageOf(html, 'result'), />7\.1 /);
  assert.doesNotMatch(pageOf(html, 'result'), />8\.1 /);
});

test('optional blocks can be hidden: letter, sensitivity, cards, glossary', () => {
  const st = fresh();
  st.design = { sections: { letter: false, sensitivity: false, cards: false, glossary: false } };
  const html = Report.render(st, MCA.compute(st));
  assert.doesNotMatch(html, /class="letter"/);
  assert.doesNotMatch(html, /class="sens-grid"/);
  assert.equal(pageOf(html, 'cards'), '');
  assert.doesNotMatch(html, /class="glossary"/);
  assert.match(pageOf(html, 'toc'), /class="toc"/);
});

test('custom chapters are inserted, numbered, paginated on --- and listed in the TOC', () => {
  const st = fresh();
  st.customSections = [{ id: 'cs1', enabled: true, after: 'location', title: { es: 'Urbanismo', it: 'Urbanistica' }, kicker: '', body: { es: 'Texto **clave**\n\n## Normativa\n\n- uno\n- dos\n\n---\n\nSegunda página' } }];
  const html = Report.render(st, MCA.compute(st));
  const pages = html.split('<section ').filter((p) => /data-sections="[^"]*custom-cs1/.test(p));
  assert.equal(pages.length, 2);
  assert.match(pages[0], /<span class="sec-num">03<\/span>/);
  assert.match(pages[0], /Urbanismo/);
  assert.match(pages[0], /<strong>clave<\/strong>/);
  assert.match(pages[0], /<li>uno<\/li>/);
  assert.match(pages[0], /<h3 class="h3">Normativa<\/h3>/);
  assert.match(pages[1], /Segunda página/);
  assert.match(pageOf(html, 'description'), /<span class="sec-num">04<\/span>/);
  assert.match(pageOf(html, 'toc'), /data-toc-target="custom-cs1"/);
  st.customSections[0].enabled = false;
  assert.doesNotMatch(Report.render(st, MCA.compute(st)), /custom-cs1/);
});

test('fit factors measured in the browser are baked into the page bodies', () => {
  const st = fresh();
  const html = Report.render(st, MCA.compute(st), { fit: { 5: 0.912 } });
  assert.match(html, /data-page="5"[^>]*>[\s\S]*?<div class="pg-body" style="--fit:0\.912">/);
  assert.equal(count(html, /--fit:/g), 1);
  assert.equal(typeof Report.fitPages, 'function');
});

test('watermark, custom footer and page numbers follow the design options', () => {
  const st = fresh();
  st.design = { watermark: 'draft', footerNote: { es: 'Uso interno' }, pageNumbers: false };
  const html = Report.render(st, MCA.compute(st));
  assert.equal(count(html, /class="watermark"/g), count(html, /<section /g));
  assert.match(html, /BORRADOR/);
  assert.match(html, /Uso interno/);
  assert.doesNotMatch(html, /class="pg-num"/);
  st.meta.reportLang = 'it';
  assert.match(Report.render(st, MCA.compute(st)), /BOZZA/);
});

test('advisor signature image is printed only when it is a safe raster image', () => {
  const st = fresh();
  st.meta.advisor.signature = PNG;
  assert.match(pageOf(Report.render(st, MCA.compute(st)), 'certification'), /<img class="sign-img" src="data:image\/png;base64,/);
  st.meta.advisor.signature = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
  assert.doesNotMatch(Report.render(st, MCA.compute(st)), /sign-img/);
});

test('uncertainty chapter shows Monte Carlo percentiles and leave-one-out, and can be switched off', () => {
  const st = fresh();
  const html = Report.render(st, MCA.compute(st));
  const pg = pageOf(html, 'uncertainty');
  assert.ok(pg, 'uncertainty page present by default');
  assert.match(pg, /P10/);
  assert.match(pg, /P90/);
  assert.match(pg, /<svg/);
  assert.match(pg, /T1/);
  assert.doesNotMatch(noData(pg), /NaN|undefined/);
  st.design = { sections: { uncertainty: false } };
  assert.equal(pageOf(Report.render(st, MCA.compute(st)), 'uncertainty'), '');
});

test('cover styles: the pattern cover (formerly gradient and solid) replaces the map', () => {
  const st = fresh();
  st.design = { coverStyle: 'gradient' };
  const cover = pageOf(Report.render(st, MCA.compute(st)), 'cover');
  assert.match(cover, /cv-bg-gradient cv-shape-linear cv-shade-frame cv-motif-lines/);
  assert.doesNotMatch(cover, /class="map/);
  st.design = { coverStyle: 'solid' };
  assert.match(pageOf(Report.render(st, MCA.compute(st)), 'cover'), /cv-bg-solid cv-shape-linear cv-shade-frame cv-motif-lines/);
  st.design = { coverStyle: 'pattern', cover: { pattern: 'grid', fill: 'gradient' } };
  assert.match(pageOf(Report.render(st, MCA.compute(st)), 'cover'), /cv-bg-gradient cv-shape-radial cv-shade-frame cv-motif-grid/);
});

test('documentHtml adds the auto-fit script only when asked', () => {
  assert.doesNotMatch(Report.documentHtml('<section></section>', '', 't', 'es'), /<script/);
  assert.match(Report.documentHtml('<section></section>', '', 't', 'es', { autoFit: true }), /<script>[\s\S]*fitPages/);
});

test('cover gallery: every cover style renders its own cover page', () => {
  assert.equal(Report.COVER_STYLES.length, 4);
  for (const style of Report.COVER_STYLES) {
    const st = fresh();
    st.design = { coverStyle: style };
    const cover = pageOf(Report.render(st, MCA.compute(st)), 'cover');
    const bg = { map: 'cv-bg-map', photo: 'cv-bg-photo', pattern: 'cv-bg-gradient', minimal: 'cv-bg-solid' }[style];
    assert.ok(cover.includes(`page--cover ${bg}`), style);
    assert.doesNotMatch(cover.replace(/data:[^"]+/g, ''), /undefined|NaN/, style);
  }
});

test('custom cover image: used by the photo covers, ignored by the graphic ones, dropped when unsafe', () => {
  const img = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const st = fresh();
  st.design = { coverStyle: 'fullbleed', coverImage: img };
  assert.match(pageOf(Report.render(st, MCA.compute(st)), 'cover'), /class="cover-photo" src="data:image\/jpeg/);
  st.design = { coverStyle: 'gradient', coverImage: img };
  assert.doesNotMatch(pageOf(Report.render(st, MCA.compute(st)), 'cover'), /cover-photo/);
  st.design = { coverStyle: 'fullbleed', coverImage: 'javascript:alert(1)' };
  assert.doesNotMatch(pageOf(Report.render(st, MCA.compute(st)), 'cover'), /javascript:/);
});

test('document checks: the report adds a page with what was verified and the recommended checks', () => {
  const st = fresh();
  st.meta.reportLang = 'it';
  st.checks = [{ topic: 'title', status: 'not_verified' }, { topic: 'cadastral', status: 'verified', source: 'Certificado catastral', date: '2026-11-10' }];
  const html = Report.render(st, MCA.compute(st));
  assert.match(html, /Verifiche documentali/);
  assert.match(html, /Certificado catastral/);
  assert.match(html, /class="cr-box"/);
  const none = fresh();
  none.checks = [];
  assert.doesNotMatch(Report.render(none, MCA.compute(none)), /class="cr-box"/);
});

test('AI use statement: the declaration page says how AI was used', () => {
  const st = fresh();
  st.meta.reportLang = 'it';
  st.aiLog = [{ id: 'a', at: '2026-11-23T10:00:00Z', status: 'accepted', provider: 'Anthropic', changes: [{ path: 'subject.yearBuilt', kind: 'value', before: null, after: 1999, state: 'accepted' }] }];
  const html = Report.render(st, MCA.compute(st));
  assert.match(html, /class="ai-use"/);
  assert.match(html, /Anthropic/);
  const none = fresh();
  none.aiLog = [];
  assert.doesNotMatch(Report.render(none, MCA.compute(none)), /class="ai-use"/);
});

test('country packs: an Italian property gets Italian documents and no Spanish references', () => {
  const st = fresh();
  st.meta.reportLang = 'it';
  st.meta.country = 'IT';
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('Ispezioni ipotecarie'));
  for (const s of ['Sede Electrónica del Catastro', 'ECO/805', 'RD 390']) assert.ok(!html.includes(s), s);
  assert.ok(html.includes('UNI 11612'), 'Italian national standard');
});

test('country packs: a Swiss property shows its amounts in Swiss francs', () => {
  const st = fresh();
  st.meta.reportLang = 'en';
  st.meta.country = 'CH';
  st.market.references = [];
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('CHF'));
  assert.ok(html.includes('Swiss francs'));
  assert.ok(!html.replace(/data:[^"]+/g, '').includes('€'));
  I18N.setCurrency('EUR');
});

test('country packs: a Spanish property keeps the Spanish references', () => {
  const st = fresh();
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('Orden ECO/805/2003'));
  assert.ok(html.includes('Nota simple del Registro de la Propiedad'));
});

test('country packs: value note, map and map credit follow the country', () => {
  const st = fresh();
  st.meta.reportLang = 'en';
  st.meta.country = 'CH';
  st.subject.lat = 47.3769;
  st.subject.lon = 8.5417;
  const html = Report.render(st, MCA.compute(st));
  assert.ok(html.includes('expressed in Swiss francs'), 'value note in Swiss francs');
  assert.ok(!html.includes('ign.es/wmts'), 'no Spanish map tiles outside Spain');
  assert.ok(!html.includes('Instituto Geográfico Nacional'), 'no Spanish map credit outside Spain');
  st.meta.reportLang = 'it';
  assert.ok(Report.render(st, MCA.compute(st)).includes('espresso in franchi svizzeri'), 'it');
  st.meta.reportLang = 'es';
  assert.ok(Report.render(st, MCA.compute(st)).includes('expresa en francos suizos'), 'es');
  I18N.setCurrency('EUR');
  const es = fresh();
  const h2 = Report.render(es, MCA.compute(es));
  assert.ok(h2.includes('Instituto Geográfico Nacional'), 'the Spanish sample keeps its map credit');
  assert.ok(h2.includes('se expresa en euros'));
});

test('country packs: the nature of the report makes no claim about who may value in each country', () => {
  const ch = fresh();
  ch.meta.reportLang = 'en';
  ch.meta.country = 'CH';
  const h = Report.render(ch, MCA.compute(ch));
  assert.ok(h.includes('<strong>It is not an official appraisal</strong> and is not valid for mortgage, court or tax purposes.'), 'neutral outside Spain');
  // The nature paragraph names no body; the Swiss Bankers Association may appear only among the methodological references.
  const nature = (/<div class="callout callout--warn"><strong>1\.5 Nature of the report\.<\/strong>[^]*?<\/div>/.exec(h) || [''])[0];
  assert.ok(nature.length > 50, 'nature paragraph found');
  for (const s of ['reserved to', 'Swiss Bankers']) assert.ok(!nature.includes(s), s);
  assert.ok(!h.includes('reserved to'), 'reserved to');
  I18N.setCurrency('EUR');
  const it = fresh();
  it.meta.reportLang = 'it';
  it.meta.country = 'IT';
  const hi = Report.render(it, MCA.compute(it));
  assert.ok(hi.includes('<strong>Non costituisce una perizia ufficiale</strong> e non è valido a fini ipotecari, giudiziari o fiscali.'), 'it');
  assert.ok(!hi.includes('riservate a'));
  const es = Report.render(fresh(), MCA.compute(fresh()));
  assert.ok(es.includes('conforme a la Orden ECO/805/2003, emitida por sociedades de tasación inscritas en el Banco de España, y no es válido para fines hipotecarios, judiciales ni fiscales.'), 'es');
});

test('country packs: assumptions name only checks that fit the country', () => {
  const at = (cc, lang) => { const st = fresh(); st.meta.country = cc; st.meta.reportLang = lang; const a = Report.autoTexts(st, MCA.compute(st)); I18N.setCurrency('EUR'); return a.hypotheses; };
  const ch = at('CH', 'en');
  assert.ok(!ch.includes('normally required'), 'no energy duty claimed outside Spain');
  assert.ok(!ch.includes('(Lex Koller'), 'Lex Koller is not a planning document');
  assert.ok(ch.includes('(GEAK / CECB)'), 'Swiss energy certificate named');
  const it = at('IT', 'it');
  assert.ok(it.includes('(Stato legittimo urbanistico · conformità catastale)'));
  assert.ok(!it.includes('di norma richiesto'));
  const es = at('ES', 'es');
  assert.ok(es.includes('(Certificado catastral · cédula de habitabilidad)'));
  assert.ok(es.includes('suele exigirse antes de publicitar la venta (RD 390/2021)'));
});

test('country packs: the checks page names no non-planning document for planning', () => {
  const ch = fresh();
  ch.meta.country = 'CH';
  ch.meta.reportLang = 'en';
  ch.checks = [{ topic: 'title', status: 'verified' }, { topic: 'planning', status: 'not_verified' }];
  const h = Report.render(ch, MCA.compute(ch));
  I18N.setCurrency('EUR');
  assert.ok(h.includes('class="cr-box"'));
  assert.ok(!h.includes('Lex Koller'));
});

test('maps: once outside maps are allowed, the report uses the base map of the country with its credit', () => {
  require('../src/js/maps.js').setAllowed(true);
  try { mapsOfCountries(); } finally { require('../src/js/maps.js').setAllowed(false); }
});
function mapsOfCountries() {
  const it = fresh();
  it.meta.country = 'IT';
  it.meta.reportLang = 'it';
  it.subject.lat = 45.2975;
  it.subject.lon = 12.0367;
  const h = Report.render(it, MCA.compute(it));
  assert.ok(h.includes('sgx.geodatenzentrum.de') && h.includes('© BKG'), 'European street map by default');
  assert.ok(!h.includes('ign.es'), 'no Spanish tiles');
  it.map = { base: 'it-cadastre' };
  const hk = Report.render(it, MCA.compute(it));
  assert.ok(hk.includes('wms.cartografia.agenziaentrate.gov.it'), 'Italian cadastral map when chosen');
  assert.ok(hk.includes('© Agenzia delle Entrate'), 'its credit');
  const ch = fresh();
  ch.meta.country = 'CH';
  ch.subject.lat = 46.948;
  ch.subject.lon = 7.4474;
  const hc = Report.render(ch, MCA.compute(ch));
  assert.ok(hc.includes('wmts.geo.admin.ch') && hc.includes('© swisstopo'), 'Swiss map and credit');
  I18N.setCurrency('EUR');
}

test('maps: a valuation without coordinates draws no map', () => {
  const st = fresh();
  st.subject.lat = null;
  st.subject.lon = null;
  const h = Report.render(st, MCA.compute(st));
  assert.ok(!h.includes('ign.es/wmts'), 'no tiles requested');
  assert.equal(count(h, /<svg class="map /g), 0, 'no map drawn at 0,0');
});

test('wording follows the property type: an office is not a dwelling', () => {
  const st = fresh();
  st.subject.propertyType = { code: 'OFF.OFFICE_UNIT', description: '' };
  const want = {
    it: ['<em>dell’ufficio</em>', 'Valore unitario dell’ufficio', '3.3 L’ufficio', 'ufficio senza pertinenze', 'Valore dell’ufficio', 'Vani · servizi'],
    es: ['<em>de la oficina</em>', 'Valor unitario de la oficina', '3.3 La oficina', 'oficina sin anejos', 'Valor de la oficina', 'Estancias · aseos'],
    en: ['<em>of the office</em>', 'Unit value of the office', '3.3 The office', 'office excluding annexes', 'Value of the office', 'Rooms · WCs'],
  };
  for (const lang of Object.keys(want)) {
    st.meta.reportLang = lang;
    const h = Report.render(st, MCA.compute(st));
    for (const w of want[lang]) assert.ok(h.includes(w), `${lang}: ${w}`);
  }
  const home = fresh();
  home.meta.reportLang = 'it';
  assert.ok(Report.render(home, MCA.compute(home)).includes('<em>dell’abitazione</em>'), 'a flat stays a dwelling');
});

test('covers: four styles, older styles shown with the closest one', () => {
  assert.deepEqual(Report.COVER_STYLES, ['map', 'photo', 'pattern', 'minimal']);
  const st = fresh();
  st.design.coverStyle = 'blueprint';
  assert.ok(Report.render(st, MCA.compute(st)).includes('cv-bg-solid cv-shape-linear cv-shade-frame cv-motif-grid'), 'blueprint → pattern (grid, solid)');
  st.design.coverStyle = 'editorial';
  assert.ok(Report.render(st, MCA.compute(st)).includes('page--cover cv-bg-photo'), 'editorial → photo');
});

test('cover editor: own texts per language and optional blocks', () => {
  const st = fresh();
  st.meta.reportLang = 'it';
  st.design.cover = { kicker: { it: 'Relazione di stima' }, title: { it: 'Stima del valore' }, titleEm: { it: 'per la vendita' }, foot: { it: 'Riservato' }, showPanel: false };
  const h = Report.render(st, MCA.compute(st));
  for (const w of ['Relazione di stima', 'Stima del valore', '<em>per la vendita</em>', 'Riservato']) assert.ok(h.includes(w), w);
  assert.ok(!h.includes('class="cover-panel"'), 'panel hidden');
  st.meta.reportLang = 'en';
  assert.ok(Report.render(st, MCA.compute(st)).includes('Market value'), 'other languages keep the automatic texts');
});

test('technical page: energy, seismic and installations with their documents', () => {
  const st = fresh();
  st.meta.reportLang = 'it';
  st.meta.country = 'IT';
  st.technical = { energy: { class: 'B', ep: 72.4, issued: '2024-03-01', validUntil: '2034-03-01', code: 'VE-123' }, seismic: { zone: '3', riskClass: 'C', structure: 'rc', year: 1998 },
    systems: { heating: { status: 'dico', date: '2019-05-02', by: 'Impianti Esempio' }, electrical: { status: 'diri' } }, deductions: [{ label: 'Adeguamento impianto elettrico', amount: 2500 }] };
  st.attachments = [{ id: 'a1', topic: 'energy', kind: 'ape', title: 'APE 2024', name: 'ape.pdf', mime: 'application/pdf', size: 1000, dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
    issuer: 'Ing. Esempio', date: '2024-03-01', ref: 'VE-123', include: true, sha256: 'ab'.repeat(32) },
  { id: 'a2', topic: 'installations', kind: 'dico', title: 'DiCo caldaia', name: 'dico.png', mime: 'image/png', size: 10, dataUrl: 'data:image/png;base64,iVBORw0KGgo=', include: true, sha256: 'cd'.repeat(32) }];
  const h = Report.render(st, MCA.compute(st));
  for (const w of ['Aspetti tecnici', 'Prestazione energetica', 'class="ecl on"', 'Zona sismica', 'Dichiarazione di conformità (DiCo)', 'Dichiarazione di rispondenza (DiRi)',
    'Adeguamento impianto elettrico', 'Allegati', 'APE 2024', 'abababababab', 'DiCo caldaia', 'data:image/png;base64,iVBORw0KGgo=']) assert.ok(h.includes(w), w);
  const none = fresh();
  none.technical = {};
  none.attachments = [];
  const hn = Report.render(none, MCA.compute(none));
  assert.ok(!hn.includes('class="tech'), 'no technical page without data');
});

test('other approaches: a page with each approach and the reconciliation', () => {
  const st = fresh();
  st.meta.reportLang = 'it';
  st.approaches = { income: { on: true, rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 5 }, weights: { market: 60, income: 40 } };
  const h = Report.render(st, MCA.compute(st));
  for (const w of ['Altri metodi e riconciliazione', 'Capitalizzazione del reddito', 'Reddito netto', 'Valore riconciliato', '60%', '40%']) assert.ok(h.includes(w), w);
  assert.ok(h.includes('Confronto di mercato · Capitalizzazione del reddito'), 'cover line names the approaches');
  const plain = fresh();
  assert.ok(!Report.render(plain, MCA.compute(plain)).includes('class="ap-'), 'no page without other approaches');
});

test('report language packs: each renders in its own language, without English leftovers', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const RI = require('../src/js/report_i18n.js');
  const packs = fs.readdirSync(path.join(__dirname, '..', 'src', 'js', 'lang')).map((f) => (/^report\.([a-z]{2})\.js$/.exec(f) || [])[1]).filter(Boolean);
  assert.ok(packs.length >= 1);
  for (const l of packs) {
    assert.ok(RI[l], `${l} loaded`);
    const st = fresh();
    st.meta.reportLang = l;
    st.technical = { energy: { class: 'C' } };
    st.checks = [{ topic: 'title', status: 'verified' }, { topic: 'energy', status: 'not_verified' }];
    const h = Report.render(st, MCA.compute(st)).replace(/data:[^"]+/g, '');
    assert.ok(h.includes(`lang="${l}"`), `${l}: lang attribute`);
    for (const en of ['Property valuation report', 'Most probable market value', 'Assumptions, limitations and sources', 'Document checks', 'Location and surroundings']) assert.ok(!h.includes(en), `${l}: "${en}" left in English`);
    assert.doesNotMatch(h, /undefined|NaN|\[object Object\]/, l);
  }
});

test('report stylesheet keeps the page layout and the style of every section', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src', 'css', 'report.css'), 'utf8');
  for (const rule of ['@page', '.page--cover', '.cv-bg-photo', '.cv-bg-gradient', '.cv-motif-band', '.cv-txt-dark', '.cv-shade-frame', '.checks-rep', '.ai-use', '.tech .h2', '.annex-t', '.annex-img', '.ap-grid'])
    assert.ok(css.includes(rule), `report.css lost ${rule}`);
  assert.ok(css.split('\n').length > 400, 'report.css looks truncated');
});

test('letter greeting: a language can build it around the surname (Hungarian title after the name)', () => {
  const st = fresh();
  st.meta.client = Object.assign({}, st.meta.client || {}, { name: 'Sr. Péter Kovács' });
  st.meta.reportLang = 'hu';
  const h = Report.render(st, MCA.compute(st));
  assert.ok(h.includes('Tisztelt Kovács úr!'), 'surname before the title');
  assert.ok(!h.includes('Tisztelt Uram Kovács'), 'no title before the surname');
});

test('letter greeting in Chinese: surname then title, full-width colon', () => {
  const st = fresh();
  st.meta.client = Object.assign({}, st.meta.client || {}, { name: 'Sr. Wei Wang' });
  st.meta.reportLang = 'zh';
  const h = Report.render(st, MCA.compute(st));
  assert.ok(h.includes('尊敬的Wang先生：'), 'Chinese salutation');
});

test('report language packs translate every English text (proper names of Spanish bodies excepted)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const RI = require('../src/js/report_i18n.js');
  const SAME = new Set(['mvCite', 'catSource', 'catastro']);
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const missing = (base, pack, pre, out) => {
    Object.keys(base).forEach((k) => {
      const p = pre ? `${pre}.${k}` : k;
      if (!pre && SAME.has(k)) return;
      if (!(k in (pack || {}))) out.push(p);
      else if (isObj(base[k]) && isObj(pack[k])) missing(base[k], pack[k], p, out);
      else if (Array.isArray(base[k]) && (!Array.isArray(pack[k]) || pack[k].length !== base[k].length)) out.push(`${p} (length)`);
      else if (typeof base[k] === 'function' && typeof pack[k] !== 'function') out.push(`${p} (function)`);
    });
    return out;
  };
  const dir = path.join(__dirname, '..', 'src', 'js', 'lang');
  const codes = fs.readdirSync(dir).map((f) => (/^report\.([a-z]{2})\.js$/.exec(f) || [])[1]).filter(Boolean);
  assert.equal(codes.length, 14, 'fourteen packs besides en, es, it');
  for (const c of codes) {
    let raw = null;
    require(path.join(dir, `report.${c}.js`))({ extend: (code, p) => { raw = p; } });
    assert.deepEqual(missing(RI.en, raw, '', []), [], `${c}: untranslated keys`);
  }
});

test('cadastral data: the Spanish source and the 20-character split apply only to Spanish references', () => {
  const st = fresh();
  st.meta.country = 'IT';
  st.meta.reportLang = 'it';
  st.subject.cadastralParcel = 'Foglio 12, particella 345';
  st.subject.cadastralRef = 'Fg. 12 Part. 345 Sub. 6';
  st.subject.cadastralRefAlt = '';
  const h = Report.render(st, MCA.compute(st));
  const i = h.indexOf('3.9 Dati catastali');
  assert.ok(i > 0, 'cadastral section present');
  const cat = h.slice(i, i + 1600);
  assert.ok(!cat.includes('Sede Electrónica del Catastro'), 'no Spanish source for an Italian property');
  assert.ok(cat.includes('Fg. 12 Part. 345 Sub. 6'), 'the Italian reference is shown whole');
  const es = fresh();
  assert.ok(Report.render(es, MCA.compute(es)).includes('Sede Electrónica del Catastro'), 'Spanish properties keep the source');
});

test('charts follow the report language for numbers and the currency position', () => {
  try {
    Charts.setCurrency('€');
    Charts.setLocale('de');
    assert.equal(Charts.fmt(4572.5, 1), '4.572,5');
    assert.equal(Charts.money(1000), '1.000 €');
    Charts.setLocale('zh');
    assert.equal(Charts.fmt(4572.5, 1), '4,572.5');
    Charts.setLocale('ru');
    assert.match(Charts.fmt(4572.5, 1), /^4\s572,5$/);
    Charts.setLocale('fr');
    assert.match(Charts.fmt(-4572, 0), /^−4\s572$/);
    Charts.setLocale('nl');
    assert.equal(Charts.money(1000), '€1.000');
  } finally { Charts.setLocale('es'); }
});

test('cover: a custom cover text applies only to the language it was written in', () => {
  const st = fresh();
  st.design = Object.assign({}, st.design, { cover: Object.assign({}, (st.design || {}).cover, { titleEm: { it: 'dello studio professionale' } }) });
  st.meta.reportLang = 'it';
  assert.ok(Report.render(st, MCA.compute(st)).includes('dello studio professionale'), 'used in Italian');
  st.meta.reportLang = 'zh';
  assert.ok(!Report.render(st, MCA.compute(st)).includes('dello studio professionale'), 'not used in Chinese');
  st.design.cover.titleEm = 'plain text';
  assert.ok(Report.render(st, MCA.compute(st)).includes('plain text'), 'a plain string applies to every language');
});


test('absurd coordinates never hang the report or its maps (child process, time and memory limits)', () => {
  const { spawnSync } = require('node:child_process');
  const path = require('node:path');
  const js = path.join(__dirname, '..', 'src', 'js');
  const code = `const p=require('path');const R=(f)=>require(p.join(${JSON.stringify(js)},f));
global.MCA=R('engine.js');global.Charts=R('charts.js');global.ASSETS=R('assets.js');const Report=R('report.js');
const st=JSON.parse(JSON.stringify(R('data.js')));st.subject.lon=-1e15;st.comparables[0].lat=1e300;st.subject.pois=[{name:'x',lat:41.3,lon:1e18}];
Report.render(st,MCA.compute(st));
const m=Charts.map({z:16,center:[45,1e300],w:840,h:560},[],{provider:{tile:(z,x,y)=>'t'+x}});
console.log('ok',m.length);`;
  const r = spawnSync(process.execPath, ['--max-old-space-size=256', '-e', code], { timeout: 30000, encoding: 'utf8' });
  assert.ok(!r.error, 'timed out');
  assert.equal(r.status, 0, (r.stderr || '').slice(-300));
  assert.match(r.stdout, /^ok /);
});


// ---------- no empty-value words in the report text ----------
const visibleText = (html) => noData(html).replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const BAD_WORDS = /\b(undefined|NaN)\b|Infinity|\[object Object\]|Invalid Date/;
const badAt = (t, re) => { const m = t.match(re); return m ? `…${t.slice(Math.max(0, m.index - 70), m.index + 25)}…` : ''; };

test('emptied fields never print null, undefined or NaN, in any report language', () => {
  const LANGS17 = require('../src/js/i18n.js').LANGS;
  for (const lang of LANGS17) {
    for (const v of [null, '']) {
      const st = fresh();
      st.meta.reportLang = lang;
      ['bathrooms', 'yearBuilt', 'floor', 'address', 'floorDoor', 'orientation', 'condition', 'zone'].forEach((k) => { st.subject[k] = v; });
      st.subject.bedrooms = 4;
      st.comparables.forEach((c) => ['bathrooms', 'bedrooms', 'yearBuilt', 'floor', 'date', 'address', 'source', 'condition'].forEach((k) => { c[k] = v; }));
      const t = visibleText(Report.render(st, MCA.compute(st)));
      const re = ['de', 'nb'].includes(lang) ? BAD_WORDS : new RegExp(`\\bnull\\b|${BAD_WORDS.source}`);   // "null" is a word in German and Norwegian
      assert.equal(badAt(t, re), '', `${lang}, fields set to ${JSON.stringify(v)}`);
    }
  }
});

test('dirty data (text, lists, objects, non-finite numbers) never reaches the report text: 60 seeded cases', () => {
  let seed = 4242;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const JUNK = [null, undefined, '', 'abc', '  ', -1, 0, NaN, Infinity, -Infinity, '12e3', [], {}, true, 3.7, '1.234,5'];
  const SUBJ = ['areaBuilt', 'areaBuiltCommon', 'terraceM2', 'galleryM2', 'floor', 'bedrooms', 'bathrooms', 'yearBuilt', 'lat', 'lon', 'parking',
    'storage', 'orientation', 'condition', 'elevator', 'address', 'zone', 'communityFee', 'neighbours'];
  const COMP = ['price', 'areaBuilt', 'areaUseful', 'negotiation', 'date', 'floor', 'bedrooms', 'bathrooms', 'yearBuilt', 'source', 'address', 'zone', 'parking', 'storage'];
  const LANGS = ['en', 'es', 'it', 'fr', 'pt', 'pl', 'cs', 'ru', 'zh'];
  for (let i = 0; i < 60; i++) {
    const st = fresh();
    st.meta.reportLang = LANGS[i % LANGS.length];
    const muts = [];
    for (let k = 0; k < 5; k++) { const key = pick(SUBJ), v = pick(JUNK); st.subject[key] = v; muts.push(`s.${key}=${String(v)}`); }
    st.comparables.forEach((c, j) => { if (rnd() < 0.6) { const key = pick(COMP), v = pick(JUNK); c[key] = v; muts.push(`c${j}.${key}=${String(v)}`); } });
    const t = visibleText(Report.render(st, MCA.compute(st)));
    assert.equal(badAt(t, new RegExp(`\\bnull\\b|${BAD_WORDS.source}`)), '', `case ${i} (${st.meta.reportLang}; ${muts.join(', ')})`);
  }
});


test('draft languages never fall back to English for the tagline, the property type, the default purpose or the reserved-valuers clause', () => {
  const I18N = require('../src/js/i18n.js');
  const EN = ['Property valuation with the sales comparison approach', 'Estimate of the market value of the property', 'registered with the Banco de España'];
  for (const lang of I18N.DRAFT) {
    const st = fresh();
    st.meta.reportLang = lang;
    const res = MCA.compute(st);
    const t = visibleText(Report.render(st, res));
    EN.forEach((en) => assert.ok(!t.includes(en), `${lang}: "${en}"`));
    assert.ok(!/\bApartment\b/.test(t), `${lang}: property type in English`);
    const purpose = Report.autoTexts(st, res).purpose;
    assert.ok(purpose && purpose.length > 10 && !/market value/.test(purpose), `${lang}: purpose "${purpose}"`);
  }
});


test('without the choice to load outside map tiles the report loads nothing from outside; with it, the national service', () => {
  const MapsM = require('../src/js/maps.js');
  const loaded = (html) => noData(html).match(/<(?:image|img)\b[^>]*?(?:href|src)="https?:\/\/[^"]*"/g) || [];
  const st = fresh();
  st.meta.reportLang = 'en';
  st.subject.lat = 40.4168; st.subject.lon = -3.7038;   // away from the embedded demo maps
  try {
    MapsM.setAllowed(false);
    assert.deepEqual(loaded(Report.render(st, MCA.compute(st))), []);
    MapsM.setAllowed(true);
    const on = loaded(Report.render(st, MCA.compute(st)));
    assert.ok(on.length > 0 && on.every((u) => /ign\.es/.test(u)), on.slice(0, 2).join(' '));
  } finally { MapsM.setAllowed(false); }
});

test('Charts.map draws no outside tiles unless a map service is given', () => {
  const svg = Charts.map({ z: 15, center: [40.4168, -3.7038], w: 400, h: 300 }, [], {});
  assert.ok(!/(?:href|src)="https?:\/\//.test(svg));
});

test('exported reports carry their map images inside the file: no outside address remains, links stay', async () => {
  const html = '<svg><image href="https://tiles.example.org/a?x=1&amp;y=2" x="0"/><image href="https://tiles.example.org/b.png"/></svg><img src="https://tiles.example.org/c.png" alt=""><a href="https://example.org">link</a>';
  const seen = [];
  const out = await Report.inlineImages(html, async (u) => { seen.push(u); return u.endsWith('b.png') ? null : 'data:image/png;base64,AAAA'; });
  assert.ok(!/<(?:image|img)\b[^>]*?(?:href|src)="https?:/.test(out), out);
  assert.equal((out.match(/data:image\/png;base64,AAAA/g) || []).length, 2);
  assert.match(out, /<a href="https:\/\/example.org">/);
  assert.deepEqual(seen.sort(), ['https://tiles.example.org/a?x=1&y=2', 'https://tiles.example.org/b.png', 'https://tiles.example.org/c.png']);
});


test('stylesheets: small text colors meet WCAG AA contrast (4.5:1) on white and on the app background', () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'css', 'app.css'), 'utf8');
  const rep = fs.readFileSync(path.join(__dirname, '..', 'src', 'css', 'report.css'), 'utf8');
  const lum = (hex) => {
    const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const tok = (name) => (css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];
  const bg = tok('ui-bg');
  for (const name of ['ui-muted', 'ui-faint']) {
    const c = tok(name);
    assert.ok(ratio(c, '#FFFFFF') >= 4.5 && ratio(c, bg) >= 4.5, `${name} ${c}: ${ratio(c, '#FFFFFF').toFixed(2)} on white, ${ratio(c, bg).toFixed(2)} on the background`);
  }
  const lv0 = (css.match(/\.lv0 \{ color: ([^;]+);/) || [])[1];
  assert.ok(lv0 === 'var(--ui-faint)' || ratio(lv0, '#FFFFFF') >= 4.5, `.lv0 ${lv0}`);
  const lvlz = (rep.match(/\.lvlz \{ color: (#[0-9A-Fa-f]{6});/) || [])[1];
  assert.ok(ratio(lvlz, '#FFFFFF') >= 4.5, `.lvlz ${lvlz}: ${ratio(lvlz, '#FFFFFF').toFixed(2)}`);
});

test('the neutral Valesta profile shows the Valesta logo when the app provides it; other agencies keep their own', () => {
  const st = fresh();
  st.brand = Object.assign({}, st.brand, { profileId: 'valesta', logoMode: 'text', name: 'Valesta' });
  try {
    global.VALESTA_LOGO = { light: 'data:image/svg+xml;base64,TElHSFQ=', dark: 'data:image/svg+xml;base64,REFSSw==' };
    const html = Report.render(st, MCA.compute(st));
    assert.ok(html.includes('src="data:image/svg+xml;base64,TElHSFQ="'), 'logo on light');
    assert.ok(html.includes('src="data:image/svg+xml;base64,REFSSw=="'), 'logo on dark');
    const other = fresh();
    other.brand = Object.assign({}, other.brand, { profileId: 'agency-x', logoMode: 'text', name: 'Agenzia Esempio' });
    const h2 = Report.render(other, MCA.compute(other));
    assert.ok(!h2.includes('TElHSFQ=') && h2.includes('Agenzia Esempio'));
  } finally { delete global.VALESTA_LOGO; }
});

test('report file names have a title in every report language, plain ASCII', () => {
  const I18N = require('../src/js/i18n.js');
  for (const l of I18N.LANGS) assert.match(Report.fileTitle(l), /^[A-Za-z]+(_[A-Za-z]+)*$/, l);
  assert.equal(Report.fileTitle('es'), 'Informe_Valoracion');
  assert.equal(Report.fileTitle('it'), 'Rapporto_Valutazione');
  assert.equal(Report.fileTitle('en'), 'Valuation_Report');
  assert.equal(Report.fileTitle('xx'), 'Valuation_Report');
});

test('the Chinese report embeds Noto Sans SC cut to every Chinese character the report uses', () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'css', 'fonts-cjk.css'), 'utf8');
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) || [];
  assert.equal(faces.length, 2);
  assert.ok(faces.every((f) => /font-family:\s*'Noto Sans SC'/.test(f) && /format\('woff2'\)/.test(f) && /unicode-range:/.test(f)));
  assert.deepEqual(faces.map((f) => +(/font-weight:\s*(\d+)/.exec(f) || [])[1]).sort(), [400, 700]);
  const ranges = (/unicode-range:\s*([^;]+);/.exec(faces[0]) || [])[1].split(',').map((r) => r.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16)));
  const covered = (cp) => ranges.some(([a, b]) => cp >= a && cp <= (b == null ? a : b));
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'lang', 'report.zh.js'), 'utf8');
  const missing = [...new Set([...src].filter((ch) => /[\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF]/.test(ch)))].filter((ch) => !covered(ch.codePointAt(0)));
  assert.deepEqual(missing, [], 'run tools/subset_cjk.py again');
  const st = fresh();
  st.meta.reportLang = 'zh';
  assert.ok(Report.usedFonts(st).includes('Noto Sans SC'));
  st.meta.reportLang = 'en';
  assert.ok(!Report.usedFonts(st).includes('Noto Sans SC'));
  assert.match(Report.FONT_STACKS.Inter, /'Noto Sans SC'/);
});

test('maps colour their tiles with blend overlays, not SVG filters, so PDFs keep the tiles as JPEG (lighter files)', () => {
  const tile = { tile: (z, x, y) => `https://tiles.example.org/${z}/${x}/${y}.jpg` };
  const plain = Charts.map({ z: 15, center: [41.27, 1.97], w: 400, h: 300 }, [], { provider: tile, saturate: 0.3 });
  const duo = Charts.map({ z: 15, center: [41.27, 1.97], w: 400, h: 300 }, [], { provider: tile, duotone: true, duo: ['#0B4F47', '#5BE3B0'] });
  for (const svg of [plain, duo]) {
    assert.ok(!/<filter\b|filter="url\(/.test(svg), 'no SVG filter');
    assert.match(svg, /mix-blend-mode:saturation/);
    assert.match(svg, /isolation:isolate/);
  }
  assert.match(duo, /fill="#5BE3B0" style="mix-blend-mode:multiply"/i);
  assert.match(duo, /fill="#0B4F47" style="mix-blend-mode:screen"/i);
});

// ---- Valesta 1.1: report computations (docs/methodology/6-code-findings.md) ----
const withIncome = (s) => {
  s.technical = { deductions: [{ label: 'Boiler certificate', amount: 3000 }] };
  s.approaches = { income: { on: true, rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 4.5 }, weights: { market: 80, income: 20 } };
  return s;
};

test('F-03: estimator sensitivity rows equal the engine totals, with deductions and another approach', () => {
  const s = withIncome(fresh());
  const res = MCA.compute(s);
  const rows = Report.sensitivityRows(s, res);
  for (const r of rows.est) {
    const t = MCA.compute(Object.assign({}, s, { settings: Object.assign({}, s.settings, { estimator: r.key }) })).total;
    assert.equal(r.t, t, r.key);
  }
  assert.equal(rows.est.find((r) => r.adopted).t, res.total);
});

test('F-08: uncertainty figures are rounded with the valuation rounding step', () => {
  const s = fresh();
  s.settings.rounding = 100000;
  const res = MCA.compute(s);
  const rob = MCA.robustness(s, { n: 100, seed: 3 });
  const k = Report.uncertaintyKpis(s, res, rob);
  for (const v of [k.p10, k.p50, k.p90]) assert.equal(v % 100000, 0);
});

test('F-20: the adjustment table marks overridden coefficients and annex amounts', () => {
  const s = fresh();
  s.meta.reportLang = 'en';
  s.comparables[0].annexOverride = 0;
  s.comparables[1].kOverride = { loc: 1.3 };
  const html = Report.render(s, MCA.compute(s));
  assert.equal(count(html, /class="k ovr"/g), 1);
  assert.equal(count(html, /class="ovr"/g), 1);
  assert.ok(html.includes('set outside the editor'));
});

test('F-14: the approaches page prints the reasoning of the weights', () => {
  const s = withIncome(fresh());
  s.meta.reportLang = 'en';
  s.approaches.reason = 'Rental evidence is thin, so the income approach weighs less.';
  const html = Report.render(s, MCA.compute(s));
  assert.ok(html.includes('Rental evidence is thin, so the income approach weighs less.'));
});

// ---- Valesta 1.1: report texts (en/es/it) ----
const enReport = (mod) => { const s = fresh(); s.meta.reportLang = 'en'; if (mod) mod(s); return Report.render(s, MCA.compute(s)); };

test('D1/F-11: no MCA in en, es and it, and the method has its name', () => {
  for (const lang of ['en', 'es', 'it']) {
    const s = fresh(); s.meta.reportLang = lang;
    assert.ok(!/\bMCA\b/.test(Report.render(s, MCA.compute(s))), lang);
  }
  assert.ok(enReport().includes('Sales comparison with homogenisation coefficients'));
});

test('F-04: the comparables sentence follows the sources', () => {
  const html = enReport((s) => s.comparables.forEach((c) => { c.source = 'registro'; }));
  assert.ok(!/published asking prices/.test(html));
  assert.ok(/transaction prices/.test(html));
});

test('F-05 and F-25: similarity is the complement of the gross adjustment; no unconditional consistency claims', () => {
  const html = enReport();
  assert.ok(!/inverse of the gross adjustment/.test(html));
  assert.ok(/complement of the gross adjustment/.test(html));
  assert.ok(!/confirming the robustness of the estimate/.test(html));
});

test('F-06: the unit price step names the area basis', () => {
  const html = enReport((s) => { s.settings.areaBasis = 'useful'; });
  assert.ok(!/divided by the built area of the comparable/.test(html));
  assert.ok(/usable area of the comparable/.test(html));
});

test('F-10: no unsourced negotiation margin', () => {
  assert.ok(!/5–10%/.test(enReport()));
});

test('F-22: the range is the confidence interval of the estimate', () => {
  const html = enReport();
  assert.ok(!/Value range/.test(html));
  assert.ok(!/reasonable range/.test(html));
  assert.ok(/confidence interval of the estimate/i.test(html));
});

test('F-15: the Spanish useful area excludes exterior spaces', () => {
  assert.ok(!/covered private outdoor space counts at 50%/.test(enReport()));
});

test('F-16: chapters not verified are not cited', () => {
  const html = enReport((s) => { s.approaches = { income: { on: true, rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 4.5 }, weights: { market: 80, income: 20 } }; });
  for (const re of [/IVS 104 \/ RICS VPS 6/, /VPS 2/, /VPS 3/, /VPS 6/, /\(IVS 103\)/, /\(IVS 104\)/]) assert.ok(!re.test(html), String(re));
});

test('F-12: the glossary defines the interval as precision and names the listing price', () => {
  const html = enReport();
  assert.ok(!/contains the mean market unit value/.test(html));
  assert.ok(/<dt>Listing price<\/dt>/.test(html));
});

test('Valesta 1.1: draft report languages name the method, follow the price kind and drop unsourced claims and section numbers', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const RI = require('../src/js/report_i18n.js');
  const dir = path.join(__dirname, '..', 'src', 'js', 'lang');
  const codes = fs.readdirSync(dir).map((f) => (/^report\.([a-z]{2})\.js$/.exec(f) || [])[1]).filter(Boolean);
  assert.equal(codes.length, 14);
  for (const c of codes) {
    // (the list of the IVS standards by title, as in English, stays: only the citations of sections as sources go)
    const src = fs.readFileSync(path.join(dir, `report.${c}.js`), 'utf8').split('\n').filter((l) => !/^\s+\['IVS 2025', /.test(l)).join('\n');
    assert.doesNotMatch(src, /\bMCA\b/, `${c}: MCA`);
    assert.doesNotMatch(src, /VPS \d|IVS 10[34]\b/, `${c}: section numbers of IVS / RICS`);
    assert.doesNotMatch(src, /5[–-]10\s?%|5 (et|e|a|und|en|og|och|és|și|i) 10\b/, `${c}: fixed negotiation margin`);
    const T = RI[c];
    assert.ok(T.coverStandards.startsWith(T.ma.approachName), `${c}: the cover names the method`);
    assert.notEqual(T.sampleNote('1', false, 'closed'), T.sampleNote('1', false, 'asking'), `${c}: sample note by price kind`);
    const hyp = (k) => T.auto.hypotheses({ cc: 'IT', docs: [], planDoc: '', energy: '', law: '', validity: 6, priceKind: k });
    assert.notEqual(hyp('closed'), hyp('asking'), `${c}: assumptions by price kind`);
    assert.equal(typeof T.steps[2][1], 'function', `${c}: the unit price step names the area basis`);
    const r = T.auto.result({ est: 'X', mean: '1', median: '2', weighted: '3', estSpread: '4,4%', estAgree: false, unitTotal: '5', avg: '6', traits: '' });
    assert.ok(r.includes('4,4%'), `${c}: the result states the spread between estimators`);
    const letter = T.auto.letter({ addr: 'A', zone: '', town: 'B', visit: 'C', nAll: 7, nFactors: 12, total: 'T', words: 'W', ci: 80, lo: 'L', hi: 'H' });
    assert.ok(letter.includes('80'), `${c}: the letter gives the confidence level of the interval`);
  }
});

test('review fix I1: without a sales-comparison range, the letter, the summary and the result print no empty interval', () => {
  const st = fresh();
  st.meta.reportLang = 'en';
  st.approaches = { income: { on: true, rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 4.5 }, weights: { market: 0, income: 100 } };
  const res = MCA.compute(st);
  assert.equal(res.rangeLow, null);
  const h = Report.render(st, res);
  assert.doesNotMatch(h, /— – —|from — to —/);
  assert.ok(!h.includes('confidence interval of the estimate ('), 'no interval clause in the letter');
  const RI = require('../src/js/report_i18n.js');
  for (const l of ['es', 'it', 'en', 'fr', 'de', 'pt', 'nl', 'pl', 'cs', 'hu', 'ro', 'hr', 'da', 'sv', 'nb', 'ru', 'zh']) {
    const ctx = { addr: 'A', zone: '', town: 'B', visit: 'C', nAll: 7, nFactors: 12, total: 'T', words: 'W', ci: 80 };
    assert.ok(!RI[l].auto.letter(Object.assign({ lo: '', hi: '' }, ctx)).includes('80'), `${l}: no interval without a range`);
    assert.ok(RI[l].auto.letter(Object.assign({ lo: 'L', hi: 'H' }, ctx)).includes('80'), `${l}: interval with a range`);
  }
});

test('review fix I3: with closing prices only, the texts speak neither of offers nor of a negotiation margin, nor of a value range', () => {
  const st = fresh();
  st.meta.reportLang = 'en';
  st.comparables.forEach((c) => { c.source = 'registro'; });
  const h = Report.render(st, MCA.compute(st)).toLowerCase();
  for (const x of ['on offer', 'live offers', 'negotiation margin of', 'value range']) assert.ok(!h.includes(x), x);
  const RI = require('../src/js/report_i18n.js');
  const m = { town: 'B', avg: '1', month: 'M', isMax: false, yoy: '1%', qoq: '1%', zoneNote: '', dRange: '', commentary: '', negPct: '6', neg: '0.94' };
  for (const l of ['es', 'it', 'en', 'fr', 'de', 'pt', 'nl', 'pl', 'cs', 'hu', 'ro', 'hr', 'da', 'sv', 'nb', 'ru', 'zh']) {
    const T = RI[l];
    assert.ok(!T.auto.market(Object.assign({ priceKind: 'closed' }, m)).includes('0.94'), `${l}: no coefficient with closing prices`);
    assert.ok(T.auto.market(Object.assign({ priceKind: 'mixed' }, m)).includes('0.94'), `${l}: coefficient with asking prices`);
  }
});

test('review fix M7: the app names the method without «MCA» and calls the range a confidence interval', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.template.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  assert.doesNotMatch(html, /\bMCA\b/);
  const UI = require('../src/js/ui_i18n.js');
  for (const l of ['it', 'en', 'es']) {
    assert.doesNotMatch(UI[l].appTag, /\bMCA\b/, l);
    assert.doesNotMatch(UI[l].resRange(80), /Range|Forchetta|Horquilla/, l);
  }
});

test('report models: client and complete (bank and valuer); older and unknown names open as complete', () => {
  assert.deepEqual(Object.keys(Report.PRESETS), ['client', 'full']);
  assert.equal(Report.DEFAULT_DESIGN.preset, 'full');
  for (const p of ['complete', 'technical', undefined, 'unknown']) assert.equal(Report.designOf({ design: { preset: p } }).preset, 'full', String(p));
  assert.equal(Report.designOf({ design: { preset: 'client' } }).preset, 'client');
  assert.equal(Report.PRESETS.client.letter, undefined, 'the client report keeps the cover letter');
  assert.deepEqual(Report.PRESETS.full, {}, 'the complete report shows every section');
});

test('cover model: 1.0.0 covers become layers with the same look', () => {
  const m = (design) => Report.coverModel(design);
  const map = m({ coverStyle: 'map' });
  assert.deepEqual(map.bg, { type: 'map', shape: 'linear', c1: 'brandDeep', c2: 'brand', angle: 155 });
  assert.deepEqual(map.shade, { color: 'brandDeep', opacity: 100, mode: 'frame' });
  assert.deepEqual(map.motif, { type: 'none' });
  assert.deepEqual(map.logo, { size: 14, pos: 'tl', plate: 'auto' });
  assert.deepEqual(map.text, { color: 'auto', align: 'left' });
  assert.deepEqual(m({}), map, 'no design: the map cover');
  assert.equal(m({ coverStyle: 'map', cover: { veil: 0.4 } }).shade.opacity, 40);
  assert.equal(m({ coverStyle: 'photo' }).bg.type, 'photo');
  assert.equal(m({ coverStyle: 'photo' }).shade.mode, 'frame');
  assert.deepEqual(m({ coverStyle: 'pattern' }).bg, { type: 'gradient', shape: 'linear', c1: 'brandDeep', c2: 'brand', angle: 155 });
  assert.deepEqual(m({ coverStyle: 'pattern' }).motif, { type: 'lines' });
  assert.equal(m({ coverStyle: 'pattern', cover: { pattern: 'grid' } }).bg.shape, 'radial');
  assert.deepEqual(m({ coverStyle: 'pattern', cover: { pattern: 'grid' } }).motif, { type: 'grid' });
  assert.equal(m({ coverStyle: 'pattern', cover: { fill: 'solid' } }).bg.type, 'solid');
  const minimal = m({ coverStyle: 'minimal' });
  assert.deepEqual([minimal.bg.type, minimal.bg.c1, minimal.motif.type, minimal.text.color, minimal.shade.opacity], ['solid', 'white', 'band', 'auto', 0]);
  assert.equal(m({ coverStyle: 'pattern' }).shade.opacity, 100, 'the 1.0.0 shade over a pattern cover stays');
  assert.equal(m({ cover: { bg: { type: 'solid', c1: '#ffffff' } } }).shade.opacity, 0, 'a new solid cover has no shade');
  assert.equal(m({ cover: { bg: { type: 'photo' } } }).shade.opacity, 100, 'a new photo cover has a shade');
  for (const [old, type] of [['fullbleed', 'photo'], ['editorial', 'photo'], ['gradient', 'gradient'], ['solid', 'solid'], ['blueprint', 'solid']]) {
    assert.equal(m({ coverStyle: old }).bg.type, type, old);
  }
});

test('cover model: new layers are kept and checked', () => {
  const c = Report.coverModel({ coverStyle: 'map', cover: { bg: { type: 'solid', c1: '#FFFFFF' }, shade: { color: '#000000', opacity: 250, mode: 'x' },
    motif: { type: 'band' }, logo: { size: 99, pos: 'zz', plate: 'on' }, text: { color: 'dark', align: 'center' } } });
  assert.deepEqual(c.bg, { type: 'solid', shape: 'linear', c1: '#ffffff', c2: 'brand', angle: 155 });
  assert.deepEqual(c.shade, { color: '#000000', opacity: 100, mode: 'frame' });
  assert.deepEqual(c.motif, { type: 'band' });
  assert.deepEqual(c.logo, { size: 30, pos: 'tl', plate: 'on' });
  assert.deepEqual(c.text, { color: 'dark', align: 'center' });
  const d = Report.coverModel({ cover: { bg: { type: 'gradient', shape: 'radial', c1: 'red', c2: '#12', angle: 400 }, logo: { size: 2 } } });
  assert.deepEqual(d.bg, { type: 'gradient', shape: 'radial', c1: 'brandDeep', c2: 'brand', angle: 360 });
  assert.equal(d.logo.size, 6);
  assert.deepEqual(Report.designOf({ design: { coverStyle: 'minimal' } }).layers, Report.coverModel({ coverStyle: 'minimal' }), 'designOf carries the layers');
});

test('cover colours: tokens follow the brand, the text colour keeps the contrast, white stays white', () => {
  const P = Report.palette({ primary: '#0E5A4E', accent: '#1A8A47' });
  const D = { ink: '#1A2229' };
  const L = (over) => Report.coverModel({ cover: over });
  assert.equal(Report.colorOf('brandDeep', P, D), P.deep);
  assert.equal(Report.colorOf('white', P, D), '#ffffff');
  assert.equal(Report.colorOf('#ABCDEF', P, D), '#abcdef');
  assert.equal(Math.round(Report.contrast('#ffffff', '#000000')), 21);
  const white = Report.coverInk(L({ bg: { type: 'solid', c1: '#ffffff' } }), P, D);
  assert.deepEqual([white.bg, white.ink, white.dark], ['#ffffff', '#1A2229', true]);
  assert.ok(white.ratio >= 4.5);
  const deep = Report.coverInk(L({ bg: { type: 'solid', c1: 'brandDeep' } }), P, D);
  assert.deepEqual([deep.ink, deep.dark], ['#ffffff', false]);
  const lightGradient = Report.coverInk(L({ bg: { type: 'gradient', c1: '#ffffff', c2: '#f2efe8' } }), P, D);
  assert.equal(lightGradient.dark, true);
  const forced = Report.coverInk(L({ bg: { type: 'solid', c1: '#ffffff' }, text: { color: 'light' } }), P, D);
  assert.deepEqual([forced.ink, forced.ratio], ['#ffffff', 1]);
  const map = Report.coverInk(L({ bg: { type: 'map' }, shade: { color: 'brandDeep', opacity: 100 } }), P, D);
  assert.equal(map.dark, false, 'a full brand shade over the map keeps light text');
  const clear = Report.coverInk(L({ bg: { type: 'map' }, shade: { color: '#ffffff', opacity: 90 } }), P, D);
  assert.equal(clear.dark, true, 'a white shade over the map gives dark text');
});

const coverOf = (st) => {
  const html = Report.render(st, MCA.compute(st));
  const m = /<section class="page page--cover([^"]*)"[^>]*style="([^"]*)"[^>]*>([\s\S]*?)<\/section>/.exec(html);
  assert.ok(m, 'cover section with layer variables');
  return { cls: m[1].trim().split(/\s+/), style: m[2], body: m[3] };
};

test('cover rendering: a white background stays white, with dark text, the logo size and position', () => {
  const st = fresh();
  st.design.cover = { bg: { type: 'solid', c1: '#ffffff' }, logo: { size: 20, pos: 'tr' } };
  const c = coverOf(st);
  for (const k of ['cv-bg-solid', 'cv-txt-dark', 'cv-logo-tr', 'cv-motif-none', 'cv-al-left']) assert.ok(c.cls.includes(k), k);
  for (const v of ['--cv-c1:#ffffff', '--cv-base:#ffffff', '--cv-so:0;', '--cv-logo-h:20mm']) assert.ok(c.style.includes(v), v);
  assert.ok(!c.body.includes('brand-logo--pill'), 'no plate on a light cover');
});

test('cover rendering: a 1.0.0 map cover keeps its colours and shade', () => {
  const st = fresh();
  st.design.coverStyle = 'map';
  delete st.design.cover;
  const P = Report.palette(st.brand);
  const c = coverOf(st);
  for (const k of ['cv-bg-map', 'cv-txt-light', 'cv-shade-frame', 'cv-logo-tl']) assert.ok(c.cls.includes(k), k);
  for (const v of [`--cv-shade:${P.deep}`, `--cv-base:${P.deep}`, '--cv-so:1;', '--cv-logo-h:14mm']) assert.ok(c.style.includes(v), v);
  assert.ok(c.body.includes('class="cover-shade"'));
});

test('cover rendering: band, centred text, logo at the bottom; motifs follow the text colour', () => {
  const st = fresh();
  st.design.cover = { bg: { type: 'solid', c1: '#ffffff' }, motif: { type: 'band' }, text: { align: 'center' }, logo: { pos: 'bl' } };
  let c = coverOf(st);
  for (const k of ['cv-motif-band', 'cv-al-center', 'cv-logo-bl']) assert.ok(c.cls.includes(k), k);
  assert.ok(c.body.includes('class="cover-band"'));
  assert.ok(c.body.includes('class="cover-logo-b"'), 'the logo moves to the bottom block');
  st.design.cover = { bg: { type: 'gradient', c1: '#ffffff', c2: '#f4f1ea' }, motif: { type: 'lines' } };
  c = coverOf(st);
  assert.ok(c.cls.includes('cv-txt-dark'));
  assert.ok(c.body.includes('stroke="#1a2229"') || c.body.includes('stroke="#1A2229"'), 'dark lines on a light gradient');
  st.design.cover = { bg: { type: 'solid', c1: 'brandDeep' }, motif: { type: 'grid' }, logo: { plate: 'on' } };
  st.brand.logoMode = 'custom';
  st.brand.logoLight = 'data:image/png;base64,iVBORw0KGgo=';
  st.brand.logoDark = null;
  c = coverOf(st);
  assert.ok(c.cls.includes('cv-txt-light') && c.body.includes('stroke="#fff"'));
  assert.ok(c.body.includes('brand-logo--pill'), 'plate on request');
});

test('cover rendering: a gradient made with layers covers the whole page; a 1.0.0 pattern cover keeps its geometry', () => {
  assert.equal(Report.coverModel({ coverStyle: 'pattern' }).legacy, true);
  assert.equal(Report.coverModel({ cover: { bg: { type: 'gradient' } } }).legacy, false);
  const st = fresh();
  st.design.coverStyle = 'pattern';
  delete st.design.cover;
  assert.ok(coverOf(st).cls.includes('cv-legacy'));
  st.design.cover = { bg: { type: 'gradient', c1: '#1b2a49', c2: '#b08d57' } };
  assert.ok(!coverOf(st).cls.includes('cv-legacy'));
});

test('page logo: small, medium or large in the page headers; medium by default', () => {
  const css = (v) => Report.brandCss({ brand: {}, design: v === undefined ? {} : { headerLogo: v } });
  assert.match(css(), /--hl:7mm;--hl-k:1[;}]/);
  assert.match(css('S'), /--hl:5mm;--hl-k:0\.714/);
  assert.match(css('L'), /--hl:9mm;--hl-k:1\.286/);
  assert.match(css('XL'), /--hl:7mm/);
  assert.equal(Report.designOf({ design: { headerLogo: 'zz' } }).headerLogo, 'M');
  const sheet = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src', 'css', 'report.css'), 'utf8');
  assert.match(sheet, /\.pg-head \.brand-logo \{ height: var\(--hl, 7mm\); \}/);
});

test('profiles: the demo looks like the Valesta profile when the design is read as the report reads it', () => {
  const AppCore = require('../src/js/appcore.js');
  const Profiles = require('../src/js/profiles.js');
  const read = (d) => Report.designOf({ design: d });
  const demo = fresh();
  assert.equal(demo.brand.profileId, 'valesta');
  assert.equal(AppCore.profileChanged(demo, Profiles.get('valesta').profile, read), false);
  demo.design.fontHead = 'Montserrat';
  assert.equal(AppCore.profileChanged(demo, Profiles.get('valesta').profile, read), true);
});

test('cover options: the editor offers the choices that the report reads', () => {
  const O = Report.COVER_OPTIONS;
  assert.deepEqual(O.bg, ['solid', 'gradient', 'map', 'photo']);
  assert.deepEqual(O.shapes, ['linear', 'radial']);
  assert.deepEqual(O.shades, ['frame', 'full', 'bottom', 'top']);
  assert.deepEqual(O.motifs, ['none', 'lines', 'grid', 'band']);
  assert.deepEqual(O.logoPos, ['tl', 'tc', 'tr', 'bl']);
  assert.deepEqual(O.plates, ['auto', 'on', 'off']);
  assert.deepEqual(O.textColors, ['auto', 'light', 'dark']);
  assert.deepEqual(O.tokens, ['brand', 'brandDeep', 'accent', 'white', 'ink']);
  assert.ok(Object.isFrozen(O));
  for (const motif of O.motifs) assert.equal(Report.coverModel({ cover: { bg: { type: 'solid' }, motif: { type: motif } } }).motif.type, motif);
});
