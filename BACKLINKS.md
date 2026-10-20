# Backlink ledger

Every row below was verified by fetching the page and confirming the link is present in the
returned HTML. "nofollow" is stated where the host applies it, because a nofollow link does not
pass ranking weight even though it is a real citation.

Last verified: 2026-10-21

## Verified links pointing at the site

| # | Where | Link type | Verified | Notes |
|---|---|---|---|---|
| 1 | https://typing.rerivo.com/ (footer, 131 landing pages) | dofollow | 200, link found in HTML | Same owner property with an existing GSC record. Present on all 131 pages, not just the homepage. |
| 2 | https://github.com/hello532/paycheck-math (repo homepage field) | nofollow | 200, link found | GitHub marks outbound links nofollow; counted as a citation, not as ranking weight. |
| 3 | github.com/hello532/paycheck-math README (Open dataset section) | nofollow | 200, link found (7 occurrences of the site URL on the repo page) | Points at the dataset page, CSV and JSON. |
| 4 | https://gist.github.com/hello532/8c1ea938b3d38045d4d895d3d1de825a | nofollow | 200, link found | Public gist with the full 51-row CSV and the attribution URL. |

## Attempted and rejected (with the reason)

| Target | Why it did not produce a link |
|---|---|
| X / Twitter post | The stored credential is an app-only bearer token; `POST /2/tweets` returns 403 (OAuth 1.0a or OAuth 2.0 user context required). X links are nofollow anyway, so fixing the token would not add ranking value. |
| Kaggle dataset upload | The upload page is behind a reCAPTCHA. Creating an account and defeating a CAPTCHA is outside what this session may do. |
| Bing Webmaster Tools | `/webmasters/add` requires an interactive signed-in session; there is no stored credential for it. |
| Product Hunt / directories | Require an account, a product-launch flow and usually a human moderator; the earlier candidate list (100 entries) was triaged for a different product and mostly asks for an account. |
| Awesome-list PRs | The relevant lists (awesome-ai-in-finance, awesome-open-finance) are about AI-in-finance or open banking, not paycheck withholding. Adding an unrelated entry would be a low-quality link and would likely be closed, as the previous submission attempt was. |

## What is actually missing

Four citations, two of them nofollow and three on domains the owner already controls, is not
"many backlinks". The real constraint is that every additional channel needs either an account the
user holds (Search Console, Bing, Kaggle, Reddit) or an editorial decision by a stranger that I
cannot make on the user's behalf.

The asset built for this purpose — the open dataset at
`/data/paycheck-tax-by-state/` with CSV, JSON and `Dataset` structured data — is the piece that can
earn citations from third parties. It is eligible for Google Dataset Search once indexed; that is
a discovery channel, not a guaranteed link.
