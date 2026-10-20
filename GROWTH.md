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

- **AdSense**: build with `ADSENSE_CLIENT=ca-pub-XXXX node build.mjs` to emit the loader and one
  in-article unit per page. Without the variable the pages ship a neutral placeholder and no
  third-party script. Verified both paths: with the variable the page contains the `adsbygoogle`
  loader and unit, without it nothing is injected. Nothing is live until an approved publisher ID
  exists — that application is the user's (it needs their identity and a live domain).
- **RPM reference**: published 2025 AdSense benchmarks put the finance category at roughly
  $20–$50 page RPM for US traffic (techconda.com benchmark round-up, cited as an industry
  estimate, not a guarantee). At 100k sessions/month that is a $2k–$5k range; at 1M, $20k–$50k.
  These are estimates and will be wrong in either direction until real data exists.
- **Affiliate candidates** that fit the query intent: tax software (TurboTax, FreeTaxUSA, H&R
  Block) on after-tax pages, and high-yield savings accounts on the take-home pages. Not placed
  yet: an unapproved affiliate link earns nothing and costs trust. They go in once one program
  approves the site.

## Next actions, in order

1. Point a real domain at the Pages project (see the domain section below).
2. Submit `sitemap.xml` in Search Console as soon as the domain is live.
3. Apply for AdSense once the domain is live, then rebuild with `ADSENSE_CLIENT`.
4. Execute steps 1–3 of `EXPANSION.md` (hourly × state, salary × state, pay frequency).

## Milestone math, stated honestly

Nothing here has organic traffic yet — the site was built on 2026-10-20 and the only submission
is IndexNow (811 URLs, HTTP 200). The honest position:

- A new domain in a competitive finance cluster typically needs 6–12 months before programmatic
  pages rank for anything commercial. Expect near-zero for the first 8–12 weeks.
- 100k sessions/month is the realistic first success marker, not 1M. It needs roughly
  1,500–2,500 indexed pages earning an average of 40–60 sessions each per month.
- 1M sessions/month needs the full matrix (≈8–10k pages) plus earned links. Links are the
  binding constraint, not page count — that is why `EXPANSION.md` step 4 is comparison pages and
  why the next real work after expansion is outreach, not more generation.

What is verified today: 12/12 health checks against the live host, 811 sitemap URLs all on the
live host, unknown URLs return 404, the tax engine matches hand arithmetic to the cent, and the
calculator recalculates in a real browser and writes shareable URL state.

## Snapshot log

| Date | Pages | GSC impressions | GSC clicks | Notes |
|---|---|---|---|---|
| 2026-10-20 | 812 | n/a (new site) | n/a | Built and deployed to paycheck-math.pages.dev; 811 sitemap URLs accepted by IndexNow (HTTP 200). Health gate 12/12. No organic traffic yet by design. |
| 2026-10-20 (r3) | 1233 | n/a (not yet indexed) | n/a | Disclosed per-state bracket years: 6 states (AR, CA, ID, MA, ND, VT) still use 2025 inflation-adjusted widths because the source table flagged the 2026 figures unpublished. Verified CA's table against the FTB 2025 rate schedule — identical (11,079 / 26,264 / 41,452 / 57,542 / 72,724). Pages now carry a visible warning instead of implying 2026. IndexNow resubmitted all 1,232 URLs (200). Search engines have not indexed the site yet, confirmed by a site: query returning zero results. |
| 2026-10-20 (r2b) | 1233 | n/a | n/a | Live at hello532.github.io/paycheck-math. 1,232 sitemap URLs, health 15/15 on that host, calculator verified under the subpath. Added pay-frequency pages computed from the real 2026 calendar (biweekly 27, weekly 53, monthly 12, semi-monthly 24) — independently recomputed and matched. |
| 2026-10-20 (r2) | 1085 | n/a | n/a | Local only — Cloudflare OAuth expired before deploy. Removed 182 duplicate hourly-by-state pages (9 no-wage-tax states produce identical take-home, so one shared figure replaced nine copies), added 6 taxing states (CA/NY/IL/NJ/GA/MA) at 91 rates each where the numbers genuinely differ. Added per-state income percentiles, local-tax facts, and a 5-gram similarity gate (max 0.571, mean 0.191). |

## Round 2 defects found and fixed

- **Washington was taxed as if it had a wage income tax.** The Tax Foundation table marks WA
  "capital gains income only", but the parser read its 7%/9% rows as wage brackets, so every
  Washington page overstated state tax. Now parsed as no-wage-tax with the capital gains note.
  A test pins it.
- **NaN salaries on all 51 state pages.** When the income dataset changed from a number to an
  object, `stateIncome.byState[name]` became an object and `Math.round(obj/100)` produced NaN,
  so every state page said "On a $NaN salary". Fixed, and the health gate now fails on NaN.
- **Build did not prune stale output.** Deleting 182 pages left their directories in `public/`,
  so removed pages would have stayed live. The build now prunes files that are no longer
  generated.
- **Similarity measured the wrong unit.** Word-level Jaccard read 0.8 on pages that share
  vocabulary but not sentences. Switched to 5-gram shingles, which is what duplicate-content
  detection actually uses. That exposed the real duplicate set: 91 hourly-by-state pairs at
  ~0.81, all between no-wage-tax states.

## Live host: GitHub Pages (Cloudflare still pending)

Because the Cloudflare token expired, the current build is live at
**https://hello532.github.io/paycheck-math/** — 1,229 pages, 1,228 URLs in the sitemap, all on
that host, canonical tags rewritten to match, calculator verified working under the subpath
(`$61,346` → `$87,310` when the salary changes, URL state intact).

Redeploy: `sh deploy-ghpages.sh`. Health: `SITE_ORIGIN=https://hello532.github.io BASE_PATH=/paycheck-math node tools/health.mjs`.

IndexNow initially returned 403 `SiteVerificationNotCompleted` for the GitHub Pages subpath, then
accepted all 1,232 URLs (HTTP 200) once verification completed. Both Bing and Yandex receive the
full list.

## Deploy is blocked on Cloudflare credentials

The Cloudflare OAuth token expired 2026-10-20T15:55Z and the stored refresh token is rejected
(`invalid_client`). `deploy.sh` now exits 2 with a clear message instead of failing inside
wrangler. Local state is complete and verified; it needs one of:

- `npx wrangler login` once (browser consent), or
- a `CLOUDFLARE_API_TOKEN` with Pages:Edit in `~/.config/secrets.env`.

The live site is still the 812-page build from before this round. The 1,229-page build
(442 new salary x state pages, minus 182 removed duplicates) is committed and waiting.

## Analytics

`GA_MEASUREMENT_ID=G-XXXX node build.mjs` emits GA4. Verified both ways: without the variable
no `googletagmanager` tag is present, with it the page contains exactly one. Nothing is sent
anywhere until a real property ID exists.

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

## Goal audit — 2026-10-20

Checked against the objective as written, not against what was convenient:

| Requirement | State | Evidence |
|---|---|---|
| Find a vertical that can actually earn USD | **done** | SERP checks show small sites (pinebill.app, oysterlink.com, hivedesk.com) ranking on salary/hourly long tail; finance is a top-RPM ad category |
| Build it | **done** | 1,233 pages live at hello532.github.io/paycheck-math; 1,232 sitemap URLs all return 200 (measured, not sampled) |
| 500+ unique pages, no thin content | **done** | 5-gram shingle gate: 1,217 pages, max 0.596, mean 0.190, no pair above 0.6 |
| Verification each round (build --check, live 200, GSC snapshot in GROWTH.md) | **partial** | build --check passes, live 200 verified; **GSC snapshot is absent because the site has no verified GSC property.** The GSC API lists only typing.rerivo.com, bimaxlaundrycare.com and the Shopify store. Adding and verifying a property needs the user's Google account action; the site-verification API is retired (404). |
| AdSense connected | **wired, not earning** | `ADSENSE_CLIENT` emits loader + units and is verified both ways; no approved publisher ID exists, so nothing is live |
| Affiliate connected | **not done** | no program approved; placing unapproved links earns nothing |
| 500k impressions / 100k sessions / 1M sessions | **not achieved** | site is 1 day old with zero measured traffic; these are months away at best |

Honest status: the build is complete and verified, but the traffic and revenue milestones are not
achieved and cannot be claimed. The blockers are the user's: GSC property verification, an AdSense
publisher ID, and Cloudflare DNS (or keeping GitHub Pages as the permanent host).
