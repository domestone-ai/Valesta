# Part 3 — Income, cost and residual approaches, and the reconciliation

Status: draft for technical review, 24 November 2026. Code references point to this version of the repository.

## 3.1 Approaches by property type

For each of the 48 property types, the code lists of Valesta give the recommended approaches:
`src/js/taxonomy.js:28` (`TYPES`), `src/js/taxonomy.js:101` (`APPROACHES`). In the standard the field is called
`recommendedApproaches` and states no order of preference.

| Category | Approaches in the code list | Computed by the engine |
|---|---|---|
| Residential | sales comparison, income capitalisation | both |
| Retail; offices | income capitalisation, discounted cash flow, sales comparison | not the discounted cash flow |
| Wholesale | income capitalisation, sales comparison | both |
| Industrial and logistics | income capitalisation, cost, sales comparison | all three |
| Hospitality | profits method, income capitalisation, sales comparison | not the profits method |
| Land | residual, sales comparison | both |
| Accessory units | sales comparison | yes |
| Special and mixed use | cost, income capitalisation | both |

Every valuation runs the sales comparison of Part 1. The engine also computes three optional approaches, which the
valuer switches on and fills in:

- income, by direct capitalisation;
- cost, as depreciated replacement cost;
- residual, by the static procedure.

The engine does not compute:

- the discounted cash flow;
- the profits method;
- automated valuation models.

The code list names all three, with these consequences (finding F-13):

- **Retail units and offices.** They list income capitalisation, which the engine computes, and the discounted cash
  flow, which it does not.
- **Hospitality.** It lists the profits method first, and that method is not available.
- **Special and mixed-use types.** Their list does not include the sales comparison, yet the market comparison still
  enters the reconciliation with weight 100 by default.

The inputs of these approaches are percentages written as numbers (5 = 5%). Each function returns nothing when its key
inputs are missing or not positive: `src/js/engine.js:246` (`const approaches`).

## 3.2 Income approach: direct capitalisation

`src/js/engine.js:248` (`income(o)`):

```text
gross income      G   = monthly rent × 12
effective income  E   = G × (1 − vacancy)
net income        NOI = E × (1 − operating costs)
value             V   = NOI ÷ capitalisation rate
```

| Input | Meaning |
|---|---|
| Monthly rent | market rent of the property, per month |
| Vacancy | allowance for voids and bad debts, as a share of the gross income |
| Operating costs | non-recoverable costs borne by the owner, as a share of the effective income |
| Capitalisation rate | the yield that converts one year of net income into a value |

Basis:

- **Income approach in general.** It is one of the approaches of the international standards [IVSC-2025].
- **Spain.** The order values by discounting cash flows. It requires information on at least six rents: arts. 24–33
  and art. 25.a of [ES-ECO805].
- **Germany.** The *Ertragswertverfahren* is in §§ 27–34 of [DE-IMMOWERTV].

Limits:

- one year of income, no growth, no holding period and no reversion;
- the capitalisation rate is the valuer's input and should come from market evidence;
- vacancy and costs are flat percentages.

## 3.3 Cost approach: depreciated replacement cost

`src/js/engine.js:258` (`cost(o)`):

```text
cost new       C  = unit building cost × area
loaded cost    C′ = C × (1 + fees) × (1 + developer's profit)
depreciated    C″ = C′ × (1 − min(1, depreciation))
value          V  = land value + C″
```

- **The area.** It is the reference area of the subject unless the valuer enters another one: `src/js/engine.js:295`
  (`area: refArea`). That area depends on the area basis and excludes the annexes, which the market value includes, so
  the two values may cover different things (§3.5).
- **Depreciation** is one percentage, capped at 100%.
- **The developer's profit** applies to the cost including fees.

Basis:

- **The cost approach of the international standards** [IVSC-2025].
- **Spain.** Gross and net replacement value: arts. 17–19 of [ES-ECO805].
- **Germany.** The *Sachwertverfahren*: §§ 35–39 of [DE-IMMOWERTV].

Limits:

- the land value is an input, not derived;
- depreciation is a single figure, not split into physical, functional and external obsolescence;
- no adjustment to market conditions, of the kind German practice makes with *Sachwertfaktoren* (§ 21 of
  [DE-IMMOWERTV]).

## 3.4 Residual approach: static procedure

`src/js/engine.js:269` (`residual(o)`):

```text
gross development value  GDV = saleable area × sale price per m²
fees                     F   = building cost × fees
finance                  Fi  = (building cost + F) × finance rate
developer's profit       B   = GDV × profit
sale costs               Sc  = GDV × sale costs
value                    V   = GDV − building cost − F − Fi − B − Sc
```

- **Nothing is discounted.** All amounts are taken at today's values.
- **The value can be negative.** Nothing stops it.
- **What the value represents.** It is the value of the land, or of the property to be transformed.

Basis: the Spanish order has two residual procedures [ES-ECO805]:

- **Dynamic procedure (arts. 36–39).** It discounts the cash flows of the development.
- **Static procedure (arts. 40–42).** It works with current values. Its formula is F = VM · (1 − b) − ΣCi, with the
  developer's margin b as a share of the value (art. 42). Art. 34.3 limits it to plots and buildings to be renovated
  where works can start within one year, and to built plots.

Valesta's formula has the same structure as the static procedure. It takes the profit and the sale costs as shares of
GDV and subtracts the costs, with finance as a flat percentage instead of discounting. It should therefore be used only
where the static procedure is acceptable: short projects that can start soon.

Before entering the developer's profit, check whether that margin already covers finance and marketing costs. Some
definitions of the margin do, for example art. 41 of [ES-ECO805] (content to be verified). In that case, entering
Valesta's separate finance and sale-cost inputs as well would count those costs twice.

Limits:

- no time value of money and no phasing;
- purchase costs and taxes on the land are not separated;
- the engine does not check that a land value is reconciled only with land (§3.5).

## 3.5 Reconciliation

`src/js/engine.js:281` (`reconcile(values, weights)`), `src/js/engine.js:290` (`function approachesOf`).

### Which values are used

- **Market comparison.** Its value is V_market: the value of the dwelling plus annexes, before deductions (Part 1,
  §1.12).
- **The other approaches.** Their values count only if switched on and computable.

### How they are combined

- **Weights.** They are read from `state.approaches.weights`. The market comparison has 100 by default:
  `src/js/engine.js:298` (`market: 100`).
- **Which approaches count.** An approach counts if its value is a finite number and its weight is above zero. The
  weights of the approaches that count are normalised to sum to 1.
- **Reconciled value.** R = Σ_k w_k · V_k.
- **When the reconciliation applies.** Only if at least one approach other than the market comparison counts:
  `src/js/engine.js:301` (`out.active`). Otherwise the market value stands.

### What happens next (Part 1, §1.12)

- **The value.** V = round(R − deductions).
- **The range.** The bounds of the confidence range are multiplied by R ÷ V_market. The range is scaled, not
  recomputed: the other approaches bring no uncertainty measure of their own.

### Cases without a sales-comparison basis

| Case | What the engine does |
|---|---|
| Market comparison weight 0 | The value comes from the other approaches alone, and no range is shown: the confidence interval belongs to the sales comparison, which does not enter the value. With the demo and the income approach of §3.6 at weight 100, the value is 323,000. The pre-release code showed the market confidence range scaled by R ÷ V_market (305,000 – 341,000). |
| Missing subject area, or no usable comparable, with another approach switched on | The value comes from the other approaches alone, there is no range, and the warning `invalid_area` says so. |

These are finding F-21, fixed: the report then prints no interval in the letter, the summary or the result.

### How the report shows it

The report shows each approach with its inputs, and a reconciliation table with each value and its normalised weight:
`src/js/report.js:1113` (`function pApproaches`). The cover lists the approaches used:
`src/js/report.js:1108` (`function methodsLine`). The report's note attributes the weights to the reliability of each
approach for the property and the market:
`src/js/report_i18n.js:694` (`The weights reflect how reliable each approach is`). The pre-release code added «(IVS
103)», which could not be verified on the text (finding F-16, fixed).

The valuer records the reasoning of the weights, and the report prints it: `src/js/report.js:1141` (`X.reasonTitle`).
The quality review flags other approaches weighted without reasoning:
`src/js/review.js:176` (`'method-reconciliation'`). The Spanish order requires stated and justified weights for
comparables (art. 22.1.d of [ES-ECO805]). The international standards and the US literature are understood to expect an
explanation of the weight given to each indication [IVSC-2025] [AI-ARE-16] (content to be verified). The pre-release
code had no such field (finding F-14, fixed).

### Scope of the values

The valuer must make sure that every value covers the same thing. The market value includes the annexes and is taken
before deductions. A rent or a cost must cover the same scope. A residual land value should be reconciled only when
the subject is land or a property to be redeveloped.

## 3.6 Illustration with synthetic inputs

The engine's functions of this version were run on the inputs below; `tests/methodology-docs.test.js` checks them. The
amounts are in euros.

| Approach | Inputs | Steps | Value |
|---|---|---|---|
| Income | rent 1,500 a month; vacancy 5%; operating costs 15%; capitalisation rate 4.5% | gross 18,000; effective 17,100; net 14,535 | **323,000** |
| Cost | land 120,000; 1,400 per m² × 110 m²; fees 10%; profit 12%; depreciation 25% | cost new 154,000; loaded 189,728; depreciated 142,296 | **262,296** |
| Residual | 900 m² at 3,200 per m²; building cost 1,350,000; fees 10%; finance 6%; profit 18%; sale costs 3% | GDV 2,880,000; fees 135,000; finance 89,100; profit 518,400; sale costs 86,400 | **701,100** |

A reconciliation with market value 400,000 (weight 70), income 323,000 (weight 30) and cost (weight 0) gives:

> 0.7 × 400,000 + 0.3 × 323,000 = **376,900**

The cost approach does not count because its weight is zero.
