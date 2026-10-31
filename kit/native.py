#!/usr/bin/env python3
"""Runs a native (non-browser) game for the game picker, e.g. SuperTuxKart.

    python3 kit/native.py <game-id>

The game is described by the "native" section of games/<id>/game.json:

    "command":   argv to run; "{name}" is replaced by a random pick from choices
    "choices":   {"name": ["option", ...]} picked at random on each launch
    "requires":  program that must be installed (defaults to command[0])
    "exitOnLog": regex; when the game prints a matching line it is closed,
                 e.g. when a race has finished

While the game runs, the wheel is watched directly (/dev/input/js*). Holding
the two parent buttons for 5 seconds closes the game, which returns the
screen to the picker.

The game server runs as a background service without the desktop's display
variables, so kiosk.sh saves them to <data>/session.env and they are loaded here.
"""

import json
import os
import random
import re
import select
import shutil
import signal
import struct
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(os.environ.get("GRASSNYER_ROOT", Path(__file__).resolve().parent.parent))
DATA = Path(os.environ.get("GRASSNYER_DATA", Path.home() / ".local/share/grassnyer"))
PARENT_HOLD_SECONDS = 5
JS_EVENT = struct.Struct("IhBB")  # time, value, type, number (linux/joystick.h)
JS_EVENT_BUTTON = 0x01
INPUT_DIR = Path(os.environ.get("GRASSNYER_INPUT_DIR", "/dev/input"))  # tests point this elsewhere


def load_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError):
        return default


def session_env():
    env = dict(os.environ)
    for line in (DATA / "session.env").read_text().splitlines() if (DATA / "session.env").exists() else []:
        key, _, value = line.partition("=")
        if key and value:
            env[key] = value
    return env


def build_command(native):
    picks = {k: random.choice(v) for k, v in native.get("choices", {}).items() if v}
    cmd = [os.path.expanduser(arg.format(**picks)) for arg in native["command"]]
    # games piping into us would otherwise buffer their output for a long time
    if native.get("exitOnLog") and shutil.which("stdbuf"):
        cmd = ["stdbuf", "-oL", "-eL"] + cmd
    return cmd


def stop(proc):
    if proc.poll() is not None:
        return
    try:
        os.killpg(proc.pid, signal.SIGTERM)
        proc.wait(timeout=4)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def watch_parent_buttons(proc, buttons, log):
    """Closes the game when both parent buttons are held for 5 seconds."""
    fds = {}
    pressed = {}
    held_since = None
    last_scan = 0
    while proc.poll() is None:
        now = time.monotonic()
        if now - last_scan > 2:  # pick up the wheel if it is plugged in late
            last_scan = now
            for dev in INPUT_DIR.glob("js*"):
                if str(dev) not in fds:
                    try:
                        fds[str(dev)] = os.open(dev, os.O_RDONLY | os.O_NONBLOCK)
                        pressed[str(dev)] = set()
                    except OSError:
                        pass
        if fds:
            ready = select.select(list(fds.values()), [], [], 0.2)[0]
        else:
            time.sleep(0.2)
            ready = []
        for name, fd in list(fds.items()):
            if fd not in ready:
                continue
            try:
                data = os.read(fd, JS_EVENT.size * 64)
            except BlockingIOError:
                continue
            except OSError:  # unplugged
                data = b""
            if not data:
                os.close(fd)
                del fds[name]
                pressed.pop(name, None)
                continue
            for off in range(0, len(data) - JS_EVENT.size + 1, JS_EVENT.size):
                _, value, etype, number = JS_EVENT.unpack_from(data, off)
                if etype & JS_EVENT_BUTTON:
                    (pressed[name].add if value else pressed[name].discard)(number)
        combo = any(all(b in p for b in buttons) for p in pressed.values())
        if combo:
            held_since = held_since or time.monotonic()
            if time.monotonic() - held_since >= PARENT_HOLD_SECONDS:
                log("parent buttons held: closing the game")
                stop(proc)
                break
        else:
            held_since = None
    for fd in fds.values():
        os.close(fd)


def main():
    gid = sys.argv[1]
    info = load_json(ROOT / "games" / gid / "game.json", {})
    native = info.get("native")
    if not native:
        sys.exit(f"{gid} is not a native game")
    settings = load_json(DATA / "settings.json", {})
    buttons = (settings.get("wheel") or {}).get("parentButtons") or [6, 7]
    exit_re = re.compile(native["exitOnLog"]) if native.get("exitOnLog") else None

    DATA.mkdir(parents=True, exist_ok=True)
    logfile = open(DATA / f"native-{gid}.log", "w", buffering=1)
    def log(msg):
        logfile.write(f"[grassnyer] {msg}\n")

    cmd = build_command(native)
    log("starting: " + " ".join(cmd))
    proc = subprocess.Popen(cmd, env=session_env(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            stdin=subprocess.DEVNULL, start_new_session=True, text=True, errors="replace")
    threading.Thread(target=watch_parent_buttons, args=(proc, buttons, log), daemon=True).start()

    for line in proc.stdout:
        logfile.write(line)
        if exit_re and exit_re.search(line):
            log("finished: closing the game")
            time.sleep(native.get("exitDelay", 0))
            stop(proc)
            break
    proc.wait()
    log(f"exited with {proc.returncode}")


if __name__ == "__main__":
    main()
