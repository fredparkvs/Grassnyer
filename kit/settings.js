// Settings shared by every game. Stored as JSON by kit/server.py.

export const DEFAULTS = {
  version: 1,
  driveMode: 'auto',      // 'auto' (rolls by itself) or 'pedals'
  maxSpeed: 3,            // 1..5
  steering: 3,            // 1..5 sensitivity
  music: true,
  volume: 7,              // 0..10
  vibration: true,
  playTimerMin: 0,        // 0 = off
  wheel: null,            // saved by the wheel setup screen (see input.js)
  games: {},              // per-game saved state, keyed by game id
};

let current = null;
let saveTimer = null;
const listeners = new Set();

export async function loadSettings() {
  let saved = {};
  try {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    if (res.ok) saved = await res.json();
  } catch (e) {
    console.warn('settings: server not reachable, using defaults', e);
  }
  current = { ...structuredClone(DEFAULTS), ...saved, games: { ...(saved.games || {}) } };
  return current;
}

export function settings() {
  if (!current) throw new Error('loadSettings() first');
  return current;
}

export function gameState(gameId, defaults = {}) {
  const s = settings();
  s.games[gameId] = { ...defaults, ...(s.games[gameId] || {}) };
  return s.games[gameId];
}

export function updateSettings(patch) {
  Object.assign(settings(), patch);
  saveSoon();
}

export function saveSoon() {
  for (const fn of listeners) fn(current);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

export async function saveNow() {
  clearTimeout(saveTimer);
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    });
  } catch (e) {
    console.warn('settings: save failed', e);
  }
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
