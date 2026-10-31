#!/usr/bin/env bash
# Opens the game full screen. Started by the desktop at login (see setup.sh).
# Restarts the browser if it ever closes, unless the parent chose
# "Quit to desktop" (quit.sh leaves a flag file).
DATA="${GRASSNYER_DATA:-$HOME/.local/share/grassnyer}"
FLAG="$DATA/quit-kiosk"
URL="http://127.0.0.1:${GRASSNYER_PORT:-8321}/"
BROWSER="$(command -v chromium || command -v chromium-browser)"
mkdir -p "$DATA"
rm -f "$FLAG"

for _ in $(seq 1 60); do
  curl -fs "${URL}api/version" >/dev/null && break
  sleep 1
done

while [ ! -f "$FLAG" ]; do
  "$BROWSER" --kiosk --noerrdialogs --disable-infobars --no-first-run \
    --autoplay-policy=no-user-gesture-required --password-store=basic \
    --disable-session-crashed-bubble --disable-features=Translate,TranslateUI \
    --check-for-update-interval=31536000 \
    --user-data-dir="$DATA/chromium-kiosk" "$URL"
  sleep 2
done
