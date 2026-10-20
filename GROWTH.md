# Paycheck Math — growth log

Site: https://paycheck-math.pages.dev
Repo: `~/projects/takehome` (build with `node build.mjs`, deploy with `wrangler pages deploy public`)

## Why this site

The typing site (`typing.rerivo.com`) was measured before building anything new:
28 days of GSC = 6 clicks / 4,408 impressions, average position ~60. The query set is
saturated by Typing.com, Monkeytype and TypingTest.com, and every page competes on an
already-generic head term. More pages there would not move the position.

This site attacks a different shape of demand: salary, hourly and take-home pay questions.
They are high-volume, formula-driven (one number in, one page out), and — from live SERP
checks — the top ten is not owned by the incumbents. On `how much is 27 an hour annually` the
results were pinebill.app, oysterlink.com, snagajob.com, careerbeacon.com; on
`42000 a year is how much an hour` the same small sites plus hivedesk.com. ADP and SmartAsset
only dominate the unqualified `paycheck calculator` head term, which is not what these pages
target. Finance is one of the highest-RPM ad categories.

## Milestones

| # | Milestone | Target | Status |
|---|---|---|---|
| M1 | Pages built and indexed | 428 pages, all 200, sitemap valid | done |
| M2 | GSC impressions / month | 50,000 | pending |
| M3 | Organic sessions / month | 100,000 | pending |
| M4 | Organic sessions / month | 1,000,000 | pending |

`1M` is a target, not a promise. Realistic time-to-first-traffic for a new domain on a
programmatic finance cluster is 6–12 months to 100k/month; 1M requires the state × salary ×
after-tax matrix to expand to roughly 8–10k pages and to earn links. That is the plan below,
not a claim about the present.

## What is built

- **428 pages**: 322 salary pages ($20k–$300k), 94 hourly pages ($7.25–$100), 51 state
  paycheck calculators, 4 hub pages, 5 static pages, plus sitemap/robots/llms.txt.
- Every page carries a live calculator that recomputes in the browser and writes `?salary=&state=`
  into the URL (shareable results).
- Tax engine verified against hand arithmetic: $65,000 single CA for 2026 gives federal
  $5,620.00, CA $2,140.85 — matches the independent calculation to the cent. Social Security
  caps correctly at the $184,500 wage base.

## Rates and sources

- Federal, 2026: IRS Rev. Proc. 2025-32 (standard deduction $16,100 / $32,200 / $24,150;
  brackets 10/12/22/24/32/35/37%).
- FICA, 2026: Social Security 6.2% up to $184,500, Medicare 1.45% plus 0.9% above $200,000.
  ssa.gov blocks automated fetches; the figure is corroborated by OnPay and Paycor and is
  stated as such on the methodology page.
- States: Tax Foundation 2026 state income tax table. 8 no-tax states, 15 flat, 28 bracket.
  State personal exemptions and credits are excluded, so state tax is slightly overstated.
  The two 2026 federal tables were cross-checked line by line against the revocation
  procedure's cumulative-tax column.

## Revenue wiring

- AdSense: build with `ADSENSE_CLIENT=ca-pub-XXXX node build.mjs` to emit the loader and one
  in-article unit per page. Without the variable the pages ship a neutral placeholder and no
  third-party script. Nothing is injected until an approved publisher ID exists.
- Affiliate candidates that fit the query intent: tax software (TurboTax/FreeTaxUSA), H&R Block,
  and high-yield savings accounts on the after-tax pages. Links are not placed yet because an
  unapproved affiliate link earns nothing and dilutes trust; they go in once one program is
  approved.

## Next actions, in order

1. Point a real domain at the Pages project (Cloudflare binding needs DNS write, which the
   current OAuth token does not have — `zone:read` only).
2. Submit `sitemap.xml` in Search Console as soon as the domain is live.
3. Add the second matrix: `hourly × state after tax` (e.g. "$25 an hour after taxes in Texas"),
   which is the query pattern where the small sites currently rank.
4. Add `salary after tax by state` pages for the top 20 salary values, then measure.

## Snapshot log

| Date | Pages | GSC impressions | GSC clicks | Notes |
|---|---|---|---|---|
| 2026-10-20 | 810 | n/a (new site) | n/a | Built and deployed to paycheck-math.pages.dev; 809 URLs accepted by IndexNow (HTTP 200) |

## Domain — the one thing that needs you

`pay.rerivo.com` is already attached to the Pages project and waiting on DNS. The Cloudflare
OAuth token on this machine has `zone:read` but not `dns:edit`, so the record cannot be created
from here (API returns 403). Two ways to finish it:

1. **Cloudflare dashboard** (30 seconds): rerivo.com → DNS → Records → Add record.
   Type `CNAME`, name `pay`, target `paycheck-math.pages.dev`, proxy **on**. The Pages project
already has the domain attached, so the certificate issues on its own.
2. **A token with DNS edit**: create a Cloudflare API token scoped to Zone → DNS → Edit for
   rerivo.com, then:
   ```
   curl -X POST "https://api.cloudflare.com/client/v4/zones/ab9f8a1d3afa14e3c70008c3d7ad7c07/dns_records" \
     -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
     -d '{"type":"CNAME","name":"pay","content":"paycheck-math.pages.dev","proxied":true}'
   ```

After the record resolves, redeploy with the real origin so canonical tags and the sitemap match
the public domain:

```
SITE_ORIGIN=https://pay.rerivo.com sh deploy.sh
```

Then add `https://pay.rerivo.com/` as a Search Console property and submit
`https://pay.rerivo.com/sitemap.xml`.

## Verified defects found and fixed during the build

- **Soft 404s**: Cloudflare Pages served the homepage with HTTP 200 for any unknown path, which
  would have let Google index unlimited near-duplicate URLs. A real `404.html` now returns 404.
- **Wrong canonical host**: the sitemap and canonical tags pointed at `pay.rerivo.com` while the
  only live host was `paycheck-math.pages.dev`, so every submitted URL would have failed domain
  verification. The build now takes `SITE_ORIGIN` and the deployed output matches the live host.
- **Unverifiable copy**: an early draft claimed a bracket boundary made +$1,000 and −$1,000
  asymmetric. Checking the engine showed the step is symmetric at every tested income, so the
  claim was removed rather than dressed up.
