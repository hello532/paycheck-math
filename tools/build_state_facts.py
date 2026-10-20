import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "state_notes.json"
OUT = ROOT / "data" / "state_facts.json"

raw = json.loads(SRC.read_text())

LOCAL = {
    "AL": 0.07, "IN": 0.35, "IA": 0.08, "KY": 0.93, "MD": 2.4, "MI": 0.16,
    "MO": 0.18, "NY": 1.60, "OH": 1.2, "OR": 0.18, "PA": 0.99,
}
PAYROLL_LOCAL = ["CA", "CO", "DE", "KS", "NJ", "OR", "WV"]

DEDUCTS_FEDERAL_INCOME_TAX = ["AL", "AZ", "IA", "LA", "MO", "MT", "ND", "OR"]
INCLUDES_FEDERAL_STD_DEDUCTION = ["CO", "ID", "IA", "MT", "NM", "ND", "SC"]
NO_WAGE_TAX = ["AK", "FL", "NH", "NV", "SD", "TN", "TX", "WA", "WY"]

CODE = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
    "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
    "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
    "Virginia": "VA", "Washington": "WA", "Washington DC": "DC", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY",
}

facts = {}
for name, notes in raw.items():
    code = CODE.get(name)
    if not code:
        continue
    facts[code] = {"addedLocalIncomeTax": None, "localPayrollTax": False,
                   "deductsFederalTax": False, "includesFederalStandardDeduction": False,
                   "noWageTax": code in NO_WAGE_TAX, "sources": notes}

for c, pct in LOCAL.items():
    if c in facts:
        facts[c]["addedLocalIncomeTax"] = pct
for c in PAYROLL_LOCAL:
    if c in facts:
        facts[c]["localPayrollTax"] = True
for c in DEDUCTS_FEDERAL_INCOME_TAX:
    if c in facts:
        facts[c]["deductsFederalTax"] = True
for c in INCLUDES_FEDERAL_STD_DEDUCTION:
    if c in facts:
        facts[c]["includesFederalStandardDeduction"] = True

OUT.write_text(json.dumps(facts, indent=2) + "\n")
print("states with facts:", len(facts))
print("with local income tax:", sum(1 for f in facts.values() if f["addedLocalIncomeTax"]))
print("missing:", [c for c in CODE.values() if c not in facts])
