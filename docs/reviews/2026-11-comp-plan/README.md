# Compensation plan review, November 2026

A review of the proposed Sales and Care Team Compensation Plan (board review draft, prepared by Matthew Hawes, November 2026) against the costs in this repo's pricing model.

> These files show our unit costs, margins and proposed pay. The repo is public, so anyone with the link can read them.

**Live page:** https://lopescapital-test.github.io/neurohome-pricing-model/reviews/2026-11-comp-plan/ (`index.html` in this folder links to every file below).

## Agreed in the November 20 meeting

| # | Decision |
|---|---|
| D1 | One rate: 10% on every sale. First plans, second intensives, Continuing Care and equipment, in a package or on its own. |
| D2 | Never commissioned: labs, physician or clinical-consult time (Dr. Jared, Dr. Kyle, any licensed clinician who diagnoses) and supplements. Inside a package they come off the price first. |
| D3 | Supplements pay Specialists nothing. An amount equal to 10% of supplement revenue (placeholder; 5% discussed) funds the care team pool. |
| D4 | Care team markers: NPS 80+, clean compliance audits with notes complete, 90% of families completing their plan of care and moving into Continuing Care. |
| D5 | Pool payout: three markers 100%, two 75%, fewer nothing. Team share by caseload, 60% PT / 40% PTA. Unearned money stays in the pool. |
| D6 | No pool at launch; the board sets a small first pool once there is cash. |
| D7 | A second intensive for a returning family is hours only, no kit, at 10% of its price. |
| D8 | Commission accrues at sale and is released when the cash is collected. |
| D9 | Commission only. Plan B, the stretch goal and the bonuses were not decided and are held for the board. |

| File | What it is |
|---|---|
| `agreed-plan-stress-test.html` + `agreed-plan.js` | Eleven example sales, draft vs agreed, plus a typical month, Specialist earnings, care team pool sizing and the open items. `node agreed-plan.js --html` rebuilds the numbers from `model.js`. |
| `comp-plan-redline-nov20.pdf` | The original deck with D1 to D9 marked in red, plus the decision list and the example sales. |
| `comp-plan-final.pdf` | The clean plan as agreed, with a "Still to decide" slide. Pending attorney review. |

Guardrails in the final deck that the meeting did not discuss come from the November 19 revision: commission net of card and financing fees, pro-rata clawbacks for the whole refund window, nothing sold below cost pays, and worker classification in the attorney review.

## Earlier review, November 19

| File | What it is |
|---|---|
| `commission-plan-stress-test.html` | Nine example sales, one per commission type, run through the plan as drafted and with the amendments. Each sale has two bars that split the price into cost, commission, bonuses, fees and what is left, plus a Plan A / Plan B switch. Download it and open it in a browser. |
| `comp-plan-board-markup.pdf` | The original deck with recommended amendments A1 to A11 marked in red: strike-throughs, inline replacements and callouts. Two slides are added before the ask: the amendment list and the recast examples. |
| `therapy-only-commission.html` + `therapy-only.js` | A scenario that pays commission only on therapy and coaching. The kit, labs, supplements, Dr. Jared's time and the Hub are carved out, and stand-alone sales of them pay nothing. Every program is broken into its line items, with commission shown on the therapy and coaching lines only. `node therapy-only.js --html` rebuilds the line-item sections from the current costs in `model.js`. |
| `comp-plan-revised.pdf` | The clean revised deck, in the same style, with the amendments written in. It adds a slide that gives every product a rate. |

## The amendments

| # | Change |
|---|---|
| A1 | Pay therapy plans on price minus pass-through costs: labs, physician time, supplements included in a program, and supplement credits. |
| A2 | Cap commission plus bonuses on any one sale at 25% of that sale's gross profit. |
| A3 | No bundle bonus on any product that already includes equipment. This includes the Pre-Intensive. |
| A4 | Name a rate for every product. Anything not listed pays no commission. |
| A5 | Pay supplements on gross margin (20% / 10%), like equipment. Nothing sold below cost pays commission. |
| A6 | Claw back refunds and cancellations for the whole refund window, pro rata. |
| A7 | Define cash collected as net of card and financing fees. |
| A8 | Grow the care team pool with completed plans of care, never with sales. |
| A9 | Add worker classification for 1099 clinicians to the attorney review. |
| A10 | Use catalogue prices in examples: an $850 panel with $532 of margin pays a Plan A Specialist $106. |
| A11 | Hold margin floors on two bases, gross margin and margin after cost of sale, and set a maximum ad cost per family. |

## What the numbers rest on

- **Costs.** From `model.js` at commit `6acde32`. Some costs are assumed: coordinator $40/hr, Hub $0, and 50% wholesale for supplements with no recorded cost. The model does not cost shipping, no-shows or the coach assigned to Clinical, so real margins are a few points lower.
- **Card fees.** 3% of price. Cherry financing fees would add to this.
- **Pre-Intensive, as drafted.** Shown at the most the draft allows: 15% commission, plus the $250 bundle bonus, plus the 1.5% paid-in-full bonus.
- **Revised deck, typical-month slide.** Assumes all four families' plans include the standard $950 of labs, and that supplements carry a 50% margin.
- **Revised deck, earnings range.** The $140,000 to $165,000 range is the draft's own $150,000 to $175,000, reduced by about 6% for the pass-through rule.
- **Unlisted products.** "None" for Eva, Hub, labs and clinician time, and 15% of net for the Dr. Jared bundle, are recommendations for the board to confirm.
