import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(ROOT, "../public");
const N = 5;
const LIMIT = 0.6;

function shingles(html) {
  const words =
    html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .toLowerCase()
      .match(/[a-z0-9$.,%]+/g) || [];
  const out = new Set();
  for (let i = 0; i + N <= words.length; i++) out.add(words.slice(i, i + N).join(" "));
  return out;
}

const groups = {
  "state calculators": ["paycheck-calculator"],
  "hourly after tax": [],
  "salary after tax": [],
};

function collect(dir, filter) {
  const full = path.join(BASE, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full, { withFileTypes: true })
    .filter((d) => d.isDirectory() && filter(d.name))
    .map((d) => ({ name: `${dir}/${d.name}`, html: fs.readFileSync(path.join(full, d.name, "index.html"), "utf8") }));
}

const pages = [
  ...collect("paycheck-calculator", () => true),
  ...collect("", (n) => n.endsWith("-an-hour-after-taxes")),
  ...collect("", (n) => n.endsWith("-a-year-after-taxes")),
  ...collect("", (n) => n.endsWith("-a-year-is-how-much-an-hour")),
  ...collect("", (n) => n.endsWith("-an-hour-is-how-much-a-year")),
  ...collect("", (n) => n.endsWith("-a-year-a-good-salary")),
  ...collect("", (n) => n.includes("-an-hour-after-taxes-in-")),
];

const sets = pages.map((p) => ({ name: p.name, s: shingles(p.html) }));
let worst = { v: 0, a: null, b: null };
let sum = 0;
let n = 0;
const over = [];
for (let i = 0; i < sets.length; i++) {
  for (let j = i + 1; j < sets.length; j++) {
    const A = sets[i].s;
    const B = sets[j].s;
    let inter = 0;
    for (const w of A) if (B.has(w)) inter++;
    const v = inter / (A.size + B.size - inter);
    sum += v;
    n++;
    if (v > worst.v) worst = { v, a: sets[i].name, b: sets[j].name };
    if (v > LIMIT) over.push({ v, a: sets[i].name, b: sets[j].name });
  }
}

const empty = sets.filter((x) => x.s.size < 60).map((x) => `${x.name} (${x.s.size} shingles)`);

console.log(`pages compared: ${sets.length} (${n} pairs)`);
console.log(`mean 5-gram similarity: ${(sum / n).toFixed(3)}`);
console.log(`max:  ${worst.v.toFixed(3)}  ${worst.a} vs ${worst.b}`);
if (empty.length) console.log(`thin pages (<60 shingles): ${empty.length}  ${empty.slice(0, 5).join(", ")}`);

if (over.length) {
  console.error(`\nFAIL: ${over.length} pairs above ${LIMIT}`);
  for (const o of over.slice(0, 10)) console.error(`  ${o.v.toFixed(3)}  ${o.a} vs ${o.b}`);
  process.exitCode = 1;
} else if (empty.length) {
  console.error("\nFAIL: thin pages found");
  process.exitCode = 1;
} else {
  console.log(`OK: no pair above ${LIMIT}`);
}
