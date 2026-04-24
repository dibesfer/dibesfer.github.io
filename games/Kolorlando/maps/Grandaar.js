import { World } from '../code/data/World.js';
import { VoxelandiaVoxels } from './Voxelandia.js';

let Grandaar = new World({
  name: 'Grandaar',
  size: { x: 1000, y: 1000, z: 1000 },
  land: { x: 1000, y: 100, z: 1000 },
  spawnPosition: { x: 0, y: 105, z: 0 },
  boxel15DistanceRendering: { radiusInVoxels: 15, verticalChunkRadius: 1 },
});

Grandaar.setVoxelTypes(Object.values(VoxelandiaVoxels));

function createGrandaarChunkVoxels({
  world = Grandaar,
  chunkPosition = { x: 0, y: 0, z: 0 },
  chunkSize = 15,
} = {}) {
  const chunkMinY = chunkPosition.y * chunkSize;
  if (chunkMinY >= world.land.y) {
    return [];
  }

  const grayVoxel = VoxelandiaVoxels.gray;
  const chunkVoxels = [];
  const maxLocalY = Math.min(chunkSize, world.land.y - chunkMinY);

  for (let localX = 0; localX < chunkSize; localX += 1) {
    for (let localY = 0; localY < maxLocalY; localY += 1) {
      for (let localZ = 0; localZ < chunkSize; localZ += 1) {
        chunkVoxels.push({
          position: {
            x: localX,
            y: localY,
            z: localZ,
          },
          voxel: grayVoxel,
        });
      }
    }
  }

  return chunkVoxels;
}

function fillWorldWithVoxel(world = Grandaar) {
  world.clearVoxels();
  world.setVoxelTypes(Object.values(VoxelandiaVoxels));
  world.setChunkGenerator(createGrandaarChunkVoxels);
  world.staticMiniMapColor = VoxelandiaVoxels.gray.color;
  return world;
}

Grandaar.setChunkGenerator(createGrandaarChunkVoxels);
Grandaar.staticMiniMapColor = VoxelandiaVoxels.gray.color;

export { Grandaar, fillWorldWithVoxel };
