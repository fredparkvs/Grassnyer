// Garden life on the mowed lawn (added 2026-11-01 at the parent's request):
// - carrots sprout here and there in cut grass; driving over one pulls it up
//   and it joins the carrot row at the top of the screen
// - a bunny hops in to nibble a carrot, and dashes off when the vehicle comes near
// - molehills pop up in cut grass (a mole peeks out now and then); the dog
//   likes to dig at them, and driving over one flattens it
// main.js passes callbacks for the sounds, particles and the carrot row.

import * as M from './models.js';

const CARROT_FIRST = 10, CARROT_EVERY = [9, 15], CARROT_MAX = 4;
const MOLE_FIRST = 25, MOLE_EVERY = [18, 28], MOLE_MAX = 3;
const BUNNY_WAIT = 5, BUNNY_REST = 12;   // carrot must be up 5 s; 12 s between bunnies
const BUNNY_NEAR = 5;                    // vehicle closer than this: the bunny runs
const EAT_TIME = 14;                     // a bunny takes its time over a carrot
const between = ([a, b]) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Garden {
  constructor(scene, on = {}) {
    this.scene = scene;
    this.on = on;   // { pull(x, z), eaten(x, z), dirt(x, z, n), poof(x, z), sprout(x, z) }
    this.world = null;
    this.carrots = [];
    this.holes = [];
    this.bunny = null;
    this.collected = 0;
  }

  reset(world) {
    for (const c of this.carrots) this.scene.remove(c.obj);
    for (const h of this.holes) this.scene.remove(h.m.root);
    if (this.bunny) this.scene.remove(this.bunny.m.root);
    this.world = world;
    this.carrots = [];
    this.holes = [];
    this.bunny = null;
    this.collected = 0;
    this.carrotIn = CARROT_FIRST;
    this.moleIn = MOLE_FIRST;
    this.bunnyRest = 0;
  }

  // somewhere on the mowed part of the lawn, clear of the vehicle and other things
  _cutSpot(vehicle, near = null) {
    const g = this.world.grass, B = this.world.colliders.bounds;
    const { circles, boxes } = this.world.colliders;
    for (let i = 0; i < 80; i++) {
      const x = near ? near.x + (Math.random() - 0.5) * 2 * near.r : B.minX + 1 + Math.random() * (B.maxX - B.minX - 2);
      const z = near ? near.z + (Math.random() - 0.5) * 2 * near.r : B.minZ + 1 + Math.random() * (B.maxZ - B.minZ - 2);
      if (x < B.minX + 1 || x > B.maxX - 1 || z < B.minZ + 1 || z > B.maxZ - 1) continue;
      if (!near && (!g.isMowable(x, z, 0.5) || g.isTall(x, z))) continue;
      if (Math.hypot(x - vehicle.x, z - vehicle.z) < 3) continue;
      if (circles.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 0.8)) continue;
      if (boxes.some((b) => Math.abs(x - b.x) < b.hw + 0.8 && Math.abs(z - b.z) < b.hd + 0.8)) continue;
      if ([...this.carrots, ...this.holes].some((o) => Math.hypot(x - o.x, z - o.z) < 1.8)) continue;
      return { x, z };
    }
    return null;
  }

  sproutCarrot(x, z) {
    const obj = M.carrotSprout();
    obj.position.set(x, 0, z);
    obj.scale.setScalar(0.01);
    this.scene.add(obj);
    const c = { x, z, obj, age: 0, eaten: 0, pulled: false };
    this.carrots.push(c);
    this.on.sprout?.(x, z);
    return c;
  }

  addMoleHill(x, z) {
    const m = M.moleHill();
    m.root.position.set(x, 0, z);
    m.root.scale.setScalar(0.01);
    this.scene.add(m.root);
    const h = { x, z, m, age: 0, peek: 3 + Math.random() * 4, flat: 0 };
    this.holes.push(h);
    this.on.dirt?.(x, z, 18);
    return h;
  }

  spawnBunny(carrot, vehicle) {
    // pop in a few steps from the carrot, on the side away from the vehicle
    const away = Math.atan2(carrot.x - vehicle.x, carrot.z - vehicle.z);
    const B = this.world.colliders.bounds;
    const x = clamp(carrot.x + Math.sin(away) * 4.5, B.minX + 0.8, B.maxX - 0.8);
    const z = clamp(carrot.z + Math.cos(away) * 4.5, B.minZ + 0.8, B.maxZ - 0.8);
    const m = M.gardenBunny();
    m.root.scale.setScalar(1.3);   // easy to spot on the TV
    m.root.position.set(x, 0, z);
    this.scene.add(m.root);
    this.bunny = { m, x, z, heading: away + Math.PI, state: 'hop', carrot, phase: 0, t: 0, target: null };
    this.on.poof?.(x, z);
    return this.bunny;
  }

  update(dt, t, vehicle, { spawning = true, reach = 1.2 } = {}) {
    if (!this.world) return;

    // ---- new carrots and molehills, on the mowed part ----
    if (spawning && this.world.grass.progress > 0.04) {
      this.carrotIn -= dt;
      if (this.carrotIn <= 0) {
        this.carrotIn = between(CARROT_EVERY);
        if (this.carrots.filter((c) => !c.pulled).length < CARROT_MAX) {
          const spot = this._cutSpot(vehicle);
          if (spot) this.sproutCarrot(spot.x, spot.z);
        }
      }
      this.moleIn -= dt;
      if (this.moleIn <= 0) {
        this.moleIn = between(MOLE_EVERY);
        if (this.holes.length < MOLE_MAX) {
          const spot = this._cutSpot(vehicle);
          if (spot) this.addMoleHill(spot.x, spot.z);
        }
      }
    }

    // ---- carrots: grow in, wiggle, get pulled up or nibbled away ----
    for (const c of this.carrots) {
      c.age += dt;
      if (c.pulled) {
        c.k += dt / 0.6;
        c.obj.position.y = Math.sin(Math.min(1, c.k) * Math.PI * 0.5) * 1.8;
        c.obj.rotation.y += dt * 12;
        c.obj.scale.setScalar(Math.max(0.01, 1.6 * (1 - Math.max(0, c.k - 0.6) / 0.4)));
        continue;
      }
      const grow = 1.4 * Math.min(1, c.age / 0.6) * (1 - c.eaten * 0.7);   // 1.4: easy to spot on the TV
      c.obj.scale.setScalar(Math.max(0.01, grow));
      c.obj.rotation.z = Math.sin(t * 5 + c.x) * 0.12;   // a little wiggle: here I am!
      if (spawning && Math.hypot(c.x - vehicle.x, c.z - vehicle.z) < reach) this._pull(c);
    }
    this.carrots = this.carrots.filter((c) => {
      const done = (c.pulled && c.k >= 1) || c.eaten >= 1;
      if (done) this.scene.remove(c.obj);
      return !done;
    });

    // ---- molehills: rise, a mole peeks out now and then, flatten when driven over ----
    for (const h of this.holes) {
      h.age += dt;
      if (h.flat > 0) {
        h.flat += dt / 0.3;
        h.m.root.scale.set(1 + h.flat * 0.4, Math.max(0.01, 1 - h.flat), 1 + h.flat * 0.4);
        continue;
      }
      h.m.root.scale.setScalar(Math.max(0.01, Math.min(1, h.age / 0.5)));
      h.peek -= dt;
      const up = h.peek < 0 && h.peek > -2.2;
      h.m.mole.visible = up;
      if (up) h.m.mole.position.y = 0.06 + Math.sin(Math.min(1, -h.peek / 0.3) * Math.PI / 2) * 0.16 * (h.peek > -1.9 ? 1 : (h.peek + 2.2) / 0.3);
      if (h.peek <= -2.2) h.peek = 4 + Math.random() * 6;
      if (spawning && Math.hypot(h.x - vehicle.x, h.z - vehicle.z) < reach) {
        h.flat = 0.01;
        h.m.mole.visible = false;
        this.on.flatten?.(h.x, h.z);
      }
    }
    this.holes = this.holes.filter((h) => {
      if (h.flat >= 1) { this.scene.remove(h.m.root); return false; }
      return true;
    });

    this._updateBunny(dt, t, vehicle, spawning);
  }

  _pull(c) {
    c.pulled = true;
    c.k = 0;
    this.scene.remove(c.obj);
    c.obj = M.carrot();   // the whole carrot comes up
    c.obj.position.set(c.x, 0, c.z);
    this.scene.add(c.obj);
    this.collected++;
    this.on.pull?.(c.x, c.z);
  }

  _updateBunny(dt, t, vehicle, spawning) {
    this.bunnyRest -= dt;
    if (!this.bunny) {
      const waiting = this.carrots.find((c) => !c.pulled && c.age > BUNNY_WAIT);
      if (spawning && waiting && this.bunnyRest <= 0 && Math.hypot(waiting.x - vehicle.x, waiting.z - vehicle.z) > BUNNY_NEAR + 2) {
        this.spawnBunny(waiting, vehicle);
      }
      return;
    }
    const b = this.bunny;
    b.t += dt;
    const dv = Math.hypot(b.x - vehicle.x, b.z - vehicle.z);
    if (dv < BUNNY_NEAR && b.state !== 'flee') {
      b.state = 'flee';
      b.t = 0;
      const away = Math.atan2(b.x - vehicle.x, b.z - vehicle.z);
      b.target = { x: b.x + Math.sin(away) * 12, z: b.z + Math.cos(away) * 12 };
    }
    if (b.state === 'hop' && (!b.carrot || b.carrot.pulled || !this.carrots.includes(b.carrot))) {
      b.state = 'leave'; b.t = 0;
      b.target = { x: b.x + Math.sin(b.heading) * 10, z: b.z + Math.cos(b.heading) * 10 };
    }

    let speed = 0, goal = null;
    if (b.state === 'hop') {
      goal = { x: b.carrot.x - Math.sin(b.heading) * 0.45, z: b.carrot.z - Math.cos(b.heading) * 0.45 };
      if (Math.hypot(goal.x - b.x, goal.z - b.z) < 0.15) { b.state = 'eat'; b.t = 0; }
      speed = 2.2;
    } else if (b.state === 'eat') {
      if (b.carrot.pulled || !this.carrots.includes(b.carrot)) { b.state = 'leave'; b.t = 0; b.target = { x: b.x - Math.sin(b.heading) * 10, z: b.z - Math.cos(b.heading) * 10 }; }
      else {
        b.carrot.eaten = Math.min(1, b.carrot.eaten + dt / EAT_TIME);
        if (b.carrot.eaten >= 1) {
          this.on.eaten?.(b.carrot.x, b.carrot.z);
          b.state = 'leave'; b.t = 0;
          b.target = { x: b.x - Math.sin(b.heading) * 10, z: b.z - Math.cos(b.heading) * 10 };
        }
      }
    } else {   // 'flee' (fast) or 'leave' (hopping off with a full tummy)
      goal = b.target;
      speed = b.state === 'flee' ? 8 : 2.6;
      const B = this.world.colliders.bounds;
      const out = b.x < B.minX + 0.6 || b.x > B.maxX - 0.6 || b.z < B.minZ + 0.6 || b.z > B.maxZ - 0.6;
      if (b.t > (b.state === 'flee' ? 1.4 : 3.5) || out) {   // gone: poof
        this.on.poof?.(b.x, b.z);
        this.scene.remove(b.m.root);
        this.bunny = null;
        this.bunnyRest = BUNNY_REST;
        return;
      }
    }
    if (goal) {
      const want = Math.atan2(goal.x - b.x, goal.z - b.z);
      b.heading += clamp(wrap(want - b.heading), -10 * dt, 10 * dt);
      b.x += Math.sin(b.heading) * speed * dt;
      b.z += Math.cos(b.heading) * speed * dt;
      const B = this.world.colliders.bounds;
      b.x = clamp(b.x, B.minX + 0.4, B.maxX - 0.4);
      b.z = clamp(b.z, B.minZ + 0.4, B.maxZ - 0.4);
    }
    // hop when moving, nibble when eating
    const m = b.m;
    b.phase += dt * (speed > 4 ? 14 : 9);
    m.body.position.y = speed > 0 ? Math.abs(Math.sin(b.phase)) * (speed > 4 ? 0.35 : 0.2) : 0;
    m.head.rotation.x = b.state === 'eat' ? 0.45 + Math.sin(t * 14) * 0.08 : 0;
    m.root.position.set(b.x, 0, b.z);
    m.root.rotation.y = b.heading;
  }
}
