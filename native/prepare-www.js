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
/* Copies the built PWA (../dist/Web) into www/ for the native shells (no service worker needed inside the apps). */
'use strict';
const fs = require('fs');
const path = require('path');
const src = path.resolve(__dirname, '..', 'dist', 'Web');
const dst = path.join(__dirname, 'www');
if (!fs.existsSync(path.join(src, 'index.html'))) { console.error('Run "python -I build.py" first: dist/Web/index.html missing'); process.exit(1); }
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(path.join(dst, 'icons'), { recursive: true });
fs.copyFileSync(path.join(src, 'index.html'), path.join(dst, 'index.html'));
fs.copyFileSync(path.join(src, 'manifest.webmanifest'), path.join(dst, 'manifest.webmanifest'));
for (const f of fs.readdirSync(path.join(src, 'icons'))) if (f.endsWith('.png')) fs.copyFileSync(path.join(src, 'icons', f), path.join(dst, 'icons', f));
// The licence of Valesta, the notices and the licence texts of the third-party components go into the app too.
for (const f of ['LICENSE', 'NOTICE']) fs.copyFileSync(path.join(src, f), path.join(dst, f));
fs.cpSync(path.join(src, 'LICENSES'), path.join(dst, 'LICENSES'), { recursive: true });
console.log('www ready:', fs.readdirSync(dst).join(', '));
