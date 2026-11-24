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
// The tools that typeset the scientific paper (tools/paper): equations, Markdown and figures.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tex } = require('../tools/paper/tex.js');

test('tex: identifiers, primes, subscripts and upright labels', () => {
  const r = tex("P'_i = P_i \\cdot K_{\\mathrm{neg},i} - A_i \\tag{1}");
  assert.equal(r.tag, '1');
  assert.match(r.mathml, /^<math display="block" alttext="[^"]*">/);
  assert.ok(r.mathml.includes('<msubsup><mi>P</mi><mi>i</mi><mo>′</mo></msubsup>'), r.mathml);
  assert.ok(r.mathml.includes('<msub><mi>K</mi><mrow><mi>neg</mi><mo>,</mo><mi>i</mi></mrow></msub>'), r.mathml);
  assert.ok(r.mathml.includes('<mo>·</mo>') && r.mathml.includes('<mo>−</mo>'), r.mathml);
  assert.ok(!/tag/.test(r.mathml.replace(/alttext="[^"]*"/, '')), 'the tag is not typeset inside the formula');
  assert.ok(!/\\tag/.test(r.alt), 'the alternative text has no tag');
});

test('tex: fractions, roots, big operators with limits and decimal commas', () => {
  assert.ok(tex('\\frac{a}{b}').mathml.includes('<mfrac><mrow><mi>a</mi></mrow><mrow><mi>b</mi></mrow></mfrac>'));
  assert.ok(tex('\\sqrt{n}').mathml.includes('<msqrt><mi>n</mi></msqrt>'));
  assert.ok(tex('\\sum_j x_j').mathml.includes('<munder><mo movablelimits="true">∑</mo><mi>j</mi></munder>'));
  assert.ok(tex('K = \\prod_j k').mathml.includes('<munder><mo movablelimits="true">∏</mo><mi>j</mi></munder>'));
  assert.ok(tex('\\max(0{,}2;\\ 1 - G)').mathml.includes('<mn>0,2</mn>'));
  // plain brackets keep their size, as in TeX; \left and \right stretch
  assert.ok(tex('(1 + g)^{m / 12}').mathml.includes('<msup><mo stretchy="false">)</mo><mrow><mi>m</mi><mo>/</mo><mn>12</mn></mrow></msup>'));
  assert.ok(tex('\\sum_j \\ln(1 + x)').mathml.includes('<mo stretchy="false">(</mo>'));
  assert.ok(tex('\\lvert x \\rvert').mathml.includes('<mo stretchy="false" lspace="0" rspace="0">|</mo><mi>x</mi><mo stretchy="false" lspace="0" rspace="0">|</mo>'));
  assert.ok(tex('\\left(x\\right)^2').mathml.includes('<msup><mrow><mo>(</mo><mi>x</mi><mo>)</mo></mrow><mn>2</mn></msup>'));
  assert.ok(tex('p^{*}').mathml.includes('<msup><mi>p</mi><mo>∗</mo></msup>'));
  assert.ok(tex('t_{1-\\alpha/2,\\,\\nu}').mathml.includes('<mi>α</mi>') && tex('\\nu').mathml.includes('<mi>ν</mi>'));
  assert.ok(tex('\\operatorname{round}\\left(x;\\ r\\right)').mathml.includes('<mi>round</mi>'));
  assert.ok(tex('\\mathrm{P90} - \\mathrm{P10}').mathml.includes('<mi>P90</mi><mo>−</mo><mi>P10</mi>'));
});

test('tex: the number of an equation written after it, as GitHub can show it', () => {
  const r = tex('V = \\mathrm{round}\\left(x;\\ r\\right) \\qquad (12)');
  assert.equal(r.tag, '12');
  assert.ok(!/\(12\)|<mn>12<\/mn>/.test(r.mathml), 'the number is not typeset inside the formula');
  assert.ok(r.mathml.includes('<mi>round</mi>') && !/qquad|2em/.test(r.mathml), r.mathml);
  assert.ok(!/\(12\)/.test(r.alt), 'the alternative text has no number');
});

test('tex: an unknown command is an error, not a silent omission', () => {
  assert.throws(() => tex('\\foo{x}'), /unsupported/);
  assert.throws(() => tex('\\frac{a}'), /unbalanced|missing/);
});

const { parse, inline, slug } = require('../tools/paper/markdown.js');

test('markdown: GitHub heading anchors', () => {
  assert.equal(slug("4. Analisi dell'incertezza dovuta al giudizio"), '4-analisi-dellincertezza-dovuta-al-giudizio');
  assert.equal(slug('3.2 Depurazione dei prezzi'), '32-depurazione-dei-prezzi');
  assert.equal(slug('Riproducibilità'), 'riproducibilità');
});

test('markdown: blocks of the paper (math, tables with alignment, notes, figures, lists, raw HTML)', () => {
  const md = ['<p align="center">', '  <img src="x.svg" alt="Valesta">', '</p>', '', '# Title', '', '## 1. One', '', 'Para one',
    'continues.', '', '```math', 'a = b \\tag{1}', '```', '', '| Id | P |', '|---|---:|', '| T1 | 579.000 |', '',
    '> **Note.** Quoted', '> text.', '', '![Alt text](figures/fig-1.it.svg)', '', '**Figura 1.** Caption.', '',
    '- **Item.** First', '  continued', '  - sub item', '- Second'].join('\n');
  const b = parse(md);
  assert.deepEqual(b.map((x) => x.type), ['html', 'h1', 'h', 'p', 'math', 'table', 'quote', 'img', 'p', 'list']);
  assert.equal(b[3].text, 'Para one continues.');
  assert.equal(b[4].src, 'a = b \\tag{1}');
  assert.deepEqual(b[5].align, ['', 'right']);
  assert.deepEqual(b[5].rows, [['T1', '579.000']]);
  assert.equal(b[6].blocks[0].text, '**Note.** Quoted text.');
  assert.deepEqual([b[7].alt, b[7].src], ['Alt text', 'figures/fig-1.it.svg']);
  assert.deepEqual(b[9].items, [{ text: '**Item.** First continued', sub: ['sub item'] }, { text: 'Second', sub: [] }]);
  assert.equal(b[2].id, '1-one');
});

test('markdown: inline text with citations, code, links and Italian typography', () => {
  const h = inline("L'analisi [ROSEN-1974] in `src/js/engine.js`, su 113 m² al 24 novembre 2026 (vedi [LICENSE](../../../LICENSE)); *Survey*, **forte**, p\\*.", { lang: 'it' });
  assert.ok(h.includes('L’analisi'), h);
  assert.ok(h.includes('<a class="cite" href="#ref-ROSEN-1974">[ROSEN-1974]</a>'), h);
  assert.ok(h.includes('<code>src/js/engine.js</code>'), h);
  assert.ok(h.includes('113\u00a0m²') && h.includes('24\u00a0novembre\u00a02026'), h);
  assert.ok(h.includes('<a href="../../../LICENSE">LICENSE</a>'), h);
  assert.ok(h.includes('<em>Survey</em>') && h.includes('<strong>forte</strong>') && h.includes('p*'), h);
  assert.ok(inline('vedi [LICENSE](../../../LICENSE)', { lang: 'it', print: true }).includes('<span class="xref">LICENSE</span>'), 'no local links in the PDF');
  assert.ok(inline('[en](valesta-method.en.md)', { lang: 'it' }).includes('href="valesta-method.en.html"'), 'the other language links its HTML');
  assert.ok(inline('Δ<sub>i</sub> e V<sup>(r)</sup>', { lang: 'it' }).includes('Δ<sub>i</sub> e V<sup>(r)</sup>'));
  // no line break inside an absolute value, an ISO date or an ISBN
  assert.ok(inline('se max |Δ<sub>i</sub>| ≤ 3%', { lang: 'it' }).includes('<span class="nw">|Δ<sub>i</sub>|</span>'));
  assert.ok(inline('verificato il 2026-11-24.', { lang: 'it' }).includes('<span class="nw">2026-11-24</span>'));
  assert.ok(inline('ISBN 978-0-471-10949-5).', { lang: 'it' }).includes('<span class="nw">978-0-471-10949-5</span>'));
});

test('figures: labels are written once, with no outline halo (which a PDF keeps as a second copy of the text)', () => {
  for (const f of figures('it')) assert.ok(!/paint-order="stroke"/.test(f.svg), `figure ${f.n}`);
});

const { figures } = require('../tools/paper/figures.js');
const MCA = require('../src/js/engine.js');
const DEFAULT_STATE = require('../src/js/data.js');

test('figures: drawn from the engine on the demo valuation, in the language of the paper', () => {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  const r = MCA.compute(s);
  const rob = MCA.robustness(s, { n: 600, seed: 20261122 });
  const rnd = (x, d) => Math.sign(x) * Math.round(Math.abs(x) * 10 ** d + 1e-7) / 10 ** d;
  const en = (x, d) => rnd(x, d).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const it = (x, d) => en(x, d).replace(/[.,]/g, (c) => (c === ',' ? '.' : ','));
  for (const [lang, N] of [['it', it], ['en', en]]) {
    const f = figures(lang);
    assert.deepEqual(f.map((x) => x.n), [1, 2, 3, 4]);
    for (const x of f) {
      assert.match(x.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+"/);
      assert.ok(x.svg.includes('role="img"') && x.svg.includes('<title') && x.svg.includes('<desc'), `${lang} ${x.n}: accessible`);
      assert.ok(!/<script|https?:\/\/(?!www\.w3\.org)/.test(x.svg), `${lang} ${x.n}: no script, nothing loaded`);
      assert.ok(x.title && x.desc && x.file === `fig-${x.n}.${lang}.svg`);
    }
    const [, f2, f3, f4] = f.map((x) => x.svg);
    for (const v of [N(r.unitValue, 2), N(r.stats.ciLow, 2), N(r.stats.ciHigh, 2)]) assert.ok(f2.includes(v), `${lang} fig 2: ${v}`);
    for (const c of r.comps.filter((c) => c.include)) assert.ok(f2.includes(`>${c.id}<`) && f3.includes(`>${c.id}`), `${lang}: ${c.id}`);
    for (const v of [r.total, r.rangeLow, r.rangeHigh, rob.mc.p10, rob.mc.p50, rob.mc.p90]) assert.ok(f4.includes(N(v, 0)), `${lang} fig 4: ${N(v, 0)}`);
    // the prediction interval of equation (11), converted like the confidence interval
    const h = r.stats.tCrit * r.stats.stdWeighted * Math.sqrt(1 + 1 / r.stats.nEff);
    const V = (p) => Math.round((p * r.refArea + r.annexValue - (r.deductions || 0)) / 1000) * 1000;
    assert.ok(f4.includes(N(V(r.unitValue - h), 0)) && f4.includes(N(V(r.unitValue + h), 0)), `${lang} fig 4: prediction interval`);
  }
});
