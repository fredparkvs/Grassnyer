#!/usr/bin/env bash
# Sets up the Raspberry Pi to run Grassnyer. Safe to run again at any time.
#
# Run it from the workshop copy (where Claude works):
#   bash ~/Grassnyer/pi/setup.sh
#
# What it does:
#   1. installs the few packages it needs
#   2. makes the "live" copy the TV runs (~/grassnyer-live, from GitHub main)
#   3. runs the game server as a background service
#   4. starts the game full screen when the desktop starts
#   5. turns off screen blanking, logs into the desktop automatically, enables SSH
#   6. keeps Claude Code Remote Control running in a tmux session
#   7. creates a deploy key so the Pi can save work to this one GitHub repo
#   8. installs the test tools for the workshop copy
set -euo pipefail

REPO_HTTPS="https://github.com/fredparkvs/Grassnyer.git"
REPO_SSH="git@github-grassnyer:fredparkvs/Grassnyer.git"
WORKSHOP="$(cd "$(dirname "$0")/.." && pwd)"
LIVE="$HOME/grassnyer-live"
DATA="$HOME/.local/share/grassnyer"
UNITS="$HOME/.config/systemd/user"

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

step "1/8 Installing packages"
CHROMIUM=chromium
apt-cache show chromium >/dev/null 2>&1 || CHROMIUM=chromium-browser
sudo apt-get update -qq
sudo apt-get install -y -qq git curl python3 "$CHROMIUM" evtest joystick ffmpeg tmux nodejs npm

step "2/8 Live copy for the TV ($LIVE)"
if [ -d "$LIVE/.git" ]; then
  echo "Already there (press Update in the parent settings to change it)."
else
  git clone --branch main "$REPO_HTTPS" "$LIVE"
fi
mkdir -p "$DATA"

step "3/8 Game server service"
mkdir -p "$UNITS"
install -m 644 "$WORKSHOP/pi/systemd/grassnyer-server.service" "$UNITS/"
sudo loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now grassnyer-server.service
systemctl --user restart grassnyer-server.service

step "4/8 Start the game full screen with the desktop"
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/grassnyer-kiosk.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Grassnyer
Exec=$LIVE/pi/kiosk.sh
X-GNOME-Autostart-enabled=true
DESKTOP
echo "Added $HOME/.config/autostart/grassnyer-kiosk.desktop"

step "5/8 No screen blanking, desktop auto-login, SSH on"
if command -v raspi-config >/dev/null; then
  sudo raspi-config nonint do_blanking 1      # 1 = blanking off
  sudo raspi-config nonint do_boot_behaviour B4  # desktop, logged in automatically
fi
sudo systemctl enable --now ssh

step "6/8 Claude Code Remote Control service"
install -m 644 "$WORKSHOP/pi/systemd/claude-remote.service" "$UNITS/"
systemctl --user daemon-reload
systemctl --user enable claude-remote.service
if command -v claude >/dev/null || [ -x "$HOME/.local/bin/claude" ]; then
  echo "Enabled. It starts at boot in a tmux session called 'claude' (attach: tmux attach -t claude)."
  echo "Not started now, so it doesn't clash with the Remote Control session you may be using."
else
  echo "Claude Code isn't installed yet, so the service will fail until it is."
fi

step "7/8 Deploy key for saving work to GitHub"
KEY="$HOME/.ssh/grassnyer_deploy"
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
[ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N "" -C "grassnyer-pi" -f "$KEY"
touch "$HOME/.ssh/config"
chmod 600 "$HOME/.ssh/config"
if ! grep -q "Host github-grassnyer" "$HOME/.ssh/config"; then
  cat >> "$HOME/.ssh/config" <<SSHCONF

Host github-grassnyer
  HostName github.com
  User git
  IdentityFile $KEY
  IdentitiesOnly yes
SSHCONF
fi
grep -q "github.com" "$HOME/.ssh/known_hosts" 2>/dev/null || ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
git -C "$WORKSHOP" remote set-url --push origin "$REPO_SSH"

step "8/8 Test tools for the workshop copy"
(cd "$WORKSHOP" && npm install --no-audit --no-fund --silent)

cat <<DONE

All set. Still to do by hand:

  * Add the deploy key on GitHub so the Pi can save its work:
      1. Open https://github.com/fredparkvs/Grassnyer/settings/keys/new
      2. Title: Grassnyer Pi
      3. Key: the line below
      4. Tick "Allow write access", then "Add key"

$(cat "$KEY.pub")

  * Reboot when convenient (sudo reboot). The game should come up full screen.
  * Run bash $WORKSHOP/pi/wheel-check.sh with the wheel plugged in.
DONE
