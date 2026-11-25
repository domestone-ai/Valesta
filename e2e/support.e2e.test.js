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
// End-to-end tests of the invitation to support Valesta and of the feedback form, in the installed Chrome or Edge
// (playwright-core). The clock of the page and its storage are set by each test. Every request to an outside service
// is stopped and recorded: nothing may leave the device before the user opens a link. Needs a build (python -I build.py).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const DIST = path.join(__dirname, '..', 'dist');
const KEY = 'valesta-support';
const REPO = 'https://github.com/domestone-ai/Valesta';
const day = (d) => new Date(`${d}T10:00:00+01:00`);
const ELIGIBLE = (lastDay) => JSON.stringify({ v: 1, exports: 2, days: 2, lastDay, shown: '', until: '', off: false, gh: false });
let server = null;
let browser = null;
let base = '';

before(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'Valesta.html')), 'build first: python -I build.py');
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '');
    const file = path.resolve(DIST, rel);
    if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': /\.html$/.test(file) ? 'text/html; charset=utf-8' : 'application/octet-stream' });
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

// A fresh profile in Italian after the privacy window of the first start, its clock at `time`, its support
// preferences preset to `prefs` (raw text) when given. Outside requests are aborted and recorded.
async function session(t, o) {
  const opts = o || {};
  const context = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true,
    viewport: opts.viewport || { width: 1360, height: 900 }, reducedMotion: opts.reducedMotion || 'no-preference' });
  const outside = [];
  await context.route((url) => !/^http:\/\/127\.0\.0\.1:\d+\//.test(url.href), (route) => { outside.push(route.request().url()); return route.abort(); });
  await context.addInitScript(([key, prefs]) => {
    if (!localStorage.getItem('valesta-ui-lang')) localStorage.setItem('valesta-ui-lang', 'it');
    if (!localStorage.getItem('valesta-privacy-notice')) localStorage.setItem('valesta-privacy-notice', JSON.stringify({ seen: '2026-01-01T00:00:00.000Z' }));
    if (prefs != null && localStorage.getItem(key) === null) localStorage.setItem(key, prefs);
  }, [KEY, opts.prefs == null ? null : opts.prefs]);
  if (opts.init) await context.addInitScript(opts.init);
  const page = await context.newPage();
  await page.clock.setFixedTime(day(opts.day || '2026-11-24'));
  const errors = [];
  page.on('pageerror', (e) => errors.push('page error: ' + e.message));
  await page.goto(`${base}/Valesta.html`);
  await page.waitForSelector('#side [data-step]', { state: 'attached' });
  t.after(() => context.close());
  return { context, page, outside, errors };
}
// As a user does: when space is short the steps are a drawer, opened from the strip at the top of the step.
async function goStep(page, step) {
  if (await page.evaluate(() => document.getElementById('app').dataset.nav === 'drawer' && !document.getElementById('side').classList.contains('open'))) {
    await page.click('.step-strip [data-nav-toggle]');
    await page.waitForSelector('#side.open [data-step]');
  }
  await page.click(`#side [data-step="${step}"]`);
  await page.waitForSelector(`#side [data-step="${step}"][aria-current="step"]`, { state: 'attached' });
}
async function exportHtml(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#tab-body [data-action="export-html"]')]);
  return download;
}
const prefs = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const card = '#support-slot .sup-card';
const waitCard = (page) => page.waitForSelector(card, { timeout: 10000 });
async function noCard(page) {
  await page.waitForTimeout(5200); // longer than the pause after an export, which waits for its message to go
  assert.equal(await page.$(card), null, 'no invitation');
}
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName) : ''; });
// Escape, then the dialog's close event, which comes in a later task and moves the focus out of the dialog.
async function escape(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => { const d = document.getElementById('dlg'); return !d.open && !d.contains(document.activeElement); });
}
async function reloadOn(page, d) {
  await page.clock.setFixedTime(day(d));
  await page.reload();
  await page.waitForSelector('#side [data-step]', { state: 'attached' });
}

test('the Help menu opens “Sostieni Valesta” and the feedback form; Escape closes them and the focus returns', async (t) => {
  const { page, outside, errors } = await session(t);
  await page.click('#menu-btn');
  assert.equal((await page.textContent('#menu-title-help')).trim(), 'Aiuto');
  assert.equal((await page.textContent('#menu [data-action="support"] .lbl')).trim(), 'Sostieni il progetto');
  assert.equal((await page.textContent('#menu [data-action="feedback"] .lbl')).trim(), 'Invia feedback');
  await page.click('#menu [data-action="support"]');
  await page.waitForSelector('#dlg[open] .dlg-body.sup');
  assert.equal((await page.textContent('#dlg h2')).trim(), 'Sostieni Valesta');
  assert.match(await page.textContent('#dlg .sup-lead'), /progetto open source mantenuto da Domestone/);
  assert.match(await page.textContent('#dlg .sup-star'), /seleziona «Star»/);
  const gh = await page.$eval('#dlg a[data-sup="gh"]', (a) => [a.getAttribute('href'), a.target, a.rel]);
  assert.deepEqual(gh, [REPO, '_blank', 'noopener noreferrer']);
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.getElementById('dlg').contains(document.activeElement)), 'the focus stays in the dialog');
  await escape(page);
  assert.equal(await active(page), 'menu-btn', 'the focus goes back to the menu button');
  // Keyboard only: the menu button, then the item.
  await page.focus('#menu-btn');
  await page.keyboard.press('Enter');
  await page.focus('#menu [data-action="feedback"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#dlg[open] .dlg-body.fb');
  assert.equal(await active(page), 'fb-type', 'the form starts on its first field');
  await escape(page);
  assert.equal(await active(page), 'menu-btn');
  assert.deepEqual(outside, [], 'nothing requested from outside');
  assert.deepEqual(errors, []);
});

test('opening GitHub is recorded only as “opened”, never as a star, and only then is GitHub contacted', async (t) => {
  const { context, page, outside } = await session(t);
  await page.click('#menu-btn');
  await page.click('#menu [data-action="support"]');
  await page.waitForSelector('#dlg[open] .dlg-body.sup');
  assert.deepEqual(outside, []);
  const [popup] = await Promise.all([context.waitForEvent('page'), page.click('#dlg a[data-sup="gh"]')]);
  await popup.waitForLoadState().catch(() => null);
  assert.ok(outside.some((u) => u.replace(/\/$/, '') === REPO), outside.join());
  const p = await prefs(page);
  assert.equal(p.gh, true);
  assert.ok(!JSON.stringify(p).toLowerCase().includes('star'));
  assert.equal(await page.$eval('#dlg', (d) => d.open), true, 'the dialog stays open');
});

test('the invitation appears only after two successful exports on two different days, without taking the focus', async (t) => {
  const { page, outside, errors } = await session(t, { day: '2026-11-24' });
  await goStep(page, 'deliver');
  await exportHtml(page);
  await exportHtml(page);
  await noCard(page);
  assert.deepEqual(await prefs(page), { v: 1, exports: 2, days: 1, lastDay: '2026-11-24', shown: '', until: '', off: false, gh: false });
  await reloadOn(page, '2026-11-24');
  assert.equal((await prefs(page)).days, 1, 'a reload on the same day is not a new day');
  await reloadOn(page, '2026-11-25');
  assert.equal((await prefs(page)).days, 2);
  await goStep(page, 'deliver');
  await noCard(page); // not before an export in this run
  await exportHtml(page);
  await waitCard(page);
  assert.equal(await page.$eval(card, (c) => c.contains(document.activeElement)), false, 'the focus is not taken');
  assert.equal(await page.$eval(card, (c) => c.closest('[aria-live]') === null && !c.matches('[role="alert"], [role="status"]')), true, 'not announced');
  assert.equal((await page.textContent(`${card} h2`)).trim(), 'Valesta ti è utile?');
  assert.match(await page.textContent(card), /È un progetto open source di Domestone/);
  await page.$eval(card, (c) => c.scrollIntoView());
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).shown === '2026-11-25', KEY);
  assert.equal((await prefs(page)).until, '2027-02-23', 'seen: the next one waits 90 days');
  // Leaving the step removes it; it does not come back in this run.
  await goStep(page, 'style');
  assert.equal(await page.$(card), null);
  await goStep(page, 'deliver');
  await exportHtml(page);
  await noCard(page);
  assert.deepEqual(outside, []);
  assert.deepEqual(errors, []);
});

test('cancelled and failed exports count nothing', async (t) => {
  const init = () => {
    navigator.canShare = () => true;
    navigator.share = () => Promise.reject(new DOMException('Share canceled', 'AbortError'));
  };
  const { page } = await session(t, { init });
  await goStep(page, 'deliver');
  await page.click('#tab-body [data-action="share"]');
  await page.waitForTimeout(800);
  assert.equal((await prefs(page)).exports, 0, 'a cancelled share is not an export');
  await page.evaluate(() => { URL.createObjectURL = () => { throw new Error('blocked'); }; });
  await page.click('#tab-body [data-action="export-html"]');
  await page.waitForTimeout(800);
  assert.equal((await prefs(page)).exports, 0, 'a failed export is not counted');
});

test('Not now, the close button and Don’t show again: 90 days, then never; the focus moves to the step heading', async (t) => {
  const { page } = await session(t, { day: '2026-11-26', prefs: ELIGIBLE('2026-11-25') });
  await goStep(page, 'deliver');
  await exportHtml(page);
  await waitCard(page);
  await page.click(`${card} [data-sup="notnow"]`);
  assert.equal(await page.$(card), null);
  assert.equal(await active(page), 'H1');
  assert.equal((await prefs(page)).until, '2027-02-24');
  await exportHtml(page);
  await noCard(page);
  await reloadOn(page, '2027-02-23');
  await goStep(page, 'deliver');
  await exportHtml(page);
  await noCard(page);
  await reloadOn(page, '2027-02-24');
  await goStep(page, 'deliver');
  await exportHtml(page);
  await waitCard(page);
  await page.click(`${card} [data-sup="close"]`);
  assert.equal(await page.$(card), null);
  assert.equal((await prefs(page)).until, '2027-05-25');
  await reloadOn(page, '2027-05-25');
  await goStep(page, 'deliver');
  await exportHtml(page);
  await waitCard(page);
  await page.click(`${card} [data-sup="never"]`);
  assert.equal((await prefs(page)).off, true);
  await reloadOn(page, '2030-01-01');
  await goStep(page, 'deliver');
  await exportHtml(page);
  await noCard(page);
  // The menu still offers both, and the switch can turn the invitations back on.
  await page.click('#menu-btn');
  await page.click('#menu [data-action="support"]');
  assert.equal(await page.$eval('#dlg [data-sup="pref"]', (c) => c.checked), false);
  await page.check('#dlg [data-sup="pref"]');
  assert.equal((await prefs(page)).off, false);
});

test('the invitation waits while a dialog is open or a field has the focus, and comes at the next safe moment', async (t) => {
  const { page } = await session(t, { day: '2026-11-26', prefs: ELIGIBLE('2026-11-25') });
  await goStep(page, 'deliver');
  await exportHtml(page);
  await page.click('#menu-btn');
  await page.click('#menu [data-action="support"]');
  await noCard(page);
  await escape(page);
  await waitCard(page);
  // A field with the focus: the card waits for the next visit to the step.
  const second = await session(t, { day: '2026-11-26', prefs: ELIGIBLE('2026-11-25') });
  await goStep(second.page, 'deliver');
  await exportHtml(second.page);
  await second.page.focus('#dlv-lang');
  await noCard(second.page);
  await goStep(second.page, 'style');
  await goStep(second.page, 'deliver');
  await waitCard(second.page);
});

test('offline, with two tabs, with damaged or unavailable storage: no invitation, the menu still works', async (t) => {
  const off = await session(t, { day: '2026-11-26', prefs: ELIGIBLE('2026-11-25') });
  await goStep(off.page, 'deliver');
  await off.context.setOffline(true);
  await exportHtml(off.page);
  await noCard(off.page);
  // Two tabs: shown in the first, not in the second.
  const tabs = await session(t, { day: '2026-11-26', prefs: ELIGIBLE('2026-11-25') });
  const other = await tabs.context.newPage();
  await other.clock.setFixedTime(day('2026-11-26'));
  await other.goto(`${base}/Valesta.html`);
  await other.waitForSelector('#side [data-step]', { state: 'attached' });
  await goStep(tabs.page, 'deliver');
  await exportHtml(tabs.page);
  await waitCard(tabs.page);
  await tabs.page.$eval(card, (c) => c.scrollIntoView());
  await tabs.page.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).shown !== '', KEY);
  await goStep(other, 'deliver');
  await exportHtml(other);
  await noCard(other);
  // Damaged preferences: never overwritten by the app, no invitation.
  const bad = await session(t, { day: '2026-11-26', prefs: '{oops' });
  await goStep(bad.page, 'deliver');
  await exportHtml(bad.page);
  await exportHtml(bad.page);
  await noCard(bad.page);
  assert.equal(await bad.page.evaluate((k) => localStorage.getItem(k), KEY), '{oops');
  // Storage that cannot be read: the dialog says so, links still work.
  const init = () => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { if (k === 'valesta-support') throw new Error('blocked'); return get.call(this, k); };
  };
  const blocked = await session(t, { init });
  await blocked.page.click('#menu-btn');
  await blocked.page.click('#menu [data-action="support"]');
  assert.equal(await blocked.page.$('#dlg [data-sup="pref"]'), null);
  assert.match(await blocked.page.textContent('#dlg .sup-pref'), /non si possono salvare/);
  assert.equal(await blocked.page.$eval('#dlg a[data-sup="gh"]', (a) => a.href.replace(/\/$/, '')), REPO);
  assert.deepEqual(blocked.errors, []);
});

test('the feedback form checks its fields, shows and lets remove the technical details, never adds an e-mail', async (t) => {
  const { context, page, outside, errors } = await session(t);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  await goStep(page, 'deliver');
  await page.click('#menu-btn');
  await page.click('#menu [data-action="feedback"]');
  await page.waitForSelector('#dlg[open] .dlg-body.fb');
  assert.equal(await page.$('#dlg input[type="email"]'), null, 'no e-mail field: there is no private channel');
  assert.match(await page.textContent('#dlg .sup-note'), /Non includere indirizzi, dati dei clienti/);
  assert.equal((await page.textContent('#fb-gh-warn')).trim(), 'La segnalazione sarà pubblica e richiede un account GitHub.');
  await page.click('#dlg [data-sup="copy"]');
  assert.equal(await page.getAttribute('#fb-type', 'aria-invalid'), 'true');
  assert.equal((await page.textContent('#fb-type-err')).trim(), 'Scegli il tipo di segnalazione.');
  assert.equal((await page.textContent('#fb-what-err')).trim(), 'Descrivi che cosa è successo o che cosa manca.');
  assert.equal(await active(page), 'fb-type', 'the focus goes to the first field to fix');
  await page.selectOption('#fb-type', 'bug');
  assert.equal(await page.isChecked('#dlg [data-fb="tech"]'), true, 'technical details offered for a technical problem');
  const tech = await page.textContent('#fb-tech');
  const version = fs.readFileSync(path.join(__dirname, '..', 'build.py'), 'utf8').match(/^VERSION = "([^"]+)"$/m)[1];
  for (const s of ['Versione', `Valesta ${version}`, 'Piattaforma', 'Web · Chrome', 'Lingua dell’app', 'Sezione', 'deliver']) assert.ok(tech.includes(s), s);
  await page.fill('#fb-doing', 'Esportare il report');
  await page.fill('#fb-what', 'Il PDF esce senza la mappa.');
  assert.equal(await page.getAttribute('#fb-what', 'aria-invalid'), 'false');
  await page.uncheck('#dlg [data-fb="tech"]');
  const text = await page.textContent('#fb-text');
  assert.ok(text.includes('Il PDF esce senza la mappa.') && !text.includes('Versione'), 'without the technical details');
  await page.check('#dlg [data-fb="tech"]');
  // Copy: the exact text of the preview reaches the clipboard.
  await page.click('#dlg [data-sup="copy"]');
  await page.waitForFunction(() => /copiato negli appunti/.test(document.getElementById('fb-status').textContent));
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clip.replace(/\r\n/g, '\n'), await page.textContent('#fb-text'), 'the clipboard holds the text of the preview');
  // The public issue: explicit click, a new tab, the text in the link, no e-mail, no "sent".
  assert.deepEqual(outside, []);
  const [popup] = await Promise.all([context.waitForEvent('page'), page.click('#dlg a[data-sup="issue"]')]);
  await popup.waitForLoadState().catch(() => null);
  const issue = outside.find((u) => u.startsWith(`${REPO}/issues/new?`));
  assert.ok(issue, outside.join());
  const q = new URL(issue).searchParams;
  assert.equal(q.get('title'), 'Problema tecnico: Il PDF esce senza la mappa.');
  assert.ok(q.get('body').includes('Esportare il report') && q.get('body').includes(`Valesta ${version}`));
  assert.ok(!/@/.test(q.get('title') + q.get('body')), 'no e-mail address');
  const st = await page.textContent('#fb-status');
  assert.match(st, /la segnalazione arriva solo quando la pubblichi lì/);
  assert.ok(!/inviat/.test(st), 'no false message of success');
  assert.deepEqual(errors, []);
});

test('a text too long for a link is not cut: the first click asks to copy it, the next opens GitHub with the title', async (t) => {
  const { context, page, outside } = await session(t);
  await page.click('#menu-btn');
  await page.click('#menu [data-action="feedback"]');
  await page.waitForSelector('#dlg[open] .dlg-body.fb');
  await page.selectOption('#fb-type', 'usability');
  await page.fill('#fb-what', 'è'.repeat(4000));
  await page.click('#dlg a[data-sup="issue"]');
  await page.waitForFunction(() => /troppo lungo/.test(document.getElementById('fb-status').textContent));
  assert.deepEqual(outside, [], 'nothing opened yet');
  const [popup] = await Promise.all([context.waitForEvent('page'), page.click('#dlg a[data-sup="issue"]')]);
  await popup.waitForLoadState().catch(() => null);
  const q = new URL(outside.find((u) => u.includes('/issues/new?'))).searchParams;
  assert.equal(q.get('body'), '(Incolla qui il testo copiato da Valesta.)');
  assert.ok(q.get('title').startsWith('Difficoltà d’uso: èèè'));
});

test('a failed copy keeps the text, selected, and closing with text not taken anywhere asks first', async (t) => {
  const init = () => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } }); };
  const { page } = await session(t, { init });
  await page.click('#menu-btn');
  await page.click('#menu [data-action="feedback"]');
  await page.waitForSelector('#dlg[open] .dlg-body.fb');
  await page.selectOption('#fb-type', 'idea');
  await page.fill('#fb-what', 'Un riepilogo stampabile delle verifiche.');
  await page.click('#dlg [data-sup="copy"]');
  await page.waitForSelector('#fb-manual:not([hidden])');
  assert.ok((await page.inputValue('#fb-manual')).includes('Un riepilogo stampabile delle verifiche.'));
  assert.match(await page.textContent('#fb-status'), /Copia non riuscita/);
  assert.equal(await active(page), 'fb-manual');
  let asked = 0;
  page.once('dialog', (d) => { asked += 1; d.dismiss(); });
  await page.mouse.click(4, 4); // the backdrop
  await page.waitForTimeout(300);
  assert.equal(asked, 1);
  assert.equal(await page.$eval('#dlg', (d) => d.open), true, 'a click outside does not lose the text');
  page.once('dialog', (d) => { asked += 1; d.dismiss(); });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assert.equal(asked, 2);
  assert.equal(await page.$eval('#dlg', (d) => d.open), true, 'kept open');
  assert.equal(await page.inputValue('#fb-what'), 'Un riepilogo stampabile delle verifiche.', 'and the text with it');
  page.once('dialog', (d) => { asked += 1; d.accept(); });
  await page.click('#dlg [data-sup="x"]');
  await page.waitForTimeout(300);
  assert.equal(asked, 3);
  assert.equal(await page.$eval('#dlg', (d) => d.open), false);
});

test('with reduced motion the card appears without animation; the security channel is separate', async (t) => {
  const { page } = await session(t, { day: '2026-11-26', prefs: ELIGIBLE('2026-11-25'), reducedMotion: 'reduce' });
  await goStep(page, 'deliver');
  await exportHtml(page);
  await waitCard(page);
  assert.equal(await page.$eval(card, (c) => getComputedStyle(c).animationName), 'none');
  await page.click(`${card} [data-sup="feedback"]`);
  await page.waitForSelector('#dlg[open] .dlg-body.fb');
  assert.equal(await page.$eval('#dlg .fb-sec a', (a) => a.getAttribute('href')), `${REPO}/security/advisories/new`);
  assert.match(await page.textContent('#dlg .fb-sec'), /non usare questo modulo né le segnalazioni pubbliche/);
  await escape(page);
  assert.equal(await active(page), 'H1', 'opened from the card: the focus goes to the step heading');
  assert.equal((await prefs(page)).until, '2027-02-24', 'the feedback form postpones the invitation');
});

test('on a phone and at 200 % zoom the card and the dialogs fit the width', async (t) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 680, height: 450 }]) {
    const { page } = await session(t, { day: '2026-11-26', prefs: ELIGIBLE('2026-11-25'), viewport });
    await page.evaluate(() => window.__valesta.goStep('deliver'));
    await exportHtml(page);
    await waitCard(page);
    const fits = (sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= window.innerWidth + 1 && el.scrollWidth <= el.clientWidth + 1; });
    assert.ok(await fits(card), `card at ${viewport.width}px`);
    await page.click(`${card} [data-sup="feedback"]`);
    await page.waitForSelector('#dlg[open] .dlg-body.fb');
    assert.ok(await fits('#dlg'), `feedback form at ${viewport.width}px`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  }
});

test('exports and the report are unchanged: no trace of the invitation in the exported file', async (t) => {
  const { page } = await session(t, { day: '2026-11-26', prefs: ELIGIBLE('2026-11-25') });
  await goStep(page, 'deliver');
  const download = await exportHtml(page);
  await waitCard(page);
  const html = fs.readFileSync(await download.path(), 'utf8');
  for (const s of ['sup-card', 'support-slot', 'Valesta ti è utile', 'github.com/domestone-ai']) assert.ok(!html.includes(s), s);
  const report = await page.evaluate(() => window.__valesta.buildReportHtml());
  assert.ok(!report.includes('sup-card') && !report.includes('Sostieni'));
  assert.equal(await page.$$eval('#tab-body .opts .ocard', (els) => els.length) >= 4, true, 'all the delivery formats are still there');
});
