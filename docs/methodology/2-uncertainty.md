# Part 2 — Valuation uncertainty

Status: draft for technical review, 24 November 2026. Code references point to this version of the repository.

## 2.1 What is measured

The confidence interval of [Part 1, §1.11](1-sales-comparison.md#111-dispersion-reliability-and-confidence-interval)
measures how dispersed the adjusted sample is. It does not show how much the value depends on two other things:

1. **single comparables.** Would the value move if one of them were dropped?
2. **the valuer's judgement.** This means the inputs that Valesta does not estimate: the negotiation coefficient, the
   time trend, the annex values, the factor weights δ and the ratings.

`src/js/engine.js:553` (`function robustness`) answers both, with a leave-one-out analysis and a Monte Carlo
simulation. For a given seed the result is always the same.

Three places call it:

- the report runs 600 iterations: `src/js/report.js:1298` (`n: 600`);
- the editor runs 600 iterations: `src/js/editor.js:1504` (`n: 600`);
- the AI tools run 300 iterations: `src/js/aitools.js:363` (`n: 300`).

## 2.2 Leave-one-out

For each comparable in use, the engine:

1. removes that comparable: `src/js/engine.js:561` (`include = false`);
2. recomputes the whole valuation with the same settings;
3. records the rounded value V₋ᵢ and the relative change Δᵢ = (V₋ᵢ − V) ÷ V: `src/js/engine.js:563` (`loo.push`).

The result is the list of Δᵢ and the largest |Δᵢ|: `src/js/engine.js:601` (`looMaxAbs`).

A large |Δᵢ| means that the value leans on one comparable. Because the values compared are rounded, the changes move in
steps of one rounding step. With a value of 518,000 rounded to 1,000, a step is about 0.2%.

## 2.3 Monte Carlo simulation

### Iterations and random numbers

- **Number of iterations.** `opts.n`, 800 by default, kept between 20 and 5,000: `src/js/engine.js:565`
  (`Math.min(5000`).
- **Random numbers.** They come from Mulberry32, a 32-bit generator: `src/js/engine.js:530` (`function mulberry32`).
- **Seed.** 20261122 by default: `src/js/engine.js:566` (`20261122`). The same inputs always give the same results.

### What each iteration varies

Each iteration copies the valuation (`src/js/engine.js:541` (`function lite`)) and varies these inputs independently.
U(a, b) is a uniform draw between a and b.

| Input | Variation | Code |
|---|---|---|
| Default negotiation coefficient | K₀ + U(−0.02, +0.02), where K₀ is the setting, or 0.94 if it is missing | `src/js/engine.js:569` (`neg0`), `src/js/engine.js:575` (`u(-0.02, 0.02)`) |
| Annual time trend | g₀ × U(0.5, 1.5) | `src/js/engine.js:570` (`trend0`), `src/js/engine.js:576` (`u(0.5, 1.5)`) |
| Parking and storage values | each × U(0.85, 1.15) | `src/js/engine.js:577` (`u(0.85, 1.15)`) |
| Weight δ of each factor | each × U(0.8, 1.2) | `src/js/engine.js:579` (`u(0.8, 1.2)`) |
| Each rating of each comparable | with probability 0.10, moved one level up or down (even odds), kept in [−2, +2] | `src/js/engine.js:582` (`rnd() < 0.1`) |

Each iteration then recomputes the valuation and keeps the unrounded value: `src/js/engine.js:586` (`totalRaw`).

### What is not varied

- **Some negotiation coefficients do not change.** These are the comparables' own coefficients and the 1.00 of land
  registry and closed sales. Only comparables that use the valuation default feel the variation.
- **The valuer's overrides do not change:** neither the coefficients (`kOverride`) nor the annex amounts
  (`annexOverride`).
- **The weights of the reconciliation with other approaches do not change.**
- **The weights δ under the `uniform10` preset.** That preset ignores δ, so varying δ has no effect.
- **A time trend of zero stays zero.** It is varied by multiplication.
- **Several inputs stay as entered:**
  - prices, areas and dates;
  - the area basis and the estimator;
  - the deductions;
  - the inputs of the other approaches.

### Effects to keep in mind

- **Clamping.** A rating already at ±2 can only move inwards, and a δ near 0.25 is capped after the variation. This
  makes the variations slightly asymmetric.
- **Sampling error of the simulation.** The percentiles depend on the number of iterations and on the seed. With the
  default of 800 iterations, the demo's P05 is 500,800 instead of the 501,222 obtained with the report's 600.
- **Missing negotiation default.** When the default coefficient is missing, the simulation varies it around the same
  default as the value, 1.00. In the pre-release code it varied it around 0.94 while the value used 1.00, so that on the
  demo the whole P10–P90 band lay below the value of 551,000 (finding F-01, fixed).

### Outputs

- **Statistics of the simulated values.** Mean, standard deviation, CV, and the percentiles P05, P10, P50, P90 and P95.
  The percentiles use the same interpolation as the quartiles of Part 1: `src/js/engine.js:602` (`p05`).
- **Histogram.** 14 bins of equal width: `src/js/engine.js:592` (`bins = 14`).

### Basis

- **Monte Carlo method.** Random sampling of the inputs to study the output [METROPOLIS-ULAM-1949].
- **Propagation of distributions.** JCGM 101:2008 describes how to propagate the distributions of a model's inputs to
  its output by Monte Carlo sampling [JCGM-101-2008]. Valesta's ranges are judgement, not distributions estimated from
  data: see §2.7.

## 2.4 How the report presents it

`src/js/report.js:1250` (`function pUncertainty`) shows:

- **P10, P50 and P90**, rounded with the rounding step of the valuation:
  `src/js/report.js:1084` (`function uncertaintyKpis`). The pre-release code rounded them to 1,000 whatever the currency
  (finding F-08, fixed).
- **The spread** ±h, where h = (P90 − P10) ÷ 2 ÷ V: `src/js/report.js:1088` (`mc.p90 - mc.p10`).
- **A histogram** with the P10–P90 band.
- **A bar chart** of the leave-one-out changes.

The report then classifies the estimate: `src/js/report.js:1255` (`robust`). The thresholds are conventions of
Valesta, not taken from a standard or estimated from data.

| Class | Condition |
|---|---|
| robust | max \|Δᵢ\| ≤ 3% and h ≤ 5% |
| moderately sensitive | max \|Δᵢ\| ≤ 6% and h ≤ 10% |
| sensitive to the assumptions | otherwise |

The report lists the assumptions of the simulation. It adds that the analysis is not a declaration of «material
valuation uncertainty»: `src/js/report_i18n.js:558` (`material valuation uncertainty`). Its introduction says that the
assumptions vary within the ranges it sets out: `src/js/report_i18n.js:552` (`within the ranges set out below`). The
pre-release code referred there to «IVS 104 / RICS VPS 6», which [Part 4](4-international-framework.md) could not verify
(finding F-16, fixed).

## 2.5 Worked example

This is the demo valuation of Part 1, with value 518,000, 600 iterations and seed 20261122.

### Leave-one-out

| Comparable removed | Value without it | Change |
|---|---|---|
| T1 | 508,000 | −1.93% |
| T2 | 524,000 | +1.16% |
| T3 | 530,000 | +2.32% |
| T4 | 511,000 | −1.35% |
| T5 | 524,000 | +1.16% |
| T6 | 509,000 | −1.74% |
| T7 | 519,000 | +0.19% |

The largest change is 2.32%, when T3 is removed.

### Monte Carlo

Over 600 iterations:

| Statistic | Value |
|---|---|
| Mean | 518,033 |
| Standard deviation | 10,592 (CV 2.04%) |
| P05 | 501,222 |
| P10 | 504,214 |
| P50 | 517,872 |
| P90 | 531,887 |
| P95 | 535,468 |

The spread is h = (531,887 − 504,214) ÷ 2 ÷ 518,000 = 2.67%. Since 2.32% ≤ 3% and 2.67% ≤ 5%, the report classifies
the estimate as **robust**, by Valesta's thresholds.

### Comparison with the confidence interval

For comparison, the 80% confidence range of Part 1 (489,000 – 547,000) is ±5.60% of the value. The two answer
different questions, and Valesta does not combine them:

- the confidence interval reflects the dispersion of the sample;
- the simulation reflects the sensitivity to judgement.

## 2.6 Three measures, three questions

| Measure | Question it answers | Part |
|---|---|---|
| Confidence interval | How precise is the central estimate, given the dispersion of the adjusted sample? | Part 1, §1.11 |
| Leave-one-out | Does the value depend on one comparable? | §2.2 |
| Monte Carlo | How much does the value move when the judgement inputs vary within Valesta's ranges? | §2.3 |

The literature treats valuation uncertainty as the doubt about the figure at the valuation date, distinct from the
variation between valuers or over time [FRENCH-GABRIELLI-2004] (content to be verified). The three measures above cover parts of it.
None covers errors in the data (wrong areas or prices), the choice of comparables, or the choice of method.

## 2.7 Limits

- **The ranges are conventions of Valesta.** They are not estimated from data: ±0.02, ×0.5–1.5, ±15%, ±20% and 10%.
- **The inputs are varied independently.** Real judgement errors may be correlated, for example δ and the ratings.
- **The random moves of the ratings treat all factors alike.**
- **The leave-one-out analysis uses rounded values.** The simulation uses unrounded ones.
- **The analysis does not include the sampling error of the confidence interval.**
- **The analysis is not a statement of material valuation uncertainty under the professional standards**, as the
  report says.
