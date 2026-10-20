# Expansion plan — what to build next, in what order

The site currently covers one axis per page. The 1M-session target needs the matrix below,
built in this order, because each step reuses pages the previous step already made.

## Where the demand actually is

Live SERP checks on 2026-10-20 (Tavily, US, top 10):

| Query | Who ranks | Read |
|---|---|---|
| `how much is 27 an hour annually` | pinebill.app, indeedflex, ziprecruiter, snagajob, careerbeacon, oysterlink | small calculators rank; no employer moat |
| `42000 a year is how much an hour` | joinotto, oysterlink, snagajob, ziprecruiter, hivedesk | same, plus one small site per result |
| `how much is 25 an hour after taxes` | finalroundai, salarycalculatoraftertaxes.com, paycheckcalculatorcalifornia.com, smartasset, adp | one small site ranks against ADP — the gap is real |
| `texas paycheck calculator` | ADP, surepayroll, esmartpaycheck, smartasset, gusto, irs.gov | head term is owned; do not attack it |

Conclusion: attack the number-plus-state long tail, not the head terms.

## Step 1 — hourly × state after tax (done, 3 states)

`$N an hour after taxes in {state}` for 91 rates × TX/CA/FL. Next: add the other five
no-tax states (AK, NV, NH, SD, TN, WA, WY) — 7 × 91 = 637 pages. These are the states where
the take-home number is most surprising, and they have the least competing content.

## Step 2 — salary × state after tax

`$N a year after taxes in {state}` for the top 20 salary values × 51 states = 1,020 pages.
Reuses the same engine and the same differentiation blocks as the existing after-tax pages.

## Step 3 — biweekly and monthly pay

`$N a year biweekly`, `$N a year per month`, `$N an hour biweekly`. These are separate
queries with their own intent (paycheck frequency), and the calculator already computes them.
Roughly 300 salary values × 3 frequencies.

## Step 4 — comparison pages

`$25 an hour vs $30 an hour`, `Texas vs California take-home pay`. Low volume each, but they
attract links because they are genuinely useful, and links are what the domain still lacks.

## Guardrails

- Every generated page must carry at least one number that changes with its inputs (state tax,
  marginal rate, or the ±$1,000 step). Pages that only swap a number in a headline do not ship.
- `node build.mjs --check` must pass and `node tools/health.mjs` must be 12/12 before deploying.
- Nothing ships with a canonical pointing at a host that is not live.
- Adjacent-page similarity stays under 0.75 Jaccard on body text. Measured on 2026-10-20:
  after-tax salary pages 0.747, state calculators 0.796 (before the differentiation blocks),
  0.804 for hourly-by-state. Adding blocks moved the state pages but not enough; the next
  expansion must add per-page unique facts, not just one extra paragraph.
