import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((ROOT / "data" / "state_income.json").read_text())
nat = d["national"]
rows = sorted(d["byState"].items(), key=lambda kv: -kv[1]["median"])
print("national", nat)
print("top5 rank list:")
for i, (n, v) in enumerate(rows[:5], 1):
    print(" ", i, n, v["median"], v["ratio8020"])
print("bottom3:")
for n, v in rows[-3:]:
    print(" ", n, v["median"])
missing = [k for k, v in d["byState"].items() if not all(v.get(x) for x in ("p20","p40","median","p60","p80"))]
print("incomplete rows:", missing)
