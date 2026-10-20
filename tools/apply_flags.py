import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
flags = json.loads((ROOT / "data" / "state_flags.json").read_text())
tax = json.loads((ROOT / "data" / "tax_params.json").read_text())

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

for name, letters in flags.items():
    code = CODE.get(name)
    if not code or code not in tax["states"]:
        continue
    st = tax["states"][code]
    if "j" in letters:
        st["bracketYear"] = 2025
        st["bracketNote"] = (
            "Brackets are the 2025 inflation-adjusted figures: 2026 bracket widths were not "
            "published when the source table was compiled."
        )
    else:
        st["bracketYear"] = 2026
    if st["type"] == "none":
        st.pop("bracketNote", None)
        st["bracketYear"] = 2026
        continue
    if "n" in letters:
        st["bracketNote"] = (
            st.get("bracketNote", "") + " The 2026 inflation adjustment had not been published, "
            "so the figure reflects the 2025 amount."
        ).strip()

tax["meta"]["bracket_year_policy"] = (
    "Federal figures are tax year 2026 (IRS Rev. Proc. 2025-32). State brackets are 2026 except "
    "for states flagged bracketYear 2025, whose inflation-adjusted 2026 widths were not published."
)

pathlib.Path(ROOT / "data" / "tax_params.json").write_text(json.dumps(tax, indent=2) + "\n")
stale = [c for c, s in tax["states"].items() if s.get("bracketYear") == 2025]
print("states flagged bracketYear=2025:", len(stale), stale)
