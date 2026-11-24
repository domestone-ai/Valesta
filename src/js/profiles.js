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
/* Profiles — library of agency profiles (brand, logo, colours, fonts, cover, office details).
 * Neutral default profile plus three fictitious example agencies that show different styles: a neighbourhood agency,
 * a luxury agency and a modern agency. The example agencies, their logos and their contact details are invented.
 * Profiles created by users have the same format (AppCore.makeProfile) and live in the browser storage.
 */
(function (root, factory) {
  const mod = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Profiles = mod;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const G = typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : root;
  const A = G.PROFILE_ASSETS || (typeof require === 'function' ? require('./profiles_assets.js') : {});
  const T = (en, es, it) => ({ en, es, it });
  const logo = (k, side) => (A[k] && A[k][side]) || null;

  const make = (o) => ({ kind: 'valesta-profile', version: 1, name: o.brand.name, created: '2026-11-23', brand: o.brand, office: o.office, design: o.design });
  const demoOffice = (name, company) => ({ name, company, address: 'Example Street 1 · 00000 Example Town', phone: '+00 000 000 000', email: 'info@example.com', web: 'www.example.com', license: '' });

  const LIST = [
    {
      id: 'valesta', builtin: true, label: 'Valesta',
      profile: make({
        brand: { name: 'Valesta', logoMode: 'text', logoLight: null, logoDark: null, primary: '#0E5A4E', accent: '#1A8A47', showBand: true,
          tagline: T('Property valuation with the sales comparison approach', 'Valoración inmobiliaria con el método de comparación de mercado', 'Valutazione immobiliare con il metodo di comparazione di mercato') },
        office: { name: 'Valesta', company: '', address: '', phone: '', email: '', web: '', license: '' },
        design: { fontHead: 'Cormorant Garamond', fontBody: 'Inter', coverStyle: 'map', radius: 'rounded', density: 'normal', ink: '#1A2229' },
      }),
    },
    {
      id: 'example-casa-aurora', builtin: true, label: 'Casa Aurora · example',
      profile: make({
        brand: { name: 'Casa Aurora', logoMode: 'custom', logoLight: logo('casaaurora', 'light'), logoDark: logo('casaaurora', 'dark'), primary: '#2F6B4F', accent: '#2F6B4F', showBand: true,
          tagline: T('Your neighbourhood agency', 'Tu agencia de barrio', 'La tua agenzia di quartiere') },
        office: demoOffice('Casa Aurora — demo office', 'Casa Aurora (fictitious)'),
        design: { fontHead: 'Montserrat', fontBody: 'Inter', coverStyle: 'map', radius: 'rounded', density: 'normal', ink: '#1A2229' },
      }),
    },
    {
      id: 'example-mirador', builtin: true, label: 'Mirador Estates · example',
      profile: make({
        brand: { name: 'Mirador Estates', logoMode: 'custom', logoLight: logo('mirador', 'light'), logoDark: logo('mirador', 'dark'), primary: '#111111', accent: '#B08D57', showBand: true,
          tagline: T('Exceptional homes, personal service', 'Viviendas excepcionales, servicio personal', 'Case eccezionali, servizio personale') },
        office: demoOffice('Mirador Estates — demo office', 'Mirador Estates (fictitious)'),
        design: { fontHead: 'Cormorant Garamond', fontBody: 'Inter', coverStyle: 'solid', radius: 'square', density: 'normal', ink: '#111111' },
      }),
    },
    {
      id: 'example-nordic-homes', builtin: true, label: 'Nordic Homes · example',
      profile: make({
        brand: { name: 'Nordic Homes', logoMode: 'custom', logoLight: logo('nordichomes', 'light'), logoDark: logo('nordichomes', 'dark'), primary: '#1F3A5F', accent: '#3FA796', showBand: true,
          tagline: T('Clear valuations, simple decisions', 'Valoraciones claras, decisiones sencillas', 'Valutazioni chiare, decisioni semplici') },
        office: demoOffice('Nordic Homes — demo office', 'Nordic Homes (fictitious)'),
        design: { fontHead: 'Figtree', fontBody: 'Figtree', coverStyle: 'gradient', radius: 'square', density: 'normal', ink: '#202221' },
      }),
    },
  ];
  const DEFAULT_ID = 'valesta';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const get = (id) => { const p = LIST.find((x) => x.id === id); return p ? clone(p) : null; };
  // Very old projects used a "built-in" logo that no longer exists: they switch to the text wordmark.
  function legacyBrand(brand) {
    if (!brand || brand.logoMode !== 'builtin') return brand;
    return Object.assign({}, brand, { logoMode: 'text' });
  }
  return { LIST, DEFAULT_ID, get, legacyBrand };
});
