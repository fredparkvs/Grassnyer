// Grassnyer: mow the tall grass, find presents, make a giant grass pile.
//
// Flow: garage -> lawn intro -> play -> celebrate -> next lawn ...
// Leaving the wheel alone stops the vehicle (20 s) and later sends it to the
// shed to sleep (10 min). Waking starts a fresh session from the game picker:
// plain vehicle, next lawn. The optional play timer also ends in the shed.

import * as THREE from 'three';
import { loadSettings, settings, gameState, saveSoon, saveNow } from '/kit/settings.js';
import { Wheel } from '/kit/input.js';
import { Sound } from '/kit/audio.js';
import { ParentMenu } from '/kit/parent.js';
import { buildWorld, makeSky, addLights, CUT_RADIUS } from './world.js';
import { LAWNS } from './lawns.js';
import { Garage } from './garage.js';
import { Hud } from './hud.js';
import { Particles, Hints, CLIPPING_COLOURS, CONFETTI_COLOURS } from './effects.js';
import { pickDecoration } from './decorations.js';
import * as M from './models.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? Number(params.get(k)) : d);
const T = {
  idleStop: num('idleStop', 20),       // seconds untouched before the vehicle waits
  idleSleep: num('idleSleep', 600),    // seconds untouched before it goes to the shed
  hintAfter: num('hintAfter', 8),      // seconds without cutting before sparkles show
  finishAt: 0.95,                      // lawn counts as done at 95%
  presents: 3,
};
const SCALES = [1, 0.85, 0.72, 0.6, 0.5];

await loadSettings();
const gs = gameState('mower', { vehicle: 'mower', colour: 0, nextLawn: 0 });

const wheel = new Wheel();
const sound = new Sound();
await sound.init();
const hud = new Hud();

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let scaleIdx = Math.max(0, SCALES.indexOf(num('scale', 1)));
renderer.setPixelRatio(SCALES[scaleIdx] * Math.min(1, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const menu = new ParentMenu({
  wheel, sound,
  onClose: () => { last = performance.now(); },
  onSettingsChanged: () => sound.applySettings(),
});
const toggleMenu = wheel.onParent;
wheel.onParent = () => (state === 'sleep' ? wake() : toggleMenu());

// ---- lawn scene ------------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd8f1ff, 45, 120);
scene.add(makeSky());
addLights(scene);
const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 400);
const clippings = new Particles(500, { size: 0.13, gravity: -9, drag: 1.5 });
const confetti = new Particles(600, { size: 0.22, gravity: -2.5, drag: 1.2 });
const paintFx = new Particles(150, { size: 0.18, gravity: -7, drag: 1.0 });
const hints = new Hints();
scene.add(clippings.points, confetti.points, paintFx.points, hints.group);
const flyer = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), M.glow(0xfff2a0));
flyer.visible = false;
scene.add(flyer);

const garage = new Garage({ wheel, sound, hud });

let state = 'boot';
let world = null, vehicle = null, pile = null;
let presents = [], giftsFound = 0, currentLawn = 0;
let going = true, idleStopped = false, cuttingLevel = 0;
let gear = 1, beepIn = 0;          // gear lever: 1 forward, -1 reverse
const REVERSE_SPEED = 0.5;         // reversing is slower than driving forward
let lastCutTime = 0, hintsOn = false, hintsSince = 0, hintRefresh = 0;
let camMode = 'follow', camHeading = 0, timerDue = false;
let simT = 0, last = performance.now();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const session = { found: new Set(), playTime: 0 };
const tweens = [];

// ---- little helpers ------------------------------------------------------------
function tween(dur, fn) {
  return new Promise((resolve) => tweens.push({ t: 0, dur, fn, resolve }));
}
const wait = (s) => tween(s, () => {});
const ease = (k) => k * k * (3 - 2 * k);
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function runTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t = Math.min(tw.dur, tw.t + dt);
    tw.fn(tw.dur ? tw.t / tw.dur : 1);
    if (tw.t >= tw.dur) { tweens.splice(i, 1); tw.resolve(); }
  }
}

function rightOf(h) { return [-Math.cos(h), Math.sin(h)]; }

// ---- sessions, garage and lawns --------------------------------------------------
function newSession() {
  session.found = new Set();
  session.playTime = 0;
  timerDue = false;
}

async function enterGarage() {
  state = 'garage';
  hud.setPlaying(false);
  hud.setLight(false, false);
  hud.setWheelHint(false);
  sound.stopEngine();
  sound.startMusic();
  const picked = garage.start(gs.vehicle, gs.colour);
  hud.fade(0, 500);
  const choice = await picked;
  gs.vehicle = choice.type;
  gs.colour = choice.colour;
  saveSoon();
  vehicle = choice.vehicle;
  state = 'leaving-garage';
  await hud.fade(1, 450);
  await startLawn(gs.nextLawn % LAWNS.length);
}

async function startLawn(index) {
  state = 'loading';
  if (world) { scene.remove(world.group); world.dispose(); }
  if (pile) scene.remove(pile);
  presents.forEach((p) => scene.remove(p.obj));
  world = buildWorld(index);
  scene.add(world.group);
  currentLawn = index;
  gs.nextLawn = (index + 1) % LAWNS.length;
  saveSoon();

  scene.add(vehicle.group);
  vehicle.group.position.set(0, 0, 0);
  vehicle.group.rotation.set(0, 0, 0);
  vehicle.y = 0;
  vehicle.fill = 0;
  vehicle.setTip(0);
  vehicle.place(world.start.x, world.start.z, world.start.heading);

  pile = M.grassPile();
  pile.position.set(world.pile.x, 0, world.pile.z);
  pile.scale.setScalar(0.001);
  pile.visible = false;
  scene.add(pile);

  spawnPresents();
  giftsFound = 0;
  hud.setGifts(0);
  hud.setProgress(0);
  hints.show(false);
  hintsOn = false;
  lastCutTime = simT;
  going = true;
  gear = 1;
  idleStopped = false;
  clippings.clear(); confetti.clear(); paintFx.clear();
  camMode = 'follow';
  camHeading = vehicle.heading;
  placeCamera(1);
  hud.setPlaying(true);
  state = 'intro';
  await hud.fade(0, 700);
  sound.startEngine();
  sound.startMusic();
  sound.voice('lets_mow', 'start');
  wheel.markActive();
  state = 'play';
}

function spawnPresents() {
  presents = [];
  const g = world.grass;
  const colours = [0xff4f8b, 0x3fa8ff, 0xffd21f];
  for (let tries = 0; tries < 2000 && presents.length < T.presents; tries++) {
    const x = (Math.random() - 0.5) * (world.def.w - 2);
    const z = (Math.random() - 0.5) * (world.def.h - 2);
    if (!g.isMowable(x, z, 0.9)) continue;
    if (Math.hypot(x - world.start.x, z - world.start.z) < 4) continue;
    if (presents.some((p) => Math.hypot(p.x - x, p.z - z) < 4)) continue;
    const obj = M.present(colours[presents.length]);
    obj.position.set(x, 0, z);
    obj.rotation.y = Math.random() * 6;
    scene.add(obj);
    presents.push({ x, z, obj, found: false });
  }
}

// ---- playing -----------------------------------------------------------------------
function updatePlay(dt) {
  const s = settings();
  let target = 0;
  // Gear lever: forward drives forwards, back reverses. In auto-drive, moving
  // the lever also means "go", even if the vehicle was stopped.
  const shift = (g) => {
    if (gear !== g) { gear = g; sound.play('clunk'); }
    going = true;
  };
  if (wheel.gearForward.pressed) shift(1);
  if (wheel.gearReverse.pressed) shift(-1);
  const dir = gear > 0 ? 1 : -REVERSE_SPEED;
  if (s.driveMode === 'auto') {
    if (wheel.go.pressed) { going = !going; sound.play('ding'); }
    idleStopped = wheel.idleSeconds() > T.idleStop;
    target = going && !idleStopped ? dir : 0;
  } else {
    idleStopped = false;
    if (wheel.gas > 0) target = wheel.gas * dir;
    // brake stops; in forward gear holding it creeps into a slow reverse (as agreed)
    else if (wheel.brake > 0) target = gear < 0 || vehicle.speed > 0.2 ? 0 : -wheel.brake * 0.4;
  }
  // reversing beeper, like a real tractor
  if (vehicle.speed < -0.3) {
    beepIn -= dt;
    if (beepIn <= 0) { sound.play('beep'); beepIn = 0.7; }
  } else beepIn = 0;
  hud.setLight(s.driveMode === 'auto', going && !idleStopped);
  hud.setWheelHint(idleStopped);

  if (wheel.paint.pressed) paint();

  const bump = vehicle.drive(dt, { target, steer: wheel.steer }, s, world.colliders);
  if (bump) {
    sound.play(bump.kind === 'water' ? 'splash' : 'boing');
    wheel.rumble(0.35 + 0.5 * bump.strength, 220);
  }

  let cut = 0;
  if (Math.abs(vehicle.speed) > 0.05) cut = world.grass.cutAt(vehicle.x, vehicle.z, vehicle.heading);
  if (cut > 0) {
    lastCutTime = simT;
    const [rx, rz] = rightOf(vehicle.heading);
    const n = Math.min(5, 1 + (cut >> 3));
    for (let i = 0; i < n; i++) {
      clippings.emit(vehicle.x + rx * 0.8, 0.3, vehicle.z + rz * 0.8,
        rx * (2 + Math.random() * 2) + (Math.random() - 0.5), 1.5 + Math.random() * 2, rz * (2 + Math.random() * 2) + (Math.random() - 0.5),
        1.2, CLIPPING_COLOURS[(Math.random() * 4) | 0]);
    }
  }
  cuttingLevel += ((cut > 0 ? 1 : 0) - cuttingLevel) * Math.min(1, dt * 8);
  const vmax = [2.0, 2.6, 3.2, 3.9, 4.6][s.maxSpeed - 1] || 3.2;
  sound.setEngine(Math.min(1, Math.abs(vehicle.speed) / vmax), cuttingLevel);

  const progress = world.grass.progress;
  vehicle.fill = Math.min(1, progress);
  hud.setProgress(progress / T.finishAt);

  for (const p of presents) {
    if (!p.found && Math.hypot(p.x - vehicle.x, p.z - vehicle.z) < CUT_RADIUS + 0.15) openPresent(p);
    if (!p.found) p.obj.rotation.y += dt * 0.6;
  }

  updateHints(progress);
  if (progress >= T.finishAt) celebrate();
}

function updateHints(progress) {
  if (!hintsOn && simT - lastCutTime > T.hintAfter) {
    hintsOn = true;
    hintsSince = simT;
    hintRefresh = 0;
    hints.show(true);
    if (progress > 0.6) sound.voice('nearly_done', 'sparkle');
    else sound.play('sparkle');
  }
  if (hintsOn && progress < 0.8 && simT - hintsSince > 6 && simT - lastCutTime < 0.5) {
    hintsOn = false;
    hints.show(false);
  }
  if (hintsOn && simT > hintRefresh) {
    hintRefresh = simT + 0.5;
    hints.setTargets(world.grass.patches());
  }
}

function paint() {
  gs.colour = (gs.colour + 1) % M.PAINT.length;
  vehicle.setColour(gs.colour);
  saveSoon();
  sound.play('splash');
  paintFx.burst(vehicle.x, 1.3, vehicle.z, 40, 3, [M.PAINT[gs.colour], 0xffffff], 1.2);
}

function openPresent(p) {
  p.found = true;
  scene.remove(p.obj);
  giftsFound++;
  hud.setGifts(giftsFound);
  sound.play('pop');
  confetti.burst(p.x, 0.5, p.z, 60, 3, CONFETTI_COLOURS, 1.6, 1.4);
  const item = pickDecoration(session.found, vehicle.decorationIds());
  session.found.add(item.id);
  flyer.visible = true;
  const sx = p.x, sz = p.z;
  tween(0.7, (k) => {
    const tx = vehicle.x, tz = vehicle.z;
    flyer.position.set(sx + (tx - sx) * k, 0.5 + Math.sin(k * Math.PI) * 2.2 + k * 0.8, sz + (tz - sz) * k);
  }).then(() => {
    flyer.visible = false;
    vehicle.setDecoration(item);
    sound.play('sparkle');
    sound.voice('ooh_a_present');
  });
}

// ---- celebration ------------------------------------------------------------------
async function celebrate() {
  state = 'celebrate';
  hints.show(false);
  hud.setLight(false, false);
  hud.setWheelHint(false);
  sound.setEngine(0.3, 0);
  vehicle.speed = 0;

  // zoom-cut whatever is left, in a wave spreading out from the vehicle
  const g = world.grass;
  const left = g.remainingTexels().map((k) => {
    const [x, z] = g.texelPos(k);
    return { k, x, z, d: Math.hypot(x - vehicle.x, z - vehicle.z) };
  }).sort((a, b) => a.d - b.d);
  sound.play('whoosh');
  let done = 0;
  await tween(1.2, (k) => {
    const upto = Math.floor(left.length * k);
    for (; done < upto; done++) {
      const t = left[done];
      g.cutTexel(t.k);
      if (done % 24 === 0) clippings.burst(t.x, 0.3, t.z, 3, 1.5, CLIPPING_COLOURS, 1, 1);
    }
    hud.setProgress(1);
  });
  for (; done < left.length; done++) g.cutTexel(left[done].k);
  vehicle.fill = 1;
  sound.play('sparkle');
  await wait(0.4);

  // hop over the fence to the compost corner
  const spot = world.dumpSpot;
  await hop(spot.x, spot.z, spot.heading, 1.4, 3.5);
  camMode = 'pile';
  await wait(0.5);

  // tip the catcher and grow a ridiculous pile
  sound.play('dump');
  await tween(0.6, (k) => vehicle.setTip(ease(k)));
  pile.visible = true;
  const pour = new THREE.Vector3();
  await tween(2.4, (k) => {
    pile.scale.setScalar(Math.max(0.001, easeOut(k)));
    vehicle.fill = 1 - k;
    vehicle.m.tipper.getWorldPosition(pour);
    for (let i = 0; i < 4; i++) {
      clippings.emit(pour.x + (Math.random() - 0.5) * 0.8, pour.y + 0.4, pour.z,
        (world.pile.x - pour.x) * 0.5 + (Math.random() - 0.5), 1 + Math.random() * 2, (world.pile.z - pour.z) * 0.6 + (Math.random() - 0.5),
        1.0, CLIPPING_COLOURS[(Math.random() * 4) | 0]);
    }
  });
  await tween(0.5, (k) => vehicle.setTip(1 - ease(k)));
  vehicle.fill = 0;

  // party!
  sound.play('fanfare');
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      confetti.burst(world.pile.x + (Math.random() - 0.5) * 3, 3.5, world.pile.z + (Math.random() - 0.5) * 2, 90, 4, CONFETTI_COLOURS, 2.5, 1.6);
    }, i * 350);
  }
  await wait(1.4);
  await Promise.race([sound.voice('well_done'), wait(4)]);
  await wait(1.6);

  await hud.fade(1, 700);
  if (timerDue) { goToSleep('timer', true); return; }
  await startLawn((currentLawn + 1) % LAWNS.length);
}

// Cartoon leap to a spot (over hedges, fences, ponds...).
async function hop(x, z, heading, dur, height) {
  const sx = vehicle.x, sz = vehicle.z, sh = vehicle.heading;
  const dh = wrapAngle(heading - sh);
  sound.play('hop');
  vehicle.speed = 0;
  await tween(dur, (k) => {
    const e = ease(k);
    vehicle.x = sx + (x - sx) * e;
    vehicle.z = sz + (z - sz) * e;
    vehicle.y = Math.sin(k * Math.PI) * height;
    vehicle.heading = sh + dh * e;
    vehicle.trailerHeading = vehicle.heading;
  });
  vehicle.y = 0;
  sound.play('land');
}

// ---- sleeping ------------------------------------------------------------------------
let sleepPoll = null;
let sleepReason = null;

async function goToSleep(reason, alreadyDark = false) {
  if (state === 'sleep' || state === 'to-sleep') return;
  const fromLawn = !alreadyDark && world && (state === 'play' || state === 'intro');
  state = 'to-sleep';
  sleepReason = reason;
  hints.show(false);
  hud.setLight(false, false);
  hud.setWheelHint(false);
  if (reason === 'timer') sound.voice('time_to_rest', 'lullaby');
  else sound.play('lullaby');
  if (fromLawn) {
    const door = world.shed.door;
    await hop(door.x, door.z, Math.PI, 1.4, 3.0);
    camMode = 'shed';
    const z0 = vehicle.z;
    await tween(2.2, (k) => { vehicle.z = z0 + (world.shed.parkZ - z0) * ease(k); vehicle.speed = k < 0.9 ? 1.5 : 0; });
    vehicle.speed = 0;
    const doors = world.shed.obj.userData.doors;
    await tween(0.9, (k) => doors.forEach((d, i) => { d.rotation.y = (i ? 1 : -1) * 1.9 * (1 - ease(k)); }));
    await wait(0.4);
  }
  sound.stopEngine();
  sound.stopMusic();
  hud.setPlaying(false);
  hud.setSleep(true);
  await hud.fade(0, 10);
  state = 'sleep';
  // the render loop stops; poll the wheel gently so a touch (or the parent
  // buttons after the play timer) can wake it
  wheel.markActive();
  const asleepAt = performance.now();
  sleepPoll = setInterval(() => {
    wheel.poll();
    if (sleepReason === 'idle' && wheel.lastActivity > asleepAt + 300) wake();
  }, 100);
}

// Waking starts a fresh session from the game picker (agreed: wake goes to
// the picker). With only one game the picker skips straight back here.
function wake() {
  if (state !== 'sleep') return;
  clearInterval(sleepPoll);
  state = 'waking';
  hud.setSleep(false);
  hud.fade(1, 10);
  saveNow().finally(() => location.replace('/' + location.search));
}

// ---- camera ----------------------------------------------------------------------------
function placeCamera(k) {
  const v = vehicle;
  const desired = new THREE.Vector3(), look = new THREE.Vector3();
  if (camMode === 'follow') {
    camHeading += wrapAngle(v.heading - camHeading) * Math.min(1, k * 0.8);
    const fx = Math.sin(camHeading), fz = Math.cos(camHeading);
    const back = v.type === 'tractor' ? 7.8 : 6.8, up = v.type === 'tractor' ? 6.8 : 6.0;
    desired.set(v.x - fx * back, up + v.y * 0.5, v.z - fz * back);
    look.set(v.x + fx * 2.5, 0.4 + v.y * 0.6, v.z + fz * 2.5);
  } else if (camMode === 'pile') {
    const midZ = (world.pile.z + world.dumpSpot.z) / 2;
    desired.set(world.pile.x + 6, 5.5, midZ + 7);
    look.set(world.pile.x - 0.3, 1.5, midZ);
  } else if (camMode === 'shed') {
    desired.set(world.shed.x - 3, 5, world.shed.door.z + 8);
    look.set(world.shed.x, 1.2, world.shed.z);
  }
  if (k >= 1) { camPos.copy(desired); camLook.copy(look); }
  else { camPos.lerp(desired, k); camLook.lerp(look, k); }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ---- main loop -----------------------------------------------------------------------------
let fpsFrames = 0, fpsTime = 0, fpsGood = 0, fps = 60;

function frame(now) {
  if (state === 'sleep') return;
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  menu.tick();
  if (menu.isOpen) return;
  wheel.poll();
  hud.setConnected(wheel.connected);
  simT += dt;

  if (['garage', 'play', 'celebrate', 'intro'].includes(state)) session.playTime += dt;
  const timerMin = settings().playTimerMin;
  if (timerMin > 0 && session.playTime >= timerMin * 60) {
    if (state === 'celebrate') timerDue = true;
    else if (state === 'play' || state === 'garage') goToSleep('timer');
  }
  if (wheel.idleSeconds() > T.idleSleep && (state === 'play' || state === 'garage')) goToSleep('idle');

  if (state === 'garage') {
    garage.update(dt, simT);
    renderer.render(garage.scene, garage.camera);
  } else if (state === 'leaving-garage') {
    renderer.render(garage.scene, garage.camera);
  } else if (world && vehicle) {
    if (state === 'play') updatePlay(dt);
    runTweens(dt);
    vehicle.update(dt, simT);
    world.grass.update(simT);
    clippings.update(dt);
    confetti.update(dt);
    paintFx.update(dt);
    hints.update(simT, vehicle);
    placeCamera(1 - Math.exp(-dt * 3));
    renderer.render(scene, camera);
  }
  if (state !== 'play') runTweensOutsideLawn(dt);

  // keep it smooth on the Pi by lowering the render resolution if needed
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime > 2) {
    fps = fpsFrames / fpsTime;
    fpsFrames = 0; fpsTime = 0;
    if (!params.has('scale')) {
      if (fps < 48 && scaleIdx < SCALES.length - 1) { scaleIdx++; applyScale(); fpsGood = 0; }
      else if (fps > 58 && scaleIdx > 0 && ++fpsGood >= 3) { scaleIdx--; applyScale(); fpsGood = 0; }
    }
  }
}

// tweens also need to run while the garage or a fade is on screen
function runTweensOutsideLawn(dt) {
  if (!(world && vehicle) || state === 'garage' || state === 'leaving-garage') runTweens(dt);
}

function applyScale() {
  renderer.setPixelRatio(SCALES[scaleIdx] * Math.min(1, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function resize() {
  const aspect = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  garage.resize(aspect);
}
window.addEventListener('resize', resize);
resize();

// ---- test hooks (used by tests/smoke.cjs; harmless otherwise) --------------------------------
window.__grassnyer = {
  get state() { return state; },
  get lawn() { return currentLawn; },
  get progress() { return world ? world.grass.progress : 0; },
  get fps() { return fps; },
  get gifts() { return giftsFound; },
  get presents() { return presents.map((p) => ({ x: p.x, z: p.z, found: p.found })); },
  get vehicle() {
    return vehicle && { x: vehicle.x, z: vehicle.z, heading: vehicle.heading, speed: vehicle.speed,
      type: vehicle.type, colour: vehicle.colour, decorations: vehicle.decorationIds() };
  },
  get idleStopped() { return idleStopped; },
  get gear() { return gear; },
  get hints() { return hintsOn; },
  get tufts() { return world ? world.grass.tuftCount : 0; },
  mowTo(fraction) {
    const g = world.grass;
    const left = g.remainingTexels();
    for (let i = left.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [left[i], left[j]] = [left[j], left[i]]; }
    for (const k of left) { if (g.progress >= fraction) break; g.cutTexel(k); }
  },
  place(x, z, heading) { vehicle.place(x, z, heading); camHeading = heading; },
  sleep(reason = 'idle') { goToSleep(reason); },
  get garage() { return { step: garage.step, type: garage.current()?.type, colour: garage.colour, decorations: garage.current()?.decorationIds() }; },
  jumpToLawn(i) { if (state === 'play') startLawn(i); },
  expireTimer() { session.playTime = 1e9; },
};

newSession();
requestAnimationFrame(frame);
enterGarage();
