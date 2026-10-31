# Grassnyer: notes for Claude

Kids' steering-wheel games for a Raspberry Pi 5 on a TV. The first game is
Grassnyer: a 4 year old drives a ride-on mower or tractor, mows tall grass,
finds presents that decorate the vehicle, and celebrates with a giant grass pile.

`SPEC.md` is the design the parent agreed to. Don't change agreed behaviour
without asking; if something in the spec turns out to be impractical, say so.

## Layout

```
index.html, kit/picker.js   game picker (skips itself while there is one game)
kit/server.py               stdlib-only server: static files, settings JSON, update/goback/quit
kit/input.js                wheel via Gamepad API + keyboard; calibration lives in settings.wheel
kit/settings.js             shared settings (GET/POST /api/settings)
kit/audio.js                all sounds synthesised in WebAudio; voice/ clips override fallbacks
kit/parent.js               parent settings screen + wheel setup wizard
games/mower/                the mower game (js/main.js is the state machine)
vendor/three/               three.js r187, bundled (no CDN, works offline)
voice/                      parent's recorded clips (see voice/README.md)
pi/                         setup.sh, kiosk, update/goback/quit, Remote Control service
tests/smoke.cjs             end-to-end test in headless Chromium with a fake wheel
```

Plain ES modules with an import map, no build step. Keep it that way so edits
are instant and the Pi needs nothing extra.

## Run and test

```
python3 kit/server.py 8322      # then open http://127.0.0.1:8322/
npm test                        # full flow, screenshots in test-output/
```

`npm test` starts its own server on a spare port with a throwaway settings
folder. Always look at the screenshots in `test-output/` after visual changes;
passing checks don't prove it looks right.

Useful URL params on the game page: `idleStop` and `idleSleep` (seconds),
`hintAfter` (seconds), `scale` (fixed render scale, e.g. 0.6).
`window.__grassnyer` exposes state and test hooks (see the end of main.js).
Keyboard: arrows steer/gas/brake, Space = Stop/Go, C = paint, Ctrl+Shift+P = parent settings.

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

The wheel is a generic "Vibration Steering Racing Wheel & Pedals", most
likely the DragonRise / PXN V900 family: USB `11ff:0511` in X-input mode
(kernel `xpad` driver, should just work), `0079:1864` in D-input mode. Holding
MODE for 3 seconds switches modes. One manual says rumble only works in D-input.

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

Create `games/<id>/` with `game.json` (`name`, `icon`, `order`) and an
`index.html`. Reuse `kit/` for the wheel, settings, sounds, parent menu and
saving (`gameState('<id>')`). The picker appears automatically once there
are two games. Before then, add a "Back to the games" item to the parent menu
so the child can return to the picker.

## Performance

Target 60 fps at 1080p on the Pi 5. The mower game lowers its render scale
automatically when fps drops (`__grassnyer.fps`). Grass is instanced tufts in
chunks, driven by a small mask texture (`grass.js`). Prefer cheap Lambert
materials and blob shadows. There are no shadow maps, on purpose.
