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

  const voxelEntries = world.getVoxelEntries();
  for (let i = 0; i < voxelEntries.length; i++) {
    const entry = voxelEntries[i];
    const mesh = createVoxelMesh(entry);

    voxelMeshes.push(mesh);
    mapGroup.add(mesh);
    buildingColliders.push(new THREE.Box3().setFromObject(mesh));
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
      const voxel = world.getVoxel(cellX, cellY, cellZ);
      if (!voxel) return null;

      return {
        voxelTypeId: voxel.name || 'voxel',
        color: voxel.color,
      };
    },
    shadowRange: Math.max(world.size.x, world.size.z),
    miniMapViewSize: Math.max(world.size.x, world.size.z),
    miniMapHeight: Math.max(world.size.y + 20, 60),
  };
}
