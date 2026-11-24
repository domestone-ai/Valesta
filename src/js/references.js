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
/* References — the methodological sources of Valesta with their verification status: «content» (the point cited was
 * checked on the official text), «bibliographic» (only the bibliographic data were checked) or «tbv» (to be verified).
 * Generated from docs/methodology/5-bibliography.md; keep the two in step (tests/references.test.js checks it).
 * Pure data, no DOM. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.References = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const REFERENCES = [
    {
      "key": "IVSC-2025",
      "group": "standard",
      "country": null,
      "text": "International Valuation Standards Council. International Valuation Standards, effective 31 January 2025 (published January 2024). London: IVSC. ISBN 978-0-9931513-7-8.",
      "url": "https://www.ivsc.org/standards/",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "RICS-RB-2025",
      "group": "standard",
      "country": null,
      "text": "Royal Institution of Chartered Surveyors. RICS Valuation – Global Standards («Red Book»), 2025 edition, effective 31 January 2025.",
      "url": "https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/red-book/red-book-global",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "RICS-RB-UK",
      "group": "standard",
      "country": "GB",
      "text": "Royal Institution of Chartered Surveyors. RICS Valuation – Global Standards: UK national supplement, in effect from 31 May 2024.",
      "url": "https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/red-book/red-book-global",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "TEGOVA-EVS-2025",
      "group": "standard",
      "country": null,
      "text": "TEGoVA. European Valuation Standards 2025, tenth edition, effective 1 January 2025.",
      "url": "https://tegova.org/european-valuation-standards-evs",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "EU-CRR",
      "group": "eu",
      "country": null,
      "text": "Regulation (EU) No 575/2013 on prudential requirements for credit institutions, consolidated text of 1 January 2025.",
      "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02013R0575-20250101",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "EU-CRR3",
      "group": "eu",
      "country": null,
      "text": "Regulation (EU) 2024/1623 of 31 May 2024 amending Regulation (EU) No 575/2013 as regards requirements for credit risk, credit valuation adjustment risk, operational risk, market risk and the output floor; applies from 1 January 2025, with exceptions.",
      "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R1623",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "EU-MCD",
      "group": "eu",
      "country": null,
      "text": "Directive 2014/17/EU of 4 February 2014 on credit agreements for consumers relating to residential immovable property. OJ L 60, 28.2.2014, p. 34.",
      "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014L0017",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "EBA-GL-2020-06",
      "group": "eu",
      "country": null,
      "text": "European Banking Authority. Guidelines on loan origination and monitoring, EBA/GL/2020/06, final report of 29 May 2020, applying from 30 June 2021.",
      "url": "https://www.eba.europa.eu/regulation-and-policy/credit-risk/guidelines-on-loan-origination-and-monitoring",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "EU-EPBD-2024",
      "group": "eu",
      "country": null,
      "text": "Directive (EU) 2024/1275 of 24 April 2024 on the energy performance of buildings (recast).",
      "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024L1275",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "AT-LBG",
      "group": "national",
      "country": "AT",
      "text": "Liegenschaftsbewertungsgesetz, BGBl. Nr. 150/1992.",
      "url": "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003036",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "AT-WEG",
      "group": "national",
      "country": "AT",
      "text": "Wohnungseigentumsgesetz 2002.",
      "url": "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20001921",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "AT-EAVG",
      "group": "national",
      "country": "AT",
      "text": "Energieausweis-Vorlage-Gesetz 2012, BGBl. I Nr. 27/2012.",
      "url": "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20007799",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "BE-OVAM-ASBEST",
      "group": "national",
      "country": "BE",
      "text": "OVAM (Flemish public waste agency). Het asbestattest.",
      "url": "https://ovam.vlaanderen.be/asbestattest",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "HR-ZPVN",
      "group": "national",
      "country": "HR",
      "text": "Zakon o procjeni vrijednosti nekretnina, Narodne novine 78/2015.",
      "url": "https://narodne-novine.nn.hr/clanci/sluzbeni/2015_07_78_1491.html",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "HR-PRAVILNIK-105-15",
      "group": "national",
      "country": "HR",
      "text": "Pravilnik o metodama procjene vrijednosti nekretnina, Narodne novine 105/2015 (2 October 2015).",
      "url": "https://narodne-novine.nn.hr/clanci/sluzbeni/2015_10_105_2060.html",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "CZ-ZOM",
      "group": "national",
      "country": "CZ",
      "text": "Zákon č. 151/1997 Sb., o oceňování majetku.",
      "url": "https://e-sbirka.gov.cz/sb/1997/151",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "CZ-VYHL-441",
      "group": "national",
      "country": "CZ",
      "text": "Vyhláška č. 441/2013 Sb. (oceňovací vyhláška), as amended.",
      "url": "https://e-sbirka.gov.cz/sb/2013/441",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "DK-LFFE",
      "group": "national",
      "country": "DK",
      "text": "Lov om forbrugerbeskyttelse ved erhvervelse af fast ejendom m.v., consolidated act LBK nr. 1123 of 22 September 2015.",
      "url": "https://www.retsinformation.dk/eli/lta/2015/1123",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "FR-CHARTE-2017",
      "group": "national",
      "country": "FR",
      "text": "Charte de l'expertise en évaluation immobilière, 5th edition, March 2017, amended in 2022.",
      "url": "https://acpr.banque-france.fr/system/files/import/acpr/media/2021/11/05/20211105_notice.pdf",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "FR-CARREZ",
      "group": "national",
      "country": "FR",
      "text": "Loi n° 65-557 du 10 juillet 1965, art. 46.",
      "url": "https://legifrance.gouv.fr/loda/article_lc/LEGIARTI000028807508",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "FR-DECRET-97-532",
      "group": "national",
      "country": "FR",
      "text": "Décret n° 97-532 du 23 mai 1997 portant définition de la superficie privative d'un lot de copropriété.",
      "url": "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000566836",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "FR-CCH-R156-1",
      "group": "national",
      "country": "FR",
      "text": "Code de la construction et de l'habitation, art. R156-1.",
      "url": "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043819221",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "FR-CCH-L271-4",
      "group": "national",
      "country": "FR",
      "text": "Code de la construction et de l'habitation, art. L271-4 (dossier de diagnostic technique).",
      "url": "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049398848",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "DE-BAUGB-194",
      "group": "national",
      "country": "DE",
      "text": "Baugesetzbuch, § 194 Verkehrswert.",
      "url": "https://www.gesetze-im-internet.de/bbaug/__194.html",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "DE-IMMOWERTV",
      "group": "national",
      "country": "DE",
      "text": "Immobilienwertermittlungsverordnung vom 14. Juli 2021 (BGBl. I S. 2805), in force 1 January 2022.",
      "url": "https://www.gesetze-im-internet.de/immowertv_2022/",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "DE-BELWERTV",
      "group": "national",
      "country": "DE",
      "text": "Beleihungswertermittlungsverordnung.",
      "url": "https://www.gesetze-im-internet.de/belwertv/",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "DE-PFANDBG-16",
      "group": "national",
      "country": "DE",
      "text": "Pfandbriefgesetz, § 16 Beleihungswertermittlung.",
      "url": "https://www.gesetze-im-internet.de/pfandbg/__16.html",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "DE-WOFLV",
      "group": "national",
      "country": "DE",
      "text": "Wohnflächenverordnung, in force since 1 January 2004.",
      "url": "https://www.gesetze-im-internet.de/woflv/",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "DE-GMODG-87",
      "group": "national",
      "country": "DE",
      "text": "§ 87 «Pflichtangaben in einer Immobilienanzeige». The official portal now titles the act Gebäudemodernisierungsgesetz (GModG), formerly GEG.",
      "url": "https://www.gesetze-im-internet.de/geg/__87.html",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "HU-PM-25-1997",
      "group": "national",
      "country": "HU",
      "text": "25/1997. (VIII. 1.) PM rendelet a termőföldnek nem minősülő ingatlanok hitelbiztosítéki értékének meghatározására vonatkozó módszertani elvekről (state of 1 January 2024).",
      "url": "https://net.jogtar.hu/jogszabaly?docid=99700025.PM",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "HU-JHT-1997",
      "group": "national",
      "country": "HU",
      "text": "1997. évi XXX. törvény a jelzálog-hitelintézetről és a jelzáloglevélről.",
      "url": "https://njt.hu/jogszabaly/1997-30-00-00",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "IE-PSRA",
      "group": "national",
      "country": "IE",
      "text": "Property Services Regulatory Authority (Property Services (Regulation) Act 2011)",
      "url": "https://www.psr.ie/",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "IE-SEAI-BER",
      "group": "national",
      "country": "IE",
      "text": "Sustainable Energy Authority of Ireland. BER sales and rental guidelines.",
      "url": "https://www.seai.ie/ber/ber-advertising",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "IT-UNI11612",
      "group": "national",
      "country": "IT",
      "text": "UNI. UNI 11612:2015 Stima del valore di mercato degli immobili, in force since 10 December 2015.",
      "url": "https://store.uni.com/uni-11612-2015",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "IT-CVI",
      "group": "national",
      "country": "IT",
      "text": "Tecnoborsa. Codice delle Valutazioni Immobiliari – Italian Property Valuation Standard.",
      "url": "https://www.tecnoborsa.com/osservatorio/linee-guida-valutazioni-immobiliari-abi/",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "IT-ABI-LGVI-2022",
      "group": "national",
      "country": "IT",
      "text": "ABI and others. Linee guida per la valutazione degli immobili a garanzia delle esposizioni creditizie, 2022 edition (signed 5 April 2022).",
      "url": "https://www.tecnoborsa.com/osservatorio/linee-guida-valutazioni-immobiliari-abi/",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "IT-TUB-120DUODECIES",
      "group": "national",
      "country": "IT",
      "text": "D.Lgs. 1 settembre 1993, n. 385 (Testo unico bancario), art. 120-duodecies, inserted by D.Lgs. 21 aprile 2016, n. 72.",
      "url": "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1993-09-01;385~art120duodecies",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "IT-BDI-CIRC285",
      "group": "national",
      "country": "IT",
      "text": "Banca d'Italia. Circolare n. 285 del 17 dicembre 2013, Disposizioni di vigilanza per le banche.",
      "url": "https://www.bancaditalia.it/compiti/vigilanza/normativa/archivio-norme/circolari/c285/",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "IT-DPR138-1998",
      "group": "national",
      "country": "IT",
      "text": "D.P.R. 23 marzo 1998, n. 138, Allegato C (superficie catastale).",
      "url": "https://www.agenziaentrate.gov.it/portale/documents/20143/268000/dpr23032008_138_dpr_138_1998.pdf",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "NL-NRVT",
      "group": "national",
      "country": "NL",
      "text": "Nederlands Register Vastgoed Taxateurs. Reglement Wonen and practice guidance; agreement with the Ministry of Housing (September 2025).",
      "url": "https://www.nrvt.nl/voor-register-taxateurs/regelgeving/reglement-wonen/download",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "NL-NHG",
      "group": "national",
      "country": "NL",
      "text": "Nationale Hypotheek Garantie. Voorwaarden & Normen, explanatory note 2023-1.",
      "url": "https://www.nhg.nl/media/igijw31s/20221101-toelichting-vn-2023-1-def.pdf",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "NL-NEN2580",
      "group": "national",
      "country": "NL",
      "text": "NEN 2580 (area of buildings), as described by Statistics Netherlands.",
      "url": "https://www.cbs.nl/nl-nl/onze-diensten/methoden/begrippen/gebruiksoppervlakte-zelfstandige-woningen",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "NO-NS3940",
      "group": "national",
      "country": "NO",
      "text": "Standard Norge. NS 3940:2023 Areal- og volumberegninger av bygninger.",
      "url": "https://standard.no/globalassets/kurs-arrangement-og-radgiving/standard-morgen-og-andre-arr/areal--og-volumberegninger/ns_3940_2023_standard_morgen_aarnes.pdf",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "PL-ROZP-2023",
      "group": "national",
      "country": "PL",
      "text": "Rozporządzenie Ministra Rozwoju i Technologii z dnia 5 września 2023 r. w sprawie wyceny nieruchomości (Dz.U. 2023 poz. 1832).",
      "url": "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20230001832",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "PT-LEI-153-2015",
      "group": "national",
      "country": "PT",
      "text": "Lei n.º 153/2015, de 14 de setembro.",
      "url": "https://diariodarepublica.pt/dr/detalhe/lei/153-2015-70280712",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "PT-DL-74A-2017",
      "group": "national",
      "country": "PT",
      "text": "Decreto-Lei n.º 74-A/2017, de 23 de junho.",
      "url": "https://diariodarepublica.pt/dr/detalhe/decreto-lei/74-a-2017-107561581",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "RO-OG-24-2011",
      "group": "national",
      "country": "RO",
      "text": "Ordonanța Guvernului nr. 24/2011, approved by Legea nr. 99/2013; consolidated text published by ANEVAR.",
      "url": "https://www.anevar.ro/images/documente/og_24_2011_versiune_consolidata.pdf",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "RO-ANEVAR-SEV",
      "group": "national",
      "country": "RO",
      "text": "ANEVAR. Standardele de evaluare a bunurilor, 2022 edition.",
      "url": "https://www.anevar.ro",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "ES-ECO805",
      "group": "national",
      "country": "ES",
      "text": "Orden ECO/805/2003, de 27 de marzo, sobre normas de valoración de bienes inmuebles y de determinados derechos para ciertas finalidades financieras. BOE núm. 85, 9 April 2003; consolidated text, last updated 12 June 2025.",
      "url": "https://www.boe.es/buscar/act.php?id=BOE-A-2003-7253",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "ES-ECM599-2025",
      "group": "national",
      "country": "ES",
      "text": "Orden ECM/599/2025, de 10 de junio, por la que se modifica la Orden ECO/805/2003. BOE núm. 141, 12 June 2025.",
      "url": "https://www.boe.es/buscar/doc.php?id=BOE-A-2025-11815",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "ES-RD775-1997",
      "group": "national",
      "country": "ES",
      "text": "Real Decreto 775/1997, de 30 de mayo, sobre el régimen jurídico de homologación de los servicios y sociedades de tasación. BOE núm. 141, 13 June 1997.",
      "url": "https://www.boe.es/buscar/act.php?id=BOE-A-1997-12854",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "ES-BDE-TASACION",
      "group": "national",
      "country": "ES",
      "text": "Banco de España. Appraisal companies and services.",
      "url": "https://www.bde.es/wbe/en/areas-actuacion/normativa/regulacion-sistema-financiero/sociedades-de-tasacion.html",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "ES-RD390-2021",
      "group": "national",
      "country": "ES",
      "text": "Real Decreto 390/2021, de 1 de junio, por el que se aprueba el procedimiento básico para la certificación de la eficiencia energética de los edificios. BOE núm. 131, 2 June 2021.",
      "url": "https://www.boe.es/buscar/act.php?id=BOE-A-2021-9176",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "SE-FML-2021",
      "group": "national",
      "country": "SE",
      "text": "Fastighetsmäklarlag (2021:516).",
      "url": "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/fastighetsmaklarlag-2021516_sfs-2021-516/",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "SE-SS21054",
      "group": "national",
      "country": "SE",
      "text": "Svenska institutet för standarder. SS 21054:2020 Area och volym för husbyggnader – Terminologi och mätregler.",
      "url": "https://www.sis.se/en/produkter/construction-materials-and-building/buildings/general/ss-210542020/",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "SE-BOVERKET-ED",
      "group": "national",
      "country": "SE",
      "text": "Boverket. Dessa byggnader ska energideklareras.",
      "url": "https://www.boverket.se/sv/energideklaration/energideklaration/dessa-byggnader-ska-energideklareras/",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "CH-SBVG",
      "group": "national",
      "country": "CH",
      "text": "Swiss Bankers Association. Guidelines on examining, valuing and processing mortgage-backed loans, and minimum requirements for mortgage financing, recognised by FINMA.",
      "url": "https://www.swissbanking.ch/en/topics/regulation-and-compliance/mortgage-market-regulation",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "CH-BEWG",
      "group": "national",
      "country": "CH",
      "text": "Bundesgesetz über den Erwerb von Grundstücken durch Personen im Ausland (BewG), SR 211.412.41.",
      "url": "https://www.admin.ch/ch/d/sr/2/211.412.41.de.pdf",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "CH-ZWG",
      "group": "national",
      "country": "CH",
      "text": "Bundesgesetz über Zweitwohnungen (Zweitwohnungsgesetz, ZWG) vom 20. März 2015, SR 702.",
      "url": "https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2015/886/20241001/de/pdf-a/fedlex-data-admin-ch-eli-cc-2015-886-20241001-de-pdf-a-3.pdf",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "GB-RICS-VRS",
      "group": "national",
      "country": "GB",
      "text": "Royal Institution of Chartered Surveyors. Valuer registration.",
      "url": "https://www.rics.org/regulation/regulatory-schemes/valuer-registration",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "GB-RICS-PM2",
      "group": "national",
      "country": "GB",
      "text": "Royal Institution of Chartered Surveyors. RICS property measurement, 2nd edition.",
      "url": "https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/real-estate-standards/rics-property-measurement-2nd-edition",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "GB-EPC-GUIDE",
      "group": "national",
      "country": "GB",
      "text": "Department for Communities and Local Government. A guide to energy performance certificates for the marketing, sale and let of dwellings.",
      "url": "https://assets.publishing.service.gov.uk/media/5a821a74ed915d74e3401be1/A_guide_to_energy_performance_certificates_for_the_marketing__sale_and_let_of_dwellings.pdf",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "GB-HOW-TO-SELL",
      "group": "national",
      "country": "GB",
      "text": "Ministry of Housing, Communities and Local Government. How to sell a home.",
      "url": "https://assets.publishing.service.gov.uk/media/5d72296740f0b6094e69564c/6.5492_-_MHCLG_-_How_to_Sell_Guide_WEB.PDF",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "AI-ARE-16",
      "group": "literature",
      "country": null,
      "text": "Appraisal Institute (2026). The Appraisal of Real Estate, 16th edition. Chicago: Appraisal Institute. ISBN 978-1-935328-98-8.",
      "url": "https://www.appraisalinstitute.org/insights-and-resources/resources/books/the-appraisal-of-real-estate-16th-edition",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "PAGOURTZI-2003",
      "group": "literature",
      "country": null,
      "text": "Pagourtzi, E.; Assimakopoulos, V.; Hatzichristos, T.; French, N. (2003). Real estate appraisal: a review of valuation methods. Journal of Property Investment & Finance 21(4), 383–401. doi:10.1108/14635780310483656.",
      "url": "",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "ROSEN-1974",
      "group": "literature",
      "country": null,
      "text": "Rosen, S. (1974). Hedonic Prices and Implicit Markets: Product Differentiation in Pure Competition. Journal of Political Economy 82(1), 34–55. doi:10.1086/260169.",
      "url": "",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "FRENCH-GABRIELLI-2004",
      "group": "literature",
      "country": null,
      "text": "French, N.; Gabrielli, L. (2004). The uncertainty of valuation. Journal of Property Investment & Finance 22(6), 484–500. doi:10.1108/14635780410569470.",
      "url": "",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "STUDENT-1908",
      "group": "statistics",
      "country": null,
      "text": "Student (1908). The Probable Error of a Mean. Biometrika 6(1). doi:10.1093/biomet/6.1.1.",
      "url": "",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "KISH-1965",
      "group": "statistics",
      "country": null,
      "text": "Kish, L. (1965). Survey Sampling. New York: John Wiley & Sons (reprinted 1995, ISBN 978-0-471-10949-5).",
      "url": "https://www.wiley.com/en-us/Survey+Sampling-p-9780471109495",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "GSL-WSTATS",
      "group": "statistics",
      "country": null,
      "text": "GNU Scientific Library 2.8 documentation, Statistics – Weighted Samples, function gsl_stats_wvariance.",
      "url": "https://www.gnu.org/software/gsl/doc/html/statistics.html",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "HYNDMAN-FAN-1996",
      "group": "statistics",
      "country": null,
      "text": "Hyndman, R.J.; Fan, Y. (1996). Sample Quantiles in Statistical Packages. The American Statistician 50(4), 361–365. doi:10.1080/00031305.1996.10473566.",
      "url": "",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "MS-TRIMMEAN",
      "group": "statistics",
      "country": null,
      "text": "Microsoft Support. TRIMMEAN function.",
      "url": "https://support.microsoft.com/en-us/office/trimmean-function-d90c9878-a119-4746-88fa-63d988f511d3",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "MS-QUARTILE-INC",
      "group": "statistics",
      "country": null,
      "text": "Microsoft Support. QUARTILE.INC function.",
      "url": "https://support.microsoft.com/en-us/office/quartile-inc-function-1bbacc80-5075-42f1-aed6-47d735c4819d",
      "status": "content",
      "date": "2026-11-24"
    },
    {
      "key": "TUKEY-1977",
      "group": "statistics",
      "country": null,
      "text": "Tukey, J.W. (1977). Exploratory Data Analysis. Reading, Mass.: Addison-Wesley. ISBN 0-201-07616-0.",
      "url": "",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "METROPOLIS-ULAM-1949",
      "group": "statistics",
      "country": null,
      "text": "Metropolis, N.; Ulam, S. (1949). The Monte Carlo Method. Journal of the American Statistical Association 44(247), 335–341. doi:10.1080/01621459.1949.10483310.",
      "url": "",
      "status": "bibliographic",
      "date": "2026-11-24"
    },
    {
      "key": "JCGM-101-2008",
      "group": "statistics",
      "country": null,
      "text": "Joint Committee for Guides in Metrology (2008). JCGM 101:2008 Evaluation of measurement data – Supplement 1 to the «Guide to the expression of uncertainty in measurement» – Propagation of distributions using a Monte Carlo method, first edition. BIPM. doi:10.59161/JCGM101-2008.",
      "url": "https://www.bipm.org/en/committees/jc/jcgm/publications",
      "status": "bibliographic",
      "date": "2026-11-24"
    }
  ];
  // EU member states among the countries of the packs: the EU rules on valuations for loan security apply there.
  const EU = ['AT', 'BE', 'CZ', 'DE', 'DK', 'ES', 'FR', 'HR', 'HU', 'IE', 'IT', 'NL', 'PL', 'PT', 'RO', 'SE'];
  const byKey = {};
  REFERENCES.forEach((r) => { byKey[r.key] = r; });
  const get = (key) => byKey[key] || null;
  const international = () => REFERENCES.filter((r) => r.group === 'standard' && !r.country);
  const euRules = (cc) => (EU.includes(cc) ? REFERENCES.filter((r) => r.group === 'eu') : []);
  const byCountry = (cc) => REFERENCES.filter((r) => r.country === cc);
  const literature = () => REFERENCES.filter((r) => r.group === 'literature' || r.group === 'statistics');
  // The literature behind the method of the report: comparison and hedonic pricing, valuation uncertainty, and the
  // statistics of the confidence interval and of the simulation.
  const METHOD_KEYS = ['AI-ARE-16', 'PAGOURTZI-2003', 'ROSEN-1974', 'FRENCH-GABRIELLI-2004', 'STUDENT-1908', 'KISH-1965', 'GSL-WSTATS',
    'HYNDMAN-FAN-1996', 'METROPOLIS-ULAM-1949', 'JCGM-101-2008'];
  const method = () => METHOD_KEYS.map(get).filter(Boolean);
  return { REFERENCES, EU, get, international, euRules, byCountry, literature, method };
});
