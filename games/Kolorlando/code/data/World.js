import { Boxel } from './Boxel.js';
import { Voxel } from './Voxel.js';

export const Boxel10 = new Boxel({
  name: 'Boxel10',
  size: 10,
});

export class World {
  constructor({
    name = 'Default World',
    size = { x: 100, y: 100, z: 100 },
    land = { x: 1, y: 1, z: 1 },
    spawnPosition = { x: 0, y: 0, z: 0 },
    entities = null,
    boxels = null,
    voxels = null,
  } = {}) {
    // World is the top container layer for placed Boxels in world space.
    this.name = normalizeText(name, '');
    this.size = normalizeWorldSize(size);
    this.land = normalizeWorldSize(land);
    this.spawnPosition = normalizeWorldPosition(spawnPosition);
    this.entities = createDefaultWorldEntities();
    this.boxels = [];
    this.voxels = new Map();

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
    return this;
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
    return this.voxels.get(createVoxelKey(position.x, position.y, position.z)) ?? null;
  }

  setVoxel(x = 0, y = 0, z = 0, voxel = null) {
    const position = normalizeWorldPosition({ x, y, z });
    const normalizedVoxel = normalizeWorldVoxel(voxel, position);
    this.assertVoxelPositionWithinWorld(position);
    this.voxels.set(createVoxelKey(position.x, position.y, position.z), normalizedVoxel);
    return this;
  }

  removeVoxel(x = 0, y = 0, z = 0) {
    const position = normalizeWorldPosition({ x, y, z });
    return this.voxels.delete(createVoxelKey(position.x, position.y, position.z));
  }

  hasVoxel(x = 0, y = 0, z = 0) {
    const position = normalizeWorldPosition({ x, y, z });
    return this.voxels.has(createVoxelKey(position.x, position.y, position.z));
  }

  clearVoxels() {
    this.voxels.clear();
    return this;
  }

  setVoxels(voxels) {
    this.voxels = new Map();

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

  getVoxelEntries() {
    return Array.from(this.voxels.entries()).map(([key, voxel]) => ({
      position: parseVoxelKey(key),
      voxel: voxel.clone(),
    }));
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

  clone() {
    return new World({
      name: this.name,
      size: this.size,
      land: this.land,
      spawnPosition: this.spawnPosition,
      entities: this.entities,
      boxels: this.boxels,
      voxels: this.voxels,
    });
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
    : new Boxel().fromJSON(boxel ?? {});

  return {
    position: {
      x: toFiniteNumber(position?.x, 0),
      y: toFiniteNumber(position?.y, 0),
      z: toFiniteNumber(position?.z, 0),
    },
    boxel: normalizedBoxel,
  };
}

function normalizeWorldVoxel(voxel, position = {}) {
  const normalizedVoxel = voxel instanceof Voxel
    ? voxel.clone()
    : new Voxel().fromJSON(voxel ?? {});

  normalizedVoxel.setPosition(position.x, position.y, position.z);
  return normalizedVoxel;
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
