# Valesta valuation methodology

Copyright (C) 2026 Domestone S.r.l. This folder is part of the Valesta repository and is covered by its licence; see
[LICENSE](../../LICENSE) and [NOTICE](../../NOTICE).

**Status:** draft 0.2, 24 November 2026, for technical review. It describes the code of version 1.0.0 of the repository.
The findings of [6-code-findings.md](6-code-findings.md) were made on the pre-release code, which was not published, and
version 1.0.0 contains their fixes.

## Purpose and readers

These documents explain how Valesta estimates the value of a property and why. They cover four things:

- every formula, parameter and threshold of the engine;
- the scientific and professional sources the method relies on;
- the international framework;
- the rules of the 19 countries for which Valesta has a country pack.

They are written for these readers:

- Domestone S.r.l.;
- the valuers who review the method and validate the country packs;
- the developers of the engine.

For clients, «Method» and «Sources» chapters in the report are proposed in
[7-proposal-report-app.md](7-proposal-report-app.md).

## What these documents are not

- **Not legal advice.** The national references are summaries checked on official sources. The texts in force prevail.
- **Not a validation of the country packs.** The packs in `src/js/taxonomy.js` are drafts until a local professional
  reviews them, and the country cards say so.
- **Not a basis for calling a Valesta report an official appraisal.** Valesta reports state that they are not one:
  see [Part 1, §1.2](1-sales-comparison.md#12-basis-of-value).

## Contents

| File | Content |
|---|---|
| [1-sales-comparison.md](1-sales-comparison.md) | The sales comparison approach: cleansing, factors and coefficients, weights, estimators, confidence interval, value, checks, worked example |
| [2-uncertainty.md](2-uncertainty.md) | Valuation uncertainty: Monte Carlo simulation and leave-one-out analysis |
| [3-other-approaches.md](3-other-approaches.md) | Income, cost and residual approaches, and the reconciliation |
| [4-international-framework.md](4-international-framework.md) | IVS, RICS Red Book, EVS, and the EU rules on valuations for loan security |
| [countries/](countries/README.md) | One card per country: valuation standards, area measurement, typical documents, who signs valuations for mortgage lending |
| [5-bibliography.md](5-bibliography.md) | All sources, with their verification status |
| [6-code-findings.md](6-code-findings.md) | Differences between the code, the report texts and the sources, and their status in this version |
| [7-proposal-report-app.md](7-proposal-report-app.md) | «Method» and «Sources» chapters in the report and the app: the proposal and how it was carried out |
| [paper/](paper/) | The method as a scientific paper, in English. `node tools/paper/build.js --pdf` builds its figures, its HTML and its PDF (in `dist/paper/`) from the Markdown, and `node tools/paper/qa.js` checks the three formats against each other |

## Conventions

- **Code anchors.** References to the code use the form `src/js/engine.js:219` (`factorK`): the file, the line in the
  same version of the repository and an identifier found on that line. `tests/methodology-docs.test.js` checks every
  anchor, the factor table, the worked examples of Parts 1–3 and the bibliography keys: when the code moves, the test
  fails and the documents are updated in the same change. Quotations of the pre-release code carry no line number.
- **Source keys.** Keys in square brackets, such as [ES-ECO805], point to entries in
  [5-bibliography.md](5-bibliography.md).
- **Verification status.** Every bibliography entry has one of three statuses:
  - **Verified YYYY-MM-DD (content).** On that date, the point the documents cite was checked on the official text,
    on the issuing body's page, or on the indexed text of that page.
  - **Verified YYYY-MM-DD (bibliographic).** Only the bibliographic data were checked: title, issuing body or author,
    year or edition, and link or ISBN/DOI. The content was not consulted; this is the case for paywalled standards
    and books, and for papers checked on Crossref. A sentence that relies on such a source for more than its title is
    marked «(content to be verified)».
  - **To be verified.** The source could not be confirmed. The reason is stated.
- **Terms.**
  - The *subject* is the property being valued; a *comparable* is a property whose price is used for comparison.
  - Ratings always compare the subject with the comparable.
  - Percentages in the code are fractions (0.05 = 5%). Two kinds of input are written as percentages instead
    (5 = 5%): the inputs of the other approaches and the listing margin `listingMarginPct`.
  - `trimPct` is a fraction, despite its name.
- **Numbers.** Numbers use a comma for thousands and a point for decimals. Amounts are in the valuation's currency;
  those of the worked example are in euros.

## Reproducing the worked example

The worked example in Parts 1 and 2 comes from running the engine on the demo valuation, whose data are synthetic.
Run it from the repository root with Node.js 20 or later:

```js
const MCA = require('./src/js/engine.js');
global.MCA = MCA;
const demo = require('./src/js/data.js');
const result = MCA.compute(demo);                                    // Part 1, §1.14
const robustness = MCA.robustness(demo, { n: 600, seed: 20261122 }); // Part 2
```
