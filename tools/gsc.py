import json, time, urllib.request, urllib.parse, base64, sys

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding

cred = json.load(open(sys.argv[1]))
key = serialization.load_pem_private_key(cred["private_key"].encode(), password=None)
now = int(time.time())

header = {"alg": "RS256", "typ": "JWT"}
claim = {
    "iss": cred["client_email"],
    "scope": "https://www.googleapis.com/auth/webmasters",
    "aud": "https://oauth2.googleapis.com/token",
    "iat": now,
    "exp": now + 3600,
}


def b64(o):
    return base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b"=")


msg = b64(header) + b"." + b64(claim)
sig = key.sign(msg, padding.PKCS1v15(), hashes.SHA256())
jwt = msg + b"." + base64.urlsafe_b64encode(sig).rstrip(b"=")

data = urllib.parse.urlencode(
    {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": jwt.decode()}
).encode()
tok = json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data)))
access = tok["access_token"]

sites = json.load(
    urllib.request.urlopen(
        urllib.request.Request(
            "https://www.googleapis.com/webmasters/v3/sites",
            headers={"Authorization": "Bearer " + access},
        )
    )
)
print("sites:")
for s in sites.get("siteEntry", []):
    print(" ", s["siteUrl"], s["permissionLevel"])

if len(sys.argv) > 2 and sys.argv[2] == "add":
    target = sys.argv[3]
    body = json.dumps({}).encode()
    req = urllib.request.Request(
        "https://www.googleapis.com/webmasters/v3/sites/" + urllib.parse.quote(target, safe=""),
        data=body,
        method="PUT",
        headers={"Authorization": "Bearer " + access, "Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req)
        print("added:", target)
    except urllib.error.HTTPError as e:
        print("add failed:", e.code, e.read().decode()[:300])
