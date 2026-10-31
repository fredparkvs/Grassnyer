// Particles (clippings, confetti, paint splashes), hint sparkles and the arrow.

import * as THREE from 'three';
import { arrow as arrowModel } from './models.js';

function dotTexture(star) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (star) {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, r = i % 2 ? 6 : 31;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.fill();
  } else {
    g.fillStyle = '#fff';
    g.fillRect(8, 8, 48, 48);
  }
  return new THREE.CanvasTexture(c);
}

export class Particles {
  constructor(max, { size = 0.15, gravity = -9, drag = 0.5, star = false, additive = false } = {}) {
    this.max = max;
    this.gravity = gravity;
    this.drag = drag;
    this.pos = new Float32Array(max * 3).fill(-100);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size, vertexColors: true, map: dotTexture(star), transparent: true, alphaTest: star ? 0 : 0.5,
      depthWrite: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    this.c = new THREE.Color();
  }

  emit(x, y, z, vx, vy, vz, life, colour) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.c.set(colour);
    this.col.set([this.c.r, this.c.g, this.c.b], i * 3);
    this.life[i] = life;
  }

  burst(x, y, z, n, speed, colours, life = 1.5, up = 1) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, Math.cos(a) * s, up * (2 + Math.random() * speed), Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.4), colours[k % colours.length]);
    }
  }

  update(dt) {
    const { pos, vel, life } = this;
    const damp = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const k = i * 3;
      if (life[i] <= 0 || pos[k + 1] < -1) { pos[k + 1] = -100; life[i] = 0; continue; }
      vel[k] *= damp; vel[k + 2] *= damp;
      vel[k + 1] = vel[k + 1] * damp + this.gravity * dt;
      pos[k] += vel[k] * dt;
      pos[k + 1] = Math.max(0.03, pos[k + 1] + vel[k + 1] * dt);
      pos[k + 2] += vel[k + 2] * dt;
      if (pos[k + 1] <= 0.03) { vel[k] *= 0.5; vel[k + 2] *= 0.5; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -100;
  }
}

export const CLIPPING_COLOURS = [0x6cc84a, 0x8fd65a, 0x4fa832, 0xa6e070];
export const CONFETTI_COLOURS = [0xff4f6a, 0xffd21f, 0x3fd06a, 0x3fa8ff, 0xc56bff, 0xff8a1f, 0xffffff];

// Twinkling stars over the patches of grass still standing.
export class Hints {
  constructor() {
    this.max = 40;
    this.sparkles = new Particles(this.max, { size: 0.9, gravity: 0, drag: 0, star: true, additive: true });
    this.sparkles.points.visible = false;
    this.arrow = arrowModel();
    this.arrow.visible = false;
    this.targets = [];
    this.group = new THREE.Group();
    this.group.add(this.sparkles.points, this.arrow);
    this.active = false;
    this.c = new THREE.Color();
  }

  setTargets(patches) {
    patches.sort((a, b) => b.count - a.count);
    this.targets = patches.slice(0, this.max);
  }

  show(on) {
    this.active = on;
    this.sparkles.points.visible = on;
    if (!on) this.arrow.visible = false;
  }

  update(t, vehicle) {
    if (!this.active) return;
    const s = this.sparkles;
    for (let i = 0; i < this.max; i++) {
      const p = this.targets[i];
      if (!p) { s.pos[i * 3 + 1] = -100; continue; }
      s.pos.set([p.x, 0.75 + Math.sin(t * 2 + i) * 0.15, p.z], i * 3);
      const b = 0.55 + 0.45 * Math.sin(t * 5 + i * 1.7);
      this.c.setRGB(1, 0.95, 0.55).multiplyScalar(b);
      s.col.set([this.c.r, this.c.g, this.c.b], i * 3);
    }
    s.points.geometry.attributes.position.needsUpdate = true;
    s.points.geometry.attributes.color.needsUpdate = true;

    let best = null, bd = Infinity;
    for (const p of this.targets) {
      const d = Math.hypot(p.x - vehicle.x, p.z - vehicle.z);
      if (d < bd) { bd = d; best = p; }
    }
    this.arrow.visible = !!best && bd > 2.2;
    if (this.arrow.visible) {
      const lift = vehicle.type === 'tractor' ? 3.1 : 2.6;
      this.arrow.position.set(vehicle.x, lift + Math.sin(t * 4) * 0.12, vehicle.z);
      this.arrow.rotation.y = Math.atan2(best.x - vehicle.x, best.z - vehicle.z);
    }
  }
}
