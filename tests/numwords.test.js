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
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const NW = require('../src/js/numwords.js');

const cases = {
  fr: [[518000, 'cinq cent dix-huit mille'], [1250000, 'un million deux cent cinquante mille'], [80, 'quatre-vingts'], [71, 'soixante et onze'], [200, 'deux cents']],
  de: [[518000, 'fünfhundertachtzehntausend'], [1250000, 'eine Million zweihundertfünfzigtausend'], [21, 'einundzwanzig'], [2000000, 'zwei Millionen']],
  pt: [[518000, 'quinhentos e dezoito mil'], [1250000, 'um milhão duzentos e cinquenta mil'], [100, 'cem'], [2000000, 'dois milhões']],
  nl: [[518000, 'vijfhonderdachttienduizend'], [1250000, 'een miljoen tweehonderdvijftigduizend'], [21, 'eenentwintig'], [83, 'drieëntachtig']],
  pl: [[518000, 'pięćset osiemnaście tysięcy'], [1250000, 'jeden milion dwieście pięćdziesiąt tysięcy'], [2000, 'dwa tysiące'], [5000000, 'pięć milionów']],
  cs: [[518000, 'pět set osmnáct tisíc'], [1250000, 'jeden milion dvě stě padesát tisíc'], [2000, 'dva tisíce'], [5000000, 'pět milionů']],
  hu: [[518000, 'ötszáztizennyolcezer'], [1250000, 'egymillió-kétszázötvenezer'], [1500, 'ezerötszáz'], [2300, 'kétezer-háromszáz']],
  ro: [[518000, 'cinci sute optsprezece mii'], [1250000, 'un milion două sute cincizeci de mii'], [2000, 'două mii'], [21, 'douăzeci și unu']],
  hr: [[518000, 'petsto osamnaest tisuća'], [1250000, 'jedan milijun dvjesto pedeset tisuća'], [2000, 'dvije tisuće'], [21, 'dvadeset i jedan']],
  da: [[518000, 'femhundrede og atten tusind'], [1250000, 'en million tohundrede og halvtreds tusind'], [58, 'otteoghalvtreds'], [90, 'halvfems']],
  sv: [[518000, 'femhundraartontusen'], [1250000, 'en miljon tvåhundrafemtiotusen'], [21, 'tjugoett'], [2000000, 'två miljoner']],
  nb: [[518000, 'fem hundre og atten tusen'], [1250000, 'én million to hundre og femti tusen'], [21, 'tjueen'], [2000000, 'to millioner']],
  zh: [[518000, '五十一万八千'], [1250000, '一百二十五万'], [20000, '两万'], [10500, '一万零五百'], [345, '三百四十五']],
  ru: [[518000, 'пятьсот восемнадцать тысяч'], [1250000, 'один миллион двести пятьдесят тысяч'], [2000, 'две тысячи'], [21000, 'двадцать одна тысяча'], [5000000, 'пять миллионов']],
};

for (const [lang, list] of Object.entries(cases)) {
  test(`numbers in words: ${lang}`, () => {
    for (const [n, w] of list) assert.equal(NW.words(n, lang), w, `${lang} ${n}`);
  });
}

test('currency names agree with the number', () => {
  assert.equal(NW.currencyWords(518000, 'ru', 'CHF'), 'пятьсот восемнадцать тысяч швейцарских франков');
  assert.equal(NW.currencyWords(518000, 'pl', 'EUR'), 'pięćset osiemnaście tysięcy euro');
  assert.equal(NW.currencyWords(2000000, 'fr', 'EUR'), 'deux millions d’euros');
  assert.equal(NW.currencyWords(518000, 'zh', 'EUR'), '五十一万八千欧元');
  assert.equal(NW.currencyWords(518000, 'ro', 'EUR'), 'cinci sute optsprezece mii de euro');
  assert.equal(NW.currencyWords(518000, 'de', 'CHF'), 'fünfhundertachtzehntausend Schweizer Franken');
  assert.equal(NW.currencyName('cs', 'CZK'), 'českých korun');
  assert.equal(NW.words(518000, 'xx'), null, 'unknown language');
});


test('amounts beyond 999 999 999 are written in grouped digits, with the currency name and no particle', () => {
  assert.match(NW.words(1234567890, 'fr'), /^1\D234\D567\D890$/);
  assert.match(NW.words(1234567890, 'de'), /^1\D234\D567\D890$/);
  assert.match(NW.currencyWords(2e9, 'fr', 'EUR'), /^2\D000\D000\D000 euros$/);
  assert.match(NW.currencyWords(2e9, 'pt', 'EUR'), /^2\D000\D000\D000 euros$/);
  assert.match(NW.currencyWords(1234567890, 'ru', 'EUR'), /^1\D234\D567\D890 евро$/);
});
