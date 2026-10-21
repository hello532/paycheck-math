# SEO and AI-readability status

Last run: 2026-10-21. Live: https://hello532.github.io/paycheck-math/ (1,335 pages).

## Done and verified against the live site

| Item | State | Evidence |
|---|---|---|
| Sitemap | `/sitemap.xml` 1,335 URLs, plus `/sitemap-index.xml` | both 200; robots points at the index |
| Crawl rules | Full robots.txt: allow all, explicit Allow for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot | 200, policy lines present |
| Titles | 0 of 1,336 pages over 62 chars | full-site scan |
| Descriptions | 0 over 160 chars (one was 171, fixed) | full-site scan |
| Canonical | 1,336/1,336 present and self-referencing on the live host | full-site scan |
| 301s | `/path` → `/path/` returns 301 to the slash form; unknown paths return a real 404 | measured with redirect:manual |
| Structured data | WebSite+Organization+WebPage sitewide; BreadcrumbList + FAQPage on Q&A pages; Dataset on the open-data page | 0 invalid JSON-LD across 1,336 pages |
| Performance | CSS inlined (no render-blocking stylesheet), `tax-params.json` preloaded, no web fonts, HTML ~12 KB gzipped, total assets ~3 KB | measured; 0 blocking stylesheet links |
| Core Web Vitals | No layout shift from the calculator (container height stable before/after hydration, measured 487→487 px) | WebView measurement |
| Accessibility | Skip link, `<main id="main" tabindex="-1">`, one h1 per page, 0 images without alt, all inputs labelled, aria-live on results, 21 table headers, `lang="en"`; text contrast 4.94:1–16.24:1 (AA pass) | measured |
| Internal links | 0 pages with zero inbound links; 0 pages unreachable from home; 7 hubs cross-link 6/6 to each other | BFS over the built graph |
| Duplicate content | 5-gram shingle gate: 1,317 pages, max 0.596, mean 0.177, no pair over 0.6 | `tools/similarity.mjs` |
| llms.txt | 3.2 KB: what the site answers, core pages, data endpoints, key facts, attribution, and links to 8 Markdown versions (all 200) | fetched and checked |
| openapi.json | OpenAPI 3.1 describing `/assets/tax-params.json` and `/data/paycheck-tax-by-state.json`, plus the calculation formula | parses, 2 paths |
| Markdown versions | 8: index, methodology, both withholding hubs, dataset, state calculator, salary-to-hourly, after-taxes — served as `text/markdown` | 200 with correct MIME |
| IndexNow / Brave | All 1,335 URLs submitted, HTTP 200. Brave shares this endpoint with Bing/Yandex | submission response |
| External links | 4 verified (typing.rerivo.com footer dofollow on 131 pages; GitHub repo homepage; README; public gist) | see BACKLINKS.md |

## Blocked on the account holder

These cannot be done from this machine; each needs one action from you.

- **Google Search Console** — the GSC API lists only typing.rerivo.com, bimaxlaundrycare.com and one unverified Shopify store. Adding this property needs your Google login and a verification step. Google's site-verification API is retired (404), so it cannot be automated. Until then there is no GSC snapshot for this site.
- **Bing Webmaster Tools** — `/webmasters/add` requires an interactive signed-in session; no stored credential.
- **Cloudflare** — the OAuth token expired and its refresh token is rejected (invalid_client). Separately, if this site is later moved behind Cloudflare, "Under Attack" or a bot-fight challenge must stay off for `Googlebot`, `Bingbot`, `GPTBot`, `OAI-SearchBot`, `ClaudeBot` and `PerplexityBot`, or those crawlers will get 403s and the site will drop out of both search and AI answers. Nothing to configure today because the site is on GitHub Pages.
- **Reddit / YouTube** — no credentials stored for either. Posting there also needs an account with standing in the subreddit/channel, which is yours to build.

## Honest note

Everything above is plumbing. None of it produces traffic on its own: the site still has zero measured impressions, and the earlier GSC data showed this account's existing property sits at average position 61 with 2,253 impressions in 28 days. The next real lever is rank, not more markup.
