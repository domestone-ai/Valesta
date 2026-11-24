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
const Zip = require('../src/js/zip.js');

test('CRC-32 of the standard check string', () => {
  assert.equal(Zip.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('a stored ZIP lists its files and keeps their bytes', () => {
  const files = [{ name: 'Report.html', data: new TextEncoder().encode('<p>ciao</p>') }, { name: 'allegati/01 APE è.pdf', data: new Uint8Array([37, 80, 68, 70]) }];
  const z = Zip.build(files, new Date(2026, 10, 23, 10, 30, 0));
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  assert.equal(v.getUint32(0, true), 0x04034b50, 'local header');
  const eocd = z.byteLength - 22;
  assert.equal(v.getUint32(eocd, true), 0x06054b50, 'end of central directory');
  assert.equal(v.getUint16(eocd + 10, true), 2, 'two entries');
  const cdOff = v.getUint32(eocd + 16, true);
  assert.equal(v.getUint32(cdOff, true), 0x02014b50, 'central directory');
  const names = Zip.list(z);
  assert.deepEqual(names.map((e) => e.name), ['Report.html', 'allegati/01 APE è.pdf']);
  assert.deepEqual(Array.from(names[1].data), [37, 80, 68, 70]);
});
