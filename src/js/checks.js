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
/* Checks — document checks (title, easements, planning, cadastre, energy…) and the positive wording that the report uses
 * for what was verified and for what is best verified before signing. Topics and statuses follow the code lists of the
 * code lists of Valesta (topics, check statuses). Pure data and text, no DOM. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Checks = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const L = (en, es, it) => ({ en, es, it });
  const G = typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : {};
  // Italian, English and Spanish are in the label; the other languages come from the interface packs (UI_I18N.text).
  const pick = (o, lang) => (!o ? '' : ['en', 'es', 'it'].includes(lang) ? o[lang] || o.en || '' : G.UI_I18N && G.UI_I18N.text ? G.UI_I18N.text(o, lang) : o.en || '');

  const STATUSES = ['verified', 'not_verified', 'to_investigate', 'not_applicable'];
  const STATUS_LABEL = {
    verified: L('Verified', 'Verificada', 'Verificata'), not_verified: L('Not verified', 'No verificada', 'Non verificata'),
    to_investigate: L('To investigate', 'Por investigar', 'Da approfondire'), not_applicable: L('Not applicable', 'No aplicable', 'Non applicabile'),
  };
  const GROUPS = [
    { id: 'legal', label: L('Title, charges and easements', 'Titularidad, cargas y servidumbres', 'Titolarità, gravami e servitù') },
    { id: 'planning', label: L('Planning and cadastre', 'Urbanismo y catastro', 'Urbanistica e catasto') },
    { id: 'structure', label: L('Structure and seismic safety', 'Estructura y seguridad sísmica', 'Struttura e sicurezza sismica') },
    { id: 'energy', label: L('Energy and installations', 'Energía e instalaciones', 'Energia e impianti') },
    { id: 'use', label: L('Building, occupation and environment', 'Comunidad, ocupación y entorno', 'Condominio, occupazione e ambiente') },
  ];
  // doc: index of the typical document of the country pack (Taxonomy.COUNTRIES[].checkDocs) shown with the check.
  // skip / only: property categories (Taxonomy) where the check does not apply / only applies.
  const CATALOG = [
    { topic: 'title', group: 'legal', doc: 0, join: 'with', label: L('Title and charges', 'Titularidad y cargas', 'Titolarità e gravami'),
      hint: L('Ownership, mortgages, seizures', 'Propiedad, hipotecas, embargos', 'Proprietà, ipoteche, pignoramenti'), who: L('notary or conveyancer', 'notario', 'notaio') },
    { topic: 'easements', group: 'legal', label: L('Easements and restrictions', 'Servidumbres y limitaciones', 'Servitù e vincoli'),
      hint: L('Rights of way, views, landscape or coastal restrictions', 'Pasos, vistas, limitaciones paisajísticas o de costas', 'Passaggi, vedute, vincoli paesaggistici o costieri'),
      who: L('notary and surveyor', 'notario y técnico', 'notaio e tecnico') },
    { topic: 'planning', group: 'planning', doc: 1, label: L('Planning and building permits', 'Urbanismo y licencias', 'Conformità urbanistica'),
      hint: L('Permits compared with the property as it is', 'Licencias frente al estado real', 'Titoli edilizi rispetto allo stato di fatto'), who: L('qualified surveyor', 'técnico competente', 'tecnico abilitato') },
    { topic: 'cadastral', group: 'planning', label: L('Cadastral conformity', 'Conformidad catastral', 'Conformità catastale'),
      hint: L('Registered plan and data compared with the property as it is', 'Plano y datos catastrales frente al estado real', 'Planimetria e dati rispetto allo stato di fatto'),
      who: L('surveyor', 'técnico', 'tecnico') },
    { topic: 'occupancy_permit', group: 'planning', skip: ['land'], label: L('Occupancy permit', 'Licencia de ocupación o cédula', 'Agibilità o abitabilità'),
      hint: L('Certificate that the property can be used', 'Certificado de que el inmueble puede usarse', 'Titolo che attesta l’utilizzabilità'),
      who: L('owner or municipality', 'propietario o ayuntamiento', 'proprietario o comune') },
    { topic: 'seismic', group: 'structure', skip: ['land'], label: L('Seismic safety', 'Seguridad sísmica', 'Sicurezza sismica'),
      hint: L('Seismic zone, structure, risk class and structural certificates', 'Zona sísmica, estructura, clase de riesgo y certificados estructurales', 'Zona sismica, struttura, classe di rischio e certificati strutturali'),
      who: L('structural engineer', 'técnico de estructuras', 'ingegnere strutturista') },
    { topic: 'energy', group: 'energy', doc: 2, skip: ['land', 'accessory'], label: L('Energy certificate', 'Certificado energético', 'Attestato energetico'),
      hint: L('Rating and validity', 'Calificación y validez', 'Classe e validità'), who: L('energy assessor', 'técnico certificador', 'certificatore energetico') },
    { topic: 'installations', group: 'energy', skip: ['land'], label: L('Installations', 'Instalaciones', 'Impianti'),
      hint: L('Electrical, gas, heating', 'Electricidad, gas, calefacción', 'Elettrico, gas, riscaldamento'), who: L('licensed installer', 'instalador autorizado', 'installatore abilitato') },
    { topic: 'condominium', group: 'use', skip: ['land', 'industrial', 'hospitality'], label: L('Building charges and approved works', 'Cuotas de comunidad y obras aprobadas', 'Spese e lavori condominiali'),
      hint: L('Arrears and works already approved', 'Deudas y obras ya aprobadas', 'Arretrati e lavori già deliberati'), who: L('building manager', 'administrador de fincas', 'amministratore') },
    { topic: 'tenancy', group: 'use', label: L('Tenancy and occupation', 'Arrendamientos y ocupación', 'Locazioni e occupazione'),
      hint: L('Vacant, let or occupied', 'Libre, arrendado u ocupado', 'Libero, locato o occupato'), who: L('owner', 'propietario', 'proprietario') },
    { topic: 'environmental', group: 'use', only: ['industrial', 'land', 'special', 'hospitality'], label: L('Environment and natural risks', 'Medio ambiente y riesgos', 'Ambiente e rischi naturali'),
      hint: L('Contamination, flooding and other risks', 'Contaminación, inundación y otros riesgos', 'Contaminazione, alluvioni e altri rischi'),
      who: L('environmental consultant', 'consultor ambiental', 'consulente ambientale') },
  ];

  // Positive wording for checks not (yet) verified: what is assumed, who usually checks it, and that the valuation will be
  // updated if needed. {doc} = typical document of the country, kept in its original language.
  const ADVICE = {
    title: L('The value refers to full ownership, free of mortgages, charges and undeclared encumbrances. This is always confirmed before signing{doc}: if anything relevant came up, we would gladly update the valuation.',
      'El valor se refiere al pleno dominio, libre de hipotecas, embargos y cargas no declaradas. Es lo que siempre se confirma antes de firmar{doc}: si apareciera algo relevante, actualizaremos con gusto la valoración.',
      'Il valore si riferisce alla piena proprietà, libera da ipoteche, pignoramenti e gravami non dichiarati. È ciò che si conferma sempre prima della firma{doc}: se emergesse qualcosa di rilevante, aggiorneremo volentieri la valutazione.'),
    easements: L('No easements or restrictions have been declared. The notary or the conveyancer normally checks them before signing: if any came up, we would take them into account.',
      'No constan servidumbres ni limitaciones declaradas. El notario o el profesional que lleva la compraventa las comprueba normalmente antes de firmar: si apareciera alguna, la tendremos en cuenta.',
      'Non risultano servitù o vincoli dichiarati. Il notaio o il professionista che segue la compravendita li verifica normalmente prima della firma: se ne emergessero, ne terremo conto.'),
    planning: L('We valued the property as we saw it, assuming it complies with its planning and building permits{doc}. A surveyor usually confirms this before contracts are signed: if any differences came up, we would gladly update the valuation.',
      'Hemos valorado el inmueble tal como lo vimos, considerándolo conforme a sus licencias{doc}. Un técnico suele confirmarlo antes de firmar el contrato: si aparecieran diferencias, actualizaremos con gusto la valoración.',
      'Abbiamo valutato l’immobile così come lo abbiamo visto, considerandolo conforme ai titoli edilizi{doc}. Di solito lo conferma un tecnico prima del contratto: se emergessero differenze, aggiorneremo volentieri la valutazione.'),
    cadastral: L('We used the cadastral data as the reference for the areas. A surveyor can confirm that the registered plan matches the property as it is: a quick check that is best done early.',
      'Hemos usado los datos catastrales como referencia para las superficies. Un técnico puede confirmar que el plano registrado coincide con el estado real: es una comprobación rápida que conviene hacer con tiempo.',
      'Abbiamo usato i dati catastali come riferimento per le superfici. Un tecnico può confermare che la planimetria corrisponde allo stato di fatto: è un controllo rapido che conviene fare per tempo.'),
    occupancy_permit: L('We assume the property holds the occupancy permit it requires. Having it at hand makes the negotiation and the buyer’s financing easier.',
      'Consideramos que el inmueble cuenta con la licencia de ocupación o cédula que le corresponde. Tenerla a mano facilita la negociación y la financiación del comprador.',
      'Consideriamo l’immobile dotato del titolo di agibilità o abitabilità previsto. Averlo a portata di mano rende più semplici la trattativa e il finanziamento dell’acquirente.'),
    energy: L('The energy certificate{doc} is normally required before advertising the sale: it is also a chance to learn about possible improvements and their effect on value.',
      'El certificado energético{doc} suele exigirse antes de anunciar la venta: es también la ocasión de conocer las mejoras posibles y su efecto en el valor.',
      'L’attestato energetico{doc} è di norma richiesto prima di pubblicizzare la vendita: è anche l’occasione per conoscere i miglioramenti possibili e il loro effetto sul valore.'),
    energyAny: L('Having the energy certificate{doc} ready before advertising the sale helps buyers compare: it is also a chance to learn about possible improvements and their effect on value.',
      'Contar con el certificado energético{doc} antes de anunciar la venta ayuda a los compradores a comparar: es también la ocasión de conocer las mejoras posibles y su efecto en el valor.',
      'Disporre dell’attestato energetico{doc} prima di pubblicizzare la vendita aiuta gli acquirenti a confrontare: è anche l’occasione per conoscere i miglioramenti possibili e il loro effetto sul valore.'),
    seismic: L('The structure was observed during the inspection, without structural tests. The seismic zone of the municipality and, where available, the structural certificates and the risk class complete the picture for the buyer.',
      'La estructura se observó durante la visita, sin ensayos estructurales. La zona sísmica del municipio y, si existen, los certificados estructurales y la clase de riesgo completan la información para el comprador.',
      'La struttura è stata osservata durante il sopralluogo, senza prove strutturali. La zona sismica del comune e, se disponibili, i certificati strutturali e la classe di rischio completano il quadro per l’acquirente.'),
    installations: L('The installations were observed during the inspection, without technical tests. Compliance certificates, where available, complete the picture for the buyer.',
      'Las instalaciones se observaron durante la visita, sin pruebas técnicas. Los certificados de las instalaciones, si están disponibles, completan la información para el comprador.',
      'Gli impianti sono stati osservati durante il sopralluogo, senza prove tecniche. Le dichiarazioni di conformità, se disponibili, completano il quadro per l’acquirente.'),
    condominium: L('We recommend asking the building manager for the service charges and any works already approved: a simple document that makes the negotiation smoother.',
      'Recomendamos pedir al administrador el estado de las cuotas y de las obras ya aprobadas: es un documento sencillo que hace la negociación más tranquila.',
      'Consigliamo di chiedere all’amministratore la situazione delle spese e dei lavori già deliberati: è un documento semplice che rende la trattativa più serena.'),
    tenancy: L('The valuation assumes vacant possession on completion. If the property were let or occupied, we would review the value in the light of the lease.',
      'La valoración considera el inmueble libre en la entrega. Si estuviera arrendado u ocupado, revisaríamos el valor a la luz del contrato.',
      'La valutazione considera l’immobile libero alla consegna. Se fosse locato o occupato, rivedremmo il valore alla luce del contratto.'),
    environmental: L('No environmental risk factors came up during the inspection. For industrial property or land, a dedicated environmental assessment gives certainty to all parties.',
      'No se apreciaron riesgos ambientales durante la visita. En inmuebles industriales o suelo, un estudio ambiental específico da seguridad a todas las partes.',
      'Non sono emersi elementi di rischio ambientale durante il sopralluogo. Per immobili produttivi o terreni, una verifica ambientale dedicata dà certezza a tutte le parti.'),
  };
  // How the document name joins the sentence: ", with the …" for the title check, " (…)" for the others.
  const DOC_JOIN = { with: L(', with the {doc}', ', con {doc}', ', con {doc}'), paren: L(' ({doc})', ' ({doc})', ' ({doc})') };
  const TEXT = {
    title: L('Document checks', 'Verificaciones documentales', 'Verifiche documentali'),
    verifiedTitle: L('What we verified', 'Lo que hemos verificado', 'Cosa abbiamo verificato'),
    adviceTitle: L('Checks we recommend before signing', 'Verificaciones recomendadas antes de firmar', 'Verifiche consigliate prima della firma'),
    deep: L('To investigate.', 'Por investigar.', 'Da approfondire.'),
  };

  const PREFIX = { RES: 'residential', RET: 'retail', WHO: 'wholesale', OFF: 'office', IND: 'industrial', HOS: 'hospitality', LND: 'land', ACC: 'accessory', SPC: 'special' };
  const categoryOfCode = (code) => PREFIX[String(code || '').split('.')[0]] || 'residential';
  const applicable = (category) => CATALOG.filter((c) => !(c.skip && c.skip.includes(category)) && !(c.only && !c.only.includes(category)));
  const records = (state) => (Array.isArray(state && state.checks) ? state.checks : []);
  const statusOf = (state, topic) => { const r = records(state).find((x) => x && x.topic === topic); return (r && r.status) || ''; };
  function progress(state) {
    const list = applicable(categoryOfCode(state && state.subject && state.subject.propertyType && state.subject.propertyType.code));
    return { done: list.filter((c) => STATUSES.includes(statusOf(state, c.topic))).length, total: list.length };
  }
  const label = (topic, lang) => pick((CATALOG.find((c) => c.topic === topic) || {}).label, lang);
  // Text block for the report; null when no check has a status yet (the report then stays as before).
  // X: texts of a report language pack ({ title, verifiedTitle, adviceTitle, deep, labels, advice, docJoin }), when present.
  function reportBlock(state, lang, docs, X) {
    const list = applicable(categoryOfCode(state && state.subject && state.subject.propertyType && state.subject.propertyType.code));
    if (!list.some((c) => STATUSES.includes(statusOf(state, c.topic)))) return null;
    const verified = [];
    const advice = [];
    list.forEach((c) => {
      const r = records(state).find((x) => x && x.topic === c.topic) || {};
      const st = r.status || 'not_verified';
      if (st === 'not_applicable') return;
      if (st === 'verified') {
        verified.push({ topic: c.topic, text: [(X && X.labels && X.labels[c.topic]) || pick(c.label, lang), [r.source, r.date].filter(Boolean).join(', ')].filter(Boolean).join(' — ') });
        return;
      }
      const join = (X && X.docJoin && X.docJoin[c.join || 'paren']) || pick(DOC_JOIN[c.join || 'paren'], lang);
      const doc = c.doc != null && docs && docs[c.doc] ? join.replace('{doc}', docs[c.doc]) : '';
      const key = c.topic === 'energy' && ((state && state.meta && state.meta.country) || 'ES') !== 'ES' ? 'energyAny' : c.topic;
      advice.push({ topic: c.topic, deep: st === 'to_investigate', label: (X && X.labels && X.labels[c.topic]) || pick(c.label, lang), text: ((X && X.advice && X.advice[key]) || pick(ADVICE[key], lang)).replace('{doc}', doc) });
    });
    const tx = (k) => (X && X[k]) || pick(TEXT[k], lang);
    return { title: tx('title'), verifiedTitle: tx('verifiedTitle'), adviceTitle: tx('adviceTitle'), deepLabel: (X && X.deep) || pick(TEXT.deep, lang), verified, advice };
  }

  return { STATUSES, STATUS_LABEL, GROUPS, CATALOG, categoryOfCode, applicable, statusOf, progress, label, reportBlock, pick };
});
