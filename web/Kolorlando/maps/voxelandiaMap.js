import * as THREE from 'three';

const VOXEL_TYPES = [
  { name: 'red', color: 0xff4040 },
  { name: 'orange', color: 0xff9c33 },
  { name: 'yellow', color: 0xffe066 },
  { name: 'green', color: 0x2fba4e },
  { name: 'lightblue', color: 0x6ccfff },
  { name: 'blue', color: 0x3a6fff },
  { name: 'magenta', color: 0xff4fd0 },
  { name: 'fuchsia', color: 0xdf4bff },
  { name: 'purple', color: 0x8a57ff },
  { name: 'white', color: 0xf5f5f5 },
  { name: 'gray', color: 0x8a8a8a },
  { name: 'black', color: 0x171717 },
];

function createBorderedVoxelTexture() {
  const size = 64;
  const border = 1;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(120, 120, 120, 0.5)';
  ctx.lineWidth = border;
  ctx.strokeRect(border * 0.5, border * 0.5, size - border, size - border);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function buildVoxelandiaMap({ scene }) {
  const gridWidth = 100;
  const gridDepth = 100;
  const gridHeight = 3;
  const voxelSize = 1;
  const groundY = 0;
  const initialVoxelCount = gridWidth * gridDepth * gridHeight;
  const extraVoxelCapacity = 20000;
  const maxVoxelCount = initialVoxelCount + extraVoxelCapacity;

  const voxelGeo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
  const voxelTexture = createBorderedVoxelTexture();
  const voxelMat = new THREE.MeshStandardMaterial({
    map: voxelTexture,
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
  });

  const voxelGrid = new THREE.InstancedMesh(voxelGeo, voxelMat, maxVoxelCount);
  voxelGrid.castShadow = false;
  voxelGrid.receiveShadow = true;
  voxelGrid.name = 'Voxelandia';

  const startX = -gridWidth * 0.5 + voxelSize * 0.5;
  const startZ = -gridDepth * 0.5 + voxelSize * 0.5;
  const startY = groundY - voxelSize * 0.5;

  const matrix = new THREE.Matrix4();
  const hiddenMatrix = new THREE.Matrix4().makeTranslation(0, -10000, 0);
  const hitNormalWorld = new THREE.Vector3();
  const addTargetPoint = new THREE.Vector3();
  const collisionBox = new THREE.Box3();
  const tmpInstanceColor = new THREE.Color();
  const voxelTypesByName = new Map(VOXEL_TYPES.map(type => [type.name, type]));
  const occupiedVoxels = new Map();
  const voxelIdToKey = new Map();
  const voxelIdToTypeName = new Map();
  const freeVoxelIds = [];
  let index = 0;

  function resolveVoxelType(typeName) {
    return voxelTypesByName.get(typeName) ?? voxelTypesByName.get('green');
  }

  function toCellCoord(coord) {
    return Math.round(coord / voxelSize - 0.5);
  }

  function toCellCenter(cell) {
    return (cell + 0.5) * voxelSize;
  }

  function keyFromCell(x, y, z) {
    return `${x}|${y}|${z}`;
  }

  function setCollisionBoxFromCell(cellX, cellY, cellZ) {
    const minX = cellX * voxelSize;
    const minY = cellY * voxelSize;
    const minZ = cellZ * voxelSize;
    collisionBox.min.set(minX, minY, minZ);
    collisionBox.max.set(minX + voxelSize, minY + voxelSize, minZ + voxelSize);
    return collisionBox;
  }

  function setBoxFromKey(key, targetBox) {
    if (!key || !targetBox) return null;
    const parts = key.split('|');
    if (parts.length !== 3) return null;
    const cellX = Number(parts[0]);
    const cellY = Number(parts[1]);
    const cellZ = Number(parts[2]);
    if (!Number.isFinite(cellX) || !Number.isFinite(cellY) || !Number.isFinite(cellZ)) return null;

    const minX = cellX * voxelSize;
    const minY = cellY * voxelSize;
    const minZ = cellZ * voxelSize;
    targetBox.min.set(minX, minY, minZ);
    targetBox.max.set(minX + voxelSize, minY + voxelSize, minZ + voxelSize);
    return targetBox;
  }

  function intersectColliderBox(box) {
    const overlapEpsilon = 0.001;
    const minCellX = Math.floor(box.min.x / voxelSize);
    const maxCellX = Math.ceil(box.max.x / voxelSize) - 1;
    const minCellY = Math.floor(box.min.y / voxelSize);
    const maxCellY = Math.ceil(box.max.y / voxelSize) - 1;
    const minCellZ = Math.floor(box.min.z / voxelSize);
    const maxCellZ = Math.ceil(box.max.z / voxelSize) - 1;

    for (let y = minCellY; y <= maxCellY; y++) {
      for (let x = minCellX; x <= maxCellX; x++) {
        for (let z = minCellZ; z <= maxCellZ; z++) {
          if (!occupiedVoxels.has(keyFromCell(x, y, z))) continue;
          const voxelMinY = y * voxelSize;
          const voxelMaxY = voxelMinY + voxelSize;
          const hasVerticalPenetration =
            box.min.y < voxelMaxY - overlapEpsilon &&
            box.max.y > voxelMinY + overlapEpsilon;
          if (!hasVerticalPenetration) continue;
          return setCollisionBoxFromCell(x, y, z);
        }
      }
    }

    return null;
  }

  function isBoxSupported(box, epsilon = 0.03) {
    const minCellX = Math.floor((box.min.x + 0.001) / voxelSize);
    const maxCellX = Math.ceil((box.max.x - 0.001) / voxelSize) - 1;
    const minCellZ = Math.floor((box.min.z + 0.001) / voxelSize);
    const maxCellZ = Math.ceil((box.max.z - 0.001) / voxelSize) - 1;

    if (maxCellX < minCellX || maxCellZ < minCellZ) {
      return false;
    }

    const topCellLevel = box.min.y / voxelSize - 1;
    const minCellY = Math.floor(topCellLevel - epsilon / voxelSize);
    const maxCellY = Math.ceil(topCellLevel + epsilon / voxelSize);

    for (let y = minCellY; y <= maxCellY; y++) {
      const topY = (y + 1) * voxelSize;
      if (Math.abs(topY - box.min.y) > epsilon) continue;

      for (let x = minCellX; x <= maxCellX; x++) {
        for (let z = minCellZ; z <= maxCellZ; z++) {
          if (occupiedVoxels.has(keyFromCell(x, y, z))) {
            return true;
          }
        }
      }
    }

    return false;
  }

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      for (let z = 0; z < gridDepth; z++) {
        const centerX = startX + x * voxelSize;
        const centerY = startY - y * voxelSize;
        const centerZ = startZ + z * voxelSize;
        matrix.makeTranslation(centerX, centerY, centerZ);
        voxelGrid.setMatrixAt(index, matrix);
        const voxelType = resolveVoxelType('green');
        voxelGrid.setColorAt(index, tmpInstanceColor.setHex(voxelType.color));
        const key = keyFromCell(
          toCellCoord(centerX),
          toCellCoord(centerY),
          toCellCoord(centerZ)
        );
        occupiedVoxels.set(key, index);
        voxelIdToKey.set(index, key);
        voxelIdToTypeName.set(index, voxelType.name);
        index++;
      }
    }
  }

  for (let i = initialVoxelCount; i < maxVoxelCount; i++) {
    voxelGrid.setMatrixAt(i, hiddenMatrix);
    voxelGrid.setColorAt(i, tmpInstanceColor.setHex(0xffffff));
    freeVoxelIds.push(i);
  }

  voxelGrid.instanceMatrix.needsUpdate = true;
  if (voxelGrid.instanceColor) {
    voxelGrid.instanceColor.needsUpdate = true;
  }
  scene.add(voxelGrid);

  return {
    groundY,
    hasInfiniteGround: false,
    voxelTypes: VOXEL_TYPES.map(type => ({ ...type })),
    spawnPoint: new THREE.Vector3(0, 1.7, 0),
    buildingColliders: [],
    entities: [],
    intersectColliderBox,
    isBoxSupported,
    getVoxelBoxFromRaycastHit(hit, targetBox) {
      if (!hit || hit.object !== voxelGrid || !targetBox) return null;
      const voxelId = hit.instanceId;
      if (!Number.isInteger(voxelId)) return null;
      const key = voxelIdToKey.get(voxelId);
      if (!key) return null;
      return setBoxFromKey(key, targetBox);
    },
    raycastTargets: [voxelGrid],
    resolveRaycastLabel(hit) {
      if (!hit || hit.object !== voxelGrid) return null;
      const voxelId = hit.instanceId;
      if (!Number.isInteger(voxelId)) return null;
      return voxelIdToTypeName.get(voxelId) ?? null;
    },
    removeVoxelAtRaycastHit(hit) {
      if (!hit || hit.object !== voxelGrid) return false;
      const voxelId = hit.instanceId;
      if (!Number.isInteger(voxelId)) return false;
      const key = voxelIdToKey.get(voxelId);
      if (!key) return false;

      voxelGrid.setMatrixAt(voxelId, hiddenMatrix);
      voxelGrid.instanceMatrix.needsUpdate = true;
      occupiedVoxels.delete(key);
      voxelIdToKey.delete(voxelId);
      voxelIdToTypeName.delete(voxelId);
      freeVoxelIds.push(voxelId);
      return true;
    },
    addVoxelAtRaycastHit(hit, options = {}) {
      if (!hit || hit.object !== voxelGrid) return false;
      if (!hit.face || freeVoxelIds.length === 0) return false;

      hitNormalWorld.copy(hit.face.normal).transformDirection(voxelGrid.matrixWorld);
      addTargetPoint.copy(hit.point).addScaledVector(hitNormalWorld, voxelSize * 0.5 + 0.001);

      const cellX = toCellCoord(addTargetPoint.x);
      const cellY = toCellCoord(addTargetPoint.y);
      const cellZ = toCellCoord(addTargetPoint.z);
      const key = keyFromCell(cellX, cellY, cellZ);

      if (occupiedVoxels.has(key)) return false;
      const playerCollider = options.playerCollider;
      const candidateBox = setCollisionBoxFromCell(cellX, cellY, cellZ);
      if (playerCollider && candidateBox.intersectsBox(playerCollider)) return false;

      const voxelType = resolveVoxelType(options.voxelType);
      const voxelId = freeVoxelIds.pop();
      matrix.makeTranslation(
        toCellCenter(cellX),
        toCellCenter(cellY),
        toCellCenter(cellZ)
      );
      voxelGrid.setMatrixAt(voxelId, matrix);
      voxelGrid.setColorAt(voxelId, tmpInstanceColor.setHex(voxelType.color));
      voxelGrid.instanceMatrix.needsUpdate = true;
      if (voxelGrid.instanceColor) {
        voxelGrid.instanceColor.needsUpdate = true;
      }
      occupiedVoxels.set(key, voxelId);
      voxelIdToKey.set(voxelId, key);
      voxelIdToTypeName.set(voxelId, voxelType.name);
      return true;
    },
    shadowRange: 90,
    miniMapViewSize: 130,
    miniMapHeight: 170,
  };
}
