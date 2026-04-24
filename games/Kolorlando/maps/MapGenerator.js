import * as THREE from 'three';
import { World } from '../code/data/World.js';
import { Voxel, VoxelPlane, VoxelPlaneText } from '../code/data/Voxel.js';

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
  const faceOffsetVector = new THREE.Vector3();
  const hitNormalWorld = new THREE.Vector3();
  const adjacentVoxelPoint = new THREE.Vector3();
  const voxelFaceInstanceIdsByKey = new Map();
  const voxelColliderByKey = new Map();
  const voxelTypesByName = new Map();
  const texturedVoxelMeshByKey = new Map();
  const planeRaycastMeshByKey = new Map();
  const freeVoxelFaceIdsByName = new Map();
  const worldOrigin = world.getMapOrigin(voxelSize);
  const voxelEntries = world.getVoxelEntries({ activeChunksOnly: true });
  const pendingChunkVisualJobs = [];
  const pendingChunkBoundaryJobs = [];
  const initialVoxelCount = voxelEntries.length;
  const extraVoxelCapacity = 20000;
  const maxVoxelCount = Math.max(initialVoxelCount + extraVoxelCapacity, 1);
  const textureLoader = new THREE.TextureLoader();
  const voxelFaceTextureCache = new Map();
  const HIDDEN_FACE_MATERIAL = new THREE.MeshStandardMaterial({ visible: false });
  const FACE_NEIGHBOR_OFFSETS = {
    right: { x: 1, y: 0, z: 0 },
    left: { x: -1, y: 0, z: 0 },
    top: { x: 0, y: 1, z: 0 },
    bottom: { x: 0, y: -1, z: 0 },
    front: { x: 0, y: 0, z: 1 },
    back: { x: 0, y: 0, z: -1 },
  };
  const TEXTURED_FACE_ORDER = ['right', 'left', 'top', 'bottom', 'front', 'back'];
  const SOLID_FACE_TRANSFORMS = {
    right: { normal: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI * 0.5, z: 0 } },
    left: { normal: { x: -1, y: 0, z: 0 }, rotation: { x: 0, y: -Math.PI * 0.5, z: 0 } },
    top: { normal: { x: 0, y: 1, z: 0 }, rotation: { x: -Math.PI * 0.5, y: 0, z: 0 } },
    bottom: { normal: { x: 0, y: -1, z: 0 }, rotation: { x: Math.PI * 0.5, y: 0, z: 0 } },
    front: { normal: { x: 0, y: 0, z: 1 }, rotation: { x: 0, y: 0, z: 0 } },
    back: { normal: { x: 0, y: 0, z: -1 }, rotation: { x: 0, y: Math.PI, z: 0 } },
  };

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

  function cloneTextureSpec(texture = '') {
    if (typeof texture === 'string') {
      return texture.trim();
    }

    if (!texture || typeof texture !== 'object' || Array.isArray(texture)) {
      return '';
    }

    return { ...texture };
  }

  function resolveVoxelTextureFaces(voxel = null) {
    if (typeof voxel?.getResolvedTextureFaces === 'function') {
      return voxel.getResolvedTextureFaces();
    }

    return null;
  }

  function hasImageTextureFaces(voxel = null) {
    const resolvedFaces = resolveVoxelTextureFaces(voxel);
    if (!resolvedFaces) return false;

    return Object.values(resolvedFaces).some(faceTexture => normalizeTexture(faceTexture) !== 'bordered');
  }

  function isVoxelPlane(voxel = null) {
    return voxel instanceof VoxelPlane || voxel?.shape === 'plane';
  }

  function isVoxelPlaneText(voxel = null) {
    return voxel instanceof VoxelPlaneText || voxel?.contentType === 'text';
  }

  function getVoxelPlaneFace(voxel = null) {
    return typeof voxel?.planeFace === 'string' && voxel.planeFace.trim()
      ? voxel.planeFace.trim()
      : 'front';
  }

  function isCollidableVoxel(voxel = null) {
    return Boolean(voxel) && !isVoxelPlane(voxel);
  }

  function isTransparentVoxel(voxel = null) {
    return Boolean(voxel?.transparent);
  }

  function isOpaqueCubeVoxel(voxel = null) {
    return Boolean(voxel)
      && !isVoxelPlane(voxel)
      && !isTransparentVoxel(voxel)
      && !hasImageTextureFaces(voxel);
  }

  function getVoxelRotation(voxel = null) {
    const rotation = voxel?.rotation;
    if (!rotation || typeof rotation !== 'object' || Array.isArray(rotation)) {
      return { x: 0, y: 0, z: 0 };
    }

    return {
      x: Number.isFinite(rotation.x) ? rotation.x : 0,
      y: Number.isFinite(rotation.y) ? rotation.y : 0,
      z: Number.isFinite(rotation.z) ? rotation.z : 0,
    };
  }

  function applyVoxelMeshRotation(mesh, voxel = null) {
    if (!mesh?.rotation) return;

    const rotation = getVoxelRotation(voxel);
    mesh.rotation.x += rotation.x;
    mesh.rotation.y += rotation.y;
    mesh.rotation.z += rotation.z;
  }

  function shouldRenderVoxelFace(cellX, cellY, cellZ, faceName, voxel = null) {
    const neighborOffset = FACE_NEIGHBOR_OFFSETS[faceName];
    if (!neighborOffset) return true;

    const neighborCellX = cellX + neighborOffset.x;
    const neighborCellY = cellY + neighborOffset.y;
    const neighborCellZ = cellZ + neighborOffset.z;
    if (!world.isVoxelCellActive(neighborCellX, neighborCellY, neighborCellZ)) {
      return true;
    }

    const neighborVoxel = world.getVoxel(
      neighborCellX,
      neighborCellY,
      neighborCellZ
    );

    if (!neighborVoxel) {
      return true;
    }

    const currentTransparent = isTransparentVoxel(voxel);
    const neighborTransparent = isTransparentVoxel(neighborVoxel);

    if (currentTransparent && neighborTransparent) {
      return false;
    }

    if (currentTransparent && !neighborTransparent) {
      return true;
    }

    if (!currentTransparent && neighborTransparent) {
      return true;
    }

    return false;
  }

  function getChunkLocalNeighborVoxel(chunkPosition, localPosition, offset) {
    const chunkEntry = world.getChunkEntry(chunkPosition.x, chunkPosition.y, chunkPosition.z);
    if (!chunkEntry?.boxel) return null;

    return chunkEntry.boxel.get(
      localPosition.x + offset.x,
      localPosition.y + offset.y,
      localPosition.z + offset.z
    );
  }

  function getNeighborVoxelForCulling(cellX, cellY, cellZ, faceName) {
    const neighborOffset = FACE_NEIGHBOR_OFFSETS[faceName];
    if (!neighborOffset) return null;

    const voxelAddress = world.getChunkVoxelAddress(cellX, cellY, cellZ);
    const chunkSize = world.getChunkSize();
    const nextLocalX = voxelAddress.local.x + neighborOffset.x;
    const nextLocalY = voxelAddress.local.y + neighborOffset.y;
    const nextLocalZ = voxelAddress.local.z + neighborOffset.z;
    const neighborIsInsideChunk = (
      nextLocalX >= 0 && nextLocalX < chunkSize
      && nextLocalY >= 0 && nextLocalY < chunkSize
      && nextLocalZ >= 0 && nextLocalZ < chunkSize
    );

    if (neighborIsInsideChunk) {
      const localNeighborVoxel = getChunkLocalNeighborVoxel(
        voxelAddress.chunk,
        voxelAddress.local,
        neighborOffset
      );
      return localNeighborVoxel?.active === true ? localNeighborVoxel : null;
    }

    const neighborCellX = cellX + neighborOffset.x;
    const neighborCellY = cellY + neighborOffset.y;
    const neighborCellZ = cellZ + neighborOffset.z;
    if (!world.isVoxelCellActive(neighborCellX, neighborCellY, neighborCellZ)) {
      return null;
    }

    return world.getVoxel(neighborCellX, neighborCellY, neighborCellZ);
  }

  function isVoxelFullyOccluded(cellX, cellY, cellZ, voxel = null) {
    if (!isOpaqueCubeVoxel(voxel)) {
      return false;
    }

    for (const faceName of TEXTURED_FACE_ORDER) {
      const neighborVoxel = getNeighborVoxelForCulling(cellX, cellY, cellZ, faceName);
      if (!isOpaqueCubeVoxel(neighborVoxel)) {
        return false;
      }
    }

    return true;
  }

  function getVisibleSolidFaces(cellX, cellY, cellZ, voxel = null) {
    if (!isOpaqueCubeVoxel(voxel)) {
      return [];
    }

    return TEXTURED_FACE_ORDER.filter(faceName => shouldRenderVoxelFace(cellX, cellY, cellZ, faceName, voxel));
  }

  function shouldRenderVoxelPlane(cellX, cellY, cellZ, voxel = null) {
    if (!isVoxelPlane(voxel)) {
      return false;
    }

    return shouldRenderVoxelFace(cellX, cellY, cellZ, getVoxelPlaneFace(voxel), voxel);
  }

  function getLoadedVoxelFaceTexture(texturePath = '') {
    const normalizedPath = typeof texturePath === 'string' ? texturePath.trim() : '';
    if (!normalizedPath) return null;

    if (voxelFaceTextureCache.has(normalizedPath)) {
      return voxelFaceTextureCache.get(normalizedPath);
    }

    const texture = textureLoader.load(normalizedPath);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    voxelFaceTextureCache.set(normalizedPath, texture);
    return texture;
  }

  function createTexturedVoxelMesh(cellX, cellY, cellZ, voxel = null) {
    const resolvedFaces = resolveVoxelTextureFaces(voxel);
    if (!resolvedFaces) return null;

    const faceMaterials = TEXTURED_FACE_ORDER.map(faceName => {
      if (!shouldRenderVoxelFace(cellX, cellY, cellZ, faceName, voxel)) {
        return HIDDEN_FACE_MATERIAL;
      }

      const faceTexture = resolvedFaces[faceName];
      const resolvedTexture = getLoadedVoxelFaceTexture(faceTexture);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: resolvedTexture,
        transparent: true,
        alphaTest: 0.5,
        side: isTransparentVoxel(voxel) ? THREE.DoubleSide : THREE.FrontSide,
        roughness: 0.95,
        metalness: 0.0,
      });
    });
    const mesh = new THREE.Mesh(voxelRaycastGeometry, faceMaterials);
    const centerPosition = world.gridToMapCenterPosition(cellX, cellY, cellZ, voxelSize);

    mesh.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    applyVoxelMeshRotation(mesh, voxel);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.voxelCell = {
      x: cellX,
      y: cellY,
      z: cellZ,
    };

    return mesh;
  }

  function createVoxelPlaneMesh(cellX, cellY, cellZ, voxel = null) {
    const planeFace = getVoxelPlaneFace(voxel);
    if (!shouldRenderVoxelPlane(cellX, cellY, cellZ, voxel)) {
      return null;
    }
    const inset = Number.isFinite(voxel?.inset) ? voxel.inset : 0;
    const textureHref = normalizeTexture(voxel?.texture) ? String(voxel.texture).trim() : '';
    const planeGeometry = new THREE.PlaneGeometry(voxelSize, voxelSize);
    const resolvedTexture = isVoxelPlaneText(voxel)
      ? createTextPlaneCanvasTexture(voxel)
      : textureHref ? getLoadedVoxelFaceTexture(textureHref) : null;
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: normalizeColor(voxel?.color),
      map: resolvedTexture,
      transparent: Boolean(voxel?.transparent) || Boolean(resolvedTexture),
      alphaTest: voxel?.transparent ? 0.5 : 0,
      side: voxel?.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: 0.95,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(planeGeometry, planeMaterial);
    const centerPosition = world.gridToMapCenterPosition(cellX, cellY, cellZ, voxelSize);
    const halfVoxel = voxelSize * 0.5;
    const insetOffset = THREE.MathUtils.clamp(inset, 0, halfVoxel);

    mesh.position.set(centerPosition.x, centerPosition.y, centerPosition.z);

    if (planeFace === 'front') {
      mesh.position.z += halfVoxel - insetOffset;
      mesh.rotation.y = Math.PI;
    } else if (planeFace === 'back') {
      mesh.position.z -= halfVoxel - insetOffset;
      mesh.rotation.y = 0;
    } else if (planeFace === 'left') {
      mesh.position.x -= halfVoxel - insetOffset;
      mesh.rotation.y = Math.PI * 0.5;
    } else if (planeFace === 'right') {
      mesh.position.x += halfVoxel - insetOffset;
      mesh.rotation.y = -Math.PI * 0.5;
    } else if (planeFace === 'top') {
      mesh.position.y += halfVoxel - insetOffset;
      mesh.rotation.x = Math.PI * 0.5;
    } else if (planeFace === 'bottom') {
      mesh.position.y -= halfVoxel - insetOffset;
      mesh.rotation.x = -Math.PI * 0.5;
    }

    applyVoxelMeshRotation(mesh, voxel);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.voxelCell = { x: cellX, y: cellY, z: cellZ };
    return mesh;
  }

  function createPlaneRaycastMesh(cellX, cellY, cellZ) {
    const mesh = new THREE.Mesh(voxelRaycastGeometry, planeRaycastMaterial);
    const centerPosition = world.gridToMapCenterPosition(cellX, cellY, cellZ, voxelSize);

    mesh.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    mesh.userData.voxelCell = { x: cellX, y: cellY, z: cellZ };
    return mesh;
  }

  function createTextPlaneCanvasTexture(voxel = null) {
    if (typeof voxel?.createCanvasTextureSource !== 'function') {
      return null;
    }

    const texture = new THREE.CanvasTexture(voxel.createCanvasTextureSource());
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
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
      shape: isVoxelPlane(voxel) ? 'plane' : 'voxel',
      contentType: isVoxelPlaneText(voxel) ? 'text' : null,
      type: typeof voxel?.type === 'string' && voxel.type.trim()
        ? voxel.type.trim().toLowerCase()
        : 'colored',
      color: new THREE.Color(normalizeColor(voxel?.color)).getHex(),
      texture: cloneTextureSpec(voxel?.texture),
      transparent: isTransparentVoxel(voxel),
      rotation: getVoxelRotation(voxel),
      planeFace: typeof voxel?.planeFace === 'string' ? voxel.planeFace : 'front',
      doubleSided: voxel?.doubleSided === true,
      inset: Number.isFinite(voxel?.inset) ? Number(voxel.inset) : 0,
      text: typeof voxel?.text === 'string' ? voxel.text : 'Write your message',
      fontFamily: typeof voxel?.fontFamily === 'string' ? voxel.fontFamily : 'monospace',
      fontSize: typeof voxel?.fontSize === 'string' ? voxel.fontSize : '3rem',
      textColor: typeof voxel?.textColor === 'string' ? voxel.textColor : 'black',
      backgroundColor: typeof voxel?.backgroundColor === 'string' ? voxel.backgroundColor : 'white',
      horizontalAlign: typeof voxel?.horizontalAlign === 'string' ? voxel.horizontalAlign : 'center',
      verticalAlign: typeof voxel?.verticalAlign === 'string' ? voxel.verticalAlign : 'center',
      padding: Number.isFinite(voxel?.padding) ? Number(voxel.padding) : 0,
    });
  }

  const authoredVoxelTypes = typeof world.getVoxelTypes === 'function'
    ? world.getVoxelTypes()
    : [];
  for (let i = 0; i < authoredVoxelTypes.length; i += 1) {
    registerVoxelType(authoredVoxelTypes[i]);
  }

  function getFaceInstanceRecord(cellX, cellY, cellZ) {
    return voxelFaceInstanceIdsByKey.get(createCellKey(cellX, cellY, cellZ)) ?? null;
  }

  function ensureFaceInstanceRecord(cellX, cellY, cellZ) {
    const key = createCellKey(cellX, cellY, cellZ);
    const existingRecord = voxelFaceInstanceIdsByKey.get(key);
    if (existingRecord) return existingRecord;

    const nextRecord = new Map();
    voxelFaceInstanceIdsByKey.set(key, nextRecord);
    return nextRecord;
  }

  function clearFaceInstanceRecord(cellX, cellY, cellZ) {
    voxelFaceInstanceIdsByKey.delete(createCellKey(cellX, cellY, cellZ));
  }

  function addColliderForCell(cellX, cellY, cellZ) {
    if (!world.isVoxelCellActive(cellX, cellY, cellZ)) {
      return null;
    }

    const voxel = world.getVoxel(cellX, cellY, cellZ);
    if (!isCollidableVoxel(voxel)) {
      return null;
    }

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

  function getNextFaceInstanceId(faceName) {
    const freeFaceIds = freeVoxelFaceIdsByName.get(faceName) ?? [];
    if (freeFaceIds.length > 0) {
      return freeFaceIds.pop();
    }

    const faceGrid = voxelFaceGridsByName.get(faceName);
    const nextFaceInstanceId = nextVoxelFaceInstanceIdByName.get(faceName) ?? 0;
    if (!faceGrid || nextFaceInstanceId >= maxVoxelCount) {
      return null;
    }

    nextVoxelFaceInstanceIdByName.set(faceName, nextFaceInstanceId + 1);
    faceGrid.count = Math.max(faceGrid.count, nextFaceInstanceId + 1);
    return nextFaceInstanceId;
  }

  function hideVoxelFaceInstance(cellX, cellY, cellZ, faceName) {
    const faceInstanceRecord = getFaceInstanceRecord(cellX, cellY, cellZ);
    const faceInstanceId = faceInstanceRecord?.get(faceName);
    if (!Number.isInteger(faceInstanceId)) return false;

    const faceGrid = voxelFaceGridsByName.get(faceName);
    const faceVoxelCells = voxelFaceCellByInstanceIdByName.get(faceName);
    const freeFaceIds = freeVoxelFaceIdsByName.get(faceName);
    if (!faceGrid || !faceVoxelCells || !freeFaceIds) return false;

    faceGrid.setMatrixAt(faceInstanceId, hiddenInstanceMatrix);
    faceGrid.instanceMatrix.needsUpdate = true;
    faceVoxelCells[faceInstanceId] = null;
    faceInstanceRecord.delete(faceName);
    if (faceInstanceRecord.size === 0) {
      clearFaceInstanceRecord(cellX, cellY, cellZ);
    }
    freeFaceIds.push(faceInstanceId);
    return true;
  }

  function syncVoxelFaceInstance(cellX, cellY, cellZ, faceName, voxel = null) {
    const faceTransform = SOLID_FACE_TRANSFORMS[faceName];
    const faceGrid = voxelFaceGridsByName.get(faceName);
    const faceVoxelCells = voxelFaceCellByInstanceIdByName.get(faceName);
    if (!faceTransform || !faceGrid || !faceVoxelCells) return false;

    const faceInstanceRecord = ensureFaceInstanceRecord(cellX, cellY, cellZ);
    const currentFaceInstanceId = faceInstanceRecord.get(faceName);
    const faceInstanceId = Number.isInteger(currentFaceInstanceId)
      ? currentFaceInstanceId
      : getNextFaceInstanceId(faceName);
    if (!Number.isInteger(faceInstanceId)) return false;

    const centerPosition = world.gridToMapCenterPosition(cellX, cellY, cellZ, voxelSize);
    faceOffsetVector.set(
      faceTransform.normal.x * voxelSize * 0.5,
      faceTransform.normal.y * voxelSize * 0.5,
      faceTransform.normal.z * voxelSize * 0.5
    );
    instanceMatrix.makeRotationFromEuler(new THREE.Euler(
      faceTransform.rotation.x,
      faceTransform.rotation.y,
      faceTransform.rotation.z
    ));
    instanceMatrix.setPosition(
      centerPosition.x + faceOffsetVector.x,
      centerPosition.y + faceOffsetVector.y,
      centerPosition.z + faceOffsetVector.z
    );

    faceGrid.setMatrixAt(faceInstanceId, instanceMatrix);
    faceGrid.setColorAt(faceInstanceId, instanceColor.set(normalizeColor(voxel?.color)));
    faceGrid.instanceMatrix.needsUpdate = true;
    if (faceGrid.instanceColor) {
      faceGrid.instanceColor.needsUpdate = true;
    }

    faceVoxelCells[faceInstanceId] = { x: cellX, y: cellY, z: cellZ };
    faceInstanceRecord.set(faceName, faceInstanceId);
    return true;
  }

  function syncSolidVoxelFaces(cellX, cellY, cellZ, voxel = null) {
    const visibleFaces = new Set(getVisibleSolidFaces(cellX, cellY, cellZ, voxel));
    const faceInstanceRecord = getFaceInstanceRecord(cellX, cellY, cellZ);

    for (const faceName of TEXTURED_FACE_ORDER) {
      if (visibleFaces.has(faceName)) {
        if (!syncVoxelFaceInstance(cellX, cellY, cellZ, faceName, voxel)) {
          return false;
        }
      } else if (faceInstanceRecord?.has(faceName)) {
        hideVoxelFaceInstance(cellX, cellY, cellZ, faceName);
      }
    }

    return true;
  }

  function refreshAdjacentVoxelVisuals(cellX, cellY, cellZ) {
    const faceNames = Object.keys(FACE_NEIGHBOR_OFFSETS);

    for (let i = 0; i < faceNames.length; i += 1) {
      const offset = FACE_NEIGHBOR_OFFSETS[faceNames[i]];
      const neighborCellX = cellX + offset.x;
      const neighborCellY = cellY + offset.y;
      const neighborCellZ = cellZ + offset.z;
      if (!world.isVoxelCellActive(neighborCellX, neighborCellY, neighborCellZ)) continue;
      const neighborVoxel = world.getVoxel(neighborCellX, neighborCellY, neighborCellZ);
      const neighborKey = createCellKey(neighborCellX, neighborCellY, neighborCellZ);
      const existingMesh = texturedVoxelMeshByKey.get(neighborKey);
      if (existingMesh) {
        texturedVoxelGroup.remove(existingMesh);
        texturedVoxelMeshByKey.delete(neighborKey);
      }

      const existingPlaneRaycastMesh = planeRaycastMeshByKey.get(neighborKey);
      if (existingPlaneRaycastMesh) {
        planeRaycastGroup.remove(existingPlaneRaycastMesh);
        planeRaycastMeshByKey.delete(neighborKey);
      }

      if (!neighborVoxel) {
        for (const faceName of TEXTURED_FACE_ORDER) {
          hideVoxelFaceInstance(neighborCellX, neighborCellY, neighborCellZ, faceName);
        }
        removeColliderForCell(neighborCellX, neighborCellY, neighborCellZ);
        continue;
      }

      if (isVoxelPlane(neighborVoxel) || hasImageTextureFaces(neighborVoxel)) {
        const nextNeighborMesh = isVoxelPlane(neighborVoxel)
          ? createVoxelPlaneMesh(neighborCellX, neighborCellY, neighborCellZ, neighborVoxel)
          : createTexturedVoxelMesh(neighborCellX, neighborCellY, neighborCellZ, neighborVoxel);

        if (!nextNeighborMesh) continue;
        texturedVoxelGroup.add(nextNeighborMesh);
        texturedVoxelMeshByKey.set(neighborKey, nextNeighborMesh);
        if (isVoxelPlane(neighborVoxel)) {
          const planeRaycastMesh = createPlaneRaycastMesh(neighborCellX, neighborCellY, neighborCellZ);
          planeRaycastGroup.add(planeRaycastMesh);
          planeRaycastMeshByKey.set(neighborKey, planeRaycastMesh);
        }
        addColliderForCell(neighborCellX, neighborCellY, neighborCellZ);
        for (const faceName of TEXTURED_FACE_ORDER) {
          hideVoxelFaceInstance(neighborCellX, neighborCellY, neighborCellZ, faceName);
        }
        continue;
      }

      if (isVoxelFullyOccluded(neighborCellX, neighborCellY, neighborCellZ, neighborVoxel)) {
        for (const faceName of TEXTURED_FACE_ORDER) {
          hideVoxelFaceInstance(neighborCellX, neighborCellY, neighborCellZ, faceName);
        }
        removeColliderForCell(neighborCellX, neighborCellY, neighborCellZ);
        continue;
      }

      syncSolidVoxelFaces(neighborCellX, neighborCellY, neighborCellZ, neighborVoxel);
      addColliderForCell(neighborCellX, neighborCellY, neighborCellZ);
    }
  }

  function refreshVoxelVisual(cellX, cellY, cellZ) {
    if (!world.isVoxelCellActive(cellX, cellY, cellZ)) {
      return false;
    }

    const voxel = world.getVoxel(cellX, cellY, cellZ);
    const key = createCellKey(cellX, cellY, cellZ);
    const existingMesh = texturedVoxelMeshByKey.get(key);
    if (existingMesh) {
      texturedVoxelGroup.remove(existingMesh);
      texturedVoxelMeshByKey.delete(key);
    }

    const existingPlaneRaycastMesh = planeRaycastMeshByKey.get(key);
    if (existingPlaneRaycastMesh) {
      planeRaycastGroup.remove(existingPlaneRaycastMesh);
      planeRaycastMeshByKey.delete(key);
    }

    if (!voxel) {
      for (const faceName of TEXTURED_FACE_ORDER) {
        hideVoxelFaceInstance(cellX, cellY, cellZ, faceName);
      }
      removeColliderForCell(cellX, cellY, cellZ);
      return true;
    }

    if (isVoxelPlane(voxel) || hasImageTextureFaces(voxel)) {
      const texturedVoxelMesh = isVoxelPlane(voxel)
        ? createVoxelPlaneMesh(cellX, cellY, cellZ, voxel)
        : createTexturedVoxelMesh(cellX, cellY, cellZ, voxel);
      if (!texturedVoxelMesh) {
        removeColliderForCell(cellX, cellY, cellZ);
        for (const faceName of TEXTURED_FACE_ORDER) {
          hideVoxelFaceInstance(cellX, cellY, cellZ, faceName);
        }
        return true;
      }
      texturedVoxelGroup.add(texturedVoxelMesh);
      texturedVoxelMeshByKey.set(key, texturedVoxelMesh);
      if (isVoxelPlane(voxel)) {
        const planeRaycastMesh = createPlaneRaycastMesh(cellX, cellY, cellZ);
        planeRaycastGroup.add(planeRaycastMesh);
        planeRaycastMeshByKey.set(key, planeRaycastMesh);
      }
      addColliderForCell(cellX, cellY, cellZ);
      for (const faceName of TEXTURED_FACE_ORDER) {
        hideVoxelFaceInstance(cellX, cellY, cellZ, faceName);
      }
      return true;
    }

    if (isVoxelFullyOccluded(cellX, cellY, cellZ, voxel)) {
      for (const faceName of TEXTURED_FACE_ORDER) {
        hideVoxelFaceInstance(cellX, cellY, cellZ, faceName);
      }
      removeColliderForCell(cellX, cellY, cellZ);
      return true;
    }

    if (!syncSolidVoxelFaces(cellX, cellY, cellZ, voxel)) {
      return false;
    }

    addColliderForCell(cellX, cellY, cellZ);
    return true;
  }

  function syncWorldVoxelAddedAtCell(cellX, cellY, cellZ, { refreshNeighbors = true } = {}) {
    const voxel = world.getVoxel(cellX, cellY, cellZ);
    if (!voxel) return false;

    if (!world.isVoxelCellActive(cellX, cellY, cellZ)) {
      return true;
    }

    registerVoxelType(voxel);
    refreshVoxelVisual(cellX, cellY, cellZ);
    if (refreshNeighbors) {
      refreshAdjacentVoxelVisuals(cellX, cellY, cellZ);
    }
    return true;
  }

  function syncWorldVoxelRemovedAtCell(cellX, cellY, cellZ, { refreshNeighbors = true } = {}) {
    for (const faceName of TEXTURED_FACE_ORDER) {
      hideVoxelFaceInstance(cellX, cellY, cellZ, faceName);
    }
    const key = createCellKey(cellX, cellY, cellZ);
    const texturedVoxelMesh = texturedVoxelMeshByKey.get(key);
    if (texturedVoxelMesh) {
      texturedVoxelGroup.remove(texturedVoxelMesh);
      texturedVoxelMeshByKey.delete(key);
    }
    const planeRaycastMesh = planeRaycastMeshByKey.get(key);
    if (planeRaycastMesh) {
      planeRaycastGroup.remove(planeRaycastMesh);
      planeRaycastMeshByKey.delete(key);
    }
    removeColliderForCell(cellX, cellY, cellZ);
    if (refreshNeighbors) {
      refreshAdjacentVoxelVisuals(cellX, cellY, cellZ);
    }
    return true;
  }

  function refreshChunkBoundaryNeighbors(chunkPosition, chunkVoxelEntries = []) {
    const chunkSize = world.getChunkSize();
    const neighborCellsToRefresh = new Set();

    for (let i = 0; i < chunkVoxelEntries.length; i += 1) {
      const entry = chunkVoxelEntries[i];
      const localPosition = entry.position;
      const cellX = chunkPosition.x * chunkSize + localPosition.x;
      const cellY = chunkPosition.y * chunkSize + localPosition.y;
      const cellZ = chunkPosition.z * chunkSize + localPosition.z;

      if (localPosition.x === 0) {
        neighborCellsToRefresh.add(createCellKey(cellX - 1, cellY, cellZ));
      }
      if (localPosition.x === chunkSize - 1) {
        neighborCellsToRefresh.add(createCellKey(cellX + 1, cellY, cellZ));
      }
      if (localPosition.y === 0) {
        neighborCellsToRefresh.add(createCellKey(cellX, cellY - 1, cellZ));
      }
      if (localPosition.y === chunkSize - 1) {
        neighborCellsToRefresh.add(createCellKey(cellX, cellY + 1, cellZ));
      }
      if (localPosition.z === 0) {
        neighborCellsToRefresh.add(createCellKey(cellX, cellY, cellZ - 1));
      }
      if (localPosition.z === chunkSize - 1) {
        neighborCellsToRefresh.add(createCellKey(cellX, cellY, cellZ + 1));
      }
    }

    for (const neighborCellKey of neighborCellsToRefresh) {
      const neighborCell = world.parseChunkKey(neighborCellKey);
      if (!neighborCell) continue;
      pendingChunkBoundaryJobs.push({
        type: 'refresh',
        cellX: neighborCell.x,
        cellY: neighborCell.y,
        cellZ: neighborCell.z,
      });
    }
  }

  function enqueueChunkVisualJobs(chunkKey = '', action = 'add') {
    const chunkPosition = typeof world.parseChunkKey === 'function'
      ? world.parseChunkKey(chunkKey)
      : null;
    const chunkEntry = chunkPosition
      ? world.getChunkEntry(chunkPosition.x, chunkPosition.y, chunkPosition.z)
      : null;
    if (!chunkEntry?.boxel) return false;

    const chunkVoxelEntries = chunkEntry.boxel.getVoxelEntries({ activeOnly: true });
    for (let i = 0; i < chunkVoxelEntries.length; i += 1) {
      const entry = chunkVoxelEntries[i];
      pendingChunkVisualJobs.push({
        type: action,
        cellX: chunkPosition.x * world.getChunkSize() + entry.position.x,
        cellY: chunkPosition.y * world.getChunkSize() + entry.position.y,
        cellZ: chunkPosition.z * world.getChunkSize() + entry.position.z,
      });
    }

    refreshChunkBoundaryNeighbors(chunkPosition, chunkVoxelEntries);
    return true;
  }

  function updateActiveChunks(center = null) {
    const chunkDelta = typeof world.updateActiveChunks === 'function'
      ? world.updateActiveChunks(center)
      : { added: [], removed: [], active: [] };

    for (let i = 0; i < chunkDelta.removed.length; i += 1) {
      enqueueChunkVisualJobs(chunkDelta.removed[i], 'remove');
    }

    for (let i = 0; i < chunkDelta.added.length; i += 1) {
      enqueueChunkVisualJobs(chunkDelta.added[i], 'add');
    }

    return chunkDelta;
  }

  function processPendingChunkVisualUpdates(maxJobs = 120) {
    let processedJobs = 0;

    while (
      processedJobs < maxJobs
      && (pendingChunkBoundaryJobs.length > 0 || pendingChunkVisualJobs.length > 0)
    ) {
      const job = pendingChunkBoundaryJobs.length > 0
        ? pendingChunkBoundaryJobs.shift()
        : pendingChunkVisualJobs.shift();
      if (!job) break;

      if (job.type === 'add') {
        syncWorldVoxelAddedAtCell(job.cellX, job.cellY, job.cellZ, { refreshNeighbors: false });
      } else if (job.type === 'remove') {
        syncWorldVoxelRemovedAtCell(job.cellX, job.cellY, job.cellZ, { refreshNeighbors: false });
      } else if (job.type === 'refresh') {
        if (world.isVoxelCellActive(job.cellX, job.cellY, job.cellZ)) {
          refreshVoxelVisual(job.cellX, job.cellY, job.cellZ);
        }
      }

      processedJobs += 1;
    }

    return {
      processedJobs,
      remainingJobs: pendingChunkBoundaryJobs.length + pendingChunkVisualJobs.length,
    };
  }

  function getVoxelCellFromRaycastHit(hit) {
    const texturedVoxelCell = hit?.object?.userData?.voxelCell;
    if (texturedVoxelCell) {
      return {
        cellX: texturedVoxelCell.x,
        cellY: texturedVoxelCell.y,
        cellZ: texturedVoxelCell.z,
      };
    }

    const faceName = hit?.object?.userData?.faceName;
    const faceVoxelCells = faceName ? voxelFaceCellByInstanceIdByName.get(faceName) : null;
    const cell = faceVoxelCells?.[hit?.instanceId];
    if (!cell) return null;

    return {
      cellX: cell.x,
      cellY: cell.y,
      cellZ: cell.z,
    };
  }

  function getAdjacentVoxelCellFromRaycastHit(hit) {
    if (!hit?.object || !hit.face) return null;

    hitNormalWorld.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
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

  const voxelRaycastGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
  const voxelFaceGeometry = new THREE.PlaneGeometry(voxelSize, voxelSize);
  const hasBorderedTexture = voxelEntries.some(entry => normalizeTexture(entry?.voxel?.texture) === 'bordered');
  const voxelFaceMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: hasBorderedTexture ? createBorderedVoxelTexture() : null,
    side: THREE.DoubleSide,
    roughness: 0.95,
    metalness: 0.0,
  });
  const planeRaycastMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const voxelFaceGridsByName = new Map();
  const voxelFaceCellByInstanceIdByName = new Map();
  const nextVoxelFaceInstanceIdByName = new Map();
  const texturedVoxelGroup = new THREE.Group();
  const planeRaycastGroup = new THREE.Group();

  for (const faceName of TEXTURED_FACE_ORDER) {
    const faceGrid = new THREE.InstancedMesh(
      voxelFaceGeometry,
      voxelFaceMaterial,
      maxVoxelCount
    );
    faceGrid.name = `${mapGroup.name} ${faceName} Faces`;
    faceGrid.receiveShadow = true;
    faceGrid.count = 0;
    faceGrid.frustumCulled = false;
    faceGrid.userData.faceName = faceName;
    voxelFaceGridsByName.set(faceName, faceGrid);
    voxelFaceCellByInstanceIdByName.set(faceName, []);
    nextVoxelFaceInstanceIdByName.set(faceName, 0);
    freeVoxelFaceIdsByName.set(faceName, []);
    mapGroup.add(faceGrid);
  }
  texturedVoxelGroup.name = `${mapGroup.name} Textured Voxels`;
  planeRaycastGroup.name = `${mapGroup.name} Plane Raycast`;

  for (let i = 0; i < voxelEntries.length; i++) {
    const entry = voxelEntries[i];
    const { position, voxel } = entry;
    registerVoxelType(voxel);

    if (isVoxelPlane(voxel) || hasImageTextureFaces(voxel)) {
      const texturedVoxelMesh = isVoxelPlane(voxel)
        ? createVoxelPlaneMesh(position.x, position.y, position.z, voxel)
        : createTexturedVoxelMesh(position.x, position.y, position.z, voxel);
      if (texturedVoxelMesh) {
        texturedVoxelGroup.add(texturedVoxelMesh);
        texturedVoxelMeshByKey.set(createCellKey(position.x, position.y, position.z), texturedVoxelMesh);
        if (isVoxelPlane(voxel)) {
          const planeRaycastMesh = createPlaneRaycastMesh(position.x, position.y, position.z);
          planeRaycastGroup.add(planeRaycastMesh);
          planeRaycastMeshByKey.set(createCellKey(position.x, position.y, position.z), planeRaycastMesh);
        }
      }
    } else {
      if (!isVoxelFullyOccluded(position.x, position.y, position.z, voxel)) {
        syncSolidVoxelFaces(position.x, position.y, position.z, voxel);
      }
    }

    if (!isVoxelFullyOccluded(position.x, position.y, position.z, voxel)) {
      addColliderForCell(position.x, position.y, position.z);
    }
  }

  for (const faceGrid of voxelFaceGridsByName.values()) {
    faceGrid.instanceMatrix.needsUpdate = true;
    if (faceGrid.instanceColor) {
      faceGrid.instanceColor.needsUpdate = true;
    }
  }

  const boundaryColliders = createWorldBoundaryColliders();
  buildingColliders.push(...boundaryColliders);

  mapGroup.add(texturedVoxelGroup);
  mapGroup.add(planeRaycastGroup);
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
    raycastTargets: [...Array.from(voxelFaceGridsByName.values()), texturedVoxelGroup, planeRaycastGroup],
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
      const texturedVoxelCell = hit?.object?.userData?.voxelCell;
      if (texturedVoxelCell) {
        return world.getVoxel(texturedVoxelCell.x, texturedVoxelCell.y, texturedVoxelCell.z)?.name ?? null;
      }

      const faceName = hit?.object?.userData?.faceName;
      const faceVoxelCells = faceName ? voxelFaceCellByInstanceIdByName.get(faceName) : null;
      const cell = faceVoxelCells?.[hit?.instanceId];
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

      if (voxelType.shape === 'plane') {
        if (voxelType.contentType === 'text') {
          return new VoxelPlaneText({
            name: voxelType.name,
            type: voxelType.type,
            color: '#' + voxelType.color.toString(16).padStart(6, '0'),
            texture: cloneTextureSpec(voxelType.texture) || null,
            transparent: voxelType.transparent === true,
            rotation: getVoxelRotation(voxelType),
            planeFace: voxelType.planeFace || 'front',
            doubleSided: voxelType.doubleSided === true,
            inset: voxelType.inset ?? 0,
            text: voxelType.text,
            fontFamily: voxelType.fontFamily,
            fontSize: voxelType.fontSize,
            textColor: voxelType.textColor,
            backgroundColor: voxelType.backgroundColor,
            horizontalAlign: voxelType.horizontalAlign,
            verticalAlign: voxelType.verticalAlign,
            padding: voxelType.padding,
          });
        }

        return new VoxelPlane({
          name: voxelType.name,
          type: voxelType.type,
          color: '#' + voxelType.color.toString(16).padStart(6, '0'),
          texture: cloneTextureSpec(voxelType.texture) || null,
          transparent: voxelType.transparent === true,
          rotation: getVoxelRotation(voxelType),
          planeFace: voxelType.planeFace || 'front',
          doubleSided: voxelType.doubleSided === true,
          inset: voxelType.inset ?? 0,
        });
      }

      return new Voxel({
        name: voxelType.name,
        type: voxelType.type,
        color: '#' + voxelType.color.toString(16).padStart(6, '0'),
        texture: cloneTextureSpec(voxelType.texture) || null,
        transparent: voxelType.transparent === true,
        rotation: getVoxelRotation(voxelType),
      });
    },
    syncWorldVoxelAddedAtCell,
    syncWorldVoxelRemovedAtCell,
    updateActiveChunks,
    processPendingChunkVisualUpdates,
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
            if (!world.isVoxelCellActive(cellX, cellY, cellZ)) continue;
            if (!isCollidableVoxel(world.getVoxel(cellX, cellY, cellZ))) continue;

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
            if (!world.isVoxelCellActive(cellX, cellY, cellZ)) continue;
            if (isCollidableVoxel(world.getVoxel(cellX, cellY, cellZ))) {
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
            if (!world.isVoxelCellActive(cellX, cellY, cellZ)) continue;
            if (!isCollidableVoxel(world.getVoxel(cellX, cellY, cellZ))) continue;
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
