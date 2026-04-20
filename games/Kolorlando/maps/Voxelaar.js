import { World } from '../code/data/World.js';

/* Voxelaar starts as an empty world object.
Inner content layers will be authored later. */
let Voxelaar = new World({
  size: { x: 100, y: 3, z: 100 },
});

export { Voxelaar };
