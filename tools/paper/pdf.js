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
// Reads the PDF that Chromium prints, with no dependency: pages, bookmarks, structure tags, fonts, links and text. It
// handles what Chromium writes (plain objects, Flate streams, Type0 fonts with ToUnicode maps), not every PDF.
'use strict';
const zlib = require('zlib');

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set('()<>[]{}/%'.split('').map((c) => c.charCodeAt(0)));

class Lexer {
  constructor(buf, pos = 0) { this.b = buf; this.i = pos; }
  skip() {
    for (;;) {
      while (this.i < this.b.length && WS.has(this.b[this.i])) this.i++;
      if (this.b[this.i] === 0x25) { while (this.i < this.b.length && this.b[this.i] !== 0x0a && this.b[this.i] !== 0x0d) this.i++; } else return;
    }
  }
  value() {
    this.skip();
    const b = this.b;
    const c = b[this.i];
    if (c === undefined) return undefined;
    if (c === 0x3c && b[this.i + 1] === 0x3c) {   // << dict >>
      this.i += 2;
      const d = {};
      for (;;) {
        this.skip();
        if (b[this.i] === 0x3e && b[this.i + 1] === 0x3e) { this.i += 2; return d; }
        const k = this.value();
        d[k.name] = this.value();
      }
    }
    if (c === 0x5b) {   // [ array ]
      this.i++;
      const a = [];
      for (;;) { this.skip(); if (b[this.i] === 0x5d) { this.i++; return a; } a.push(this.value()); }
    }
    if (c === 0x2f) {   // /Name
      let j = this.i + 1;
      while (j < b.length && !WS.has(b[j]) && !DELIM.has(b[j])) j++;
      const name = b.toString('latin1', this.i + 1, j).replace(/#([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
      this.i = j;
      return { name };
    }
    if (c === 0x28) {   // (literal string)
      let depth = 1;
      const out = [];
      this.i++;
      while (this.i < b.length && depth) {
        let ch = b[this.i++];
        if (ch === 0x5c) {
          const e = b[this.i++];
          const map = { 0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12 };
          if (map[e] !== undefined) out.push(map[e]);
          else if (e >= 0x30 && e <= 0x37) {
            let o = e - 0x30;
            for (let k = 0; k < 2 && b[this.i] >= 0x30 && b[this.i] <= 0x37; k++) o = o * 8 + (b[this.i++] - 0x30);
            out.push(o & 0xff);
          } else if (e === 0x0d || e === 0x0a) { if (e === 0x0d && b[this.i] === 0x0a) this.i++; } else out.push(e);
          continue;
        }
        if (ch === 0x28) depth++;
        if (ch === 0x29) { depth--; if (!depth) break; }
        out.push(ch);
      }
      return { str: Buffer.from(out) };
    }
    if (c === 0x3c) {   // <hex string>
      const j = b.indexOf(0x3e, this.i);
      const hex = b.toString('latin1', this.i + 1, j).replace(/\s+/g, '');
      this.i = j + 1;
      return { str: Buffer.from(hex.length % 2 ? hex + '0' : hex, 'hex') };
    }
    let j = this.i;
    while (j < b.length && !WS.has(b[j]) && !DELIM.has(b[j])) j++;
    const tok = b.toString('latin1', this.i, j);
    this.i = j;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok)) {
      // an indirect reference: "12 0 R"
      const save = this.i;
      const m = /^\s+(\d+)\s+R(?![A-Za-z])/.exec(b.toString('latin1', this.i, this.i + 24));
      if (/^\d+$/.test(tok) && m) { this.i = save + m[0].length; return { ref: +tok }; }
      return +tok;
    }
    if (tok === 'true') return true;
    if (tok === 'false') return false;
    if (tok === 'null') return null;
    return { op: tok };
  }
}

function readPdf(buf) {
  const objects = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  const text = buf.toString('latin1');
  let m;
  while ((m = re.exec(text))) {
    const lx = new Lexer(buf, m.index + m[0].length);
    lx.skip();
    const valStart = lx.i;
    const val = lx.value();
    const valEnd = lx.i;
    lx.skip();
    let stream = null;
    if (buf.toString('latin1', lx.i, lx.i + 6) === 'stream') {
      let s = lx.i + 6;
      if (buf[s] === 0x0d) s++;
      if (buf[s] === 0x0a) s++;
      let len = val && val.Length;
      if (len && len.ref != null) len = null;   // resolved below
      stream = { start: s, len };
    }
    objects.set(+m[1], { val, stream, valStart, valEnd });
    re.lastIndex = lx.i;
  }
  const get = (v) => (v && v.ref != null ? (objects.get(v.ref) || {}).val : v);
  const data = (num) => {
    const o = objects.get(num);
    if (!o || !o.stream) return null;
    let len = o.stream.len;
    if (len == null) len = get(o.val.Length);
    let raw = buf.subarray(o.stream.start, o.stream.start + len);
    const f = get(o.val.Filter);
    const filters = Array.isArray(f) ? f.map((x) => x.name) : f ? [f.name] : [];
    for (const name of filters) {
      if (name === 'FlateDecode') raw = zlib.inflateSync(raw);
      else return null;
    }
    return raw;
  };
  const trailerAt = text.lastIndexOf('trailer');
  const tlx = trailerAt >= 0 ? new Lexer(buf, trailerAt + 7) : null;
  if (tlx) tlx.skip();
  const trailerStart = tlx ? tlx.i : -1;
  const trailer = tlx ? tlx.value() : null;
  const trailerEnd = tlx ? tlx.i : -1;
  const sx = /startxref\s+(\d+)\s*%%EOF\s*$/.exec(text);
  let root = trailer && get(trailer.Root);
  if (!root) for (const o of objects.values()) if (o.val && o.val.Type && o.val.Type.name === 'Catalog') root = o.val;
  // pages in order, by object number
  const pages = [];
  (function walk(node) {
    const n = get(node);
    if (!n) return;
    if (n.Type && n.Type.name === 'Pages') (get(n.Kids) || []).forEach(walk);
    else pages.push(node.ref);
  })(root.Pages);
  return { buf, objects, get, data, root, pages, trailer: { start: trailerStart, end: trailerEnd, startxref: sx ? +sx[1] : null } };
}

// The object numbers of the bookmarks, in reading order.
function outlineItems(pdf) {
  const out = [];
  const ol = pdf.get(pdf.root.Outlines);
  (function walk(ref) {
    while (ref) {
      const it = pdf.get(ref);
      if (!it) break;
      out.push(ref.ref);
      if (it.First) walk(it.First);
      ref = it.Next;
    }
  })(ol && ol.First);
  return out;
}

// Rewrites the titles of the bookmarks with an incremental update: the bytes of the original file stay as they are, and
// the bookmark objects are appended in their new version with a new cross-reference section (ISO 32000-1, 7.5.6).
function setOutlineTitles(buf, titles) {
  const pdf = readPdf(buf);
  const items = outlineItems(pdf);
  if (items.length !== titles.length) throw new Error(`setOutlineTitles: ${items.length} bookmarks, ${titles.length} titles`);
  if (pdf.trailer.start < 0 || pdf.trailer.startxref == null) throw new Error('setOutlineTitles: no classic trailer');
  const hex = (s) => { const b = Buffer.from(s, 'utf16le'); b.swap16(); return '<FEFF' + b.toString('hex').toUpperCase() + '>'; };
  const parts = [buf];
  let size = buf.length;
  const add = (s) => { const b = Buffer.from(s, 'latin1'); parts.push(b); size += b.length; };
  if (buf[buf.length - 1] !== 0x0a) add('\n');
  const offsets = [];
  items.forEach((num, k) => {
    const o = pdf.objects.get(num);
    const raw = buf.toString('latin1', o.valStart, o.valEnd);
    const at = raw.indexOf('/Title');
    if (at < 0) throw new Error(`setOutlineTitles: object ${num} has no title`);
    const lx = new Lexer(Buffer.from(raw, 'latin1'), at + 6);
    lx.skip();
    const from = lx.i;
    lx.value();
    const dict = raw.slice(0, from) + hex(titles[k]) + raw.slice(lx.i);
    offsets.push([num, size]);
    add(`${num} 0 obj\n${dict}\nendobj\n`);
  });
  const xref = size;
  offsets.sort((a, b) => a[0] - b[0]);
  add('xref\n' + offsets.map(([num, off]) => `${num} 1\n${String(off).padStart(10, '0')} 00000 n\r\n`).join(''));
  const t = buf.toString('latin1', pdf.trailer.start, pdf.trailer.end).replace(/\/Prev\s+\d+/, '');
  add(`trailer\n${t.replace(/>>\s*$/, ` /Prev ${pdf.trailer.startxref} >>`)}\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(parts);
}

const decodeText = (s) => {
  if (!s || !s.str) return '';
  const b = s.str;
  if (b[0] === 0xfe && b[1] === 0xff) { let out = ''; for (let k = 2; k + 1 < b.length; k += 2) out += String.fromCharCode((b[k] << 8) | b[k + 1]); return out; }
  return b.toString('latin1');
};

// [{ title, level, page }] with 1-based page numbers
function outline(pdf) {
  const out = [];
  const pageOf = (dest) => {
    let d = pdf.get(dest);
    if (d && d.D) d = pdf.get(d.D);
    if (Array.isArray(d) && d[0] && d[0].ref != null) return pdf.pages.indexOf(d[0].ref) + 1;
    return 0;
  };
  const ol = pdf.get(pdf.root.Outlines);
  (function walk(ref, level) {
    while (ref) {
      const it = pdf.get(ref);
      if (!it) break;
      const a = pdf.get(it.A);
      out.push({ title: decodeText(it.Title), level, page: pageOf(it.Dest || (a && a.D)) });
      if (it.First) walk(it.First, level + 1);
      ref = it.Next;
    }
  })(ol && ol.First, 1);
  return out;
}

// Struct element types and their counts, the /Alt texts of figures, the document language.
function structure(pdf) {
  const counts = {};
  const alts = [];
  for (const o of pdf.objects.values()) {
    const v = o.val;
    if (v && v.S && v.S.name && (v.P || v.K !== undefined) && (!v.Type || v.Type.name === 'StructElem')) {
      counts[v.S.name] = (counts[v.S.name] || 0) + 1;
      if (v.S.name === 'Figure') alts.push(decodeText(pdf.get(v.Alt)));
    }
  }
  return { counts, alts, lang: decodeText(pdf.get(pdf.root.Lang)), tagged: !!pdf.root.StructTreeRoot };
}

function fonts(pdf) {
  const out = [];
  for (const o of pdf.objects.values()) {
    const v = o.val;
    if (!v || !v.Type || v.Type.name !== 'Font' || v.Subtype.name === 'Type0') continue;
    const fd = pdf.get(v.FontDescriptor);
    out.push({ name: v.BaseFont ? v.BaseFont.name : '', embedded: !!(fd && (fd.FontFile || fd.FontFile2 || fd.FontFile3)) });
  }
  return out;
}

function links(pdf) {
  const out = [];
  for (const o of pdf.objects.values()) {
    const v = o.val;
    if (!v || !v.Subtype || v.Subtype.name !== 'Link') continue;
    const a = pdf.get(v.A);
    out.push(a && a.URI ? { uri: decodeText(a.URI) } : { internal: true });
  }
  return out;
}

function mediaBoxes(pdf) {
  return pdf.pages.map((p) => { let n = pdf.get({ ref: p }); let mb; while (n && !(mb = n.MediaBox)) n = pdf.get(n.Parent); return pdf.get(mb); });
}

// ToUnicode CMap → Map(code → text)
function cmap(bytes) {
  const s = bytes.toString('latin1');
  const map = new Map();
  const hex = (h) => parseInt(h, 16);
  const uni = (h) => { let out = ''; for (let k = 0; k + 3 < h.length + 1; k += 4) out += String.fromCharCode(parseInt(h.slice(k, k + 4), 16)); return out; };
  for (const blk of s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const m of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) map.set(hex(m[1]), uni(m[2]));
  for (const blk of s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])/g)) {
      const a = hex(m[1]);
      const z = hex(m[2]);
      if (m[3][0] === '[') { const list = [...m[3].matchAll(/<([0-9A-Fa-f]+)>/g)]; for (let k = a; k <= z; k++) map.set(k, uni(list[k - a][1])); } else {
        const base = m[3].slice(1, -1);
        const start = parseInt(base.slice(-4), 16);
        for (let k = a; k <= z; k++) map.set(k, uni(base.slice(0, -4) + (start + k - a).toString(16).padStart(4, '0')));
      }
    }
  }
  return map;
}

// The text of each page, in content order (Chromium writes it in reading order).
function pageTexts(pdf) {
  const fontCache = new Map();
  const fontInfo = (ref) => {
    const key = ref && ref.ref != null ? ref.ref : ref;
    if (fontCache.has(key)) return fontCache.get(key);
    const f = pdf.get(ref);
    const info = { two: f && f.Subtype && f.Subtype.name === 'Type0', map: new Map() };
    if (f && f.ToUnicode && f.ToUnicode.ref != null) { const d = pdf.data(f.ToUnicode.ref); if (d) info.map = cmap(d); }
    fontCache.set(key, info);
    return info;
  };
  const run = (bytes, resources, out, depth) => {
    if (!bytes || depth > 8) return;
    const lx = new Lexer(bytes);
    const stack = [];
    let font = null;
    const fontsDict = pdf.get(resources && pdf.get(resources).Font) || {};
    const xobjects = pdf.get(resources && pdf.get(resources).XObject) || {};
    const show = (s) => {
      if (!font || !s || !s.str) return;
      const b = s.str;
      if (font.two) for (let k = 0; k + 1 < b.length; k += 2) out.push(font.map.get((b[k] << 8) | b[k + 1]) || '');
      else for (let k = 0; k < b.length; k++) out.push(font.map.get(b[k]) || String.fromCharCode(b[k]));
    };
    for (;;) {
      const v = lx.value();
      if (v === undefined) break;
      if (!(v && v.op)) { stack.push(v); continue; }
      const op = v.op;
      if (op === 'Tf') { const name = stack[stack.length - 2]; font = name && fontsDict[name.name] ? fontInfo(fontsDict[name.name]) : null; }
      else if (op === 'Tj' || op === "'" || op === '"') { if (op !== 'Tj') out.push('\n'); show(stack[stack.length - 1]); }
      else if (op === 'TJ') { for (const e of stack[stack.length - 1] || []) { if (typeof e === 'number') { if (e < -180) out.push(' '); } else show(e); } }
      else if (op === 'Td' || op === 'TD') { if (stack[stack.length - 1]) out.push('\n'); else out.push(' '); }
      else if (op === 'T*' || op === 'ET') out.push('\n');
      else if (op === 'Tm') out.push('\n');
      else if (op === 'Do') {
        const xo = xobjects[stack[stack.length - 1] && stack[stack.length - 1].name];
        const x = pdf.get(xo);
        if (x && x.Subtype && x.Subtype.name === 'Form' && xo.ref != null) run(pdf.data(xo.ref), x.Resources || resources, out, depth + 1);
      } else if (op === 'BI') { const end = bytes.indexOf('EI', lx.i, 'latin1'); lx.i = end < 0 ? bytes.length : end + 2; }
      stack.length = 0;
    }
  };
  return pdf.pages.map((p) => {
    let page = pdf.get({ ref: p });
    let res = page.Resources;
    let n = page;
    while (!res && n) { n = pdf.get(n.Parent); res = n && n.Resources; }
    const contents = Array.isArray(pdf.get(page.Contents)) ? pdf.get(page.Contents) : [page.Contents];
    const out = [];
    for (const c of contents) if (c && c.ref != null) run(pdf.data(c.ref), res, out, 0);
    return out.join('');
  });
}

module.exports = { readPdf, outline, outlineItems, setOutlineTitles, structure, fonts, links, mediaBoxes, pageTexts, decodeText };
