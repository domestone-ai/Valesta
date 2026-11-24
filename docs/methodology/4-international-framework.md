# Part 4 — International and European framework

Status: draft for technical review, 24 November 2026. Code references point to this version of the repository.

## 4.1 Purpose

The Valesta report refers to the international and European standards in several places:

- **the cover;**
- **the basis of value:** `src/js/report_i18n.js:466` (`mvDef`), `src/js/report_i18n.js:467` (`mvCite`);
- **the list of standards:** `src/js/report_i18n.js:472` (`stds`);
- **the methodological references** of the sources chapter, with their verification status:
  `src/js/report.js:1113` (`function pRefs`).

The pre-release code also cited IVS sections and RICS VPS numbers in the uncertainty section, the method introduction,
the reconciliation note, the list of standards and two quality checks. Those that could not be verified on the texts
were removed (finding F-16); §4.2 and §4.3 record them.

This part records what was verified about those standards. It also covers the EU rules on valuations for loan
security, which decide who may value property for mortgage lending in the EU countries (see the
[country cards](countries/README.md)).

The full texts of the IVS, the Red Book and the EVS are not freely reproducible. This document verifies their titles,
editions and dates and cites them by title. Where the app cites a specific chapter whose content could not be read,
the citation stays «to be verified» (finding F-16).

## 4.2 International Valuation Standards (IVS)

### Edition

- **The current edition** has been effective since 31 January 2025 [IVSC-2025]. RICS states that it was published on
  31 January 2024 [RICS-RB-2025].
- **A new edition may follow.** IVSC consulted on an exposure draft in 2026, and RICS plans a Red Book 2028 after the
  updated IVS [RICS-RB-2025]. Check the edition before relying on the numbering below.
- **Access.** The standards are available from IVSC as a PDF after registration, under IVSC's terms of use, or in
  print (ISBN 978-0-9931513-7-8).

### Structure

| Number | Title |
|---|---|
| IVS 100 | Valuation Framework |
| IVS 101 | Scope of Work |
| IVS 102 | Bases of Value |
| IVS 103 | Valuation Approaches |
| IVS 104 | Data and Inputs |
| IVS 105 | Valuation Models |
| IVS 106 | Documentation and Reporting |
| IVS 400 | Real Property Interests |
| IVS 410 | Development Property |

### Citations in the app

| Where the app cites it | What it says | Check |
|---|---|---|
| Basis of value: `src/js/report_i18n.js:467` (`mvCite`) | «IVS 102» for the market value definition | IVS 102 is Bases of Value: consistent. The definition quoted by the report is substantively the same as the one in art. 4(1)(76) of the CRR [EU-CRR], which is worded for property. |
| List of standards: `src/js/report_i18n.js:473` (`IVS 102 Bases of Value`) | IVS 102, 103, 104 and 106 with their titles | consistent with the titles |
| Letter to the client: `src/js/report_i18n.js:582` (`International Valuation Standards (IVS 2025)`) | the valuation follows the principles of IVS 2025, the RICS Red Book and EVS 2025 | editions confirmed; conformity is a claim of the signatory, not checked here |
| Declaration: `src/js/report_i18n.js:596` (`IVS 2025, the RICS Red Book and EVS 2025`) | the advisor applied the principles of these standards | as above |

The pre-release code also cited, without a verified basis in the texts (finding F-16), and this version no longer cites:

| Where | What it said | Check |
|---|---|---|
| Selection of comparables | IVS 104 for documenting discarded comparables | IVS 104 is Data and Inputs: consistent by title; content to be verified |
| Uncertainty | IVS 104 / RICS VPS 6 as the reference for reporting uncertainty | the public pages do not show where IVS 2025 deals with valuation uncertainty |
| Quality check on photos | IVS 106 recommends documenting the inspection | IVS 106 is Documentation and Reporting; content to be verified |
| Quality check on purpose | IVS 101 and RICS VPS 1 require the purpose to be stated | IVS 101 is Scope of Work: consistent by title; content to be verified |
| Reconciliation note | IVS 103 for weights by reliability | IVS 103 is Valuation Approaches: consistent by title |
| Method introduction | the market approach of IVS 103 is «the preferred method» for residences | «preferred method» not found on the public pages |

IVS 2025 has a standard on valuation models (IVS 105). This folder is the documentation of Valesta's model. Whether it
meets IVS 105 must be checked against the text.

## 4.3 RICS Valuation – Global Standards (Red Book)

- **Edition.** The 2025 edition has been effective since 31 January 2025. RICS states that it aligns with the IVS
  published in January 2024 and that each valuation technical and performance standard (VPS) cross-references the IVS
  [RICS-RB-2025].
- **UK national supplement.** It has been in effect since 31 May 2024 [RICS-RB-UK].
- **Next edition.** RICS plans a Red Book 2028.

The pre-release code cited four Red Book standards by number: VPS 1 (scope), VPS 2 (bases of value), VPS 3 (approaches)
and VPS 6 (reports). RICS refused automated access to the PDF of the 2025 edition, so the numbering could not be
checked, and this version cites the Red Book by title and edition:
`src/js/report_i18n.js:474` (`RICS Valuation – Global Standards, 2025 edition`) (finding F-16). The numbering is to be
verified on a copy of the edition.

## 4.4 European Valuation Standards (EVS)

The current edition is EVS 2025, the tenth edition, effective since 1 January 2025 [TEGOVA-EVS-2025]. TEGoVA's pages
confirm that it contains:

- EVS 6 Valuation and Energy Efficiency;
- European Valuation Guidance Note 2 on Valuation for Mortgage Lending;
- Part VI Valuation and Sustainability;
- Part X European Union Legislation and Property Valuation.

The full list of standards was not confirmed.

Where EVS matters for Valesta:

- **Energy factor.** Its description cites «EVS 2025, ESG factors»: `src/js/engine.js:86` (`EVS 2025, ESG factors`).
  Its δ is the smallest of all, 1% per level (Part 1, §1.6).
- **Mortgage lending.** The guidance note on valuation for mortgage lending is the European professional reference.

## 4.5 EU rules on valuations for loan security

### Capital Requirements Regulation (CRR)

Regulation (EU) No 575/2013 [EU-CRR], as amended by Regulation (EU) 2024/1623, which has applied from 1 January 2025
[EU-CRR3]:

- **Art. 4(1)(76): market value.** Substantively the same definition as the one Valesta's report quotes, worded for
  property.
- **Art. 4(1)(74): mortgage lending value.** A prudent assessment of the future marketability of the property.
- **Art. 4(1)(74a): property value.** The value determined under art. 229(1).
- **Art. 229(1): valuation of immovable property.** It requires:
  - an independent valuer with the necessary qualifications, ability and experience, independent from the credit
    process;
  - prudently conservative criteria: no expected price increases, and an adjustment where the market value is above a
    sustainable level;
  - a transparent record;
  - a value not above market value;
  - limits on upward revaluations.
- **Art. 208(3): monitoring of property values.** When the value may have declined materially, a qualified valuer
  independent from the credit decision process reviews it.

### Mortgage Credit Directive (MCD)

Directive 2014/17/EU, art. 19 [EU-MCD]. Member States must:

- ensure reliable standards for valuing residential property for mortgage lending;
- require that internal and external appraisers are professionally competent and sufficiently independent from the
  credit underwriting process;
- require the valuation to be documented in a durable medium.

### EBA guidelines on loan origination and monitoring

EBA/GL/2020/06, applying from 30 June 2021 [EBA-GL-2020-06].

| Paragraphs | Content |
|---|---|
| 207 | Collateral is valued under international, European and national standards; the guidelines name IVS, EVS and RICS. |
| 208 | Valuers take ESG factors into account, such as energy efficiency. |
| 209–210 | At origination, a full inspection, inside and out, by an internal or external valuer. For residential property in mature markets, a desktop valuation supported by advanced statistical models is allowed, with the valuer still responsible. |
| 231–235 (section 7.3) | The valuer: is competent and meets professional requirements; has the skills, experience and knowledge of the market and of the purpose; is independent from the credit decision; is paid in a way not linked to the result; has no conflicts of interest; is rotated. |
| 236–239 (section 7.4) | Advanced statistical models must be property- and location-specific, backtested against observed transaction prices, built on a large and representative sample, and up to date. |

### Energy Performance of Buildings Directive (EPBD)

Directive (EU) 2024/1275, art. 19 [EU-EPBD-2024]. By 29 May 2026, energy performance certificates follow a common
template and state a class on a closed scale from A to G. Member States may use A0 for zero-emission buildings and may
add A+.

Valesta's suggested energy rating scores the classes A to G, and maps A0, A+, A++, A+++ and the Italian A4–A1 onto A and
the German H below G (finding F-18, fixed; the pre-release code scored A to G only).

### What this means for Valesta

1. **A Valesta report is a market valuation by an advisor.** It does not claim to be a valuation for loan security,
   and says so: `src/js/report_i18n.js:480` (`nature`).
2. **A valuation for loan security** in the EU needs an independent, qualified valuer under the CRR, the MCD and the
   national rules (see the country cards).
3. **Valesta does not compute the «property value» of the CRR.** That value is prudently conservative and excludes
   expected price increases. Valesta computes only market value (Part 1, §1.2).
4. **Valesta's coefficient model is not an advanced statistical model** in the sense of the EBA guidelines. Its δ
   values are not backtested against transaction prices (Part 1, §1.6).

## 4.6 Summary: requirements and Valesta

| Requirement | Source | What Valesta does | Open point |
|---|---|---|---|
| Purpose and basis of value stated | IVS 101, IVS 102 (by title) | purpose field, quality check, market value | content of the IVS to be verified |
| Data documented, sample representative and traceable | IVS 104 (by title); art. 22.1.c of [ES-ECO805]: a representative sample, abnormal prices screened out, sources traceable | sources, URLs and exclusion reasons in the report | asking prices dominate the samples (F-04) |
| Weights of comparables and approaches justified | art. 22.1.d of [ES-ECO805]; IVS 103 (by title) | weights printed | no written reasoning (F-14) |
| Model documented | IVS 105 (by title) | this folder | to be checked against the text |
| Energy efficiency considered | EVS 6 [TEGOVA-EVS-2025]; para. 208 of [EBA-GL-2020-06] | energy factor | scale A–G only (F-18) |
| Independent, qualified valuer for loan security | art. 229(1) of [EU-CRR]; art. 19 of [EU-MCD]; section 7.3 of [EBA-GL-2020-06] | not claimed: the report disclaims it | — |
| Prudent value for loan security | art. 229(1)(b) of [EU-CRR] | not computed | outside the scope of Valesta |
