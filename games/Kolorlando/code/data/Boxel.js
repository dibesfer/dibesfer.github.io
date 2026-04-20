import { Voxel } from './Voxel.js';

export class Boxel {
  constructor({
    size = 7,
    name = 'Default Boxel',
    voxels = null,
  } = {}) {
    // Boxel is the first container layer: a named 3D group of Voxels.
    this.size = normalizeBoxelSize(size);
    this.name = normalizeText(name, '');
    this.voxels = createVoxelGrid(this.size);

    if (Array.isArray(voxels)) {
      this.setVoxels(voxels);
    }
  }

  setName(name = '') {
    this.name = normalizeText(name, '');
    return this;
  }

  get(x, y, z) {
    return this.voxels?.[x]?.[y]?.[z] ?? null;
  }

  set(x, y, z, voxel) {
    if (!(voxel instanceof Voxel)) {
      throw new Error('set expects a Voxel instance.');
    }

    if (!this.voxels?.[x]?.[y]) {
      throw new Error(`Invalid voxel position ${x},${y},${z}.`);
    }

    voxel.setPosition(x, y, z);
    this.voxels[x][y][z] = voxel;
    return this;
  }

  setVoxels(voxelsArray) {
    if (!Array.isArray(voxelsArray) || voxelsArray.length === 0) {
      this.voxels = createVoxelGrid(this.size);
      return this;
    }

    this.voxels = Array.from({ length: this.size }, (_, x) =>
      Array.from({ length: this.size }, (_, y) =>
        Array.from({ length: this.size }, (_, z) => {
          const sourceVoxel = voxelsArray?.[x]?.[y]?.[z];

          if (sourceVoxel instanceof Voxel) {
            return sourceVoxel.clone().setPosition(x, y, z);
          }

          return new Voxel({
            x,
            y,
            z,
          }).fromJSON(sourceVoxel ?? {});
        })
      )
    );

    return this;
  }

  toJSON() {
    return {
      name: this.name,
      size: this.size,
      voxels: this.voxels.map(plane =>
        plane.map(row =>
          row.map(voxel => voxel.toJSON())
        )
      ),
    };
  }

  fromJSON(data = {}) {
    if (normalizeBoxelSize(data?.size) !== this.size) {
      throw new Error('Loaded boxel size does not match the current boxel.');
    }

    if ('name' in data) {
      this.setName(data.name);
    }

    if (Array.isArray(data?.voxels)) {
      this.setVoxels(data.voxels);
    }

    return this;
  }
  clone() {
    return new Boxel({
      size: this.size,
      name: this.name,
      voxels: this.voxels,
    });
  }
}

function normalizeBoxelSize(size) {
  const numericSize = Math.floor(Number(size));
  return Number.isFinite(numericSize) && numericSize > 0 ? numericSize : 7;
}

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
}

function createVoxelGrid(size) {
  return Array.from({ length: size }, (_, x) =>
    Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, z) => new Voxel({
        x,
        y,
        z,
      }))
    )
  );
}
