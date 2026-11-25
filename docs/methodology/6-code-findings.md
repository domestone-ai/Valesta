# Findings: code, report texts and sources

Status: draft, 24 November 2026. The findings were made on the pre-release code, which was not published. Code
references with a line number point to version 1.0.0 of the repository; quotations of the pre-release code have no line
number.

While the methodology was being documented, the code, the report texts and the sources were compared. This file lists
every difference found and its status in this version. The fixes follow the proposal in
[7-proposal-report-app.md](7-proposal-report-app.md), approved by Domestone S.r.l. on 24 November 2026, and are part
of version 1.0.0 (`CHANGELOG.md`).

Severity:

- **High:** it can change a value without the valuer noticing.
- **Medium:** it can mislead a reader of the report, or it states something unsupported.
- **Low:** wording, or an edge case.

| Id | Severity | Topic | Status |
|---|---|---|---|
| F-01 | High | Default negotiation coefficient: 1.00 in the engine, 0.94 in the report and the simulation | fixed |
| F-02 | High | New valuations inherit the demo's market inputs | fixed |
| F-03 | Medium | The estimator sensitivity table ignores deductions and reconciliation | fixed |
| F-04 | Medium | The report always speaks of «asking prices» | fixed |
| F-05 | Low | «Inverse» instead of «complement» of the gross adjustment | fixed |
| F-06 | Low | Area basis: method text and comparables' areas | partly fixed |
| F-07 | Low | Confidence interval of the median and trimmed mean | partly fixed |
| F-08 | Low | Rounding steps that do not depend on the currency | fixed |
| F-09 | Medium | Spain-specific texts and rules used in every country | fixed |
| F-10 | Medium | Unsourced negotiation margin of 5–10% | fixed |
| F-11 | Medium | The «MCA» label | fixed |
| F-12 | Low | Glossary: confidence interval and «asking price» | fixed |
| F-13 | Medium | Approaches listed but not computed | partly fixed |
| F-14 | Medium | Reconciliation weights without reasoning | fixed |
| F-15 | Medium | Spanish useful-area definition outdated | fixed |
| F-16 | Medium | Citations of the standards to be verified | fixed |
| F-17 | Low | Comparable without a source: two different defaults | fixed |
| F-18 | Low | Energy classes outside A–G are not scored | fixed |
| F-19 | Medium | Corrections to the country packs | open |
| F-20 | High | Overrides set by the AI tools are never shown | fixed |
| F-21 | Medium | Values without a sales-comparison basis, and warnings that contradict them | fixed |
| F-22 | Medium | The confidence interval is presented as the property's value range | fixed |
| F-23 | Low | The estimator name is not checked | fixed |
| F-24 | Low | A new-build comparable is always rated older than the subject | fixed |
| F-25 | Medium | The result text claims agreement between estimators whatever their spread | fixed |
| F-26 | Low | The Spanish area definitions are shown for every country | open |
| F-27 | High | Opening a saved valuation drops its other approaches and their reasoning | fixed |

## F-01 — Default negotiation coefficient

- **What happened (pre-release).** When `settings.negotiationDefault` was missing, the engine used 1.00, the report text
  said 0.94, and the Monte Carlo varied the coefficient around 0.94. The setting can be missing inside the app (the
  valuer can empty the field, the AI tools can clear it) and in the saved files that the MCP server reads. On the demo
  the value rose from 518,000 to 551,000 while the report still said 0.94, and the whole P10–P90 band lay below the
  value.
- **Status: fixed.** One default, defined in the engine and used everywhere: `src/js/engine.js:226` (`function negotiationDefault`).
  - The simulation: `src/js/engine.js:569` (`const neg0 = negotiationDefault`).
  - The report: `src/js/report.js:352` (`MCA().negotiationDefault`).

## F-02 — New valuations inherit the demo's market inputs

- **What happened (pre-release).** A new valuation copied the settings of the valuation that was open or, at the start,
  those of the synthetic Spanish demo, including two market inputs: an annual time trend of 8.1% and annex values of
  18,000 and 4,000. A valuer who did not change them carried a fictitious market into a real valuation.
- **Status: fixed.** New valuations start with no time trend and no annex values, and the market inputs are marked as
  unconfirmed: `src/js/appcore.js:337` (`marketConfirmed: false`). The quality review asks the valuer to confirm them,
  together with the negotiation coefficient, and flags files saved before this version that still carry the demo's
  inputs: `src/js/review.js:147` (`const demoInputs`). The AI tools cannot confirm them for the valuer:
  `src/js/aitools.js:231` (`settings.marketConfirmed`).

## F-03 — The estimator sensitivity table ignores deductions and reconciliation

- **What happened (pre-release).** The table recomputed the value of each estimator as unit value × area + annexes,
  rounded, leaving out deductions and the reconciliation, and measured its changes against the final value, which
  includes them.
- **Status: fixed.** Every row is computed by the engine: `src/js/report.js:1063` (`function sensitivityRows`).

## F-04 — The report always speaks of «asking prices»

- **What happened (pre-release).** The assumptions and the note under the sample table described the comparables as
  published asking prices, even when they were land-registry or closed sales, in every language.
- **Status: fixed.** The wording follows the sources used (asking, transaction or both): `src/js/report.js:325` (`ctx.priceKind =`).
  The scope, the selection criteria, the sample and the market text speak of comparables, not of offers, and the
  negotiation sentence of the market text is left out when all prices are closing prices:
  `src/js/report_i18n.js:590` (`c.priceKind === 'closed' ? '' :`).

## F-05 — «Inverse» instead of «complement» of the gross adjustment

- **What happened (pre-release).** The result text called similarity «the inverse of the gross adjustment», while the
  code uses 1 − G with a minimum of 0.2.
- **Status: fixed** in all languages: `src/js/report_i18n.js:593` (`complement of the gross adjustment`).

## F-06 — Area basis

- **What happened (pre-release).** The method chapter always said that the unit price uses the comparable's built area,
  also with the basis `useful`.
- **Status: partly fixed.** The step now names the area basis: `src/js/report_i18n.js:513` (`Cleansed price divided by the`).
  **Open:** with the basis `builtCommon` the subject's area includes common parts while the comparables' areas are
  taken as recorded: `src/js/engine.js:205` (`function compArea`). Recording the basis of the comparables' areas remains to
  be done.

## F-07 — Confidence interval of the median and the trimmed mean

- **What happens.** For these estimators the half-width is the mean's, t · s / √n, centred on the chosen estimator:
  `src/js/engine.js:402` (`const half = useW`).
- **Status: partly fixed.** The method chapter of the report states the approximation: `src/js/report.js:896` (`X.approx`).
  An interval suited to these estimators (for example by resampling) remains to be done.

## F-08 — Rounding steps that do not depend on the currency

- **What happened (pre-release).** The listing price was always rounded to 5,000 and the P10, P50 and P90 of the
  uncertainty page to 1,000, whatever the currency.
- **Status: fixed.** The listing price is rounded to five rounding steps of the valuation:
  `src/js/engine.js:236` (`const listingStep`). The figures of the uncertainty page use the rounding step:
  `src/js/report.js:1081` (`function uncertaintyKpis`).

## F-09 — Spain-specific texts and rules used in every country

- **What happened (pre-release).** The cadastral and energy checks referred to Spanish sources for properties in any
  country, and the small-sample warning cited the Spanish order as general best practice.
- **Status: fixed.** The checks name the Spanish sources only for Spain: `src/js/review.js:45` (`const isES`). The minimum of
  six comparables is presented as Valesta's recommendation, with the Spanish order (art. 21.1.c of [ES-ECO805]) as its
  origin: `src/js/engine.js:411` (`a requirement of the Spanish Orden ECO/805/2003`).

## F-10 — Unsourced negotiation margin

- **What happened (pre-release).** The report stated a margin of 5–10% between asking and transaction prices «according
  to industry sources» without naming any, and the quality check spoke of a discount «normally 1–12%».
- **Status: fixed.** The report states only the coefficient chosen by the valuer: `src/js/report_i18n.js:590` (`chosen by the valuer`),
  with the valuer's reasoning, a new field printed in the method chapter: `src/js/method.js:75` (`negotiationReason`). The
  check presents its range as Valesta's expectation: `src/js/review.js:142` (`Valesta expects 0.88`). When asking prices
  are corrected by the default coefficient without reasoning, the quality review asks for it:
  `src/js/review.js:161` (`'method-negotiation-reason'`).

## F-11 — The «MCA» label

- **What happened (pre-release).** The cover called the method «Market comparison approach (MCA)». In Italian practice
  «MCA» commonly means adjustment by the marginal prices of characteristics ([Part 1,
  §1.7](1-sales-comparison.md#17-relationship-with-other-comparison-methods)), while Valesta uses percentage
  coefficients on ratings.
- **Status: fixed.** The method is called «sales comparison with homogenisation coefficients» in all 17 languages,
  and no text of the report or the app uses «MCA», the page template included.

## F-12 — Glossary

- **What happened (pre-release).** The glossary said that the confidence interval contains the mean market unit value
  with the stated probability (the probability belongs to the procedure, not to one interval), and it used «Asking
  price» for the recommended listing price, the words used for the comparables' offer prices.
- **Status: fixed** in all languages: `src/js/report_i18n.js:573` (`Confidence interval of the estimate',`) and
  `src/js/report_i18n.js:577` (`'Listing price'`).

## F-13 — Approaches listed but not computed

- **What happens.** The code list names the discounted cash flow, the profits method and automated valuation models
  (`src/js/taxonomy.js:101` (`const APPROACHES`)), but the engine does not compute them. Retail units and offices lose the
  discounted cash flow; hospitality types lose the profits method, which they list first. Special and mixed-use types
  do not list the sales comparison, yet the market comparison enters the reconciliation with weight 100 by default.
- **Status: partly fixed.** The method chapter of the report names the usual approaches of the property type that
  Valesta does not compute: `src/js/method.js:66` (`const notComputed`). **Open:** saying so in the app, the default weight
  of special and mixed-use types, and the roadmap.

## F-14 — Reconciliation weights without reasoning

- **What happened (pre-release).** The report printed the weights of the approaches but not why they were chosen. The
  Spanish order requires stated and justified weights for comparables (art. 22.1.d of [ES-ECO805]); the international
  standards are understood to expect the reconciliation to be explained (content to be verified, Part 4).
- **Status: fixed.** A field for the valuer's reasoning, printed in the report (`src/js/report.js:1141` (`X.reasonTitle`)),
  and a quality check when another approach is used without it: `src/js/review.js:176` (`'method-reconciliation'`).

## F-15 — Spanish useful-area definition outdated

- **What happened (pre-release).** The report's definition of useful area counted covered private outdoor space at 50%.
  Since 12 August 2025, Orden ECM/599/2025 excludes exterior spaces from the useful area [ES-ECM599-2025].
- **Status: fixed** in all languages: `src/js/report_i18n.js:503` (`since the 2025 amendment`).

## F-16 — Citations of the standards to be verified

- **What happened (pre-release).** Some citations could not be checked against the current texts (Part 4): «IVS 104» for
  valuation uncertainty, «IVS 106» for documenting the inspection, «IVS 101» for the purpose, and RICS VPS numbers.
- **Status: fixed.** Statements are no longer attributed to sections that were not verified; the standards are cited by
  title: `src/js/report_i18n.js:467` (`IVS 102 · RICS Red Book`). The list of the IVS standards by title stays, as their
  titles were checked on the IVSC pages [IVSC-2025].

## F-17 — Comparable without a source: two different defaults

- **What happened (pre-release).** The review treated a comparable without a source as a portal, the engine as «other»,
  and the review counted agency mandates as not being asking prices.
- **Status: fixed.** The review uses the engine's sources, with the same default and the same notion of asking price:
  `src/js/review.js:117` (`MCA().SOURCES.otro).negotiation`).

## F-18 — Energy classes outside A–G are not scored

- **What happened (pre-release).** The suggested energy rating knew only the classes A to G, so the Italian A4–A1, the
  German A+ and H and the A0 of the new EPBD [EU-EPBD-2024] got no suggestion.
- **Status: fixed.** The national classes are mapped onto the scale: `src/js/engine.js:467` (`A0:`).

## F-19 — Corrections to the country packs

Each card in [countries/](countries/README.md) ends with its corrections. In summary:

| Country | Correction |
|---|---|
| ES | add the appraisal services of credit institutions |
| IT | state the area convention: Italian practice speaks of «superficie commerciale», often computed with the criteria of DPR 138/1998, Allegato C (to be confirmed); cite art. 120-duodecies TUB for mortgage valuations |
| FR | list the DDT under art. L271-4 CCH |
| DE | replace «certified» with «meeting §§ 6–7 BelWertV» |
| GB | say England and Wales |
| AT | the LBG covers court valuations |
| CH | name both guidelines of the Swiss Bankers Association |
| BE | name the region of each document; align the asbestos dates with OVAM |
| NL | add the six-month limit and the independence rule of NHG |
| IE | the PSRA regulates agents, not valuation standards |
| PL | name the 2023 regulation in full |
| CZ | move «39/2020 Sb.» (brokerage) to the obligations of agents; present decree 441/2013 Sb. as the decree on official (administrative) prices, not on market value (to be confirmed) |
| HU | replace «decree 25/2007 PM» with Act XXX of 1997 |
| RO | state the edition of the ANEVAR standards |
| DK | the LFFE is not a valuation standard |
| SE | the Estate Agents Act governs agents |

**Status: open.** These corrections should follow the review by local professionals.

## F-20 — Overrides set by the AI tools are never shown

- **What happened (pre-release).** The AI tools of the assistant and of the MCP server could set the hidden overrides
  `annexOverride` and `kOverride` of a comparable, which the editor does not show. On the demo, two overrides moved the
  value from 518,000 to 535,000 without any sign in the app or the report.
- **Status: fixed.** The AI tools can no longer write them: `src/js/aitools.js:229` (`(kOverride`). Overrides set
  in a file are marked with an asterisk in the adjustment table of the report (`src/js/report.js:986` (`ovr' : ''`)) and listed
  by the quality review: `src/js/review.js:169` (`'method-overrides'`).

## F-21 — Values without a sales-comparison basis

- **What happened (pre-release).** With a missing area or no usable comparable and another approach switched on, the
  value came from the other approaches while the warning said that no value was calculated; with one comparable the
  warning said that two were required; with a market weight of 0, the range was the market confidence range scaled to
  the reconciled value.
- **Status: fixed.**
  - The warnings say what happens: `src/js/engine.js:436` (`'invalid_area'`) and `src/js/engine.js:407` (`'insufficient'`).
  - A value from the other approaches alone is allowed, with that warning.
  - The range is shown only when the sales comparison enters the value: `src/js/engine.js:448` (`marketInValue =`).
    Without it the letter, the summary and the result print no interval: `src/js/report.js:586` (`T.rangeLabel(ci)`).

## F-22 — The confidence interval is presented as the property's value range

- **What happened (pre-release).** The report called the confidence interval of the mean unit value the «value range»,
  and the letter called it a «reasonable range» of the value. A range for the subject's own price would be a prediction
  interval: on the demo 436,000 – 600,000 (±15.8%), against 489,000 – 547,000 (±5.6%). See Part 1, §1.11.
- **Status: fixed.** The report and the letter call it the «confidence interval of the estimate», and the method chapter
  says what it measures: `src/js/report_i18n.js:548` (`rangeCI: (c) =>`). The listing text no longer speaks of a
  «value range», and the app calls the interval a confidence interval. A prediction interval is not shown.

## F-23 — The estimator name is not checked

- **What happened (pre-release).** The engine used any statistic named in `settings.estimator`, which the AI tools can
  write; with `max`, the demo's value was 584,000.
- **Status: fixed.** Only the four estimators are accepted: `src/js/engine.js:396` (`ESTIMATORS.includes`).

## F-24 — A new-build comparable is always rated older than the subject

- **What happened (pre-release).** A new-build comparable got the age rating −2 even when the subject was new too.
- **Status: fixed.** The rule is skipped when the subject is new: `src/js/engine.js:499` (`const subjectNew`).

## F-25 — Agreement between estimators claimed whatever their spread

- **What happened (pre-release).** The result text said that the arithmetic mean, the median and the weighted mean «are
  consistent with one another, confirming the robustness of the estimate», whatever their values, and that the total
  unit value «is consistent with» the municipal asking price once the negotiation margin is deducted.
- **Status: fixed.** The text states the largest difference between the estimators and, above 5%, refers to the
  sensitivity analysis; the municipal asking price is given for reference only: `src/js/report.js:390` (`estSpread: PCT`).

## F-26 — The Spanish area definitions are shown for every country

- **What happens.** The block of area definitions of the report shows the definitions of the Spanish order under
  «country criterion» whatever the country: `src/js/report_i18n.js:503` (`defs: [['Usable'`).
- **Status: open.** Take the definitions from the country pack, or show them only for Spain.

## F-27 — Opening a saved valuation drops its other approaches and their reasoning

- **What happened (pre-release).** Every load path (the app at start-up, a file, an archive, the MCP server) rebuilds
  the valuation field by field, and the other approaches were not among the fields. After a reload, a valuation
  reconciled with the income approach (market 70, income 30) went back from 483,000 to the sales comparison alone,
  518,000, and the reasoning of the weights was lost. Found by the final review of this version.
- **Status: fixed.** The approaches, their weights and the reasoning are kept, with only their known fields:
  `src/js/appcore.js:181` (`function normalizeApproaches`).
