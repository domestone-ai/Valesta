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
// One version everywhere: the menu of the app, the build, the MCP server, the Windows and Android apps, the packages
// and the top section of the changelog.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const one = (f, re) => { const m = read(f).match(re); assert.ok(m, `${f}: ${re}`); return m[1]; };

test('version: the app, the build, the MCP server, the native apps and the changelog have the same version', () => {
  const build = one('build.py', /^VERSION = "(\d+\.\d+)"$/m);
  const full = `${build}.0`;
  assert.equal(one('src/js/editor.js', /const VERSION = '([^']+)';/), build, 'the version in the menu of the app');
  assert.equal(one('mcp/valesta-mcp.js', /const VERSION = '([^']+)';/), full, 'MCP server');
  assert.equal(one('native/android/app/build.gradle', /versionName "([^"]+)"/), full, 'Android');
  assert.equal(one('native/ios/App/App.xcodeproj/project.pbxproj', /MARKETING_VERSION = ([^;]+);/), build, 'iOS');
  for (const f of ['package.json', 'desktop/package.json', 'native/package.json']) assert.equal(JSON.parse(read(f)).version, full, f);
  for (const f of ['package-lock.json', 'desktop/package-lock.json', 'native/package-lock.json']) {
    const lock = JSON.parse(read(f));
    assert.equal(lock.version, full, f);
    assert.equal(lock.packages[''].version, full, f);
  }
  const top = one('CHANGELOG.md', /^## \[([^\]]+)\]/m);
  assert.ok(top === full || top === 'Unreleased', `CHANGELOG: the top section is ${top}`);
  if (top === full) assert.match(read('CHANGELOG.md'), new RegExp(`^\\[${full.replace(/\./g, '\\.')}\\]: https://github\\.com/domestone-ai/Valesta/releases/tag/v${full.replace(/\./g, '\\.')}$`, 'm'));
});
