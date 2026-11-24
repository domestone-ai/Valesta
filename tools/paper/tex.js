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
// Typesets the LaTeX subset of the paper's equations as MathML Core. GitHub renders the same source (```math blocks)
// with MathJax; browsers render the MathML natively, and the printed PDF keeps it as text. An unknown command is an
// error, so that nothing is dropped silently.
'use strict';

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ',
  omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};
const SYMBOL = {
  cdot: '·', times: '×', pm: '±', mp: '∓', approx: '≈', le: '≤', leq: '≤', ge: '≥', geq: '≥', in: '∈', notin: '∉', ne: '≠',
  neq: '≠', to: '→', rightarrow: '→', lfloor: '⌊', rfloor: '⌋', ldots: '…', cdots: '⋯', mid: '|', lvert: '|', rvert: '|',
  '{': '{', '}': '}', '|': '‖',
};
const BIG = { sum: '∑', prod: '∏' };
const FUNCTIONS = new Set(['ln', 'log', 'exp', 'max', 'min']);
const SPACE = { ',': '0.1667em', ':': '0.2222em', '>': '0.2222em', ';': '0.2778em', ' ': '0.25em', quad: '1em', qquad: '2em' };
const IGNORE = new Set(['big', 'Big', 'bigg', 'Bigg', 'displaystyle', 'limits']);
const OP = { '-': '−', '*': '∗', '<': '&lt;', '>': '&gt;', '&': '&amp;' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Plain brackets keep their size, as in TeX (only \left and \right stretch); bars of an absolute value take no space.
const BAR = '<mo stretchy="false" lspace="0" rspace="0">|</mo>';
const opMl = (v) => (v === '|' ? BAR : '()[]'.includes(v) ? `<mo stretchy="false">${v}</mo>` : `<mo>${OP[v] || esc(v)}</mo>`);

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      const m = /^\\([A-Za-z]+)/.exec(src.slice(i));
      if (m) { out.push({ t: 'cmd', v: m[1] }); i += m[0].length; } else { out.push({ t: 'cmd', v: src[i + 1] }); i += 2; }
      continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c)) {
      const m = /^[0-9]+(?:(?:\.|\{,\})[0-9]+)?/.exec(src.slice(i));   // 0{,}2 is a decimal comma
      out.push({ t: 'num', v: m[0].replace('{,}', ',') });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z]/.test(c)) { out.push({ t: 'id', v: c }); i++; continue; }
    if ('{}^_\''.includes(c)) { out.push({ t: c }); i++; continue; }
    out.push({ t: 'op', v: c });
    i++;
  }
  return out;
}

// tex('x = \frac{a}{b} \qquad (3)') → { tag: '3', alt: 'x = \frac{a}{b}', mathml: '<math display="block" …>…</math>' }
// The number of an equation is written after it, "\qquad (n)", as GitHub shows it: GitHub turns \tag{n} into a
// labelled MathML row that Chromium browsers cannot lay out. \tag{n} is still read.
function tex(src) {
  let tag = null;
  const body = String(src).replace(/\\tag\{([^}]*)\}/, (m, t) => { tag = t.trim(); return ''; })
    .replace(/\\qquad\s*\((\d+)\)\s*$/, (m, t) => { tag = t; return ''; }).trim();
  const toks = tokenize(body);
  let i = 0;
  const peek = () => toks[i];
  const fail = (msg) => { throw new Error(`tex: ${msg} in "${src}"`); };
  const row = (items) => (items.length === 1 ? items[0] : `<mrow>${items.join('')}</mrow>`);
  const isOp = (k, v) => k && k.t === 'op' && k.v === v;

  function group() {
    if (!peek() || peek().t !== '{') fail('missing {');
    i++;
    const items = list('}');
    if (!peek() || peek().t !== '}') fail('unbalanced {');
    i++;
    return items;
  }
  // The text of a group, for \mathrm and \operatorname (spaces are not kept).
  function rawGroup() {
    if (!peek() || peek().t !== '{') fail('missing {');
    i++;
    let s = '';
    while (peek() && peek().t !== '}') { const k = toks[i++]; s += k.v != null ? k.v : k.t; }
    if (!peek()) fail('unbalanced {');
    i++;
    return s;
  }
  function delim() {
    const k = toks[i++];
    if (!k) fail('missing delimiter');
    if (k.t === 'op') return k.v === '.' ? '' : `<mo>${OP[k.v] || esc(k.v)}</mo>`;
    if (k.t === 'cmd' && SYMBOL[k.v]) return `<mo>${SYMBOL[k.v]}</mo>`;
    return fail('bad delimiter');
  }
  function command(v) {
    if (v === 'lvert' || v === 'rvert') return { ml: BAR };
    if (GREEK[v]) return { ml: `<mi>${GREEK[v]}</mi>` };
    if (SYMBOL[v]) return { ml: `<mo>${SYMBOL[v]}</mo>` };
    if (BIG[v]) return { ml: `<mo movablelimits="true">${BIG[v]}</mo>`, big: true };
    if (FUNCTIONS.has(v)) return { ml: `<mi>${v}</mi>`, fn: true };
    if (v in SPACE) return { ml: `<mspace width="${SPACE[v]}"/>` };
    if (IGNORE.has(v)) return null;
    if (v === 'frac') { const a = group(); const b = group(); return { ml: `<mfrac><mrow>${a.join('')}</mrow><mrow>${b.join('')}</mrow></mfrac>` }; }
    if (v === 'sqrt') return { ml: `<msqrt>${group().join('')}</msqrt>` };
    if (v === 'mathrm' || v === 'operatorname') {
      const t = rawGroup();
      return { ml: `<mi${t.length === 1 ? ' mathvariant="normal"' : ''}>${esc(t)}</mi>`, fn: v === 'operatorname' };
    }
    if (v === 'left') {
      const open = delim();
      const items = list('right');
      if (!peek()) fail('missing \\right');
      i++;
      return { ml: `<mrow>${open}${items.join('')}${delim()}</mrow>` };
    }
    return fail(`unsupported command \\${v}`);
  }
  function atom() {
    const k = toks[i++];
    if (k.t === 'id') return { ml: `<mi>${k.v}</mi>` };
    if (k.t === 'num') return { ml: `<mn>${k.v}</mn>` };
    if (k.t === 'op') return { ml: opMl(k.v) };
    if (k.t === '{') { i--; return { ml: row(group()) }; }
    if (k.t === "'") return { ml: '<mo>′</mo>' };
    if (k.t === 'cmd') return command(k.v);
    return fail(`unexpected ${k.t}`);
  }
  function scriptArg() {
    const k = peek();
    if (!k) fail('missing script');
    if (k.t === '{') return row(group());
    i++;
    if (k.t === 'id') return `<mi>${k.v}</mi>`;
    if (k.t === 'num') return `<mn>${k.v}</mn>`;
    if (k.t === 'op') return opMl(k.v);
    if (k.t === 'cmd') { const a = command(k.v); return a ? a.ml : ''; }
    return fail('bad script');
  }
  function scripts(a) {
    if (!a) return [];
    let sub = null;
    let sup = null;
    let primes = 0;
    for (;;) {
      const k = peek();
      if (k && k.t === "'") { primes++; i++; } else if (k && k.t === '_' && sub == null) { i++; sub = scriptArg(); } else if (k && k.t === '^' && sup == null) { i++; sup = scriptArg(); } else break;
    }
    if (primes) sup = sup ? `<mrow><mo>${'′'.repeat(primes)}</mo>${sup}</mrow>` : `<mo>${'′'.repeat(primes)}</mo>`;
    let ml = a.ml;
    if (sub != null || sup != null) {
      const el = a.big ? (sub != null && sup != null ? 'munderover' : sub != null ? 'munder' : 'mover')
        : (sub != null && sup != null ? 'msubsup' : sub != null ? 'msub' : 'msup');
      ml = `<${el}>${ml}${sub != null ? sub : ''}${sup != null ? sup : ''}</${el}>`;
    }
    const out = [ml];
    const next = peek();
    if (a.fn && sub == null && sup == null && next && !isOp(next, '(') && !(next.t === 'cmd' && next.v === 'left')) out.push('<mspace width="0.1667em"/>');
    return out;
  }
  function list(stop) {
    const out = [];
    while (i < toks.length) {
      const k = peek();
      if (stop === '}' && k.t === '}') break;
      if (stop === 'right' && k.t === 'cmd' && k.v === 'right') break;
      if (k.t === '}') fail('unbalanced }');
      if (k.t === '^' || k.t === '_') fail('script without base');
      out.push(...scripts(atom()));
    }
    return out;
  }

  const items = list(null);
  const alt = body.replace(/\s+/g, ' ');
  return { tag, alt, mathml: `<math display="block" alttext="${esc(alt)}">${row(items)}</math>` };
}

module.exports = { tex };
