import re, html

t = open('/tmp/tf2.html', encoding='utf-8', errors='ignore').read()
t = re.sub(r'<script[\s\S]*?</script>', ' ', t)
rows = []
for tb in re.findall(r'<table[\s\S]*?</table>', t):
    for tr in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', tb):
        cells = [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', c))).strip()
                 for c in re.findall(r'<t[dh][^>]*>([\s\S]*?)</t[dh]>', tr)]
        if cells:
            rows.append(cells)

for r in rows:
    if r and r[0].startswith('Washington'):
        print(repr(r[:5]))
