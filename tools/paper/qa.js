#!/usr/bin/env node
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
// Checks the three formats of the paper against each other and against the rules of the layout, and writes a report.
// Usage: node tools/paper/qa.js --lang it [--pdf <file>] [--baseline <earlier .md>] [--out <report.json>]
// Without --pdf it reads dist/paper/valesta-method.<lang>.pdf. With --baseline it lists every unit of text of the
// earlier Markdown that the new one no longer contains, word for word (it must be none).
'use strict';
const fs = require('fs');
const path = require('path');
const { parse, plain } = require('./markdown.js');
const { tex } = require('./tex.js');
const { headings } = require('./build.js');
const P = require('./pdf.js');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'docs', 'methodology', 'paper');
const arg = (name, dflt) => { const k = process.argv.indexOf(name); return k >= 0 ? process.argv[k + 1] : dflt; };

// The units of text of a Markdown file: headings, paragraphs, list items and table cells (equations apart).
function units(md) {
  const out = [];
  const walk = (blocks) => blocks.forEach((b) => {
    if (b.type === 'h1' || b.type === 'h' || b.type === 'p') out.push(b.text);
    else if (b.type === 'list') b.items.forEach((it) => { out.push(it.text); it.sub.forEach((s) => out.push(s)); });
    else if (b.type === 'table') [b.head, ...b.rows].forEach((r) => r.forEach((c) => c && out.push(c)));
    else if (b.type === 'quote') walk(b.blocks);
  });
  walk(parse(md).filter((b) => b.type !== 'html'));
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
const norm = (s) => decode(s).replace(/[’ʼ‘]/g, "'").replace(/[\s ]+/g, ' ').trim();
const squash = (s) => norm(s).replace(/[\s-]+/g, '').toLowerCase();
const noScripts = (s) => s.replace(/<(sub|sup)>[\s\S]*?<\/\1>/g, '');

async function main() {
  const lang = arg('--lang', 'en');
  const mdFile = path.resolve(arg('--md', path.join(DIR, `valesta-method.${lang}.md`)));
  const htmlFile = path.join(DIR, `valesta-method.${lang}.html`);
  const pdfFile = path.resolve(arg('--pdf', path.join(ROOT, 'dist', 'paper', `valesta-method.${lang}.pdf`)));
  const md = fs.readFileSync(mdFile, 'utf8');
  const html = fs.readFileSync(htmlFile, 'utf8');
  const checks = [];
  const add = (group, check, ok, detail = '') => checks.push({ group, check, result: ok ? 'PASS' : 'FAIL', detail: String(detail) });

  // ----- Markdown
  const mine = units(md);
  const base = arg('--baseline');
  if (base) {
    const before = units(fs.readFileSync(path.resolve(base), 'utf8'));
    const now = new Set(mine);
    const missing = before.filter((u) => !now.has(u));
    const added = mine.filter((u) => !new Set(before).has(u));
    add('Markdown', 'Body text unchanged: each text unit of the previous version is present and identical', !missing.length, missing.length ? missing.join(' ¶ ') : `${before.length} units`);
    add('Markdown', 'Text units added (captions, trademark note)', true, added.join(' ¶ '));
  }
  const refs = [...md.matchAll(/\]\(([^)\s]+)\)|srcset="([^"]+)"|src="([^"]+)"/g)].map((m) => m[1] || m[2] || m[3]).filter((u) => !/^(https?:|#|mailto:)/.test(u));
  const broken = refs.filter((u) => !fs.existsSync(path.resolve(DIR, u.split('#')[0])));
  add('Markdown', 'Relative links and images exist', !broken.length, broken.length ? broken.join(', ') : `${refs.length}`);
  const maths = parse(md).flatMap(function f(b) { return b.type === 'quote' ? b.blocks.flatMap(f) : b.type === 'math' ? [b.src] : []; });
  let tags = [];
  try { tags = maths.map((s) => tex(s).tag); } catch (e) { tags = [e.message]; }
  add('Markdown', 'LaTeX equations are readable and numbered in order', tags.join(',') === maths.map((x, k) => String(k + 1)).join(','), `${maths.length} equations`);
  add('Markdown', 'No remains of the old ```eq format', !/^```eq$/m.test(md), '');

  // ----- HTML
  add('HTML', 'Self-contained: no outside resource, no script', !/<script|<link[^>]+stylesheet|\b(?:src|srcset)="https?:|url\((?:"|')?https?:/i.test(html), `${Math.round(html.length / 1024)} KB`);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  const dead = anchors.filter((a) => !ids.has(decode(a)));
  add('HTML', 'Internal references are valid', !dead.length, dead.length ? dead.join(', ') : `${anchors.length}`);
  add('HTML', 'AGPL header and title', /Copyright \(C\) 2026 Domestone S\.r\.l\./.test(html) && /GNU Affero General Public License/.test(html), '');
  const htmlText = squash(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' '));
  const meta = parse(md).find((b) => b.type === 'p' && / · /.test(b.text));
  const skip = new Set([meta && meta.text]);
  const cmpUnit = (u) => squash(plain(u).replace(/valesta-method\.(en|it)\.md/g, 'valesta-method.$1.html'));
  const missH = mine.filter((u) => !skip.has(u) && !htmlText.includes(cmpUnit(u)));
  add('HTML', 'Same text as the Markdown: each text unit is present', !missH.length, missH.length ? missH.join(' ¶ ') : `${mine.length - 1} units`);
  const tables = (html.match(/<table/g) || []).length;
  const ths = (html.match(/<th /g) || []).length;
  add('HTML', 'Tables have column headers', tables > 0 && ths >= tables, `${tables} tables, ${ths} headers`);
  const figs = [...html.matchAll(/<figure class="fig"[\s\S]*?<\/figure>/g)];
  add('HTML', 'Figures have a title, a description and a caption', figs.length === 4 && figs.every((f) => /<title/.test(f[0]) && /<desc/.test(f[0]) && /<figcaption/.test(f[0])), `${figs.length}`);
  add('HTML', 'Equations in MathML, one for each number', (html.match(/<math display="block"/g) || []).length === maths.length && (html.match(/class="eq"/g) || []).length === maths.length, `${maths.length}`);

  const { withBrowser } = require('./browser.js');
  await withBrowser(async (page) => {
    for (const width of [375, 768, 1280]) {
      await page.open(htmlFile, { width, height: 900, mobile: width < 768 });
      const r = await page.eval('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })');
      add('HTML', `No horizontal scroll of the page at ${width} px`, r.sw <= r.cw + 1, `${r.sw} / ${r.cw}`);
    }
  });

  // ----- PDF
  if (!fs.existsSync(pdfFile)) add('PDF', 'File is present', false, pdfFile);
  else {
    const pdf = P.readPdf(fs.readFileSync(pdfFile));
    const boxes = P.mediaBoxes(pdf);
    add('PDF', 'A4 pages', boxes.every((b) => Math.abs(b[2] - 595.28) < 1.5 && Math.abs(b[3] - 841.89) < 1.5), `${boxes.length} pages`);
    const isType3 = (o) => o.val && o.val.Type && o.val.Type.name === 'Font' && o.val.Subtype && o.val.Subtype.name === 'Type3';
    const type3 = [...pdf.objects.values()].filter(isType3).length;
    const fonts = P.fonts(pdf).filter((f) => f.name);   // a Type 3 font has no name and carries its glyphs in the file
    add('PDF', 'Fonts are embedded', fonts.every((f) => f.embedded), [...new Set(fonts.map((f) => f.name.replace(/^[A-Z]{6}\+/, '')))].join(', ') + (type3 ? `, ${type3} Type 3` : ''));
    add('PDF', 'Text in static Inter (TrueType); Type 3 only for the Cormorant Garamond of the titles', fonts.some((f) => /Inter-Regular/.test(f.name)), `${type3} Type 3 fonts`);
    const marks = P.outline(pdf);
    const want = headings(md, lang);
    add('PDF', 'Bookmarks: one for each title, with the exact text', marks.length === want.length && marks.every((b, k) => b.title === want[k]), `${marks.length}`);
    const texts = P.pageTexts(pdf).map((t) => squash(t));
    // the number of a section sits in the side column and comes after its title in the text of the page
    const bare = (t) => squash(t.replace(/^\d+(?:\.\d+)*\.?\s+/, '')).slice(0, 40);
    const wrong = marks.filter((b) => !texts[b.page - 1] || !texts[b.page - 1].includes(bare(b.title)));
    add('PDF', 'Each bookmark (and page number of the contents) goes to the page that shows the title', !wrong.length, wrong.length ? wrong.map((b) => `${b.title} → ${b.page}`).join('; ') : '');
    const order = marks.map((b) => b.page);
    add('PDF', 'Bookmarks in reading order', order.every((p, k) => !k || p >= order[k - 1]), '');
    const st = P.structure(pdf);
    add('PDF', 'Tagged PDF, with the language of the document', st.tagged && st.lang === lang, `${st.lang}; ${['H1', 'H2', 'H3', 'P', 'L', 'LI', 'Table', 'TH', 'TD', 'Figure'].map((t) => `${t} ${st.counts[t] || 0}`).join(', ')}`);
    const alts = st.alts.filter(Boolean);
    add('PDF', 'Figures have alternative text (logo and four figures)', alts.length >= 5, alts.map((a) => a.slice(0, 40)).join(' | '));
    const links = P.links(pdf);
    const local = links.filter((l) => l.uri && /^file:/i.test(l.uri));
    add('PDF', 'No link to a file on the local disk', !local.length, `${links.filter((l) => l.internal).length} internal, ${links.filter((l) => l.uri).length} external`);
    const all = texts.join('');
    // A PDF keeps subscripts, section numbers and reference keys as separate runs of text, which may come after the line
    // they belong to: a unit is found when its pieces between those runs appear in order.
    const heads = new Set(parse(md).filter((b) => b.type === 'h').map((b) => b.text));
    const inOrder = (parts) => { let at = 0; for (const p of parts) { if (!p) continue; const i = all.indexOf(p, at); if (i < 0) return false; at = i + p.length; } return true; };
    const found = (u) => {
      let s = u.replace(/valesta-method\.(en|it)\.md/g, 'valesta-method.$1.pdf');
      if (heads.has(u)) s = s.replace(/^\d+(?:\.\d+)*\.?\s+/, '');
      const key = /^\*\*\[([^\]]+)\]\*\*\s*/.exec(s);
      if (key && !all.includes(squash(`[${key[1]}]`))) return false;
      if (key) s = s.slice(key[0].length);
      s = s.replace(/\\\*/g, '\u0001').replace(/\*+/g, '').replace(/\u0001/g, '*');   // emphasis marks, not an escaped star
      // word by word, in order: a paragraph may continue on the next page, after the running head and foot
      return inOrder(s.split(/<(?:sub|sup)>[\s\S]*?<\/(?:sub|sup)>/).flatMap((c) => plain(c).split(/\s+/)).map(squash));
    };
    const missP = mine.filter((u) => !skip.has(u) && !found(u));
    add('PDF', 'Same text as the Markdown: each text unit is present', !missP.length, missP.length ? missP.slice(0, 8).join(' ¶ ') : `${mine.length - 1} units`);
    const ph = /\b(TODO|TBD|XXX|lorem ipsum)\b|\{\{|\[\[/i;
    add('PDF', 'No placeholder', !ph.test(P.pageTexts(pdf).join(' ')), '');
    // Chromium draws a page in the coordinates of the whole document: a rule on the line where the page breaks would be
    // painted at the foot of one page and at the head of the next
    const rules = {};
    pdf.pages.forEach((ref, k) => {
      const pg = pdf.get({ ref });
      const parts = Array.isArray(pdf.get(pg.Contents)) ? pdf.get(pg.Contents) : [pg.Contents];
      const s = parts.map((c) => (pdf.data(c.ref) || Buffer.alloc(0)).toString('latin1')).join('\n');
      for (const m of s.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re/g)) if (+m[3] > 400 && Math.abs(+m[4]) < 3) (rules[m[2]] = rules[m[2]] || new Set()).add(k + 1);
    });
    const twice = Object.entries(rules).filter(([, p]) => p.size > 1);
    add('PDF', 'No rule repeated across two pages', !twice.length, twice.length ? twice.map(([y, p]) => `${[...p].join('/')}`).join('; ') : `${Object.keys(rules).length} rules`);
  }

  const fails = checks.filter((c) => c.result === 'FAIL');
  const out = arg('--out');
  if (out) fs.writeFileSync(path.resolve(out), JSON.stringify({ lang, date: new Date().toISOString().slice(0, 10), summary: fails.length ? 'FAIL' : 'PASS', checks }, null, 1));
  for (const c of checks) console.log(`${c.result}  ${c.group.padEnd(8)} ${c.check}${c.detail ? `: ${c.detail.slice(0, 300)}` : ''}`);
  console.log(`\n${checks.length - fails.length}/${checks.length} PASS`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
