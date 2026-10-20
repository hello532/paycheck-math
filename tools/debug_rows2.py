import json, re, pathlib

wt = json.loads(pathlib.Path("/tmp/w.json").read_text())["parse"]["wikitext"]["*"]
t0 = wt.split("{|")[1]
rows = t0.split("\n|-")

def clean_name(raw):
    n = re.sub(r"<ref[\s\S]*?(/>|</ref>)", "", raw)
    n = re.sub(r"\{\{[^}]*\}\}", " ", n)
    n = re.sub(r"\[\[([^|\]]*\|)?([^\]]*)\]\]", r"\2", n)
    n = n.replace("'''", "").replace("}}", "").strip()
    return re.sub(r"\s+", " ", n)

for r in rows[2:6]:
    lines = [l for l in r.split("\n") if l.startswith("|") and not l.startswith("|}")]
    print("LINES", lines[:3])
    if not lines:
        continue
    cells = [l[1:] for l in lines]
    print("CELL0", repr(cells[0]))
    print("NAME", repr(clean_name(cells[0].strip())))
    print("CELL1", repr(cells[1]) if len(cells) > 1 else "MISSING")
    print("---")
