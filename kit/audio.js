// All sounds are synthesised with WebAudio, so there are no sound files to
// license. Parent voice clips in voice/ replace the matching fallback sound.

import { settings } from './settings.js';

const MELODY = [72, 76, 79, 76, 77, 81, 79, null, 76, 79, 84, 79, 81, 79, 76, null,
  74, 77, 81, 77, 79, 77, 74, null, 72, 76, 79, 76, 74, 71, 72, null];
const BASS = [48, 55, 53, 48, 55, 50, 48, 43];

const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.clips = {};
    this.buffers = new Map();
    this.engine = null;
    this.musicTimer = null;
  }

  async init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.noise = this._noiseBuffer();
    this.applySettings();
    const wake = () => this.ctx.state !== 'running' && this.ctx.resume();
    ['keydown', 'pointerdown', 'touchstart'].forEach((e) => window.addEventListener(e, wake));
    try {
      const res = await fetch('/api/voice', { cache: 'no-store' });
      if (res.ok) this.clips = await res.json();
    } catch (e) { /* no voice clips */ }
  }

  get ok() { return !!this.ctx; }
  get now() { return this.ctx.currentTime; }

  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }

  applySettings() {
    if (!this.ctx) return;
    const s = settings();
    const vol = Math.max(0, Math.min(10, s.volume)) / 10;
    this.master.gain.setTargetAtTime(vol * vol * 1.2, this.now, 0.05);
    if (this.musicTimer) this.musicBus.gain.setTargetAtTime(s.music ? 0.55 : 0, this.now, 0.3);
  }

  _noiseBuffer() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---- building blocks ----------------------------------------------
  _tone(freq, t, dur, { type = 'sine', vol = 0.3, attack = 0.005, slideTo = null, dest = null } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  _noise(t, dur, { vol = 0.3, filter = 'bandpass', freq = 1500, freqTo = null, q = 1 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ---- sound effects -------------------------------------------------
  play(name) {
    if (!this.ctx) return;
    this.resume();
    const fn = this['sfx_' + name];
    if (fn) fn.call(this, this.now);
  }

  sfx_boing(t) {
    const o = this._tone(420, t, 0.45, { type: 'sine', vol: 0.35, slideTo: 140 });
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 18;
    lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + 0.5);
  }

  sfx_splash(t) {
    this._noise(t, 0.35, { vol: 0.25, freq: 3000, freqTo: 600, q: 0.8 });
    [0, 0.06, 0.11, 0.17].forEach((d, i) => this._tone(500 + i * 180, t + d, 0.09, { vol: 0.15, slideTo: 900 + i * 200 }));
  }

  sfx_pop(t) {
    this._noise(t, 0.12, { vol: 0.4, freq: 1800, q: 2 });
    this._tone(300, t, 0.15, { vol: 0.3, slideTo: 900 });
  }

  sfx_sparkle(t) {
    [84, 88, 91, 96, 100].forEach((n, i) => this._tone(midiHz(n), t + i * 0.07, 0.35, { type: 'triangle', vol: 0.12 }));
  }

  sfx_whoosh(t) {
    this._noise(t, 0.35, { vol: 0.2, freq: 400, freqTo: 2500, q: 1.5 });
  }

  sfx_click(t) {
    this._tone(1200, t, 0.05, { type: 'square', vol: 0.06 });
  }

  sfx_hop(t) {
    this._tone(300, t, 0.35, { type: 'triangle', vol: 0.25, slideTo: 900 });
  }

  sfx_land(t) {
    this._tone(120, t, 0.2, { vol: 0.35, slideTo: 60 });
    this._noise(t, 0.15, { vol: 0.15, filter: 'lowpass', freq: 600 });
  }

  sfx_dump(t) {
    this._noise(t, 1.6, { vol: 0.35, filter: 'lowpass', freq: 900, freqTo: 250 });
    this._tone(90, t + 0.1, 0.8, { vol: 0.25, slideTo: 50 });
    for (let i = 0; i < 6; i++) this._tone(150 + Math.random() * 100, t + 0.2 + i * 0.18, 0.12, { vol: 0.12 });
  }

  sfx_fanfare(t) {
    const seq = [[72, 0], [76, 0.14], [79, 0.28], [84, 0.42]];
    seq.forEach(([n, d]) => this._tone(midiHz(n), t + d, 0.3, { type: 'square', vol: 0.09 }));
    [72, 76, 79, 84].forEach((n) => this._tone(midiHz(n), t + 0.6, 1.2, { type: 'triangle', vol: 0.1, attack: 0.02 }));
    [60, 67].forEach((n) => this._tone(midiHz(n), t + 0.6, 1.2, { type: 'sine', vol: 0.15, attack: 0.02 }));
  }

  sfx_start(t) {
    [60, 64, 67].forEach((n, i) => this._tone(midiHz(n), t + i * 0.12, 0.25, { type: 'triangle', vol: 0.15 }));
  }

  sfx_lullaby(t) {
    [79, 76, 72, 74, 72].forEach((n, i) => this._tone(midiHz(n), t + i * 0.45, 0.7, { type: 'sine', vol: 0.12, attack: 0.05 }));
  }

  sfx_ding(t) {
    this._tone(midiHz(88), t, 0.5, { type: 'triangle', vol: 0.12 });
  }

  // gear lever moved: a chunky thunk with a click on top
  sfx_clunk(t) {
    this._tone(140, t, 0.16, { vol: 0.35, slideTo: 70 });
    this._noise(t, 0.06, { vol: 0.2, filter: 'lowpass', freq: 1500 });
    this._tone(900, t + 0.02, 0.04, { type: 'square', vol: 0.05 });
  }

  // one count of the back-to-the-start countdown: a wood-block tock
  sfx_tick(t) {
    this._tone(1320, t, 0.12, { type: 'triangle', vol: 0.18, slideTo: 990 });
  }

  // the chow chow: a friendly "wuf-wuf"
  sfx_woof(t) {
    for (const d of [0, 0.24]) {
      this._tone(420, t + d, 0.14, { type: 'triangle', vol: 0.3, slideTo: 150 });
      this._noise(t + d, 0.1, { vol: 0.14, filter: 'bandpass', freq: 800, q: 1.3 });
    }
  }

  // reversing beeper (played every 0.7 s while going backwards)
  sfx_beep(t) {
    this._tone(1050, t, 0.22, { type: 'square', vol: 0.05 });
  }

  // ---- engine and grass cutting loop ----------------------------------
  startEngine() {
    if (!this.ctx || this.engine) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.sfxBus);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const putt = ctx.createGain();
    putt.gain.value = 0.6;
    lp.connect(putt).connect(out);

    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 48;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 97;
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    o1.connect(lp); o2.connect(g2).connect(lp);

    const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain).connect(putt.gain);

    const cut = ctx.createBufferSource(); cut.buffer = this.noise; cut.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7;
    const cutGain = ctx.createGain(); cutGain.gain.value = 0;
    cut.connect(bp).connect(cutGain).connect(this.sfxBus);

    [o1, o2, lfo, cut].forEach((n) => n.start());
    out.gain.setTargetAtTime(0.12, this.now, 0.3);
    this.engine = { out, o1, o2, lfo, lp, cutGain, nodes: [o1, o2, lfo, cut] };
  }

  setEngine(speed01, cutting01) {
    const e = this.engine;
    if (!e) return;
    const t = this.now;
    e.o1.frequency.setTargetAtTime(48 + speed01 * 30, t, 0.1);
    e.o2.frequency.setTargetAtTime(97 + speed01 * 60, t, 0.1);
    e.lfo.frequency.setTargetAtTime(9 + speed01 * 10, t, 0.1);
    e.lp.frequency.setTargetAtTime(450 + speed01 * 500, t, 0.1);
    e.out.gain.setTargetAtTime(0.08 + speed01 * 0.08, t, 0.15);
    e.cutGain.gain.setTargetAtTime(cutting01 * 0.07, t, 0.08);
  }

  stopEngine() {
    const e = this.engine;
    if (!e) return;
    this.engine = null;
    e.out.gain.setTargetAtTime(0, this.now, 0.2);
    e.cutGain.gain.setTargetAtTime(0, this.now, 0.1);
    setTimeout(() => e.nodes.forEach((n) => { try { n.stop(); } catch (_) {} }), 1200);
  }

  // ---- music ----------------------------------------------------------
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const stepDur = 60 / 116 / 2; // eighth notes
    let step = 0;
    let next = this.now + 0.1;
    this.musicBus.gain.setTargetAtTime(settings().music ? 0.55 : 0, this.now, 0.5);
    const schedule = () => {
      while (next < this.now + 0.3) {
        const n = MELODY[step % MELODY.length];
        if (n != null) this._tone(midiHz(n), next, stepDur * 0.9, { type: 'triangle', vol: 0.07, dest: this.musicBus });
        if (step % 4 === 0) {
          const b = BASS[Math.floor(step / 4) % BASS.length];
          this._tone(midiHz(b), next, stepDur * 3, { type: 'sine', vol: 0.12, dest: this.musicBus });
        }
        next += stepDur;
        step++;
      }
    };
    this.musicTimer = setInterval(schedule, 100);
    schedule();
  }

  stopMusic() {
    if (!this.musicTimer) return;
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicBus.gain.setTargetAtTime(0, this.now, 0.3);
  }

  // ---- parent voice clips --------------------------------------------
  // Plays voice/<name>.* if it exists, otherwise the fallback sound effect.
  // Resolves when the clip (or fallback) has roughly finished.
  async voice(name, fallback = null) {
    if (!this.ctx) return;
    this.resume();
    const url = this.clips[name];
    if (!url) {
      if (fallback) this.play(fallback);
      return new Promise((r) => setTimeout(r, 600));
    }
    try {
      let buf = this.buffers.get(url);
      if (!buf) {
        const data = await (await fetch(url)).arrayBuffer();
        buf = await this.ctx.decodeAudioData(data);
        this.buffers.set(url, buf);
      }
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      g.gain.value = 1.4;
      src.buffer = buf;
      src.connect(g).connect(this.master);
      src.start();
      return new Promise((r) => { src.onended = r; });
    } catch (e) {
      console.warn('voice clip failed', name, e);
      if (fallback) this.play(fallback);
    }
  }
}
