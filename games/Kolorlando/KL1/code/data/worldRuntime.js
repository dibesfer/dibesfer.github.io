import { buildSimpleMap } from '../../maps/simpleMap.js';
import { buildCityMap } from '../../maps/cityMap.js';
import { buildMapFromWorld } from '../../maps/MapGenerator.js';
import { Voxelaar, fillWorldWithVoxel } from '../../maps/Voxelaar.js';
import { Voxelandia, fillWorldWithVoxel as fillVoxelandiaWorldWithVoxel } from '../../maps/Voxelandia.js';
import { Grandaar, fillWorldWithVoxel as fillGrandaarWorldWithVoxel } from '../../maps/Grandaar.js';
import { Colorlandia, fillWorldWithVoxel as fillColorlandiaWorldWithVoxel } from '../../maps/Colorlandia.js';
import { Datatest, fillWorldWithVoxel as fillDatatestWorldWithVoxel } from '../../maps/Datatest.js';
import { createLocalWorldSaveStore } from './worldSaving.js';

const KL_SINGLEPLAYER_WORLD_STORAGE_KEY = 'KL_Singleplayer_World';
const DEFAULT_SINGLEPLAYER_WORLD = 'Voxelandia';

function resolveSingleplayerWorldPreset(storage = window.localStorage) {
  const storedWorld = storage.getItem(KL_SINGLEPLAYER_WORLD_STORAGE_KEY);
  const normalizedWorld = typeof storedWorld === 'string' ? storedWorld.trim() : '';
  const selectedWorld = normalizedWorld || DEFAULT_SINGLEPLAYER_WORLD;

  if (!normalizedWorld) {
    storage.setItem(KL_SINGLEPLAYER_WORLD_STORAGE_KEY, DEFAULT_SINGLEPLAYER_WORLD);
  }

  switch (selectedWorld.toLowerCase()) {
    case 'simple':
      return 'simple';
    case 'city':
      return 'city';
    case 'voxelaar':
      return 'voxelaar';
    case 'grandaar':
      return 'grandaar';
    case 'colorlandia':
      return 'colorlandia';
    case 'datatest':
      return 'datatest';
    case 'voxelandia':
    default:
      return 'voxelandia';
  }
}

function hasSameWorldVector(left = null, right = null) {
  return (
    Number(left?.x) === Number(right?.x)
    && Number(left?.y) === Number(right?.y)
    && Number(left?.z) === Number(right?.z)
  );
}

function canApplyLocalWorldSnapshot(snapshot = null, presetWorld = null) {
  if (!snapshot || !presetWorld) return false;
  if (typeof snapshot.name === 'string' && snapshot.name && snapshot.name !== presetWorld.name) {
    return false;
  }
  return (
    hasSameWorldVector(snapshot.size, presetWorld.size)
    && hasSameWorldVector(snapshot.land, presetWorld.land)
    && hasSameWorldVector(snapshot.spawnPosition, presetWorld.spawnPosition)
  );
}

export function createWorldRuntime({
  mode = 'singleplayer',
  multiplayerEnabled = false,
  scene = null,
  camera = null,
  playerEye = null,
  groundTexture = null,
  brickTexture = null,
  spawnPadTexture = null,
  brickTileSize = 1,
  storage = window.localStorage,
} = {}) {
  const mapPreset = resolveSingleplayerWorldPreset(storage);
  const mapBuilders = {
    simple: buildSimpleMap,
    city: buildCityMap,
  };
  const worldPresets = {
    voxelaar: () => fillWorldWithVoxel(Voxelaar.clone()),
    voxelandia: () => fillVoxelandiaWorldWithVoxel(Voxelandia.clone()),
    grandaar: () => fillGrandaarWorldWithVoxel(Grandaar.clone()),
    colorlandia: () => fillColorlandiaWorldWithVoxel(Colorlandia.clone()),
    datatest: () => fillDatatestWorldWithVoxel(Datatest.clone()),
  };
  const isClassWorldPreset = typeof worldPresets[mapPreset] === 'function';
  const localWorldSaveStore = !multiplayerEnabled && isClassWorldPreset
    ? createLocalWorldSaveStore({
      worldId: `${mode}-${mapPreset}`,
    })
    : null;
  const savedLocalWorldSnapshot = localWorldSaveStore?.loadWorldSnapshot?.() ?? null;
  const savedLocalWorldSavedBoxels = localWorldSaveStore?.loadSavedBoxels?.() ?? [];
  const selectedMapBuilder = mapBuilders[mapPreset] ?? buildSimpleMap;

  function resolveInitialVoxelWorld() {
    const buildPresetWorld = worldPresets[mapPreset];
    if (typeof buildPresetWorld !== 'function') {
      return null;
    }

    const nextWorld = buildPresetWorld();
    if (canApplyLocalWorldSnapshot(savedLocalWorldSnapshot, nextWorld)) {
      nextWorld.fromSnapshot(savedLocalWorldSnapshot);
    }
    return nextWorld;
  }

  const mapData = isClassWorldPreset
    ? buildMapFromWorld({
      scene,
      world: resolveInitialVoxelWorld(),
    })
    : selectedMapBuilder({
      scene,
      camera,
      playerEye,
      groundTexture,
      brickTexture,
      spawnPadTexture,
      brickTileSize,
      spawnDynamicEntities: !multiplayerEnabled,
    });

  return {
    mapPreset,
    mapData,
    isClassWorldPreset,
    localWorldSaveStore,
    savedLocalWorldSavedBoxels,
  };
}

export {
  DEFAULT_SINGLEPLAYER_WORLD,
  KL_SINGLEPLAYER_WORLD_STORAGE_KEY,
  resolveSingleplayerWorldPreset,
};
