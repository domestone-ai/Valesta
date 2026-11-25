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
// End-to-end tests of the "Style and brand" step: profiles, sections, cover designer, type and pages. Same set-up as
// app.e2e.test.js: a build in dist/, the installed Chrome or Edge, outside requests stopped and recorded.
// Run: node --test e2e/
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
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

// A fresh browser profile in Italian, as after the privacy window of the first start (every service off).
async function session(t) {
  const context = await browser.newContext({ locale: 'it-IT', viewport: { width: 1360, height: 900 } });
  const outside = [];
  await context.route((url) => !/^http:\/\/127\.0\.0\.1:\d+\//.test(url.href), (route) => { outside.push(route.request().url()); return route.abort(); });
  await context.addInitScript(() => {
    if (!localStorage.getItem('valesta-ui-lang')) localStorage.setItem('valesta-ui-lang', 'it');
    if (!localStorage.getItem('valesta-privacy-notice')) localStorage.setItem('valesta-privacy-notice', JSON.stringify({ seen: '2026-01-01T00:00:00.000Z' }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/Valesta.html`);
  await page.waitForSelector('#side [data-step]', { state: 'attached' });
  t.after(() => context.close());
  return { page, outside, errors };
}
const goStep = async (page, step) => {
  if (await page.evaluate(() => document.getElementById('app').dataset.nav === 'drawer' && !document.getElementById('side').classList.contains('open'))) {
    await page.click('.step-strip [data-nav-toggle]');
    await page.waitForSelector('#side.open [data-step]');
  }
  await page.click(`#side [data-step="${step}"]`);
  await page.waitForSelector(`#side [data-step="${step}"][aria-current="step"]`, { state: 'attached' });
};

const BAR = '#tab-body .prof-bar';
const nameWindow = (page) => page.waitForSelector('#dlg[open] #dlg-name');
const windowOpen = (page) => page.evaluate(() => document.getElementById('dlg').open);

test('profiles: the bar shows the profile in use and its state; save as new, save, rename and duplicate ask for a name in the app’s window', async (t) => {
  const { page, outside, errors } = await session(t);
  await goStep(page, 'style');
  const barState = () => page.getAttribute(BAR, 'data-state');
  const barName = async () => (await page.textContent(`${BAR} .pb-name`)).trim();
  const labels = () => page.$$eval('#tab-body .prof .prof-meta b', (els) => els.map((e) => e.textContent.trim()));
  const isMain = (sel) => page.$eval(sel, (b) => b.classList.contains('btn-primary'));
  assert.equal(await barState(), 'example');
  assert.equal(await barName(), 'Valesta');
  assert.equal(await page.$(`${BAR} [data-action="prof-save"]`), null, 'an included example is not overwritten');
  assert.equal(await page.$('#tab-body .prof [data-action="prof-rename"][data-id="valesta"]'), null);
  assert.ok(await page.$('#tab-body .prof [data-action="prof-dup"][data-id="valesta"]'), 'an example can be duplicated');

  // A change of the brand: the valuation no longer looks like the example; "save as new" becomes the main button.
  await page.fill('#tab-body [data-bind="brand.name"]', 'Studio Rossi');
  await page.waitForSelector(`${BAR}[data-state="dirty"]`);
  assert.equal(await isMain(`${BAR} [data-action="prof-new"]`), true);
  await page.click(`${BAR} [data-action="prof-new"]`);
  await nameWindow(page);
  assert.equal(await page.inputValue('#dlg-name'), 'Studio Rossi', 'the brand name is proposed');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'dlg-name', 'the name field has the focus');
  await page.keyboard.press('Enter');
  await page.waitForSelector(`${BAR}[data-state="saved"]`);
  assert.equal(await barName(), 'Studio Rossi');
  assert.equal(await windowOpen(page), false);
  assert.ok((await labels()).includes('Studio Rossi'));

  // A change of an own profile: "save to the profile" is the main button and saves it.
  await page.fill('#tab-body [data-bind="brand.name"]', 'Studio Rossi Valutazioni');
  await page.waitForSelector(`${BAR}[data-state="dirty"]`);
  assert.equal(await isMain(`${BAR} [data-action="prof-save"]`), true);
  await page.click(`${BAR} [data-action="prof-save"]`);
  await page.waitForSelector(`${BAR}[data-state="saved"]`);

  // Rename from the bar: the current name is proposed.
  await page.click(`${BAR} [data-action="prof-rename"]`);
  await nameWindow(page);
  assert.equal(await page.inputValue('#dlg-name'), 'Studio Rossi');
  await page.fill('#dlg-name', 'Rossi – stile 2027');
  await page.click('#dlg button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('#tab-body .prof-bar .pb-name').textContent.trim() === 'Rossi – stile 2027');
  assert.ok((await labels()).includes('Rossi – stile 2027'));
  assert.equal(await barState(), 'saved', 'a new name is no change of the look');

  // Duplicate from the card: "name – copy" is proposed; Escape creates nothing; the profile in use stays.
  const count = (await labels()).length;
  const dup = '#tab-body .prof.on [data-action="prof-dup"]';
  await page.click(dup);
  await nameWindow(page);
  assert.equal(await page.inputValue('#dlg-name'), 'Rossi – stile 2027 – copia');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('dlg').open);
  assert.equal((await labels()).length, count, 'Escape creates nothing');
  await page.click(dup);
  await nameWindow(page);
  await page.fill('#dlg-name', 'Rossi – banca');
  await page.keyboard.press('Enter');
  await page.waitForFunction((n) => document.querySelectorAll('#tab-body .prof').length === n, count + 1);
  assert.ok((await labels()).includes('Rossi – banca'));
  assert.equal(await barName(), 'Rossi – stile 2027', 'the profile in use stays');

  // After a new start the valuation still matches its profile.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForSelector('#side [data-step]', { state: 'attached' });
  await goStep(page, 'style');
  assert.equal(await barName(), 'Rossi – stile 2027');
  assert.equal(await barState(), 'saved');
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('the name window: a blank name is refused, Cancel closes it, on a phone it stays a small window', async (t) => {
  const { page, errors } = await session(t);
  await goStep(page, 'style');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.click(`${BAR} [data-action="prof-new"]`);
  await nameWindow(page);
  const box = await page.$eval('#dlg', (d) => { const r = d.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  assert.ok(box.w <= 366 + 1 && box.h < 400, JSON.stringify(box));
  await page.fill('#dlg-name', '   ');
  await page.keyboard.press('Enter');
  assert.equal(await windowOpen(page), true, 'a blank name is not accepted');
  await page.click('#dlg .dlg-foot [data-action="dlg-close"]');
  await page.waitForFunction(() => !document.getElementById('dlg').open);
  assert.equal(await page.getAttribute(BAR, 'data-state'), 'example');
  assert.equal(await page.evaluate(() => document.getElementById('dlg').classList.contains('dlg-small')), false, 'the next window has its normal size');
  assert.deepEqual(errors, []);
});
