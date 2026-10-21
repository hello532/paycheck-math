# Paycheck Math

> Machine-readable version of https://hello532.github.io/paycheck-math/data/paycheck-tax-by-state/
> Generated 2026-10-20. Rates: 2026 federal (IRS Rev. Proc. 2025-32), FICA wage base $184,500, state tables from the Tax Foundation 2026 table with verified 2026 overrides.

[Home](/) › Open data 

# US Paycheck Tax by State — Open Dataset

 How much of a typical paycheck is withheld in each US jurisdiction, computed at that jurisdiction's own median household income. 51 rows , one methodology, free to reuse. 
 
 Lowest Tennessee 16.59% 
 Median of states 20.92% 
 Highest Washington DC 27.25% 
 

 Download: [CSV](/data/paycheck-tax-by-state.csv) · [JSON](/data/paycheck-tax-by-state.json). Licence: reuse freely with attribution to Paycheck Math. 

## Method

 For each jurisdiction: gross = its median household income from the 2023 ACS one-year estimates, rounded to the nearest $100; deductions = 2026 federal income tax after the standard deduction, that state's own wage tax, Social Security at 6.2% up to $184,500 and Medicare at 1.45%. Single filer, no dependents, no pre-tax deductions. State personal exemptions and credits are excluded, so the state line is slightly overstated. That is the same engine the rest of this site uses. 

## The dataset

| # | State | Median income | Withheld | Share | Take-home |
|---|---|---|---|---|---|
| 1 | Tennessee | $67,600 | $11,213 | 16.59% | $56,387 |
| 2 | South Dakota | $71,800 | $12,459 | 17.35% | $59,341 |
| 3 | Wyoming | $72,400 | $12,637 | 17.45% | $59,763 |
| 4 | Florida | $73,300 | $12,903 | 17.6% | $60,397 |
| 5 | Texas | $75,800 | $13,645 | 18% | $62,155 |
| 6 | Nevada | $76,400 | $13,823 | 18.09% | $62,577 |
| 7 | Louisiana | $58,200 | $10,616 | 18.24% | $47,584 |
| 8 | New Mexico | $62,300 | $11,824 | 18.98% | $50,476 |
| 9 | West Virginia | $55,900 | $10,676 | 19.1% | $45,224 |
| 10 | Mississippi | $54,200 | $10,415 | 19.22% | $43,785 |
| 11 | Ohio | $67,800 | $13,137 | 19.38% | $54,663 |
| 12 | Kentucky | $61,100 | $11,847 | 19.39% | $49,253 |
| 13 | Arkansas | $58,700 | $11,460 | 19.52% | $47,240 |
| 14 | Alaska | $88,100 | $17,292 | 19.63% | $70,808 |
| 15 | North Dakota | $76,500 | $15,030 | 19.65% | $61,470 |
| 16 | Indiana | $69,500 | $13,827 | 19.89% | $55,673 |
| 17 | Oklahoma | $62,100 | $12,410 | 19.98% | $49,690 |
| 18 | Missouri | $68,500 | $13,789 | 20.13% | $54,711 |
| 19 | Iowa | $71,400 | $14,442 | 20.23% | $56,959 |
| 20 | Washington | $94,600 | $19,219 | 20.32% | $75,381 |
| 21 | North Carolina | $70,800 | $14,478 | 20.45% | $56,322 |
| 22 | Arizona | $77,300 | $15,813 | 20.46% | $61,487 |
| 23 | New Hampshire | $96,800 | $19,871 | 20.53% | $76,929 |
| 24 | Pennsylvania | $73,800 | $15,317 | 20.76% | $58,483 |
| 25 | Montana | $70,800 | $14,802 | 20.91% | $55,999 |
| 26 | South Carolina | $67,800 | $14,184 | 20.92% | $53,616 |
| 27 | Michigan | $69,200 | $14,629 | 21.14% | $54,571 |
| 28 | Wisconsin | $74,600 | $15,899 | 21.31% | $58,701 |
| 29 | Nebraska | $74,600 | $15,980 | 21.42% | $58,620 |
| 30 | Georgia | $74,600 | $16,263 | 21.8% | $58,337 |
| 31 | Idaho | $74,900 | $16,494 | 22.02% | $58,406 |
| 32 | Kansas | $70,300 | $15,648 | 22.26% | $54,652 |
| 33 | Rhode Island | $85,000 | $19,140 | 22.52% | $65,860 |
| 34 | Vermont | $81,200 | $18,495 | 22.78% | $62,705 |
| 35 | Maine | $73,700 | $17,175 | 23.3% | $56,525 |
| 36 | New York | $82,100 | $19,349 | 23.57% | $62,751 |
| 37 | Illinois | $80,300 | $18,954 | 23.6% | $61,346 |
| 38 | Colorado | $92,900 | $22,094 | 23.78% | $70,806 |
| 39 | Delaware | $82,200 | $19,781 | 24.06% | $62,420 |
| 40 | Minnesota | $85,100 | $20,666 | 24.28% | $64,434 |
| 41 | Utah | $93,400 | $23,019 | 24.65% | $70,381 |
| 42 | Connecticut | $91,700 | $22,653 | 24.7% | $69,047 |
| 43 | Virginia | $89,900 | $22,234 | 24.73% | $67,666 |
| 44 | New Jersey | $99,800 | $24,993 | 25.04% | $74,807 |
| 45 | Maryland | $98,700 | $24,911 | 25.24% | $73,789 |
| 46 | California | $95,500 | $24,291 | 25.44% | $71,209 |
| 47 | Massachusetts | $99,900 | $25,785 | 25.81% | $74,115 |
| 48 | Hawaii | $95,300 | $25,226 | 26.47% | $70,074 |
| 49 | Oregon | $80,200 | $21,393 | 26.67% | $58,807 |
| 50 | Washington DC | $108,200 | $29,480 | 27.25% | $78,720 |

 Generated 2026-10-20. Federal source: IRS Rev. Proc. 2025-32. State source: Tax Foundation 2026 table, with 2026 changes verified against state revenue departments for GA, MS, UT, NE. Income source: ACS 2023 1-year. 

CLUSTER_NAV_PLACEHOLDER_MARKER
