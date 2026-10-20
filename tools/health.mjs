import { execFileSync } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.SITE_ORIGIN || "https://paycheck-math.pages.dev";
const report = { base: BASE, date: new Date().toISOString().slice(0, 10), checks: [], failures: [] };

function check(name, ok, detail) {
  report.checks.push({ name, ok, detail });
  if (!ok) report.failures.push(`${name}: ${detail}`);
}

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check("sitemap urls", urls.length > 700, `${urls.length} urls`);
check("sitemap host", urls.every((u) => u.startsWith(BASE + "/")), "all urls on the live host");

const sample = [...urls.slice(0, 25), ...urls.slice(Math.floor(urls.length / 2) - 12, Math.floor(urls.length / 2) + 12), ...urls.slice(-25)];
const statuses = await Promise.all(sample.map(async (u) => ({ u, s: (await fetch(u, { method: "HEAD" })).status })));
const bad = statuses.filter((x) => x.s !== 200);
check("sampled pages 200", bad.length === 0, bad.slice(0, 3).map((b) => `${b.u} ${b.s}`).join(", ") || `${statuses.length} ok`);

const notFound = await fetch(`${BASE}/definitely-not-a-page-${Date.now()}/`);
check("unknown url returns 404", notFound.status === 404, String(notFound.status));

const home = await (await fetch(`${BASE}/`)).text();
const canonical = home.match(/rel="canonical" href="([^"]+)/)?.[1];
check("canonical on live host", canonical === `${BASE}/`, String(canonical));
check("title under 60", (home.match(/<title>([^<]*)/)?.[1] ?? "").length <= 60, String((home.match(/<title>([^<]*)/)?.[1] ?? "").length));
check("meta description under 160", (home.match(/name="description" content="([^"]*)/)?.[1] ?? "").length <= 160, "");
check("json-ld present", home.includes("application/ld+json"), "");
check("robots points to sitemap", (await (await fetch(`${BASE}/robots.txt`)).text()).includes(`${BASE}/sitemap.xml`), "");

const statePageHtml = await (await fetch(`${BASE}/paycheck-calculator/tx/`)).text();
check("state page has no NaN or undefined", !/NaN|undefined|\[object Object\]/.test(statePageHtml), "");
check("state page sample salary differs by state", await (async () => {
  const fl = await (await fetch(`${BASE}/paycheck-calculator/fl/`)).text();
  const sampleOf = (h) => (h.match(/On a \$([\d,]+) salary/) || [])[1];
  return sampleOf(statePageHtml) !== sampleOf(fl) && !!sampleOf(statePageHtml);
})(), "");

const tax = JSON.parse(fs.readFileSync(new URL("../data/tax_params.json", import.meta.url), "utf8"));
const { computePaycheck } = await import("../src/tax.mjs");
const c = computePaycheck(tax, 65000, "CA", "single");
check("engine federal tax 65k CA single = 5620", Math.abs(c.federalTax - 5620) < 0.01, c.federalTax.toFixed(2));
check("Washington has no wage tax", computePaycheck(tax, 75000, "WA", "single").stateTax === 0, "");
check("engine SS capped at wage base", Math.abs(computePaycheck(tax, 400000, "TX", "single").socialSecurity - tax.fica.ss_wage_base * tax.fica.ss_rate) < 0.01, "");
check("all 51 jurisdictions present", Object.keys(tax.states).length === 51, String(Object.keys(tax.states).length));

fs.writeFileSync(new URL("../health.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(`${report.checks.length - report.failures.length}/${report.checks.length} checks passed`);
if (report.failures.length) {
  for (const f of report.failures) console.error("FAIL " + f);
  process.exitCode = 1;
}
