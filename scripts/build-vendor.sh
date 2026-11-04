#!/usr/bin/env bash
# Rebuilds public/assets/vendor/three-lite.min.js from the npm "three" package.
# Run after changing scripts/three-lite.js or upgrading three. Not part of the deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp scripts/three-lite.js "$tmp/entry.js"
(cd "$tmp" && npm init -y >/dev/null && npm i --silent three esbuild)
"$tmp/node_modules/.bin/esbuild" "$tmp/entry.js" --bundle --minify --format=esm \
  --legal-comments=none --outfile=public/assets/vendor/three-lite.min.js
cp "$tmp/node_modules/three/LICENSE" public/assets/vendor/three.LICENSE
echo "three $(node -p "require('$tmp/node_modules/three/package.json').version")" > public/assets/vendor/three.VERSION
ls -la public/assets/vendor
