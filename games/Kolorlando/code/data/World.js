import { Boxel } from './Boxel.js';
import { Voxel, VoxelPlane, VoxelPlaneText } from './Voxel.js';

export const Boxel10 = new Boxel({
  name: 'Boxel10',
  size: 10,
});

const WORLD_SNAPSHOT_FORMAT = 'kolorlando.worldSnapshot.compact';
const WORLD_SNAPSHOT_VERSION = 1;

export class World {
  constructor({
    name = 'Default World',
    size = { x: 100, y: 100, z: 100 },
    land = { x: 1, y: 1, z: 1 },
    spawnPosition = { x: 0, y: 0, z: 0 },
    voxelTypes = null,
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
    this.voxelTypes = new Map();
    this.voxels = new Map();

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
    return this.voxels.get(createVoxelKey(position.x, position.y, position.z)) ?? null;
  }

  setVoxel(x = 0, y = 0, z = 0, voxel = null) {
    const position = normalizeWorldPosition({ x, y, z });
    const normalizedVoxel = normalizeWorldVoxel(voxel, position);
    this.assertVoxelPositionWithinWorld(position);
    this.registerVoxelType(normalizedVoxel);
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
    return new World({
      name: this.name,
      size: this.size,
      land: this.land,
      spawnPosition: this.spawnPosition,
      voxelTypes: this.getVoxelTypes(),
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
