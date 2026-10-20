import re, html, json, sys

src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/tf2.html"
t = open(src, encoding="utf-8", errors="ignore").read()
t = re.sub(r"<script[\s\S]*?</script>", " ", t)
t = re.sub(r"<style[\s\S]*?</style>", " ", t)

tables = re.findall(r"<table[\s\S]*?</table>", t)
print("tables:", len(tables), file=sys.stderr)

rows = []
for tb in tables:
    for tr in re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", tb):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr)]
        cells = [re.sub(r"\s+", " ", c) for c in cells]
        if cells:
            rows.append(cells)

for r in rows[:40]:
    print(r)
print("total rows:", len(rows), file=sys.stderr)
