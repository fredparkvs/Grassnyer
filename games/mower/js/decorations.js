// Purely visual extras found in presents. Each item has a spot (slot) on the
// vehicle; a new find replaces whatever is in that spot.

import * as THREE from 'three';
import { mat, glow, rbox, box, cyl, ball, blob, at, C, chowChow } from './models.js';

export const SLOTS = ['side', 'bonnet', 'roof', 'lights', 'wheels', 'hat', 'pet', 'trail'];

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

function heartPath(g, x, y, s) {   // heart centred on x, top at y, about 2s wide
  g.beginPath();
  g.moveTo(x, y + s * 0.3);
  g.bezierCurveTo(x, y, x - s, y - s * 0.4, x - s, y + s * 0.35);
  g.bezierCurveTo(x - s, y + s * 0.9, x, y + s * 1.2, x, y + s * 1.5);
  g.bezierCurveTo(x, y + s * 1.2, x + s, y + s * 0.9, x + s, y + s * 0.35);
  g.bezierCurveTo(x + s, y - s * 0.4, x, y, x, y + s * 0.3);
}

function paw(g, x, y, s, fill, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = fill;
  g.beginPath(); g.ellipse(0, s * 0.25, s * 0.42, s * 0.34, 0, 0, 7); g.fill();
  for (const [tx, ty] of [[-0.42, -0.2], [-0.15, -0.45], [0.15, -0.45], [0.42, -0.2]]) {
    g.beginPath(); g.ellipse(tx * s, ty * s, s * 0.15, s * 0.19, 0, 0, 7); g.fill();
  }
  g.restore();
}

function butterfly(g, x, y, s, [wing, spot]) {
  g.save(); g.translate(x, y);
  g.lineWidth = s * 0.06; g.strokeStyle = '#222';
  for (const side of [-1, 1]) {
    g.fillStyle = wing;
    g.beginPath(); g.ellipse(side * s * 0.42, -s * 0.18, s * 0.42, s * 0.32, side * 0.5, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(side * s * 0.3, s * 0.3, s * 0.28, s * 0.22, -side * 0.5, 0, 7); g.fill(); g.stroke();
    g.fillStyle = spot;
    g.beginPath(); g.arc(side * s * 0.45, -s * 0.2, s * 0.11, 0, 7); g.fill();
    g.beginPath(); g.moveTo(0, -s * 0.4); g.quadraticCurveTo(side * s * 0.15, -s * 0.75, side * s * 0.28, -s * 0.78); g.stroke();
  }
  g.fillStyle = '#222';
  g.beginPath(); g.ellipse(0, 0, s * 0.08, s * 0.45, 0, 0, 7); g.fill();
  g.restore();
}

function note(g, x, y, s, fill) {   // a quaver
  g.fillStyle = fill; g.strokeStyle = fill; g.lineWidth = s * 0.1;
  g.beginPath(); g.ellipse(x, y + s * 0.8, s * 0.24, s * 0.17, -0.4, 0, 7); g.fill();
  g.beginPath(); g.moveTo(x + s * 0.2, y + s * 0.75); g.lineTo(x + s * 0.2, y); g.quadraticCurveTo(x + s * 0.5, y + s * 0.2, x + s * 0.45, y + s * 0.45); g.stroke();
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
  hearts(g, w, h) {
    const cols = ['#ff4f8b', '#ff8ac2', '#e8352f'];
    for (let i = 0; i < 7; i++) {
      heartPath(g, w * (0.07 + i * 0.143), h * (i % 2 ? 0.12 : 0.42), h * (0.17 + (i % 3) * 0.03));
      g.fillStyle = cols[i % 3]; g.fill();
      g.lineWidth = 4; g.strokeStyle = '#222'; g.stroke();
    }
  },
  polka(g, w, h) {
    const cols = ['#ffffff', '#ffd21f', '#5ab8ff', '#ff6fb5'];
    let n = 0;
    for (let row = 0; row < 3; row++) {
      for (let x = (row % 2) * w * 0.06 + w * 0.04; x < w; x += w * 0.12) {
        g.beginPath(); g.arc(x, h * (0.2 + row * 0.3), h * 0.11, 0, 7);
        g.fillStyle = cols[n++ % cols.length]; g.fill();
      }
    }
  },
  paws(g, w, h) {
    for (let i = 0; i < 6; i++) paw(g, w * (0.09 + i * 0.165), h * (i % 2 ? 0.34 : 0.66), h * 0.24, '#6b4423', 1.57);
  },
  butterflies(g, w, h) {
    const cols = [['#ff6fb5', '#ffd21f'], ['#5ab8ff', '#ffffff'], ['#ff8a1f', '#8e4fe0']];
    for (let i = 0; i < 4; i++) butterfly(g, w * (0.13 + i * 0.25), h * (i % 2 ? 0.42 : 0.58), h * 0.3, cols[i % 3]);
  },
  checkers(g, w, h) {
    const s = h / 4;
    for (let y = 0; y < 2; y++) for (let x = 0; x * s < w; x++) {
      g.fillStyle = (x + y) % 2 ? '#111111' : '#ffffff';
      g.fillRect(x * s, h * 0.5 - s + y * s, s, s);
    }
  },
  music(g, w, h) {
    const cols = ['#8e4fe0', '#2f7fe8', '#e8352f', '#2fb84a'];
    for (let i = 0; i < 6; i++) note(g, w * (0.08 + i * 0.155), h * (i % 2 ? 0.08 : 0.3), h * 0.55, cols[i % 4]);
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
  sun(g, w, h) {
    const x = w / 2, y = h / 2;
    g.strokeStyle = '#ff8a1f'; g.lineWidth = 14;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      g.beginPath(); g.moveTo(x + Math.cos(a) * h * 0.3, y + Math.sin(a) * h * 0.3); g.lineTo(x + Math.cos(a) * h * 0.45, y + Math.sin(a) * h * 0.45); g.stroke();
    }
    g.beginPath(); g.arc(x, y, h * 0.25, 0, 7); g.fillStyle = '#ffd21f'; g.fill();
    g.lineWidth = 8; g.strokeStyle = '#e08a00'; g.stroke();
  },
  paw(g, w, h) { paw(g, w / 2, h * 0.55, h * 0.4, '#6b4423'); },
  moon(g, w, h) {
    g.fillStyle = '#ffe98a';
    g.beginPath(); g.arc(w * 0.45, h * 0.5, h * 0.32, 0, 7); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(w * 0.58, h * 0.42, h * 0.28, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
    star(g, w * 0.75, h * 0.25, h * 0.09, '#ffffff', '#ffffff');
    star(g, w * 0.8, h * 0.65, h * 0.07, '#ffffff', '#ffffff');
  },
  ladybird(g, w, h) {
    const x = w / 2, y = h * 0.55;
    g.fillStyle = '#222'; g.beginPath(); g.arc(x, y - h * 0.3, h * 0.13, 0, 7); g.fill();
    g.fillStyle = '#e8352f'; g.beginPath(); g.arc(x, y, h * 0.32, 0, 7); g.fill();
    g.lineWidth = 7; g.strokeStyle = '#222'; g.stroke();
    g.beginPath(); g.moveTo(x, y - h * 0.32); g.lineTo(x, y + h * 0.32); g.stroke();
    g.fillStyle = '#222';
    for (const [dx, dy] of [[-0.15, -0.12], [0.15, -0.12], [-0.17, 0.1], [0.17, 0.1], [-0.08, 0.22], [0.08, 0.22]]) {
      g.beginPath(); g.arc(x + dx * h, y + dy * h, h * 0.05, 0, 7); g.fill();
    }
  },
  chequered(g, w, h) {
    const n = 6, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? '#111111' : '#ffffff'; g.fillRect(x * s, y * s, s, s); }
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
const HUB_ART = {
  rainbow(g, r) {
    const cols = ['#e8352f', '#ff8a1f', '#ffd21f', '#2fb84a', '#2f7fe8', '#8e4fe0'];
    cols.forEach((c, i) => {
      g.beginPath(); g.moveTo(r, r); g.arc(r, r, r - 2, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3); g.fillStyle = c; g.fill();
    });
  },
  flower(g, r) {
    g.fillStyle = '#7fd36b'; g.beginPath(); g.arc(r, r, r - 2, 0, 7); g.fill();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.fillStyle = i % 2 ? '#ffffff' : '#ff6fb5';
      g.beginPath(); g.ellipse(r + Math.cos(a) * r * 0.45, r + Math.sin(a) * r * 0.45, r * 0.3, r * 0.17, a, 0, 7); g.fill();
    }
    g.fillStyle = '#ffd21f'; g.beginPath(); g.arc(r, r, r * 0.28, 0, 7); g.fill();
  },
  star(g, r) {
    g.fillStyle = '#2f5fe8'; g.beginPath(); g.arc(r, r, r - 2, 0, 7); g.fill();
    star(g, r, r * 1.05, r * 0.8, '#ffd21f', '#ffd21f');
  },
  swirl(g, r) {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(r, r, r - 2, 0, 7); g.fill();
    g.strokeStyle = '#e8352f'; g.lineWidth = r * 0.16;
    g.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.1) g.lineTo(r + Math.cos(a) * (a / (Math.PI * 6)) * r * 0.9, r + Math.sin(a) * (a / (Math.PI * 6)) * r * 0.9);
    g.stroke();
  },
  football(g, r) {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(r, r, r - 2, 0, 7); g.fill();
    const pent = (cx, cy, s) => {
      g.beginPath();
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; g.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); }
      g.closePath(); g.fillStyle = '#222'; g.fill();
    };
    pent(r, r, r * 0.3);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5 + Math.PI / 5; pent(r + Math.cos(a) * r * 0.82, r + Math.sin(a) * r * 0.82, r * 0.24); }
  },
};
function hubcaps(style) {
  return (v) => {
    const tex = canvasTex(128, 128, (g, w) => {
      const r = w / 2;
      if (HUB_ART[style]) {
        HUB_ART[style](g, r);
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
    return { objects: [[v.driver.head, h]], update: h.userData.update, onRemove: () => { v.driver.hat.visible = true; } };
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
  wizard() {
    const g = new THREE.Group();
    const tex = canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#5b3cc4'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) star(c, (i * 37 + 10) % w, (i * 53 + 20) % h, 9, '#ffd21f', '#ffd21f');
    });
    g.add(cyl(0.3, 0.3, 0.03, mat(0x5b3cc4), 18));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 14), new THREE.MeshLambertMaterial({ map: tex }));
    cone.position.set(0.02, 0.26, 0);
    cone.rotation.z = -0.12;
    g.add(cone);
    return g;
  },
  chef() {
    const g = new THREE.Group();
    g.add(at(cyl(0.17, 0.16, 0.16, mat(C.white), 14), 0, 0.06, 0));
    for (const [x, z] of [[0, 0], [0.09, 0.05], [-0.09, 0.05], [0.05, -0.09], [-0.06, -0.08]]) g.add(at(blob(0.11, mat(C.white)), x, 0.2, z));
    return g;
  },
  viking() {
    const g = new THREE.Group();
    const metal = new THREE.MeshPhongMaterial({ color: 0xb8c0c8, specular: 0xffffff, shininess: 50 });
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal), 0, -0.04, 0));
    g.add(at(cyl(0.196, 0.196, 0.04, mat(0x8b5a2b), 14), 0, -0.03, 0));
    for (const s of [-1, 1]) {
      const horn = at(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 8), mat(0xf3ead2)), s * 0.22, 0.08, 0);
      horn.rotation.z = -s * 0.9;
      g.add(horn);
    }
    return g;
  },
  tophat() {
    const g = new THREE.Group();
    g.add(cyl(0.27, 0.27, 0.025, mat(0x1e1e22), 18));
    g.add(at(cyl(0.15, 0.15, 0.34, mat(0x1e1e22), 16), 0, 0.17, 0));
    g.add(at(cyl(0.153, 0.153, 0.06, mat(0xe8352f), 16), 0, 0.05, 0));
    return g;
  },
  propeller() {
    const g = new THREE.Group();
    const tex = canvasTex(64, 32, (c) => { ['#e8352f', '#ffd21f', '#2fb84a', '#2f7fe8'].forEach((col, i) => { c.fillStyle = col; c.fillRect(i * 16, 0, 16, 32); }); });
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex })), 0, -0.04, 0));
    g.add(at(cyl(0.012, 0.012, 0.1, mat(0x333333), 6), 0, 0.18, 0));
    const prop = new THREE.Group();
    prop.position.y = 0.23;
    for (const s of [-1, 1]) {
      const blade = at(rbox(0.22, 0.012, 0.06, 0.005, mat(s > 0 ? 0xe8352f : 0x2f7fe8)), s * 0.11, 0, 0);
      blade.rotation.x = s * 0.3;
      prop.add(blade);
    }
    g.add(prop);
    g.userData.update = (t) => { prop.rotation.y = t * 14; };
    return g;
  },
  bunny() {
    const g = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.016, 6, 18, Math.PI), mat(0xff6fb5));
    band.position.y = -0.12;   // arcs over the head, ear to ear
    g.add(band);
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(s * 0.08, 0.04, 0);
      ear.rotation.z = -s * 0.25;
      const outer = at(ball(0.06, mat(C.white), 10), 0, 0.15, 0);
      outer.scale.set(0.8, 2.6, 0.45);
      const inner = at(ball(0.04, mat(0xffb3d1), 8), 0, 0.15, 0.02);
      inner.scale.set(0.7, 2.4, 0.3);
      ear.add(outer, inner);
      g.add(ear);
    }
    return g;
  },
  flowers() {
    const g = new THREE.Group();
    const cols = [0xff6fb5, 0xffd21f, 0xffffff, 0xc56bff, 0xff8a1f];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.add(at(ball(0.05, mat(cols[i % cols.length]), 8), Math.cos(a) * 0.165, -0.03, Math.sin(a) * 0.165));
      g.add(at(ball(0.03, mat(0x3fae3a), 6), Math.cos(a + 0.31) * 0.17, -0.05, Math.sin(a + 0.31) * 0.17));
    }
    return g;
  },
  astronaut() {
    const g = new THREE.Group();
    const glass = new THREE.MeshPhongMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.3, shininess: 100, specular: 0xffffff, depthWrite: false });
    g.add(at(ball(0.27, glass, 16), 0, -0.12, 0));   // a bubble round the whole head
    g.add(at(cyl(0.2, 0.22, 0.07, mat(0xf2f2f2), 16), 0, -0.36, 0));
    g.add(at(cyl(0.012, 0.012, 0.14, mat(0x999999), 6), 0.13, 0.16, 0));
    g.add(at(ball(0.03, glow(0xff3f3f), 6), 0.13, 0.24, 0));
    return g;
  },
};

// ---- more roof toys ------------------------------------------------------------------
function onRoof(v) {
  const g = new THREE.Group();
  g.position.set(...v.anchors.roof.pos);
  return g;
}

function balloons(v) {
  const g = onRoof(v);
  const cols = [0xe8352f, 0xffd21f, 0x2f7fe8, 0x2fb84a, 0xff6fb5];
  const strings = new THREE.BufferGeometry().setFromPoints(cols.flatMap(() => [new THREE.Vector3(), new THREE.Vector3()]));
  g.add(new THREE.LineSegments(strings, new THREE.LineBasicMaterial({ color: 0x777777 })));
  const items = cols.map((c, i) => {
    const a = (i / cols.length) * Math.PI * 2;
    const b = ball(0.17, new THREE.MeshPhongMaterial({ color: c, shininess: 80, specular: 0x777777 }), 12);
    b.scale.y = 1.2;
    g.add(b);
    return { b, x: Math.cos(a) * 0.3, y: 1.0 + (i % 2) * 0.24, z: Math.sin(a) * 0.22, phase: i * 1.7 };
  });
  const pos = strings.attributes.position;
  return {
    objects: [[v.root, g]],
    update: (t) => items.forEach((it, i) => {
      it.b.position.set(it.x + Math.sin(t * 1.5 + it.phase) * 0.07, it.y + Math.sin(t * 2.1 + it.phase) * 0.05, it.z);
      pos.setXYZ(i * 2, 0, 0.05, 0);
      pos.setXYZ(i * 2 + 1, it.b.position.x, it.b.position.y - 0.2, it.b.position.z);
      pos.needsUpdate = true;
    }),
  };
}

function pinwheel(v) {
  const g = onRoof(v);
  g.add(at(cyl(0.02, 0.02, 0.75, mat(0xdddddd), 6), 0, 0.37, 0));
  const wheel = new THREE.Group();
  wheel.position.set(0, 0.78, 0.06);
  [0xe8352f, 0xffd21f, 0x2f7fe8, 0x2fb84a].forEach((c, i) => {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    const blade = at(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 3), mat(c, { side: THREE.DoubleSide })), 0.06, 0.15, 0);
    blade.scale.z = 0.15;
    blade.rotation.z = -0.4;
    arm.add(blade);
    wheel.add(arm);
  });
  wheel.add(ball(0.04, mat(0xffffff), 8));
  g.add(wheel);
  return { objects: [[v.root, g]], update: (t) => { wheel.rotation.z = -t * 5; } };
}

function parasol(v) {
  const g = onRoof(v);
  g.add(at(cyl(0.02, 0.02, 0.95, mat(0xeeeeee), 6), 0, 0.47, 0));
  const tex = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff4f8b'; c.fillRect((i * w) / 12, 0, w / 12 + 1, h); } });
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.32, 12, 1, true), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  canopy.position.y = 1.05;
  g.add(canopy, at(ball(0.04, mat(0xffffff), 8), 0, 1.23, 0));
  return { objects: [[v.root, g]], update: (t) => { g.rotation.y = Math.sin(t * 0.5) * 0.4; } };
}

function discoBall(v) {
  const g = onRoof(v);
  g.add(at(cyl(0.02, 0.02, 0.3, mat(0x999999), 6), 0, 0.15, 0));
  const tex = canvasTex(64, 32, (c) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) { c.fillStyle = (x + y) % 3 ? '#cfd6de' : '#ffffff'; c.fillRect(x * 4, y * 4, 4, 4); } });
  const disco = at(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), new THREE.MeshPhongMaterial({ map: tex, shininess: 120, specular: 0xffffff, flatShading: true })), 0, 0.5, 0);
  g.add(disco);
  const sparks = [0xff3fd0, 0x3fd0ff, 0xffe03f].map((c) => { const h = halo(c, 0.7); g.add(h); return h; });
  return {
    objects: [[v.root, g]],
    update: (t) => {
      disco.rotation.y = t * 2;
      sparks.forEach((h, i) => { const a = t * 3 + (i * Math.PI * 2) / 3; h.position.set(Math.cos(a) * 0.4, 0.5 + Math.sin(t * 5 + i) * 0.15, Math.sin(a) * 0.4); });
    },
  };
}

function rotor(v) {
  const g = onRoof(v);
  g.add(at(cyl(0.03, 0.04, 0.25, mat(0x555555), 8), 0, 0.12, 0));
  const spin = new THREE.Group();
  spin.position.y = 0.27;
  spin.add(ball(0.06, mat(0x333333), 8));
  for (const r of [0, Math.PI / 2]) {
    const blade = rbox(1.7, 0.025, 0.12, 0.01, mat(0x3a3f45));
    blade.rotation.y = r;
    spin.add(blade);
  }
  g.add(spin);
  return { objects: [[v.root, g]], update: (t) => { spin.rotation.y = t * 16; } };
}

function rainbowArch(v) {
  const g = onRoof(v);
  [0xe8352f, 0xff8a1f, 0xffd21f, 0x2fb84a, 0x2f7fe8, 0x8e4fe0].forEach((c, i) => {
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.78 - i * 0.07, 0.036, 6, 28, Math.PI), mat(c)));
  });
  for (const s of [-1, 1]) {   // a little cloud at each end
    for (const [dx, dy, r] of [[0, 0, 0.13], [0.11, 0.03, 0.1], [-0.1, 0.02, 0.1]]) g.add(at(blob(r, mat(C.white)), s * 0.6 + dx, dy, dy));
  }
  return { objects: [[v.root, g]] };
}

// ---- more lights ----------------------------------------------------------------------
function partyLights(v) {   // a glowing bulb on each top corner, chasing through the rainbow
  const g = new THREE.Group();
  const items = v.anchors.edges.map((p, i) => {
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });
    const b = at(ball(0.07, m, 8), ...p);
    const h = halo(0xffffff, 0.9);
    h.position.copy(b.position);
    g.add(b, h);
    return { m, h, i };
  });
  const c = new THREE.Color();
  return {
    objects: [[v.root, g]],
    update: (t) => items.forEach(({ m, h, i }) => {
      c.setHSL((t * 0.5 + i * 0.25) % 1, 1, 0.55);
      m.color.copy(c); m.emissive.copy(c); h.material.color.copy(c);
    }),
  };
}

function starLights(v) {   // little gold stars twinkling round the top
  const pts = v.anchors.edges.map((p) => new THREE.Vector3(...p));
  pts.push(pts[0]);
  const g = new THREE.Group();
  const stars = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 3; k++) {
      const p = pts[i].clone().lerp(pts[i + 1], (k + 0.5) / 3);
      const st = at(new THREE.Mesh(new THREE.OctahedronGeometry(0.06), glow(0xffd84a)), p.x, p.y + 0.08, p.z);
      g.add(st);
      stars.push(st);
    }
  }
  return {
    objects: [[v.root, g]],
    update: (t) => stars.forEach((st, i) => { st.rotation.y = t * 2 + i; st.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(t * 3 + i * 1.9))); }),
  };
}

// ---- pets riding on the bonnet ----------------------------------------------------------
function pet(build) {
  return (v) => {
    const b = v.anchors.bonnet;
    const p = build();
    const holder = new THREE.Group();
    holder.position.set(b.pos[0] - 0.14, b.pos[1] + 0.01, b.pos[2] + b.d * 0.1);   // left of the tractor's exhaust stack
    holder.scale.setScalar(1.4);   // big enough to spot on the TV
    holder.add(p.root);
    return { objects: [[v.root, holder]], update: p.update };
  };
}

const eye = (x, y, z, r = 0.022) => at(ball(r, mat(0x1e1e22), 6), x, y, z);

const PETS = {
  duck() {
    const root = new THREE.Group(), y = mat(0xffd21f), o = mat(0xff8a1f);
    const body = at(ball(0.13, y, 10), 0, 0.12, 0); body.scale.set(1, 0.85, 1.3);
    const head = new THREE.Group(); head.position.set(0, 0.27, 0.08);
    head.add(ball(0.08, y, 10), at(rbox(0.07, 0.03, 0.08, 0.012, o), 0, -0.01, 0.09), eye(0.04, 0.02, 0.06), eye(-0.04, 0.02, 0.06));
    const tail = at(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 6), y), 0, 0.17, -0.17); tail.rotation.x = -1;
    root.add(body, head, tail);
    return { root, update: (t) => { root.rotation.z = Math.sin(t * 4) * 0.12; head.rotation.y = Math.sin(t * 0.9) * 0.6; } };
  },
  chick() {
    const root = new THREE.Group(), y = mat(0xffe25a);
    const body = at(ball(0.12, y, 10), 0, 0.12, 0);
    root.add(body, at(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 6), mat(0xff8a1f)), 0, 0.15, 0.13).rotateX(Math.PI / 2), eye(0.045, 0.17, 0.1), eye(-0.045, 0.17, 0.1));
    for (const s of [-1, 1]) { const w = at(ball(0.05, y, 6), s * 0.11, 0.11, 0); w.scale.set(0.4, 0.8, 1); root.add(w); }
    return { root, update: (t) => { root.position.y = Math.max(0, Math.sin(t * 6)) * 0.07; } };
  },
  kitten() {
    const root = new THREE.Group(), fur = mat(0xf0a050), pale = mat(0xfde2c0);
    root.add(at(rbox(0.16, 0.16, 0.24, 0.07, fur), 0, 0.09, 0));
    const head = new THREE.Group(); head.position.set(0, 0.23, 0.08);
    head.add(ball(0.085, fur, 10), at(ball(0.035, pale, 6), 0, -0.02, 0.07), eye(0.035, 0.02, 0.07), eye(-0.035, 0.02, 0.07));
    for (const s of [-1, 1]) head.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), fur), s * 0.05, 0.08, 0));
    const tail = new THREE.Group(); tail.position.set(0, 0.12, -0.12);
    tail.add(at(cyl(0.02, 0.02, 0.18, fur, 6), 0, 0.09, 0));
    root.add(head, tail);
    return { root, update: (t) => { tail.rotation.z = Math.sin(t * 3) * 0.5; head.rotation.y = Math.sin(t * 0.7) * 0.5; } };
  },
  bunny() {
    const root = new THREE.Group(), w = mat(C.white);
    const body = at(ball(0.12, w, 10), 0, 0.11, 0); body.scale.set(1, 0.9, 1.15);
    const head = new THREE.Group(); head.position.set(0, 0.24, 0.08);
    head.add(ball(0.08, w, 10), at(ball(0.018, mat(0xff8ab3), 6), 0, -0.01, 0.08), eye(0.035, 0.02, 0.065), eye(-0.035, 0.02, 0.065));
    for (const s of [-1, 1]) { const ear = at(ball(0.03, w, 6), s * 0.035, 0.13, -0.01); ear.scale.set(0.8, 3, 0.6); ear.rotation.z = -s * 0.15; head.add(ear); }
    root.add(body, head, at(ball(0.045, w, 6), 0, 0.12, -0.14));
    return { root, update: (t) => { root.position.y = Math.max(0, Math.sin(t * 5)) * 0.09; } };
  },
  frog() {
    const root = new THREE.Group(), g = mat(0x4cbf3a), dark = mat(0x2f8a24);
    const body = at(ball(0.13, g, 10), 0, 0.09, 0); body.scale.set(1.2, 0.7, 1.1);
    root.add(body, at(rbox(0.14, 0.012, 0.02, 0.005, mat(0x8a2a2a)), 0, 0.09, 0.14));
    for (const s of [-1, 1]) {
      root.add(at(ball(0.05, g, 8), s * 0.07, 0.17, 0.06), at(ball(0.03, mat(C.white), 6), s * 0.07, 0.19, 0.09), eye(s * 0.07, 0.195, 0.115, 0.016));
      root.add(at(ball(0.05, dark, 6), s * 0.13, 0.03, -0.05));
    }
    return { root, update: (t) => { const k = (t * 0.6) % 1; root.position.y = k < 0.2 ? Math.sin((k / 0.2) * Math.PI) * 0.18 : 0; } };
  },
  penguin() {
    const root = new THREE.Group(), blk = mat(0x22252b), wht = mat(C.white), o = mat(0xff8a1f);
    const body = at(ball(0.12, blk, 10), 0, 0.15, 0); body.scale.set(0.9, 1.4, 0.85);
    const belly = at(ball(0.09, wht, 10), 0, 0.14, 0.04); belly.scale.set(0.85, 1.4, 0.7);
    root.add(body, belly, at(ball(0.08, blk, 10), 0, 0.33, 0), at(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6), o), 0, 0.32, 0.09).rotateX(Math.PI / 2), eye(0.035, 0.35, 0.065), eye(-0.035, 0.35, 0.065));
    for (const s of [-1, 1]) root.add(at(rbox(0.05, 0.02, 0.07, 0.008, o), s * 0.05, 0.01, 0.04));
    return { root, update: (t) => { root.rotation.z = Math.sin(t * 5) * 0.15; } };
  },
  puppy() {   // a tiny chow chow, like the one in the garden
    const d = chowChow();
    d.root.scale.setScalar(0.3);
    d.root.remove(d.root.children[0]);   // no shadow
    d.tongue.visible = true;
    return { root: d.root, update: (t) => { d.tail.rotation.z = Math.sin(t * 10) * 0.35; d.head.rotation.y = Math.sin(t * 0.8) * 0.5; } };
  },
  teddy() {
    const root = new THREE.Group(), fur = mat(0x9a6233), muzzle = mat(0xe0b884);
    root.add(at(ball(0.12, fur, 10), 0, 0.12, 0));
    const head = new THREE.Group(); head.position.set(0, 0.29, 0.02);
    head.add(ball(0.09, fur, 10), at(ball(0.04, muzzle, 6), 0, -0.02, 0.075), eye(0.035, 0.025, 0.075), eye(-0.035, 0.025, 0.075), at(ball(0.015, mat(0x1e1e22), 6), 0, -0.005, 0.11));
    for (const s of [-1, 1]) { head.add(at(ball(0.035, fur, 6), s * 0.07, 0.07, 0)); root.add(at(ball(0.045, fur, 6), s * 0.11, 0.13, 0.05), at(ball(0.05, fur, 6), s * 0.07, 0.02, 0.07)); }
    root.add(head);
    return { root, update: (t) => { root.rotation.z = Math.sin(t * 1.5) * 0.1; } };
  },
};

// ---- magic trails (main.js scatters them behind the moving vehicle) ---------------------
export const TRAILS = {
  bubbles: { kind: 'up', colours: [0xbfe9ff, 0xe8f7ff, 0xd9c8ff], rate: 12 },
  sparkles: { kind: 'stars', colours: [0xffe36b, 0xffffff, 0xffb3e6], rate: 22 },
  petals: { kind: 'fall', colours: [0xff9ccf, 0xffffff, 0xffc2e0], rate: 16 },
  rainbow: { kind: 'stars', colours: [0xe8352f, 0xff8a1f, 0xffd21f, 0x2fb84a, 0x2f7fe8, 0x8e4fe0], rate: 30, inOrder: true },
  confetti: { kind: 'fall', colours: [0xff4f8b, 0x3fa8ff, 0xffd21f, 0x2fb84a, 0xc56bff], rate: 20 },
};
const trail = (name) => () => ({ objects: [], trail: TRAILS[name] });

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
  { id: 'lights-party', slot: 'lights', make: partyLights },
  { id: 'lights-stars', slot: 'lights', make: starLights },
  { id: 'roof-balloons', slot: 'roof', make: balloons },
  { id: 'roof-pinwheel', slot: 'roof', make: pinwheel },
  { id: 'roof-parasol', slot: 'roof', make: parasol },
  { id: 'roof-disco', slot: 'roof', make: discoBall },
  { id: 'roof-rotor', slot: 'roof', make: rotor },
  { id: 'roof-rainbow', slot: 'roof', make: rainbowArch },
  ...['flower', 'star', 'swirl', 'football'].map((k) => ({ id: `wheels-${k}`, slot: 'wheels', make: hubcaps(k) })),
  ...Object.keys(PETS).map((k) => ({ id: `pet-${k}`, slot: 'pet', make: pet(PETS[k]) })),
  ...Object.keys(TRAILS).map((k) => ({ id: `trail-${k}`, slot: 'trail', make: trail(k) })),
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
