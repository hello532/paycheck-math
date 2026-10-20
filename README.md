# Paycheck Math

Static programmatic SEO site for US salary, hourly and take-home pay questions.

```
python3 tools/build_state_params.py   # data/tax_params.json from the Tax Foundation 2026 table
node build.mjs                        # public/  (809 pages)
node build.mjs --check                # verify public/ matches src/
```

Deploy:

```
wrangler pages deploy public --project-name paycheck-math
```

Ads: set `ADSENSE_CLIENT=ca-pub-...` before building to emit the loader and the in-article units.

Rates: IRS Rev. Proc. 2025-32 (federal, tax year 2026), SSA wage base $184,500,
Tax Foundation 2026 state table. See `GROWTH.md` for the plan and the verified numbers.

## Open dataset

Paycheck withholding for all 51 US jurisdictions, computed at each jurisdiction's own median
household income, tax year 2026:

- page: https://hello532.github.io/paycheck-math/data/paycheck-tax-by-state/
- CSV: https://hello532.github.io/paycheck-math/data/paycheck-tax-by-state.csv
- JSON: https://hello532.github.io/paycheck-math/data/paycheck-tax-by-state.json
- gist: https://gist.github.com/hello532/8c1ea938b3d38045d4d895d3d1de825a

Live site: https://hello532.github.io/paycheck-math/ (1,336 pages).
