#!/bin/bash
# Usage: tools/shots.sh <outdir> <first> <last> [hash]
OUT="$1"; A="$2"; B="$3"; H="${4:-}"
# Screenshots of report pages from dev/preview.html served by a local web server (BASE), with a temporary profile.
BASE="${BASE:-http://localhost:8777/dev/preview.html}"
SP="${TMPDIR:-/tmp}/valesta-shots"
mkdir -p "$OUT"
for n in $(seq "$A" "$B"); do
  timeout 60 "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
    --user-data-dir="$SP/edge-profile" --hide-scrollbars --force-device-scale-factor=1.4 --window-size=794,1123 \
    --virtual-time-budget=6000 --screenshot="$OUT/p$(printf %02d $n).png" "$BASE?only=$n$H" > /dev/null 2>&1
done
ls "$OUT" | tr '\n' ' '
