import Woxel from "../Wabavam/Woxel/Woxel.js";
import { colors12 } from "../Wabavam/Voxel/12colors/12colors.js";
import Voxel from "../Wabavam/Voxel/Voxel.js";
import BoxelMesher from "../Game/Optimization/Meshing/BoxelMesher.js";

export class Mapper {
  constructor(woxel = Mapper.defaultWoxel()) {
    this.woxel = woxel;
    this.woxel.landVoxel = this.woxel.landVoxel || colors12.green;
    this.palette = Object.values(colors12);
    this.accentPalette = this.palette.filter(voxel => voxel.name !== this.woxel.landVoxel.name);
    this.accentChance = 0.03;
    this.voxels = new Map();
    this.boxels = new Map();
    this.patches = { placed: new Map(), removed: new Set() };
    this.lastEditPositions = [];
    this.lastEditKind = null;
    this.lastEditFaces = new Map();
    this.mesher = new BoxelMesher({
      isSolid: position => this.isSolidAt(position),
      voxelAt: position => this.voxels.get(this.voxelKey(position)) || null,
      renderOffset: this.renderOffset()
    });
    this.indexBoxels();
    this.indexVoxels();
  }

  static defaultWoxel() {
    return new Woxel({
      name: "Example",
      landVoxel: colors12.green
    });
  }

  build() {
    this.applyPatches();

    return {
      woxel: this.woxel,
      meshes: [],
      borders: this.createWorldBorders(),
      spawnPosition: this.toRenderCoords(this.woxel.spawnPosition)
    };
  }

  createWorldBorders() {
    const { size, land } = this.woxel;
    const min = {
      x: -size.x / 2,
      y: -land.y,
      z: -size.z / 2
    };
    const max = {
      x: size.x / 2,
      y: size.y - land.y,
      z: size.z / 2
    };

    return [
      { axis: "x", side: "min", value: min.x },
      { axis: "x", side: "max", value: max.x },
      { axis: "y", side: "min", value: min.y },
      { axis: "y", side: "max", value: max.y },
      { axis: "z", side: "min", value: min.z },
      { axis: "z", side: "max", value: max.z }
    ];
  }

  createBoxelVoxels(origin) {
    const { land, boxelSize } = this.woxel;
    const voxels = [];
    const localPatchVoxels = this.patchLandVoxelKeysForBoxel(origin);

    for (let x = origin.x; x < Math.min(origin.x + boxelSize, land.x); x += 1) {
      for (let z = origin.z; z < Math.min(origin.z + boxelSize, land.z); z += 1) {
        const lateralWorldBorder = this.isBoxelBorderColumn(origin, { x, z });

        for (let y = origin.y; y < Math.min(origin.y + boxelSize, land.y); y += 1) {
          const position = { x, y, z };
          const topSurface = y === this.landSurfaceY();
          const bottomSurface = y === 0;
          const verticalBoundarySurface = lateralWorldBorder;
          const localPatchSurface = localPatchVoxels.has(this.voxelKey(position));

          if (!topSurface && !bottomSurface && !verticalBoundarySurface && !localPatchSurface) continue;
          if (!this.isVirtualLandSolid(position)) continue;

          voxels.push(this.createLandVoxel(position));
        }
      }
    }

    return voxels;
  }

  indexVoxels(boxels = this.woxel.boxels) {
    this.voxels.clear();

    boxels.forEach(boxel => {
      boxel.voxels.forEach(voxel => {
        if (voxel.active === false) return;
        this.voxels.set(this.voxelKey(voxel.position), voxel);
      });
    });
  }

  indexBoxels(boxels = this.woxel.boxels) {
    this.boxels.clear();

    boxels.forEach(boxel => {
      this.boxels.set(this.voxelKey(boxel.position), boxel);
    });
  }

  landBoxelPositionsNear(renderPosition, renderDistance) {
    const base = this.toVoxelPosition(renderPosition);
    const range = renderDistance + this.woxel.boxelSize;
    const size = this.woxel.boxelSize;
    const minX = Math.max(0, Math.floor((base.x - range) / size) * size);
    const maxX = Math.min(this.woxel.land.x - 1, Math.floor((base.x + range) / size) * size);
    const minZ = Math.max(0, Math.floor((base.z - range) / size) * size);
    const maxZ = Math.min(this.woxel.land.z - 1, Math.floor((base.z + range) / size) * size);
    const positions = [];

    for (let x = minX; x <= maxX; x += size) {
      for (let z = minZ; z <= maxZ; z += size) {
        for (const y of this.landBoxelYOriginsForArea(x, z, size)) {
          const position = { x, y, z };
          const key = this.voxelKey(position);

          if (this.boxels.has(key)) continue;
          positions.push(position);
        }
      }
    }

    return positions.sort((a, b) => this.positionDistanceSq(a, base) - this.positionDistanceSq(b, base));
  }

  createLandBoxel(position) {
    const key = this.voxelKey(position);
    if (this.boxels.has(key)) return this.boxels.get(key);

    const boxel = new this.woxel.boxel({
      position,
      voxels: this.createBoxelVoxels(position)
    });
    boxel.persisted = false;

    if (boxel.voxels.length === 0) return null;

    this.addBoxel(boxel);
    this.applyPatchesToBoxel(boxel);
    return boxel;
  }

  positionDistanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return dx * dx + dy * dy + dz * dz;
  }

  addBoxel(boxel) {
    this.woxel.boxels.push(boxel);
    this.boxels.set(this.voxelKey(boxel.position), boxel);
    boxel.voxels.forEach(voxel => {
      if (voxel.active === false) return;
      this.voxels.set(this.voxelKey(voxel.position), voxel);
    });
  }

  removeTransientBoxel(boxel) {
    if (!boxel || boxel.persisted) return false;

    const key = this.voxelKey(boxel.position);

    this.boxels.delete(key);
    this.woxel.boxels = this.woxel.boxels.filter(item => item !== boxel);
    boxel.voxels.forEach(voxel => {
      this.voxels.delete(this.voxelKey(voxel.position));
    });

    return true;
  }

  boxelsAround(boxel) {
    const size = this.woxel.boxelSize;
    const positions = [
      boxel.position,
      { ...boxel.position, x: boxel.position.x + size },
      { ...boxel.position, x: boxel.position.x - size },
      { ...boxel.position, y: boxel.position.y + size },
      { ...boxel.position, y: boxel.position.y - size },
      { ...boxel.position, z: boxel.position.z + size },
      { ...boxel.position, z: boxel.position.z - size }
    ];

    return positions
      .map(position => this.boxels.get(this.voxelKey(position)))
      .filter(Boolean);
  }

  createBoxelMesh(boxel) {
    return this.decorateBoxelMesh(boxel, this.mesher.createChunkMesh(boxel));
  }

  createBoxelMeshFromGeometryData(boxel, geometryData) {
    return this.decorateBoxelMesh(boxel, this.mesher.createMeshFromGeometryData(
      boxel,
      this.remapGeometryVoxels(geometryData)
    ));
  }

  decorateBoxelMesh(boxel, mesh) {
    if (!mesh) return null;

    mesh.userData.woxel = this.woxel;
    mesh.userData.toRenderPosition = position => this.toRenderPosition(position);
    mesh.userData.toVoxelPosition = position => this.toVoxelPosition(position);
    mesh.userData.voxelAt = position => this.voxels.get(this.voxelKey(position));

    return mesh;
  }

  meshWorkerPayload(boxel) {
    const boundary = this.boundaryMeshingData(boxel);

    return {
      boxel: this.serializeBoxelForMeshing(boxel),
      solidKeys: boundary.solidKeys,
      neighborVoxels: boundary.neighborVoxels,
      land: this.woxel.land
    };
  }

  boundaryMeshingData(boxel) {
    const { min, max } = this.expandedBoxelBounds(boxel, 1);
    const solidKeys = [];
    const neighborVoxels = [];
    const neighborVoxelKeys = new Set();

    for (let x = min.x; x <= max.x; x += 1) {
      for (let y = min.y; y <= max.y; y += 1) {
        for (let z = min.z; z <= max.z; z += 1) {
          const position = { x, y, z };
          const key = this.voxelKey(position);

          if (this.isSolidAt(position)) solidKeys.push(key);
          if (this.isPositionInsideBoxel(position, boxel.position)) continue;

          const voxel = this.voxels.get(key);

          if (!voxel || voxel.active === false || !voxel.hasMicroxels?.()) continue;
          if (neighborVoxelKeys.has(key)) continue;

          neighborVoxelKeys.add(key);
          neighborVoxels.push(this.serializeVoxelForMeshing(voxel));
        }
      }
    }

    return { solidKeys, neighborVoxels };
  }

  expandedBoxelBounds(boxel, padding = 1) {
    const { boxelSize } = this.woxel;

    return {
      min: {
        x: boxel.position.x - padding,
        y: boxel.position.y - padding,
        z: boxel.position.z - padding
      },
      max: {
        x: boxel.position.x + boxelSize - 1 + padding,
        y: boxel.position.y + boxelSize - 1 + padding,
        z: boxel.position.z + boxelSize - 1 + padding
      }
    };
  }

  neighborVoxelsNearBoxel(boxel) {
    return this.boundaryMeshingData(boxel).neighborVoxels;
  }

  solidKeysNearBoxel(boxel) {
    return this.boundaryMeshingData(boxel).solidKeys;
  }
  serializeBoxelForMeshing(boxel) {
    return {
      position: { ...boxel.position },
      voxels: boxel.voxels.map(voxel => this.serializeVoxelForMeshing(voxel))
    };
  }

  serializeVoxelForMeshing(voxel) {
    const data = {
      name: voxel.name,
      position: { ...voxel.position },
      color: voxel.color,
      active: voxel.active !== false,
      type: voxel.type,
      orientable: Boolean(voxel.orientable),
      orientation: voxel.orientation ? { ...voxel.orientation } : null,
      rotation: voxel.rotation ? { ...voxel.rotation } : null
    };

    if (voxel?.hasMicroxels?.()) {
      data.microxelSize = voxel.microxelSize;
      data.microxels = voxel.microxels;
    }

    return data;
  }


  markLocalEdit(positions = [], kind = "edit", { faceNormals = [] } = {}) {
    this.lastEditPositions = positions
      .filter(position => position && this.contains(position))
      .map(position => ({
        x: Math.floor(Number(position.x) || 0),
        y: Math.floor(Number(position.y) || 0),
        z: Math.floor(Number(position.z) || 0)
      }));

    this.lastEditKind = kind;
    this.lastEditFaces = new Map();

    this.lastEditPositions.forEach((position, index) => {
      const normals = Array.isArray(faceNormals[index])
        ? faceNormals[index]
        : faceNormals[index]
          ? [faceNormals[index]]
          : [];

      this.lastEditFaces.set(this.voxelKey(position), normals
        .map(normal => this.normalizedFaceNormal(normal))
        .filter(Boolean));
    });

    return this.lastEditPositions;
  }

  normalizedFaceNormal(normal = null) {
    if (!normal) return null;

    const x = Math.round(Number(normal.x) || 0);
    const y = Math.round(Number(normal.y) || 0);
    const z = Math.round(Number(normal.z) || 0);

    if (Math.abs(x) + Math.abs(y) + Math.abs(z) !== 1) return null;

    return { x, y, z };
  }

  remapGeometryVoxels(geometryData) {
    const remap = voxel => this.voxels.get(this.voxelKey(voxel.position)) || voxel;

    return {
      ...geometryData,
      voxels: (geometryData.voxels || []).map(remap),
      faceVoxels: (geometryData.faceVoxels || []).map(remap)
    };
  }

  removeHit(hit) {
    const voxel = this.hitVoxel(hit);
    if (!voxel) return null;

    const position = voxel.position ? { ...voxel.position } : null;
    const faceNormal = this.normalizedFaceNormal(hit?.face?.normal);
    const boxels = this.removeVoxelAt(voxel.position);

    if (boxels?.length && position && faceNormal) {
      this.markLocalEdit([position], "remove", { faceNormals: [faceNormal] });
    }

    return boxels;
  }

  placeHit(hit, voxel = this.woxel.landVoxel) {
    if (!voxel) return null;

    const base = this.hitVoxel(hit);
    if (!base || !hit.face) return null;

    const position = {
      x: base.position.x + Math.round(hit.face.normal.x),
      y: base.position.y + Math.round(hit.face.normal.y),
      z: base.position.z + Math.round(hit.face.normal.z)
    };

    if (!this.contains(position) || this.isSolidAt(position)) return null;

    const voxelData = voxel.toJSON?.() || voxel;
    const dirty = new Map();
    this.materializeLandEditSurface(position, dirty);
    const boxel = this.findOrCreateBoxel(position);
    const nextVoxel = new Voxel({
      ...voxelData,
      id: voxelData.id || voxelData.name,
      name: voxelData.name,
      position,
      solid: true
    });

    boxel.voxels.push(nextVoxel);
    boxel.persisted = true;
    this.voxels.set(this.voxelKey(position), nextVoxel);
    this.recordPlacedVoxel(nextVoxel);
    this.markLocalEdit([position], "place");

    this.dirtyBoxelsNear(position).forEach(item => this.addDirtyBoxel(dirty, item));

    return [...dirty.values()];
  }

  placeBoxel(boxel, anchor) {
    const dirty = new Map();
    const placedPositions = [];

    boxel.voxels.forEach(voxel => {
      const position = {
        x: anchor.x + voxel.position.x,
        y: anchor.y + voxel.position.y,
        z: anchor.z + voxel.position.z
      };

      if (!this.contains(position)) return;

      this.materializeLandEditSurface(position, dirty);

      const targetBoxel = this.findOrCreateBoxel(position);
      const key = this.voxelKey(position);
      const nextVoxel = new Voxel({ ...voxel, position });

      targetBoxel.voxels = targetBoxel.voxels.filter(item => this.voxelKey(item.position) !== key);
      targetBoxel.voxels.push(nextVoxel);
      targetBoxel.persisted = true;
      if (nextVoxel.active !== false) this.voxels.set(key, nextVoxel);
      this.recordPlacedVoxel(nextVoxel);
      placedPositions.push({ ...position });
      this.dirtyBoxelsNear(position).forEach(item => dirty.set(this.voxelKey(item.position), item));
    });

    this.markLocalEdit(placedPositions, "place");
    return [...dirty.values()];
  }


  placeBounds(bounds, voxel = this.woxel.landVoxel) {
    if (!voxel) return [];

    const positions = this.positionsInBounds(bounds).filter(position => this.contains(position));
    if (positions.length === 0) return [];

    const dirty = new Map();
    const voxelData = voxel.toJSON?.() || voxel;
    const grouped = new Map();

    this.prepareBoundsEdit(positions, dirty);

    positions.forEach(position => {
      const key = this.voxelKey(position);
      const targetBoxel = this.findOrCreateBoxel(position);
      const boxelKey = this.voxelKey(targetBoxel.position);
      const nextVoxel = new Voxel({
        ...voxelData,
        id: voxelData.id || voxelData.name,
        name: voxelData.name,
        position: { ...position },
        solid: true
      });

      if (!grouped.has(boxelKey)) {
        grouped.set(boxelKey, {
          boxel: targetBoxel,
          keys: new Set(),
          voxels: []
        });
      }

      const group = grouped.get(boxelKey);

      group.keys.add(key);
      group.voxels.push(nextVoxel);
    });

    grouped.forEach(group => {
      group.boxel.voxels = group.boxel.voxels.filter(item => !group.keys.has(this.voxelKey(item.position)));
      group.voxels.forEach(nextVoxel => {
        const key = this.voxelKey(nextVoxel.position);

        group.boxel.voxels.push(nextVoxel);
        if (nextVoxel.active !== false) this.voxels.set(key, nextVoxel);
        else this.voxels.delete(key);
        this.recordPlacedVoxel(nextVoxel);
      });
      group.boxel.persisted = true;
      this.addDirtyBoxel(dirty, group.boxel);
    });

    this.addDirtyBoxelsNearPositions(dirty, positions);
    this.markLocalEdit(positions, "place");

    return [...dirty.values()];
  }

  removeBounds(bounds, { fullColumn = false } = {}) {
    const positions = this.positionsInBounds(bounds)
      .filter(position => this.contains(position) && this.isSolidAt(position));

    if (positions.length === 0) return [];

    const dirty = new Map();
    const grouped = new Map();

    // Remove is data-truth first.
    // Normal edit only materializes the touched Y slice.
    // Full land columns are reserved for explicit terrain surgery.
    positions.forEach(position => {
      this.recordRemovedVoxel(position);
      this.voxels.delete(this.voxelKey(position));
    });

    this.prepareBoundsEdit(positions, dirty, { fullColumn });

    positions.forEach(position => {
      const key = this.voxelKey(position);
      const targetBoxel = this.findOrCreateBoxel(position);
      const boxelKey = this.voxelKey(targetBoxel.position);

      if (!grouped.has(boxelKey)) {
        grouped.set(boxelKey, {
          boxel: targetBoxel,
          keys: new Set()
        });
      }

      grouped.get(boxelKey).keys.add(key);
    });

    grouped.forEach(group => {
      group.boxel.voxels = group.boxel.voxels.filter(item => !group.keys.has(this.voxelKey(item.position)));
      group.boxel.persisted = true;
      this.addDirtyBoxel(dirty, group.boxel);
    });

    this.addDirtyBoxelsNearPositions(dirty, positions);
    this.markLocalEdit(positions, "remove");

    return [...dirty.values()];
  }

  removeTerrainBounds(bounds) {
    return this.removeBounds(bounds, { fullColumn: true });
  }

  prepareBoundsEdit(positions = [], dirty = new Map(), { fullColumn = false } = {}) {
    if (fullColumn) {
      const edits = new Map();

      positions.forEach(position => {
        if (!this.isLandPosition(position) && !this.voxels.has(this.voxelKey(position))) return;

        this.landColumnsNear(position).forEach(column => {
          const key = this.columnKey(column);

          if (!edits.has(key)) {
            edits.set(key, { column: { x: column.x, y: position.y, z: column.z } });
          }
        });
      });

      edits.forEach(({ column }) => {
        this.ensureModifiedLandColumn(column, null)
          .forEach(boxel => this.addDirtyBoxel(dirty, boxel));
      });

      return dirty;
    }

    positions.forEach(position => this.materializeLandEditSurface(position, dirty));

    return dirty;
  }

  addDirtyBoxel(dirty, boxel) {
    if (!dirty || !boxel) return dirty;

    dirty.set(this.voxelKey(boxel.position), boxel);
    return dirty;
  }

  addDirtyBoxelsNearPositions(dirty, positions = []) {
    const origins = new Map();

    positions.forEach(position => {
      const origin = this.boxelOrigin(position);

      origins.set(this.voxelKey(origin), origin);
      this.dirtyNeighborOrigins(position).forEach(item => origins.set(this.voxelKey(item), item));
    });

    origins.forEach(origin => this.addDirtyBoxel(dirty, this.boxelForDirtyOrigin(origin)));
    return dirty;
  }

  boxelForDirtyOrigin(origin) {
    const key = this.voxelKey(origin);

    return this.boxels.get(key) || this.createLandBoxel(origin) || null;
  }

  placeVoxelAt(position, voxel = this.woxel.landVoxel) {
    if (!voxel || !this.contains(position)) return [];

    return this.placeBounds({ min: position, max: position }, voxel);
  }

  removeVoxelAt(position) {
    if (!this.contains(position)) return [];

    return this.removeBounds({ min: position, max: position }, { fullColumn: false });
  }

  removeTerrainVoxelAt(position) {
    if (!this.contains(position)) return [];

    return this.removeBounds({ min: position, max: position }, { fullColumn: true });
  }

  positionsInBounds(bounds = {}) {
    const clean = this.normalizeBounds(bounds);
    const positions = [];

    for (let x = clean.min.x; x <= clean.max.x; x += 1) {
      for (let y = clean.min.y; y <= clean.max.y; y += 1) {
        for (let z = clean.min.z; z <= clean.max.z; z += 1) {
          positions.push({ x, y, z });
        }
      }
    }

    return positions;
  }

  normalizeBounds(bounds = {}) {
    const min = bounds.min || bounds.first || bounds;
    const max = bounds.max || bounds.second || bounds.min || bounds;

    return {
      min: {
        x: Math.min(Math.floor(Number(min.x) || 0), Math.floor(Number(max.x) || 0)),
        y: Math.min(Math.floor(Number(min.y) || 0), Math.floor(Number(max.y) || 0)),
        z: Math.min(Math.floor(Number(min.z) || 0), Math.floor(Number(max.z) || 0))
      },
      max: {
        x: Math.max(Math.floor(Number(min.x) || 0), Math.floor(Number(max.x) || 0)),
        y: Math.max(Math.floor(Number(min.y) || 0), Math.floor(Number(max.y) || 0)),
        z: Math.max(Math.floor(Number(min.z) || 0), Math.floor(Number(max.z) || 0))
      }
    };
  }

  voxelAt(position) {
    return this.voxels.get(this.voxelKey(position)) || null;
  }

  hitVoxel(hit) {
    if (!hit) return null;
    if (hit.instanceId !== undefined) {
      return hit.object.userData.voxels?.[hit.instanceId] || null;
    }
    if (hit.voxel?.position && hit.voxel.active !== false) return hit.voxel;

    const voxel = this.hitPointVoxel(hit);
    if (voxel) return voxel;

    const faceIndex = Math.floor((hit.faceIndex ?? -1) / 2);

    return hit.object.userData.faceVoxels?.[faceIndex] || null;
  }

  hitPointVoxel(hit) {
    if (!hit.point || !hit.face?.normal) return null;

    const point = hit.point.clone().addScaledVector(hit.face.normal, -0.01);
    const position = this.toVoxelPosition(point);

    return this.voxels.get(this.voxelKey(position)) || null;
  }

  groundAt(renderPosition) {
    const position = this.toVoxelPosition(renderPosition);

    if (!this.insideLandColumn(position)) return null;

    for (let y = Math.min(position.y, this.woxel.land.y - 1); y >= 0; y -= 1) {
      const groundPosition = { x: position.x, y, z: position.z };

      if (this.isSolidAt(groundPosition)) {
        const center = this.toRenderPosition(groundPosition);

        return {
          x: renderPosition.x,
          y: center.y + 0.5,
          z: renderPosition.z
        };
      }
    }

    return null;
  }

  proceduralGroundAt(renderPosition) {
    return {
      x: renderPosition.x,
      y: 0,
      z: renderPosition.z
    };
  }

  insideLandColumn(position) {
    return position.x >= 0
      && position.z >= 0
      && position.x < this.woxel.land.x
      && position.z < this.woxel.land.z;
  }

  isBoxelBorderColumn(origin, position) {
    if (!this.insideLandColumn(position)) return false;
    const size = this.woxel.boxelSize;
    const touchesMinX = origin.x === 0;
    const touchesMinZ = origin.z === 0;
    const touchesMaxX = origin.x + size >= this.woxel.land.x;
    const touchesMaxZ = origin.z + size >= this.woxel.land.z;

    return (touchesMinX && position.x === origin.x)
      || (touchesMaxX && position.x === Math.min(origin.x + size, this.woxel.land.x) - 1)
      || (touchesMinZ && position.z === origin.z)
      || (touchesMaxZ && position.z === Math.min(origin.z + size, this.woxel.land.z) - 1);
  }

  hasGeneratedLandColumn(position) {
    const top = this.boxelOrigin({
      x: position.x,
      y: this.woxel.land.y - 1,
      z: position.z
    });

    return this.boxels.has(this.voxelKey(top));
  }

  isSurfaceBoxel(boxel) {
    return boxel?.position?.y === this.boxelOrigin({
      x: boxel.position.x,
      y: this.landSurfaceY(),
      z: boxel.position.z
    }).y;
  }

  isUngeneratedLandColumn(renderPosition) {
    return false;
  }

  findOrCreateBoxel(position) {
    const origin = this.boxelOrigin(position);
    const key = this.voxelKey(origin);
    let boxel = this.boxels.get(key);

    if (!boxel) {
      boxel = new this.woxel.boxel({ position: origin, voxels: [] });
      boxel.persisted = true;
      this.woxel.boxels.push(boxel);
      this.boxels.set(key, boxel);
    }

    return boxel;
  }

  loadPatches(data = {}) {
    const patches = data.patches || {
      placed: this.legacyPlacedVoxels(data),
      removed: []
    };

    this.patches = {
      placed: new Map((patches.placed || []).map(voxel => [this.voxelKey(voxel.position), voxel])),
      removed: new Set((patches.removed || []).map(position => this.voxelKey(position)))
    };
  }

  applyPatches() {
    this.patches.removed.forEach(key => {
      if (this.isLandBoxelOrigin(this.boxelOrigin(this.positionFromKey(key)))) return;

      const voxel = this.voxels.get(key);

      if (!voxel) return;
      const boxel = this.findOrCreateBoxel(voxel.position);

      boxel.voxels = boxel.voxels.filter(item => this.voxelKey(item.position) !== key);
      boxel.persisted = true;
      this.voxels.delete(key);
    });
    this.patches.placed.forEach(voxelData => {
      const key = this.voxelKey(voxelData.position);
      const voxel = new Voxel(voxelData);
      const origin = this.boxelOrigin(voxel.position);

      if (this.isLandBoxelOrigin(origin)) return;

      const boxel = this.findOrCreateBoxel(voxel.position);

      boxel.voxels = boxel.voxels.filter(item => this.voxelKey(item.position) !== key);
      boxel.voxels.push(voxel);
      boxel.persisted = true;
      if (voxel.active !== false) this.voxels.set(key, voxel);
    });
  }

  applyPatchesToBoxel(boxel) {
    const origin = boxel.position;
    const size = this.woxel.boxelSize;

    boxel.voxels = boxel.voxels.filter(voxel => {
      const key = this.voxelKey(voxel.position);
      const keep = !this.patches.removed.has(key);

      if (!keep) this.voxels.delete(key);
      return keep;
    });
    this.patches.placed.forEach(voxelData => {
      if (!this.isPositionInsideBoxel(voxelData.position, origin, size)) return;

      const key = this.voxelKey(voxelData.position);
      const voxel = new Voxel(voxelData);

      boxel.voxels = boxel.voxels.filter(item => this.voxelKey(item.position) !== key);
      boxel.voxels.push(voxel);
      if (voxel.active !== false) this.voxels.set(key, voxel);
    });
    if (boxel.persisted === false && (boxel.voxels.length === 0 || this.hasPatchInBoxel(origin, size))) {
      boxel.persisted = true;
    }
  }

  isPositionInsideBoxel(position, origin, size = this.woxel.boxelSize) {
    return position.x >= origin.x
      && position.y >= origin.y
      && position.z >= origin.z
      && position.x < origin.x + size
      && position.y < origin.y + size
      && position.z < origin.z + size;
  }

  hasPatchInBoxel(origin, size = this.woxel.boxelSize) {
    for (const key of this.patches.removed) {
      if (this.isPositionInsideBoxel(this.positionFromKey(key), origin, size)) return true;
    }

    return [...this.patches.placed.values()].some(voxel => this.isPositionInsideBoxel(voxel.position, origin, size));
  }

  isLandBoxelOrigin(origin) {
    return origin.x >= 0
      && origin.y >= 0
      && origin.z >= 0
      && origin.x < this.woxel.land.x
      && origin.y < this.woxel.land.y
      && origin.z < this.woxel.land.z;
  }

  recordPlacedVoxel(voxel) {
    const data = this.serializePatchVoxel(voxel);
    const key = this.voxelKey(data.position);

    this.patches.removed.delete(key);
    this.patches.placed.set(key, data);
  }

  recordRemovedVoxel(position) {
    const key = this.voxelKey(position);

    this.patches.placed.delete(key);
    this.patches.removed.add(key);
  }

  patchData() {
    return {
      placed: [...this.patches.placed.values()],
      removed: [...this.patches.removed].map(key => this.positionFromKey(key))
    };
  }

  legacyPlacedVoxels(data = {}) {
    const landName = data.landVoxel?.name;

    return (data.boxels || [])
      .flatMap(boxel => boxel.voxels || [])
      .filter(voxel => !landName || voxel.name !== landName);
  }

  serializePatchVoxel(voxel) {
    if (voxel?.toJSON) return voxel.toJSON();

    return {
      id: voxel.id,
      name: voxel.name,
      position: { ...voxel.position },
      solid: voxel.solid,
      color: voxel.color,
      ...(voxel.active === false ? { active: false } : {})
    };
  }

  positionFromKey(key) {
    const [x, y, z] = key.split(",").map(Number);

    return { x, y, z };
  }

  boxelOrigin(position) {
    const size = this.woxel.boxelSize;

    return {
      x: Math.floor(position.x / size) * size,
      y: Math.floor(position.y / size) * size,
      z: Math.floor(position.z / size) * size
    };
  }

  contains(position) {
    const { size } = this.woxel;

    return position.x >= 0
      && position.y >= 0
      && position.z >= 0
      && position.x < size.x
      && position.y < size.y
      && position.z < size.z;
  }

  voxelKey(position) {
    return `${position.x},${position.y},${position.z}`;
  }

  columnKey(position) {
    return `${position.x},${position.z}`;
  }

  landSurfaceY() {
    return this.woxel.land.y - 1;
  }

  createLandVoxel(position) {
    const voxel = this.landVoxelAt(position);

    return new Voxel({
      id: voxel.name,
      name: voxel.name,
      position,
      solid: true,
      color: voxel.color
    });
  }

  isSolidAt(position) {
    const key = this.voxelKey(position);
    const voxel = this.voxels.get(key);

    if (voxel && voxel.active !== false) return true;

    return this.isVirtualLandSolid(position);
  }

  isVirtualLandSolid(position) {
    const key = this.voxelKey(position);
    const placed = this.patches.placed.get(key);

    if (placed) return placed.active !== false;
    if (this.patches.removed.has(key)) return false;

    return this.isLandPosition(position);
  }

  isLandPosition(position) {
    return this.insideLandColumn(position)
      && position.y >= 0
      && position.y < this.woxel.land.y;
  }

  landBoxelYOriginsForArea(x, z, size = this.woxel.boxelSize) {
    const origins = new Set([
      0,
      this.boxelOrigin({ x, y: this.landSurfaceY(), z }).y
    ]);

    if (this.isLandBorderArea(x, z, size)) {
      for (let y = 0; y < this.woxel.land.y; y += size) origins.add(y);
    }

    this.patchLandYOriginsForArea(x, z, size)
      .forEach(y => origins.add(y));

    return [...origins].sort((a, b) => a - b);
  }

  patchLandYOriginsForArea(x, z, size = this.woxel.boxelSize) {
    const origins = new Set();

    this.landPatchEditPositions().forEach(position => {
      if (!this.landEditTouchesArea(position, x, z, size)) return;

      origins.add(this.boxelOrigin(position).y);
    });

    return origins;
  }

  patchLandVoxelKeysForBoxel(origin) {
    const voxels = new Set();

    this.landPatchEditPositions().forEach(position => {
      this.landEditSurfacePositions(position).forEach(surfacePosition => {
        if (!this.isPositionInsideBoxel(surfacePosition, origin, this.woxel.boxelSize)) return;

        voxels.add(this.voxelKey(surfacePosition));
      });
    });

    return voxels;
  }

  landEditTouchesArea(position, x, z, size = this.woxel.boxelSize) {
    return this.landEditSurfacePositions(position).some(surfacePosition => (
      surfacePosition.x >= x
      && surfacePosition.x < x + size
      && surfacePosition.z >= z
      && surfacePosition.z < z + size
    ));
  }

  landPatchEditPositions() {
    const positions = [];

    this.patches.removed.forEach(key => {
      const position = this.positionFromKey(key);

      if (this.isLandPosition(position)) positions.push(position);
    });
    this.patches.placed.forEach(voxel => {
      const position = voxel?.position;

      if (this.isLandPosition(position)) positions.push(position);
    });

    return positions;
  }

  isLandBorderArea(x, z, size = this.woxel.boxelSize) {
    return x <= 0
      || z <= 0
      || x + size >= this.woxel.land.x
      || z + size >= this.woxel.land.z;
  }

  materializeLandEditSurface(position, dirty = new Map()) {
    this.landEditSurfacePositions(position).forEach(surfacePosition => {
      this.materializeLandVoxel(surfacePosition, dirty);
    });

    return dirty;
  }

  landEditSurfacePositions(position) {
    const directions = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 }
    ];
    const positions = new Map();

    directions.forEach(direction => {
      const surfacePosition = {
        x: position.x + direction.x,
        y: position.y + direction.y,
        z: position.z + direction.z
      };

      if (!this.isLandPosition(surfacePosition)) return;
      if (!this.isVirtualLandSolid(surfacePosition) && !this.voxels.has(this.voxelKey(surfacePosition))) return;

      positions.set(this.voxelKey(surfacePosition), surfacePosition);
    });

    return [...positions.values()];
  }

  materializeLandVoxel(position, dirty = new Map()) {
    if (!this.isLandPosition(position)) return null;
    if (!this.isVirtualLandSolid(position) && !this.voxels.has(this.voxelKey(position))) return null;

    const key = this.voxelKey(position);
    const boxel = this.findOrCreateBoxel(position);

    if (!this.voxels.has(key)) {
      const voxel = this.createLandVoxel(position);

      boxel.voxels.push(voxel);
      this.voxels.set(key, voxel);
    }

    boxel.persisted = true;
    this.addDirtyBoxel(dirty, boxel);
    return boxel;
  }

  ensureModifiedLandColumn(position, yHint = null) {
    if (!this.isLandPosition(position)) return [];

    if (Number.isFinite(yHint)) {
      const origin = this.boxelOrigin({
        x: position.x,
        y: yHint,
        z: position.z
      });
      const boxel = this.createLandBoxel(origin) || this.boxels.get(this.voxelKey(origin));

      if (!boxel) return [];

      this.materializeLandColumnInBoxel(boxel, position);
      return [boxel];
    }

    const boxels = [];

    for (let y = 0; y < this.woxel.land.y; y += this.woxel.boxelSize) {
      const origin = this.boxelOrigin({ x: position.x, y, z: position.z });
      const boxel = this.createLandBoxel(origin) || this.boxels.get(this.voxelKey(origin));

      if (!boxel) continue;
      this.materializeLandColumnInBoxel(boxel, position);
      boxels.push(boxel);
    }

    return boxels;
  }

  ensureModifiedLandColumnsNear(position, { fullColumn = false } = {}) {
    const dirty = new Map();
    const yHint = fullColumn ? null : position.y;

    this.landColumnsNear(position).forEach(column => {
      this.ensureModifiedLandColumn(column, yHint)
        .forEach(boxel => dirty.set(this.voxelKey(boxel.position), boxel));
    });

    return [...dirty.values()];
  }

  landColumnsNear(position) {
    return [
      position,
      { ...position, x: position.x + 1 },
      { ...position, x: position.x - 1 },
      { ...position, z: position.z + 1 },
      { ...position, z: position.z - 1 }
    ].filter(column => this.isLandPosition(column));
  }

  materializeLandColumnInBoxel(boxel, column) {
    const maxY = Math.min(boxel.position.y + this.woxel.boxelSize, this.woxel.land.y);

    for (let y = boxel.position.y; y < maxY; y += 1) {
      const position = { x: column.x, y, z: column.z };
      const key = this.voxelKey(position);

      if (!this.isVirtualLandSolid(position) || this.voxels.has(key)) continue;

      const voxel = this.createLandVoxel(position);

      boxel.voxels.push(voxel);
      this.voxels.set(key, voxel);
    }
  }

  mergeDirtyBoxels(boxels = []) {
    const dirty = new Map();

    boxels.forEach(boxel => {
      if (!boxel) return;
      dirty.set(this.voxelKey(boxel.position), boxel);
    });

    return [...dirty.values()];
  }

  dirtyBoxelsNear(position) {
    const boxels = new Map();
    const addBoxel = boxel => {
      if (!boxel) return;

      boxels.set(this.voxelKey(boxel.position), boxel);
    };
    const origin = this.boxelOrigin(position);

    addBoxel(this.boxelForDirtyOrigin(origin));
    this.dirtyNeighborOrigins(position)
      .map(item => this.boxelForDirtyOrigin(item))
      .forEach(addBoxel);

    return [...boxels.values()];
  }

  dirtyNeighborOrigins(position) {
    const size = this.woxel.boxelSize;
    const origin = this.boxelOrigin(position);
    const max = this.effectiveBoxelMax(origin);
    const origins = [];

    if (position.x === origin.x) origins.push({ ...origin, x: origin.x - size });
    if (position.x === max.x) origins.push({ ...origin, x: origin.x + size });
    if (position.y === origin.y) origins.push({ ...origin, y: origin.y - size });
    if (position.y === max.y) origins.push({ ...origin, y: origin.y + size });
    if (position.z === origin.z) origins.push({ ...origin, z: origin.z - size });
    if (position.z === max.z) origins.push({ ...origin, z: origin.z + size });

    return origins.filter(item => this.isBoxelOriginInsideWorld(item));
  }

  effectiveBoxelMax(origin) {
    const size = this.woxel.boxelSize;
    const world = this.woxel.size || this.woxel.land;

    return {
      x: Math.min(origin.x + size, world.x) - 1,
      y: Math.min(origin.y + size, world.y) - 1,
      z: Math.min(origin.z + size, world.z) - 1
    };
  }

  isBoxelOriginInsideWorld(origin) {
    const world = this.woxel.size || this.woxel.land;

    return origin.x >= 0
      && origin.y >= 0
      && origin.z >= 0
      && origin.x < world.x
      && origin.y < world.y
      && origin.z < world.z;
  }

  toRenderPosition(position) {
    const { land } = this.woxel;

    return {
      x: position.x - land.x / 2 + 0.5,
      y: position.y - land.y + 0.5,
      z: position.z - land.z / 2 + 0.5
    };
  }

  renderOffset() {
    const { land } = this.woxel;

    return {
      x: -land.x / 2,
      y: -land.y,
      z: -land.z / 2
    };
  }

  toVoxelPosition(position) {
    const { land } = this.woxel;

    return {
      x: Math.floor(position.x + land.x / 2),
      y: Math.floor(position.y + land.y),
      z: Math.floor(position.z + land.z / 2)
    };
  }

  toWorldCoords(position) {
    const { land } = this.woxel;

    return {
      x: position.x,
      y: position.y + land.y,
      z: position.z
    };
  }

  toRenderCoords(position) {
    const { land } = this.woxel;

    return {
      x: position.x,
      y: position.y - land.y,
      z: position.z
    };
  }

  randomVoxel() {
    return this.palette[Math.floor(Math.random() * this.palette.length)];
  }

  landVoxelAt(position) {
    if (this.random01(position) > this.accentChance) return this.woxel.landVoxel;

    return this.accentPalette[Math.floor(this.random01({
      x: position.x + 17,
      y: position.y + 31,
      z: position.z + 47
    }) * this.accentPalette.length)] || this.woxel.landVoxel;
  }

  random01(position) {
    const seed = Math.sin(
      position.x * 127.1
      + position.y * 311.7
      + position.z * 74.7
    ) * 43758.5453;

    return seed - Math.floor(seed);
  }
}

export default Mapper;



