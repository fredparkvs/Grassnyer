// Picture-only overlay: progress meter, presents found, stop/go light,
// "touch the wheel" hint, garage pickers, fades and the sleep screen.

import { PAINT } from './models.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

const SVG = {
  grass: `<svg viewBox="0 0 40 40"><path d="M6 36 C8 22 10 14 8 6 C14 14 15 24 15 36Z M14 36 C16 20 20 10 26 4 C24 16 22 26 22 36Z M21 36 C24 26 28 20 35 16 C30 24 29 30 30 36Z" fill="#3aa52a" stroke="#1f6b17" stroke-width="2" stroke-linejoin="round"/></svg>`,
  star: `<svg viewBox="0 0 40 40"><path d="M20 3 L25 15 L38 15 L27.5 23 L31.5 36 L20 28 L8.5 36 L12.5 23 L2 15 L15 15Z" fill="#ffd21f" stroke="#b8860b" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  gift: `<svg viewBox="0 0 40 40"><rect x="5" y="15" width="30" height="21" rx="3" fill="currentColor" stroke="#333" stroke-width="2"/><rect x="3" y="10" width="34" height="8" rx="2" fill="currentColor" stroke="#333" stroke-width="2"/><rect x="17" y="10" width="6" height="26" fill="#fff" stroke="#333" stroke-width="1.5"/><path d="M20 10 C14 2 8 6 12 10 M20 10 C26 2 32 6 28 10" fill="none" stroke="#333" stroke-width="2.5"/></svg>`,
  wheel: `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="25" fill="none" stroke="#333" stroke-width="7"/><circle cx="30" cy="30" r="6" fill="#333"/><path d="M8 26 L24 28 M52 26 L36 28 M30 36 L30 54" stroke="#333" stroke-width="7" stroke-linecap="round"/></svg>`,
  arrowL: `<svg viewBox="0 0 40 40"><path d="M26 6 L10 20 L26 34" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  arrowR: `<svg viewBox="0 0 40 40"><path d="M14 6 L30 20 L14 34" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  button: `<svg viewBox="0 0 60 60"><circle cx="30" cy="33" r="22" fill="#a51f1f"/><circle cx="30" cy="28" r="22" fill="#ff4a3d" stroke="#7a1010" stroke-width="3"/><ellipse cx="23" cy="20" rx="7" ry="4" fill="#ffffff" opacity="0.6"/></svg>`,
  pot: `<svg viewBox="0 0 40 44"><path d="M6 14 L34 14 L31 40 L9 40Z" fill="#9aa3ab" stroke="#333" stroke-width="2"/><ellipse cx="20" cy="14" rx="14" ry="5" fill="currentColor" stroke="#333" stroke-width="2"/><path d="M12 15 C12 24 16 22 16 28 C16 32 20 32 20 28 L20 16" fill="currentColor"/></svg>`,
  moon: `<svg viewBox="0 0 80 80"><path d="M50 8 A32 32 0 1 0 72 52 A26 26 0 1 1 50 8Z" fill="#fff3b0"/></svg>`,
  plug: `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="#fff" stroke-width="6"/><path d="M12 12 L48 48" stroke="#ff4a3d" stroke-width="7" stroke-linecap="round"/></svg>`,
};

export class Hud {
  constructor() {
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div class="top hidden">
        <div class="meter"><span class="m-icon">${SVG.grass}</span><div class="bar"><div class="fill"></div></div><span class="m-icon">${SVG.star}</span></div>
        <div class="gifts">${[0, 1, 2].map(() => `<span class="gift">${SVG.gift}</span>`).join('')}</div>
      </div>
      <div class="light hidden"><i class="red"></i><i class="green"></i></div>
      <div class="wheel-hint hidden">${SVG.wheel}</div>
      <div class="countdown hidden"><b></b></div>
      <div class="nowheel hidden">${SVG.wheel}<span>${SVG.plug}</span></div>
      <div class="garage-ui hidden">
        <div class="g-row g-vehicle"><span class="g-arrow">${SVG.arrowL}</span><span class="g-wheel">${SVG.wheel}</span><span class="g-arrow">${SVG.arrowR}</span></div>
        <div class="g-row g-colours">${PAINT.map((c) => `<span class="pot" style="color:${hex(c)}">${SVG.pot}</span>`).join('')}</div>
        <div class="g-button">${SVG.button}</div>
      </div>
      <div class="sleep hidden"><div class="moon">${SVG.moon}</div><div class="zzz"><b>z</b><b>z</b><b>z</b></div></div>
      <div class="fade"></div>`;
    document.body.appendChild(root);
    this.root = root;
    this.q = (s) => root.querySelector(s);
    this.fill = this.q('.fill');
    this.gifts = [...root.querySelectorAll('.gift')];
    this.pots = [...root.querySelectorAll('.pot')];
    this.fadeEl = this.q('.fade');
  }

  show(sel, on) { this.q(sel).classList.toggle('hidden', !on); }

  setPlaying(on) { this.show('.top', on); }

  setProgress(p) { this.fill.style.width = `${Math.round(Math.min(1, p) * 100)}%`; }

  setGifts(n) { this.gifts.forEach((g, i) => g.classList.toggle('found', i < n)); }

  // bonus presents found join the row, in their wrapping colour (up to 9 fit)
  addBonusGift(colour) {
    const row = this.q('.gifts');
    if (row.querySelectorAll('.bonus').length >= 9) return;
    const el = document.createElement('span');
    el.className = 'gift found bonus';
    el.style.color = hex(colour);
    el.innerHTML = SVG.gift;
    row.appendChild(el);
  }

  clearBonusGifts() { this.root.querySelectorAll('.gift.bonus').forEach((el) => el.remove()); }

  setLight(visible, going) {
    this.show('.light', visible);
    this.q('.light').classList.toggle('going', going);
  }

  setWheelHint(on) { this.show('.wheel-hint', on); }

  // big 5-4-3-2-1 before a stuck vehicle goes back to the start; null hides it
  setCountdown(n) {
    const el = this.q('.countdown');
    this.show('.countdown', n != null);
    if (n == null) return;
    el.firstElementChild.textContent = n;
    el.classList.remove('tick');
    void el.offsetWidth;
    el.classList.add('tick');
  }

  setConnected(c) { this.show('.nowheel', !c); }

  garage(step, colour) {
    this.show('.garage-ui', step != null);
    if (step == null) return;
    this.show('.g-vehicle', step === 'vehicle');
    this.show('.g-colours', step === 'colour');
    this.pots.forEach((p, i) => p.classList.toggle('sel', i === colour));
  }

  pressButton() {
    const b = this.q('.g-button');
    b.classList.remove('press');
    void b.offsetWidth;
    b.classList.add('press');
  }

  fade(to, ms = 600) {
    this.fadeEl.style.transition = `opacity ${ms}ms ease`;
    this.fadeEl.style.opacity = to;
    return new Promise((r) => setTimeout(r, ms));
  }

  setSleep(on) { this.show('.sleep', on); }
}
