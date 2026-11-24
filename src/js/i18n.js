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
/* I18N — formatting and the 17 languages: numbers, currencies, dates, amounts in words, localised texts.
 * A localised text is a string (the same in all languages) or an object {es, it, en, _}.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.I18N = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Report languages. Spanish, Italian and English have their own rules below; the others use Intl and NumWords.
  const LANGS = ['en', 'es', 'it', 'fr', 'de', 'pt', 'nl', 'pl', 'cs', 'hu', 'ro', 'hr', 'da', 'sv', 'nb', 'zh', 'ru'];
  const LANG_NAMES = { it: 'Italiano', en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', nl: 'Nederlands', pl: 'Polski',
    cs: 'Čeština', hu: 'Magyar', ro: 'Română', hr: 'Hrvatski', da: 'Dansk', sv: 'Svenska', nb: 'Norsk (bokmål)', zh: '中文', ru: 'Русский' };
  const LOCALE = { en: 'en-GB', es: 'es-ES', it: 'it-IT', fr: 'fr-FR', de: 'de-DE', pt: 'pt-PT', nl: 'nl-NL', pl: 'pl-PL', cs: 'cs-CZ', hu: 'hu-HU',
    ro: 'ro-RO', hr: 'hr-HR', da: 'da-DK', sv: 'sv-SE', nb: 'nb-NO', zh: 'zh-CN', ru: 'ru-RU' };
  const norm = (l) => (LANGS.includes(l) ? l : 'en');
  const OWN = ['en', 'es', 'it'];
  // Report languages whose wording is a draft still to be reviewed by native speakers (flagged in the app).
  const DRAFT = LANGS.filter((l) => !OWN.includes(l));
  const G = typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : {};
  const NW = () => G.NumWords || (typeof require === 'function' ? (G.NumWords = require('./numwords.js')) : null);

  // ---------- localized values ----------
  function loc(v, lang) {
    if (v == null) return '';
    if (typeof v === 'object' && !Array.isArray(v)) {
      const l = norm(lang);
      const pick = [v[l], v._, v.en, v.es, v.it].find((x) => x != null && String(x) !== '');
      return pick == null ? '' : String(pick);
    }
    return String(v);
  }
  function setLoc(obj, path, lang, value) {
    const keys = String(path).split('.');
    if (keys.some((k) => /^(__proto__|constructor|prototype)$/.test(k))) return obj;   // never the prototype of all objects
    let o = obj;
    keys.slice(0, -1).forEach((k, i) => {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[k];
    });
    const k = keys[keys.length - 1];
    const cur = o[k];
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) cur[norm(lang)] = value;
    else if (cur == null || cur === '' || cur === value) o[k] = value;
    else o[k] = { _: cur, [norm(lang)]: value };
    return obj;
  }

  // ---------- numbers ----------
  const SEP = { es: ['.', ','], it: ['.', ','], en: [',', '.'] };
  const nf = {};
  function fmt(v, d, lang) {
    if (v == null || !isFinite(v)) return '—';
    const l = norm(lang);
    if (!OWN.includes(l)) {
      const key = l + (d || 0);
      if (!nf[key]) nf[key] = new Intl.NumberFormat(LOCALE[l], { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0, useGrouping: true });
      return nf[key].format(v).replace(/^-/, '−');
    }
    const [th, dec] = SEP[l];
    const neg = v < 0;
    const parts = Math.abs(v).toFixed(d || 0).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, th);
    return (neg ? '−' : '') + parts.join(dec);
  }
  // ---------- currency of the valuation (ISO 4217): amounts in the app and the report follow it ----------
  const SYMBOL = { EUR: '€', GBP: '£' };
  let CUR = 'EUR';
  function setCurrency(c) { CUR = /^[A-Z]{3}$/.test(String(c || '')) ? String(c) : 'EUR'; return CUR; }
  const currency = () => CUR;
  const sym = (c) => SYMBOL[c || CUR] || (c || CUR);
  // English: symbol before the amount (€518,000; CHF 1,250,000); Spanish and Italian: after it (518.000 €).
  const pre = () => (SYMBOL[CUR] ? sym() : sym() + ' ');
  // ¤ in UI and report texts stands for the currency of the valuation: "¤/m²" → "CHF/m²", "¤80" → "€80" or "CHF 80".
  const withCurrency = (x) => String(x).replace(/¤(?=\d)/g, () => pre()).replace(/¤/g, () => sym());
  // The symbol goes before the amount in English, Dutch and Chinese; after it in the other languages.
  const BEFORE = ['en', 'nl', 'zh'];
  function money(v, lang, d) {
    if (v == null || !isFinite(v)) return '—';
    const l = norm(lang);
    return BEFORE.includes(l) ? (v < 0 ? '−' + pre() + fmt(-v, d, l) : pre() + fmt(v, d, l)) : fmt(v, d, l) + ' ' + sym();
  }
  function perM2(v, lang, d) {
    if (v == null || !isFinite(v)) return '—';
    const l = norm(lang);
    return BEFORE.includes(l) ? `${pre()}${fmt(v, d, l)}/m²` : `${fmt(v, d, l)} ${sym()}/m²`;
  }
  function pct(v, d, lang, signed) {
    if (v == null || !isFinite(v)) return '—';
    return (signed && v > 0 ? '+' : '') + fmt(v * 100, d == null ? 1 : d, lang) + '%';
  }

  // ---------- dates ----------
  const MONTHS = {
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  };
  const MONTHS_S = {
    es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  };
  const intlDate = (y, mo, d, l, opt) => new Intl.DateTimeFormat(LOCALE[l], Object.assign({ timeZone: 'UTC' }, opt)).format(new Date(Date.UTC(y, mo, d)));
  function dateLong(iso, lang) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return '—';
    const l = norm(lang);
    if (!OWN.includes(l)) return intlDate(+m[1], +m[2] - 1, +m[3], l, { day: 'numeric', month: 'long', year: 'numeric' });
    const d = +m[3];
    const mo = MONTHS[l][+m[2] - 1];
    if (l === 'es') return `${d} de ${mo} de ${m[1]}`;
    return `${d} ${mo} ${m[1]}`;
  }
  const monthShort = (i, lang) => { const l = norm(lang); return OWN.includes(l) ? MONTHS_S[l][i] : intlDate(2026, i, 15, l, { month: 'short' }).replace(/\.$/, ''); };
  const monthLong = (i, lang) => { const l = norm(lang); return OWN.includes(l) ? MONTHS[l][i] : intlDate(2026, i, 15, l, { month: 'long' }); };

  // ---------- number to words ----------
  // Spanish
  const ES_U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce',
    'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro',
    'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const ES_T = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const ES_C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const es99 = (n) => (n < 30 ? ES_U[n] : ES_T[Math.floor(n / 10)] + (n % 10 ? ' y ' + ES_U[n % 10] : ''));
  const es999 = (n) => (n === 100 ? 'cien' : [ES_C[Math.floor(n / 100)], n % 100 ? es99(n % 100) : ''].filter(Boolean).join(' '));
  const esApo = (s) => s.replace(/veintiuno$/, 'veintiún').replace(/(^|\s)uno$/, '$1un');
  // Feminine currencies (libras, coronas): doscientas, una, veintiuna — millions stay masculine (millones).
  const esFem = (s) => s.replace(/ientos\b/g, 'ientas').replace(/veintiuno$/, 'veintiuna').replace(/(^|\s)uno$/, '$1una');
  // Millions up to 999 999 millions: "un millón", "veintiún millones", "mil doscientos treinta y cuatro millones"
  // (Spanish says "mil millones" for a thousand million; "billón" is a million million).
  function esMillions(m) {
    if (m === 1) return 'un millón';
    const k = Math.floor(m / 1000), r = m % 1000;
    return [k ? (k === 1 ? 'mil' : esApo(es999(k)) + ' mil') : '', r ? esApo(es999(r)) : ''].filter(Boolean).join(' ') + ' millones';
  }
  function esWords(n, fem) {
    const mil = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), r = n % 1000;
    const p = [];
    if (mil) p.push(esMillions(mil));
    if (th) p.push(th === 1 ? 'mil' : (fem ? esFem(es999(th)) : esApo(es999(th))) + ' mil');
    if (r) p.push(fem ? esFem(es999(r)) : es999(r));
    return p.join(' ');
  }
  // Italian
  const IT_U = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici',
    'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
  const IT_T = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];
  function it99(n) {
    if (n < 20) return IT_U[n];
    const u = n % 10;
    let w = IT_T[Math.floor(n / 10)];
    if (u === 1 || u === 8) w = w.slice(0, -1);
    return w + IT_U[u];
  }
  function it999(n) {
    const h = Math.floor(n / 100), r = n % 100;
    let w = h ? (h === 1 ? 'cento' : IT_U[h] + 'cento') : '';
    if (r) {
      if (h && (r === 8 || (r >= 80 && r <= 89))) w = w.slice(0, -1);
      w += it99(r);
    }
    return w;
  }
  function itWords(n) {
    const bil = Math.floor(n / 1e9), mil = Math.floor((n % 1e9) / 1e6), th = Math.floor((n % 1e6) / 1000), r = n % 1000;
    const p = [];
    if (bil) p.push(bil === 1 ? 'un miliardo' : it999(bil) + ' miliardi');
    if (mil) p.push(mil === 1 ? 'un milione' : it999(mil) + ' milioni');
    let low = '';
    if (th) low += th === 1 ? 'mille' : it999(th) + 'mila';
    if (r) low += it999(r);
    if (low) p.push(low);
    let s = p.join(' ');
    if (n > 3 && /tre$/.test(s)) s = s.replace(/tre$/, 'tré');
    return s;
  }
  // English (UK style)
  const EN_U = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
    'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const EN_T = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const en99 = (n) => (n < 20 ? EN_U[n] : EN_T[Math.floor(n / 10)] + (n % 10 ? '-' + EN_U[n % 10] : ''));
  function en999(n, andIfSmall) {
    const h = Math.floor(n / 100), r = n % 100;
    const p = [];
    if (h) p.push(EN_U[h] + ' hundred');
    if (r) p.push((h || andIfSmall ? 'and ' : '') + en99(r));
    return p.join(' ');
  }
  function enWords(n) {
    const bil = Math.floor(n / 1e9), mil = Math.floor((n % 1e9) / 1e6), th = Math.floor((n % 1e6) / 1000), r = n % 1000;
    const p = [];
    if (bil) p.push(en999(bil) + ' billion');
    if (mil) p.push(en999(mil) + ' million');
    if (th) p.push(en999(th) + ' thousand');
    if (r) p.push(en999(r, (bil || mil || th) && r < 100));
    return p.join(' ');
  }
  // Words up to 999 999 999 999; larger amounts are written in grouped digits (1.500.000.000.000).
  const WORD_MAX = 999999999999;
  function numberToWords(n, lang) {
    n = Math.round(Math.abs(n || 0));
    const l = norm(lang);
    if (!OWN.includes(l)) return (NW() && NW().words(n, l)) || String(n);
    if (n === 0) return { es: 'cero', it: 'zero', en: 'zero' }[l];
    if (!(n <= WORD_MAX)) return fmt(n, 0, l);
    return l === 'it' ? itWords(n) : l === 'en' ? enWords(n) : esWords(n);
  }
  // [singular, plural, feminine in Spanish]
  const CUR_WORDS = {
    EUR: { es: ['euro', 'euros'], it: ['euro', 'euro'], en: ['euro', 'euros'] },
    GBP: { es: ['libra esterlina', 'libras esterlinas', 1], it: ['sterlina', 'sterline'], en: ['pound sterling', 'pounds sterling'] },
    CHF: { es: ['franco suizo', 'francos suizos'], it: ['franco svizzero', 'franchi svizzeri'], en: ['Swiss franc', 'Swiss francs'] },
    PLN: { es: ['esloti', 'eslotis'], it: ['złoty', 'złoty'], en: ['złoty', 'złoty'] },
    CZK: { es: ['corona checa', 'coronas checas', 1], it: ['corona ceca', 'corone ceche'], en: ['Czech koruna', 'Czech korunas'] },
    HUF: { es: ['forinto', 'forintos'], it: ['fiorino ungherese', 'fiorini ungheresi'], en: ['forint', 'forints'] },
    RON: { es: ['leu rumano', 'lei rumanos'], it: ['leu romeno', 'lei romeni'], en: ['Romanian leu', 'Romanian lei'] },
    DKK: { es: ['corona danesa', 'coronas danesas', 1], it: ['corona danese', 'corone danesi'], en: ['Danish krone', 'Danish kroner'] },
    NOK: { es: ['corona noruega', 'coronas noruegas', 1], it: ['corona norvegese', 'corone norvegesi'], en: ['Norwegian krone', 'Norwegian kroner'] },
    SEK: { es: ['corona sueca', 'coronas suecas', 1], it: ['corona svedese', 'corone svedesi'], en: ['Swedish krona', 'Swedish kronor'] },
  };
  // Plural name of the currency of the valuation: "Swiss francs", "franchi svizzeri", "euros" (the code when unknown).
  function currencyName(lang) {
    const l = norm(lang);
    if (!OWN.includes(l)) return (NW() && NW().currencyName(l, CUR)) || CUR;
    const w = CUR_WORDS[CUR];
    return w ? w[l][1] : CUR;
  }
  function currencyWords(n, lang) {
    const l = norm(lang);
    if (!OWN.includes(l)) return (NW() && NW().currencyWords(n, l, CUR)) || `${n} ${CUR}`;
    const w = (CUR_WORDS[CUR] || { es: [CUR, CUR], it: [CUR, CUR], en: [CUR, CUR] })[l];
    const v = Math.round(Math.abs(n || 0));
    const words = l === 'es' && v && v <= WORD_MAX ? esWords(v, !!w[2]) : numberToWords(v, l);
    const exactMillions = v >= 1e6 && v % 1e6 === 0;
    return words + (exactMillions && l === 'es' ? ' de ' : exactMillions && l === 'it' ? ' di ' : ' ') + (v === 1 ? w[0] : w[1]);
  }

  return { LANGS, DRAFT, LANG_NAMES, LOCALE, norm, loc, setLoc, fmt, money, perM2, pct, dateLong, monthShort, monthLong, numberToWords, currencyWords, setCurrency, currency, sym, withCurrency, currencyName };
});
