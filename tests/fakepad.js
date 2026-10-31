// Injected before page scripts: replaces navigator.getGamepads with a
// controllable fake wheel (xpad-style raw layout) for headless tests.
(() => {
  const pad = {
    id: 'Fake Wheel (Vendor: 11ff Product: 0511)', index: 0, connected: true, mapping: '',
    timestamp: 0,
    axes: [0, 0, -1, 0, 0, -1, 0, 0],
    buttons: Array.from({ length: 11 }, () => ({ pressed: false, touched: false, value: 0 })),
    vibrationActuator: { type: 'dual-rumble', playEffect: (t, p) => { window.__rumbles = (window.__rumbles || 0) + 1; return Promise.resolve('complete'); } },
  };
  window.__pad = pad;
  window.__setSteer = (v) => { pad.axes[0] = v; };
  window.__press = (i, down) => { pad.buttons[i].pressed = down; pad.buttons[i].value = down ? 1 : 0; };
  navigator.getGamepads = () => [pad, null, null, null];
})();
