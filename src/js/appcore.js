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
/* AppCore — pure functions of the app (no DOM): number parsing, data paths, automatic suggestions,
 * validation and migration of projects, new valuation, safe persistence.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.AppCore = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const G = typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : {};
  const MCA = () => G.MCA;
  const Profiles = () => G.Profiles || (typeof require === 'function' ? (G.Profiles = require('./profiles.js')) : null);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // "85,60" → 85.6 · "592.000" → 592000 · "1.234,5" → 1234.5 · "495000 €" → 495000
  // "CHF 1’250’000" → 1250000 · "£1,250,000" → 1250000 · "1,234.5" → 1234.5 ("350,000" stays 350: comma is the decimal mark)
  function parseNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v == null) return null;
    let s = String(v).replace(/[€£\s%]|m²|m2|\b(EUR|GBP|CHF|PLN|CZK|HUF|RON|DKK|NOK|SEK)\b|zł|Kč|Ft\b|kr\b|lei\b/gi, '').trim();
    if (!s) return null;
    if (/^-?\d{1,3}(['’]\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/['’]/g, '');
    else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) && (s.includes('.') || s.split(',').length > 2)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    if (!/^-?\d*\.?\d+$/.test(s)) return null;
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function getPath(obj, path) {
    return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  // A path never reaches the prototype of all objects (__proto__, constructor, prototype).
  const UNSAFE_KEY = /^(__proto__|constructor|prototype)$/;
  function setPath(obj, path, value) {
    const keys = String(path).split('.');
    if (keys.some((k) => UNSAFE_KEY.test(k))) return obj;
    let o = obj;
    keys.slice(0, -1).forEach((k, i) => {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[k];
    });
    o[keys[keys.length - 1]] = value;
    return obj;
  }

  // Applies MCA.suggestRatings to the comparables (all, or one id). 'loc' and factors with a note stay manual.
  function applySuggestions(state, compId) {
    let changed = 0;
    (state.comparables || []).forEach((c) => {
      if (compId && c.id !== compId) return;
      const sug = MCA().suggestRatings(state.subject || {}, c, state.settings || {});
      c.ratings = c.ratings || {};
      const notes = c.ratingNotes || {};
      Object.keys(sug).forEach((f) => {
        if (f === 'loc') return;
        if (notes[f] && String(notes[f]).trim()) return;
        if ((c.ratings[f] || 0) !== sug[f]) { c.ratings[f] = sug[f]; changed++; }
      });
    });
    return changed;
  }

  const BLANK_SUBJECT = {
    propertyType: { code: '', description: '' },
    address: '', floorDoor: '', postalCode: '', municipality: '', province: '', region: '', zone: '', lat: null, lon: null,
    cadastralRef: '', cadastralRefAlt: '', cadastralParcel: '', cadastralAddress: '', cadastralUse: 'Residencial', cadastralYear: null,
    cadastralPrivate: null, cadastralCommon: null, cadastralShare: null, type: 'Piso', floor: null, yearBuilt: null, condition: 'buen_estado',
    orientation: '', exterior: true, elevator: false, intercom: false, ac: false, heating: false, gas: '', electricity: '', pool: false,
    garden: false, parking: false, storage: false, terraceM2: 0, galleryM2: 0, bedrooms: null, bathrooms: null, energyCert: '',
    energyKwh: null, communityFee: null, neighbours: null, rooms: [], areaBuilt: null, areaBuiltCommon: null, pois: [], notes: '',
  };
  const BLANK_COMP = {
    id: '', include: true, excludeReason: '', address: '', zone: '', municipality: '', lat: null, lon: null, approxLocation: true,
    source: 'portal', sourceName: '', url: '', date: '', price: null, areaBuilt: null, areaUseful: null, floor: null, elevator: false,
    bedrooms: null, bathrooms: null, yearBuilt: null, condition: 'buen_estado', orientation: '', terraceM2: 0, gardenM2: 0,
    parking: false, storage: false, ac: false, heating: false, pool: false, garden: false, energyCert: '', energyKwh: null,
    communityFee: null, newBuild: false, negotiation: null, description: '', ratings: {}, ratingNotes: {},
  };

  function factorIds(state) {
    const f = state && Array.isArray(state.factors) && state.factors.length ? state.factors : MCA().FACTORS;
    return f.map((x) => x.id);
  }

  // Only http(s) links are kept (a "javascript:" URL in an imported project must never become a clickable link).
  const safeUrl = (u) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : '');
  // Only raster images encoded as plain base64 (no SVG: it can carry scripts).
  // ---------- technical data (energy certificate, seismic safety, installations) and attached documents ----------
  const ENERGY_CLASSES = ['A4', 'A3', 'A2', 'A1', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const SEISMIC_CLASSES = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const STRUCTURES = ['masonry', 'rc', 'steel', 'wood', 'mixed', 'prefab'];
  const SYSTEMS = ['heating', 'cooling', 'electrical', 'gas'];
  const SYSTEM_STATUS = ['dico', 'diri', 'none', 'na'];
  const ATT_KINDS = ['ape', 'dico', 'diri', 'static', 'seismic', 'report', 'test', 'plan', 'deed', 'other'];
  const ATT_MIME = /^data:(application\/pdf|image\/jpeg|image\/png|image\/webp);base64,[A-Za-z0-9+/=]+$/;
  const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const pick = (v, list) => (list.includes(v) ? v : '');
  function normalizeTechnical(t) {
    t = t && typeof t === 'object' && !Array.isArray(t) ? t : {};
    const e = t.energy && typeof t.energy === 'object' ? t.energy : {};
    const z = t.seismic && typeof t.seismic === 'object' ? t.seismic : {};
    const sy = t.systems && typeof t.systems === 'object' ? t.systems : {};
    const systems = {};
    SYSTEMS.forEach((k) => {
      const x = sy[k] && typeof sy[k] === 'object' ? sy[k] : null;
      if (x) systems[k] = { status: pick(x.status, SYSTEM_STATUS), date: isoDate(x.date), by: str(x.by, 120), notes: str(x.notes, 400) };
    });
    return {
      energy: { class: pick(e.class, ENERGY_CLASSES), ep: parseNum(e.ep), issued: isoDate(e.issued), validUntil: isoDate(e.validUntil), code: str(e.code, 60), certifier: str(e.certifier, 120) },
      seismic: { zone: pick(String(z.zone == null ? '' : z.zone), ['1', '2', '3', '4']), riskClass: pick(z.riskClass, SEISMIC_CLASSES), structure: pick(z.structure, STRUCTURES),
        year: Number.isInteger(+z.year) && +z.year > 1000 && +z.year < 2200 ? +z.year : null, works: str(z.works, 400), notes: str(z.notes, 600) },
      systems,
      deductions: (Array.isArray(t.deductions) ? t.deductions : []).map((d) => ({ label: str(d && d.label, 160).trim(), amount: parseNum(d && d.amount) }))
        .filter((d) => d.label && d.amount != null && d.amount > 0).slice(0, 20),
    };
  }
  // Documents attached to the checks: PDF or images only, base64, with their details; anything else is dropped.
  function normalizeAttachments(list) {
    return (Array.isArray(list) ? list : []).filter((a) => a && typeof a === 'object' && ATT_MIME.test(String(a.dataUrl || ''))).slice(0, 60).map((a, i) => ({
      id: str(a.id || 'att' + (i + 1), 40).replace(/[^\w-]/g, '') || 'att' + (i + 1), topic: /^[a-z_]{2,40}$/.test(String(a.topic || '')) ? a.topic : '',
      kind: pick(a.kind, ATT_KINDS) || 'other', title: str(a.title || a.name, 160), name: str(a.name, 160), mime: String(a.dataUrl).slice(5, String(a.dataUrl).indexOf(';')),
      size: Number.isFinite(+a.size) ? +a.size : 0, issuer: str(a.issuer, 120), date: isoDate(a.date), ref: str(a.ref, 80), include: a.include !== false,
      sha256: /^[0-9a-f]{64}$/.test(String(a.sha256 || '')) ? a.sha256 : '', dataUrl: a.dataUrl,
    }));
  }
  // The detailed class of the certificate (A4…G, A+…H) feeds the energy factor, which works on A…G.
  function syncTechnical(state) {
    const c = state && state.technical && state.technical.energy && state.technical.energy.class;
    if (!c || !state.subject) return state;
    state.subject.energyCert = /^A/.test(c) ? 'A' : c === 'H' ? 'G' : c;
    return state;
  }

  const REPORT_LANGS = ['en', 'es', 'it', 'fr', 'de', 'pt', 'nl', 'pl', 'cs', 'hu', 'ro', 'hr', 'da', 'sv', 'nb', 'zh', 'ru'];
  const isSafeImage = (d) => typeof d === 'string' && /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(d);
  // Logos are only ever rendered through <img>, where SVG scripts never run: raster or SVG, base64 only.
  const isSafeLogo = (d) => typeof d === 'string' && /^data:image\/(jpeg|jpg|png|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(d);

  function normalizeComp(c, state) {
    const out = Object.assign(clone(BLANK_COMP), c || {});
    out.url = safeUrl(out.url);
    out.ratings = Object.assign({}, out.ratings || {});
    factorIds(state).forEach((id) => { if (typeof out.ratings[id] !== 'number') out.ratings[id] = 0; });
    out.ratingNotes = Object.assign({}, out.ratingNotes || {});
    out.include = out.include !== false;
    out.id = String(out.id || '');
    return out;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  const CHECK_STATUSES = ['verified', 'not_verified', 'to_investigate', 'not_applicable'];
  // Other approaches (income, cost, residual), their reconciliation weights and the valuer's reasoning, kept on load:
  // only the known fields, numbers as numbers (on: true / false); the reasoning is a text or a text per language.
  const APPROACH_FIELDS = {
    income: ['rentMonthly', 'vacancy', 'opex', 'capRate'],
    cost: ['landValue', 'unitCost', 'area', 'fees', 'profit', 'depreciation'],
    residual: ['sellArea', 'unitPrice', 'buildCost', 'fees', 'finance', 'profit', 'saleCosts'],
  };
  function normalizeApproaches(a) {
    const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    if (!isObj(a)) return null;
    const numOrNull = (v) => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : null);
    const out = {};
    Object.keys(APPROACH_FIELDS).forEach((k) => {
      if (!isObj(a[k])) return;
      const o = { on: a[k].on === true };
      APPROACH_FIELDS[k].forEach((f) => { if (Object.prototype.hasOwnProperty.call(a[k], f)) o[f] = numOrNull(a[k][f]); });
      out[k] = o;
    });
    if (isObj(a.weights)) {
      out.weights = {};
      ['market', 'income', 'cost', 'residual'].forEach((k) => { const v = numOrNull(a.weights[k]); if (v != null) out.weights[k] = v; });
    }
    if (typeof a.reason === 'string') out.reason = a.reason;
    else if (isObj(a.reason)) {
      out.reason = {};
      Object.keys(a.reason).forEach((k) => { if (/^[a-z_]{1,3}$/.test(k) && typeof a.reason[k] === 'string') out.reason[k] = a.reason[k]; });
    }
    return out;
  }

  function validateState(obj, defaults) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['File non valido: non contiene un progetto di valutazione.'] };
    if (!obj.subject || typeof obj.subject !== 'object' || !Array.isArray(obj.comparables)) {
      return { ok: false, errors: ['Struttura non riconosciuta: mancano i dati dell’immobile o dei comparabili.'] };
    }
    const d = defaults ? clone(defaults) : {};
    const st = {};
    st.version = 2;
    // Projects saved before the trilingual version (no version field) were Spanish; newer ones default to English.
    const legacyLang = !(Number(obj.version) >= 2);
    st.meta = Object.assign({ reportLang: legacyLang ? 'es' : 'en', reportNo: '', internalRef: '', visitDate: '', valuationDate: today(), reportDate: today(), purpose: '',
      client: { name: '', role: '' }, advisor: { name: '', role: '' }, office: { name: '', web: '' },
      validityMonths: 6 }, obj.meta || {});
    if (!REPORT_LANGS.includes(st.meta.reportLang)) st.meta.reportLang = legacyLang ? 'es' : 'en';
    // Projects saved before the new interface were Spanish residential valuations for a sale.
    if (!/^[A-Z]{2}$/.test(String(st.meta.country || ''))) st.meta.country = 'ES';
    if (!/^[a-z_]{2,40}$/.test(String(st.meta.purposeCode || ''))) st.meta.purposeCode = 'sale';
    st.meta = Object.assign({}, st.meta);
    ensureId(st);
    const db = d.brand || { name: 'Valesta', logoMode: 'text', primary: '#0E5A4E', accent: '#1A8A47', showBand: true, tagline: '' };
    st.brand = Object.assign({}, db, obj.brand || {});
    // Valorem 1.1, the app before Valesta, named the neutral profile "Valorem": projects using it switch to the Valesta one.
    if (st.brand.profileId === 'valorem') {
      st.brand.profileId = 'valesta';
      if (st.brand.name === 'Valorem') st.brand.name = 'Valesta';
      if (st.meta.office && st.meta.office.name === 'Valorem') st.meta.office = Object.assign({}, st.meta.office, { name: 'Valesta' });
    }
    if (st.brand.logoMode === 'builtin') st.brand = Profiles() ? Profiles().legacyBrand(st.brand) : Object.assign(st.brand, { logoMode: 'text' });
    ['logoLight', 'logoDark'].forEach((k) => { if (!isSafeLogo(st.brand[k])) st.brand[k] = null; });
    if (!['custom', 'text'].includes(st.brand.logoMode)) st.brand.logoMode = 'text';
    st.meta.advisor = Object.assign({ name: '', role: '' }, st.meta.advisor || {});
    if (!isSafeImage(st.meta.advisor.signature)) st.meta.advisor.signature = null;
    const dd = d.design || {};
    const od = obj.design && typeof obj.design === 'object' && !Array.isArray(obj.design) ? obj.design : {};
    st.design = Object.assign({}, clone(dd), od);
    if (st.design.coverImage != null && !isSafeImage(st.design.coverImage)) st.design.coverImage = null;
    st.design.sections = Object.assign({}, dd.sections || {}, od.sections && typeof od.sections === 'object' ? od.sections : {}, { result: true });
    // Cover texts are kept per report language (each language has its own automatic text). Older saves hold a plain
    // string, or a language-neutral "_": both were typed in the report language of the case.
    if (st.design.cover && typeof st.design.cover === 'object') {
      const rl = REPORT_LANGS.includes(obj.meta && obj.meta.reportLang) ? obj.meta.reportLang : 'es';
      const cv = st.design.cover = Object.assign({}, st.design.cover);
      ['kicker', 'title', 'titleEm', 'standards', 'foot'].forEach((k) => {
        const v = cv[k];
        if (typeof v === 'string') { if (v.trim()) cv[k] = { [rl]: v }; }
        else if (v && typeof v === 'object' && !Array.isArray(v) && v._ != null) {
          const o = Object.assign({}, v);
          if (o[rl] == null && String(o._).trim()) o[rl] = o._;
          delete o._;
          cv[k] = o;
        }
      });
    }
    st.customSections = Array.isArray(obj.customSections) ? obj.customSections
      .filter((c) => c && typeof c === 'object' && !Array.isArray(c))
      .map((c, i) => ({ id: String(c.id || 'cs' + (i + 1)).replace(/[^\w-]/g, '') || 'cs' + (i + 1), enabled: c.enabled !== false, after: String(c.after || 'end'),
        title: c.title || '', kicker: c.kicker || '', body: c.body || '' })) : [];
    st.subject = Object.assign(clone(BLANK_SUBJECT), obj.subject);
    const pt = obj.subject.propertyType;
    st.subject.propertyType = pt && typeof pt === 'object' && typeof pt.code === 'string'
      ? { code: pt.code.slice(0, 60), description: String(pt.description || '').slice(0, 500) }
      : { code: 'RES.APARTMENT', description: '' };
    st.settings = Object.assign({}, d.settings || {}, obj.settings || {});
    st.settings.annex = Object.assign({}, (d.settings || {}).annex || {}, (obj.settings || {}).annex || {});
    st.settings.sourceWeights = Object.assign({}, (d.settings || {}).sourceWeights || {}, (obj.settings || {}).sourceWeights || {});
    st.factors = Array.isArray(obj.factors) && obj.factors.length ? obj.factors : d.factors || clone(MCA().FACTORS);
    st.market = obj.market && typeof obj.market === 'object' ? obj.market : d.market || {};
    const caption = (c) => (c && typeof c === 'object' && !Array.isArray(c) ? c : String(c || ''));
    st.photos = Array.isArray(obj.photos) ? obj.photos.filter((p) => p && isSafeImage(p.dataUrl)).map((p) => ({ id: String(p.id || ''), dataUrl: p.dataUrl, caption: caption(p.caption), cover: !!p.cover })) : [];
    st.texts = obj.texts && typeof obj.texts === 'object' ? obj.texts : {};
    st.comparables = obj.comparables.map((c) => normalizeComp(c, st));
    // Coordinates must be on the globe; anything else (text, huge numbers) becomes "no position".
    const toNum = (v) => (typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : v);
    const fixLL = (o) => {
      if (!o || typeof o !== 'object') return;
      const la = toNum(o.lat), lo = toNum(o.lon);
      o.lat = typeof la === 'number' && isFinite(la) && Math.abs(la) <= 90 ? la : null;
      o.lon = typeof lo === 'number' && isFinite(lo) && Math.abs(lo) <= 180 ? lo : null;
    };
    fixLL(st.subject);
    if (Array.isArray(st.subject.pois)) st.subject.pois.forEach(fixLL);
    st.comparables.forEach(fixLL);
    // Document checks (topic and status codes of the standard); the last record of a topic wins.
    const seen = {};
    (Array.isArray(obj.checks) ? obj.checks : []).forEach((c) => {
      if (!c || typeof c !== 'object' || !/^[a-z_]{2,40}$/.test(String(c.topic || '')) || !CHECK_STATUSES.includes(c.status)) return;
      seen[c.topic] = { topic: c.topic, status: c.status, source: String(c.source || '').slice(0, 200), date: /^\d{4}-\d{2}-\d{2}$/.test(String(c.date || '')) ? c.date : '', note: String(c.note || '').slice(0, 500) };
    });
    st.checks = Object.keys(seen).map((k) => seen[k]);
    // AI log (AIReview): proposals of the assistant with their changes and the decision taken.
    const AI_ST = ['open', 'accepted', 'rejected'];
    const CH_ST = ['open', 'accepted', 'rejected', 'edited', 'kept'];
    const CH_KIND = ['value', 'comp-add', 'comp-remove', 'comp-replace'];
    st.aiLog = (Array.isArray(obj.aiLog) ? obj.aiLog : []).filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && AI_ST.includes(e.status)).slice(-200).map((e) => {
      const o = { id: e.id.slice(0, 40), at: String(e.at || ''), status: e.status, request: String(e.request || '').slice(0, 400), summary: String(e.summary || '').slice(0, 600),
        provider: String(e.provider || '').slice(0, 60), model: String(e.model || '').slice(0, 80),
        sources: (Array.isArray(e.sources) ? e.sources : []).filter((x) => x && typeof x.url === 'string' && /^https?:\/\//i.test(x.url)).slice(0, 8).map((x) => ({ title: String(x.title || '').slice(0, 160), url: x.url.slice(0, 500) })),
        changes: (Array.isArray(e.changes) ? e.changes : []).filter((c) => c && typeof c.path === 'string' && c.path.length < 120 && !/__proto__|prototype|constructor/.test(c.path)).slice(0, 300).map((c) => {
          const x = { path: c.path, kind: CH_KIND.includes(c.kind) ? c.kind : 'value', state: CH_ST.includes(c.state) ? c.state : 'open' };
          if (c.id != null) x.id = String(c.id).slice(0, 40);
          if (Number.isInteger(c.index)) x.index = c.index;
          if (c.big) x.big = true;
          if ('before' in c) x.before = c.before;
          if ('after' in c) x.after = c.after;
          return x;
        }) };
      if (e.decidedAt) o.decidedAt = String(e.decidedAt);
      return o;
    });
    st.technical = normalizeTechnical(obj.technical);
    st.attachments = normalizeAttachments(obj.attachments);
    const ap = normalizeApproaches(obj.approaches);
    if (ap) st.approaches = ap;
    return { ok: true, errors: [], state: st };
  }

  function blankState(defaults, current) {
    const d = clone(defaults);
    const cur = current ? clone(current) : d;
    const t = today();
    // The demo's advisor is fictional: a new valuation starts without a name rather than signing as the sample person.
    const curAdv = cur.meta && cur.meta.advisor;
    const demoAdv = !curAdv || (d.meta.advisor && curAdv.name === d.meta.advisor.name);
    const advisor = demoAdv ? { name: '', role: clone(d.meta.advisor.role), signature: null } : curAdv;
    return {
      version: 2,
      brand: cur.brand || d.brand,
      design: cur.design || d.design,
      customSections: cur.customSections || [],
      meta: { reportLang: (cur.meta && cur.meta.reportLang) || 'es', country: (cur.meta && cur.meta.country) || 'ES', purposeCode: 'sale', reportNo: '', internalRef: '', visitDate: t, valuationDate: t, reportDate: t, purpose: d.meta.purpose,
        client: { name: '', role: d.meta.client.role }, advisor, office: cur.meta.office, validityMonths: d.meta.validityMonths },
      subject: clone(BLANK_SUBJECT),
      // Market inputs belong to one market: a new valuation starts without a time trend or annex values, to be confirmed.
      settings: Object.assign({}, cur.settings || d.settings, { timeTrendAnnual: 0, annex: { parking: null, storage: null }, marketConfirmed: false, negotiationReason: '' }),
      factors: cur.factors || d.factors,
      comparables: [],
      market: cur.market || d.market,
      checks: [],
      aiLog: [],
      photos: [],
      texts: {},
    };
  }

  // Rounding step of the value by country: currencies with a small unit (forint, koruna, kroner, kronor) round to a
  // larger step; the others to 1,000.
  const ROUNDING = { HU: 100000, CZ: 10000, DK: 10000, NO: 10000, SE: 10000 };
  const roundingFor = (cc) => ROUNDING[cc] || 1000;

  // Language of the interface: the one the user chose, else the first of the browser's languages (navigator.languages,
  // e.g. ['de-DE', 'it']) that the interface has, else English. The interface has the 17 languages of the report.
  const I18 = () => G.I18N || (typeof require === 'function' ? (G.I18N = require('./i18n.js')) : null);
  function uiLangFor(chosen, browserLangs) {
    const UI_LANGS = (I18() && I18().LANGS) || ['it', 'en', 'es'];
    if (UI_LANGS.includes(chosen)) return chosen;
    for (const tag of Array.isArray(browserLangs) ? browserLangs : []) {
      const l = String(tag || '').toLowerCase().split(/[-_]/)[0];
      if (UI_LANGS.includes(l)) return l;
    }
    return 'en';
  }

  // The languages in alphabetical order of their own names, as the pickers show them (Čeština, Dansk, Deutsch,
  // English…), with the collation of the app's language: a Russian one puts Русский first.
  function langsByName(uiLang, langs) {
    const i18n = I18() || {};
    const names = i18n.LANG_NAMES || {};
    const name = (l) => names[l] || String(l);
    let coll;
    try { coll = new Intl.Collator((i18n.LOCALE && i18n.LOCALE[uiLang]) || uiLang || undefined, { sensitivity: 'base' }); } catch (e) { coll = new Intl.Collator('en', { sensitivity: 'base' }); }
    return (Array.isArray(langs) ? langs : i18n.LANGS || []).slice().sort((a, b) => coll.compare(name(a), name(b)) || (a < b ? -1 : a > b ? 1 : 0));
  }

  // New valuation from the start screen. choices: { country, purposeCode, reportLang, propertyType {code, description},
  // typeLabel {en, es, it}, address }. Market data are kept only for the same country.
  function newValuation(defaults, current, choices) {
    const c = choices || {};
    const st = blankState(defaults, current);
    const sameCountry = !c.country || c.country === ((current && current.meta && current.meta.country) || 'ES');
    if (c.country) {
      const r = +(st.settings && st.settings.rounding);
      const prevCC = (current && current.meta && current.meta.country) || 'ES';
      if (!r || r === roundingFor(prevCC)) st.settings = Object.assign({}, st.settings, { rounding: roundingFor(c.country) });   // a chosen step stays
      st.meta.country = c.country;
    }
    if (c.purposeCode) st.meta.purposeCode = c.purposeCode;
    if (REPORT_LANGS.includes(c.reportLang)) st.meta.reportLang = c.reportLang;
    if (c.propertyType && c.propertyType.code) st.subject.propertyType = { code: c.propertyType.code, description: c.propertyType.description || '' };
    if (c.typeLabel) st.subject.type = clone(c.typeLabel);
    if (c.address) st.subject.address = String(c.address);
    if (!sameCountry) st.market = { source: '', sourceUrl: '', month: '', cityAvg: null, mom: null, qoq: null, yoy: null, series: [], districts: [], references: [], zoneNote: '', commentary: '' };
    return st;
  }
  // Sets the property type and the type shown in the report; returns the previous report type (for undo or a notice).
  function setPropertyType(state, code, label) {
    const s = state.subject;
    const prev = clone(s.type);
    s.propertyType = Object.assign({ description: '' }, s.propertyType || {}, { code });
    if (label) s.type = clone(label);
    return prev;
  }

  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function fileName(state, ext) {
    const s = state.subject || {};
    const date = (state.meta && state.meta.valuationDate) || today();
    return `Valesta_${slug(s.address) || 'property'}_${date}.${ext || 'json'}`;
  }

  function loadLocal(storage, key) {
    try {
      const raw = storage && storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function saveLocal(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function newComparable(state) {
    const used = new Set((state.comparables || []).map((c) => c.id));
    let n = 1;
    while (used.has('T' + n)) n++;
    const c = normalizeComp({ id: 'T' + n, municipality: (state.subject && state.subject.municipality) || '', zone: (state.subject && state.subject.zone) || '',
      date: (state.meta && state.meta.valuationDate) || today() }, state);
    return c;
  }

  // ---------- archive id ----------
  function ensureId(state) {
    state.meta = state.meta || {};
    if (typeof state.meta.id !== 'string' || !/^v[a-z0-9]{8,}$/.test(state.meta.id)) {
      state.meta.id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
    return state.meta.id;
  }

  // ---------- agency profile: brand, agency, advisor, style, chapters and method defaults (no case data) ----------
  const PROFILE_SETTINGS = ['negotiationDefault', 'annex', 'estimator', 'ciLevel', 'rounding', 'listingMarginPct', 'sourceWeights', 'areaBasis',
    'builtToUseful', 'timeAdjust', 'timeTrendAnnual', 'trimPct', 'scalePreset', 'showListingPrice'];
  // Valorem 1.1 saved profiles with the kind "valorem-profile": they are still accepted.
  const PROFILE_KINDS = ['valesta-profile', 'valorem-profile'];
  const isProfile = (o) => !!(o && typeof o === 'object' && PROFILE_KINDS.includes(o.kind) && o.brand && typeof o.brand === 'object');
  // Fields of the design that belong to one valuation (report model, chapters, draft mark), not to the look of the agency.
  const REPORT_DESIGN = ['preset', 'sections', 'watermark', 'watermarkText'];
  function makeProfile(state) {
    const st = state.settings || {};
    const settings = {};
    PROFILE_SETTINGS.forEach((k) => { if (st[k] !== undefined) settings[k] = clone(st[k]); });
    const m = state.meta || {};
    return {
      kind: 'valesta-profile', version: 1, name: (state.brand && state.brand.name) || '', created: today(),
      brand: clone(state.brand || {}), office: clone(m.office || {}), advisor: clone(m.advisor || {}),
      design: clone(state.design || {}), customSections: clone(state.customSections || []), settings, factors: clone(state.factors || []),
    };
  }
  function applyProfile(state, profile) {
    if (!isProfile(profile)) return { ok: false, errors: ['not a profile'] };
    const out = clone(state);
    out.brand = Object.assign({}, out.brand || {}, profile.brand);
    ['logoLight', 'logoDark'].forEach((k) => { if (!isSafeLogo(out.brand[k])) out.brand[k] = null; });
    if (!['custom', 'text'].includes(out.brand.logoMode)) out.brand.logoMode = 'text';
    out.meta = out.meta || {};
    if (profile.office && typeof profile.office === 'object') out.meta.office = Object.assign({}, profile.office);
    if (profile.advisor && typeof profile.advisor === 'object') {
      out.meta.advisor = Object.assign({ name: '', role: '' }, profile.advisor);
      if (!isSafeImage(out.meta.advisor.signature)) out.meta.advisor.signature = null;
    }
    if (profile.design && typeof profile.design === 'object') {
      // The profile gives the whole look: a field it does not have goes back to its default, so the cover of the previous
      // look does not stay. The report choices of the valuation stay unless the profile has them.
      const cur = out.design || {};
      const keep = {};
      REPORT_DESIGN.forEach((k) => { if (cur[k] !== undefined) keep[k] = cur[k]; });
      out.design = Object.assign(keep, clone(profile.design), { sections: Object.assign({}, cur.sections || {}, profile.design.sections || {}) });
    }
    if (out.design && out.design.coverImage != null && !isSafeImage(out.design.coverImage)) out.design.coverImage = null;
    if (Array.isArray(profile.customSections)) out.customSections = profile.customSections.filter((c) => c && typeof c === 'object' && !Array.isArray(c));
    if (profile.settings && typeof profile.settings === 'object') {
      out.settings = Object.assign({}, out.settings || {});
      PROFILE_SETTINGS.forEach((k) => { if (profile.settings[k] !== undefined) out.settings[k] = clone(profile.settings[k]); });
    }
    if (Array.isArray(profile.factors) && profile.factors.length) out.factors = clone(profile.factors);
    return { ok: true, errors: [], state: out };
  }
  // Value without empty parts (null, '', empty groups) and with the keys in order, to compare two looks.
  function lean(v) {
    if (Array.isArray(v)) return v.map(lean);
    if (v === null || typeof v !== 'object') return v === '' ? undefined : v;
    const o = {};
    Object.keys(v).sort().forEach((k) => { const x = lean(v[k]); if (x !== undefined && x !== null) o[k] = x; });
    return Object.keys(o).length ? o : undefined;
  }
  // The part of a valuation that a profile saves and the style step shows: brand, agency, look and own chapters. Not the
  // valuation data, the advisor (Contents step) or the report choices: they change from one valuation to the next.
  function profileLook(state, read) {
    const s = state || {};
    const brand = Object.assign({}, s.brand || {});
    delete brand.profileId;
    const design = Object.assign({}, read ? read(s.design || {}) : s.design || {});
    REPORT_DESIGN.forEach((k) => { delete design[k]; });
    return JSON.stringify(lean({ brand, office: (s.meta || {}).office, design, customSections: s.customSections }) || {});
  }
  // True when the valuation looks different from the profile: applying the profile again would change something.
  // "read" (optional) gives the design as the report reads it (defaults, older font names), so equal looks compare equal.
  function profileChanged(state, profile, read) {
    if (!isProfile(profile) || !state) return false;
    const m = state.meta || {};
    const light = { brand: state.brand, meta: { office: m.office, advisor: m.advisor }, design: state.design, customSections: state.customSections };
    const r = applyProfile(light, profile);
    return !!r.ok && profileLook(light, read) !== profileLook(r.state, read);
  }

  return { parseNum, getPath, setPath, roundingFor, uiLangFor, langsByName, applySuggestions, validateState, blankState, newValuation, setPropertyType, fileName, slug, loadLocal, saveLocal, newComparable, normalizeComp, safeUrl, isSafeImage, isSafeLogo, BLANK_SUBJECT, clone,
    ensureId, makeProfile, applyProfile, isProfile, profileChanged, normalizeTechnical, normalizeAttachments, syncTechnical, ENERGY_CLASSES, SEISMIC_CLASSES, STRUCTURES, SYSTEMS, SYSTEM_STATUS, ATT_KINDS };
});
