import * as THREE from 'three';
import { World } from '../code/data/World.js';

/*

edit flow X
collision helpers V
dynamic entities X
map boundary colliders V

rendering scalability
voxelandiaMap.js used InstancedMesh
current MapGenerator uses one mesh per voxel
coordinate convention
voxelandiaMap.js centered the world around origin
MapGenerator currently builds from 0,0,0

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
  const voxelCellByInstanceId = [];
  const worldOrigin = world.getMapOrigin(voxelSize);

  mapGroup.name = world.name || 'World';

  function normalizeColor(color = '#ffffff') {
    return typeof color === 'string' && color.trim() ? color.trim() : '#ffffff';
  }

  function setBoxFromCell(cellX, cellY, cellZ, targetBox = new THREE.Box3()) {
    const minPosition = world.gridToMapPosition(cellX, cellY, cellZ, voxelSize);
    targetBox.min.set(minPosition.x, minPosition.y, minPosition.z);
    targetBox.max.set(
      targetBox.min.x + voxelSize,
      targetBox.min.y + voxelSize,
      targetBox.min.z + voxelSize
    );
    return targetBox;
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

  const voxelEntries = world.getVoxelEntries();
  const voxelGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
  const voxelMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
  });
  const voxelGrid = new THREE.InstancedMesh(
    voxelGeometry,
    voxelMaterial,
    Math.max(voxelEntries.length, 1)
  );

  voxelGrid.name = `${mapGroup.name} Voxels`;
  voxelGrid.receiveShadow = true;

  for (let i = 0; i < voxelEntries.length; i++) {
    const entry = voxelEntries[i];
    const { position, voxel } = entry;
    const centerPosition = world.gridToMapCenterPosition(position.x, position.y, position.z, voxelSize);

    instanceMatrix.makeTranslation(
      centerPosition.x,
      centerPosition.y,
      centerPosition.z
    );
    voxelGrid.setMatrixAt(i, instanceMatrix);
    voxelGrid.setColorAt(i, instanceColor.set(normalizeColor(voxel.color)));
    voxelCellByInstanceId[i] = {
      x: position.x,
      y: position.y,
      z: position.z,
    };

    // Runtime colliders stay derived from authored world voxels.
    buildingColliders.push(setBoxFromCell(position.x, position.y, position.z).clone());
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
    groundY: 0,
    hasInfiniteGround: false,
    spawnPoint: new THREE.Vector3(
      world.spawnPosition.x,
      world.spawnPosition.y,
      world.spawnPosition.z
    ),
    buildingColliders,
    entities: [],
    raycastTargets: [voxelGrid],
    resolveRaycastLabel(hit) {
      const cell = voxelCellByInstanceId[hit?.instanceId];
      if (!cell) return null;
      return world.getVoxel(cell.x, cell.y, cell.z)?.name ?? null;
    },
    getVoxelCellFromRaycastHit(hit) {
      const cell = voxelCellByInstanceId[hit?.instanceId];
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
