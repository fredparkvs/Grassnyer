#!/usr/bin/env bash
# Keeps Claude Code Remote Control running in the workshop folder.
# claude-remote.service starts this inside tmux at boot; watch it over SSH with:
#   tmux attach -t claude        (detach again with Ctrl+B then D)
cd "$HOME/Grassnyer" || exit 1
export PATH="$HOME/.local/bin:$PATH"
while true; do
  claude remote-control
  echo "Remote Control stopped. Restarting in 30 seconds (Ctrl+C to stop)..."
  sleep 30
done
