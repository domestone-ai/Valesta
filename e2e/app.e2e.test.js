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
// End-to-end tests of the main flows in a real browser: the installed Chrome or Edge, driven by playwright-core (no
// browser download). They need a build (python -I build.py). Every request to an outside service is stopped and
// recorded, so the tests also check that nothing leaves the device without the user's choice.
// Run: node --test e2e/
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');

const DIST = path.join(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml' };
let server = null;
let browser = null;
let base = '';

before(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'Valesta.html')), 'build first: python -I build.py');
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '');
    const file = path.resolve(DIST, rel);
    if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const channel of ['chrome', 'msedge']) {
    try { browser = await chromium.launch({ channel, headless: true }); break; } catch (e) { /* try the next browser */ }
  }
  assert.ok(browser, 'Chrome or Edge not found');
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.close();
});

// A fresh browser profile in Italian; outside requests are aborted and recorded, script errors and CSP violations kept.
async function session(t, file) {
  const context = await browser.newContext({ locale: 'it-IT', acceptDownloads: true, viewport: { width: 1360, height: 900 } });
  const outside = [];
  await context.route((url) => !/^http:\/\/127\.0\.0\.1:\d+\//.test(url.href), (route) => { outside.push(route.request().url()); return route.abort(); });
  await context.addInitScript(() => {
    if (!localStorage.getItem('valesta-ui-lang')) localStorage.setItem('valesta-ui-lang', 'it');
    // The privacy window of the first start has a test of its own: here the app starts as after it, with every service off.
    if (!localStorage.getItem('valesta-privacy-notice')) localStorage.setItem('valesta-privacy-notice', JSON.stringify({ seen: '2026-01-01T00:00:00.000Z' }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/${file || 'Valesta.html'}`);
  await page.waitForSelector('#side [data-step]', { state: 'attached' });
  t.after(() => context.close());
  return { page, outside, errors };
}

// At this width (1360 px) the form and the document share the screen and the steps are a drawer (layout.js), opened from
// the strip at the top of the step, as a user does.
const openSteps = async (page) => {
  if (await page.evaluate(() => document.getElementById('app').dataset.nav === 'drawer' && !document.getElementById('side').classList.contains('open'))) {
    await page.click('.step-strip [data-nav-toggle]');
    await page.waitForSelector('#side.open [data-step]');
  }
};
const goStep = async (page, step) => {
  await openSteps(page);
  await page.click(`#side [data-step="${step}"]`);
  await page.waitForSelector(`#side [data-step="${step}"][aria-current="step"]`, { state: 'attached' });
};
const topValue = (page) => page.textContent('.top [data-action="goto-step"][data-key="result"]');

for (const file of ['Valesta.html', 'Web/index.html']) {
  test(`${file}: every step opens with no script error, no CSP violation and no request to outside services`, async (t) => {
    const { page, outside, errors } = await session(t, file);
    const steps = await page.$$eval('#side [data-step]', (els) => els.map((e) => e.dataset.step));
    assert.ok(steps.length >= 12, `${steps.length} steps`);
    for (const s of steps) await goStep(page, s);
    assert.deepEqual(errors, []);
    assert.deepEqual(outside, []);
  });
}

test('layout: three modes, a divider moved with the keyboard, reset from the menu, the steps as a drawer when space is short', async (t) => {
  const { page, errors } = await session(t);
  const lay = () => page.evaluate(() => ({ mode: document.getElementById('app').dataset.layout, nav: document.getElementById('app').dataset.nav,
    ctx: Math.round(document.getElementById('ctx').getBoundingClientRect().width), now: Number(document.getElementById('ctx-resizer').getAttribute('aria-valuenow')) }));
  // 1360 px: form and document side by side, the steps in a drawer opened from the strip; Escape gives the focus back.
  assert.deepEqual((({ mode, nav }) => ({ mode, nav }))(await lay()), { mode: 'split', nav: 'drawer' });
  await page.click('.step-strip [data-nav-toggle]');
  await page.waitForSelector('#side.open [data-step][aria-current="step"]');
  assert.equal(await page.getAttribute('.step-strip [data-nav-toggle]', 'aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('side').classList.contains('open'));
  const back = await page.evaluate(() => ({ ok: document.activeElement.hasAttribute('data-nav-toggle'), el: document.activeElement.outerHTML.slice(0, 90) }));
  assert.ok(back.ok, `focus back on the button, not on ${back.el}`);
  // 1440 px: three columns; the divider moves by 24 px with the arrows, Enter restores the width chosen by the app.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => document.getElementById('app').dataset.nav === 'side');
  const start = await lay();
  assert.ok(start.ctx >= 400 && start.now === start.ctx, JSON.stringify(start));
  await page.focus('#ctx-resizer');
  await page.keyboard.press('ArrowLeft');
  assert.equal((await lay()).now, start.now + 24);
  await page.keyboard.press('Enter');
  assert.equal((await lay()).now, start.now);
  // Document review: the steps go into the drawer and the document gets most of the width; the menu resets the layout.
  await page.click('[data-layout-mode="review"]');
  const review = await lay();
  assert.ok(review.mode === 'review' && review.nav === 'drawer' && review.ctx > start.ctx, JSON.stringify(review));
  await page.click('#menu-btn');
  await page.click('#menu [data-action="layout-reset"]');
  assert.deepEqual((({ mode, nav }) => ({ mode, nav }))(await lay()), { mode: 'split', nav: 'side' });
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('valesta-layout'))).mode, 'split');
  assert.deepEqual(errors, []);
});

test('preview toolbar: the tools stay on one line on laptop screens; the status texts get shorter instead', async (t) => {
  const { page, errors } = await session(t);
  // A row is a group of tools whose vertical centres are less than 10 px apart.
  const rows = () => page.$$eval('.pv-toolbar > button, .pv-toolbar > .seg', (els) => els.map((b) => { const r = b.getBoundingClientRect(); return Math.round(r.top + r.height / 2); })
    .sort((a, b) => a - b).filter((y, i, all) => i === 0 || y - all[i - 1] >= 10));
  for (const width of [1360, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await goStep(page, 'result');
    await page.waitForTimeout(400);
    assert.equal((await rows()).length, 1, `${width} px: ${JSON.stringify(await rows())}`);
  }
  assert.deepEqual(errors, []);
});

test('step strip: the current step shows whole, also at the end of a phase, on a phone and in document review', async (t) => {
  const { page, errors } = await session(t);
  // Whole: inside the strip and not under the "Steps" button, which stays at the start of the strip.
  const whole = () => page.evaluate(() => {
    const s = document.querySelector('.step-strip');
    const nav = s.querySelector('.strip-nav');
    const a = s.getBoundingClientRect(), b = s.querySelector('[aria-current="step"]').getBoundingClientRect();
    const start = nav && nav.offsetWidth ? nav.getBoundingClientRect().right : a.left;
    return b.left >= start - 1 && b.right <= a.right + 1 && (!nav || !nav.offsetWidth || nav.getBoundingClientRect().left >= a.left - 1);
  });
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    if (width > 760) await page.click('[data-layout-mode="review"]');
    for (const s of ['result', 'checks', 'deliver']) {
      await page.evaluate((x) => window.__valesta.goStep(x), s);
      await page.waitForTimeout(300);
      assert.ok(await whole(), `${width} px, ${s}`);
    }
  }
  assert.deepEqual(errors, []);
});

test('header and steps: the value has a state, the quality check is named, every step state has its own shape and name', async (t) => {
  const { page, errors } = await session(t);
  const head = await page.evaluate(() => ({ state: document.querySelector('.tkpi .vstate').textContent.trim(), quality: document.querySelector('.tq').getAttribute('aria-label'),
    search: document.getElementById('cmd-btn').getAttribute('aria-label'), ai: document.getElementById('tb-ai').getAttribute('aria-label') }));
  assert.match(head.state, /controll[oi] apert[oi]|Nessun controllo aperto|Dati incompleti/, head.state);
  assert.match(head.quality, /^Controllo di qualità: \d{1,3} su 100, classe [A-E]$/, head.quality);
  assert.doesNotMatch(head.search, /AI/, 'search and assistant are two different entries');
  assert.match(head.ai, /assistente AI/);
  const steps = await page.$$eval('#side .step', (els) => els.map((b) => ({ shape: b.querySelector('svg.st').getAttribute('class'), name: b.querySelector('.sr-only').textContent })));
  assert.ok(steps.every((s) => /st-(ok|part|warn|todo|opt)/.test(s.shape) && s.name.trim().length > 3), JSON.stringify(steps));
  assert.ok(steps.some((s) => /st-ok/.test(s.shape)) && steps.some((s) => /st-warn/.test(s.shape)), 'the demo has complete steps and steps with open checks');
  assert.deepEqual(errors, []);
});

test('comparison view, field errors and preview tools: changes are undone, the value comes back, the choices are kept', async (t) => {
  const { page, errors } = await session(t);
  const value = async () => (await topValue(page)).replace(/\s+/g, ' ');
  const start = await value();
  // Comparison view: one row per comparable; the switch takes a comparable out of the calculation and back.
  await goStep(page, 'comps');
  assert.equal(await page.$$eval('table.ct tbody tr', (r) => r.length), await page.evaluate(() => window.__valesta.state.comparables.length));
  const sw = 'table.ct tbody tr:first-child .tgl';
  await page.click(sw);
  await page.waitForFunction((s) => document.querySelector(s).getAttribute('aria-checked') === 'false', sw);
  await page.click(sw);
  await page.waitForFunction((s) => document.querySelector(s).getAttribute('aria-checked') === 'true', sw);
  await page.waitForFunction((v) => document.querySelector('.top [data-action="goto-step"][data-key="result"]').textContent.replace(/\s+/g, ' ') === v, start);
  await page.click('table.ct [data-action="comp-open"][data-i="1"]');
  assert.ok(await page.evaluate(() => document.querySelector('.comp[data-i="1"]').open), 'the card of the comparable is open');
  // A number that cannot be read: the field says why and is marked invalid, until the value is right again.
  await goStep(page, 'features');
  const year = '[data-bind="subject.yearBuilt"]';
  const before = await page.inputValue(year);
  await page.fill(year, '19x9');
  assert.equal(await page.getAttribute(year, 'aria-invalid'), 'true');
  assert.match(await page.evaluate((s) => document.getElementById(document.querySelector(s).getAttribute('aria-describedby')).textContent, year), /numero intero/);
  await page.fill(year, before);
  assert.equal(await page.getAttribute(year, 'aria-invalid'), null);
  // Preview: fit to the page is kept on the device; the chapters list the sections of the report.
  await page.click('#pv-fitp');
  assert.equal(await page.getAttribute('#pv-fitp', 'aria-pressed'), 'true');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('valesta-preview'))).zoom, 'page');
  await page.click('#pv-chap');
  assert.ok(await page.$$eval('#pop [data-action="pv-goto"]', (b) => b.length) >= 5, 'chapters of the report');
  await page.keyboard.press('Escape');
  await page.click('#pv-fitw');
  assert.equal(await value(), start, 'the value is unchanged');
  assert.deepEqual(errors, []);
});

test('motion: a step change slides from the side it comes from, indicators follow the choice, reduced motion moves nothing', async (t) => {
  const { page, errors } = await session(t);
  await goStep(page, 'features');
  assert.equal(await page.getAttribute('#tab-body', 'data-enter'), 'fwd', 'forward: from the right');
  await goStep(page, 'identity');
  assert.equal(await page.getAttribute('#tab-body', 'data-enter'), 'back', 'back: from the left');
  // The thumb of the layout modes sits under the chosen mode and moves with it.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => document.getElementById('app').dataset.nav === 'side');
  const thumb = () => page.evaluate(() => { const g = document.getElementById('layout-seg'); return [g.style.getPropertyValue('--m-x'), `${g.querySelector(':scope > button.on').offsetLeft}px`]; });
  let [x, want] = await thumb();
  assert.equal(x, want);
  await page.click('[data-layout-mode="review"]');
  [x, want] = await thumb();
  assert.equal(x, want);
  await page.click('[data-layout-mode="split"]');
  // With reduced motion the content changes in place: no animation, no sliding.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await goStep(page, 'areas');
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('tab-body')).animationName), 'none');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#layout-seg > .m-ind')).transitionDuration), '0s');
  assert.deepEqual(errors, []);
});

test('changing the estimator changes the value at once', async (t) => {
  const { page, errors } = await session(t);
  await goStep(page, 'result');
  const before = (await topValue(page)).trim();
  await page.selectOption('[data-bind="settings.estimator"]', 'median');
  await page.waitForFunction((v) => document.querySelector('.top [data-action="goto-step"][data-key="result"]').textContent.trim() !== v, before);
  assert.match(await topValue(page), /€/);
  assert.deepEqual(errors, []);
});

test('a report in another language carries no draft label; the report and its file follow it and contact no outside service', async (t) => {
  const { page, outside, errors } = await session(t);
  await page.click('#tab-body [data-action="pop-lang"][data-key="report"]');
  await page.click('#pop [data-rl="fr"]');
  await page.waitForFunction(() => /Français/.test(document.querySelector('#tab-body').textContent));
  assert.ok(!/Français \(bozza\)/.test(await page.textContent('#tab-body')), 'no draft label next to the language');
  await page.waitForFunction(() => document.querySelector('.report') && document.querySelector('.report').textContent.includes('Rapport d’évaluation'));
  await goStep(page, 'deliver');
  assert.ok(!/testi in bozza/.test(await page.textContent('#tab-body')), 'no draft warning on the language before sending');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#tab-body [data-action="export-html"]')]);
  assert.match(download.suggestedFilename(), /^Rapport_Evaluation_Valesta_.+\.html$/);
  const html = fs.readFileSync(await download.path(), 'utf8');
  assert.match(html, /<html lang="fr">/);
  assert.ok(html.includes('Rapport d’évaluation'));
  assert.ok(!/<(?:image|img)\b[^>]*?(?:href|src)="https?:/.test(html), 'no outside image in the file');
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('outside maps wait for the user’s choice, exported reports keep no outside address, the privacy panel turns them off', async (t) => {
  const { page, outside, errors } = await session(t);
  await goStep(page, 'features');
  await page.waitForSelector('[data-action="maps-consent"]');
  assert.deepEqual(outside, [], 'nothing before the choice');
  await page.click('[data-action="maps-consent"]');
  assert.match(await page.textContent('#geo-panel'), /IGN · Mapa base \(Spagna\)/);
  await page.click('[data-action="maps-on"]');
  await page.waitForFunction(() => window.Maps && Maps.isAllowed());
  await page.waitForTimeout(800);
  assert.ok(outside.some((u) => /^https:\/\/www\.ign\.es\//.test(u)), 'tiles requested only after the choice');
  assert.ok(await page.evaluate(() => !!localStorage.getItem('valesta-maps-consent')));
  await goStep(page, 'deliver');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#tab-body [data-action="export-html"]')]);
  const html = fs.readFileSync(await download.path(), 'utf8');
  assert.ok(!/<(?:image|img)\b[^>]*?(?:href|src)="https?:/.test(html), 'tiles that cannot be embedded are left out, never linked');
  await page.click('#menu-btn');
  await page.click('#menu [data-action="privacy"]');
  await page.waitForSelector('#dlg[open] .priv-row');
  assert.equal(await page.$$eval('#dlg .priv-row', (r) => r.length), 5);
  await page.click('#dlg [data-action="priv-maps"]');
  assert.equal(await page.evaluate(() => Maps.isAllowed()), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('valesta-maps-consent')), null);
  assert.deepEqual(errors, []);
});

test('the assistant keeps the geodata services off and shows where the AI provider is based', async (t) => {
  const { page, outside, errors } = await session(t);
  await page.click('[data-ctx="ai"]');
  await page.click('[data-ai="settings"]');
  await page.waitForSelector('#ai-settings [data-set="geodata"]', { state: 'attached' });
  assert.equal(await page.isChecked('#ai-settings [data-set="geodata"]'), false);
  assert.equal(await page.isChecked('#ai-settings [data-set="redact"]'), true);
  assert.match(await page.textContent('#ai-settings'), /Sede del fornitore: Stati Uniti, fuori dallo Spazio economico europeo/);
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('a new valuation needs a property type, then starts blank from the identification step', async (t) => {
  const { page, outside, errors } = await session(t);
  await openSteps(page);
  await page.click('#side [data-action="new"]');
  await page.click('[data-action="wiz-create"]');
  await page.waitForFunction(() => /tipologia/i.test(document.body.textContent), null, { timeout: 5000 });
  await page.click('[data-action="wiz-cat"]');
  await page.click('[data-action="wiz-type"]');
  await page.click('[data-action="wiz-create"]');
  await page.waitForSelector('#side [data-step="identity"][aria-current="step"]', { state: 'attached' });
  await goStep(page, 'features');
  assert.equal(await page.inputValue('[data-bind="subject.address"]'), '', 'blank property');
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('until the user picks a language, the interface and the example report follow the browser; a choice is kept', async (t) => {
  const errors = [];
  // [language of the page, report language of the example, stored choice] at the first start in a browser of `locale`.
  const firstStart = async (locale, chosen) => {
    const context = await browser.newContext({ locale });
    t.after(() => context.close());
    await context.route((url) => !/^http:\/\/127\.0\.0\.1:\d+\//.test(url.href), (route) => route.abort());
    if (chosen) await context.addInitScript((l) => localStorage.setItem('valesta-ui-lang', l), chosen);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push('page error: ' + e.message));
    await page.goto(`${base}/Valesta.html`);
    await page.waitForSelector('#side [data-step]', { state: 'attached' });
    return page.evaluate(() => [document.documentElement.lang, window.__valesta.state.meta.reportLang, localStorage.getItem('valesta-ui-lang')]);
  };
  assert.deepEqual(await firstStart('es-ES'), ['es', 'es', null], 'Spanish browser: Spanish; nothing stored until the user chooses');
  assert.deepEqual(await firstStart('de-DE'), ['de', 'de', null], 'German browser: German (draft)');
  assert.deepEqual(await firstStart('ja-JP'), ['en', 'en', null], 'a language the interface does not have: English');
  assert.deepEqual(await firstStart('es-ES', 'it'), ['it', 'it', 'it'], 'a language chosen before is kept, and the example follows it');
  assert.deepEqual(errors, []);
});

test('one language button sets app and report in any of the 17 languages; the menu sets them apart', async (t) => {
  const { page, outside, errors } = await session(t);
  const all = await page.evaluate(() => I18N.LANGS.length);
  const langs = () => page.evaluate(() => [document.documentElement.lang, window.__valesta.state.meta.reportLang]);
  await page.click('.top [data-action="pop-lang"][data-key="both"]');
  await page.waitForSelector('#pop:not([hidden]) [data-lang="fr"]');
  assert.equal(await page.$$eval('#pop [data-lang]', (els) => els.length), all);
  assert.equal(await page.$$eval('#pop [data-lang] .r', (els) => els.length), 0, 'no language is marked as a draft');
  assert.deepEqual(await page.$$eval('#pop [data-lang]', (els) => els.map((e) => e.dataset.lang)),
    ['cs', 'da', 'de', 'en', 'es', 'fr', 'hr', 'it', 'hu', 'nl', 'nb', 'pl', 'pt', 'ro', 'sv', 'ru', 'zh'], 'in alphabetical order of their names');
  await page.click('#pop [data-lang="fr"]');
  await page.waitForFunction(() => document.documentElement.lang === 'fr');
  assert.deepEqual(await langs(), ['fr', 'fr']);
  const ui = await page.evaluate(() => ({
    newBtn: document.querySelector('#side [data-action="new"]').textContent.trim(), fr: UI_I18N.fr.newValuation, en: UI_I18N.en.newValuation,
    step: document.querySelector('#side [data-step="features"]').textContent.trim(), stepFr: UI_I18N.text(Workflow.STEPS.features.label, 'fr'),
  }));
  assert.ok(ui.fr !== ui.en && ui.newBtn.includes(ui.fr), `${ui.newBtn} · ${ui.fr}`);
  assert.ok(ui.stepFr !== 'Features' && ui.step.includes(ui.stepFr), `${ui.step} · ${ui.stepFr}`);
  // The menu: the report alone in German (the app stays in French), then the app alone in Portuguese.
  await page.click('#menu-btn');
  await page.click('#menu [data-action="pop-lang"][data-key="report"]');
  await page.waitForSelector('#pop:not([hidden]) [data-rl="de"]');
  assert.equal(await page.$$eval('#pop [data-rl]', (els) => els.length), all);
  await page.click('#pop [data-rl="de"]');
  assert.deepEqual(await langs(), ['fr', 'de']);
  await page.click('#menu-btn');
  await page.click('#menu [data-action="pop-lang"][data-key="ui"]');
  await page.waitForSelector('#pop:not([hidden]) [data-ul="pt"]');
  await page.click('#pop [data-ul="pt"]');
  await page.waitForFunction(() => document.documentElement.lang === 'pt');
  assert.deepEqual(await langs(), ['pt', 'de']);
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('the demo opens with the report in the language of the app', async (t) => {
  const { page, outside, errors } = await session(t);
  const reportLang = () => page.evaluate(() => window.__valesta.state.meta.reportLang);
  assert.equal(await reportLang(), 'it', 'first start');
  await page.click('#tab-body [data-action="pop-lang"][data-key="report"]');
  await page.click('#pop [data-rl="fr"]');
  assert.equal(await reportLang(), 'fr');
  await page.click('#brand-link');
  await page.waitForSelector('[data-action="home-demo"]');
  page.once('dialog', (d) => d.accept());
  await page.click('[data-action="home-demo"]');
  await page.waitForSelector('#side [data-step="identity"][aria-current="step"]', { state: 'attached' });
  assert.equal(await reportLang(), 'it');
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('the menu shows the version, when the app was built and from which code', async (t) => {
  const { page, errors } = await session(t);
  let commit = '';
  try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim(); } catch (e) { /* not a git checkout: date only */ }
  await page.click('#menu-btn');
  const text = await page.textContent('#menu-version');
  assert.match(text, /^Versione \d+\.\d+, compilata il \d{1,2} \S+ \d{4}, \d{2}:\d{2}/);
  if (commit) assert.ok(text.includes(` · ${commit}`), text);
  assert.deepEqual(errors, []);
});

test('at the first start a privacy window asks which outside services to use: refusing is as easy as accepting', async (t) => {
  const errors = [];
  const start = async () => {
    const context = await browser.newContext({ locale: 'it-IT', viewport: { width: 1360, height: 900 } });
    t.after(() => context.close());
    const outside = [];
    await context.route((url) => !/^http:\/\/127\.0\.0\.1:\d+\//.test(url.href), (route) => { outside.push(route.request().url()); return route.abort(); });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push('page error: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(`${base}/Valesta.html`);
    await page.waitForSelector('#dlg[open] [data-action="priv-accept-all"]');
    return { page, outside };
  };
  const stored = (page) => page.evaluate(() => ['valesta-maps-consent', 'valesta-geocoder', 'valesta-geodata', 'valesta-privacy-notice']
    .map((k) => JSON.parse(localStorage.getItem(k) || 'null')));
  const closed = (page) => page.waitForFunction(() => !document.querySelector('#dlg').open);

  // Refuse all: nothing is chosen in advance, nothing turns on or leaves the device, and the window does not come back.
  let { page, outside } = await start();
  assert.match(await page.textContent('#dlg h2'), /Privacy e servizi esterni/);
  assert.equal(await page.$$eval('#dlg [data-priv]', (els) => els.length), 3, 'maps, address search, geodata of the assistant');
  assert.equal(await page.$$eval('#dlg [data-priv]:checked', (els) => els.length), 0, 'nothing chosen in advance');
  await page.click('#dlg [data-action="priv-reject-all"]');
  await closed(page);
  let [maps, geo, geodata, notice] = await stored(page);
  assert.ok(!maps && !(geo && geo.provider !== 'off') && !geodata && notice && notice.seen, JSON.stringify([maps, geo, geodata, notice]));
  await page.reload();
  await page.waitForSelector('#side [data-step]', { state: 'attached' });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.querySelector('#dlg').open), false, 'shown once');
  assert.deepEqual(outside, []);

  // Accept all: maps, address search (Nominatim) and the geodata of the assistant are on, with the date; tiles follow.
  ({ page, outside } = await start());
  await page.click('#dlg [data-action="priv-accept-all"]');
  await closed(page);
  [maps, geo, geodata, notice] = await stored(page);
  assert.ok(maps.accepted && geo.provider === 'nominatim' && geo.accepted && geodata.accepted && notice.seen, JSON.stringify([maps, geo, geodata]));
  assert.ok(await page.evaluate(() => Maps.isAllowed()));
  await goStep(page, 'features');
  await page.waitForTimeout(800);
  assert.ok(outside.some((u) => /^https:\/\/www\.ign\.es\//.test(u)), 'map tiles after the choice');

  // One service only (the maps, so their tiles may load); then the close button, which keeps everything off as refusing does.
  ({ page } = await start());
  await page.check('#dlg [data-priv="maps"]');
  await page.click('#dlg [data-action="priv-save"]');
  await closed(page);
  [maps, geo, geodata] = await stored(page);
  assert.ok(maps && maps.accepted && !geo && !geodata, JSON.stringify([maps, geo, geodata]));
  ({ page, outside } = await start());
  await page.check('#dlg [data-priv="geo"]');
  await page.click('#dlg [data-action="dlg-close"]');
  await closed(page);
  [maps, geo, geodata, notice] = await stored(page);
  assert.ok(!maps && !geo && !geodata && notice && notice.seen, 'closing turns on nothing, not even what was ticked');
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('the Result and Delivery steps say that Valesta supports the valuer and does not replace them; the report does not', async (t) => {
  const { page, errors } = await session(t);
  const note = 'Valesta è uno strumento di supporto: non sostituisce il valutatore, che resta responsabile di dati, metodo e conclusioni.';
  for (const step of ['result', 'deliver']) {
    await goStep(page, step);
    assert.equal((await page.textContent('#tab-body .tool-note')).trim(), note, step);
  }
  await goStep(page, 'identity');
  assert.equal(await page.$('#tab-body .tool-note'), null, 'only on the Result and Delivery steps');
  const report = await page.evaluate(() => window.__valesta.buildReportHtml());
  assert.ok(!report.includes('strumento di supporto') && !report.includes('tool-note'), 'never in the report');
  assert.deepEqual(errors, []);
});
