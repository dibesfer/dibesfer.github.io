import { World } from './World.js';

export class WorldEditor {
  constructor({
    world = null,
    getVoxelCellFromRaycastHit = null,
    getAdjacentVoxelCellFromRaycastHit = null,
    voxelSize = 1,
  } = {}) {
    this.world = world instanceof World ? world : null;
    this.getVoxelCellFromRaycastHit = typeof getVoxelCellFromRaycastHit === 'function'
      ? getVoxelCellFromRaycastHit
      : () => null;
    this.getAdjacentVoxelCellFromRaycastHit = typeof getAdjacentVoxelCellFromRaycastHit === 'function'
      ? getAdjacentVoxelCellFromRaycastHit
      : () => null;
    this.voxelSize = normalizeVoxelSize(voxelSize);
  }

  setWorld(world = null) {
    this.world = world instanceof World ? world : null;
    return this;
  }

  setVoxelSize(voxelSize = 1) {
    this.voxelSize = normalizeVoxelSize(voxelSize);
    return this;
  }

  setRaycastResolvers({
    getVoxelCellFromRaycastHit = this.getVoxelCellFromRaycastHit,
    getAdjacentVoxelCellFromRaycastHit = this.getAdjacentVoxelCellFromRaycastHit,
  } = {}) {
    this.getVoxelCellFromRaycastHit = typeof getVoxelCellFromRaycastHit === 'function'
      ? getVoxelCellFromRaycastHit
      : () => null;
    this.getAdjacentVoxelCellFromRaycastHit = typeof getAdjacentVoxelCellFromRaycastHit === 'function'
      ? getAdjacentVoxelCellFromRaycastHit
      : () => null;
    return this;
  }

  getTargetVoxelCell(hit = null) {
    return normalizeVoxelCell(this.getVoxelCellFromRaycastHit(hit));
  }

  getAdjacentTargetVoxelCell(hit = null) {
    return normalizeVoxelCell(this.getAdjacentVoxelCellFromRaycastHit(hit));
  }

  getVoxelBox(cellX = 0, cellY = 0, cellZ = 0, targetBox = null) {
    if (!this.world) return null;
    return this.world.getVoxelBox(cellX, cellY, cellZ, this.voxelSize, targetBox);
  }

  getTargetVoxelBox(hit = null, targetBox = null) {
    const cell = this.getTargetVoxelCell(hit);
    if (!cell) return null;
    return this.getVoxelBox(cell.cellX, cell.cellY, cell.cellZ, targetBox);
  }

  getAdjacentTargetVoxelBox(hit = null, targetBox = null) {
    const cell = this.getAdjacentTargetVoxelCell(hit);
    if (!cell) return null;
    return this.getVoxelBox(cell.cellX, cell.cellY, cell.cellZ, targetBox);
  }

  setVoxel(cellX = 0, cellY = 0, cellZ = 0, voxel = null) {
    if (!this.world) return false;
    try {
      this.world.setVoxel(cellX, cellY, cellZ, voxel);
      return true;
    } catch {
      return false;
    }
  }

  removeVoxel(cellX = 0, cellY = 0, cellZ = 0) {
    if (!this.world) return false;
    try {
      return this.world.removeVoxel(cellX, cellY, cellZ);
    } catch {
      return false;
    }
  }

  setVoxelFromHit(hit = null, voxel = null, options = {}) {
    const cell = this.getAdjacentTargetVoxelCell(hit);
    if (!cell) return null;
    if (options.replaceExisting !== true && this.world?.hasVoxel(cell.cellX, cell.cellY, cell.cellZ)) {
      return null;
    }

    const applied = this.setVoxel(cell.cellX, cell.cellY, cell.cellZ, voxel);
    return applied
      ? { applied: true, ...cell }
      : null;
  }

  removeVoxelFromHit(hit = null) {
    const cell = this.getTargetVoxelCell(hit);
    if (!cell) return null;

    const removed = this.removeVoxel(cell.cellX, cell.cellY, cell.cellZ);
    return removed
      ? { removed: true, ...cell }
      : null;
  }
}

function normalizeVoxelCell(cell = null) {
  if (!cell) return null;

  const cellX = Number(cell.cellX);
  const cellY = Number(cell.cellY);
  const cellZ = Number(cell.cellZ);
  if (!Number.isFinite(cellX) || !Number.isFinite(cellY) || !Number.isFinite(cellZ)) {
    return null;
  }

  return { cellX, cellY, cellZ };
}

function normalizeVoxelSize(voxelSize = 1) {
  const normalizedVoxelSize = Number(voxelSize);
  return Number.isFinite(normalizedVoxelSize) && normalizedVoxelSize > 0
    ? normalizedVoxelSize
    : 1;
}
