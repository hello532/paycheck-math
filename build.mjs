#!/usr/bin/env node
/**
 * Static site generator for the take-home pay site.
 *
 *   node build.mjs          # write public/
 *   node build.mjs --check  # verify public/ matches what would be generated
 *
 * Every page is derived from data/tax_params.json; no tax number is hardcoded here.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computePaycheck, annualFromHourly, usd, usd2, pct, bracketTax } from "./src/tax.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "public");
const SITE = process.env.SITE_ORIGIN || "https://pay.rerivo.com";

const params = JSON.parse(fs.readFileSync(path.join(ROOT, "data/tax_params.json"), "utf8"));
const css = fs.readFileSync(path.join(ROOT, "src/style.css"), "utf8");
const calcJs = fs.readFileSync(path.join(ROOT, "src/calc.js"), "utf8");
const taxJs = fs.readFileSync(path.join(ROOT, "src/tax.mjs"), "utf8");

const STATE_CODES = Object.keys(params.states).sort();

/* ── page shells ─────────────────────────────────────────────────────── */

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function jsonld(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function layout({ title, desc, slug, body, breadcrumb, faq, extraHead = "" }) {
  const url = SITE + slug;
  const crumbs = breadcrumb || [];
  const crumbLd = crumbs.length
    ? jsonld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: SITE + c.href,
        })),
      })
    : "";
  const faqLd = faq && faq.length
    ? jsonld({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      })
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Paycheck Math">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/assets/style.css">
${crumbLd}
${faqLd}
${extraHead}
${ADSENSE_HEAD}
</head>
<body>
<header class="site"><div class="wrap">
  <a class="brand" href="/">Paycheck <span>Math</span></a>
  <nav class="top">
    <a href="/paycheck-calculator/">Paycheck calculator</a>
    <a href="/salary-to-hourly/">Salary to hourly</a>
    <a href="/hourly-to-salary/">Hourly to salary</a>
    <a href="/after-taxes/">After taxes</a>
  </nav>
</div></header>
<main><div class="wrap">
${body}
</div></main>
<footer class="site"><div class="wrap">
  <div>Paycheck Math — ${params.meta.tax_year} federal rates. Estimates only, not tax advice.</div>
  <div>
    <a href="/about/">About</a> · <a href="/methodology/">Methodology</a> ·
    <a href="/privacy/">Privacy</a> · <a href="/contact/">Contact</a>
  </div>
</div></footer>
<script type="module" src="/assets/calc.js"></script>
</body>
</html>
`;
}

/** Interactive calculator block reused across pages. */
function calculatorBlock({ defaultGross, state = "CA", filing = "single", heading = "Your take-home pay" }) {
  return `<section class="calc">
  <h2>${esc(heading)}</h2>
  <div class="row">
    <div>
      <label for="gross">Gross annual salary</label>
      <input id="gross" type="number" inputmode="numeric" min="0" step="500" value="${defaultGross}">
    </div>
    <div>
      <label for="state">State</label>
      <select id="state">
${STATE_CODES.map((s) => `<option value="${s}"${s === state ? " selected" : ""}>${esc(params.states[s].name)}</option>`).join("\n")}
      </select>
    </div>
  </div>
  <div class="row">
    <div>
      <label for="filing">Filing status</label>
      <select id="filing">
        <option value="single"${filing === "single" ? " selected" : ""}>Single</option>
        <option value="married"${filing === "married" ? " selected" : ""}>Married filing jointly</option>
        <option value="hoh"${filing === "hoh" ? " selected" : ""}>Head of household</option>
      </select>
    </div>
    <div style="display:flex;align-items:flex-end"><button class="btn" id="go" type="button">Calculate</button></div>
  </div>
  <div class="result" id="out" aria-live="polite"></div>
</section>`;
}

function adsSlot(label = "Advertisement") {
  const pub = process.env.ADSENSE_CLIENT;
  if (!pub) {
    return `<div class="ad" data-slot="${esc(label)}">${esc(label)}</div>`;
  }
  return `<div class="ad"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(pub)}" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`;
}

const ADSENSE_HEAD = process.env.ADSENSE_CLIENT
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(process.env.ADSENSE_CLIENT)}" crossorigin="anonymous"></script>
<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>`
  : "";

/* ── money helpers ───────────────────────────────────────────────────── */

const round0 = (n) => Math.round(n);
const fmt = (n) => usd(round0(n));

function ladderLinks(items, current, hrefFor, labelFor) {
  const i = items.indexOf(current);
  const near = [
    items[i - 2],
    items[i - 1],
    items[i + 1],
    items[i + 2],
  ].filter((x) => x !== undefined);
  return `<ul class="links">${near.map((x) => `<li><a href="${hrefFor(x)}">${esc(labelFor(x))}</a></li>`).join("")}</ul>`;
}

/* ── page: hourly → annual ───────────────────────────────────────────── */

const HOURLY = [];
for (let r = 7.25; r <= 100; r += r === 7.25 ? 0.75 : 1) HOURLY.push(+r.toFixed(2));

function hourlyPage(rate) {
  const annual40 = annualFromHourly(rate, 40);
  const annual375 = annualFromHourly(rate, 37.5);
  const annual20 = annualFromHourly(rate, 20);
  const calc = computePaycheck(params, annual40, "CA", "single");
  const med = params.benchmarks.median_annual_wage_us;
  const slug = `/${rate.toString().replace(".", "-")}-an-hour-is-how-much-a-year/`;
  const title = `$${rate} an Hour Is How Much a Year? ${fmt(annual40)} Before Tax`;
  const desc = `$${rate} an hour works out to ${fmt(annual40)} a year at 40 hours a week (${fmt(annual40 / 12)} a month). See the full breakdown, plus what's left after federal tax and FICA.`;
  const perHour = calc.net / 2080;

  const body = `
<p class="crumb"><a href="/">Home</a> › Hourly to salary</p>
<h1>$${rate} an Hour Is How Much a Year?</h1>
<p class="lede">At 40 hours a week, 52 weeks a year, <strong>$${rate} an hour is ${fmt(annual40)} a year</strong> before tax — about ${fmt(annual40 / 12)} a month and ${fmt(annual40 / 52)} a week. After estimated federal tax and FICA you keep roughly <strong>${fmt(calc.net)}</strong>.</p>
<div class="grid3">
  <div class="card"><div class="k">Per year</div><div class="v">${fmt(annual40)}</div></div>
  <div class="card"><div class="k">Per month</div><div class="v">${fmt(annual40 / 12)}</div></div>
  <div class="card"><div class="k">Per week</div><div class="v">${fmt(annual40 / 52)}</div></div>
</div>

<h2>The math</h2>
<p>$${rate} × 40 hours × 52 weeks = <strong>${fmt(annual40)}</strong>. If your schedule is different, the total moves with you:</p>
<table>
<thead><tr><th>Hours per week</th><th class="num">Annual</th><th class="num">Monthly</th><th class="num">Weekly</th></tr></thead>
<tbody>
<tr><td>20 (part time)</td><td class="num">${fmt(annual20)}</td><td class="num">${fmt(annual20 / 12)}</td><td class="num">${fmt(annual20 / 52)}</td></tr>
<tr><td>37.5</td><td class="num">${fmt(annual375)}</td><td class="num">${fmt(annual375 / 12)}</td><td class="num">${fmt(annual375 / 52)}</td></tr>
<tr><td>40 (full time)</td><td class="num">${fmt(annual40)}</td><td class="num">${fmt(annual40 / 12)}</td><td class="num">${fmt(annual40 / 52)}</td></tr>
<tr><td>45</td><td class="num">${fmt(annualFromHourly(rate, 45))}</td><td class="num">${fmt(annualFromHourly(rate, 45) / 12)}</td><td class="num">${fmt(annualFromHourly(rate, 45) / 52)}</td></tr>
<tr><td>50</td><td class="num">${fmt(annualFromHourly(rate, 50))}</td><td class="num">${fmt(annualFromHourly(rate, 50) / 12)}</td><td class="num">${fmt(annualFromHourly(rate, 50) / 52)}</td></tr>
</tbody></table>
<p>Most hourly jobs pay for actual hours worked, so a week off without pay removes roughly ${fmt(annual40 / 52)} from your year. Federal law (FLSA) requires 1.5× pay for hours over 40 in a workweek for most non-exempt employees; if you regularly work 45 hours at $${rate}, overtime pushes the year to ${fmt(annual40 + rate * 1.5 * 5 * 52)}.</p>

${adsSlot()}

<h2>What $${rate} an hour looks like after tax</h2>
<p>For a single filer with no dependents in California, ${fmt(annual40)} gross works out to about <strong>${fmt(calc.net)} take-home</strong> a year — ${fmt(calc.net / 12)} a month, or ${usd2(perHour)} for every hour worked. That is an effective rate of ${pct(calc.effectiveRate)} across federal income tax, state income tax, Social Security and Medicare.</p>
<table>
<thead><tr><th>Item</th><th class="num">Annual</th><th class="num">Monthly</th></tr></thead>
<tbody>
<tr><td>Gross pay</td><td class="num">${fmt(annual40)}</td><td class="num">${fmt(annual40 / 12)}</td></tr>
<tr><td>Federal income tax</td><td class="num">−${fmt(calc.federalTax)}</td><td class="num">−${fmt(calc.federalTax / 12)}</td></tr>
<tr><td>State income tax</td><td class="num">−${fmt(calc.stateTax)}</td><td class="num">−${fmt(calc.stateTax / 12)}</td></tr>
<tr><td>Social Security + Medicare</td><td class="num">−${fmt(calc.fica)}</td><td class="num">−${fmt(calc.fica / 12)}</td></tr>
<tr><td><strong>Take-home</strong></td><td class="num"><strong>${fmt(calc.net)}</strong></td><td class="num"><strong>${fmt(calc.net / 12)}</strong></td></tr>
</tbody></table>
<div class="note">State tax varies a lot. The same ${fmt(annual40)} is ${fmt(computePaycheck(params, annual40, "TX", "single").net)} in Texas and ${fmt(computePaycheck(params, annual40, "NY", "single").net)} in New York. <a href="/paycheck-calculator/">Run your own state →</a></div>

<h2>Is $${rate} an hour a good wage?</h2>
<p>The median full-time annual wage in the United States is about ${fmt(med)}. ${fmt(annual40)} sits <strong>${annual40 >= med ? "above" : "below"}</strong> that line by ${fmt(Math.abs(annual40 - med))}, which is ${(annual40 / med * 100).toFixed(0)}% of the median. On a 40-hour week the federal minimum wage of $7.25 brings in ${fmt(annualFromHourly(7.25))}, so $${rate} is ${(annual40 / annualFromHourly(7.25)).toFixed(1)}× the floor.</p>

${calculatorBlock({ defaultGross: round0(annual40), state: "CA" })}

<h2>Nearby hourly rates</h2>
${ladderLinks(HOURLY, rate, (r) => `/${r.toString().replace(".", "-")}-an-hour-is-how-much-a-year/`, (r) => `$${r} an hour`)}
<p><a href="/hourly-to-salary/">See the full hourly-to-salary table →</a></p>
`;

  const faq = [
    {
      q: `How much is $${rate} an hour per year?`,
      a: `$${rate} an hour is ${fmt(annual40)} a year before tax at 40 hours per week and 52 weeks per year. That is ${fmt(annual40 / 12)} a month.`,
    },
    {
      q: `How much is $${rate} an hour after taxes?`,
      a: `A single filer in California keeps about ${fmt(calc.net)} a year, or ${usd2(perHour)} an hour, after federal income tax, state income tax, Social Security and Medicare. Your own figure depends on state, filing status and deductions.`,
    },
    {
      q: `Is $${rate} an hour full time or part time?`,
      a: `At $${rate} an hour, 40 hours a week is full time and produces ${fmt(annual40)}. At 20 hours a week you would earn ${fmt(annual20)}.`,
    },
  ];

  return {
    slug,
    html: layout({
      title,
      desc,
      slug,
      body,
      breadcrumb: [{ name: "Home", href: "/" }, { name: `$${rate} an hour`, href: slug }],
      faq,
    }),
  };
}

/* ── page: annual → hourly ───────────────────────────────────────────── */

const SALARIES = [];
for (let s = 20000; s <= 120000; s += 1000) SALARIES.push(s);
for (let s = 125000; s <= 300000; s += 5000) SALARIES.push(s);

function salaryPage(amount) {
  const hourly40 = amount / 2080;
  const hourly375 = amount / 1950;
  const hourly50 = amount / 2600;
  const calc = computePaycheck(params, amount, "CA", "single");
  const med = params.benchmarks.median_annual_wage_us;
  const slug = `/${amount}-a-year-is-how-much-an-hour/`;
  const title = `$${amount.toLocaleString("en-US")} a Year Is How Much an Hour? ${usd2(hourly40)}/hr`;
  const desc = `$${amount.toLocaleString("en-US")} a year is ${usd2(hourly40)} an hour at 40 hours a week, or ${fmt(amount / 12)} a month. Full breakdown with the after-tax figure for your state.`;

  const body = `
<p class="crumb"><a href="/">Home</a> › Salary to hourly</p>
<h1>$${amount.toLocaleString("en-US")} a Year Is How Much an Hour?</h1>
<p class="lede">On a standard 40-hour week, <strong>$${amount.toLocaleString("en-US")} a year is ${usd2(hourly40)} an hour</strong> before tax. That is ${fmt(amount / 12)} a month, ${fmt(amount / 26)} per biweekly paycheck and ${fmt(amount / 52)} a week. After estimated federal tax and FICA you keep about <strong>${fmt(calc.net)}</strong>.</p>
<div class="grid3">
  <div class="card"><div class="k">Hourly (40h)</div><div class="v">${usd2(hourly40)}</div></div>
  <div class="card"><div class="k">Monthly</div><div class="v">${fmt(amount / 12)}</div></div>
  <div class="card"><div class="k">Biweekly</div><div class="v">${fmt(amount / 26)}</div></div>
</div>

<h2>How the hourly rate changes with your schedule</h2>
<p>${amount.toLocaleString("en-US")} ÷ 2,080 hours is the standard conversion for a salaried job. Salaried roles usually pay the same regardless of hours, so the real hourly rate depends on how long you actually work:</p>
<table>
<thead><tr><th>Hours per week</th><th class="num">Hours per year</th><th class="num">Implied hourly</th></tr></thead>
<tbody>
<tr><td>35</td><td class="num">1,820</td><td class="num">${usd2(amount / 1820)}</td></tr>
<tr><td>37.5</td><td class="num">1,950</td><td class="num">${usd2(hourly375)}</td></tr>
<tr><td>40</td><td class="num">2,080</td><td class="num">${usd2(hourly40)}</td></tr>
<tr><td>45</td><td class="num">2,340</td><td class="num">${usd2(amount / 2340)}</td></tr>
<tr><td>50</td><td class="num">2,600</td><td class="num">${usd2(hourly50)}</td></tr>
</tbody></table>
<p>This is why two offers with the same salary can differ sharply: a role that expects 50 hours a week pays ${usd2(hourly50)} an hour, while the same money over 40 hours is worth ${usd2(hourly40)}. Add unpaid on-call or a long commute and the gap widens again.</p>

${adsSlot()}

<h2>Paycheck breakdown at $${amount.toLocaleString("en-US")}</h2>
<p>For a single filer in California, ${fmt(amount)} gross produces about <strong>${fmt(calc.net)} take-home</strong>, an effective rate of ${pct(calc.effectiveRate)}. Your top federal bracket is ${pct(calc.marginalFederal)} — that rate applies only to the last dollars earned, not the whole salary.</p>
<table>
<thead><tr><th>Item</th><th class="num">Annual</th><th class="num">Monthly</th><th class="num">Biweekly</th></tr></thead>
<tbody>
<tr><td>Gross pay</td><td class="num">${fmt(amount)}</td><td class="num">${fmt(amount / 12)}</td><td class="num">${fmt(amount / 26)}</td></tr>
<tr><td>Federal income tax</td><td class="num">−${fmt(calc.federalTax)}</td><td class="num">−${fmt(calc.federalTax / 12)}</td><td class="num">−${fmt(calc.federalTax / 26)}</td></tr>
<tr><td>State income tax</td><td class="num">−${fmt(calc.stateTax)}</td><td class="num">−${fmt(calc.stateTax / 12)}</td><td class="num">−${fmt(calc.stateTax / 26)}</td></tr>
<tr><td>Social Security + Medicare</td><td class="num">−${fmt(calc.fica)}</td><td class="num">−${fmt(calc.fica / 12)}</td><td class="num">−${fmt(calc.fica / 26)}</td></tr>
<tr><td><strong>Take-home</strong></td><td class="num"><strong>${fmt(calc.net)}</strong></td><td class="num"><strong>${fmt(calc.net / 12)}</strong></td><td class="num"><strong>${fmt(calc.net / 26)}</strong></td></tr>
</tbody></table>
<div class="note">Living somewhere with no state income tax makes a real difference: ${fmt(amount)} nets ${fmt(computePaycheck(params, amount, "TX", "single").net)} in Texas versus ${fmt(computePaycheck(params, amount, "NY", "single").net)} in New York. <a href="/after-taxes/">Compare states →</a></div>

<h2>Is $${amount.toLocaleString("en-US")} a good salary?</h2>
<p>The median full-time annual wage in the US is about ${fmt(med)}. At ${fmt(amount)} you earn <strong>${(amount / med * 100).toFixed(0)}% of the median</strong>, which is ${amount >= med ? `${fmt(amount - med)} more` : `${fmt(med - amount)} less`} than the typical full-time worker. Housing usually decides whether that feels comfortable: a common budgeting rule caps rent at 30% of gross, which here is ${fmt(amount * 0.3 / 12)} a month.</p>

${calculatorBlock({ defaultGross: amount, state: "CA" })}

${marginalStepBlock(amount, "CA")}

<h2>Nearby salaries</h2>
${ladderLinks(SALARIES, amount, (s) => `/${s}-a-year-is-how-much-an-hour/`, (s) => `$${s.toLocaleString("en-US")} a year`)}
<p><a href="/salary-to-hourly/">See the full salary-to-hourly table →</a></p>
`;

  const faq = [
    {
      q: `How much is $${amount.toLocaleString("en-US")} a year per hour?`,
      a: `$${amount.toLocaleString("en-US")} a year is ${usd2(hourly40)} an hour at 40 hours per week for 52 weeks. At 37.5 hours a week it is ${usd2(hourly375)} an hour.`,
    },
    {
      q: `What is $${amount.toLocaleString("en-US")} a year per month?`,
      a: `Gross is ${fmt(amount / 12)} a month. After estimated federal tax, state tax and FICA a single filer in California keeps about ${fmt(calc.net / 12)} a month.`,
    },
    {
      q: `How much is $${amount.toLocaleString("en-US")} a year after taxes?`,
      a: `About ${fmt(calc.net)} a year, or ${fmt(calc.net / 12)} a month, for a single filer in California. In a state with no income tax such as Texas the figure is ${fmt(computePaycheck(params, amount, "TX", "single").net)}.`,
    },
  ];

  return {
    slug,
    html: layout({
      title,
      desc,
      slug,
      body,
      breadcrumb: [{ name: "Home", href: "/" }, { name: `$${amount.toLocaleString("en-US")}`, href: slug }],
      faq,
    }),
  };
}

/* ── page: after tax ─────────────────────────────────────────────────── */

const NO_TAX = STATE_CODES.filter((s) => params.states[s].type === "none");
const HIGH_TAX = ["CA", "NY", "NJ", "OR", "MN", "MA"].filter((s) => params.states[s]);

function afterTaxPage(amount) {
  const base = computePaycheck(params, amount, "CA", "single");
  const tx = computePaycheck(params, amount, "TX", "single");
  const slug = `/${amount}-a-year-after-taxes/`;
  const title = `$${amount.toLocaleString("en-US")} a Year After Taxes: ${fmt(base.net)} Take-Home`;
  const desc = `Take-home pay on $${amount.toLocaleString("en-US")} a year is about ${fmt(base.net)} for a single filer in California — ${fmt(base.net / 12)} a month. Full federal and state breakdown.`;

  const body = `
<p class="crumb"><a href="/">Home</a> › After taxes</p>
<h1>$${amount.toLocaleString("en-US")} a Year After Taxes</h1>
<p class="lede">On $${amount.toLocaleString("en-US")} a year, a single filer in California takes home about <strong>${fmt(base.net)}</strong> — ${fmt(base.net / 12)} a month, or ${fmt(base.net / 26)} per biweekly paycheck. Total deductions come to ${fmt(base.totalTax)}, an effective rate of ${pct(base.effectiveRate)}.</p>
<div class="grid3">
  <div class="card"><div class="k">Take-home / year</div><div class="v">${fmt(base.net)}</div></div>
  <div class="card"><div class="k">Take-home / month</div><div class="v">${fmt(base.net / 12)}</div></div>
  <div class="card"><div class="k">Effective tax rate</div><div class="v">${pct(base.effectiveRate)}</div></div>
</div>

<h2>Where the money goes</h2>
<table>
<thead><tr><th>Deduction</th><th class="num">Annual</th><th class="num">Monthly</th><th class="num">Share</th></tr></thead>
<tbody>
<tr><td>Federal income tax</td><td class="num">${fmt(base.federalTax)}</td><td class="num">${fmt(base.federalTax / 12)}</td><td class="num">${pct(base.federalTax / amount)}</td></tr>
<tr><td>California income tax</td><td class="num">${fmt(base.stateTax)}</td><td class="num">${fmt(base.stateTax / 12)}</td><td class="num">${pct(base.stateTax / amount)}</td></tr>
<tr><td>Social Security (6.2%)</td><td class="num">${fmt(Math.min(amount, params.fica.ss_wage_base) * params.fica.ss_rate)}</td><td class="num">${fmt(Math.min(amount, params.fica.ss_wage_base) * params.fica.ss_rate / 12)}</td><td class="num">${pct(Math.min(amount, params.fica.ss_wage_base) * params.fica.ss_rate / amount)}</td></tr>
<tr><td>Medicare (1.45%${amount > 200000 ? " + 0.9%" : ""})</td><td class="num">${fmt(base.medicare)}</td><td class="num">${fmt(base.medicare / 12)}</td><td class="num">${pct(base.medicare / amount)}</td></tr>
<tr><td><strong>Total withheld</strong></td><td class="num"><strong>${fmt(base.totalTax)}</strong></td><td class="num"><strong>${fmt(base.totalTax / 12)}</strong></td><td class="num"><strong>${pct(base.effectiveRate)}</strong></td></tr>
</tbody></table>
<p>The federal figure assumes the ${params.federal.year} standard deduction of ${fmt(params.federal.standard_deduction.single)} and no 401(k), health premium or other pre-tax deduction. Those come off the top and reduce the taxable figure, so a real paycheck usually lands slightly higher than this estimate.</p>

${adsSlot()}

<h2>Same salary, different state</h2>
<p>State income tax is the single biggest swing factor at this income. Here is what $${amount.toLocaleString("en-US")} nets across a spread of states:</p>
<table>
<thead><tr><th>State</th><th class="num">State tax</th><th class="num">Take-home</th><th class="num">Monthly</th></tr></thead>
<tbody>
${["TX", ...(NO_TAX.slice(0, 2)), "FL", ...HIGH_TAX.slice(0, 4)]
  .filter((s, i, a) => a.indexOf(s) === i)
  .map((s) => {
    const c = computePaycheck(params, amount, s, "single");
    return `<tr><td>${esc(params.states[s].name)}</td><td class="num">${c.stateTax === 0 ? "none" : "−" + fmt(c.stateTax)}</td><td class="num">${fmt(c.net)}</td><td class="num">${fmt(c.net / 12)}</td></tr>`;
  })
  .join("\n")}
</tbody></table>
<p>The gap between the best and worst state here is ${fmt(Math.max(...STATE_CODES.map((s) => computePaycheck(params, amount, s, "single").net)) - Math.min(...STATE_CODES.map((s) => computePaycheck(params, amount, s, "single").net)))} a year on the same salary. <a href="/paycheck-calculator/">Pick your state →</a></p>

<h2>What that leaves you each month</h2>
<p>At ${fmt(base.net / 12)} net a month, the 50/30/20 rule would put ${fmt(base.net / 12 * 0.5)} toward needs, ${fmt(base.net / 12 * 0.3)} toward wants and ${fmt(base.net / 12 * 0.2)} toward savings or debt. If rent takes 30% of gross — ${fmt(amount * 0.3 / 12)} — the remainder after rent is ${fmt(base.net / 12 - amount * 0.3 / 12)} a month.</p>

${calculatorBlock({ defaultGross: amount, state: "CA", heading: "Recalculate with your numbers" })}

${marginalStepBlock(amount, "CA")}

<h2>Nearby salaries after tax</h2>
${ladderLinks(SALARIES, amount, (s) => `/${s}-a-year-after-taxes/`, (s) => `$${s.toLocaleString("en-US")} a year`)}
<p><a href="/after-taxes/">See the full after-tax table →</a></p>
`;

  const faq = [
    {
      q: `How much is $${amount.toLocaleString("en-US")} a year after taxes?`,
      a: `About ${fmt(base.net)} a year for a single filer in California, or ${fmt(base.net / 12)} a month. That is an effective tax rate of ${pct(base.effectiveRate)}.`,
    },
    {
      q: `What is the monthly take-home on $${amount.toLocaleString("en-US")}?`,
      a: `${fmt(base.net / 12)} a month in California. In Texas, which has no state income tax, it is ${fmt(tx.net / 12)}.`,
    },
    {
      q: `How much tax do you pay on $${amount.toLocaleString("en-US")}?`,
      a: `Roughly ${fmt(base.totalTax)} in total, including ${fmt(base.federalTax)} federal income tax, ${fmt(base.stateTax)} California income tax and ${fmt(base.fica)} in Social Security and Medicare.`,
    },
  ];

  return {
    slug,
    html: layout({
      title,
      desc,
      slug,
      body,
      breadcrumb: [{ name: "Home", href: "/" }, { name: `$${amount.toLocaleString("en-US")} after tax`, href: slug }],
      faq,
    }),
  };
}

/* ── page: state paycheck calculator ─────────────────────────────────── */

function statePage(code) {
  const st = params.states[code];
  const sample = 75000;
  const c = computePaycheck(params, sample, code, "single");
  const tx = computePaycheck(params, sample, "TX", "single");
  const slug = `/paycheck-calculator/${code.toLowerCase()}/`;
  const taxDesc =
    st.type === "none"
      ? "no state income tax on wages"
      : st.type === "flat"
        ? `a flat ${pct(st.rate)} state income tax`
        : `progressive state income tax brackets`;
  const title = `${st.name} Paycheck Calculator — ${params.meta.tax_year} Take-Home Pay`;
  const desc = `Calculate take-home pay in ${st.name} for ${params.meta.tax_year}. ${st.name} has ${taxDesc}. See federal tax, FICA and net pay for any salary.`;

  const body = `
<p class="crumb"><a href="/">Home</a> › <a href="/paycheck-calculator/">Paycheck calculator</a> › ${esc(st.name)}</p>
<h1>${esc(st.name)} Paycheck Calculator</h1>
<p class="lede">${esc(st.name)} has <strong>${taxDesc}</strong>. On a $${sample.toLocaleString("en-US")} salary a single filer takes home about <strong>${fmt(c.net)}</strong> — ${fmt(c.net / 12)} a month${c.stateTax > 0 ? `, after ${fmt(c.stateTax)} of state income tax` : ""}.</p>
${c.stateNote ? `<div class="warn">${esc(c.stateNote)}</div>` : ""}
<div class="grid3">
  <div class="card"><div class="k">Take-home on $75k</div><div class="v">${fmt(c.net)}</div></div>
  <div class="card"><div class="k">State tax</div><div class="v">${c.stateTax === 0 ? "$0" : fmt(c.stateTax)}</div></div>
  <div class="card"><div class="k">Effective rate</div><div class="v">${pct(c.effectiveRate)}</div></div>
</div>

${calculatorBlock({ defaultGross: sample, state: code, heading: `${esc(st.name)} take-home calculator` })}

<h2>How ${esc(st.name)} taxes wages</h2>
${
  st.type === "none"
    ? `<p>${esc(st.name)} does not levy a tax on wage income, so your state withholding is zero. Federal income tax and FICA still apply — they are federal, not state, and every state pays them. That is why a no-income-tax state still withholds roughly ${pct(c.totalTax / sample)} of a $${sample.toLocaleString("en-US")} salary.</p>`
    : st.type === "flat"
      ? `<p>${esc(st.name)} applies a flat ${pct(st.rate)} rate to taxable wages${st.standard_deduction ? ` after a ${fmt(st.standard_deduction)} standard deduction` : ""}. A flat rate means the percentage does not rise with income, but the dollar amount does: at $50,000 you pay about ${fmt(Math.max(0, 50000 - (st.standard_deduction || 0)) * st.rate)}, at $100,000 about ${fmt(Math.max(0, 100000 - (st.standard_deduction || 0)) * st.rate)}.</p>`
      : `<p>${esc(st.name)} uses progressive brackets, so only the income inside each band is taxed at that band's rate. On a $${sample.toLocaleString("en-US")} salary the state tax comes to ${fmt(c.stateTax)}, an effective ${pct(c.stateTax / sample)} — lower than the top bracket you reach.</p>
<table>
<thead><tr><th>Up to</th><th class="num">Rate</th></tr></thead>
<tbody>
${(st.brackets || []).map((b) => `<tr><td>${b.up_to == null ? "and above" : fmt(b.up_to)}</td><td class="num">${pct(b.rate)}</td></tr>`).join("\n")}
</tbody></table>`
}

<h2>Federal tax applies everywhere</h2>
<p>Whatever the state does, the federal side is identical. On $${sample.toLocaleString("en-US")} a single filer pays ${fmt(c.federalTax)} of federal income tax after the ${fmt(params.federal.standard_deduction.single)} standard deduction, plus ${fmt(c.fica)} in Social Security and Medicare.</p>
<table>
<thead><tr><th>Item</th><th class="num">Annual</th><th class="num">Monthly</th></tr></thead>
<tbody>
<tr><td>Gross</td><td class="num">${fmt(sample)}</td><td class="num">${fmt(sample / 12)}</td></tr>
<tr><td>Federal income tax</td><td class="num">−${fmt(c.federalTax)}</td><td class="num">−${fmt(c.federalTax / 12)}</td></tr>
<tr><td>${esc(st.name)} income tax</td><td class="num">${c.stateTax === 0 ? "0" : "−" + fmt(c.stateTax)}</td><td class="num">${c.stateTax === 0 ? "0" : "−" + fmt(c.stateTax / 12)}</td></tr>
<tr><td>FICA</td><td class="num">−${fmt(c.fica)}</td><td class="num">−${fmt(c.fica / 12)}</td></tr>
<tr><td><strong>Net</strong></td><td class="num"><strong>${fmt(c.net)}</strong></td><td class="num"><strong>${fmt(c.net / 12)}</strong></td></tr>
</tbody></table>
<div class="note">Against Texas (no wage tax) the same $75,000 nets ${fmt(tx.net)}. ${esc(st.name)} comes out ${c.net >= tx.net ? `${fmt(c.net - tx.net)} ahead` : `${fmt(tx.net - c.net)} behind`}.</div>

${stateFactsBlock(code, sample)}

<h2>Other states</h2>
<ul class="links">
${STATE_CODES.map((s) => `<li><a href="/paycheck-calculator/${s.toLowerCase()}/">${esc(params.states[s].name)}</a></li>`).join("\n")}
</ul>
`;

  const faq = [
    {
      q: `Does ${st.name} have state income tax?`,
      a: st.type === "none"
        ? `${st.name} does not tax wage income, so state withholding is zero. Federal income tax and FICA still apply.`
        : `${st.name} taxes wage income with ${taxDesc}. On a $${sample.toLocaleString("en-US")} salary a single filer pays about ${fmt(c.stateTax)}.`,
    },
    {
      q: `What is take-home pay on $75,000 in ${st.name}?`,
      a: `About ${fmt(c.net)} a year, or ${fmt(c.net / 12)} a month, for a single filer using the ${params.meta.tax_year} federal standard deduction and no other pre-tax deductions.`,
    },
  ];

  return {
    slug,
    html: layout({
      title,
      desc,
      slug,
      body,
      breadcrumb: [
        { name: "Home", href: "/" },
        { name: "Paycheck calculator", href: "/paycheck-calculator/" },
        { name: st.name, href: slug },
      ],
      faq,
    }),
  };
}

/* ── hub pages ───────────────────────────────────────────────────────── */

function homePage() {
  const slug = "/";
  const sample = 65000;
  const c = computePaycheck(params, sample, "CA", "single");
  const body = `
<h1>Paycheck math, answered in one screen</h1>
<p class="lede">Convert any salary to an hourly rate, see what the government takes, and find out what actually lands in your account. Built on ${params.meta.tax_year} federal brackets and all 50 states plus DC.</p>

${calculatorBlock({ defaultGross: sample, state: "CA", heading: "Start with your salary" })}

<h2>Popular questions</h2>
<ul class="links">
  <li><a href="/65000-a-year-is-how-much-an-hour/">$65,000 a year is how much an hour?</a></li>
  <li><a href="/50000-a-year-is-how-much-an-hour/">$50,000 a year is how much an hour?</a></li>
  <li><a href="/25-an-hour-is-how-much-a-year/">$25 an hour is how much a year?</a></li>
  <li><a href="/20-an-hour-is-how-much-a-year/">$20 an hour is how much a year?</a></li>
  <li><a href="/75000-a-year-after-taxes/">$75,000 after taxes</a></li>
  <li><a href="/100000-a-year-after-taxes/">$100,000 after taxes</a></li>
</ul>

<h2>Browse by state</h2>
<ul class="links">
${STATE_CODES.slice(0, 18).map((s) => `<li><a href="/paycheck-calculator/${s.toLowerCase()}/">${esc(params.states[s].name)}</a></li>`).join("\n")}
</ul>
<p><a href="/paycheck-calculator/">All 51 paycheck calculators →</a></p>

<h2>How the estimate is built</h2>
<p>Take-home pay is gross wages minus four things: federal income tax (${params.meta.tax_year} brackets after the standard deduction), state income tax, Social Security at ${pct(params.fica.ss_rate)} up to the ${fmt(params.fica.ss_wage_base)} wage base, and Medicare at ${pct(params.fica.medicare_rate)} plus an extra ${pct(params.fica.additional_medicare_rate)} above ${fmt(params.fica.additional_threshold.single)}. Nothing here accounts for 401(k) contributions, health premiums or dependent credits — those all lower the taxable figure, so your real paycheck is usually a little larger. <a href="/methodology/">See the full method →</a></p>
`;
  return {
    slug,
    html: layout({
      title: "Paycheck Math — Salary, Hourly and Take-Home Pay Calculators",
      desc: `Turn any salary into an hourly rate and see real take-home pay for all 50 states, using ${params.meta.tax_year} federal tax brackets and FICA.`,
      slug,
      body,
    }),
  };
}

function hubPage({ slug, h1, lede, items, title, desc }) {
  const body = `
<p class="crumb"><a href="/">Home</a></p>
<h1>${esc(h1)}</h1>
<p class="lede">${lede}</p>
<ul class="links">
${items.map((i) => `<li><a href="${i.href}">${esc(i.label)}</a></li>`).join("\n")}
</ul>
`;
  return { slug, html: layout({ title, desc, slug, body, breadcrumb: [{ name: "Home", href: "/" }] }) };
}

/* ── static pages ────────────────────────────────────────────────────── */

function aboutPage() {
  const slug = "/about/";
  const body = `
<p class="crumb"><a href="/">Home</a> › About</p>
<h1>About Paycheck Math</h1>
<p class="lede">Paycheck Math is a free calculator and reference site for US pay questions: what a salary is per hour, what a wage is per year, and what actually arrives after tax.</p>
<h2>What we do</h2>
<p>Every figure on this site is computed from published government rates, not copied from another calculator. Federal brackets and standard deductions come from the IRS, FICA rates and the Social Security wage base from the Social Security Administration, and state rules from each state's revenue department. Sources are listed on the <a href="/methodology/">methodology page</a>.</p>
<h2>How to read the numbers</h2>
<p>Take-home figures are estimates for a single filer with the standard deduction and no other pre-tax deductions. Real paychecks differ with 401(k) contributions, health insurance, dependents, credits and local taxes. Use these numbers to compare offers and states, then check your actual pay stub for the precise figure.</p>
<h2>Corrections</h2>
<p>If a rate is wrong, tell us and we will fix it. Email <a href="/contact/">the contact page</a> with the page URL and the source you are citing.</p>
<p class="byline">Reviewed against the ${params.meta.tax_year} IRS revenue procedure and SSA wage base. Last updated ${params.meta.generated}.</p>
`;
  return { slug, html: layout({ title: "About Paycheck Math", desc: "Who runs Paycheck Math, where the tax numbers come from and how to report a correction.", slug, body, breadcrumb: [{ name: "Home", href: "/" }, { name: "About", href: slug }] }) };
}

function methodologyPage() {
  const slug = "/methodology/";
  const src = params.meta.sources || {};
  const body = `
<p class="crumb"><a href="/">Home</a> › Methodology</p>
<h1>Methodology and sources</h1>
<p class="lede">No number on this site comes from memory. This page lists every rate, where it came from, and the exact arithmetic applied.</p>
<h2>Federal income tax</h2>
<p>Taxable income is gross wages minus the standard deduction of ${fmt(params.federal.standard_deduction.single)} (single), ${fmt(params.federal.standard_deduction.married)} (married filing jointly) or ${fmt(params.federal.standard_deduction.hoh)} (head of household). Marginal brackets are applied in bands:</p>
<table>
<thead><tr><th>Up to</th><th class="num">Single</th><th class="num">Married</th></tr></thead>
<tbody>
${params.federal.brackets.single.map((b, i) => `<tr><td>${b.up_to == null ? "and above" : fmt(b.up_to)}</td><td class="num">${pct(b.rate)}</td><td class="num">${pct(params.federal.brackets.married[i].rate)}</td></tr>`).join("\n")}
</tbody></table>
<p>Source: ${src.federal ? `<a href="${src.federal}" rel="nofollow">${src.federal}</a>` : "IRS revenue procedure for tax year " + params.federal.year}.</p>
<h2>FICA</h2>
<p>Social Security at ${pct(params.fica.ss_rate)} on wages up to ${fmt(params.fica.ss_wage_base)}; Medicare at ${pct(params.fica.medicare_rate)} on all wages plus ${pct(params.fica.additional_medicare_rate)} above ${fmt(params.fica.additional_threshold.single)} for single filers and ${fmt(params.fica.additional_threshold.married)} for married filing jointly. Source: ${src.fica ? `<a href="${src.fica}" rel="nofollow">${src.fica}</a>` : "Social Security Administration"}.</p>
<h2>State income tax</h2>
<p>States with no wage tax are computed at zero. Flat-rate states apply their rate after any state standard deduction. Bracket states use the published table. States marked as estimates on their calculator page use the top marginal rate because a fully verified bracket table was not available — those pages carry a visible warning.</p>
<h2>What the estimates exclude</h2>
<ul>
<li>401(k), 403(b) and IRA contributions</li>
<li>Health, dental and vision premiums</li>
<li>Dependent credits, EITC and itemised deductions</li>
<li>Local and city income taxes</li>
<li>Self-employment tax, which is double the employee FICA share</li>
</ul>
<h2>Rounding</h2>
<p>Annual figures are rounded to the nearest dollar. Monthly figures divide by 12, biweekly by 26, weekly by 52 and hourly by 2,080. Effective rates are total deductions over gross.</p>
<h2>Benchmarks</h2>
<p>The median annual wage used for "is this a good salary" comparisons is ${fmt(params.benchmarks.median_annual_wage_us)} (${params.benchmarks.year}). ${params.benchmarks.source ? `Source: <a href="${params.benchmarks.source}" rel="nofollow">${params.benchmarks.source}</a>.` : ""}</p>
<p class="byline">Last updated ${params.meta.generated}.</p>
`;
  return { slug, html: layout({ title: "Methodology — how Paycheck Math computes take-home pay", desc: "Every federal bracket, FICA rate and state rule used on this site, with its government source and the exact formula.", slug, body, breadcrumb: [{ name: "Home", href: "/" }, { name: "Methodology", href: slug }] }) };
}

function privacyPage() {
  const slug = "/privacy/";
  const body = `
<p class="crumb"><a href="/">Home</a> › Privacy</p>
<h1>Privacy policy</h1>
<p class="lede">The calculators run entirely in your browser. The salary you type is never sent to a server.</p>
<h2>What we collect</h2>
<p>Nothing you type into a calculator leaves your device — the arithmetic happens in JavaScript on the page. We do not require an account and we do not ask for an email address.</p>
<h2>Analytics and advertising</h2>
<p>We use privacy-respecting aggregate analytics to count page views. If advertising is enabled on a page, the ad provider may set cookies to measure and personalise ads, subject to your consent where required. You can block these with any content blocker and the calculators still work.</p>
<h2>Contact</h2>
<p>Questions about this policy go to the <a href="/contact/">contact page</a>.</p>
`;
  return { slug, html: layout({ title: "Privacy policy — Paycheck Math", desc: "Paycheck Math calculators run in your browser. What we do and do not collect.", slug, body, breadcrumb: [{ name: "Home", href: "/" }, { name: "Privacy", href: slug }] }) };
}

function contactPage() {
  const slug = "/contact/";
  const body = `
<p class="crumb"><a href="/">Home</a> › Contact</p>
<h1>Contact</h1>
<p class="lede">Corrections, questions about the method, or a rate that changed: send the page URL and the source you are looking at.</p>
<h2>Email</h2>
<p><a href="mailto:hello@rerivo.com">hello@rerivo.com</a></p>
<h2>What gets fixed fast</h2>
<ul>
<li>A tax bracket that changed for the new year</li>
<li>A state rule we have marked as an estimate</li>
<li>An arithmetic error on a salary or hourly page</li>
</ul>
<p>We aim to answer within two business days.</p>
`;
  return { slug, html: layout({ title: "Contact — Paycheck Math", desc: "Report a correction or ask about the take-home pay method.", slug, body, breadcrumb: [{ name: "Home", href: "/" }, { name: "Contact", href: slug }] }) };
}

/* ── page: hourly after tax ──────────────────────────────────────────── */

function hourlyAfterTaxPage(rate) {
  const gross = annualFromHourly(rate, 40);
  const ca = computePaycheck(params, gross, "CA", "single");
  const tx = computePaycheck(params, gross, "TX", "single");
  const slug = `/${rate}-an-hour-after-taxes/`;
  const title = `$${rate} an Hour After Taxes: ${fmt(ca.net / 2080)}/hr Take-Home`;
  const desc = `$${rate} an hour is ${fmt(gross)} a year before tax. After federal tax, state tax and FICA you keep about ${fmt(ca.net)} — ${fmt(ca.net / 2080)} an hour. See every state.`;
  const hourlyNet = ca.net / 2080;

  const body = `
<p class="crumb"><a href="/">Home</a> › Hourly after tax</p>
<h1>$${rate} an Hour After Taxes</h1>
<p class="lede">Working 40 hours a week at $${rate} an hour brings in ${fmt(gross)} a year before tax. After federal income tax, state tax and FICA, a single filer in California keeps about <strong>${fmt(ca.net)}</strong> — which is <strong>${usd2(hourlyNet)} an hour</strong>, not $${rate}.</p>
<div class="grid3">
  <div class="card"><div class="k">Take-home / year</div><div class="v">${fmt(ca.net)}</div></div>
  <div class="card"><div class="k">Take-home / week</div><div class="v">${fmt(ca.net / 52)}</div></div>
  <div class="card"><div class="k">Real hourly rate</div><div class="v">${usd2(hourlyNet)}</div></div>
</div>

<h2>From $${rate} gross to ${usd2(hourlyNet)} net</h2>
<p>The gap is ${usd2(rate - hourlyNet)} for every hour worked, or ${fmt(gross - ca.net)} across the year. Effective rate: ${pct(ca.effectiveRate)}. Federal income tax is the largest piece at ${fmt(ca.federalTax)}, then ${fmt(ca.stateTax)} of California income tax and ${fmt(ca.fica)} of Social Security and Medicare.</p>
<table>
<thead><tr><th>Deduction</th><th class="num">Per year</th><th class="num">Per week</th><th class="num">Per hour</th></tr></thead>
<tbody>
<tr><td>Gross</td><td class="num">${fmt(gross)}</td><td class="num">${fmt(gross / 52)}</td><td class="num">${usd2(rate)}</td></tr>
<tr><td>Federal income tax</td><td class="num">−${fmt(ca.federalTax)}</td><td class="num">−${fmt(ca.federalTax / 52)}</td><td class="num">−${usd2(ca.federalTax / 2080)}</td></tr>
<tr><td>California income tax</td><td class="num">−${fmt(ca.stateTax)}</td><td class="num">−${fmt(ca.stateTax / 52)}</td><td class="num">−${usd2(ca.stateTax / 2080)}</td></tr>
<tr><td>Social Security + Medicare</td><td class="num">−${fmt(ca.fica)}</td><td class="num">−${fmt(ca.fica / 52)}</td><td class="num">−${usd2(ca.fica / 2080)}</td></tr>
<tr><td><strong>Take-home</strong></td><td class="num"><strong>${fmt(ca.net)}</strong></td><td class="num"><strong>${fmt(ca.net / 52)}</strong></td><td class="num"><strong>${usd2(hourlyNet)}</strong></td></tr>
</tbody></table>

${adsSlot()}

<h2>What changes by state</h2>
<p>No-income-tax states return the most on the same wage. At $${rate} an hour the difference between Texas and California is ${fmt(tx.net - ca.net)} a year — about ${usd2((tx.net - ca.net) / 2080)} for every hour worked.</p>
<table>
<thead><tr><th>State</th><th class="num">Take-home / year</th><th class="num">Per hour</th></tr></thead>
<tbody>
${["TX", "FL", "WA", "CA", "NY", "IL", "GA", "NJ"]
  .filter((s) => params.states[s])
  .map((s) => {
    const c = computePaycheck(params, gross, s, "single");
    return `<tr><td>${esc(params.states[s].name)}</td><td class="num">${fmt(c.net)}</td><td class="num">${usd2(c.net / 2080)}</td></tr>`;
  })
  .join("\n")}
</tbody></table>
<p><a href="/${rate}-an-hour-after-taxes-in-texas/">$${rate} an hour after taxes in Texas →</a></p>

<h2>Monthly and weekly figures</h2>
<p>Net pay of ${fmt(ca.net)} a year is ${fmt(ca.net / 12)} a month, ${fmt(ca.net / 26)} per biweekly check and ${fmt(ca.net / 52)} a week. A 401(k) contribution of even 5% would remove ${fmt(gross * 0.05)} from the taxable figure before any of this is computed, which lowers the effective rate slightly.</p>

${calculatorBlock({ defaultGross: round0(gross), state: "CA", heading: "Your own numbers" })}

<h2>Nearby hourly rates</h2>
${ladderLinks(HOURLY_TAX, rate, (r) => `/${r}-an-hour-after-taxes/`, (r) => `$${r} an hour after tax`)}
`;

  return {
    slug,
    html: layout({
      title,
      desc,
      slug,
      body,
      breadcrumb: [{ name: "Home", href: "/" }, { name: `$${rate} an hour after tax`, href: slug }],
      faq: [
        {
          q: `How much is $${rate} an hour after taxes?`,
          a: `About ${fmt(ca.net)} a year, or ${usd2(hourlyNet)} an hour, for a single filer in California. In Texas the figure is ${fmt(tx.net)}, which is ${usd2(tx.net / 2080)} an hour.`,
        },
        {
          q: `What is $${rate} an hour after taxes per week?`,
          a: `${fmt(ca.net / 52)} a week after federal tax, California tax and FICA, based on 40 hours a week.`,
        },
      ],
    }),
  };
}

function hourlyStatePage(rate, code) {
  const st = params.states[code];
  const gross = annualFromHourly(rate, 40);
  const c = computePaycheck(params, gross, code, "single");
  const slug = `/${rate}-an-hour-after-taxes-in-${st.name.toLowerCase().replace(/\s+/g, "-")}/`;
  const title = `$${rate} an Hour After Taxes in ${st.name}`;
  const desc = `In ${st.name}, $${rate} an hour is ${fmt(c.net)} a year after tax — ${usd2(c.net / 2080)} an hour. ${st.type === "none" ? `${st.name} has no state income tax.` : `${st.name} takes ${fmt(c.stateTax)}.`}`;

  const body = `
<p class="crumb"><a href="/">Home</a> › <a href="/${rate}-an-hour-after-taxes/">$${rate} an hour after tax</a> › ${esc(st.name)}</p>
<h1>$${rate} an Hour After Taxes in ${esc(st.name)}</h1>
<p class="lede">In ${esc(st.name)}, $${rate} an hour works out to <strong>${fmt(c.net)}</strong> a year after federal income tax, ${st.type === "none" ? "no state income tax" : `${esc(st.name)} income tax`} and FICA — ${usd2(c.net / 2080)} an hour, ${fmt(c.net / 12)} a month.</p>
<div class="grid3">
  <div class="card"><div class="k">Take-home / year</div><div class="v">${fmt(c.net)}</div></div>
  <div class="card"><div class="k">Take-home / week</div><div class="v">${fmt(c.net / 52)}</div></div>
  <div class="card"><div class="k">State tax</div><div class="v">${c.stateTax === 0 ? "$0" : fmt(c.stateTax)}</div></div>
</div>
<h2>Where the ${fmt(gross)} goes</h2>
<p>${st.type === "none" ? `${esc(st.name)} levies no tax on wages, so the only deductions are federal: ${fmt(c.federalTax)} of income tax and ${fmt(c.fica)} of Social Security and Medicare.` : `${esc(st.name)} takes ${fmt(c.stateTax)} on top of ${fmt(c.federalTax)} of federal income tax and ${fmt(c.fica)} of FICA.`} That leaves ${fmt(c.net)}, an effective rate of ${pct(c.effectiveRate)}.</p>
<table>
<thead><tr><th>Item</th><th class="num">Per year</th><th class="num">Per month</th><th class="num">Per hour</th></tr></thead>
<tbody>
<tr><td>Gross</td><td class="num">${fmt(gross)}</td><td class="num">${fmt(gross / 12)}</td><td class="num">${usd2(rate)}</td></tr>
<tr><td>Federal income tax</td><td class="num">−${fmt(c.federalTax)}</td><td class="num">−${fmt(c.federalTax / 12)}</td><td class="num">−${usd2(c.federalTax / 2080)}</td></tr>
<tr><td>${esc(st.name)} income tax</td><td class="num">${c.stateTax === 0 ? "0" : "−" + fmt(c.stateTax)}</td><td class="num">${c.stateTax === 0 ? "0" : "−" + fmt(c.stateTax / 12)}</td><td class="num">${c.stateTax === 0 ? "0" : "−" + usd2(c.stateTax / 2080)}</td></tr>
<tr><td>FICA</td><td class="num">−${fmt(c.fica)}</td><td class="num">−${fmt(c.fica / 12)}</td><td class="num">−${usd2(c.fica / 2080)}</td></tr>
<tr><td><strong>Take-home</strong></td><td class="num"><strong>${fmt(c.net)}</strong></td><td class="num"><strong>${fmt(c.net / 12)}</strong></td><td class="num"><strong>${usd2(c.net / 2080)}</strong></td></tr>
</tbody></table>
${c.stateNote ? `<div class="warn">${esc(c.stateNote)}</div>` : ""}
${adsSlot()}
<h2>Compare</h2>
<ul class="links">
  <li><a href="/${rate}-an-hour-after-taxes/">$${rate} an hour after tax (California)</a></li>
  <li><a href="/paycheck-calculator/${code.toLowerCase()}/">${esc(st.name)} paycheck calculator</a></li>
  <li><a href="/${rate}-an-hour-is-how-much-a-year/">$${rate} an hour is how much a year</a></li>
</ul>
${calculatorBlock({ defaultGross: round0(gross), state: code, heading: "Recalculate" })}
`;

  return {
    slug,
    html: layout({
      title,
      desc,
      slug,
      body,
      breadcrumb: [
        { name: "Home", href: "/" },
        { name: `$${rate} an hour after tax`, href: `/${rate}-an-hour-after-taxes/` },
        { name: st.name, href: slug },
      ],
      faq: [
        {
          q: `How much is $${rate} an hour after taxes in ${st.name}?`,
          a: `About ${fmt(c.net)} a year, or ${usd2(c.net / 2080)} an hour, for a single filer with no other pre-tax deductions.`,
        },
      ],
    }),
  };
}

/* ── page: is this a good salary ─────────────────────────────────────── */

const GOOD_SALARIES = [35000, 40000, 45000, 50000, 55000, 60000, 65000, 70000, 75000, 80000, 85000, 90000, 100000, 110000, 120000, 150000, 200000];

function goodSalaryPage(amount) {
  const med = params.benchmarks.median_annual_wage_us;
  const ca = computePaycheck(params, amount, "CA", "single");
  const tx = computePaycheck(params, amount, "TX", "single");
  const ratio = amount / med;
  const slug = `/is-${amount}-a-year-a-good-salary/`;
  const verdict = ratio >= 1.5 ? "strong" : ratio >= 1 ? "above average" : ratio >= 0.75 ? "close to typical" : "below typical";

  const body = `
<p class="crumb"><a href="/">Home</a> › Is this a good salary</p>
<h1>Is $${amount.toLocaleString("en-US")} a Year a Good Salary?</h1>
<p class="lede">$${amount.toLocaleString("en-US")} is <strong>${(ratio * 100).toFixed(0)}% of the US median full-time wage</strong> (${fmt(med)}), so it is ${verdict}. What that buys depends almost entirely on where you live and how much housing costs there.</p>
<div class="grid3">
  <div class="card"><div class="k">Per month gross</div><div class="v">${fmt(amount / 12)}</div></div>
  <div class="card"><div class="k">After tax (CA)</div><div class="v">${fmt(ca.net)}</div></div>
  <div class="card"><div class="k">vs median</div><div class="v">${amount >= med ? "+" : "−"}${fmt(Math.abs(amount - med))}</div></div>
</div>

<h2>How it compares</h2>
<p>The ${fmt(med)} median covers all full-time wage and salary workers in the United States. At ${fmt(amount)} you are ${amount >= med ? `ahead of ${(100 - 100 / ratio).toFixed(0)}% of that distribution` : `${fmt(med - amount)} short of the midpoint`}. Two things move the answer more than the headline number: state tax and housing.</p>
<table>
<thead><tr><th>Benchmark</th><th class="num">Amount</th><th class="num">Your salary</th></tr></thead>
<tbody>
<tr><td>Federal minimum wage, full time</td><td class="num">${fmt(annualFromHourly(7.25))}</td><td class="num">${(amount / annualFromHourly(7.25)).toFixed(1)}×</td></tr>
<tr><td>US median full-time wage</td><td class="num">${fmt(med)}</td><td class="num">${(ratio * 100).toFixed(0)}%</td></tr>
<tr><td>90th percentile wage</td><td class="num">${fmt(med * 2.3)}</td><td class="num">${(amount / (med * 2.3) * 100).toFixed(0)}%</td></tr>
</tbody></table>
<p>The 90th-percentile reference is ${fmt(med * 2.3)}, roughly 2.3× the median. It is an approximation for orientation, not an official BLS series.</p>

${adsSlot()}

<h2>What it feels like month to month</h2>
<p>After tax in California you keep ${fmt(ca.net)}, or ${fmt(ca.net / 12)} a month. The common 30% housing rule caps rent at ${fmt(amount * 0.3 / 12)}; in a high-cost metro that is tight, in a mid-size city it is comfortable. The 50/30/20 split of net pay gives ${fmt(ca.net / 12 * 0.5)} to needs, ${fmt(ca.net / 12 * 0.3)} to wants and ${fmt(ca.net / 12 * 0.2)} to savings.</p>
<table>
<thead><tr><th>State</th><th class="num">Take-home</th><th class="num">Monthly</th></tr></thead>
<tbody>
${["TX", "FL", "CA", "NY", "IL", "GA"]
  .filter((s) => params.states[s])
  .map((s) => {
    const c = computePaycheck(params, amount, s, "single");
    return `<tr><td>${esc(params.states[s].name)}</td><td class="num">${fmt(c.net)}</td><td class="num">${fmt(c.net / 12)}</td></tr>`;
  })
  .join("\n")}
</tbody></table>
<p>Between Texas and California the same salary differs by ${fmt(tx.net - ca.net)} a year.</p>

<h2>The honest answer</h2>
<p>Whether ${fmt(amount)} is "good" depends on your household size, debt and city. A single renter in a mid-cost city with no debt is comfortable; a family of four in San Francisco or New York on the same number is not. Use the calculator below with your own state and compare against your actual rent rather than a national average.</p>

${calculatorBlock({ defaultGross: amount, state: "CA", heading: "Check another number" })}

<h2>Other salaries</h2>
${ladderLinks(GOOD_SALARIES, amount, (s) => `/is-${s}-a-year-a-good-salary/`, (s) => `$${s.toLocaleString("en-US")} a year`)}
`;

  return {
    slug,
    html: layout({
      title: `Is $${amount.toLocaleString("en-US")} a Year a Good Salary? ${(ratio * 100).toFixed(0)}% of US Median`,
      desc: `$${amount.toLocaleString("en-US")} is ${(ratio * 100).toFixed(0)}% of the US median full-time wage of ${fmt(med)}. See the take-home figure by state and what it leaves each month.`,
      slug,
      body,
      breadcrumb: [{ name: "Home", href: "/" }, { name: `$${amount.toLocaleString("en-US")} a year`, href: slug }],
      faq: [
        {
          q: `Is $${amount.toLocaleString("en-US")} a good salary?`,
          a: `It is ${(ratio * 100).toFixed(0)}% of the US median full-time wage of ${fmt(med)}, which is ${verdict}. Whether it feels comfortable depends on your city, household size and debt.`,
        },
        {
          q: `What is $${amount.toLocaleString("en-US")} a year after taxes?`,
          a: `About ${fmt(ca.net)} in California and ${fmt(tx.net)} in Texas for a single filer.`,
        },
      ],
    }),
  };
}

function notFoundPage() {
  const slug = "/404.html";
  const body = `
<p class="crumb"><a href="/">Home</a></p>
<h1>That page does not exist</h1>
<p class="lede">The salary or URL you asked for is not one we publish. Try the calculators instead.</p>
<ul class="links">
  <li><a href="/paycheck-calculator/">Paycheck calculator by state</a></li>
  <li><a href="/salary-to-hourly/">Salary to hourly</a></li>
  <li><a href="/hourly-to-salary/">Hourly to salary</a></li>
  <li><a href="/after-taxes/">Salary after taxes</a></li>
</ul>
`;
  return {
    slug,
    html: layout({ title: "Page not found — Paycheck Math", desc: "That page does not exist. Use the salary, hourly or state paycheck calculators.", slug: "/404.html", body }),
  };
}

function marginalStepBlock(amount, state) {
  const net = computePaycheck(params, amount, state, "single").net;
  const next = computePaycheck(params, amount + 1000, state, "single").net;
  const prev = computePaycheck(params, amount - 1000, state, "single").net;
  const up = next - net;
  const down = net - prev;
  const mr = computePaycheck(params, amount, state, "single").marginalFederal;
  const stateHasTax = params.states[state].type !== "none";
  return `<h2>What the next $1,000 does</h2>
<p>At ${fmt(amount)}, another $1,000 of gross pay adds <strong>${fmt(up)}</strong> to your annual take-home — you keep ${pct(up / 1000)} of it. Your top federal bracket is ${pct(mr)}; Social Security and Medicare take another ${pct(params.fica.ss_rate + params.fica.medicare_rate)}${stateHasTax ? `, and ${esc(params.states[state].name)} income tax a little more` : ""}, which is why the marginal rate you face is ${pct(1 - up / 1000)} rather than the bracket rate alone.</p>
<table>
<thead><tr><th>Gross change</th><th class="num">Take-home per year</th><th class="num">Change</th></tr></thead>
<tbody>
<tr><td>−$1,000</td><td class="num">${fmt(prev)}</td><td class="num">−${fmt(down)}</td></tr>
<tr><td>current</td><td class="num">${fmt(net)}</td><td class="num">—</td></tr>
<tr><td>+$1,000</td><td class="num">${fmt(next)}</td><td class="num">+${fmt(up)}</td></tr>
</tbody></table>
<p>To move your take-home by ${fmt(1000)} you would need about ${fmt(1000 / (up / 1000))} more gross pay, because the rest goes to tax.</p>`;
}

function stateFactsBlock(code, amount) {
  const st = params.states[code];
  const c = computePaycheck(params, amount, code, "single");
  const tx = computePaycheck(params, amount, "TX", "single");
  const diff = c.net - tx.net;
  const marginal = 1 - (computePaycheck(params, amount + 1000, code, "single").net - c.net) / 1000;
  return `<h2>What is specific to ${esc(st.name)} here</h2>
<p>Your marginal rate — what you lose on the next dollar earned — is <strong>${pct(marginal)}</strong> in ${esc(st.name)}, against ${pct(1 - (computePaycheck(params, amount + 1000, "TX", "single").net - tx.net) / 1000)} in Texas. That is the number that matters for overtime, a raise or a second job.</p>
<table>
<thead><tr><th>Line</th><th class="num">${esc(st.name)}</th><th class="num">Texas (no state tax)</th><th class="num">Difference</th></tr></thead>
<tbody>
<tr><td>State income tax</td><td class="num">${c.stateTax === 0 ? "$0" : fmt(c.stateTax)}</td><td class="num">$0</td><td class="num">${c.stateTax === 0 ? "—" : fmt(c.stateTax)}</td></tr>
<tr><td>Take-home</td><td class="num">${fmt(c.net)}</td><td class="num">${fmt(tx.net)}</td><td class="num">${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))}</td></tr>
<tr><td>Monthly</td><td class="num">${fmt(c.net / 12)}</td><td class="num">${fmt(tx.net / 12)}</td><td class="num">${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff) / 12)}</td></tr>
</tbody></table>
<p>${c.stateTax === 0 ? `${esc(st.name)} is one of eight states with no tax on wage income.` : `Over a working year that is ${fmt(Math.abs(diff) / 12)} a month of difference on the same gross salary.`}</p>`;
}

/* ── assemble ────────────────────────────────────────────────────────── */

const pages = [];
pages.push(homePage());
pages.push(aboutPage(), methodologyPage(), privacyPage(), contactPage(), notFoundPage());

pages.push(
  hubPage({
    slug: "/paycheck-calculator/",
    h1: "Paycheck calculator by state",
    lede: `See take-home pay for any salary in any state, using ${params.meta.tax_year} federal brackets plus that state's own income tax rules.`,
    items: STATE_CODES.map((s) => ({ href: `/paycheck-calculator/${s.toLowerCase()}/`, label: `${params.states[s].name} paycheck calculator` })),
    title: "Paycheck Calculator by State — Take-Home Pay",
    desc: `Take-home pay calculators for all 50 states and DC using ${params.meta.tax_year} federal brackets, FICA and each state's income tax.`,
  }),
  hubPage({
    slug: "/salary-to-hourly/",
    h1: "Salary to hourly",
    lede: "Every annual salary converted to an hourly rate at 40 hours a week, with the after-tax figure.",
    items: SALARIES.map((s) => ({ href: `/${s}-a-year-is-how-much-an-hour/`, label: `$${s.toLocaleString("en-US")} a year` })),
    title: "Salary to Hourly — every salary converted",
    desc: "Convert an annual salary to an hourly rate. Full table from $20,000 to $300,000 with monthly and biweekly equivalents.",
  }),
  hubPage({
    slug: "/hourly-to-salary/",
    h1: "Hourly to salary",
    lede: "Every hourly rate converted to an annual salary at 40 hours a week, plus part-time equivalents.",
    items: HOURLY.map((r) => ({ href: `/${r.toString().replace(".", "-")}-an-hour-is-how-much-a-year/`, label: `$${r} an hour` })),
    title: "Hourly to Salary — every hourly rate converted",
    desc: "Convert an hourly wage to an annual salary. Full table from minimum wage to $100 an hour.",
  }),
  hubPage({
    slug: "/after-taxes/",
    h1: "Salary after taxes",
    lede: "What each salary actually pays after federal income tax, state tax and FICA.",
    items: SALARIES.map((s) => ({ href: `/${s}-a-year-after-taxes/`, label: `$${s.toLocaleString("en-US")} after taxes` })),
    title: "Salary After Taxes — take-home pay by salary",
    desc: "Take-home pay for every salary from $20,000 to $300,000, with the federal, state and FICA breakdown.",
  })
);

for (const r of HOURLY) pages.push(hourlyPage(r));
for (const s of SALARIES) pages.push(salaryPage(s));
for (const s of SALARIES) pages.push(afterTaxPage(s));
for (const c of STATE_CODES) pages.push(statePage(c));

const HOURLY_TAX = HOURLY.filter((r) => r >= 10 && Number.isInteger(r));
for (const r of HOURLY_TAX) pages.push(hourlyAfterTaxPage(r));
for (const r of HOURLY_TAX) pages.push(hourlyStatePage(r, "TX"));
for (const r of HOURLY_TAX) pages.push(hourlyStatePage(r, "CA"));
for (const r of HOURLY_TAX) pages.push(hourlyStatePage(r, "FL"));
for (const s of GOOD_SALARIES) pages.push(goodSalaryPage(s));

/* sitemap + robots + llms.txt */

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .filter((p) => !p.slug.endsWith(".html"))
  .map(
    (p) => `  <url><loc>${SITE}${p.slug}</loc><lastmod>${params.meta.generated}</lastmod><changefreq>monthly</changefreq><priority>${p.slug === "/" ? "1.0" : "0.7"}</priority></url>`
  )
  .join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

const llms = `# Paycheck Math

> Free salary, hourly and take-home pay calculators for the United States, built on ${params.meta.tax_year} federal brackets and state income tax rules.

## Core pages
- ${SITE}/paycheck-calculator/ — take-home pay by state
- ${SITE}/salary-to-hourly/ — salary to hourly conversion
- ${SITE}/hourly-to-salary/ — hourly to salary conversion
- ${SITE}/after-taxes/ — salary after tax
- ${SITE}/methodology/ — every rate and its source

## Facts
- Federal standard deduction ${params.meta.tax_year}: ${fmt(params.federal.standard_deduction.single)} single, ${fmt(params.federal.standard_deduction.married)} married.
- FICA: Social Security ${pct(params.fica.ss_rate)} up to ${fmt(params.fica.ss_wage_base)}, Medicare ${pct(params.fica.medicare_rate)}.
- Pages: ${pages.length}.
`;

/* write or check */

const write = !process.argv.includes("--check");
const files = new Map();
for (const p of pages) {
  if (p.slug === "/404.html") {
    files.set(path.join(OUT, "404.html"), p.html);
    continue;
  }
  const dir = p.slug === "/" ? OUT : path.join(OUT, p.slug);
  const file = path.join(dir, "index.html");
  files.set(file, p.html);
}
files.set(path.join(OUT, "sitemap.xml"), sitemap);
files.set(path.join(OUT, "robots.txt"), robots);
files.set(path.join(OUT, "llms.txt"), llms);
files.set(path.join(OUT, "d3b27220b2e09fc3488db3f7724ae3cc.txt"), "d3b27220b2e09fc3488db3f7724ae3cc\n");
files.set(path.join(OUT, "assets/style.css"), css);
files.set(path.join(OUT, "assets/calc.js"), calcJs);
files.set(path.join(OUT, "assets/tax.mjs"), taxJs);
files.set(path.join(OUT, "assets/tax-params.json"), JSON.stringify(params));

let mismatches = 0;
for (const [file, content] of files) {
  if (write) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  } else {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (cur !== content) {
      mismatches++;
      console.error("MISMATCH", path.relative(OUT, file));
    }
  }
}

// orphan check: every internal href must resolve to a generated page
const slugs = new Set(pages.map((p) => p.slug));
const bad = [];
for (const p of pages) {
  if (p.slug === "/404.html") continue;
  const html = files.get(path.join(OUT, p.slug === "/" ? "" : p.slug, "index.html"));
  const hrefs = [...html.matchAll(/href="(\/[^"#?]*)"/g)];
  for (const m of hrefs) {
    const h = m[1];
    if (h.startsWith("/assets/")) continue;
    if (!slugs.has(h)) bad.push(`${p.slug} -> ${h}`);
  }
}
if (bad.length) {
  console.error(`BROKEN LINKS (${bad.length}):`);
  for (const b of bad.slice(0, 20)) console.error("  " + b);
  process.exitCode = 1;
}

if (!write) {
  if (mismatches === 0 && bad.length === 0) console.log(`OK: ${pages.length} pages match src/`);
  process.exitCode = mismatches || bad.length ? 1 : 0;
} else {
  console.log(`Built ${pages.length} pages into public/ (${files.size} files, ${bad.length} broken links)`);
}
