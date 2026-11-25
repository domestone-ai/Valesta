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
const zlib = require('node:zlib');
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

// The drawing of a PDF made by Chrome: the fill colours ("r g b rg") and the gradients ("scn") of its compressed page
// streams, read with zlib (no other tool).
function pdfDrawing(buf) {
  const s = buf.toString('latin1');
  const re = /(?<!end)stream\r?\n/g;
  let m;
  let txt = '';
  while ((m = re.exec(s))) {
    const end = s.indexOf('endstream', m.index);
    if (end < 0) break;
    try {
      const t = zlib.inflateSync(Buffer.from(s.slice(m.index + m[0].length, end), 'latin1'), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('latin1');
      if (/\b(re|cm|rg)\b/.test(t) && !t.includes('\u0000')) txt += t + '\n';
    } catch (e) { /* not a page stream: fonts, images */ }
    re.lastIndex = end + 9;
  }
  return { fills: (txt.match(/[-.0-9]+ [-.0-9]+ [-.0-9]+ rg/g) || []).sort(), gradients: (txt.match(/\bscn\b/g) || []).length };
}

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
  await openSec(page, 'brand');
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
  await openSec(page, 'profile');
  assert.ok((await labels()).includes('Studio Rossi'));

  // A change of an own profile: "save to the profile" is the main button and saves it.
  await openSec(page, 'brand');
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
  await openSec(page, 'profile');
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

const tabSel = (k) => `#tab-body .st-tabs [role="tab"][data-key="${k}"]`;
const openSec = async (page, k) => { await page.click(tabSel(k)); await page.waitForSelector(`${tabSel(k)}[aria-selected="true"]`); };
// Moves a slider as a hand would: a new value and an input event.
const slide = (page, sel, v) => page.$eval(sel, (el, x) => { el.value = x; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
// True when the report page at the top of the preview is the cover (or, with cover = false, an inner page).
const previewTop = (page, cover) => page.waitForFunction((want) => {
  const top = document.getElementById('pv-scroll').getBoundingClientRect().top;
  const p = [...document.querySelectorAll('#report .page')].find((x) => x.getBoundingClientRect().bottom > top + 40);
  return !!p && p.classList.contains('page--cover') === want;
}, cover);

test('style step: six sections as tabs; arrow keys, Home and End move between them; the choice is kept; the preview shows the page of the section', async (t) => {
  const { page, outside, errors } = await session(t);
  await goStep(page, 'style');
  const keys = await page.$$eval('#tab-body .st-tabs [role="tab"]', (els) => els.map((e) => e.dataset.key));
  assert.deepEqual(keys, ['profile', 'model', 'brand', 'cover', 'type', 'pages']);
  assert.equal(await page.getAttribute(tabSel('profile'), 'aria-selected'), 'true', 'the profiles come first');
  assert.ok(await page.$('#st-panel[role="tabpanel"] .prof-grid'));
  assert.ok((await page.textContent('#st-panel .st-lead')).trim().length > 20, 'each section says what it does');
  await page.focus(tabSel('profile'));
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector(`${tabSel('model')}[aria-selected="true"]`);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.key), 'model', 'the focus follows');
  assert.ok(await page.$('#st-panel [data-action="design-preset"][data-key="full"]'));
  await page.keyboard.press('End');
  await page.waitForSelector(`${tabSel('pages')}[aria-selected="true"]`);
  await page.keyboard.press('Home');
  await page.waitForSelector(`${tabSel('profile')}[aria-selected="true"]`);
  await page.keyboard.press('ArrowLeft');
  await page.waitForSelector(`${tabSel('pages')}[aria-selected="true"]`);
  assert.equal(await page.$$eval('#tab-body .st-tabs [role="tab"][tabindex="0"]', (els) => els.length), 1, 'one tab in the Tab order');
  await previewTop(page, false);
  await openSec(page, 'brand');
  assert.ok(await page.$('#st-panel [data-bind="brand.primary"]'));
  assert.ok(await page.$('#st-panel [data-bind="meta.office.name"]'), 'the agency data are in the brand section');
  await openSec(page, 'cover');
  await previewTop(page, true);
  await openSec(page, 'type');
  await page.reload();
  await page.waitForSelector('#side [data-step]', { state: 'attached' });
  await goStep(page, 'style');
  assert.equal(await page.getAttribute(tabSel('type'), 'aria-selected'), 'true', 'the section is kept');
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('cover designer: a white background stays white with dark texts; the logo slider and position change the cover; a weak contrast is reported', async (t) => {
  const { page, outside, errors } = await session(t);
  await goStep(page, 'style');
  await openSec(page, 'cover');
  const cover = '#report .page--cover';
  const hasCls = (c) => page.waitForFunction(([sel, x]) => document.querySelector(sel).classList.contains(x), [cover, c]);
  for (const k of ['map', 'photo', 'pattern', 'minimal']) assert.ok(await page.$(`#st-panel [data-action="cv-start"][data-key="${k}"]`), k);
  assert.equal(await page.evaluate(() => (window.__valesta.state.design.cover || {}).bg), undefined, 'looking writes nothing');
  await page.click('#st-panel [data-action="cv-set"][data-key="bg.type"][data-val="solid"]');
  await hasCls('cv-bg-solid');
  assert.equal(await page.evaluate(() => window.__valesta.state.design.cover.shade.opacity), 0, 'the shade of the map does not stay over a colour');
  await page.click('#st-panel [data-action="cv-set"][data-key="bg.c1"][data-val="white"]');
  await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel + ' .cover-visual')).backgroundColor === 'rgb(255, 255, 255)', cover);
  await hasCls('cv-txt-dark');
  assert.notEqual(await page.$eval(`${cover} .cover-title`, (e) => getComputedStyle(e).color), 'rgb(255, 255, 255)', 'dark title');
  assert.equal(await page.getAttribute('#st-panel [data-action="cv-set"][data-key="bg.c1"][data-val="white"]', 'aria-pressed'), 'true');
  const note = '#st-panel [data-live="cv-contrast"]';
  assert.equal(await page.$eval(note, (e) => e.classList.contains('low')), false);
  assert.equal(await page.getAttribute(note, 'role'), 'status');
  await page.click('#st-panel [data-action="cv-set"][data-key="text.color"][data-val="light"]');
  await page.waitForSelector(`${note}.low`);
  await page.click('#st-panel [data-action="cv-set"][data-key="text.color"][data-val="auto"]');
  await page.waitForSelector(`${note}:not(.low)`);
  await slide(page, '#st-panel input[data-bind="design.cover.logo.size"]', 24);
  await page.waitForFunction((sel) => /--cv-logo-h:\s*24mm/.test(document.querySelector(sel).getAttribute('style')), cover);
  assert.equal((await page.textContent('#st-panel output[for="cv-logo-size"]')).trim(), '24 mm');
  await page.click('#st-panel [data-action="cv-set"][data-key="logo.pos"][data-val="tc"]');
  await hasCls('cv-logo-tc');
  await page.click('#st-panel [data-action="cv-set"][data-key="bg.type"][data-val="gradient"]');
  await hasCls('cv-bg-gradient');
  assert.ok(await page.$('#st-panel input[data-bind="design.cover.bg.angle"]'), 'a gradient has a direction');
  assert.ok(await page.$('#st-panel [data-action="cv-set"][data-key="bg.c2"][data-val="accent"]'), 'and a second colour');
  await slide(page, '#st-panel input[data-bind="design.cover.shade.opacity"]', 40);
  await page.waitForFunction((sel) => /--cv-so:\s*0?\.4/.test(document.querySelector(sel).getAttribute('style')), cover);
  await page.click('#st-panel [data-action="cv-start"][data-key="map"]');
  await hasCls('cv-bg-map');
  const L = await page.evaluate(() => window.__valesta.state.design.cover);
  assert.equal(L.bg.type, 'map');
  assert.equal(L.logo.size, 24, 'a starting point keeps the logo');
  assert.equal(L.logo.pos, 'tc');
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('type and pages: a font pair sets both fonts; the size slider, the spacing and the logo of the headers change the report', async (t) => {
  const { page, outside, errors } = await session(t);
  await goStep(page, 'style');
  await openSec(page, 'type');
  const css = (re) => page.waitForFunction((src) => new RegExp(src).test(document.getElementById('css-brand').textContent), re.source);
  await page.click('#st-panel [data-action="type-pair"][data-key="modern"]');
  await css(/--serif:'Montserrat'/);
  assert.equal(await page.getAttribute('#st-panel [data-action="type-pair"][data-key="modern"]', 'aria-pressed'), 'true');
  await slide(page, '#st-panel input[data-bind="design.textScale"]', 1.1);
  await css(/--ts:1\.1[;}]/);
  assert.equal((await page.textContent('#st-panel output[for="ty-scale"]')).trim(), '110%');
  await page.click('#st-panel [data-action="design-set"][data-key="density"][data-val="airy"]');
  await css(/--lh:1\.6/);
  assert.ok(await page.$('#st-panel .font-preview'), 'a sample on paper');
  await openSec(page, 'pages');
  await page.click('#st-panel [data-action="design-set"][data-key="headerLogo"][data-val="L"]');
  await css(/--hl:9mm/);
  for (const p of ['design.footerNote', 'design.watermark', 'design.pageNumbers', 'design.autoFit']) assert.ok(await page.$(`#st-panel [data-bind="${p}"]`), p);
  assert.equal(await page.$eval('#st-panel [data-bind="design.pageNumbers"]', (e) => e.checked), true);
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('cover designer: every control has a name; a very wide logo at 30 mm stays on the page; the layers print without background graphics', async (t) => {
  const { page, outside, errors } = await session(t);
  await goStep(page, 'style');
  await openSec(page, 'cover');
  const unnamed = await page.$$eval('#st-panel button, #st-panel input, #st-panel select', (els) => els
    .filter((e) => !(e.getAttribute('aria-label') || (e.labels && e.labels.length) || e.textContent.trim() || e.title))
    .map((e) => e.outerHTML.slice(0, 80)));
  assert.deepEqual(unnamed, [], 'every control of the cover has an accessible name');
  // A logo ten times wider than high, at the largest size.
  await openSec(page, 'brand');
  await page.selectOption('#st-panel [data-bind="brand.logoMode"]', 'custom');
  await page.waitForSelector('#st-panel [data-action="logo-upload"][data-key="logoLight"]');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="100" viewBox="0 0 1200 100"><rect width="1200" height="100" fill="#123456"/></svg>';
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#st-panel [data-action="logo-upload"][data-key="logoLight"]')]);
  await chooser.setFiles({ name: 'wide-logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await page.waitForFunction(() => !!window.__valesta.state.brand.logoLight);
  await openSec(page, 'cover');
  await page.click('#st-panel [data-action="cv-start"][data-key="minimal"]');
  const logoBox = async (mm) => {
    await slide(page, '#st-panel input[data-bind="design.cover.logo.size"]', mm);
    await page.waitForFunction((h) => new RegExp(`--cv-logo-h:\\s*${h}mm`).test(document.querySelector('#report .page--cover').getAttribute('style')), mm);
    await page.waitForFunction(() => { const i = document.querySelector('#report .page--cover .brand-logo img'); return i && i.complete && i.getBoundingClientRect().width > 0; });
    return page.evaluate(() => {
      const p = document.querySelector('#report .page--cover').getBoundingClientRect();
      const i = document.querySelector('#report .page--cover .brand-logo img').getBoundingClientRect();
      return { w: (i.width * 210) / p.width, left: i.left - p.left, right: p.right - i.right };
    });
  };
  const at14 = await logoBox(14);
  assert.ok(at14.w <= 62.5, `at the default height a wide logo is at most 62 mm wide, as in 1.0.0 (${at14.w.toFixed(1)} mm)`);
  const box = await logoBox(30);
  assert.ok(box.w <= 90.5, `at most 90 mm wide (${box.w.toFixed(1)} mm)`);
  assert.ok(box.left >= 0 && box.right >= 0, 'inside the page');
  // PDF without "background graphics": the layers of the cover still print (print-color-adjust on the pages). Compared:
  // the gradients and the fill colours that page 1 draws, with and without background graphics. Only the white of the
  // canvas outside the pages may drop.
  await page.click('#st-panel [data-action="cv-set"][data-key="bg.type"][data-val="gradient"]');
  await page.click('#st-panel [data-action="cv-set"][data-key="motif.type"][data-val="grid"]');
  await slide(page, '#st-panel input[data-bind="design.cover.shade.opacity"]', 60);
  await page.waitForFunction(() => /--cv-so:\s*0?\.6/.test(document.querySelector('#report .page--cover').getAttribute('style')));
  const html = await page.evaluate(() => window.__valesta.buildReportHtml());
  const doc = await page.context().newPage();
  await doc.setContent(html, { waitUntil: 'load' });
  await doc.evaluate(() => document.fonts.ready);
  const on = pdfDrawing(await doc.pdf({ format: 'A4', printBackground: true, pageRanges: '1', preferCSSPageSize: true }));
  const off = pdfDrawing(await doc.pdf({ format: 'A4', printBackground: false, pageRanges: '1', preferCSSPageSize: true }));
  await doc.close();
  assert.ok(on.gradients > 0, 'the gradient of the cover is in the PDF');
  assert.equal(off.gradients, on.gradients, 'the gradient prints without background graphics');
  const dropped = on.fills.slice();
  off.fills.forEach((f) => { const i = dropped.indexOf(f); if (i >= 0) dropped.splice(i, 1); });
  assert.deepEqual(dropped.filter((f) => f !== '1 1 1 rg'), [], 'every colour of the cover prints without background graphics');
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});
