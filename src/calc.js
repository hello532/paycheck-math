import { computePaycheck } from "/assets/tax.mjs";

const $ = (id) => document.getElementById(id);
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const money2 = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => (n * 100).toFixed(1) + "%";

let params = null;
const grossEl = $("gross");
const stateEl = $("state");
const filingEl = $("filing");
const outEl = $("out");
const goEl = $("go");

function render() {
  if (!params || !grossEl) return;
  const gross = parseFloat(grossEl.value) || 0;
  const r = computePaycheck(params, gross, stateEl.value, filingEl.value);
  const rows = [
    ["Federal income tax", r.federalTax],
    [r.stateName + " income tax", r.stateTax],
    ["Social Security + Medicare", r.fica],
  ];
  outEl.innerHTML =
    '<div class="bignum"><small>Annual take-home</small>' + money(r.net) + "</div>" +
    '<div class="grid3">' +
    '<div class="card"><div class="k">Monthly</div><div class="v">' + money(r.net / 12) + "</div></div>" +
    '<div class="card"><div class="k">Biweekly</div><div class="v">' + money(r.net / 26) + "</div></div>" +
    '<div class="card"><div class="k">Effective rate</div><div class="v">' + pct(r.effectiveRate) + "</div></div>" +
    "</div>" +
    "<table><thead><tr><th>Deduction</th><th class=\"num\">Per year</th><th class=\"num\">Per month</th></tr></thead><tbody>" +
    "<tr><td>Gross pay</td><td class=\"num\">" + money(r.gross) + "</td><td class=\"num\">" + money(r.gross / 12) + "</td></tr>" +
    rows.map((x) =>
      "<tr><td>" + x[0] + "</td><td class=\"num\">&minus;" + money(x[1]) + "</td><td class=\"num\">&minus;" + money(x[1] / 12) + "</td></tr>"
    ).join("") +
    "<tr><td><strong>Take-home</strong></td><td class=\"num\"><strong>" + money(r.net) + "</strong></td><td class=\"num\"><strong>" + money(r.net / 12) + "</strong></td></tr>" +
    "</tbody></table>" +
    '<p class="byline">About ' + money2(r.hourly) + " an hour after tax at 2,080 hours a year." +
    (r.stateNote ? "<br><em>" + r.stateNote + "</em>" : "") +
    "</p>";
}

// Public link contract: ?salary=&state= restores a shared calculation.
function readQuery() {
  const qs = new URLSearchParams(window.location.search);
  if (qs.get("salary")) grossEl.value = qs.get("salary");
  if (params && qs.get("state") && params.states[qs.get("state")]) stateEl.value = qs.get("state");
}

function applyAndShare() {
  render();
  const url = new URL(window.location.href);
  url.searchParams.set("salary", grossEl.value);
  url.searchParams.set("state", stateEl.value);
  window.history.replaceState(null, "", url.toString());
}

if (grossEl && outEl) {
  goEl.addEventListener("click", applyAndShare);
  [grossEl, stateEl, filingEl].forEach((el) => el.addEventListener("change", render));
  fetch("/assets/tax-params.json")
    .then((r) => r.json())
    .then((j) => {
      params = j;
      readQuery();
      render();
    })
    .catch(() => {
      outEl.textContent = "The tax table did not load. Reload the page.";
    });
}
