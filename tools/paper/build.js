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
// Builds the scientific paper from its Markdown (docs/methodology/paper/valesta-method.<lang>.md): the figures for
// GitHub (figures/fig-N.<lang>.svg), the self-contained HTML next to the Markdown and, with --pdf, the A4 PDF in
// dist/paper/, printed twice so that the contents list carries the page numbers of the bookmarks.
// Usage: node tools/paper/build.js [--lang en] [--pdf] [--pdf-dir <folder>]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parse, inline, plain, esc } = require('./markdown.js');
const { tex } = require('./tex.js');
const { figures } = require('./figures.js');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'docs', 'methodology', 'paper');
const PDF_DIR = path.join(ROOT, 'dist', 'paper');

const UI = {
  it: { status: 'Stato', date: 'Data', issuer: 'Editore', toc: 'Indice', meta: 'Informazioni sul documento' },
  en: { status: 'Status', date: 'Date', issuer: 'Publisher', toc: 'Contents', meta: 'About this document' },
};

const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const HEADER = read('src', 'index.template.html').split('\n').slice(1, 17).join('\n');   // the AGPL comment
const CSS = read('tools', 'paper', 'paper.css').replace(/^\/\*[\s\S]*?\*\/\s*/, '');      // without its own licence header

// The embedded fonts of the app (Latin subsets, SIL OFL 1.1): Inter and Cormorant Garamond, each file once.
function fontFaces() {
  const css = read('src', 'css', 'fonts.css');
  const seen = new Set();
  const out = [];
  for (const m of css.matchAll(/\/\* (Inter|Cormorant Garamond) (normal|italic) latin \*\/\s*@font-face \{([\s\S]*?)\}/g)) {
    const src = /src: (url\(data:font\/woff2;base64,[A-Za-z0-9+/=]+\) format\('woff2'\)|url\(data:font\/woff2;base64,[A-Za-z0-9+/=]+\))/.exec(m[3]);
    const range = /unicode-range: ([^;]+);/.exec(m[3]);
    if (!src || seen.has(src[1])) continue;
    seen.add(src[1]);
    const weight = m[1] === 'Inter' ? '400 800' : m[2] === 'italic' ? '500 600' : '500 700';
    out.push(`@font-face{font-family:'${m[1]}';font-style:${m[2]};font-weight:${weight};font-display:swap;src:${src[1]};${range ? `unicode-range:${range[1]};` : ''}}`);
  }
  if (out.length !== 3) throw new Error(`fonts: expected Inter and two Cormorant Garamond files, found ${out.length}`);
  return out.join('\n');
}

const svgFile = (name) => read('brand', name).replace(/<\?xml[^>]*>\s*/, '').trim();
const LOGO = svgFile('valesta-logo-reverse.svg').replace('<svg ', '<svg class="cover-logo" focusable="false" ');
// The running head carries the small-size symbol at 5 mm, the minimum of the brand guide for print.
const SYMBOL_URI = 'data:image/svg+xml,' + encodeURIComponent(svgFile('valesta-symbol-small.svg').replace(/ width="[^"]*" height="[^"]*"/, '')
  .replace('<svg ', '<svg width="19" height="19" '));
const ARCS = (() => {
  const cx = 430;
  const cy = 470;
  const arc = (r) => `<path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}"/>`;
  return `<svg class="cover-art" viewBox="0 0 860 470" aria-hidden="true" focusable="false"><g fill="none" stroke="#FFFFFF" stroke-width="1.4">`
    + `<g stroke-opacity="0.085">${[400, 360, 320, 280].map(arc).join('')}</g><g stroke-opacity="0.13">${arc(230)}</g>`
    + `<g stroke-opacity="0.06">${[190, 150, 110].map(arc).join('')}</g></g></svg>`;
})();

// "**Domestone S.r.l.** · Articolo tecnico · Bozza per la revisione tecnica, 24 novembre 2026"
function metaLine(text) {
  const parts = text.split(' · ').map((s) => s.trim());
  const issuer = plain(parts[0]);
  const kind = parts[1];
  const last = parts.slice(2).join(' · ');
  const k = last.lastIndexOf(', ');
  return { issuer, kind, status: k > 0 ? last.slice(0, k) : last, date: k > 0 ? last.slice(k + 2) : '' };
}

// For the PDF: the static Inter files of the system, when they are installed (or in the folder PAPER_FONTS), so that the
// PDF embeds TrueType fonts with true italics and Greek letters; Chromium embeds a variable font, such as the Inter of
// the app, as Type 3 glyphs. Without the files the embedded variable Inter is used.
const INTER_STATIC = [['400', 'normal', 'Regular'], ['500', 'normal', 'Medium'], ['600', 'normal', 'SemiBold'], ['700', 'normal', 'Bold'], ['400', 'italic', 'Italic']];
function printFonts() {
  const dirs = [process.env.PAPER_FONTS, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'),
    process.env.WINDIR && path.join(process.env.WINDIR, 'Fonts'), path.join(os.homedir(), 'Library', 'Fonts'), '/Library/Fonts',
    path.join(os.homedir(), '.local', 'share', 'fonts'), '/usr/share/fonts/truetype/inter'].filter(Boolean);
  const file = (n) => dirs.map((d) => path.join(d, `Inter-${n}.ttf`)).find((p) => fs.existsSync(p));
  const faces = INTER_STATIC.map(([w, s, n]) => [w, s, file(n)]);
  if (faces.some((f) => !f[2])) return { css: '', found: false };
  const css = faces.map(([w, s, f]) => `@font-face{font-family:'Inter Print';font-weight:${w};font-style:${s};src:url(data:font/ttf;base64,${fs.readFileSync(f).toString('base64')}) format('truetype');}`).join('\n')
    + "\n:root{--sans:'Inter Print','Inter','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}\n.fig svg{font-family:var(--sans)}";
  return { css, found: true };
}

const cssStr = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
function pageRules(run) {
  const font = "'Inter Print', 'Inter', 'Segoe UI', Arial, sans-serif";
  return `@page { size: A4; margin: 22mm 18mm 19mm 18mm;
  @top-left { content: url("${SYMBOL_URI}") "\\2002 ${cssStr(run.left)}"; font: 500 6.8pt ${font}; color: #5A6670; vertical-align: middle; }
  @top-right { content: "${cssStr(run.right)}"; font: 500 6.8pt ${font}; color: #5A6670; vertical-align: middle; }
  @bottom-left { content: "${cssStr(run.issuer)}"; font: 600 6.8pt ${font}; color: #0B4F47; letter-spacing: .03em; vertical-align: middle; }
  @bottom-right { content: counter(page) " / " counter(pages); font: 500 6.8pt ${font}; color: #5A6670; vertical-align: middle; }
}
@page cover { margin: 0; @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }`;
}

const NUMERIC = /^[−+]?[\d.,%\s–()±m² ]+$/;
function tableHtml(t, cap, o) {
  const gap = t.head.map((h, k) => !h && t.rows.every((r) => !r[k]));
  const cls = (k, c, head) => (gap[k] ? ' class="gap"' : t.align[k] === 'right' || (!t.align[k] && !head && NUMERIC.test(c) && /\d/.test(c)) ? ' class="num"' : '');
  const id = cap ? ` id="${plain(cap[1]).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}"` : '';
  const narrow = t.head.length <= 5 ? ' narrow' : '';   // a table of a few columns stays in the text column
  // On a narrow screen the table scrolls sideways: its caption is shown above the scrolling area (hidden from screen
  // readers, which read the caption of the table), while print shows the caption of the table itself.
  const capText = cap ? `<span class="lbl">${cap[1]}</span> ${inline(cap[2], o)}` : '';
  return `<div class="tbl${narrow}"${id}>${cap ? `<p class="tcap" aria-hidden="true">${capText}</p>` : ''}<div class="tscroll"><table>${cap ? `<caption>${capText}</caption>` : ''}`
    + `<thead><tr>${t.head.map((h, k) => (gap[k] ? '<td class="gap" aria-hidden="true"></td>' : `<th scope="col"${cls(k, h, true)}>${inline(h, o)}</th>`)).join('')}</tr></thead>`
    + `<tbody>${t.rows.map((r) => `<tr>${r.map((c, k) => (gap[k] ? '<td class="gap" aria-hidden="true"></td>' : `<td${cls(k, c)}>${inline(c, o)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

function listHtml(x, o) {
  const KEY = /^\*\*\[([A-Z][A-Z0-9]*-[A-Z0-9-]+)\]\*\*\s*([\s\S]*)$/;
  if (x.items.every((it) => KEY.test(it.text))) {
    return '<ul class="refs">' + x.items.map((it) => {
      const m = KEY.exec(it.text);
      const k = m[2].lastIndexOf(' — ');
      const body = k > 0 ? `${inline(m[2].slice(0, k), o)} <span class="st">${inline(m[2].slice(k + 1), o)}</span>` : inline(m[2], o);
      return `<li id="ref-${m[1]}"><span class="key">[${m[1]}]</span> ${body}</li>`;
    }).join('') + '</ul>';
  }
  return '<ul>' + x.items.map((it) => `<li>${inline(it.text, o)}${it.sub.length ? `<ul>${it.sub.map((s) => `<li>${inline(s, o)}</li>`).join('')}</ul>` : ''}</li>`).join('') + '</ul>';
}

function headingHtml(x, o, extra = '') {
  const n = /^(\d+(?:\.\d+)*\.?)\s+(.*)$/.exec(x.text);
  const inner = n ? `<span class="num">${n[1]} </span>${inline(n[2], o)}` : inline(x.text, o);
  return `<h${x.level} id="${x.id}"${extra}>${inner}</h${x.level}>`;
}

const CAPTION = /^\*\*((?:Tabella|Table|Figura|Figure) [A-Z]?\.?\d+(?:\.\d+)?\.)\*\*\s*([\s\S]*)$/;
function blocksHtml(blocks, o) {
  let out = '';
  for (let k = 0; k < blocks.length; k++) {
    const x = blocks[k];
    const next = blocks[k + 1];
    if (x.type === 'h') out += headingHtml(x, o, o.pageBreaks && o.pageBreaks.includes(x.id) ? ' class="break-before"' : '');
    else if (x.type === 'p') {
      const cap = CAPTION.exec(x.text);
      if (cap && /^(Tabella|Table)/.test(cap[1]) && next && next.type === 'table') { out += tableHtml(next, cap, o); k++; } else out += `<p>${inline(x.text, o)}</p>`;
    } else if (x.type === 'table') out += tableHtml(x, null, o);
    else if (x.type === 'img') {
      const m = /fig-(\d+)\.[a-z]+\.svg$/.exec(x.src);
      const f = m && o.figs[+m[1] - 1];
      if (!f) throw new Error(`no figure for ${x.src}`);
      const cap = next && next.type === 'p' && CAPTION.exec(next.text);
      const capHtml = cap && /^(Figura|Figure)/.test(cap[1]) ? `<figcaption><span class="lbl">${cap[1]}</span> ${inline(cap[2], o)}</figcaption>` : '';
      if (capHtml) k++;
      out += `<figure class="fig" id="figura-${f.n}">${f.svg.replace(/ width="\d+" height="\d+"/, '')}${capHtml}</figure>`;
    } else if (x.type === 'math') {
      const r = tex(x.src);
      out += `<div class="eq"${r.tag ? ` id="eq-${r.tag}"` : ''}>${r.mathml}${r.tag ? `<span class="eq-no">(${r.tag})</span>` : ''}</div>`;
    } else if (x.type === 'list') out += listHtml(x, o);
    else if (x.type === 'quote') out += `<div class="note" role="note">${blocksHtml(x.blocks, o)}</div>`;
    else if (x.type === 'code') out += `<pre><code>${esc(x.text)}</code></pre>`;
    out += '\n';
  }
  return out;
}

// The model of the paper: title, meta line, legal notes, abstract and body.
function model(md) {
  const blocks = parse(md).filter((x) => x.type !== 'html');   // the logo at the top is for GitHub
  const h1 = blocks.findIndex((x) => x.type === 'h1');
  const h2 = blocks.findIndex((x, k) => k > h1 && x.type === 'h' && x.level === 2);
  const next = blocks.findIndex((x, k) => k > h2 && x.type === 'h' && x.level === 2);
  const front = blocks.slice(h1 + 1, h2);
  return {
    title: blocks[h1].text,
    meta: metaLine(front[0].text),
    legal: front.slice(1),
    abstract: blocks.slice(h2, next),
    body: blocks.slice(next),
  };
}

function html(md, lang, opts = {}) {
  const ui = UI[lang];
  const m = model(md);
  const o = { lang, print: !!opts.print, figs: figures(lang), pageBreaks: [] };
  const k = m.title.indexOf(': ');
  // the colon stays in the text of the title (bookmark, screen readers) but is not seen: the subtitle starts a new line
  const titleHtml = k > 0 ? `${inline(m.title.slice(0, k), o)}<span class="colon">: </span><span class="sub">${inline(m.title.slice(k + 2), o)}</span>` : inline(m.title, o);
  const [ah, ...arest] = m.abstract;
  const abstract = `<h2 id="${ah.id}" class="label">${inline(ah.text, o)}</h2>\n` + arest.map((x) => {
    if (x.type !== 'p') return blocksHtml([x], o);
    if (/^\*\*[^*]+:\*\*/.test(x.text)) return `<p class="kw">${inline(x.text, o)}</p>\n`;
    return `<p class="lead">${inline(x.text, o)}</p>\n`;
  }).join('');
  const heads = m.body.filter((x) => x.type === 'h' && (x.level === 2 || x.level === 3));
  const toc = `<nav class="toc" aria-labelledby="toc-title"><h2 class="label" id="toc-title">${ui.toc}</h2><ol>`
    + heads.map((x) => {
      const n = /^(\d+(?:\.\d+)*\.?)\s+(.*)$/.exec(x.text);
      return `<li class="l${x.level}"><a href="#${x.id}"><span class="n">${n ? n[1] : ''}</span><span class="t">${inline(n ? n[2] : x.text, o)}</span>`
        + `<span class="pg" data-for="${esc(plain(x.text))}">${opts.pages && opts.pages[plain(x.text)] ? opts.pages[plain(x.text)] : ''}</span></a></li>`;
    }).join('') + '</ol></nav>';
  const colophon = `<div class="colophon">${m.legal.map((x) => blocksHtml([x], o)).join('')}</div>`;
  const firstSentence = plain(arest.find((x) => x.type === 'p').text).split(/(?<=\.)\s/)[0];
  const run = { left: k > 0 ? m.title.slice(0, k) : m.title, right: `${m.meta.kind} · ${m.meta.date}`, issuer: m.meta.issuer };
  return `<!doctype html>
${HEADER}
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(plain(m.title))}</title>
<meta name="author" content="${esc(m.meta.issuer)}">
<meta name="description" content="${esc(firstSentence)}">
<meta name="color-scheme" content="light">
<style>
${fontFaces()}
${CSS}
${pageRules(run)}${opts.print ? '\n' + printFonts().css : ''}
</style>
</head>
<body>
<header class="cover"><div class="cover-in">
${ARCS}
${LOGO}
<p class="cover-kicker">${esc(m.meta.kind)}</p>
<h1 class="cover-title">${titleHtml}</h1>
<span class="cover-rule" aria-hidden="true"></span>
<dl class="cover-meta"><div><dt>${ui.status}</dt><dd>${esc(m.meta.status)}</dd></div><div><dt>${ui.date}</dt><dd>${inline(m.meta.date, o)}</dd></div><div><dt>${ui.issuer}</dt><dd>${esc(m.meta.issuer)}</dd></div></dl>
</div></header>
<main>
<section class="doc front" aria-label="${esc(ui.meta)}">
${abstract}${toc}
${colophon}
</section>
<article class="doc">
${blocksHtml(m.body, o)}</article>
</main>
<footer class="site-foot"><div><span><strong>${esc(m.meta.issuer)}</strong> · ${esc(m.meta.kind)} · ${inline(m.meta.date, o)}</span><span>${esc(plain(m.title.slice(0, k > 0 ? k : undefined)))}</span></div></footer>
</body>
</html>
`;
}

// The headings in the order of the bookmarks: the title, the abstract, the contents, then the body.
function headings(md, lang) {
  const m = model(md);
  return [plain(m.title), plain(m.abstract[0].text), UI[lang].toc,
    ...m.body.filter((x) => x.type === 'h' && x.level <= 3).map((x) => plain(x.text))];
}

// Chromium builds the bookmarks from the laid-out lines of each heading, and joins wrapped lines without a space: the
// bookmarks are matched to the headings by order (their letters must agree) and then given the exact titles.
async function printPdf(md, lang, out) {
  const { withBrowser } = require('./browser.js');
  const { readPdf, outline, setOutlineTitles } = require('./pdf.js');
  const want = headings(md, lang);
  const letters = (s) => s.toLowerCase().replace(/[’ʼ]/g, "'").replace(/[\s ]+/g, '');
  const pagesOf = (file) => {
    const marks = outline(readPdf(fs.readFileSync(file)));
    if (marks.length !== want.length) throw new Error(`${marks.length} bookmarks for ${want.length} headings`);
    marks.forEach((b, k) => { if (letters(b.title) !== letters(want[k])) throw new Error(`bookmark ${k + 1} "${b.title}" is not "${want[k]}"`); });
    return Object.fromEntries(want.map((t, k) => [t, marks[k].page]));
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'valesta-paper-print-'));
  try {
    return await withBrowser(async (page) => {
      const first = path.join(tmp, `pass1.${lang}.html`);
      fs.writeFileSync(first, html(md, lang, { print: true }));
      await page.open(first);
      await page.print(path.join(tmp, 'pass1.pdf'));
      const pages = pagesOf(path.join(tmp, 'pass1.pdf'));
      const second = path.join(tmp, `pass2.${lang}.html`);
      fs.writeFileSync(second, html(md, lang, { print: true, pages }));
      await page.open(second);
      await page.print(path.join(tmp, 'pass2.pdf'));
      const again = pagesOf(path.join(tmp, 'pass2.pdf'));
      const moved = want.filter((t) => again[t] !== pages[t]);
      if (moved.length) throw new Error(`the page numbers moved between the two passes: ${moved.join('; ')}`);
      const fixed = setOutlineTitles(fs.readFileSync(path.join(tmp, 'pass2.pdf')), want);
      fs.writeFileSync(out, fixed);
      const check = outline(readPdf(fixed));
      check.forEach((b, k) => { if (b.title !== want[k] || b.page !== pages[want[k]]) throw new Error(`bookmark ${k + 1} after the fix: "${b.title}"`); });
      return { pages: readPdf(fixed).pages.length, bookmarks: check.length };
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const li = args.indexOf('--lang');
  const all = fs.readdirSync(DIR).map((f) => /^valesta-method\.([a-z]{2})\.md$/.exec(f)).filter(Boolean).map((x) => x[1]);
  const langs = li >= 0 ? args[li + 1].split(',') : all.filter((l) => /^```math$/m.test(fs.readFileSync(path.join(DIR, `valesta-method.${l}.md`), 'utf8')));
  fs.mkdirSync(path.join(DIR, 'figures'), { recursive: true });
  for (const lang of langs) {
    if (!UI[lang]) throw new Error(`no interface texts for ${lang}`);
    const md = fs.readFileSync(path.join(DIR, `valesta-method.${lang}.md`), 'utf8');
    for (const f of figures(lang)) fs.writeFileSync(path.join(DIR, 'figures', f.file), f.svg + '\n');
    const out = path.join(DIR, `valesta-method.${lang}.html`);
    const page = html(md, lang);
    fs.writeFileSync(out, page);
    console.log(`written ${path.relative(ROOT, out)} (${Math.round(page.length / 1024)} KB) and ${figures(lang).length} figures`);
    if (args.includes('--pdf')) {
      const di = args.indexOf('--pdf-dir');
      const dir = di >= 0 ? path.resolve(args[di + 1]) : PDF_DIR;
      fs.mkdirSync(dir, { recursive: true });
      const pdf = path.join(dir, `valesta-method.${lang}.pdf`);
      const r = await printPdf(md, lang, pdf);
      console.log(`printed ${path.relative(ROOT, pdf)}: ${r.pages} pages, ${r.bookmarks} bookmarks, ${Math.round(fs.statSync(pdf).size / 1024)} KB`);
    }
  }
}

if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exit(1); });

module.exports = { html, model, metaLine, headings };
