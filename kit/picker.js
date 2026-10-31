// Game picker: big picture tiles, turn the wheel to choose, press to play.
// Skips itself while there is only one (browser) game.
//
// Native games such as SuperTuxKart are started by the server; the picker
// waits underneath until they close, then carries on.

import { loadSettings } from './settings.js';
import { Wheel } from './input.js';
import { Sound } from './audio.js';
import { ParentMenu } from './parent.js';

const games = await (await fetch('/api/games', { cache: 'no-store' })).json();
if (games.length === 1 && games[0].url) {
  location.replace(games[0].url + location.search);
} else {
  await loadSettings();
  const wheel = new Wheel();
  const sound = new Sound();
  await sound.init();
  const menu = new ParentMenu({ wheel, sound, onPicker: true });
  const root = document.getElementById('picker');
  root.innerHTML = games.map((g) => `<div class="tile"><img src="${g.icon}" alt=""></div>`).join('');
  const tiles = [...root.children];
  let sel = 0;
  let armed = true;
  let busy = false;
  const show = () => tiles.forEach((t, i) => t.classList.toggle('sel', i === sel));
  show();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function launch(g, tile) {
    busy = true;
    tile.classList.add('launching');
    sound.play('start');
    try {
      const res = await fetch('/api/launch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id }),
      });
      if (res.ok) {
        // wait for the game to close (race over, or parent buttons held)
        await sleep(2000);
        for (;;) {
          const s = await (await fetch('/api/native', { cache: 'no-store' })).json();
          if (!s.running) break;
          await sleep(1000);
        }
      } else {
        tile.classList.add('nope');
        await sleep(600);
      }
    } catch (e) { /* server restarting: just carry on */ }
    tile.classList.remove('launching', 'nope');
    wheel.markActive();
    busy = false;
  }

  const loop = () => {
    requestAnimationFrame(loop);
    menu.tick();
    // while a native game runs it owns the wheel (its watcher handles the
    // parent buttons), so don't read it here or the parent menu would open too
    if (menu.isOpen || busy) return;
    const w = wheel.poll();
    if (Math.abs(w.steer) < 0.25) armed = true;
    if (armed && Math.abs(w.steer) > 0.5) {
      armed = false;
      sel = (sel + (w.steer > 0 ? 1 : -1) + tiles.length) % tiles.length;
      sound.play('whoosh');
      show();
    }
    if (w.any.pressed && games[sel]) {
      const g = games[sel];
      if (g.url) location.href = g.url;
      else launch(g, tiles[sel]);
    }
  };
  loop();
}
