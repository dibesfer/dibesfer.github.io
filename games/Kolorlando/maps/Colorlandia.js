import { World } from '../code/data/World.js';
import { Voxel } from '../code/data/Voxel.js';

const COLORLANDIA_NOISE_TEXTURE = 'assets/voxels/textures/noise.png';

let Colorlandia = new World({
  name: 'Colorlandia',
  size: { x: 2000, y: 2000, z: 2000 },
  land: { x: 2000, y: 100, z: 2000 },
  spawnPosition: { x: 0, y: 105, z: 0 },
  boxel15DistanceRendering: { radiusInVoxels: 30, verticalChunkRadius: 1 },
});

/* These keep the Voxelandia palette while swapping in the tinted noise texture. */
let ColorlandiaVoxels = {
  noise_red: new Voxel({ name: 'noise_red', color: '#ff5a5a', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_orange: new Voxel({ name: 'noise_orange', color: '#ffb347', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_yellow: new Voxel({ name: 'noise_yellow', color: '#fff07a', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_green: new Voxel({ name: 'noise_green', color: '#47d968', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_lightblue: new Voxel({ name: 'noise_lightblue', color: '#89e0ff', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_blue: new Voxel({ name: 'noise_blue', color: '#5a8cff', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_brown: new Voxel({ name: 'noise_brown', color: '#b97a3d', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_pink: new Voxel({ name: 'noise_pink', color: '#ff96c7', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_purple: new Voxel({ name: 'noise_purple', color: '#a178ff', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_white: new Voxel({ name: 'noise_white', color: '#fafafa', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_gray: new Voxel({ name: 'noise_gray', color: '#a6a6a6', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
  noise_black: new Voxel({ name: 'noise_black', color: '#2b2b2b', type: 'textured', texture: COLORLANDIA_NOISE_TEXTURE, textureInfluence: 0.6 }),
};

const COLORLANDIA_VOXEL_PALETTE = Object.values(ColorlandiaVoxels);

Colorlandia.setVoxelTypes(COLORLANDIA_VOXEL_PALETTE);

function createColorlandiaChunkVoxels({
  world = Colorlandia,
  chunkPosition = { x: 0, y: 0, z: 0 },
  chunkSize = 15,
} = {}) {
  const chunkMinY = chunkPosition.y * chunkSize;
  if (chunkMinY >= world.land.y) {
    return [];
  }

  const chunkMinX = chunkPosition.x * chunkSize;
  const chunkMinZ = chunkPosition.z * chunkSize;
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
          voxel: ColorlandiaVoxels.noise_brown,
        });
      }
    }
  }

  return chunkVoxels;
}

function fillWorldWithVoxel(world = Colorlandia) {
  world.clearVoxels();
  world.setVoxelTypes(COLORLANDIA_VOXEL_PALETTE);
  world.setChunkGenerator(createColorlandiaChunkVoxels);
  world.staticMiniMapColor = ColorlandiaVoxels.noise_gray.color;
  return world;
}

Colorlandia.setChunkGenerator(createColorlandiaChunkVoxels);
Colorlandia.staticMiniMapColor = ColorlandiaVoxels.noise_gray.color;

export { Colorlandia, ColorlandiaVoxels, fillWorldWithVoxel };
