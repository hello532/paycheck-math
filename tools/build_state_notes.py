import re, html, json, sys, pathlib

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/tf2.html"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "state_notes.json"

t = open(SRC, encoding="utf-8", errors="ignore").read()
t = re.sub(r"<script[\s\S]*?</script>", " ", t)
clean = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t)))

start = clean.rfind("(a) Local income taxes")
seg = clean[start:start + 14000]
marks = [(m.group(1), m.start()) for m in re.finditer(r"\(([a-z]{1,2})\)\s", seg)]
footnotes = {}
for i, (k, pos) in enumerate(marks):
    end = marks[i + 1][1] if i + 1 < len(marks) else len(seg)
    body = seg[pos:end].strip()
    body = re.sub(r"^\([a-z]{1,2}\)\s*", "", body)
    if k not in footnotes:
        footnotes[k] = re.sub(r"\s+", " ", body)

rows = []
for tb in re.findall(r"<table[\s\S]*?</table>", t):
    for tr in re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", tb):
        cells = [
            re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()
            for c in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr)
        ]
        if cells:
            rows.append(cells)

names = {}
for r in rows:
    if not r or r[0].startswith("- "):
        continue
    m = re.match(r"^(.*?)\s*\(([a-z, ]+)\)$", r[0])
    if m:
        names[m.group(1).strip()] = [x.strip() for x in m.group(2).split(",")]

out = {}
for name, letters in names.items():
    notes = [footnotes[k] for k in letters if k in footnotes]
    if notes:
        out[name] = notes

OUT.write_text(json.dumps(out, indent=2) + "\n")
print(f"states with notes: {len(out)}")
print(f"footnotes parsed: {len(footnotes)}")
print("sample:", json.dumps({k: out[k][:1] for k in list(out)[:3]}, indent=1)[:600])
