import json, time, urllib.request, urllib.parse, base64, sys

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding

CRED = "/Users/doi/.config/google-seo-mcp/kinx-seo-credentials.json"
SCOPE = "https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification"


def token():
    cred = json.load(open(CRED))
    key = serialization.load_pem_private_key(cred["private_key"].encode(), password=None)
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    claim = {"iss": cred["client_email"], "scope": SCOPE, "aud": "https://oauth2.googleapis.com/token",
             "iat": now, "exp": now + 3600}

    def b64(o):
        return base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b"=")

    msg = b64(header) + b"." + b64(claim)
    sig = key.sign(msg, padding.PKCS1v15(), hashes.SHA256())
    jwt = msg + b"." + base64.urlsafe_b64encode(sig).rstrip(b"=")
    data = urllib.parse.urlencode(
        {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": jwt.decode()}
    ).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data)))["access_token"]


def call(method, url, access, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Authorization": "Bearer " + access, "Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


access = token()
print("token ok")

s, b = call("GET", "https://www.googleapis.com/siteVerification/v1/token?"
            + urllib.parse.urlencode({"verificationMethod": "FILE", "site": {"type": "SITE", "identifier": "https://hello532.github.io/"}}),
            access)
print("token status", s)
print(b[:500])
