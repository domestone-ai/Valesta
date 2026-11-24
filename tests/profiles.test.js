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
global.Charts = require('../src/js/charts.js');
global.ASSETS = require('../src/js/assets.js');
global.I18N = require('../src/js/i18n.js');
global.PROFILE_ASSETS = require('../src/js/profiles_assets.js');
const Profiles = require('../src/js/profiles.js');
global.Profiles = Profiles;
const AppCore = require('../src/js/appcore.js');
const Report = require('../src/js/report.js');
const DEFAULT_STATE = require('../src/js/data.js');

const fresh = () => JSON.parse(JSON.stringify(DEFAULT_STATE));

test('profile library: neutral default plus three fictitious example agencies', () => {
  const ids = Profiles.LIST.map((p) => p.id);
  assert.deepEqual(ids, ['valesta', 'example-casa-aurora', 'example-mirador', 'example-nordic-homes']);
  assert.equal(Profiles.DEFAULT_ID, 'valesta');
  for (const p of Profiles.LIST) {
    assert.equal(AppCore.isProfile(p.profile), true, p.id);
    const b = p.profile.brand;
    if (b.logoMode === 'custom') { assert.ok(AppCore.isSafeLogo(b.logoLight), p.id + ' light'); assert.ok(AppCore.isSafeLogo(b.logoDark), p.id + ' dark'); }
    assert.ok(p.profile.office.name, p.id + ' office');
    assert.ok(Report.FONT_STACKS[p.profile.design.fontHead] && Report.FONT_STACKS[p.profile.design.fontBody], p.id + ' fonts');
    assert.equal(p.profile.advisor, undefined, 'built-in profiles carry no advisor');
    if (p.id !== 'valesta') {
      assert.match(p.profile.office.email, /@example\.com$/, p.id + ' uses fictitious contact data');
      assert.match(p.label, /example/);
    }
  }
  assert.equal(Profiles.get('example-mirador').profile.design.fontHead, 'Cormorant Garamond');
  assert.equal(Profiles.get('nope'), null);
});

test('applying a library profile restyles the report and keeps the case data', () => {
  const st = fresh();
  const r = AppCore.applyProfile(st, Profiles.get('example-mirador').profile);
  assert.equal(r.ok, true);
  assert.equal(r.state.brand.name, 'Mirador Estates');
  assert.equal(r.state.subject.address, st.subject.address);
  assert.equal(r.state.meta.advisor.name, st.meta.advisor.name);
  const css = Report.brandCss(r.state);
  assert.match(css, /--serif:'Cormorant Garamond'/);
  assert.match(css, /--accent:#b08d57/);
  const html = Report.render(r.state, MCA.compute(r.state));
  assert.match(html, /<img src="data:image\/svg\+xml;base64,/);
  assert.match(html, /Example Street 1/);
});

test('legacy projects: old built-in logo becomes the text wordmark; old fonts map to equivalents', () => {
  const legacy = fresh();
  legacy.brand = { name: 'Agency X', logoMode: 'builtin', primary: '#365C76', accent: '#1A8A47' };
  assert.equal(AppCore.validateState(legacy, DEFAULT_STATE).state.brand.logoMode, 'text');
  const st = fresh();
  st.design = Object.assign({}, st.design, { fontHead: 'Lora', fontBody: 'Source Sans 3' });
  const d = Report.designOf(st);
  assert.equal(d.fontHead, 'Literata');
  assert.equal(d.fontBody, 'Open Sans');
  st.design.fontHead = 'Playfair Display';
  assert.equal(Report.designOf(st).fontHead, 'Cormorant Garamond');
});

test('the demo case is synthetic: fictitious identities, no links to real listings or sources', () => {
  const txt = JSON.stringify(DEFAULT_STATE);
  assert.doesNotMatch(txt, /https?:\/\//, 'no URL in the demo data');
  const st = fresh();
  assert.equal(st.brand.name, 'Valesta');
  assert.equal(st.brand.logoMode, 'text');
  assert.equal(st.meta.reportLang, 'en');
  assert.equal(st.subject.address, 'Calle de Ejemplo, 10');
  for (const c of st.comparables) assert.equal(c.sourceName, 'Portal (demo)', c.id);
  assert.equal(MCA.compute(st).total, 518000);
  const html = Report.render(st, MCA.compute(st));
  assert.match(html, /Valuation report/);
  assert.match(html, /class="wordmark[ "]/);
  assert.equal(ASSETS.logo, undefined, 'no agency logo among the generic assets');
});

test('English comes first: language order and fallbacks', () => {
  assert.deepEqual(I18N.LANGS.slice(0, 3), ['en', 'es', 'it'], 'English first, then the original languages; 14 more report languages follow');
  assert.equal(I18N.loc({ es: 'a', en: 'b' }, 'it'), 'b');
  assert.equal(I18N.loc({ it: 'c', es: 'a' }, 'en'), 'a');
});
