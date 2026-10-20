/* UI layer: wires the calculator markup to the engine above. */
(function () {
  var params = null;
  var nodes = {
    gross: document.getElementById("gross"),
    state: document.getElementById("state"),
    filing: document.getElementById("filing"),
    out: document.getElementById("out"),
    go: document.getElementById("go"),
  };
  if (!nodes.gross || !nodes.out) return;

  function money(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }
  function money2(n) {
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(n) {
    return (n * 100).toFixed(1) + "%";
  }

  function render() {
    if (!params) return;
    var gross = parseFloat(nodes.gross.value) || 0;
    var state = nodes.state.value;
    var filing = nodes.filing.value;
    var r = computePaycheck(params, gross, state, filing);
    var rows = [
      ["Federal income tax", r.federalTax],
      [r.stateName + " income tax", r.stateTax],
      ["Social Security + Medicare", r.fica],
    ];
    nodes.out.innerHTML =
      '<div class="bignum"><small>Annual take-home</small>' + money(r.net) + "</div>" +
      '<div class="grid3">' +
      '<div class="card"><div class="k">Monthly</div><div class="v">' + money(r.net / 12) + "</div></div>" +
      '<div class="card"><div class="k">Biweekly</div><div class="v">' + money(r.net / 26) + "</div></div>" +
      '<div class="card"><div class="k">Effective rate</div><div class="v">' + pct(r.effectiveRate) + "</div></div>" +
      "</div>" +
      '<table><thead><tr><th>Deduction</th><th class="num">Per year</th><th class="num">Per month</th></tr></thead><tbody>' +
      '<tr><td>Gross pay</td><td class="num">' + money(r.gross) + '</td><td class="num">' + money(r.gross / 12) + "</td></tr>" +
      rows
        .map(function (x) {
          return (
            "<tr><td>" + x[0] + '</td><td class="num">&minus;' + money(x[1]) + '</td><td class="num">&minus;' + money(x[1] / 12) + "</td></tr>"
          );
        })
        .join("") +
      '<tr><td><strong>Take-home</strong></td><td class="num"><strong>' + money(r.net) + '</strong></td><td class="num"><strong>' + money(r.net / 12) + "</strong></td></tr>" +
      "</tbody></table>" +
      '<p class="byline">Hourly equivalent after tax: ' + money2(r.hourly) + " at 2,080 hours a year. " +
      (r.stateNote ? '<br><em>' + r.stateNote + "</em>" : "") +
      "</p>";
  }

  function calc() {
    render();
    var url = new URL(window.location.href);
    url.searchParams.set("salary", nodes.gross.value);
    url.searchParams.set("state", nodes.state.value);
    window.history.replaceState(null, "", url.toString());
  }

  nodes.go.addEventListener("click", calc);
  [nodes.gross, nodes.state, nodes.filing].forEach(function (el) {
    el.addEventListener("change", render);
  });

  // shareable state: ?salary=&state=
  var qs = new URLSearchParams(window.location.search);
  if (qs.get("salary")) nodes.gross.value = qs.get("salary");
  if (qs.get("state") && params && params.states[qs.get("state")]) nodes.state.value = qs.get("state");

  fetch("/assets/tax-params.json")
    .then(function (r) { return r.json(); })
    .then(function (j) {
      params = j;
      render();
    })
    .catch(function () {
      nodes.out.textContent = "Calculator could not load its tax table. Reload the page.";
    });
})();
