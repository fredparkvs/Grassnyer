// End-to-end smoke test: runs the real game in headless Chromium with a
// simulated wheel, walks through every part of the flow, and saves
// screenshots to test-output/.
//
//   npm test                      (or: node tests/smoke.cjs)
//   CHROMIUM_PATH=/usr/bin/chromium node tests/smoke.cjs   (on the Pi)
//
// Starts its own server on a spare port with a throwaway settings folder, so
// it never touches the live game or its saved settings.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

let pw, bundledBrowser = true;
try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); bundledBrowser = false; }

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'test-output');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
}

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

// Writes button presses into the fake /dev/input/js0 (a FIFO) that the test
// server reads, one button number per line on stdin.
const JOYSTICK_WRITER = `
import os, struct, sys, time
for _ in range(100):
    try:
        fd = os.open(sys.argv[1], os.O_WRONLY | os.O_NONBLOCK); break
    except OSError: time.sleep(0.1)
else: sys.exit(1)
print('ready', flush=True)
for line in sys.stdin:
    n = int(line)
    os.write(fd, struct.pack('IhBB', 0, 1, 1, n)); time.sleep(0.15)
    os.write(fd, struct.pack('IhBB', 0, 0, 1, n))
`;

async function main() {
  const port = await freePort();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'grassnyer-test-'));
  // a fake joystick, so the server never reads a real wheel during tests
  const input = path.join(data, 'input');
  fs.mkdirSync(input);
  require('child_process').execSync(`mkfifo ${path.join(input, 'js0')}`);
  const server = spawn('python3', [path.join(ROOT, 'kit/server.py')], {
    // HOME too, so native games installed on this machine (SuperTuxKart on the Pi)
    // stay hidden and the picker still skips itself
    env: { ...process.env, GRASSNYER_PORT: String(port), GRASSNYER_DATA: data, GRASSNYER_ROOT: ROOT, GRASSNYER_ALLOW_SYSTEM: '',
      GRASSNYER_INPUT_DIR: input, HOME: data },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 800));

  const launch = {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  };
  // playwright-core has no browser of its own: use the system Chromium (the Pi's)
  const systemChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  else if (!bundledBrowser && systemChromium) launch.executablePath = systemChromium;
  const browser = await pw.chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript({ path: path.join(__dirname, 'fakepad.js') });

  const G = (expr) => page.evaluate(expr);
  const sleep = (ms) => page.waitForTimeout(ms);
  const until = (fn, timeout = 30000) => page.waitForFunction(fn, null, { timeout, polling: 100 });
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const tap = async (i) => { await G(`__press(${i}, true)`); await sleep(200); await G(`__press(${i}, false)`); await sleep(250); };
  const nudge = async (v) => { await G(`__setSteer(${v})`); await sleep(350); await G('__setSteer(0)').catch(() => {}); await sleep(350); };
  // waking reloads the page (via the picker), so poll across the navigation
  const waitForGarage = async (ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) {
      const st = await G('window.__grassnyer && window.__grassnyer.state').catch(() => null);
      if (st === 'garage') return true;
    }
    return false;
  };

  try {
    await page.goto(`http://127.0.0.1:${port}/?idleStop=3&idleSleep=14&hintAfter=2&stuckAfter=4`);
    await until(() => window.__grassnyer && window.__grassnyer.state === 'garage');
    check('picker skips straight to the only game', page.url().includes('/games/mower/'));
    await sleep(600);
    await shot('01-garage-mower');

    // ---- garage ----
    await nudge(1);
    let gar = await G('__grassnyer.garage');
    check('turning the wheel switches to the tractor', gar.type === 'tractor', gar.type);
    await sleep(400);
    await shot('02-garage-tractor');
    await tap(0);
    await nudge(1);
    gar = await G('__grassnyer.garage');
    check('colour step and turning picks the next colour', gar.step === 'colour' && gar.colour === 1, JSON.stringify(gar));
    await shot('03-garage-colour');
    await tap(0);
    await until(() => window.__grassnyer.state === 'play');
    let v = await G('__grassnyer.vehicle');
    check('lawn starts with the chosen vehicle and colour', v.type === 'tractor' && v.colour === 1, `${v.type} ${v.colour}`);
    check('starts plain (no decorations)', Object.keys(v.decorations).length === 0);
    await sleep(1500);
    v = await G('__grassnyer.vehicle');
    check('auto-drive moves forward', v.speed > 1, JSON.stringify({ speed: v.speed, idle: await G('__grassnyer.idleStopped') }));
    await shot('04-lawn1-driving');
    check('mowing makes progress', (await G('__grassnyer.progress')) > 0.005);   // lawns have twice the area now

    // ---- gear lever (the F and R keys stand in for it) ----
    const shiftKey = async (key) => { await page.keyboard.down(key); await sleep(500); await page.keyboard.up(key); };
    await G('__grassnyer.place(3, -2, Math.PI)');   // open lawn behind and ahead
    await shiftKey('KeyR');
    await sleep(1500);
    v = await G('__grassnyer.vehicle');
    check('gear lever back reverses', (await G('__grassnyer.gear')) === -1 && v.speed < -0.8, String(v.speed.toFixed(2)));
    await shot('04b-reversing');
    await shiftKey('KeyF');
    await sleep(1500);
    v = await G('__grassnyer.vehicle');
    check('gear lever forward drives forwards again', (await G('__grassnyer.gear')) === 1 && v.speed > 1, String(v.speed.toFixed(2)));

    // ---- a gear lever only the server can see (Chromium loses it on some wheels) ----
    await G(`Promise.all([import('/kit/settings.js'), import('/kit/input.js')]).then(([s, i]) =>
      s.updateSettings({ wheel: { ...i.defaultMapping(window.__pad), gearForward: { raw: 7 }, gearReverse: { raw: 6 } } }))`);
    await G('__grassnyer.place(3, -2, Math.PI)');
    const writer = spawn('python3', ['-c', JOYSTICK_WRITER, path.join(input, 'js0')], { stdio: ['pipe', 'pipe', 'ignore'] });
    const ready = await Promise.race([
      new Promise((r) => writer.stdout.once('data', () => r(true))),
      new Promise((r) => setTimeout(() => r(false), 12000)),
    ]);
    writer.stdin.write('6\n');
    await sleep(1500);
    v = await G('__grassnyer.vehicle');
    check('server-read gear lever reverses', ready && (await G('__grassnyer.gear')) === -1 && v.speed < -0.8, `ready=${ready} speed=${v.speed.toFixed(2)}`);
    writer.stdin.write('7\n');
    await sleep(1500);
    v = await G('__grassnyer.vehicle');
    check('server-read gear lever drives forwards', (await G('__grassnyer.gear')) === 1 && v.speed > 1, String(v.speed.toFixed(2)));
    writer.stdin.end();
    writer.kill();
    await G(`import('/kit/settings.js').then((s) => s.updateSettings({ wheel: null }))`);

    // ---- every lawn has its own look ----
    const looks = await G(`import('/games/mower/js/lawns.js').then((L) => L.LAWNS.map((l) => [l.look.grass.tip, l.look.sky[0], l.look.grass.blades + '/' + l.look.grass.width].join(' ')))`);
    check('every lawn has its own grass and sky', new Set(looks).size === looks.length && looks.length === 5, looks.join(' | '));

    // ---- surprises: lots of kinds, and every one fits both vehicles ----
    const pool = await G(`Promise.all([import('/games/mower/js/decorations.js'), import('/games/mower/js/vehicle.js')]).then(([D, V]) => {
      const bad = [];
      for (const type of ['mower', 'tractor']) for (const item of D.POOL) {
        try { const v = new V.Vehicle(type, 0); v.setDecoration(item, false); v.update(0.016, 1.3); } catch (e) { bad.push(type + ' ' + item.id + ': ' + e.message); }
      }
      return { count: D.POOL.length, bad };
    })`);
    check('lots of kinds of surprises in presents (60+)', pool.count >= 60, String(pool.count));
    check('every surprise fits both vehicles without errors', pool.bad.length === 0, pool.bad.slice(0, 3).join('; '));

    // ---- a bonus present floats down, lands and can be picked up ----
    await G('__grassnyer.place(3, 3, Math.PI)');
    await G('__grassnyer.dropGift()');
    let bonus = await G('__grassnyer.bonusPresents');
    check('a bonus present floats down', bonus.length === 1 && bonus[0].falling, JSON.stringify(bonus));
    await shot('04d-bonus-falling');
    await G('__press(0, true)'); await sleep(250); await G('__press(0, false)');   // stop and watch it land
    // keep touching the wheel (button 5 has no job) so it doesn't fall asleep while we wait
    for (const end = Date.now() + 25000; Date.now() < end && (await G('__grassnyer.bonusPresents'))[0].falling; ) await tap(5);
    bonus = await G('__grassnyer.bonusPresents');
    check('it lands on the lawn', !bonus[0].falling, JSON.stringify(bonus[0]));
    await G(`__grassnyer.place(${bonus[0].x}, ${bonus[0].z + 0.2}, Math.PI)`);
    await until(() => window.__grassnyer.bonusFound > 0, 8000).catch(() => {});
    check('driving over it opens it', (await G('__grassnyer.bonusFound')) === 1, String(await G('__grassnyer.bonusFound')));
    await G('__press(0, true)'); await sleep(250); await G('__press(0, false)');   // and go again
    // a magic trail present scatters sparkles behind the moving vehicle
    await G("__grassnyer.give('trail-sparkles')");
    await G('__grassnyer.place(3, 4, Math.PI)');
    for (let i = 0; i < 4; i++) await tap(5);
    check('a magic trail goes on the vehicle', (await G('__grassnyer.trail')) === 'trail-sparkles');
    await shot('04e-trail');

    // ---- the chow chow: on the lawn, and runs off when the tractor comes ----
    let dog = await G('__grassnyer.dog');
    const LB = await G('__grassnyer.bounds');
    check('the chow chow is on the lawn', dog.visible && dog.x > LB.minX && dog.x < LB.maxX && dog.z > LB.minZ && dog.z < LB.maxZ, JSON.stringify(dog));
    await G('__grassnyer.place(3, 3, Math.PI)');                 // driving north
    await G('__grassnyer.placeDog(3, 0.2)');                     // right in its path
    const gap = async () => { const d = await G('__grassnyer.dog'), t = await G('__grassnyer.vehicle'); return Math.hypot(d.x - t.x, d.z - t.z); };
    let ran = false;
    for (let i = 0; i < 40; i++) {
      await tap(5);   // keep driving
      if ((await G('__grassnyer.dog')).state === 'run') ran = true;
      if (ran && (await gap()) > 5.5) break;
    }
    await shot('04c-dog');
    check('the chow chow runs away from the tractor', ran && (await gap()) > 5.5, `ran=${ran} gap=${(await gap()).toFixed(1)}`);

    // ---- magic paint ----
    await tap(1);
    v = await G('__grassnyer.vehicle');
    check('magic paint changes the colour', v.colour === 2, String(v.colour));

    // ---- presents ----
    await tap(5); // any button counts as activity, so auto-drive keeps going
    const presents = await G('__grassnyer.presents');
    check('3 presents hidden in the lawn', presents.length === 3, String(presents.length));
    for (const p of presents) {
      await G(`__grassnyer.place(${p.x}, ${p.z + 0.3}, Math.PI)`);
      await sleep(1200);
    }
    v = await G('__grassnyer.vehicle');
    check('finding presents decorates the vehicle', (await G('__grassnyer.gifts')) === 3 && Object.keys(v.decorations).length >= 2,
      JSON.stringify(v.decorations));
    await G('__grassnyer.place(0, 2, Math.PI)');
    await sleep(800);
    await shot('05-decorated');

    // ---- bumping ----
    await tap(5);
    const B = await G('__grassnyer.bounds');
    check('lawns are bigger (lawn 1 is 22.4 wide)', Math.abs(B.maxX - B.minX - 22.4) < 0.01, String(B.maxX - B.minX));
    await G(`__grassnyer.place(0, ${B.minZ + 2.5}, Math.PI)`);   // facing the north fence
    // the simulation can run slower than real time in a headless browser; keep
    // touching the wheel (button 5 has no job) so it doesn't stop to wait
    for (const end = Date.now() + 20000; Date.now() < end && !(await G('window.__rumbles || 0')); ) await tap(5);
    check('hitting the fence rumbles the wheel', (await G('window.__rumbles || 0')) > 0, String(await G('window.__rumbles || 0')));
    // keeps driving into the same bit of fence: after 5 bumps it hops away from it
    // (button 5 has no job: pressing it is just "touching the wheel", so it keeps going)
    for (const end = Date.now() + 25000; Date.now() < end; ) {
      if ((await G('__grassnyer.hops')) > 0 && !(await G('__grassnyer.hopping'))) break;
      await tap(5);
    }
    v = await G('__grassnyer.vehicle');
    check('bumping the same spot 5 times hops away from it', (await G('__grassnyer.hops')) > 0 && v.z > B.minZ + 2.5,
      `hops=${await G('__grassnyer.hops')} z=${v.z.toFixed(1)}`);
    await shot('05b-after-hop');

    // ---- stuck: trying to drive but going nowhere -> countdown -> back to the start ----
    const pinned = await G('[__grassnyer.vehicle.x, __grassnyer.vehicle.z]');
    let sawCountdown = false;
    for (let i = 0, end = Date.now() + 25000; Date.now() < end; i++) {
      if ((await G('__grassnyer.resets')) > 0) break;
      await G(`__grassnyer.place(${pinned[0]}, ${pinned[1]}, 0)`);   // hold it in place, as if wedged
      if (i % 8 === 0) await G('__press(5, true)'); else if (i % 8 === 2) await G('__press(5, false)');   // keep it awake
      if (!sawCountdown && (await G('__grassnyer.countdown')) > 0) { sawCountdown = true; await shot('05c-countdown'); }
      await sleep(100);
    }
    const st = await G('__grassnyer.start');
    v = await G('__grassnyer.vehicle');
    check('stuck for a while: a countdown appears', sawCountdown);
    check('after the countdown it goes back to the start', (await G('__grassnyer.resets')) > 0 && Math.hypot(v.x - st.x, v.z - st.z) < 2,
      `resets=${await G('__grassnyer.resets')} at ${v.x.toFixed(1)},${v.z.toFixed(1)}`);

    // ---- idle stop ----
    await sleep(3600);
    check('vehicle waits when the wheel is left alone', await G('__grassnyer.idleStopped'));
    await shot('06-idle-wheel-hint');
    await nudge(0.4);
    await sleep(800);
    check('touching the wheel carries on', !(await G('__grassnyer.idleStopped')));

    // ---- hints ----
    await tap(0); // stop
    await G('__grassnyer.mowTo(0.7)');
    await until(() => window.__grassnyer.hints, 8000).catch(() => {});
    check('sparkles appear after a while without mowing', await G('__grassnyer.hints'));
    await sleep(600);
    await shot('07-hints');

    // ---- celebration ----
    await G('__grassnyer.mowTo(0.82)');
    await tap(0); // go again
    await until(() => window.__grassnyer.state === 'celebrate', 5000).catch(() => {});
    check('lawn finishes at 80%', (await G('__grassnyer.state')) === 'celebrate');
    await sleep(4300);
    await shot('08-celebrate-pile');
    await sleep(2200);
    await shot('09-celebrate-party');
    await until(() => window.__grassnyer.state === 'play' && window.__grassnyer.lawn === 1, 60000).catch(() => {});
    check('next lawn starts automatically', (await G('__grassnyer.lawn')) === 1);
    v = await G('__grassnyer.vehicle');
    check('decorations carry over to the next lawn', Object.keys(v.decorations).length >= 2);
    await sleep(800);
    await shot('10-lawn2');

    // ---- all lawns render ----
    for (const i of [2, 3, 4]) {
      await G(`__grassnyer.jumpToLawn(${i})`);
      await until(`window.__grassnyer.state === 'play' && window.__grassnyer.lawn === ${i}`, 20000);
      await sleep(900);
      await shot(`11-lawn${i + 1}`);
      check(`lawn ${i + 1} has grass to mow`, (await G('__grassnyer.tufts')) > 1000, String(await G('__grassnyer.tufts')));
    }

    // ---- idle sleep and waking ----
    await until(() => window.__grassnyer.state === 'to-sleep', 25000).catch(() => {});
    check('left alone long enough, it heads to the shed', ['to-sleep', 'sleep'].includes(await G('__grassnyer.state')));
    await sleep(3200);
    await shot('12-into-shed');
    await until(() => window.__grassnyer.state === 'sleep', 10000).catch(() => {});
    check('falls asleep', (await G('__grassnyer.state')) === 'sleep');
    await shot('13-sleep');
    await nudge(0.6);
    const woke = await waitForGarage(10000);
    gar = await G('__grassnyer.garage');
    check('a touch wakes it (via the picker) into the garage', woke);
    check('new session: plain vehicle', Object.keys(gar.decorations || {}).length === 0, JSON.stringify(gar.decorations));
    check('new session: vehicle and colour remembered', gar.type === 'tractor' && gar.colour === 2, JSON.stringify(gar));
    await tap(0); await tap(0);
    await until(() => window.__grassnyer.state === 'play');
    check('new session moves on to the next lawn', (await G('__grassnyer.lawn')) === 0, String(await G('__grassnyer.lawn')));

    // ---- play timer: ends in the shed, only the parent buttons wake it ----
    await page.evaluate(async () => {
      const s = await (await fetch('/api/settings')).json();
      return s;
    });
    await page.keyboard.press('Control+Shift+P');
    await sleep(400);
    const menuOpen = await G("!document.querySelector('.parent-menu').classList.contains('hidden')");
    check('Ctrl+Shift+P opens the parent settings', menuOpen);
    // move to "Play timer" (row 7) and set 10 minutes
    for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowDown'); await sleep(80); }
    await page.keyboard.press('ArrowRight');
    await sleep(300);
    await shot('14-parent-menu');
    await page.keyboard.press('Escape');
    await sleep(800);
    let saved = await page.evaluate(async () => (await fetch('/api/settings')).json());
    check('settings are saved to the server', saved.playTimerMin === 10, String(saved.playTimerMin));
    await G('__grassnyer.expireTimer()');
    await until(() => window.__grassnyer.state === 'sleep', 15000).catch(() => {});
    check('play timer sends it to sleep', (await G('__grassnyer.state')) === 'sleep');
    await nudge(0.8);
    await sleep(500);
    check('after the timer, a wheel touch does not wake it', (await G('__grassnyer.state')) === 'sleep');
    await G('__press(6, true); __press(7, true)');
    check('holding the parent buttons wakes it', await waitForGarage(12000));

    // ---- wheel setup wizard ----
    await page.keyboard.press('Control+Shift+P');
    await sleep(300);
    for (let i = 0; i < 7; i++) { await page.keyboard.press('ArrowDown'); await sleep(60); }
    await page.keyboard.press('Enter');
    await sleep(3000); // hands off
    await G('__setSteer(-0.9)'); await sleep(1100);
    await G('__setSteer(0.85)'); await sleep(1100);
    await G('__setSteer(0)');
    await G('__pad.axes[5] = 1'); await sleep(900); await G('__pad.axes[5] = -1'); await sleep(300);
    await G('__pad.axes[2] = 1'); await sleep(900); await G('__pad.axes[2] = -1'); await sleep(300);
    for (const b of [1, 2]) await tap(b);   // gear lever forward, then back
    for (const b of [3, 4, 9, 10]) await tap(b);
    await shot('15-wheel-setup');
    await tap(3);
    await sleep(600);
    saved = await page.evaluate(async () => (await fetch('/api/settings')).json());
    const wm = saved.wheel || {};
    check('wheel setup saves the mapping', wm.steer?.axis === 0 && wm.gas?.axis === 5 && wm.brake?.axis === 2
      && wm.goButton === 3 && wm.paintButton === 4 && wm.parentButtons?.join() === '9,10'
      && wm.gearForward?.button === 1 && wm.gearReverse?.button === 2, JSON.stringify(wm));
    await page.keyboard.press('Escape');

    check('no errors in the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    check('test run completed', false, e.message);
    await shot('99-failure').catch(() => {});
  } finally {
    await browser.close();
    server.kill();
    fs.rmSync(data, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshots in test-output/`);
  process.exit(failed.length ? 1 : 0);
}

main();
