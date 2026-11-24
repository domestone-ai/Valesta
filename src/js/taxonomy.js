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
/* Taxonomy — property types, purposes and approaches (the code lists of Valesta) and the
 * 19 country packs. The country packs are drafts until a local professional reviews them. Pure data, no DOM. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Taxonomy = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const L = (en, es, it) => ({ en, es, it });

  /* code lists: property types, purposes, approaches (version 0.1.0) */
  const TYPES = [
    { code: "RES.DETACHED_HOUSE", category: "residential", cc: "1110", label: L("Detached house", "Vivienda unifamiliar aislada", "Casa unifamiliare indipendente"), approaches: ["sales_comparison", "income_capitalisation"] },
    { code: "RES.SEMI_DETACHED_HOUSE", category: "residential", cc: "1121", label: L("Semi-detached or two-family house", "Vivienda pareada o bifamiliar", "Casa bifamiliare o semi-indipendente"), approaches: ["sales_comparison", "income_capitalisation"] },
    { code: "RES.TERRACED_HOUSE", category: "residential", cc: "1110", label: L("Terraced house", "Vivienda adosada", "Villetta a schiera"), approaches: ["sales_comparison", "income_capitalisation"] },
    { code: "RES.APARTMENT", category: "residential", cc: "1122", label: L("Apartment in a multi-dwelling building", "Piso en edificio plurifamiliar", "Appartamento in condominio"), approaches: ["sales_comparison", "income_capitalisation"] },
    { code: "RES.PENTHOUSE", category: "residential", cc: "1122", label: L("Penthouse", "Ático", "Attico"), approaches: ["sales_comparison", "income_capitalisation"] },
    { code: "RES.VILLA", category: "residential", cc: "1110", label: L("Villa", "Villa", "Villa"), approaches: ["sales_comparison", "income_capitalisation"] },
    { code: "RES.RURAL_HOUSE", category: "residential", cc: "1110", label: L("Rural house", "Casa rural", "Casale o rustico"), approaches: ["sales_comparison", "income_capitalisation"] },
    { code: "RES.LOFT", category: "residential", cc: "1122", label: L("Loft", "Loft", "Loft"), approaches: ["sales_comparison", "income_capitalisation"] },
    { code: "RES.COMMUNITY_RESIDENCE", category: "residential", cc: "1130", label: L("Residence for communities (students, seniors)", "Residencia colectiva (estudiantes, mayores)", "Residenza collettiva (studentato, senior)"), approaches: ["sales_comparison", "income_capitalisation"] },
    { code: "RET.HIGH_STREET_SHOP", category: "retail", cc: "1230", label: L("High-street shop", "Local a pie de calle", "Negozio su strada"), approaches: ["income_capitalisation", "discounted_cash_flow", "sales_comparison"] },
    { code: "RET.SHOPPING_CENTRE_UNIT", category: "retail", cc: "1230", label: L("Unit in a shopping centre", "Local en centro comercial", "Unità in centro commerciale"), approaches: ["income_capitalisation", "discounted_cash_flow", "sales_comparison"] },
    { code: "RET.SHOPPING_CENTRE", category: "retail", cc: "1230", label: L("Shopping centre or retail park", "Centro comercial o parque comercial", "Centro commerciale o retail park"), approaches: ["income_capitalisation", "discounted_cash_flow", "sales_comparison"] },
    { code: "RET.SUPERMARKET", category: "retail", cc: "1230", label: L("Supermarket or large store", "Supermercado o gran superficie", "Supermercato o grande superficie"), approaches: ["income_capitalisation", "discounted_cash_flow", "sales_comparison"] },
    { code: "RET.SHOWROOM", category: "retail", cc: "1230", label: L("Showroom", "Showroom", "Showroom"), approaches: ["income_capitalisation", "discounted_cash_flow", "sales_comparison"] },
    { code: "RET.FOOD_AND_BEVERAGE", category: "retail", cc: "1230", label: L("Bar or restaurant", "Bar o restaurante", "Bar e ristorazione"), approaches: ["income_capitalisation", "discounted_cash_flow", "sales_comparison"] },
    { code: "WHO.CASH_AND_CARRY", category: "wholesale", cc: "1230", label: L("Cash and carry", "Cash & carry", "Cash & carry"), approaches: ["income_capitalisation", "sales_comparison"] },
    { code: "WHO.WHOLESALE_WAREHOUSE", category: "wholesale", cc: "1230", label: L("Wholesale warehouse", "Almacén mayorista", "Magazzino con vendita all’ingrosso"), approaches: ["income_capitalisation", "sales_comparison"] },
    { code: "WHO.TRADE_SHOWROOM", category: "wholesale", cc: "1230", label: L("Trade showroom", "Showroom profesional", "Showroom per operatori"), approaches: ["income_capitalisation", "sales_comparison"] },
    { code: "OFF.OFFICE_UNIT", category: "office", cc: "1220", label: L("Office unit or professional studio", "Oficina o despacho profesional", "Ufficio o studio professionale"), approaches: ["income_capitalisation", "discounted_cash_flow", "sales_comparison"] },
    { code: "OFF.OFFICE_BUILDING", category: "office", cc: "1220", label: L("Office building", "Edificio de oficinas", "Edificio direzionale"), approaches: ["income_capitalisation", "discounted_cash_flow", "sales_comparison"] },
    { code: "OFF.COWORKING", category: "office", cc: "1220", label: L("Coworking space", "Coworking", "Coworking"), approaches: ["income_capitalisation", "discounted_cash_flow", "sales_comparison"] },
    { code: "IND.PRODUCTION", category: "industrial", cc: "1251", label: L("Production building", "Nave industrial de producción", "Capannone produttivo"), approaches: ["income_capitalisation", "cost", "sales_comparison"] },
    { code: "IND.WAREHOUSE", category: "industrial", cc: "1252", label: L("Warehouse or storage building", "Almacén", "Magazzino o deposito"), approaches: ["income_capitalisation", "cost", "sales_comparison"] },
    { code: "IND.LOGISTICS", category: "industrial", cc: "1252", label: L("Logistics or distribution centre", "Centro logístico", "Polo logistico"), approaches: ["income_capitalisation", "cost", "sales_comparison"] },
    { code: "IND.WORKSHOP", category: "industrial", cc: "1251", label: L("Workshop", "Taller", "Laboratorio artigianale"), approaches: ["income_capitalisation", "cost", "sales_comparison"] },
    { code: "IND.DATA_CENTRE", category: "industrial", cc: null, label: L("Data centre", "Centro de datos", "Data center"), approaches: ["income_capitalisation", "cost", "sales_comparison"] },
    { code: "IND.LIGHT_INDUSTRIAL", category: "industrial", cc: "1251", label: L("Light industrial", "Industria ligera", "Light industrial"), approaches: ["income_capitalisation", "cost", "sales_comparison"] },
    { code: "HOS.HOTEL", category: "hospitality", cc: "1211", label: L("Hotel", "Hotel", "Hotel o albergo"), approaches: ["profits", "income_capitalisation", "sales_comparison"] },
    { code: "HOS.APARTHOTEL", category: "hospitality", cc: "1212", label: L("Aparthotel or serviced residence", "Aparthotel", "Residence o aparthotel"), approaches: ["profits", "income_capitalisation", "sales_comparison"] },
    { code: "HOS.BED_AND_BREAKFAST", category: "hospitality", cc: "1212", label: L("Bed and breakfast or guest house", "Bed and breakfast o pensión", "B&B o affittacamere"), approaches: ["profits", "income_capitalisation", "sales_comparison"] },
    { code: "HOS.HOSTEL", category: "hospitality", cc: "1212", label: L("Hostel", "Albergue", "Ostello"), approaches: ["profits", "income_capitalisation", "sales_comparison"] },
    { code: "HOS.CAMPSITE", category: "hospitality", cc: "1212", label: L("Campsite or holiday village", "Camping o ciudad de vacaciones", "Campeggio o villaggio"), approaches: ["profits", "income_capitalisation", "sales_comparison"] },
    { code: "HOS.AGRITOURISM", category: "hospitality", cc: "1212", label: L("Agritourism", "Agroturismo", "Agriturismo"), approaches: ["profits", "income_capitalisation", "sales_comparison"] },
    { code: "HOS.HOLIDAY_HOME", category: "hospitality", cc: null, label: L("Holiday home", "Vivienda vacacional", "Casa vacanze"), approaches: ["profits", "income_capitalisation", "sales_comparison"] },
    { code: "LND.BUILDABLE_RESIDENTIAL", category: "land", cc: null, label: L("Buildable land, residential", "Suelo urbanizable residencial", "Edificabile residenziale"), approaches: ["residual", "sales_comparison"] },
    { code: "LND.BUILDABLE_COMMERCIAL", category: "land", cc: null, label: L("Buildable land, commercial or industrial", "Suelo urbanizable terciario o industrial", "Edificabile produttivo o commerciale"), approaches: ["residual", "sales_comparison"] },
    { code: "LND.AGRICULTURAL", category: "land", cc: null, label: L("Agricultural land", "Suelo rústico", "Agricolo"), approaches: ["residual", "sales_comparison"] },
    { code: "ACC.GARAGE", category: "accessory", cc: "1242", label: L("Garage", "Garaje cerrado", "Box o garage"), approaches: ["sales_comparison"] },
    { code: "ACC.PARKING_SPACE", category: "accessory", cc: "1242", label: L("Parking space", "Plaza de aparcamiento", "Posto auto"), approaches: ["sales_comparison"] },
    { code: "ACC.STORAGE", category: "accessory", cc: null, label: L("Storage room or cellar", "Trastero", "Cantina o deposito"), approaches: ["sales_comparison"] },
    { code: "SPC.HEALTHCARE", category: "special", cc: "1264", label: L("Healthcare or care home", "Sanitario o residencia asistida", "Sanitario e assistenziale"), approaches: ["cost", "income_capitalisation"] },
    { code: "SPC.EDUCATION", category: "special", cc: "1263", label: L("Education", "Educativo", "Istruzione"), approaches: ["cost", "income_capitalisation"] },
    { code: "SPC.SPORTS_LEISURE", category: "special", cc: "1265", label: L("Sports and leisure", "Deportivo y ocio", "Sport e tempo libero"), approaches: ["cost", "income_capitalisation"] },
    { code: "SPC.WORSHIP", category: "special", cc: "1272", label: L("Place of worship", "Lugar de culto", "Luogo di culto"), approaches: ["cost", "income_capitalisation"] },
    { code: "SPC.AGRICULTURAL_BUILDING", category: "special", cc: "1271", label: L("Agricultural building", "Edificio agrícola", "Fabbricato agricolo"), approaches: ["cost", "income_capitalisation"] },
    { code: "SPC.SERVICE_STATION_PARKING", category: "special", cc: null, label: L("Service station or car park", "Estación de servicio o aparcamiento", "Stazione di servizio o parcheggio"), approaches: ["cost", "income_capitalisation"] },
    { code: "SPC.MIXED_USE", category: "special", cc: null, label: L("Mixed-use property (components)", "Inmueble mixto (componentes)", "Immobile misto (più componenti)"), approaches: ["cost", "income_capitalisation"] },
    { code: "SPC.OTHER", category: "special", cc: "1274", label: L("Other", "Otro", "Altro"), approaches: ["cost", "income_capitalisation"] },
  ];
  const CATEGORY_LABELS = {
    residential: L("Residential", "Residencial", "Residenziale"),
    retail: L("Retail", "Comercial – venta al por menor", "Commerciale – vendita al dettaglio"),
    wholesale: L("Wholesale", "Comercial – venta al por mayor", "Commerciale – vendita all’ingrosso"),
    office: L("Office", "Oficinas", "Uffici e direzionale"),
    industrial: L("Industrial and logistics", "Industrial y logística", "Industriale e logistica"),
    hospitality: L("Hospitality", "Hotelero y alojamiento", "Ricettivo"),
    land: L("Land", "Suelo", "Terreni"),
    accessory: L("Accessory units", "Anejos", "Pertinenze"),
    special: L("Special and mixed-use", "Especiales y mixtos", "Speciali e misti"),
  };
  const PURPOSES = [
    { code: "sale", label: L("Sale", "Venta", "Vendita") },
    { code: "purchase", label: L("Purchase", "Compra", "Acquisto") },
    { code: "inheritance", label: L("Inheritance", "Herencia", "Successione") },
    { code: "divorce_or_partition", label: L("Divorce or partition", "Divorcio o división", "Separazione o divisione") },
    { code: "insurance", label: L("Insurance", "Seguro", "Assicurazione") },
    { code: "financial_reporting", label: L("Financial reporting", "Información financiera", "Bilancio") },
    { code: "loan_security", label: L("Loan security", "Garantía hipotecaria", "Garanzia di un mutuo") },
    { code: "taxation", label: L("Taxation", "Fiscal", "Fisco") },
    { code: "litigation", label: L("Litigation", "Litigio", "Contenzioso") },
    { code: "other", label: L("Other", "Otro", "Altro") },
  ];
  const APPROACHES = {
    sales_comparison: L("Sales comparison", "Comparación", "Confronto di mercato"),
    income_capitalisation: L("Income capitalisation", "Capitalización de rentas", "Capitalizzazione del reddito"),
    discounted_cash_flow: L("Discounted cash flow", "Descuento de flujos de caja", "Flussi di cassa attualizzati"),
    profits: L("Profits method", "Método de beneficios", "Metodo reddituale sulla gestione"),
    cost: L("Cost (depreciated replacement cost)", "Coste de reemplazamiento depreciado", "Costo di ricostruzione deprezzato"),
    residual: L("Residual", "Residual", "Valore di trasformazione"),
    automated_model: L("Automated valuation model", "Modelo automático de valoración", "Modello di valutazione automatica"),
  };

  const CATEGORY_UI = {
    residential: { prefix: 'RES', icon: 'home', hint: L('Houses and apartments', 'Casas y pisos', 'Case e appartamenti') },
    retail: { prefix: 'RET', icon: 'store', hint: L('Shops and shopping centres', 'Locales y centros comerciales', 'Negozi e centri commerciali') },
    wholesale: { prefix: 'WHO', icon: 'box', hint: L('Cash & carry and trade sales', 'Cash & carry y venta a profesionales', 'Cash & carry e vendita a operatori') },
    office: { prefix: 'OFF', icon: 'briefcase', hint: L('Offices, studios, office buildings', 'Oficinas, despachos, edificios', 'Uffici, studi, edifici direzionali') },
    industrial: { prefix: 'IND', icon: 'factory', hint: L('Production, warehouses, logistics', 'Naves, almacenes, logística', 'Capannoni, magazzini, logistica') },
    hospitality: { prefix: 'HOS', icon: 'bed', hint: L('Hotels, B&Bs, campsites', 'Hoteles, B&B, campings', 'Hotel, B&B, campeggi') },
    land: { prefix: 'LND', icon: 'land', hint: L('Buildable and agricultural', 'Urbanizable y rústico', 'Edificabili e agricoli') },
    accessory: { prefix: 'ACC', icon: 'car', hint: L('Garages, parking spaces, storage', 'Garajes, plazas, trasteros', 'Box, posti auto, cantine') },
    special: { prefix: 'SPC', icon: 'star', hint: L('Healthcare, education, sport, mixed use', 'Sanitario, educativo, deportivo, mixto', 'Sanità, istruzione, sport, misto') },
  };
  const CATEGORIES = Object.keys(CATEGORY_UI).map((id) => Object.assign({ id, label: CATEGORY_LABELS[id] }, CATEGORY_UI[id]));

  /* ----- country packs (status: draft, to be validated by local professionals) ----- */
  const C = (code, currency, locale, languages, std, area, docs, reserved) => ({ code, currency, locale, languages, std, area, docs, reserved, status: 'draft' });
  const COUNTRIES = [
    C('AT', 'EUR', 'de-AT', ['de'], 'LBG 1992 · ÖNORM B 1802 · EVS/IVS', 'Nutzfläche (WEG 2002)',
      ['Grundbuchauszug, Lastenblatt C', 'Flächenwidmungs- und Bebauungsplan', 'Energieausweis'],
      L('sworn experts and bank valuers (mortgage lending value)', 'peritos jurados y tasadores bancarios (valor hipotecario)', 'periti giurati e valutatori delle banche (valore di garanzia)')),
    C('BE', 'EUR', 'nl-BE', ['nl', 'fr', 'de'], 'EVS/IVS', 'Bewoonbare oppervlakte / surface habitable',
      ['Hypothecair getuigschrift / État hypothécaire', 'Stedenbouwkundig uittreksel / Renseignements urbanistiques', 'EPC / PEB', 'Asbestattest Vlaanderen'],
      L('géomètres-experts and bank valuers', 'géomètres-experts y tasadores bancarios', 'géomètres-experts e valutatori delle banche')),
    C('CH', 'CHF', 'de-CH', ['de', 'fr', 'it'], 'Swiss Valuation Standards (SVS)', 'SIA 416',
      ['Grundbuchauszug / extrait du registre foncier', 'Lex Koller · Zweitwohnungen / résidences secondaires', 'GEAK / CECB'],
      L('bank valuers (Swiss Bankers Association guidelines)', 'tasadores bancarios (directrices de la ASB)', 'valutatori delle banche (direttive ASB)')),
    C('CZ', 'CZK', 'cs-CZ', ['cs'], 'Zákon 151/1997 Sb. · 39/2020 Sb.', 'Podlahová plocha',
      ['List vlastnictví z katastru', 'Kolaudace · územní plán', 'PENB'],
      L('registered experts (znalci) and qualified valuers', 'peritos inscritos (znalci) y tasadores cualificados', 'periti iscritti (znalci) e valutatori qualificati')),
    C('DE', 'EUR', 'de-DE', ['de'], '§194 BauGB · ImmoWertV 2021 · BelWertV', 'Wohnflächenverordnung (WoFlV)',
      ['Grundbuchauszug, Abt. II und III', 'Baulastenverzeichnis · Bebauungsplan', 'Energieausweis'],
      L('certified mortgage lending value valuers (BelWertV)', 'tasadores certificados del valor hipotecario (BelWertV)', 'periti certificati per il valore di garanzia (BelWertV)')),
    C('DK', 'DKK', 'da-DK', ['da'], 'LFFE · Finanstilsynet · EVS/IVS', 'BBR-areal',
      ['Tingbogsattest', 'Tilstandsrapport · elinstallationsrapport', 'Energimærke'],
      L('mortgage credit institution valuers', 'tasadores de las entidades de crédito hipotecario', 'valutatori degli istituti di credito ipotecario')),
    C('ES', 'EUR', 'es-ES', ['es'], 'Orden ECO/805/2003 · EVS/IVS', 'Superficie construida (Orden ECO/805/2003)',
      ['Nota simple del Registro de la Propiedad', 'Certificado catastral · cédula de habitabilidad', 'Certificado de eficiencia energética'],
      L('appraisal companies registered with the Banco de España', 'sociedades de tasación inscritas en el Banco de España', 'sociedades de tasación iscritte al Banco de España')),
    C('FR', 'EUR', 'fr-FR', ['fr'], 'Charte de l’expertise en évaluation immobilière · EVS/IVS', 'Loi Carrez / surface habitable',
      ['État hypothécaire', 'Certificat d’urbanisme · DAACT', 'DDT: DPE, amiante, plomb'],
      L('independent valuation experts', 'expertos en valoración independientes', 'esperti in valutazione indipendenti')),
    C('GB', 'GBP', 'en-GB', ['en'], 'RICS Red Book (UK national supplement)', 'IPMS 3 / GIA (m² and sq ft)',
      ['HM Land Registry title', 'Local authority searches LLC1 and CON29', 'EPC'],
      L('RICS Registered Valuers', 'RICS Registered Valuers', 'RICS Registered Valuers')),
    C('HR', 'EUR', 'hr-HR', ['hr'], 'Zakon o procjeni vrijednosti nekretnina (NN 78/15)', 'Neto korisna površina',
      ['Zemljišnoknjižni izvadak', 'Uporabna dozvola / rješenje o izvedenom stanju', 'Energetski certifikat'],
      L('permanent court experts and valuers', 'peritos y tasadores judiciales permanentes', 'periti e valutatori giudiziari permanenti')),
    C('HU', 'HUF', 'hu-HU', ['hu'], '25/1997 PM rendelet · MNB ajánlások', 'Hasznos alapterület',
      ['Tulajdoni lap', 'Használatbavételi engedély', 'Energetikai tanúsítvány'],
      L('registered valuers (decree 25/2007 PM)', 'tasadores inscritos en el registro (decreto 25/2007 PM)', 'valutatori iscritti al registro (25/2007 PM)')),
    C('IE', 'EUR', 'en-IE', ['en'], 'SCSI / RICS Red Book · PSRA', 'GIA',
      ['Folio, Tailte Éireann', 'Planning permission · certificate of compliance', 'BER'],
      L('SCSI or RICS qualified valuers', 'tasadores cualificados SCSI o RICS', 'valutatori qualificati SCSI o RICS')),
    C('IT', 'EUR', 'it-IT', ['it'], 'UNI 11612 · Linee guida ABI · Codice delle Valutazioni Immobiliari', 'Superficie commerciale (DPR 138/98)',
      ['Ispezioni ipotecarie', 'Stato legittimo urbanistico · conformità catastale', 'APE'],
      L('independent valuers, often UNI 11558 certified', 'peritos independientes, a menudo certificados UNI 11558', 'periti indipendenti, spesso certificati UNI 11558')),
    C('NL', 'EUR', 'nl-NL', ['nl'], 'NRVT · gevalideerd taxatierapport', 'NEN 2580',
      ['Kadastraal bericht eigendom', 'VvE: reservefonds · MJOP', 'Energielabel'],
      L('NRVT registered valuers with a validated report', 'tasadores registrados NRVT con informe validado', 'register-taxateur NRVT con rapporto validato')),
    C('NO', 'NOK', 'nb-NO', ['nb'], 'Avhendingslova (2022) · NS 3600', 'NS 3940:2023 (BRA-i)',
      ['Grunnbokutskrift', 'Tilstandsrapport', 'Energiattest'],
      L('surveyors (takstmann) and bank valuers', 'peritos (takstmann) y tasadores bancarios', 'periti (takstmann) e valutatori bancari')),
    C('PL', 'PLN', 'pl-PL', ['pl'], 'Ustawa o gospodarce nieruchomościami · Rozporządzenie 2023', 'Powierzchnia użytkowa',
      ['Księga wieczysta, dział III–IV', 'MPZP / decyzja WZ', 'Świadectwo charakterystyki energetycznej'],
      L('licensed property valuers (rzeczoznawca majątkowy)', 'tasadores habilitados (rzeczoznawca majątkowy)', 'periti abilitati (rzeczoznawca majątkowy)')),
    C('PT', 'EUR', 'pt-PT', ['pt'], 'Lei 153/2015 (CMVM) · DL 74-A/2017', 'Área bruta privativa',
      ['Certidão permanente do registo predial', 'Licença de utilização', 'Certificado energético'],
      L('valuers registered with the CMVM (peritos avaliadores)', 'peritos avaliadores registrados en la CMVM', 'peritos avaliadores registrati presso la CMVM')),
    C('RO', 'RON', 'ro-RO', ['ro'], 'SEV ANEVAR · OG 24/2011', 'Suprafață utilă',
      ['Extras de carte funciară', 'Certificat de urbanism · proces-verbal de recepție', 'Certificat de performanță energetică'],
      L('ANEVAR authorised valuers', 'tasadores autorizados ANEVAR', 'valutatori autorizzati ANEVAR')),
    C('SE', 'SEK', 'sv-SE', ['sv'], 'Fastighetsmäklarlag (2021:516) · EVS/IVS', 'Boarea (SS 21054)',
      ['Fastighetsutdrag, Lantmäteriet', 'BRF: årsredovisning', 'Energideklaration'],
      L('authorised or bank valuers', 'tasadores autorizados o bancarios', 'valutatori autorizzati o bancari')),
  ];
  // Names used in the project brief where the short ISO name differs (Intl gives “Czechia”, “United Kingdom”).
  // Official valuations framework named in the report (only where it is a single, well-known act).
  COUNTRIES.find((c) => c.code === 'ES').law = 'Orden ECO/805/2003';
  // The second document of a pack is a planning one, except where it covers other checks
  // (Lex Koller, condition reports, owners' associations and housing cooperatives).
  COUNTRIES.forEach((c) => {
    c.planningDoc = ['CH', 'DK', 'NL', 'NO', 'SE'].includes(c.code) ? '' : c.docs[1] || '';
    c.checkDocs = [c.docs[0] || '', c.planningDoc].concat(c.docs.slice(2)); // documents named by the checks (index = check.doc)
  });
  const NAME_OVERRIDE = { GB: L('England', 'Inglaterra', 'Inghilterra'), CZ: L('Czech Republic', 'República Checa', 'Repubblica Ceca') };

  /* ----- describing the property: keyword suggestions in Italian, Spanish and English (the AI can refine) ----- */
  const KEYWORDS = [
    [/\b(misto|mixed|mixto)\b|negozi?o?\b.*\bappartament|appartament.*\bnegozi|\blocal\b.*\bviviendas?\b|\bshop\b.*\b(flats?|apartments?)\b/, 'SPC.MIXED_USE'],
    [/cash ?(&|and|e|y)? ?carry/, 'WHO.CASH_AND_CARRY'],
    [/ingrosso|wholesale|mayorista/, 'WHO.WHOLESALE_WAREHOUSE'],
    [/showroom per operatori|trade showroom/, 'WHO.TRADE_SHOWROOM'],
    [/capannon|fabbric|produttiv|nave industrial|factory|production (building|plant)|planta industrial/, 'IND.PRODUCTION'],
    [/logistic/, 'IND.LOGISTICS'],
    [/data ?cent(er|re)|centro (de )?datos|centro dati/, 'IND.DATA_CENTRE'],
    [/magazzin|warehouse|almacen/, 'IND.WAREHOUSE'],
    [/laboratorio artigian|\bworkshop\b|\btaller\b/, 'IND.WORKSHOP'],
    [/centro commerciale|centro comercial|shopping (centre|center|mall)|\bmall\b|retail park/, 'RET.SHOPPING_CENTRE'],
    [/supermercat|supermercado|supermarket|ipermercat|grande superficie|gran superficie/, 'RET.SUPERMARKET'],
    [/ristorant|\bbar\b|pizzeri|trattori|restaurante|restaurant|cafeteria/, 'RET.FOOD_AND_BEVERAGE'],
    [/showroom/, 'RET.SHOWROOM'],
    [/negozi|vetrin|bottega|\bshop\b|local comercial|\blocal\b|tienda|\bstore\b/, 'RET.HIGH_STREET_SHOP'],
    [/studentat|student (residence|housing)|residenza (universitaria|per studenti)|residencia (de estudiantes|universitaria)|senior (living|housing)/, 'RES.COMMUNITY_RESIDENCE'],
    [/clinic|\brsa\b|ospedal|sanitar|hospital|care home|nursing home|residencia de (mayores|ancianos)|casa di cura/, 'SPC.HEALTHCARE'],
    [/aparthotel|\bresidence\b/, 'HOS.APARTHOTEL'],
    [/hotel|albergo|hostal\b/, 'HOS.HOTEL'],
    [/\bb ?& ?b\b|bed (and|&) breakfast|affittacamer|guest ?house|casa de huespedes|pension\b/, 'HOS.BED_AND_BREAKFAST'],
    [/ostell|hostel|albergue/, 'HOS.HOSTEL'],
    [/campegg|camping|villaggio turistico|holiday village/, 'HOS.CAMPSITE'],
    [/agritur|turismo rural|agritourism|farm stay/, 'HOS.AGRITOURISM'],
    [/casa vacanz|holiday (home|let|rental)|vivienda (turistica|vacacional)|vacation rental/, 'HOS.HOLIDAY_HOME'],
    [/coworking/, 'OFF.COWORKING'],
    [/edificio direzional|office building|edificio de oficinas|palazzo (per )?uffici/, 'OFF.OFFICE_BUILDING'],
    [/uffic|studio profession|\boffice|oficina|despacho/, 'OFF.OFFICE_UNIT'],
    [/agricol|agricultural|finca rustica|terreno rustico|farmland/, 'LND.AGRICULTURAL'],
    [/edificabile (produttiv|commercial|industrial)|suelo (industrial|terciario)|commercial (land|plot)/, 'LND.BUILDABLE_COMMERCIAL'],
    [/terren|lotto|edificabil|\bsolar\b|building plot|\bplot\b|\bland\b|parcela|\bsuelo\b/, 'LND.BUILDABLE_RESIDENTIAL'],
    [/posto auto|parking space|plaza de (garaje|aparcamiento|parking)|aparcamiento|\bparking\b/, 'ACC.PARKING_SPACE'],
    [/\bbox\b|garage|garaje|autorimessa/, 'ACC.GARAGE'],
    [/cantin|trastero|cellar|storage (room|unit)|soffitta|ripostiglio/, 'ACC.STORAGE'],
    [/scuol|universit|istruzion|school|colegio|escuela|asilo nido|nursery/, 'SPC.EDUCATION'],
    [/palestr|\bsport|piscin|\bgym|gimnasio|polideportivo|\bstadi/, 'SPC.SPORTS_LEISURE'],
    [/chiesa|church|iglesia|luogo di culto|place of worship|templo|mosque|moschea|synagog|sinagog/, 'SPC.WORSHIP'],
    [/stazione di servizio|distributore|gas station|petrol station|gasolinera|estacion de servicio|parcheggio multipiano|car park/, 'SPC.SERVICE_STATION_PARKING'],
    [/fabbricato (agricolo|rurale)|\bbarn\b|fienile|stalla|nave agricola|granero/, 'SPC.AGRICULTURAL_BUILDING'],
    [/schiera|terraced|adosad|townhouse/, 'RES.TERRACED_HOUSE'],
    [/bifamil|semi.?(indipendent|detached)|pareado|duplex/, 'RES.SEMI_DETACHED_HOUSE'],
    [/attico|penthouse|atico/, 'RES.PENTHOUSE'],
    [/\bloft\b/, 'RES.LOFT'],
    [/casale|rustic|masseria|cortijo|masia|farmhouse|cottage|baita/, 'RES.RURAL_HOUSE'],
    [/\bvilla\b/, 'RES.VILLA'],
    [/unifamil|indipendent|detached|chalet|casa (aislada|independiente)|single.family/, 'RES.DETACHED_HOUSE'],
    [/appartament|bilocal|trilocal|quadrilocal|monolocal|\bpiso\b|apartament|\bflat\b|apartment|condomin|\bcasa\b|vivienda|\bhouse\b|\bhome\b/, 'RES.APARTMENT'],
  ];
  const fold = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`´]/g, "'").toLowerCase();

  const byCode = {};
  TYPES.forEach((t) => { byCode[t.code] = t; });
  const lng = (lang) => (['en', 'es', 'it'].includes(lang) ? lang : 'en');
  const G = typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : {};
  // Italian, English and Spanish are in the label; the other languages come from the interface packs (UI_I18N.text).
  const pick = (o, lang) => (!o ? '' : ['en', 'es', 'it'].includes(lang) ? o[lang] || o.en || '' : G.UI_I18N && G.UI_I18N.text ? G.UI_I18N.text(o, lang) : o.en || '');

  function classifyType(text) {
    const q = fold(text).trim();
    if (q.length < 2) return null;
    for (const [re, code] of KEYWORDS) if (re.test(q) && byCode[code]) return { code, category: byCode[code].category };
    return null;
  }
  const typeByCode = (code) => byCode[code] || null;
  const categoryOf = (code) => { const t = byCode[code]; return t ? CATEGORIES.find((c) => c.id === t.category) : null; };
  const typesOf = (category) => TYPES.filter((t) => t.category === category);
  const typeLabel = (code, lang) => pick(byCode[code] && byCode[code].label, lang);
  const purposeLabel = (code, lang) => { const p = PURPOSES.find((x) => x.code === code); return p ? pick(p.label, lang) : ''; };
  const approachLabel = (code, lang) => pick(APPROACHES[code], lang);
  const country = (code) => COUNTRIES.find((c) => c.code === code) || null;
  function countryName(code, lang) {
    if (NAME_OVERRIDE[code]) return pick(NAME_OVERRIDE[code], lang);
    const l = /^[a-z]{2}$/.test(String(lang || '')) ? lang : lng(lang);
    try { return new Intl.DisplayNames([l], { type: 'region' }).of(code) || code; } catch (e) { return code; }
  }
  // "in Italy", "nei Paesi Bassi", "en la República Checa": the country with its preposition and article.
  const IN_OVERRIDE = { NL: L('in the Netherlands', 'en los Países Bajos', 'nei Paesi Bassi'), CZ: L('in the Czech Republic', 'en la República Checa', 'nella Repubblica Ceca') };
  function countryIn(code, lang) {
    if (IN_OVERRIDE[code]) return pick(IN_OVERRIDE[code], lang);
    return `${lng(lang) === 'es' ? 'en' : 'in'} ${countryName(code, lang)}`;
  }
  // Currency of a valuation: an explicit meta.currency, otherwise the currency of its country.
  function currencyOf(state) {
    const m = (state && state.meta) || {};
    if (/^[A-Z]{3}$/.test(String(m.currency || ''))) return m.currency;
    const c = country(m.country);
    return c ? c.currency : 'EUR';
  }
  function countries(lang) {
    const coll = new Intl.Collator(/^[a-z]{2}$/.test(String(lang || '')) ? lang : lng(lang), { sensitivity: 'base' });
    return COUNTRIES.slice().sort((a, b) => coll.compare(countryName(a.code, lang), countryName(b.code, lang)));
  }

  return { CATEGORIES, TYPES, PURPOSES, APPROACHES, COUNTRIES, classifyType, typeByCode, categoryOf, typesOf, typeLabel, purposeLabel, approachLabel, country, countryName, countryIn, currencyOf, countries, fold };
});
