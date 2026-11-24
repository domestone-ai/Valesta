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
/* Puts the files of the Windows app in place: the built app (dist/Valesta.html), the licence texts and the app icon.
 * Run "python -I build.py" in the repository first. Usage: node prepare.js */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const copy = (from, to) => {
  if (!fs.existsSync(from)) throw new Error(`${path.relative(ROOT, from)} not found: run "python -I build.py" first`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};
copy(path.join(ROOT, 'dist', 'Valesta.html'), path.join(__dirname, 'app', 'Valesta.html'));
for (const f of ['LICENSE', 'NOTICE']) copy(path.join(ROOT, f), path.join(__dirname, 'app', f));
// The licence texts of the third-party components (fonts, base maps): NOTICE refers to them.
fs.rmSync(path.join(__dirname, 'app', 'LICENSES'), { recursive: true, force: true });
for (const f of fs.readdirSync(path.join(ROOT, 'LICENSES')).filter((n) => n.endsWith('.txt'))) {
  copy(path.join(ROOT, 'LICENSES', f), path.join(__dirname, 'app', 'LICENSES', f));
}
// The icon of the native apps (brand files: see brand/README.md).
copy(path.join(ROOT, 'native', 'assets', 'icon-only.png'), path.join(__dirname, 'build', 'icon.png'));
console.log('desktop: app/Valesta.html, LICENSE, NOTICE, LICENSES/ and build/icon.png ready');
