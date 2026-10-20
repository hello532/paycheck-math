import json, re, pathlib

wt = json.loads(pathlib.Path("/tmp/w.json").read_text())["parse"]["wikitext"]["*"]
t0 = wt.split("{|")[1]
rows = t0.split("\n|-")
print("rows:", len(rows))
for r in rows[1:4] + rows[8:11]:
    print("-----")
    print(repr(r[:400]))
