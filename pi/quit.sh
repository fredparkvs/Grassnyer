#!/usr/bin/env bash
# "Quit to desktop" in the parent settings. Reboot (or run kiosk.sh) to come back.
DATA="${GRASSNYER_DATA:-$HOME/.local/share/grassnyer}"
touch "$DATA/quit-kiosk"
pkill -f -- "--user-data-dir=$DATA/chromium-kiosk" || true
echo "Closed the game. Restart the Pi to start it again."
