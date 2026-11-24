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
const DEFAULT_STATE = require('../src/js/data.js');
const AppCore = require('../src/js/appcore.js');
const fresh = () => JSON.parse(JSON.stringify(DEFAULT_STATE));

test('parseNum accepts Italian/Spanish decimals and thousand separators', () => {
  assert.equal(AppCore.parseNum('85,60'), 85.6);
  assert.equal(AppCore.parseNum('85.6'), 85.6);
  assert.equal(AppCore.parseNum('592.000'), 592000);
  assert.equal(AppCore.parseNum('1.234,5'), 1234.5);
  assert.equal(AppCore.parseNum(' 495000 € '), 495000);
  assert.equal(AppCore.parseNum(''), null);
  assert.equal(AppCore.parseNum('abc'), null);
});

test('getPath / setPath work on nested objects and arrays', () => {
  const o = { a: { b: [{ c: 1 }] } };
  assert.equal(AppCore.getPath(o, 'a.b.0.c'), 1);
  AppCore.setPath(o, 'a.b.0.c', 5);
  AppCore.setPath(o, 'a.x.y', 'z');
  assert.equal(o.a.b[0].c, 5);
  assert.equal(o.a.x.y, 'z');
});

test('applySuggestions keeps location and factors justified by a note', () => {
  const st = fresh();
  const t4 = st.comparables.find((c) => c.id === 'T4');
  t4.ratings.floor = -2; // will be overwritten by the objective suggestion (+1)
  const changed = AppCore.applySuggestions(st);
  assert.ok(changed > 0);
  assert.equal(t4.ratings.floor, 1);
  assert.equal(t4.ratings.loc, 1, 'loc must stay manual');
  assert.equal(t4.ratings.cond, 0, 'noted factor must stay as set');
});

test('validateState rejects garbage and migrates partial projects', () => {
  assert.equal(AppCore.validateState(null).ok, false);
  assert.equal(AppCore.validateState({ foo: 1 }).ok, false);
  const partial = { subject: { address: 'X' }, comparables: [] };
  const r = AppCore.validateState(partial, DEFAULT_STATE);
  assert.equal(r.ok, true);
  assert.ok(r.state.settings && r.state.factors.length === 12 && Array.isArray(r.state.photos));
  assert.equal(r.state.subject.address, 'X');
});

test('blankState empties the subject and comparables but keeps method settings', () => {
  const b = AppCore.blankState(DEFAULT_STATE);
  assert.equal(b.comparables.length, 0);
  assert.equal(b.subject.address, '');
  assert.equal(b.settings.negotiationDefault, DEFAULT_STATE.settings.negotiationDefault);
  assert.equal(b.factors.length, 12);
  assert.equal(b.photos.length, 0);
});

test('fileName builds a safe project file name', () => {
  assert.equal(AppCore.fileName(fresh()), 'Valesta_Calle-de-Ejemplo-10_2026-11-22.json');
});

test('storage helpers never throw when storage is unavailable', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(AppCore.loadLocal(broken, 'k'), null);
  assert.equal(AppCore.saveLocal(broken, 'k', { a: 1 }), false);
  const mem = {}; const ok = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  assert.equal(AppCore.saveLocal(ok, 'k', { a: 1 }), true);
  assert.deepEqual(AppCore.loadLocal(ok, 'k'), { a: 1 });
});

test('a blank valuation renders a report without errors, NaN or undefined', () => {
  global.Charts = require('../src/js/charts.js');
  global.ASSETS = require('../src/js/assets.js');
  const Report = require('../src/js/report.js');
  const b = AppCore.blankState(DEFAULT_STATE);
  const r = MCA.compute(b);
  const html = Report.render(b, r).replace(/data:[a-z]+\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+/g, 'DATA');
  assert.ok(!/NaN|undefined|Infinity|\[object Object\]/.test(html), html.match(/.{60}(NaN|undefined|Infinity).{40}/) + '');
  // one comparable only, with data
  const c = AppCore.newComparable(b);
  Object.assign(c, { price: 300000, areaBuilt: 80, address: 'Calle Test 1' });
  b.comparables.push(c);
  b.subject.areaBuilt = 90;
  const html2 = Report.render(b, MCA.compute(b)).replace(/data:[a-z]+\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+/g, 'DATA');
  assert.ok(!/NaN|undefined|Infinity|\[object Object\]/.test(html2), html2.match(/.{60}(NaN|undefined|Infinity).{40}/) + '');
});

test('validateState drops photos that are not plain base64 images and unsafe comparable URLs', () => {
  const st = fresh();
  st.photos = [
    { id: 'ok', dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', caption: 'ok' },
    { id: 'bad', dataUrl: 'x" onerror="alert(1)', caption: 'bad' },
    { id: 'svg', dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', caption: 'svg' },
  ];
  st.comparables[0].url = 'javascript:alert(1)';
  const r = AppCore.validateState(st, DEFAULT_STATE);
  assert.deepEqual(r.state.photos.map((p) => p.id), ['ok']);
  assert.equal(r.state.comparables[0].url, '');
  assert.equal(AppCore.safeUrl('https://www.example.com/listing/1/'), 'https://www.example.com/listing/1/');
  assert.equal(AppCore.safeUrl('javascript:alert(1)'), '');
});

test('newComparable gets the next free id and neutral ratings', () => {
  const st = fresh();
  const c = AppCore.newComparable(st);
  assert.equal(c.id, 'T8');
  assert.equal(c.include, true);
  assert.equal(Object.keys(c.ratings).length, 12);
});

test('validateState migrates projects saved without brand or report language', () => {
  const old = fresh();
  delete old.version;
  delete old.brand;
  delete old.meta.reportLang;
  const r = AppCore.validateState(old, DEFAULT_STATE);
  assert.equal(r.ok, true);
  assert.equal(r.state.brand.name, 'Valesta');
  assert.equal(r.state.meta.reportLang, 'es', 'projects saved before the trilingual version were Spanish');
});

test('validateState keeps localized captions and safe logos, drops unsafe logos', () => {
  const st = fresh();
  st.photos = [{ id: 'a', dataUrl: 'data:image/jpeg;base64,/9j/4AAQ', caption: { es: 'Salón', it: 'Soggiorno' } }];
  st.brand.logoMode = 'custom';
  st.brand.logoLight = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
  st.brand.logoDark = 'javascript:alert(1)';
  const r = AppCore.validateState(st, DEFAULT_STATE);
  assert.deepEqual(r.state.photos[0].caption, { es: 'Salón', it: 'Soggiorno' });
  assert.equal(r.state.brand.logoLight, 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');
  assert.equal(r.state.brand.logoDark, null);
  assert.equal(AppCore.isSafeLogo('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(AppCore.isSafeLogo('data:text/html;base64,PGh0bWw+'), false);
});

test('blankState keeps brand, agency and report language of the current case', () => {
  const cur = fresh();
  cur.brand.name = 'Casa Mía';
  cur.meta.reportLang = 'it';
  const b = AppCore.blankState(DEFAULT_STATE, cur);
  assert.equal(b.brand.name, 'Casa Mía');
  assert.equal(b.meta.reportLang, 'it');
  assert.equal(b.meta.office.name, cur.meta.office.name);
});

test('validateState keeps design options and custom chapters, sanitising the signature', () => {
  const st = fresh();
  st.design = Object.assign({}, st.design, { fontHead: 'Literata', sections: { market: false } });
  st.customSections = [{ id: 'cs1', enabled: true, after: 'market', title: 'Extra', body: 'x' }, 'garbage'];
  st.meta.advisor.signature = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
  const r = AppCore.validateState(st, DEFAULT_STATE);
  assert.equal(r.state.design.fontHead, 'Literata');
  assert.equal(r.state.design.sections.market, false);
  assert.equal(r.state.design.sections.result, true);
  assert.equal(r.state.customSections.length, 1);
  assert.equal(r.state.meta.advisor.signature, null);
  const old = fresh();
  delete old.design;
  delete old.customSections;
  const m = AppCore.validateState(old, DEFAULT_STATE);
  assert.equal(m.state.design.fontBody, DEFAULT_STATE.design.fontBody);
  assert.deepEqual(m.state.customSections, []);
});

test('blankState keeps the design and custom chapter structure of the current case', () => {
  const cur = fresh();
  cur.design.fontHead = 'Literata';
  cur.customSections = [{ id: 'cs1', enabled: true, after: 'end', title: 'Anexo', body: 'texto' }];
  const b = AppCore.blankState(DEFAULT_STATE, cur);
  assert.equal(b.design.fontHead, 'Literata');
  assert.equal(b.customSections.length, 1);
});

test('agency profile: export and re-apply brand, agency, advisor, style and chapters', () => {
  const src = fresh();
  src.brand.name = 'Casa Sol';
  src.brand.primary = '#8C2F39';
  src.brand.logoMode = 'custom';
  src.brand.logoLight = 'data:image/png;base64,iVBORw0KGgo=';
  src.meta.office = { name: 'Casa Sol Sitges', phone: '+34 900 000 000', email: 'info@example.com', web: 'casasol.example', company: '', address: '', license: '' };
  src.meta.advisor = { name: 'Laura Pons', role: 'Tasadora', signature: 'data:image/png;base64,iVBORw0KGgo=' };
  src.design.fontHead = 'Literata';
  src.customSections = [{ id: 'cs1', enabled: true, after: 'end', title: 'Quiénes somos', body: 'Texto' }];
  src.settings.negotiationDefault = 0.95;
  const prof = AppCore.makeProfile(src);
  assert.equal(prof.kind, 'valesta-profile');
  assert.equal(prof.name, 'Casa Sol');
  assert.equal(AppCore.isProfile(prof), true);
  assert.equal(JSON.stringify(prof).includes('Ejemplo'), false, 'no case data in a profile');
  const target = fresh();
  const r = AppCore.applyProfile(target, JSON.parse(JSON.stringify(prof)));
  assert.equal(r.ok, true);
  assert.equal(r.state.brand.name, 'Casa Sol');
  assert.equal(r.state.brand.logoLight, 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(r.state.meta.office.name, 'Casa Sol Sitges');
  assert.equal(r.state.meta.advisor.name, 'Laura Pons');
  assert.equal(r.state.design.fontHead, 'Literata');
  assert.equal(r.state.customSections[0].title, 'Quiénes somos');
  assert.equal(r.state.settings.negotiationDefault, 0.95);
  assert.equal(r.state.subject.address, target.subject.address, 'case data untouched');
  assert.equal(target.brand.name, 'Valesta', 'input state not mutated');
});

test('agency profile: unsafe images are dropped and other files are rejected', () => {
  const prof = AppCore.makeProfile(fresh());
  prof.brand.logoLight = 'javascript:alert(1)';
  prof.advisor.signature = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
  const r = AppCore.applyProfile(fresh(), prof);
  assert.equal(r.ok, true);
  assert.equal(r.state.brand.logoLight, null);
  assert.equal(r.state.meta.advisor.signature, null);
  assert.equal(AppCore.applyProfile(fresh(), { subject: {} }).ok, false);
  assert.equal(AppCore.isProfile(fresh()), false);
});

test('ensureId gives every case a stable archive id', () => {
  const st = fresh();
  delete st.meta.id;
  const id = AppCore.ensureId(st);
  assert.match(id, /^v[a-z0-9]{8,}$/);
  assert.equal(AppCore.ensureId(st), id);
  const r = AppCore.validateState(st, DEFAULT_STATE);
  assert.equal(r.state.meta.id, id);
});

test('agency profile: files saved by Valorem 1.1 (kind valorem-profile) can still be imported', () => {
  const prof = AppCore.makeProfile(fresh());
  prof.kind = 'valorem-profile';
  prof.brand.name = 'Old Agency';
  assert.equal(AppCore.isProfile(prof), true);
  const r = AppCore.applyProfile(fresh(), prof);
  assert.equal(r.ok, true);
  assert.equal(r.state.brand.name, 'Old Agency');
});

test('projects saved by Valorem 1.1 with the neutral profile switch to the Valesta profile', () => {
  const old = fresh();
  old.brand = Object.assign({}, old.brand, { name: 'Valorem', profileId: 'valorem' });
  old.meta.office = Object.assign({}, old.meta.office, { name: 'Valorem' });
  const r = AppCore.validateState(JSON.parse(JSON.stringify(old)), DEFAULT_STATE);
  assert.equal(r.ok, true);
  assert.equal(r.state.brand.profileId, 'valesta');
  assert.equal(r.state.brand.name, 'Valesta');
  assert.equal(r.state.meta.office.name, 'Valesta');
});

test('projects saved by Valorem 1.1 keep an agency name chosen by the user', () => {
  const old = fresh();
  old.brand = Object.assign({}, old.brand, { name: 'Casa Sol', profileId: 'valorem' });
  old.meta.office = Object.assign({}, old.meta.office, { name: 'Casa Sol Sitges' });
  const r = AppCore.validateState(JSON.parse(JSON.stringify(old)), DEFAULT_STATE);
  assert.equal(r.state.brand.name, 'Casa Sol');
  assert.equal(r.state.meta.office.name, 'Casa Sol Sitges');
});

test('projects saved before the new interface get country, purpose and property type', () => {
  const old = fresh();
  delete old.meta.country;
  delete old.meta.purposeCode;
  delete old.subject.propertyType;
  const r = AppCore.validateState(JSON.parse(JSON.stringify(old)), DEFAULT_STATE);
  assert.equal(r.state.meta.country, 'ES');
  assert.equal(r.state.meta.purposeCode, 'sale');
  assert.deepEqual(r.state.subject.propertyType, { code: 'RES.APARTMENT', description: '' });
  const bad = fresh();
  bad.meta.country = 'Spain';
  bad.subject.propertyType = 'flat';
  const r2 = AppCore.validateState(JSON.parse(JSON.stringify(bad)), DEFAULT_STATE);
  assert.equal(r2.state.meta.country, 'ES');
  assert.equal(r2.state.subject.propertyType.code, 'RES.APARTMENT');
});

test('new valuation from the start screen: type, country, language and purpose', () => {
  const shop = { en: 'High-street shop', es: 'Local a pie de calle', it: 'Negozio su strada' };
  const st = AppCore.newValuation(DEFAULT_STATE, fresh(), { country: 'IT', purposeCode: 'loan_security', reportLang: 'it',
    propertyType: { code: 'RET.HIGH_STREET_SHOP', description: 'Negozio con due vetrine' }, typeLabel: shop, address: 'Via Roma 1, Milano' });
  assert.equal(st.meta.country, 'IT');
  assert.equal(st.meta.purposeCode, 'loan_security');
  assert.equal(st.meta.reportLang, 'it');
  assert.deepEqual(st.subject.propertyType, { code: 'RET.HIGH_STREET_SHOP', description: 'Negozio con due vetrine' });
  assert.deepEqual(st.subject.type, shop);
  assert.equal(st.subject.address, 'Via Roma 1, Milano');
  assert.equal(st.comparables.length, 0);
  assert.equal((st.market.series || []).length, 0, 'market data of another country are not carried over');
  assert.equal(AppCore.validateState(JSON.parse(JSON.stringify(st)), DEFAULT_STATE).ok, true);
  const same = AppCore.newValuation(DEFAULT_STATE, fresh(), { country: 'ES', reportLang: 'en', propertyType: { code: 'RES.APARTMENT', description: '' } });
  assert.ok((same.market.series || []).length > 0, 'same country: market data kept');
});

test('changing the property type updates the type shown in the report and returns the previous one', () => {
  const st = fresh();
  const prev = AppCore.setPropertyType(st, 'RES.PENTHOUSE', { en: 'Penthouse', es: 'Ático', it: 'Attico' });
  assert.equal(st.subject.propertyType.code, 'RES.PENTHOUSE');
  assert.equal(st.subject.type.it, 'Attico');
  assert.equal(prev.it, 'Appartamento');
});

test('design: a custom cover image is kept only when it is a plain base64 image', () => {
  const ok = fresh();
  ok.design.coverImage = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(AppCore.validateState(JSON.parse(JSON.stringify(ok)), DEFAULT_STATE).state.design.coverImage, 'data:image/png;base64,iVBORw0KGgo=');
  const bad = fresh();
  bad.design.coverImage = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
  assert.equal(AppCore.validateState(JSON.parse(JSON.stringify(bad)), DEFAULT_STATE).state.design.coverImage, null);
  const prof = AppCore.makeProfile(fresh());
  prof.design.coverImage = 'javascript:alert(1)';
  assert.equal(AppCore.applyProfile(fresh(), prof).state.design.coverImage, null);
});

test('document checks: only known statuses and plain text are kept', () => {
  const s = fresh();
  s.checks = [{ topic: 'title', status: 'verified', source: 'Nota simple', date: '2026-11-12' }, { topic: 'energy', status: 'hacked' }, { topic: 'x'.repeat(80), status: 'verified' }, null, 'bad',
    { topic: 'title', status: 'not_verified' }];
  const r = AppCore.validateState(JSON.parse(JSON.stringify(s)), DEFAULT_STATE);
  assert.deepEqual(r.state.checks, [{ topic: 'title', status: 'not_verified', source: '', date: '', note: '' }]);
  const old = fresh();
  delete old.checks;
  assert.deepEqual(AppCore.validateState(JSON.parse(JSON.stringify(old)), DEFAULT_STATE).state.checks, []);
});

test('AI log: entries with a known status are kept, the rest is dropped', () => {
  const s = fresh();
  s.aiLog = [{ id: 'ai1', at: '2026-11-23T10:00:00Z', status: 'open', request: 'compila', changes: [{ path: 'subject.yearBuilt', kind: 'value', before: null, after: 1999, state: 'open' }] },
    { id: 'bad', status: 'weird', changes: [] }, null, { id: 'ai2', status: 'accepted', changes: 'nope' }];
  const r = AppCore.validateState(JSON.parse(JSON.stringify(s)), DEFAULT_STATE);
  assert.equal(r.state.aiLog.length, 2);
  assert.equal(r.state.aiLog[0].changes[0].after, 1999);
  assert.deepEqual(r.state.aiLog[1].changes, []);
  const old = fresh();
  delete old.aiLog;
  assert.deepEqual(AppCore.validateState(JSON.parse(JSON.stringify(old)), DEFAULT_STATE).state.aiLog, []);
});

test('parseNum reads amounts typed with other currencies and separators', () => {
  assert.equal(AppCore.parseNum('CHF 1’250’000'), 1250000);
  assert.equal(AppCore.parseNum("1'250'000.50"), 1250000.5);
  assert.equal(AppCore.parseNum('£1,250,000'), 1250000);
  assert.equal(AppCore.parseNum('1 250 000 Kč'), 1250000);
  assert.equal(AppCore.parseNum('4 500 zł'), 4500);
  assert.equal(AppCore.parseNum('85,60'), 85.6);
});

test('technical data and attachments are kept safe when a project is opened', () => {
  const pdf = 'data:application/pdf;base64,JVBERi0xLjQK';
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const r = AppCore.validateState({
    subject: {}, comparables: [],
    technical: { energy: { class: 'B', ep: '85,5' }, seismic: { zone: '3', riskClass: 'C' }, systems: { heating: { status: 'dico', date: '2019-05-02' }, x: { status: 'bad' } },
      deductions: [{ label: 'DiRi', amount: '1.500' }, { label: '', amount: 'x' }] },
    attachments: [{ id: 'a1', topic: 'energy', kind: 'ape', title: 'APE', name: 'ape.pdf', mime: 'application/pdf', dataUrl: pdf, sha256: 'ab'.repeat(32) },
      { id: 'a2', dataUrl: 'data:text/html;base64,PGI+' }, { id: 'a3', kind: 'photo', dataUrl: png }],
  }, DEFAULT_STATE);
  const st = r.state;
  assert.equal(st.technical.energy.class, 'B');
  assert.equal(st.technical.energy.ep, 85.5);
  assert.equal(st.technical.systems.heating.status, 'dico');
  assert.ok(!st.technical.systems.x);
  assert.deepEqual(st.technical.deductions, [{ label: 'DiRi', amount: 1500 }]);
  assert.deepEqual(st.attachments.map((a) => a.id), ['a1', 'a3']);
  assert.equal(st.attachments[1].kind, 'other');
  assert.equal(st.attachments[0].include, true);
});

test('the class of the energy certificate feeds the energy factor', () => {
  const st = { subject: { energyCert: '' }, technical: { energy: { class: 'A2' } } };
  AppCore.syncTechnical(st);
  assert.equal(st.subject.energyCert, 'A');
  st.technical.energy.class = 'H';
  AppCore.syncTechnical(st);
  assert.equal(st.subject.energyCert, 'G');
  st.technical.energy.class = '';
  st.subject.energyCert = 'C';
  AppCore.syncTechnical(st);
  assert.equal(st.subject.energyCert, 'C');
});

test('a new valuation does not inherit the fictional advisor of the demo, but keeps a real one', () => {
  const b = AppCore.blankState(DEFAULT_STATE, fresh());
  assert.equal(b.meta.advisor.name, '', 'demo advisor not carried over');
  assert.deepEqual(b.meta.advisor.role, DEFAULT_STATE.meta.advisor.role);
  assert.equal(b.meta.advisor.signature, null);
  const cur = fresh();
  cur.meta.advisor = { name: 'Advisor Two', role: 'Valuer', signature: null };
  assert.equal(AppCore.blankState(DEFAULT_STATE, cur).meta.advisor.name, 'Advisor Two', 'the user’s own advisor is kept');
});

test('cover texts saved before per-language storage belong to the report language', () => {
  const st = fresh();
  st.meta.reportLang = 'it';
  st.design = Object.assign({}, st.design, { cover: Object.assign({}, (st.design || {}).cover, { titleEm: 'dello studio professionale', title: { _: 'Valore', de: 'Marktwert' }, kicker: '' }) });
  const r = AppCore.validateState(st, DEFAULT_STATE);
  assert.deepEqual(r.state.design.cover.titleEm, { it: 'dello studio professionale' });
  assert.deepEqual(r.state.design.cover.title, { it: 'Valore', de: 'Marktwert' });
  assert.equal(r.state.design.cover.kicker, '');
});


test('loading a valuation drops coordinates that are not on the globe', () => {
  const st = fresh();
  st.subject.lat = 1e15; st.subject.lon = 'abc';
  st.comparables[0].lat = 41.3; st.comparables[0].lon = -1e15;
  st.subject.pois = [{ name: 'A', lat: 95, lon: 12 }, { name: 'B', lat: 45.1, lon: 12.2 }];
  const r = AppCore.validateState(st, DEFAULT_STATE);
  assert.equal(r.state.subject.lat, null);
  assert.equal(r.state.subject.lon, null);
  assert.equal(r.state.comparables[0].lon, null);
  assert.equal(r.state.subject.pois[0].lat, null);
  assert.equal(r.state.subject.pois[1].lat, 45.1);
});


test('setPath and setLoc ignore paths that would change the prototype of every object', () => {
  const I18N = require('../src/js/i18n.js');
  const o = {};
  AppCore.setPath(o, '__proto__.polluted', 1);
  AppCore.setPath(o, 'a.constructor.prototype.polluted', 1);
  I18N.setLoc(o, '__proto__.polluted2', 'it', 'x');
  assert.equal(({}).polluted, undefined);
  assert.equal(({}).polluted2, undefined);
  AppCore.setPath(o, 'subject.address', 'Via Esempio 1');
  assert.equal(o.subject.address, 'Via Esempio 1');
});

test('a new valuation in a country with a small currency unit rounds to a larger step, unless the user chose one', () => {
  const cur = fresh();
  assert.equal(cur.settings.rounding, 1000);
  assert.equal(AppCore.newValuation(DEFAULT_STATE, cur, { country: 'HU' }).settings.rounding, 100000);
  assert.equal(AppCore.newValuation(DEFAULT_STATE, cur, { country: 'SE' }).settings.rounding, 10000);
  assert.equal(AppCore.newValuation(DEFAULT_STATE, cur, { country: 'IT' }).settings.rounding, 1000);
  const custom = fresh();
  custom.settings.rounding = 5000;
  assert.equal(AppCore.newValuation(DEFAULT_STATE, custom, { country: 'HU' }).settings.rounding, 5000);
  assert.equal(cur.settings.rounding, 1000, 'the current valuation is not changed');
  assert.equal(AppCore.roundingFor('CZ'), 10000);
});

test('the interface starts in the language chosen, else in the first browser language it has, else in English', () => {
  assert.equal(AppCore.uiLangFor(null, ['it-IT', 'en-US']), 'it');
  assert.equal(AppCore.uiLangFor(null, ['ja-JP', 'es-ES', 'it']), 'es', 'the order of the browser languages counts');
  assert.equal(AppCore.uiLangFor(null, ['de-DE', 'es-ES']), 'de', 'all the languages of the report');
  assert.equal(AppCore.uiLangFor(null, ['nb-NO']), 'nb');
  assert.equal(AppCore.uiLangFor(null, ['zh-Hans-CN']), 'zh');
  assert.equal(AppCore.uiLangFor(null, ['ES']), 'es');
  assert.equal(AppCore.uiLangFor(null, ['it_IT']), 'it');
  assert.equal(AppCore.uiLangFor(null, ['ja-JP', 'ko']), 'en');
  assert.equal(AppCore.uiLangFor(null, []), 'en');
  assert.equal(AppCore.uiLangFor(null, undefined), 'en');
  assert.equal(AppCore.uiLangFor(null, [null, '', 'it']), 'it');
  assert.equal(AppCore.uiLangFor('es', ['it-IT']), 'es', 'a language chosen by the user is kept');
  assert.equal(AppCore.uiLangFor('fr', ['it-IT']), 'fr');
  assert.equal(AppCore.uiLangFor('xx', ['it-IT']), 'it', 'a stored value the interface does not have is ignored');
});

test('the language pickers list the languages by their own names, in the alphabet of the app', () => {
  assert.deepEqual(AppCore.langsByName('it'), ['cs', 'da', 'de', 'en', 'es', 'fr', 'hr', 'it', 'hu', 'nl', 'nb', 'pl', 'pt', 'ro', 'sv', 'ru', 'zh']);
  assert.deepEqual(AppCore.langsByName('en'), AppCore.langsByName('it'), 'the same Latin alphabet');
  assert.equal(AppCore.langsByName('ru')[0], 'ru', 'Cyrillic comes first for a Russian user');
  assert.deepEqual(AppCore.langsByName('it', ['it', 'en', 'es']), ['en', 'es', 'it'], 'any list of codes');
  assert.deepEqual(AppCore.langsByName('xx', ['it', 'en']), ['en', 'it'], 'an unknown language of the app still sorts');
});

// ---- Valesta 1.1 (D2): new valuations start with neutral market inputs to confirm ----
test('D2: a new valuation starts with no time trend, no annex values and unconfirmed market inputs', () => {
  const st = AppCore.newValuation(DEFAULT_STATE, fresh(), { country: 'IT' });
  assert.equal(st.settings.timeTrendAnnual, 0);
  assert.equal(st.settings.annex.parking, null);
  assert.equal(st.settings.annex.storage, null);
  assert.equal(st.settings.marketConfirmed, false);
  assert.equal(st.settings.estimator, DEFAULT_STATE.settings.estimator);
});

test('D2: the demo carries confirmed market inputs', () => {
  assert.equal(DEFAULT_STATE.settings.marketConfirmed, true);
});

test('review fix C1: a saved valuation keeps its other approaches, their weights and the reasoning', () => {
  const s = fresh();
  s.approaches = { income: { on: true, rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 4.5 }, weights: { market: 70, income: 30 }, reason: 'Rented flat: the income matters' };
  const value = MCA.compute(s).total;
  assert.notEqual(value, MCA.compute(fresh()).total);
  const back = AppCore.validateState(JSON.parse(JSON.stringify(s)), DEFAULT_STATE);
  assert.ok(back.ok);
  assert.deepEqual(back.state.approaches.weights, { market: 70, income: 30 });
  assert.equal(back.state.approaches.reason, 'Rented flat: the income matters');
  assert.equal(MCA.compute(back.state).total, value);
  const hostile = AppCore.validateState(Object.assign(JSON.parse(JSON.stringify(s)), { approaches: { income: 'x', weights: { market: 'a', __proto__: { x: 1 } }, extra: 1 } }), DEFAULT_STATE);
  assert.ok(hostile.ok);
  assert.equal(hostile.state.approaches.extra, undefined);
  assert.equal(hostile.state.approaches.income, undefined);
});
