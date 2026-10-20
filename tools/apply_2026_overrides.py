import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
p = ROOT / "data" / "tax_params.json"
tax = json.loads(p.read_text())

# Verified 2026 changes overriding the Tax Foundation table (which was compiled earlier).
OVERRIDES = {
    "GA": {
        "type": "flat",
        "rate": 0.0499,
        "standard_deduction": 15000,
        "bracketYear": 2026,
        "source": "https://dor.georgia.gov/taxes/important-tax-updates",
        "note": "2026: flat rate cut to 4.99% and standard deduction raised to $15,000 (Georgia DOR).",
    },
    "UT": {
        "type": "flat",
        "rate": 0.0445,
        "standard_deduction": 0,
        "bracketYear": 2026,
        "source": "https://le.utah.gov",
        "note": "2026: flat rate reduced to 4.45% (Utah 2026 tax law change).",
    },
    "MS": {
        "type": "brackets",
        "brackets": [{"up_to": 10000, "rate": 0.0}, {"up_to": None, "rate": 0.044}],
        "standard_deduction": 0,
        "bracketYear": 2026,
        "source": "https://www.dor.ms.gov/general-information",
        "note": "2026: 0% on the first $10,000 of taxable income, 4.4% above that (Mississippi DOR).",
    },
    "NE": {
        "bracketYear": 2026,
        "topRate": 0.0455,
        "source": "https://revenue.nebraska.gov",
        "note": "2026: top marginal rate 4.55%, part of the scheduled reduction to 3.99% by 2027.",
    },
}

for code, ov in OVERRIDES.items():
    st = tax["states"][code]
    for k, v in ov.items():
        st[k] = v
    st.pop("brackets", None) if ov.get("type") == "flat" else None
    st.pop("rate", None) if ov.get("type") == "brackets" else None

# Nebraska: apply 4.55% to the top band, keep lower bands
ne = tax["states"]["NE"]
if ne.get("brackets"):
    ne["brackets"][-1]["rate"] = 0.0455
    ne["brackets"][-2]["rate"] = min(ne["brackets"][-2]["rate"], 0.0455)

# drop the earlier blanket 2025 bracket note for states now verified as 2026
for c in ("GA", "UT", "MS", "NE"):
    tax["states"][c].pop("bracketNote", None)

tax["meta"]["verified_overrides"] = list(OVERRIDES)
p.write_text(json.dumps(tax, indent=2) + "\n")

for c in ("GA", "UT", "MS", "NE"):
    s = tax["states"][c]
    print(c, s["type"], s.get("rate") or [b["rate"] for b in s.get("brackets", [])], "sd", s.get("standard_deduction"))
