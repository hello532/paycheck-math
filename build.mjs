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
const SITE_ROOT = process.env.SITE_ORIGIN || "https://pay.rerivo.com";
const BASE_PATH = (process.env.BASE_PATH || "").replace(/\/$/, "");
const SITE = SITE_ROOT + BASE_PATH;
const prefixAssets = (html) =>
  BASE_PATH
    ? html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`)
    : html;
const slugHref = (href) => (BASE_PATH ? BASE_PATH + href : href);

const params = JSON.parse(fs.readFileSync(path.join(ROOT, "data/tax_params.json"), "utf8"));
const css = fs.readFileSync(path.join(ROOT, "src/style.css"), "utf8");
const calcJs = fs.readFileSync(path.join(ROOT, "src/calc.js"), "utf8");
const taxJs = fs.readFileSync(path.join(ROOT, "src/tax.mjs"), "utf8");

const STATE_CODES = Object.keys(params.states).sort();
const NO_TAX_STATES = STATE_CODES.filter((c) => params.states[c].type === "none");
const stateSlug = (c) => params.states[c].name.toLowerCase().replace(/\s+/g, "-");

/* ── page shells ─────────────────────────────────────────────────────── */

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CLUSTER_NAV = `<nav class="clusters" aria-label="All calculators">
<p><strong>Paycheck Math</strong> — every calculator on the site:</p>
<p>
<a href="/paycheck-calculator/">Take-home by state</a> ·
<a href="/how-much-tax-is-taken-out-of-paycheck/">Tax taken out of a paycheck</a> ·
<a href="/what-percentage-of-paycheck-goes-to-taxes/">Percent of paycheck to taxes</a> ·
<a href="/salary-to-hourly/">Salary to hourly</a> ·
<a href="/hourly-to-salary/">Hourly to salary</a> ·
<a href="/after-taxes/">Salary after tax</a> ·
<a href="/hourly-after-taxes/">After-tax hourly</a> ·
<a href="/data/paycheck-tax-by-state/">Open dataset</a> ·
<a href="/methodology/">Methodology</a>
</p>
</nav>`;

function jsonld(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function siteLd(slug, title, desc) {
  return jsonld({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        "url": `${SITE}/`,
        "name": "Paycheck Math",
        "description": "Salary, hourly and take-home pay calculators for the United States.",
      },
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        "name": "Paycheck Math",
        "url": `${SITE}/`,
      },
      {
        "@type": "WebPage",
        "@id": `${SITE}${slug}#webpage`,
        "url": `${SITE}${slug}`,
        "name": title,
        "description": desc,
        "isPartOf": { "@id": `${SITE}/#website` },
        "about": { "@id": `${SITE}/#organization` },
        "inLanguage": "en-US",
      },
    ],
  });
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
<link rel="preload" href="/assets/tax-params.json" as="fetch" crossorigin>
<meta name="pm-base" content="${BASE_PATH}">
<style>@@CRITICAL_CSS@@</style>
${crumbLd}
${faqLd}
${siteLd(slug, title, desc)}
${extraHead}
${ADSENSE_HEAD}
${GA_HEAD}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap">
  <a class="brand" href="/">Paycheck <span>Math</span></a>
  <nav class="top">
    <a href="/paycheck-calculator/">Paycheck calculator</a>
    <a href="/salary-to-hourly/">Salary to hourly</a>
    <a href="/hourly-to-salary/">Hourly to salary</a>
    <a href="/after-taxes/">After taxes</a>
    <a href="/hourly-after-taxes/">After-tax hourly</a>
  </nav>
</div></header>
<main id="main" tabindex="-1"><div class="wrap">
${body}
CLUSTER_NAV_PLACEHOLDER_MARKER
</div></main>
<footer class="site"><div class="wrap">
  <div>Paycheck Math — ${params.meta.tax_year} federal rates. Estimates only, not tax advice.</div>
  <div>
    <a href="/about/">About</a> · <a href="/methodology/">Methodology</a> ·
    <a href="/privacy/">Privacy</a> · <a href="/contact/">Contact</a> ·
    <a href="https://typing.rerivo.com/">Free typing speed test</a>
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

const GA_ID = process.env.GA_MEASUREMENT_ID || "";
const GA_HEAD = GA_ID
  ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');</script>`
  : "";

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

${GOOD_SALARIES.includes(amount) ? `<p><a href="/is-${amount}-a-year-a-good-salary/">Is ${fmt(amount)} a year a good salary?</a></p>` : ""}

<h2>How this ${fmt(amount)} is taxed band by band</h2>
<p>Federal brackets apply only to the income inside each band, which is why the effective rate stays below the marginal one. At ${fmt(amount)} after the ${fmt(params.federal.standard_deduction.single)} standard deduction, the federal tax breaks down as:</p>
<table>
<thead><tr><th>Band</th><th class="num">Rate</th><th class="num">Income in band</th><th class="num">Tax</th></tr></thead>
<tbody>
${(() => {
  let floor = 0;
  return params.federal.brackets.single.map((b) => {
    const top = b.up_to === null ? Infinity : b.up_to;
    const taxable = Math.max(0, amount - params.federal.standard_deduction.single);
    const slice = Math.max(0, Math.min(taxable, top) - floor);
    const out = slice > 0 ? `<tr><td>${fmt(floor)} – ${b.up_to === null ? "above" : fmt(b.up_to)}</td><td class="num">${pct(b.rate)}</td><td class="num">${fmt(slice)}</td><td class="num">${fmt(slice * b.rate)}</td></tr>` : "";
    floor = top;
    return out;
  }).join("");
})()}
</tbody></table>
<p>Total federal income tax at this gross: <strong>${fmt(base.federalTax)}</strong>, or ${pct(base.federalTax / amount)} of gross. Add FICA of ${fmt(base.fica)} and ${base.stateTax === 0 ? "no state income tax" : fmt(base.stateTax) + " of state tax"}.</p>

<h2>Nearby salaries after tax</h2>
<p>At ${fmt(amount)} the next $1,000 of gross adds ${fmt(computePaycheck(params, amount + 1000, "CA", "single").net - base.net)} to take-home in California, and ${fmt(computePaycheck(params, amount + 1000, "TX", "single").net - computePaycheck(params, amount, "TX", "single").net)} in Texas.</p>
<p>${amount >= params.fica.ss_wage_base ? `You are ${fmt(amount - params.fica.ss_wage_base)} above the Social Security wage base, so that 6.2% has already stopped for the year and only Medicare and income tax apply to further pay.` : `You are ${fmt(params.fica.ss_wage_base - amount)} below the ${fmt(params.fica.ss_wage_base)} Social Security wage base, so the full 6.2% applies to every paycheck.`} Against the highest-taxing state measured on this site, the same ${fmt(amount)} leaves ${fmt(computePaycheck(params, amount, "OR", "single").net)} in Oregon — ${fmt(computePaycheck(params, amount, "OR", "single").net - computePaycheck(params, amount, "TX", "single").net)} less than Texas.</p>
${ladderLinks(SALARIES, amount, (s) => `/${s}-a-year-after-taxes/`, (s) => `${s.toLocaleString("en-US")} a year`)}
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
  const NO_TAX = Object.keys(params.states).filter((s) => params.states[s].type === "none");
  const stateRow = stateIncome.byState[st.name];
  const stateMedian = stateRow && typeof stateRow.median === "number" ? stateRow.median : null;
  const sample = stateMedian ? Math.round(stateMedian / 100) * 100 : 75000;
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
  <div class="card"><div class="k">Take-home on ${fmt(sample)}</div><div class="v">${fmt(c.net)}</div></div>
  <div class="card"><div class="k">State tax</div><div class="v">${c.stateTax === 0 ? "$0" : fmt(c.stateTax)}</div></div>
  <div class="card"><div class="k">Effective rate</div><div class="v">${pct(c.effectiveRate)}</div></div>
</div>

${calculatorBlock({ defaultGross: sample, state: code, heading: `${esc(st.name)} take-home calculator` })}

<h2>How ${esc(st.name)} taxes wages</h2>
${
  st.type === "none"
    ? `<p>${esc(st.name)} does not levy a tax on wage income, so your state withholding is zero. Federal income tax and FICA still apply — they are federal, not state, and every state pays them. That is why a no-income-tax state still withholds roughly ${pct(c.totalTax / sample)} of a $${sample.toLocaleString("en-US")} salary.</p>
<p class="byline">${esc(st.name)} is one of ${NO_TAX.length} jurisdictions with no wage income tax${st.note ? ` — ${st.note.replace(/\.$/, "").replace(/^Applies to /i, "")}` : ""}. The ${fmt(c.totalTax)} withheld here is entirely federal: ${fmt(c.federalTax)} income tax and ${fmt(c.fica)} FICA.</p>`
    : st.type === "flat"
      ? `<p>${esc(st.name)} applies a flat ${pct(st.rate)} rate to taxable wages${st.standard_deduction ? ` after a ${fmt(st.standard_deduction)} standard deduction` : ""}. A flat rate means the percentage does not rise with income, but the dollar amount does: at $50,000 you pay about ${fmt(Math.max(0, 50000 - (st.standard_deduction || 0)) * st.rate)}, at $100,000 about ${fmt(Math.max(0, 100000 - (st.standard_deduction || 0)) * st.rate)}.</p>
<p class="byline">${esc(st.name)} is one of ${Object.values(params.states).filter((s) => s.type === "flat").length} states with a single wage-tax rate. Its first ${fmt(st.standard_deduction || 0)} of gross wages is untaxed${st.standard_deduction ? "" : " (no standard deduction applies, so tax runs from the first dollar)"}, which means the $${sample.toLocaleString("en-US")} salary pays state tax on ${fmt(Math.max(0, sample - (st.standard_deduction || 0)))}.</p>`
      : `<p>${esc(st.name)} uses progressive brackets, so only the income inside each band is taxed at that band's rate. On a $${sample.toLocaleString("en-US")} salary the state tax comes to ${fmt(c.stateTax)}, an effective ${pct(c.stateTax / sample)} — lower than the top bracket you reach.</p>
<p class="byline">${esc(st.name)} taxes its first dollar at ${pct((st.brackets || [])[0]?.rate ?? 0)}; the band containing $${sample.toLocaleString("en-US")} starts at ${fmt((st.brackets || []).filter((b) => (b.up_to ?? Infinity) >= Math.max(0, sample - (st.standard_deduction || 0)))[0]?.floor ?? 0)} and charges ${pct((st.brackets || []).filter((b) => (b.up_to ?? Infinity) >= Math.max(0, sample - (st.standard_deduction || 0)))[0]?.rate ?? 0)}. Going from $${sample.toLocaleString("en-US")} to $${(sample * 1.25).toLocaleString("en-US")} adds ${fmt(computePaycheck(params, sample * 1.25, code).stateTax - c.stateTax)} of state tax.</p>
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

${st.bracketYear === 2025 ? `<div class="warn"><strong>${esc(st.name)} uses 2025 bracket widths.</strong> ${esc(st.bracketNote || "")} The rate you see is the published 2025 figure applied to 2026 wages.</div>` : ""}
${stateFactsBlock(code, sample)}
${stateSpecificBlock(code, sample)}
${stateIncomeBlock(code, sample)}
${noTaxComparisonBlock(code, sample)}
${uniqueFactsBlock({ gross: sample, state: code })}
${SALARY_STATES.includes(code) ? `<h2>Salaries in ${esc(st.name)}</h2>
<ul class="links">
${SALARY_STATE_VALUES.map((v) => `<li><a href="/${v}-a-year-after-taxes-in-${stateSlug(code)}/">${fmt(v)}</a></li>`).join("\n")}
</ul>` : ""}

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
  <li><a href="/how-much-tax-is-taken-out-of-paycheck/">How much tax is taken out of a paycheck?</a></li>
  <li><a href="/what-percentage-of-paycheck-goes-to-taxes/">What percentage of your paycheck goes to taxes?</a></li>
  <li><a href="/data/paycheck-tax-by-state/">Open dataset: withholding by state (CSV/JSON)</a></li>
  <li><a href="/how-many-biweekly-paychecks-in-2026/">How many biweekly paychecks in 2026?</a></li>
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
  const groups = new Map();
  for (const it of items) {
    const key = it.label.replace(/^\$/, "").charAt(0).toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const body = `
<p class="crumb"><a href="/">Home</a></p>
<h1>${esc(h1)}</h1>
<p class="lede">${lede}</p>
<nav class="jump" aria-label="Jump to section"><p>${[...groups.keys()].map((k) => `<a href="#g-${k.toLowerCase()}">${k}</a>`).join(" · ")}</p></nav>
${[...groups.entries()].map(([k, list]) => `<h2 id="g-${k.toLowerCase()}">${k}</h2>\n<ul class="links">${list.map((i) => `<li><a href="${i.href}">${esc(i.label)}</a></li>`).join("")}</ul>`).join("\n")}
<ul class="links" hidden>
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
<p>Figures are computed from published rates rather than copied from another calculator: federal brackets and standard deductions from the IRS, FICA and the wage base from the Social Security Administration, and state rules from the Tax Foundation's state table plus, where they changed for 2026, the state revenue department. Where a state's 2026 bracket widths were not yet published, the page says so. Sources are listed on the <a href="/methodology/">methodology page</a>.</p>
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
<p class="lede">Every rate on this site traces to a published government table, and the exceptions are labelled on the pages they affect. This page lists the sources and the exact arithmetic.</p>
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
<p>${(() => { const stale = Object.entries(params.states).filter(([, v]) => v.bracketYear === 2025); return stale.length ? `Bracket widths are 2026 except in ${stale.map(([, v]) => v.name).join(", ")}, where the 2026 inflation-adjusted figures had not been published when the source was compiled and the 2025 figures are used instead.` : ""; })()}</p>
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
<h2>Compare by state</h2>
<p>${NO_TAX_STATES.length} states have no wage income tax — ${NO_TAX_STATES.map((c) => params.states[c].name).join(", ")}. All of them produce the identical take-home figure at this rate, so any of those state pages shows the same number. The difference appears only in states that tax wages.</p>
<ul class="links">
  <li><a href="/${rate}-an-hour-after-taxes-in-california/">${rate} an hour in California (progressive)</a></li>
  <li><a href="/hourly-after-taxes/">All hourly after-tax pages</a></li>
  <li><a href="/hourly-after-taxes-by-state/">By state</a></li>
</ul>

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
${uniqueFactsBlock({ gross: annualFromHourly(rate, 40), state: code, rate })}
${stateSpecificBlock(code, annualFromHourly(rate, 40))}
${stateIncomeBlock(code, annualFromHourly(rate, 40))}
${noTaxComparisonBlock(code, annualFromHourly(rate, 40))}
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
  const stTaxableName = st.type === "none" ? "none" : "tax";
  return `<h2>What is specific to ${esc(st.name)} here</h2>
<p>Your marginal rate — what you lose on the next dollar earned — is <strong>${pct(marginal)}</strong> in ${esc(st.name)}, against ${pct(1 - (computePaycheck(params, amount + 1000, "TX", "single").net - tx.net) / 1000)} in Texas. That is the number that matters for overtime, a raise or a second job.</p>
<table>
<thead><tr><th>Line</th><th class="num">${esc(st.name)}</th><th class="num">Texas (no state tax)</th><th class="num">Difference</th></tr></thead>
<tbody>
<tr><td>State income tax</td><td class="num">${c.stateTax === 0 ? "$0" : fmt(c.stateTax)}</td><td class="num">$0</td><td class="num">${c.stateTax === 0 ? "—" : fmt(c.stateTax)}</td></tr>
<tr><td>Take-home</td><td class="num">${fmt(c.net)}</td><td class="num">${fmt(tx.net)}</td><td class="num">${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))}</td></tr>
<tr><td>Monthly</td><td class="num">${fmt(c.net / 12)}</td><td class="num">${fmt(tx.net / 12)}</td><td class="num">${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff) / 12)}</td></tr>
</tbody></table>
<p>${c.stateTax === 0 ? `${esc(st.name)} is one of ${Object.values(params.states).filter((s) => s.type === "none").length} jurisdictions with no wage income tax${st.note ? ` (its income tax covers ${st.note.replace(/\.$/, "").replace(/^Applies to /i, "").toLowerCase()})` : ""}.` : `Over a working year that is ${fmt(Math.abs(diff) / 12)} a month of difference on the same gross salary.`}</p>`;
}

function bracketPosition(gross, state, filing = "single") {
  const st = params.states[state];
  const fedBrackets = params.federal.brackets[filing];
  const fedTaxable = Math.max(0, gross - params.federal.standard_deduction[filing]);
  let fedTop = null;
  let fedRate = fedBrackets[0].rate;
  for (const b of fedBrackets) {
    if (fedTaxable <= (b.up_to ?? Infinity)) { fedRate = b.rate; fedTop = b.up_to; break; }
  }
  let stTop = null;
  let stRate = null;
  if (st && st.type === "brackets") {
    const stTaxable = Math.max(0, gross - (st.standard_deduction || 0));
    for (const b of st.brackets) {
      if (stTaxable <= (b.up_to ?? Infinity)) { stRate = b.rate; stTop = b.up_to; break; }
    }
  } else if (st && st.type === "flat") {
    stRate = st.rate;
  }
  return { fedRate, fedTop, stRate, stTop, fedTaxable };
}

function uniqueFactsBlock({ gross, state, rate = null }) {
  const st = params.states[state];
  const pos = bracketPosition(gross, state);
  const c = computePaycheck(params, gross, state, "single");
  const fedStarts = params.federal.standard_deduction.single;
  const stateStarts = st && st.type !== "none" ? st.standard_deduction || 0 : 0;
  const toNextFed = pos.fedTop && pos.fedTop !== null ? Math.max(0, pos.fedTop - pos.fedTaxable) : null;

  const ladder = [0.6, 0.8, 1.0, 1.2, 1.4].map((f) => {
    const g = Math.round((gross * f) / 100) * 100;
    const r = computePaycheck(params, g, state, "single");
    return { g, net: r.net, eff: r.effectiveRate };
  });

  const hoursRows = rate
    ? [20, 30, 40, 50].map((h) => {
        const g = annualFromHourly(rate, h);
        const r = computePaycheck(params, g, state, "single");
        return { h, g, net: r.net, perHour: r.net / (h * 52) };
      })
    : [];

  const otGross = gross + (rate ? rate * 1.5 * 5 * 52 : 0);
  const ot = rate ? computePaycheck(params, otGross, state, "single") : null;

  return `<h2>${rate ? `The tax structure you hit at $${rate}/hour in ${esc(st.name)}` : `Where ${esc(st.name)} income sits in the tax structure`}</h2>
<p>Your first ${fmt(fedStarts)} of gross pay is covered by the federal standard deduction, so federal income tax starts above that line. ${stateStarts > 0 ? `${esc(st.name)} adds its own ${fmt(stateStarts)} deduction before state tax starts.` : st.type === "none" ? `${esc(st.name)} has no state income tax at all, so only the federal threshold applies.` : `${esc(st.name)} has no standard deduction for this calculation, so state tax applies from the first dollar.`}</p>
<table>
<thead><tr><th>Threshold</th><th class="num">Gross where it starts</th></tr></thead>
<tbody>
<tr><td>Federal income tax</td><td class="num">${fmt(fedStarts)}</td></tr>
<tr><td>${esc(st.name)} income tax</td><td class="num">${st.type === "none" ? "does not apply" : fmt(stateStarts)}</td></tr>
<tr><td>Social Security (${pct(params.fica.ss_rate)})</td><td class="num">first dollar</td></tr>
<tr><td>Social Security stops</td><td class="num">${fmt(params.fica.ss_wage_base)}</td></tr>
</tbody></table>
<p>At ${fmt(gross)} you are in the <strong>${pct(pos.fedRate)} federal bracket</strong>${pos.stRate ? ` and the <strong>${pct(pos.stRate)} ${esc(st.name)} bracket</strong>` : st.type === "none" ? ` and pay nothing to ${esc(st.name)}` : ` at a flat ${pct(pos.stRate || 0)}`}. ${toNextFed && toNextFed > 0 ? `You are ${fmt(toNextFed)} of taxable income away from the next federal bracket.` : "You are already in the top federal bracket."}</p>

<h2>Net pay across the income range</h2>
<p>The same ${esc(st.name)} rules applied at five different gross levels, so you can see how the effective rate climbs:</p>
<table>
<thead><tr><th>Gross</th><th class="num">Take-home</th><th class="num">Effective rate</th></tr></thead>
<tbody>
${ladder.map((r) => `<tr><td>${fmt(r.g)}</td><td class="num">${fmt(r.net)}</td><td class="num">${pct(r.eff)}</td></tr>`).join("\n")}
</tbody></table>
${
  rate
    ? `<h2>Part time versus full time at $${rate} an hour</h2>
<table>
<thead><tr><th>Hours per week</th><th class="num">Gross</th><th class="num">Take-home</th><th class="num">Net per hour worked</th></tr></thead>
<tbody>
${hoursRows.map((r) => `<tr><td>${r.h}</td><td class="num">${fmt(r.g)}</td><td class="num">${fmt(r.net)}</td><td class="num">${usd2(r.perHour)}</td></tr>`).join("\n")}
</tbody></table>
<p>Net per hour worked rises as hours fall, because a smaller gross means less of it crosses into higher brackets. Going from 50 hours to 20 raises the net value of each hour by ${usd2(hoursRows[0].perHour - hoursRows[3].perHour)}.</p>

<h2>What five hours of overtime actually adds</h2>
<p>At time-and-a-half, five extra hours a week is ${fmt(rate * 1.5 * 5 * 52)} more gross a year. After federal tax${st.type === "none" ? "" : `, ${esc(st.name)} tax`} and FICA, that lands as <strong>${fmt(ot.net - c.net)}</strong> — about ${usd2((ot.net - c.net) / 260)} for each of those extra hours.</p>`
    : ""
}<h2>What this page does not model</h2>
<p>Single filer, standard deduction, no 401(k), no health premium, no dependents, no local or city income tax, and state credits and personal exemptions are excluded — which means the state figure is a slight overstatement. Self-employment would double the FICA share.</p>`;
}

const stateFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/state_facts.json"), "utf8"));

function stateSpecificBlock(code, sample) {
  const f = stateFacts[code] || {};
  const st = params.states[code];
  const lines = [];
  if (f.noWageTax) {
    lines.push(`<li><strong>No wage income tax.</strong> ${esc(st.name)} does not tax wages${st.note ? ` — its income tax covers ${st.note.replace(/\.$/, "").replace(/^Applies to /i, "")}` : ""}.</li>`);
  }
  if (f.addedLocalIncomeTax) {
    lines.push(`<li><strong>Local income taxes add about ${f.addedLocalIncomeTax}% of AGI</strong> on average in ${esc(st.name)}, on top of the state rate. County and city taxes are excluded from the calculator above.</li>`);
  }
  if (f.localPayrollTax) {
    lines.push(`<li><strong>Some cities and counties levy their own payroll or wage taxes</strong> in ${esc(st.name)}. Those are local, not state, and excluded here.</li>`);
  }
  if (f.deductsFederalTax) {
    lines.push(`<li><strong>Federal income tax is deductible on the state return.</strong> ${esc(st.name)} lets filers subtract some or all federal tax paid from state taxable income, which lowers the real state bill below what the flat table shows.</li>`);
  }
  if (f.includesFederalStandardDeduction) {
    lines.push(`<li><strong>The state income starting point includes the federal standard deduction.</strong> ${esc(st.name)} builds its state taxable income on top of the federal figure, so the ${fmt(params.federal.standard_deduction.single)} federal deduction is already reflected.</li>`);
  }
  if (st.type === "none" && !f.noWageTax) {
    lines.push(`<li><strong>No wage income tax applies to this salary.</strong></li>`);
  }
  const width = st.type === "brackets" ? st.brackets.length : st.type === "flat" ? 1 : 0;
  if (width > 1) {
    lines.push(`<li><strong>${width} income bands.</strong> The top band starts at ${fmt(st.brackets[width - 2]?.up_to ?? 0)} of taxable income and charges ${pct(st.brackets[width - 1].rate)}.</li>`);
  }
  lines.push(`<li><strong>Social Security stops at ${fmt(params.fica.ss_wage_base)} of wages.</strong> ${sample >= params.fica.ss_wage_base ? `At ${fmt(sample)} you are above that line, so the 6.2% stops partway through the year.` : `At ${fmt(sample)} you are below that line, so the full 6.2% applies to every paycheck.`}</li>`);
  return `<h2>What is different about ${esc(st.name)}</h2>\n<ul>${lines.map((l) => `\n  ${l}`).join("")}\n</ul>`;
}

const stateIncome = JSON.parse(fs.readFileSync(path.join(ROOT, "data/state_income.json"), "utf8"));

function incomeTier(gross, st) {
  if (gross >= st.p80) return "top 20%";
  if (gross >= st.p60) return "60th-80th percentile";
  if (gross >= st.median) return "40th-60th percentile";
  if (gross >= st.p40) return "20th-40th percentile";
  return "bottom 20%";
}

function stateIncomeBlock(code, gross) {
  const st = params.states[code];
  const d = stateIncome.byState[st.name];
  if (!d) return "";
  const nat = stateIncome.national;
  const ranked = Object.entries(stateIncome.byState).sort((a, b) => b[1].median - a[1].median);
  const rank = ranked.findIndex(([n]) => n === st.name) + 1;
  const ratio = gross / d.median;
  const natRatio = gross / nat.median;
  const spread = d.p80 / d.p20;
  const natSpread = nat.p80 / nat.p20;
  const gapLine = gross < d.median ? `${fmt(d.median - gross)} below the state midpoint` : `${fmt(gross - d.median)} above it`;
  return `<h2>Where ${fmt(gross)} lands in ${esc(st.name)}</h2>
<p>${esc(st.name)} households have a median income of <strong>${fmt(d.median)}</strong>, ranking <strong>${rank} of ${ranked.length}</strong> jurisdictions against a national median of ${fmt(nat.median)}. A gross salary of ${fmt(gross)} is <strong>${(ratio * 100).toFixed(0)}% of the ${esc(st.name)} median</strong> and ${(natRatio * 100).toFixed(0)}% of the national one — ${gapLine}.</p>
<p>By percentile, that puts a single earner in the <strong>${incomeTier(gross, d)}</strong> of ${esc(st.name)} households. Read this as a rough marker, not an exact position: the percentiles count whole households, which often have two earners, while this salary is one person's gross.</p>
<table>
<thead><tr><th>${esc(st.name)} household percentile</th><th class="num">Income</th><th class="num">${fmt(gross)} is</th></tr></thead>
<tbody>
<tr><td>20th</td><td class="num">${fmt(d.p20)}</td><td class="num">${(gross / d.p20 * 100).toFixed(0)}%</td></tr>
<tr><td>40th</td><td class="num">${fmt(d.p40)}</td><td class="num">${(gross / d.p40 * 100).toFixed(0)}%</td></tr>
<tr><td>median (50th)</td><td class="num">${fmt(d.median)}</td><td class="num">${(ratio * 100).toFixed(0)}%</td></tr>
<tr><td>60th</td><td class="num">${fmt(d.p60)}</td><td class="num">${(gross / d.p60 * 100).toFixed(0)}%</td></tr>
<tr><td>80th</td><td class="num">${fmt(d.p80)}</td><td class="num">${(gross / d.p80 * 100).toFixed(0)}%</td></tr>
</tbody></table>
<p>${esc(st.name)}'s 80th percentile household earns <strong>${spread.toFixed(2)}×</strong> its 20th percentile — ${spread > 5 ? "one of the widest gaps" : spread > 4.5 ? "a wide gap" : spread > 4 ? "a moderate gap" : "a narrower gap"} against the national ${natSpread.toFixed(2)}.</p>
<p class="byline">Source: ${stateIncome.measure}, ${stateIncome.year}. ${stateIncome.source_note}</p>`;
}

function noTaxComparisonBlock(code, gross) {
  const st = params.states[code];
  if (st.type !== "none") return "";
  const ranked = Object.entries(stateIncome.byState).sort((a, b) => b[1].median - a[1].median);
  const rank = ranked.findIndex(([n]) => n === st.name) + 1;
  const peerCodes = Object.keys(params.states).filter((c) => params.states[c].type === "none" && c !== code);
  const peerRows = peerCodes
    .map((c) => {
      const name = params.states[c].name;
      const inc = stateIncome.byState[name];
      return { c, name, inc, net: computePaycheck(params, gross, c, "single").net };
    })
    .sort((a, b) => (b.inc ? b.inc.median : 0) - (a.inc ? a.inc.median : 0))
    .map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${x.inc ? fmt(x.inc.median) : "—"}</td><td class="num">${fmt(x.net)}</td></tr>`)
    .join("\n");
  const highTax = ["CA", "NY", "NJ", "OR"]
    .map((c) => ({ name: params.states[c].name, tax: computePaycheck(params, gross, c, "single").stateTax }))
    .sort((a, b) => b.tax - a.tax);
  return `<h2>If ${esc(st.name)} taxed wages like other states</h2>
<p>${esc(st.name)} takes nothing from this ${fmt(gross)} salary. The table is hypothetical — it applies another state's wage tax to the same income, so the absence of a state tax becomes a number instead of an adjective:</p>
<table>
<thead><tr><th>Taxed as if you lived in</th><th class="num">State tax on ${fmt(gross)}</th><th class="num">Kept by living in ${esc(st.name)}</th></tr></thead>
<tbody>
${highTax.map((h) => `<tr><td>${esc(h.name)}</td><td class="num">${fmt(h.tax)}</td><td class="num">${fmt(h.tax)}</td></tr>`).join("\n")}
</tbody></table>
<p>Against ${esc(highTax[0].name)} the saving is ${fmt(highTax[0].tax)} a year, or ${fmt(highTax[0].tax / 12)} a month — and it scales with salary, unlike a fixed deduction.</p>
<h2>Other states with no wage tax</h2>
<p>${esc(st.name)} ranks ${rank} of ${ranked.length} by median household income. On the same ${fmt(gross)} gross:</p>
<table>
<thead><tr><th>State (no wage tax)</th><th class="num">Median household (${stateIncome.year})</th><th class="num">Take-home on ${fmt(gross)}</th></tr></thead>
<tbody>
${peerRows}
</tbody></table>`;
}

const SALARY_STATES = ["CA", "TX", "NY", "IL", "GA", "NJ", "MA", "MI", "NC"];
const SALARY_STATE_VALUES = [30000, 40000, 45000, 50000, 55000, 60000, 65000, 70000, 75000, 80000, 85000, 90000, 100000, 110000, 120000, 150000];

function salaryStatePage(amount, code) {
  const st = params.states[code];
  const c = computePaycheck(params, amount, code, "single");
  const tx = computePaycheck(params, amount, "TX", "single");
  const d = stateIncome.byState[st.name];
  const slug = `/${amount}-a-year-after-taxes-in-${stateSlug(code)}/`;
  const pos = bracketPosition(amount, code);
  const netMonthly = c.net / 12;
  return {
    slug,
    html: layout({
      title: `$${amount.toLocaleString("en-US")} a Year After Taxes in ${st.name}`,
      desc: `In ${st.name}, $${amount.toLocaleString("en-US")} a year leaves about ${fmt(c.net)} after federal tax, ${st.type === "none" ? "no state income tax" : st.name + " income tax"} and FICA — ${fmt(netMonthly)} a month.`,
      slug,
      breadcrumb: [
        { name: "Home", href: "/" },
        { name: `$${amount.toLocaleString("en-US")} after taxes`, href: `/${amount}-a-year-after-taxes/` },
        { name: st.name, href: slug },
      ],
      faq: [
        {
          q: `How much is $${amount.toLocaleString("en-US")} after taxes in ${st.name}?`,
          a: `About ${fmt(c.net)} a year, or ${fmt(netMonthly)} a month, for a single filer with the ${params.meta.tax_year} federal standard deduction and no other pre-tax deductions.`,
        },
        {
          q: `How much state tax do you pay on $${amount.toLocaleString("en-US")} in ${st.name}?`,
          a: st.type === "none"
            ? `${st.name} has no wage income tax, so the state figure is zero. Federal income tax of ${fmt(c.federalTax)} and FICA of ${fmt(c.fica)} still apply.`
            : `About ${fmt(c.stateTax)}, which is ${pct(c.stateTax / amount)} of the gross salary.`,
        },
      ],
      body: `
<p class="crumb"><a href="/">Home</a> › <a href="/${amount}-a-year-after-taxes/">$${amount.toLocaleString("en-US")} after taxes</a> › ${esc(st.name)}</p>
<h1>$${amount.toLocaleString("en-US")} a Year After Taxes in ${esc(st.name)}</h1>
<p class="lede">After federal income tax, ${st.type === "none" ? "no state income tax" : `${esc(st.name)} income tax`} and FICA, a single filer on $${amount.toLocaleString("en-US")} in ${esc(st.name)} keeps <strong>${fmt(c.net)}</strong> — ${fmt(netMonthly)} a month, ${fmt(c.net / 26)} per biweekly check.</p>
<div class="grid3">
  <div class="card"><div class="k">Take-home / year</div><div class="v">${fmt(c.net)}</div></div>
  <div class="card"><div class="k">Take-home / month</div><div class="v">${fmt(netMonthly)}</div></div>
  <div class="card"><div class="k">Effective rate</div><div class="v">${pct(c.effectiveRate)}</div></div>
</div>

<h2>The four deductions</h2>
<table>
<thead><tr><th>Item</th><th class="num">Per year</th><th class="num">Per month</th></tr></thead>
<tbody>
<tr><td>Gross</td><td class="num">${fmt(amount)}</td><td class="num">${fmt(amount / 12)}</td></tr>
<tr><td>Federal income tax</td><td class="num">−${fmt(c.federalTax)}</td><td class="num">−${fmt(c.federalTax / 12)}</td></tr>
<tr><td>${esc(st.name)} income tax</td><td class="num">${c.stateTax === 0 ? "0" : "−" + fmt(c.stateTax)}</td><td class="num">${c.stateTax === 0 ? "0" : "−" + fmt(c.stateTax / 12)}</td></tr>
<tr><td>Social Security + Medicare</td><td class="num">−${fmt(c.fica)}</td><td class="num">−${fmt(c.fica / 12)}</td></tr>
<tr><td><strong>Take-home</strong></td><td class="num"><strong>${fmt(c.net)}</strong></td><td class="num"><strong>${fmt(netMonthly)}</strong></td></tr>
</tbody></table>
<div class="note">${
  st.type === "none"
    ? `${esc(st.name)} is one of ${NO_TAX_STATES.length} states with no wage income tax, so this figure is identical in ${NO_TAX_STATES.filter((x) => x !== code).map((x) => params.states[x].name).join(", ")}. The comparison that matters is against a state that does tax wages: California on the same salary nets ${fmt(computePaycheck(params, amount, "CA", "single").net)}.`
    : `The same $${amount.toLocaleString("en-US")} in Texas, which has no wage income tax, nets ${fmt(tx.net)} — ${c.net >= tx.net ? `${fmt(c.net - tx.net)} more` : `${fmt(tx.net - c.net)} less`} than ${esc(st.name)}.`
}</div>

<h2>What ${fmt(amount)} buys at ${esc(st.name)} tax rates</h2>
<p>Two identical gross salaries, two states. The difference below is entirely the state line:</p>
<table>
<thead><tr><th>At ${fmt(amount)}</th><th class="num">${esc(st.name)}</th><th class="num">California</th><th class="num">Difference</th></tr></thead>
<tbody>
<tr><td>State income tax</td><td class="num">${c.stateTax === 0 ? "$0" : fmt(c.stateTax)}</td><td class="num">${fmt(computePaycheck(params, amount, "CA", "single").stateTax)}</td><td class="num">${fmt(computePaycheck(params, amount, "CA", "single").stateTax - c.stateTax)}</td></tr>
<tr><td>Take-home</td><td class="num">${fmt(c.net)}</td><td class="num">${fmt(computePaycheck(params, amount, "CA", "single").net)}</td><td class="num">${fmt(c.net - computePaycheck(params, amount, "CA", "single").net)}</td></tr>
<tr><td>Monthly</td><td class="num">${fmt(c.net / 12)}</td><td class="num">${fmt(computePaycheck(params, amount, "CA", "single").net / 12)}</td><td class="num">${fmt((c.net - computePaycheck(params, amount, "CA", "single").net) / 12)}</td></tr>
</tbody></table>

<h2>Where this salary sits in ${esc(st.name)}</h2>
<p>You keep ${pct(c.net / amount)} of gross. Your top federal bracket is ${pct(pos.fedRate)}${st.type === "brackets" && pos.stRate ? `, and the state bracket at this income is ${pct(pos.stRate)}` : st.type === "none" ? " and there is no state bracket" : ` and the state rate is a flat ${pct(st.rate)}`}. ${d ? `That ${fmt(amount)} gross is ${(amount / d.median * 100).toFixed(0)}% of ${esc(st.name)}'s ${fmt(d.median)} median household income.` : ""}</p>
<table>
<thead><tr><th>Monthly budget at ${fmt(netMonthly)} net</th><th class="num">50/30/20 rule</th></tr></thead>
<tbody>
<tr><td>Needs</td><td class="num">${fmt(netMonthly * 0.5)}</td></tr>
<tr><td>Wants</td><td class="num">${fmt(netMonthly * 0.3)}</td></tr>
<tr><td>Savings or debt</td><td class="num">${fmt(netMonthly * 0.2)}</td></tr>
</tbody></table>

${adsSlot()}
<h2>How ${fmt(amount)} is taxed band by band</h2>
<p>Federal tax applies only to the income inside each band, so the effective rate stays below the marginal one. After the ${fmt(params.federal.standard_deduction.single)} standard deduction:</p>
<table>
<thead><tr><th>Band</th><th class="num">Rate</th><th class="num">Income in band</th><th class="num">Tax</th></tr></thead>
<tbody>
${(() => {
  let floor = 0;
  const taxable = Math.max(0, amount - params.federal.standard_deduction.single);
  return params.federal.brackets.single.map((b) => {
    const top = b.up_to === null ? Infinity : b.up_to;
    const slice = Math.max(0, Math.min(taxable, top) - floor);
    const out = slice > 0 ? `<tr><td>${fmt(floor)} – ${b.up_to === null ? "above" : fmt(b.up_to)}</td><td class="num">${pct(b.rate)}</td><td class="num">${fmt(slice)}</td><td class="num">${fmt(slice * b.rate)}</td></tr>` : "";
    floor = top;
    return out;
  }).join("");
})()}
</tbody></table>
<p>Federal income tax at this gross: <strong>${fmt(c.federalTax)}</strong> (${pct(c.federalTax / amount)} of gross). ${st.type === "none" ? `${esc(st.name)} adds nothing on top.` : `${esc(st.name)} adds ${fmt(c.stateTax)}.`} FICA is ${fmt(c.fica)}.</p>
${uniqueFactsBlock({ gross: amount, state: code })}
${stateSpecificBlock(code, amount)}

<h2>Other states at $${amount.toLocaleString("en-US")}</h2>
<ul class="links">
${SALARY_STATES.filter((x) => x !== code)
  .map((x) => `<li><a href="/${amount}-a-year-after-taxes-in-${stateSlug(x)}/">${esc(params.states[x].name)}</a></li>`)
  .join("\n")}
</ul>
<p><a href="/${amount}-a-year-after-taxes/">Back to $${amount.toLocaleString("en-US")} after taxes</a></p>

${calculatorBlock({ defaultGross: amount, state: code, heading: "Recalculate" })}
`,
    }),
  };
}

const TODAY = new Date(process.env.BUILD_DATE || Date.now());

function payPeriodPages() {
  const out = [];
  const year = 2026;
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dec31 = new Date(Date.UTC(year, 11, 31));
  const startToday = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate()));

  const schedules = {
    weekly: { days: 7, label: "weekly", name: "Weekly" },
    biweekly: { days: 14, label: "biweekly", name: "Biweekly" },
    semimonthly: { days: null, label: "semimonthly", name: "Semi-monthly" },
    monthly: { days: null, label: "monthly", name: "Monthly" },
  };

  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const fmtDate = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

  for (const [key, sched] of Object.entries(schedules)) {
    let dates = [];
    if (sched.days) {
      for (let d = new Date(jan1); d <= dec31; d = addDays(d, sched.days)) dates.push(new Date(d));
    } else if (key === "semimonthly") {
      for (let m = 0; m < 12; m++) {
        dates.push(new Date(Date.UTC(year, m, 15)));
        dates.push(new Date(Date.UTC(year, m + 1, 0)));
      }
    } else {
      for (let m = 0; m < 12; m++) dates.push(new Date(Date.UTC(year, m + 1, 0)));
    }
    dates = dates.filter((d) => d >= jan1 && d <= dec31).sort((a, b) => a - b);
    const remaining = dates.filter((d) => d >= startToday);
    const next3 = remaining.slice(0, 3);
    const perYear = dates.length;
    const perCheck = 1000;
    const slug = `/how-many-${sched.label}-paychecks-in-${year}/`;
    const title = `How Many ${sched.name} Paychecks in ${year}? ${perYear} Paydays`;
    const desc = `A ${sched.label} pay schedule produces ${perYear} paychecks in ${year}. See every payday, how many are left from ${fmtDate(startToday)}, and what each one is worth after tax.`;

    out.push({
      slug,
      html: layout({
        title,
        desc,
        slug,
        breadcrumb: [{ name: "Home", href: "/" }, { name: `${sched.name} paychecks ${year}`, href: slug }],
        faq: [
          {
            q: `How many ${sched.label} paychecks are there in ${year}?`,
            a: `${perYear}. A ${sched.label} schedule in ${year} runs from January 1 to December 31 and produces that many paydays.`,
          },
          {
            q: `How many ${sched.label} paychecks are left in ${year}?`,
            a: `${remaining.length}, counting from ${fmtDate(startToday)}. The next one is ${next3.length ? fmtDate(next3[0]) : "none — the year\u2019s schedule has ended"}.`,
          },
        ],
        body: `
<p class="crumb"><a href="/">Home</a> › ${sched.name} paychecks</p>
<h1>How Many ${sched.name} Paychecks in ${year}?</h1>
<p class="lede">A ${sched.label} pay schedule produces <strong>${perYear} paychecks</strong> in ${year}. From ${fmtDate(startToday)} there are <strong>${remaining.length} left</strong>${next3.length ? `, and the next one falls on ${fmtDate(next3[0])}` : ""}.</p>
<div class="grid3">
  <div class="card"><div class="k">Paychecks in ${year}</div><div class="v">${perYear}</div></div>
  <div class="card"><div class="k">Left this year</div><div class="v">${remaining.length}</div></div>
  <div class="card"><div class="k">Next payday</div><div class="v" style="font-size:16px">${next3.length ? fmtDate(next3[0]) : "—"}</div></div>
</div>

<h2>What each paycheck is worth at different salaries</h2>
<p>The number of paydays is the same whatever you earn; the size of each check is not. Gross per check at ${sched.label} frequency, and the after-tax figure for a single filer in California:</p>
<table>
<thead><tr><th>Annual salary</th><th class="num">Gross per check</th><th class="num">Take-home per check (CA)</th></tr></thead>
<tbody>
${[40000, 50000, 65000, 75000, 100000, 120000]
  .map((amt) => {
    const c = computePaycheck(params, amt, "CA", "single");
    return `<tr><td><a href="/${amt}-a-year-after-taxes/">$${amt.toLocaleString("en-US")}</a></td><td class="num">${usd2(amt / perYear)}</td><td class="num">${usd2(c.net / perYear)}</td></tr>`;
  })
  .join("\n")}
</tbody></table>
<p>Divide the annual figure by ${perYear}, not by 12 or 26 — the mismatch is the single most common payroll surprise. A ${sched.label} schedule in a ${perYear}-payday year means each check is ${(12 / perYear * 100).toFixed(1)}% of a month's salary on average.</p>

${adsSlot()}

<h2>Upcoming ${year} paydays</h2>
<p>The next ten ${sched.label} paydays from today:</p>
<table>
<thead><tr><th>#</th><th>Payday</th><th class="num">Days away</th></tr></thead>
<tbody>
${next3.length
  ? remaining
      .slice(0, 10)
      .map((d, i) => `<tr><td>${i + 1}</td><td>${fmtDate(d)}</td><td class="num">${Math.round((d - startToday) / 86400000)}</td></tr>`)
      .join("\n")
  : `<tr><td colspan="3">The ${year} schedule has ended. The next payday falls in ${year + 1}.</td></tr>`}
</tbody></table>

<h2>Why the count differs by year</h2>
<p>${year} starts on a ${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][jan1.getUTCDay()]}. Whether a ${sched.label} schedule produces ${perYear} checks or one more depends on where the year boundary lands relative to the payday. 52 weeks divide into ${year % 4 === 0 ? "366" : "365"} days with one or two days left over, which is why some years carry 27 checks instead of 26. The table above is computed from the actual calendar, not from a rule of thumb.</p>

<h2>Related</h2>
<ul class="links">
  <li><a href="/how-many-biweekly-paychecks-in-${year}/">Biweekly paychecks in ${year}</a></li>
  <li><a href="/how-many-weekly-paychecks-in-${year}/">Weekly paychecks in ${year}</a></li>
  <li><a href="/how-many-monthly-paychecks-in-${year}/">Monthly paychecks in ${year}</a></li>
  <li><a href="/how-many-semimonthly-paychecks-in-${year}/">Semi-monthly paychecks in ${year}</a></li>
  <li><a href="/salary-to-hourly/">Salary to hourly</a></li>
</ul>

${calculatorBlock({ defaultGross: 75000, state: "CA", heading: "Your numbers" })}
`,
      }),
    });
  }
  return out;
}

function incomeLine(gross, d, st) {
  if (!d) return "";
  const nat = ((gross / stateIncome.national.median) * 100).toFixed(0);
  const same = Math.abs(gross - d.median) < 100;
  const lead = same
    ? `That gross is the ${esc(st.name)} median household income (${fmt(d.median)}, ${stateIncome.year}), rounded to the nearest hundred.`
    : `That gross is ${((gross / d.median) * 100).toFixed(0)}% of the ${esc(st.name)} median household income (${fmt(d.median)}, ${stateIncome.year}).`;
  return `<p>${lead} It is ${nat}% of the national median household income of ${fmt(stateIncome.national.median)}.</p>`;
}

function burdenLine(pct, st, code, gross, c) {
  const tone = pct > 0.25 ? "more than a quarter" : pct < 0.18 ? "less than a fifth" : "a little under a quarter";
  const raise = computePaycheck(params, gross + 5000, code, "single").net - c.net;
  return `<p>At this level ${esc(st.name)} takes ${tone} of gross pay. A ${fmt(5000)} raise would add about ${fmt(raise)} to take-home, because the marginal rate applies only to the extra.</p>`;
}

function percentPage(code) {
  const st = params.states[code];
  const d = stateIncome.byState[st.name];
  const { gross, c, pct, fedPct, statePct, ficaPct } = stateWithholdingRate(code);
  const slug = `/what-percentage-of-paycheck-goes-to-taxes-in-${stateSlug(code)}/`;
  return {
    slug,
    html: layout({
      title: `What Percentage of a ${st.name} Paycheck Goes to Taxes?`,
      desc: `About ${pct_full(pct)} of a ${fmt(gross)} paycheck in ${st.name} goes to federal tax, state tax and FICA. See the split and what lowers it.`,
      slug,
      breadcrumb: [{ name: "Home", href: "/" }, { name: "Percent of paycheck to taxes", href: slug }],
      faq: [
        { q: `What percentage of your paycheck goes to taxes in ${st.name}?`, a: `About ${pct_full(pct)} at a ${fmt(gross)} salary: ${pct_full(fedPct)} federal, ${pct_full(statePct)} state and ${pct_full(ficaPct)} FICA.` },
        { q: `Is that percentage higher for a bigger salary?`, a: `Yes, slowly. Federal brackets are progressive, so the share rises with income while FICA stays flat at 7.65% up to the wage base.` },
      ],
      body: `
<p class="crumb"><a href="/">Home</a> › Percent of paycheck to taxes</p>
<h1>What Percentage of a ${esc(st.name)} Paycheck Goes to Taxes?</h1>
<p class="lede">At a typical ${esc(st.name)} salary of <strong>${fmt(gross)}</strong>, a single filer loses <strong>${pct_full(pct)}</strong> to taxes and keeps ${fmt(c.net)}. The percentage is not one number — it is three, and they behave differently.</p>
<div class="grid3">
  <div class="card"><div class="k">To taxes</div><div class="v">${pct_full(pct)}</div></div>
  <div class="card"><div class="k">You keep</div><div class="v">${pct_full(1 - pct)}</div></div>
  <div class="card"><div class="k">Net / month</div><div class="v">${fmt(c.net / 12)}</div></div>
</div>

<h2>The percentage, line by line</h2>
<table>
<thead><tr><th>Line</th><th class="num">Rate on gross</th><th class="num">Amount</th></tr></thead>
<tbody>
<tr><td>Federal income tax</td><td class="num">${pct_full(fedPct)}</td><td class="num">${fmt(c.federalTax)}</td></tr>
<tr><td>${esc(st.name)} income tax</td><td class="num">${pct_full(statePct)}</td><td class="num">${c.stateTax === 0 ? "$0" : fmt(c.stateTax)}</td></tr>
<tr><td>Social Security</td><td class="num">${pct_full(c.socialSecurity / gross)}</td><td class="num">${fmt(c.socialSecurity)}</td></tr>
<tr><td>Medicare</td><td class="num">${pct_full(c.medicare / gross)}</td><td class="num">${fmt(c.medicare)}</td></tr>
<tr><td><strong>Total</strong></td><td class="num"><strong>${pct_full(pct)}</strong></td><td class="num"><strong>${fmt(c.totalTax)}</strong></td></tr>
</tbody></table>
<p>Two of those lines are flat nationwide: Social Security at 6.2% and Medicare at 1.45%. The federal line is progressive, so its <em>effective</em> rate (${pct_full(fedPct)}) is well below the bracket you are in. The state line is what makes ${esc(st.name)} different from its neighbours.</p>

${adsSlot()}

<h2>How the percentage changes with income</h2>
<p>The same ${esc(st.name)} rules applied at five salary levels. Notice the share creeps up rather than jumping:</p>
<table>
<thead><tr><th>Gross salary</th><th class="num">To taxes</th><th class="num">You keep</th></tr></thead>
<tbody>
${[0.5, 0.75, 1, 1.5, 2].map((f) => {
  const g = Math.round(gross * f / 100) * 100;
  const r = computePaycheck(params, g, code, "single");
  return `<tr><td>${fmt(g)}</td><td class="num">${pct_full(r.totalTax / g)}</td><td class="num">${fmt(r.net)}</td></tr>`;
}).join("\n")}
</tbody></table>

<h2>What ${fmt(gross)} means in ${esc(st.name)}</h2>
${incomeLine(gross, d, st)}
<p>After every deduction you keep <strong>${fmt(c.net)}</strong> a year — ${fmt(c.net / 12)} a month, ${fmt(c.net / 26)} per biweekly check. Rent at the common 30%-of-gross rule would take ${fmt(gross * 0.3 / 12)} a month, leaving ${fmt(c.net / 12 - gross * 0.3 / 12)}.</p>
${burdenLine(pct, st, code, gross, c)}

<h2>How to lower the percentage</h2>
<p>Pre-tax deductions come off before federal income tax: a 401(k), a health premium or an HSA. None of them reduce FICA, so the saving is real but partial. Putting 5% of ${fmt(gross)} into a 401(k) removes ${fmt(gross * 0.05)} from the federal taxable base, roughly ${fmt(gross * 0.05 * 0.22)} of federal tax at this income. Filing jointly, a dependent-care account and the earned income credit change the result too.</p>

${calculatorBlock({ defaultGross: gross, state: code, heading: "Your numbers" })}

<h2>Related</h2>
<ul class="links">
  <li><a href="/how-much-tax-is-taken-out-of-paycheck-in-${stateSlug(code)}/">How much is taken out in ${esc(st.name)}</a></li>
  <li><a href="/paycheck-calculator/${code.toLowerCase()}/">${esc(st.name)} paycheck calculator</a></li>
  <li><a href="/what-percentage-of-paycheck-goes-to-taxes/">All states</a></li>
</ul>
`,
    }),
  };
}

function withholdingHubPage() {
  const rows = TAX_PAGE_STATES.map((c) => ({ c, name: params.states[c].name, pct: stateWithholdingRate(c).pct })).sort((a, b) => a.pct - b.pct);
  return {
    slug: "/how-much-tax-is-taken-out-of-paycheck/",
    html: layout({
      title: "How Much Tax Is Taken Out of a Paycheck? Every State",
      desc: "Paycheck withholding by state, computed at each state's median salary: federal tax, state tax and FICA, lowest to highest.",
      slug: "/how-much-tax-is-taken-out-of-paycheck/",
      breadcrumb: [{ name: "Home", href: "/" }, { name: "Tax taken out of paycheck", href: "/how-much-tax-is-taken-out-of-paycheck/" }],
      body: `
<p class="crumb"><a href="/">Home</a> › Tax taken out of a paycheck</p>
<h1>How Much Tax Is Taken Out of a Paycheck?</h1>
<p class="lede">The answer depends on the state, but less than most people expect: FICA is identical everywhere and the federal line is identical too. Only the state line moves. Each figure below is computed at that state's own median household income, so it reflects a typical local paycheck.</p>
<table>
<thead><tr><th>#</th><th>State</th><th class="num">Withheld</th><th class="num">Detail</th></tr></thead>
<tbody>
${rows.map((r, i) => `<tr><td>${i + 1}</td><td><a href="/how-much-tax-is-taken-out-of-paycheck-in-${stateSlug(r.c)}/">${esc(r.name)}</a></td><td class="num">${pct_full(r.pct)}</td><td class="num">${fmt(stateWithholdingRate(r.c).c.totalTax)}</td></tr>`).join("\n")}
</tbody></table>
<p>The range runs from ${pct_full(rows[0].pct)} to ${pct_full(rows[rows.length - 1].pct)} — about ${pct_full(rows[rows.length - 1].pct - rows[0].pct)} of gross pay between the lightest and heaviest state.</p>
<h2>Other states</h2>
<ul class="links">
${rows.slice(0, 12).map((r) => `<li><a href="/what-percentage-of-paycheck-goes-to-taxes-in-${stateSlug(r.c)}/">${esc(r.name)}</a></li>`).join("\n")}
</ul>
<p><a href="/what-percentage-of-paycheck-goes-to-taxes/">See every state →</a></p>
<p><a href="/how-much-tax-is-taken-out-of-paycheck/">The same question in dollars →</a></p>
<h2>By state, in dollars</h2>
<ul class="links">
${rows.map((r) => `<li><a href="/how-much-tax-is-taken-out-of-paycheck-in-${stateSlug(r.c)}/">${esc(r.name)}</a></li>`).join("\n")}
</ul>
<ul class="links">
</ul>
`,
    }),
  };
}

function percentageHubPage() {
  const rows = TAX_PAGE_STATES.map((c) => ({ c, name: params.states[c].name, pct: stateWithholdingRate(c).pct })).sort((a, b) => a.pct - b.pct);
  return {
    slug: "/what-percentage-of-paycheck-goes-to-taxes/",
    html: layout({
      title: "What Percentage of Your Paycheck Goes to Taxes? By State",
      desc: "The share of gross pay lost to federal tax, state tax and FICA in every state, computed at each state's median salary.",
      slug: "/what-percentage-of-paycheck-goes-to-taxes/",
      breadcrumb: [{ name: "Home", href: "/" }, { name: "Percent of paycheck", href: "/what-percentage-of-paycheck-goes-to-taxes/" }],
      body: `
<p class="crumb"><a href="/">Home</a> › Percent of paycheck to taxes</p>
<h1>What Percentage of Your Paycheck Goes to Taxes?</h1>
<p class="lede">Nationwide the figure usually lands between <strong>${pct_full(rows[0].pct)}</strong> and <strong>${pct_full(rows[rows.length - 1].pct)}</strong> for a single filer at a typical salary. FICA contributes 7.65% almost everywhere; everything above that is income tax.</p>
<table>
<thead><tr><th>#</th><th>State</th><th class="num">To taxes</th><th class="num">You keep</th></tr></thead>
<tbody>
${rows.map((r, i) => `<tr><td>${i + 1}</td><td><a href="/what-percentage-of-paycheck-goes-to-taxes-in-${stateSlug(r.c)}/">${esc(r.name)}</a></td><td class="num">${pct_full(r.pct)}</td><td class="num">${pct_full(1 - r.pct)}</td></tr>`).join("\n")}
</tbody></table>
<p><a href="/how-much-tax-is-taken-out-of-paycheck/">See the dollar amounts instead →</a></p>
`,
    }),
  };
}

function paycheckTaxDataset() {
  return TAX_PAGE_STATES.map((c) => {
    const r = stateWithholdingRate(c);
    return {
      state: params.states[c].name,
      code: c,
      medianIncome: r.gross,
      federal: Math.round(r.c.federalTax),
      stateTax: Math.round(r.c.stateTax),
      fica: Math.round(r.c.fica),
      withheld: Math.round(r.c.totalTax),
      keep: Math.round(r.c.net),
      withheldShare: +(r.pct * 100).toFixed(2),
    };
  }).sort((a, b) => a.withheldShare - b.withheldShare);
}

function dataPage() {
  const rows = paycheckTaxDataset();
  const slug = "/data/paycheck-tax-by-state/";
  const csv = ["state,code,median_income,federal_tax,state_tax,fica,total_withheld,take_home,withheld_share_pct"]
    .concat(rows.map((r) => [r.state, r.code, r.medianIncome, r.federal, r.stateTax, r.fica, r.withheld, r.keep, r.withheldShare].join(",")))
    .join("\n") + "\n";
  return {
    slug,
    csv,
    json: JSON.stringify({ generated: params.meta.generated, taxYear: params.meta.tax_year, method: "single filer, standard deduction, each state's own median household income", rows }, null, 2) + "\n",
    html: layout({
      title: "US Paycheck Tax by State, 2026 — Open Dataset",
      desc: "Withholding for federal tax, state tax and FICA in all 51 US jurisdictions, computed at each one's median income. Free CSV and JSON.",
      slug,
      breadcrumb: [{ name: "Home", href: "/" }, { name: "Open data", href: slug }],
      extraHead: jsonld({
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: "US paycheck withholding by state, 2026",
        description: "Share of gross pay withheld for federal income tax, state income tax and FICA in all 51 US jurisdictions, computed at each jurisdiction's own median household income.",
        url: SITE + slug,
        temporalCoverage: String(params.meta.tax_year),
        spatialCoverage: "United States",
        isAccessibleForFree: true,
        creator: { "@type": "Organization", name: "Paycheck Math", url: SITE + "/" },
        license: "https://creativecommons.org/licenses/by/4.0/",
        distribution: [
          { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: SITE + "/data/paycheck-tax-by-state.csv" },
          { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: SITE + "/data/paycheck-tax-by-state.json" },
        ],
        variableMeasured: ["median household income", "federal income tax", "state income tax", "FICA", "take-home pay"],
      }),
      body: `
<p class="crumb"><a href="/">Home</a> › Open data</p>
<h1>US Paycheck Tax by State — Open Dataset</h1>
<p class="lede">How much of a typical paycheck is withheld in each US jurisdiction, computed at that jurisdiction's own median household income. <strong>51 rows</strong>, one methodology, free to reuse.</p>
<div class="grid3">
  <div class="card"><div class="k">Lowest</div><div class="v">${rows[0].state} ${rows[0].withheldShare}%</div></div>
  <div class="card"><div class="k">Median of states</div><div class="v">${rows[Math.floor(rows.length / 2)].withheldShare}%</div></div>
  <div class="card"><div class="k">Highest</div><div class="v">${rows[rows.length - 1].state} ${rows[rows.length - 1].withheldShare}%</div></div>
</div>

<p><strong>Download:</strong> <a href="/data/paycheck-tax-by-state.csv">CSV</a> · <a href="/data/paycheck-tax-by-state.json">JSON</a>. Licence: reuse freely with attribution to Paycheck Math.</p>

<h2>Method</h2>
<p>For each jurisdiction: gross = its median household income from the 2023 ACS one-year estimates, rounded to the nearest $100; deductions = ${params.meta.tax_year} federal income tax after the standard deduction, that state's own wage tax, Social Security at 6.2% up to ${fmt(params.fica.ss_wage_base)} and Medicare at 1.45%. Single filer, no dependents, no pre-tax deductions. State personal exemptions and credits are excluded, so the state line is slightly overstated. That is the same engine the rest of this site uses.</p>

<h2>The dataset</h2>
<table>
<thead><tr><th>#</th><th>State</th><th class="num">Median income</th><th class="num">Withheld</th><th class="num">Share</th><th class="num">Take-home</th></tr></thead>
<tbody>
${rows.map((r, i) => `<tr><td>${i + 1}</td><td><a href="/how-much-tax-is-taken-out-of-paycheck-in-${stateSlug(r.code)}/">${esc(r.state)}</a></td><td class="num">${fmt(r.medianIncome)}</td><td class="num">${fmt(r.withheld)}</td><td class="num">${r.withheldShare}%</td><td class="num">${fmt(r.keep)}</td></tr>`).join("\n")}
</tbody></table>
<p class="byline">Generated ${params.meta.generated}. Federal source: IRS Rev. Proc. 2025-32. State source: Tax Foundation 2026 table, with 2026 changes verified against state revenue departments for GA, MS, UT, NE. Income source: ACS 2023 1-year.</p>
`,
    }),
  };
}

const TAX_PAGE_STATES = ["TX", "CA", "FL", "NY", "IL", "GA", "NJ", "MA", "WA", "MI", "NC", "TN", "OH", "PA", "AZ", "VA", "CO", "MD", "MN", "WI", "MO", "IN", "SC", "OR", "CT", "NV", "UT", "KY", "OK", "IA", "AR", "MS", "KS", "NE", "NM", "ID", "WV", "HI", "ME", "MT", "ND", "SD", "DE", "RI", "VT", "NH", "AK", "WY", "LA", "DC"];

function stateWithholdingRate(code) {
  const d = stateIncome.byState[params.states[code].name];
  const median = d && d.median ? d.median : 65000;
  const gross = Math.round(median / 100) * 100;
  const c = computePaycheck(params, gross, code, "single");
  return { gross, c, pct: c.totalTax / gross, fedPct: c.federalTax / gross, statePct: c.stateTax / gross, ficaPct: c.fica / gross };
}

function withholdingPage(code) {
  const st = params.states[code];
  const { gross, c, pct, fedPct, statePct, ficaPct } = stateWithholdingRate(code);
  const d = stateIncome.byState[st.name];
  const ranked = TAX_PAGE_STATES
    .map((x) => ({ name: params.states[x].name, pct: stateWithholdingRate(x).pct }))
    .sort((a, b) => a.pct - b.pct);
  const rank = ranked.findIndex((r) => r.name === st.name) + 1;
  const slug = `/how-much-tax-is-taken-out-of-paycheck-in-${stateSlug(code)}/`;
  return {
    slug,
    html: layout({
      title: `How Much Tax Is Taken Out of a Paycheck in ${st.name}?`,
      desc: `On a typical ${st.name} salary of ${fmt(gross)}, about ${pct_full(pct)} goes to federal tax, ${st.name} tax and FICA. See the exact dollar breakdown.`,
      slug,
      breadcrumb: [{ name: "Home", href: "/" }, { name: "Paycheck tax by state", href: slug }],
      faq: [
        { q: `How much tax is taken out of a paycheck in ${st.name}?`, a: `About ${pct_full(pct)} on a ${fmt(gross)} salary for a single filer: ${pct_full(fedPct)} federal income tax, ${statePct === 0 ? "no state income tax" : pct_full(statePct) + " " + st.name + " income tax"} and ${pct_full(ficaPct)} Social Security and Medicare.` },
        { q: `Does ${st.name} take state tax out of your paycheck?`, a: statePct === 0 ? `No. ${st.name} has no wage income tax, so only federal income tax and FICA are withheld.` : `Yes. On ${fmt(gross)} the ${st.name} withholding comes to ${fmt(c.stateTax)} a year, or about ${pct_full(statePct)}.` },
      ],
      body: `
<p class="crumb"><a href="/">Home</a> › How much tax is taken out</p>
<h1>How Much Tax Is Taken Out of a Paycheck in ${esc(st.name)}?</h1>
<p class="lede">On a typical ${esc(st.name)} salary of <strong>${fmt(gross)}</strong>, a single filer has about <strong>${pct_full(pct)}</strong> withheld: ${fmt(c.totalTax)} a year, or ${fmt(c.totalTax / 12)} a month. That ranks ${esc(st.name)} <strong>${rank} of ${ranked.length}</strong> for paycheck withholding among the states here.</p>
<div class="grid3">
  <div class="card"><div class="k">Withheld / year</div><div class="v">${fmt(c.totalTax)}</div></div>
  <div class="card"><div class="k">Share of gross</div><div class="v">${pct_full(pct)}</div></div>
  <div class="card"><div class="k">Keep / year</div><div class="v">${fmt(c.net)}</div></div>
</div>

<h2>The three things taken out</h2>
<table>
<thead><tr><th>Withholding</th><th class="num">Per year</th><th class="num">Share of gross</th></tr></thead>
<tbody>
<tr><td>Federal income tax</td><td class="num">${fmt(c.federalTax)}</td><td class="num">${pct_full(fedPct)}</td></tr>
<tr><td>${esc(st.name)} income tax</td><td class="num">${c.stateTax === 0 ? "$0" : fmt(c.stateTax)}</td><td class="num">${pct_full(statePct)}</td></tr>
<tr><td>Social Security + Medicare</td><td class="num">${fmt(c.fica)}</td><td class="num">${pct_full(ficaPct)}</td></tr>
<tr><td><strong>Total withheld</strong></td><td class="num"><strong>${fmt(c.totalTax)}</strong></td><td class="num"><strong>${pct_full(pct)}</strong></td></tr>
</tbody></table>
<p>FICA is fixed at 6.2% for Social Security up to ${fmt(params.fica.ss_wage_base)} of wages and 1.45% for Medicare, so ${pct_full(ficaPct)} is the same in every state at this salary. The part that moves is the state line.</p>

${adsSlot()}

<h2>Where ${esc(st.name)} sits</h2>
<p>${esc(st.name)} ranks <strong>${rank} of ${ranked.length}</strong> on paycheck withholding. The states immediately around it:
${ranked.slice(Math.max(0, rank - 3), rank + 2).filter((r) => r.name !== st.name).map((r) => `${esc(r.name)} at ${pct_full(r.pct)}`).join(", ")}.</p>
<p>The lightest state measured here is ${esc(ranked[0].name)} at ${pct_full(ranked[0].pct)}; the heaviest is ${esc(ranked[ranked.length - 1].name)} at ${pct_full(ranked[ranked.length - 1].pct)}. ${esc(st.name)} sits ${pct_full(pct - ranked[0].pct)} above the lightest and ${pct_full(ranked[ranked.length - 1].pct - pct)} below the heaviest.</p>
<p>${d ? `The salary used here, ${fmt(gross)}, is ${esc(st.name)}'s median household income from ${stateIncome.year} — so this is what a typical local earner sees, not what a national average salary would produce in ${esc(st.name)}.` : ""}</p>

<h2>What actually changes your number</h2>
<p>Three things move withholding more than the state does: filing status, pre-tax deductions and additional income. A 401(k) contribution comes out before federal income tax, so putting in 5% lowers the federal line without lowering the FICA line. Filing jointly widens the federal brackets, which is why two similar salaries can withhold very differently.</p>
<p class="byline">Computed with ${params.meta.tax_year} federal brackets, the ${fmt(params.fica.ss_wage_base)} Social Security wage base, and ${esc(st.name)}'s published rate${st.bracketYear === 2025 ? " (2025 bracket widths — 2026 not yet published)" : ""}. Estimate only, not tax advice.</p>

${calculatorBlock({ defaultGross: gross, state: code, heading: "Your own paycheck" })}

<h2>Related</h2>
<ul class="links">
  ${SALARY_STATES.includes(code) && SALARY_STATE_VALUES.includes(Math.round(gross / 1000) * 1000) ? `<li><a href="/${Math.round(gross / 1000) * 1000}-a-year-after-taxes-in-${stateSlug(code)}/">${fmt(Math.round(gross / 1000) * 1000)} after taxes in ${esc(st.name)}</a></li>` : ""}
  <li><a href="/paycheck-calculator/${code.toLowerCase()}/">${esc(st.name)} paycheck calculator</a></li>
  <li><a href="/what-percentage-of-paycheck-goes-to-taxes-in-${stateSlug(code)}/">What percentage of a ${esc(st.name)} paycheck goes to taxes</a></li>
  <li><a href="/how-much-tax-is-taken-out-of-paycheck/">All states</a></li>
</ul>
`,
    }),
  };
}

function pct_full(x) {
  return (x * 100).toFixed(1) + "%";
}

/* ── assemble ──/* ── assemble ──/* ── assemble ──/* ── assemble ────────────────────────────────────────────────────────── */

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

pages.push(
  hubPage({
    slug: "/hourly-after-taxes/",
    h1: "Hourly pay after taxes",
    lede: "What an hourly wage actually pays after federal income tax, state tax and FICA — 40 hours a week, 52 weeks a year.",
    items: HOURLY.filter((r) => r >= 10 && Number.isInteger(r)).map((r) => ({ href: `/${r}-an-hour-after-taxes/`, label: `$${r} an hour after taxes` })),
    title: "Hourly Pay After Taxes — take-home per hour",
    desc: "Take-home pay for hourly wages from $10 to $100 an hour, with federal tax, state tax and FICA per hour, week and month.",
  })
);

pages.push({
  slug: "/hourly-after-taxes-by-state/",
  html: layout({
    title: "Hourly Pay After Taxes by State — Six Taxing States",
    desc: "Take-home pay per hour in California, New York, Illinois, New Jersey, Georgia and Massachusetts, from $10 to $100 an hour.",
    slug: "/hourly-after-taxes-by-state/",
    breadcrumb: [{ name: "Home", href: "/" }, { name: "Hourly after taxes by state", href: "/hourly-after-taxes-by-state/" }],
    body: `
<p class="crumb"><a href="/">Home</a> › Hourly after taxes by state</p>
<h1>Hourly Pay After Taxes, by State</h1>
<p class="lede">The same hourly wage lands differently depending on where you work. Nine states take no wage income tax and share one figure; the six below tax wages in different ways, so each has its own numbers.</p>
${["CA", "NY", "IL", "NJ", "GA", "MA"]
  .map(
    (code) => `<h2>${esc(params.states[code].name)}</h2>
<ul class="links">
${HOURLY.filter((r) => r >= 10 && Number.isInteger(r))
  .map((r) => `<li><a href="/${r}-an-hour-after-taxes-in-${stateSlug(code)}/">$${r} an hour</a></li>`)
  .join("\\n")}
</ul>`
  )
  .join("\\n")}
<p><a href="/hourly-after-taxes/">All hourly after-tax pages →</a> · <a href="/paycheck-calculator/">Paycheck calculator by state →</a></p>
`,
  }),
});

for (const r of HOURLY) pages.push(hourlyPage(r));
for (const s of SALARIES) pages.push(salaryPage(s));
for (const s of SALARIES) pages.push(afterTaxPage(s));
for (const c of STATE_CODES) pages.push(statePage(c));

const HOURLY_TAX = HOURLY.filter((r) => r >= 10 && Number.isInteger(r));
for (const r of HOURLY_TAX) pages.push(hourlyAfterTaxPage(r));
for (const code of ["CA", "NY", "IL", "NJ", "GA", "MA"]) {
  for (const r of HOURLY_TAX) pages.push(hourlyStatePage(r, code));
}
for (const s of GOOD_SALARIES) pages.push(goodSalaryPage(s));
for (const amount of SALARY_STATE_VALUES) for (const code of SALARY_STATES) pages.push(salaryStatePage(amount, code));
pages.push(...payPeriodPages());
for (const code of TAX_PAGE_STATES) {
  pages.push(withholdingPage(code));
  pages.push(percentPage(code));
}
pages.push(withholdingHubPage(), percentageHubPage());
const dataAsset = dataPage();
pages.push(dataAsset);

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

const robots = `# Paycheck Math — search and AI crawler policy
# Search engines: allow everything. AI assistants: allow, because being quoted with a source
# is how this site earns traffic. Training-only crawlers are allowed too; there is no
# proprietary content here, only computed public data.

User-agent: *
Allow: /

# AI search and citation crawlers (explicitly welcome)
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: CCBot
Allow: /

# Sitemap
Sitemap: ${SITE}/sitemap-index.xml

# Machine-readable entry points
# llms.txt:      ${SITE}/llms.txt
# openapi.json:  ${SITE}/openapi.json
# dataset:       ${SITE}/data/paycheck-tax-by-state.json
`;

const MD_PAGES = [
  { slug: "/", file: "index.md" },
  { slug: "/methodology/", file: "methodology.md" },
  { slug: "/how-much-tax-is-taken-out-of-paycheck/", file: "how-much-tax-is-taken-out-of-paycheck.md" },
  { slug: "/what-percentage-of-paycheck-goes-to-taxes/", file: "what-percentage-of-paycheck-goes-to-taxes.md" },
  { slug: "/data/paycheck-tax-by-state/", file: "paycheck-tax-by-state.md" },
  { slug: "/paycheck-calculator/", file: "paycheck-calculator.md" },
  { slug: "/salary-to-hourly/", file: "salary-to-hourly.md" },
  { slug: "/after-taxes/", file: "after-taxes.md" },
];

function htmlToMarkdown(html) {
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  return main
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<nav[\s\S]*?<\/nav>/g, "")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, "\n### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/g, "- $1\n")
    .replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (m, inner) => {
      const rows = [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
        .map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()))
        .filter((r) => r.length);
      if (!rows.length) return "";
      const width = Math.max(...rows.map((r) => r.length));
      const line = (r) => "| " + r.concat(Array(width - r.length).fill("")).join(" | ") + " |";
      return "\n\n" + line(rows[0]) + "\n|" + Array(width).fill("---").join("|") + "|\n" + rows.slice(1).map(line).join("\n") + "\n\n";
    })
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, "[$2]($1)")
    .replace(/<[^>]+>/g, " ")
    .replace(/&minus;/g, "-").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function writeMarkdownPages() {
  for (const page of MD_PAGES) {
    const built = pages.find((x) => x.slug === page.slug);
    if (!built) continue;
    const url = SITE + page.slug;
    const front = `# Paycheck Math\n\n> Machine-readable version of ${url}\n> Generated ${params.meta.generated}. Rates: ${params.meta.tax_year} federal (IRS Rev. Proc. 2025-32), FICA wage base ${fmt(params.fica.ss_wage_base)}, state tables from the Tax Foundation 2026 table with verified 2026 overrides.\n\n`;
    files.set(path.join(OUT, BASE_PATH, page.file), front + htmlToMarkdown(built.html) + "\n");
  }
}
const llms = `# Paycheck Math

> Free salary, hourly and take-home pay calculators for the United States. Every figure is
> computed from published rates: ${params.meta.tax_year} federal brackets (IRS Rev. Proc. 2025-32),
> FICA with a ${fmt(params.fica.ss_wage_base)} Social Security wage base, and state rules from the Tax
> Foundation 2026 table with 2026 changes verified against state revenue departments.

## What this site answers

- How much an hourly wage is per year, and what it is worth after tax
- What a salary is per hour, per month and per biweekly check
- How much tax is taken out of a paycheck, by state
- What percentage of a paycheck goes to taxes, by state
- How many weekly / biweekly / semi-monthly / monthly paychecks fall in ${TODAY.getUTCFullYear()}
- Take-home pay in every state, at that state's own median income

## Core pages
- ${SITE}/ — calculators and the entry point
- ${SITE}/paycheck-calculator/ — take-home pay by state
- ${SITE}/how-much-tax-is-taken-out-of-paycheck/ — withholding by state, dollars
- ${SITE}/what-percentage-of-paycheck-goes-to-taxes/ — withholding by state, percentage
- ${SITE}/salary-to-hourly/ and ${SITE}/hourly-to-salary/ — conversion tables
- ${SITE}/after-taxes/ — salary after tax
- ${SITE}/methodology/ — every rate and its source

## Data and machine-readable endpoints
- ${SITE}/data/paycheck-tax-by-state/ — open dataset, 51 jurisdictions
- ${SITE}/data/paycheck-tax-by-state.csv — CSV
- ${SITE}/data/paycheck-tax-by-state.json — JSON
- ${SITE}/openapi.json — OpenAPI 3.1 description of the data endpoints
- ${SITE}/assets/tax-params.json — the exact rate table the engine uses

## Key facts an answer should quote
- Federal standard deduction ${params.meta.tax_year}: ${fmt(params.federal.standard_deduction.single)} single,
  ${fmt(params.federal.standard_deduction.married)} married, ${fmt(params.federal.standard_deduction.hoh)} head of household.
- FICA: Social Security ${pct(params.fica.ss_rate)} up to ${fmt(params.fica.ss_wage_base)}; Medicare ${pct(params.fica.medicare_rate)}
  plus ${pct(params.fica.additional_medicare_rate)} above ${fmt(params.fica.additional_threshold.single)} (single).
- ${NO_TAX_STATES.length} jurisdictions have no wage income tax: ${NO_TAX_STATES.map((c) => params.states[c].name).join(", ")}.
- Six states still use 2025 bracket widths because 2026 was unpublished at compile time, and their
  pages say so: Arkansas, California, Idaho, Massachusetts, North Dakota, Vermont.

## Markdown versions of the main pages
${MD_PAGES.map((m) => `- ${SITE}/${m.file}`).join("\n")}

## Attribution
Reuse the data with credit to Paycheck Math and a link to the dataset page. Estimates only; not tax advice.
`;

/* write or check */

const write = !process.argv.includes("--check");
const files = new Map();
for (const p of pages) {
  if (p.slug === "/404.html") {
    files.set(path.join(OUT, BASE_PATH, "404.html"), p.html);
    continue;
  }
  const dir = path.join(OUT, BASE_PATH, p.slug === "/" ? "" : p.slug);
  const file = path.join(dir, "index.html");
  files.set(file, p.html);
}
files.set(path.join(OUT, BASE_PATH, "sitemap.xml"), sitemap);
files.set(path.join(OUT, BASE_PATH, "sitemap-index.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE}/sitemap.xml</loc><lastmod>${params.meta.generated}</lastmod></sitemap>
</sitemapindex>
`);
files.set(path.join(OUT, BASE_PATH, "robots.txt"), robots);
files.set(path.join(OUT, BASE_PATH, "llms.txt"), llms);
const apiSpec = JSON.stringify({
  openapi: "3.1.0",
  info: {
    title: "Paycheck Math take-home pay API",
    version: String(params.meta.tax_year),
    description: "Compute US take-home pay from gross salary, state and filing status. Every rate is the one published on the site; see /methodology/.",
    license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  },
  servers: [{ url: SITE }],
  paths: {
    "/assets/tax-params.json": {
      get: {
        operationId: "getTaxParams",
        summary: "Every federal bracket, FICA rate and state rule the engine uses",
        responses: { "200": { description: "Tax parameter table", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/data/paycheck-tax-by-state.json": {
      get: {
        operationId: "getPaycheckTaxByState",
        summary: "Withholding and take-home for all 51 jurisdictions at each one's median income",
        responses: {
          "200": {
            description: "51 rows",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    taxYear: { type: "integer" },
                    rows: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          state: { type: "string" },
                          code: { type: "string" },
                          medianIncome: { type: "integer" },
                          withheld: { type: "integer" },
                          keep: { type: "integer" },
                          withheldShare: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "x-calculation": {
    formula: "net = gross - federalTax - stateTax - socialSecurity - medicare",
    federalTax: "progressive brackets from /assets/tax-params.json applied to (gross - standard deduction)",
    socialSecurity: "0.062 * min(gross, wageBase)",
    medicare: "0.0145 * gross (+0.009 above the additional threshold)",
  },
}, null, 2) + "\n";
files.set(path.join(OUT, BASE_PATH, "openapi.json"), apiSpec);
writeMarkdownPages();


files.set(path.join(OUT, BASE_PATH, "data/paycheck-tax-by-state.csv"), dataAsset.csv);
files.set(path.join(OUT, BASE_PATH, "data/paycheck-tax-by-state.json"), dataAsset.json);
files.set(path.join(OUT, BASE_PATH, "d3b27220b2e09fc3488db3f7724ae3cc.txt"), "d3b27220b2e09fc3488db3f7724ae3cc\n");
files.set(path.join(OUT, BASE_PATH, "assets/style.css"), css);
files.set(path.join(OUT, BASE_PATH, "assets/calc.js"), calcJs);
files.set(path.join(OUT, BASE_PATH, "assets/tax.mjs"), taxJs);
files.set(path.join(OUT, BASE_PATH, "assets/tax-params.json"), JSON.stringify(params));

const keep = new Set(files.keys());
let pruned = 0;
if (write && fs.existsSync(OUT)) {
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
      } else if (!keep.has(full)) {
        fs.unlinkSync(full);
        pruned++;
      }
    }
  };
  walk(OUT);
}

const HUB_SLUGS = new Set(["/", "/paycheck-calculator/", "/salary-to-hourly/", "/hourly-to-salary/", "/after-taxes/", "/hourly-after-taxes/", "/how-much-tax-is-taken-out-of-paycheck/", "/what-percentage-of-paycheck-goes-to-taxes/", "/methodology/", "/data/paycheck-tax-by-state/"]);
for (const [file, content] of files) {
  if (!file.endsWith(".html")) continue;
  const slug = "/" + path.relative(path.join(OUT, BASE_PATH), path.dirname(file)).split(path.sep).join("/") + (path.dirname(file).endsWith(BASE_PATH) ? "/" : "/");
  const norm = slug === "/" ? "/" : slug;
  const nav = HUB_SLUGS.has(norm) || HUB_SLUGS.has(norm.replace(/\/$/, "/")) ? CLUSTER_NAV : "";
  files.set(file, prefixAssets(content.replace("@@CRITICAL_CSS@@", css).replace("CLUSTER_NAV_PLACEHOLDER_MARKER", nav)));
}

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
  const html = prefixAssets(p.html);
  const hrefs = [...html.matchAll(/href="(\/[^"#?]*)"/g)];
  for (const m of hrefs) {
    let h = m[1];
    if (BASE_PATH && h.startsWith(BASE_PATH + "/")) h = h.slice(BASE_PATH.length);
    if (h.startsWith("/assets/") || h.startsWith("/data/")) continue;
    if (!slugs.has(h)) bad.push(`${p.slug} -> ${m[1]}`);
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
  console.log(`Built ${pages.length} pages into public/ (${files.size} files, ${bad.length} broken links, ${pruned} stale pruned)`);
}
