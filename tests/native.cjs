// Multi-game test: the picker with a native (non-browser) game.
//
// Copies the repo to a temp folder, adds two stand-in native games (a short
// "race" that prints a finish line, and one that never ends), and checks:
// launching from the picker, closing when the race ends, closing when the
// parent buttons are held (through a fake /dev/input/js0), "Back to the
// games" in Grassnyer's parent menu, and waking Grassnyer into the picker.
//
//   node tests/native.cjs     (part of npm test)

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

let pw, bundledBrowser = true;
try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); bundledBrowser = false; }

const REPO = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(REPO, 'test-output'), { recursive: true });
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
}
const freePort = () => new Promise((resolve) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});

const RACE = `import time; print('kart {kart}'); time.sleep(2); print('Switching to screen race_result.stkgui'); time.sleep(60)`;
const ENDLESS = `import time; print('racing'); time.sleep(120)`;

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grassnyer-native-'));
  const root = path.join(tmp, 'repo');
  const data = path.join(tmp, 'data');
  const input = path.join(tmp, 'input');
  for (const f of execSync('git ls-files -co --exclude-standard', { cwd: REPO }).toString().split('\n').filter(Boolean)) {
    if (!fs.existsSync(path.join(REPO, f))) continue;
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.copyFileSync(path.join(REPO, f), path.join(root, f));
  }
  const addGame = (id, order, code) => {
    fs.mkdirSync(path.join(root, 'games', id), { recursive: true });
    fs.copyFileSync(path.join(REPO, 'games/supertuxkart/icon.svg'), path.join(root, 'games', id, 'icon.svg'));
    fs.writeFileSync(path.join(root, 'games', id, 'game.json'), JSON.stringify({
      name: id, icon: 'icon.svg', order,
      native: { command: ['python3', '-c', code], choices: { kart: ['tux'] }, exitOnLog: 'race_result\\.stkgui', exitDelay: 1 },
    }));
  };
  addGame('zz-race', 50, RACE);
  addGame('zz-endless', 51, ENDLESS);
  fs.mkdirSync(input, { recursive: true });
  execSync(`mkfifo ${path.join(input, 'js0')}`);

  const port = await freePort();
  const server = spawn('python3', [path.join(root, 'kit/server.py')], {
    env: { ...process.env, GRASSNYER_PORT: String(port), GRASSNYER_DATA: data, GRASSNYER_ROOT: root,
      GRASSNYER_ALLOW_SYSTEM: '1', GRASSNYER_INPUT_DIR: input },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 800));

  const launch = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
  const systemChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  else if (!bundledBrowser && systemChromium) launch.executablePath = systemChromium;
  const browser = await pw.chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript({ path: path.join(__dirname, 'fakepad.js') });
  const G = (expr) => page.evaluate(expr);
  const sleep = (ms) => page.waitForTimeout(ms);
  const api = (p) => page.evaluate(async (u) => (await fetch(u)).json(), p);
  const tap = async (i) => { await G(`__press(${i}, true)`); await sleep(200); await G(`__press(${i}, false)`); await sleep(250); };
  const nudge = async (v) => { await G(`__setSteer(${v})`); await sleep(300); await G('__setSteer(0)').catch(() => {}); await sleep(300); };
  const waitNative = async (running, ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) if ((await api('/api/native')).running === running) return true;
    return false;
  };
  const select = async (id) => {
    const games = await api('/api/games');
    for (let i = 0; i < games.findIndex((g) => g.id === id); i++) await nudge(1);
  };

  try {
    await page.goto(`http://127.0.0.1:${port}/`);
    await sleep(1200);
    const tiles = await G("document.querySelectorAll('.picker .tile').length");
    check('picker shows when there is more than one game', tiles >= 3 && page.url().endsWith('/'), `${tiles} tiles`);
    await page.screenshot({ path: path.join(REPO, 'test-output', 'n1-picker.png') }).catch(() => {});

    // a race that ends by itself
    await select('zz-race');
    await tap(0);
    check('pressing starts the native game', await waitNative(true, 4000));
    check('picker waits while it runs', await G("!!document.querySelector('.tile.launching')"));
    check('game closes itself when the race ends', await waitNative(false, 10000));
    await sleep(1500);
    check('picker is usable again afterwards', !(await G("!!document.querySelector('.tile.launching')")));
    const log = fs.readFileSync(path.join(data, 'native-zz-race.log'), 'utf8');
    check('random choices are filled into the command', log.includes('kart tux'));

    // a game that never ends: the parent buttons close it
    await nudge(1);
    await tap(0);
    check('second native game starts', await waitNative(true, 4000));
    const holder = spawn('python3', ['-c', `
import os, struct, time
for _ in range(100):
    try:
        fd = os.open(${JSON.stringify(path.join(input, 'js0'))}, os.O_WRONLY | os.O_NONBLOCK); break
    except OSError: time.sleep(0.1)
os.write(fd, struct.pack('IhBB', 0, 1, 1, 6) + struct.pack('IhBB', 0, 1, 1, 7))
time.sleep(9)
`]);
    check('holding the parent buttons for 5 s closes it', await waitNative(false, 12000));
    holder.kill();

    // Grassnyer: "Back to the games" and waking into the picker
    await page.goto(`http://127.0.0.1:${port}/games/mower/?idleSleep=4`);
    await page.waitForFunction(() => window.__grassnyer && window.__grassnyer.state === 'garage', null, { timeout: 30000 });
    await page.keyboard.press('Control+Shift+P');
    await sleep(800);
    const hasBack = await G("[...document.querySelectorAll('.pm-label')].some((e) => e.textContent === 'Back to the games')");
    check('parent menu offers "Back to the games"', hasBack);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__grassnyer.state === 'sleep', null, { timeout: 20000 }).catch(() => {});
    check('Grassnyer falls asleep when left alone', (await G('window.__grassnyer && window.__grassnyer.state').catch(() => null)) === 'sleep');
    await nudge(0.7);
    await page.waitForURL((u) => u.pathname === '/', { timeout: 8000 }).catch(() => {});
    await sleep(800);
    check('waking goes to the game picker', new URL(page.url()).pathname === '/'
      && (await G("document.querySelectorAll('.picker .tile').length")) >= 3);
    check('no errors in the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    check('test run completed', false, e.message);
  } finally {
    await browser.close();
    server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  process.exit(failed.length ? 1 : 0);
}

main();
