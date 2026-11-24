# Spain (ES)

Status: draft for validation by a local professional. Sources checked on 24 November 2026.

## Pack in the app

The pack is `src/js/taxonomy.js:145` (`C('ES'`). The report names the order as the official framework:
`src/js/taxonomy.js:187` (`law = 'Orden ECO/805/2003'`).

| Field | Value in the pack |
|---|---|
| Standards | «Orden ECO/805/2003 · EVS/IVS» |
| Area | «Superficie construida (Orden ECO/805/2003)» |
| Documents | nota simple of the land registry; cadastral certificate and *cédula de habitabilidad*; energy certificate |
| Reserved valuations | appraisal companies registered with the Banco de España |

## 1. Valuation norms and standards

| Item | Status | Source |
|---|---|---|
| Orden ECO/805/2003 sets the rules for valuations made for certain financial purposes, such as mortgage lending. It defines the cost, comparison, income and residual methods (art. 15.1 and following). | Confirmed | [ES-ECO805] |
| Orden ECM/599/2025 amends it from 12 August 2025: new useful-area definition, documentation, and art. 15 bis on automated valuation models. | Confirmed | [ES-ECM599-2025] |
| Real Decreto 775/1997 regulates the approval (homologación) of appraisal companies and services. | Confirmed | [ES-RD775-1997] |
| International standards (EVS, IVS) | Confirmed as editions | [TEGOVA-EVS-2025], [IVSC-2025] |

## 2. Area measurement

Art. 4 of the order defines three areas:

| Item | Status | Source |
|---|---|---|
| *Superficie útil* (useful area): floor area inside the inner face of the external walls. It excludes interior partitions and structural elements, ducts larger than 100 cm² and areas lower than 1.5 m. Since the amendment of 2025 it also excludes exterior spaces, which are tabulated and valued separately (art. 5.1.d). | Confirmed | [ES-ECO805], [ES-ECM599-2025] |
| *Superficie construida* (built area): the useful area plus the interior elements, with façade walls at 100% and walls shared with other units at 50% | Confirmed | [ES-ECO805] |
| *Superficie construida con partes comunes* (built area with common parts): the built area plus the unit's share of the common parts, according to its quota | Confirmed | [ES-ECO805] |

The report's definition of useful area follows the 2025 amendment: `src/js/report_i18n.js:503` (`since the 2025 amendment`).
Version 1.0.0 still counted covered private outdoor space at 50% (finding F-15, fixed).

## 3. Typical documents

Art. 8.1 of the order, as amended in 2025, lists the documents required for a valuation [ES-ECO805]:

| Document | Status | Source |
|---|---|---|
| Registry certificate of ownership, charges and description, at most 3 months old. A *nota simple* is accepted for mortgage valuations (art. 2.a). | Confirmed | [ES-ECO805], art. 8.1 |
| Cadastral descriptive and graphic information from the Catastro's e-office, at most 3 months old | Confirmed | [ES-ECO805], art. 8.1 |
| Registered energy performance certificate, for finished buildings | Confirmed | [ES-ECO805], art. 8.1; [ES-RD390-2021] |
| *Cédula de habitabilidad* or licence of first occupation | To be verified: these are regional instruments, and the regional rules were not checked | — |

## 4. Valuations for mortgage lending: who signs

| Item | Status | Source |
|---|---|---|
| Valuations under the order are issued by an *entidad tasadora*: an approved appraisal company registered with the Banco de España or, for mortgage valuations, an approved appraisal service of a credit institution | Confirmed | [ES-ECO805], art. 4; [ES-RD775-1997]; [ES-BDE-TASACION] |

## Differences from the app pack

- **Reserved valuations.** The pack mentions only appraisal companies. Add the appraisal services of credit
  institutions.
- **Area definition.** The report's definition of useful area follows the order as amended in 2025 (F-15, fixed in
  this version).
- **Documents.** The pack could list the documents of art. 8.1 with their 3-month limit.
