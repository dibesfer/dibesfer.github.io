import * as THREE from 'three';
import { World } from '../code/data/World.js';
import { Voxel } from '../code/data/Voxel.js';

/*

edit flow V
collision helpers V
dynamic entities X
map boundary colliders V

rendering scalability
voxelandiaMap.js used InstancedMesh
current MapGenerator keeps an InstancedMesh and syncs it from World edits
coordinate convention
voxelandiaMap.js centered the world around origin
MapGenerator now follows World spatial helpers

*/

export function buildMapFromWorld({
  scene,
  world,
  voxelSize = 1,
}) {
  if (!scene) {
    throw new Error('buildMapFromWorld requires a scene.');
  }

  if (!(world instanceof World)) {
    throw new Error('buildMapFromWorld requires a World instance.');
  }

  const mapGroup = new THREE.Group();
  const buildingColliders = [];
  const tempCollisionBox = new THREE.Box3();
  const searchRegion = new THREE.Box3();
  const boundaryThickness = voxelSize;
  const instanceMatrix = new THREE.Matrix4();
  const instanceColor = new THREE.Color();
  const hiddenInstanceMatrix = new THREE.Matrix4().makeTranslation(0, -10000, 0);
  const hitNormalWorld = new THREE.Vector3();
  const adjacentVoxelPoint = new THREE.Vector3();
  const voxelCellByInstanceId = [];
  const voxelInstanceIdByKey = new Map();
  const voxelColliderByKey = new Map();
  const voxelTypesByName = new Map();
  const freeVoxelIds = [];
  const worldOrigin = world.getMapOrigin(voxelSize);
  const voxelEntries = world.getVoxelEntries();
  const initialVoxelCount = voxelEntries.length;
  const extraVoxelCapacity = 20000;
  const maxVoxelCount = Math.max(initialVoxelCount + extraVoxelCapacity, 1);
  let nextVoxelInstanceId = 0;

  mapGroup.name = world.name || 'World';

  function createBorderedVoxelTexture() {
    const size = 64;
    const border = 1;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);

    context.strokeStyle = 'rgba(120, 120, 120, 0.5)';
    context.lineWidth = border;
    context.strokeRect(border * 0.5, border * 0.5, size - border, size - border);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  function normalizeColor(color = '#ffffff') {
    return typeof color === 'string' && color.trim() ? color.trim() : '#ffffff';
  }

  function normalizeTexture(texture = '') {
    return typeof texture === 'string' && texture.trim() ? texture.trim().toLowerCase() : '';
  }

  function createCellKey(cellX, cellY, cellZ) {
    return `${cellX}|${cellY}|${cellZ}`;
  }

  function setBoxFromCell(cellX, cellY, cellZ, targetBox = new THREE.Box3()) {
    return world.getVoxelBox(cellX, cellY, cellZ, voxelSize, targetBox);
  }

  function createWorldBoundaryColliders() {
    const minX = worldOrigin.x;
    const minY = worldOrigin.y;
    const minZ = worldOrigin.z;
    const maxX = minX + world.size.x * voxelSize;
    const maxY = minY + world.size.y * voxelSize;
    const maxZ = minZ + world.size.z * voxelSize;

    return [
      new THREE.Box3(
        new THREE.Vector3(minX - boundaryThickness, minY, minZ),
        new THREE.Vector3(minX, maxY, maxZ)
      ),
      new THREE.Box3(
        new THREE.Vector3(maxX, minY, minZ),
        new THREE.Vector3(maxX + boundaryThickness, maxY, maxZ)
      ),
      new THREE.Box3(
        new THREE.Vector3(minX, minY - boundaryThickness, minZ),
        new THREE.Vector3(maxX, minY, maxZ)
      ),
      new THREE.Box3(
        new THREE.Vector3(minX, maxY, minZ),
        new THREE.Vector3(maxX, maxY + boundaryThickness, maxZ)
      ),
      new THREE.Box3(
        new THREE.Vector3(minX, minY, minZ - boundaryThickness),
        new THREE.Vector3(maxX, maxY, minZ)
      ),
      new THREE.Box3(
        new THREE.Vector3(minX, minY, maxZ),
        new THREE.Vector3(maxX, maxY, maxZ + boundaryThickness)
      ),
    ];
  }

  function registerVoxelType(voxel = null) {
    const voxelName = String(voxel?.name ?? '').trim();
    if (!voxelName || voxelTypesByName.has(voxelName)) return;

    voxelTypesByName.set(voxelName, {
      name: voxelName,
      type: typeof voxel?.type === 'string' && voxel.type.trim()
        ? voxel.type.trim().toLowerCase()
        : 'colored',
      color: new THREE.Color(normalizeColor(voxel?.color)).getHex(),
      texture: normalizeTexture(voxel?.texture),
    });
  }

  const authoredVoxelTypes = typeof world.getVoxelTypes === 'function'
    ? world.getVoxelTypes()
    : [];
  for (let i = 0; i < authoredVoxelTypes.length; i += 1) {
    registerVoxelType(authoredVoxelTypes[i]);
  }

  function syncVoxelInstance(voxelId, cellX, cellY, cellZ, voxel) {
    const centerPosition = world.gridToMapCenterPosition(cellX, cellY, cellZ, voxelSize);
    instanceMatrix.makeTranslation(
      centerPosition.x,
      centerPosition.y,
      centerPosition.z
    );
    voxelGrid.setMatrixAt(voxelId, instanceMatrix);
    voxelGrid.setColorAt(voxelId, instanceColor.set(normalizeColor(voxel?.color)));
    voxelCellByInstanceId[voxelId] = {
      x: cellX,
      y: cellY,
      z: cellZ,
    };
  }

  function addColliderForCell(cellX, cellY, cellZ) {
    const key = createCellKey(cellX, cellY, cellZ);
    if (voxelColliderByKey.has(key)) {
      return voxelColliderByKey.get(key);
    }

    const collider = setBoxFromCell(cellX, cellY, cellZ).clone();
    voxelColliderByKey.set(key, collider);
    return collider;
  }

  function removeColliderForCell(cellX, cellY, cellZ) {
    const key = createCellKey(cellX, cellY, cellZ);
    const collider = voxelColliderByKey.get(key);
    if (!collider) return false;

    voxelColliderByKey.delete(key);
    return true;
  }

  function getNextVoxelInstanceId() {
    if (freeVoxelIds.length > 0) {
      return freeVoxelIds.pop();
    }

    if (nextVoxelInstanceId >= maxVoxelCount) {
      return null;
    }

    const voxelId = nextVoxelInstanceId;
    nextVoxelInstanceId += 1;
    voxelGrid.count = Math.max(voxelGrid.count, nextVoxelInstanceId);
    return voxelId;
  }

  function syncWorldVoxelAddedAtCell(cellX, cellY, cellZ) {
    const voxel = world.getVoxel(cellX, cellY, cellZ);
    if (!voxel) return false;

    registerVoxelType(voxel);
    const key = createCellKey(cellX, cellY, cellZ);
    const currentVoxelId = voxelInstanceIdByKey.get(key);
    const voxelId = Number.isInteger(currentVoxelId) ? currentVoxelId : getNextVoxelInstanceId();
    if (!Number.isInteger(voxelId)) return false;

    syncVoxelInstance(voxelId, cellX, cellY, cellZ, voxel);
    voxelInstanceIdByKey.set(key, voxelId);
    addColliderForCell(cellX, cellY, cellZ);
    voxelGrid.instanceMatrix.needsUpdate = true;
    if (voxelGrid.instanceColor) {
      voxelGrid.instanceColor.needsUpdate = true;
    }
    return true;
  }

  function syncWorldVoxelRemovedAtCell(cellX, cellY, cellZ) {
    const key = createCellKey(cellX, cellY, cellZ);
    const voxelId = voxelInstanceIdByKey.get(key);
    if (!Number.isInteger(voxelId)) return false;

    voxelGrid.setMatrixAt(voxelId, hiddenInstanceMatrix);
    voxelGrid.instanceMatrix.needsUpdate = true;
    voxelCellByInstanceId[voxelId] = null;
    voxelInstanceIdByKey.delete(key);
    freeVoxelIds.push(voxelId);
    removeColliderForCell(cellX, cellY, cellZ);
    return true;
  }

  function getVoxelCellFromRaycastHit(hit) {
    const cell = voxelCellByInstanceId[hit?.instanceId];
    if (!cell) return null;

    return {
      cellX: cell.x,
      cellY: cell.y,
      cellZ: cell.z,
    };
  }

  function getAdjacentVoxelCellFromRaycastHit(hit) {
    if (!hit || hit.object !== voxelGrid || !hit.face) return null;

    hitNormalWorld.copy(hit.face.normal).transformDirection(voxelGrid.matrixWorld);
    adjacentVoxelPoint.copy(hit.point).addScaledVector(hitNormalWorld, voxelSize * 0.5 + 0.001);

    const adjacentGridPosition = world.mapToGridPosition(
      adjacentVoxelPoint.x,
      adjacentVoxelPoint.y,
      adjacentVoxelPoint.z,
      voxelSize
    );

    return {
      cellX: Math.floor(adjacentGridPosition.x),
      cellY: Math.floor(adjacentGridPosition.y),
      cellZ: Math.floor(adjacentGridPosition.z),
    };
  }

  const voxelGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
  const hasBorderedTexture = voxelEntries.some(entry => normalizeTexture(entry?.voxel?.texture) === 'bordered');
  const voxelMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: hasBorderedTexture ? createBorderedVoxelTexture() : null,
    roughness: 0.95,
    metalness: 0.0,
  });
  const voxelGrid = new THREE.InstancedMesh(
    voxelGeometry,
    voxelMaterial,
    maxVoxelCount
  );

  voxelGrid.name = `${mapGroup.name} Voxels`;
  voxelGrid.receiveShadow = true;
  voxelGrid.count = Math.max(initialVoxelCount, 1);

  for (let i = 0; i < voxelEntries.length; i++) {
    const entry = voxelEntries[i];
    const { position, voxel } = entry;
    registerVoxelType(voxel);
    syncVoxelInstance(i, position.x, position.y, position.z, voxel);
    voxelInstanceIdByKey.set(createCellKey(position.x, position.y, position.z), i);
    addColliderForCell(position.x, position.y, position.z);
    nextVoxelInstanceId = i + 1;
  }

  voxelGrid.instanceMatrix.needsUpdate = true;
  if (voxelGrid.instanceColor) {
    voxelGrid.instanceColor.needsUpdate = true;
  }

  const boundaryColliders = createWorldBoundaryColliders();
  buildingColliders.push(...boundaryColliders);

  mapGroup.add(voxelGrid);
  scene.add(mapGroup);

  return {
    world,
    voxelSize,
    /* Voxel worlds stand on top of their authored land stack, so runtime
    systems should treat that top face as the playable floor height. */
    groundY: world.land.y * voxelSize,
    hasInfiniteGround: false,
    spawnPoint: new THREE.Vector3(
      world.spawnPosition.x,
      world.spawnPosition.y,
      world.spawnPosition.z
    ),
    buildingColliders,
    entities: [],
    raycastTargets: [voxelGrid],
    miniMapStaticLayer: {
      type: 'voxel-grid',
      worldMinX: worldOrigin.x,
      worldMinZ: worldOrigin.z,
      worldWidth: world.size.x * voxelSize,
      worldDepth: world.size.z * voxelSize,
      pixelWidth: world.size.x,
      pixelHeight: world.size.z,
      sampleColor(cellX, cellZ) {
        for (let cellY = world.size.y - 1; cellY >= 0; cellY -= 1) {
          const voxel = world.getVoxel(cellX, cellY, cellZ);
          if (!voxel) continue;
          return voxel.color ?? null;
        }
        return null;
      },
    },
    voxelTypes: Array.from(voxelTypesByName.values()),
    resolveRaycastLabel(hit) {
      const cell = voxelCellByInstanceId[hit?.instanceId];
      if (!cell) return null;
      return world.getVoxel(cell.x, cell.y, cell.z)?.name ?? null;
    },
    getVoxelCellFromRaycastHit,
    getAdjacentVoxelCellFromRaycastHit,
    getVoxelAtCell(cellX, cellY, cellZ) {
      return world.getVoxel(cellX, cellY, cellZ);
    },
    createVoxelFromType(voxelTypeName) {
      const voxelType = voxelTypesByName.get(String(voxelTypeName ?? '').trim());
      if (!voxelType) return null;

      return new Voxel({
        name: voxelType.name,
        color: '#' + voxelType.color.toString(16).padStart(6, '0'),
        texture: voxelType.texture || null,
      });
    },
    syncWorldVoxelAddedAtCell,
    syncWorldVoxelRemovedAtCell,
    intersectColliderBox(box) {
      if (!box) return null;

      for (let i = 0; i < boundaryColliders.length; i++) {
        if (boundaryColliders[i].intersectsBox(box)) {
          return boundaryColliders[i].clone();
        }
      }

      const minGridPosition = world.mapToGridPosition(box.min.x, box.min.y, box.min.z, voxelSize);
      const maxGridPosition = world.mapToGridPosition(box.max.x, box.max.y, box.max.z, voxelSize);
      const minCellX = Math.floor(minGridPosition.x);
      const maxCellX = Math.ceil(maxGridPosition.x) - 1;
      const minCellY = Math.floor(minGridPosition.y);
      const maxCellY = Math.ceil(maxGridPosition.y) - 1;
      const minCellZ = Math.floor(minGridPosition.z);
      const maxCellZ = Math.ceil(maxGridPosition.z) - 1;

      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
          for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
            if (!world.hasVoxel(cellX, cellY, cellZ)) continue;

            setBoxFromCell(cellX, cellY, cellZ, tempCollisionBox);
            if (tempCollisionBox.intersectsBox(box)) {
              return tempCollisionBox.clone();
            }
          }
        }
      }

      return null;
    },
    isBoxSupported(box, epsilon = 0.03) {
      if (!box) return false;

      const minGridPosition = world.mapToGridPosition(box.min.x + 0.001, box.min.y, box.min.z + 0.001, voxelSize);
      const maxGridPosition = world.mapToGridPosition(box.max.x - 0.001, box.max.y, box.max.z - 0.001, voxelSize);
      const supportMinGridPosition = world.mapToGridPosition(box.min.x, box.min.y - epsilon, box.min.z, voxelSize);
      const supportMaxGridPosition = world.mapToGridPosition(box.min.x, box.min.y + epsilon, box.min.z, voxelSize);
      const minCellX = Math.floor(minGridPosition.x);
      const maxCellX = Math.ceil(maxGridPosition.x) - 1;
      const minCellZ = Math.floor(minGridPosition.z);
      const maxCellZ = Math.ceil(maxGridPosition.z) - 1;
      const supportMinY = Math.floor(supportMinGridPosition.y) - 1;
      const supportMaxY = Math.ceil(supportMaxGridPosition.y) - 1;

      for (let cellY = supportMinY; cellY <= supportMaxY; cellY++) {
        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
          for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
            if (world.hasVoxel(cellX, cellY, cellZ)) {
              return true;
            }
          }
        }
      }

      return false;
    },
    collectDebugCollisionBoxes(center, halfExtent = 6, targetBoxes = []) {
      if (!center || !Array.isArray(targetBoxes)) return targetBoxes;

      searchRegion.min.set(
        center.x - halfExtent,
        center.y - halfExtent,
        center.z - halfExtent
      );
      searchRegion.max.set(
        center.x + halfExtent,
        center.y + halfExtent,
        center.z + halfExtent
      );

      const minGridPosition = world.mapToGridPosition(
        searchRegion.min.x,
        searchRegion.min.y,
        searchRegion.min.z,
        voxelSize
      );
      const maxGridPosition = world.mapToGridPosition(
        searchRegion.max.x,
        searchRegion.max.y,
        searchRegion.max.z,
        voxelSize
      );
      const minCellX = Math.floor(minGridPosition.x);
      const maxCellX = Math.floor(maxGridPosition.x);
      const minCellY = Math.floor(minGridPosition.y);
      const maxCellY = Math.floor(maxGridPosition.y);
      const minCellZ = Math.floor(minGridPosition.z);
      const maxCellZ = Math.floor(maxGridPosition.z);

      for (let i = 0; i < boundaryColliders.length; i++) {
        if (searchRegion.intersectsBox(boundaryColliders[i])) {
          targetBoxes.push(boundaryColliders[i].clone());
        }
      }

      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
          for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
            if (!world.hasVoxel(cellX, cellY, cellZ)) continue;
            targetBoxes.push(setBoxFromCell(cellX, cellY, cellZ).clone());
          }
        }
      }

      return targetBoxes;
    },
    shadowRange: Math.max(world.size.x, world.size.z),
    miniMapViewSize: Math.max(world.size.x, world.size.z),
    miniMapHeight: Math.max(world.size.y + 20, 60),
  };
}
