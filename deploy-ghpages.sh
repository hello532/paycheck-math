#!/bin/sh
set -e
cd "$(dirname "$0")"

ORIGIN=${SITE_ORIGIN:-https://hello532.github.io}
BASE=${BASE_PATH:-/paycheck-math}

python3 tools/build_state_params.py
node tools/tax.test.mjs
SITE_ORIGIN="$ORIGIN" BASE_PATH="$BASE" node build.mjs
SITE_ORIGIN="$ORIGIN" BASE_PATH="$BASE" node build.mjs --check
node tools/similarity.mjs

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
