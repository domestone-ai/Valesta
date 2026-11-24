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
// Texts of the interface for translators: the English strings (src/js/ui_i18n.js) and the English labels of the modules
// (property types, steps, document checks, review, map services), which a pack in src/js/lang-ui translates.
//   node tools/ui_strings.js          the English source, as JSON
//   node tools/ui_strings.js <lang>   what the pack src/js/lang-ui/ui.<lang>.js lacks or no longer needs
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src', 'js');
// Label helpers of the modules and the position of the English text: L(en, es, it), L3(it, en, es); Lf and L3f take
// templates with {0}, {1} for values.
const HELPERS = { L: 0, Lf: 0, L3: 1, L3f: 1 };
const FILES = ['taxonomy.js', 'workflow.js', 'checks.js', 'review.js'];

// Reads the JavaScript string literal at s[i] (quote, double quote or backtick); null when it is not one.
function literal(s, i) {
  const q = s[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let j = i + 1;
  while (j < s.length && s[j] !== q) j += s[j] === '\\' ? 2 : 1;
  const src = s.slice(i, j + 1);
  if (q === '`' && src.includes('${')) return { dynamic: true, src, end: j + 1 };
  return { value: Function(`"use strict"; return (${src});`)(), end: j + 1 };   // a literal of our own sources
}

function skipArg(s, i) {
  let depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') { i = literal(s, i).end; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) return i; depth--; } else if (c === ',' && depth === 0) return i;
    i++;
  }
  return i;
}

function scan(file) {
  const s = fs.readFileSync(path.join(SRC, file), 'utf8');
  const found = [];
  const re = /\b(L3f|L3|Lf|L)\(/g;
  let m;
  while ((m = re.exec(s))) {
    let i = m.index + m[0].length;
    for (let n = 0; n <= HELPERS[m[1]]; n++) {
      while (/\s/.test(s[i])) i++;
      if (n === HELPERS[m[1]]) {
        const lit = literal(s, i);
        if (lit && lit.dynamic) throw new Error(`${file}: label with a JavaScript placeholder, use ${m[1]}f and {0}: ${lit.src.slice(0, 80)}`);
        if (lit && lit.value) found.push(lit.value);
        break;
      }
      i = skipArg(s, i);
      if (s[i] !== ',') break;
      i++;
    }
  }
  return found;
}

// Labels written as objects ({ it: '…', en: '…', es: '…' }): levels, sources, conditions and warnings of the engine,
// map services. A text with values keeps its English template in _tpl ('… {0} …').
const OBJECT_FILES = ['engine.js', 'maps.js'];
function objectLabels(file) {
  const s = fs.readFileSync(path.join(SRC, file), 'utf8');
  const out = [];
  const re = /\b(en|_tpl):\s*('(?:[^'\\]|\\.)*')/g;
  let m;
  while ((m = re.exec(s))) out.push(literal(m[2], 0).value);
  const dynamic = (s.match(/\ben:\s*`/g) || []).length;
  const templates = (s.match(/\b_tpl:\s*'/g) || []).length;
  if (dynamic > templates) throw new Error(`${file}: ${dynamic - templates} English text(s) with values but no _tpl template`);
  return out;
}

function labels() {
  return [...new Set(FILES.flatMap(scan).concat(OBJECT_FILES.flatMap(objectLabels)))].sort();
}

function source() {
  const UI = require(path.join(SRC, 'ui_i18n.js'));
  const plainText = (v) => (typeof v === 'function' ? v.toString() : v && typeof v === 'object' ? (Array.isArray(v) ? v.map(plainText) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainText(x)]))) : v);
  return { strings: plainText(UI.en), labels: labels() };
}

function lacks(lang) {
  const UI = require(path.join(SRC, 'ui_i18n.js'));
  const pack = UI.packs[lang];
  if (!pack) return { pack: false };
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, p + k + '.') : [p + k]));
  const have = new Set(keys(pack.strings || {}));
  const all = labels();
  return {
    strings: keys(UI.en).filter((k) => !have.has(k)),
    labels: all.filter((s) => (pack.labels || {})[s] == null),
    stale: Object.keys(pack.labels || {}).filter((s) => !all.includes(s)),
  };
}

module.exports = { labels, source, lacks };

if (require.main === module) {
  const lang = process.argv[2];
  process.stdout.write(JSON.stringify(lang ? lacks(lang) : source(), null, 1) + '\n');
}
