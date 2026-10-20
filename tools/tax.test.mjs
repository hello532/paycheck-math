import assert from "node:assert/strict";
import fs from "node:fs";
import { computePaycheck, bracketTax, annualFromHourly } from "../src/tax.mjs";

const tax = JSON.parse(fs.readFileSync(new URL("../data/tax_params.json", import.meta.url), "utf8"));
let passed = 0;
const t = (name, fn) => {
  fn();
  passed++;
  console.log("ok  " + name);
};

t("federal tax on $65,000 single = $5,620 (2026 table, hand-checked)", () => {
  const c = computePaycheck(tax, 65000, "CA", "single");
  assert.ok(Math.abs(c.federalTax - 5620) < 0.01, String(c.federalTax));
});

t("bracket boundary is exact: first band stops at $12,400 taxable", () => {
  assert.ok(Math.abs(bracketTax(12400, tax.federal.brackets.single) - 1240) < 0.001);
  assert.ok(bracketTax(12401, tax.federal.brackets.single) > 1240);
});

t("zero and negative income produce no tax", () => {
  assert.equal(bracketTax(0, tax.federal.brackets.single), 0);
  assert.equal(computePaycheck(tax, 0, "CA", "single").totalTax, 0);
});

t("Social Security stops at the wage base", () => {
  const c = computePaycheck(tax, 400000, "TX", "single");
  assert.ok(Math.abs(c.socialSecurity - tax.fica.ss_wage_base * tax.fica.ss_rate) < 0.01);
});

t("additional Medicare applies above the threshold only", () => {
  const under = computePaycheck(tax, 200000, "TX", "single");
  const over = computePaycheck(tax, 300000, "TX", "single");
  assert.ok(Math.abs(under.medicare - 200000 * 0.0145) < 0.01);
  assert.ok(Math.abs(over.medicare - (300000 * 0.0145 + 100000 * 0.009)) < 0.01);
});

t("Washington has no wage income tax (capital gains only)", () => {
  const c = computePaycheck(tax, 75000, "WA", "single");
  assert.equal(c.stateTax, 0);
  assert.equal(tax.states.WA.note.includes("capital gains"), true);
});

t("no-tax states all produce zero state tax", () => {
  for (const [code, st] of Object.entries(tax.states)) {
    if (st.type !== "none") continue;
    assert.equal(computePaycheck(tax, 120000, code, "single").stateTax, 0, code);
  }
});

t("flat-rate states apply their rate with no brackets", () => {
  for (const [code, st] of Object.entries(tax.states)) {
    if (st.type !== "flat") continue;
    assert.equal(st.brackets, undefined, code);
    assert.ok(st.rate > 0 && st.rate < 0.2, code + " " + st.rate);
  }
});

t("bracket states are monotonic and end at infinity", () => {
  for (const [code, st] of Object.entries(tax.states)) {
    if (st.type !== "brackets") continue;
    const b = st.brackets;
    assert.equal(b[b.length - 1].up_to, null, code);
    for (let i = 1; i < b.length; i++) {
      assert.ok(b[i].up_to === null || b[i].up_to > b[i - 1].up_to, code + " ordering");
      assert.ok(b[i].rate >= b[i - 1].rate - 1e-9, code + " rate monotonic");
    }
  }
});

t("every state has a name and all 51 jurisdictions are present", () => {
  assert.equal(Object.keys(tax.states).length, 51);
  for (const [code, st] of Object.entries(tax.states)) {
    assert.equal(st.name.length > 2, true, code);
    assert.ok(["none", "flat", "brackets"].includes(st.type), code);
  }
});

t("take-home equals gross minus every deduction", () => {
  for (const code of ["CA", "TX", "NY", "WA", "IL"]) {
    const c = computePaycheck(tax, 88000, code, "single");
    const sum = c.federalTax + c.stateTax + c.socialSecurity + c.medicare;
    assert.ok(Math.abs(c.totalTax - sum) < 0.01, code);
    assert.ok(Math.abs(c.net + c.totalTax - c.gross) < 0.01, code);
  }
});

t("hourly to annual uses 2,080 hours", () => {
  assert.equal(annualFromHourly(25, 40), 52000);
  assert.equal(annualFromHourly(25, 20), 26000);
});

t("married filing jointly pays less than single at the same gross", () => {
  const s = computePaycheck(tax, 120000, "TX", "single");
  const m = computePaycheck(tax, 120000, "TX", "married");
  assert.ok(m.federalTax < s.federalTax);
});

t("progressive states have a lower effective rate than the top bracket", () => {
  const c = computePaycheck(tax, 75000, "CA", "single");
  assert.ok(c.effectiveRate < 0.37);
  assert.ok(c.effectiveRate > 0.05);
});

console.log(`\n${passed} tests passed`);
