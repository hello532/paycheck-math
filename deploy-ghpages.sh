#!/bin/sh
set -e
cd "$(dirname "$0")"
ROOT=$(pwd)

ORIGIN=${SITE_ORIGIN:-https://hello532.github.io}
BASE=${BASE_PATH:-/paycheck-math}

python3 tools/build_state_params.py
python3 tools/apply_flags.py
node tools/tax.test.mjs
SITE_ORIGIN="$ORIGIN" BASE_PATH="$BASE" node build.mjs
SITE_ORIGIN="$ORIGIN" BASE_PATH="$BASE" node build.mjs --check
BASE_PATH="$BASE" node tools/similarity.mjs

KEY=$(ls "public$BASE" | grep -E '^[0-9a-f]{32}\.txt$' | sed 's/\.txt$//')

python3 - "$ROOT" "$ORIGIN" "$BASE" "$KEY" <<'PY'
import json, re, sys, time, urllib.request, urllib.error

root, origin, base, key = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
urls = re.findall(r"<loc>([^<]+)</loc>", open(f"{root}/public{base}/sitemap.xml", encoding="utf-8").read())
bad = [u for u in urls if not u.startswith(origin + base + "/")]
if bad:
    raise SystemExit(f"refusing to submit {len(bad)} urls outside {origin}{base}: {bad[:3]}")

body = json.dumps({"host": origin.split("//")[1], "key": key,
                   "keyLocation": f"{origin}{base}/{key}.txt", "urlList": urls}).encode()
for attempt in range(3):
    req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body,
                                 headers={"Content-Type": "application/json; charset=utf-8",
                                          "User-Agent": "PaycheckMath/1.0"})
    try:
        print("IndexNow:", urllib.request.urlopen(req).status, f"({len(urls)} urls)")
        break
    except urllib.error.HTTPError as e:
        print(f"IndexNow attempt {attempt + 1}: {e.code} {e.read().decode()[:140]}")
        if attempt < 2:
            time.sleep(20)
    except Exception as e:
        print(f"IndexNow skipped: {e}")
        break
PY

rm -rf /tmp/pm-deploy
cp -R "public$BASE" /tmp/pm-deploy
cd /tmp/pm-deploy
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.email=dev@local -c user.name=dev commit -qm "build $(date -u +%Y-%m-%dT%H:%MZ)"
git remote add origin https://github.com/hello532/paycheck-math.git 2>/dev/null || true
git push -q -f origin gh-pages

echo "Live: $ORIGIN$BASE/"
