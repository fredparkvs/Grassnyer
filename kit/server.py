#!/usr/bin/env python3
"""Tiny local server for the Grassnyer games.

Serves the game files, stores settings as JSON on disk, and (on the Pi only)
runs the Update / Go back / Quit scripts for the parent settings screen and
starts native games such as SuperTuxKart (see kit/native.py).

Standard library only, so it runs on a fresh Raspberry Pi OS with no installs.

Environment variables:
  GRASSNYER_PORT          port to listen on (default 8321)
  GRASSNYER_ROOT          repo folder to serve (default: the folder above kit/)
  GRASSNYER_DATA          where settings live (default ~/.local/share/grassnyer)
  GRASSNYER_ALLOW_SYSTEM  set to 1 to enable update/goback/quit (the Pi service sets it)
  GRASSNYER_INPUT_DIR     where to look for joysticks (default /dev/input; tests use fakes)

GET /api/joystick streams the wheel's buttons, read straight from
/dev/input/js*, as server-sent events. Chromium's built-in layout for some
wheels loses buttons (the gear lever of the "SHANWAN PS3 GamePad" wheel), so
kit/input.js can map controls to these raw Linux joystick button numbers.
"""

import fcntl
import json
import mimetypes
import os
import select
import shutil
import struct
import subprocess
import sys
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(os.environ.get("GRASSNYER_ROOT", Path(__file__).resolve().parent.parent)).resolve()
DATA = Path(os.environ.get("GRASSNYER_DATA", Path.home() / ".local/share/grassnyer")).resolve()
PORT = int(os.environ.get("GRASSNYER_PORT", "8321"))
ALLOW_SYSTEM = os.environ.get("GRASSNYER_ALLOW_SYSTEM") == "1"

SETTINGS_FILE = DATA / "settings.json"
HISTORY_FILE = DATA / "deploy-history"
PUBLIC_PREFIXES = ("kit/", "games/", "voice/", "vendor/")
PUBLIC_FILES = ("index.html",)
AUDIO_EXTS = (".ogg", ".mp3", ".wav", ".m4a", ".webm", ".opus")
MAX_BODY = 256 * 1024

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("audio/ogg", ".ogg")
mimetypes.add_type("audio/ogg", ".opus")
mimetypes.add_type("audio/mp4", ".m4a")

settings_lock = threading.Lock()
native = {"proc": None, "id": None}


def git_commit():
    try:
        out = subprocess.run(
            ["git", "-C", str(ROOT), "log", "-1", "--format=%h %cs %s"],
            capture_output=True, text=True, timeout=5,
        )
        return out.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def can_go_back():
    try:
        return any(line.strip() for line in HISTORY_FILE.read_text().splitlines())
    except OSError:
        return False


def list_games():
    games = []
    for manifest in sorted((ROOT / "games").glob("*/game.json")):
        try:
            info = json.loads(manifest.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        if info.get("hidden"):
            continue
        gid = manifest.parent.name
        nat = info.get("native")
        if nat and not shutil.which(os.path.expanduser(nat.get("requires") or nat["command"][0])):
            continue  # not installed on this machine, so don't offer it
        games.append({
            "id": gid,
            "name": info.get("name", gid),
            "type": "native" if nat else "web",
            "url": None if nat else f"/games/{gid}/",
            "icon": f"/games/{gid}/{info['icon']}" if info.get("icon") else None,
            "order": info.get("order", 100),
        })
    games.sort(key=lambda g: (g["order"], g["id"]))
    return games


def list_voice_clips():
    clips = {}
    voice_dir = ROOT / "voice"
    if voice_dir.is_dir():
        for ext in AUDIO_EXTS:  # earlier extensions win
            for f in sorted(voice_dir.glob(f"*{ext}")):
                clips.setdefault(f.stem.lower(), f"/voice/{f.name}")
    return clips


def run_pi_script(name):
    script = ROOT / "pi" / f"{name}.sh"
    if not script.is_file():
        return {"ok": False, "message": f"Missing script pi/{name}.sh"}, False
    try:
        out = subprocess.run(
            ["bash", str(script)], capture_output=True, text=True, timeout=180,
            env={**os.environ, "GRASSNYER_DATA": str(DATA), "GRASSNYER_ROOT": str(ROOT)},
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "message": "Timed out"}, False
    text = (out.stdout + out.stderr).strip()
    lines = [l for l in text.splitlines() if l.strip()]
    changed = any(l.strip() == "CHANGED" for l in lines)
    message = "\n".join(l for l in lines if l.strip() != "CHANGED")[-600:]
    return {"ok": out.returncode == 0, "message": message, "restarting": changed}, changed


def native_running():
    return native["proc"] is not None and native["proc"].poll() is None


def launch_native(gid):
    if native_running():
        return {"ok": False, "message": "A game is already running."}
    if not any(g["id"] == gid and g["type"] == "native" for g in list_games()):
        return {"ok": False, "message": f"No installed native game called {gid}."}
    native["proc"] = subprocess.Popen(
        [sys.executable, str(ROOT / "kit" / "native.py"), gid],
        env={**os.environ, "GRASSNYER_DATA": str(DATA), "GRASSNYER_ROOT": str(ROOT)},
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    native["id"] = gid
    return {"ok": True}


def restart_soon():
    # systemd (Restart=always) brings us back with the new files.
    threading.Timer(1.0, lambda: os._exit(0)).start()


JS_EVENT = struct.Struct("IhBB")  # time, value, type, number (linux/joystick.h)
JS_EVENT_BUTTON = 0x01
INPUT_DIR = Path(os.environ.get("GRASSNYER_INPUT_DIR", "/dev/input"))


def joystick_name(fd):
    try:
        buf = bytearray(128)
        fcntl.ioctl(fd, 0x80006A13 | (len(buf) << 16), buf)  # JSIOCGNAME
        return buf.split(b"\0", 1)[0].decode(errors="replace")
    except OSError:
        return ""


class Joystick:
    """Watches /dev/input/js* for button presses, from the first time a page asks.

    "presses" counts every press, so a tap that is released again before a
    page reads the next update is never lost.
    """

    def __init__(self):
        self.cond = threading.Condition()
        self.pressed = {}  # device -> set of button numbers held down
        self.names = {}    # device -> name reported by the driver
        self.presses = {}  # button number -> times pressed
        self.seq = 0
        self.started = False

    def start(self):
        with self.cond:
            if self.started:
                return
            self.started = True
        threading.Thread(target=self.run, daemon=True).start()

    def snapshot(self):
        held = set().union(*self.pressed.values())
        return {
            "seq": self.seq,
            "name": next(iter(self.names.values()), ""),
            "buttons": sorted(held),
            "presses": {str(n): c for n, c in self.presses.items()},
        }

    def wait(self, seq, timeout):
        with self.cond:
            self.cond.wait_for(lambda: self.seq != seq, timeout)
            return self.snapshot()

    def _changed(self):  # call with self.cond held
        self.seq += 1
        self.cond.notify_all()

    def run(self):
        fds = {}
        last_scan = 0
        while True:
            if time.monotonic() - last_scan > 2:  # pick up the wheel if it is plugged in late
                last_scan = time.monotonic()
                for dev in sorted(INPUT_DIR.glob("js*")):
                    if str(dev) in fds:
                        continue
                    try:
                        fd = os.open(dev, os.O_RDONLY | os.O_NONBLOCK)
                    except OSError:
                        continue
                    fds[str(dev)] = fd
                    with self.cond:
                        self.pressed[str(dev)] = set()
                        self.names[str(dev)] = joystick_name(fd)
                        self._changed()
            if fds:
                ready = select.select(list(fds.values()), [], [], 0.5)[0]
            else:
                time.sleep(0.5)
                ready = []
            for dev, fd in list(fds.items()):
                if fd not in ready:
                    continue
                try:
                    data = os.read(fd, JS_EVENT.size * 64)
                except BlockingIOError:
                    continue
                except OSError:  # unplugged
                    data = b""
                with self.cond:
                    if not data:
                        os.close(fd)
                        del fds[dev]
                        self.pressed.pop(dev, None)
                        self.names.pop(dev, None)
                        self._changed()
                        continue
                    held = self.pressed[dev]
                    changed = False
                    for off in range(0, len(data) - JS_EVENT.size + 1, JS_EVENT.size):
                        _, value, etype, number = JS_EVENT.unpack_from(data, off)
                        if not etype & JS_EVENT_BUTTON or bool(value) == (number in held):
                            continue
                        changed = True
                        if value:
                            held.add(number)
                            self.presses[number] = self.presses.get(number, 0) + 1
                        else:
                            held.discard(number)
                    if changed:
                        self._changed()


joystick = Joystick()


class Handler(SimpleHTTPRequestHandler):
    server_version = "Grassnyer/1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        if os.environ.get("GRASSNYER_VERBOSE"):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # ---- helpers -------------------------------------------------------
    def send_json(self, obj, status=HTTPStatus.OK):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def stream_joystick(self):
        joystick.start()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        seq = None
        try:
            while True:
                snap = joystick.wait(seq, timeout=15)
                if snap["seq"] == seq:
                    self.wfile.write(b": still here\n\n")  # keeps the connection alive
                else:
                    seq = snap["seq"]
                    self.wfile.write(f"data: {json.dumps(snap)}\n\n".encode())
                self.wfile.flush()
        except OSError:  # the page went away
            pass

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ValueError("too big")
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw or b"{}")

    # ---- routes --------------------------------------------------------
    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path.startswith("/api/"):
            return self.api_get(path)
        rel = path.lstrip("/")
        if rel == "" or rel in PUBLIC_FILES or (rel.startswith(PUBLIC_PREFIXES) and ".." not in rel):
            return super().do_GET()
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/settings":
            try:
                data = self.read_json()
            except (ValueError, json.JSONDecodeError):
                return self.send_json({"ok": False}, HTTPStatus.BAD_REQUEST)
            with settings_lock:
                DATA.mkdir(parents=True, exist_ok=True)
                tmp = SETTINGS_FILE.with_suffix(".tmp")
                tmp.write_text(json.dumps(data, indent=2))
                tmp.replace(SETTINGS_FILE)
            return self.send_json({"ok": True})
        if path == "/api/launch":
            if not ALLOW_SYSTEM:
                return self.send_json({"ok": False, "message": "Only available on the Pi."}, HTTPStatus.NOT_IMPLEMENTED)
            try:
                gid = str(self.read_json().get("id", ""))
            except (ValueError, json.JSONDecodeError):
                return self.send_json({"ok": False}, HTTPStatus.BAD_REQUEST)
            result = launch_native(gid)
            return self.send_json(result, HTTPStatus.OK if result["ok"] else HTTPStatus.CONFLICT)
        if path in ("/api/update", "/api/goback", "/api/quit"):
            if not ALLOW_SYSTEM:
                return self.send_json(
                    {"ok": False, "message": "Only available on the Pi."},
                    HTTPStatus.NOT_IMPLEMENTED,
                )
            result, changed = run_pi_script(path.rsplit("/", 1)[1])
            self.send_json(result)
            if changed:
                restart_soon()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def api_get(self, path):
        if path == "/api/settings":
            with settings_lock:
                try:
                    data = json.loads(SETTINGS_FILE.read_text())
                except (OSError, json.JSONDecodeError):
                    data = {}
            return self.send_json(data)
        if path == "/api/games":
            return self.send_json(list_games())
        if path == "/api/joystick":
            return self.stream_joystick()
        if path == "/api/voice":
            return self.send_json(list_voice_clips())
        if path == "/api/native":
            return self.send_json({"running": native_running(), "id": native["id"] if native_running() else None})
        if path == "/api/version":
            return self.send_json({
                "commit": git_commit(),
                "canGoBack": can_go_back(),
                "system": ALLOW_SYSTEM,
                "pid": os.getpid(),
            })
        self.send_error(HTTPStatus.NOT_FOUND)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    print(f"Grassnyer serving {ROOT} on http://127.0.0.1:{port}/ (data: {DATA})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
