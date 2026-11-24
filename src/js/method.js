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
/* Method — the facts of the method applied in one valuation, taken from the engine's result and the settings: the
 * «Method» chapter of the report and the method panel of the app describe what was actually done, not a standard text.
 * Pure functions, no DOM and no texts (the texts are in report_i18n.js and ui_i18n.js). Depends on the global MCA. */
(function (root, factory) {
  const mod = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Method = mod;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const G = typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : root;
  const E = () => G.MCA || (typeof require === 'function' ? (G.MCA = require('./engine.js')) : null);
  const num = (v) => (v == null || v === '' || typeof v === 'boolean' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  // The methodology the chapter refers to: docs/methodology in the source code, in its version of this date.
  const DOC = { path: 'docs/methodology', date: '2026-11-24' };
  // Weight of a comparable: w = f × max(SIMILARITY_FLOOR, 1 − G), with G the gross adjustment (src/js/engine.js).
  const SIMILARITY_FLOOR = 0.2;
  const coef = (v) => { const x = num(v); return x != null && x > 0 && x <= 1.5 ? x : null; };   // as the engine reads it
  // Approaches the engine computes; the others listed for a property type (src/js/taxonomy.js) are named as not computed.
  const COMPUTED = ['sales_comparison', 'income_capitalisation', 'cost', 'residual'];
  const TX = () => G.Taxonomy || (typeof require === 'function' ? (G.Taxonomy = require('./taxonomy.js')) : null);

  function facts(state, res, rob) {
    const M = E();
    const s = (state && state.settings) || {};
    const list = Array.isArray(state && state.comparables) ? state.comparables : [];
    const pairs = list.map((c, i) => ({ c: c || {}, r: res && Array.isArray(res.comps) ? res.comps[i] : null })).filter((x) => x.r);
    const used = pairs.filter((x) => x.r.include);
    const srcOf = (x) => (M.SOURCES[x.c.source] ? x.c.source : 'otro');
    const bySource = {};
    used.forEach((x) => { bySource[srcOf(x)] = (bySource[srcOf(x)] || 0) + 1; });
    const asking = used.filter((x) => M.SOURCES[srcOf(x)].negotiation == null);
    const priceKind = !used.length || asking.length === used.length ? 'asking' : asking.length ? 'mixed' : 'closed';
    const dates = used.map((x) => String(x.c.date || '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    const months = used.map((x) => num(x.r.months) || 0);
    const uniform = s.scalePreset === 'uniform10';
    const flist = Array.isArray(state && state.factors) && state.factors.length ? state.factors : M.FACTORS;   // as the engine reads them
    const factors = flist.map((f) => ({
      id: f && f.id, delta: uniform ? 0.1 : num(f && f.delta) || 0, origin: uniform ? 'default' : M.factorOrigin(f), source: String((f && f.source) || '') }));
    const overrides = used.reduce((n, x) => n + (x.r.factors || []).filter((k) => k.overridden).length, 0);
    const ap = (res && res.approaches) || {};
    const rec = ap.reconciled || {};
    const st = (res && res.stats) || {};
    const estimator = M.ESTIMATORS.includes(res && res.estimator) ? res.estimator : 'weighted';
    let loo = null;
    if (rob && Array.isArray(rob.loo) && rob.loo.length) {
      const w = rob.loo.reduce((a, l) => (!a || Math.abs(l.delta) > Math.abs(a.delta) ? l : a), null);
      loo = { maxAbs: Math.abs(w.delta), id: w.id };
    }
    const type = TX() && TX().typeByCode(((state && state.subject && state.subject.propertyType) || {}).code);
    const notComputed = ((type && type.approaches) || []).filter((a) => !COMPUTED.includes(a));
    return {
      approach: { active: !!ap.active, used: rec.used || ['market'], weights: rec.weights || { market: 1 }, reason: (state && state.approaches && state.approaches.reason) || '', notComputed },
      evidence: {
        used: used.length, total: pairs.length, excluded: pairs.length - used.length, bySource, priceKind,
        dateFrom: dates[0] || '', dateTo: dates[dates.length - 1] || '',
        time: { on: s.timeAdjust !== false && (num(s.timeTrendAnnual) || 0) !== 0, trend: num(s.timeTrendAnnual) || 0, monthsMax: months.length ? Math.max(...months) : 0 },
        // The default coefficient applies to the asking prices without a coefficient of their own; closing prices keep 1.
        negotiation: { value: M.negotiationDefault(s), onDefault: asking.filter((x) => coef(x.c.negotiation) == null).length,
          own: used.filter((x) => coef(x.c.negotiation) != null).length, reason: s.negotiationReason || '' },
        confirmed: s.marketConfirmed !== false,
      },
      adjustment: { factors, uniform, valuer: factors.filter((f) => f.origin === 'valuer').length, overrides, levels: M.LEVELS.map((l) => l.v) },
      weights: { floor: SIMILARITY_FLOOR, estimator },
      // The interval is reported only when the sales comparison gives the value (rangeBasis); n_eff only for the weighted
      // estimator, as in the engine.
      ci: st.ciLow != null && st.ciHigh != null && res.rangeBasis ? { level: st.ciLevel, low: st.ciLow, high: st.ciHigh, n: st.n,
        nEff: estimator === 'weighted' && st.stdWeighted != null && st.nEff > 1 ? st.nEff : st.n, t: st.tCrit,
        approx: estimator === 'median' || estimator === 'trimmed' } : null,
      mc: rob && rob.mc ? { n: rob.mc.n, p10: rob.mc.p10, p50: rob.mc.p50, p90: rob.mc.p90 } : null,
      loo,
      doc: DOC,
    };
  }

  // How each number of the result screen is computed, with the section of docs/methodology that documents it. The
  // formulas are the engine's (src/js/engine.js); the texts that go with them are in ui_i18n.js (mx).
  const UNIT = { weighted: 'p* = Σ w·p_h / Σ w', mean: 'p* = Σ p_h / n', median: 'p* = median(p_h)', trimmed: 'p* = trimmed mean(p_h)' };
  function explain(settings) {
    const est = UNIT[settings && settings.estimator] ? settings.estimator : 'weighted';
    return [
      { id: 'adjusted', formula: 'P′ = P × K_neg × K_t − A', doc: '1-sales-comparison.md §1.4' },
      { id: 'weight', formula: `w = f × max(${SIMILARITY_FLOOR}, 1 − Σ|k − 1|)`, doc: '1-sales-comparison.md §1.9' },
      { id: 'unit', formula: UNIT[est], doc: '1-sales-comparison.md §1.10' },
      { id: 'range', formula: est === 'weighted' ? 'p* ± t · s_w / √n_eff' : 'p* ± t · s / √n', doc: '1-sales-comparison.md §1.11' },
      { id: 'p10p90', formula: 'P10 = Q(0.10; V₁…V_N), P90 = Q(0.90; V₁…V_N)', doc: '2-uncertainty.md §2.3' },
    ];
  }

  // Sources view of a country (src/js/references.js): standards, EU rules in member states, the country's references
  // and the literature on the method, each with its verification status.
  const RF = () => G.References || (typeof require === 'function' ? (G.References = require('./references.js')) : null);
  function sources(cc) {
    const R = RF();
    if (!R) return { standards: [], eu: [], country: [], method: [] };
    return { standards: R.international(), eu: R.euRules(cc), country: R.byCountry(cc), method: R.method() };
  }

  return { facts, explain, sources, DOC, SIMILARITY_FLOOR };
});
