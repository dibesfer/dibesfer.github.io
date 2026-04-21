import * as THREE from 'three';
import { World } from '../code/data/World.js';

/*

edit flow X
collision helpers 
dynamic entities
map boundary colliders

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
  const voxelMeshes = [];
  const buildingColliders = [];
  const materialByColor = new Map();
  const tempCollisionBox = new THREE.Box3();
  const searchRegion = new THREE.Box3();

  mapGroup.name = world.name || 'World';

  function getMaterial(color = '#ffffff') {
    const normalizedColor = typeof color === 'string' && color.trim() ? color.trim() : '#ffffff';

    if (!materialByColor.has(normalizedColor)) {
      materialByColor.set(normalizedColor, new THREE.MeshStandardMaterial({
        color: normalizedColor,
        roughness: 0.95,
        metalness: 0.0,
      }));
    }

    return materialByColor.get(normalizedColor);
  }

  function createVoxelMesh(entry) {
    const { position, voxel } = entry;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize),
      getMaterial(voxel.color)
    );

    // Keep the cell reference on the mesh so raycasts can resolve back to world data.
    mesh.position.set(
      position.x * voxelSize + voxelSize * 0.5,
      position.y * voxelSize + voxelSize * 0.5,
      position.z * voxelSize + voxelSize * 0.5
    );
    mesh.receiveShadow = true;
    mesh.userData.voxelCell = {
      x: position.x,
      y: position.y,
      z: position.z,
    };

    return mesh;
  }

  function setBoxFromCell(cellX, cellY, cellZ, targetBox = new THREE.Box3()) {
    targetBox.min.set(
      cellX * voxelSize,
      cellY * voxelSize,
      cellZ * voxelSize
    );
    targetBox.max.set(
      targetBox.min.x + voxelSize,
      targetBox.min.y + voxelSize,
      targetBox.min.z + voxelSize
    );
    return targetBox;
  }

  const voxelEntries = world.getVoxelEntries();
  for (let i = 0; i < voxelEntries.length; i++) {
    const entry = voxelEntries[i];
    const mesh = createVoxelMesh(entry);
    const { position } = entry;

    voxelMeshes.push(mesh);
    mapGroup.add(mesh);
    // Runtime colliders stay derived from authored world voxels.
    buildingColliders.push(setBoxFromCell(position.x, position.y, position.z).clone());
  }

  scene.add(mapGroup);

  return {
    groundY: 0,
    hasInfiniteGround: false,
    spawnPoint: new THREE.Vector3(
      world.spawnPosition.x,
      world.spawnPosition.y,
      world.spawnPosition.z
    ),
    buildingColliders,
    entities: [],
    raycastTargets: voxelMeshes,
    resolveRaycastLabel(hit) {
      const cell = hit?.object?.userData?.voxelCell;
      if (!cell) return null;
      return world.getVoxel(cell.x, cell.y, cell.z)?.name ?? null;
    },
    getVoxelCellFromRaycastHit(hit) {
      const cell = hit?.object?.userData?.voxelCell;
      if (!cell) return null;

      return {
        cellX: cell.x,
        cellY: cell.y,
        cellZ: cell.z,
      };
    },
    getVoxelAtCell(cellX, cellY, cellZ) {
      return world.getVoxel(cellX, cellY, cellZ);
    },
    intersectColliderBox(box) {
      if (!box) return null;

      const minCellX = Math.floor(box.min.x / voxelSize);
      const maxCellX = Math.ceil(box.max.x / voxelSize) - 1;
      const minCellY = Math.floor(box.min.y / voxelSize);
      const maxCellY = Math.ceil(box.max.y / voxelSize) - 1;
      const minCellZ = Math.floor(box.min.z / voxelSize);
      const maxCellZ = Math.ceil(box.max.z / voxelSize) - 1;

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

      const minCellX = Math.floor((box.min.x + 0.001) / voxelSize);
      const maxCellX = Math.ceil((box.max.x - 0.001) / voxelSize) - 1;
      const minCellZ = Math.floor((box.min.z + 0.001) / voxelSize);
      const maxCellZ = Math.ceil((box.max.z - 0.001) / voxelSize) - 1;
      const supportMinY = Math.floor((box.min.y - epsilon) / voxelSize) - 1;
      const supportMaxY = Math.ceil((box.min.y + epsilon) / voxelSize) - 1;

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

      const minCellX = Math.floor(searchRegion.min.x / voxelSize);
      const maxCellX = Math.floor(searchRegion.max.x / voxelSize);
      const minCellY = Math.floor(searchRegion.min.y / voxelSize);
      const maxCellY = Math.floor(searchRegion.max.y / voxelSize);
      const minCellZ = Math.floor(searchRegion.min.z / voxelSize);
      const maxCellZ = Math.floor(searchRegion.max.z / voxelSize);

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
