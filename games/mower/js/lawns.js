// The five lawns. The lawn is centred on (0, 0); x runs east-west (w) and z
// north-south (h). North (-z) is where the house, shed and compost corner are.
// The mower starts near the south edge facing north.
//
// Obstacle types (see world.js): tree, bush, flowers (w,d), bench (w),
// gnome, pond (r), sandpit (w,d), hay, rock (r), path (w,d).

export const LAWNS = [
  {
    name: 'Back garden', w: 16, h: 12, edge: 'fence', backdrop: 'house',
    obstacles: [
      { type: 'tree', x: -3, z: -1.5 },
    ],
  },
  {
    name: 'Front garden', w: 20, h: 14, edge: 'pickets', backdrop: 'house',
    obstacles: [
      { type: 'path', x: -4, z: 0, w: 1.4, d: 14 },
      { type: 'flowers', x: 4, z: -3.5, w: 4, d: 1.5 },
      { type: 'flowers', x: -7, z: 2, w: 1.5, d: 4 },
      { type: 'bush', x: 6, z: 3 },
    ],
  },
  {
    name: 'Park', w: 24, h: 18, edge: 'hedge', backdrop: 'park',
    obstacles: [
      { type: 'pond', x: 4.5, z: -2, r: 2.4 },
      { type: 'bench', x: -6, z: 4.5 },
      { type: 'bench', x: -5, z: -5.5 },
      { type: 'tree', x: -8, z: -1 },
      { type: 'tree', x: 8.5, z: 5 },
      { type: 'rock', x: 0, z: 5, r: 0.6 },
    ],
  },
  {
    name: 'Farm field', w: 28, h: 20, edge: 'fence', backdrop: 'farm',
    obstacles: [
      { type: 'hay', x: -7, z: -4 },
      { type: 'hay', x: 6, z: 4 },
      { type: 'hay', x: 9, z: -5 },
      { type: 'hay', x: -10, z: 5 },
      { type: 'rock', x: -2, z: 4, r: 0.7 },
      { type: 'tree', x: 1, z: -5 },
    ],
  },
  {
    name: 'Big garden', w: 30, h: 22, edge: 'hedge', backdrop: 'house',
    obstacles: [
      { type: 'path', x: 0, z: 8, w: 1.4, d: 6 },
      { type: 'tree', x: -9, z: -5 },
      { type: 'tree', x: 10, z: 6 },
      { type: 'flowers', x: -3, z: -7, w: 4, d: 1.5 },
      { type: 'flowers', x: 12, z: -2, w: 1.5, d: 4 },
      { type: 'pond', x: 6, z: -4, r: 2.0 },
      { type: 'sandpit', x: -9, z: 5, w: 3, d: 3 },
      { type: 'gnome', x: 3, z: 3 },
      { type: 'gnome', x: -3, z: -1 },
      { type: 'gnome', x: 12, z: 8 },
      { type: 'bench', x: -1, z: -8 },
      { type: 'bush', x: -13, z: -8 },
    ],
  },
];
