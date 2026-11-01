// Low-poly toy models built from simple shapes (no model files to license).
// Everything faces +Z, with y = 0 on the ground.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
export function glow(color) {
  return mat(color, { emissive: color, emissiveIntensity: 1 });
}

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

export function rbox(w, h, d, r, material) {
  const geo = cached(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)));
  return new THREE.Mesh(geo, material);
}
export function box(w, h, d, material) {
  return new THREE.Mesh(cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), material);
}
export function cyl(rt, rb, h, material, seg = 14) {
  return new THREE.Mesh(cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), material);
}
export function ball(r, material, seg = 12) {
  return new THREE.Mesh(cached(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0))), material);
}
export function blob(r, material, detail = 1) {
  return new THREE.Mesh(cached(`i${r},${detail}`, () => new THREE.IcosahedronGeometry(r, detail)), material);
}
export function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }

// Soft round shadow under things (much cheaper than real shadows).
let shadowTex = null;
export function blobShadow(w, d, opacity = 0.35) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    cached('shadowPlane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false }),
  );
  m.scale.set(w, 1, d);
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

// ---- common colours --------------------------------------------------
export const C = {
  tyre: 0x2a2a2e, hub: 0xd9d9d9, dark: 0x3a3f45, grey: 0x9aa3ab, seat: 0x26262b,
  skin: 0xf2c49b, shirt: 0x3d7fe0, trousers: 0x2f4a73, straw: 0xf3d36b, strawBand: 0xd9534f,
  fabric: 0x55704b, grass: 0x5cb83a, trunk: 0x8a5a33, leaf: 0x4fa83a, leaf2: 0x3d9130,
  wood: 0xb7814a, woodDark: 0x8d6236, white: 0xf7f7f2, soil: 0x7a5636, sand: 0xf0d995,
  water: 0x4fb3e8, stone: 0xb9b5ab, roof: 0xc4553c, hedge: 0x3f8f34,
};

export const PAINT = [0xe8352f, 0xff8a1f, 0xffd21f, 0x2fb84a, 0x2f7fe8, 0x8e4fe0, 0xff6fb5, 0x2b2b30];

// ---- wheels and driver ---------------------------------------------------
export function wheel(radius, width) {
  const g = new THREE.Group();
  const tyre = cyl(radius, radius, width, mat(C.tyre), 18);
  tyre.rotation.z = Math.PI / 2;
  const hub = cyl(radius * 0.55, radius * 0.55, width * 1.04, mat(C.hub), 14);
  hub.rotation.z = Math.PI / 2;
  g.add(tyre, hub);
  g.userData = { radius, width };
  return g;
}

export function driver(seatPos) {
  const g = new THREE.Group();
  const [x, y, z] = seatPos;
  g.add(at(rbox(0.36, 0.42, 0.26, 0.09, mat(C.shirt)), x, y + 0.27, z));
  // legs reach forward
  for (const s of [-1, 1]) {
    g.add(at(rbox(0.13, 0.13, 0.42, 0.05, mat(C.trousers)), x + s * 0.1, y + 0.08, z + 0.24));
    g.add(at(rbox(0.13, 0.32, 0.13, 0.05, mat(C.trousers)), x + s * 0.1, y - 0.06, z + 0.44));
    const arm = cyl(0.05, 0.05, 0.42, mat(C.shirt), 8);
    arm.position.set(x + s * 0.2, y + 0.33, z + 0.2);
    arm.rotation.x = Math.PI / 2.6;
    g.add(arm);
  }
  const head = new THREE.Group();
  head.position.set(x, y + 0.64, z);
  head.add(ball(0.17, mat(C.skin), 14));
  for (const s of [-1, 1]) head.add(at(ball(0.025, mat(0x222222), 6), s * 0.06, 0.03, 0.155));
  head.add(at(rbox(0.08, 0.02, 0.02, 0.01, mat(0xc2554b)), 0, -0.06, 0.16));
  const hat = sunHat();
  hat.position.y = 0.12;
  head.add(hat);
  g.add(head);
  return { group: g, head, hat };
}

export function sunHat() {
  const g = new THREE.Group();
  g.add(cyl(0.32, 0.32, 0.025, mat(C.straw), 18));
  g.add(at(cyl(0.15, 0.17, 0.15, mat(C.straw), 14), 0, 0.08, 0));
  g.add(at(cyl(0.172, 0.172, 0.04, mat(C.strawBand), 14), 0, 0.03, 0));
  return g;
}

// Open-topped box (grass catcher / trailer) with a grass fill that grows.
function bin(w, h, d, wallMat) {
  const g = new THREE.Group();
  const t = 0.05;
  g.add(at(box(w, t, d, wallMat), 0, t / 2, 0));
  g.add(at(box(t, h, d, wallMat), -w / 2 + t / 2, h / 2, 0));
  g.add(at(box(t, h, d, wallMat), w / 2 - t / 2, h / 2, 0));
  g.add(at(box(w, h, t, wallMat), 0, h / 2, -d / 2 + t / 2));
  g.add(at(box(w, h, t, wallMat), 0, h / 2, d / 2 - t / 2));
  const fill = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * t, 1, d - 2 * t).translate(0, 0.5, 0), mat(C.grass));
  fill.position.y = t;
  fill.scale.y = 0.001;
  fill.userData.maxH = h - t * 1.5;
  g.add(fill);
  return { group: g, fill };
}

// ---- vehicles ----------------------------------------------------------
// Each returns { root, paint, wheels, catcher, tipper, anchors, driver }.

export function buildMower(colour) {
  const root = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colour });
  const wheels = [];
  for (const s of [-1, 1]) {
    const r = at(wheel(0.34, 0.24), s * 0.6, 0.34, -0.42); r.userData.side = s; wheels.push(r);
    const f = at(wheel(0.24, 0.18), s * 0.5, 0.24, 0.66); f.userData.side = s; wheels.push(f);
  }
  root.add(...wheels);
  root.add(at(rbox(1.38, 0.14, 0.86, 0.05, mat(C.grey)), 0, 0.2, 0.12));
  root.add(at(rbox(1.0, 0.44, 1.6, 0.1, paint), 0, 0.52, 0.02));
  root.add(at(rbox(0.94, 0.34, 0.74, 0.12, paint), 0, 0.86, 0.44));
  root.add(at(rbox(0.72, 0.24, 0.06, 0.02, mat(C.dark)), 0, 0.8, 0.82));
  root.add(at(rbox(0.6, 0.12, 0.5, 0.05, mat(C.seat)), 0, 0.8, -0.3));
  root.add(at(rbox(0.6, 0.46, 0.12, 0.05, mat(C.seat)), 0, 1.02, -0.56));
  const col = cyl(0.03, 0.03, 0.5, mat(C.dark), 8);
  col.position.set(0, 1.0, 0.18);
  col.rotation.x = -0.5;
  root.add(col);
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 16), mat(C.dark));
  sw.position.set(0, 1.22, 0.06);
  sw.rotation.x = -1.0;
  root.add(sw);
  // roll bar behind the seat
  for (const s of [-1, 1]) root.add(at(cyl(0.04, 0.04, 0.9, mat(C.dark), 8), s * 0.46, 1.15, -0.7));
  const bar = cyl(0.04, 0.04, 0.96, mat(C.dark), 8);
  bar.rotation.z = Math.PI / 2;
  root.add(at(bar, 0, 1.6, -0.7));

  // grass catcher on a hinge at its bottom-rear edge
  const tipper = new THREE.Group();
  tipper.position.set(0, 0.42, -1.36);
  const c = bin(0.92, 0.6, 0.6, mat(C.fabric));
  c.group.position.set(0, 0, 0.3);
  tipper.add(c.group);
  root.add(tipper);
  root.add(at(rbox(0.5, 0.06, 0.12, 0.02, mat(C.dark)), 0, 0.5, -0.98));

  const d = driver([0, 0.86, -0.3]);
  root.add(d.group);
  root.add(blobShadow(1.9, 2.6));

  const anchors = {
    side: [
      { pos: [0.505, 0.52, 0.02], normal: 1, w: 1.25, h: 0.34 },
      { pos: [-0.505, 0.52, 0.02], normal: -1, w: 1.25, h: 0.34 },
    ],
    bonnet: { pos: [0, 1.035, 0.44], w: 0.74, d: 0.56 },
    roof: { pos: [0, 1.64, -0.7], w: 0.9 },
    headlights: [[-0.28, 0.86, 0.82], [0.28, 0.86, 0.82]],
    under: { w: 1.6, d: 2.2 },
    edges: [[-0.5, 0.75, 0.8], [-0.5, 0.75, -0.75], [0.5, 0.75, -0.75], [0.5, 0.75, 0.8]],
    exhaust: [0.32, 1.0, 0.62],
    flag: [0.46, 1.6, -0.7],
  };
  return { root, paint, wheels, catcher: c.fill, tipper, tipAngle: -1.9, anchors, driver: d, radius: 0.85 };
}

export function buildTractor(colour) {
  const root = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colour });
  const wheels = [];
  for (const s of [-1, 1]) {
    const r = at(wheel(0.58, 0.32), s * 0.68, 0.58, -0.4); r.userData.side = s; wheels.push(r);
    const f = at(wheel(0.34, 0.22), s * 0.52, 0.34, 0.95); f.userData.side = s; wheels.push(f);
  }
  root.add(...wheels);
  root.add(at(rbox(1.5, 0.14, 0.8, 0.05, mat(C.grey)), 0, 0.2, 0.28));
  root.add(at(rbox(0.6, 0.34, 2.1, 0.08, mat(C.dark)), 0, 0.5, 0.25));
  root.add(at(rbox(0.74, 0.62, 1.28, 0.14, paint), 0, 0.92, 0.62));
  root.add(at(rbox(0.62, 0.5, 0.06, 0.02, mat(C.dark)), 0, 0.9, 1.27));
  for (const s of [-1, 1]) root.add(at(rbox(0.4, 0.12, 1.15, 0.05, paint), s * 0.68, 1.2, -0.4));
  root.add(at(rbox(1.0, 0.1, 0.8, 0.03, mat(C.dark)), 0, 0.78, -0.38));
  root.add(at(rbox(0.6, 0.12, 0.5, 0.05, mat(C.seat)), 0, 1.0, -0.42));
  root.add(at(rbox(0.6, 0.46, 0.12, 0.05, mat(C.seat)), 0, 1.22, -0.68));
  const col = cyl(0.03, 0.03, 0.5, mat(C.dark), 8);
  col.position.set(0, 1.28, 0.06);
  col.rotation.x = -0.5;
  root.add(col);
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16), mat(C.dark));
  sw.position.set(0, 1.48, -0.06);
  sw.rotation.x = -1.0;
  root.add(sw);
  root.add(at(cyl(0.05, 0.05, 0.5, mat(C.dark), 8), 0.22, 1.45, 1.0));
  for (const s of [-1, 1]) root.add(at(cyl(0.045, 0.045, 1.4, mat(C.dark), 8), s * 0.52, 1.45, -0.86));
  root.add(at(rbox(1.25, 0.08, 1.15, 0.04, mat(C.white)), 0, 2.16, -0.4));
  for (const s of [-1, 1]) root.add(at(cyl(0.035, 0.035, 1.4, mat(C.dark), 8), s * 0.52, 1.45, 0.06));

  const d = driver([0, 1.06, -0.42]);
  root.add(d.group);
  root.add(blobShadow(2.2, 3.0));

  // trailer follows the hitch; positioned in world space by the Vehicle
  const trailer = new THREE.Group();
  const tbody = new THREE.Group();
  tbody.position.set(0, 0.42, -1.75);
  const tipper = new THREE.Group();
  tipper.position.set(0, 0, -0.65);
  const c = bin(1.25, 0.55, 1.3, paint);
  c.group.position.set(0, 0, 0.65);
  tipper.add(c.group);
  tbody.add(tipper);
  trailer.add(tbody);
  for (const s of [-1, 1]) trailer.add(at(wheel(0.3, 0.18), s * 0.72, 0.3, -1.75));
  const bar2 = rbox(0.1, 0.08, 1.1, 0.03, mat(C.dark));
  trailer.add(at(bar2, 0, 0.45, -0.55));
  trailer.add(at(blobShadow(1.8, 1.8, 0.3), 0, 0, -1.75));

  const anchors = {
    side: [
      { pos: [0.375, 0.95, 0.6], normal: 1, w: 1.05, h: 0.44 },
      { pos: [-0.375, 0.95, 0.6], normal: -1, w: 1.05, h: 0.44 },
    ],
    bonnet: { pos: [0, 1.235, 0.62], w: 0.6, d: 1.0 },
    roof: { pos: [0, 2.2, -0.4], w: 1.1 },
    headlights: [[-0.22, 1.0, 1.29], [0.22, 1.0, 1.29]],
    under: { w: 1.8, d: 2.8 },
    edges: [[-0.62, 2.12, 0.18], [-0.62, 2.12, -0.98], [0.62, 2.12, -0.98], [0.62, 2.12, 0.18]],
    exhaust: [-0.22, 1.45, 1.0],
    flag: [0.55, 2.2, -0.95],
  };
  return { root, paint, wheels, catcher: c.fill, tipper, tipAngle: -1.0, anchors, driver: d, radius: 0.85, trailer, hitchZ: -1.0 };
}

// ---- garden things ---------------------------------------------------------
export function tree(scale = 1) {
  const g = new THREE.Group();
  g.add(at(cyl(0.18 * scale, 0.26 * scale, 1.6 * scale, mat(C.trunk), 8), 0, 0.8 * scale, 0));
  const leaves = [[0, 2.2, 0, 1.15], [0.6, 1.9, 0.2, 0.8], [-0.55, 1.95, -0.2, 0.85], [0.1, 2.75, -0.1, 0.8]];
  leaves.forEach(([x, y, z, r], i) => {
    const m = blob(r * scale, mat(i % 2 ? C.leaf2 : C.leaf, { flatShading: true }), 1);
    g.add(at(m, x * scale, y * scale, z * scale));
  });
  g.add(blobShadow(2.6 * scale, 2.6 * scale, 0.3));
  return g;
}

export function bush(r = 0.7) {
  const g = new THREE.Group();
  g.add(at(blob(r, mat(C.hedge, { flatShading: true }), 1), 0, r * 0.75, 0));
  g.add(at(blob(r * 0.6, mat(C.leaf, { flatShading: true }), 1), r * 0.4, r * 1.1, r * 0.2));
  g.add(blobShadow(r * 2.4, r * 2.4, 0.3));
  return g;
}

const FLOWER_COLOURS = [0xff5a7a, 0xffd23f, 0xffffff, 0xb46bff, 0xff8c42, 0x5ab8ff];
export function flowerBed(w, d) {
  const g = new THREE.Group();
  g.add(at(rbox(w, 0.16, d, 0.06, mat(C.soil)), 0, 0.08, 0));
  const n = Math.round(w * d * 4);
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * (w - 0.3);
    const z = (Math.random() - 0.5) * (d - 0.3);
    const h = 0.35 + Math.random() * 0.3;
    g.add(at(cyl(0.02, 0.02, h, mat(0x3f8f34), 4), x, h / 2 + 0.1, z));
    g.add(at(ball(0.1, mat(FLOWER_COLOURS[i % FLOWER_COLOURS.length]), 6), x, h + 0.12, z));
  }
  return g;
}

export function bench(w = 1.8) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) g.add(at(box(0.08, 0.45, 0.5, mat(C.dark)), s * (w / 2 - 0.15), 0.22, 0));
  for (let i = 0; i < 3; i++) g.add(at(rbox(w, 0.06, 0.14, 0.02, mat(C.wood)), 0, 0.47, -0.17 + i * 0.17));
  for (let i = 0; i < 2; i++) g.add(at(rbox(w, 0.12, 0.05, 0.02, mat(C.wood)), 0, 0.7 + i * 0.17, -0.26));
  g.add(blobShadow(w + 0.4, 1.0, 0.3));
  return g;
}

export function gnome() {
  const g = new THREE.Group();
  g.add(at(cyl(0.2, 0.26, 0.4, mat(0x3d7fe0), 10), 0, 0.2, 0));
  g.add(at(ball(0.16, mat(C.skin), 10), 0, 0.53, 0));
  g.add(at(blob(0.15, mat(C.white, { flatShading: true }), 0), 0, 0.43, 0.08));
  g.add(at(cyl(0.0, 0.18, 0.45, mat(0xe8352f), 10), 0, 0.85, 0));
  g.add(blobShadow(0.8, 0.8, 0.3));
  return g;
}

export function pond(r) {
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(r, 28).rotateX(-Math.PI / 2), mat(C.water));
  water.position.y = 0.04;
  g.add(water);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 6, 28).rotateX(Math.PI / 2), mat(C.stone, { flatShading: true }));
  ring.position.y = 0.08;
  g.add(ring);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7, rr = r * 0.55;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10, 0.4, Math.PI * 1.8).rotateX(-Math.PI / 2), mat(0x3f9a3a));
    pad.position.set(Math.cos(a) * rr, 0.06, Math.sin(a) * rr);
    g.add(pad);
  }
  return g;
}

export function sandpit(w, d) {
  const g = new THREE.Group();
  g.add(at(box(w - 0.2, 0.12, d - 0.2, mat(C.sand)), 0, 0.06, 0));
  for (const s of [-1, 1]) {
    g.add(at(rbox(w, 0.25, 0.14, 0.04, mat(C.wood)), 0, 0.125, s * (d / 2 - 0.07)));
    g.add(at(rbox(0.14, 0.25, d, 0.04, mat(C.wood)), s * (w / 2 - 0.07), 0.125, 0));
  }
  g.add(at(cyl(0.12, 0.18, 0.22, mat(0xe8352f), 10), w * 0.2, 0.2, 0));
  return g;
}

export function hayBale() {
  const g = new THREE.Group();
  const b = cyl(0.6, 0.6, 1.1, mat(0xe6c45a), 14);
  b.rotation.z = Math.PI / 2;
  b.position.y = 0.6;
  g.add(b);
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.6, 14), mat(0xd4ad42));
    c.rotation.y = s * Math.PI / 2;
    c.position.set(s * 0.551, 0.6, 0);
    g.add(c);
  }
  g.add(blobShadow(1.6, 1.6, 0.3));
  return g;
}

export function rock(r = 0.5) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat(C.stone, { flatShading: true }));
  m.scale.y = 0.7;
  m.position.y = r * 0.45;
  g.add(m, blobShadow(r * 2.4, r * 2.4, 0.3));
  return g;
}

export function stones(w, d) {
  const g = new THREE.Group();
  const step = 0.7;
  const along = w > d;
  const len = along ? w : d;
  for (let t = -len / 2 + step / 2; t < len / 2; t += step) {
    for (let k = -1; k <= 1; k += 2) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.06, 8), mat(C.stone));
      const off = k * 0.32 * (along ? d : w) / 1.4;
      m.position.set(along ? t : off, 0.03, along ? off : t);
      g.add(m);
    }
  }
  return g;
}

// A wrapped present. shape: 'cube', 'tall', 'wide' or 'round' (a hatbox).
export function present(colour, { ribbon = C.white, shape = 'cube' } = {}) {
  const g = new THREE.Group();
  const rib = mat(ribbon);
  let top;
  if (shape === 'round') {
    g.add(at(cyl(0.24, 0.24, 0.3, mat(colour), 16), 0, 0.15, 0));
    g.add(at(cyl(0.256, 0.256, 0.08, mat(colour), 16), 0, 0.31, 0));   // lid
    g.add(at(cyl(0.245, 0.245, 0.06, rib, 16), 0, 0.17, 0));
    top = 0.35;
  } else {
    const [w, h, d] = shape === 'tall' ? [0.34, 0.6, 0.34] : shape === 'wide' ? [0.62, 0.26, 0.48] : [0.42, 0.38, 0.42];
    g.add(at(rbox(w, h, d, 0.04, mat(colour)), 0, h / 2, 0));
    g.add(at(box(w + 0.02, h + 0.02, 0.08, rib), 0, h / 2, 0));
    g.add(at(box(0.08, h + 0.02, d + 0.02, rib), 0, h / 2, 0));
    top = h;
  }
  for (const s of [-1, 1]) {
    const bow = new THREE.Mesh(cached('bow', () => new THREE.TorusGeometry(0.08, 0.03, 6, 10)), rib);
    bow.position.set(s * 0.07, top + 0.05, 0);
    bow.rotation.y = s * 0.6;
    g.add(bow);
  }
  return g;
}

// A little striped parachute that bonus presents float down on.
export function parachute(colour) {
  const g = new THREE.Group();
  const segs = 8;
  for (let i = 0; i < segs; i++) {   // alternating panels
    const geo = cached(`chute${i}`, () => new THREE.SphereGeometry(0.6, 3, 6, (i / segs) * Math.PI * 2, (Math.PI * 2) / segs, 0, Math.PI / 2));
    const panel = new THREE.Mesh(geo, mat(i % 2 ? C.white : colour, { side: THREE.DoubleSide }));
    panel.scale.y = 0.55;
    panel.position.y = 1.15;
    g.add(panel);
  }
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.55, 1.15, Math.sin(a) * 0.55), new THREE.Vector3(0, 0.42, 0));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x555555 })));
  return g;
}

// ---- edges and buildings --------------------------------------------------
export function hedgeRun(len, along) {
  const m = rbox(along ? len : 0.8, 0.75, along ? 0.8 : len, 0.28, mat(C.hedge, { flatShading: true }));
  m.position.y = 0.375;
  return m;
}

export function fenceRun(len, along, colour = C.wood) {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 1.2));
  for (let i = 0; i <= n; i++) {
    const t = -len / 2 + (i * len) / n;
    g.add(at(box(0.12, 1.0, 0.12, mat(colour)), along ? t : 0, 0.5, along ? 0 : t));
  }
  for (const y of [0.4, 0.8]) g.add(at(box(along ? len : 0.06, 0.12, along ? 0.06 : len, mat(colour)), 0, y, 0));
  return g;
}

export function pickets(len, along) {
  const g = new THREE.Group();
  const n = Math.round(len / 0.3);
  for (let i = 0; i <= n; i++) {
    const t = -len / 2 + (i * len) / n;
    g.add(at(box(0.14, 0.75, 0.05, mat(C.white)), along ? t : 0, 0.37, along ? 0 : t)).children.at(-1).rotation.y = along ? 0 : Math.PI / 2;
  }
  g.add(at(box(along ? len : 0.04, 0.08, along ? 0.04 : len, mat(C.white)), 0, 0.5, 0));
  return g;
}

export function house(w = 12, colour = 0xf2e3c6) {
  const g = new THREE.Group();
  g.add(at(box(w, 4.2, 5, mat(colour)), 0, 2.1, 0));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 3.9, 2.4, 4, 1).rotateY(Math.PI / 4), mat(C.roof, { flatShading: true }));
  roof.scale.set(w / 5.2, 1, 5.6 / 5.2);
  roof.position.y = 5.4;
  g.add(roof);
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 1.6 + i * (w - 3.2) / 3;
    g.add(at(box(1.1, 1.1, 0.1, mat(0x8fd3ff)), x, 2.7, 2.52));
    g.add(at(box(1.3, 0.12, 0.14, mat(C.white)), x, 2.12, 2.54));
  }
  g.add(at(box(1.2, 2.0, 0.1, mat(0x7a4a2a)), 0.6, 1.0, 2.52));
  return g;
}

export function barn() {
  const g = new THREE.Group();
  g.add(at(box(7, 4, 5, mat(0xc0392b)), 0, 2, 0));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 3.7, 2.4, 4, 1).rotateY(Math.PI / 4), mat(0x6b4f3a, { flatShading: true }));
  roof.scale.set(7.4 / 5.2, 1, 5.6 / 5.2);
  roof.position.y = 5.2;
  g.add(roof);
  g.add(at(box(2.6, 2.8, 0.1, mat(C.white)), 0, 1.4, 2.52));
  g.add(at(box(2.3, 2.5, 0.12, mat(0x9e2f23)), 0, 1.35, 2.53));
  return g;
}

export function shed() {
  const g = new THREE.Group();
  g.add(at(box(3.6, 2.6, 3.0, mat(0x8fb36b)), 0, 1.3, 0));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 4.0, 3, 1, false).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), mat(0x5d4636, { flatShading: true }));
  roof.scale.set(1, 0.45, 0.82);
  roof.position.y = 2.85;
  g.add(roof);
  g.add(at(box(2.5, 2.1, 0.06, mat(0x2a2620)), 0, 1.05, 1.5));
  // two door leaves hinge at the edges of the doorway
  const doors = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(s * 1.25, 0, 1.52);
    const leaf = at(box(1.25, 2.1, 0.08, mat(C.wood)), -s * 0.625, 1.05, 0);
    hinge.add(leaf);
    hinge.rotation.y = s * 1.9; // open
    g.add(hinge);
    doors.push(hinge);
  }
  g.userData.doors = doors;
  return g;
}

export function compostBin() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const y = 0.15 + i * 0.25;
    g.add(at(box(2.0, 0.16, 0.1, mat(C.woodDark)), 0, y, -1.0));
    g.add(at(box(0.1, 0.16, 2.0, mat(C.woodDark)), -1.0, y, 0));
    g.add(at(box(0.1, 0.16, 2.0, mat(C.woodDark)), 1.0, y, 0));
  }
  g.add(at(blob(0.8, mat(0x6e5a2e, { flatShading: true }), 0), 0, 0.2, -0.3));
  return g;
}

// A lumpy green mountain of clippings, built at full size and scaled up.
export function grassPile() {
  const g = new THREE.Group();
  const shades = [0x5cb83a, 0x6cc84a, 0x4fa832, 0x7dd35a];
  const lumps = [[0, 1.0, 0, 2.2], [1.4, 0.7, 0.6, 1.5], [-1.3, 0.7, 0.4, 1.6], [0.4, 0.8, -1.3, 1.5],
    [-0.5, 0.7, 1.3, 1.4], [0.2, 2.1, 0.1, 1.5], [0.6, 2.9, -0.2, 1.0], [-0.4, 2.6, 0.4, 1.1], [0.1, 3.5, 0, 0.7]];
  lumps.forEach(([x, y, z, r], i) => g.add(at(blob(r, mat(shades[i % shades.length], { flatShading: true }), 1), x, y, z)));
  g.add(blobShadow(6, 6, 0.3));
  return g;
}

export function arrow() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.7);
  shape.lineTo(0.5, 0.1);
  shape.lineTo(0.2, 0.1);
  shape.lineTo(0.2, -0.5);
  shape.lineTo(-0.2, -0.5);
  shape.lineTo(-0.2, 0.1);
  shape.lineTo(-0.5, 0.1);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
  geo.translate(0, 0, -0.07);
  geo.rotateX(Math.PI / 2); // lie flat, pointing along +Z
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xffd21f, emissive: 0x996600, side: THREE.DoubleSide }));
  const g = new THREE.Group();
  g.add(m);
  return g;
}

// ---- the family's chow chow -------------------------------------------------
// Big, fluffy and tan, with a lion-like ruff, small ears, a tail curled over
// its back and the breed's blue-black tongue (shown while panting).
// Returns parts so dog.js can animate them: legs pivot at the hip.
export function chowChow() {
  const tan = mat(0xd8a05e), deep = mat(0xb98247), ruff = mat(0xe4b273), cream = mat(0xf1d39b);
  const black = mat(0x1e1e22), tongueMat = mat(0x2c2f6b);
  const root = new THREE.Group();
  root.add(blobShadow(1.3, 1.9, 0.3));
  const body = new THREE.Group();
  root.add(body);
  body.add(at(rbox(0.76, 0.62, 1.05, 0.3, tan), 0, 0.6, -0.02));
  const rump = at(blob(0.4, tan), 0, 0.64, -0.44);
  rump.scale.set(1, 0.95, 0.9);
  body.add(rump);
  const mane = at(blob(0.46, ruff), 0, 0.8, 0.3);   // the big ruff around the neck
  mane.scale.set(1.15, 1.02, 0.72);
  body.add(mane);

  const head = new THREE.Group();
  head.position.set(0, 0.98, 0.76);
  body.add(head);
  const skull = blob(0.3, tan);
  skull.scale.set(1.05, 0.92, 1);
  head.add(skull);
  head.add(at(rbox(0.3, 0.2, 0.24, 0.09, cream), 0, -0.07, 0.25));   // short square muzzle
  head.add(at(ball(0.06, black, 8), 0, -0.02, 0.38));                // nose
  for (const s of [-1, 1]) {
    head.add(at(ball(0.035, black, 6), s * 0.11, 0.07, 0.24));         // small deep-set eyes
    const ear = at(cyl(0, 0.09, 0.17, deep, 4), s * 0.17, 0.27, -0.02);
    ear.rotation.z = -s * 0.25;
    head.add(ear);
  }
  const tongue = at(rbox(0.11, 0.03, 0.15, 0.015, tongueMat), 0, -0.2, 0.34);
  tongue.rotation.x = 0.6;
  head.add(tongue);

  const legs = [];
  for (const [x, z] of [[-0.23, 0.32], [0.23, 0.32], [-0.23, -0.36], [0.23, -0.36]]) {
    const hip = new THREE.Group();   // short, thick chow legs
    hip.position.set(x, 0.38, z);
    hip.add(at(cyl(0.15, 0.13, 0.36, deep, 8), 0, -0.18, 0));
    hip.add(at(ball(0.13, deep, 8), 0, -0.33, 0.04));                  // fluffy paw
    body.add(hip);
    legs.push(hip);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.9, -0.42);
  const curl = at(blob(0.22, ruff), 0, 0.08, 0.06);                    // curled up over the back
  curl.scale.set(0.9, 0.8, 1.15);
  tail.add(curl);
  tail.add(at(blob(0.12, cream), 0.05, 0.2, 0.14));
  body.add(tail);

  return { root, body, head, legs, tail, tongue, radius: 0.55 };
}
