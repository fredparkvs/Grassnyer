// Tall grass and the mowed lawn.
//
// A small mask texture covers the lawn (8 texels per unit):
//   R = grass still tall (255) or cut (0)
//   G = mowing-stripe direction
//   B = mowable (reachable by the mower deck)
// The grass tufts read R in their vertex shader to stand tall or vanish, and
// the ground reads all three to draw dark under-grass or light/dark stripes.

import * as THREE from 'three';

export const RES = 8;            // mask texels per world unit
const CELL = 2;                  // hint cell size (units)
const TUFT_SPACING = 0.33;
const CHUNK = 6;
const GRASS_HEIGHT = 0.6;

function tuftGeometry() {
  const pos = [];
  const rnd = mulberry(7);
  for (let b = 0; b < 7; b++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * 0.16;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    const ang = rnd() * Math.PI;
    const w = 0.05 + rnd() * 0.03;
    const dx = Math.cos(ang) * w, dz = Math.sin(ang) * w;
    const h = 0.7 + rnd() * 0.3;
    const lean = (rnd() - 0.5) * 0.25;
    pos.push(bx - dx, 0, bz - dz, bx + dx, 0, bz + dz, bx + lean, h, bz + lean * 0.5);
  }
  return new THREE.Float32BufferAttribute(pos, 3);
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRASS_VERT = `
attribute vec3 iPos;
attribute vec2 iRand;
uniform sampler2D uMask;
uniform vec4 uLawn;
uniform float uTime;
uniform float uHeight;
uniform vec3 uBase;
uniform vec3 uTip;
varying vec3 vColor;
#include <fog_pars_vertex>
void main() {
  vec2 uv = (iPos.xy - uLawn.xy) / uLawn.zw;
  float tall = smoothstep(0.3, 0.7, texture2D(uMask, uv).r);
  float h = position.y;
  float s = sin(iPos.z), c = cos(iPos.z);
  vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
  float scale = uHeight * (0.75 + 0.5 * iRand.x) * tall;
  p.y *= scale;
  float sway = sin(uTime * 1.6 + iPos.x * 0.5 + iPos.y * 0.35) * 0.07 + sin(uTime * 2.7 + iPos.x * 1.3) * 0.025;
  p.x += sway * h * h * tall;
  vec4 mvPosition = modelViewMatrix * vec4(iPos.x + p.x, p.y, iPos.y + p.z, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vColor = mix(uBase, uTip, h) * (0.85 + 0.3 * iRand.y);
  #include <fog_vertex>
}`;

const GRASS_FRAG = `
varying vec3 vColor;
#include <common>
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const GROUND_VERT = `
uniform vec4 uLawn;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vUv = (world.xz - uLawn.xy) / uLawn.zw;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const GROUND_FRAG = `
uniform sampler2D uMask;
uniform vec4 uLawn;
uniform vec3 uUnder;
uniform vec3 uShortA;
uniform vec3 uShortB;
varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec4 m = texture2D(uMask, vUv);
  vec3 shortC = mix(uShortA, uShortB, m.g);
  vec3 col = mix(shortC, uUnder, smoothstep(0.2, 0.8, m.r) * step(0.5, m.b));
  vec2 cell = floor(vUv * uLawn.zw * 5.0);
  float n = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  col *= 0.94 + 0.1 * n;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class GrassField {
  // lawn: { w, h }, shapes: obstacle footprints, start: {x, z}, radius: vehicle radius, cut: cut radius
  constructor({ w, h, shapes, start, radius, cutRadius }) {
    this.w = w; this.h = h;
    this.minX = -w / 2; this.minZ = -h / 2;
    this.tw = Math.round(w * RES);
    this.th = Math.round(h * RES);
    this.cutRadius = cutRadius;
    this.longAxisX = w >= h;
    const n = this.tw * this.th;
    this.data = new Uint8Array(n * 4);
    this.group = new THREE.Group();

    this._buildMask(shapes, start, radius, cutRadius * 0.92);

    this.texture = new THREE.DataTexture(this.data, this.tw, this.th, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;

    const lawnU = new THREE.Vector4(this.minX, this.minZ, w, h);
    this.uniforms = {
      uMask: { value: this.texture }, uLawn: { value: lawnU }, uTime: { value: 0 },
      uHeight: { value: GRASS_HEIGHT },
      uBase: { value: new THREE.Color(0x2f7a24) }, uTip: { value: new THREE.Color(0x9ad94f) },
    };
    this._buildGround(lawnU);
    this._buildTufts();
  }

  _buildMask(shapes, start, R, reach) {
    const { tw, th, data } = this;
    const n = tw * th;
    const blocked = new Uint8Array(n);
    const centreOk = new Uint8Array(n);
    const inShape = (s, x, z, grow) => s.type === 'circle'
      ? Math.hypot(x - s.x, z - s.z) < s.r + grow
      : Math.abs(x - s.x) < s.hw + grow && Math.abs(z - s.z) < s.hd + grow;
    for (let j = 0; j < th; j++) {
      const z = this.minZ + (j + 0.5) / RES;
      for (let i = 0; i < tw; i++) {
        const x = this.minX + (i + 0.5) / RES;
        const k = j * tw + i;
        let blk = 0, ok = 1;
        for (const s of shapes) {
          if (s.noGrass && inShape(s, x, z, 0)) blk = 1;
          if (s.solid && inShape(s, x, z, R)) ok = 0;
        }
        if (x < this.minX + R || x > -this.minX - R || z < this.minZ + R || z > -this.minZ - R) ok = 0;
        blocked[k] = blk;
        centreOk[k] = ok;
      }
    }
    // flood fill from the start so unreachable pockets don't count
    const reach1 = new Uint8Array(n);
    const si = Math.floor((start.x - this.minX) * RES), sj = Math.floor((start.z - this.minZ) * RES);
    const stack = [sj * tw + si];
    while (stack.length) {
      const k = stack.pop();
      if (reach1[k] || !centreOk[k]) continue;
      reach1[k] = 1;
      const i = k % tw, j = (k / tw) | 0;
      if (i > 0) stack.push(k - 1);
      if (i < tw - 1) stack.push(k + 1);
      if (j > 0) stack.push(k - tw);
      if (j < th - 1) stack.push(k + tw);
    }
    // everything the deck can sweep = reachable centres grown by the reach
    const mow = new Uint8Array(n);
    const rr = Math.ceil(reach * RES);
    const disk = [];
    for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) if (di * di + dj * dj <= (reach * RES) ** 2) disk.push([di, dj]);
    for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
      const k = j * tw + i;
      if (!reach1[k]) continue;
      mow[k] = 1;
      const edge = (i > 0 && !reach1[k - 1]) || (i < tw - 1 && !reach1[k + 1]) || (j > 0 && !reach1[k - tw]) || (j < th - 1 && !reach1[k + tw]);
      if (!edge) continue;
      for (const [di, dj] of disk) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < tw && jj < th) mow[jj * tw + ii] = 1;
      }
    }
    this.cw = Math.ceil(this.w / CELL);
    this.ch = Math.ceil(this.h / CELL);
    this.cellTall = new Int32Array(this.cw * this.ch);
    this.total = 0;
    for (let k = 0; k < n; k++) {
      const m = mow[k] && !blocked[k];
      data[k * 4] = m ? 255 : 0;
      data[k * 4 + 1] = 0;
      data[k * 4 + 2] = m ? 255 : 0;
      data[k * 4 + 3] = 255;
      if (m) {
        this.total++;
        this.cellTall[this._cellOf(k)]++;
      }
    }
    this.remaining = this.total;
  }

  _cellOf(k) {
    const i = k % this.tw, j = (k / this.tw) | 0;
    return Math.floor(j / RES / CELL) * this.cw + Math.floor(i / RES / CELL);
  }

  _buildGround(lawnU) {
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uMask: { value: null }, uLawn: { value: lawnU },
        uUnder: { value: new THREE.Color(0x3e7d2a) },
        uShortA: { value: new THREE.Color(0x86c95a) }, uShortB: { value: new THREE.Color(0x6fb447) },
      }]),
      vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, fog: true,
    });
    mat.uniforms.uMask.value = this.texture;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(this.w, this.h).rotateX(-Math.PI / 2), mat);
    this.group.add(ground);
  }

  _buildTufts() {
    const base = tuftGeometry();
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.uniforms]),
      vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG, fog: true, side: THREE.DoubleSide,
    });
    mat.uniforms.uMask.value = this.texture;
    this.grassUniforms = mat.uniforms;
    const rnd = mulberry(Math.round(this.w * 131 + this.h));
    const chunks = new Map();
    for (let z = this.minZ + TUFT_SPACING / 2; z < -this.minZ; z += TUFT_SPACING) {
      for (let x = this.minX + TUFT_SPACING / 2; x < -this.minX; x += TUFT_SPACING) {
        const px = x + (rnd() - 0.5) * TUFT_SPACING * 0.9;
        const pz = z + (rnd() - 0.5) * TUFT_SPACING * 0.9;
        const k = this._texel(px, pz);
        if (k < 0 || !this.data[k * 4 + 2]) continue;
        const key = Math.floor((px - this.minX) / CHUNK) + ',' + Math.floor((pz - this.minZ) / CHUNK);
        if (!chunks.has(key)) chunks.set(key, { pos: [], rand: [] });
        const c = chunks.get(key);
        c.pos.push(px, pz, rnd() * Math.PI * 2);
        c.rand.push(rnd(), rnd());
      }
    }
    this.tuftCount = 0;
    for (const c of chunks.values()) {
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute('position', base);
      geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(c.pos), 3));
      geo.setAttribute('iRand', new THREE.InstancedBufferAttribute(new Float32Array(c.rand), 2));
      geo.instanceCount = c.pos.length / 3;
      this.tuftCount += geo.instanceCount;
      let cx = 0, cz = 0;
      for (let i = 0; i < c.pos.length; i += 3) { cx += c.pos[i]; cz += c.pos[i + 1]; }
      cx /= geo.instanceCount; cz /= geo.instanceCount;
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, GRASS_HEIGHT / 2, cz), CHUNK * 0.75 + 0.5);
      geo.boundingBox = new THREE.Box3(new THREE.Vector3(cx - CHUNK, 0, cz - CHUNK), new THREE.Vector3(cx + CHUNK, 1, cz + CHUNK));
      const mesh = new THREE.Mesh(geo, mat);
      this.group.add(mesh);
    }
  }

  _texel(x, z) {
    const i = Math.floor((x - this.minX) * RES), j = Math.floor((z - this.minZ) * RES);
    if (i < 0 || j < 0 || i >= this.tw || j >= this.th) return -1;
    return j * this.tw + i;
  }

  isTall(x, z) {
    const k = this._texel(x, z);
    return k >= 0 && this.data[k * 4] > 0 && this.data[k * 4 + 2] > 0;
  }

  isMowable(x, z, margin = 0) {
    const steps = margin > 0 ? 8 : 0;
    const test = (px, pz) => { const k = this._texel(px, pz); return k >= 0 && this.data[k * 4 + 2] > 0; };
    if (!test(x, z)) return false;
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      if (!test(x + Math.cos(a) * margin, z + Math.sin(a) * margin)) return false;
    }
    return true;
  }

  get progress() { return this.total ? 1 - this.remaining / this.total : 1; }

  // Cuts a circle of grass; returns how many tall texels were cut.
  cutAt(x, z, heading, radius = this.cutRadius) {
    const stripe = (this.longAxisX ? Math.sin(heading) : Math.cos(heading)) >= 0 ? 255 : 0;
    const r2 = (radius * RES) ** 2;
    const ci = (x - this.minX) * RES, cj = (z - this.minZ) * RES;
    const i0 = Math.max(0, Math.floor(ci - radius * RES)), i1 = Math.min(this.tw - 1, Math.ceil(ci + radius * RES));
    const j0 = Math.max(0, Math.floor(cj - radius * RES)), j1 = Math.min(this.th - 1, Math.ceil(cj + radius * RES));
    const d = this.data;
    let cut = 0, changed = false;
    for (let j = j0; j <= j1; j++) {
      const dj = j + 0.5 - cj;
      for (let i = i0; i <= i1; i++) {
        const di = i + 0.5 - ci;
        if (di * di + dj * dj > r2) continue;
        const k = j * this.tw + i;
        if (!d[k * 4 + 2]) continue;
        if (d[k * 4]) {
          d[k * 4] = 0;
          this.cellTall[this._cellOf(k)]--;
          cut++;
        }
        if (d[k * 4 + 1] !== stripe) { d[k * 4 + 1] = stripe; changed = true; }
      }
    }
    if (cut || changed) this.texture.needsUpdate = true;
    this.remaining -= cut;
    return cut;
  }

  cutTexel(k) {
    const d = this.data;
    if (!d[k * 4] || !d[k * 4 + 2]) return false;
    d[k * 4] = 0;
    this.cellTall[this._cellOf(k)]--;
    this.remaining--;
    this.texture.needsUpdate = true;
    return true;
  }

  texelPos(k) {
    return [this.minX + ((k % this.tw) + 0.5) / RES, this.minZ + (((k / this.tw) | 0) + 0.5) / RES];
  }

  remainingTexels() {
    const out = [];
    const d = this.data;
    for (let k = 0, n = this.tw * this.th; k < n; k++) if (d[k * 4] && d[k * 4 + 2]) out.push(k);
    return out;
  }

  // Centres of the patches still standing (for sparkles and the arrow).
  patches(minCount = 3) {
    const out = [];
    const cellTex = CELL * RES;
    for (let cj = 0; cj < this.ch; cj++) for (let ci = 0; ci < this.cw; ci++) {
      const c = cj * this.cw + ci;
      if (this.cellTall[c] < minCount) continue;
      let sx = 0, sz = 0, cnt = 0;
      for (let j = cj * cellTex; j < Math.min(this.th, (cj + 1) * cellTex); j++) {
        for (let i = ci * cellTex; i < Math.min(this.tw, (ci + 1) * cellTex); i++) {
          const k = j * this.tw + i;
          if (this.data[k * 4] && this.data[k * 4 + 2]) { sx += i; sz += j; cnt++; }
        }
      }
      if (cnt) out.push({ x: this.minX + (sx / cnt + 0.5) / RES, z: this.minZ + (sz / cnt + 0.5) / RES, count: cnt });
    }
    return out;
  }

  update(t) {
    this.grassUniforms.uTime.value = t;
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.texture.dispose();
  }
}
