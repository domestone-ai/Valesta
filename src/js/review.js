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
/* Review — deterministic quality check of the valuation (no AI, works offline).
 * run(state, res) → { score 0–100, grade A–E, counts, checks[{ id, area, level, title{it,en,es}, detail{it,en,es}, fix{tab,path} }] }
 * Areas: data (property), sample, method, report. Levels: ok · info · warn · error.
 */
(function (root, factory) {
  const mod = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Review = mod;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const G = typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : root;
  const MCA = () => G.MCA || (typeof require === 'function' ? (G.MCA = require('./engine.js')) : null);
  const L3 = (it, en, es) => ({ it, en, es });
  // A text with values: templates with {0}, {1}. The English template is the key of the translations in other languages.
  const fill = (s, a) => String(s).replace(/\{(\d+)\}/g, (m, i) => (a[+i] == null ? '' : a[+i]));
  const L3f = (it, en, es, ...a) => ({ it: fill(it, a), en: fill(en, a), es: fill(es, a), _tpl: en, _args: a });
  const PENALTY = { ok: 0, info: 1.5, warn: 5, error: 14 };
  const fmt1 = (v) => (Math.round(v * 10) / 10).toString();
  const pct = (v) => `${Math.round(v * 100)}%`;
  const locText = (v) => (v == null ? '' : typeof v === 'object' ? String(v.it || v.es || v.en || v._ || '') : String(v));
  const has = (v) => locText(v).trim().length > 0;
  const fin = (v) => typeof v === 'number' && isFinite(v);

  function run(state, res) {
    state = state || {};
    res = res || MCA().compute(state);
    const s = state.subject || {};
    const m = state.meta || {};
    const isES = (m.country || 'ES') === 'ES';
    const st = state.settings || {};
    const comps = (state.comparables || []).map((c, i) => ({ c, r: res.comps[i] || {} }));
    const used = comps.filter((x) => x.r.include);
    const U = MCA().util;
    const checks = [];
    const add = (id, area, level, title, detail, fix) => checks.push({ id, area, level, title, detail: detail || L3('', '', ''), fix: fix || null });
    const ids = (list, f) => list.map((x) => `${x.c.id} (${f(x)})`).join(', ');

    // ---------- data ----------
    add('subject-address', 'data', s.address && s.municipality ? 'ok' : 'error', L3('Indirizzo dell’immobile', 'Property address', 'Dirección del inmueble'),
      s.address && s.municipality ? null : L3('Mancano indirizzo o comune: servono per identificare il bene.', 'Address or municipality missing: both are needed to identify the property.', 'Faltan la dirección o el municipio: son necesarios para identificar el inmueble.'),
      { tab: 'immobile', path: 'subject.address' });
    const coords = fin(s.lat) && fin(s.lon);
    add('subject-coords', 'data', coords ? 'ok' : 'warn', L3('Coordinate geografiche', 'Geographic coordinates', 'Coordenadas geográficas'),
      coords ? null : L3('Senza coordinate non ci sono mappe né distanze dai comparabili.', 'Without coordinates there are no maps and no distances to the comparables.', 'Sin coordenadas no hay mapas ni distancias a los testigos.'),
      { tab: 'immobile', path: 'subject.lat' });
    add('subject-area', 'data', res.refArea > 0 ? 'ok' : 'error', L3('Superficie di riferimento', 'Reference area', 'Superficie de referencia'),
      res.refArea > 0 ? null : L3('Indica la superficie costruita o i vani: senza superficie il valore non si calcola.', 'Enter the built area or the rooms: without an area the value cannot be calculated.', 'Indica la superficie construida o las estancias: sin superficie no se calcula el valor.'),
      { tab: 'superfici', path: 'subject.areaBuilt' });
    add('subject-cadastre', 'data', has(s.cadastralRef) ? 'ok' : 'warn', L3('Riferimento catastale', 'Cadastral reference', 'Referencia catastral'),
      has(s.cadastralRef) ? null : isES ? L3('Verifica i dati nella Sede Elettronica del Catasto e riporta il riferimento (20 caratteri).', 'Check the data in the Spanish Cadastre e-office and enter the reference (20 characters).', 'Verifica los datos en la Sede Electrónica del Catastro e indica la referencia (20 caracteres).')
        : L3('Verifica i dati catastali e riporta il riferimento.', 'Check the cadastral data and enter the reference.', 'Verifica los datos catastrales e indica la referencia.'),
      { tab: 'superfici', path: 'subject.cadastralRef' });
    add('subject-year', 'data', fin(s.yearBuilt) ? 'ok' : 'warn', L3('Anno di costruzione', 'Year built', 'Año de construcción'),
      fin(s.yearBuilt) ? null : L3('L’anno incide sul fattore vetustà e sulla descrizione dell’edificio.', 'The year drives the age factor and the building description.', 'El año incide en el factor antigüedad y en la descripción del edificio.'),
      { tab: 'immobile', path: 'subject.yearBuilt' });
    add('subject-energy', 'data', has(s.energyCert) ? 'ok' : 'info', L3('Certificato energetico', 'Energy certificate', 'Certificado energético'),
      has(s.energyCert) ? null : isES ? L3('Obbligatorio per vendere o affittare in Spagna (RD 390/2021): indica la classe se disponibile.', 'Mandatory to sell or let in Spain (RD 390/2021): enter the rating if available.', 'Obligatorio para vender o alquilar (RD 390/2021): indica la calificación si está disponible.')
        : L3('Indica la classe energetica se disponibile: vedi i documenti del Paese.', 'Enter the energy rating if available: see the documents of the country.', 'Indica la calificación energética si está disponible: consulta los documentos del país.'),
      { tab: 'immobile', path: 'subject.energyCert' });
    const np = (state.photos || []).length;
    add('subject-photos', 'data', np >= 4 ? 'ok' : np ? 'info' : 'warn', L3('Documentazione fotografica', 'Photographic record', 'Reportaje fotográfico'),
      np >= 4 ? L3f('{0} foto.', '{0} photos.', '{0} fotos.', np)
        : np ? L3f('Solo {0} foto: consigliate 4–6 (esterno, soggiorno, cucina, bagni, camere).', 'Only {0} photos: 4–6 are recommended (exterior, living room, kitchen, bathrooms, bedrooms).', 'Solo {0} fotos: se recomiendan 4–6 (exterior, salón, cocina, baños, dormitorios).', np)
          : L3('Nessuna foto: il capitolo fotografico viene omesso. Le foto documentano il sopralluogo.', 'No photos: the photo chapter is omitted. Photos document the inspection.', 'Sin fotos: el capítulo fotográfico se omite. Las fotos documentan la visita.'),
      { tab: 'foto' });

    // ---------- sample ----------
    const n = res.stats.n;
    add('sample-size', 'sample', n >= 6 ? 'ok' : n >= 4 ? 'warn' : 'error', L3('Ampiezza del campione', 'Sample size', 'Tamaño de la muestra'),
      n >= 6 ? L3f('{0} comparabili nel calcolo.', '{0} comparables used.', '{0} testigos en el cálculo.', n)
        : n >= 4 ? L3f('Solo {0} comparabili: se ne consigliano almeno 6 (requisito della Orden ECO/805/2003 spagnola).', 'Only {0} comparables: at least 6 are recommended (a requirement of the Spanish Orden ECO/805/2003).', 'Solo {0} testigos: se recomiendan al menos 6 (requisito de la Orden ECO/805/2003).', n)
          : L3f('{0} comparabili: campione insufficiente per una stima affidabile.', '{0} comparables: not enough for a reliable estimate.', '{0} testigos: muestra insuficiente para una estimación fiable.', n),
      { tab: 'comparabili' });
    if (n >= 2 && res.stats.cv != null) {
      const cv = res.stats.cv;
      add('sample-cv', 'sample', cv <= 0.15 ? 'ok' : cv <= 0.2 ? 'warn' : 'error', L3('Dispersione del campione (CV)', 'Sample dispersion (CV)', 'Dispersión de la muestra (CV)'),
        cv <= 0.15 ? L3f('CV {0}%: dispersione contenuta.', 'CV {0}%: limited dispersion.', 'CV {0}%: dispersión contenida.', fmt1(cv * 100))
          : L3f('CV {0}%: rivedi i livelli di omogeneizzazione o escludi i comparabili meno simili.', 'CV {0}%: review the adjustment levels or exclude the least similar comparables.', 'CV {0}%: revisa los niveles de homogeneización o excluye los testigos menos semejantes.', fmt1(cv * 100)),
        { tab: 'omog' });
    }
    const heavy = used.filter((x) => x.r.grossAdj > 0.35);
    add('sample-gross', 'sample', !heavy.length ? 'ok' : heavy.some((x) => x.r.grossAdj > 0.5) ? 'error' : 'warn', L3('Aggiustamenti lordi', 'Gross adjustments', 'Ajustes brutos'),
      !heavy.length ? L3('Tutti i comparabili restano sotto il 35% di aggiustamento lordo.', 'All comparables stay below 35% gross adjustment.', 'Todos los testigos quedan por debajo del 35 % de ajuste bruto.')
        : L3f('Aggiustamento elevato: {0}. Verifica che siano davvero comparabili.', 'Heavy adjustment: {0}. Check they are truly comparable.', 'Ajuste elevado: {0}. Comprueba que sean realmente comparables.', ids(heavy, (x) => pct(x.r.grossAdj))),
      { tab: 'omog' });
    const vd = m.valuationDate;
    const age = (x) => (x.c.date && vd ? U.monthsBetween(x.c.date, vd) : 0);
    const old = used.filter((x) => age(x) > 6);
    add('sample-recency', 'sample', !old.length ? 'ok' : old.some((x) => age(x) > 12) ? 'error' : 'warn', L3('Attualità dei dati', 'Data recency', 'Actualidad de los datos'),
      !old.length ? L3('Rilevazioni degli ultimi 6 mesi.', 'Observations from the last 6 months.', 'Datos de los últimos 6 meses.')
        : L3f('Rilevazioni datate (età in mesi): {0}.', 'Dated observations (age in months): {0}.', 'Datos antiguos (antigüedad en meses): {0}.', ids(old, (x) => String(Math.round(age(x))))),
      { tab: 'comparabili' });
    if (coords) {
      const far = used.filter((x) => fin(x.r.distanceKm) && x.r.distanceKm > 2);
      add('sample-distance', 'sample', far.length ? 'warn' : 'ok', L3('Prossimità dei comparabili', 'Proximity of comparables', 'Proximidad de los testigos'),
        far.length ? L3f('Lontani dall’immobile: {0}.', 'Far from the subject: {0}.', 'Alejados del inmueble: {0}.', ids(far, (x) => `${fmt1(x.r.distanceKm)} km`)) : null,
        { tab: 'comparabili' });
    }
    if (used.length) {
      // Asking prices as the engine sees them: every source without its own negotiation coefficient (mandates, portals, other).
      const onlyAsking = used.every((x) => (MCA().SOURCES[x.c.source] || MCA().SOURCES.otro).negotiation == null);
      add('sample-sources', 'sample', onlyAsking ? 'info' : 'ok', L3('Tipologia delle fonti', 'Type of sources', 'Tipo de fuentes'),
        onlyAsking ? L3('Solo prezzi d’offerta: se possibile aggiungi compravendite registrate (Registro, Notariato) o chiusure dell’agenzia.', 'Asking prices only: if possible add registered sales (Land Registry, notaries) or the agency’s own closings.', 'Solo precios de oferta: si es posible añade compraventas registradas (Registro, Notariado) o cierres de la agencia.') : null,
        { tab: 'comparabili' });
    }
    if (n >= 4) {
      const iqr = res.stats.q3 - res.stats.q1;
      const lo = res.stats.q1 - 1.5 * iqr;
      const hi = res.stats.q3 + 1.5 * iqr;
      const out = used.filter((x) => x.r.unitHomog < lo || x.r.unitHomog > hi);
      add('sample-outliers', 'sample', out.length ? 'warn' : 'ok', L3('Valori anomali', 'Outliers', 'Valores atípicos'),
        out.length ? L3f('Fuori dall’intervallo interquartile: {0}.', 'Outside the interquartile fences: {0}.', 'Fuera del rango intercuartílico: {0}.', ids(out, (x) => `${Math.round(x.r.unitHomog)} ${G.I18N && G.I18N.sym ? G.I18N.sym() : '€'}/m²`)) : null,
        { tab: 'omog' });
    }
    if (res.refArea > 0) {
      const off = used.filter((x) => x.r.area && (x.r.area / res.refArea < 0.6 || x.r.area / res.refArea > 1.4));
      add('sample-areas', 'sample', off.length ? 'warn' : 'ok', L3('Superfici confrontabili', 'Comparable sizes', 'Superficies comparables'),
        off.length ? L3f('Superficie molto diversa (±40%): {0}.', 'Very different size (±40%): {0}.', 'Superficie muy distinta (±40 %): {0}.', ids(off, (x) => `${Math.round(x.r.area)} m²`)) : null,
        { tab: 'comparabili' });
    }

    // ---------- method ----------
    const neg = U.num(st.negotiationDefault);
    const negOk = neg != null && neg >= 0.88 && neg <= 0.99;
    add('method-negotiation', 'method', negOk ? 'ok' : 'warn', L3('Coefficiente di trattativa', 'Negotiation coefficient', 'Coeficiente de negociación'),
      negOk ? null : L3('Valore insolito: verifica il coefficiente (Valesta si attende 0,88–0,99).', 'Unusual value: check the coefficient (Valesta expects 0.88–0.99).', 'Valor inusual: revisa el coeficiente (Valesta espera 0,88–0,99).'),
      { tab: 'risultato', path: 'settings.negotiationDefault' });
    // Market inputs to confirm (D2): unconfirmed in a new valuation, or — in a file saved before the flag existed — still the
    // inputs of the 1.0 demo (trend 8.1%, annexes 18,000 and 4,000).
    const annexIn = st.annex || {};
    const demoInputs = U.num(st.timeTrendAnnual) === 0.081 && U.num(annexIn.parking) === 18000 && U.num(annexIn.storage) === 4000;
    if (st.marketConfirmed === false || (st.marketConfirmed === undefined && demoInputs)) {
      add('method-market', 'method', 'warn', L3('Dati di mercato', 'Market inputs', 'Datos de mercado'),
        L3('Coefficiente di trattativa, trend temporale e valori delle pertinenze non sono confermati per questo mercato: verificali e conferma.',
          'The negotiation coefficient, the time trend and the annex values are not confirmed for this market: check and confirm them.',
          'El coeficiente de negociación, la tendencia temporal y los valores de los anejos no están confirmados para este mercado: revísalos y confírmalos.'),
        { tab: 'risultato', path: 'settings.marketConfirmed' });
    }
    // F-10: asking prices corrected by the default coefficient need the valuer's reasoning, which the report prints.
    const onDefault = used.filter((x) => (MCA().SOURCES[x.c.source] || MCA().SOURCES.otro).negotiation == null
      && !(U.num(x.c.negotiation) > 0 && U.num(x.c.negotiation) <= 1.5)).length;
    const why = st.negotiationReason;
    const hasWhy = typeof why === 'string' ? !!why.trim() : !!why && typeof why === 'object' && Object.keys(why).some((k) => String(why[k] || '').trim());
    if (onDefault && !hasWhy) {
      add('method-negotiation-reason', 'method', 'info', L3('Motivazione della trattativa', 'Reasoning of the negotiation coefficient', 'Justificación de la negociación'),
        L3('I prezzi di offerta sono corretti con il coefficiente di trattativa: registra la motivazione, che il report stampa.',
          'Asking prices are corrected by the negotiation coefficient: record its reasoning, which the report prints.',
          'Los precios de oferta se corrigen con el coeficiente de negociación: registra la justificación, que el informe imprime.'),
        { tab: 'risultato', path: 'settings.negotiationReason' });
    }
    const overridden = used.filter((x) => U.num(x.c.annexOverride) != null || Object.keys(x.c.kOverride || {}).some((k) => U.num(x.c.kOverride[k]) > 0));
    if (overridden.length) {
      add('method-overrides', 'method', 'info', L3('Valori forzati', 'Overridden values', 'Valores forzados'),
        L3f('Coefficienti o pertinenze impostati fuori dall’editor: {0}.', 'Coefficients or annex amounts set outside the editor: {0}.',
          'Coeficientes o anejos fijados fuera del editor: {0}.', overridden.map((x) => x.c.id).join(', ')),
        { tab: 'omog' });
    }
    if (res.approaches && res.approaches.active) {
      const reason = locText((state.approaches || {}).reason).trim();
      add('method-reconciliation', 'method', reason ? 'ok' : 'warn', L3('Riconciliazione', 'Reconciliation', 'Conciliación'),
        reason ? null : L3('Spiega perché gli approcci hanno questi pesi: la motivazione è stampata nel report.',
          'Explain why the approaches have these weights: the reasoning is printed in the report.',
          'Explica por qué los métodos tienen estos pesos: la justificación se imprime en el informe.'),
        { tab: 'methods', path: 'approaches.reason' });
    }
    const ax = st.annex || {};
    const annexBad = (s.parking && !(U.num(ax.parking) > 0)) || (s.storage && !(U.num(ax.storage) > 0));
    add('method-annex', 'method', annexBad ? 'warn' : 'ok', L3('Valore delle pertinenze', 'Value of the annexes', 'Valor de los anejos'),
      annexBad ? L3('L’immobile ha posto auto o ripostiglio ma il loro valore è zero.', 'The property has parking or storage but their value is zero.', 'El inmueble tiene parking o trastero pero su valor es cero.') : null,
      { tab: 'risultato', path: 'settings.annex.parking' });
    const loose = used.filter((x) => (x.c.ratings || {}).loc && !has((x.c.ratingNotes || {}).loc));
    add('method-judgement', 'method', loose.length ? 'info' : 'ok', L3('Giustificazione dell’ubicazione', 'Location rationale', 'Justificación de la localización'),
      loose.length ? L3f('Livelli di ubicazione senza nota: {0}. Una frase rende la stima difendibile.', 'Location levels without a note: {0}. One sentence makes the estimate defensible.', 'Niveles de localización sin nota: {0}. Una frase hace la estimación defendible.', loose.map((x) => x.c.id).join(', ')) : null,
      { tab: 'omog' });
    if (st.timeAdjust === false && used.some((x) => age(x) > 3)) {
      add('method-time', 'method', 'info', L3('Aggiornamento temporale', 'Time adjustment', 'Actualización temporal'),
        L3('Ci sono rilevazioni di oltre 3 mesi: valuta se attivare l’aggiornamento temporale.', 'Some observations are over 3 months old: consider enabling the time adjustment.', 'Hay datos de más de 3 meses: valora activar la actualización temporal.'),
        { tab: 'risultato', path: 'settings.timeAdjust' });
    }
    if (res.total && res.rangeLow != null && res.rangeHigh != null) {
      const w = (res.rangeHigh - res.rangeLow) / res.total;
      add('method-range', 'method', w > 0.2 ? 'warn' : 'ok', L3('Ampiezza della forchetta', 'Width of the range', 'Amplitud de la horquilla'),
        w > 0.2 ? L3f('Forchetta pari al {0} del valore: aumenta il campione o riduci la dispersione.', 'Range equal to {0} of the value: enlarge the sample or reduce dispersion.', 'Horquilla del {0} del valor: amplía la muestra o reduce la dispersión.', pct(w))
          : L3f('Forchetta pari al {0} del valore.', 'Range equal to {0} of the value.', 'Horquilla del {0} del valor.', pct(w)),
        { tab: 'risultato' });
    }

    // ---------- report ----------
    const adv = m.advisor || {};
    add('report-advisor', 'report', has(adv.name) ? 'ok' : 'error', L3('Consulente firmatario', 'Signing advisor', 'Asesor firmante'),
      has(adv.name) ? null : L3('Indica chi firma il rapporto.', 'Enter who signs the report.', 'Indica quién firma el informe.'), { tab: 'pratica', path: 'meta.advisor.name' });
    const off = m.office || {};
    const offLevel = has(off.name) ? (has(off.phone) || has(off.email) ? 'ok' : 'info') : 'warn';
    add('report-office', 'report', offLevel, L3('Dati dell’agenzia', 'Agency details', 'Datos de la agencia'),
      offLevel === 'ok' ? null : offLevel === 'info' ? L3('Aggiungi telefono o email dell’agenzia per la firma.', 'Add the agency phone or email to the signature block.', 'Añade el teléfono o el email de la agencia en la firma.')
        : L3('Indica il nome dell’agenzia che firma il rapporto.', 'Enter the name of the agency signing the report.', 'Indica el nombre de la agencia que firma el informe.'),
      { tab: 'agenzia', path: 'meta.office.name' });
    add('report-purpose', 'report', has(m.purpose) ? 'ok' : 'warn', L3('Finalità e base di valore', 'Purpose and basis of value', 'Finalidad y base de valor'),
      has(m.purpose) ? null : L3('Indica la finalità della valutazione: definisce la base di valore e l’uso del rapporto.', 'State the purpose of the valuation: it frames the basis of value and the use of the report.', 'Indica la finalidad de la valoración: enmarca la base de valor y el uso del informe.'),
      { tab: 'pratica', path: 'meta.purpose' });
    let dLevel = 'ok';
    let dText = null;
    if (!m.valuationDate) { dLevel = 'error'; dText = L3('Manca la data di valutazione.', 'The valuation date is missing.', 'Falta la fecha de valoración.'); }
    else if ((m.visitDate && m.visitDate > m.valuationDate) || (m.reportDate && m.reportDate < m.valuationDate)) {
      dLevel = 'warn';
      dText = L3('Ordine delle date incoerente: sopralluogo ≤ valutazione ≤ emissione.', 'Dates out of order: inspection ≤ valuation ≤ report.', 'Orden de fechas incoherente: visita ≤ valoración ≤ emisión.');
    }
    add('report-dates', 'report', dLevel, L3('Date del rapporto', 'Report dates', 'Fechas del informe'), dText, { tab: 'pratica', path: 'meta.valuationDate' });
    add('report-client', 'report', has((m.client || {}).name) ? 'ok' : 'info', L3('Committente', 'Client', 'Solicitante'),
      has((m.client || {}).name) ? null : L3('Il nome del committente compare in copertina e nella lettera.', 'The client’s name appears on the cover and in the letter.', 'El nombre del solicitante aparece en la portada y en la carta.'),
      { tab: 'pratica', path: 'meta.client.name' });

    const counts = { ok: 0, info: 0, warn: 0, error: 0 };
    let penalty = 0;
    checks.forEach((c) => { counts[c.level]++; penalty += PENALTY[c.level]; });
    const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'E';
    return { score, grade, counts, checks };
  }

  return { run, PENALTY };
});
