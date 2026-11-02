// Garage: turn the wheel to pick mower or tractor, press; turn to pick a
// colour, press; turn to pick the grass colour (see GRASS_CHOICES), press.
// The last choices are pre-selected.

import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { PAINT, mat, box, at, rbox } from './models.js';
import { makeSky, addLights } from './world.js';
import { LAWNS, GRASS_CHOICES } from './lawns.js';

const TYPES = ['mower', 'tractor'];

export class Garage {
  constructor({ wheel, sound, hud }) {
    this.wheel = wheel;
    this.sound = sound;
    this.hud = hud;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd8f1ff, 40, 120);
    this.scene.add(makeSky());
    addLights(this.scene);
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 400);
    this.camera.position.set(0, 3.4, 9.2);
    this.camera.lookAt(0, 0.5, 0);

    // a sunny driveway in front of the shed
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), mat(0x69a94b));
    this.scene.add(ground);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.4, 0.16, 40), mat(0xd9d2c3));
    pad.position.y = 0.08;
    this.scene.add(pad);
    this.turntable = new THREE.Group();
    this.turntable.position.y = 0.16;
    this.scene.add(this.turntable);
    const shed = new THREE.Group();
    shed.add(at(box(9, 4.2, 0.3, mat(0x8fb36b)), 0, 2.1, -4));
    shed.add(at(box(5, 3.4, 0.32, mat(0x2a2620)), 0, 1.7, -3.98));
    shed.add(at(rbox(9.6, 0.4, 3.0, 0.1, mat(0x5d4636)), 0, 4.3, -4.6));
    this.scene.add(shed);
    this.vehicles = {};

    // a ring of grass round the turntable, showing the grass colour being picked;
    // for "every lawn its own" the tufts take the five lawns' colours in turn
    this.tuftMats = LAWNS.map(() => new THREE.MeshLambertMaterial({ color: 0x9ad94f }));
    const blade = new THREE.ConeGeometry(0.07, 0.55, 4).translate(0, 0.27, 0);
    let seed = 5;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2, r = 2.7 + rnd() * 1.6;
      const tuft = new THREE.Group();
      tuft.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const m = this.tuftMats[i % this.tuftMats.length];
      for (let b = 0; b < 4; b++) {
        const bl = new THREE.Mesh(blade, m);
        bl.position.set((rnd() - 0.5) * 0.18, 0, (rnd() - 0.5) * 0.18);
        bl.rotation.set((rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5);
        bl.scale.y = 0.7 + rnd() * 0.6;
        tuft.add(bl);
      }
      this.scene.add(tuft);
    }
  }

  showGrass() {
    const choice = GRASS_CHOICES[this.grass];
    this.tuftMats.forEach((m, i) => m.color.set(choice ? choice.tip : LAWNS[i].look.grass.tip));
  }

  // Resolves with { type, colour, grass } once all three are picked.
  start(type, colour, grass = 0) {
    this.typeIndex = Math.max(0, TYPES.indexOf(type));
    this.colour = colour;
    this.grass = grass >= 0 && grass < GRASS_CHOICES.length ? grass : 0;
    this.showGrass();
    this.step = 'vehicle';
    // ignore a wheel that is already turned (e.g. the touch that woke us)
    // until it has been back to the middle once
    this.armed = false;
    this.repeatAt = Infinity;
    this.slide = 0;
    for (const t of TYPES) {
      if (!this.vehicles[t]) this.vehicles[t] = new Vehicle(t, colour);
      this.vehicles[t].setColour(colour);
      this.vehicles[t].clearDecorations();
      this.vehicles[t].y = 0;
      this.vehicles[t].fill = 0;
      this.vehicles[t].setTip(0);
      this.vehicles[t].place(0, 0, 0.5);
      this.vehicles[t].group.position.set(0, 0, 0);
    }
    this.show();
    this.hud.garage('vehicle', colour);
    this.sound.voice('pick_your_mower');
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  current() { return this.vehicles[TYPES[this.typeIndex]]; }

  show() {
    for (const t of TYPES) this.turntable.remove(this.vehicles[t].group);
    this.turntable.add(this.current().group);
  }

  update(dt, t) {
    const w = this.wheel;
    const v = this.current();
    this.turntable.rotation.y += dt * 0.5;
    this.slide *= Math.exp(-dt * 8);
    v.group.position.x = this.slide;
    v.update(dt, t);

    // turn past half-way to step; hold to keep stepping
    const now = performance.now();
    if (Math.abs(w.steer) < 0.25) this.armed = true;
    if (Math.abs(w.steer) > 0.45 && (this.armed || now > this.repeatAt)) {
      this.repeatAt = now + (this.armed ? 700 : 450);
      this.armed = false;
      const d = w.steer > 0 ? 1 : -1;
      if (this.step === 'vehicle') {
        this.typeIndex = (this.typeIndex + d + TYPES.length) % TYPES.length;
        this.show();
        this.slide = d * 3;
        this.sound.play('whoosh');
      } else if (this.step === 'colour') {
        this.colour = (this.colour + d + PAINT.length) % PAINT.length;
        for (const k of TYPES) this.vehicles[k].setColour(this.colour);
        this.hud.garage('colour', this.colour);
        this.sound.play('splash');
      } else {
        this.grass = (this.grass + d + GRASS_CHOICES.length) % GRASS_CHOICES.length;
        this.showGrass();
        this.hud.garage('grass', this.colour, this.grass);
        this.sound.play('whoosh');
      }
    }
    if (w.paint.pressed && this.step === 'colour') {
      this.colour = (this.colour + 1) % PAINT.length;
      for (const k of TYPES) this.vehicles[k].setColour(this.colour);
      this.hud.garage('colour', this.colour);
      this.sound.play('splash');
    } else if (w.any.pressed) {
      this.hud.pressButton();
      this.sound.play('pop');
      if (this.step === 'vehicle') {
        this.step = 'colour';
        this.hud.garage('colour', this.colour);
        this.sound.voice('pick_a_colour');
      } else if (this.step === 'colour') {
        this.step = 'grass';
        this.hud.garage('grass', this.colour, this.grass);
        this.sound.voice('pick_the_grass');
      } else {
        this.hud.garage(null);
        this.resolve({ type: TYPES[this.typeIndex], colour: this.colour, grass: this.grass, vehicle: v });
      }
    }
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
