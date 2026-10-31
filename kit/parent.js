// Parent-only settings screen and the wheel setup wizard.
//
// Opened by holding the two parent buttons for 5 seconds, or Ctrl+Shift+P.
// Navigate with the wheel (turn to move, Stop/Go button to change) or the
// keyboard (Up/Down to move, Left/Right/Enter to change, Escape to close).

import { settings, updateSettings, saveNow } from './settings.js';
import { defaultMapping, normSteer } from './input.js';

const TIMER_STEPS = [0, 10, 15, 20, 30, 45, 60];

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export class ParentMenu {
  constructor({ wheel, sound, onOpen, onClose, onSettingsChanged }) {
    this.wheel = wheel;
    this.sound = sound;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onSettingsChanged = onSettingsChanged;
    this.isOpen = false;
    this.index = 0;
    this.status = '';
    this.version = null;
    this.wizard = null;
    this._steerArmed = true;
    this._repeatAt = 0;

    this.root = el('div', 'parent-menu hidden');
    document.body.appendChild(this.root);
    this.hold = el('div', 'parent-hold hidden');
    document.body.appendChild(this.hold);

    wheel.onParent = () => (this.isOpen ? this.close() : this.open());
    window.addEventListener('keydown', (e) => this._key(e));
  }

  // Called every frame by the game so the hold indicator can show.
  tick() {
    const h = this.wheel.parentHold;
    if (h > 1 && !this.isOpen) {
      this.hold.classList.remove('hidden');
      this.hold.style.setProperty('--p', Math.min(1, (h - 1) / 4));
    } else {
      this.hold.classList.add('hidden');
    }
  }

  items() {
    const s = settings();
    const canGoBack = this.version?.canGoBack;
    return [
      { label: 'Driving', value: s.driveMode === 'auto' ? 'Auto-drive (steer only)' : 'Pedals',
        change: () => updateSettings({ driveMode: s.driveMode === 'auto' ? 'pedals' : 'auto' }) },
      { label: 'Max speed', value: dots(s.maxSpeed), adjust: (d) => updateSettings({ maxSpeed: wrap(s.maxSpeed + d, 1, 5) }) },
      { label: 'Steering', value: dots(s.steering), adjust: (d) => updateSettings({ steering: wrap(s.steering + d, 1, 5) }) },
      { label: 'Music', value: s.music ? 'On' : 'Off', change: () => updateSettings({ music: !s.music }) },
      { label: 'Volume', value: `${s.volume} / 10`, adjust: (d) => updateSettings({ volume: wrap(s.volume + d, 0, 10) }) },
      { label: 'Vibration', value: s.vibration ? 'On (bumps only)' : 'Off',
        change: () => { updateSettings({ vibration: !s.vibration }); if (!s.vibration) return; this.wheel.rumble(0.7, 300); } },
      { label: 'Play timer', value: s.playTimerMin ? `${s.playTimerMin} minutes` : 'Off',
        adjust: (d) => {
          const i = TIMER_STEPS.indexOf(s.playTimerMin);
          updateSettings({ playTimerMin: TIMER_STEPS[wrap((i < 0 ? 0 : i) + d, 0, TIMER_STEPS.length - 1)] });
        } },
      { label: 'Wheel setup', value: this.wheel.connected ? 'Wheel connected' : 'No wheel found', action: () => this.startWizard() },
      { label: 'Update', value: 'Install the latest version from GitHub', action: () => this.system('update', 'Checking for updates...') },
      { label: 'Go back', value: canGoBack ? 'Return to the previous version' : 'Nothing to go back to',
        disabled: !canGoBack, action: () => this.system('goback', 'Going back...') },
      { label: 'Quit to desktop', value: '', action: () => this.system('quit', 'Quitting...') },
      { label: 'Back to the game', value: '', action: () => this.close() },
    ];
  }

  async open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.index = 0;
    this.status = '';
    this.root.classList.remove('hidden');
    this.onOpen?.();
    this.render();
    this._loop();
    try {
      this.version = await (await fetch('/api/version', { cache: 'no-store' })).json();
    } catch (e) { this.version = null; }
    this.render();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.wizard = null;
    this.root.classList.add('hidden');
    saveNow();
    this.wheel.markActive();
    this.onClose?.();
  }

  _loop() {
    if (!this.isOpen) return;
    requestAnimationFrame(() => this._loop());
    const w = this.wheel.poll();
    if (this.wizard) { this.wizard.update(); return; }

    // wheel navigation: turn to move between rows, Stop/Go to change
    const now = performance.now();
    const st = w.steer;
    if (Math.abs(st) < 0.25) this._steerArmed = true;
    if (Math.abs(st) > 0.5 && (this._steerArmed || now > this._repeatAt)) {
      this._repeatAt = now + (this._steerArmed ? 600 : 250);
      this._steerArmed = false;
      this.move(st > 0 ? 1 : -1);
    }
    if (w.go.pressed) this.activate(1);
    if (w.paint.pressed) this.activate(-1);
  }

  _key(e) {
    if (!this.isOpen) return;
    if (this.wizard) {
      if (e.code === 'Escape') { this.wizard = null; this.render(); }
      else if (e.code === 'Enter') this.wizard.skip();
      e.preventDefault();
      return;
    }
    const map = { ArrowUp: () => this.move(-1), ArrowDown: () => this.move(1),
      ArrowLeft: () => this.activate(-1), ArrowRight: () => this.activate(1),
      Enter: () => this.activate(1), Space: () => this.activate(1), Escape: () => this.close() };
    if (map[e.code]) { e.preventDefault(); e.stopPropagation(); map[e.code](); }
  }

  move(d) {
    const n = this.items().length;
    this.index = (this.index + d + n) % n;
    this.sound?.play('click');
    this.render();
  }

  activate(d) {
    const item = this.items()[this.index];
    if (!item || item.disabled) return;
    if (item.adjust) item.adjust(d);
    else if (item.change) item.change();
    else if (item.action) { item.action(); return; }
    this.sound?.play('click');
    this.onSettingsChanged?.();
    this.render();
  }

  async system(name, busyText) {
    this.status = busyText;
    this.render();
    try {
      const res = await fetch(`/api/${name}`, { method: 'POST' });
      const out = await res.json();
      this.status = out.message || (out.ok ? 'Done.' : 'Something went wrong.');
      this.render();
      if (out.restarting) {
        this.status += '\nRestarting...';
        this.render();
        await waitForRestart(this.version?.pid);
        location.reload();
      }
    } catch (e) {
      this.status = 'Could not reach the game server.';
      this.render();
    }
  }

  render() {
    if (!this.isOpen) return;
    if (this.wizard) { this.wizard.render(this.root); return; }
    const items = this.items();
    const rows = items.map((it, i) => `
      <div class="pm-row${i === this.index ? ' sel' : ''}${it.disabled ? ' disabled' : ''}">
        <span class="pm-label">${it.label}</span><span class="pm-value">${it.value}</span>
      </div>`).join('');
    const v = this.version;
    this.root.innerHTML = `
      <div class="pm-panel">
        <h1>Parent settings</h1>
        <div class="pm-rows">${rows}</div>
        <pre class="pm-status">${escapeHtml(this.status)}</pre>
        <div class="pm-help">Wheel: turn to move, Stop/Go button to change. Keyboard: arrows, Enter, Esc.</div>
        <div class="pm-foot">Version: ${escapeHtml(v ? v.commit : '...')}${this.wheel.padId ? ' &middot; ' + escapeHtml(this.wheel.padId) : ''}</div>
      </div>`;
  }

  startWizard() {
    this.wizard = new WheelWizard(this.wheel, () => {
      this.wizard = null;
      this.status = 'Wheel setup saved.';
      this.onSettingsChanged?.();
      this.render();
    });
    this.render();
  }
}

// ---------------------------------------------------------------------
// Wheel setup: records which axis and buttons do what.

const STEPS = [
  { id: 'rest', title: 'Hands off', text: 'Let go of the wheel and pedals.' },
  { id: 'left', title: 'Turn the wheel fully LEFT', text: 'Turn it as far as it goes and hold it there.' },
  { id: 'right', title: 'Turn the wheel fully RIGHT', text: 'Turn it as far as it goes and hold it there.' },
  { id: 'gas', title: 'Press the GAS pedal all the way', text: 'Hold it down. Press Enter to skip if you have no pedals.', optional: true },
  { id: 'brake', title: 'Press the BRAKE pedal all the way', text: 'Hold it down. Press Enter to skip.', optional: true },
  { id: 'go', title: 'Press the STOP / GO button', text: 'Pick a big button your child can find easily.' },
  { id: 'paint', title: 'Press the MAGIC PAINT button', text: 'A different button. It changes the vehicle colour.' },
  { id: 'parent1', title: 'Press the FIRST parent button', text: 'Pick one your child is unlikely to hold down.' },
  { id: 'parent2', title: 'Press the SECOND parent button', text: 'Holding both for 5 seconds opens this screen.' },
  { id: 'test', title: 'All done. Try it!', text: 'Turn the wheel and press the pedals to check. Press Stop/Go or Enter to save.' },
];

class WheelWizard {
  constructor(wheel, onDone) {
    this.wheel = wheel;
    this.onDone = onDone;
    this.step = 0;
    this.map = { ...defaultMapping(wheel.pad), steer: null, gas: null, brake: null };
    this.baseline = null;
    this.stepStart = performance.now();
    this.holdSince = 0;
    this.needRelease = false;
    this.used = new Set();
  }

  get current() { return STEPS[this.step]; }

  next() {
    this.step++;
    this.stepStart = performance.now();
    this.holdSince = 0;
    this.needRelease = true;
  }

  skip() {
    const s = this.current;
    if (s.optional) this.next();
    else if (s.id === 'test') this.save();
  }

  save() {
    const pad = this.wheel.pad;
    this.map.gamepadId = pad ? pad.id : null;
    updateSettings({ wheel: this.map });
    saveNow();
    this.onDone();
  }

  update() {
    const pad = this.wheel.pad;
    const now = performance.now();
    const elapsed = (now - this.stepStart) / 1000;
    const root = document.querySelector('.parent-menu');
    if (!pad) { this.render(root); return; }
    const axes = Array.from(pad.axes);
    const pressed = pad.buttons.map((b) => b.pressed);
    if (this.needRelease) {
      if (pressed.some(Boolean) && this.step !== 1 && this.step !== 2) { this.render(root); return; }
      this.needRelease = false;
    }
    const s = this.current;

    if (s.id === 'rest') {
      if (elapsed > 2.5) {
        this.baseline = axes;
        this.next();
      }
    } else if (s.id === 'left' || s.id === 'right') {
      const axis = s.id === 'right' ? this.map.steer?.axis : this._biggestAxis(axes, [])?.axis;
      if (axis != null) {
        const delta = axes[axis] - this.baseline[axis];
        const ok = Math.abs(delta) > 0.4 && (s.id === 'left' || Math.sign(delta) !== Math.sign(this.map.steer.left - this.map.steer.center));
        if (ok) {
          if (!this.holdSince) this.holdSince = now;
          if (now - this.holdSince > 700) {
            const center = this.baseline[axis];
            if (s.id === 'left') this.map.steer = { axis, left: axes[axis], center, right: 2 * center - axes[axis] };
            else this.map.steer.right = axes[axis];
            this.next();
          }
        } else this.holdSince = 0;
      }
    } else if (s.id === 'gas' || s.id === 'brake') {
      const exclude = [this.map.steer.axis];
      if (s.id === 'brake' && this.map.gas?.axis != null) exclude.push(this.map.gas.axis);
      const cand = this._biggestAxis(axes, exclude);
      const btn = pressed.findIndex((p, i) => p && !this.used.has(i));
      if (cand && Math.abs(cand.delta) > 0.4) {
        if (!this.holdSince) this.holdSince = now;
        if (now - this.holdSince > 500) {
          this.map[s.id] = { axis: cand.axis, rest: this.baseline[cand.axis], full: axes[cand.axis] };
          this.next();
        }
      } else if (btn >= 0) {
        this.map[s.id] = { button: btn };
        this.used.add(btn);
        this.next();
      } else {
        this.holdSince = 0;
        if (elapsed > 15) this.next();
      }
    } else if (['go', 'paint', 'parent1', 'parent2'].includes(s.id)) {
      const btn = pressed.findIndex((p, i) => p && !this.used.has(i));
      if (btn >= 0) {
        this.used.add(btn);
        if (s.id === 'go') this.map.goButton = btn;
        if (s.id === 'paint') this.map.paintButton = btn;
        if (s.id === 'parent1') this.map.parentButtons = [btn, -1];
        if (s.id === 'parent2') this.map.parentButtons[1] = btn;
        this.next();
      }
    } else if (s.id === 'test') {
      if (pressed[this.map.goButton]) { this.save(); return; }
    }
    this.render(root);
  }

  _biggestAxis(axes, exclude) {
    let best = null;
    axes.forEach((v, i) => {
      if (exclude.includes(i) || this.baseline[i] == null) return;
      const delta = v - this.baseline[i];
      if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { axis: i, delta };
    });
    return best;
  }

  render(root) {
    if (!root) return;
    const pad = this.wheel.pad;
    const s = this.current;
    let live = '';
    if (pad) {
      const bars = Array.from(pad.axes).map((v, i) => `
        <div class="wz-axis"><span>Axis ${i}</span><div class="wz-bar"><i style="left:${(v + 1) * 50}%"></i></div></div>`).join('');
      const btns = pad.buttons.map((b, i) => `<span class="wz-btn${b.pressed ? ' on' : ''}">${i}</span>`).join('');
      live = `<div class="wz-live">${bars}<div class="wz-btns">${btns}</div></div>`;
    }
    let test = '';
    if (s.id === 'test' && pad) {
      const m = this.map;
      const steer = normSteer(pad.axes[m.steer.axis] ?? 0, m.steer);
      const pedal = (p) => !p ? 0 : p.button != null ? (pad.buttons[p.button]?.value ?? 0)
        : Math.max(0, Math.min(1, ((pad.axes[p.axis] ?? p.rest) - p.rest) / ((p.full - p.rest) || 1)));
      test = `<div class="wz-test">
        <div>Steering <div class="wz-bar"><i style="left:${(steer + 1) * 50}%"></i></div></div>
        <div>Gas <div class="wz-bar"><i style="left:${pedal(m.gas) * 100}%"></i></div></div>
        <div>Brake <div class="wz-bar"><i style="left:${pedal(m.brake) * 100}%"></i></div></div></div>`;
    }
    root.innerHTML = `
      <div class="pm-panel wizard">
        <h1>Wheel setup <small>step ${this.step + 1} of ${STEPS.length}</small></h1>
        ${pad ? '' : '<p class="wz-warn">No wheel found. Plug it in (and try its MODE button).</p>'}
        <h2>${s.title}</h2>
        <p>${s.text}</p>
        ${test}
        ${live}
        <div class="pm-help">Esc cancels without saving.</div>
      </div>`;
  }
}

// ---------------------------------------------------------------------

function dots(n) { return '●'.repeat(n) + '○'.repeat(5 - n); }
function wrap(v, lo, hi) { return v > hi ? lo : v < lo ? hi : v; }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

async function waitForRestart(oldPid) {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 1500));
  while (Date.now() - start < 60000) {
    try {
      const v = await (await fetch('/api/version', { cache: 'no-store' })).json();
      if (v.pid !== oldPid) return;
    } catch (e) { /* still restarting */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
