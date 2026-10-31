// Builds a lawn: sky, surroundings, edges, obstacles, colliders and grass.

import * as THREE from 'three';
import * as M from './models.js';
import { GrassField, mulberry } from './grass.js';
import { LAWNS } from './lawns.js';

export const CUT_RADIUS = 1.0;
export const VEHICLE_RADIUS = 0.85;

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = `
uniform vec3 uTop;
uniform vec3 uHorizon;
varying vec3 vDir;
void main() {
  float t = clamp(vDir.y * 1.6, 0.0, 1.0);
  gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0);
  #include <colorspace_fragment>
}`;

export function makeSky() {
  const g = new THREE.Group();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(160, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color(0x4aa8f0) }, uHorizon: { value: new THREE.Color(0xd8f1ff) } },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    }),
  );
  sky.renderOrder = -10;
  g.add(sky);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xbbbbbb, flatShading: true, fog: false });
  const rnd = mulberry(99);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    const a = (i / 9) * Math.PI * 2 + rnd();
    const d = 90 + rnd() * 30;
    c.position.set(Math.cos(a) * d, 28 + rnd() * 14, Math.sin(a) * d);
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + rnd() * 3, 1), cloudMat);
      b.position.set((k - 1.5) * 4.5, rnd() * 2, rnd() * 3);
      b.scale.y = 0.6;
      c.add(b);
    }
    g.add(c);
  }
  return g;
}

export function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x6a9a48, 1.7));
  const sun = new THREE.DirectionalLight(0xfff6e0, 2.2);
  sun.position.set(6, 12, 8);
  scene.add(sun);
}

// ---------------------------------------------------------------------------
export function buildWorld(index) {
  const def = LAWNS[index % LAWNS.length];
  const { w, h } = def;
  const group = new THREE.Group();
  const circles = [], boxes = [], shapes = [];

  // ground outside the lawn
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), M.mat(0x69a94b));
  outside.position.y = -0.02;
  group.add(outside);
  const rnd = mulberry(index * 977 + 13);
  for (let i = 0; i < 6; i++) { // rolling hills on the horizon
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(28 + rnd() * 10, 16, 8), M.mat(i % 2 ? 0x5e9e42 : 0x6fb04f));
    hill.scale.y = 0.28;
    hill.position.set(Math.cos(a) * 85, -2, Math.sin(a) * 85);
    group.add(hill);
  }

  // ---- obstacles ----
  const solidCircle = (x, z, r, kind = 'hard', grassR = r) => {
    circles.push({ x, z, r, kind });
    shapes.push({ type: 'circle', x, z, r: grassR, noGrass: true, solid: false });
    shapes.push({ type: 'circle', x, z, r, noGrass: false, solid: true });
  };
  const solidBox = (x, z, hw, hd, kind = 'hard') => {
    boxes.push({ x, z, hw, hd, kind });
    shapes.push({ type: 'box', x, z, hw, hd, noGrass: true, solid: true });
  };
  for (const o of def.obstacles) {
    let obj = null;
    switch (o.type) {
      case 'tree': obj = M.tree(1); solidCircle(o.x, o.z, 0.5, 'hard', 0.3); break;
      case 'bush': obj = M.bush(0.7); solidCircle(o.x, o.z, 0.7, 'hard', 0.55); break;
      case 'flowers': obj = M.flowerBed(o.w, o.d); solidBox(o.x, o.z, o.w / 2, o.d / 2, 'soft'); break;
      case 'bench': obj = M.bench(1.8); solidBox(o.x, o.z, 0.95, 0.35); break;
      case 'gnome': obj = M.gnome(); solidCircle(o.x, o.z, 0.32); break;
      case 'pond': obj = M.pond(o.r); solidCircle(o.x, o.z, o.r + 0.1, 'water'); break;
      case 'sandpit': obj = M.sandpit(o.w, o.d); solidBox(o.x, o.z, o.w / 2, o.d / 2); break;
      case 'hay': obj = M.hayBale(); solidCircle(o.x, o.z, 0.72); break;
      case 'rock': obj = M.rock(o.r); solidCircle(o.x, o.z, o.r * 0.95); break;
      case 'path':
        obj = M.stones(o.w, o.d);
        shapes.push({ type: 'box', x: o.x, z: o.z, hw: o.w / 2, hd: o.d / 2, noGrass: true, solid: false });
        break;
      default: continue;
    }
    obj.position.set(o.x, 0, o.z);
    if (o.type === 'tree' || o.type === 'bush' || o.type === 'rock' || o.type === 'gnome') obj.rotation.y = rnd() * Math.PI * 2;
    group.add(obj);
  }

  // ---- edges ----
  const sides = [
    { x: 0, z: -h / 2, len: w, along: true }, { x: 0, z: h / 2, len: w, along: true },
    { x: -w / 2, z: 0, len: h, along: false }, { x: w / 2, z: 0, len: h, along: false },
  ];
  for (const s of sides) {
    let e;
    if (def.edge === 'hedge') {
      e = M.hedgeRun(s.len + 1.6, s.along);
      const out = 0.42;
      e.position.set(s.x + (s.along ? 0 : Math.sign(s.x) * out), e.position.y, s.z + (s.along ? Math.sign(s.z) * out : 0));
    } else {
      e = def.edge === 'pickets' ? M.pickets(s.len, s.along) : M.fenceRun(s.len, s.along);
      e.position.set(s.x + (s.along ? 0 : Math.sign(s.x) * 0.08), 0, s.z + (s.along ? Math.sign(s.z) * 0.08 : 0));
    }
    group.add(e);
  }

  // ---- north yard: shed, compost corner, backdrop ----
  const yardZ = -h / 2;
  const shed = M.shed();
  shed.scale.setScalar(1.6); // big enough for the tractor and its trailer
  shed.position.set(w / 2 - 3.6, 0, yardZ - 5.8);
  group.add(shed);
  const compost = M.compostBin();
  compost.position.set(-w / 2 + 3.5, 0, yardZ - 5.6);
  group.add(compost);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(w + 4, 8).rotateX(-Math.PI / 2), M.mat(0x7fb35a));
  yard.position.set(0, -0.01, yardZ - 4.5);
  group.add(yard);

  if (def.backdrop === 'house') {
    const house = M.house(Math.min(w - 2, 16));
    house.position.set(0, 0, yardZ - 11.5);
    group.add(house);
  } else if (def.backdrop === 'farm') {
    const barn = M.barn();
    barn.position.set(2, 0, yardZ - 12);
    group.add(barn);
    for (let i = 0; i < 3; i++) {
      const b = M.hayBale();
      b.position.set(-4 + i * 1.3, 0, yardZ - 9.5);
      group.add(b);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const t = M.tree(1.3 + rnd() * 0.4);
      t.position.set(-8 + i * 4 + rnd(), 0, yardZ - 11 - rnd() * 3);
      group.add(t);
    }
  }

  // trees scattered around the outside
  for (let i = 0; i < 16; i++) {
    const side = i % 3;
    let x, z;
    if (side === 0) { x = -w / 2 - 3.5 - rnd() * 10; z = (rnd() - 0.5) * (h + 20); }
    else if (side === 1) { x = w / 2 + 3.5 + rnd() * 10; z = (rnd() - 0.5) * (h + 20); }
    else { x = (rnd() - 0.5) * (w + 20); z = h / 2 + 4 + rnd() * 10; }
    const t = rnd() < 0.7 ? M.tree(1 + rnd() * 0.6) : M.bush(0.8 + rnd() * 0.5);
    t.position.set(x, 0, z);
    t.rotation.y = rnd() * 6;
    group.add(t);
  }

  const start = { x: 0, z: h / 2 - 2.2, heading: Math.PI };
  const bounds = { minX: -w / 2, maxX: w / 2, minZ: -h / 2, maxZ: h / 2 };
  const grass = new GrassField({ w, h, shapes, start, radius: VEHICLE_RADIUS, cutRadius: CUT_RADIUS });
  group.add(grass.group);

  return {
    def, index, group, grass, start,
    colliders: { circles, boxes, bounds },
    pile: { x: compost.position.x, z: yardZ - 5.0 },
    dumpSpot: { x: compost.position.x, z: yardZ - 1.7, heading: 0 },
    shed: { obj: shed, x: shed.position.x, z: shed.position.z, parkZ: yardZ - 6.9, door: { x: shed.position.x, z: yardZ - 1.7 } },
    dispose() {
      grass.dispose();
    },
  };
}
