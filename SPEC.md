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
- **Gear lever** (added 2026-10-31 at the parent's request, after he got stuck in a corner): push it forward to drive forwards, pull it back to reverse. Reversing is half speed, with a reversing beep. In auto-drive, moving the lever also starts the vehicle if it was stopped. In pedals mode, the gas pedal drives in the chosen direction. Each new lawn starts in forward.
- **Steering feel:** softened, with a response curve, a dead zone and a wide minimum turning circle, so holding full lock doesn't spin the vehicle on the spot.
- **Speed:** a bit faster than a real ride-on, still gentle. Max speed can be adjusted in the parent settings.
- **Magic paint button:** cycles through the 8 colours during play, with a splash sound.
- **Vibration:** only when hitting something (obstacles, hedges, fences). It's gentle, and can be switched off in the parent settings.
- **Wheel setup screen (parent settings):** turn fully left, then fully right, press gas, press brake, push the gear lever forward, pull it back, press the paint button, press the stop button. The result is saved, so switching the wheel's mode or replacing the wheel never needs code changes.
- If steering and vibration work best in different wheel modes, reliable steering wins.

## 4. Game flow

1. The Pi boots straight into the game, full screen. No keyboard or mouse is needed.
2. **Game picker:** big picture tiles, turn the wheel to choose, press to play. It skips itself while there's only one game. With SuperTuxKart installed (section 13) it shows at start-up.
3. **Garage:**
   - Turn the wheel to choose the mower or the tractor, then press.
   - Turn the wheel through 8 colours (red, orange, yellow, green, blue, purple, pink, black), then press.
   - The last vehicle and colour are pre-selected, so a single press is enough to go.
4. **Lawn:** mow the grass and find the 3 hidden presents.
5. **Celebration:** at about 80% mowed (see section 7). This was 95% until 2026-10-31, when the parent asked for it lower.
6. The next lawn starts automatically. After lawn 5, it loops back to lawn 1 with the presents in new places.

**[Q37] Walking away and coming back:**
- If the wheel isn't touched for about 20 seconds, the vehicle gently stops and waits. Touching the wheel carries on.
- After 10 minutes untouched, the vehicle drives itself into the shed and the screen shows it sleeping, dimmed. Rendering stops, so the Pi idles cool.
- The next touch starts a **new play session**:
  - It goes to the **game picker** (agreed when SuperTuxKart was added; with only one game the picker skips straight to Grassnyer's garage), with a **plain vehicle** (decorations reset).
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

Each lawn has its own look (added 2026-11-01 at the parent's request): its own sky, light, grass colour and blade shape, flowers among the grass, mowed-stripe colours, and something floating in the air.

| # | Look |
|---|------|
| 1 | Sunny summer day: bright green grass with a few white and yellow daisies. |
| 2 | Flowery morning: lush, broad blue-green grass full of pink, purple and white flowers; a soft pink sky; petals drifting. |
| 3 | Golden afternoon meadow: tall, thin, wispy grass with dandelions; dandelion fluff floating by. |
| 4 | Wheat field at sunset: straight golden stalks with a few red poppies; an orange-pink sky; straw-coloured stubble; dust glinting. |
| 5 | Magic evening: teal grass with glowing blue, purple and white flower tips; a purple-pink sky; fireflies. |

Every lawn has:
- Tall grass, plus a few big, obvious obstacles.
- Flower beds that can't be mowed: the vehicle slides around them and they stay standing, with no penalty.
- Hedges and fences all the way around.

Bumping into anything gives a soft "boing" and a gentle bounce back (plus vibration). The vehicle can never get stuck. These rules were added 2026-10-31 at the parent's request:
- **5 bumps in a row in the same spot** (within 2.5 units, each within 6 s of the last): the vehicle hops 3.5 units away from whatever it keeps hitting, and lands facing away from it. Out of a corner, that means diagonally out.
- **10 seconds without getting anywhere** while it's meant to be driving: a big 5-4-3-2-1 countdown with a tick for each number, then it pops back to the lawn's starting spot. "Getting anywhere" means moving 1.5 units. Waiting for a touch counts as meant to be driving; pressing Stop doesn't. Driving away during the countdown cancels it.
- **Lawns are 1.4 times bigger** in each direction than the sizes in the table above. Obstacles keep their size and spread out with the lawn.

**The family's chow chow** (added 2026-10-31 at the parent's request): a big, fluffy, tan chow chow lives on every lawn. He wanders about, stops to sniff or to watch the vehicle, and runs off whenever the vehicle comes within about 5 units, with a friendly "wuf-wuf" at most every 6 seconds. He then pants with his blue-black tongue. He's faster than the fastest vehicle, picks the free spot furthest from the vehicle without running past it, and never blocks or gets hit: if the two ever meet, only the dog is nudged aside. He doesn't mow, and he doesn't count towards anything.

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
- **Celebration** (automatic, at about 80% mowed):
  1. The leftover tufts get zoom-cut.
  2. The vehicle drives itself to the compost corner.
  3. The catcher or trailer tips up and pours out a ridiculously huge pile, made of that lawn's own cut grass: its colours, loose clippings sticking out, and flower heads if the lawn had flowers (2026-11-01). The clippings flying while mowing, and the grass in the catcher, match the lawn too.
  4. Confetti, a fanfare and "Well done!".
  5. The next lawn starts.

## 8. Presents and decorations

- Each lawn hides 3 wrapped presents in the tall grass. When one is mowed it pops open, and an item flies onto the vehicle with a sparkle sound.
- **Bonus presents** (added 2026-11-01 at the parent's request): every 25 to 35 seconds of play, a present floats down on a little parachute, with a slide whistle, somewhere ahead of the vehicle. It lands with a puff of confetti, then bounces and sparkles until it's driven over. Each one found joins the gift row at the top in its wrapping colour (up to 9 extra). At most 3 wait on the lawn at once.
- Presents come in different wrappings: 8 colours, 4 ribbon colours, and 4 shapes (cube, tall, flat, round hatbox). The 3 hidden ones keep the pink, blue and yellow that match the gift row.
- **Pool:** 69 purely visual items (grown from about 25 on 2026-11-01, at the parent's request):
  - **Vinyls:** flames, stars, racing stripes, flowers, lightning bolts, a rainbow, a dinosaur, a big number, hearts, polka dots, paw prints, butterflies, checkers, music notes, a sun, a moon, a ladybird, a chequered flag.
  - **Lights:** headlights, a flashing orange roof beacon, a light bar, underglow, fairy lights, rainbow party lights, twinkling stars.
  - **Roof:** a flag on a pole, a chrome exhaust stack, a bunch of balloons, a pinwheel, a striped parasol, a disco ball, a helicopter rotor, a rainbow arch.
  - **Hubcaps:** chrome, gold, rainbow, flower, star, lollipop swirl, football.
  - **Driver's hats:** cowboy, crown, cap, party, pirate, wizard, chef, viking, top hat, propeller beanie, bunny ears, flower crown, astronaut bubble.
  - **Pets riding on the bonnet:** duck, chick, kitten, bunny, frog, penguin, teddy, and a mini chow chow puppy. They hop, waddle and look around.
  - **Magic trails** behind the moving vehicle: bubbles, sparkles, flower petals, a rainbow, confetti.
- Each item has a spot on the vehicle (side, bonnet, roof, lights, wheels, driver's hat, pet, trail). A new find replaces whatever is in that spot.
- Decorations are shared between the mower and the tractor.
- The vehicle starts plain on every lawn (changed 2026-11-01 at the parent's request; decorations used to build up across lawns within a session).
- **Presents take turns between the kinds of thing** (added 2026-11-01): every spot comes round once, in a shuffled order (side sticker, bonnet sticker, roof, lights, wheels, hat, pet, trail), before any comes again, and never the same spot twice in a row. So there's no new hat straight after a hat. Within a spot, it's something not found yet this session.
- Once everything for a spot has been found in a session, presents for that spot pick something different from what's on now.

## 8b. Garden life (added 2026-11-01 at the parent's request)

- **Carrots:** every 9 to 15 seconds, once some grass is cut, a carrot top (leaves and an orange shoulder, wiggling) sprouts somewhere on the mowed part. There are at most 4 at once. Driving over one pulls the whole carrot up with a "pluck", and it joins a carrot row under the gift row (up to 15 shown). The row starts empty on each lawn.
- **The bunny:** when a carrot has been up for 5 seconds, a bunny pops in a few steps away, on the side away from the vehicle, and hops over to nibble it. It takes about 14 seconds to finish one; if it does, the carrot is gone with a "munch". When the vehicle comes within 5 units, the bunny dashes off fast and vanishes in a puff. There's one bunny at a time, with at least 12 seconds between visits.
- **Molehills:** every 18 to 28 seconds a molehill pushes up in the mowed grass, with a puff of dirt. There are at most 3, and now and then a mole peeks out of the top. Driving over one flattens it. The chow likes them: when he's idle he often trots over and digs, front paws scrabbling and dirt flying, until the vehicle comes near.

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

## 13. Second game: SuperTuxKart

Agreed on 2026-10-31.

- **Install:** SuperTuxKart 1.5, the official self-contained ARM64 download, goes into `~/.local/opt` (`pi/install-supertuxkart.sh`, run by `pi/setup.sh`). Raspberry Pi OS ships 1.4, which can't be told to use the wheel when it starts straight into a race.
- **In the picker:** it only appears once it's installed.
- **Starting:** picking it launches it straight into a race, skipping SuperTuxKart's text menus:
  - easiest difficulty (Novice)
  - the child plus 3 AI karts
  - 2 laps on a short track
  - kart and track picked at random from a friendly list in `games/supertuxkart/game.json`
- **Controls:** the wheel steers. The **gas pedal** accelerates and the brake pedal brakes (agreed: no auto-accelerate helper). The pedals are bound in SuperTuxKart's own controls on the Pi.
- **Ending:** when the race ends, the results show for a few seconds and then SuperTuxKart closes, back to the picker.
- **Getting out:** holding the two parent buttons for 5 seconds closes SuperTuxKart at any time, back to the picker.
- **Back to the games:** Grassnyer's parent settings have a "Back to the games" item.
- **Play timer:** it only counts time in Grassnyer. SuperTuxKart races are short and always end back at the picker.
- **Speed:** unknown until it runs on the Pi. It starts at 1280x720 with the simple renderer, no shadows and no dynamic lights. Claude on the Pi measures the speed and tunes these.
