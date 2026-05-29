import { Voxel } from './Voxel.js';

export class Boxel {
  constructor({
    size = 7,
    name = 'Default Boxel',
    active = true,
    voxels = null,
  } = {}) {
    // Boxel is the first container layer: a named 3D group of Voxels.
    this.size = normalizeBoxelSize(size);
    this.name = normalizeText(name, '');
    this.active = Boolean(active);
    this.voxels = createVoxelGrid(this.size);

    if (Array.isArray(voxels)) {
      this.setVoxels(voxels);
    }
  }

  setName(name = '') {
    this.name = normalizeText(name, '');
    return this;
  }

  destroy() {
    this.active = false;
    return this;
  }

  revive() {
    this.active = true;
    return this;
  }

  resetVoxels(active = false) {
    this.voxels = createVoxelGrid(this.size, { active });
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
      this.resetVoxels(false);
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

  setVoxelEntries(voxelEntries = []) {
    this.resetVoxels(false);

    if (!Array.isArray(voxelEntries) || voxelEntries.length === 0) {
      return this;
    }

    for (let i = 0; i < voxelEntries.length; i += 1) {
      const entry = voxelEntries[i];
      const position = normalizeVoxelEntryPosition(entry?.position ?? entry);
      if (!position) continue;
      if (!this.voxels?.[position.x]?.[position.y]?.[position.z]) continue;

      const voxel = entry?.voxel instanceof Voxel
        ? entry.voxel.clone()
        : new Voxel({
          x: position.x,
          y: position.y,
          z: position.z,
        }).fromJSON(entry?.voxel ?? entry ?? {});

      voxel.setPosition(position.x, position.y, position.z);
      voxel.active = entry?.voxel?.active ?? entry?.active ?? voxel.active;
      this.voxels[position.x][position.y][position.z] = voxel;
    }

    return this;
  }

  getVoxelEntries({ activeOnly = true } = {}) {
    const voxelEntries = [];

    for (let x = 0; x < this.size; x += 1) {
      for (let y = 0; y < this.size; y += 1) {
        for (let z = 0; z < this.size; z += 1) {
          const voxel = this.get(x, y, z);
          if (!voxel) continue;
          if (activeOnly && voxel.active !== true) continue;

          voxelEntries.push({
            position: { x, y, z },
            voxel: voxel.clone(),
          });
        }
      }
    }

    return voxelEntries;
  }

  toJSON() {
    return {
      name: this.name,
      size: this.size,
      active: this.active,
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

    if ('active' in data) {
      this.active = Boolean(data.active);
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
      active: this.active,
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

function createVoxelGrid(size, { active = true } = {}) {
  return Array.from({ length: size }, (_, x) =>
    Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, z) => new Voxel({
        x,
        y,
        z,
        active,
      }))
    )
  );
}

function normalizeVoxelEntryPosition(position = null) {
  if (!position || typeof position !== 'object') return null;

  const x = Math.floor(Number(position.x));
  const y = Math.floor(Number(position.y));
  const z = Math.floor(Number(position.z));
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }

  return { x, y, z };
}
