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
// Keeps docs/methodology true to the code: when a change moves a line or a number, a test fails and the documents
// are updated in the same change.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MCA = require('../src/js/engine.js');
const DEFAULT_STATE = require('../src/js/data.js');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs', 'methodology');
const mdFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? mdFiles(path.join(dir, e.name))
  : /\.md$/.test(e.name) ? [path.join(dir, e.name)] : []));
const DOC_FILES = mdFiles(DOCS);
const read = (name) => fs.readFileSync(path.join(DOCS, name), 'utf8');
const section = (text, from, to) => { const a = text.indexOf(from); const b = to ? text.indexOf(to, a + 1) : -1; return a < 0 ? '' : text.slice(a, b < 0 ? undefined : b); };
const flat = (text) => text.replace(/[ \t]*\n[ \t]*/g, ' ');   // a sentence may wrap; table rows stay whole
const fresh = () => JSON.parse(JSON.stringify(DEFAULT_STATE));
// decimal rounding (0.70975 → 0.7098), not the rounding of the binary value
const rnd = (x, d) => Math.sign(x) * Math.round(Math.abs(x) * 10 ** d + 1e-7) / 10 ** d;
const fx = (x, d) => rnd(x, d).toFixed(d);
const en = (x, d) => rnd(x, d).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const g3 = (x) => fx(x, 3).replace(/0$/, '');   // 0.30, 0.24, 0.165 as in the tables
const signed = (x) => `${x < 0 ? '−' : '+'}${Math.abs(x * 100).toFixed(2)}%`;

test('code anchors point to their identifiers', () => {
  const bad = [];
  let count = 0;
  for (const f of DOC_FILES) {
    const text = fs.readFileSync(f, 'utf8');
    const rel = path.relative(DOCS, f);
    // every anchor with a line number names an identifier: `src/js/<file>.js:<n>` (`<id>`), or a range n-m
    const bare = [...text.matchAll(/`(src\/js\/[\w./-]+\.js):(\d+)(?:[-–](\d+))?`(?!\s*\(`)/g)];
    bare.forEach((m) => bad.push(`${rel}: ${m[0]} has no identifier`));
    for (const m of text.matchAll(/`(src\/js\/[\w./-]+\.js):(\d+)(?:[-–](\d+))?`\s*\(`([^`]+)`\)/g)) {
      count++;
      const file = path.join(ROOT, m[1]);
      if (!fs.existsSync(file)) { bad.push(`${rel}: ${m[1]} does not exist`); continue; }
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      const from = Number(m[2]);
      const to = m[3] ? Number(m[3]) : from;
      const span = lines.slice(from - 1, to).join('\n');
      if (!span.includes(m[4])) bad.push(`${rel}: ${m[1]}:${m[2]}${m[3] ? '-' + m[3] : ''} lacks «${m[4]}»`);
    }
  }
  assert.ok(count > 200, `anchors found: ${count}`);
  assert.deepEqual(bad, []);
});

test('factor table matches FACTORS', () => {
  const table = section(read('1-sales-comparison.md'), '### Factors', '### Rating scale');
  const rows = [...table.matchAll(/^\| `(\w+)` \| [^|]+ \| ([\d.]+)% \| ±([\d.]+)% \|$/gm)].map((m) => ({ id: m[1], delta: Number(m[2]) / 100, max: Number(m[3]) / 100 }));
  assert.deepEqual(rows.map((r) => r.id), MCA.FACTORS.map((f) => f.id));
  rows.forEach((r, i) => {
    assert.ok(Math.abs(r.delta - MCA.FACTORS[i].delta) < 1e-9, r.id);
    assert.ok(Math.abs(r.max - 2 * MCA.FACTORS[i].delta) < 1e-9, r.id);
  });
});

test('worked example matches the engine', () => {
  const s = fresh();
  const r = MCA.compute(s);
  const ex = flat(section(read('1-sales-comparison.md'), '## 1.14', '## 1.15'));
  const used = r.comps.filter((c) => c.include);
  assert.equal(used.length, 7);
  for (const c of used) {
    const row = `| ${c.id} | ${en(c.price, 0)} | ${c.area} | ${fx(c.kSource, 2)} | ${en(c.annexDeduct, 0)} | ${en(c.unitBase, 2)} | ${fx(c.kTotal, 4)} | ${g3(c.grossAdj)} | ${fx(c.weight, 4)} | ${en(c.unitHomog, 2)} |`;
    assert.ok(ex.includes(row), row);
  }
  const st = r.stats;
  for (const x of [`| n | ${st.n} |`, `| Mean / median / weighted mean | ${en(st.mean, 2)} / ${en(st.median, 2)} / ${en(st.weighted, 2)} |`,
    `| s / CV | ${en(st.std, 2)} / ${(st.cv * 100).toFixed(2)}% |`, `| n_eff / s_w | ${fx(st.nEff, 4)} / ${en(st.stdWeighted, 2)} |`,
    `| Degrees of freedom / t (80%) | ${Math.floor(st.nEff - 1 + 1e-9)} / ${st.tCrit} |`, `| Interval of the unit value | ${en(st.ciLow, 2)} – ${en(st.ciHigh, 2)} |`,
    `| ${en(r.unitValue * r.refArea, 2)} |`, `**${en(r.total, 0)}**`, `| ${en(r.rangeLow, 0)} – ${en(r.rangeHigh, 0)} |`, `| ${en(r.listingPrice, 0)} |`])
    assert.ok(ex.includes(x), x);
  const rob = MCA.robustness(s, { n: 600, seed: 20261122 });
  assert.ok(ex.includes(`P10 ${en(rob.mc.p10, 0)}, P50 ${en(rob.mc.p50, 0)} and P90 ${en(rob.mc.p90, 0)}`), 'Monte Carlo in Part 1');
  const u = flat(section(read('2-uncertainty.md'), '## 2.5', '## 2.6'));
  rob.loo.forEach((l) => assert.ok(u.includes(`| ${l.id} | ${en(l.total, 0)} | ${signed(l.delta)} |`), `leave-one-out ${l.id}`));
  const mc = rob.mc;
  for (const x of [`| Mean | ${en(mc.mean, 0)} |`, `| Standard deviation | ${en(mc.std, 0)} (CV ${(mc.cv * 100).toFixed(2)}%) |`, `| P05 | ${en(mc.p05, 0)} |`,
    `| P10 | ${en(mc.p10, 0)} |`, `| P50 | ${en(mc.p50, 0)} |`, `| P90 | ${en(mc.p90, 0)} |`, `| P95 | ${en(mc.p95, 0)} |`])
    assert.ok(u.includes(x), x);
});

test('approach illustration matches the engine', () => {
  const ill = flat(section(read('3-other-approaches.md'), '## 3.6', '## 3.7'));
  const A = MCA.approaches;
  const inc = A.income({ rentMonthly: 1500, vacancy: 5, opex: 15, capRate: 4.5 })   // percentages as the editor stores them;
  const cost = A.cost({ landValue: 120000, unitCost: 1400, area: 110, fees: 10, profit: 12, depreciation: 25 });
  const res = A.residual({ sellArea: 900, unitPrice: 3200, buildCost: 1350000, fees: 10, finance: 6, profit: 18, saleCosts: 3 });
  const rec = A.reconcile({ market: 400000, income: inc.value, cost: cost.value }, { market: 70, income: 30, cost: 0 });
  for (const x of [`gross ${en(inc.gross, 0)}; effective ${en(inc.effective, 0)}; net ${en(inc.noi, 0)}`, `**${en(inc.value, 0)}**`,
    `cost new ${en(cost.costNew, 0)}; loaded ${en(cost.loaded, 0)}; depreciated ${en(cost.depreciated, 0)}`, `**${en(cost.value, 0)}**`,
    `GDV ${en(res.gdv, 0)}; fees ${en(res.fees, 0)}; finance ${en(res.finance, 0)}; profit ${en(res.profit, 0)}; sale costs ${en(res.sale, 0)}`,
    `**${en(res.value, 0)}**`, `**${en(rec.value, 0)}**`])
    assert.ok(ill.includes(x), x);
});

test('every cited key has a bibliography entry with a status', () => {
  const bib = read('5-bibliography.md');
  const entries = new Map([...bib.matchAll(/^- \*\*\[([A-Z][A-Z0-9]*-[A-Z0-9-]+)\]\*\* .*?(Verified (20\d\d-\d\d-\d\d)|To be verified)/gm)].map((m) => [m[1], m[2]]));
  assert.ok(entries.size >= 70);
  const missing = [];
  for (const f of DOC_FILES) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/\[([A-Z][A-Z0-9]*-[A-Z0-9-]+)\]/g)) if (!entries.has(m[1])) missing.push(`${path.relative(DOCS, f)}: ${m[1]}`);
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('the scientific paper reports the numbers of the engine, in English and in Italian', () => {
  const s = fresh();
  const r = MCA.compute(s);
  const rob = MCA.robustness(s, { n: 600, seed: 20261122 });
  const st = r.stats;
  const itNum = (x, d) => en(x, d).replace(/[.,]/g, (c) => (c === ',' ? '.' : ','));
  const pct = (x, d, it) => (it ? fx(x * 100, d).replace('.', ',') : fx(x * 100, d)) + '%';
  for (const [file, it] of [['valesta-method.en.md', false]]) {
    const N = it ? itNum : en;
    const F = (x, d) => (it ? fx(x, d).replace('.', ',') : fx(x, d));
    const paper = flat(read(path.join('paper', file)));
    const used = r.comps.filter((c) => c.include);
    for (const c of used) {
      const row = `| ${c.id} | ${N(c.price, 0)} | ${c.area} | ${F(c.kSource, 2)} | ${N(c.annexDeduct, 0)} | ${N(c.unitBase, 2)} | ${F(c.kTotal, 4)} | ${it ? g3(c.grossAdj).replace('.', ',') : g3(c.grossAdj)} | ${F(c.weight, 4)} | ${N(c.unitHomog, 2)} |`;
      assert.ok(paper.includes(row), `${file}: ${row}`);
    }
    for (const x of [`${N(st.mean, 2)} / ${N(st.median, 2)} / ${N(st.weighted, 2)}`, `${N(st.std, 2)} / ${pct(st.cv, 2, it)}`,
      `${F(st.nEff, 4)} / ${N(st.stdWeighted, 2)}`, `${N(st.ciLow, 2)} – ${N(st.ciHigh, 2)}`, `| ${N(r.total, 0)} |`,
      `${N(r.rangeLow, 0)} – ${N(r.rangeHigh, 0)}`, `| ${N(rob.mc.mean, 0)} |`, `| ${N(rob.mc.p10, 0)} |`, `| ${N(rob.mc.p50, 0)} |`,
      `| ${N(rob.mc.p90, 0)} |`, pct((rob.mc.p90 - rob.mc.p10) / 2 / r.total, 2, it)])
      assert.ok(paper.includes(x), `${file}: ${x}`);
    rob.loo.forEach((l) => assert.ok(paper.includes(`| ${l.id} | ${it ? signed(l.delta).replace('.', ',') : signed(l.delta)} |`), `${file}: leave-one-out ${l.id}`));
  }
});

test('the HTML of the paper is built from its Markdown (same title and figures, AGPL header)', () => {
  const s = fresh();
  const r = MCA.compute(s);
  const rob = MCA.robustness(s, { n: 600, seed: 20261122 });
  const itNum = (x, d) => en(x, d).replace(/[.,]/g, (c) => (c === ',' ? '.' : ','));
  for (const lang of ['en']) {
    const md = read(path.join('paper', `valesta-method.${lang}.md`));
    const html = read(path.join('paper', `valesta-method.${lang}.html`));
    assert.match(html, /Copyright \(C\) 2026 Domestone S\.r\.l\./);
    assert.match(html, /GNU Affero General Public License/);
    const title = /^# (.+)$/m.exec(md)[1];
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    assert.equal(h1 && h1[1].replace(/<[^>]+>/g, '').replace(/&#39;|’/g, "'"), title, `${lang}: title`);
    const text = html.replace(/<[^>]+>/g, '');
    const N = lang === 'it' ? itNum : en;
    for (const x of [N(r.total, 0), N(r.stats.ciLow, 2), N(r.stats.ciHigh, 2), N(rob.mc.p10, 0), N(rob.mc.p90, 0)]) assert.ok(text.includes(x), `${lang}: ${x}`);
    // equations: "(n)" lines of the first edition, or LaTeX blocks ending in "\qquad (n)" (tools/paper/build.js)
    const equations = (md.match(/^\(\d+\)/gm) || []).length + (md.match(/\\qquad \(\d+\)$/gm) || []).length;
    assert.equal((html.match(/class="eq"/g) || []).length, equations, `${lang}: equations`);
  }
});

test('the typeset paper: MathML equations, figures from the engine, the logo and its notice (tools/paper)', () => {
  for (const lang of ['en']) {
    const md = read(path.join('paper', `valesta-method.${lang}.md`));
    if (!/^```math$/m.test(md)) continue;   // a language not yet typeset with tools/paper
    const html = read(path.join('paper', `valesta-method.${lang}.html`));
    assert.equal((html.match(/<math display="block"/g) || []).length, (md.match(/\\qquad \(\d+\)$/gm) || []).length, `${lang}: MathML`);
    // GitHub turns \tag into a labelled MathML row that Chromium browsers cannot show, and refuses \operatorname
    assert.ok(!/\\tag\{|\\operatorname/.test(md), `${lang}: equations that GitHub can show`);
    const figs = [...md.matchAll(/!\[[^\]]+\]\((figures\/fig-\d+\.[a-z]+\.svg)\)/g)].map((m) => m[1]);
    assert.ok(figs.length >= 1, `${lang}: figures`);
    for (const f of figs) {
      const svg = read(path.join('paper', f));
      assert.ok(html.includes(svg.trim().replace(/ width="\d+" height="\d+"/, '')), `${lang}: ${f} is the figure of the HTML`);
    }
    assert.match(html, /<svg class="cover-logo"[^>]*aria-label="Valesta"/, `${lang}: logo on the cover`);
    assert.match(md, /TRADEMARK_POLICY\.md/, `${lang}: the notice on the name and the logo`);
    assert.ok(!/<script|\b(?:src|href)="https?:/.test(html.replace(/<a [^>]*>/g, '')), `${lang}: the HTML loads nothing`);
  }
});
