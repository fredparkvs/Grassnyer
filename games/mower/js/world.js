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
  // each lawn has its own sky (see the looks in lawns.js)
  g.userData.apply = (look) => {
    sky.material.uniforms.uTop.value.set(look.sky[0]);
    sky.material.uniforms.uHorizon.value.set(look.sky[1]);
    cloudMat.color.set(look.clouds ?? 0xffffff);
    cloudMat.emissive.set(look.clouds ?? 0xffffff).multiplyScalar(0.73);
  };
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
  const hemi = new THREE.HemisphereLight(0xe8f6ff, 0x6a9a48, 1.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6e0, 2.2);
  sun.position.set(6, 12, 8);
  scene.add(sun);
  return { hemi, sun };
}

// Sky, fog and light for a lawn's look.
export function applyLook(look, { scene, sky, lights }) {
  sky.userData.apply(look);
  scene.fog.color.set(look.fog);
  lights.hemi.color.set(look.hemi[0]);
  lights.hemi.groundColor.set(look.hemi[1]);
  lights.hemi.intensity = look.hemi[2];
  lights.sun.color.set(look.sun[0]);
  lights.sun.intensity = look.sun[1];
  lights.sun.position.set(...look.sun[2]);
}

// Little things floating in the air: petals, dandelion fluff, golden dust or fireflies.
let moteTex = null;
function makeMotes(motes, w, h) {
  if (!moteTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 1, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    moteTex = new THREE.CanvasTexture(c);
  }
  const n = 130, glowy = motes.kind === 'fireflies';
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), base = [], colours = [];
  const rnd = mulberry(w * 7 + h);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    base.push({ x: (rnd() - 0.5) * (w + 6), y: 0.4 + rnd() * (glowy ? 1.6 : 3), z: (rnd() - 0.5) * (h + 6), p: rnd() * 6.3, s: 0.5 + rnd() });
    colours.push(c.set(motes.colours[i % motes.colours.length]).clone());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: glowy ? 0.3 : motes.kind === 'dust' ? 0.09 : 0.16, map: moteTex, vertexColors: true, transparent: true,
    depthWrite: false, blending: glowy || motes.kind === 'dust' ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  const drift = motes.kind === 'petals' || motes.kind === 'fluff' ? 0.35 : 0;   // carried along on the breeze
  const update = (t) => {
    for (let i = 0; i < n; i++) {
      const b = base[i];
      let x = b.x + Math.sin(t * 0.4 * b.s + b.p) * 0.8 + t * drift * b.s;
      x = ((x + (w + 6) / 2) % (w + 6) + (w + 6)) % (w + 6) - (w + 6) / 2;
      pos[i * 3] = x;
      pos[i * 3 + 1] = b.y + Math.sin(t * 0.9 * b.s + b.p * 2) * 0.25;
      pos[i * 3 + 2] = b.z + Math.cos(t * 0.33 * b.s + b.p) * 0.8;
      const k = glowy ? Math.max(0, Math.sin(t * 2 * b.s + b.p * 3)) : 1;   // fireflies blink
      col[i * 3] = colours[i].r * k; col[i * 3 + 1] = colours[i].g * k; col[i * 3 + 2] = colours[i].b * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  update(0);
  return { points, update };
}

// ---------------------------------------------------------------------------
export function buildWorld(index) {
  const def = LAWNS[index % LAWNS.length];
  const { w, h } = def;
  const group = new THREE.Group();
  const circles = [], boxes = [], shapes = [];

  // ground outside the lawn
  const look = def.look;
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), M.mat(look.ground));
  outside.position.y = -0.02;
  group.add(outside);
  const rnd = mulberry(index * 977 + 13);
  for (let i = 0; i < 6; i++) { // rolling hills on the horizon
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(28 + rnd() * 10, 16, 8), M.mat(look.hills[i % 2]));
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
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(w + 4, 8).rotateX(-Math.PI / 2), M.mat(look.yard));
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
  const grass = new GrassField({ w, h, shapes, start, radius: VEHICLE_RADIUS, cutRadius: CUT_RADIUS, look });
  group.add(grass.group);
  const motes = look.motes ? makeMotes(look.motes, w, h) : null;
  if (motes) group.add(motes.points);

  return {
    def, index, group, grass, start,
    colliders: { circles, boxes, bounds },
    pile: { x: compost.position.x, z: yardZ - 5.0 },
    dumpSpot: { x: compost.position.x, z: yardZ - 1.7, heading: 0 },
    shed: { obj: shed, x: shed.position.x, z: shed.position.z, parkZ: yardZ - 6.9, door: { x: shed.position.x, z: yardZ - 1.7 } },
    update(t) { motes?.update(t); },
    dispose() {
      grass.dispose();
    },
  };
}
