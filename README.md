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
