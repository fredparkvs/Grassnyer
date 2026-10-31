# Grassnyer: v1 spec

Agreed in planning on 2026-10-31. The one item still open is marked **[Q37]**.

## 1. What it is

A 3D mowing game for a 4 year old, played with a steering wheel on a Raspberry Pi 5 connected to a TV. You drive a ride-on mower or a tractor, mow tall grass, find presents that decorate the vehicle, and celebrate each finished lawn with a giant grass pile. There's no reading, no losing and no timer pressure.

The repo is also the home for future kids' games on the same Pi.

## 2. Hardware and platform

- **Pi:** Raspberry Pi 5, 8 GB, on a dedicated SD card running Raspberry Pi OS 64-bit (desktop). The Pi stays on so Remote Control is always reachable; only the TV gets switched off.
- **Screen and sound:** a TV over HDMI, using the TV's speakers.
- **Wheel:** a generic "Vibration Steering Racing Wheel & Pedals". It's most likely the DragonRise / PXN V900 family:
  - USB IDs `11ff:0511` in X-input mode and `0079:1864` in D-input mode.
  - The Linux kernel's xpad driver supports X-input mode.
  - Rumble is unverified. The exact model, axes and rumble get confirmed on the Pi with `lsusb`, `evtest` and `fftest`.
- **Engine:** a web game using Three.js (bundled, so it works offline), running in full-screen Chromium. A tiny local server serves the games and saves settings to a JSON file on disk.
- **Performance target:** 60 fps at 1080p on the Pi 5. If that's not reachable, the game lowers its internal resolution automatically.

## 3. Controls

- **Auto-drive (default):** the vehicle rolls forward at a gentle speed and the child only steers. A button on the wheel stops and starts it.
- **Pedals mode (parent setting):** gas to go. Brake to stop, and holding it brakes into a slow reverse.
- **Steering feel:** softened, with a response curve, a dead zone and a wide minimum turning circle, so holding full lock doesn't spin the vehicle on the spot.
- **Speed:** a bit faster than a real ride-on, still gentle. Max speed can be adjusted in the parent settings.
- **Magic paint button:** cycles through the 8 colours during play, with a splash sound.
- **Vibration:** only when hitting something (obstacles, hedges, fences). It's gentle, and can be switched off in the parent settings.
- **Wheel setup screen (parent settings):** turn fully left, then fully right, press gas, press brake, press the paint button, press the stop button. The result is saved, so switching the wheel's mode or replacing the wheel never needs code changes.
- If steering and vibration work best in different wheel modes, reliable steering wins.

## 4. Game flow

1. The Pi boots straight into the game, full screen. No keyboard or mouse is needed.
2. A game picker exists, but it skips itself while there's only one game.
3. **Garage:**
   - Turn the wheel to choose the mower or the tractor, then press.
   - Turn the wheel through 8 colours (red, orange, yellow, green, blue, purple, pink, black), then press.
   - The last vehicle and colour are pre-selected, so a single press is enough to go.
4. **Lawn:** mow the grass and find the 3 hidden presents.
5. **Celebration:** at about 95% mowed (see section 7).
6. The next lawn starts automatically. After lawn 5, it loops back to lawn 1 with the presents in new places.

**[Q37] Walking away and coming back:**
- If the wheel isn't touched for about 20 seconds, the vehicle gently stops and waits. Touching the wheel carries on.
- After 10 minutes untouched, the vehicle drives itself into the shed and the screen shows it sleeping, dimmed. Rendering stops, so the Pi idles cool.
- The next touch starts a **new play session**:
  - It goes back to the garage with a **plain vehicle** (decorations reset).
  - It moves on to the next lawn in the sequence with fresh grass. A half-mowed lawn doesn't resume.
  - The vehicle and colour choices are remembered.
- Decorations also reset whenever the Pi restarts, after Update or Go back, and when waking from the play timer.

## 5. Lawns

| # | Setting | Notes |
|---|---------|-------|
| 1 | Small back garden | One tree. Learn to steer. |
| 2 | Front garden | A path and flower beds. |
| 3 | Park | A pond and benches. |
| 4 | Farm field | Bigger and open, where the tractor feels at home. |
| 5 | Big garden | Everything from the first four. |

Every lawn has:
- Tall grass, plus a few big, obvious obstacles.
- Flower beds that can't be mowed: the vehicle slides around them and they stay standing, with no penalty.
- Hedges and fences all the way around.

Bumping into anything gives a soft "boing" and a gentle bounce back (plus vibration). The vehicle can never get stuck.

## 6. Look and sound

- **Look:** chunky, bright, toy-like low-poly 3D. A small driver character in a sun hat sits on the vehicle, which has no face.
- **Camera:** a chase camera behind and above the vehicle, high enough to see plenty of lawn and the mowed stripes.
- **No text for the child.** Everything is pictures, colours and sounds. The parent settings screen can use text.
- **Sound:** engine and cutting sounds, plus light music that can be switched off.
- **Voice:** your own recorded clips go in `voice/`, with built-in sound effects used for any clip that's missing:
  - `lets_mow`
  - `pick_your_mower`
  - `pick_a_colour`
  - `ooh_a_present`
  - `nearly_done`
  - `well_done`
  - `time_to_rest`

  Any common audio format works; Claude on the Pi converts it if needed.
- **Asset licensing:** models and sounds are built in code or come from CC0 sources only, with credits listed in the repo.

## 7. Mowing and celebration

- Tall grass gets cut short in stripes behind the vehicle, with clippings spraying out.
- The grass catcher (a bag on the mower, a trailer behind the tractor) visibly fills up. There's nothing to empty during play.
- A picture-based progress meter fills as the lawn gets mowed.
- **Last tufts:** after a short spell with no progress, the remaining patches sparkle and an arrow points to the nearest one.
- **Celebration** (automatic, at about 95% mowed):
  1. The leftover tufts get zoom-cut.
  2. The vehicle drives itself to the compost corner.
  3. The catcher or trailer tips up and pours out a ridiculously huge pile.
  4. Confetti, a fanfare and "Well done!".
  5. The next lawn starts.

## 8. Presents and decorations

- Each lawn hides 3 wrapped presents in the tall grass. When one is mowed it pops open, and an item flies onto the vehicle with a sparkle sound.
- **Pool:** about 25 purely visual items:
  - **Vinyls:** flames, stars, racing stripes, flowers, lightning bolts, a rainbow, a dinosaur, a big number.
  - **Lights:** headlights, a flashing orange roof beacon, a light bar, underglow, fairy lights.
  - **Add-ons:** a flag on a pole, shiny hubcaps, a chrome exhaust stack, hats for the driver.
- Each item has a spot on the vehicle (side, bonnet, roof, lights, wheels, driver's hat). A new find replaces whatever is in that spot.
- Decorations are shared between the mower and the tractor.
- The vehicle starts plain at the start of every play session (see [Q37]), and decorations build up across lawns within a session.
- Once the whole pool has been found in a session, presents shuffle the look instead.

## 9. Parent controls

- **Getting in:** hold two specific wheel buttons for 5 seconds, or use a keyboard shortcut. This works from the picker and from inside every game.
- **Settings:**
  - Auto-drive or pedals
  - Max speed
  - Steering sensitivity
  - Music on/off
  - Volume
  - Vibration on/off
  - Wheel setup
  - Play timer
  - Update
  - Go back
  - Quit to desktop
- **Play timer:** off by default, and set in minutes. When time's up, the vehicle finishes its current moment, drives into the shed and sleeps with a gentle sound. There's no sudden cut-off, and the parent combo wakes it.

## 10. Claude on the Pi, updates and safety

- **Claude Code** runs on the Pi in the workshop copy (`~/Grassnyer`). You drive it from the Claude app through Remote Control.
  - A self-restarting service keeps Remote Control running after reboots and network drops.
  - SSH is enabled as a backup way in.
- **Two copies:**
  - **Workshop (`~/Grassnyer`):** Claude edits and tests here. It runs the game hidden with a simulated wheel and takes screenshots, so the TV is never touched.
  - **Live (`~/grassnyer-live`):** what the TV runs. It only changes when you press **Update**, and **Go back** restores the previous version.
- **GitHub main is "the version the TV can get":**
  - Claude on the Pi pushes to main only when you say "ship it".
  - Cloud sessions send pull requests, which you merge.
  - Update installs whatever is on main.
- **GitHub access:** a deploy key that can write to this repo only. Claude on the Pi creates it and tells you where to paste it.
- **Permissions for Claude on the Pi:**
  - It can edit game files, use git, and run the game hidden for testing without asking.
  - It must ask before installing software, changing system settings or running admin commands.

## 11. Repo layout

```
CLAUDE.md          guide for Claude (especially Claude on the Pi)
SPEC.md            this file
kit/               shared: server, wheel input and mapping, parent settings,
                   saving, audio and voice, game picker
games/mower/       Grassnyer itself
voice/             your recorded clips
pi/                setup script, services, kiosk autostart
```

New games go in `games/<name>/` and get the wheel handling, parent menu and picker for free.

## 12. Who does what

1. **Claude (cloud session):** builds v1, tests it in headless Chromium with a simulated wheel, writes `pi/setup.sh` and `CLAUDE.md`, and pushes everything with a pull request for you to merge.
2. **You, on the Pi:**
   - Flash Raspberry Pi OS 64-bit with Raspberry Pi Imager: hostname `grassnyer`, SSH on, your username and Wi-Fi.
   - Install Claude Code and log in using the Pi's browser.
   - Clone the repo to `~/Grassnyer` and start Remote Control there.
3. **Claude on the Pi:**
   - Runs `pi/setup.sh`: creates the live copy, sets up kiosk autostart, the Remote Control service, SSH and the deploy key.
   - Tests the wheel in both modes and saves the best mapping.
   - Tunes the steering and rumble with the real wheel.
