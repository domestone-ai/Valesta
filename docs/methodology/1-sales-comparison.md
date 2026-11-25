# Part 1 — The sales comparison approach in Valesta

Status: draft for technical review, 24 November 2026. Code references point to this version of the repository; see
[README.md](README.md) for the conventions.

## 1.1 Scope

Valesta's main approach is the sales comparison approach: the market approach of the international standards
[IVSC-2025]. Valesta uses a variant that turns the comparison between the subject and each comparable into
multiplicative coefficients.

All of it is computed by `src/js/engine.js:305` (`function compute`), a pure function with no access to the page. The
same function serves:

- the app;
- the report;
- the quality review;
- the MCP server.

```text
price P of each comparable
  → cleansing     P′ = P × K_neg × K_t − A                              §1.4
  → unit price    p  = P′ / S                                           §1.5
  → adjustment    p_h = p × K,  K = Π_j (1 + n_j · δ_j)                  §1.6
  → weight        w  = f × max(0.2, 1 − Σ_j |k_j − 1|)                   §1.9
  → estimator     p* = Σ w·p_h / Σ w   (default; three others)           §1.10
  → value         V  = round(p* × S_ref + annexes − deductions)          §1.12
  → range         confidence interval of p*, converted the same way     §1.11
```

## 1.2 Basis of value

The report's basis of value is market value:

- the report quotes the IVS definition and attributes it to «IVS 102 · RICS Red Book · EVS 2025»:
  `src/js/report_i18n.js:466` (`mvDef`), `src/js/report_i18n.js:467` (`mvCite`);
- Part 4 checks those references against the current editions.

The engine computes one figure on this basis. It does not compute the other bases in the code lists of Valesta
(market rent, investment value, fair value, mortgage lending value).

Every report states that it is not an official appraisal and is not valid for mortgage, court or tax purposes:
`src/js/report_i18n.js:480` (`nature`).

The report's method text rests the approach on the principle of substitution: `src/js/report_i18n.js:591`
(`principle of substitution`).

## 1.3 Comparable evidence

Each comparable carries:

- a price, built and usable areas, a date and a source;
- optionally, its own negotiation coefficient;
- the annexes it includes;
- the ratings of the factors;
- an inclusion flag.

The source sets two defaults: `src/js/engine.js:98` (`SOURCES`).

| Code | Source | Weight f | Negotiation coefficient |
|---|---|---|---|
| `registro` | Land registry or notary, closing price | 1.00 | 1.00 |
| `cierre` | Sale closed by an agency | 1.00 | 1.00 |
| `mandato` | Agency mandate, asking price | 0.95 | valuation default |
| `portal` | Property portal, asking price | 0.85 | valuation default |
| `otro` | Other source | 0.80 | valuation default |

- **Unknown source code.** It counts as `otro`: `src/js/engine.js:323` (`SOURCES.otro`).
- **Weights per valuation.** They can be changed in `settings.sourceWeights`: `src/js/engine.js:339`
  (`sourceWeights`).
- **Valid comparable.** It needs a price and an area greater than zero: `src/js/engine.js:322` (`valid`). Invalid
  comparables are dropped with the warning `invalid_comp`.
- **Used comparable.** It is valid and the valuer has not excluded it: `src/js/engine.js:352` (`include`). The report
  still lists excluded comparables, as references, with the reason.
- **Distance to the subject.** It is a great-circle (haversine) distance on a sphere of radius 6,371.0088 km:
  `src/js/engine.js:169` (`distanceKm`), `src/js/engine.js:172` (`6371.0088`). It is shown in the report and used by one
  quality check (§1.13). It does not enter the value.

## 1.4 Price cleansing

Cleansing turns each comparable's price into the probable price of the dwelling alone at the valuation date:

> P′ = P × K_neg × K_t − A — `src/js/engine.js:340` (`priceAdj`), `src/js/engine.js:341` (`dwellingPrice`)

### Negotiation coefficient K_neg

`src/js/engine.js:324` (`kSource`). The first of these that applies is used:

1. the comparable's own coefficient, if it lies in (0, 1.5]: `src/js/engine.js:313` (`coef`);
2. the default of its source: 1.00 for land-registry and closed sales;
3. the valuation default `settings.negotiationDefault`, which is 0.94 in the demo and in valuations started from it:
   `src/js/data.js:161` (`negotiationDefault`);
4. 1.00, when no valid default is set: `src/js/engine.js:226` (`function negotiationDefault`), used by the engine
   (`src/js/engine.js:314` (`const negDefault`)), by the Monte Carlo (`src/js/engine.js:569` (`const neg0 = negotiationDefault`)) and by
   the report (`src/js/report.js:355` (`MCA().negotiationDefault`)).

In the pre-release code the report and the Monte Carlo assumed 0.94 when the setting was missing, while the engine used
1.00 (finding F-01 in [6-code-findings.md](6-code-findings.md), fixed). The setting can still go missing inside the app:
the valuer can empty its field (`src/js/editor.js:1531` (`negotiationDefault`)).

Valesta does not estimate the coefficient; the valuer chooses it and can record the reasoning, which the method chapter
of the report prints: `src/js/editor.js:1536` (`negotiationReason`). The report states only the coefficient applied:
`src/js/report_i18n.js:590` (`chosen by the valuer`). The pre-release code also quoted a margin of 5–10% «according to
industry sources» without naming them (finding F-10, fixed).

### Time adjustment K_t

`src/js/engine.js:325` (`monthsBetween`), `src/js/engine.js:326` (`kTime`):

> K_t = (1 + g)^(m/12)

- **g** is `settings.timeTrendAnnual`, an annual rate written as a fraction, clamped to [−0.5, +0.5].
- **m** is the number of months from the comparable's date to the valuation date. A month is 30.4375 days:
  `src/js/engine.js:184` (`30.4375`).
- **m is never negative.** A comparable dated after the valuation date, or without a date, gets m = 0.
- **Valuation date.** It is `meta.valuationDate` or, if missing, today: `src/js/engine.js:316` (`valuationDate`).
- **Switching it off.** With `settings.timeAdjust = false`, m = 0 for every comparable.

The rate compounds. With g = 8.1%:

- six months give K_t = 1.0397;
- twelve months give K_t = 1.0810.

The rate is an input. Valesta does not derive it from an index. The demo sets 8.1% a year (`src/js/data.js:169`
(`timeTrendAnnual`)). New valuations start without a trend, and the quality review asks the valuer to confirm the
market inputs: `src/js/review.js:149` (`'method-market'`) (finding F-02, fixed).

Updating comparable prices to the valuation date with an index is the technique of the German regulation: see § 9(1)
sentence 2 and § 18 of [DE-IMMOWERTV].

### Annex deduction A

`src/js/engine.js:327` (`annexDeduct`).

- **Amount.** It is the comparable's `annexOverride`, if numeric. Otherwise it is the parking value (if the comparable
  includes parking) plus the storage value (if it includes storage), both from `settings.annex`.
- **Demo values.** Parking 18,000 and storage 4,000: `src/js/data.js:162` (`annex`). New valuations start without
  annex values: `src/js/appcore.js:337` (`annex: { parking: null`) (finding F-02, fixed).
- **Purpose.** It compares dwellings with dwellings. The subject's own annexes are added back in §1.12.

The engine also reads `annexOverride` and the per-factor `kOverride` (§1.6). The editor does not offer either, and
the AI tools of the assistant and of the MCP server can no longer write them: `src/js/aitools.js:229` (`(kOverride`). A value
set in a file is marked with an asterisk in the adjustment table of the report (finding F-20, fixed).

## 1.5 Unit price and area basis

> p = P′ / S — `src/js/engine.js:343` (`unitBase`)

The areas depend on `settings.areaBasis`: `src/js/engine.js:196` (`subjectRefArea`), `src/js/engine.js:205`
(`compArea`).

| `areaBasis` | Subject area S_ref | Comparable area S |
|---|---|---|
| `built` (default) | built area | built area; if missing, usable area × r |
| `useful` | sum of the rooms' areas, else the usable area: `src/js/engine.js:187` (`usefulArea`) | usable area; if missing, built area ÷ r |
| `builtCommon` | built area with common parts | as for `built` |

- **The ratio r.** It is `settings.builtToUseful`, 1.18 by default: `src/js/engine.js:207` (`1.18`).
- **Missing subject area.** If the subject's area is missing or not positive, the sales comparison gives no value
  and the warning `invalid_area` appears: `src/js/engine.js:434` (`refArea > 0`). If another approach is switched
  on, a value is computed from the other approaches alone (Part 3, §3.5); the warning says so, and no range is shown
  (finding F-21, fixed).
- **`builtCommon`.** The comparables' area is taken as recorded. The valuer must make sure it is on the same basis
  (finding F-06, open).
- **The asking unit price P / S.** The report shows it: `src/js/engine.js:342` (`unitAsk`). It does not enter the
  value.

The report's method chapter names the area on which the unit price is computed:
`src/js/report_i18n.js:513` (`Cleansed price divided by the`). The pre-release code always said «the built area of the
comparable» (finding F-06).

## 1.6 Factors and the coefficient scale

### Factors

The twelve default factors and their weight δ per level are in `src/js/engine.js:27` (`FACTORS`). A rating of ±2
gives the maximum adjustment ±2δ.

| Id | Factor | δ per level | Maximum |
|---|---|---|---|
| `loc` | Location and surroundings | 7.5% | ±15% |
| `size` | Size | 3% | ±6% |
| `floor` | Floor level | 3% | ±6% |
| `lift` | Lift and accessibility | 5% | ±10% |
| `age` | Building age and type | 5% | ±10% |
| `cond` | Condition and finishes | 5% | ±10% |
| `dist` | Layout (bedrooms and bathrooms) | 3% | ±6% |
| `orient` | Orientation, light and views | 2% | ±4% |
| `terr` | Terraces and outdoor space | 3% | ±6% |
| `clim` | Climate control and services | 2% | ±4% |
| `common` | Communal areas (pool, garden) | 2% | ±4% |
| `energy` | Energy efficiency | 1% | ±2% |

The factor list and its δ values belong to the valuation file. The defaults come from `FACTORS`:
`src/js/engine.js:214` (`factorList`). In the editor the valuer can change δ factor by factor:
`src/js/editor.js:1439` (`factors.${j}.delta`).

### Rating scale

Each factor is rated on five levels: `src/js/engine.js:90` (`LEVELS`).

| n | Meaning |
|---|---|
| −2 | much worse |
| −1 | worse |
| 0 | similar |
| +1 | better |
| +2 | much better |

The rating compares the subject with the comparable. If the subject is better, the comparable's price goes up
(k > 1).

### Coefficients

`src/js/engine.js:219` (`factorK`):

> k_j = 1 + n_j · δ_j  K = Π_j k_j  G = Σ_j |k_j − 1|

| Element | Rule | Code |
|---|---|---|
| Rating n | rounded to an integer, kept in [−2, +2] | `src/js/engine.js:331` (`clamp(Math.round`) |
| δ | kept in [0, 0.25], so every k stays in [0.5, 1.5] | `src/js/engine.js:220` (`uniform10`) |
| Preset `uniform10` | δ = 0.10 for every factor, whatever the factor list says | `src/js/engine.js:220` (`uniform10`) |
| Override | a valuer's `kOverride` greater than zero replaces k, kept in [0.5, 1.5] | `src/js/engine.js:329` (`kOverride`), `src/js/engine.js:333` (`clamp(ov, 0.5, 1.5)`) |
| Total coefficient K | product of the k | `src/js/engine.js:336` (`kTotal`) |
| Gross adjustment G | sum of the corrections in absolute value | `src/js/engine.js:337` (`grossAdj`) |
| Net adjustment | K − 1 | `src/js/engine.js:361` (`netAdj`) |

> p_h = p × K — `src/js/engine.js:344` (`unitHomog`)

K itself is not clamped. With the default δ values and every rating at +2, K = 2.2172; with every rating at −2,
K = 0.4195. In practice the warnings of §1.13 catch heavy adjustments long before that.

The product has two useful properties:

- the order of the factors does not matter;
- K stays positive.

Its price is that corrections compound: two +5% corrections give 1.1025, not 1.10.

### What δ is, and what it is not

- **The δ values are expert defaults written in the code.** The repository does not document how they were chosen,
  and Valesta does not estimate them from transactions. They are not calibrated to any market.
- **Data-driven practice measures these effects from prices.** Two examples:
  - hedonic price models, which estimate the implicit price of each characteristic [ROSEN-1974];
  - coefficients that an official body derives from purchase prices. The German *Umrechnungskoeffizienten* of
    § 19 [DE-IMMOWERTV] work this way.
- **Valesta treats δ as uncertain.** The Monte Carlo of [Part 2](2-uncertainty.md) varies every δ by ±20%, except
  under the `uniform10` preset, which fixes δ at 10%.

How to calibrate δ for each market is part of the proposal in [7-proposal-report-app.md](7-proposal-report-app.md).

## 1.7 Relationship with other comparison methods

[PAGOURTZI-2003] reviews valuation methods. In the main traditions the comparison approach adjusts comparables as
follows.

| Tradition | How differences are adjusted | Relationship with Valesta |
|---|---|---|
| International standards [IVSC-2025] | The market approach is one of the valuation approaches of IVS 103. How far the standard constrains the adjustment technique must be checked on its text (content to be verified). | Valesta applies a comparison technique within the market approach. |
| United States [AI-ARE-16] | The sales comparison approach of US practice adjusts comparable prices for each element of comparison and reconciles the adjusted prices (content to be verified). | Similar layout: the report's adjustment table has the comparables in columns and the factors in rows. |
| Spain [ES-ECO805] | Homogenisation with justified «criterios, coeficientes y/o ponderaciones» (art. 22.1.d); information on at least six transactions or offers (art. 21.1.c). | Closest to Valesta: homogenised unit prices, coefficients and stated weights. |
| Germany [DE-IMMOWERTV] | Comparison prices adjusted to the valuation date with indices and for characteristics with conversion coefficients derived from purchase prices (§§ 9, 18, 19, 25). | Same structure (time index × coefficients). Valesta's coefficients are not derived from data. |
| Italy [IT-UNI11612] [IT-CVI] | The «market comparison approach» of Italian practice adjusts each comparable by the marginal prices of its characteristics, that is amounts per unit of each characteristic, estimated from the market. This description is to be checked on the texts, which are paywalled. | Different technique. Valesta no longer uses the name «MCA» (finding F-11, fixed). |

## 1.8 Suggested ratings

For every factor except location, the engine can suggest a rating from the data of the subject and the comparable:
`src/js/engine.js:477` (`suggestRatings`).

| Factor | Rule (subject compared with the comparable) | Code |
|---|---|---|
| Size | ratio r = subject area ÷ comparable area: r ≥ 1.25 → −2; r ≥ 1.08 → −1; r ≤ 0.80 → +2; r ≤ 0.926 → +1. A larger subject has a lower unit price. | `src/js/engine.js:483` (`out.size`) |
| Floor | floors capped at 3; a difference of ≥ 2 floors → ±1 | `src/js/engine.js:490` (`out.floor`) |
| Lift | a unit needs a lift from the first floor up, or when its floor is unknown. A unit is served if it has a lift or does not need one (ground floor). Subject served, comparable not: +1, or +2 if the comparable is on floor 2 or higher. The reverse: −1, or −2 if the subject is on floor 2 or higher. | `src/js/engine.js:496` (`out.lift`) |
| Age | new-build comparable → −2, or 0 when the subject is new too (finding F-24, fixed). Otherwise the difference in years of construction: ≥ 30 → +2; ≥ 12 → +1; the same thresholds downwards. | `src/js/engine.js:499` (`newBuild`), `src/js/engine.js:501` (`12, 30`) |
| Condition | scores 1 (to refurbish) to 6 (new build): `src/js/engine.js:106` (`CONDITIONS`). A difference of ≥ 3 → +2; ≥ 1 → +1; the same downwards. | `src/js/engine.js:507` (`out.cond`) |
| Layout | difference in bedrooms plus difference in bathrooms: ≥ 3 → +2; ≥ 1 → +1; the same downwards. Only when both bedroom counts are known. | `src/js/engine.js:511` (`out.dist`) |
| Orientation | score 1 for north, north-east and north-west; 2 for east and west; 3 for south, south-east, south-west or all directions. The difference is kept in ±1. | `src/js/engine.js:465` (`ORIENT_SCORE`), `src/js/engine.js:515` (`out.orient`) |
| Outdoor space | m² of terrace, gallery and garden for the subject; terrace and garden only for the comparable. Difference ≥ 30 → +2; ≥ 6 → +1; the same downwards. | `src/js/engine.js:516` (`galleryM2`), `src/js/engine.js:518` (`6, 30`) |
| Climate | air conditioning plus heating (0–2), difference | `src/js/engine.js:520` (`out.clim`) |
| Communal areas | score 2 with a pool, otherwise 1 with a garden, otherwise 0; difference | `src/js/engine.js:522` (`out.common`) |
| Energy | class A = 7 … G = 1; A0, A+, A++, A+++ and the Italian A1–A4 = 7; the German H = 0 (finding F-18, fixed). Difference ≥ 4 → +2; ≥ 2 → +1; the same downwards; 0 if either class is missing. | `src/js/engine.js:467` (`ENERGY_SCORE`), `src/js/engine.js:525` (`bucket(se - ce, 2, 4)`) |
| Location | never suggested: the valuer's judgement | — |

How suggestions are applied: `src/js/appcore.js:65` (`applySuggestions`).

- **Location** is skipped: `src/js/appcore.js:73` (`'loc'`).
- **Factors with a justification note** from the valuer keep the valuer's rating: `src/js/appcore.js:74`
  (`notes[f]`).
- **Every other factor that has a suggestion** gets it, replacing the current rating. When data are missing, the
  factors behave differently:
  - size, floor, condition and layout get no suggestion and keep their rating;
  - age, orientation and energy get 0;
  - lift, outdoor space, climate and communal areas are computed as if the missing feature were absent.

## 1.9 Weights

> w_i = f_i × s_i  s_i = max(0.2, 1 − G_i) — `src/js/engine.js:363` (`wSource * similarity`),
> `src/js/engine.js:338` (`similarity`)

- **f** is the reliability of the source (§1.3).
- **s** is the similarity. It is the complement of the gross adjustment, with a floor of 0.2 that is reached when
  G ≥ 0.8.
- **Excluded or invalid comparables** weigh zero.

Comparables that need smaller adjustments count more. The Spanish order requires that any weighting of comparables be
justified and that each comparable's weight be stated: art. 22.1.d of [ES-ECO805]. The report prints every weight.

The report's result text calls the similarity the complement of the gross adjustment, as the code computes it:
`src/js/report_i18n.js:593` (`complement of the gross adjustment`). The pre-release code said «inverse» (finding F-05,
fixed).

## 1.10 Estimators

The unit value p* is one of four estimators of the adjusted prices p_h, chosen in `settings.estimator`. If the chosen
one cannot be computed, the weighted mean is used: `src/js/engine.js:397` (`unitValue`).

| Estimator | Definition | Code |
|---|---|---|
| `weighted` (default) | Σ w·p_h / Σ w | `src/js/engine.js:377` (`weighted`) |
| `mean` | arithmetic mean | `src/js/engine.js:374` (`mean`) |
| `median` | median | `src/js/engine.js:136` (`median`) |
| `trimmed` | mean after removing k = ⌊n · t / 2⌋ values from each tail, t = `settings.trimPct` | `src/js/engine.js:151` (`trimmedMean`), `src/js/engine.js:155` (`Math.floor`) |

- **The trimmed mean** follows the rule of the TRIMMEAN spreadsheet function [MS-TRIMMEAN]. When `trimPct` is
  missing, t = 0 and nothing is trimmed. The demo uses t = 0.10, with which nothing is trimmed below 20 comparables, so
  the trimmed mean equals the mean.
- **The estimator name is checked.** Only the four estimators are accepted:
  `src/js/engine.js:396` (`ESTIMATORS.includes`). The pre-release code accepted any statistic of the result, for example
  `max` (finding F-23, fixed).
- **The quartiles** used by a quality check follow QUARTILE.INC [MS-QUARTILE-INC]: linear interpolation between order
  statistics, known as definition 7 in [HYNDMAN-FAN-1996] (content to be verified). See `src/js/engine.js:142`
  (`quantileInc`).
- **The report's sensitivity table** shows the value under each estimator, computed by the engine with deductions and
  reconciliation: `src/js/report.js:1066` (`function sensitivityRows`) (finding F-03, fixed).

## 1.11 Dispersion, reliability and confidence interval

### Dispersion and reliability

- **Standard deviation s.** The sample standard deviation (n − 1) of the adjusted prices: `src/js/engine.js:162`
  (`stdSample`).
- **Coefficient of variation.** CV = s ÷ arithmetic mean: `src/js/engine.js:388` (`stats.cv`). It is always the
  unweighted one, whatever the estimator.
- **Reliability.** `src/js/engine.js:455` (`quality`):
  - high, if CV ≤ 10% and n ≥ 6;
  - medium, if CV ≤ 15%;
  - low, otherwise;
  - none, below two comparables.

### Confidence interval

| Element | Rule | Code |
|---|---|---|
| Level | `settings.ciLevel`, one of 0.80, 0.90, 0.95. Any other value gives 0.95. The demo and the valuations started from it use 0.80. | `src/js/engine.js:383` (`ciLevel`), `src/js/data.js:176` (`ciLevel`) |
| Critical value t | two-sided Student t [STUDENT-1908], tabulated for 1–30 degrees of freedom; beyond 30, the normal values 1.282 / 1.645 / 1.96 | `src/js/engine.js:116` (`T_TABLE`), `src/js/engine.js:127` (`tab.inf`) |
| Weighted estimator | effective size n_eff = (Σw)² / Σw², the effective sample size of [KISH-1965] (content to be verified); weighted standard deviation s_w = √(Σw(x − x̄_w)² / (Σw − Σw²/Σw)), the weighted variance of the GNU Scientific Library, which reduces to the usual n − 1 form when the weights are equal [GSL-WSTATS]; degrees of freedom ⌊n_eff − 1⌋, at least 1; half-width h = t · s_w / √n_eff. If s_w cannot be computed or n_eff ≤ 1, the formula of the other estimators is used instead. | `src/js/engine.js:400` (`useW`), `src/js/engine.js:392` (`nEff`), `src/js/engine.js:393` (`stdWeighted`), `src/js/engine.js:401` (`Math.floor(stats.nEff - 1`), `src/js/engine.js:402` (`half`) |
| Other estimators | h = t(n − 1) · s / √n, centred on the chosen estimator | `src/js/engine.js:402` (`half`) |
| Interval of the unit value | [p* − h, p* + h] | `src/js/engine.js:384-385` (`ciLow`) |
| Range in money | round((bound × S_ref + annexes) × ratio − deductions). The ratio is 1 unless other approaches are reconciled (Part 3). | `src/js/engine.js:450` (`rangeLow`), `src/js/engine.js:451` (`rangeHigh`) |

With a single comparable, a value is still computed, but there is no interval and no reliability class, and the
warning says so: `src/js/engine.js:407` (`insufficient`) (finding F-21, fixed).

What the interval means, and its approximations:

1. **It is a t interval.** It assumes that the adjusted prices are independent and roughly normal. It also rests on
   three simplifications:
   - the weights are treated as fixed, with equal error variance;
   - the degrees of freedom ⌊n_eff − 1⌋ are a rule of thumb;
   - beyond 30 degrees of freedom the critical value jumps to the normal one.
2. **For the median and the trimmed mean it uses the mean's half-width.** It is centred on the chosen estimator but
   does not reflect the estimator's own sampling error. The method chapter of the report says so (finding F-07, partly
   fixed).
3. **It measures the sampling error of the central estimate.** It does not include the uncertainty of δ, K_neg and
   g, which is assessed in [Part 2](2-uncertainty.md).
4. **It is not a range for the subject's own price.** That would be a prediction interval, with half-width about t · s_w
   · √(1 + 1/n_eff). On the demo it gives 436,000 – 600,000 (±15.8%), against ±5.6% for the confidence interval. The
   report calls the latter the «confidence interval of the estimate» and says what it measures; the pre-release code
   called it the «value range» of the property and, in the letter, a «reasonable range» (finding F-22, fixed).
5. **It does not contain the market value with the stated probability.** In the frequentist sense, the probability
   belongs to the procedure, not to one interval. The report glossary says so:
   `src/js/report_i18n.js:573` (`Confidence interval of the estimate',`); the pre-release code did not (finding F-12,
   fixed).

## 1.12 From unit value to market value

1. **Value of the dwelling.** V_dwelling = p* × S_ref: `src/js/engine.js:426` (`dwellingValue`).
2. **Add the subject's annexes.** V_market = V_dwelling + annexes, where annexes are the values of the parking space
   and storage room from `settings.annex`: `src/js/engine.js:424` (`annexValue`), `src/js/engine.js:430`
   (`marketGross`).
3. **Deductions D.** The sum of the positive amounts the valuer lists, for example the cost of regularising an
   installation: `src/js/engine.js:428` (`deductions`).
4. **Raw value.** V_raw = V_market − D. When other approaches are reconciled, V_raw = R − D, with R the reconciled
   value: `src/js/engine.js:443` (`ap.active`), `src/js/engine.js:445` (`totalRaw`).
5. **Rounding.** `src/js/engine.js:446` (`roundTo(totalRaw, rounding)`).
   - The step is `settings.rounding` if positive (at least 1); otherwise 1,000: `src/js/engine.js:234` (`1000`).
   - New valuations get a step by country: 100,000 for HU; 10,000 for CZ, DK, NO and SE; 1,000 elsewhere.
     `src/js/appcore.js:350` (`ROUNDING`).
   - The country step replaces the previous one only if that was the previous country's default:
     `src/js/appcore.js:386` (`roundingFor(prevCC)`).
6. **Unit value of the total.** V ÷ S_ref.
7. **Listing price.** V × (1 + m/100), rounded to five rounding steps (5,000 with the step of 1,000), where m =
   `settings.listingMarginPct` (5 in the demo): `src/js/engine.js:452` (`listingMarginPct`),
   `src/js/engine.js:236` (`const listingStep`). The pre-release code always rounded to 5,000 (finding F-08, fixed).
   - The listing price is a marketing recommendation, not a value. The report's glossary calls it «listing price»:
     `src/js/report_i18n.js:577` (`'Listing price'`) (finding F-12, fixed).

## 1.13 Warnings and quality checks

The engine attaches these warnings to the result:

| Code | Condition | Code reference |
|---|---|---|
| `invalid_comp` | comparable without a price or area: excluded | `src/js/engine.js:347` (`invalid_comp`) |
| `high_adjustment` | gross adjustment above 35% | `src/js/engine.js:354` (`high_adjustment`) |
| `insufficient` | fewer than 2 comparables in use | `src/js/engine.js:407` (`insufficient`) |
| `small_sample` | 2–5 comparables; the text recommends at least six, a requirement of the Spanish order | `src/js/engine.js:411` (`small_sample`) |
| `high_cv` | CV above 15% | `src/js/engine.js:417` (`high_cv`) |
| `invalid_area` | subject without a valid reference area: no value, or a value from the other approaches alone | `src/js/engine.js:436` (`invalid_area`) |

The quality review, `src/js/review.js`, runs these checks:

| Check | ok / info / warn / error | Code reference |
|---|---|---|
| Address and municipality | both present / — / — / missing | `src/js/review.js:55` (`subject-address`) |
| Coordinates | present / — / missing / — | `src/js/review.js:59` (`subject-coords`) |
| Reference area | > 0 / — / — / missing | `src/js/review.js:62` (`subject-area`) |
| Cadastral reference | present / — / missing / — | `src/js/review.js:65` (`subject-cadastre`) |
| Year built | present / — / missing / — | `src/js/review.js:69` (`subject-year`) |
| Energy certificate | present / missing / — / — | `src/js/review.js:72` (`subject-energy`) |
| Photos | ≥ 4 / 1–3 / none / — | `src/js/review.js:77` (`subject-photos`) |
| Sample size | ≥ 6 / — / 4–5 / ≤ 3 | `src/js/review.js:85` (`n >= 6`) |
| Dispersion (CV) | ≤ 15% / — / ≤ 20% / > 20% | `src/js/review.js:92` (`cv <= 0.15`) |
| Gross adjustments | all ≤ 35% / — / some > 35% / some > 50% | `src/js/review.js:98` (`grossAdj > 0.5`) |
| Data recency | ≤ 6 months / — / > 6 months / > 12 months | `src/js/review.js:105` (`age(x) > 12`) |
| Proximity | all ≤ 2 km / — / some > 2 km / — | `src/js/review.js:110` (`distanceKm > 2`) |
| Sources | other sources present / every comparable at an asking price, as the engine defines it (portal, agency mandate, other or no source) / — / — | `src/js/review.js:117` (`onlyAsking`) |
| Outliers | none / — / outside Q1 − 1.5·IQR … Q3 + 1.5·IQR, from 4 comparables / — | `src/js/review.js:124` (`1.5 * iqr`) |
| Comparable sizes | all within −40%/+40% / — / otherwise / — | `src/js/review.js:132` (`0.6`) |
| Negotiation coefficient | 0.88–0.99 / — / otherwise / — | `src/js/review.js:140` (`0.88`) |
| Annex values | consistent / — / annex without value / — | `src/js/review.js:183` (`annexBad`) |
| Location rationale | notes present / location rated without a note / — / — | `src/js/review.js:187` (`ratingNotes`) |
| Time adjustment | — / off, with data older than 3 months / — / — | `src/js/review.js:191` (`timeAdjust === false`) |
| Width of the range | ≤ 20% of the value / — / > 20% / — | `src/js/review.js:198` (`w > 0.2`) |
| Market inputs | confirmed / — / not confirmed (negotiation coefficient, time trend, annex values), or a file saved before this version with the demo's inputs / — | `src/js/review.js:149` (`'method-market'`) |
| Reasoning of the negotiation coefficient | — / asking prices on the default coefficient without reasoning / — / — | `src/js/review.js:161` (`'method-negotiation-reason'`) |
| Overrides | none / coefficients or annex amounts set outside the editor / — / — | `src/js/review.js:169` (`'method-overrides'`) |
| Reconciliation | reasoning given / — / other approaches weighted without reasoning / — | `src/js/review.js:176` (`'method-reconciliation'`) |
| Advisor, agency, purpose, dates, client | see the code | `src/js/review.js:206` (`report-advisor`), `src/js/review.js:210` (`report-office`), `src/js/review.js:214` (`report-purpose`), `src/js/review.js:224` (`report-dates`), `src/js/review.js:225` (`report-client`) |

- **Score.** 100 minus the penalties (info 1.5, warn 5, error 14), kept between 0 and 100: `src/js/review.js:33`
  (`PENALTY`), `src/js/review.js:232` (`score`).
- **Grade.** A ≥ 90, B ≥ 80, C ≥ 65, D ≥ 50, otherwise E: `src/js/review.js:233` (`grade`).
- **Outlier fences.** They follow the box-plot rule usually attributed to Tukey [TUKEY-1977] (content to be
  verified).
- **Negotiation check.** The check presents its range of 0.88–0.99 as Valesta's expectation:
  `src/js/review.js:142` (`Valesta expects 0.88`). The pre-release code called it the normal discount, without a source
  (finding F-10, fixed).

All thresholds are Valesta's design choices. Only the minimum of six comparables has an external source, art. 21.1.c of
the Spanish order [ES-ECO805]; Valesta recommends it in every country and names its origin. The cadastral and energy
texts of the checks name Spanish sources only for Spain: `src/js/review.js:45` (`const isES`) (finding F-09, fixed).

## 1.14 Worked example

The example is the demo valuation, which is synthetic: `src/js/data.js:159` (`settings`).

- **Subject.** 113 m² built; parking space and storage room included.
- **Valuation date.** 22 November 2026.
- **Settings.** Weighted estimator, 80% confidence level, negotiation 0.94, annexes 18,000 and 4,000.

The numbers below are printed by the engine of this version, run with Node.js on that state; `tests/methodology-docs.test.js`
checks them. Values are in euros, rounded half up for display.

### Comparables

| Id | P | S (m²) | K_neg | A | p | K | G | w | p_h |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 579,000 | 103 | 0.94 | 18,000 | 5,109.32 | 0.9561 | 0.24 | 0.6460 | 4,884.96 |
| T2 | 412,000 | 94 | 0.94 | 22,000 | 3,885.96 | 1.0524 | 0.30 | 0.5950 | 4,089.63 |
| T3 | 274,000 | 83 | 0.94 | 0 | 3,103.13 | 1.2006 | 0.31 | 0.5865 | 3,725.67 |
| T4 | 488,000 | 110 | 0.94 | 22,000 | 3,970.18 | 1.1746 | 0.165 | 0.7098 | 4,663.26 |
| T5 | 557,000 | 140 | 0.94 | 18,000 | 3,611.29 | 1.1384 | 0.215 | 0.6673 | 4,111.20 |
| T6 | 641,000 | 121 | 0.94 | 18,000 | 4,830.91 | 1.0292 | 0.43 | 0.4845 | 4,971.91 |
| T7 | 474,500 | 94 | 0.94 | 22,000 | 4,510.96 | 0.9499 | 0.47 | 0.4505 | 4,285.04 |

- **Same date as the valuation.** All seven are portal asking prices dated on the valuation date, so K_t = 1.
- **Two more comparables are excluded by the valuer.** They stay in the report as references.
  - R1 is a new build with its own coefficient 0.97.
  - R2 is an illegally occupied property marketed as a non-performing loan, not an open-market sale:
    `src/js/data.js:325` (`Illegally occupied`).

### Comparable T1, step by step

1. **Cleansed price.** P′ = 579,000 × 0.94 − 18,000 = 526,260.
2. **Unit price.** p = 526,260 ÷ 103 = 5,109.32.
3. **Ratings.** Size −1 (k 0.97), floor +1 (1.03), condition −1 (0.95), layout +1 (1.03), orientation +1 (1.02),
   outdoor space −2 (0.94), climate +1 (1.02).
4. **Total coefficient.** K = 0.9561. G = 0.03 + 0.03 + 0.05 + 0.03 + 0.02 + 0.06 + 0.02 = 0.24.
5. **Weight.** s = 0.76, so w = 0.85 × 0.76 = 0.6460.
6. **Adjusted price.** p_h = 5,109.32 × 0.9561 = 4,884.96.

### Statistics and value

| Quantity | Value |
|---|---|
| n | 7 |
| Mean / median / weighted mean | 4,390.24 / 4,285.04 / 4,388.54 |
| s / CV | 461.63 / 10.51% |
| n_eff / s_w | 6.8488 / 458.97 |
| Degrees of freedom / t (80%) | 5 / 1.476 |
| Interval of the unit value | 4,129.68 – 4,647.40 |
| V_dwelling = 4,388.54 × 113 | 495,905.10 |
| + annexes 22,000, rounded to 1,000 | **518,000** |
| Range: (4,129.68 × 113 + 22,000) and (4,647.40 × 113 + 22,000), rounded | 489,000 – 547,000 |
| Listing price: 518,000 × 1.05, rounded to 5,000 | 545,000 |
| Reliability | medium (CV above 10%) |
| Warnings | T6 and T7: gross adjustment above 35% |

Part 2 adds the uncertainty analysis for the same valuation. The Monte Carlo gives P10 504,214, P50 517,872 and
P90 531,887.

## 1.15 Limits

- **The default δ values are not calibrated.** They are a professional starting point, which the valuer should review
  for each market.
- **The ratings are ordinal and partly judgemental.** Location is entirely the valuer's judgement.
- **The coefficients are independent of each other.** Interactions between characteristics are modelled only through
  the product.
- **The negotiation coefficient and the time trend are inputs, not estimates.**
- **The confidence interval rests on the assumptions in §1.11.**
- **Several thresholds are Valesta's choices.** The sample minimum comes from Spanish rules.
- **The method does not adjust for property rights, financing or conditions of sale**, beyond the negotiation
  coefficient and the choice of comparables.
