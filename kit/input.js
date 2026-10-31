// Steering wheel (Gamepad API) plus a keyboard fallback for testing.
//
// The cheap wheel is not a "standard" gamepad, so axes and buttons come in
// raw. The parent "Wheel setup" screen records which axis/button is which and
// saves it in settings.wheel; until then we guess the usual Linux xpad layout.

import { settings } from './settings.js';

const STEER_DEADZONE = 0.05;
const PEDAL_DEADZONE = 0.08;
const ACTIVITY_STEER = 0.06;
const PARENT_HOLD_SECONDS = 5;

// The gear lever (gearForward / gearReverse) is like a pedal: { button: n },
// { axis: n, rest, full }, or { raw: n } for a button the browser can't see
// (read by the game server, see RawJoystick below). null means no lever.

// Wheels found by testing on the Pi (docs/wheel-notes.md), matched by the
// name the driver reports. The "SHANWAN PS3 GamePad" wheel pretends to be a
// PS3 pad but has no X axis, which throws Chromium's PS3 layout off by one:
// steering still lands on axis 0, but L2/R2 (its gear lever) are lost.
const KNOWN_WHEELS = [
  { name: /SHANWAN PS3 GamePad/i, gearForward: { raw: 7 }, gearReverse: { raw: 6 } },
];

export function defaultMapping(pad, rawName = '') {
  const known = KNOWN_WHEELS.find((w) => w.name.test(rawName) || w.name.test(pad?.id || ''));
  const lever = { gearForward: known?.gearForward || null, gearReverse: known?.gearReverse || null };
  if (pad && pad.mapping === 'standard') {
    return {
      gamepadId: null,
      steer: { axis: 0, left: -1, center: 0, right: 1 },
      gas: { button: 7 },
      brake: { button: 6 },
      goButton: 0,
      paintButton: 1,
      parentButtons: [8, 9],
      ...lever,
    };
  }
  // Linux xpad / joydev order: X, Y, Z(LT), RX, RY, RZ(RT), hat X, hat Y.
  return {
    gamepadId: null,
    steer: { axis: 0, left: -1, center: 0, right: 1 },
    gas: { axis: 5, rest: -1, full: 1 },
    brake: { axis: 2, rest: -1, full: 1 },
    goButton: 0,
    paintButton: 1,
    parentButtons: [6, 7],
    ...lever,
  };
}

// Buttons read straight from the wheel by the game server (GET /api/joystick),
// numbered as Linux numbers them. Only controls mapped as { raw: n } use them.
export class RawJoystick {
  constructor(url = '/api/joystick') {
    this.name = '';
    this.down = new Set();
    this.pending = new Set();   // pressed since the last poll, even if already let go
    this.lastChange = 0;
    this._presses = null;
    if (typeof EventSource === 'undefined') return;
    try {
      this.source = new EventSource(url);
      this.source.onmessage = (e) => { try { this._update(JSON.parse(e.data)); } catch (err) { /* ignore */ } };
      // lost the server (e.g. restarting after Update): it reconnects by itself
      this.source.onerror = () => { this._presses = null; this.down = new Set(); };
    } catch (e) { /* no server: the Gamepad API and keyboard still work */ }
  }

  _update(s) {
    this.name = s.name || '';
    const down = new Set(s.buttons || []);
    const presses = s.presses || {};
    if (this._presses) {   // the first update after (re)connecting is only a starting point
      for (const [n, c] of Object.entries(presses)) {
        if (c > (this._presses[n] || 0)) this.pending.add(Number(n));
      }
      if (this.pending.size || down.size !== this.down.size || [...down].some((n) => !this.down.has(n))) {
        this.lastChange = performance.now();
      }
    }
    this._presses = presses;
    this.down = down;
  }

  isDown(n) { return this.down.has(n) || this.pending.has(n); }

  endPoll() { this.pending.clear(); }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function makeButton() { return { down: false, pressed: false, released: false }; }

export class Wheel {
  constructor() {
    this.steer = 0;        // -1 (left) .. 1 (right), calibrated
    this.gas = 0;          // 0..1
    this.brake = 0;        // 0..1
    this.go = makeButton();
    this.paint = makeButton();
    this.gearForward = makeButton();  // gear lever pushed forward
    this.gearReverse = makeButton();  // gear lever pulled back
    this.any = makeButton();      // any wheel button or confirm key
    this.raw = new RawJoystick(); // buttons the browser can't see, via the game server
    this.connected = false;
    this.padId = '';
    this.lastActivity = performance.now();
    this.parentHold = 0;          // seconds the parent combo has been held
    this.onParent = null;         // callback when the parent combo fires
    this.enabled = true;          // games disable input while the parent menu is open

    this._keys = new Set();
    this._tapped = new Set();     // keys pressed since the last poll, even if already let go
    this._kbSteer = 0;
    this._prevButtons = [];
    this._steerAnchor = 0;
    this._pedalArmed = { gas: false, brake: false };
    this._parentFired = false;
    this._lastPoll = performance.now();

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
        e.preventDefault();
        this.onParent?.();
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      this._keys.add(e.code);
      this._tapped.add(e.code);
      this.lastActivity = performance.now();
    });
    window.addEventListener('keyup', (e) => this._keys.delete(e.code));
    window.addEventListener('blur', () => this._keys.clear());
  }

  mapping() {
    const saved = settings().wheel;
    if (!saved) return defaultMapping(this.pad, this.raw.name);
    if (saved.gearForward !== undefined) return saved;
    // Saved by a wheel setup from before the gear lever existed: borrow the
    // default lever, unless setup gave those buttons another job.
    const d = defaultMapping(this.pad, this.raw.name);
    const taken = [saved.gas?.button, saved.brake?.button, saved.goButton, saved.paintButton, ...(saved.parentButtons || [])];
    const free = (g) => (g && (g.button == null || !taken.includes(g.button)) ? g : null);
    return { ...saved, gearForward: free(d.gearForward), gearReverse: free(d.gearReverse) };
  }

  findPad() {
    const pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);
    const saved = settings().wheel?.gamepadId;
    return (saved && pads.find((p) => p.id === saved)) || pads.find((p) => p.axes.length > 0) || null;
  }

  poll() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this._lastPoll) / 1000);
    this._lastPoll = now;

    const pad = this.findPad();
    this.pad = pad;
    this.connected = !!pad;
    this.padId = pad ? pad.id : '';
    const m = this.mapping();

    // ---- wheel -------------------------------------------------------
    let steer = 0, gas = 0, brake = 0;
    let goDown = false, paintDown = false, anyDown = false;
    let fwdDown = false, revDown = false;
    let parentDown = false;
    if (pad) {
      steer = normSteer(pad.axes[m.steer.axis] ?? 0, m.steer);
      gas = this._pedal(pad, m.gas, 'gas');
      brake = this._pedal(pad, m.brake, 'brake');

      const btn = (i) => i != null && i >= 0 && !!pad.buttons[i]?.pressed;
      goDown = btn(m.goButton);
      paintDown = btn(m.paintButton);
      // pedals and the gear lever are for driving, not for "press to choose"
      const drivingButtons = [m.gas?.button, m.brake?.button, m.gearForward?.button, m.gearReverse?.button];
      anyDown = pad.buttons.some((b, i) => b.pressed && !drivingButtons.includes(i));
      parentDown = m.parentButtons?.length === 2 && btn(m.parentButtons[0]) && btn(m.parentButtons[1]);

      const changed = pad.buttons.some((b, i) => b.pressed !== (this._prevButtons[i] || false));
      if (changed) this.lastActivity = now;
      this._prevButtons = pad.buttons.map((b) => b.pressed);
    }
    // the gear lever may come from the server even before the browser shows the wheel
    fwdDown = level(pad, m.gearForward, this.raw) > 0.6;
    revDown = level(pad, m.gearReverse, this.raw) > 0.6;
    if (fwdDown || revDown) this.lastActivity = now;
    if (this.raw.lastChange > this.lastActivity) this.lastActivity = this.raw.lastChange;
    this.raw.endPoll();

    // ---- keyboard ----------------------------------------------------
    // a tap shorter than a frame still counts once (slow frames on the Pi)
    const k = new Set([...this._keys, ...this._tapped]);
    this._tapped.clear();
    const kbTarget = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const rate = kbTarget === 0 ? 6 : 3;
    this._kbSteer += clamp(kbTarget - this._kbSteer, -rate * dt, rate * dt);
    if (Math.abs(this._kbSteer) > Math.abs(steer)) steer = this._kbSteer;
    if (k.has('ArrowUp') || k.has('KeyW')) gas = 1;
    if (k.has('ArrowDown') || k.has('KeyS')) brake = 1;
    if (k.has('Space') || k.has('Enter')) { goDown = true; anyDown = true; }
    if (k.has('KeyC')) { paintDown = true; anyDown = true; }
    if (k.has('KeyF')) fwdDown = true;   // gear lever forward
    if (k.has('KeyR')) revDown = true;   // gear lever back (reverse)

    if (!this.enabled) { steer = 0; gas = 0; brake = 0; goDown = paintDown = anyDown = fwdDown = revDown = false; }

    // dead zone, then rescale so small turns still register smoothly
    const a = Math.abs(steer);
    this.steer = a < STEER_DEADZONE ? 0 : Math.sign(steer) * (a - STEER_DEADZONE) / (1 - STEER_DEADZONE);
    this.gas = gas;
    this.brake = brake;

    if (Math.abs(this.steer - this._steerAnchor) > ACTIVITY_STEER) {
      this._steerAnchor = this.steer;
      this.lastActivity = now;
    }
    if (gas > 0.2 || brake > 0.2) this.lastActivity = now;

    setButton(this.go, goDown);
    setButton(this.paint, paintDown);
    setButton(this.gearForward, fwdDown);
    setButton(this.gearReverse, revDown);
    setButton(this.any, anyDown);

    // ---- parent combo ------------------------------------------------
    if (parentDown) {
      this.parentHold += dt;
      if (this.parentHold >= PARENT_HOLD_SECONDS && !this._parentFired) {
        this._parentFired = true;
        this.onParent?.();
      }
    } else {
      this.parentHold = 0;
      this._parentFired = false;
    }
    return this;
  }

  _pedal(pad, p, name) {
    if (!p) return 0;
    if (p.button != null) return pad.buttons[p.button]?.value ?? 0;
    const v = pad.axes[p.axis];
    if (v == null) return 0;
    // Some drivers report 0 for trigger axes until they first move, which
    // would look like a half-pressed pedal. Ignore a pedal until it has been
    // seen at rest once.
    if (!this._pedalArmed[name]) {
      if (Math.abs(v - p.rest) < 0.15) this._pedalArmed[name] = true;
      else return 0;
    }
    const t = clamp((v - p.rest) / ((p.full - p.rest) || 1), 0, 1);
    return t < PEDAL_DEADZONE ? 0 : (t - PEDAL_DEADZONE) / (1 - PEDAL_DEADZONE);
  }

  idleSeconds() {
    return (performance.now() - this.lastActivity) / 1000;
  }

  markActive() { this.lastActivity = performance.now(); }

  rumble(strength = 0.6, ms = 180) {
    if (!settings().vibration) return;
    const pad = this.pad;
    if (!pad) return;
    try {
      if (pad.vibrationActuator?.playEffect) {
        pad.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0, duration: ms,
          strongMagnitude: clamp(strength, 0, 1),
          weakMagnitude: clamp(strength * 0.7, 0, 1),
        }).catch(() => {});
      } else if (pad.hapticActuators?.[0]?.pulse) {
        pad.hapticActuators[0].pulse(strength, ms);
      }
    } catch (e) { /* rumble is a bonus, never an error */ }
  }
}

// 0..1 for a { button }, { axis, rest, full } or { raw } control, such as the
// gear lever. No "seen at rest" check like the pedals: an axis that reads 0
// before it first moves is half way, which is not enough to count as pushed.
export function level(pad, c, raw) {
  if (!c) return 0;
  if (c.raw != null) return raw?.isDown(c.raw) ? 1 : 0;
  if (!pad) return 0;
  if (c.button != null) return pad.buttons[c.button]?.value ?? 0;
  const v = pad.axes[c.axis];
  if (v == null) return 0;
  return clamp((v - c.rest) / ((c.full - c.rest) || 1), 0, 1);
}

// Works whichever way round the wheel reports left and right.
export function normSteer(raw, s) {
  const t = raw - s.center;
  const toRight = s.right - s.center;
  const toLeft = s.left - s.center;
  if (t === 0) return 0;
  if (Math.sign(t) === Math.sign(toRight)) return clamp(t / (toRight || 1), 0, 1);
  return -clamp(t / (toLeft || -1), 0, 1);
}

function setButton(b, down) {
  b.pressed = down && !b.down;
  b.released = !down && b.down;
  b.down = down;
}
