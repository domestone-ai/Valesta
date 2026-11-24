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
// The optional invitation to support Valesta and the feedback form: preferences kept on the device, when the
// invitation may appear, the text of the feedback and where it goes. Time and storage are under the test's control.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/js/support.js');
const UI = require('../src/js/ui_i18n.js');

// A storage with the interface of localStorage. Two of them over the same map behave like two tabs of the app.
function memStorage(map, opts) {
  const m = map || new Map();
  const o = opts || {};
  return {
    map: m,
    getItem: (k) => { if (o.throwGet) throw new Error('blocked'); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (o.throwSet) throw new Error('quota'); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
const D1 = '2026-11-24';
const D2 = '2026-11-25';
const stored = (st) => JSON.parse(st.map.get(S.KEY));
// Two days of use and two successful exports: the state in which the invitation may appear.
function eligibleStorage() {
  const st = memStorage();
  S.noteDay(st, D1);
  S.countExport(st, true, D1);
  S.noteDay(st, D2);
  S.countExport(st, true, D2);
  return st;
}
const t = (k) => UI.it[k];

test('local days: a day string, adding days across months and summer time', () => {
  assert.equal(S.today(new Date(2026, 10, 24, 23, 59)), '2026-11-24');
  assert.equal(S.today(new Date(2026, 0, 5, 0, 0)), '2026-01-05');
  assert.equal(S.addDays('2026-11-24', 90), '2027-02-22');
  assert.equal(S.addDays('2026-03-01', 30), '2026-03-31', 'across the change to summer time');
});

test('the first use shows no invitation', () => {
  const st = memStorage();
  S.noteDay(st, D1);
  assert.equal(S.eligible(S.read(st), D1), false);
  assert.equal(stored(st).days, 1);
});

test('two successful exports on the same day are not enough', () => {
  const st = memStorage();
  S.noteDay(st, D1);
  S.countExport(st, true, D1);
  S.countExport(st, true, D1);
  assert.equal(stored(st).exports, 2);
  assert.equal(S.eligible(S.read(st), D1), false);
});

test('two days of use and two successful exports make the invitation possible', () => {
  const st = eligibleStorage();
  assert.equal(S.eligible(S.read(st), D2), true);
});

test('reloading the app on the same day does not add a day of use', () => {
  const st = memStorage();
  for (let i = 0; i < 5; i += 1) S.noteDay(st, D1);
  assert.equal(stored(st).days, 1);
});

test('a failed or cancelled export counts nothing', () => {
  const st = memStorage();
  S.noteDay(st, D1);
  for (const result of [false, undefined, null, 'yes', 1]) S.countExport(st, result, D1);
  assert.equal(stored(st).exports, 0);
});

test('the counters stop at the threshold and no history is kept', () => {
  const st = memStorage();
  ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].forEach((d) => { S.noteDay(st, d); S.countExport(st, true, d); S.countExport(st, true, d); });
  const p = stored(st);
  assert.equal(p.exports, 2);
  assert.equal(p.days, 2);
  assert.equal(p.lastDay, '2026-11-04');
  assert.deepEqual(Object.keys(p).sort(), ['days', 'exports', 'gh', 'lastDay', 'off', 'shown', 'until', 'v']);
});

test('once shown, the invitation waits 90 days', () => {
  const st = eligibleStorage();
  S.noteShown(st, D2);
  assert.equal(stored(st).shown, D2);
  assert.equal(S.eligible(S.read(st), D2), false);
  assert.equal(S.eligible(S.read(st), S.addDays(D2, 89)), false);
  assert.equal(S.eligible(S.read(st), S.addDays(D2, 90)), true);
});

test('Not now and closing the card postpone the invitation by 90 days', () => {
  for (const action of ['notnow', 'close']) {
    const st = eligibleStorage();
    S.act(st, action, D2);
    assert.equal(stored(st).until, S.addDays(D2, 90), action);
    assert.equal(S.eligible(S.read(st), S.addDays(D2, 89)), false, action);
    assert.equal(S.eligible(S.read(st), S.addDays(D2, 90)), true, action);
  }
});

test('Don’t show again turns the automatic invitation off for good', () => {
  const st = eligibleStorage();
  S.act(st, 'never', D2);
  assert.equal(stored(st).off, true);
  assert.equal(S.eligible(S.read(st), S.addDays(D2, 3650)), false);
});

test('opening GitHub stops the automatic invitations and records no star', () => {
  const st = eligibleStorage();
  S.act(st, 'github', D2);
  const p = stored(st);
  assert.equal(p.gh, true);
  assert.ok(!JSON.stringify(p).toLowerCase().includes('star'), 'nothing says a star was given');
  assert.equal(S.eligible(S.read(st), S.addDays(D2, 3650)), false);
});

test('opening the feedback form postpones the invitation by 90 days, whether or not anything is sent', () => {
  const st = eligibleStorage();
  S.act(st, 'feedback', D2);
  assert.equal(stored(st).until, S.addDays(D2, 90));
  assert.equal(S.eligible(S.read(st), S.addDays(D2, 30)), false);
});

test('the switch turns the invitations back on, also after GitHub was opened, and off again', () => {
  const st = eligibleStorage();
  S.act(st, 'never', D2);
  S.act(st, 'github', D2);
  S.act(st, 'on', D2);
  assert.equal(stored(st).off, false);
  assert.equal(stored(st).gh, false);
  assert.equal(S.showsInvites(S.read(st)), true);
  S.act(st, 'off', D2);
  assert.equal(S.showsInvites(S.read(st)), false);
});

test('an update of the app keeps the preferences as they are', () => {
  const st = eligibleStorage();
  S.act(st, 'notnow', D2);
  const before = st.map.get(S.KEY);
  const again = S.read(st);
  assert.equal(again.ok, true);
  assert.equal(st.map.get(S.KEY), before, 'reading changes nothing');
  assert.deepEqual(again.prefs, JSON.parse(before));
});

test('storage that cannot be used: no automatic invitation and no error', () => {
  for (const st of [memStorage(null, { throwGet: true }), null, undefined]) {
    assert.equal(S.read(st).ok, false);
    assert.equal(S.noteDay(st, D1), null);
    assert.equal(S.countExport(st, true, D1), null);
    assert.equal(S.act(st, 'never', D1), null);
    assert.equal(S.eligible(S.read(st), D1), false);
  }
  const full = memStorage(null, { throwSet: true });
  assert.equal(S.noteDay(full, D1), null, 'a full storage: nothing saved, nothing thrown');
});

test('damaged, unknown or newer data: no automatic invitation and no automatic overwrite', () => {
  const bad = ['{oops', '[]', 'null', '42', '{"v":1,"off":"yes"}', '{"v":1,"exports":-3}', '{"v":1,"until":"tomorrow"}', '{"v":2,"exports":2}', '{"exports":2}'];
  for (const raw of bad) {
    const st = memStorage(new Map([[S.KEY, raw]]));
    assert.equal(S.read(st).ok, false, raw);
    S.noteDay(st, D1);
    S.countExport(st, true, D1);
    S.noteShown(st, D1);
    S.act(st, 'notnow', D1);
    assert.equal(st.map.get(S.KEY), raw, `${raw}: left as it is`);
    assert.equal(S.eligible(S.read(st), D2), false, raw);
  }
});

test('an explicit choice of the user replaces damaged data with valid preferences', () => {
  const st = memStorage(new Map([[S.KEY, '{oops']]));
  S.act(st, 'never', D1);
  assert.equal(S.read(st).ok, true);
  assert.equal(stored(st).off, true);
  const st2 = memStorage(new Map([[S.KEY, '{oops']]));
  S.act(st2, 'on', D1);
  assert.equal(S.read(st2).ok, true);
  assert.equal(stored(st2).off, false);
});

test('counters above the threshold are read as the threshold', () => {
  const st = memStorage(new Map([[S.KEY, JSON.stringify({ v: 1, exports: 9, days: 7, lastDay: D1, shown: '', until: '', off: false, gh: false })]]));
  const r = S.read(st);
  assert.equal(r.ok, true);
  assert.equal(r.prefs.exports, 2);
  assert.equal(r.prefs.days, 2);
});

test('two tabs share one set of preferences', () => {
  const map = new Map();
  const a = memStorage(map);
  const b = memStorage(map);
  S.noteDay(a, D1);
  S.noteDay(b, D1);
  assert.equal(stored(a).days, 1, 'the same day in two tabs is one day');
  S.countExport(a, true, D1);
  S.noteDay(b, D2);
  S.countExport(b, true, D2);
  assert.equal(S.eligible(S.read(a), D2), true);
  S.noteShown(a, D2);
  assert.equal(S.eligible(S.read(b), D2), false, 'shown in one tab: not again in the other');
});

test('the feedback form asks only for the type and for what happened', () => {
  assert.deepEqual(S.validate({}), { type: 'fbErrType', what: 'fbErrWhat' });
  assert.deepEqual(S.validate({ type: 'bug', what: '   ' }), { what: 'fbErrWhat' });
  assert.deepEqual(S.validate({ type: 'nonsense', what: 'Il PDF esce vuoto' }), { type: 'fbErrType' });
  assert.deepEqual(S.validate({ type: 'bug', what: 'Il PDF esce vuoto' }), {});
  assert.deepEqual(S.TYPES, ['bug', 'usability', 'idea', 'method', 'other']);
});

test('the technical details are few and coarse: no full browser string, nothing of the valuation', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Safari/537.36';
  assert.equal(S.platform(ua, ''), 'Web · Chrome 131 · Windows');
  assert.equal(S.platform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70', ''), 'Web · Edge 131 · Windows');
  assert.equal(S.platform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', ''), 'Web · Safari 18 · macOS');
  assert.equal(S.platform('Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0', ''), 'Web · Firefox 133 · Linux');
  assert.equal(S.platform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.81 Mobile Safari/537.36', 'android'), 'App Android · Chrome 131 · Android');
  const rows = S.techRows({ version: 'Valesta 1.0 (9d8344a)', ua, native: '', lang: 'it', section: 'deliver' });
  assert.deepEqual(rows, [['fbTechVer', 'Valesta 1.0 (9d8344a)'], ['fbTechPlat', 'Web · Chrome 131 · Windows'], ['fbTechLang', 'it'], ['fbTechSec', 'deliver']]);
  assert.ok(!JSON.stringify(rows).includes('Mozilla'));
});

test('the shared text holds the answers and, only when chosen, the technical details', () => {
  const form = { type: 'bug', doing: 'Esportare il PDF', what: 'Il PDF esce senza la mappa.' };
  const rows = [['fbTechVer', 'Valesta 1.0'], ['fbTechSec', 'deliver']];
  const withTech = S.compose(form, rows, t);
  assert.match(withTech.title, /^Problema tecnico: Il PDF esce senza la mappa\.$/);
  for (const s of ['Problema tecnico', 'Esportare il PDF', 'Il PDF esce senza la mappa.', 'Valesta 1.0', 'deliver']) assert.ok(withTech.body.includes(s), s);
  const without = S.compose(form, null, t);
  assert.ok(!without.body.includes('Valesta 1.0') && !without.body.includes('deliver'));
  const noDoing = S.compose({ type: 'idea', what: 'Un tema scuro.' }, null, t);
  assert.ok(!noDoing.body.includes(t('fbDoing')), 'an empty optional answer is left out');
  const long = S.compose({ type: 'other', what: 'x'.repeat(300) }, null, t);
  assert.ok(long.title.length <= 90, 'a short title');
});

test('the e-mail never reaches a public issue', () => {
  const form = { type: 'bug', what: 'Errore', email: 'someone@example.com', doing: 'Salvare' };
  const { title, body } = S.compose(form, null, t);
  const link = S.issueLink(title, body);
  for (const s of [title, body, link.url]) assert.ok(!s.includes('someone@example.com'), s);
});

test('the public issue link carries the text, and a text too long for a link is never cut', () => {
  const { title, body } = S.compose({ type: 'bug', what: 'Il valore non si aggiorna.' }, null, t);
  const ok = S.issueLink(title, body);
  assert.equal(ok.tooLong, false);
  assert.ok(ok.url.startsWith(S.links().issues + '?'));
  assert.equal(new URL(ok.url).searchParams.get('body'), body);
  assert.equal(new URL(ok.url).searchParams.get('title'), title);
  const big = S.compose({ type: 'bug', what: 'è'.repeat(5000) }, null, t);
  const long = S.issueLink(big.title, big.body, t('fbGhPaste'));
  assert.equal(long.tooLong, true);
  assert.equal(new URL(long.url).searchParams.get('body'), t('fbGhPaste'), 'only the title and a request to paste');
  assert.ok(long.url.length < 2000);
});

test('the links go to the official repository; security problems have their own private channel', () => {
  const L = S.links();
  assert.equal(L.repo, 'https://github.com/domestone-ai/Valesta');
  assert.equal(L.issues, 'https://github.com/domestone-ai/Valesta/issues/new');
  assert.equal(L.security, 'https://github.com/domestone-ai/Valesta/security/advisories/new');
});
