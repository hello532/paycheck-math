#!/bin/sh
set -e
cd "$(dirname "$0")"

ORIGIN="${SITE_ORIGIN:-https://paycheck-math.pages.dev}"

python3 tools/build_state_params.py
node tools/tax.test.mjs
SITE_ORIGIN="$ORIGIN" node build.mjs
SITE_ORIGIN="$ORIGIN" node build.mjs --check
node tools/similarity.mjs

CFG="$HOME/Library/Preferences/.wrangler/config/default.toml"
EXP=$(grep -o 'expiration_time = "[^"]*"' "$CFG" | sed 's/.*= "//;s/"//')
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
if [[ "$NOW" > "$EXP" ]]; then
  echo "Cloudflare OAuth token expired at $EXP." >&2
  echo "Run 'npx wrangler login' once, then re-run this script." >&2
  exit 2
fi
npx --yes wrangler@latest pages deploy public \
  --project-name paycheck-math --branch main --commit-dirty=true

KEY=$(ls public | grep -E '^[0-9a-f]{32}\.txt$' | sed 's/\.txt$//')
python3 - "$ORIGIN" "$KEY" <<'PY'
import json, sys, urllib.request, re
origin, key = sys.argv[1], sys.argv[2]
urls = re.findall(r"<loc>([^<]+)</loc>", open("public/sitemap.xml", encoding="utf-8").read())
bad = [u for u in urls if not u.startswith(origin + "/")]
if bad:
    raise SystemExit(f"refusing to submit {len(bad)} urls outside {origin}: {bad[:3]}")
body = json.dumps({"host": origin.split("//")[1], "key": key,
                   "keyLocation": f"{origin}/{key}.txt", "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body,
                             headers={"Content-Type": "application/json; charset=utf-8",
                                      "User-Agent": "PaycheckMath/1.0"})
try:
    print("IndexNow:", urllib.request.urlopen(req).status, f"({len(urls)} urls)")
except Exception as e:
    print(f"IndexNow skipped ({e}); sitemap still submitted to search engines by crawl")
PY

echo "Live: $ORIGIN"
