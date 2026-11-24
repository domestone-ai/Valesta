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
// Each package that we distribute contains the licence of Valesta (LICENSE), the notices (NOTICE) and the licence texts
// of the third-party components (LICENSES/): the fonts (SIL OFL 1.1), the IGN base maps (CC BY 4.0) and the libraries
// of the native apps (MIT, Apache-2.0). Needs a build (python -I build.py).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TEXTS = fs.readdirSync(path.join(ROOT, 'LICENSES')).filter((f) => f.endsWith('.txt')).sort();
const same = (a, b) => fs.readFileSync(a).equals(fs.readFileSync(b));

function assertLicences(dir) {
  assert.ok(fs.existsSync(dir), `${path.relative(ROOT, dir)} missing: build first (python -I build.py)`);
  for (const f of ['LICENSE', 'NOTICE']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `${f} missing in ${path.relative(ROOT, dir)}`);
    assert.ok(same(path.join(dir, f), path.join(ROOT, f)), `${f} in ${path.relative(ROOT, dir)} differs from the repository`);
  }
  const copied = fs.readdirSync(path.join(dir, 'LICENSES')).filter((f) => f.endsWith('.txt')).sort();
  assert.deepEqual(copied, TEXTS);
  for (const f of TEXTS) assert.ok(same(path.join(dir, 'LICENSES', f), path.join(ROOT, 'LICENSES', f)), `LICENSES/${f} differs`);
}

test('licences: the licence texts of the third-party components cover the fonts, maps and native libraries', () => {
  for (const f of ['CC-BY-4.0.txt', 'MIT-Capacitor.txt', 'MIT-Ionic-Filesystem.txt', 'Apache-2.0.txt']) assert.ok(TEXTS.includes(f), f);
  assert.ok(TEXTS.some((f) => f.startsWith('OFL-1.1-')), 'SIL OFL texts of the fonts');
});

test('licences: the web app (and so the Android app) contains LICENSE, NOTICE and LICENSES/', () => {
  assertLicences(path.join(DIST, 'Web'));
});

test('licences: the MCP server package contains LICENSE, NOTICE and LICENSES/', () => {
  assertLicences(path.join(DIST, 'mcp'));
});
