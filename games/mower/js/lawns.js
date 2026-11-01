// The five lawns. The lawn is centred on (0, 0); x runs east-west (w) and z
// north-south (h). North (-z) is where the house, shed and compost corner are.
// The mower starts near the south edge facing north.
//
// Obstacle types (see world.js): tree, bush, flowers (w,d), bench (w),
// gnome, pond (r), sandpit (w,d), hay, rock (r), path (w,d).

// Every lawn is drawn GROW times bigger than the numbers below (the parent
// asked for bigger fields, 2026-10-31). Obstacles keep their size but spread
// out with the lawn; paths also get longer so they still reach the edge.
const GROW = 1.4;

// Each lawn has its own look (added 2026-11-01 at the parent's request):
// sky, light, grass (colour, blade shape, flowers), mowed stripes and
// little things floating in the air.
//   sky: [top, horizon]   hemi: [sky light, ground light, strength]
//   sun: [colour, strength, position]   clouds: cloud colour
//   grass: blades/width/lean shape the tufts; flowers tip some tufts in colour
//   mowed: under = dark ground under tall grass, a/b = the two stripe colours
const LOOKS = {
  sunny: {   // a bright summer day with a few daisies
    sky: [0x4aa8f0, 0xd8f1ff], fog: 0xd8f1ff, clouds: 0xffffff,
    hemi: [0xe8f6ff, 0x6a9a48, 1.7], sun: [0xfff6e0, 2.2, [6, 12, 8]],
    ground: 0x69a94b, hills: [0x5e9e42, 0x6fb04f], yard: 0x7fb35a,
    grass: { base: 0x2f7a24, tip: 0x9ad94f, height: 0.6, blades: 7, width: 1, lean: 0.25, flowers: [0xffffff, 0xffe14a, 0xffffff], flowerChance: 0.05 },
    mowed: { under: 0x3e7d2a, a: 0x86c95a, b: 0x6fb447 },
    motes: null,
  },
  flowery: {   // a soft pink morning, lush broad grass full of flowers, petals in the air
    sky: [0x76b9f0, 0xffe4ee], fog: 0xf6e6ee, clouds: 0xfff4f8,
    hemi: [0xfff0f6, 0x5a9a5a, 1.75], sun: [0xffe6d0, 2.1, [-8, 9, 6]],
    ground: 0x5fa85a, hills: [0x58a057, 0x6cb565], yard: 0x78b866,
    grass: { base: 0x1f6a36, tip: 0x74d58a, height: 0.56, blades: 8, width: 1.35, lean: 0.2, flowers: [0xff6fb5, 0xc56bff, 0xffffff], flowerChance: 0.17 },
    mowed: { under: 0x2f7a3f, a: 0x7fd08a, b: 0x63b872 },
    motes: { kind: 'petals', colours: [0xffb3d9, 0xffffff, 0xff8ac2] },
  },
  meadow: {   // a golden afternoon: tall wispy grass, dandelions, fluff floating by
    sky: [0x3f8fe0, 0xf3ecc8], fog: 0xece6c8, clouds: 0xfffaf0,
    hemi: [0xfff4dc, 0x7a9a40, 1.65], sun: [0xffe2a8, 2.3, [10, 10, 4]],
    ground: 0x76a845, hills: [0x6a9e3c, 0x82b04c], yard: 0x8ab65a,
    grass: { base: 0x4a7a1e, tip: 0xd6e870, height: 0.8, blades: 6, width: 0.65, lean: 0.5, flowers: [0xffd21f, 0xffffff, 0xffd21f], flowerChance: 0.11 },
    mowed: { under: 0x557d26, a: 0xa6cf66, b: 0x8cbc52 },
    motes: { kind: 'fluff', colours: [0xffffff, 0xfffbe6] },
  },
  wheat: {   // a wheat field at sunset: straight golden stalks, a few poppies, dust glinting
    sky: [0x5b78d0, 0xffb07a], fog: 0xf6c49a, clouds: 0xffd2b4,
    hemi: [0xffe0c0, 0x8a7a3a, 1.6], sun: [0xffb070, 2.4, [-12, 6, -4]],
    ground: 0xa8a050, hills: [0x9a9a4a, 0xb0a85a], yard: 0xb8b064,
    grass: { base: 0x8a6a20, tip: 0xf4d870, height: 0.74, blades: 7, width: 0.6, lean: 0.08, flowers: [0xe8352f, 0xe8352f, 0xff8a1f], flowerChance: 0.04 },
    mowed: { under: 0x8a702e, a: 0xdcc67c, b: 0xc8b064 },
    motes: { kind: 'dust', colours: [0xffe8a0, 0xfff2c8] },
  },
  magic: {   // a magic evening: teal grass with glowing flower tips, fireflies
    sky: [0x2e3a8c, 0xff9fc4], fog: 0xc89ac8, clouds: 0xe6d2ff,
    hemi: [0xd8d0ff, 0x4a6a7a, 1.55], sun: [0xffb8e0, 2.0, [8, 7, -6]],
    ground: 0x4f8a6a, hills: [0x46807a, 0x5a9480], yard: 0x62967a,
    grass: { base: 0x1d5560, tip: 0x8fe3c8, height: 0.65, blades: 7, width: 1, lean: 0.3, flowers: [0xc56bff, 0x5ab8ff, 0xffffff], flowerChance: 0.13 },
    mowed: { under: 0x2a6a66, a: 0x86d0b4, b: 0x6cbca0 },
    motes: { kind: 'fireflies', colours: [0xd8ff6a, 0xfff38a] },
  },
};

const PLANS = [
  {
    name: 'Back garden', w: 16, h: 12, edge: 'fence', backdrop: 'house', look: LOOKS.sunny,
    obstacles: [
      { type: 'tree', x: -3, z: -1.5 },
    ],
  },
  {
    name: 'Front garden', w: 20, h: 14, edge: 'pickets', backdrop: 'house', look: LOOKS.flowery,
    obstacles: [
      { type: 'path', x: -4, z: 0, w: 1.4, d: 14 },
      { type: 'flowers', x: 4, z: -3.5, w: 4, d: 1.5 },
      { type: 'flowers', x: -7, z: 2, w: 1.5, d: 4 },
      { type: 'bush', x: 6, z: 3 },
    ],
  },
  {
    name: 'Park', w: 24, h: 18, edge: 'hedge', backdrop: 'park', look: LOOKS.meadow,
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
    name: 'Farm field', w: 28, h: 20, edge: 'fence', backdrop: 'farm', look: LOOKS.wheat,
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
    name: 'Big garden', w: 30, h: 22, edge: 'hedge', backdrop: 'house', look: LOOKS.magic,
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

export const LAWNS = PLANS.map((p) => ({
  ...p,
  w: p.w * GROW,
  h: p.h * GROW,
  obstacles: p.obstacles.map((o) => ({ ...o, x: o.x * GROW, z: o.z * GROW, ...(o.type === 'path' ? { d: o.d * GROW } : {}) })),
}));
