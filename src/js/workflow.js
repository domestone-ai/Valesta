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
/* Workflow — the four phases of a valuation and their steps, the status of each step, the completeness of the
 * valuation and the commands of the command bar. Pure logic, no DOM: the editor renders it. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Workflow = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const L = (en, es, it) => ({ en, es, it });
  // A label with values: templates with {0}, {1}. The English template is the key of the translations in other languages.
  const fill = (s, a) => String(s).replace(/\{(\d+)\}/g, (m, i) => (a[+i] == null ? '' : a[+i]));
  const Lf = (en, es, it, ...a) => ({ en: fill(en, a), es: fill(es, a), it: fill(it, a), _tpl: en, _args: a });
  const G = typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : {};
  const CK = () => G.Checks || (typeof require === 'function' ? (G.Checks = require('./checks.js')) : null);
  // Italian, English and Spanish are in the label; the other languages come from the interface packs (UI_I18N.text).
  const pick = (o, lang) => (!o ? '' : ['en', 'es', 'it'].includes(lang) ? o[lang] || o.en || '' : G.UI_I18N && G.UI_I18N.text ? G.UI_I18N.text(o, lang) : o.en || '');

  const PHASES = [
    { id: 'property', icon: 'home', label: L('Property', 'Inmueble', 'Immobile'), steps: ['identity', 'features', 'areas', 'photos'] },
    { id: 'market', icon: 'map', label: L('Market', 'Mercado', 'Mercato'), steps: ['comps', 'marketdata', 'sources'] },
    { id: 'analysis', icon: 'chart', label: L('Analysis', 'Análisis', 'Analisi'), steps: ['adjust', 'methods', 'result', 'checks'] },
    { id: 'report', icon: 'file', label: L('Report', 'Informe', 'Report'), steps: ['content', 'style', 'deliver'] },
  ];
  // anchor: report section shown in the preview while the step is open; optional: not counted in the completeness.
  const STEPS = {
    identity: { label: L('Identification', 'Identificación', 'Identificazione'), anchor: 'cover' },
    features: { label: L('Features', 'Características', 'Caratteristiche'), anchor: 'description' },
    areas: { label: L('Areas', 'Superficies', 'Superfici'), anchor: 'description' },
    photos: { label: L('Photos', 'Fotos', 'Foto'), anchor: 'photos', optional: true },
    comps: { label: L('Comparables', 'Testigos', 'Comparabili'), anchor: 'sample' },
    marketdata: { label: L('Market data', 'Datos de mercado', 'Dati di mercato'), anchor: 'market' },
    sources: { label: L('Sources', 'Fuentes', 'Fonti'), anchor: 'hypotheses', optional: true },
    adjust: { label: L('Adjustments', 'Homogeneización', 'Omogeneizzazione'), anchor: 'homog' },
    methods: { label: L('Other approaches', 'Otros métodos', 'Altri metodi'), anchor: 'result', optional: true },
    result: { label: L('Result', 'Resultado', 'Risultato'), anchor: 'result' },
    checks: { label: L('Checks', 'Verificaciones', 'Verifiche'), anchor: 'hypotheses', optional: true },
    content: { label: L('Content', 'Contenidos', 'Contenuti'), anchor: 'letter' },
    style: { label: L('Style and brand', 'Estilo y marca', 'Stile e marchio'), anchor: 'cover' },
    deliver: { label: L('Delivery', 'Entrega', 'Consegna'), anchor: 'cover', optional: true },
  };
  // Tabs of version 1 (still used by the review checks, the assistant and saved links) → steps.
  const TAB_STEP = { pratica: 'identity', immobile: 'features', superfici: 'areas', foto: 'photos', comparabili: 'comps', mercato: 'marketdata',
    omog: 'adjust', risultato: 'result', testi: 'content', design: 'style', agenzia: 'style' };
  const AREA_STEP = { data: 'features', sample: 'comps', method: 'result', report: 'identity' };

  const phaseOf = (step) => PHASES.find((p) => p.steps.includes(step)) || null;
  const position = (step) => { const p = phaseOf(step); return p ? { phase: p.id, n: p.steps.indexOf(step) + 1, of: p.steps.length } : null; };
  const stepLabel = (step, lang) => pick(STEPS[step] && STEPS[step].label, lang);
  const phaseLabel = (id, lang) => pick((PHASES.find((p) => p.id === id) || {}).label, lang);
  // Step where a value of the valuation is edited (used to go from an AI change or a check to its field).
  function stepForPath(path) {
    const p = String(path || '');
    if (/^comparables/.test(p)) return 'comps';
    if (/^factors/.test(p)) return 'adjust';
    if (/^market\.references/.test(p)) return 'sources';
    if (/^market(\.|$)/.test(p)) return 'marketdata';
    if (/^(texts|customSections)(\.|$)/.test(p) || /^design\.sections/.test(p)) return 'content';
    if (/^(design|brand)(\.|$)/.test(p) || /^meta\.office/.test(p)) return 'style';
    if (/^settings(\.|$)/.test(p)) return 'result';
    if (/^photos/.test(p)) return 'photos';
    if (/^checks/.test(p)) return 'checks';
    if (/^approaches(\.|$)/.test(p)) return 'methods';
    if (/^subject\.propertyType/.test(p)) return 'identity';
    if (/^subject\.(areaBuilt|areaBuiltCommon|rooms|cadastral)/.test(p)) return 'areas';
    if (/^subject(\.|$)/.test(p)) return 'features';
    return 'identity';
  }
  const stepForTab = (tab) => (STEPS[tab] ? tab : TAB_STEP[tab] || null);

  // ---------- status ----------
  const txt = (v) => (v == null ? '' : typeof v === 'object' ? Object.values(v).map((x) => String(x == null ? '' : x)).join('') : String(v));
  const has = (v) => txt(v).trim().length > 0;
  const fin = (v) => typeof v === 'number' && isFinite(v);
  // For each step: complete (all essentials present) and touched (some data present).
  function filled(state, res) {
    const s = state.subject || {};
    const m = state.meta || {};
    const mk = state.market || {};
    const comps = (res && res.comps) || [];
    const used = comps.filter((c) => c && c.include).length;
    const typed = !!(s.propertyType && s.propertyType.code);
    const C = (complete, touched) => ({ complete: !!complete, touched: !!(complete || touched) });
    const ck = CK() ? CK().progress(state) : { done: 0, total: 0 };
    return {
      identity: C(typed && has(m.country) && has(m.valuationDate) && has(m.client && m.client.name), typed || has(m.client && m.client.name) || has(m.reportNo)),
      features: C(has(s.address) && has(s.municipality), has(s.address) || has(s.municipality) || fin(s.yearBuilt) || fin(s.bedrooms)),
      areas: C(res && res.refArea > 0, fin(s.areaBuilt) || (s.rooms || []).length > 0),
      photos: C((state.photos || []).length > 0),
      comps: C(used >= 3, comps.length > 0),
      marketdata: C(has(mk.source) || fin(mk.cityAvg) || (mk.series || []).length > 0),
      sources: C((mk.references || []).length > 0),
      adjust: C(used > 0 && res && fin(res.unitValue)),
      methods: C(res && res.approaches && res.approaches.active, ['income', 'cost', 'residual'].some((k) => state.approaches && state.approaches[k] && state.approaches[k].on)),
      result: C(res && fin(res.total) && res.total > 0),
      checks: C(ck.total > 0 && ck.done === ck.total, ck.done > 0),
      content: C(has(m.reportLang)),
      style: C(has(state.brand && state.brand.name)),
      deliver: C(has(m.deliveredAt)),
    };
  }
  function stepStatus(state, res, review) {
    const f = filled(state, res);
    const issues = ((review && review.checks) || []).filter((c) => c.level === 'error' || c.level === 'warn')
      .map((c) => ({ id: c.id, level: c.level, title: c.title, detail: c.detail, path: c.fix && c.fix.path, step: stepForTab(c.fix && c.fix.tab) || AREA_STEP[c.area] || 'result' }));
    const comps = (res && res.comps) || [];
    const byStep = {};
    let got = 0;
    let need = 0;
    PHASES.forEach((p) => p.steps.forEach((id) => {
      const mine = issues.filter((i) => i.step === id);
      const v = f[id];
      // complete → ok (orange if the review found problems); started but incomplete → orange; untouched → to do.
      const st = v.complete ? (mine.length ? 'warn' : 'ok') : v.touched ? 'warn' : STEPS[id].optional ? 'opt' : 'todo';
      const badge = id === 'comps' && comps.length ? `${comps.filter((c) => c && c.include).length}/${comps.length}` : mine.length ? String(mine.length) : '';
      byStep[id] = { status: st, issues: mine.length, badge };
      if (!STEPS[id].optional) { need += 1; got += v.complete ? (mine.some((i) => i.level === 'error') ? 0.5 : 1) : v.touched ? 0.5 : 0; }
    }));
    const phases = {};
    PHASES.forEach((p) => { phases[p.id] = { done: p.steps.filter((id) => byStep[id].status === 'ok').length, of: p.steps.length }; });
    return { byStep, phases, issues, completeness: need ? Math.round((got / need) * 100) : 0 };
  }

  // ---------- command bar ----------
  const fold = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ACTIONS = [
    ['act:save', 'action', L('Save the project file', 'Guardar el archivo del proyecto', 'Salva il file della pratica')],
    ['act:open', 'action', L('Open a project file', 'Abrir un archivo de proyecto', 'Apri un file di pratica')],
    ['act:undo', 'action', L('Undo', 'Deshacer', 'Annulla')],
    ['act:redo', 'action', L('Redo', 'Rehacer', 'Ripeti')],
    ['act:preview', 'action', L('Full-screen preview', 'Vista previa a pantalla completa', 'Anteprima a schermo intero')],
    ['act:lang-en', 'action', L('Language: English', 'Idioma: English', 'Lingua: English')],
    ['act:lang-es', 'action', L('Language: Español', 'Idioma: Español', 'Lingua: Español')],
    ['act:lang-it', 'action', L('Language: Italiano', 'Idioma: Italiano', 'Lingua: Italiano')],
    ['act:export-pdf', 'export', L('Export PDF', 'Exportar PDF', 'Esporta PDF')],
    ['act:export-html', 'export', L('Export interactive HTML', 'Exportar HTML interactivo', 'Esporta HTML interattivo')],
    ['ai:review', 'ai', L('Review the report and flag the risks', 'Revisa el informe y señala los riesgos', 'Rivedi il report e segnala i rischi')],
    ['ai:describe', 'ai', L('Write the property description', 'Escribe la descripción del inmueble', 'Scrivi la descrizione dell’immobile')],
    ['ai:comps', 'ai', L('Find comparables near the property', 'Busca testigos cerca del inmueble', 'Cerca comparabili vicino all’immobile')],
    ['ai:missing', 'ai', L('What is still missing?', '¿Qué falta todavía?', 'Cosa manca ancora?')],
  ];
  function commands(query, lang) {
    const items = [
      { id: 'go:home', group: 'go', label: L('Valuations', 'Valoraciones', 'Pratiche') },
      { id: 'go:new', group: 'go', label: L('New valuation', 'Nueva valoración', 'Nuova valutazione') },
    ];
    PHASES.forEach((p) => p.steps.forEach((s) => items.push({ id: 'go:' + s, group: 'go', label: STEPS[s].label, hint: p.label })));
    ACTIONS.forEach(([id, group, label]) => items.push({ id, group, label, ai: group === 'ai' }));
    const out = items.map((it, i) => ({ id: it.id, group: it.group, label: pick(it.label, lang), hint: pick(it.hint, lang), ai: !!it.ai, text: it.ai ? pick(it.label, lang) : undefined, i }));
    const q = fold(query).trim();
    if (!q) return out.map(({ i, ...rest }) => rest);
    const toks = q.split(/\s+/);
    const scored = out.map((it) => {
      const lab = fold(it.label);
      const hay = lab + ' ' + fold(it.hint);
      if (!toks.every((t) => hay.includes(t))) return null;
      const score = lab.startsWith(q) ? 0 : lab.split(/[\s’'«»:,.]+/).some((w) => w.startsWith(toks[0])) ? 1 : 2;
      return Object.assign({ score }, it);
    }).filter(Boolean).sort((a, b) => a.score - b.score || a.i - b.i);
    const text = String(query).trim();
    const ask = { id: 'ai:ask', group: 'ai', ai: true, text, label: pick(Lf('Ask the AI: “{0}”', 'Preguntar a la IA: «{0}»', 'Chiedi all’AI: «{0}»', text), lang), hint: '' };
    const list = scored.map(({ score, i, ...rest }) => rest);
    return list.some((x) => !x.ai) ? list.concat(ask) : [ask].concat(list);
  }

  return { PHASES, STEPS, TAB_STEP, phaseOf, position, stepLabel, phaseLabel, stepForTab, stepForPath, stepStatus, commands };
});
