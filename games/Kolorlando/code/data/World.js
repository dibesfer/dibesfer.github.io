import { Boxel } from './Boxel.js';
import { Voxel, VoxelPlane, VoxelPlaneText } from './Voxel.js';

export const Boxel10 = new Boxel({
  name: 'Boxel10',
  size: 10,
});

export const Boxel15 = new Boxel({
  name: 'Boxel15',
  size: 15,
});

const WORLD_SNAPSHOT_FORMAT = 'kolorlando.worldSnapshot.compact';
const WORLD_SNAPSHOT_VERSION = 1;

export class Boxel15DistanceRendering {
  constructor({
    radiusInVoxels = 30,
    verticalChunkRadius = null,
  } = {}) {
    this.radiusInVoxels = normalizeWorldAxisSize(radiusInVoxels);
    this.verticalChunkRadius = normalizeWorldOptionalChunkRadius(verticalChunkRadius);
  }

  setRadiusInVoxels(radiusInVoxels = 30) {
    this.radiusInVoxels = normalizeWorldAxisSize(radiusInVoxels);
    return this;
  }

  setVerticalChunkRadius(verticalChunkRadius = null) {
    this.verticalChunkRadius = normalizeWorldOptionalChunkRadius(verticalChunkRadius);
    return this;
  }

  getChunkRadius(chunkSize = Boxel15.size) {
    return Math.ceil(this.radiusInVoxels / normalizeWorldAxisSize(chunkSize));
  }

  getCenterChunkPosition(world = null, center = null) {
    const fallbackCenter = center && typeof center === 'object'
      ? center
      : world?.spawnPosition ?? { x: 0, y: 0, z: 0 };
    const chunkSize = world?.getChunkSize?.() ?? Boxel15.size;
    const gridPosition = world instanceof World
      ? world.mapToGridPosition(
        Number(fallbackCenter.x) || 0,
        Number(fallbackCenter.y) || 0,
        Number(fallbackCenter.z) || 0,
        1
      )
      : {
        x: Number(fallbackCenter.x) || 0,
        y: Number(fallbackCenter.y) || 0,
        z: Number(fallbackCenter.z) || 0,
      };

    return {
      x: Math.floor(gridPosition.x / chunkSize),
      y: Math.floor(gridPosition.y / chunkSize),
      z: Math.floor(gridPosition.z / chunkSize),
    };
  }

  getActiveChunkPositions(world = null, center = null) {
    const centerChunk = this.getCenterChunkPosition(world, center);
    const chunkRadius = this.getChunkRadius(world?.getChunkSize?.() ?? Boxel15.size);
    const verticalChunkRadius = Number.isInteger(this.verticalChunkRadius)
      ? this.verticalChunkRadius
      : chunkRadius;
    const activeChunkPositions = [];

    for (let x = centerChunk.x - chunkRadius; x <= centerChunk.x + chunkRadius; x += 1) {
      for (let y = centerChunk.y - verticalChunkRadius; y <= centerChunk.y + verticalChunkRadius; y += 1) {
        for (let z = centerChunk.z - chunkRadius; z <= centerChunk.z + chunkRadius; z += 1) {
          if (world instanceof World && !world.isChunkPositionWithinWorld(x, y, z)) continue;
          activeChunkPositions.push({ x, y, z });
        }
      }
    }

    return activeChunkPositions;
  }

  getActiveChunkKeys(world = null, center = null) {
    const activeChunkPositions = this.getActiveChunkPositions(world, center);
    if (!(world instanceof World)) {
      return activeChunkPositions.map(position => createVoxelKey(position.x, position.y, position.z));
    }

    return activeChunkPositions.map(position => world.getChunkKey(position.x, position.y, position.z));
  }

  toJSON() {
    return {
      radiusInVoxels: this.radiusInVoxels,
      verticalChunkRadius: this.verticalChunkRadius,
    };
  }
}

export class World {
  constructor({
    name = 'Default World',
    size = { x: 100, y: 100, z: 100 },
    land = { x: 1, y: 1, z: 1 },
    spawnPosition = { x: 0, y: 0, z: 0 },
    boxel15DistanceRendering = null,
    voxelTypes = null,
    entities = null,
    chunkBoxel = null,
    chunkGenerator = null,
    boxels = null,
    voxels = null,
  } = {}) {
    // World is the top container layer for placed Boxels in world space.
    this.name = normalizeText(name, '');
    this.size = normalizeWorldSize(size);
    this.land = normalizeWorldSize(land);
    this.spawnPosition = normalizeWorldPosition(spawnPosition);
    this.boxel15DistanceRendering = normalizeWorldBoxel15DistanceRendering(boxel15DistanceRendering);
    this.entities = createDefaultWorldEntities();
    this.chunkBoxel = normalizeWorldChunkBoxel(chunkBoxel);
    this.boxels = [];
    this.voxelTypes = new Map();
    this.voxelBoxels = new Map();
    this.generatedChunkKeys = new Set();
    this.chunkGenerator = typeof chunkGenerator === 'function' ? chunkGenerator : null;
    this.activeChunkKeys = new Set();
    this.activeChunkCenterKey = '';
    this.updateActiveChunks(this.spawnPosition);

    if (voxelTypes instanceof Map || Array.isArray(voxelTypes)) {
      this.setVoxelTypes(voxelTypes);
    }

    if (Array.isArray(entities)) {
      this.setEntities(entities);
    }

    if (Array.isArray(boxels)) {
      this.setBoxels(boxels);
    }

    if (voxels instanceof Map || Array.isArray(voxels)) {
      this.setVoxels(voxels);
    }
  }

  setName(name = '') {
    this.name = normalizeText(name, '');
    return this;
  }

  setSize(size = { x: 100, y: 100, z: 100 }) {
    this.size = normalizeWorldSize(size);
    return this;
  }

  setLand(land = { x: 1, y: 1, z: 1 }) {
    this.land = normalizeWorldSize(land);
    return this;
  }

  setSpawnPosition(position = { x: 0, y: 0, z: 0 }) {
    this.spawnPosition = normalizeWorldPosition(position);
    if (this.activeChunkKeys instanceof Set) {
      this.updateActiveChunks(this.spawnPosition);
    }
    return this;
  }

  setBoxel15DistanceRendering(boxel15DistanceRendering = null) {
    this.boxel15DistanceRendering = normalizeWorldBoxel15DistanceRendering(boxel15DistanceRendering);
    if (this.activeChunkKeys instanceof Set) {
      this.updateActiveChunks(this.spawnPosition);
    }
    return this;
  }

  setChunkBoxel(chunkBoxel = null) {
    this.chunkBoxel = normalizeWorldChunkBoxel(chunkBoxel);
    return this;
  }

  setChunkGenerator(chunkGenerator = null) {
    this.chunkGenerator = typeof chunkGenerator === 'function' ? chunkGenerator : null;
    this.generatedChunkKeys = new Set();

    return this;
  }

  setVoxelTypes(voxelTypes = null) {
    this.voxelTypes = new Map();

    if (voxelTypes instanceof Map) {
      for (const [, voxel] of voxelTypes.entries()) {
        this.registerVoxelType(voxel);
      }
      return this;
    }

    if (Array.isArray(voxelTypes)) {
      for (let i = 0; i < voxelTypes.length; i += 1) {
        this.registerVoxelType(voxelTypes[i]?.voxel ?? voxelTypes[i]);
      }
    }

    return this;
  }

  registerVoxelType(voxel = null) {
    const normalizedVoxel = normalizeWorldVoxel(voxel);
    const voxelName = normalizeText(normalizedVoxel?.name, '');
    if (!voxelName) return this;

    this.voxelTypes.set(voxelName, normalizedVoxel);
    return this;
  }

  getVoxelTypes() {
    return Array.from(this.voxelTypes.values()).map(voxel => voxel.clone());
  }

  setEntities(entitiesArray = []) {
    this.entities = Array.isArray(entitiesArray)
      ? entitiesArray.map(entity => normalizeWorldEntitySpec(entity))
      : createDefaultWorldEntities();
    return this;
  }

  addEntity(entity = {}) {
    this.entities.push(normalizeWorldEntitySpec(entity));
    return this;
  }

  getMapOrigin(unitSize = 1) {
    const normalizedUnitSize = toFiniteNumber(unitSize, 1);
    return {
      x: -this.size.x * normalizedUnitSize * 0.5,
      y: 0,
      z: -this.size.z * normalizedUnitSize * 0.5,
    };
  }

  gridToMapPosition(x = 0, y = 0, z = 0, unitSize = 1) {
    const position = normalizeWorldPosition({ x, y, z });
    const normalizedUnitSize = toFiniteNumber(unitSize, 1);
    const origin = this.getMapOrigin(normalizedUnitSize);

    return {
      x: origin.x + position.x * normalizedUnitSize,
      y: origin.y + position.y * normalizedUnitSize,
      z: origin.z + position.z * normalizedUnitSize,
    };
  }

  gridToMapCenterPosition(x = 0, y = 0, z = 0, unitSize = 1) {
    const basePosition = this.gridToMapPosition(x, y, z, unitSize);
    const normalizedUnitSize = toFiniteNumber(unitSize, 1);

    return {
      x: basePosition.x + normalizedUnitSize * 0.5,
      y: basePosition.y + normalizedUnitSize * 0.5,
      z: basePosition.z + normalizedUnitSize * 0.5,
    };
  }

  mapToGridPosition(x = 0, y = 0, z = 0, unitSize = 1) {
    const position = normalizeWorldPosition({ x, y, z });
    const normalizedUnitSize = toFiniteNumber(unitSize, 1);
    const origin = this.getMapOrigin(normalizedUnitSize);

    return {
      x: (position.x - origin.x) / normalizedUnitSize,
      y: (position.y - origin.y) / normalizedUnitSize,
      z: (position.z - origin.z) / normalizedUnitSize,
    };
  }

  getVoxelBox(x = 0, y = 0, z = 0, unitSize = 1, targetBox = null) {
    const position = normalizeWorldPosition({ x, y, z });
    const normalizedUnitSize = toFiniteNumber(unitSize, 1);
    const minPosition = this.gridToMapPosition(
      position.x,
      position.y,
      position.z,
      normalizedUnitSize
    );

    if (!targetBox?.min || !targetBox?.max) {
      return {
        min: {
          x: minPosition.x,
          y: minPosition.y,
          z: minPosition.z,
        },
        max: {
          x: minPosition.x + normalizedUnitSize,
          y: minPosition.y + normalizedUnitSize,
          z: minPosition.z + normalizedUnitSize,
        },
      };
    }

    targetBox.min.set(minPosition.x, minPosition.y, minPosition.z);
    targetBox.max.set(
      minPosition.x + normalizedUnitSize,
      minPosition.y + normalizedUnitSize,
      minPosition.z + normalizedUnitSize
    );
    return targetBox;
  }

  getVoxel(x = 0, y = 0, z = 0) {
    const position = normalizeWorldPosition({ x, y, z });
    const voxel = this.peekVoxel(position.x, position.y, position.z);
    return voxel?.active === true ? voxel.clone().setPosition(position.x, position.y, position.z) : null;
  }

  peekVoxel(x = 0, y = 0, z = 0) {
    const position = normalizeWorldPosition({ x, y, z });
    const voxelAddress = this.getChunkVoxelAddress(position.x, position.y, position.z);
    if (!voxelAddress) return null;

    const chunkEntry = this.getChunkEntry(
      voxelAddress.chunk.x,
      voxelAddress.chunk.y,
      voxelAddress.chunk.z
    );
    if (!chunkEntry) return null;

    const voxel = chunkEntry.boxel.get(
      voxelAddress.local.x,
      voxelAddress.local.y,
      voxelAddress.local.z
    );

    return voxel?.active === true ? voxel : null;
  }

  setVoxel(x = 0, y = 0, z = 0, voxel = null) {
    const position = normalizeWorldPosition({ x, y, z });
    const normalizedVoxel = normalizeWorldVoxel(voxel, position);
    this.assertVoxelPositionWithinWorld(position);
    this.registerVoxelType(normalizedVoxel);

    const voxelAddress = this.getChunkVoxelAddress(position.x, position.y, position.z);
    const chunkEntry = this.ensureChunkEntry(
      voxelAddress.chunk.x,
      voxelAddress.chunk.y,
      voxelAddress.chunk.z
    );

    chunkEntry.boxel.set(
      voxelAddress.local.x,
      voxelAddress.local.y,
      voxelAddress.local.z,
      normalizedVoxel
    );
    return this;
  }

  removeVoxel(x = 0, y = 0, z = 0) {
    const position = normalizeWorldPosition({ x, y, z });
    const voxelAddress = this.getChunkVoxelAddress(position.x, position.y, position.z);
    if (!voxelAddress) return false;

    const chunkKey = createVoxelKey(
      voxelAddress.chunk.x,
      voxelAddress.chunk.y,
      voxelAddress.chunk.z
    );
    const chunkEntry = this.voxelBoxels.get(chunkKey);
    if (!chunkEntry) return false;

    const currentVoxel = chunkEntry.boxel.get(
      voxelAddress.local.x,
      voxelAddress.local.y,
      voxelAddress.local.z
    );
    if (!currentVoxel?.active) return false;

    currentVoxel.active = false;

    if (chunkEntry.boxel.getVoxelEntries({ activeOnly: true }).length === 0) {
      this.voxelBoxels.delete(chunkKey);
    }

    return true;
  }

  hasVoxel(x = 0, y = 0, z = 0) {
    const position = normalizeWorldPosition({ x, y, z });
    return Boolean(this.peekVoxel(position.x, position.y, position.z));
  }

  clearVoxels() {
    this.voxelBoxels.clear();
    this.generatedChunkKeys.clear();
    return this;
  }

  setVoxels(voxels) {
    this.voxelBoxels = new Map();

    if (voxels instanceof Map) {
      for (const [key, voxel] of voxels.entries()) {
        const position = parseVoxelKey(key);
        if (!position) continue;
        this.setVoxel(position.x, position.y, position.z, voxel);
      }
      return this;
    }

    if (Array.isArray(voxels)) {
      for (let i = 0; i < voxels.length; i++) {
        const entry = voxels[i];
        const sourcePosition = entry?.position ?? entry;
        this.setVoxel(sourcePosition?.x, sourcePosition?.y, sourcePosition?.z, entry?.voxel ?? entry);
      }
    }

    return this;
  }

  getVoxelEntries({ activeChunksOnly = false } = {}) {
    const voxelEntries = [];

    if (activeChunksOnly) {
      for (const chunkKey of this.activeChunkKeys) {
        this.ensureGeneratedChunkKey(chunkKey);
      }
    }

    for (const chunkEntry of this.voxelBoxels.values()) {
      if (activeChunksOnly && !this.isChunkActive(chunkEntry.position.x, chunkEntry.position.y, chunkEntry.position.z)) {
        continue;
      }

      const chunkVoxelEntries = chunkEntry.boxel.getVoxelEntries({ activeOnly: true });

      for (let i = 0; i < chunkVoxelEntries.length; i += 1) {
        const chunkVoxelEntry = chunkVoxelEntries[i];
        const worldPosition = {
          x: chunkEntry.position.x * this.chunkBoxel.size + chunkVoxelEntry.position.x,
          y: chunkEntry.position.y * this.chunkBoxel.size + chunkVoxelEntry.position.y,
          z: chunkEntry.position.z * this.chunkBoxel.size + chunkVoxelEntry.position.z,
        };

        voxelEntries.push({
          position: worldPosition,
          voxel: chunkVoxelEntry.voxel.clone().setPosition(
            worldPosition.x,
            worldPosition.y,
            worldPosition.z
          ),
        });
      }
    }

    return voxelEntries;
  }

  getChunkSize() {
    return this.chunkBoxel.size;
  }

  getChunkCounts() {
    const chunkSize = this.getChunkSize();
    return {
      x: Math.ceil(this.size.x / chunkSize),
      y: Math.ceil(this.size.y / chunkSize),
      z: Math.ceil(this.size.z / chunkSize),
    };
  }

  getChunkKey(chunkX = 0, chunkY = 0, chunkZ = 0) {
    return createVoxelKey(chunkX, chunkY, chunkZ);
  }

  parseChunkKey(chunkKey = '') {
    return parseVoxelKey(chunkKey);
  }

  isChunkPositionWithinWorld(chunkX = 0, chunkY = 0, chunkZ = 0) {
    const chunkCounts = this.getChunkCounts();

    return (
      chunkX >= 0 && chunkX < chunkCounts.x
      && chunkY >= 0 && chunkY < chunkCounts.y
      && chunkZ >= 0 && chunkZ < chunkCounts.z
    );
  }

  getChunkVoxelAddress(x = 0, y = 0, z = 0) {
    const position = normalizeWorldPosition({ x, y, z });
    const chunkSize = this.getChunkSize();

    return {
      chunk: {
        x: Math.floor(position.x / chunkSize),
        y: Math.floor(position.y / chunkSize),
        z: Math.floor(position.z / chunkSize),
      },
      local: {
        x: position.x % chunkSize,
        y: position.y % chunkSize,
        z: position.z % chunkSize,
      },
    };
  }

  getChunkEntry(chunkX = 0, chunkY = 0, chunkZ = 0) {
    const chunkKey = this.getChunkKey(chunkX, chunkY, chunkZ);
    this.ensureGeneratedChunkKey(chunkKey);
    return this.voxelBoxels.get(chunkKey) ?? null;
  }

  ensureChunkEntry(chunkX = 0, chunkY = 0, chunkZ = 0) {
    const chunkKey = this.getChunkKey(chunkX, chunkY, chunkZ);
    const existingChunkEntry = this.voxelBoxels.get(chunkKey);
    if (existingChunkEntry) return existingChunkEntry;

    const nextChunkEntry = {
      position: { x: chunkX, y: chunkY, z: chunkZ },
      boxel: this.chunkBoxel.clone(),
    };

    this.voxelBoxels.set(chunkKey, nextChunkEntry);
    return nextChunkEntry;
  }

  getChunkEntries() {
    return Array.from(this.voxelBoxels.values()).map(entry => ({
      position: { ...entry.position },
      boxel: entry.boxel.clone(),
    }));
  }

  getActiveChunkKeys() {
    return Array.from(this.activeChunkKeys);
  }

  isChunkActive(chunkX = 0, chunkY = 0, chunkZ = 0) {
    return this.activeChunkKeys.has(this.getChunkKey(chunkX, chunkY, chunkZ));
  }

  isVoxelCellActive(cellX = 0, cellY = 0, cellZ = 0) {
    const voxelAddress = this.getChunkVoxelAddress(cellX, cellY, cellZ);
    return this.isChunkActive(
      voxelAddress.chunk.x,
      voxelAddress.chunk.y,
      voxelAddress.chunk.z
    );
  }

  updateActiveChunks(center = null) {
    const normalizedCenter = normalizeWorldPosition(center ?? this.spawnPosition);
    const centerChunkPosition = this.boxel15DistanceRendering.getCenterChunkPosition(this, normalizedCenter);
    const nextCenterChunkKey = this.getChunkKey(
      centerChunkPosition.x,
      centerChunkPosition.y,
      centerChunkPosition.z
    );
    const nextActiveChunkKeys = new Set(
      this.boxel15DistanceRendering.getActiveChunkKeys(this, normalizedCenter)
    );

    if (
      nextCenterChunkKey === this.activeChunkCenterKey
      && areWorldChunkKeySetsEqual(this.activeChunkKeys, nextActiveChunkKeys)
    ) {
      return {
        center: normalizedCenter,
        active: this.getActiveChunkKeys(),
        added: [],
        removed: [],
      };
    }
    const added = [];
    const removed = [];

    for (const chunkKey of nextActiveChunkKeys) {
      if (!this.activeChunkKeys.has(chunkKey)) {
        added.push(chunkKey);
      }
    }

    for (const chunkKey of this.activeChunkKeys) {
      if (!nextActiveChunkKeys.has(chunkKey)) {
        removed.push(chunkKey);
      }
    }

    this.activeChunkKeys = nextActiveChunkKeys;
    this.activeChunkCenterKey = nextCenterChunkKey;

    return {
      center: normalizedCenter,
      active: this.getActiveChunkKeys(),
      added,
      removed,
    };
  }

  get(index) {
    return this.boxels[index] ?? null;
  }

  add(boxel, position = {}) {
    const placedBoxel = normalizePlacedBoxel(boxel, position);
    this.boxels.push(placedBoxel);
    return this;
  }

  set(index, boxel, position = {}) {
    const normalizedIndex = Math.max(0, Math.floor(Number(index) || 0));
    this.boxels[normalizedIndex] = normalizePlacedBoxel(boxel, position);
    return this;
  }

  remove(index) {
    const normalizedIndex = Math.max(0, Math.floor(Number(index) || 0));
    this.boxels.splice(normalizedIndex, 1);
    return this;
  }

  clear() {
    this.boxels = [];
    return this;
  }

  setBoxels(boxelsArray) {
    this.boxels = Array.isArray(boxelsArray)
      ? boxelsArray.map(entry => normalizePlacedBoxel(entry?.boxel ?? entry, entry?.position ?? entry))
      : [];

    return this;
  }

  toJSON() {
    return {
      name: this.name,
      size: {
        x: this.size.x,
        y: this.size.y,
        z: this.size.z,
      },
      land: {
        x: this.land.x,
        y: this.land.y,
        z: this.land.z,
      },
      spawnPosition: {
        x: this.spawnPosition.x,
        y: this.spawnPosition.y,
        z: this.spawnPosition.z,
      },
      boxel15DistanceRendering: this.boxel15DistanceRendering.toJSON(),
      chunkBoxel: serializeChunkBoxel(this.chunkBoxel),
      voxelTypes: this.getVoxelTypes().map(voxel => voxel.toJSON()),
      entities: this.entities.map(entity => cloneWorldEntityValue(entity)),
      voxels: this.getVoxelEntries().map(entry => ({
        position: {
          x: entry.position.x,
          y: entry.position.y,
          z: entry.position.z,
        },
        voxel: entry.voxel.toJSON(),
      })),
      boxels: this.boxels.map(entry => ({
        position: {
          x: entry.position.x,
          y: entry.position.y,
          z: entry.position.z,
        },
        boxel: entry.boxel.toJSON(),
      })),
    };
  }

  toSnapshot() {
    const worldJson = this.toJSON();
    const voxelPalette = [];
    const voxelPaletteByKey = new Map();
    const encodedVoxels = [];
    const voxelEntries = Array.isArray(worldJson.voxels) ? worldJson.voxels : [];

    for (let i = 0; i < voxelEntries.length; i += 1) {
      const voxelEntry = voxelEntries[i];
      const position = normalizeSnapshotVoxelPosition(voxelEntry?.position ?? voxelEntry);
      const voxel = cloneSnapshotVoxelDefinition(voxelEntry?.voxel ?? voxelEntry);
      if (!position || !voxel) continue;

      const voxelKey = JSON.stringify(voxel);
      let paletteIndex = voxelPaletteByKey.get(voxelKey);
      if (!Number.isInteger(paletteIndex)) {
        paletteIndex = voxelPalette.length;
        voxelPaletteByKey.set(voxelKey, paletteIndex);
        voxelPalette.push(voxel);
      }

      encodedVoxels.push([position.x, position.y, position.z, paletteIndex]);
    }

    return {
      format: WORLD_SNAPSHOT_FORMAT,
      version: WORLD_SNAPSHOT_VERSION,
      name: worldJson.name,
      size: cloneSnapshotValue(worldJson.size) ?? null,
      land: cloneSnapshotValue(worldJson.land) ?? null,
      spawnPosition: cloneSnapshotValue(worldJson.spawnPosition) ?? null,
      voxelTypes: cloneSnapshotValue(worldJson.voxelTypes) ?? [],
      entities: cloneSnapshotValue(worldJson.entities) ?? [],
      boxels: cloneSnapshotValue(worldJson.boxels) ?? [],
      voxelPalette,
      voxels: encodedVoxels,
    };
  }

  fromJSON(data = {}) {
    if ('name' in data) {
      this.setName(data.name);
    }

    if ('size' in data) {
      this.setSize(data.size);
    }

    if ('land' in data) {
      this.setLand(data.land);
    }

    if ('spawnPosition' in data) {
      this.setSpawnPosition(data.spawnPosition);
    }

    if ('boxel15DistanceRendering' in data) {
      this.setBoxel15DistanceRendering(data.boxel15DistanceRendering);
    }

    if ('chunkBoxel' in data) {
      this.setChunkBoxel(data.chunkBoxel);
    }

    if (data?.voxelTypes instanceof Map || Array.isArray(data?.voxelTypes)) {
      this.setVoxelTypes(data.voxelTypes);
    }

    if (Array.isArray(data?.entities)) {
      this.setEntities(data.entities);
    }

    if (data?.voxels instanceof Map || Array.isArray(data?.voxels)) {
      this.setVoxels(data.voxels);
    }

    if (Array.isArray(data?.boxels)) {
      this.setBoxels(data.boxels);
    }

    return this;
  }

  fromSnapshot(snapshot = {}) {
    const normalizedSnapshot = cloneSnapshotValue(snapshot);
    if (!normalizedSnapshot || typeof normalizedSnapshot !== 'object') {
      return this;
    }

    if (normalizedSnapshot.format !== WORLD_SNAPSHOT_FORMAT) {
      return this.fromJSON(normalizedSnapshot);
    }

    const voxelPalette = Array.isArray(normalizedSnapshot.voxelPalette)
      ? normalizedSnapshot.voxelPalette
      : [];
    const encodedVoxels = Array.isArray(normalizedSnapshot.voxels)
      ? normalizedSnapshot.voxels
      : [];

    const nextWorldData = {
      name: typeof normalizedSnapshot.name === 'string' ? normalizedSnapshot.name : '',
      size: cloneSnapshotValue(normalizedSnapshot.size) ?? null,
      land: cloneSnapshotValue(normalizedSnapshot.land) ?? null,
      spawnPosition: cloneSnapshotValue(normalizedSnapshot.spawnPosition) ?? null,
      entities: cloneSnapshotValue(normalizedSnapshot.entities) ?? [],
      boxels: cloneSnapshotValue(normalizedSnapshot.boxels) ?? [],
      voxels: encodedVoxels.map(entry => {
        const position = normalizeSnapshotVoxelPosition({
          x: entry?.[0],
          y: entry?.[1],
          z: entry?.[2],
        });
        const voxel = cloneSnapshotVoxelDefinition(voxelPalette[entry?.[3]]);
        if (!position || !voxel) return null;

        return {
          position,
          voxel,
        };
      }).filter(Boolean),
    };

    /* Legacy snapshots may not include the authored voxel catalog yet. In that
    case we keep the preset world catalog instead of collapsing the world to
    only the voxel types currently placed in the save payload. */
    if (Array.isArray(normalizedSnapshot.voxelTypes)) {
      nextWorldData.voxelTypes = cloneSnapshotValue(normalizedSnapshot.voxelTypes) ?? [];
    }

    return this.fromJSON(nextWorldData);
  }

  clone() {
    const clonedWorld = new World({
      name: this.name,
      size: this.size,
      land: this.land,
      spawnPosition: this.spawnPosition,
      boxel15DistanceRendering: this.boxel15DistanceRendering,
      chunkBoxel: this.chunkBoxel,
      voxelTypes: this.getVoxelTypes(),
      entities: this.entities,
      boxels: this.boxels,
      voxels: this.getVoxelEntries(),
    });

    if (typeof this.chunkGenerator === 'function') {
      clonedWorld.setChunkGenerator(this.chunkGenerator);
    }

    return clonedWorld;
  }

  ensureGeneratedChunkKey(chunkKey = '') {
    if (typeof chunkKey !== 'string' || !chunkKey.trim()) {
      return null;
    }

    if (this.generatedChunkKeys.has(chunkKey)) {
      return this.voxelBoxels.get(chunkKey) ?? null;
    }

    this.generatedChunkKeys.add(chunkKey);
    if (typeof this.chunkGenerator !== 'function') {
      return this.voxelBoxels.get(chunkKey) ?? null;
    }

    const chunkPosition = this.parseChunkKey(chunkKey);
    if (!chunkPosition || !this.isChunkPositionWithinWorld(chunkPosition.x, chunkPosition.y, chunkPosition.z)) {
      return null;
    }

    const generatedChunk = this.chunkGenerator({
      world: this,
      chunkPosition: {
        x: chunkPosition.x,
        y: chunkPosition.y,
        z: chunkPosition.z,
      },
      chunkSize: this.getChunkSize(),
    });

    if (!generatedChunk) {
      return null;
    }

    if (generatedChunk instanceof Boxel) {
      const nextChunkEntry = {
        position: { ...chunkPosition },
        boxel: generatedChunk.clone(),
      };
      this.voxelBoxels.set(chunkKey, nextChunkEntry);
      return nextChunkEntry;
    }

    const voxelEntries = Array.isArray(generatedChunk?.voxels)
      ? generatedChunk.voxels
      : Array.isArray(generatedChunk)
        ? generatedChunk
        : null;
    if (!voxelEntries || voxelEntries.length === 0) {
      return null;
    }

    const nextChunkEntry = {
      position: { ...chunkPosition },
      boxel: this.chunkBoxel.clone(),
    };

    for (let i = 0; i < voxelEntries.length; i += 1) {
      const entry = voxelEntries[i];
      const localPosition = normalizeGeneratedChunkVoxelPosition(entry?.position ?? entry);
      if (!localPosition) continue;

      try {
        nextChunkEntry.boxel.set(
          localPosition.x,
          localPosition.y,
          localPosition.z,
          normalizeWorldVoxel(entry?.voxel ?? entry, localPosition)
        );
      } catch {
        continue;
      }
    }

    if (nextChunkEntry.boxel.getVoxelEntries({ activeOnly: true }).length === 0) {
      return null;
    }

    this.voxelBoxels.set(chunkKey, nextChunkEntry);
    return nextChunkEntry;
  }

  assertVoxelPositionWithinWorld(position = {}) {
    if (
      position.x < 0 || position.x >= this.size.x
      || position.y < 0 || position.y >= this.size.y
      || position.z < 0 || position.z >= this.size.z
    ) {
      throw new Error(`Voxel position ${position.x},${position.y},${position.z} is outside world bounds.`);
    }

    return this;
  }
}

function normalizePlacedBoxel(boxel, position = {}) {
  const normalizedBoxel = boxel instanceof Boxel
    ? boxel.clone()
    : new Boxel({
      size: Number(boxel?.size) || undefined,
    }).fromJSON(boxel ?? {});

  return {
    position: {
      x: toFiniteNumber(position?.x, 0),
      y: toFiniteNumber(position?.y, 0),
      z: toFiniteNumber(position?.z, 0),
    },
    boxel: normalizedBoxel,
  };
}

function normalizeWorldChunkBoxel(chunkBoxel = null) {
  return new Boxel({
    name: 'Boxel15',
    size: Boxel15.size,
    active: chunkBoxel?.active ?? true,
  }).resetVoxels(false);
}

function normalizeWorldBoxel15DistanceRendering(boxel15DistanceRendering = null) {
  if (boxel15DistanceRendering instanceof Boxel15DistanceRendering) {
    return new Boxel15DistanceRendering(boxel15DistanceRendering.toJSON());
  }

  return new Boxel15DistanceRendering(boxel15DistanceRendering ?? {});
}

function normalizeWorldOptionalChunkRadius(value = null) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalizedValue = Math.floor(Number(value));
  return Number.isFinite(normalizedValue) && normalizedValue >= 0
    ? normalizedValue
    : null;
}

function areWorldChunkKeySetsEqual(leftSet = null, rightSet = null) {
  if (!(leftSet instanceof Set) || !(rightSet instanceof Set)) {
    return false;
  }

  if (leftSet.size !== rightSet.size) {
    return false;
  }

  for (const value of leftSet) {
    if (!rightSet.has(value)) {
      return false;
    }
  }

  return true;
}

function serializeChunkBoxel(chunkBoxel = null) {
  return {
    name: 'Boxel15',
    size: Boxel15.size,
    active: chunkBoxel?.active ?? true,
  };
}

function cloneSnapshotValue(value = null) {
  if (value === null || value === undefined) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function normalizeSnapshotVoxelPosition(position = null) {
  if (!position || typeof position !== 'object') return null;

  const x = Number(position.x);
  const y = Number(position.y);
  const z = Number(position.z);
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
    return null;
  }

  return { x, y, z };
}

function normalizeGeneratedChunkVoxelPosition(position = null) {
  if (!position || typeof position !== 'object') return null;

  const x = Math.floor(Number(position.x));
  const y = Math.floor(Number(position.y));
  const z = Math.floor(Number(position.z));
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }

  return { x, y, z };
}

function cloneSnapshotVoxelDefinition(voxel = null) {
  if (!voxel || typeof voxel !== 'object') return null;

  const clonedVoxel = {};
  if (typeof voxel.shape === 'string' && voxel.shape.trim()) clonedVoxel.shape = voxel.shape.trim();
  if (typeof voxel.contentType === 'string' && voxel.contentType.trim()) clonedVoxel.contentType = voxel.contentType.trim();
  if (typeof voxel.name === 'string' && voxel.name.trim()) clonedVoxel.name = voxel.name.trim();
  if (voxel.rotation && typeof voxel.rotation === 'object' && !Array.isArray(voxel.rotation)) {
    clonedVoxel.rotation = cloneSnapshotValue(voxel.rotation);
  }
  if (typeof voxel.type === 'string' && voxel.type.trim()) clonedVoxel.type = voxel.type.trim();
  if (typeof voxel.color === 'string' && voxel.color.trim()) clonedVoxel.color = voxel.color.trim();
  if (typeof voxel.texture === 'string' && voxel.texture.trim()) clonedVoxel.texture = voxel.texture.trim();
  if (voxel.texture && typeof voxel.texture === 'object' && !Array.isArray(voxel.texture)) {
    clonedVoxel.texture = cloneSnapshotValue(voxel.texture);
  }
  if (Number.isFinite(voxel.textureInfluence)) clonedVoxel.textureInfluence = Number(voxel.textureInfluence);
  if (typeof voxel.transparent === 'boolean') clonedVoxel.transparent = voxel.transparent;
  if (typeof voxel.active === 'boolean') clonedVoxel.active = voxel.active;
  if (typeof voxel.planeFace === 'string' && voxel.planeFace.trim()) clonedVoxel.planeFace = voxel.planeFace.trim();
  if (typeof voxel.doubleSided === 'boolean') clonedVoxel.doubleSided = voxel.doubleSided;
  if (Number.isFinite(voxel.inset)) clonedVoxel.inset = Number(voxel.inset);
  if (typeof voxel.text === 'string' && voxel.text.trim()) clonedVoxel.text = voxel.text.trim();
  if (typeof voxel.fontFamily === 'string' && voxel.fontFamily.trim()) clonedVoxel.fontFamily = voxel.fontFamily.trim();
  if (typeof voxel.fontSize === 'string' && voxel.fontSize.trim()) clonedVoxel.fontSize = voxel.fontSize.trim();
  if (typeof voxel.textColor === 'string' && voxel.textColor.trim()) clonedVoxel.textColor = voxel.textColor.trim();
  if (typeof voxel.backgroundColor === 'string' && voxel.backgroundColor.trim()) clonedVoxel.backgroundColor = voxel.backgroundColor.trim();
  if (typeof voxel.horizontalAlign === 'string' && voxel.horizontalAlign.trim()) clonedVoxel.horizontalAlign = voxel.horizontalAlign.trim();
  if (typeof voxel.verticalAlign === 'string' && voxel.verticalAlign.trim()) clonedVoxel.verticalAlign = voxel.verticalAlign.trim();
  if (Number.isFinite(voxel.padding)) clonedVoxel.padding = Number(voxel.padding);
  if (Number.isFinite(voxel.microxelSize) && voxel.microxelSize > 0) clonedVoxel.microxelSize = Number(voxel.microxelSize);
  if (Array.isArray(voxel.microxels) && voxel.microxels.length > 0) {
    clonedVoxel.microxels = cloneSnapshotValue(voxel.microxels);
  }

  return Object.keys(clonedVoxel).length > 0 ? clonedVoxel : null;
}

function normalizeWorldVoxel(voxel, position = {}) {
  const normalizedVoxel = voxel instanceof Voxel
    ? voxel.clone()
    : isVoxelPlaneTextData(voxel)
      ? new VoxelPlaneText().fromJSON(voxel ?? {})
    : isVoxelPlaneData(voxel)
      ? new VoxelPlane().fromJSON(voxel ?? {})
      : new Voxel().fromJSON(voxel ?? {});

  normalizedVoxel.setPosition(position.x, position.y, position.z);
  return normalizedVoxel;
}

function isVoxelPlaneTextData(voxel = null) {
  return voxel instanceof VoxelPlaneText || voxel?.contentType === 'text';
}

function isVoxelPlaneData(voxel = null) {
  return voxel instanceof VoxelPlane || voxel?.shape === 'plane';
}

function normalizeWorldEntitySpec(entity = {}) {
  const normalizedEntity = cloneWorldEntityValue(entity);
  return normalizedEntity && typeof normalizedEntity === 'object'
    ? normalizedEntity
    : {};
}

function createDefaultWorldEntities() {
  return [
    {
      kind: 'item',
      appearanceType: 'spawn-point',
      itemId: 'spawn-point',
      positionMode: 'spawn-relative',
      position: { x: 0, y: 2, z: 0 },
      groundYMode: 'position',
      runtime: 'all',
    },
  ];
}

function cloneWorldEntityValue(value) {
  if (Array.isArray(value)) {
    return value.map(entry => cloneWorldEntityValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, cloneWorldEntityValue(entryValue)])
    );
  }

  return value;
}

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeWorldSize(size = {}) {
  return {
    x: normalizeWorldAxisSize(size?.x),
    y: normalizeWorldAxisSize(size?.y),
    z: normalizeWorldAxisSize(size?.z),
  };
}

function normalizeWorldPosition(position = {}) {
  return {
    x: toFiniteNumber(position?.x, 0),
    y: toFiniteNumber(position?.y, 0),
    z: toFiniteNumber(position?.z, 0),
  };
}

function createVoxelKey(x = 0, y = 0, z = 0) {
  return `${x}|${y}|${z}`;
}

function parseVoxelKey(key) {
  const parts = String(key).split('|');
  if (parts.length !== 3) {
    return null;
  }

  const x = toFiniteNumber(parts[0], NaN);
  const y = toFiniteNumber(parts[1], NaN);
  const z = toFiniteNumber(parts[2], NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }

  return { x, y, z };
}

function normalizeWorldAxisSize(value) {
  const numericValue = Math.floor(Number(value));
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 1;
}
