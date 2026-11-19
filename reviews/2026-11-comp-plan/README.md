# Compensation plan review, November 2026

A review of the proposed Sales and Care Team Compensation Plan (board review draft, prepared by Matthew Hawes, November 2026) against the costs in this repo's pricing model.

> **Internal only.** These files show our unit costs, margins and proposed pay. Do not forward them outside the company.

## Files

| File | What it is |
|---|---|
| `commission-plan-stress-test.html` | Nine example sales, one per commission type, run through the plan as drafted and with the amendments. Each sale has two bars that split the price into cost, commission, bonuses, fees and what is left, plus a Plan A / Plan B switch. Download it and open it in a browser. |
| `comp-plan-board-markup.pdf` | The original deck with recommended amendments A1 to A11 marked in red: strike-throughs, inline replacements and callouts. Two slides are added before the ask: the amendment list and the recast examples. |
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
