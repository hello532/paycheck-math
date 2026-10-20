import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
wt = json.loads(pathlib.Path("/tmp/w.json").read_text())["parse"]["wikitext"]["*"]
OUT = ROOT / "data" / "state_income.json"

RENAME = {
    "Washington, D.C.": "Washington DC",
    "Washington}} Washington": "Washington",
    "New York (state)}} New York": "New York",
    "Georgia (U.S. state)}} Georgia": "Georgia",
}


def clean(raw):
    n = re.sub(r"<ref[\s\S]*?(/>|</ref>)", "", raw)
    n = re.sub(r"\{\{flag(?:icon)?\|([^}|]*)[^}]*\}\}", r"\1", n)
    n = re.sub(r"\{\{[^}]*\}\}", " ", n)
    n = re.sub(r"\[\[([^|\]]*\|)?([^\]]*)\]\]", r"\2", n)
    n = n.replace("'''", "").replace("}}", "").strip()
    return re.sub(r"\s+", " ", n)


def cell(line):
    b = line[1:]
    if b.strip().startswith("class=") and "|" in b:
        b = b.split("|", 1)[1]
    return b.strip()


def num(v):
    v = v.replace("'''", "").replace(",", "").replace("$", "")
    m = re.search(r"\d{3,}", v)
    return int(m.group(0)) if m else None


tables = wt.split("{" + "|")[1:]
pct_table = next((t for t in tables if "20th Percentile" in t), None)
if pct_table is None:
    raise SystemExit("percentile table not found")

by_state = {}
national = None
for r in pct_table.split("\n|-")[1:]:
    lines = [l for l in r.split("\n") if l.startswith("|") and not l.startswith("|}")]
    if len(lines) < 7:
        continue
    cells = [cell(l) for l in lines]
    name = clean(cells[0])
    for old, new in RENAME.items():
        if name == clean(old):
            name = new
    vals = [num(c) for c in cells[1:8]]
    vals += [None] * (8 - len(vals))
    if name.strip("'") == "United States":
        national = {"p20": vals[0], "p40": vals[1], "median": vals[2], "p60": vals[3],
                    "p80": vals[4], "top5avg": vals[6]}
        continue
    if not name or vals[2] is None:
        continue
    by_state[name] = {
        "p20": vals[0], "p40": vals[1], "median": vals[2], "p60": vals[3],
        "p80": vals[4], "top5avg": vals[6],
        "ratio8020": round(vals[4] / vals[0], 3) if (vals[0] and vals[4]) else None,
    }

data = {
    "year": 2023,
    "measure": "household income percentiles (American Community Survey, 1-year)",
    "source": "https://en.wikipedia.org/wiki/List_of_U.S._states_and_territories_by_income",
    "source_note": "Wikipedia compilation of ACS 2023 1-year estimates; national median $77,719 in the same table.",
    "national": national,
    "byState": by_state,
}
OUT.write_text(json.dumps(data, indent=2) + "\n")
print("states:", len(by_state))
print("national:", national)
print("Texas:", by_state.get("Texas"))
