#!/usr/bin/env bash
# Installs SuperTuxKart 1.5 (the official self-contained ARM64 build) into
# ~/.local/opt, where games/supertuxkart/game.json expects it. Safe to re-run.
#
# Why not "apt install supertuxkart"? Raspberry Pi OS ships 1.4, which can't be
# told to use the wheel when it starts straight into a race (no --use-gamepad).
set -euo pipefail
VERSION=1.5
NAME="SuperTuxKart-$VERSION-linux-arm64"
URL="https://github.com/supertuxkart/stk-code/releases/download/$VERSION/$NAME.tar.gz"
DEST="$HOME/.local/opt"

if [ "$(uname -m)" != "aarch64" ]; then
  echo "This is for the Raspberry Pi (64-bit ARM). This machine is $(uname -m)." >&2
  exit 1
fi
if [ -x "$DEST/$NAME/run_game.sh" ]; then
  echo "SuperTuxKart $VERSION is already installed in $DEST/$NAME"
  exit 0
fi
mkdir -p "$DEST"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Downloading SuperTuxKart $VERSION (about 700 MB)..."
curl -fL --progress-bar -o "$TMP/stk.tar.gz" "$URL"
echo "Unpacking..."
tar -xzf "$TMP/stk.tar.gz" -C "$DEST"
test -x "$DEST/$NAME/run_game.sh"
echo "Installed. It now shows up in the game picker (reload the picker or restart the Pi)."
