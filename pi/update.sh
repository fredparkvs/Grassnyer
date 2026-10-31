#!/usr/bin/env bash
# "Update" in the parent settings: move the live copy to the latest GitHub main.
# Prints CHANGED when files changed, so the server restarts itself.
set -euo pipefail
ROOT="${GRASSNYER_ROOT:-$HOME/grassnyer-live}"
DATA="${GRASSNYER_DATA:-$HOME/.local/share/grassnyer}"
cd "$ROOT"
git fetch --quiet origin main
OLD="$(git rev-parse HEAD)"
NEW="$(git rev-parse origin/main)"
if [ "$OLD" = "$NEW" ]; then
  echo "Already up to date: $(git log -1 --format='%h %s')"
  exit 0
fi
mkdir -p "$DATA"
echo "$OLD" >> "$DATA/deploy-history"
git reset --hard --quiet "$NEW"
echo "Updated to: $(git log -1 --format='%h %s')"
echo CHANGED
