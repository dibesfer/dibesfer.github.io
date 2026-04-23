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
  const hitNormalWorld = new THREE.Vector3();
  const adjacentVoxelPoint = new THREE.Vector3();
  const voxelCellByInstanceId = [];
  const voxelInstanceIdByKey = new Map();
  const voxelColliderByKey = new Map();
  const voxelTypesByName = new Map();
  const texturedVoxelMeshByKey = new Map();
  const planeRaycastMeshByKey = new Map();
  const freeVoxelIds = [];
  const worldOrigin = world.getMapOrigin(voxelSize);
  const voxelEntries = world.getVoxelEntries();
  const initialVoxelCount = voxelEntries.length;
  const extraVoxelCapacity = 20000;
  const maxVoxelCount = Math.max(initialVoxelCount + extraVoxelCapacity, 1);
  let nextVoxelInstanceId = 0;
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

  function isCollidableVoxel(voxel = null) {
    return Boolean(voxel) && !isVoxelPlane(voxel);
  }

  function isTransparentVoxel(voxel = null) {
    return Boolean(voxel?.transparent);
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

    const neighborVoxel = world.getVoxel(
      cellX + neighborOffset.x,
      cellY + neighborOffset.y,
      cellZ + neighborOffset.z
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
    const mesh = new THREE.Mesh(voxelGeometry, faceMaterials);
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
    const planeFace = typeof voxel?.planeFace === 'string' ? voxel.planeFace : 'front';
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
    const mesh = new THREE.Mesh(voxelGeometry, planeRaycastMaterial);
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

  function refreshAdjacentTexturedVoxelMeshes(cellX, cellY, cellZ) {
    const faceNames = Object.keys(FACE_NEIGHBOR_OFFSETS);

    for (let i = 0; i < faceNames.length; i += 1) {
      const offset = FACE_NEIGHBOR_OFFSETS[faceNames[i]];
      const neighborCellX = cellX + offset.x;
      const neighborCellY = cellY + offset.y;
      const neighborCellZ = cellZ + offset.z;
      const neighborVoxel = world.getVoxel(neighborCellX, neighborCellY, neighborCellZ);
      if (!(hasImageTextureFaces(neighborVoxel) || isVoxelPlane(neighborVoxel))) continue;

      const neighborKey = createCellKey(neighborCellX, neighborCellY, neighborCellZ);
      const existingMesh = texturedVoxelMeshByKey.get(neighborKey);
      if (existingMesh) {
        texturedVoxelGroup.remove(existingMesh);
        texturedVoxelMeshByKey.delete(neighborKey);
      }

      const nextNeighborMesh = isVoxelPlane(neighborVoxel)
        ? createVoxelPlaneMesh(neighborCellX, neighborCellY, neighborCellZ, neighborVoxel)
        : createTexturedVoxelMesh(neighborCellX, neighborCellY, neighborCellZ, neighborVoxel);

      if (!nextNeighborMesh) continue;
      texturedVoxelGroup.add(nextNeighborMesh);
      texturedVoxelMeshByKey.set(neighborKey, nextNeighborMesh);
    }
  }

  function syncWorldVoxelAddedAtCell(cellX, cellY, cellZ) {
    const voxel = world.getVoxel(cellX, cellY, cellZ);
    if (!voxel) return false;

    registerVoxelType(voxel);
    syncWorldVoxelRemovedAtCell(cellX, cellY, cellZ);
    const key = createCellKey(cellX, cellY, cellZ);

    if (isVoxelPlane(voxel) || hasImageTextureFaces(voxel)) {
      const texturedVoxelMesh = isVoxelPlane(voxel)
        ? createVoxelPlaneMesh(cellX, cellY, cellZ, voxel)
        : createTexturedVoxelMesh(cellX, cellY, cellZ, voxel);
      if (!texturedVoxelMesh) return false;
      texturedVoxelGroup.add(texturedVoxelMesh);
      texturedVoxelMeshByKey.set(key, texturedVoxelMesh);
      if (isVoxelPlane(voxel)) {
        const planeRaycastMesh = createPlaneRaycastMesh(cellX, cellY, cellZ);
        planeRaycastGroup.add(planeRaycastMesh);
        planeRaycastMeshByKey.set(key, planeRaycastMesh);
      }
    } else {
      const currentVoxelId = voxelInstanceIdByKey.get(key);
      const voxelId = Number.isInteger(currentVoxelId) ? currentVoxelId : getNextVoxelInstanceId();
      if (!Number.isInteger(voxelId)) return false;

      syncVoxelInstance(voxelId, cellX, cellY, cellZ, voxel);
      voxelInstanceIdByKey.set(key, voxelId);
      voxelGrid.instanceMatrix.needsUpdate = true;
      if (voxelGrid.instanceColor) {
        voxelGrid.instanceColor.needsUpdate = true;
      }
    }

    addColliderForCell(cellX, cellY, cellZ);
    refreshAdjacentTexturedVoxelMeshes(cellX, cellY, cellZ);
    return true;
  }

  function syncWorldVoxelRemovedAtCell(cellX, cellY, cellZ) {
    const key = createCellKey(cellX, cellY, cellZ);
    const texturedVoxelMesh = texturedVoxelMeshByKey.get(key);
    if (texturedVoxelMesh) {
      texturedVoxelGroup.remove(texturedVoxelMesh);
      texturedVoxelMeshByKey.delete(key);
      const planeRaycastMesh = planeRaycastMeshByKey.get(key);
      if (planeRaycastMesh) {
        planeRaycastGroup.remove(planeRaycastMesh);
        planeRaycastMeshByKey.delete(key);
      }
      removeColliderForCell(cellX, cellY, cellZ);
      refreshAdjacentTexturedVoxelMeshes(cellX, cellY, cellZ);
      return true;
    }

    const voxelId = voxelInstanceIdByKey.get(key);
    if (!Number.isInteger(voxelId)) return false;

    voxelGrid.setMatrixAt(voxelId, hiddenInstanceMatrix);
    voxelGrid.instanceMatrix.needsUpdate = true;
    voxelCellByInstanceId[voxelId] = null;
    voxelInstanceIdByKey.delete(key);
    freeVoxelIds.push(voxelId);
    removeColliderForCell(cellX, cellY, cellZ);
    refreshAdjacentTexturedVoxelMeshes(cellX, cellY, cellZ);
    return true;
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

    const cell = voxelCellByInstanceId[hit?.instanceId];
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

  const voxelGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
  const hasBorderedTexture = voxelEntries.some(entry => normalizeTexture(entry?.voxel?.texture) === 'bordered');
  const initialInstancedVoxelCount = voxelEntries.reduce((count, entry) => (
    hasImageTextureFaces(entry?.voxel) ? count : count + 1
  ), 0);
  const voxelMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: hasBorderedTexture ? createBorderedVoxelTexture() : null,
    roughness: 0.95,
    metalness: 0.0,
  });
  const planeRaycastMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const voxelGrid = new THREE.InstancedMesh(
    voxelGeometry,
    voxelMaterial,
    maxVoxelCount
  );
  const texturedVoxelGroup = new THREE.Group();
  const planeRaycastGroup = new THREE.Group();

  voxelGrid.name = `${mapGroup.name} Voxels`;
  voxelGrid.receiveShadow = true;
  voxelGrid.count = Math.max(initialInstancedVoxelCount, 1);
  texturedVoxelGroup.name = `${mapGroup.name} Textured Voxels`;
  planeRaycastGroup.name = `${mapGroup.name} Plane Raycast`;

  let initialInstancedIndex = 0;
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
      syncVoxelInstance(initialInstancedIndex, position.x, position.y, position.z, voxel);
      voxelInstanceIdByKey.set(createCellKey(position.x, position.y, position.z), initialInstancedIndex);
      initialInstancedIndex += 1;
      nextVoxelInstanceId = initialInstancedIndex;
    }

    addColliderForCell(position.x, position.y, position.z);
  }

  voxelGrid.instanceMatrix.needsUpdate = true;
  if (voxelGrid.instanceColor) {
    voxelGrid.instanceColor.needsUpdate = true;
  }

  const boundaryColliders = createWorldBoundaryColliders();
  buildingColliders.push(...boundaryColliders);

  mapGroup.add(voxelGrid);
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
    raycastTargets: [voxelGrid, texturedVoxelGroup, planeRaycastGroup],
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
