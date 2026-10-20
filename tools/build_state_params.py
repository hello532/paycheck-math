import re, html, json, sys, pathlib

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/tf2.html"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "tax_params.json"
BASE = pathlib.Path(__file__).resolve().parent.parent / "data" / "tax_params.base.json"

CODES = {
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


def money(v):
    v = v.replace("$", "").replace(",", "").replace("*", "").strip()
    if v in ("", "n.a.", "none", "-"):
        return None
    m = re.match(r"^-?\d+(\.\d+)?$", v)
    return float(v) if m else None


def rate(v):
    v = v.strip()
    if v == "none":
        return None
    m = re.match(r"^(\d+(?:\.\d+)?)%$", v)
    return round(float(m.group(1)) / 100, 6) if m else None


def main():
    t = open(SRC, encoding="utf-8", errors="ignore").read()
    t = re.sub(r"<script[\s\S]*?</script>", " ", t)
    rows = []
    for tb in re.findall(r"<table[\s\S]*?</table>", t):
        for tr in re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", tb):
            cells = [
                re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()
                for c in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr)
            ]
            if cells:
                rows.append(cells)

    states = {}
    for r in rows:
        if len(r) < 4:
            continue
        name_cell = r[0]
        if name_cell.startswith("- "):
            continue
        clean = re.sub(r"\s*\([^)]*\)", "", name_cell).strip()
        if clean not in CODES:
            continue
        r_single = rate(r[1])
        floor = money(r[3])
        if r_single is None:
            states[CODES[clean]] = {"name": clean, "type": "none", "confidence": "high"}
            continue
        sd = money(r[7]) if len(r) > 7 else None
        states[CODES[clean]] = {
            "name": clean,
            "type": "brackets",
            "brackets": [{"floor": floor or 0, "rate": r_single}],
            "standard_deduction": sd or 0,
            "confidence": "high",
        }

    for r in rows:
        if len(r) < 4 or not r[0].startswith("- "):
            continue
        clean = re.sub(r"\s*\([^)]*\)", "", r[0][2:]).strip()
        code = CODES.get(clean)
        if not code or code not in states:
            continue
        rt = rate(r[1])
        fl = money(r[3])
        if rt is None:
            continue
        if "brackets" not in states[code]:
            states[code] = {
                "name": clean,
                "type": "brackets",
                "brackets": [],
                "standard_deduction": states[code].get("standard_deduction", 0),
                "confidence": "high",
            }
        states[code]["brackets"].append({"floor": fl or 0, "rate": rt})

    for code, st in states.items():
        if st["type"] != "brackets":
            continue
        bands = sorted(st["brackets"], key=lambda b: b["floor"])
        out = []
        for i, b in enumerate(bands):
            nxt = bands[i + 1]["floor"] if i + 1 < len(bands) else None
            out.append({"up_to": nxt, "rate": round(b["rate"], 6)})
        st["brackets"] = out
        if len({b["rate"] for b in out}) == 1:
            st["type"] = "flat"
            st["rate"] = out[0]["rate"]
        st.pop("brackets", None) if st["type"] == "flat" else None
        if st["type"] == "flat":
            st["rate"] = round(st["rate"], 6)

    base = json.loads(BASE.read_text())
    base["states"] = dict(sorted(states.items()))
    base["meta"]["state_source"] = "https://taxfoundation.org/data/all/state/state-income-tax-rates-2026/"
    base["meta"]["sources"] = {
        "federal": base["federal"]["source"],
        "fica": base["fica"]["source"],
        "states": base["meta"]["state_source"],
    }
    base["meta"]["notes"] = (
        "Federal figures for tax year 2026 from IRS Rev. Proc. 2025-32. "
        "State tables from the Tax Foundation 2026 state income tax table. "
        "State personal exemptions and credits are excluded, so state tax is slightly overstated. "
        "Estimates only, not tax advice."
    )
    OUT.write_text(json.dumps(base, indent=2) + "\n")
    none_ = [c for c, s in states.items() if s["type"] == "none"]
    flat = [c for c, s in states.items() if s["type"] == "flat"]
    brk = [c for c, s in states.items() if s["type"] == "brackets"]
    print(f"states={len(states)} none={len(none_)} flat={len(flat)} brackets={len(brk)}")
    print("missing:", [v for v in CODES.values() if v not in states])


if __name__ == "__main__":
    main()
