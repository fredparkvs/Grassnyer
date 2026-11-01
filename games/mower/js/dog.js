// The family's chow chow (added 2026-10-31 at the parent's request). It
// wanders about the lawn, stops for a sniff or to watch the vehicle, and runs
// off (with a woof now and then) whenever the vehicle comes close. It is
// faster than the fastest vehicle, and it never blocks the vehicle: if the two
// ever overlap, only the dog is pushed aside.

import { chowChow } from './models.js';

const NEAR = 5.5;              // closer than this and it runs off...
const SAFE = 8.5;              // ...until it is this far away
const TROT = 1.7, RUN = 5.8;   // fastest vehicle setting is 4.6
const MARGIN = 0.9;            // keeps this far from fences and obstacles

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Dog {
  constructor() {
    this.m = chowChow();
    this.root = this.m.root;
    this.root.visible = false;
    this.radius = this.m.radius;
    this.world = null;
    this.x = 0; this.z = 0; this.heading = 0; this.speed = 0;
    this.state = 'idle';
    this.timer = 1;
    this.target = null;
    this.replan = 0;
    this.phase = 0;
    this.pant = 0;
    this.barkIn = 0;
    this.onBark = null;   // main.js plays the woof
    this.onDig = null;    // main.js throws up the dirt
    this.hole = null;     // the molehill it's going to dig at
    this.dirtIn = 0;
  }

  // a free spot on this lawn, well away from the vehicle
  spawn(world, vehicle) {
    this.world = world;
    let spot = null;
    for (let i = 0; i < 50 && !spot; i++) {
      const p = this._randomSpot();
      if (p && Math.hypot(p.x - vehicle.x, p.z - vehicle.z) > SAFE) spot = p;
    }
    spot = spot || this._randomSpot() || { x: 0, z: 0 };
    this.place(spot.x, spot.z);
    this.heading = Math.random() * Math.PI * 2;
    this.state = 'idle';
    this.timer = 1 + Math.random() * 2;
    this.root.visible = true;
  }

  place(x, z) {
    this.x = x; this.z = z;
    this.speed = 0;
    this.target = null;
    this.sync();
  }

  free(x, z) {
    const { circles, boxes, bounds: B } = this.world.colliders;
    if (x < B.minX + MARGIN || x > B.maxX - MARGIN || z < B.minZ + MARGIN || z > B.maxZ - MARGIN) return false;
    for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r + MARGIN) return false;
    for (const b of boxes) if (Math.abs(x - b.x) < b.hw + MARGIN && Math.abs(z - b.z) < b.hd + MARGIN) return false;
    return true;
  }

  _randomSpot() {
    const B = this.world.colliders.bounds;
    for (let i = 0; i < 40; i++) {
      const x = B.minX + Math.random() * (B.maxX - B.minX);
      const z = B.minZ + Math.random() * (B.maxZ - B.minZ);
      if (this.free(x, z)) return { x, z };
    }
    return null;
  }

  // Where to run: as far from the vehicle as it can get, without running past it.
  _fleeSpot(vehicle) {
    let best = null, bestScore = -Infinity;
    const away = Math.atan2(this.x - vehicle.x, this.z - vehicle.z);
    for (let i = 0; i < 16; i++) {
      const a = away + (i / 16) * Math.PI * 2;
      for (const d of [6, 4, 2.5]) {
        const x = this.x + Math.sin(a) * d, z = this.z + Math.cos(a) * d;
        if (!this.free(x, z)) continue;
        const passes = segmentDistance(vehicle.x, vehicle.z, this.x, this.z, x, z) < 2.5;
        const score = Math.hypot(x - vehicle.x, z - vehicle.z) - (passes ? 4 : 0) + d * 0.2;
        if (score > bestScore) { bestScore = score; best = { x, z }; }
        break;   // the furthest free spot in each direction is enough
      }
    }
    return best;
  }

  // holes: molehills it may go and dig at ({ x, z, flat })
  update(dt, t, vehicle, holes = []) {
    if (!this.world) return;
    const dv = Math.hypot(this.x - vehicle.x, this.z - vehicle.z);
    this.timer -= dt;
    this.barkIn -= dt;

    // ---- decide ----
    if (dv < NEAR && this.state !== 'run') {
      this.state = 'run';
      this.replan = 0;
      if (this.barkIn <= 0) { this.onBark?.(); this.barkIn = 6; }
    }
    if (this.state === 'run') {
      this.replan -= dt;
      if (this.replan <= 0 || !this.target) { this.target = this._fleeSpot(vehicle) || this._randomSpot(); this.replan = 0.4; }
      if (dv > SAFE) { this.state = 'idle'; this.timer = 1 + Math.random() * 2; this.target = null; }
    } else if (this.state === 'idle') {
      const open = holes.filter((h) => !h.flat);
      if (this.timer <= 0 && open.length && Math.random() < 0.7) {   // ooh, a molehill!
        this.hole = open[(Math.random() * open.length) | 0];
        const a = Math.atan2(this.x - this.hole.x, this.z - this.hole.z);
        this.target = { x: this.hole.x + Math.sin(a) * 0.75, z: this.hole.z + Math.cos(a) * 0.75 };
        this.state = 'toDig';
        this.timer = 10;
      } else if (this.timer <= 0) { this.target = this._randomSpot(); this.state = 'trot'; this.timer = 8; }
    } else if (this.state === 'toDig') {
      const gone = !this.hole || this.hole.flat || !holes.includes(this.hole);
      const there = this.target && Math.hypot(this.target.x - this.x, this.target.z - this.z) < 0.35;
      if (gone || this.timer <= 0) { this.state = 'idle'; this.timer = 1; this.target = null; }
      else if (there) { this.state = 'dig'; this.timer = 4 + Math.random() * 2; this.target = null; }
    } else if (this.state === 'dig') {
      const gone = !this.hole || this.hole.flat || !holes.includes(this.hole);
      if (gone || this.timer <= 0) { this.state = 'idle'; this.timer = 2 + Math.random() * 2; this.hole = null; }
    } else if (this.state === 'trot') {
      const there = this.target && Math.hypot(this.target.x - this.x, this.target.z - this.z) < 0.5;
      if (!this.target || there || this.timer <= 0) {
        this.state = 'idle';
        this.timer = 1.5 + Math.random() * 3;
        this.target = null;
      }
    }

    // ---- move ----
    let want = this.state === 'run' ? RUN : this.state === 'trot' || this.state === 'toDig' ? TROT : 0;
    let wantHeading = this.heading;
    if (this.state === 'dig' && this.hole) {
      wantHeading = Math.atan2(this.hole.x - this.x, this.hole.z - this.z);   // face the molehill
    } else if (this.target) {
      const dx = this.target.x - this.x, dz = this.target.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.2) wantHeading = Math.atan2(dx, dz);
      want *= Math.min(1, dist / 1.2);   // ease in when arriving
    }
    const turnRate = this.state === 'run' ? 7 : 3;
    this.heading += clamp(wrap(wantHeading - this.heading), -turnRate * dt, turnRate * dt);
    want *= 0.35 + 0.65 * Math.max(0, Math.cos(wrap(wantHeading - this.heading)));   // slow for sharp turns
    this.speed += clamp(want - this.speed, -12 * dt, 8 * dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    this._collide(vehicle);

    // ---- animate ----
    const m = this.m;
    this.phase += this.speed * dt * (this.speed > 3 ? 2.2 : 3.4);
    const amp = Math.min(0.8, this.speed * 0.28);
    const s = Math.sin(this.phase);
    m.legs[0].rotation.x = m.legs[3].rotation.x = s * amp;    // trot: diagonal pairs together
    m.legs[1].rotation.x = m.legs[2].rotation.x = -s * amp;
    const digging = this.state === 'dig';
    if (digging) {   // front paws scrabbling, dirt flying out behind
      m.legs[0].rotation.x = Math.sin(t * 20) * 0.9 - 0.4;
      m.legs[1].rotation.x = Math.sin(t * 20 + Math.PI) * 0.9 - 0.4;
      this.dirtIn -= dt;
      if (this.dirtIn <= 0 && this.hole) { this.dirtIn = 0.12; this.onDig?.(this.hole.x, this.hole.z, this.heading); }
    }
    m.body.rotation.x += ((digging ? 0.25 : 0) - m.body.rotation.x) * Math.min(1, dt * 6);
    m.body.position.y = Math.abs(Math.cos(this.phase)) * 0.07 * Math.min(1, this.speed / 2);
    m.tail.rotation.z = Math.sin(t * (this.speed > 3 ? 16 : 8)) * 0.3;
    this.pant = this.state === 'run' ? 4 : Math.max(0, this.pant - dt);
    m.tongue.visible = this.pant > 0;
    // standing still: watch the vehicle, now and then nose down for a sniff
    let lookYaw = 0, lookDown = digging ? 0.55 : 0;
    if (this.state === 'idle') {
      const rel = wrap(Math.atan2(vehicle.x - this.x, vehicle.z - this.z) - this.heading);
      if (Math.abs(rel) < 1.6) lookYaw = clamp(rel, -0.9, 0.9);
      else lookDown = Math.sin(t * 0.7) > 0.3 ? 0.45 : 0;
    }
    m.head.rotation.y += (lookYaw - m.head.rotation.y) * Math.min(1, dt * 5);
    m.head.rotation.x += (lookDown - m.head.rotation.x) * Math.min(1, dt * 4);
    this.sync();
  }

  _collide(vehicle) {
    const R = this.radius;
    const { circles, boxes, bounds: B } = this.world.colliders;
    for (const c of circles) {
      const dx = this.x - c.x, dz = this.z - c.z, d = Math.hypot(dx, dz), min = c.r + R;
      if (d < min && d > 1e-6) { this.x += (dx / d) * (min - d); this.z += (dz / d) * (min - d); }
    }
    for (const b of boxes) {
      const cx = clamp(this.x, b.x - b.hw, b.x + b.hw), cz = clamp(this.z, b.z - b.hd, b.z + b.hd);
      const dx = this.x - cx, dz = this.z - cz, d = Math.hypot(dx, dz);
      if (d < R && d > 1e-6) { this.x += (dx / d) * (R - d); this.z += (dz / d) * (R - d); }
    }
    // never in the vehicle's way: the dog steps aside
    const dx = this.x - vehicle.x, dz = this.z - vehicle.z, d = Math.hypot(dx, dz), min = vehicle.radius + R + 0.2;
    if (d < min) {
      const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
      this.x += nx * (min - d); this.z += nz * (min - d);
    }
    this.x = clamp(this.x, B.minX + R, B.maxX - R);
    this.z = clamp(this.z, B.minZ + R, B.maxZ - R);
  }

  sync() {
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.heading;
  }
}

// distance from point (px, pz) to the segment (ax, az)-(bx, bz)
function segmentDistance(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const len2 = vx * vx + vz * vz || 1;
  const k = clamp(((px - ax) * vx + (pz - az) * vz) / len2, 0, 1);
  return Math.hypot(px - (ax + vx * k), pz - (az + vz * k));
}
