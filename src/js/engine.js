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
/* MCA engine — sales comparison approach (market comparison approach) with homogenisation coefficients.
 * Pure: no DOM access. It runs in the browser (global MCA) and in Node (module.exports).
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.MCA = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACTORS = [
    { id: 'loc', delta: 0.075,
      label_it: 'Ubicazione e contesto', label_en: 'Location and surroundings', label_es: 'Localización y entorno',
      desc_it: 'Qualità della micro-ubicazione: servizi, trasporti, spiaggia o verde e prestigio del quartiere.',
      desc_en: 'Quality of the micro-location: services, transport, beach or green areas and prestige of the neighbourhood.',
      desc_es: 'Calidad de la micro-ubicación: servicios, transporte, playa o zonas verdes y prestigio del barrio.' },
    { id: 'size', delta: 0.03,
      label_it: 'Superficie', label_en: 'Size', label_es: 'Superficie',
      desc_it: 'Economia di scala: a maggiore superficie corrisponde un minore prezzo unitario.',
      desc_en: 'Economies of scale: the larger the area, the lower the unit price.',
      desc_es: 'Economía de escala: a mayor superficie, menor precio unitario.' },
    { id: 'floor', delta: 0.03,
      label_it: 'Piano e altezza', label_en: 'Floor level', label_es: 'Planta y altura',
      desc_it: 'I piani alti con ascensore sono apprezzati per luce, viste e privacy.',
      desc_en: 'Upper floors with a lift are valued for light, views and privacy.',
      desc_es: 'Las plantas altas con ascensor se valoran por luz, vistas y privacidad.' },
    { id: 'lift', delta: 0.05,
      label_it: 'Ascensore e accessibilità', label_en: 'Lift and accessibility', label_es: 'Ascensor y accesibilidad',
      desc_it: 'L’assenza di ascensore penalizza in modo crescente dal secondo piano in su.',
      desc_en: 'The absence of a lift is increasingly penalised from the second floor upwards.',
      desc_es: 'La ausencia de ascensor penaliza de forma creciente a partir de la segunda planta.' },
    { id: 'age', delta: 0.05,
      label_it: 'Età e tipologia dell’edificio', label_en: 'Building age and type', label_es: 'Antigüedad y tipología del edificio',
      desc_it: 'Anno di costruzione, sistema costruttivo e stato dell’edificio.',
      desc_en: 'Year of construction, building system and condition of the building.',
      desc_es: 'Año de construcción, sistema constructivo y estado de la finca.' },
    { id: 'cond', delta: 0.05,
      label_it: 'Stato di conservazione e finiture', label_en: 'Condition and finishes', label_es: 'Estado de conservación y calidades',
      desc_it: 'Stato interno, ristrutturazioni e livello delle finiture.',
      desc_en: 'Interior condition, refurbishments and quality of finishes.',
      desc_es: 'Estado interior, reformas y nivel de acabados.' },
    { id: 'dist', delta: 0.03,
      label_it: 'Distribuzione (camere e bagni)', label_en: 'Layout (bedrooms and bathrooms)', label_es: 'Distribución (dormitorios y baños)',
      desc_it: 'Funzionalità degli spazi: numero di camere e bagni.',
      desc_en: 'Functionality of the layout: number of bedrooms and bathrooms.',
      desc_es: 'Funcionalidad del programa: número de dormitorios y baños.' },
    { id: 'orient', delta: 0.02,
      label_it: 'Orientamento, luce e viste', label_en: 'Orientation, light and views', label_es: 'Orientación, luminosidad y vistas',
      desc_it: 'Orientamento prevalente, carattere esterno e viste.',
      desc_en: 'Main orientation, exterior aspect and views.',
      desc_es: 'Orientación dominante, carácter exterior y vistas.' },
    { id: 'terr', delta: 0.03,
      label_it: 'Terrazze e spazi esterni', label_en: 'Terraces and outdoor space', label_es: 'Terrazas y espacios exteriores',
      desc_it: 'Superficie e fruibilità di terrazze, gallerie e giardini privati.',
      desc_en: 'Size and use of terraces, galleries and private gardens.',
      desc_es: 'Superficie y uso de terrazas, galerías y jardines privativos.' },
    { id: 'clim', delta: 0.02,
      label_it: 'Climatizzazione e impianti', label_en: 'Climate control and services', label_es: 'Climatización e instalaciones',
      desc_it: 'Aria condizionata, riscaldamento e altri impianti.',
      desc_en: 'Air conditioning, heating and other installations.',
      desc_es: 'Aire acondicionado, calefacción y otras instalaciones.' },
    { id: 'common', delta: 0.02,
      label_it: 'Parti comuni (piscina, giardino)', label_en: 'Communal areas (pool, garden)', label_es: 'Zonas comunes (piscina, jardín)',
      desc_it: 'Dotazioni condominiali: piscina, giardino, aree sportive.',
      desc_en: 'Communal amenities: swimming pool, garden, sports areas.',
      desc_es: 'Dotaciones comunitarias: piscina, jardín, zonas deportivas.' },
    { id: 'energy', delta: 0.01,
      label_it: 'Efficienza energetica', label_en: 'Energy efficiency', label_es: 'Eficiencia energética',
      desc_it: 'Classe e consumo energetico (EVS 2025, fattori ESG).',
      desc_en: 'Energy rating and consumption (EVS 2025, ESG factors).',
      desc_es: 'Calificación y consumo energético (EVS 2025, factores ESG).' },
  ];

  const LEVELS = [
    { v: 2, es: 'Mucho mejor', it: 'Molto migliore', en: 'Much better', short: '++' },
    { v: 1, es: 'Mejor', it: 'Migliore', en: 'Better', short: '+' },
    { v: 0, es: 'Igual', it: 'Uguale', en: 'Similar', short: '=' },
    { v: -1, es: 'Peor', it: 'Peggiore', en: 'Worse', short: '−' },
    { v: -2, es: 'Mucho peor', it: 'Molto peggiore', en: 'Much worse', short: '−−' },
  ];

  const SOURCES = {
    registro: { es: 'Registro / Notaría (precio de cierre)', it: 'Registro / Notaio (prezzo di chiusura)', en: 'Land Registry / notary (closing price)', weight: 1.0, negotiation: 1.0 },
    cierre: { es: 'Operación cerrada por agencia', it: 'Compravendita chiusa (agenzia)', en: 'Agency closed sale', weight: 1.0, negotiation: 1.0 },
    mandato: { es: 'Agencia (precio en mandato)', it: 'Agenzia (prezzo in mandato)', en: 'Agency (mandate asking price)', weight: 0.95, negotiation: null },
    portal: { es: 'Portal inmobiliario (precio de oferta)', it: 'Portale (prezzo di annuncio)', en: 'Property portal (asking price)', weight: 0.85, negotiation: null },
    otro: { es: 'Otra fuente', it: 'Altra fonte', en: 'Other source', weight: 0.8, negotiation: null },
  };

  const CONDITIONS = {
    a_reformar: { score: 1, es: 'A reformar', it: 'Da ristrutturare', en: 'To refurbish' },
    para_actualizar: { score: 2, es: 'Para actualizar', it: 'Da aggiornare', en: 'Needs updating' },
    buen_estado: { score: 3, es: 'Buen estado', it: 'Buono stato', en: 'Good condition' },
    muy_bueno: { score: 4, es: 'Muy buen estado', it: 'Ottimo stato', en: 'Very good condition' },
    reformado: { score: 5, es: 'Reformado', it: 'Ristrutturato', en: 'Refurbished' },
    nuevo: { score: 6, es: 'Obra nueva', it: 'Nuova costruzione', en: 'New build' },
  };

  // Student t, two-sided, by confidence level and degrees of freedom (df 1..30; beyond → normal)
  const T_TABLE = {
    0.95: { inf: 1.96, v: [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
      2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042] },
    0.9: { inf: 1.645, v: [6.314, 2.92, 2.353, 2.132, 2.015, 1.943, 1.895, 1.86, 1.833, 1.812, 1.796, 1.782, 1.771, 1.761, 1.753,
      1.746, 1.74, 1.734, 1.729, 1.725, 1.721, 1.717, 1.714, 1.711, 1.708, 1.706, 1.703, 1.701, 1.699, 1.697] },
    0.8: { inf: 1.282, v: [3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397, 1.383, 1.372, 1.363, 1.356, 1.35, 1.345, 1.341,
      1.337, 1.333, 1.33, 1.328, 1.325, 1.323, 1.321, 1.319, 1.318, 1.316, 1.315, 1.314, 1.313, 1.311, 1.31] },
  };
  function tCrit(df, level) {
    const tab = T_TABLE[level] || T_TABLE[0.95];
    if (df < 1) return null;
    return df <= 30 ? tab.v[df - 1] : tab.inf;
  }
  const tCrit95 = (df) => tCrit(df, 0.95);

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : null);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const roundTo = (v, step) => (step > 0 ? Math.round(v / step) * step : v);

  // ---------- statistics helpers (Excel semantics) ----------
  function median(values) {
    const a = values.slice().sort((x, y) => x - y);
    const n = a.length;
    if (!n) return null;
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  }
  function quantileInc(values, p) {
    const a = values.slice().sort((x, y) => x - y);
    const n = a.length;
    if (!n) return null;
    const h = (n - 1) * p;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    return a[lo] + (a[hi] - a[lo]) * (h - lo);
  }
  function trimmedMean(values, pct) {
    const a = values.slice().sort((x, y) => x - y);
    const n = a.length;
    if (!n) return null;
    const k = Math.floor((n * (pct || 0)) / 2); // excluded per tail (Excel TRIMMEAN)
    const kept = a.slice(k, n - k);
    return kept.reduce((s, v) => s + v, 0) / kept.length;
  }
  function mean(values) {
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  }
  function stdSample(values) {
    const n = values.length;
    if (n < 2) return 0;
    const m = mean(values);
    return Math.sqrt(values.reduce((s, v) => s + (v - m) * (v - m), 0) / (n - 1));
  }

  function distanceKm(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some((v) => typeof v !== 'number' || !isFinite(v))) return null;
    if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90 || Math.abs(lon1) > 180 || Math.abs(lon2) > 180) return null;
    const R = 6371.0088;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function monthsBetween(fromIso, toIso) {
    const a = Date.parse(fromIso);
    const b = Date.parse(toIso);
    if (!isFinite(a) || !isFinite(b)) return 0;
    return (b - a) / (86400000 * 30.4375);
  }

  function usefulArea(subject) {
    if (Array.isArray(subject.rooms) && subject.rooms.length) {
      const s = subject.rooms.reduce((acc, r) => acc + (num(r.m2) || 0), 0);
      if (s > 0) return Math.round(s * 100) / 100;
    }
    const u = num(subject.areaUseful);
    return u != null && u > 0 ? u : null;
  }

  function subjectRefArea(subject, settings) {
    const basis = (settings && settings.areaBasis) || 'built';
    // Areas must be positive: zero or negative values mean "missing", never a negative value.
    const pos = (v) => (v != null && v > 0 ? v : null);
    if (basis === 'useful') return usefulArea(subject);
    if (basis === 'builtCommon') return pos(num(subject.areaBuiltCommon));
    return pos(num(subject.areaBuilt));
  }

  function compArea(comp, settings) {
    const basis = (settings && settings.areaBasis) || 'built';
    const ratio = num(settings && settings.builtToUseful) || 1.18;
    const built = num(comp.areaBuilt);
    const useful = num(comp.areaUseful);
    if (basis === 'useful') return useful || (built ? built / ratio : null);
    return built || (useful ? useful * ratio : null);
  }

  function factorList(state) {
    return Array.isArray(state.factors) && state.factors.length ? state.factors : FACTORS;
  }

  // A factor weight is between 0 and 25 % a level, so a coefficient stays between 0.5 and 1.5.
  function factorK(factor, level, settings) {
    const delta = settings && settings.scalePreset === 'uniform10' ? 0.1 : clamp(num(factor.delta) || 0, 0, 0.25);
    return 1 + level * delta;
  }

  // Default negotiation coefficient of a valuation: the setting when valid (0 < k ≤ 1.5), otherwise 1 (no discount).
  // The engine, the simulation and the report all use this one rule.
  function negotiationDefault(settings) {
    const x = num(settings && settings.negotiationDefault);
    return x != null && x > 0 && x <= 1.5 ? x : 1;
  }
  const ESTIMATORS = ['weighted', 'mean', 'median', 'trimmed'];
  // Rounding step of the value (1,000 when not set) and of the listing price (five steps, so it follows the currency).
  function roundingStep(settings) {
    const r = num(settings && settings.rounding);
    return r == null || r <= 0 ? 1000 : Math.max(1, r);
  }
  const listingStep = (settings) => 5 * roundingStep(settings);
  // Origin of a factor weight: Valesta's default (FACTORS) or set by the valuer.
  function factorOrigin(f) {
    const base = FACTORS.find((x) => x.id === (f && f.id));
    return base && num(f.delta) === base.delta ? 'default' : 'valuer';
  }

  // ---------- main computation ----------
  // ---------- other approaches (valuer's inputs; percentages as numbers, e.g. 5 = 5%) ----------
  const pct = (v) => { const x = num(v); return x == null ? null : x / 100; };
  const approaches = {
    // Direct capitalisation: (rent × 12 × (1 − vacancy)) × (1 − operating costs) / capitalisation rate
    income(o) {
      o = o || {};
      const rent = num(o.rentMonthly), cap = pct(o.capRate);
      if (rent == null || rent <= 0 || cap == null || cap <= 0) return null;
      const gross = rent * 12;
      const effective = gross * (1 - (pct(o.vacancy) || 0));
      const noi = effective * (1 - (pct(o.opex) || 0));
      return { gross, effective, noi, capRate: cap, value: noi / cap };
    },
    // Depreciated replacement cost: land + area × unit cost × (1 + fees) × (1 + profit) × (1 − depreciation)
    cost(o) {
      o = o || {};
      const unit = num(o.unitCost), area = num(o.area);
      if (unit == null || unit <= 0 || area == null || area <= 0) return null;
      const land = num(o.landValue) || 0;
      const costNew = unit * area;
      const loaded = costNew * (1 + (pct(o.fees) || 0)) * (1 + (pct(o.profit) || 0));
      const depreciated = loaded * (1 - Math.min(1, pct(o.depreciation) || 0));
      return { land, costNew, loaded, depreciated, value: land + depreciated };
    },
    // Residual value of land: GDV − build cost − fees − finance − developer's profit − sale costs
    residual(o) {
      o = o || {};
      const area = num(o.sellArea), price = num(o.unitPrice), build = num(o.buildCost);
      if (area == null || area <= 0 || price == null || price <= 0 || build == null || build < 0) return null;
      const gdv = area * price;
      const fees = build * (pct(o.fees) || 0);
      const finance = (build + fees) * (pct(o.finance) || 0);
      const profit = gdv * (pct(o.profit) || 0);
      const sale = gdv * (pct(o.saleCosts) || 0);
      return { gdv, build, fees, finance, profit, sale, value: gdv - build - fees - finance - profit - sale };
    },
    // Weighted mean of the values of the approaches in use (weights as numbers; normalised).
    reconcile(values, weights) {
      const used = Object.keys(values).filter((k) => values[k] != null && isFinite(values[k]) && (num((weights || {})[k]) || 0) > 0);
      const sum = used.reduce((t, k) => t + num(weights[k]), 0);
      if (!used.length || !sum) return null;
      const w = {};
      used.forEach((k) => { w[k] = num(weights[k]) / sum; });
      return { value: used.reduce((t, k) => t + values[k] * w[k], 0), weights: w, used };
    },
  };
  function approachesOf(state, marketGross, refArea) {
    const a = (state && state.approaches) || {};
    const on = (k) => a[k] && a[k].on;
    const out = {
      income: on('income') ? approaches.income(a.income) : null,
      cost: on('cost') ? approaches.cost(Object.assign({ area: refArea }, a.cost, { area: num((a.cost || {}).area) || refArea })) : null,
      residual: on('residual') ? approaches.residual(a.residual) : null,
    };
    const w = Object.assign({ market: 100 }, a.weights || {});
    const vals = { market: marketGross, income: out.income && out.income.value, cost: out.cost && out.cost.value, residual: out.residual && out.residual.value };
    out.reconciled = approaches.reconcile(vals, w);
    out.active = !!(out.reconciled && out.reconciled.used.some((k) => k !== 'market'));
    return out;
  }

  function compute(state) {
    const settings = state.settings || {};
    const subject = state.subject || {};
    const meta = state.meta || {};
    const factors = factorList(state);
    const annex = settings.annex || {};
    const parkingV = num(annex.parking) || 0;
    const storageV = num(annex.storage) || 0;
    const coef = (v) => { const x = num(v); return x != null && x > 0 && x <= 1.5 ? x : null; };   // negotiation coefficients
    const negDefault = negotiationDefault(settings);
    const sourceWeights = settings.sourceWeights || {};
    const valuationDate = meta.valuationDate || new Date().toISOString().slice(0, 10);
    const warnings = [];

    const comps = (state.comparables || []).map((c) => {
      const price = num(c.price);
      const area = compArea(c, settings);
      const valid = !!(price && price > 0 && area && area > 0);
      const src = SOURCES[c.source] || SOURCES.otro;
      const kSource = coef(c.negotiation) || (src.negotiation != null ? src.negotiation : negDefault);
      const months = settings.timeAdjust === false ? 0 : Math.max(0, monthsBetween(c.date || valuationDate, valuationDate));
      const kTime = Math.pow(1 + clamp(num(settings.timeTrendAnnual) || 0, -0.5, 0.5), months / 12);
      const annexDeduct = num(c.annexOverride) != null ? num(c.annexOverride) : (c.parking ? parkingV : 0) + (c.storage ? storageV : 0);
      const ratings = c.ratings || {};
      const overrides = c.kOverride || {};
      const fs = factors.map((f) => {
        const level = clamp(Math.round(num(ratings[f.id]) || 0), -2, 2);
        const ov = num(overrides[f.id]);
        const k = ov != null && ov > 0 ? clamp(ov, 0.5, 1.5) : factorK(f, level, settings);
        return { id: f.id, level, k, overridden: ov != null && ov > 0 };
      });
      const kTotal = fs.reduce((p, f) => p * f.k, 1);
      const grossAdj = fs.reduce((s, f) => s + Math.abs(f.k - 1), 0);
      const similarity = Math.max(0.2, 1 - grossAdj);
      const wSource = num(sourceWeights[c.source]) != null ? num(sourceWeights[c.source]) : src.weight;
      const priceAdj = valid ? price * kSource * kTime : null;
      const dwellingPrice = valid ? priceAdj - annexDeduct : null;
      const unitAsk = valid ? price / area : null;
      const unitBase = valid ? dwellingPrice / area : null;
      const unitHomog = valid ? unitBase * kTotal : null;
      if (!valid) {
        // _tpl and _args: the English template, key of the translations of the interface in other languages.
        warnings.push({ code: 'invalid_comp', compId: c.id, _tpl: 'Comparable {0}: price or area missing — excluded from the calculation.', _args: [c.id],
          it: `Comparabile ${c.id}: prezzo o superficie mancanti — escluso dal calcolo.`,
          en: `Comparable ${c.id}: price or area missing — excluded from the calculation.`,
          es: `Testigo ${c.id}: precio o superficie no disponibles — excluido del cálculo.` });
      }
      const include = c.include !== false && valid;
      if (include && grossAdj > 0.35) {
        warnings.push({ code: 'high_adjustment', compId: c.id, _tpl: 'Comparable {0}: gross adjustment {1}% (>35%), check comparability.', _args: [c.id, (grossAdj * 100).toFixed(0)],
          it: `Comparabile ${c.id}: aggiustamento lordo ${(grossAdj * 100).toFixed(0)}% (>35%), verificare la comparabilità.`,
          en: `Comparable ${c.id}: gross adjustment ${(grossAdj * 100).toFixed(0)}% (>35%), check comparability.`,
          es: `Testigo ${c.id}: ajuste bruto del ${(grossAdj * 100).toFixed(0)}% (>35%).` });
      }
      return {
        id: c.id, include, valid, price, area, unitAsk, kSource, kTime, months, annexDeduct, priceAdj, dwellingPrice,
        unitBase, factors: fs, kTotal, grossAdj, netAdj: kTotal - 1, similarity, wSource,
        distanceKm: distanceKm(subject.lat, subject.lon, c.lat, c.lon),
        weight: include ? wSource * similarity : 0, unitHomog,
      };
    });

    const used = comps.filter((c) => c.include);
    const xs = used.map((c) => c.unitHomog);
    const ws = used.map((c) => c.weight);
    const n = xs.length;
    const sw = ws.reduce((s, v) => s + v, 0);
    const stats = {
      n,
      mean: mean(xs),
      median: median(xs),
      trimmed: trimmedMean(xs, num(settings.trimPct) || 0),
      weighted: n && sw > 0 ? xs.reduce((s, v, i) => s + v * ws[i], 0) / sw : null,
      std: stdSample(xs),
      min: n ? Math.min.apply(null, xs) : null,
      max: n ? Math.max.apply(null, xs) : null,
      q1: quantileInc(xs, 0.25),
      q3: quantileInc(xs, 0.75),
      ciLevel: T_TABLE[num(settings.ciLevel)] ? num(settings.ciLevel) : 0.95,
      tCrit: null,
      ciLow: null,
      ciHigh: null,
    };
    stats.cv = stats.mean ? stats.std / stats.mean : null;
    stats.tCrit = n >= 2 ? tCrit(n - 1, stats.ciLevel) : null;
    // Dispersion of the weighted estimator: weighted standard deviation (reliability weights) and Kish effective size.
    const sw2 = ws.reduce((s, v) => s + v * v, 0);
    stats.nEff = sw > 0 ? (sw * sw) / sw2 : null;
    stats.stdWeighted = n >= 2 && stats.weighted != null && sw > 0 && sw - sw2 / sw > 0
      ? Math.sqrt(xs.reduce((s, v, i) => s + ws[i] * (v - stats.weighted) ** 2, 0) / (sw - sw2 / sw)) : null;

    const estimator = ESTIMATORS.includes(settings.estimator) ? settings.estimator : 'weighted';
    const unitValue = n ? (stats[estimator] != null ? stats[estimator] : stats.weighted) : null;
    if (n >= 2 && unitValue != null) {
      // The weighted estimator takes the weighted deviation on the effective sample size; the others the plain one.
      const useW = estimator === 'weighted' && stats.stdWeighted != null && stats.nEff > 1;
      if (useW) stats.tCrit = tCrit(Math.max(1, Math.floor(stats.nEff - 1 + 1e-9)), stats.ciLevel);
      const half = useW ? stats.tCrit * stats.stdWeighted / Math.sqrt(stats.nEff) : stats.tCrit * stats.std / Math.sqrt(n);
      stats.ciLow = unitValue - half;
      stats.ciHigh = unitValue + half;
    }
    if (n < 2) {
      warnings.push({ code: 'insufficient', it: 'Campione insufficiente: con meno di 2 comparabili validi non ci sono forchetta né classe di affidabilità (consigliati ≥ 6).',
        en: 'Insufficient sample: with fewer than 2 valid comparables there is no range and no reliability class (≥ 6 recommended).',
        es: 'Muestra insuficiente: con menos de 2 testigos válidos no hay horquilla ni clase de fiabilidad (recomendados ≥ 6).' });
    } else if (n < 6) {
      warnings.push({ code: 'small_sample', _tpl: 'Sample of {0} comparables: at least 6 are recommended (a requirement of the Spanish Orden ECO/805/2003).', _args: [n],
        it: `Campione di ${n} comparabili: se ne consigliano almeno 6 (requisito della Orden ECO/805/2003 spagnola).`,
        en: `Sample of ${n} comparables: at least 6 are recommended (a requirement of the Spanish Orden ECO/805/2003).`,
        es: `Muestra de ${n} testigos: se recomiendan al menos 6 (requisito de la Orden ECO/805/2003).` });
    }
    if (stats.cv != null && stats.cv > 0.15) {
      warnings.push({ code: 'high_cv', _tpl: 'High dispersion (CV {0}%): review coefficients or sample.', _args: [(stats.cv * 100).toFixed(1)],
        it: `Dispersione elevata (CV ${(stats.cv * 100).toFixed(1)}%): rivedere coefficienti o campione.`,
        en: `High dispersion (CV ${(stats.cv * 100).toFixed(1)}%): review coefficients or sample.`,
        es: `Dispersión elevada (CV ${(stats.cv * 100).toFixed(1)}%).` });
    }

    const refArea = subjectRefArea(subject, settings);
    const annexValue = (subject.parking ? parkingV : 0) + (subject.storage ? storageV : 0);
    const rounding = roundingStep(settings);
    const dwellingValue = unitValue != null && refArea ? unitValue * refArea : null;
    // Regularisation costs stated by the valuer (e.g. a declaration of compliance for an installation) are deducted.
    const deductions = ((state.technical && Array.isArray(state.technical.deductions)) ? state.technical.deductions : [])
      .reduce((t, d) => { const v = num(d && d.amount); return t + (v != null && v > 0 ? v : 0); }, 0);
    const marketGross = dwellingValue != null ? dwellingValue + annexValue : null;
    const marketTotal = marketGross != null ? roundTo(marketGross - deductions, rounding) : null;
    // Other approaches (income, cost, residual) reconciled with the market comparison by the valuer's weights.
    const ap = approachesOf(state, marketGross, refArea);
    if (!(refArea > 0)) {
      warnings.push(ap.active
        ? { code: 'invalid_area', it: 'Superficie di riferimento dell’immobile mancante o non valida: il confronto di mercato non dà un valore. Il valore deriva solo dagli altri approcci, senza forchetta.',
          en: 'Reference area of the property missing or not valid: the sales comparison gives no value. The value comes from the other approaches only, without a range.',
          es: 'Superficie de referencia del inmueble ausente o no válida: la comparación no da un valor. El valor procede solo de los otros métodos, sin horquilla.' }
        : { code: 'invalid_area', it: 'Superficie di riferimento dell’immobile mancante o non valida: il confronto di mercato non dà un valore.',
          en: 'Reference area of the property missing or not valid: the sales comparison gives no value.',
          es: 'Superficie de referencia del inmueble ausente o no válida: la comparación no da un valor.' });
    }
    const gross = ap.active ? ap.reconciled.value : marketGross;
    const ratio = ap.active && marketGross ? gross / marketGross : 1;
    const totalRaw = gross != null ? gross - deductions : null;
    const total = totalRaw != null ? roundTo(totalRaw, rounding) : null;
    // The range comes from the confidence interval of the sales comparison: none when that method does not enter the value.
    const marketInValue = !ap.active || ap.reconciled.used.includes('market');
    const hasRange = stats.ciLow != null && refArea > 0 && marketGross != null && marketInValue;
    const rangeLow = hasRange ? roundTo((stats.ciLow * refArea + annexValue) * ratio - deductions, rounding) : null;
    const rangeHigh = hasRange ? roundTo((stats.ciHigh * refArea + annexValue) * ratio - deductions, rounding) : null;
    const margin = num(settings.listingMarginPct) || 0;
    const listingPrice = total != null ? roundTo(total * (1 + margin / 100), listingStep(settings)) : null;
    let quality = null;
    if (n >= 2 && stats.cv != null) quality = stats.cv <= 0.1 && n >= 6 ? 'alta' : stats.cv <= 0.15 ? 'media' : 'baja';

    return {
      comps, stats, estimator, unitValue, refArea, usefulArea: usefulArea(subject), annexValue, dwellingValue, deductions, marketGross, marketTotal, approaches: ap,
      totalRaw, total, rangeLow, rangeHigh, rangeBasis: hasRange ? 'market' : null, listingPrice, unitTotal: total && refArea ? total / refArea : null,
      quality, warnings,
    };
  }

  // ---------- rating suggestions (objective factors only; 'loc' is the valuer's judgement) ----------
  const ORIENT_SCORE = { N: 1, NE: 1, NO: 1, NW: 1, E: 2, O: 2, W: 2, S: 3, SE: 3, SO: 3, SW: 3, TODAS: 3 };
  // EU scale A–G; national top classes (A0, A+, A1–A4) count as A, the German H one step below G.
  const ENERGY_SCORE = { A: 7, B: 6, C: 5, D: 4, E: 3, F: 2, G: 1, H: 0, A0: 7, 'A+': 7, 'A++': 7, 'A+++': 7, A1: 7, A2: 7, A3: 7, A4: 7 };

  function bucket(d, t1, t2) {
    if (d >= t2) return 2;
    if (d >= t1) return 1;
    if (d <= -t2) return -2;
    if (d <= -t1) return -1;
    return 0;
  }

  function suggestRatings(subject, comp, settings) {
    const out = {};
    const sArea = subjectRefArea(subject, settings);
    const cArea = compArea(comp, settings);
    if (sArea && cArea) {
      const ratio = sArea / cArea;
      out.size = ratio >= 1.25 ? -2 : ratio >= 1.08 ? -1 : ratio <= 0.8 ? 2 : ratio <= 0.926 ? 1 : 0;
    }
    const sf = num(subject.floor);
    const cf = num(comp.floor);
    if (sf != null && cf != null) {
      const sc = Math.min(sf, 3);
      const cc = Math.min(cf, 3);
      out.floor = sc - cc >= 2 ? 1 : sc - cc <= -2 ? -1 : 0;
    }
    const sNeeds = sf == null || sf >= 1;
    const cNeeds = cf == null || cf >= 1;
    const sOk = !!subject.elevator || !sNeeds;
    const cOk = !!comp.elevator || !cNeeds;
    if (sOk && !cOk) out.lift = cf == null ? 1 : cf >= 2 ? 2 : 1;
    else if (!sOk && cOk) out.lift = sf != null && sf >= 2 ? -2 : -1;
    else out.lift = 0;
    const subjectNew = !!subject.newBuild || subject.condition === 'nuevo';
    if (comp.newBuild) out.age = subjectNew ? 0 : -2;
    else if (num(subject.yearBuilt) && num(comp.yearBuilt)) out.age = bucket(num(subject.yearBuilt) - num(comp.yearBuilt), 12, 30);
    else out.age = 0;
    const scs = CONDITIONS[subject.condition];
    const ccs = CONDITIONS[comp.condition];
    if (scs && ccs) {
      const d = scs.score - ccs.score;
      out.cond = d >= 3 ? 2 : d >= 1 ? 1 : d <= -3 ? -2 : d <= -1 ? -1 : 0;
    }
    if (num(subject.bedrooms) != null && num(comp.bedrooms) != null) {
      const d = (num(subject.bedrooms) - num(comp.bedrooms)) + ((num(subject.bathrooms) || 0) - (num(comp.bathrooms) || 0));
      out.dist = d >= 3 ? 2 : d >= 1 ? 1 : d <= -3 ? -2 : d <= -1 ? -1 : 0;
    }
    const so = ORIENT_SCORE[String(subject.orientation || '').toUpperCase()];
    const co = ORIENT_SCORE[String(comp.orientation || '').toUpperCase()];
    out.orient = so && co ? clamp(so - co, -1, 1) : 0;
    const sOut = (num(subject.terraceM2) || 0) + (num(subject.galleryM2) || 0) + (num(subject.gardenM2) || 0);
    const cOut = (num(comp.terraceM2) || 0) + (num(comp.gardenM2) || 0);
    out.terr = bucket(sOut - cOut, 6, 30);
    const clim = (o) => (o.ac ? 1 : 0) + (o.heating ? 1 : 0);
    out.clim = clamp(clim(subject) - clim(comp), -2, 2);
    const common = (o) => (o.pool ? 2 : o.garden ? 1 : 0);
    out.common = clamp(common(subject) - common(comp), -2, 2);
    const se = ENERGY_SCORE[String(subject.energyCert || '').toUpperCase()];
    const ce = ENERGY_SCORE[String(comp.energyCert || '').toUpperCase()];
    out.energy = se != null && ce != null ? bucket(se - ce, 2, 4) : 0;
    return out;
  }

  // ---------- robustness: leave-one-out + seeded Monte Carlo on the judgement inputs ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Shallow working copy: photos dropped, the objects the simulation mutates are copied.
  function lite(state) {
    const st = state.settings || {};
    return Object.assign({}, state, {
      photos: [],
      settings: Object.assign({}, st, { annex: Object.assign({}, st.annex || {}) }),
      factors: factorList(state).map((f) => Object.assign({}, f)),
      comparables: (state.comparables || []).map((c) => Object.assign({}, c, { ratings: Object.assign({}, c.ratings || {}) })),
    });
  }
  /* How much the value depends on single comparables (leave-one-out) and on the valuer's judgement
   * (Monte Carlo: negotiation ±0.02, time trend ×0.5–1.5, annex values ±15 %, factor weights ±20 %,
   * each rating moved by one level with probability 10 %). Deterministic for a given seed. */
  function robustness(state, opts) {
    opts = opts || {};
    const base = compute(state);
    if (base.total == null || !base.stats.n) return null;
    const loo = [];
    base.comps.forEach((rc, i) => {
      if (!rc.include) return;
      const s = lite(state);
      s.comparables[i].include = false;
      const r = compute(s);
      if (r.total != null) loo.push({ id: rc.id, total: r.total, delta: (r.total - base.total) / base.total });
    });
    const n = Math.max(20, Math.min(5000, Math.round(num(opts.n) || 800)));
    const rnd = mulberry32(num(opts.seed) != null ? num(opts.seed) : 20261122);
    const u = (a, b) => a + (b - a) * rnd();
    const s0 = state.settings || {};
    const neg0 = negotiationDefault(s0);
    const trend0 = num(s0.timeTrendAnnual) || 0;
    const annex0 = s0.annex || {};
    const totals = [];
    for (let k = 0; k < n; k++) {
      const s = lite(state);
      s.settings.negotiationDefault = neg0 + u(-0.02, 0.02);
      s.settings.timeTrendAnnual = trend0 * u(0.5, 1.5);
      s.settings.annex.parking = (num(annex0.parking) || 0) * u(0.85, 1.15);
      s.settings.annex.storage = (num(annex0.storage) || 0) * u(0.85, 1.15);
      s.factors.forEach((f) => { f.delta = (num(f.delta) || 0) * u(0.8, 1.2); });
      s.comparables.forEach((c) => {
        Object.keys(c.ratings).forEach((fid) => {
          if (rnd() < 0.1) c.ratings[fid] = clamp(Math.round(num(c.ratings[fid]) || 0) + (rnd() < 0.5 ? -1 : 1), -2, 2);
        });
      });
      const r = compute(s);
      if (r.totalRaw != null && isFinite(r.totalRaw)) totals.push(r.totalRaw);
    }
    if (!totals.length) return { base: base.total, loo, looMaxAbs: 0, mc: null };
    totals.sort((a, b) => a - b);
    const lo = totals[0];
    const hi = totals[totals.length - 1];
    const bins = 14;
    const w = hi > lo ? (hi - lo) / bins : 1;
    const hist = Array.from({ length: bins }, (_, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, count: 0 }));
    totals.forEach((v) => { hist[Math.min(bins - 1, Math.floor((v - lo) / w))].count++; });
    const m = mean(totals);
    const sd = stdSample(totals);
    return {
      base: base.total,
      loo,
      looMaxAbs: loo.reduce((x, l) => Math.max(x, Math.abs(l.delta)), 0),
      mc: { n: totals.length, mean: m, std: sd, cv: m ? sd / m : null, p05: quantileInc(totals, 0.05), p10: quantileInc(totals, 0.1),
        p50: quantileInc(totals, 0.5), p90: quantileInc(totals, 0.9), p95: quantileInc(totals, 0.95), hist },
    };
  }

  return { approaches, negotiationDefault, ESTIMATORS, roundingStep, listingStep, factorOrigin,
    FACTORS, LEVELS, SOURCES, CONDITIONS, compute, suggestRatings, robustness, usefulArea, subjectRefArea, compArea,
    util: { median, quantileInc, trimmedMean, mean, stdSample, tCrit, tCrit95, roundTo, monthsBetween, num, distanceKm, mulberry32 },
  };
});
