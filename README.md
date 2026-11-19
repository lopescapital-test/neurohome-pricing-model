# NeuroHome Pricing Model

The internal cost-and-margin model behind NeuroHome's prices. Every sellable item is built from parts: labor by role at an hourly cost, merchandise by item at a unit cost. From those parts the model works out gross profit, gross margin, what cost of sale takes, and whether the item clears its margin floor.

This is the base for any new pricing model (clinic partnerships, expanded telehealth, new tiers). New models reuse the same cost library and the same math, so they stay comparable with the current catalogue.

> **Internal only.** This repo holds our unit costs and labor rates. Keep it private. Nothing here may be copied into family-facing code. `neurohome-app` deliberately keeps costs out of its pricing bundle and tests for it.

## What's here

| File | What it is |
|---|---|
| `model.js` | The data and the math, with no UI. It holds the cost library (`COMPONENTS`), settings (`GLOBALS`), sections with margin floors (`SECTIONS`), every product (`PRODUCTS`), and `calc()`. It runs in the browser (`window.NHModel`) and in Node (`require('./model.js')`). |
| `index.html` + `app.js` | The Margin Book page. It has one cost column per labor role and per merchandise item, a breakout for each row, and an editable cost library. Open `index.html` in a browser; no build step is needed. |
| `scripts/build.js` | Inlines `model.js` and `app.js` into `dist/margin-book.html`, the one-file page published as the Margin Book artifact. `dist/` is not committed. |
| `scripts/export-csv.js` | Exports every product to CSV with the per-part costs. Run `node scripts/export-csv.js > margins.csv`. Override the settings with `PAY=3 COMM=10 WS=50`. |

## Reviews

Analyses built on this model are kept in `reviews/`, one folder per review.

- [`reviews/2026-11-comp-plan/`](reviews/2026-11-comp-plan/): the proposed Specialist and care-team compensation plan, tested against the model. Includes a stress-test page, a board markup of the deck and a revised deck.

## How a product is defined

```js
add('v2c', '60-minute sessions', 14500, [
  ['pt', 41, '60-min assessment + 39 × 60 min + 60-min closing call'], // labor: hours
  ['coach', 2, 'Week 0: two 60-min setup calls'],
  ['panel', 1], ['gHand', 1], ['glasses', 2],                          // merchandise: units
  ['gut', 1], ['oat', 1],
]);
```

Each line is `[componentKey, quantity, why]`. The cost of a line is quantity × the component's unit cost. Labor quantities are hours; merchandise quantities are units. `calc()` returns the cost of each part, the labor and merchandise totals, gross profit and margin, the cost of sale, what's left for overhead and profit, and the item's status against its floor.

## Building a new model (clinic, telehealth, …)

1. **New roles or items:** add them to `COMPONENTS`. Set `kind` (`labor` or `merch`), `unit`, `cost` and `retail`, and add a `src` that names where the cost came from. Mark guesses `assumed: true`.
2. **New products:** add a section to `SECTIONS`, with a `floor` if the product line has a margin rule. Then add products in `buildProducts()` using the components above. Reuse the shared building blocks (`KIT_THERAPIST`, `KIT_SIX`, `CORE_FOUR_2MO`) instead of retyping kit contents.
3. Open `index.html`. The new roles and items get their own columns automatically.

When a model grows large, move it to its own file (`models/clinic.js`) that reads `NHModel.COMPONENTS` and pushes its products. That way the cost library stays in one place.

## How the published page stays current

The Margin Book is published as a private claude.ai artifact (https://claude.ai/artifact/MkTAz1ByqBqaLcNvSknRHo). A scheduled Claude task in the repo owner's Claude desktop app, **"Republish Margin Book"**, runs on weekdays at 8:00 local time:

1. It fetches `origin/main` and compares its commit with `.last-published`, a local file that is not committed.
2. If nothing changed, it stops.
3. If something changed, it fast-forwards the local copy, runs `node scripts/build.js`, republishes `dist/margin-book.html` to that artifact, and records the commit.

**To update the page:** push to `main`. The page updates at the next run. To update it sooner, run the task from the app's scheduled tasks.

**Limits:** the task runs only while the Claude app is open; a missed run happens at the next launch. It never merges or overwrites local edits. If the local copy has uncommitted changes or has diverged from `main`, it stops and reports.

## Sources and how current they are

- **Prices:** `neurohome-app` `lib/pricing` (catalogue and registries), read 2026-11-17. When a price changes there, change it here.
- **Costs:**
  - `neurohome-journey` Plans v5.0 (2026-08-20): PT $70/hr, physician $500/hr, labs, kit and supplements.
  - `neurohome-app` CLAUDE.md: green panel $318, green handheld $247, coach $40/hr.
  - The "Inventory master" those documents cite is not on GitHub. Reconcile it here when it changes.

## Open items

- **Assumed costs.** Coordinator (PTA) $40/hr, Dr. Kyle $0, Eva support $0, Hub $0, Mycotoxins $427, and supplement wholesale at 50% of retail for SKUs with no recorded cost.
- **AdrenaCalm.** The recorded cost ($65 a bottle) is above its $50 retail. Check the invoice.
- **Not in any cost:**
  - kit shipping
  - kits lost on early exit
  - paid no-shows
  - the coach assigned to v2 Clinical
  - Hub hosting and AI
  - training and software
- **Not modelled:** the In-clinic intensive, because no cost data exists for it.
- **Cost of sale defaults.** Commission defaults to 0% and payment fees to 3%. Set real rates, including Cherry's merchant fee.
