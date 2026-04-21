import { World } from '../code/data/World.js';
import { Voxel } from '../code/data/Voxel.js';

/* Voxelandia is the authored default world data source for the main map. */
let Voxelandia = new World({
  name: 'Voxelandia',
  size: { x: 100, y: 100, z: 100 },
  land: { x: 100, y: 3, z: 100 },
  spawnPosition: { x: 0, y: 5, z: 0 },
});

/* Keep the authored voxel catalog close to the world definition. */
let VoxelandiaVoxels = {
  red: new Voxel({ name: 'red', color: '#ff4040', type: 'textured', texture: 'bordered' }),
  orange: new Voxel({ name: 'orange', color: '#ff9c33', type: 'textured', texture: 'bordered' }),
  yellow: new Voxel({ name: 'yellow', color: '#ffe066', type: 'textured', texture: 'bordered' }),
  green: new Voxel({ name: 'green', color: '#2fba4e', type: 'textured', texture: 'bordered' }),
  lightblue: new Voxel({ name: 'lightblue', color: '#6ccfff', type: 'textured', texture: 'bordered' }),
  blue: new Voxel({ name: 'blue', color: '#3a6fff', type: 'textured', texture: 'bordered' }),
  brown: new Voxel({ name: 'brown', color: '#8b5a2b', type: 'textured', texture: 'bordered' }),
  pink: new Voxel({ name: 'pink', color: '#ff7eb6', type: 'textured', texture: 'bordered' }),
  purple: new Voxel({ name: 'purple', color: '#8a57ff', type: 'textured', texture: 'bordered' }),
  white: new Voxel({ name: 'white', color: '#f5f5f5', type: 'textured', texture: 'bordered' }),
  gray: new Voxel({ name: 'gray', color: '#8a8a8a', type: 'textured', texture: 'bordered' }),
  black: new Voxel({ name: 'black', color: '#171717', type: 'textured', texture: 'bordered' }),
  fer: new Voxel({ name: 'fer', color: '#000000', type: 'textured', texture: 'bordered' }),
};

Voxelandia.setVoxelTypes(Object.values(VoxelandiaVoxels));

function createCenteredWorldEntity({
  kind = 'walker',
  position = { x: 0, y: 0, z: 0 },
  runtime = 'singleplayer',
  ...entity
} = {}) {
  /* Voxelandia authors world actors from center-bottom coordinates so content
  stays readable without leaking storage offsets into gameplay declarations. */
  return {
    kind,
    runtime,
    positionMode: 'floor-centered',
    position: {
      x: Number(position?.x) || 0,
      y: Number(position?.y) || 0,
      z: Number(position?.z) || 0,
    },
    ...entity,
  };
}

function createSpawnRelativeWorldEntity({
  kind = 'item',
  position = { x: 0, y: 0, z: 0 },
  runtime = 'singleplayer',
  ...entity
} = {}) {
  /* Starter pickups are easier to author relative to the spawn anchor than as
  absolute map coordinates. */
  return {
    kind,
    runtime,
    positionMode: 'spawn-relative',
    position: {
      x: Number(position?.x) || 0,
      y: Number(position?.y) || 0,
      z: Number(position?.z) || 0,
    },
    ...entity,
  };
}

const starterCoinOffsets = [
  { x: 0, y: 0, z: -10 },
  { x: 3.2, y: 0, z: -9.4 },
  { x: -3.2, y: 0, z: -9.4 },
  { x: 6.2, y: 0, z: -7.5 },
  { x: -6.2, y: 0, z: -7.5 },
  { x: 8.1, y: 0, z: -4.2 },
  { x: -8.1, y: 0, z: -4.2 },
  { x: 8.4, y: 0, z: 0.5 },
  { x: -8.4, y: 0, z: 0.5 },
  { x: 0, y: 0, z: 9.5 },
];

Voxelandia.setEntities([
  ...Voxelandia.entities,
  createCenteredWorldEntity({
    kind: 'talker',
    runtime: 'all',
    position: { x: 2.5, y: 1.7, z: 1.5 },
    name: 'Guide',
    dialogLines: ['Welcome back to Kolorlando', 'Check the item appearances nearby', 'Debug mode shows the item spheres'],
  }),
  createCenteredWorldEntity({
    kind: 'vehicle',
    runtime: 'singleplayer',
    vehicleType: 'spaceship',
    position: { x: 30, y: 6, z: -7 },
    name: 'SpaceShip1',
  }),
  createCenteredWorldEntity({
    kind: 'walker',
    position: { x: -18, y: 0, z: -18 },
  }),
  createCenteredWorldEntity({
    kind: 'walker',
    position: { x: 18, y: 0, z: -15 },
  }),
  createCenteredWorldEntity({
    kind: 'walker',
    position: { x: -12, y: 0, z: 20 },
  }),
  createCenteredWorldEntity({
    kind: 'chaser',
    position: { x: 24, y: 0, z: 12 },
  }),
  createCenteredWorldEntity({
    kind: 'chaser',
    position: { x: -24, y: 0, z: 12 },
  }),
  createCenteredWorldEntity({
    kind: 'chaser',
    position: { x: 0, y: 0, z: -24 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'goxel',
    itemId: 'sword',
    position: { x: 2.8, y: 0, z: -10 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'goxel',
    itemId: 'gun',
    position: { x: -2.8, y: 0, z: -10 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'boxel-selection-tool',
    itemId: 'boxel-selection-tool',
    position: { x: 0, y: 0, z: -13.2 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'color-chest',
    itemId: 'color-chest',
    position: { x: 0, y: 0, z: -6.9 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'color-pants',
    itemId: 'color-pants',
    position: { x: 3.4, y: 0, z: -6.9 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'color-boots',
    itemId: 'color-boots',
    position: { x: -3.4, y: 0, z: -6.9 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'color-gloves',
    itemId: 'color-gloves',
    position: { x: 0, y: 0, z: -4.3 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'color-shoulders',
    itemId: 'color-shoulders',
    position: { x: 0, y: 0, z: 4.5 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'color-helmet',
    itemId: 'color-helmet',
    position: { x: 0, y: 0, z: 7.9 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'color-cape',
    itemId: 'color-cape',
    position: { x: 0, y: 0, z: 11.3 },
  }),
  createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'color-tabard',
    itemId: 'color-tabard',
    position: { x: 0, y: 0, z: 14.7 },
  }),
  ...starterCoinOffsets.map(offset => createSpawnRelativeWorldEntity({
    kind: 'item',
    appearanceType: 'coin',
    itemId: 'coin',
    position: offset,
  })),
]);

function toCenteredStoragePosition(world = Voxelandia, position = {}) {
  /* Voxelandia authoring uses a centered mental model:
  0,0,0 is the bottom-center anchor of the world. */
  return {
    x: Math.floor(world.size.x * 0.5) + Math.floor(Number(position?.x) || 0),
    y: Math.floor(Number(position?.y) || 0),
    z: Math.floor(world.size.z * 0.5) + Math.floor(Number(position?.z) || 0),
  };
}

function setCenteredVoxel(world = Voxelandia, x = 0, y = 0, z = 0, voxel = VoxelandiaVoxels.green) {
  const storagePosition = toCenteredStoragePosition(world, { x, y, z });
  world.setVoxel(storagePosition.x, storagePosition.y, storagePosition.z, voxel);
  return world;
}

function fillWorldWithVoxel(world = Voxelandia, voxel = VoxelandiaVoxels.green) {
  /* Author the flat land through the World API so render and save flows share
  the same sparse source of truth.
  Voxelandia stays authored from the center outward, not from a top-left corner. */
  world.clearVoxels();

  const minX = -Math.floor(world.land.x * 0.5);
  const maxX = minX + world.land.x - 1;
  const minZ = -Math.floor(world.land.z * 0.5);
  const maxZ = minZ + world.land.z - 1;

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = 0; y < world.land.y; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        setCenteredVoxel(world, x, y, z, voxel);
      }
    }
  }

  return world;
}

export {
  Voxelandia,
  VoxelandiaVoxels,
  fillWorldWithVoxel,
  setCenteredVoxel,
  toCenteredStoragePosition,
};
