// The ride-on mower or tractor: model, colour, decorations and driving.

import * as THREE from 'three';
import { buildMower, buildTractor, PAINT } from './models.js';

const SPEEDS = [2.0, 2.6, 3.2, 3.9, 4.6];      // max speed per parent setting
const STEER_FACTOR = [0.6, 0.8, 1.0, 1.2, 1.4];
const MIN_TURN_RADIUS = 2.4;                    // wide, so full lock never spins
const ACCEL = 3.0, DECEL = 5.0;

export class Vehicle {
  constructor(type, colourIndex) {
    this.type = type;
    this.colour = colourIndex;
    this.group = new THREE.Group();
    this.m = type === 'tractor' ? buildTractor(PAINT[colourIndex]) : buildMower(PAINT[colourIndex]);
    this.root = this.m.root;
    this.group.add(this.root);
    if (this.m.trailer) this.group.add(this.m.trailer);
    for (const w of this.m.wheels) w.rotation.order = 'YXZ';
    this.radius = this.m.radius;
    this.decor = {};
    this.pops = [];
    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0;
    this.speed = 0;
    this.steerAngle = 0;
    this.bounceTimer = 0;
    this.bumpCooldown = 0;
    this.fill = 0;
    this.trailerHeading = 0;
  }

  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  setColour(i) {
    this.colour = i;
    this.m.paint.color.setHex(PAINT[i]);
  }

  place(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.steerAngle = 0; this.bounceTimer = 0;
    this.trailerHeading = heading;
    this.sync();
  }

  // ---- decorations ----------------------------------------------------------
  setDecoration(item, pop = true) {
    this.removeDecoration(item.slot);
    const d = item.make(this.m);
    d.id = item.id;
    for (const [parent, obj] of d.objects) {
      parent.add(obj);
      if (pop) { obj.userData.baseScale = obj.scale.clone(); obj.scale.multiplyScalar(0.01); this.pops.push({ obj, t: 0 }); }
    }
    this.decor[item.slot] = d;
  }

  removeDecoration(slot) {
    const d = this.decor[slot];
    if (!d) return;
    for (const [parent, obj] of d.objects) parent.remove(obj);
    d.onRemove?.();
    delete this.decor[slot];
  }

  clearDecorations() {
    for (const slot of Object.keys(this.decor)) this.removeDecoration(slot);
  }

  decorationIds() {
    return Object.fromEntries(Object.entries(this.decor).map(([s, d]) => [s, d.id]));
  }

  // ---- driving --------------------------------------------------------------
  // input: { target: desired speed (u/s), steer: -1..1 }, settings: parent settings
  // world: { circles, boxes, bounds }. Returns a bump {kind, strength} or null.
  drive(dt, input, settings, world) {
    const vmax = SPEEDS[settings.maxSpeed - 1] ?? SPEEDS[2];
    const factor = STEER_FACTOR[settings.steering - 1] ?? 1;

    let target = input.target * vmax;
    if (this.bounceTimer > 0) { this.bounceTimer -= dt; target = 0; }
    this.bumpCooldown -= dt;
    const rate = Math.abs(target) > Math.abs(this.speed) && Math.sign(target || 1) === Math.sign(this.speed || 1) ? ACCEL : DECEL;
    this.speed += THREE.MathUtils.clamp(target - this.speed, -rate * dt, rate * dt);

    const s = input.steer;
    const curved = Math.sign(s) * Math.pow(Math.abs(s), 1.4);
    this.steerAngle += THREE.MathUtils.clamp(curved - this.steerAngle, -3 * dt, 3 * dt);
    this.heading -= (this.speed / MIN_TURN_RADIUS) * this.steerAngle * factor * dt;

    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    return world ? this.collide(world) : null;
  }

  collide(world) {
    const R = this.radius;
    let bump = null;
    const hit = (nx, nz, push, kind) => {
      this.x += nx * push;
      this.z += nz * push;
      if (kind === 'soft') return;
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      const approach = -(fx * nx + fz * nz) * this.speed;
      if (approach > 0.3 && this.bumpCooldown <= 0) {
        bump = { kind, strength: Math.min(1, approach / 3) };
        this.bumpCooldown = 0.6;
        this.bounceTimer = 0.45;
        this.speed = -Math.sign(this.speed) * Math.max(0.9, Math.abs(this.speed) * 0.4);
        // turn a little along the obstacle so the next try slides off it
        const tx = fx - (fx * nx + fz * nz) * nx, tz = fz - (fx * nx + fz * nz) * nz;
        if (Math.hypot(tx, tz) > 0.05) {
          const want = Math.atan2(tx, tz);
          let d = want - this.heading;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          this.heading += THREE.MathUtils.clamp(d, -0.45, 0.45);
        }
      }
    };
    for (const c of world.circles) {
      const dx = this.x - c.x, dz = this.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + R;
      if (d < min && d > 1e-6) hit(dx / d, dz / d, min - d, c.kind);
    }
    for (const b of world.boxes) {
      const cx = THREE.MathUtils.clamp(this.x, b.x - b.hw, b.x + b.hw);
      const cz = THREE.MathUtils.clamp(this.z, b.z - b.hd, b.z + b.hd);
      const dx = this.x - cx, dz = this.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < R) {
        if (d > 1e-6) hit(dx / d, dz / d, R - d, b.kind);
        else {
          const ox = b.hw - Math.abs(this.x - b.x), oz = b.hd - Math.abs(this.z - b.z);
          if (ox < oz) hit(Math.sign(this.x - b.x) || 1, 0, ox + R, b.kind);
          else hit(0, Math.sign(this.z - b.z) || 1, oz + R, b.kind);
        }
      }
    }
    const B = world.bounds;
    if (this.x < B.minX + R) hit(1, 0, B.minX + R - this.x, 'hard');
    if (this.x > B.maxX - R) hit(-1, 0, this.x - (B.maxX - R), 'hard');
    if (this.z < B.minZ + R) hit(0, 1, B.minZ + R - this.z, 'hard');
    if (this.z > B.maxZ - R) hit(0, -1, this.z - (B.maxZ - R), 'hard');
    return bump;
  }

  // ---- per-frame visuals ------------------------------------------------------
  update(dt, t) {
    for (const w of this.m.wheels) {
      w.rotation.x += (this.speed * dt) / w.userData.radius;
      if (w.position.z > 0) w.rotation.y = this.steerAngle * 0.5;
    }
    for (const d of Object.values(this.decor)) d.update?.(t);
    this.pops = this.pops.filter((p) => {
      p.t = Math.min(1, p.t + dt / 0.45);
      const u = p.t - 1; // ease-out-back: overshoots a little, then settles
      const s = 1 + 2.7 * u * u * u + 1.7 * u * u;
      p.obj.scale.copy(p.obj.userData.baseScale).multiplyScalar(Math.max(0.01, s));
      return p.t < 1;
    });
    const fill = this.m.catcher;
    fill.scale.y = Math.max(0.001, this.fill * fill.userData.maxH);
    this.sync();
  }

  sync() {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.heading;
    const tr = this.m.trailer;
    if (tr) {
      const hx = this.x + Math.sin(this.heading) * this.m.hitchZ;
      const hz = this.z + Math.cos(this.heading) * this.m.hitchZ;
      // trailer axle trails the hitch
      const L = 1.75;
      const ax = hx - Math.sin(this.trailerHeading) * L;
      const az = hz - Math.cos(this.trailerHeading) * L;
      const dx = hx - ax, dz = hz - az;
      if (Math.hypot(dx, dz) > 1e-4) this.trailerHeading = Math.atan2(dx, dz);
      let rel = this.trailerHeading - this.heading;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (Math.abs(rel) > 1.3) this.trailerHeading = this.heading + Math.sign(rel) * 1.3;
      tr.position.set(hx, this.y, hz);
      tr.rotation.y = this.trailerHeading;
    }
  }

  setTip(k) {
    this.m.tipper.rotation.x = this.m.tipAngle * k;
  }

  // world position of the catcher opening (where grass pours from)
  pourPoint() {
    const p = new THREE.Vector3();
    (this.m.tipper).getWorldPosition(p);
    return p;
  }
}
