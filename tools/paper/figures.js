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
// The figures of the paper, as SVG. Every number is computed by the engine on the demo valuation (the example of
// section 6), with the seed of the report, so the figures cannot drift from the tables. Colours are those of the
// Valesta brand (brand/README.md); the mint is used for graphics only.
'use strict';
const path = require('path');
const MCA = require(path.join(__dirname, '..', '..', 'src', 'js', 'engine.js'));
const DEFAULT_STATE = require(path.join(__dirname, '..', '..', 'src', 'js', 'data.js'));

const C = { deep: '#0B4F47', teal: '#12796B', mint: '#12A37F', ink: '#1A2229', ink2: '#3F4B55', ink3: '#5A6670', line: '#D9E1E4',
  line2: '#EBF0F1', tint: '#F0F6F5', tint2: '#E2EFEC', white: '#FFFFFF' };
const FONT = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (x) => Math.round(x * 10) / 10;

// decimal rounding (0.70975 → 0.7098), as in the tables of the paper
const rnd = (x, d) => Math.sign(x) * Math.round(Math.abs(x) * 10 ** d + 1e-7) / 10 ** d;
function num(x, d, lang) {
  const s = rnd(x, d).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '−');
  return lang === 'it' ? s.replace(/[.,]/g, (c) => (c === ',' ? '.' : ',')) : s;
}
const pct = (x, d, lang) => num(x * 100, d, lang) + '%';
const signed = (x, d, lang) => (x > 0 ? '+' : '') + pct(x, d, lang);

const text = (x, y, s, a = '') => `<text x="${r1(x)}" y="${r1(y)}"${a}>${esc(s)}</text>`;
// A label on a light ground, legible over lines and bars. An outline halo would do the same on screen, but a PDF keeps
// it as a second copy of the text.
function tag(x, y, s, size, a = '', anchor = 'start', bold = false) {
  const w = String(s).length * size * (bold ? 0.62 : 0.58);
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return `<rect x="${r1(left - 3)}" y="${r1(y - size * 0.9)}" width="${r1(w + 6)}" height="${r1(size * 1.22)}" rx="3" fill="${C.white}" fill-opacity="0.92"/>`
    + text(x, y, s, `${anchor === 'start' ? '' : ` text-anchor="${anchor}"`} font-size="${size}"${bold ? ' font-weight="600"' : ''}${a}`);
}

function svg(n, w, h, title, desc, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" `
    + `aria-labelledby="fig-${n}-title fig-${n}-desc" font-family="${esc(FONT)}" font-size="14" fill="${C.ink}">`
    + `<title id="fig-${n}-title">${esc(title)}</title><desc id="fig-${n}-desc">${esc(desc)}</desc>`
    + `<rect width="${w}" height="${h}" fill="${C.white}"/>${body}</svg>`;
}

const L = {
  it: {
    steps: [
      ['Comparabili', ['prezzi, superfici, date,', 'fonti e giudizi'], '§ 3.1', ''],
      ['Depurazione', ['trattativa, tempo', 'e pertinenze'], '§ 3.2', 'eq. (1)–(2)'],
      ['Prezzi unitari', ['sulla base di superficie', 'scelta'], '§ 3.3', 'eq. (3)'],
      ['Omogeneizzazione', ['coefficienti su una scala', 'a cinque livelli'], '§ 3.4', 'eq. (4)–(5)'],
      ['Pesi', ['affidabilità della fonte', 'e somiglianza'], '§ 3.5', 'eq. (6)'],
      ['Stimatore', ['media ponderata o uno', 'degli altri tre stimatori'], '§ 3.6', 'eq. (7)'],
      [['Intervallo di', 'confidenza'], ['della stima'], '§ 3.7', 'eq. (8)–(10)'],
      ['Valore di mercato', ['pertinenze, detrazioni', 'e arrotondamento'], '§ 3.8', 'eq. (12)'],
    ],
    side: [
      ['Incertezza dovuta al giudizio', ['esclusione di un comparabile alla volta (§ 4.1)', 'e simulazione Monte Carlo (§ 4.2, eq. (13))']],
      ['Altri approcci e riconciliazione', ['reddito, costo di ricostruzione deprezzato,', 'metodo residuale; pesi del valutatore (§ 5)']],
    ],
    f1: ['Le fasi del metodo', 'Schema in otto passi: comparabili, depurazione dei prezzi, prezzi unitari, omogeneizzazione, pesi, stimatore, '
      + 'intervallo di confidenza della stima e valore di mercato; a valle, l’analisi dell’incertezza dovuta al giudizio e gli altri approcci con la riconciliazione.'],
    f2: ['Prezzi unitari prima e dopo l’omogeneizzazione', 'prezzo unitario p', 'prezzo unitario omogeneizzato pₕ (area proporzionale al peso w)',
      'media ponderata p* = ', 'intervallo di confidenza all’80%: ', 'euro al metro quadrato'],
    f3: ['Somiglianza e aggiustamento lordo', 'aggiustamento lordo G', 'somiglianza s', 's = max(0,2; 1 − G)', '',
      'segnalati: G > 0,35', 'minimo 0,2'],
    f4: ['Il valore e le misure dell’incertezza', ['Monte Carlo:', '600 valori simulati'], ['Esclusione di un', 'comparabile alla volta'],
      ['Intervallo di confidenza', 'della stima'], ['Monte Carlo, P10–P90'], ['Intervallo di previsione,', 'equazione (11)'], 'euro'],
    sep: ', ',
  },
  en: {
    steps: [
      ['Comparables', ['prices, areas, dates,', 'sources and ratings'], '§ 3.1', ''],
      ['Price cleansing', ['negotiation, time', 'and annexes'], '§ 3.2', 'eq. (1)–(2)'],
      ['Unit prices', ['on the chosen', 'area basis'], '§ 3.3', 'eq. (3)'],
      ['Homogenisation', ['coefficients on a', 'five-level scale'], '§ 3.4', 'eq. (4)–(5)'],
      ['Weights', ['source reliability', 'and similarity'], '§ 3.5', 'eq. (6)'],
      ['Estimator', ['weighted mean or one of', 'three other estimators'], '§ 3.6', 'eq. (7)'],
      [['Confidence', 'interval'], ['of the estimate'], '§ 3.7', 'eq. (8)–(10)'],
      ['Market value', ['annexes, deductions', 'and rounding'], '§ 3.8', 'eq. (12)'],
    ],
    side: [
      ['Uncertainty due to judgement', ['leave-one-out analysis (§ 4.1)', 'and Monte Carlo simulation (§ 4.2, eq. (13))']],
      ['Other approaches and reconciliation', ['income, depreciated replacement cost,', 'residual; the valuer’s weights (§ 5)']],
    ],
    f1: ['The steps of the method', 'Eight-step diagram: comparables, cleansing of prices, unit prices, homogenisation, weights, estimator, confidence '
      + 'interval of the estimate and market value; downstream, the analysis of the uncertainty due to judgement and the other approaches with the reconciliation.'],
    f2: ['Unit prices before and after homogenisation', 'unit price p', 'homogenised unit price pₕ (area proportional to the weight w)',
      'weighted mean p* = ', '80% confidence interval: ', 'euros per square metre'],
    f3: ['Similarity and gross adjustment', 'gross adjustment G', 'similarity s', 's = max(0.2, 1 − G)', '',
      'flagged: G > 0.35', 'floor 0.2'],
    f4: ['The value and the measures of uncertainty', ['Monte Carlo:', '600 simulated values'], ['Leave-one-out'],
      ['Confidence interval', 'of the estimate'], ['Monte Carlo, P10–P90'], ['Prediction interval,', 'equation (11)'], 'euros'],
    sep: ', ',
  },
};

function demo() {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  const r = MCA.compute(s);
  const rob = MCA.robustness(s, { n: 600, seed: 20261122 });
  const step = MCA.roundingStep(s.settings);
  const value = (p) => Math.round((p * r.refArea + r.annexValue - (r.deductions || 0)) / step) * step;
  const h = r.stats.tCrit * r.stats.stdWeighted * Math.sqrt(1 + 1 / r.stats.nEff);   // equation (11)
  return { r, rob, used: r.comps.filter((c) => c.include), pred: [value(r.unitValue - h), value(r.unitValue + h)] };
}

// Figure 1: the steps of the method.
function fig1(lang) {
  const T = L[lang];
  const W = 1000;
  const bw = 219;
  const gap = 34;
  const bh = 104;
  const xs = [0, 1, 2, 3].map((k) => 10 + k * (bw + gap));
  const rows = [20, 166];
  let b = `<defs><marker id="fig-1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">`
    + `<path d="M0,0 L10,5 L0,10 z" fill="${C.ink3}"/></marker></defs>`;
  T.steps.forEach(([title, desc, sec, eq], k) => {
    const x = xs[k % 4];
    const y = rows[Math.floor(k / 4)];
    b += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="8" fill="${C.tint}" stroke="${C.tint2}" stroke-width="1.5"/>`;
    b += `<circle cx="${x + 25}" cy="${y + 26}" r="12" fill="${C.deep}"/>` + text(x + 25, y + 31, String(k + 1), ` text-anchor="middle" font-size="13" font-weight="600" fill="${C.white}"`);
    b += text(x + 45, y + 31, sec, ` font-size="13" font-weight="600" fill="${C.teal}"`);
    if (eq) b += text(x + bw - 14, y + 31, eq, ` text-anchor="end" font-size="13" fill="${C.ink3}"`);
    const tl = Array.isArray(title) ? title : [title];
    let yy = y + 54;
    tl.forEach((t) => { b += text(x + 16, yy, t, ` font-size="17" font-weight="600"`); yy += 20; });
    yy += 1;
    desc.forEach((d) => { b += text(x + 16, yy, d, ` font-size="14" fill="${C.ink3}"`); yy += 19; });
    if (k % 4 < 3) b += `<path d="M${x + bw + 4},${y + bh / 2} H${x + bw + gap - 6}" stroke="${C.ink3}" stroke-width="1.6" marker-end="url(#fig-1-arrow)"/>`;
  });
  const c4 = xs[3] + bw / 2;
  const c1 = xs[0] + bw / 2;
  b += `<path d="M${c4},${rows[0] + bh + 2} V${rows[0] + bh + 20} H${c1} V${rows[1] - 4}" fill="none" stroke="${C.ink3}" stroke-width="1.6" marker-end="url(#fig-1-arrow)"/>`;
  const sy = 304;
  const sw = 484;
  const sx = [10, 504];
  b += `<path d="M${c4},${rows[1] + bh + 2} V${sy - 18} H${sx[0] + sw / 2} V${sy - 4}" fill="none" stroke="${C.teal}" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#fig-1-arrow)"/>`;
  b += `<path d="M${sx[1] + sw / 2},${sy - 18} V${sy - 4}" fill="none" stroke="${C.teal}" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#fig-1-arrow)"/>`;
  T.side.forEach(([title, desc], k) => {
    b += `<rect x="${sx[k]}" y="${sy}" width="${sw}" height="78" rx="8" fill="${C.white}" stroke="${C.teal}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    b += text(sx[k] + 18, sy + 26, title, ` font-size="16" font-weight="600" fill="${C.deep}"`);
    desc.forEach((d, j) => { b += text(sx[k] + 18, sy + 48 + j * 18, d, ` font-size="14" fill="${C.ink3}"`); });
  });
  return { title: T.f1[0], desc: T.f1[1], body: b, w: W, h: 392 };
}

// Figure 2: unit prices before and after homogenisation, with the weighted mean and the confidence interval.
function fig2(lang, D) {
  const T = L[lang].f2;
  const { r, used } = D;
  const st = r.stats;
  const lo = 3000;
  const hi = 5250;
  const X = (v) => 80 + ((v - lo) / (hi - lo)) * 800;
  const y0 = 112;
  const dy = 40;
  const yEnd = y0 + dy * (used.length - 1);
  const wmax = Math.max(...used.map((c) => c.weight));
  let b = '';
  // legend
  b += `<circle cx="16" cy="22" r="6" fill="${C.white}" stroke="${C.ink3}" stroke-width="2"/>` + text(30, 27, T[1], ` font-size="14" fill="${C.ink2}"`);
  b += `<circle cx="226" cy="22" r="8" fill="${C.teal}"/>` + text(242, 27, T[2], ` font-size="14" fill="${C.ink2}"`);
  b += `<path d="M6,52 H28" stroke="${C.deep}" stroke-width="1.8" stroke-dasharray="6 4"/>` + text(36, 57, T[3] + num(r.unitValue, 2, lang), ` font-size="14" fill="${C.ink2}"`);
  b += `<rect x="372" y="44" width="22" height="16" fill="${C.mint}" fill-opacity="0.16" stroke="${C.mint}" stroke-opacity="0.5"/>`
    + text(402, 57, T[4] + num(st.ciLow, 2, lang) + ' – ' + num(st.ciHigh, 2, lang), ` font-size="14" fill="${C.ink2}"`);
  // grid and axis
  for (let v = lo; v <= 5000; v += 500) {
    b += `<path d="M${r1(X(v))},${y0 - 18} V${yEnd + 22}" stroke="${C.line2}" stroke-width="1"/>`;
    b += text(X(v), yEnd + 46, num(v, 0, lang), ` text-anchor="middle" font-size="13" fill="${C.ink3}"`);
  }
  b += `<path d="M80,${yEnd + 24} H880" stroke="${C.line}" stroke-width="1.2"/>`;
  b += text(480, yEnd + 74, T[5], ` text-anchor="middle" font-size="13" fill="${C.ink3}"`);
  // interval and mean
  b += `<rect x="${r1(X(st.ciLow))}" y="${y0 - 22}" width="${r1(X(st.ciHigh) - X(st.ciLow))}" height="${yEnd - y0 + 44}" fill="${C.mint}" fill-opacity="0.14"/>`;
  b += `<path d="M${r1(X(r.unitValue))},${y0 - 26} V${yEnd + 24}" stroke="${C.deep}" stroke-width="1.8" stroke-dasharray="6 4"/>`;
  // weights column
  b += text(958, y0 - 30, 'w', ` text-anchor="end" font-size="14" font-style="italic" font-weight="600" fill="${C.ink3}"`);
  used.forEach((c, k) => {
    const y = y0 + k * dy;
    const rad = 12 * Math.sqrt(c.weight / wmax);
    b += text(40, y + 5, c.id, ` text-anchor="middle" font-size="15" font-weight="600"`);
    b += `<path d="M${r1(X(c.unitBase))},${y} H${r1(X(c.unitHomog))}" stroke="${C.ink3}" stroke-width="1.6"/>`;
    b += `<circle cx="${r1(X(c.unitBase))}" cy="${y}" r="6" fill="${C.white}" stroke="${C.ink3}" stroke-width="2"/>`;
    b += `<circle cx="${r1(X(c.unitHomog))}" cy="${y}" r="${r1(rad)}" fill="${C.teal}" fill-opacity="0.92"/>`;
    b += text(958, y + 5, num(c.weight, 4, lang), ` text-anchor="end" font-size="14" fill="${C.ink2}"`);
  });
  const desc = used.map((c) => `${c.id}: p ${num(c.unitBase, 2, lang)}, pₕ ${num(c.unitHomog, 2, lang)}, w ${num(c.weight, 4, lang)}`).join('; ')
    + `; ${T[3]}${num(r.unitValue, 2, lang)}; ${T[4]}${num(st.ciLow, 2, lang)} – ${num(st.ciHigh, 2, lang)}.`;
  return { title: T[0], desc, body: b, w: 1000, h: yEnd + 88 };
}

// Figure 3: similarity as a function of the gross adjustment, equation (6), with the comparables of the example.
function fig3(lang, D) {
  const T = L[lang].f3;
  const X = (g) => 90 + g * 870;
  const Y = (s) => 340 - s * 280;
  let b = '';
  b += `<rect x="${X(0.35)}" y="${Y(1.05)}" width="${r1(X(1) - X(0.35))}" height="${r1(Y(0) - Y(1.05))}" fill="${C.line2}" fill-opacity="0.7"/>`;
  b += text(X(1) - 10, Y(1.05) + 22, T[5], ` text-anchor="end" font-size="14" fill="${C.ink2}"`);
  for (let k = 0; k <= 5; k++) {
    const v = k / 5;
    b += `<path d="M${X(0)},${r1(Y(v))} H${X(1)}" stroke="${C.line}" stroke-width="${k ? 0.8 : 1.2}"/>`;
    b += text(X(0) - 10, Y(v) + 5, num(v, k ? 1 : 0, lang), ` text-anchor="end" font-size="13" fill="${C.ink3}"`);
    b += text(X(v), Y(0) + 24, num(v, k ? 1 : 0, lang), ` text-anchor="middle" font-size="13" fill="${C.ink3}"`);
  }
  b += `<path d="M${r1(X(0.35))},${r1(Y(1.05))} V${Y(0)}" stroke="${C.ink3}" stroke-width="1.2" stroke-dasharray="4 4"/>`;
  b += text((X(0) + X(1)) / 2, Y(0) + 54, T[1], ` text-anchor="middle" font-size="13" fill="${C.ink3}"`);
  b += text(26, (Y(0) + Y(1)) / 2, T[2], ` text-anchor="middle" font-size="13" fill="${C.ink3}" transform="rotate(-90 26 ${r1((Y(0) + Y(1)) / 2)})"`);
  b += `<polyline points="${X(0)},${Y(1)} ${r1(X(0.8))},${r1(Y(0.2))} ${X(1)},${r1(Y(0.2))}" fill="none" stroke="${C.deep}" stroke-width="2.6" stroke-linejoin="round"/>`;
  // no line crosses these labels: plain text, with no ground that would show on the grey band
  b += text(X(0.62) + 12, Y(0.38) - 10, T[3], ` font-size="15" font-weight="600" fill="${C.deep}"`);
  b += text(X(0.9), Y(0.2) - 10, T[6], ` text-anchor="middle" font-size="13" fill="${C.deep}"`);
  const pts = D.used.map((c) => ({ id: c.id, g: c.grossAdj, s: Math.max(0.2, 1 - c.grossAdj) })).sort((a, c) => a.g - c.g);
  pts.forEach((p, k) => {
    const flagged = p.g > 0.35;
    b += `<circle cx="${r1(X(p.g))}" cy="${r1(Y(p.s))}" r="7" fill="${flagged ? C.white : C.mint}" stroke="${flagged ? C.deep : C.white}" stroke-width="${flagged ? 2 : 1.5}"/>`;
    b += k % 2 ? text(X(p.g) - 10, Y(p.s) + 22, p.id, ` text-anchor="end" font-size="14" font-weight="600"`) : text(X(p.g) + 10, Y(p.s) - 12, p.id, ` font-size="14" font-weight="600"`);
  });
  const desc = `${T[3]}. ` + pts.map((p) => `${p.id}: G ${num(p.g, 3, lang).replace(/0$/, '')}, s ${num(p.s, 3, lang).replace(/0$/, '')}`).join('; ') + '.';
  return { title: T[0], desc, body: b, w: 1000, h: 412 };
}

// Figure 4: the value with the measures of section 4.3 on one axis.
function fig4(lang, D) {
  const T = L[lang].f4;
  const { r, rob, pred } = D;
  const mc = rob.mc;
  const lo = 430000;
  const hi = 610000;
  const X = (v) => 290 + ((v - lo) / (hi - lo)) * 680;
  const N = (v) => num(v, 0, lang);
  let b = '';
  const label = (y, lines) => lines.forEach((s, j) => { b += text(266, y + j * 18 - (lines.length - 1) * 9 + 5, s, ` text-anchor="end" font-size="14" fill="${C.ink2}"`); });
  for (let v = 440000; v <= 600000; v += 20000) {
    b += `<path d="M${r1(X(v))},26 V412" stroke="${C.line2}" stroke-width="1"/>`;
    b += text(X(v), 436, N(v), ` text-anchor="middle" font-size="13" fill="${C.ink3}"`);
  }
  b += `<path d="M${X(lo)},414 H${X(hi)}" stroke="${C.line}" stroke-width="1.2"/>`;
  b += text((X(lo) + X(hi)) / 2, 464, T[6], ` text-anchor="middle" font-size="13" fill="${C.ink3}"`);
  b += `<path d="M${r1(X(r.total))},24 V390" stroke="${C.ink}" stroke-width="1.6"/>`;   // the value, under the labels
  // A: histogram of the simulated values
  const base = 152;
  const cmax = Math.max(...mc.hist.map((x) => x.count));
  mc.hist.forEach((x) => {
    const hgt = (x.count / cmax) * 96;
    b += `<rect x="${r1(X(x.x0))}" y="${r1(base - hgt)}" width="${r1(X(x.x1) - X(x.x0))}" height="${r1(hgt)}" fill="${C.mint}" fill-opacity="0.55" stroke="${C.white}" stroke-width="1"/>`;
  });
  b += `<path d="M${r1(X(mc.x0 != null ? mc.x0 : mc.hist[0].x0))},${base} H${r1(X(mc.hist[mc.hist.length - 1].x1))}" stroke="${C.ink3}" stroke-width="1"/>`;
  b += `<path d="M${r1(X(mc.p10))},58 V${base}" stroke="${C.deep}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
  b += `<path d="M${r1(X(mc.p90))},58 V${base}" stroke="${C.deep}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
  b += `<path d="M${r1(X(mc.p50))},40 V${base}" stroke="${C.deep}" stroke-width="1.2"/>`;
  b += tag(X(mc.p10) - 6, 52, `P10 ${N(mc.p10)}`, 13, ` fill="${C.deep}"`, 'end');
  b += tag(X(mc.p90) + 6, 52, `P90 ${N(mc.p90)}`, 13, ` fill="${C.deep}"`);
  b += tag(X(mc.p50), 34, `P50 ${N(mc.p50)}`, 13, ` fill="${C.deep}"`, 'middle');
  label(106, T[1]);
  // B: leave-one-out values, grouped when their labels would touch
  const yB = 204;
  const loo = rob.loo.map((l) => ({ id: l.id, v: l.total })).sort((a, c) => a.v - c.v);
  const groups = [];
  loo.forEach((p) => { const g = groups[groups.length - 1]; if (g && X(p.v) - X(g[g.length - 1].v) < 14) g.push(p); else groups.push([p]); });
  groups.forEach((g, k) => {
    const same = {};
    g.forEach((p) => { const n = (same[p.v] = (same[p.v] || 0) + 1); b += `<circle cx="${r1(X(p.v))}" cy="${yB + (n - 1) * 9 - (g.filter((q) => q.v === p.v).length - 1) * 4.5}" r="5.5" fill="${C.teal}" stroke="${C.white}" stroke-width="1.2"/>`; });
    const cx = g.reduce((s, p) => s + X(p.v), 0) / g.length;
    const ids = g.map((p) => p.id).join(L[lang].sep);
    b += tag(cx, k % 2 ? yB + 30 : yB - 14, ids, 13, '', 'middle', true);
  });
  label(yB, T[2]);
  // C, D, E: the intervals
  // the end values beside the bar, or inside a light bar whose start is too close to the labels on the left
  const bar = (y, a, z, style, l, inside) => {
    b += `<rect x="${r1(X(a))}" y="${y - 8}" width="${r1(X(z) - X(a))}" height="16" rx="3" ${style}/>`;
    b += inside ? text(X(a) + 8, y + 5, N(a), ` font-size="13" fill="${C.deep}"`) + text(X(z) - 8, y + 5, N(z), ` text-anchor="end" font-size="13" fill="${C.deep}"`)
      : text(X(a) - 6, y + 5, N(a), ` text-anchor="end" font-size="13" fill="${C.ink2}"`) + text(X(z) + 6, y + 5, N(z), ` font-size="13" fill="${C.ink2}"`);
    label(y, l);
  };
  const half = (a, z) => pct((z - a) / 2 / r.total, 1, lang);
  bar(262, r.rangeLow, r.rangeHigh, `fill="${C.deep}"`, [T[3][0], `${T[3][1]}, ±${half(r.rangeLow, r.rangeHigh)}`]);
  bar(312, mc.p10, mc.p90, `fill="${C.mint}"`, [T[4][0], `h = ${pct((mc.p90 - mc.p10) / 2 / r.total, 2, lang)}`]);
  bar(362, pred[0], pred[1], `fill="${C.tint2}" stroke="${C.teal}" stroke-width="1.5"`, [T[5][0], `${T[5][1]}, ±${half(pred[0], pred[1])}`], X(pred[0]) - 70 < 290);
  b += tag(X(r.total), 406, `V = ${N(r.total)}`, 14, '', 'middle', true);
  const desc = `V = ${N(r.total)}; P10 ${N(mc.p10)}, P50 ${N(mc.p50)}, P90 ${N(mc.p90)}; `
    + rob.loo.map((l) => `${l.id} ${N(l.total)} (${signed(l.delta, 2, lang)})`).join(', ')
    + `; ${T[3].join(' ')} ${N(r.rangeLow)} – ${N(r.rangeHigh)}; ${T[5][0].replace(/,$/, '')} ${N(pred[0])} – ${N(pred[1])}.`;
  return { title: T[0], desc, body: b, w: 1000, h: 476 };
}

// figures('it') → [{ n, file, title, desc, svg }]
function figures(lang) {
  if (!L[lang]) throw new Error(`figures: no texts for ${lang}`);
  const D = demo();
  return [fig1(lang), fig2(lang, D), fig3(lang, D), fig4(lang, D)].map((f, k) => ({
    n: k + 1, file: `fig-${k + 1}.${lang}.svg`, title: f.title, desc: f.desc, svg: svg(k + 1, f.w, f.h, f.title, f.desc, f.body),
  }));
}

module.exports = { figures, num };
