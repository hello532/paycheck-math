import re, html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
t = open("/tmp/tf2.html", encoding="utf-8", errors="ignore").read()
t = re.sub(r"<script[\s\S]*?</script>", " ", t)

rows = []
for tb in re.findall(r"<table[\s\S]*?</table>", t):
    for tr in re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", tb):
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()
                 for c in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr)]
        if cells:
            rows.append(cells)

flags = {}
for r in rows:
    m = re.match(r"^(.*?)\s*\(([a-z, ]+)\)$", r[0]) if r else None
    if m and not r[0].startswith("- "):
        flags[m.group(1).strip()] = [x.strip() for x in m.group(2).split(",")]

stale = {n: l for n, l in flags.items() if "j" in l or "n" in l}
print("states whose brackets are NOT 2026-final:", len(stale))
for n, l in sorted(stale.items()):
    print(f"  {n:20s} {','.join(l)}")

print("\nstates with local income tax (a):", sum(1 for l in flags.values() if "a" in l))
print("states allowing federal deduction (b):", sum(1 for l in flags.values() if "b" in l))

out = ROOT / "data" / "state_flags.json"
out.write_text(json.dumps(flags, indent=2) + "\n")
print("wrote", out.name)
