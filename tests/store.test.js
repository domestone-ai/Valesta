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
const { ValestaStore } = require('../src/js/store.js');

function memoryStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}

test('settings saved by Valorem 1.1 are copied to the new keys', () => {
  const ls = memoryStorage({ 'valorem-ui-lang': 'es', 'valorem-state-v2': '{"a":1}', 'valorem-ai': '{"provider":"openai"}', 'other': 'x' });
  assert.equal(ValestaStore.migrateLegacyKeys(ls), 3);
  assert.equal(ls.getItem('valesta-ui-lang'), 'es');
  assert.equal(ls.getItem('valesta-state-v2'), '{"a":1}');
  assert.equal(ls.getItem('valesta-ai'), '{"provider":"openai"}');
  assert.equal(ls.getItem('valorem-ui-lang'), 'es', 'old keys are left in place');
});

test('the neutral default profile saved by Valorem 1.1 points to the Valesta profile', () => {
  const ls = memoryStorage({ 'valorem-default-profile': 'valorem' });
  ValestaStore.migrateLegacyKeys(ls);
  assert.equal(ls.getItem('valesta-default-profile'), 'valesta');
});

test('settings already saved under the new keys are not overwritten', () => {
  const ls = memoryStorage({ 'valorem-ui-lang': 'es', 'valesta-ui-lang': 'it' });
  assert.equal(ValestaStore.migrateLegacyKeys(ls), 0);
  assert.equal(ls.getItem('valesta-ui-lang'), 'it');
});

test('missing or blocked storage is ignored', () => {
  assert.equal(ValestaStore.migrateLegacyKeys(null), 0);
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  assert.equal(ValestaStore.migrateLegacyKeys(blocked), 0);
});
