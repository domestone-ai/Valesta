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
/* NumWords — amounts in words for the report languages beyond Spanish, Italian and English (those stay in I18N):
 * French, German, Portuguese, Dutch, Polish, Czech, Hungarian, Romanian, Croatian, Danish, Swedish, Norwegian bokmål,
 * Chinese and Russian, integers up to 999 999 999, with the currency names in the right grammatical form.
 * Draft wording, to be reviewed by native speakers. No DOM. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.NumWords = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const groups = (n) => [Math.floor(n / 1e6), Math.floor((n % 1e6) / 1000), n % 1000];
  // Slavic plural: one (1, 21…), few (2–4, 22–24…), many (0, 5–20, 25–30…)
  const slav = (n) => (n % 100 >= 11 && n % 100 <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2);

  // ---------- French ----------
  const FR_U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const FR_T = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
  function fr99(n, final) {
    if (n < 20) return FR_U[n];
    const t = Math.floor(n / 10), u = n % 10;
    if (t === 7) return u === 1 ? 'soixante et onze' : 'soixante-' + FR_U[10 + u];
    if (t === 9) return 'quatre-vingt-' + FR_U[10 + u];
    if (t === 8) return u ? 'quatre-vingt-' + FR_U[u] : final ? 'quatre-vingts' : 'quatre-vingt';
    return FR_T[t] + (u === 1 ? ' et un' : u ? '-' + FR_U[u] : '');
  }
  function fr999(n, final) {
    const h = Math.floor(n / 100), r = n % 100;
    if (!h) return fr99(r, final);
    const head = h === 1 ? 'cent' : FR_U[h] + ' cent' + (!r && final ? 's' : '');
    return r ? head + ' ' + fr99(r, final) : head;
  }
  function fr(n) {
    const [m, k, r] = groups(n);
    const p = [];
    if (m) p.push(m === 1 ? 'un million' : fr999(m, true) + ' millions');
    if (k) p.push(k === 1 ? 'mille' : fr999(k, false) + ' mille');
    if (r) p.push(fr999(r, true));
    return p.join(' ');
  }

  // ---------- German ----------
  const DE_U = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
  const DE_T = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
  function de99(n, inner) {
    if (n === 1) return inner ? 'ein' : 'eins';
    if (n < 20) return DE_U[n];
    const t = Math.floor(n / 10), u = n % 10;
    return u ? (u === 1 ? 'ein' : DE_U[u]) + 'und' + DE_T[t] : DE_T[t];
  }
  function de999(n, inner) {
    const h = Math.floor(n / 100), r = n % 100;
    return (h ? (h === 1 ? 'einhundert' : DE_U[h] + 'hundert') : '') + (r ? de99(r, inner) : '');
  }
  function de(n) {
    const [m, k, r] = groups(n);
    const p = [];
    if (m) p.push(m === 1 ? 'eine Million' : de999(m, true) + ' Millionen');
    const low = (k ? (k === 1 ? 'eintausend' : de999(k, true) + 'tausend') : '') + (r ? de999(r, false) : '');
    if (low) p.push(low);
    return p.join(' ');
  }

  // ---------- Portuguese (Portugal) ----------
  const PT_U = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'];
  const PT_T = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const PT_H = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const pt99 = (n) => (n < 20 ? PT_U[n] : PT_T[Math.floor(n / 10)] + (n % 10 ? ' e ' + PT_U[n % 10] : ''));
  function pt999(n) {
    if (n === 100) return 'cem';
    const h = Math.floor(n / 100), r = n % 100;
    return [h ? PT_H[h] : '', r ? pt99(r) : ''].filter(Boolean).join(' e ');
  }
  function pt(n) {
    const [m, k, r] = groups(n);
    const p = [];
    if (m) p.push(m === 1 ? 'um milhão' : pt999(m) + ' milhões');
    if (k) p.push(k === 1 ? 'mil' : pt999(k) + ' mil');
    let s = p.join(' ');
    if (r) s += (s ? (r < 100 || r % 100 === 0 ? ' e ' : ' ') : '') + pt999(r);
    return s;
  }

  // ---------- Dutch ----------
  const NL_U = ['nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien'];
  const NL_T = ['', '', 'twintig', 'dertig', 'veertig', 'vijftig', 'zestig', 'zeventig', 'tachtig', 'negentig'];
  function nl99(n) {
    if (n < 20) return NL_U[n];
    const u = n % 10, t = NL_T[Math.floor(n / 10)];
    return u ? NL_U[u] + (/e$/.test(NL_U[u]) ? 'ën' : 'en') + t : t;
  }
  const nl999 = (n) => { const h = Math.floor(n / 100), r = n % 100; return (h ? (h === 1 ? 'honderd' : NL_U[h] + 'honderd') : '') + (r ? nl99(r) : ''); };
  function nl(n) {
    const [m, k, r] = groups(n);
    const p = [];
    if (m) p.push(m === 1 ? 'een miljoen' : nl999(m) + ' miljoen');
    const low = (k ? (k === 1 ? 'duizend' : nl999(k) + 'duizend') : '') + (r ? nl999(r) : '');
    if (low) p.push(low);
    return p.join(' ');
  }

  // ---------- Polish, Czech, Croatian, Russian ----------
  const SLAVIC = {
    pl: { u: ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'],
      t: ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'],
      h: ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'],
      k: ['tysiąc', 'tysiące', 'tysięcy'], m: ['milion', 'miliony', 'milionów'], fem: {}, and: ' ', oneK: 'tysiąc' },
    cs: { u: ['nula', 'jeden', 'dva', 'tři', 'čtyři', 'pět', 'šest', 'sedm', 'osm', 'devět', 'deset', 'jedenáct', 'dvanáct', 'třináct', 'čtrnáct', 'patnáct', 'šestnáct', 'sedmnáct', 'osmnáct', 'devatenáct'],
      t: ['', '', 'dvacet', 'třicet', 'čtyřicet', 'padesát', 'šedesát', 'sedmdesát', 'osmdesát', 'devadesát'],
      h: ['', 'sto', 'dvě stě', 'tři sta', 'čtyři sta', 'pět set', 'šest set', 'sedm set', 'osm set', 'devět set'],
      k: ['tisíc', 'tisíce', 'tisíc'], m: ['milion', 'miliony', 'milionů'], fem: {}, and: ' ', oneK: 'tisíc' },
    hr: { u: ['nula', 'jedan', 'dva', 'tri', 'četiri', 'pet', 'šest', 'sedam', 'osam', 'devet', 'deset', 'jedanaest', 'dvanaest', 'trinaest', 'četrnaest', 'petnaest', 'šesnaest', 'sedamnaest', 'osamnaest', 'devetnaest'],
      t: ['', '', 'dvadeset', 'trideset', 'četrdeset', 'pedeset', 'šezdeset', 'sedamdeset', 'osamdeset', 'devedeset'],
      h: ['', 'sto', 'dvjesto', 'tristo', 'četiristo', 'petsto', 'šeststo', 'sedamsto', 'osamsto', 'devetsto'],
      k: ['tisuća', 'tisuće', 'tisuća'], m: ['milijun', 'milijuna', 'milijuna'], fem: { 1: 'jedna', 2: 'dvije' }, and: ' i ', oneK: 'tisuću' },
    ru: { u: ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'],
      t: ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'],
      h: ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'],
      k: ['тысяча', 'тысячи', 'тысяч'], m: ['миллион', 'миллиона', 'миллионов'], fem: { 1: 'одна', 2: 'две' }, and: ' ', oneK: 'одна тысяча' },
  };
  function slav999(L, n, fem) {
    const h = Math.floor(n / 100), r = n % 100, t = Math.floor(r / 10), u = r % 10;
    const unit = (x) => (fem && L.fem[x] ? L.fem[x] : L.u[x]);
    const p = [];
    if (h) p.push(L.h[h]);
    if (r) {
      if (r < 20) p.push(r < 10 ? unit(r) : L.u[r]);
      else p.push(L.t[t] + (u ? L.and + unit(u) : ''));
    }
    return p.join(' ');
  }
  function slavic(lang) {
    const L = SLAVIC[lang];
    // pl and cs use the feminine forms for thousands only in Czech (dvě) and Polish (dwa → dwa tysiące stays masculine)
    const femK = lang === 'cs' ? { 2: 'dva' } : null;
    return function (n) {
      const [m, k, r] = groups(n);
      const p = [];
      if (m) p.push(`${slav999(L, m, false)} ${L.m[slav(m)]}`);
      if (k) {
        if (k === 1) p.push(L.oneK);
        else p.push(`${slav999(L, k, lang === 'ru' || lang === 'hr' || !!femK)} ${L.k[slav(k)]}`);
      }
      if (r) p.push(slav999(L, r, false));
      return p.join(' ');
    };
  }

  // ---------- Hungarian ----------
  const HU_U = ['', 'egy', 'kettő', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];
  const HU_T = ['', 'tizen', 'huszon', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'];
  function hu99(n, comp) {
    const t = Math.floor(n / 10), u = n % 10;
    const unit = u === 2 && comp ? 'két' : HU_U[u];
    if (!t) return unit;
    if (!u) return t === 1 ? 'tíz' : t === 2 ? 'húsz' : HU_T[t];
    return HU_T[t] + unit;
  }
  function hu999(n, comp) {
    const h = Math.floor(n / 100), r = n % 100;
    return (h ? (h === 1 ? 'száz' : (h === 2 ? 'két' : HU_U[h]) + 'száz') : '') + (r ? hu99(r, comp) : '');
  }
  function hu(n) {
    const [m, k, r] = groups(n);
    const p = [];
    if (m) p.push((m === 1 ? 'egy' : hu999(m, true)) + 'millió');
    if (k) p.push((k === 1 ? '' : hu999(k, true)) + 'ezer');
    if (r) p.push(hu999(r, false));
    return p.join(n > 2000 ? '-' : '');
  }

  // ---------- Romanian ----------
  const RO_U = ['zero', 'unu', 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă', 'zece', 'unsprezece', 'doisprezece', 'treisprezece', 'paisprezece', 'cincisprezece', 'șaisprezece', 'șaptesprezece', 'optsprezece', 'nouăsprezece'];
  const RO_T = ['', '', 'douăzeci', 'treizeci', 'patruzeci', 'cincizeci', 'șaizeci', 'șaptezeci', 'optzeci', 'nouăzeci'];
  function ro99(n, fem) {
    if (n === 2 && fem) return 'două';
    if (n === 12 && fem) return 'douăsprezece';
    if (n < 20) return RO_U[n];
    const u = n % 10;
    return RO_T[Math.floor(n / 10)] + (u ? ' și ' + (u === 2 && fem ? 'două' : RO_U[u]) : '');
  }
  function ro999(n, fem) {
    const h = Math.floor(n / 100), r = n % 100;
    const p = [];
    if (h) p.push(h === 1 ? 'o sută' : (h === 2 ? 'două' : RO_U[h]) + ' sute');
    if (r) p.push(ro99(r, fem));
    return p.join(' ');
  }
  const roDe = (n) => (n % 100 === 0 && n >= 100) || n % 100 >= 20;
  function ro(n) {
    const [m, k, r] = groups(n);
    const p = [];
    if (m) p.push(m === 1 ? 'un milion' : `${ro999(m, true)} ${roDe(m) ? 'de ' : ''}milioane`);
    if (k) p.push(k === 1 ? 'o mie' : `${ro999(k, true)} ${roDe(k) ? 'de ' : ''}mii`);
    if (r) p.push(ro999(r, false));
    return p.join(' ');
  }

  // ---------- Danish, Swedish, Norwegian ----------
  const DA_U = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten'];
  const DA_T = ['', '', 'tyve', 'tredive', 'fyrre', 'halvtreds', 'tres', 'halvfjerds', 'firs', 'halvfems'];
  const da99 = (n) => (n < 20 ? DA_U[n] : (n % 10 ? DA_U[n % 10] + 'og' : '') + DA_T[Math.floor(n / 10)]);
  function da999(n) {
    const h = Math.floor(n / 100), r = n % 100;
    const head = h ? (h === 1 ? 'et hundrede' : DA_U[h] + 'hundrede') : '';
    return head && r ? head + ' og ' + da99(r) : head || da99(r);
  }
  function da(n) {
    const [m, k, r] = groups(n);
    const p = [];
    if (m) p.push(m === 1 ? 'en million' : da999(m) + ' millioner');
    if (k) p.push(k === 1 ? 'et tusind' : da999(k) + ' tusind');
    let s = p.join(' ');
    if (r) s += (s ? (r < 100 ? ' og ' : ' ') : '') + da999(r);
    return s;
  }
  const SV_U = ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv', 'tretton', 'fjorton', 'femton', 'sexton', 'sjutton', 'arton', 'nitton'];
  const SV_T = ['', '', 'tjugo', 'trettio', 'fyrtio', 'femtio', 'sextio', 'sjuttio', 'åttio', 'nittio'];
  const sv99 = (n) => (n < 20 ? SV_U[n] : SV_T[Math.floor(n / 10)] + (n % 10 ? SV_U[n % 10] : ''));
  const sv999 = (n) => { const h = Math.floor(n / 100), r = n % 100; return (h ? (h === 1 ? 'etthundra' : SV_U[h] + 'hundra') : '') + (r ? sv99(r) : ''); };
  function sv(n) {
    const [m, k, r] = groups(n);
    const p = [];
    if (m) p.push(m === 1 ? 'en miljon' : sv999(m).replace(/ett$/, 'en') + ' miljoner');
    const low = (k ? (k === 1 ? 'ettusen' : sv999(k) + 'tusen') : '') + (r ? sv999(r) : '');
    if (low) p.push(low);
    return p.join(' ');
  }
  const NB_U = ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten'];
  const NB_T = ['', '', 'tjue', 'tretti', 'førti', 'femti', 'seksti', 'sytti', 'åtti', 'nitti'];
  const nb99 = (n) => (n < 20 ? NB_U[n] : NB_T[Math.floor(n / 10)] + (n % 10 ? NB_U[n % 10] : ''));
  function nb999(n) {
    const h = Math.floor(n / 100), r = n % 100;
    const head = h ? (h === 1 ? 'ett hundre' : NB_U[h] + ' hundre') : '';
    return head && r ? head + ' og ' + nb99(r) : head || nb99(r);
  }
  function nb(n) {
    const [m, k, r] = groups(n);
    const p = [];
    if (m) p.push(m === 1 ? 'én million' : nb999(m) + ' millioner');
    if (k) p.push(k === 1 ? 'ett tusen' : nb999(k) + ' tusen');
    let s = p.join(' ');
    if (r) s += (s ? (r < 100 ? ' og ' : ' ') : '') + nb999(r);
    return s;
  }

  // ---------- Chinese ----------
  const ZH_D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  function zh4(g, lead) {
    const ds = [Math.floor(g / 1000), Math.floor(g / 100) % 10, Math.floor(g / 10) % 10, g % 10];
    const units = ['千', '百', '十', ''];
    let out = '', zero = false;
    ds.forEach((d, i) => {
      if (d) {
        if (zero) out += '零';
        zero = false;
        const digit = d === 2 && i === 0 ? '两' : ZH_D[d];
        out += digit + units[i];
      } else if (out) zero = true;
    });
    if (lead && out.startsWith('一十')) out = out.slice(1);
    return out;
  }
  function zh(n) {
    const yi = Math.floor(n / 1e8), wan = Math.floor((n % 1e8) / 1e4), rest = n % 1e4;
    let s = '';
    const grp = (g, unit, lead) => { const w = g === 2 ? '两' : zh4(g, lead); return w + unit; };
    if (yi) s += grp(yi, '亿', true);
    if (wan) s += (s && wan < 1000 ? '零' : '') + grp(wan, '万', !s);
    if (rest) s += (s && rest < 1000 ? '零' : '') + zh4(rest, !s);
    return s;
  }

  const WORDS = { fr, de, pt, nl, pl: slavic('pl'), cs: slavic('cs'), hr: slavic('hr'), ru: slavic('ru'), hu, ro, da, sv, nb, zh };
  const ZERO = { fr: 'zéro', de: 'null', pt: 'zero', nl: 'nul', pl: 'zero', cs: 'nula', hr: 'nula', ru: 'ноль', hu: 'nulla', ro: 'zero', da: 'nul', sv: 'noll', nb: 'null', zh: '零' };
  // Beyond 999 999 999 the amount is written in digits, grouped as the language does (1 234 567 890).
  const MAX = 999999999;
  function digits(n, lang) {
    try { return new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(n); } catch (e) { return String(n); }
  }
  function words(n, lang) {
    if (!WORDS[lang]) return null;
    n = Math.round(Math.abs(n || 0));
    if (n === 0) return ZERO[lang];
    if (!(n <= MAX)) return digits(n, lang);
    return WORDS[lang](n);
  }

  // ---------- currency names: [one, other] or, in Slavic languages, [one, few, many] ----------
  const CUR = {
    fr: { EUR: ['euro', 'euros'], CHF: ['franc suisse', 'francs suisses'], GBP: ['livre sterling', 'livres sterling'], PLN: ['złoty', 'złotys'], CZK: ['couronne tchèque', 'couronnes tchèques'], HUF: ['forint', 'forints'], RON: ['leu roumain', 'lei roumains'], DKK: ['couronne danoise', 'couronnes danoises'], NOK: ['couronne norvégienne', 'couronnes norvégiennes'], SEK: ['couronne suédoise', 'couronnes suédoises'] },
    de: { EUR: ['Euro', 'Euro'], CHF: ['Schweizer Franken', 'Schweizer Franken'], GBP: ['Pfund Sterling', 'Pfund Sterling'], PLN: ['Złoty', 'Złoty'], CZK: ['Tschechische Krone', 'Tschechische Kronen'], HUF: ['Forint', 'Forint'], RON: ['Rumänischer Leu', 'Rumänische Lei'], DKK: ['Dänische Krone', 'Dänische Kronen'], NOK: ['Norwegische Krone', 'Norwegische Kronen'], SEK: ['Schwedische Krone', 'Schwedische Kronen'] },
    pt: { EUR: ['euro', 'euros'], CHF: ['franco suíço', 'francos suíços'], GBP: ['libra esterlina', 'libras esterlinas'], PLN: ['zloty', 'zlotys'], CZK: ['coroa checa', 'coroas checas'], HUF: ['forint', 'forints'], RON: ['leu romeno', 'lei romenos'], DKK: ['coroa dinamarquesa', 'coroas dinamarquesas'], NOK: ['coroa norueguesa', 'coroas norueguesas'], SEK: ['coroa sueca', 'coroas suecas'] },
    nl: { EUR: ['euro', 'euro'], CHF: ['Zwitserse frank', 'Zwitserse frank'], GBP: ['pond sterling', 'pond sterling'], PLN: ['zloty', 'zloty'], CZK: ['Tsjechische kroon', 'Tsjechische kronen'], HUF: ['forint', 'forint'], RON: ['Roemeense leu', 'Roemeense lei'], DKK: ['Deense kroon', 'Deense kronen'], NOK: ['Noorse kroon', 'Noorse kronen'], SEK: ['Zweedse kroon', 'Zweedse kronen'] },
    pl: { EUR: ['euro', 'euro', 'euro'], CHF: ['frank szwajcarski', 'franki szwajcarskie', 'franków szwajcarskich'], GBP: ['funt szterling', 'funty szterlingi', 'funtów szterlingów'], PLN: ['złoty', 'złote', 'złotych'], CZK: ['korona czeska', 'korony czeskie', 'koron czeskich'], HUF: ['forint', 'forinty', 'forintów'], RON: ['lej rumuński', 'leje rumuńskie', 'lejów rumuńskich'], DKK: ['korona duńska', 'korony duńskie', 'koron duńskich'], NOK: ['korona norweska', 'korony norweskie', 'koron norweskich'], SEK: ['korona szwedzka', 'korony szwedzkie', 'koron szwedzkich'] },
    cs: { EUR: ['euro', 'eura', 'eur'], CHF: ['švýcarský frank', 'švýcarské franky', 'švýcarských franků'], GBP: ['britská libra', 'britské libry', 'britských liber'], PLN: ['polský zlotý', 'polské zloté', 'polských zlotých'], CZK: ['česká koruna', 'české koruny', 'českých korun'], HUF: ['maďarský forint', 'maďarské forinty', 'maďarských forintů'], RON: ['rumunský leu', 'rumunské lei', 'rumunských lei'], DKK: ['dánská koruna', 'dánské koruny', 'dánských korun'], NOK: ['norská koruna', 'norské koruny', 'norských korun'], SEK: ['švédská koruna', 'švédské koruny', 'švédských korun'] },
    hr: { EUR: ['euro', 'eura', 'eura'], CHF: ['švicarski franak', 'švicarska franka', 'švicarskih franaka'], GBP: ['britanska funta', 'britanske funte', 'britanskih funti'], PLN: ['poljski zlot', 'poljska zlota', 'poljskih zlota'], CZK: ['češka kruna', 'češke krune', 'čeških kruna'], HUF: ['mađarska forinta', 'mađarske forinte', 'mađarskih forinti'], RON: ['rumunjski lej', 'rumunjska leja', 'rumunjskih leja'], DKK: ['danska kruna', 'danske krune', 'danskih kruna'], NOK: ['norveška kruna', 'norveške krune', 'norveških kruna'], SEK: ['švedska kruna', 'švedske krune', 'švedskih kruna'] },
    ru: { EUR: ['евро', 'евро', 'евро'], CHF: ['швейцарский франк', 'швейцарских франка', 'швейцарских франков'], GBP: ['фунт стерлингов', 'фунта стерлингов', 'фунтов стерлингов'], PLN: ['польский злотый', 'польских злотых', 'польских злотых'], CZK: ['чешская крона', 'чешские кроны', 'чешских крон'], HUF: ['венгерский форинт', 'венгерских форинта', 'венгерских форинтов'], RON: ['румынский лей', 'румынских лея', 'румынских леев'], DKK: ['датская крона', 'датские кроны', 'датских крон'], NOK: ['норвежская крона', 'норвежские кроны', 'норвежских крон'], SEK: ['шведская крона', 'шведские кроны', 'шведских крон'] },
    hu: { EUR: ['euró', 'euró'], CHF: ['svájci frank', 'svájci frank'], GBP: ['angol font', 'angol font'], PLN: ['lengyel zloty', 'lengyel zloty'], CZK: ['cseh korona', 'cseh korona'], HUF: ['forint', 'forint'], RON: ['román lej', 'román lej'], DKK: ['dán korona', 'dán korona'], NOK: ['norvég korona', 'norvég korona'], SEK: ['svéd korona', 'svéd korona'] },
    ro: { EUR: ['euro', 'euro'], CHF: ['franc elvețian', 'franci elvețieni'], GBP: ['liră sterlină', 'lire sterline'], PLN: ['zlot', 'zloți'], CZK: ['coroană cehă', 'coroane cehe'], HUF: ['forint', 'forinți'], RON: ['leu', 'lei'], DKK: ['coroană daneză', 'coroane daneze'], NOK: ['coroană norvegiană', 'coroane norvegiene'], SEK: ['coroană suedeză', 'coroane suedeze'] },
    da: { EUR: ['euro', 'euro'], CHF: ['schweizerfranc', 'schweizerfranc'], GBP: ['britisk pund', 'britiske pund'], PLN: ['zloty', 'zloty'], CZK: ['tjekkisk koruna', 'tjekkiske koruna'], HUF: ['forint', 'forint'], RON: ['rumænsk leu', 'rumænske lei'], DKK: ['krone', 'kroner'], NOK: ['norsk krone', 'norske kroner'], SEK: ['svensk krone', 'svenske kroner'] },
    sv: { EUR: ['euro', 'euro'], CHF: ['schweizerfranc', 'schweizerfranc'], GBP: ['brittiskt pund', 'brittiska pund'], PLN: ['zloty', 'zloty'], CZK: ['tjeckisk krona', 'tjeckiska kronor'], HUF: ['forint', 'forint'], RON: ['rumänsk leu', 'rumänska lei'], DKK: ['dansk krona', 'danska kronor'], NOK: ['norsk krona', 'norska kronor'], SEK: ['krona', 'kronor'] },
    nb: { EUR: ['euro', 'euro'], CHF: ['sveitsisk franc', 'sveitsiske franc'], GBP: ['britisk pund', 'britiske pund'], PLN: ['zloty', 'zloty'], CZK: ['tsjekkisk koruna', 'tsjekkiske koruna'], HUF: ['forint', 'forint'], RON: ['rumensk leu', 'rumenske lei'], DKK: ['dansk krone', 'danske kroner'], NOK: ['krone', 'kroner'], SEK: ['svensk krone', 'svenske kroner'] },
    zh: { EUR: ['欧元'], CHF: ['瑞士法郎'], GBP: ['英镑'], PLN: ['波兰兹罗提'], CZK: ['捷克克朗'], HUF: ['匈牙利福林'], RON: ['罗马尼亚列伊'], DKK: ['丹麦克朗'], NOK: ['挪威克朗'], SEK: ['瑞典克朗'] },
  };
  const SLAVIC_LANGS = ['pl', 'cs', 'hr', 'ru'];
  function nameFor(n, lang, cur) {
    const f = (CUR[lang] || {})[cur];
    if (!f) return cur;
    if (f.length === 1) return f[0];
    if (SLAVIC_LANGS.includes(lang)) return f[slav(n)];
    return n === 1 ? f[0] : f[1];
  }
  // Plural (or genitive plural) name of a currency, as used after a large amount.
  const currencyName = (lang, cur) => nameFor(5, lang, cur);
  function currencyWords(n, lang, cur) {
    const w = words(n, lang);
    if (w == null) return null;
    const v = Math.round(Math.abs(n || 0));
    const name = nameFor(v, lang, cur);
    const exactM = v >= 1e6 && v <= MAX && v % 1e6 === 0;   // "deux millions d’euros", but "2 000 000 000 euros"
    if (lang === 'zh') return w + name;
    if (lang === 'fr' && exactM) return `${w} ${/^[aeiouyhéè]/i.test(name) ? 'd’' : 'de '}${name}`.replace(' d’', ' d’');
    if (lang === 'pt' && exactM) return `${w} de ${name}`;
    if (lang === 'ro' && roDe(v)) return `${w} de ${name}`;
    return `${w} ${name}`;
  }

  return { words, currencyWords, currencyName, LANGS: Object.keys(WORDS) };
});
