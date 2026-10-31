#!/usr/bin/env bash
# "Go back" in the parent settings: return the live copy to the version it had
# before the last Update.
set -euo pipefail
ROOT="${GRASSNYER_ROOT:-$HOME/grassnyer-live}"
HIST="${GRASSNYER_DATA:-$HOME/.local/share/grassnyer}/deploy-history"
PREV="$(tail -n 1 "$HIST" 2>/dev/null || true)"
if [ -z "$PREV" ]; then
  echo "Nothing to go back to."
  exit 0
fi
cd "$ROOT"
git reset --hard --quiet "$PREV"
sed -i '$ d' "$HIST"
echo "Went back to: $(git log -1 --format='%h %s')"
echo CHANGED
