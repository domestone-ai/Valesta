# Proposal: method and sources in the report and in the app

Status: approved by Domestone S.r.l. on 24 November 2026 and carried out in version 1.0.0 (`CHANGELOG.md`),
except for step 11. Sections 1–7 are the proposal as written; section 8 records the decisions and how the proposal
was carried out. Code references point to this version of the repository.

## 1. Starting point

### The report

- **«Methodology» chapter.** It already describes the steps, the factors and the controls:
  `src/js/report.js:835` (`function pMethod`). Its texts are partly wrong (findings F-04 to F-06 and F-11), and it does
  not say where the δ values come from.
- **«Sources and references consulted» list.** It names the market data and the comparables:
  `src/js/report.js:1206` (`const sources`). It does not name the standards, the national rules or the literature
  behind the method.
- **Client preset.** It hides the method chapter, the uncertainty analysis and the sources: `src/js/report.js:119`
  (`client:`). A client receives only the short description of the approach in the letter.

### The app

The app shows the calculation, the checks and the uncertainty, but nothing explains the method, and its sources are not
listed.

## 2. «Method» chapter in the report

Generate the chapter from the engine's result and settings, in the report's language. It describes what was actually
done, not a standard text.

### Contents

1. **Approach.** Sales comparison with homogenisation coefficients; and, if used, the other approaches with their
   weights and the valuer's reasoning (F-14).
2. **Evidence.**
   - number of comparables and sources by type;
   - date range and time adjustment;
   - negotiation coefficient, with the valuer's reason (F-10).
3. **Adjustment.**
   - the factors with their δ;
   - for each δ, whether it is Valesta's default or set by the valuer;
   - the rating scale and the direction of the ratings.
4. **Weights and estimator.**
5. **Confidence interval.** Its level, with a correct sentence on its meaning (F-12).
6. **Uncertainty.** The Monte Carlo and leave-one-out results with their assumptions.
7. **Limits.** Taken from [Part 1, §1.15](1-sales-comparison.md#115-limits).
8. **Reference.** «The full methodology is documented in the Valesta methodology, version …».

### Versions

- **Technical version:** the full chapter.
- **Client version:** half a page with items 1, 2, 5 and 6.

### Texts and languages

The texts are written in English, Spanish and Italian first. The other 14 languages follow the existing translation
workflow: drafts reviewed by native speakers.

## 3. «Sources» chapter in the report

Keep the current list of market sources and comparables, and add «Methodological references». The references come
from one structured list shared by the report, the app and these documents. It is proposed as a new data file,
`src/js/references.js`.

### Fields of each reference

- key;
- issuing body or author;
- title;
- edition and date;
- URL, ISBN or DOI;
- the country it applies to (or «international»);
- the verification status and date.

### What the report shows

- **The standards** (IVS, Red Book, EVS), with edition and date.
- **The country's references**, from its pack:
  - each with its status;
  - when the pack is still a draft, the sentence that says so, which the app already prints.
- **The literature for the method:** at least the hedonic and comparison references, and the statistical sources of
  the confidence interval and the simulation.

## 4. In the app

- **Method panel**, in the result step. For each number on screen (adjusted price, weight, unit value, range, P10–P90),
  one line on how it is computed and a link to the relevant section of these documents.
- **Sources view** for each country. It lists the references of the pack with their status and links, and marks the
  items «to be verified».
- **Defaults to confirm.** When the time trend, the annex values or the negotiation coefficient come from defaults, the
  quality review asks the valuer to confirm them (F-02).
- **Origin of δ.** In the factor editor, show whether each δ is Valesta's default or the valuer's, and let the valuer
  record a source.

## 5. Consistency test between documents and code

A new test, `tests/methodology-docs.test.js` with `node:test`, keeps these documents true to the code. As a new
source file it starts with the AGPL header «Copyright (C) 2026 Domestone S.r.l.».

| Test | Assertion |
|---|---|
| `code anchors point to their identifiers` | for every anchor `src/js/<file>.js:<n>` (`<id>`) in `docs/methodology`, line n (or the range) contains `<id>` |
| `factor table matches FACTORS` | the factor table of Part 1 lists the same ids and δ as `MCA.FACTORS` |
| `worked example matches the engine` | the numbers of Part 1, §1.14 equal `MCA.compute(DEFAULT_STATE)`, and those of Part 2, §2.5 equal `MCA.robustness(DEFAULT_STATE, { n: 600, seed: 20261122 })` |
| `approach illustration matches the engine` | the numbers of Part 3, §3.6 equal `MCA.approaches.*` on the stated inputs |
| `every cited key has a bibliography entry with a status` | each [KEY] cited has an entry in `5-bibliography.md` with «Verified YYYY-MM-DD» or «To be verified» |

When a change to the engine moves a line or a number, the test fails, and the documents are updated in the same
change.

## 6. Order of work

| Step | Content | Findings |
|---|---|---|
| 1 | Engine and app fixes that can change values: neutral market inputs for new valuations; one default negotiation coefficient; visible or forbidden overrides; accepted estimators only | F-02, F-01, F-20, F-23 |
| 2 | Report computations: sensitivity table; rounding steps by currency; ranges and warnings when the value has no sales-comparison basis; name of the confidence interval or a prediction interval | F-03, F-08, F-21, F-22 |
| 3 | Report texts in English, Spanish and Italian: asking prices; complement; area basis; method name; glossary; useful area in Spain; Spain-specific checks; unsourced margin | F-04, F-05, F-06, F-09, F-10, F-11, F-12, F-15 |
| 4 | Citations: verify the IVS and Red Book chapters on the current editions, or cite by title | F-16 |
| 5 | References data file and the «Sources» chapter | — |
| 6 | «Method» chapter, technical and client versions; reasoning of the reconciliation weights | F-14 |
| 7 | App: method panel, sources view, defaults to confirm, origin of δ | F-02 |
| 8 | Consistency test | — |
| 9 | Remaining items: energy classes; missing source; approaches not computed; estimator intervals; age rating of new builds | F-18, F-17, F-13, F-07, F-24 |
| 10 | Translations into the other 14 languages | — |
| 11 | Local validation of the 19 country packs, then the pack corrections | F-19 |

## 7. Decisions needed before starting

1. **Name of the method in the report.** Keep «MCA» with an explanation, or change it to «sales comparison with
   homogenisation coefficients» (F-11).
2. **Default market inputs.** Should new valuations start with no time trend and no annex values, or with values to
   confirm (F-02)?
3. **Client version.** Should the client version of the report contain the short «Method» chapter by default?
4. **Calibration of δ.** Should Valesta plan to calibrate δ from transaction data for each market (hedonic or paired
   sales), or keep expert defaults that the valuer reviews?

## 8. Decisions and implementation

### Decisions of Domestone S.r.l., 24 November 2026

1. **Name of the method.** «Sales comparison with homogenisation coefficients» (Italian «Confronto di mercato con
   omogeneizzazione per coefficienti», Spanish «Comparación de mercado con homogeneización por coeficientes»), with no
   «MCA» in any of the 17 languages.
2. **Default market inputs.** New valuations start with no time trend and no annex values, and the quality review asks
   the valuer to confirm the market inputs.
3. **Client version.** It contains a short «Method» chapter.
4. **Calibration of δ.** The defaults remain expert values; the app and the report show whether each δ is Valesta's
   default or set by the valuer, with the valuer's source. Calibration from transaction data is left to the roadmap.

### What was done

| Step | Where |
|---|---|
| 1 | `src/js/engine.js:226` (`function negotiationDefault`), `src/js/appcore.js:337` (`marketConfirmed: false`), `src/js/aitools.js:229` (`(kOverride`), `src/js/engine.js:396` (`ESTIMATORS.includes`) |
| 2 | `src/js/report.js:1066` (`function sensitivityRows`), `src/js/engine.js:236` (`const listingStep`), `src/js/engine.js:448` (`marketInValue =`); the interval is called «confidence interval of the estimate» |
| 3 | report texts in English, Spanish and Italian ([6-code-findings.md](6-code-findings.md) gives each anchor) |
| 4 | the standards are cited by title; the citations that could not be verified were removed (F-16) |
| 5 | `src/js/references.js:27` (`const REFERENCES`), generated from [5-bibliography.md](5-bibliography.md); the report page `src/js/report.js:1221` (`function pRefs`) |
| 6 | `src/js/method.js:38` (`function facts`); the technical page `src/js/report.js:915` (`function pMethodApplied`) and the client page `src/js/report.js:926` (`function pMethodShort`); the reasoning of the weights `src/js/review.js:176` (`'method-reconciliation'`) |
| 7 | `src/js/editor.js:1541` (`function methodPanel`), `src/js/editor.js:1548` (`function sourcesPanel`), `src/js/review.js:149` (`'method-market'`), `src/js/engine.js:238` (`function factorOrigin`) |
| 8 | `tests/methodology-docs.test.js` |
| 9 | F-18, F-17 and F-24 fixed; F-13 and F-07 stated in the method chapter (partly fixed) |
| 10 | AI drafts in the 14 other languages, listed in `CHANGELOG.md` for review by native speakers |
| 11 | not done: it needs local professionals (F-19) |

### Departures from the proposal

- **EU rules on loan security.** The report lists the standards, the national rules and the literature (§3), but not
  the EU rules on valuations for loan security: the report states that it is not valid for mortgage purposes. The
  sources view of the app lists them for the EU member states.
- **Pages.** The methodological references and the method applied in the valuation take a page each in the technical
  report.
- **Client version.** The short chapter is driven by a new design option, «Technical detail», under «Method». Designs
  saved before this version with the client preset keep the method hidden until it is switched on.
- **Negotiation coefficient.** The reasoning required by F-10 needed a new field, `settings.negotiationReason`, printed
  in the method chapter.
- **Links to these documents.** The app cites the sections of these documents as text (`docs/methodology/…, §n`), as it
  works offline.
