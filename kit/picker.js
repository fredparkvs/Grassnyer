// Game picker. Skips itself while there is only one game.

import { loadSettings } from './settings.js';
import { Wheel } from './input.js';
import { Sound } from './audio.js';
import { ParentMenu } from './parent.js';

const games = await (await fetch('/api/games', { cache: 'no-store' })).json();
if (games.length === 1) {
  location.replace(games[0].url + location.search);
} else {
  await loadSettings();
  const wheel = new Wheel();
  const sound = new Sound();
  await sound.init();
  const menu = new ParentMenu({ wheel, sound });
  const root = document.getElementById('picker');
  root.innerHTML = games.map((g) => `<div class="tile"><img src="${g.icon}" alt=""></div>`).join('');
  const tiles = [...root.children];
  let sel = 0;
  let armed = true;
  const show = () => tiles.forEach((t, i) => t.classList.toggle('sel', i === sel));
  show();
  const loop = () => {
    requestAnimationFrame(loop);
    menu.tick();
    if (menu.isOpen) return;
    const w = wheel.poll();
    if (Math.abs(w.steer) < 0.25) armed = true;
    if (armed && Math.abs(w.steer) > 0.5) {
      armed = false;
      sel = (sel + (w.steer > 0 ? 1 : -1) + tiles.length) % tiles.length;
      sound.play('whoosh');
      show();
    }
    if (w.any.pressed && games[sel]) location.href = games[sel].url;
  };
  loop();
}
