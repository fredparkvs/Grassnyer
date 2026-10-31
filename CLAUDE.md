# Grassnyer: notes for Claude

Kids' steering-wheel games for a Raspberry Pi 5 on a TV, chosen from a picture
game picker. Grassnyer (our own): a 4 year old drives a ride-on mower or tractor,
mows tall grass, finds presents that decorate the vehicle, and celebrates with
a giant grass pile. SuperTuxKart (installed, launched as a native game): straight
into a short kid race.

`SPEC.md` is the design the parent agreed to. Don't change agreed behaviour
without asking; if something in the spec turns out to be impractical, say so.

## Layout

```
index.html, kit/picker.js   game picker (skips itself while there is one game)
kit/server.py               stdlib-only server: static files, settings JSON, update/goback/quit,
                            raw joystick buttons (/api/joystick) for buttons Chromium loses
kit/input.js                wheel via Gamepad API + keyboard; calibration lives in settings.wheel
kit/settings.js             shared settings (GET/POST /api/settings)
kit/audio.js                all sounds synthesised in WebAudio; voice/ clips override fallbacks
kit/parent.js               parent settings screen + wheel setup wizard
kit/native.py               runs a native game; closes it on race end or parent buttons
games/mower/                the mower game (js/main.js is the state machine)
games/supertuxkart/         game.json describing how SuperTuxKart is launched
vendor/three/               three.js r187, bundled (no CDN, works offline)
voice/                      parent's recorded clips (see voice/README.md)
pi/                         setup.sh, kiosk, update/goback/quit, Remote Control service
tests/smoke.cjs             end-to-end Grassnyer test in headless Chromium with a fake wheel
tests/native.cjs            picker + native game test, with stand-in games and a fake joystick
```

Plain ES modules with an import map, no build step. Keep it that way so edits
are instant and the Pi needs nothing extra.

## Run and test

```
python3 kit/server.py 8322      # then open http://127.0.0.1:8322/
npm test                        # full flow, screenshots in test-output/
```

`npm test` starts its own server on a spare port with a throwaway settings
folder, a fake joystick, a throwaway `HOME` (so installed native games stay
hidden) and no display variables (so nothing can open on the TV). Always look
at the screenshots in `test-output/` after visual changes; passing checks
don't prove it looks right. On the Pi a few timing checks fail even on
unchanged code (slow software rendering); see `docs/wheel-notes.md`.

Useful URL params on the game page: `idleStop` and `idleSleep` (seconds),
`hintAfter` (seconds), `scale` (fixed render scale, e.g. 0.6).
`window.__grassnyer` exposes state and test hooks (see the end of main.js).
Keyboard: arrows steer/gas/brake, Space = Stop/Go, C = paint, F/R = gear lever
forward/reverse, Ctrl+Shift+P = parent settings.

## On the Raspberry Pi

You're on the Pi if `~/grassnyer-live` exists. Two copies of the repo:

- **Workshop, `~/Grassnyer`**: where you work. Edit, commit and test here.
- **Live, `~/grassnyer-live`**: what the TV runs, served by the
  `grassnyer-server` user service on port 8321. It only changes when the parent
  presses **Update** (GitHub main) or **Go back** in the parent settings.

Rules:

1. Never edit `~/grassnyer-live`, and never restart the game server, the kiosk
   browser or the Pi without asking first. A child may be playing.
2. Test with `npm test`, never on port 8321. It runs hidden and never touches the TV.
3. Commit in the workshop as you go. Push to `main` only when the parent says
   "ship it" (or clearly asks for it). Then tell them to press Update in the
   parent settings (hold the two parent buttons for 5 seconds, or Ctrl+Shift+P).
4. Ask before installing software, using sudo or changing system settings
   (`.claude/settings.json` makes those prompt).
5. Pushing uses the deploy key: the workshop's push URL is `git@github-grassnyer:...`.

### "Set up the Pi"

1. Run `bash pi/setup.sh` (it uses sudo, so ask first). It's safe to re-run.
2. Show the parent the deploy key it prints and the GitHub link; wait until
   they confirm, then check with `git push --dry-run origin HEAD:refs/heads/main`.
3. Bring up the wheel (below).
4. Ask before rebooting. After the reboot the game should open full screen,
   and `tmux ls` should show the `claude` session running Remote Control.
   Note: running Remote Control as a boot service isn't an officially
   documented setup. If it misbehaves, fix it or fall back to starting
   `claude remote-control` by hand in tmux.
5. Check `raspi-config nonint get_blanking` reports blanking off (the game
   must not blank while a child steers, since gamepad input doesn't count as
   activity for the screen saver).

### Wheel bring-up

**Measured on the Pi (see `docs/wheel-notes.md`):** the wheel reports as a PS3
pad, "SHANWAN PS3 GamePad" (`054c:0268`, `hid-sony`), with no X axis. Chromium's
PS3 layout gives steering correctly on axis 0 but loses L2/R2, which is
the gear lever, so the game server reads those itself (`/api/joystick`). Pedals,
rumble and the MODE button are still untested.

Before it was plugged in, the guess was the DragonRise / PXN V900 family: USB
`11ff:0511` in X-input mode (kernel `xpad` driver), `0079:1864` in D-input
mode. Holding MODE for 3 seconds switches modes. One manual says rumble only
works in D-input.

1. `bash pi/wheel-check.sh` in each mode, with the parent's help.
2. `evtest`: confirm steering is one axis and gas/brake are separate axes.
3. `fftest /dev/input/eventN`: does it rumble in each mode?
4. Pick the mode with reliable steering. Rumble is only a bonus (agreed rule).
5. Have the parent run **Wheel setup** in the parent settings with the TV,
   or improve `defaultMapping()` in `kit/input.js` for this wheel.
6. Write what you found in `docs/wheel-notes.md`.

Chromium reports this wheel with raw (non-"standard") axes. Rumble needs
`vibrationActuator`, which Chromium only provides when the kernel exposes FF_RUMBLE.

## Adding a game

**Browser game:** create `games/<id>/` with `game.json` (`name`, `icon`,
`order`) and an `index.html`. Reuse `kit/` for the wheel, settings, sounds,
parent menu (it adds "Back to the games" by itself) and saving
(`gameState('<id>')`).

**Native game:** give `game.json` a `native` section (see
`games/supertuxkart/game.json` and the top of `kit/native.py`). It only shows
in the picker when its program is installed.

How a native game runs:
- The picker asks the server (`POST /api/launch`), which runs `kit/native.py`.
- `native.py` loads the desktop's display variables from
  `~/.local/share/grassnyer/session.env`, which `kiosk.sh` writes, since the
  server runs as a background service.
- It logs to `~/.local/share/grassnyer/native-<id>.log`.
- It closes the game when `exitOnLog` matches or the parent buttons are held
  for 5 s. It reads those buttons as raw joystick numbers from
  `settings.wheel.parentButtons`, falling back to 6 and 7.

## SuperTuxKart bring-up (on the Pi)

Agreed design: `SPEC.md` section 13. The facts below come from reading the
SuperTuxKart 1.5 source; none of it has run on the Pi yet.

1. `bash pi/install-supertuxkart.sh` (setup.sh runs it). This installs the
   official 1.5 ARM64 build in `~/.local/opt`. Don't use apt: its 1.4 can't
   pick the wheel when starting straight into a race.
2. With the parent at the TV, launch it from the picker. Then read
   `~/.local/share/grassnyer/native-supertuxkart.log`.
   - "Requested input device unavailable, fallback to the default keyboard"
     means `--use-gamepad=0` isn't the wheel. Try 1.
3. **Bind the pedals.** Steering defaults to axis 0, which suits the wheel, but
   accelerate defaults to axis 1, which is wrong for it.
   - Run `~/.local/opt/SuperTuxKart-1.5-linux-arm64/run_game.sh` directly, then
     go to Options, Controls, the wheel, and bind Accelerate to the gas pedal
     and Brake to the brake pedal.
   - Or edit `~/.config/supertuxkart/config-0.10/input.xml`, for example
     `<action name="accel" event="2" id="N" direction="1" range="1"/>`.
     `event` is 2 for an axis, 3 for a button; `direction` is 0 for negative,
     1 for positive. SDL's axis numbers may differ from evtest's.
4. **Speed.** It starts at 1280x720 with the simple renderer. If it's slow,
   try `--render-driver=vulkan`, a smaller `-s`, or `--disable-particles` in
   `game.json`. Record what you measured in `docs/wheel-notes.md`.
5. **When a race finishes,** the results should show for about 6 s and then
   it returns to the picker. Check the picker gets the screen and wheel back.
   Ending relies on `--debug=gui` printing
   `Switching to screen race_result.stkgui`; if that line changes, update
   `exitOnLog`.
6. **Escape hatch.** Holding the parent buttons for 5 s must close it. If not,
   compare `jstest /dev/input/js0` button numbers with `settings.wheel.parentButtons`.

## Performance

Target 60 fps at 1080p on the Pi 5. The mower game lowers its render scale
automatically when fps drops (`__grassnyer.fps`). Grass is instanced tufts in
chunks, driven by a small mask texture (`grass.js`). Prefer cheap Lambert
materials and blob shadows. There are no shadow maps, on purpose.
