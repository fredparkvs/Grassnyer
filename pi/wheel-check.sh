#!/usr/bin/env bash
# Shows what Linux sees of the steering wheel. Run with the wheel plugged in,
# then again after holding the wheel's MODE button for 3 seconds (X-input vs
# D-input mode).
echo "== USB devices"
lsusb
echo
echo "== Input devices that look like a wheel or gamepad"
awk 'BEGIN{RS=""} /js[0-9]/' /proc/bus/input/devices
echo
echo "== Rumble support (FF line present and non-zero = the driver offers force feedback)"
awk 'BEGIN{RS=""} /js[0-9]/ {print; print "--"}' /proc/bus/input/devices | grep -E "^N:|^B: FF=" || echo "none found"
echo
echo "== Kernel drivers built with rumble"
if [ -r /proc/config.gz ]; then
  zcat /proc/config.gz | grep -E "JOYSTICK_XPAD|DRAGONRISE|HID_PID" || true
else
  echo "(run: sudo modprobe configs, then try again)"
fi
echo
echo "== Next steps"
echo "  evtest                      pick the wheel, then turn it and press pedals/buttons"
echo "  fftest /dev/input/eventN    test rumble (N from the list above)"
