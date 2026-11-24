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
// Reads the Markdown of the paper into blocks, and its inline text into HTML. It covers the subset that GitHub renders
// and the paper uses: headings, paragraphs, lists with one nested level, tables with alignment, notes (> lines),
// figures (![alt](src) alone on a line), ```math blocks and raw HTML blocks (shown on GitHub only).
'use strict';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The anchor GitHub gives a heading: lower case, punctuation removed, each space a hyphen.
const slug = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '').replace(/ /g, '-');

function table(lines) {
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const align = cells(lines[1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : /^:-/.test(c) ? 'left' : ''));
  return { type: 'table', head: cells(lines[0]), align, rows: lines.slice(2).map(cells) };
}

function parse(md) {
  const lines = String(md).replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  const interrupts = (l) => /^(#{1,6} |```|\||>|- |!\[)/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^```/.test(l)) {
      const lang = l.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(lang === 'math' ? { type: 'math', src: body.join('\n').trim() } : { type: 'code', lang, text: body.join('\n') });
      continue;
    }
    const h = /^(#{1,6}) (.*)$/.exec(l);
    if (h) {
      const text = h[2].trim();
      out.push(h[1].length === 1 ? { type: 'h1', text } : { type: 'h', level: h[1].length, text, id: slug(text) });
      i++;
      continue;
    }
    if (/^<[A-Za-z!/]/.test(l)) {
      const raw = [];
      while (i < lines.length && lines[i].trim()) raw.push(lines[i++]);
      out.push({ type: 'html', raw: raw.join('\n') });
      continue;
    }
    if (/^\|/.test(l)) {
      const t = [];
      while (i < lines.length && /^\|/.test(lines[i])) t.push(lines[i++]);
      out.push(table(t));
      continue;
    }
    if (/^>/.test(l)) {
      const q = [];
      while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^> ?/, ''));
      out.push({ type: 'quote', blocks: parse(q.join('\n')) });
      continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(l);
    if (img) { out.push({ type: 'img', alt: img[1], src: img[2] }); i++; continue; }
    if (/^- /.test(l)) {
      const items = [];
      while (i < lines.length && (/^- /.test(lines[i]) || /^ {2,}\S/.test(lines[i]))) {
        const s = lines[i++];
        const it = items[items.length - 1];
        if (/^- /.test(s)) items.push({ text: s.slice(2).trim(), sub: [] });
        else if (/^ {2}- /.test(s)) it.sub.push(s.trim().slice(2).trim());
        else if (it.sub.length) it.sub[it.sub.length - 1] += ' ' + s.trim();
        else it.text += ' ' + s.trim();
      }
      out.push({ type: 'list', items });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && interrupts(lines[i]))) para.push(lines[i++].trim());
    out.push({ type: 'p', text: para.join(' ') });
  }
  return out;
}

const MONTHS = 'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|'
  + 'January|February|March|April|May|June|July|August|September|October|November|December';
const UNITS = 'm²|m|mm|km|%|euro|€|anni|mesi|giorni|iterazioni|years|months|days|iterations';
// Typography that leaves the words as they are: typographic apostrophes, and no line break inside a number and its
// unit, a date, a section sign, a reference such as IVS 103, or before a dash.
function typography(s) {
  return s
    .replace(/(\p{L})'/gu, '$1’')
    .replace(/(^|[\s(«“])'(?=\p{L})/gu, '$1‘')
    .replace(new RegExp(`(\\d) (?=(?:${UNITS})(?![\\p{L}\\d]))`, 'gu'), '$1 ')
    .replace(new RegExp(`(\\d{1,2}) (${MONTHS})\\b`, 'g'), '$1 $2')
    .replace(new RegExp(`\\b(${MONTHS}) (\\d{4})\\b`, 'g'), '$1 $2')
    .replace(/(§|\bart\.|\bp\.|\bpp\.) (?=\d)/g, '$1 ')
    .replace(/\b([A-Z]{2,}) (?=\d)/g, '$1 ')
    .replace(/ (–|—)/g, ' $1')
    .replace(/\|[^|\s]{1,40}\|/g, (m) => `<span class="nw">${m}</span>`)
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, (m) => `<span class="nw">${m}</span>`)
    .replace(/(ISBN )([\dX-]{10,})/g, (m, a, b) => `${a}<span class="nw">${b}</span>`);
}

function link(text, url, opts) {
  const other = /^valesta-method\.(en|it)\.md$/.test(url);
  if (other) {
    const ext = opts.print ? '.pdf' : '.html';
    const t = text.replace(/\.md$/, ext);
    return opts.print ? `<span class="xref">${t}</span>` : `<a href="${url.replace(/\.md$/, '.html')}">${t}</a>`;
  }
  if (/^(https?:|mailto:|#)/.test(url)) return `<a href="${url}">${text}</a>`;
  return opts.print ? `<span class="xref">${text}</span>` : `<a href="${url}">${text}</a>`;   // a file of the repository
}

// inline('**x** [KEY] `code`', { lang, print }) → HTML. In print, links to files of the repository become plain text,
// since a PDF would turn them into links to the local disk.
function inline(s, opts = {}) {
  const keep = [];
  const hold = (h) => `\u0000${keep.push(h) - 1}\u0000`;
  s = String(s).replace(/`([^`]+)`/g, (m, c) => hold(`<code>${esc(c)}</code>`));
  s = s.replace(/<(\/?)(sub|sup|i|b|br)>/g, (m) => hold(m));
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => hold(link(t, u, opts)));
  const star = hold('*');
  s = s.replace(/\\\*/g, star);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/\[([A-Z][A-Z0-9]*-[A-Z0-9-]+)\]/g, (m, k) => hold(`<a class="cite" href="#ref-${k}">[${k}]</a>`));
  s = typography(s);
  const back = (x) => x.replace(/\u0000(\d+)\u0000/g, (m, n) => keep[+n]);
  return back(back(s));
}

// Plain text of inline Markdown, for titles and alternative texts.
const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\\\*/g, '*');

module.exports = { parse, inline, plain, slug, esc };
