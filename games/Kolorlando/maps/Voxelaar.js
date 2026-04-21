import { World } from '../code/data/World.js';
import { Voxel } from '../code/data/Voxel.js';

/* Voxelaar starts as an empty world object.
Inner content layers will be authored later. */
let Voxelaar = new World({
  size: { x: 100, y: 100, z: 100 },
  land: { x: 100, y: 3, z: 100 },
  spawnPosition: { x: 0, y: 5, z: 0 },
});

/* These mirror the 12 standard color voxels currently authored in Voxelandia. */
let VoxelaarVoxels = {
  red: new Voxel({ name: 'red', color: '#ff4040' }),
  orange: new Voxel({ name: 'orange', color: '#ff9c33' }),
  yellow: new Voxel({ name: 'yellow', color: '#ffe066' }),
  green: new Voxel({ name: 'green', color: '#2fba4e' }),
  lightblue: new Voxel({ name: 'lightblue', color: '#6ccfff' }),
  blue: new Voxel({ name: 'blue', color: '#3a6fff' }),
  brown: new Voxel({ name: 'brown', color: '#8b5a2b' }),
  pink: new Voxel({ name: 'pink', color: '#ff7eb6' }),
  purple: new Voxel({ name: 'purple', color: '#8a57ff' }),
  white: new Voxel({ name: 'white', color: '#f5f5f5' }),
  gray: new Voxel({ name: 'gray', color: '#8a8a8a' }),
  black: new Voxel({ name: 'black', color: '#171717' }),
};

function fillWorldWithVoxel(world = Voxelaar, voxel = VoxelaarVoxels.brown) {
  /* Author voxels through the World API so storage stays sparse and consistent. */
  world.clearVoxels();

  for (let x = 0; x < world.land.x; x++) {
    for (let y = 0; y < world.land.y; y++) {
      for (let z = 0; z < world.land.z; z++) {
        world.setVoxel(x, y, z, voxel);
      }
    }
  }

  return world;
}

export { Voxelaar, VoxelaarVoxels, fillWorldWithVoxel };
