import * as THREE from 'three';
import { Entity, HunterEntity } from '../code/entities/entity.js';

const VOXEL_TYPES = [
  { name: 'red', color: 0xff4040 },
  { name: 'orange', color: 0xff9c33 },
  { name: 'yellow', color: 0xffe066 },
  { name: 'green', color: 0x2fba4e },
  { name: 'lightblue', color: 0x6ccfff },
  { name: 'blue', color: 0x3a6fff },
  { name: 'brown', color: 0x8b5a2b },
  { name: 'pink', color: 0xff7eb6 },
  { name: 'purple', color: 0x8a57ff },
  { name: 'white', color: 0xf5f5f5 },
  { name: 'gray', color: 0x8a8a8a },
  { name: 'black', color: 0x171717 },
];

const ENTITY_MIN_SPAWN_DIST_SQ = 9;

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createWalkerOutfit() {
  const walkerSkinTones = [0xf0c9a5, 0xd8aa89, 0xb78562];
  const walkerShirts = [0xff9a9a, 0xb5d3ff, 0xbff0b1, 0xf7d48b, 0xd8b8ff];
  const walkerPants = [0x3f4d6b, 0x4d4d4d, 0x2e4a3a, 0x5a4638];
  const walkerShoes = [0x1a1a1a, 0x2a1f18, 0x101820];
  const walkerHair = [0x1f130d, 0x3a271a, 0x5a3a23, 0x111111, 0x8b5b2b];
  const walkerFaceEmoji = ['🙂', '😄', '😎', '🤖', '😴', '😶'];
  const shirt = pickRandom(walkerShirts);

  return {
    skin: pickRandom(walkerSkinTones),
    shirt,
    sleeves: shirt,
    pants: pickRandom(walkerPants),
    shoes: pickRandom(walkerShoes),
    hair: pickRandom(walkerHair),
    faceEmoji: pickRandom(walkerFaceEmoji),
  };
}

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

export function buildVoxelandiaMap({
  scene,
  spawnDynamicEntities = true,
}) {
  const gridWidth = 100;
  const gridDepth = 100;
  const gridHeight = 3;
  const voxelSize = 1;
  const groundY = 0;
  const jailWallThickness = 1;
  const jailMinX = -gridWidth * 0.5;
  const jailMaxX = gridWidth * 0.5;
  const jailMinZ = -gridDepth * 0.5;
  const jailMaxZ = gridDepth * 0.5;
  const jailBottomY = -gridHeight;
  const jailTopY = 100;
  const jailColliders = [
    new THREE.Box3(
      new THREE.Vector3(jailMinX - jailWallThickness, jailBottomY, jailMinZ),
      new THREE.Vector3(jailMinX, jailTopY, jailMaxZ)
    ),
    new THREE.Box3(
      new THREE.Vector3(jailMaxX, jailBottomY, jailMinZ),
      new THREE.Vector3(jailMaxX + jailWallThickness, jailTopY, jailMaxZ)
    ),
    new THREE.Box3(
      new THREE.Vector3(jailMinX, jailBottomY, jailMinZ - jailWallThickness),
      new THREE.Vector3(jailMaxX, jailTopY, jailMinZ)
    ),
    new THREE.Box3(
      new THREE.Vector3(jailMinX, jailBottomY, jailMaxZ),
      new THREE.Vector3(jailMaxX, jailTopY, jailMaxZ + jailWallThickness)
    ),
    new THREE.Box3(
      new THREE.Vector3(jailMinX - jailWallThickness, jailBottomY - jailWallThickness, jailMinZ - jailWallThickness),
      new THREE.Vector3(jailMaxX + jailWallThickness, jailBottomY, jailMaxZ + jailWallThickness)
    ),
    new THREE.Box3(
      new THREE.Vector3(jailMinX - jailWallThickness, jailTopY, jailMinZ - jailWallThickness),
      new THREE.Vector3(jailMaxX + jailWallThickness, jailTopY + jailWallThickness, jailMaxZ + jailWallThickness)
    ),
  ];
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

  function parseCellKey(key) {
    if (!key) return null;
    const parts = String(key).split('|');
    if (parts.length !== 3) return null;

    const cellX = Number(parts[0]);
    const cellY = Number(parts[1]);
    const cellZ = Number(parts[2]);
    if (!Number.isFinite(cellX) || !Number.isFinite(cellY) || !Number.isFinite(cellZ)) {
      return null;
    }

    return { cellX, cellY, cellZ };
  }

  function getVoxelCellFromRaycastHit(hit) {
    if (!hit || hit.object !== voxelGrid) return null;
    const voxelId = hit.instanceId;
    if (!Number.isInteger(voxelId)) return null;
    return parseCellKey(voxelIdToKey.get(voxelId));
  }

  function getAdjacentVoxelCellFromRaycastHit(hit) {
    if (!hit || hit.object !== voxelGrid || !hit.face) return null;

    hitNormalWorld.copy(hit.face.normal).transformDirection(voxelGrid.matrixWorld);
    addTargetPoint.copy(hit.point).addScaledVector(hitNormalWorld, voxelSize * 0.5 + 0.001);

    return {
      cellX: toCellCoord(addTargetPoint.x),
      cellY: toCellCoord(addTargetPoint.y),
      cellZ: toCellCoord(addTargetPoint.z),
    };
  }

  function removeVoxelAtCell(cellX, cellY, cellZ) {
    const key = keyFromCell(cellX, cellY, cellZ);
    const voxelId = occupiedVoxels.get(key);
    if (!Number.isInteger(voxelId)) return false;

    voxelGrid.setMatrixAt(voxelId, hiddenMatrix);
    voxelGrid.instanceMatrix.needsUpdate = true;
    occupiedVoxels.delete(key);
    voxelIdToKey.delete(voxelId);
    voxelIdToTypeName.delete(voxelId);
    freeVoxelIds.push(voxelId);
    return true;
  }

  function addVoxelAtCell(cellX, cellY, cellZ, options = {}) {
    const key = keyFromCell(cellX, cellY, cellZ);
    if (occupiedVoxels.has(key) || freeVoxelIds.length === 0) return false;

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
  }

  function getVoxelAtCell(cellX, cellY, cellZ) {
    const voxelId = occupiedVoxels.get(keyFromCell(cellX, cellY, cellZ));
    if (!Number.isInteger(voxelId)) return null;

    const voxelTypeName = voxelIdToTypeName.get(voxelId);
    const voxelType = resolveVoxelType(voxelTypeName);
    return {
      voxelTypeId: voxelType.name,
      color: `#${voxelType.color.toString(16).padStart(6, '0')}`,
    };
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

  function collectVoxelDebugCollisionBoxes(center, halfExtent = 6, targetBoxes = []) {
    if (!center || !Array.isArray(targetBoxes)) return targetBoxes;

    const radius = Math.max(voxelSize, halfExtent);
    const minCellX = Math.floor((center.x - radius) / voxelSize);
    const maxCellX = Math.floor((center.x + radius) / voxelSize);
    const minCellY = Math.floor((center.y - radius) / voxelSize);
    const maxCellY = Math.floor((center.y + radius) / voxelSize);
    const minCellZ = Math.floor((center.z - radius) / voxelSize);
    const maxCellZ = Math.floor((center.z + radius) / voxelSize);

    for (let y = minCellY; y <= maxCellY; y++) {
      for (let x = minCellX; x <= maxCellX; x++) {
        for (let z = minCellZ; z <= maxCellZ; z++) {
          const key = keyFromCell(x, y, z);
          if (!occupiedVoxels.has(key)) continue;
          targetBoxes.push(new THREE.Box3(
            new THREE.Vector3(x * voxelSize, y * voxelSize, z * voxelSize),
            new THREE.Vector3((x + 1) * voxelSize, (y + 1) * voxelSize, (z + 1) * voxelSize)
          ));
        }
      }
    }

    return targetBoxes;
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

  const spawnPoint = new THREE.Vector3(0, 1.7, 0);
  const entities = [];
  const entitySpawnBox = new THREE.Box3();
  const entitySpawnPos = new THREE.Vector3();
  const ENTITY_SPAWN_MARGIN = 0.9;
  const WALKER_COUNT = 3;
  const CHASER_COUNT = 3;

  function collidesAtGround(x, z, halfSize) {
    entitySpawnBox.min.set(x - halfSize, groundY, z - halfSize);
    entitySpawnBox.max.set(x + halfSize, groundY + 2, z + halfSize);
    for (let i = 0; i < jailColliders.length; i++) {
      if (entitySpawnBox.intersectsBox(jailColliders[i])) return true;
    }
    return intersectColliderBox(entitySpawnBox) !== null;
  }

  if (spawnDynamicEntities) {
    /* Multiplayer is moving toward shared dynamic-instance ownership, so this
    authored map only injects its local random NPC set when the caller opts in. */
    let attempts = 0;
    while (entities.length < WALKER_COUNT + CHASER_COUNT && attempts < 1200) {
      attempts++;
      const x = THREE.MathUtils.randFloat(jailMinX + 4, jailMaxX - 4);
      const z = THREE.MathUtils.randFloat(jailMinZ + 4, jailMaxZ - 4);
      if (collidesAtGround(x, z, ENTITY_SPAWN_MARGIN)) continue;
      if (spawnPoint.distanceToSquared(new THREE.Vector3(x, spawnPoint.y, z)) < 64) continue;

      let tooClose = false;
      entitySpawnPos.set(x, groundY, z);
      for (let i = 0; i < entities.length; i++) {
        if (entities[i].position.distanceToSquared(entitySpawnPos) < ENTITY_MIN_SPAWN_DIST_SQ) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      if (entities.length < WALKER_COUNT) {
        entities.push(new Entity({
          scene,
          position: entitySpawnPos,
          groundY,
          outfit: createWalkerOutfit(),
          speed: THREE.MathUtils.randFloat(1.2, 2.1),
          clearance: 1.0,
        }));
      } else {
        entities.push(new HunterEntity({
          scene,
          position: entitySpawnPos,
          groundY,
          color: 0x7e1313,
          speed: THREE.MathUtils.randFloat(2.0, 2.8),
          clearance: 1.0,
          detectionRadius: 10.0,
          stopDistance: 1.5,
        }));
      }
    }
  }

  return {
    groundY,
    hasInfiniteGround: false,
    voxelTypes: VOXEL_TYPES.map(type => ({ ...type })),
    spawnPoint,
    buildingColliders: jailColliders,
    entities,
    intersectColliderBox,
    isBoxSupported,
    collectDebugCollisionBoxes(center, halfExtent = 6, targetBoxes = []) {
      collectVoxelDebugCollisionBoxes(center, halfExtent, targetBoxes);
      if (!center || !Array.isArray(targetBoxes)) return targetBoxes;

      const radius = Math.max(voxelSize, halfExtent);
      const debugRegion = new THREE.Box3(
        new THREE.Vector3(center.x - radius, center.y - radius, center.z - radius),
        new THREE.Vector3(center.x + radius, center.y + radius, center.z + radius)
      );

      for (let i = 0; i < jailColliders.length; i++) {
        if (debugRegion.intersectsBox(jailColliders[i])) {
          targetBoxes.push(jailColliders[i].clone());
        }
      }

      return targetBoxes;
    },
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
      const voxelCell = getVoxelCellFromRaycastHit(hit);
      if (!voxelCell) return false;
      return removeVoxelAtCell(voxelCell.cellX, voxelCell.cellY, voxelCell.cellZ);
    },
    addVoxelAtRaycastHit(hit, options = {}) {
      if (!hit || hit.object !== voxelGrid) return false;
      if (!hit.face || freeVoxelIds.length === 0) return false;

      const adjacentCell = getAdjacentVoxelCellFromRaycastHit(hit);
      if (!adjacentCell) return false;
      return addVoxelAtCell(adjacentCell.cellX, adjacentCell.cellY, adjacentCell.cellZ, options);
    },
    getVoxelCellFromRaycastHit,
    getAdjacentVoxelCellFromRaycastHit,
    getVoxelAtCell,
    addVoxelAtCell,
    removeVoxelAtCell,
    shadowRange: 90,
    miniMapViewSize: 130,
    miniMapHeight: 170,
  };
}
