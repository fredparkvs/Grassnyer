# Wheel notes (measured on the Pi, 2026-10-31)

## What the wheel really is

Not the DragonRise IDs the spec guessed. Plugged into the Pi it reports as a
PlayStation 3 controller, driven by the kernel's `hid-sony`:

- USB `054c:0268`, name **"SHANWAN PS3 GamePad"**, input device version `0x8110`
- `/dev/input/by-id/usb-SHANWAN_PS3_GamePad-event-joystick` (evdev) and `js0` (joydev)
- A second device, "SHANWAN PS3 GamePad Motion Sensors", can be ignored.

We haven't tried the MODE button yet, so it's not known whether it has X-input or
D-input modes, or whether it always starts in this PS3 mode.

### Axes (evdev)

| Axis | What | Values |
|------|------|--------|
| `ABS_Y` | **steering** | 0..255, centre about 122-128, full lock reaches about 241 |
| `ABS_Z` | L2 | 0 or 255 only (digital), along with button `BTN_TL2` |
| `ABS_RX`, `ABS_RY` | unused | sit at 128 |
| `ABS_RZ` | R2 | 0 or 255 only (digital), along with button `BTN_TR2` |

There is **no `ABS_X`**. That one missing axis is what confuses Chromium (below).

### Buttons (Linux joystick numbers, as `jstest` and `native.py` see them)

0 cross, 1 circle, 2 triangle, 3 square, 4 L1, 5 R1, **6 L2, 7 R2**, 8 select,
9 start, 10 PS, 11 L3, 12 R3, 13-16 d-pad up/down/left/right. This is the same as a
real PS3 pad.

## What Chromium (the game) sees

`navigator.getGamepads()` reports `SHANWAN PS3 GamePad (STANDARD GAMEPAD Vendor:
054c Product: 0268)`, with `mapping: "standard"`, 4 axes, 17 buttons and a
`vibrationActuator`. Here's what works and what doesn't:

- **Steering: works**, on axis 0 (full lock is about ±0.85 to ±1).
- Face buttons: cross is button 0 (Stop/Go), circle is 1 (paint), triangle 3, square 2.
  Select and start are 8 and 9, the default parent buttons.
- **L2 and R2 never reach the page.** We pressed them while watching
  `getGamepads()` and nothing changed. The reason: Chromium reads joydev axes by
  number, and its PS3 layout (`MapperDualshock3SixAxisNew` in
  `device/gamepad/gamepad_standard_mappings_linux.cc`) builds the L2/R2 buttons from
  axes 2 and 5. Without `ABS_X`, every axis on this wheel shifts down one place, so
  axis 2 is the unused `ABS_RX` and axis 5 doesn't exist. Steering lands on axis 0
  by luck.

## The gear lever

When the child rocks the gear lever, L2 and R2 alternate, each held for about
0.3 s with a short gap between. That looks like a two-way lever, not pedals.
**This still needs confirming with the parent**, along with which way is forward.
For now the default is: forward = R2 (raw 7), reverse = L2 (raw 6).

Because Chromium loses L2/R2, the game server reads them itself: `GET
/api/joystick` in `kit/server.py` streams the raw `js*` buttons, and `kit/input.js`
maps the lever as `{ raw: 7 }` / `{ raw: 6 }`. See `KNOWN_WHEELS` in `kit/input.js`.
Wheel setup in the parent settings can record the lever too (button, axis or raw).

## Still to find out

- **Pedals.** Not seen yet. If they're plugged in, press them while running
  `evtest` and see whether they show up on `ABS_RX`/`ABS_RY` or elsewhere. The
  game's default pedals (standard buttons 6/7) won't work on this wheel, so
  pedals mode needs Wheel setup or a mapping, once we know where the pedals are.
- **Rumble.** Chromium offers `vibrationActuator`, but we haven't felt it rumble yet.
- **Modes.** What holding MODE does, and whether another mode avoids the Chromium
  problem altogether.

## How this was measured

- A small Python script read `/dev/input/by-id/...-event-joystick` (read-only,
  not grabbed, so the game kept working) and logged buttons and big axis moves.
- A hidden headless Chromium (playwright-core with `/usr/bin/chromium`) logged
  `navigator.getGamepads()`. The pad only shows up after a button press or a big
  axis move. Neither touches the TV.

## Tests on the Pi

On the Pi, `npm test` gives 6 smoke failures (colour step, auto-drive speed, paint,
remembered colour, and the run timing out at the play timer) and 2 native failures
(the race end). The unchanged code fails exactly the same checks: the hidden test
browser renders in software on the Pi, so game time runs slower than the tests
expect. The gear lever checks pass.
