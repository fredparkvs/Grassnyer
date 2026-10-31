# Grassnyer

Steering-wheel games for a 4 year old on a Raspberry Pi 5 plugged into the TV,
chosen from a picture game picker: **Grassnyer** (our own mowing game) and
**SuperTuxKart** (kart racing).

## Grassnyer

Pick a ride-on mower or a tractor and a colour. Then mow the tall grass, find
the presents hidden in it (each one adds flames, lights, hubcaps or a hat to
the vehicle) and finish each lawn with a ridiculous grass pile and confetti.
There's no reading, no losing and no timer pressure. The full design is in
[SPEC.md](SPEC.md).

## SuperTuxKart

[SuperTuxKart](https://supertuxkart.net) (free and open source, GPL) is
installed by the Pi setup.
- **Starting:** picking it in the game picker jumps straight into a short,
  easy race (2 laps against 3 slow AI karts, random friendly kart and track).
- **Driving:** steer with the wheel and press the **gas pedal** to go.
- **Ending:** when the race ends, the results show for a few seconds and then
  it goes back to the picker.
- **Getting out early:** hold the two parent buttons for 5 seconds.

## Setting up the Pi

You'll need a Raspberry Pi 5 (8 GB), an SD card, the TV, the wheel, and a
keyboard and mouse for this one-time setup.

1. Flash **Raspberry Pi OS (64-bit)** with Raspberry Pi Imager. In its settings,
   set the hostname to `grassnyer`, turn on SSH, and set your username, password
   and Wi-Fi.
2. Boot the Pi, open a terminal and install Claude Code:
   ```
   curl -fsSL https://claude.ai/install.sh | bash
   ```
   Then close the terminal and open a new one.
3. Download the game (this becomes Claude's "workshop" copy):
   ```
   git clone -b main https://github.com/fredparkvs/Grassnyer.git ~/Grassnyer
   ```
4. Start Claude once to log in (it opens the Pi's browser) and trust the folder.
   Type `/exit` when it's ready:
   ```
   cd ~/Grassnyer && claude
   ```
5. Start Remote Control so you can talk to it from the Claude app:
   ```
   cd ~/Grassnyer && claude remote-control
   ```
6. In the Claude app, open that session and say **"Set up the Pi"**. Claude
   runs `pi/setup.sh`, asking before anything that needs admin rights. It
   then helps you test the wheel and add a deploy key on GitHub, and asks
   before rebooting.

After the reboot the game opens full screen by itself. Claude stays reachable
from the app because Remote Control starts at boot.

## Parent controls

Hold the two parent buttons for 5 seconds (you choose them in **Wheel setup**),
or press **Ctrl+Shift+P** on a keyboard. From there you can:

- **Driving:** auto-drive (steer only, the default) or pedals
- **Max speed**, **Steering**, **Music**, **Volume** and **Vibration** (bumps only)
- **Play timer:** off, or 10 to 60 minutes. When time's up the vehicle drives
  into the shed to sleep, and only the parent buttons wake it.
- **Wheel setup:** teach the game your wheel's axes and buttons
- **Back to the games:** return to the game picker
- **Update**, **Go back** and **Quit to desktop**

If nobody touches the wheel for 20 seconds the vehicle waits. After 10
minutes it goes to sleep in the shed. The next touch opens the game picker,
and Grassnyer starts fresh: plain vehicle, on to the next lawn.

## Your voice

Record short clips like "Let's mow!" and "Well done!" and put them in
[`voice/`](voice/README.md). The file names are listed there.

## Changing the game

Ask Claude in the Claude app (it runs on the Pi). It works in `~/Grassnyer`,
tests changes without touching the TV, and only pushes them to GitHub when
you say **"ship it"**. Then press **Update** in the parent settings. If the
new version misbehaves, **Go back** restores the previous one.

## Developing

```
python3 kit/server.py 8322    # open http://127.0.0.1:8322/
npm test                      # headless end-to-end test, screenshots in test-output/
```

Keyboard: arrow keys steer, Up/Down for gas and brake, Space for Stop/Go,
C for magic paint.

Everything is built in code, with no image, model or sound files to license.
three.js (MIT) is bundled in `vendor/three/`.
