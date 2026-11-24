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
/* ValestaSupport — an optional, quiet invitation to support Valesta on GitHub, and a feedback form.
 * - Nothing leaves the device by itself: no telemetry, no account, no request until the user opens a link.
 * - The preferences stay on this device in localStorage ("valesta-support"), apart from valuations and exports.
 * - The invitation may appear on the Delivery step after two successful report exports on two different local days;
 *   once seen it waits 90 days; "Don't show again" and opening GitHub stop it. Opening GitHub is not a star.
 * Rules, stored data and channels: docs/support-and-feedback.md. */
(function (root, factory) {
  const mod = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.ValestaSupport = mod;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const KEY = 'valesta-support';
  const VERSION = 1;
  const NEED = { exports: 2, days: 2 };    // successful report exports, distinct local days of use
  const WAIT_DAYS = 90;                     // after the invitation was seen, "Not now", closing it, or the feedback form
  const QUIET_AFTER_ERROR = 60000;          // no invitation in the minute after an error
  const SHOW_DELAY = 4500;                  // after the export, once its message (4.2 s) has gone
  const MAX_URL = 7000;                     // a longer link to GitHub is not used: the text is copied instead
  // Where support and feedback go. Public issues and private vulnerability reports are settings of the repository on
  // GitHub, to check before a release (docs/support-and-feedback.md). There is no private channel for feedback.
  const REPO = 'https://github.com/domestone-ai/Valesta';
  const CHANNELS = { issues: true, security: true };
  // false: a build without the automatic invitation (for example a white-label deployment); the Help menu stays.
  const INVITE = true;
  const TYPES = ['bug', 'usability', 'idea', 'method', 'other'];

  // ---------- local calendar days ("YYYY-MM-DD") ----------
  const pad = (n) => String(n).padStart(2, '0');
  const today = (d) => { const x = d || new Date(); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const dateOf = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && today(dateOf(s)) === s;
  const addDays = (s, n) => { const d = dateOf(s); d.setDate(d.getDate() + n); return today(d); };
  const later = (a, b) => (a && a > b ? a : b);

  // ---------- preferences on this device ----------
  const fresh = () => ({ v: VERSION, exports: 0, days: 0, lastDay: '', shown: '', until: '', off: false, gh: false });
  const isCount = (n) => Number.isInteger(n) && n >= 0;
  const dayOrNone = (s) => s === '' || isDay(s);
  // The stored preferences, checked field by field. Anything unexpected makes them unreliable: then no invitation
  // appears and nothing is written over them, except an explicit choice of the user.
  function parse(raw) {
    if (raw == null) return { ok: true, prefs: fresh() };
    let o;
    try { o = JSON.parse(raw); } catch (e) { return { ok: false, reason: 'damaged' }; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, reason: 'damaged' };
    if (o.v !== VERSION) return { ok: false, reason: typeof o.v === 'number' && o.v > VERSION ? 'newer' : 'damaged' };
    if (!isCount(o.exports) || !isCount(o.days) || typeof o.off !== 'boolean' || typeof o.gh !== 'boolean'
      || !dayOrNone(o.lastDay) || !dayOrNone(o.shown) || !dayOrNone(o.until)) return { ok: false, reason: 'damaged' };
    return { ok: true, prefs: { v: VERSION, exports: Math.min(o.exports, NEED.exports), days: Math.min(o.days, NEED.days), lastDay: o.lastDay, shown: o.shown, until: o.until, off: o.off, gh: o.gh } };
  }
  function read(storage) {
    let raw;
    try {
      if (!storage) return { ok: false, reason: 'unavailable' };
      raw = storage.getItem(KEY);
    } catch (e) { return { ok: false, reason: 'unavailable' }; }
    return parse(raw);
  }
  function write(storage, p) {
    const out = { v: VERSION, exports: p.exports, days: p.days, lastDay: p.lastDay, shown: p.shown, until: p.until, off: p.off, gh: p.gh };
    try { storage.setItem(KEY, JSON.stringify(out)); return true; } catch (e) { return false; }
  }
  // Reads, changes and saves. Returns the saved preferences, or null when they could not be read or saved.
  function update(storage, change, explicit) {
    const r = read(storage);
    if (!r.ok && (!explicit || r.reason === 'unavailable')) return null;
    const p = r.ok ? r.prefs : fresh();
    change(p);
    return write(storage, p) ? p : null;
  }
  function countDay(p, day) {
    if (p.lastDay === day) return;
    p.days = Math.min(NEED.days, p.days + 1);
    p.lastDay = day;
  }
  // The app was opened on this local day: reloading it the same day adds nothing.
  const noteDay = (storage, day) => update(storage, (p) => countDay(p, day));
  // A report export ended; only ok === true counts (see exported() for what success means).
  const countExport = (storage, ok, day) => (ok === true ? update(storage, (p) => { countDay(p, day); p.exports = Math.min(NEED.exports, p.exports + 1); }) : null);
  // The invitation was seen: the next one waits 90 days.
  const noteShown = (storage, day) => update(storage, (p) => { p.shown = day; p.until = later(p.until, addDays(day, WAIT_DAYS)); });
  const wait = (p, day) => { p.until = later(p.until, addDays(day, WAIT_DAYS)); };
  const ACTIONS = {
    notnow: wait, close: wait, feedback: wait,
    never: (p) => { p.off = true; },
    off: (p) => { p.off = true; },
    github: (p) => { p.gh = true; },
    on: (p) => { p.off = false; p.gh = false; },
  };
  const EXPLICIT = { never: true, off: true, github: true, on: true };
  function act(storage, action, day) {
    const f = ACTIONS[action];
    return f ? update(storage, (p) => f(p, day), !!EXPLICIT[action]) : null;
  }
  // The automatic invitation is on: not turned off, GitHub not opened from Valesta, preferences readable.
  const showsInvites = (r) => !!(r && r.ok && !r.prefs.off && !r.prefs.gh);
  function eligible(r, day) {
    if (!showsInvites(r)) return false;
    const p = r.prefs;
    return p.exports >= NEED.exports && p.days >= NEED.days && (!p.until || day >= p.until);
  }

  // ---------- feedback: checks, technical details, text, links ----------
  const clean = (s) => String(s == null ? '' : s).trim();
  function validate(f) {
    const e = {};
    if (!TYPES.includes(f && f.type)) e.type = 'fbErrType';
    if (!clean(f && f.what)) e.what = 'fbErrWhat';
    return e;
  }
  // Where the app runs, coarsely: Web or the app, browser and major version, operating system. No full browser string.
  function platform(ua, native) {
    const s = String(ua || '');
    const v = (re) => { const m = re.exec(s); return m ? m[1] : ''; };
    const edge = v(/Edg(?:A|iOS)?\/(\d+)/);
    const firefox = v(/(?:Firefox|FxiOS)\/(\d+)/);
    const chrome = v(/(?:Chrome|CriOS)\/(\d+)/);
    const safari = v(/Version\/(\d+)[\d.]*(?: Mobile\/\S+)? Safari\//);
    const browser = edge ? 'Edge ' + edge : firefox ? 'Firefox ' + firefox : chrome ? 'Chrome ' + chrome : safari ? 'Safari ' + safari : '';
    const os = /Android/.test(s) ? 'Android' : /iPhone|iPad|iPod/.test(s) ? 'iOS' : /Windows/.test(s) ? 'Windows'
      : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /Linux|X11|CrOS/.test(s) ? 'Linux' : '';
    const where = native === 'android' ? 'App Android' : native === 'ios' ? 'App iOS' : 'Web';
    return [where, browser, os].filter(Boolean).join(' · ');
  }
  // The technical details the user may add: version, platform, language of the app, section. Nothing of the valuation.
  function techRows(env) {
    const e = env || {};
    return [['fbTechVer', clean(e.version)], ['fbTechPlat', platform(e.ua, e.native)], ['fbTechLang', clean(e.lang)], ['fbTechSec', clean(e.section)]].filter((r) => r[1]);
  }
  // The text to share, in the language of the app: type, the two answers and, when chosen, the technical details.
  // Nothing else of the form goes in (never an e-mail address).
  function compose(f, rows, t) {
    const types = t('fbTypes') || {};
    const type = types[f.type] || '';
    const what = clean(f.what);
    const doing = clean(f.doing);
    const first = what.split(/\r?\n/)[0];
    const summary = first.length > 72 ? first.slice(0, 71).trimEnd() + '…' : first;
    const parts = [`${t('fbType')}: ${type}`];
    if (doing) parts.push(`${t('fbDoing')}\n${doing}`);
    parts.push(`${t('fbWhat')}\n${what}`);
    if (rows && rows.length) parts.push(`${t('fbTechT')}\n${rows.map((r) => `- ${t(r[0])}: ${r[1]}`).join('\n')}`);
    return { title: [type, summary].filter(Boolean).join(': '), body: parts.join('\n\n') };
  }
  function links() {
    return { repo: REPO, issues: CHANNELS.issues ? REPO + '/issues/new' : null, security: CHANNELS.security ? REPO + '/security/advisories/new' : null };
  }
  // A link to a new public issue with the text filled in. A text too long for a link is never cut: the link then
  // carries the title and the request to paste the copied text (paste), and tooLong tells the form to copy first.
  function issueLink(title, body, paste) {
    const base = links().issues;
    if (!base) return { url: null, tooLong: false };
    const url = (b) => `${base}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(b)}`;
    const full = url(body);
    return full.length <= MAX_URL ? { url: full, tooLong: false } : { url: url(paste || ''), tooLong: true };
  }

  // ---------- in the app (browser only) ----------
  // host, from the editor: t, esc, ic, closeDialog, lang(), version(), native ('' | 'android' | 'ios').
  let host = null;
  const run = { pending: false, shown: false, card: null, io: null, view: '', composing: false, lastError: 0, opener: null, draft: null, timer: 0 };
  const doc = () => root.document;
  const $ = (s) => doc().querySelector(s);
  const store = () => { try { return root.localStorage; } catch (e) { return null; } };
  const day = () => today(new Date());
  const tt = (k) => host.t(k);
  const E = (s) => host.esc(s);
  const newTab = () => `<span class="sr-only"> (${E(tt('supNewTab'))})</span>`;

  function mount(h) {
    host = h;
    noteDay(store(), day());
    const d = doc();
    d.addEventListener('compositionstart', () => { run.composing = true; });
    d.addEventListener('compositionend', () => { run.composing = false; });
    root.addEventListener('error', () => { run.lastError = Date.now(); });
    root.addEventListener('unhandledrejection', () => { run.lastError = Date.now(); });
    const dlg = $('#dlg');
    dlg.addEventListener('click', onBackdrop, true);
    dlg.addEventListener('click', onDialogClick);
    dlg.addEventListener('input', onDialogInput);
    dlg.addEventListener('change', onDialogInput);
    dlg.addEventListener('cancel', onDialogCancel);
    dlg.addEventListener('close', onDialogClose);
    const slot = $('#support-slot');
    if (slot) slot.addEventListener('click', onCardClick);
    relabel();
  }
  function relabel() {
    if (!host) return;
    const title = $('#menu-title-help');
    if (title) title.textContent = tt('menuHelp');
    [['support', 'bSupport', 'tSupport'], ['feedback', 'bFeedback', 'tFeedback']].forEach(([a, k, tip]) => {
      const b = $(`#menu [data-action="${a}"]`);
      if (!b) return;
      const l = b.querySelector('.lbl');
      if (l) l.textContent = tt(k);
      b.title = tt(tip);
      b.setAttribute('aria-label', tt(k));
    });
    if (run.card) paintCard();
  }

  // ---------- the invitation (a card at the end of the Delivery step) ----------
  // The editor shows a screen or step (renderTab). Leaving the step removes the card; once seen it does not come back
  // in this run.
  function view(key) {
    if (!host) return;
    if (key !== run.view) { run.view = key; removeCard(false); }
    maybeShow();
  }
  // A report export ended. done resolves to true only when the file was made and handed over: to the browser's
  // download (the browser does not tell whether it was then saved) or, in the Android and iOS apps, to the share sheet
  // without cancelling. Printing is not counted: neither the browser nor the apps tell whether a PDF was made.
  function exported(done) {
    if (!INVITE) return;
    Promise.resolve(done).then((ok) => {
      const p = countExport(store(), ok, day());
      if (!p || run.shown || !eligible({ ok: true, prefs: p }, day())) return;
      run.pending = true;
      clearTimeout(run.timer);
      run.timer = setTimeout(maybeShow, SHOW_DELAY);
    }, () => { run.lastError = Date.now(); });
  }
  // A safe moment: the page in view and online, no dialog, menu, palette, list or message open, no printing, the user
  // not typing or composing text (IME), no error in the last minute.
  function safeNow() {
    const d = doc();
    if (d.visibilityState && d.visibilityState !== 'visible') return false;
    if (root.navigator && root.navigator.onLine === false) return false;
    const palette = $('#palette');
    const pop = $('#pop');
    if (d.querySelector('dialog[open]') || d.querySelector('#menu.open') || d.querySelector('#toast.show') || (palette && !palette.hidden) || (pop && !pop.hidden)) return false;
    if (d.body.classList.contains('printing') || d.body.classList.contains('pv-full')) return false;
    if (run.composing) return false;
    const a = d.activeElement;
    if (a && a.closest && a.closest('input, textarea, select, [contenteditable="true"]')) return false;
    return Date.now() - run.lastError >= QUIET_AFTER_ERROR;
  }
  function maybeShow() {
    if (!host || !run.pending || run.shown || run.card || run.view !== 'deliver' || !safeNow()) return;
    if (!eligible(read(store()), day())) { run.pending = false; return; }
    const slot = $('#support-slot');
    if (!slot) return;
    run.card = doc().createElement('section');
    run.card.className = 'sup-card in';
    run.card.setAttribute('aria-labelledby', 'sup-card-t');
    paintCard();
    slot.appendChild(run.card);
    // Seen: at least half of the card on screen. Until then it may appear again on this step in this run.
    const seen = () => { if (run.shown) return; run.shown = true; run.pending = false; noteShown(store(), day()); };
    if (typeof root.IntersectionObserver === 'function') {
      run.io = new root.IntersectionObserver((entries) => {
        if (!entries.some((x) => x.isIntersecting)) return;
        run.io.disconnect();
        run.io = null;
        seen();
      }, { threshold: 0.5 });
      run.io.observe(run.card);
    } else seen();
  }
  function paintCard() {
    run.card.innerHTML = `${host.ic('star')}<div class="sup-c"><h2 id="sup-card-t">${E(tt('supCardT'))}</h2><p>${E(tt('supCardText'))}</p>
      <div class="row-actions"><a class="btn btn-sm btn-primary" href="${E(REPO)}" target="_blank" rel="noopener noreferrer" data-sup="gh">${E(tt('supOpenGh'))}${newTab()}</a>
      <button type="button" class="btn btn-sm" data-sup="feedback">${E(tt('bFeedback'))}</button><span class="grow"></span>
      <button type="button" class="btn btn-sm sup-quiet" data-sup="notnow">${E(tt('supNotNow'))}</button>
      <button type="button" class="btn btn-sm sup-quiet" data-sup="never">${E(tt('supNever'))}</button></div></div>
      <button type="button" class="btn btn-icon btn-sm sup-x" data-sup="close" aria-label="${E(tt('bClose'))}" title="${E(tt('bClose'))}">✕</button>`;
  }
  // Removes the card. If it held the focus, the focus goes to the heading of the step instead of being lost.
  function removeCard(focusAfter) {
    if (!run.card) return;
    if (run.io) { run.io.disconnect(); run.io = null; }
    const held = run.card.contains(doc().activeElement);
    run.card.remove();
    run.card = null;
    if (held || focusAfter) focusHeading();
  }
  function focusHeading() {
    const h = doc().querySelector('#tab-body h1');
    if (!h) return;
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }
  function onCardClick(e) {
    const b = e.target.closest('[data-sup]');
    if (!b || !run.card) return;
    const a = b.dataset.sup;
    if (a === 'gh') { act(store(), 'github', day()); setTimeout(() => removeCard(true), 0); return; } // the link opens GitHub
    if (a === 'feedback') { removeCard(false); openFeedback(null); return; }
    if (a === 'notnow' || a === 'close' || a === 'never') { act(store(), a, day()); removeCard(true); }
  }

  // ---------- dialogs: "Support Valesta" and the feedback form ----------
  function openDialog(kind, html, opener) {
    const dlg = $('#dlg');
    dlg.dataset.support = kind;
    dlg.setAttribute('aria-labelledby', 'dlg-title');
    dlg.innerHTML = html;
    if (opener !== undefined) run.opener = opener;
    if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
  }
  const head = (title) => `<div class="dlg-head"><h2 id="dlg-title">${E(title)}</h2><button type="button" class="btn btn-icon" data-sup="x" aria-label="${E(tt('bClose'))}" title="${E(tt('bClose'))}">✕</button></div>`;
  function openSupport(opener) {
    const r = read(store());
    const pref = r.ok || r.reason !== 'unavailable'
      ? `<label class="chk"><input type="checkbox" data-sup="pref"${showsInvites(r) ? ' checked' : ''}><span>${E(tt('supPref'))}</span></label><p class="hint">${E(tt('supPrefNote'))}</p>`
      : `<p class="hint">${E(tt('supPrefOff'))}</p>`;
    openDialog('support', `${head(tt('supT'))}<div class="dlg-body sup"><p class="sup-lead">${E(tt('supText'))}</p>
      <div class="row-actions"><a class="btn btn-primary" href="${E(REPO)}" target="_blank" rel="noopener noreferrer" data-sup="gh">${host.ic('star')}${E(tt('supOpenGh'))}${newTab()}</a>
      <button type="button" class="btn" data-sup="feedback">${E(tt('bFeedback'))}</button></div>
      <p class="hint sup-star">${E(tt('supStarHint'))}</p><div class="sup-pref">${pref}</div></div>`, opener);
  }
  function openFeedback(opener) {
    act(store(), 'feedback', day());
    run.draft = { type: '', doing: '', what: '', tech: null, tried: false, handed: false };
    const types = tt('fbTypes') || {};
    const L = links();
    const warn = L.issues ? `<p class="fb-warn" id="fb-gh-warn">${E(tt('fbGhWarn'))}</p>` : '';
    const issue = L.issues ? `<a class="btn btn-primary" href="${E(L.issues)}" target="_blank" rel="noopener noreferrer" data-sup="issue" aria-describedby="fb-gh-warn">${E(tt('fbGh'))}${newTab()}</a>` : '';
    const security = L.security ? ` <a href="${E(L.security)}" target="_blank" rel="noopener noreferrer">${E(tt('fbSecurityLink'))}${newTab()}</a>` : '';
    openDialog('feedback', `${head(tt('fbT'))}<div class="dlg-body fb"><p class="sup-lead">${E(tt('fbIntro'))}</p>
      <div class="fb-f"><label class="fld"><span>${E(tt('fbType'))}</span><select id="fb-type" data-fb="type" aria-describedby="fb-type-err" aria-invalid="false" required>
      <option value="">${E(tt('fbChoose'))}</option>${TYPES.map((k) => `<option value="${k}">${E(types[k])}</option>`).join('')}</select></label>
      <small class="fld-err" id="fb-type-err" hidden></small></div>
      <label class="fld"><span>${E(tt('fbDoing'))} <em class="fb-opt">${E(tt('fbOptional'))}</em></span><textarea id="fb-doing" data-fb="doing" rows="2" maxlength="2000"></textarea></label>
      <div class="fb-f"><label class="fld"><span>${E(tt('fbWhat'))}</span><textarea id="fb-what" data-fb="what" rows="4" maxlength="4000" aria-describedby="fb-what-err" aria-invalid="false" required></textarea></label>
      <small class="fld-err" id="fb-what-err" hidden></small></div>
      <p class="sup-note">${E(tt('fbPrivacy'))}</p>
      <div class="fb-tech"><label class="chk"><input type="checkbox" data-fb="tech"><span>${E(tt('fbTech'))}</span></label><span class="hint">${E(tt('fbTechNone'))}</span>
      <dl class="sup-tech" id="fb-tech"></dl></div>
      <details class="fb-prev"><summary>${E(tt('fbPreview'))}</summary><pre class="fb-text" id="fb-text"></pre></details>
      <textarea class="fb-manual" id="fb-manual" readonly hidden aria-label="${E(tt('fbPreview'))}"></textarea>
      <p class="hint">${E(tt('fbChannels'))}</p>
      <p class="hint fb-sec">${E(tt('fbSecurity'))}${security}</p></div>
      <div class="dlg-foot fb-foot">${warn}<div class="fb-acts"><button type="button" class="btn" data-sup="copy">${E(tt('fbCopy'))}</button>${issue}</div>
      <p class="fb-status" id="fb-status" role="status" aria-live="polite"></p></div>`, opener);
    paintFeedback();
    const first = doc().getElementById('fb-type');
    if (first) first.focus();
  }
  // The technical details are offered for technical problems and usability; the user can always add or remove them.
  const techOn = () => (run.draft.tech === null ? run.draft.type === 'bug' || run.draft.type === 'usability' : run.draft.tech);
  const env = () => ({ version: host.version(), ua: root.navigator && root.navigator.userAgent, native: host.native, lang: host.lang(), section: run.view });
  const composeNow = () => compose(run.draft, techOn() ? techRows(env()) : null, tt);
  function paintFeedback() {
    const on = techOn();
    const chk = $('#dlg [data-fb="tech"]');
    if (chk) chk.checked = on;
    const box = doc().getElementById('fb-tech');
    if (box) { box.innerHTML = techRows(env()).map((r) => `<div><dt>${E(tt(r[0]))}</dt><dd>${E(r[1])}</dd></div>`).join(''); box.classList.toggle('off', !on); }
    const c = composeNow();
    const pre = doc().getElementById('fb-text');
    if (pre) pre.textContent = `${c.title}\n\n${c.body}`;
  }
  function showErrors(errs, moveFocus) {
    [['type', 'fb-type'], ['what', 'fb-what']].forEach(([k, id]) => {
      const el = doc().getElementById(id);
      const msg = doc().getElementById(id + '-err');
      if (!el || !msg) return;
      el.setAttribute('aria-invalid', errs[k] ? 'true' : 'false');
      el.closest('.fld').classList.toggle('invalid', !!errs[k]);
      msg.hidden = !errs[k];
      msg.textContent = errs[k] ? tt(errs[k]) : '';
    });
    const first = errs.type ? 'fb-type' : errs.what ? 'fb-what' : '';
    if (moveFocus && first) doc().getElementById(first).focus();
  }
  // Checked before the text leaves the form: errors are shown next to their fields and the first one gets the focus.
  function ready() {
    run.draft.tried = true;
    const errs = validate(run.draft);
    showErrors(errs, true);
    return !Object.keys(errs).length;
  }
  function status(msg) { const s = doc().getElementById('fb-status'); if (s) s.textContent = msg; }
  async function copyText() {
    if (!ready()) return;
    const c = composeNow();
    const text = `${c.title}\n\n${c.body}`;
    const manual = doc().getElementById('fb-manual');
    let ok = false;
    try {
      if (root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') { await root.navigator.clipboard.writeText(text); ok = true; }
    } catch (e) { ok = false; }
    if (!run.draft) return; // the form was closed meanwhile
    if (ok) { run.draft.handed = true; manual.hidden = true; status(tt('fbCopied')); return; }
    // Not copied: the text stays here, selected, to copy by hand.
    manual.value = text;
    manual.hidden = false;
    manual.scrollIntoView({ block: 'nearest' });
    manual.focus();
    manual.select();
    status(tt('fbCopyFail'));
  }
  // The public issue opens only on this explicit click, after the warning shown above the button. A text too long
  // for a link is not cut: the first click asks to copy it, the next one opens GitHub with the title only.
  function openIssue(e, a) {
    if (!ready()) { e.preventDefault(); return; }
    const c = composeNow();
    const link = issueLink(c.title, c.body, tt('fbGhPaste'));
    if (link.tooLong && a.dataset.long !== '1') { e.preventDefault(); a.dataset.long = '1'; a.href = link.url; status(tt('fbGhLong')); return; }
    a.href = link.url;
    run.draft.handed = true;
    status(tt('fbGhOpened'));
  }
  // The dialog says which of the two it holds in data-support (not data-sup, which marks its controls).
  function onDialogClick(e) {
    const dlg = $('#dlg');
    const b = e.target.closest('[data-sup]');
    if (!dlg.dataset.support || !b || !dlg.contains(b)) return;
    const a = b.dataset.sup;
    if (a === 'x') closeOwn();
    else if (a === 'gh') act(store(), 'github', day()); // the link itself opens GitHub in a new tab
    else if (a === 'feedback') openFeedback(undefined);
    else if (a === 'copy') copyText();
    else if (a === 'issue') openIssue(e, b);
  }
  function onDialogInput(e) {
    const dlg = $('#dlg');
    const el = e.target;
    if (dlg.dataset.support === 'support' && el.dataset.sup === 'pref') { act(store(), el.checked ? 'on' : 'off', day()); return; }
    if (dlg.dataset.support !== 'feedback' || !run.draft || !el.dataset.fb) return;
    if (el.dataset.fb === 'tech') run.draft.tech = el.checked;
    else run.draft[el.dataset.fb] = el.value;
    run.draft.handed = false;
    const issue = dlg.querySelector('[data-sup="issue"]');
    if (issue) delete issue.dataset.long;
    if (run.draft.tried) showErrors(validate(run.draft), false);
    paintFeedback();
  }
  // Text written and not yet copied or taken to GitHub: closing asks first.
  const unsent = () => !!(run.draft && !run.draft.handed && (clean(run.draft.doing) || clean(run.draft.what)));
  function closeOwn() {
    if ($('#dlg').dataset.support === 'feedback' && unsent() && !root.confirm(tt('fbDiscard'))) return;
    host.closeDialog();
  }
  function onDialogCancel(e) {
    if ($('#dlg').dataset.support === 'feedback' && unsent() && !root.confirm(tt('fbDiscard'))) e.preventDefault();
  }
  // A click on the backdrop closes the editor's dialogs: for the form with text not taken anywhere, it asks first.
  function onBackdrop(e) {
    const dlg = $('#dlg');
    if (e.target !== dlg || dlg.dataset.support !== 'feedback' || !unsent()) return;
    if (root.confirm(tt('fbDiscard'))) run.draft.handed = true; // confirmed: the editor's handler closes it
    else e.stopImmediatePropagation();
  }
  // Closed: the focus goes back where the dialog was opened from (the menu button for the menu), or to the heading
  // of the step when it was opened from the card.
  function onDialogClose() {
    const dlg = $('#dlg');
    if (!dlg.dataset.support) return;
    delete dlg.dataset.support;
    run.draft = null;
    const o = run.opener;
    run.opener = null;
    if (o === null) focusHeading();
    else {
      const back = o && o.isConnected && o.getClientRects().length ? o : $('#menu-btn');
      if (back) back.focus();
    }
    maybeShow();
  }
  function open(kind, opener) {
    if (!host) return;
    if (kind === 'feedback') openFeedback(opener);
    else openSupport(opener);
  }

  return {
    KEY, NEED, WAIT_DAYS, TYPES, today, addDays, read, noteDay, countExport, noteShown, act, eligible, showsInvites,
    validate, platform, techRows, compose, links, issueLink,
    mount, relabel, view, exported, open,
  };
});
