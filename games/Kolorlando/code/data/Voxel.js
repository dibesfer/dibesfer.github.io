import { Microxel } from './Microxel.js';
import { VoxelPresets } from './VoxelPresets.js';

export class Voxel {
  constructor({
    x = 0,
    y = 0,
    z = 0,
    type = 'colored',
    color = '#ffffff',
    texture = null,
    active = true,
    microxelSize = 0,
    microxels = null,
    name = 'Default Voxel',
  } = {}) {
    // Shared Voxel stays compatible with simple cell mode and composed mode.
    this.x = toFiniteNumber(x, 0);
    this.y = toFiniteNumber(y, 0);
    this.z = toFiniteNumber(z, 0);
    this.position = [this.x, this.y, this.z];
    this.type = normalizeVoxelType(type);
    this.color = normalizeText(color, '#ffffff');
    this.texture = normalizeText(texture, '');
    this.active = Boolean(active);
    this.name = normalizeText(name, '');
    this.microxelSize = normalizeGridSize(microxelSize);
    this.microxels = null;

    if (Array.isArray(microxels)) {
      this.setMicroxels(microxels);
    } else if (this.microxelSize > 0) {
      this.initializeMicroxels(this.microxelSize);
    }
  }

  setPosition(x = 0, y = 0, z = 0) {
    this.x = toFiniteNumber(x, 0);
    this.y = toFiniteNumber(y, 0);
    this.z = toFiniteNumber(z, 0);
    this.position = [this.x, this.y, this.z];
    return this;
  }

  setName(name = '') {
    this.name = normalizeText(name, '');
    return this;
  }

  setColor(color = '#ffffff') {
    this.type = 'colored';
    this.color = normalizeText(color, this.color || '#ffffff');
    return this;
  }

  setTexture(texture = '') {
    this.type = 'textured';
    this.texture = normalizeText(texture, '');
    return this;
  }

  initializeMicroxels(size = 7, presetName = 'full') {
    const normalizedSize = normalizeGridSize(size);
    if (!normalizedSize) {
      this.microxels = null;
      this.microxelSize = 0;
      return this;
    }

    const presetData = VoxelPresets[presetName] ?? null;
    const nextData = presetData
      ? {
        ...presetData,
        microxelSize: normalizedSize,
        microxels: cloneMicroxelDataGrid(presetData.microxels, normalizedSize),
      }
      : {
        type: 'microxeled',
        microxelSize: normalizedSize,
        microxels: createEmptyMicroxelDataGrid(normalizedSize),
      };

    return this.fromJSON(nextData);
  }

  get(x, y, z) {
    return this.microxels?.[x]?.[y]?.[z] ?? null;
  }

  set(x, y, z, microxel) {
    if (!this.microxels) {
      throw new Error('Voxel has no microxel grid.');
    }

    if (!(microxel instanceof Microxel)) {
      throw new Error('setMicroxel expects a Microxel instance.');
    }

    if (!this.microxels?.[x]?.[y]) {
      throw new Error(`Invalid microxel position ${x},${y},${z}.`);
    }

    microxel.setPosition(x, y, z);
    this.microxels[x][y][z] = microxel;
    return this;
  }

  setMicroxels(microxelsArray) {
    if (!Array.isArray(microxelsArray) || microxelsArray.length === 0) {
      this.microxels = null;
      this.microxelSize = 0;
      return this;
    }

    const size = normalizeGridSize(microxelsArray.length);
    this.microxelSize = size;
    this.microxels = Array.from({ length: size }, (_, x) =>
      Array.from({ length: size }, (_, y) =>
        Array.from({ length: size }, (_, z) => {
          const sourceCell = microxelsArray?.[x]?.[y]?.[z];

          if (sourceCell instanceof Microxel) {
            return sourceCell.clone().setPosition(x, y, z);
          }

          return new Microxel({
            x,
            y,
            z,
            color: sourceCell?.color,
            active: sourceCell?.active,
          });
        })
      )
    );

    this.color = '#ffffff';
    this.type = 'microxeled';
    return this;
  }

  clearMicroxels() {
    this.microxels = null;
    this.microxelSize = 0;
    return this;
  }

  getType() {
    return this.type;
  }

  destroy() {
    this.active = false;
    return this;
  }

  revive() {
    this.active = true;
    return this;
  }

  clone() {
    return new Voxel({
      x: this.x,
      y: this.y,
      z: this.z,
      color: this.color,
      texture: this.texture,
      active: this.active,
      microxelSize: this.microxelSize,
      microxels: this.microxels ? cloneMicroxelGrid(this.microxels) : null,
      name: this.name,
    });
  }

  toJSON() {
    return {
      name: this.name,
      position: {
        x: this.x,
        y: this.y,
        z: this.z,
      },
      type: this.type,
      color: this.color,
      texture: this.texture || null,
      active: this.active,
      microxelSize: this.microxelSize,
      microxels: this.microxels
        ? this.microxels.map(plane =>
          plane.map(row =>
            row.map(cell => ({
              color: cell.color,
              active: cell.active,
            }))
          )
        )
        : null,
    };
  }

  fromJSON(data = {}) {
    if (data?.position) {
      this.setPosition(data.position.x, data.position.y, data.position.z);
    }

    if ('name' in data) {
      this.setName(data.name);
    }

    if ('active' in data) {
      this.active = Boolean(data.active);
    }

    if (Array.isArray(data?.microxels) && data.microxels.length > 0) {
      this.setMicroxels(data.microxels);
      return this;
    }

    if ('type' in data) {
      this.type = normalizeVoxelType(data.type);
    }

    if (typeof data?.texture === 'string' && data.texture.trim()) {
      this.texture = normalizeText(data.texture, '');
      return this;
    }

    if (typeof data?.color === 'string' && data.color.trim()) {
      this.color = normalizeText(data.color, this.color || '#ffffff');
      return this;
    }

    this.clearMicroxels();
    return this;
  }
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
}

function normalizeVoxelType(type) {
  const normalizedType = normalizeText(type, 'colored').toLowerCase();

  if (
    normalizedType === 'colored'
    || normalizedType === 'textured'
    || normalizedType === 'microxeled'
  ) {
    return normalizedType;
  }

  return 'colored';
}

function cloneMicroxelGrid(grid) {
  return grid.map(plane =>
    plane.map(row =>
      row.map(cell => cell.clone())
    )
  );
}

function createEmptyMicroxelDataGrid(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        color: '#ffffff',
        active: false,
      }))
    )
  );
}

function cloneMicroxelDataGrid(grid, size) {
  if (!Array.isArray(grid)) {
    return createEmptyMicroxelDataGrid(size);
  }

  return Array.from({ length: size }, (_, x) =>
    Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, z) => ({
        color: grid?.[x]?.[y]?.[z]?.color ?? '#ffffff',
        active: Boolean(grid?.[x]?.[y]?.[z]?.active),
      }))
    )
  );
}

function normalizeGridSize(size) {
  const numericSize = Math.floor(Number(size));
  return Number.isFinite(numericSize) && numericSize > 0 ? numericSize : 0;
}
