// Paycheck / take-home pay engine.
// Every rate comes from data/tax_params.json (verified sources in data/SOURCES.md).
// No number in this file is a tax rate — only the arithmetic.

export const HOURS = { annual: 2080, monthly: 12, semimonthly: 24, biweekly: 26, weekly: 52 };

/** Tax on a bracket table: [{up_to, rate}], last up_to = Infinity. */
export function bracketTax(income, brackets) {
  if (income <= 0) return 0;
  let tax = 0;
  let floor = 0;
  for (const b of brackets) {
    const top = b.up_to === null || b.up_to === undefined ? Infinity : b.up_to;
    if (income > floor) {
      const slice = Math.min(income, top) - floor;
      tax += slice * b.rate;
    }
    floor = top;
    if (income <= top) break;
  }
  return tax;
}

export function marginalRate(income, brackets) {
  let floor = 0;
  for (const b of brackets) {
    const top = b.up_to == null ? Infinity : b.up_to;
    if (income <= top) return b.rate;
    floor = top;
  }
  return brackets[brackets.length - 1].rate;
}

/**
 * Compute a full paycheck breakdown.
 * @param {object} p params (tax_params.json)
 * @param {number} gross annual gross wages
 * @param {string} state two-letter code
 * @param {"single"|"married"|"hoh"} filing
 */
export function computePaycheck(p, gross, state, filing = "single") {
  const fed = p.federal;
  const stdDed = fed.standard_deduction[filing];
  const brackets = fed.brackets[filing];
  const taxableFederal = Math.max(0, gross - stdDed);
  const federalTax = bracketTax(taxableFederal, brackets);

  const fica = p.fica;
  const ssWages = Math.min(gross, fica.ss_wage_base);
  const socialSecurity = ssWages * fica.ss_rate;
  const medicare = gross * fica.medicare_rate;
  const addlThreshold = fica.additional_threshold[filing] ?? fica.additional_threshold.single;
  const additionalMedicare = Math.max(0, gross - addlThreshold) * fica.additional_medicare_rate;

  const st = p.states[state];
  let stateTax = 0;
  let stateNote = null;
  if (st) {
    if (st.type === "none") stateTax = 0;
    else if (st.type === "flat") stateTax = Math.max(0, gross - (st.standard_deduction || 0)) * st.rate;
    else if (st.type === "brackets") {
      stateTax = bracketTax(Math.max(0, gross - (st.standard_deduction || 0)), st.brackets);
    }
    stateNote = st.note || null;
  } else {
    stateNote = "State data unavailable";
  }

  const totalTax = federalTax + stateTax + socialSecurity + medicare + additionalMedicare;
  const net = gross - totalTax;

  const period = (n) => net / n;
  return {
    gross,
    filing,
    state,
    stateName: st ? st.name : state,
    federalTax,
    stateTax,
    socialSecurity,
    medicare: medicare + additionalMedicare,
    fica: socialSecurity + medicare + additionalMedicare,
    totalTax,
    net,
    effectiveRate: gross > 0 ? totalTax / gross : 0,
    marginalFederal: marginalRate(taxableFederal, brackets),
    periods: {
      annual: net,
      monthly: period(HOURS.monthly),
      semimonthly: period(HOURS.semimonthly),
      biweekly: period(HOURS.biweekly),
      weekly: period(HOURS.weekly),
    },
    hourly: net / HOURS.annual,
    stateNote,
  };
}

/** Gross annual from an hourly rate, assuming full-time 40h × 52w. */
export function annualFromHourly(rate, hoursPerWeek = 40, weeks = 52) {
  return rate * hoursPerWeek * weeks;
}

export const usd = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const usd2 = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (n) => (n * 100).toFixed(1) + "%";
