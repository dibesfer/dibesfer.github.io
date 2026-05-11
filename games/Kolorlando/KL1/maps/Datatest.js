import { World } from '../code/data/World.js';
import { Voxel } from '../code/data/Voxel.js';

const DATA_BACKGROUND_TEXTURE = 'assets/voxels/textures/data_background.png';
const DATA_DETAIL_TEXTURE = 'assets/voxels/textures/data_detail.png';
const DATA_TEXTURE = {
  all: DATA_BACKGROUND_TEXTURE,
  base: DATA_BACKGROUND_TEXTURE,
  mask: DATA_DETAIL_TEXTURE,
};

let Datatest = new World({
  name: 'Datatest',
  size: { x: 1000, y: 1000, z: 1000 },
  land: { x: 1000, y: 100, z: 1000 },
  skyColor: '#000000',
  boxel15DistanceRendering: { radiusInVoxels: 30, verticalChunkRadius: 1 },
});

let DatatestVoxels = {
  data_red: new Voxel({ name: 'data_red', color: '#ff5a5a', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_orange: new Voxel({ name: 'data_orange', color: '#ffb347', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_yellow: new Voxel({ name: 'data_yellow', color: '#fff07a', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_green: new Voxel({ name: 'data_green', color: '#47d968', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_lightblue: new Voxel({ name: 'data_lightblue', color: '#89e0ff', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_blue: new Voxel({ name: 'data_blue', color: '#5a8cff', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_brown: new Voxel({ name: 'data_brown', color: '#b97a3d', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_pink: new Voxel({ name: 'data_pink', color: '#ff96c7', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_purple: new Voxel({ name: 'data_purple', color: '#a178ff', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_white: new Voxel({ name: 'data_white', color: '#fafafa', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_gray: new Voxel({ name: 'data_gray', color: '#a6a6a6', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
  data_black: new Voxel({ name: 'data_black', color: '#2b2b2b', type: 'textured', texture: DATA_TEXTURE, textureInfluence: 0.6 }),
};

const DATATEST_VOXEL_PALETTE = Object.values(DatatestVoxels);

Datatest.setVoxelTypes(DATATEST_VOXEL_PALETTE);

function createDatatestChunkVoxels({
  world = Datatest,
  chunkPosition = { x: 0, y: 0, z: 0 },
  chunkSize = 15,
} = {}) {
  const chunkMinY = chunkPosition.y * chunkSize;
  if (chunkMinY >= world.land.y) {
    return [];
  }

  const maxLocalY = Math.min(chunkSize, world.land.y - chunkMinY);
  const chunkVoxels = [];

  for (let localX = 0; localX < chunkSize; localX += 1) {
    for (let localY = 0; localY < maxLocalY; localY += 1) {
      for (let localZ = 0; localZ < chunkSize; localZ += 1) {
        chunkVoxels.push({
          position: {
            x: localX,
            y: localY,
            z: localZ,
          },
          voxel: DatatestVoxels.data_white,
        });
      }
    }
  }

  return chunkVoxels;
}

function fillWorldWithVoxel(world = Datatest) {
  world.clearVoxels();
  world.setVoxelTypes(DATATEST_VOXEL_PALETTE);
  world.setChunkGenerator(createDatatestChunkVoxels);
  world.staticMiniMapColor = DatatestVoxels.data_white.color;
  return world;
}

Datatest.setChunkGenerator(createDatatestChunkVoxels);
Datatest.staticMiniMapColor = DatatestVoxels.data_white.color;

export { Datatest, DatatestVoxels, fillWorldWithVoxel };
