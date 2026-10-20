import json, time, urllib.request, urllib.parse, base64, sys, pathlib

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding

CRED = "/Users/doi/.config/google-seo-mcp/kinx-seo-credentials.json"
ROOT = pathlib.Path(__file__).resolve().parent.parent
GROWTH = ROOT / "GROWTH.md"
SITE = "https://typing.rerivo.com/"


def token():
    cred = json.load(open(CRED))
    key = serialization.load_pem_private_key(cred["private_key"].encode(), password=None)
    now = int(time.time())
    claim = {"iss": cred["client_email"], "scope": "https://www.googleapis.com/auth/webmasters.readonly",
             "aud": "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 3600}

    def b64(o):
        return base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b"=")

    msg = b64({"alg": "RS256", "typ": "JWT"}) + b"." + b64(claim)
    sig = key.sign(msg, padding.PKCS1v15(), hashes.SHA256())
    jwt = msg + b"." + base64.urlsafe_b64encode(sig).rstrip(b"=")
    data = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                   "assertion": jwt.decode()}).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data)))["access_token"]


def query(access, days, dims, limit=25):
    body = json.dumps({"startDate": time.strftime("%Y-%m-%d", time.gmtime(time.time() - days * 86400)),
                       "endDate": time.strftime("%Y-%m-%d", time.gmtime(time.time() - 3 * 86400)),
                       "dimensions": [dims], "rowLimit": limit}).encode()
    url = "https://www.googleapis.com/webmasters/v3/sites/" + urllib.parse.quote(SITE, safe="") + "/searchAnalytics/query"
    req = urllib.request.Request(url, data=body, headers={"Authorization": "Bearer " + access,
                                                          "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req)).get("rows", [])


access = token()
rows = query(access, 28, "date", 90)
pages = query(access, 28, "page", 10)
queries = query(access, 28, "query", 10)

clicks = sum(r["clicks"] for r in rows)
impr = sum(r["impressions"] for r in rows)
avg_pos = (sum(r["position"] * r["impressions"] for r in rows) / impr) if impr else 0
today = time.strftime("%Y-%m-%d")

lines = [f"### GSC snapshot — {SITE} — {today}", "",
         f"28-day window ending 3 days ago (GSC lag). Days with data: {len(rows)}.",
         "",
         f"- clicks: **{clicks}**",
         f"- impressions: **{impr}**",
         f"- impression-weighted avg position: **{avg_pos:.1f}**",
         f"- clicks per 1,000 impressions: **{(clicks / impr * 1000) if impr else 0:.2f}**",
         "",
         "| page | clicks | impressions | avg pos |", "|---|---:|---:|---:|"]
for p in pages:
    lines.append(f"| {p['keys'][0].replace(SITE, '/')} | {p['clicks']} | {p['impressions']} | {p['position']:.1f} |")
lines += ["", "| query | clicks | impressions | avg pos |", "|---|---:|---:|---:|"]
for q in queries:
    lines.append(f"| {q['keys'][0]} | {q['clicks']} | {q['impressions']} | {q['position']:.1f} |")
lines.append("")

block = "\n".join(lines)
text = GROWTH.read_text()
marker = "## GSC snapshots"
if marker not in text:
    text += "\n" + marker + "\n\n"
text = text.replace(marker + "\n\n", marker + "\n\n" + block + "\n", 1)
GROWTH.write_text(text)
print(f"clicks={clicks} impressions={impr} avg_pos={avg_pos:.1f} pages={len(pages)} queries={len(queries)}")
print("appended to GROWTH.md")
