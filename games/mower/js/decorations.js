// Purely visual extras found in presents. Each item has a spot (slot) on the
// vehicle; a new find replaces whatever is in that spot.

import * as THREE from 'three';
import { mat, glow, rbox, box, cyl, ball, at } from './models.js';

export const SLOTS = ['side', 'bonnet', 'roof', 'lights', 'wheels', 'hat'];

// ---- canvas helpers ---------------------------------------------------------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function star(g, x, y, r, fill, stroke = '#222') {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = r * 0.12;
  g.strokeStyle = stroke;
  g.stroke();
}

let haloTex = null;
function halo(colour, size) {
  if (!haloTex) {
    haloTex = canvasTex(64, 64, (g) => {
      const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    });
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTex, color: colour, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.set(size, size, 1);
  return s;
}

// ---- vinyl decals -------------------------------------------------------------
const SIDE_ART = {
  flames(g, w, h) {
    const cols = ['#ffd21f', '#ff8a1f', '#e8352f'];
    cols.forEach((c, k) => {
      g.beginPath();
      g.moveTo(0, h * 0.15);
      const tongues = 5;
      for (let i = 0; i < tongues; i++) {
        const y = h * (0.15 + (i + 0.5) * 0.7 / tongues);
        const len = w * (0.55 + 0.35 * Math.sin(i * 1.7 + 1)) * (1 - k * 0.18);
        g.quadraticCurveTo(len * 0.6, y - h * 0.12, len, y);
        g.quadraticCurveTo(len * 0.5, y + h * 0.05, 0, h * (0.15 + (i + 1) * 0.7 / tongues));
      }
      g.closePath();
      g.fillStyle = c;
      g.fill();
      if (k === 0) { g.lineWidth = 6; g.strokeStyle = '#222'; g.stroke(); }
    });
  },
  stripes(g, w, h) {
    [['#ffffff', 0.28], ['#ffd21f', 0.52]].forEach(([c, y]) => {
      g.fillStyle = '#222';
      g.fillRect(0, h * y - 4, w, h * 0.18 + 8);
      g.fillStyle = c;
      g.fillRect(0, h * y, w, h * 0.18);
    });
  },
  lightning(g, w, h) {
    for (let k = 0; k < 3; k++) {
      const x0 = w * (0.12 + k * 0.3);
      g.beginPath();
      g.moveTo(x0, h * 0.08);
      g.lineTo(x0 + w * 0.12, h * 0.08);
      g.lineTo(x0 + w * 0.06, h * 0.45);
      g.lineTo(x0 + w * 0.15, h * 0.45);
      g.lineTo(x0 - w * 0.02, h * 0.95);
      g.lineTo(x0 + w * 0.03, h * 0.55);
      g.lineTo(x0 - w * 0.05, h * 0.55);
      g.closePath();
      g.fillStyle = '#ffe23f';
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = '#222';
      g.stroke();
    }
  },
  rainbow(g, w, h) {
    const cols = ['#e8352f', '#ff8a1f', '#ffd21f', '#2fb84a', '#2f7fe8', '#8e4fe0'];
    const cx = w / 2, cy = h * 1.05, r0 = h * 0.95;
    cols.forEach((c, i) => {
      g.beginPath();
      g.arc(cx, cy, r0 - i * h * 0.11, Math.PI, 0);
      g.lineWidth = h * 0.11;
      g.strokeStyle = c;
      g.stroke();
    });
    for (const x of [cx - r0 + h * 0.2, cx + r0 - h * 0.2]) {
      g.fillStyle = '#fff';
      [[0, 0, 0.16], [0.13, 0.04, 0.12], [-0.13, 0.05, 0.12]].forEach(([dx, dy, r]) => {
        g.beginPath(); g.arc(x + dx * h, h * 0.8 + dy * h, r * h, 0, Math.PI * 2); g.fill();
      });
    }
  },
  dinosaur(g, w, h) {
    g.fillStyle = '#3cc35a';
    g.strokeStyle = '#1d5e2a';
    g.lineWidth = 6;
    const cx = w * 0.5, cy = h * 0.55;
    g.beginPath(); // tail and body
    g.moveTo(w * 0.15, cy);
    g.quadraticCurveTo(cx - w * 0.1, cy - h * 0.38, cx + w * 0.12, cy - h * 0.12);
    g.quadraticCurveTo(cx + w * 0.17, cy - h * 0.42, cx + w * 0.25, cy - h * 0.42);
    g.quadraticCurveTo(cx + w * 0.36, cy - h * 0.4, cx + w * 0.33, cy - h * 0.26);
    g.quadraticCurveTo(cx + w * 0.24, cy - h * 0.22, cx + w * 0.2, cy - h * 0.05);
    g.quadraticCurveTo(cx + w * 0.18, cy + h * 0.28, cx - w * 0.05, cy + h * 0.2);
    g.quadraticCurveTo(cx - w * 0.2, cy + h * 0.15, w * 0.15, cy);
    g.fill(); g.stroke();
    g.fillRect(cx - w * 0.06, cy + h * 0.12, w * 0.04, h * 0.25);
    g.fillRect(cx + w * 0.08, cy + h * 0.1, w * 0.04, h * 0.27);
    g.fillStyle = '#ffd21f';
    for (let i = 0; i < 4; i++) {
      const x = cx - w * 0.12 + i * w * 0.07;
      g.beginPath(); g.moveTo(x, cy - h * 0.2 + i * 0.01 * h); g.lineTo(x + w * 0.03, cy - h * 0.36); g.lineTo(x + w * 0.06, cy - h * 0.2); g.fill();
    }
    g.fillStyle = '#222';
    g.beginPath(); g.arc(cx + w * 0.27, cy - h * 0.33, h * 0.035, 0, 7); g.fill();
  },
  stars(g, w, h) {
    const cols = ['#ffd21f', '#ffffff', '#ff6fb5', '#5ab8ff'];
    for (let i = 0; i < 6; i++) star(g, w * (0.1 + i * 0.16), h * (i % 2 ? 0.35 : 0.65), h * (0.2 + (i % 3) * 0.05), cols[i % 4]);
  },
};

const BONNET_ART = {
  number(g, w, h) {
    g.fillStyle = '#fff';
    g.strokeStyle = '#222';
    g.lineWidth = 10;
    g.beginPath(); g.arc(w / 2, h / 2, h * 0.42, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#222';
    g.font = `bold ${h * 0.62}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('4', w / 2, h * 0.53);
  },
  flower(g, w, h) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.ellipse(w / 2 + Math.cos(a) * h * 0.24, h / 2 + Math.sin(a) * h * 0.24, h * 0.17, h * 0.09, a, 0, 7);
      g.fillStyle = '#fff'; g.fill();
      g.lineWidth = 5; g.strokeStyle = '#555'; g.stroke();
    }
    g.beginPath(); g.arc(w / 2, h / 2, h * 0.14, 0, 7);
    g.fillStyle = '#ffd21f'; g.fill(); g.stroke();
  },
  star(g, w, h) { star(g, w / 2, h * 0.53, h * 0.45, '#ffd21f'); },
  heart(g, w, h) {
    const x = w / 2, y = h * 0.3, s = h * 0.42;
    g.beginPath();
    g.moveTo(x, y + s * 0.3);
    g.bezierCurveTo(x, y, x - s, y - s * 0.4, x - s, y + s * 0.35);
    g.bezierCurveTo(x - s, y + s * 0.9, x, y + s * 1.2, x, y + s * 1.5);
    g.bezierCurveTo(x, y + s * 1.2, x + s, y + s * 0.9, x + s, y + s * 0.35);
    g.bezierCurveTo(x + s, y - s * 0.4, x, y, x, y + s * 0.3);
    g.fillStyle = '#ff4f8b'; g.fill();
    g.lineWidth = 9; g.strokeStyle = '#222'; g.stroke();
  },
};

function decalMaterial(tex) {
  return new THREE.MeshLambertMaterial({
    map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
}

function sideVinyl(name) {
  return (v) => {
    const a = v.anchors.side[0];
    const tex = canvasTex(512, Math.round(512 * a.h / a.w), SIDE_ART[name]);
    const m = decalMaterial(tex);
    const objects = v.anchors.side.map((s) => {
      const geo = new THREE.PlaneGeometry(s.w, s.h);
      if (s.normal < 0) { // mirror so the art points backwards on both sides
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      }
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(...s.pos);
      mesh.position.x += s.normal * 0.012;
      mesh.rotation.y = s.normal * Math.PI / 2;
      return [v.root, mesh];
    });
    return { objects };
  };
}

function bonnetVinyl(name) {
  return (v) => {
    const b = v.anchors.bonnet;
    const tex = canvasTex(256, 256, BONNET_ART[name]);
    const size = Math.min(b.w, b.d) * 0.95;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).rotateY(Math.PI), decalMaterial(tex));
    mesh.position.set(b.pos[0], b.pos[1] + 0.012, b.pos[2]);
    return { objects: [[v.root, mesh]] };
  };
}

// ---- lights ----------------------------------------------------------------------
function headlights(v) {
  const objects = [];
  for (const p of v.anchors.headlights) {
    const g = new THREE.Group();
    g.position.set(...p);
    const lamp = cyl(0.1, 0.1, 0.06, glow(0xfff4c2), 12);
    lamp.rotation.x = Math.PI / 2;
    g.add(lamp, at(halo(0xfff0b0, 1.1), 0, 0, 0.12));
    objects.push([v.root, g]);
  }
  return { objects };
}

let underTex = null;
function underglow(v) {
  if (!underTex) {
    underTex = canvasTex(64, 64, (g) => {
      const grd = g.createRadialGradient(32, 32, 6, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    });
  }
  const m = new THREE.MeshBasicMaterial({ map: underTex, color: 0xff3fd0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(v.anchors.under.w, v.anchors.under.d).rotateX(-Math.PI / 2), m);
  mesh.position.y = 0.06;
  mesh.renderOrder = 2;
  const c = new THREE.Color();
  return {
    objects: [[v.root, mesh]],
    update: (t) => m.color.copy(c.setHSL((t * 0.15) % 1, 1, 0.55)),
  };
}

function fairyLights(v) {
  const cols = [0xff3f6a, 0xffd21f, 0x3fd06a, 0x3fa8ff, 0xc56bff];
  const pts = v.anchors.edges.map((p) => new THREE.Vector3(...p));
  pts.push(pts[0]);
  const g = new THREE.Group();
  const bulbs = [];
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const steps = Math.max(2, Math.round(a.distanceTo(b) / 0.18));
    for (let k = 0; k < steps; k++) {
      const p = a.clone().lerp(b, k / steps);
      p.y -= Math.sin((k / steps) * Math.PI) * 0.06;
      const col = cols[n++ % cols.length];
      const bm = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 1 });
      const bulb = at(ball(0.045, bm, 6), p.x, p.y, p.z);
      g.add(bulb);
      bulbs.push(bm);
    }
  }
  return {
    objects: [[v.root, g]],
    update: (t) => bulbs.forEach((m, i) => { m.emissiveIntensity = 0.4 + 0.6 * (Math.sin(t * 4 + i * 1.3) > 0 ? 1 : 0); }),
  };
}

// ---- roof and add-ons ------------------------------------------------------------
function beacon(v) {
  const g = new THREE.Group();
  g.position.set(...v.anchors.roof.pos);
  g.add(at(cyl(0.12, 0.14, 0.08, mat(0x333333), 12), 0, 0.04, 0));
  const domeMat = new THREE.MeshLambertMaterial({ color: 0xff9a1f, emissive: 0xff7a00, emissiveIntensity: 1, transparent: true, opacity: 0.95 });
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat), 0, 0.08, 0));
  const spin = new THREE.Group();
  spin.position.y = 0.14;
  const h = halo(0xff9a1f, 1.4);
  h.position.set(0.25, 0, 0);
  spin.add(h);
  g.add(spin);
  return {
    objects: [[v.root, g]],
    update: (t) => { spin.rotation.y = t * 6; domeMat.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 12); },
  };
}

function lightBar(v) {
  const g = new THREE.Group();
  g.position.set(...v.anchors.roof.pos);
  const w = Math.min(0.95, v.anchors.roof.w);
  g.add(at(rbox(w, 0.1, 0.16, 0.04, mat(0x333333)), 0, 0.06, 0));
  const cells = [];
  for (let i = 0; i < 6; i++) {
    const col = i % 2 ? 0xffffff : 0xffb21f;
    const m = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 1 });
    g.add(at(box(w / 7, 0.07, 0.04, m), -w / 2 + (i + 0.5) * (w / 6), 0.07, 0.08));
    cells.push(m);
  }
  return {
    objects: [[v.root, g]],
    update: (t) => cells.forEach((m, i) => { m.emissiveIntensity = Math.floor(t * 8) % 6 === i ? 1.6 : 0.5; }),
  };
}

function flag(v) {
  const g = new THREE.Group();
  g.position.set(...v.anchors.flag);
  g.add(at(cyl(0.02, 0.02, 1.1, mat(0xdddddd), 6), 0, 0.55, 0));
  const tex = canvasTex(128, 96, (c, w, h) => {
    const s = 16;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      c.fillStyle = ((x + y) / s) % 2 ? '#e8352f' : '#ffd21f';
      c.fillRect(x, y, s, s);
    }
  });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36, 6, 1).translate(-0.25, 0, 0),
    new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  cloth.position.y = 0.92;
  g.add(cloth);
  const pos = cloth.geometry.attributes.position;
  const base = Float32Array.from(pos.array);
  return {
    objects: [[v.root, g]],
    update: (t) => {
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        pos.setZ(i, Math.sin(t * 7 + x * 9) * 0.06 * (-x / 0.5));
      }
      pos.needsUpdate = true;
    },
  };
}

function exhaust(v) {
  const g = new THREE.Group();
  g.position.set(...v.anchors.exhaust);
  const chrome = new THREE.MeshPhongMaterial({ color: 0xdfe6ee, specular: 0xffffff, shininess: 90 });
  g.add(at(cyl(0.07, 0.07, 0.8, chrome, 12), 0, 0.4, 0));
  g.add(at(cyl(0.09, 0.07, 0.08, chrome, 12), 0, 0.82, 0));
  const puffs = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
    const p = ball(0.08, m, 8);
    g.add(p);
    puffs.push(p);
  }
  return {
    objects: [[v.root, g]],
    update: (t) => puffs.forEach((p, i) => {
      const k = (t * 0.8 + i / 3) % 1;
      p.position.set(0, 0.9 + k * 0.7, -k * 0.2);
      p.scale.setScalar(0.6 + k * 1.6);
      p.material.opacity = 0.7 * (1 - k);
    }),
  };
}

// ---- hubcaps --------------------------------------------------------------------
function hubcaps(style) {
  return (v) => {
    const tex = canvasTex(128, 128, (g, w) => {
      const r = w / 2;
      if (style === 'rainbow') {
        const cols = ['#e8352f', '#ff8a1f', '#ffd21f', '#2fb84a', '#2f7fe8', '#8e4fe0'];
        cols.forEach((c, i) => {
          g.beginPath(); g.moveTo(r, r); g.arc(r, r, r - 2, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3); g.fillStyle = c; g.fill();
        });
      } else {
        const grd = g.createRadialGradient(r * 0.7, r * 0.6, 4, r, r, r);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(1, style === 'gold' ? '#c8961e' : '#9aa6b2');
        g.fillStyle = grd;
        g.beginPath(); g.arc(r, r, r - 2, 0, 7); g.fill();
        g.strokeStyle = style === 'gold' ? '#8a6510' : '#5d6670';
        g.lineWidth = 6;
        for (let i = 0; i < 5; i++) {
          const a = (i * 2 * Math.PI) / 5;
          g.beginPath(); g.moveTo(r, r); g.lineTo(r + Math.cos(a) * r * 0.85, r + Math.sin(a) * r * 0.85); g.stroke();
        }
      }
      g.fillStyle = '#333';
      g.beginPath(); g.arc(r, r, r * 0.15, 0, 7); g.fill();
    });
    const m = new THREE.MeshLambertMaterial({ map: tex });
    const objects = v.wheels.map((wheel) => {
      const { radius, width } = wheel.userData;
      const side = wheel.userData.side;
      const cap = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.72, 18), m);
      cap.rotation.y = side * Math.PI / 2;
      cap.position.x = side * (width / 2 + 0.012);
      return [wheel, cap];
    });
    return { objects };
  };
}

// ---- hats -------------------------------------------------------------------------
function hat(build) {
  return (v) => {
    const h = build();
    h.position.y = 0.12;
    v.driver.hat.visible = false;
    return { objects: [[v.driver.head, h]], onRemove: () => { v.driver.hat.visible = true; } };
  };
}

const HATS = {
  cowboy() {
    const g = new THREE.Group();
    const brim = cyl(0.36, 0.36, 0.03, mat(0x8b5a2b), 18);
    brim.scale.z = 0.8;
    g.add(brim, at(cyl(0.15, 0.18, 0.2, mat(0x8b5a2b), 14), 0, 0.11, 0), at(cyl(0.182, 0.182, 0.04, mat(0x3a2a1a), 14), 0, 0.04, 0));
    return g;
  },
  crown() {
    const g = new THREE.Group();
    const gold = new THREE.MeshPhongMaterial({ color: 0xffc82f, specular: 0xffffff, shininess: 60 });
    g.add(at(cyl(0.17, 0.17, 0.12, gold, 14), 0, 0.03, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.add(at(cyl(0, 0.05, 0.12, gold, 6), Math.cos(a) * 0.15, 0.14, Math.sin(a) * 0.15));
      g.add(at(ball(0.025, mat(i % 2 ? 0xe8352f : 0x2f7fe8), 6), Math.cos(a) * 0.172, 0.03, Math.sin(a) * 0.172));
    }
    return g;
  },
  cap() {
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe8352f));
    g.add(at(dome, 0, -0.04, 0));
    const visor = cyl(0.14, 0.14, 0.02, mat(0xe8352f), 14);
    visor.scale.z = 0.7;
    g.add(at(visor, 0, -0.03, 0.17));
    return g;
  },
  party() {
    const g = new THREE.Group();
    const tex = canvasTex(64, 64, (c) => {
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ff6fb5' : '#5ab8ff'; c.fillRect(i * 8, 0, 8, 64); }
    });
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 14), new THREE.MeshLambertMaterial({ map: tex })), 0, 0.17, 0));
    g.add(at(ball(0.05, mat(0xffd21f), 8), 0, 0.38, 0));
    return g;
  },
  pirate() {
    const g = new THREE.Group();
    const b = cyl(0.3, 0.3, 0.05, mat(0x222222), 3);
    b.rotation.y = Math.PI / 6;
    g.add(b, at(cyl(0.15, 0.18, 0.16, mat(0x222222), 14), 0, 0.09, 0));
    g.add(at(ball(0.04, mat(0xffffff), 8), 0, 0.1, 0.16));
    return g;
  },
};

// ---- the pool ------------------------------------------------------------------------
export const POOL = [
  ...Object.keys(SIDE_ART).map((k) => ({ id: `side-${k}`, slot: 'side', make: sideVinyl(k) })),
  ...Object.keys(BONNET_ART).map((k) => ({ id: `bonnet-${k}`, slot: 'bonnet', make: bonnetVinyl(k) })),
  { id: 'lights-head', slot: 'lights', make: headlights },
  { id: 'lights-under', slot: 'lights', make: underglow },
  { id: 'lights-fairy', slot: 'lights', make: fairyLights },
  { id: 'roof-beacon', slot: 'roof', make: beacon },
  { id: 'roof-lightbar', slot: 'roof', make: lightBar },
  { id: 'roof-flag', slot: 'roof', make: flag },
  { id: 'roof-exhaust', slot: 'roof', make: exhaust },
  { id: 'wheels-chrome', slot: 'wheels', make: hubcaps('chrome') },
  { id: 'wheels-gold', slot: 'wheels', make: hubcaps('gold') },
  { id: 'wheels-rainbow', slot: 'wheels', make: hubcaps('rainbow') },
  ...Object.keys(HATS).map((k) => ({ id: `hat-${k}`, slot: 'hat', make: hat(HATS[k]) })),
];

export const BY_ID = Object.fromEntries(POOL.map((d) => [d.id, d]));

// Picks a new find: something not yet found this session, or once everything
// has been found, a different item for a random spot (shuffles the look).
export function pickDecoration(found, current) {
  const fresh = POOL.filter((d) => !found.has(d.id));
  if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
  const options = POOL.filter((d) => current[d.slot] !== d.id);
  return options[Math.floor(Math.random() * options.length)];
}
