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
  const hitNormalWorld = new THREE.Vector3();
  const adjacentVoxelPoint = new THREE.Vector3();
  const hitVoxelPoint = new THREE.Vector3();
  const voxelColliderByKey = new Map();
  const voxelTypesByName = new Map();
  const texturedVoxelMeshByKey = new Map();
  const planeRaycastMeshByKey = new Map();
  const solidChunkMeshByKey = new Map();
  const temporaryExposedFaceGroupByChunkKey = new Map();
  const chunkRenderStateByKey = new Map();
  const worldOrigin = world.getMapOrigin(voxelSize);
  const usesLazyChunkGeneration = typeof world.chunkGenerator === 'function';
  const readWorldVoxel = typeof world.peekVoxel === 'function'
    ? world.peekVoxel.bind(world)
    : world.getVoxel.bind(world);
  const staticMiniMapColor = typeof world.staticMiniMapColor === 'string' && world.staticMiniMapColor.trim()
    ? world.staticMiniMapColor.trim()
    : null;
  const miniMapPixelWidth = usesLazyChunkGeneration
    ? Math.min(world.size.x, 128)
    : world.size.x;
  const miniMapPixelHeight = usesLazyChunkGeneration
    ? Math.min(world.size.z, 128)
    : world.size.z;
  const voxelEntries = usesLazyChunkGeneration
    ? []
    : world.getVoxelEntries({ activeChunksOnly: true });
  const pendingChunkActivationJobs = new Set();
  const pendingChunkVisualJobs = [];
  const pendingChunkBoundaryJobs = [];
  const pendingPrioritySolidChunkJobs = new Map();
  const pendingSolidChunkJobs = new Map();
  const textureLoader = new THREE.TextureLoader();
  const voxelFaceTextureCache = new Map();
  const solidChunkTextureCache = new Map();
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
  const OPPOSITE_FACE_BY_NAME = {
    right: 'left',
    left: 'right',
    top: 'bottom',
    bottom: 'top',
    front: 'back',
    back: 'front',
  };

  mapGroup.name = world.name || 'World';

  function resolveWorldShadowRange() {
    const authoredRadiusInVoxels = Number(world.boxel15DistanceRendering?.radiusInVoxels);
    if (Number.isFinite(authoredRadiusInVoxels) && authoredRadiusInVoxels > 0) {
      return Math.max(36, Math.min(120, authoredRadiusInVoxels + world.getChunkSize()));
    }

    return Math.max(40, Math.min(Math.max(world.size.x, world.size.z), 120));
  }

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
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  function normalizeColor(color = '#ffffff') {
    return typeof color === 'string' && color.trim() ? color.trim() : '#ffffff';
  }

  function normalizeTextureInfluence(textureInfluence = 1) {
    const numericInfluence = Number(textureInfluence);
    if (!Number.isFinite(numericInfluence)) {
      return 1;
    }

    return Math.min(1, Math.max(0, numericInfluence));
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

  function getLayeredTextureSpec(texture = null) {
    if (!texture || typeof texture !== 'object' || Array.isArray(texture)) {
      return null;
    }

    const baseTexture = typeof texture.base === 'string' && texture.base.trim()
      ? texture.base.trim()
      : typeof texture.background === 'string' && texture.background.trim()
        ? texture.background.trim()
        : typeof texture.all === 'string' && texture.all.trim()
          ? texture.all.trim()
          : '';
    const maskTexture = typeof texture.mask === 'string' && texture.mask.trim()
      ? texture.mask.trim()
      : typeof texture.detail === 'string' && texture.detail.trim()
        ? texture.detail.trim()
        : '';

    return baseTexture && maskTexture
      ? { base: baseTexture, mask: maskTexture }
      : null;
  }

  function createLayeredTextureKey(texture = null) {
    const layerSpec = getLayeredTextureSpec(texture);
    return layerSpec
      ? `layered:${layerSpec.base}|${layerSpec.mask}`
      : '';
  }

  function parseLayeredTextureKey(textureKey = '') {
    if (typeof textureKey !== 'string' || !textureKey.startsWith('layered:')) {
      return null;
    }

    const [baseTexture = '', maskTexture = ''] = textureKey.slice('layered:'.length).split('|');
    return baseTexture && maskTexture
      ? { base: baseTexture, mask: maskTexture }
      : null;
  }

  function resolveVoxelTextureFaces(voxel = null) {
    if (typeof voxel?.getResolvedTextureFaces === 'function') {
      return voxel.getResolvedTextureFaces();
    }

    return null;
  }

  function hasImageTextureFaces(voxel = null) {
    if (createLayeredTextureKey(voxel?.texture)) {
      return false;
    }

    const resolvedFaces = resolveVoxelTextureFaces(voxel);
    if (!resolvedFaces) return false;

    return Object.values(resolvedFaces).some(faceTexture => normalizeTexture(faceTexture) !== 'bordered');
  }

  function getSharedOpaqueVoxelTexturePath(voxel = null) {
    if (!voxel || isVoxelPlane(voxel) || isTransparentVoxel(voxel)) {
      return '';
    }

    const layeredTextureKey = createLayeredTextureKey(voxel.texture);
    if (layeredTextureKey) {
      return layeredTextureKey;
    }

    const resolvedFaces = resolveVoxelTextureFaces(voxel);
    if (!resolvedFaces) {
      return '';
    }

    let sharedTexturePath = '';

    for (const faceName of TEXTURED_FACE_ORDER) {
      const faceTexture = typeof resolvedFaces?.[faceName] === 'string'
        ? resolvedFaces[faceName].trim()
        : '';
      const normalizedFaceTexture = normalizeTexture(faceTexture);

      if (!normalizedFaceTexture || normalizedFaceTexture === 'bordered') {
        return '';
      }

      if (!sharedTexturePath) {
        sharedTexturePath = faceTexture;
        continue;
      }

      if (normalizeTexture(sharedTexturePath) !== normalizedFaceTexture) {
        return '';
      }
    }

    return sharedTexturePath;
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
      && (
        !hasImageTextureFaces(voxel)
        || Boolean(getSharedOpaqueVoxelTexturePath(voxel))
      );
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

    const neighborVoxel = readWorldVoxel(
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

    return readWorldVoxel(neighborCellX, neighborCellY, neighborCellZ);
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

  function getLoadedSolidChunkTexture(texturePath = '') {
    const normalizedPath = typeof texturePath === 'string' ? texturePath.trim() : '';
    if (!normalizedPath) return null;

    if (solidChunkTextureCache.has(normalizedPath)) {
      return solidChunkTextureCache.get(normalizedPath);
    }

    const baseTexture = getLoadedVoxelFaceTexture(normalizedPath);
    if (!baseTexture) {
      return null;
    }

    const texture = baseTexture.clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    solidChunkTextureCache.set(normalizedPath, texture);
    return texture;
  }

  function createLayeredTextureMaterial(textureKey = '', textureInfluence = 1) {
    const layerSpec = parseLayeredTextureKey(textureKey);
    if (!layerSpec) return null;

    const baseTexture = getLoadedSolidChunkTexture(layerSpec.base);
    const maskTexture = getLoadedSolidChunkTexture(layerSpec.mask);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: baseTexture,
      vertexColors: true,
      side: THREE.FrontSide,
      roughness: 0.95,
      metalness: 0.0,
    });
    const normalizedTextureInfluence = normalizeTextureInfluence(textureInfluence);

    material.userData.textureInfluence = normalizedTextureInfluence;
    material.onBeforeCompile = shader => {
      shader.uniforms.detailMap = { value: maskTexture };
      shader.uniforms.textureInfluence = { value: normalizedTextureInfluence };
      shader.fragmentShader = shader.fragmentShader.replace(
        'uniform float opacity;',
        'uniform float opacity;\nuniform sampler2D detailMap;\nuniform float textureInfluence;'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec4 baseColor = texture2D( map, vMapUv );
          vec4 detailColor = texture2D( detailMap, vMapUv );
          float detailMask = detailColor.a * max(max(detailColor.r, detailColor.g), detailColor.b);
          vec3 tintColor = diffuseColor.rgb;
          vec3 tintedDetail = tintColor * mix(vec3(1.0), detailColor.rgb, textureInfluence);
          diffuseColor.rgb = mix(baseColor.rgb, tintedDetail, detailMask);
          diffuseColor.a *= baseColor.a;
        #endif
        `
      );
    };
    material.customProgramCacheKey = function () {
      return `layeredTexture:${textureKey}|${normalizedTextureInfluence.toFixed(3)}`;
    };
    material.needsUpdate = true;
    return material;
  }

  function applyTextureInfluenceToMaterial(material = null, textureInfluence = 1) {
    if (!material?.map) {
      return material;
    }

    const normalizedTextureInfluence = normalizeTextureInfluence(textureInfluence);
    material.userData.textureInfluence = normalizedTextureInfluence;

    if (normalizedTextureInfluence >= 0.999) {
      material.customProgramCacheKey = function () {
        return 'textureInfluence:1.000';
      };
      return material;
    }

    material.onBeforeCompile = shader => {
      shader.uniforms.textureInfluence = { value: normalizedTextureInfluence };
      shader.fragmentShader = shader.fragmentShader.replace(
        'uniform float opacity;',
        'uniform float opacity;\nuniform float textureInfluence;'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          sampledDiffuseColor.rgb = mix(vec3(1.0), sampledDiffuseColor.rgb, textureInfluence);
          diffuseColor *= sampledDiffuseColor;
        #endif
        `
      );
    };
    material.customProgramCacheKey = function () {
      return 'textureInfluence:' + normalizedTextureInfluence.toFixed(3);
    };
    material.needsUpdate = true;
    return material;
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
      return applyTextureInfluenceToMaterial(new THREE.MeshStandardMaterial({
        color: normalizeColor(voxel?.color),
        map: resolvedTexture,
        transparent: true,
        alphaTest: 0.5,
        side: isTransparentVoxel(voxel) ? THREE.DoubleSide : THREE.FrontSide,
        roughness: 0.95,
        metalness: 0.0,
      }), voxel?.textureInfluence);
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

  function getSolidVoxelTextureKey(voxel = null) {
    const layeredTextureKey = createLayeredTextureKey(voxel?.texture);
    if (layeredTextureKey) {
      return layeredTextureKey;
    }

    if (normalizeTexture(voxel?.texture) === 'bordered') {
      return 'bordered';
    }

    return getSharedOpaqueVoxelTexturePath(voxel);
  }

  function getSolidVoxelTextureInfluence(voxel = null) {
    return normalizeTextureInfluence(voxel?.textureInfluence);
  }

  function getSolidVoxelSignature(voxel = null) {
    if (!isOpaqueCubeVoxel(voxel)) {
      return '';
    }

    return [
      new THREE.Color(normalizeColor(voxel?.color)).getHexString(),
      getSolidVoxelTextureKey(voxel),
      getSolidVoxelTextureInfluence(voxel).toFixed(3),
    ].join('|');
  }

  function getSolidChunkMaterial(textureKey = '', textureInfluence = 1) {
    const normalizedTextureKey = typeof textureKey === 'string' ? textureKey.trim() : '';
    const normalizedTextureInfluence = normalizeTextureInfluence(textureInfluence);
    const cacheKey = `${normalizedTextureKey || 'solid'}|${normalizedTextureInfluence.toFixed(3)}`;
    const existingMaterial = solidChunkMaterialByTextureKey.get(cacheKey);
    if (existingMaterial) {
      return existingMaterial;
    }

    const layeredMaterial = createLayeredTextureMaterial(normalizedTextureKey, normalizedTextureInfluence);
    if (layeredMaterial) {
      solidChunkMaterialByTextureKey.set(cacheKey, layeredMaterial);
      return layeredMaterial;
    }

    const nextMaterial = applyTextureInfluenceToMaterial(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: normalizedTextureKey === 'bordered'
        ? borderedVoxelTexture
        : (normalizedTextureKey ? getLoadedSolidChunkTexture(normalizedTextureKey) : null),
      vertexColors: true,
      side: THREE.FrontSide,
      roughness: 0.95,
      metalness: 0.0,
    }), normalizedTextureInfluence);
    solidChunkMaterialByTextureKey.set(cacheKey, nextMaterial);
    return nextMaterial;
  }

  function createChunkKeyFromCell(cellX, cellY, cellZ) {
    const voxelAddress = world.getChunkVoxelAddress(cellX, cellY, cellZ);
    if (!voxelAddress?.chunk) {
      return '';
    }

    return world.getChunkKey(
      voxelAddress.chunk.x,
      voxelAddress.chunk.y,
      voxelAddress.chunk.z
    );
  }

  function invalidateChunkRenderState(chunkKey = '') {
    if (typeof chunkKey !== 'string' || !chunkKey.trim()) {
      return false;
    }

    return chunkRenderStateByKey.delete(chunkKey);
  }

  function invalidateChunkRenderStateForCell(cellX, cellY, cellZ, { includeNeighbors = false } = {}) {
    const chunkKey = createChunkKeyFromCell(cellX, cellY, cellZ);
    if (!chunkKey) {
      return false;
    }

    invalidateChunkRenderState(chunkKey);

    if (!includeNeighbors) {
      return true;
    }

    const chunkPosition = typeof world.parseChunkKey === 'function'
      ? world.parseChunkKey(chunkKey)
      : null;
    if (!chunkPosition) {
      return true;
    }

    for (const offset of Object.values(FACE_NEIGHBOR_OFFSETS)) {
      const neighborChunkX = chunkPosition.x + offset.x;
      const neighborChunkY = chunkPosition.y + offset.y;
      const neighborChunkZ = chunkPosition.z + offset.z;
      if (!world.isChunkPositionWithinWorld(neighborChunkX, neighborChunkY, neighborChunkZ)) {
        continue;
      }

      invalidateChunkRenderState(world.getChunkKey(neighborChunkX, neighborChunkY, neighborChunkZ));
    }

    return true;
  }

  function buildChunkRenderState(chunkKey = '', chunkPosition = null, chunkEntry = null) {
    if (!chunkEntry?.boxel || !chunkPosition) {
      return null;
    }

    const chunkVoxelEntries = chunkEntry.boxel.getVoxelEntries({ activeOnly: true });
    const nonOpaqueCells = [];
    const boundarySensitiveEntries = [];
    const chunkSize = world.getChunkSize();

    for (let i = 0; i < chunkVoxelEntries.length; i += 1) {
      const entry = chunkVoxelEntries[i];
      const cellX = chunkPosition.x * chunkSize + entry.position.x;
      const cellY = chunkPosition.y * chunkSize + entry.position.y;
      const cellZ = chunkPosition.z * chunkSize + entry.position.z;
      const voxel = readWorldVoxel(cellX, cellY, cellZ);
      if (isOpaqueCubeVoxel(voxel)) {
        continue;
      }

      nonOpaqueCells.push({ cellX, cellY, cellZ });

      const localPosition = entry.position;
      if (
        localPosition.x === 0
        || localPosition.x === chunkSize - 1
        || localPosition.y === 0
        || localPosition.y === chunkSize - 1
        || localPosition.z === 0
        || localPosition.z === chunkSize - 1
      ) {
        boundarySensitiveEntries.push(entry);
      }
    }

    return {
      chunkVoxelEntryCount: chunkVoxelEntries.length,
      nonOpaqueCells,
      boundarySensitiveEntries,
    };
  }

  function getChunkRenderState(chunkKey = '', chunkPosition = null, chunkEntry = null) {
    const existingState = chunkRenderStateByKey.get(chunkKey);
    if (existingState) {
      return existingState;
    }

    const nextState = buildChunkRenderState(chunkKey, chunkPosition, chunkEntry);
    if (!nextState) {
      return null;
    }

    chunkRenderStateByKey.set(chunkKey, nextState);
    return nextState;
  }

  function scheduleSolidChunkJob(chunkKey = '', action = 'rebuild', { priority = false } = {}) {
    if (typeof chunkKey !== 'string' || !chunkKey.trim()) {
      return false;
    }

    const normalizedAction = action === 'remove' ? 'remove' : 'rebuild';
    const targetQueue = priority ? pendingPrioritySolidChunkJobs : pendingSolidChunkJobs;
    targetQueue.set(chunkKey, normalizedAction);

    if (priority) {
      pendingSolidChunkJobs.delete(chunkKey);
    }
    return true;
  }

  function scheduleSolidChunkNeighbors(chunkKey = '', action = 'rebuild', options = {}) {
    const chunkPosition = typeof world.parseChunkKey === 'function'
      ? world.parseChunkKey(chunkKey)
      : null;
    if (!chunkPosition) {
      return false;
    }

    for (const offset of Object.values(FACE_NEIGHBOR_OFFSETS)) {
      const neighborChunkX = chunkPosition.x + offset.x;
      const neighborChunkY = chunkPosition.y + offset.y;
      const neighborChunkZ = chunkPosition.z + offset.z;
      if (!world.isChunkPositionWithinWorld(neighborChunkX, neighborChunkY, neighborChunkZ)) {
        continue;
      }
      if (!world.isChunkActive(neighborChunkX, neighborChunkY, neighborChunkZ)) {
        continue;
      }

      scheduleSolidChunkJob(
        world.getChunkKey(neighborChunkX, neighborChunkY, neighborChunkZ),
        action,
        options
      );
    }

    return true;
  }

  function scheduleSolidChunkRebuildForCell(cellX, cellY, cellZ, { includeNeighbors = false, priority = false } = {}) {
    const chunkKey = createChunkKeyFromCell(cellX, cellY, cellZ);
    if (!chunkKey) {
      return false;
    }

    scheduleSolidChunkJob(chunkKey, 'rebuild', { priority });
    if (includeNeighbors) {
      scheduleSolidChunkNeighbors(chunkKey, 'rebuild', { priority });
    }
    return true;
  }

  function getChunkDistanceToCenterSq(chunkKey = '', center = null) {
    const chunkPosition = typeof world.parseChunkKey === 'function'
      ? world.parseChunkKey(chunkKey)
      : null;
    if (!chunkPosition) {
      return Number.POSITIVE_INFINITY;
    }

    const centerChunkPosition = world.boxel15DistanceRendering?.getCenterChunkPosition?.(world, center)
      ?? { x: 0, y: 0, z: 0 };
    const surfaceChunkY = Math.max(
      0,
      Math.floor(Math.max(0, (world.land?.y ?? 1) - 1) / Math.max(1, world.getChunkSize()))
    );
    const priorityCenterY = usesLazyChunkGeneration
      ? Math.min(centerChunkPosition.y, surfaceChunkY)
      : centerChunkPosition.y;
    const deltaX = chunkPosition.x - centerChunkPosition.x;
    const deltaY = chunkPosition.y - priorityCenterY;
    const deltaZ = chunkPosition.z - centerChunkPosition.z;
    return deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
  }

  function sortChunkKeysByDistance(chunkKeys = [], center = null) {
    return [...chunkKeys].sort((leftChunkKey, rightChunkKey) =>
      getChunkDistanceToCenterSq(leftChunkKey, center) - getChunkDistanceToCenterSq(rightChunkKey, center)
    );
  }

  function takeNearestPendingSolidChunkJob(center = null) {
    let nearestChunkKey = '';
    let nearestAction = '';
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const [chunkKey, action] of pendingSolidChunkJobs.entries()) {
      const chunkDistance = getChunkDistanceToCenterSq(chunkKey, center);
      if (chunkDistance >= nearestDistance) {
        continue;
      }

      nearestChunkKey = chunkKey;
      nearestAction = action;
      nearestDistance = chunkDistance;
    }

    if (!nearestChunkKey) {
      return null;
    }

    pendingSolidChunkJobs.delete(nearestChunkKey);
    return {
      chunkKey: nearestChunkKey,
      action: nearestAction,
    };
  }

  function takeNearestPendingPrioritySolidChunkJob(center = null) {
    let nearestChunkKey = '';
    let nearestAction = '';
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const [chunkKey, action] of pendingPrioritySolidChunkJobs.entries()) {
      const chunkDistance = getChunkDistanceToCenterSq(chunkKey, center);
      if (chunkDistance >= nearestDistance) {
        continue;
      }

      nearestChunkKey = chunkKey;
      nearestAction = action;
      nearestDistance = chunkDistance;
    }

    if (!nearestChunkKey) {
      return null;
    }

    pendingPrioritySolidChunkJobs.delete(nearestChunkKey);
    return {
      chunkKey: nearestChunkKey,
      action: nearestAction,
    };
  }

  function flushPrioritySolidChunkJobs(center = null, maxJobs = 8) {
    let processedJobs = 0;

    while (processedJobs < maxJobs && pendingPrioritySolidChunkJobs.size > 0) {
      const nextChunkJob = takeNearestPendingPrioritySolidChunkJob(center);
      if (!nextChunkJob) {
        break;
      }

      const { chunkKey, action } = nextChunkJob;
      if (action === 'remove') {
        removeSolidChunkMesh(chunkKey);
      } else {
        rebuildSolidChunkMesh(chunkKey);
      }

      processedJobs += 1;
    }

    return processedJobs;
  }

  function collectSolidChunkKeysForCell(cellX, cellY, cellZ, { includeNeighbors = false } = {}) {
    const chunkKey = createChunkKeyFromCell(cellX, cellY, cellZ);
    if (!chunkKey) {
      return [];
    }

    const chunkKeys = new Set([chunkKey]);
    if (!includeNeighbors) {
      return [...chunkKeys];
    }

    const chunkPosition = typeof world.parseChunkKey === 'function'
      ? world.parseChunkKey(chunkKey)
      : null;
    if (!chunkPosition) {
      return [...chunkKeys];
    }

    const chunkSize = world.getChunkSize();
    const voxelAddress = world.getChunkVoxelAddress(cellX, cellY, cellZ);
    const local = voxelAddress?.local;
    if (!local) {
      return [...chunkKeys];
    }

    const boundaryOffsets = [];
    if (local.x === 0) boundaryOffsets.push(FACE_NEIGHBOR_OFFSETS.left);
    if (local.x === chunkSize - 1) boundaryOffsets.push(FACE_NEIGHBOR_OFFSETS.right);
    if (local.y === 0) boundaryOffsets.push(FACE_NEIGHBOR_OFFSETS.bottom);
    if (local.y === chunkSize - 1) boundaryOffsets.push(FACE_NEIGHBOR_OFFSETS.top);
    if (local.z === 0) boundaryOffsets.push(FACE_NEIGHBOR_OFFSETS.back);
    if (local.z === chunkSize - 1) boundaryOffsets.push(FACE_NEIGHBOR_OFFSETS.front);

    for (let i = 0; i < boundaryOffsets.length; i += 1) {
      const offset = boundaryOffsets[i];
      const neighborChunkX = chunkPosition.x + offset.x;
      const neighborChunkY = chunkPosition.y + offset.y;
      const neighborChunkZ = chunkPosition.z + offset.z;
      if (
        !world.isChunkPositionWithinWorld(neighborChunkX, neighborChunkY, neighborChunkZ)
        || !world.isChunkActive(neighborChunkX, neighborChunkY, neighborChunkZ)
      ) continue;

      chunkKeys.add(world.getChunkKey(neighborChunkX, neighborChunkY, neighborChunkZ));
    }

    return [...chunkKeys];
  }

  function rebuildImmediateSolidChunksForCell(cellX, cellY, cellZ, { includeNeighbors = false } = {}) {
    const chunkKeys = collectSolidChunkKeysForCell(cellX, cellY, cellZ, { includeNeighbors });
    for (let i = 0; i < chunkKeys.length; i += 1) {
      const chunkKey = chunkKeys[i];
      pendingPrioritySolidChunkJobs.delete(chunkKey);
      pendingSolidChunkJobs.delete(chunkKey);
      rebuildSolidChunkMesh(chunkKey);
    }
    return chunkKeys.length;
  }

  function queueChunkActivation(chunkKey = '') {
    if (typeof chunkKey !== 'string' || !chunkKey.trim()) {
      return false;
    }

    pendingChunkActivationJobs.add(chunkKey);
    return true;
  }

  function dropPendingChunkActivation(chunkKey = '') {
    if (typeof chunkKey !== 'string' || !chunkKey.trim()) {
      return false;
    }

    return pendingChunkActivationJobs.delete(chunkKey);
  }

  function takeNearestPendingChunkActivation(center = null) {
    let nearestChunkKey = '';
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const chunkKey of pendingChunkActivationJobs.values()) {
      const chunkDistance = getChunkDistanceToCenterSq(chunkKey, center);
      if (chunkDistance >= nearestDistance) {
        continue;
      }

      nearestChunkKey = chunkKey;
      nearestDistance = chunkDistance;
    }

    if (!nearestChunkKey) {
      return null;
    }

    pendingChunkActivationJobs.delete(nearestChunkKey);
    return nearestChunkKey;
  }

  function getGreedyHitVoxelCell(hit = null, directionMultiplier = -1) {
    if (!hit?.object || !hit?.face) return null;
    if (hit.object.userData?.isGreedySolidChunk !== true) return null;

    hitNormalWorld.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    hitVoxelPoint.copy(hit.point).addScaledVector(hitNormalWorld, 0.001 * directionMultiplier);

    const gridPosition = world.mapToGridPosition(
      hitVoxelPoint.x,
      hitVoxelPoint.y,
      hitVoxelPoint.z,
      voxelSize
    );

    return {
      cellX: Math.floor(gridPosition.x),
      cellY: Math.floor(gridPosition.y),
      cellZ: Math.floor(gridPosition.z),
    };
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
      textureInfluence: normalizeTextureInfluence(voxel?.textureInfluence),
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

  function removeSolidChunkMesh(chunkKey = '') {
    const existingMesh = solidChunkMeshByKey.get(chunkKey);
    if (!existingMesh) {
      return false;
    }

    existingMesh.traverse(part => {
      if (part?.geometry?.dispose) {
        part.geometry.dispose();
      }
    });
    solidChunkGroup.remove(existingMesh);
    solidChunkMeshByKey.delete(chunkKey);
    return true;
  }

  function ensureGeometryBucket(bucketMap, textureKey = '', textureInfluence = 1) {
    const normalizedTextureKey = typeof textureKey === 'string' ? textureKey.trim() : '';
    const normalizedTextureInfluence = normalizeTextureInfluence(textureInfluence);
    const cacheKey = `${normalizedTextureKey || 'solid'}|${normalizedTextureInfluence.toFixed(3)}`;
    const existingBucket = bucketMap.get(cacheKey);
    if (existingBucket) {
      return existingBucket;
    }

    const nextBucket = {
      textureKey: normalizedTextureKey,
      textureInfluence: normalizedTextureInfluence,
      positions: [],
      normals: [],
      colors: [],
      uvs: [],
      indices: [],
      vertexCount: 0,
    };
    bucketMap.set(cacheKey, nextBucket);
    return nextBucket;
  }

  function pushGreedyQuad(bucket, vertices, normal, colorHex, width, height) {
    const baseIndex = bucket.vertexCount;
    const color = new THREE.Color(colorHex);

    for (let i = 0; i < vertices.length; i += 1) {
      const vertex = vertices[i];
      bucket.positions.push(vertex[0], vertex[1], vertex[2]);
      bucket.normals.push(normal[0], normal[1], normal[2]);
      bucket.colors.push(color.r, color.g, color.b);
    }

    bucket.uvs.push(
      0, 0,
      width, 0,
      width, height,
      0, height
    );
    bucket.indices.push(
      baseIndex,
      baseIndex + 1,
      baseIndex + 2,
      baseIndex,
      baseIndex + 2,
      baseIndex + 3
    );
    bucket.vertexCount += 4;
  }

  function createSolidVoxelFaceGeometry(cellX, cellY, cellZ, faceName, voxel = null) {
    const minX = worldOrigin.x + cellX * voxelSize;
    const minY = worldOrigin.y + cellY * voxelSize;
    const minZ = worldOrigin.z + cellZ * voxelSize;
    const maxX = minX + voxelSize;
    const maxY = minY + voxelSize;
    const maxZ = minZ + voxelSize;
    const faceSpecs = {
      right: {
        normal: [1, 0, 0],
        vertices: [[maxX, minY, minZ], [maxX, maxY, minZ], [maxX, maxY, maxZ], [maxX, minY, maxZ]],
      },
      left: {
        normal: [-1, 0, 0],
        vertices: [[minX, minY, maxZ], [minX, maxY, maxZ], [minX, maxY, minZ], [minX, minY, minZ]],
      },
      top: {
        normal: [0, 1, 0],
        vertices: [[minX, maxY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ], [minX, maxY, minZ]],
      },
      bottom: {
        normal: [0, -1, 0],
        vertices: [[minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [minX, minY, maxZ]],
      },
      front: {
        normal: [0, 0, 1],
        vertices: [[minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ]],
      },
      back: {
        normal: [0, 0, -1],
        vertices: [[maxX, minY, minZ], [minX, minY, minZ], [minX, maxY, minZ], [maxX, maxY, minZ]],
      },
    };
    const faceSpec = faceSpecs[faceName];
    if (!faceSpec) return null;

    const color = new THREE.Color(normalizeColor(voxel?.color));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(faceSpec.vertices.flat(), 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
      ...faceSpec.normal,
      ...faceSpec.normal,
      ...faceSpec.normal,
      ...faceSpec.normal,
    ], 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute([
      color.r, color.g, color.b,
      color.r, color.g, color.b,
      color.r, color.g, color.b,
      color.r, color.g, color.b,
    ], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }

  function removeTemporaryExposedFacesForChunk(chunkKey = '') {
    const existingGroup = temporaryExposedFaceGroupByChunkKey.get(chunkKey);
    if (!existingGroup) return false;

    existingGroup.traverse(part => {
      if (part?.geometry?.dispose) {
        part.geometry.dispose();
      }
    });
    solidChunkGroup.remove(existingGroup);
    temporaryExposedFaceGroupByChunkKey.delete(chunkKey);
    return true;
  }

  function removeTemporaryExposedFacesForCell(cellX, cellY, cellZ, { includeNeighbors = false } = {}) {
    const chunkKeys = collectSolidChunkKeysForCell(cellX, cellY, cellZ, { includeNeighbors });
    for (let i = 0; i < chunkKeys.length; i += 1) {
      removeTemporaryExposedFacesForChunk(chunkKeys[i]);
    }
  }

  function addTemporaryExposedFacesForRemovedCell(cellX, cellY, cellZ) {
    const meshByChunkKey = new Map();

    for (const [faceName, offset] of Object.entries(FACE_NEIGHBOR_OFFSETS)) {
      const neighborCellX = cellX + offset.x;
      const neighborCellY = cellY + offset.y;
      const neighborCellZ = cellZ + offset.z;
      if (!world.isVoxelCellActive(neighborCellX, neighborCellY, neighborCellZ)) continue;

      const neighborVoxel = readWorldVoxel(neighborCellX, neighborCellY, neighborCellZ);
      if (!isOpaqueCubeVoxel(neighborVoxel)) continue;

      const exposedFaceName = OPPOSITE_FACE_BY_NAME[faceName];
      const geometry = createSolidVoxelFaceGeometry(
        neighborCellX,
        neighborCellY,
        neighborCellZ,
        exposedFaceName,
        neighborVoxel
      );
      if (!geometry) continue;

      const mesh = new THREE.Mesh(
        geometry,
        getSolidChunkMaterial(
          getSolidVoxelTextureKey(neighborVoxel),
          getSolidVoxelTextureInfluence(neighborVoxel)
        )
      );
      const chunkKey = createChunkKeyFromCell(neighborCellX, neighborCellY, neighborCellZ);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.userData.isGreedySolidChunk = true;
      mesh.userData.chunkKey = chunkKey;
      mesh.userData.isTemporaryExposedFace = true;

      if (!meshByChunkKey.has(chunkKey)) {
        meshByChunkKey.set(chunkKey, []);
      }
      meshByChunkKey.get(chunkKey).push(mesh);
    }

    for (const [chunkKey, meshes] of meshByChunkKey.entries()) {
      let chunkGroup = temporaryExposedFaceGroupByChunkKey.get(chunkKey);
      if (!chunkGroup) {
        chunkGroup = new THREE.Group();
        chunkGroup.name = `${mapGroup.name} Temporary Faces ${chunkKey}`;
        chunkGroup.userData.isGreedySolidChunk = true;
        chunkGroup.userData.chunkKey = chunkKey;
        chunkGroup.userData.isTemporaryExposedFaces = true;
        solidChunkGroup.add(chunkGroup);
        temporaryExposedFaceGroupByChunkKey.set(chunkKey, chunkGroup);
      }
      for (let i = 0; i < meshes.length; i += 1) {
        chunkGroup.add(meshes[i]);
      }
    }
  }

  function getSolidVoxelMergeSignature(voxel = null, cell = null) {
    const baseSignature = getSolidVoxelSignature(voxel);
    if (!baseSignature) {
      return '';
    }

    const textureKey = getSolidVoxelTextureKey(voxel);
    if (textureKey === 'bordered' || parseLayeredTextureKey(textureKey)) {
      return `${baseSignature}|cell:${cell?.x ?? 0}|${cell?.y ?? 0}|${cell?.z ?? 0}`;
    }

    return baseSignature;
  }

  function createSolidChunkGeometry(chunkPosition, chunkEntry) {
    if (!chunkEntry?.boxel) {
      return [];
    }

    const bucketMap = new Map();
    const chunkSize = world.getChunkSize();
    const chunkBaseX = chunkPosition.x * chunkSize;
    const chunkBaseY = chunkPosition.y * chunkSize;
    const chunkBaseZ = chunkPosition.z * chunkSize;
    const faceConfigs = [
      {
        faceName: 'right',
        sliceMax: chunkSize,
        widthMax: chunkSize,
        heightMax: chunkSize,
        toCell: (slice, widthIndex, heightIndex) => ({
          x: chunkBaseX + slice,
          y: chunkBaseY + heightIndex,
          z: chunkBaseZ + widthIndex,
        }),
        getVertices: (slice, widthIndex, heightIndex, width, height) => {
          const planeX = worldOrigin.x + (chunkBaseX + slice + 1) * voxelSize;
          const minY = worldOrigin.y + (chunkBaseY + heightIndex) * voxelSize;
          const maxY = minY + height * voxelSize;
          const minZ = worldOrigin.z + (chunkBaseZ + widthIndex) * voxelSize;
          const maxZ = minZ + width * voxelSize;
          return {
            normal: [1, 0, 0],
            vertices: [
              [planeX, minY, minZ],
              [planeX, maxY, minZ],
              [planeX, maxY, maxZ],
              [planeX, minY, maxZ],
            ],
          };
        },
      },
      {
        faceName: 'left',
        sliceMax: chunkSize,
        widthMax: chunkSize,
        heightMax: chunkSize,
        toCell: (slice, widthIndex, heightIndex) => ({
          x: chunkBaseX + slice,
          y: chunkBaseY + heightIndex,
          z: chunkBaseZ + widthIndex,
        }),
        getVertices: (slice, widthIndex, heightIndex, width, height) => {
          const planeX = worldOrigin.x + (chunkBaseX + slice) * voxelSize;
          const minY = worldOrigin.y + (chunkBaseY + heightIndex) * voxelSize;
          const maxY = minY + height * voxelSize;
          const minZ = worldOrigin.z + (chunkBaseZ + widthIndex) * voxelSize;
          const maxZ = minZ + width * voxelSize;
          return {
            normal: [-1, 0, 0],
            vertices: [
              [planeX, minY, maxZ],
              [planeX, maxY, maxZ],
              [planeX, maxY, minZ],
              [planeX, minY, minZ],
            ],
          };
        },
      },
      {
        faceName: 'top',
        sliceMax: chunkSize,
        widthMax: chunkSize,
        heightMax: chunkSize,
        toCell: (slice, widthIndex, heightIndex) => ({
          x: chunkBaseX + widthIndex,
          y: chunkBaseY + slice,
          z: chunkBaseZ + heightIndex,
        }),
        getVertices: (slice, widthIndex, heightIndex, width, height) => {
          const planeY = worldOrigin.y + (chunkBaseY + slice + 1) * voxelSize;
          const minX = worldOrigin.x + (chunkBaseX + widthIndex) * voxelSize;
          const maxX = minX + width * voxelSize;
          const minZ = worldOrigin.z + (chunkBaseZ + heightIndex) * voxelSize;
          const maxZ = minZ + height * voxelSize;
          return {
            normal: [0, 1, 0],
            vertices: [
              [minX, planeY, maxZ],
              [maxX, planeY, maxZ],
              [maxX, planeY, minZ],
              [minX, planeY, minZ],
            ],
          };
        },
      },
      {
        faceName: 'bottom',
        sliceMax: chunkSize,
        widthMax: chunkSize,
        heightMax: chunkSize,
        toCell: (slice, widthIndex, heightIndex) => ({
          x: chunkBaseX + widthIndex,
          y: chunkBaseY + slice,
          z: chunkBaseZ + heightIndex,
        }),
        getVertices: (slice, widthIndex, heightIndex, width, height) => {
          const planeY = worldOrigin.y + (chunkBaseY + slice) * voxelSize;
          const minX = worldOrigin.x + (chunkBaseX + widthIndex) * voxelSize;
          const maxX = minX + width * voxelSize;
          const minZ = worldOrigin.z + (chunkBaseZ + heightIndex) * voxelSize;
          const maxZ = minZ + height * voxelSize;
          return {
            normal: [0, -1, 0],
            vertices: [
              [minX, planeY, minZ],
              [maxX, planeY, minZ],
              [maxX, planeY, maxZ],
              [minX, planeY, maxZ],
            ],
          };
        },
      },
      {
        faceName: 'front',
        sliceMax: chunkSize,
        widthMax: chunkSize,
        heightMax: chunkSize,
        toCell: (slice, widthIndex, heightIndex) => ({
          x: chunkBaseX + widthIndex,
          y: chunkBaseY + heightIndex,
          z: chunkBaseZ + slice,
        }),
        getVertices: (slice, widthIndex, heightIndex, width, height) => {
          const planeZ = worldOrigin.z + (chunkBaseZ + slice + 1) * voxelSize;
          const minX = worldOrigin.x + (chunkBaseX + widthIndex) * voxelSize;
          const maxX = minX + width * voxelSize;
          const minY = worldOrigin.y + (chunkBaseY + heightIndex) * voxelSize;
          const maxY = minY + height * voxelSize;
          return {
            normal: [0, 0, 1],
            vertices: [
              [minX, minY, planeZ],
              [maxX, minY, planeZ],
              [maxX, maxY, planeZ],
              [minX, maxY, planeZ],
            ],
          };
        },
      },
      {
        faceName: 'back',
        sliceMax: chunkSize,
        widthMax: chunkSize,
        heightMax: chunkSize,
        toCell: (slice, widthIndex, heightIndex) => ({
          x: chunkBaseX + widthIndex,
          y: chunkBaseY + heightIndex,
          z: chunkBaseZ + slice,
        }),
        getVertices: (slice, widthIndex, heightIndex, width, height) => {
          const planeZ = worldOrigin.z + (chunkBaseZ + slice) * voxelSize;
          const minX = worldOrigin.x + (chunkBaseX + widthIndex) * voxelSize;
          const maxX = minX + width * voxelSize;
          const minY = worldOrigin.y + (chunkBaseY + heightIndex) * voxelSize;
          const maxY = minY + height * voxelSize;
          return {
            normal: [0, 0, -1],
            vertices: [
              [maxX, minY, planeZ],
              [minX, minY, planeZ],
              [minX, maxY, planeZ],
              [maxX, maxY, planeZ],
            ],
          };
        },
      },
    ];

    for (let configIndex = 0; configIndex < faceConfigs.length; configIndex += 1) {
      const faceConfig = faceConfigs[configIndex];
      for (let slice = 0; slice < faceConfig.sliceMax; slice += 1) {
        const mask = new Array(faceConfig.widthMax * faceConfig.heightMax).fill(null);

        for (let heightIndex = 0; heightIndex < faceConfig.heightMax; heightIndex += 1) {
          for (let widthIndex = 0; widthIndex < faceConfig.widthMax; widthIndex += 1) {
            const cell = faceConfig.toCell(slice, widthIndex, heightIndex);
            const voxel = readWorldVoxel(cell.x, cell.y, cell.z);
            if (!isOpaqueCubeVoxel(voxel)) {
              continue;
            }
            if (!shouldRenderVoxelFace(cell.x, cell.y, cell.z, faceConfig.faceName, voxel)) {
              continue;
            }

            mask[heightIndex * faceConfig.widthMax + widthIndex] = {
              signature: getSolidVoxelMergeSignature(voxel, cell),
              colorHex: new THREE.Color(normalizeColor(voxel?.color)).getHex(),
              textureKey: getSolidVoxelTextureKey(voxel),
              textureInfluence: getSolidVoxelTextureInfluence(voxel),
            };
          }
        }

        for (let heightIndex = 0; heightIndex < faceConfig.heightMax; heightIndex += 1) {
          for (let widthIndex = 0; widthIndex < faceConfig.widthMax; widthIndex += 1) {
            const maskIndex = heightIndex * faceConfig.widthMax + widthIndex;
            const faceEntry = mask[maskIndex];
            if (!faceEntry) {
              continue;
            }

            let width = 1;
            while (widthIndex + width < faceConfig.widthMax) {
              const nextEntry = mask[heightIndex * faceConfig.widthMax + widthIndex + width];
              if (!nextEntry || nextEntry.signature !== faceEntry.signature) {
                break;
              }
              width += 1;
            }

            let height = 1;
            let canGrowHeight = true;
            while (heightIndex + height < faceConfig.heightMax && canGrowHeight) {
              for (let scanWidth = 0; scanWidth < width; scanWidth += 1) {
                const nextEntry = mask[(heightIndex + height) * faceConfig.widthMax + widthIndex + scanWidth];
                if (!nextEntry || nextEntry.signature !== faceEntry.signature) {
                  canGrowHeight = false;
                  break;
                }
              }

              if (canGrowHeight) {
                height += 1;
              }
            }

            const geometryBucket = ensureGeometryBucket(bucketMap, faceEntry.textureKey, faceEntry.textureInfluence);
            const quad = faceConfig.getVertices(slice, widthIndex, heightIndex, width, height);
            pushGreedyQuad(
              geometryBucket,
              quad.vertices,
              quad.normal,
              faceEntry.colorHex,
              width,
              height
            );

            for (let clearHeight = 0; clearHeight < height; clearHeight += 1) {
              for (let clearWidth = 0; clearWidth < width; clearWidth += 1) {
                mask[(heightIndex + clearHeight) * faceConfig.widthMax + widthIndex + clearWidth] = null;
              }
            }
          }
        }
      }
    }

    return Array.from(bucketMap.values()).map(bucket => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(bucket.colors, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uvs, 2));
      geometry.setIndex(bucket.indices);
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
      return {
        geometry,
        textureKey: bucket.textureKey,
        textureInfluence: bucket.textureInfluence,
      };
    });
  }

  function rebuildSolidChunkMesh(chunkKey = '') {
    const chunkPosition = typeof world.parseChunkKey === 'function'
      ? world.parseChunkKey(chunkKey)
      : null;
    if (!chunkPosition) {
      return false;
    }

    removeTemporaryExposedFacesForChunk(chunkKey);
    removeSolidChunkMesh(chunkKey);

    if (!world.isChunkActive(chunkPosition.x, chunkPosition.y, chunkPosition.z)) {
      return true;
    }

    const chunkEntry = world.getChunkEntry(chunkPosition.x, chunkPosition.y, chunkPosition.z);
    const chunkGeometries = createSolidChunkGeometry(chunkPosition, chunkEntry);
    if (chunkGeometries.length === 0) {
      return true;
    }

    const chunkGroup = new THREE.Group();
    chunkGroup.name = `${mapGroup.name} Chunk ${chunkKey}`;
    chunkGroup.userData.isGreedySolidChunk = true;
    chunkGroup.userData.chunkKey = chunkKey;

    for (let i = 0; i < chunkGeometries.length; i += 1) {
      const entry = chunkGeometries[i];
      const mesh = new THREE.Mesh(
        entry.geometry,
        getSolidChunkMaterial(entry.textureKey, entry.textureInfluence)
      );
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.userData.isGreedySolidChunk = true;
      mesh.userData.chunkKey = chunkKey;
      chunkGroup.add(mesh);
    }

    solidChunkGroup.add(chunkGroup);
    solidChunkMeshByKey.set(chunkKey, chunkGroup);
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
      const neighborVoxel = readWorldVoxel(neighborCellX, neighborCellY, neighborCellZ);
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
        continue;
      }

      addColliderForCell(neighborCellX, neighborCellY, neighborCellZ);
      scheduleSolidChunkRebuildForCell(neighborCellX, neighborCellY, neighborCellZ, { priority: true });
    }
  }

  function refreshVoxelVisual(cellX, cellY, cellZ) {
    if (!world.isVoxelCellActive(cellX, cellY, cellZ)) {
      return false;
    }

    const voxel = readWorldVoxel(cellX, cellY, cellZ);
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
      removeColliderForCell(cellX, cellY, cellZ);
      invalidateChunkRenderStateForCell(cellX, cellY, cellZ, { includeNeighbors: true });
      scheduleSolidChunkRebuildForCell(cellX, cellY, cellZ, { priority: true });
      return true;
    }

    if (isVoxelPlane(voxel) || hasImageTextureFaces(voxel)) {
      const texturedVoxelMesh = isVoxelPlane(voxel)
        ? createVoxelPlaneMesh(cellX, cellY, cellZ, voxel)
        : createTexturedVoxelMesh(cellX, cellY, cellZ, voxel);
      if (!texturedVoxelMesh) {
        removeColliderForCell(cellX, cellY, cellZ);
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
      invalidateChunkRenderStateForCell(cellX, cellY, cellZ, { includeNeighbors: true });
      return true;
    }

    addColliderForCell(cellX, cellY, cellZ);
    invalidateChunkRenderStateForCell(cellX, cellY, cellZ, { includeNeighbors: true });
    scheduleSolidChunkRebuildForCell(cellX, cellY, cellZ, { priority: true });
    return true;
  }

  function syncWorldVoxelAddedAtCell(cellX, cellY, cellZ, {
    refreshNeighbors = true,
    immediateSolidChunkJobs = refreshNeighbors,
  } = {}) {
    const voxel = readWorldVoxel(cellX, cellY, cellZ);
    if (!voxel) return false;

    if (!world.isVoxelCellActive(cellX, cellY, cellZ)) {
      return true;
    }

    registerVoxelType(voxel);
    removeTemporaryExposedFacesForCell(cellX, cellY, cellZ, { includeNeighbors: true });
    refreshVoxelVisual(cellX, cellY, cellZ);
    if (refreshNeighbors) {
      refreshAdjacentVoxelVisuals(cellX, cellY, cellZ);
    }
    if (immediateSolidChunkJobs) {
      rebuildImmediateSolidChunksForCell(cellX, cellY, cellZ, { includeNeighbors: true });
    }
    return true;
  }

  function syncWorldVoxelRemovedAtCell(cellX, cellY, cellZ, {
    refreshNeighbors = true,
    immediateSolidChunkJobs = refreshNeighbors,
  } = {}) {
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
    invalidateChunkRenderStateForCell(cellX, cellY, cellZ, { includeNeighbors: true });
    scheduleSolidChunkRebuildForCell(cellX, cellY, cellZ, { includeNeighbors: true, priority: true });
    if (!immediateSolidChunkJobs) {
      addTemporaryExposedFacesForRemovedCell(cellX, cellY, cellZ);
    }
    if (refreshNeighbors) {
      refreshAdjacentVoxelVisuals(cellX, cellY, cellZ);
    }
    if (immediateSolidChunkJobs) {
      rebuildImmediateSolidChunksForCell(cellX, cellY, cellZ, { includeNeighbors: true });
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

    const chunkRenderState = getChunkRenderState(chunkKey, chunkPosition, chunkEntry);
    if (!chunkRenderState) {
      return false;
    }

    for (let i = 0; i < chunkRenderState.nonOpaqueCells.length; i += 1) {
      const cell = chunkRenderState.nonOpaqueCells[i];
      pendingChunkVisualJobs.push({
        type: action,
        cellX: cell.cellX,
        cellY: cell.cellY,
        cellZ: cell.cellZ,
      });
    }

    scheduleSolidChunkJob(chunkKey, action === 'remove' ? 'remove' : 'rebuild');
    scheduleSolidChunkNeighbors(chunkKey, 'rebuild');
    refreshChunkBoundaryNeighbors(chunkPosition, chunkRenderState.boundarySensitiveEntries);

    return true;
  }

  function updateActiveChunks(center = null) {
    const chunkDelta = typeof world.updateActiveChunks === 'function'
      ? world.updateActiveChunks(center)
      : { added: [], removed: [], active: [] };
    if (center && typeof center === 'object') {
      centerChunkWorldPosition.x = Number(center.x) || 0;
      centerChunkWorldPosition.y = Number(center.y) || 0;
      centerChunkWorldPosition.z = Number(center.z) || 0;
    }
    const sortedRemovedChunkKeys = sortChunkKeysByDistance(chunkDelta.removed, center).reverse();
    const sortedAddedChunkKeys = sortChunkKeysByDistance(chunkDelta.added, center);

    for (let i = 0; i < sortedRemovedChunkKeys.length; i += 1) {
      dropPendingChunkActivation(sortedRemovedChunkKeys[i]);
      enqueueChunkVisualJobs(sortedRemovedChunkKeys[i], 'remove');
    }

    for (let i = 0; i < sortedAddedChunkKeys.length; i += 1) {
      queueChunkActivation(sortedAddedChunkKeys[i]);
    }

    return chunkDelta;
  }

  function processPendingChunkVisualUpdates(maxJobs = 120) {
    const maxFrameTimeMs = 2.5;
    const maxChunkActivationsPerFrame = 2;
    const maxSolidChunkJobsPerFrame = 1;
    const frameStartTime = typeof performance?.now === 'function'
      ? performance.now()
      : 0;
    const pendingCenter = centerChunkWorldPosition;
    let processedChunkActivations = 0;
    let processedJobs = 0;
    let processedSolidChunkJobs = 0;

    while (
      processedJobs < maxJobs
      && (
        pendingChunkActivationJobs.size > 0
        || pendingChunkBoundaryJobs.length > 0
        || pendingChunkVisualJobs.length > 0
        || pendingPrioritySolidChunkJobs.size > 0
        || pendingSolidChunkJobs.size > 0
      )
    ) {
      if (
        processedJobs > 0
        && frameStartTime > 0
        && typeof performance?.now === 'function'
        && performance.now() - frameStartTime >= maxFrameTimeMs
      ) {
        break;
      }

      if (pendingChunkActivationJobs.size > 0 && processedChunkActivations < maxChunkActivationsPerFrame) {
        const nextActivationChunkKey = takeNearestPendingChunkActivation(pendingCenter);
        if (!nextActivationChunkKey) break;
        enqueueChunkVisualJobs(nextActivationChunkKey, 'add');
        processedChunkActivations += 1;
      } else if (pendingChunkBoundaryJobs.length > 0 || pendingChunkVisualJobs.length > 0) {
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
      } else {
        if (processedSolidChunkJobs >= maxSolidChunkJobsPerFrame) {
          break;
        }

        const nextChunkJob = takeNearestPendingPrioritySolidChunkJob(pendingCenter)
          ?? takeNearestPendingSolidChunkJob(pendingCenter);
        if (!nextChunkJob) break;

        const { chunkKey, action } = nextChunkJob;
        if (action === 'remove') {
          removeSolidChunkMesh(chunkKey);
        } else {
          rebuildSolidChunkMesh(chunkKey);
        }
        processedSolidChunkJobs += 1;
      }

      processedJobs += 1;
    }

    const remainingJobs =
      pendingChunkActivationJobs.size
      + pendingChunkBoundaryJobs.length
      + pendingChunkVisualJobs.length
      + pendingPrioritySolidChunkJobs.size
      + pendingSolidChunkJobs.size;

    return {
      processedJobs,
      remainingJobs,
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

    return getGreedyHitVoxelCell(hit, -1);
  }

  function getAdjacentVoxelCellFromRaycastHit(hit) {
    if (!hit?.object || !hit.face) return null;

    const greedyVoxelCell = getGreedyHitVoxelCell(hit, 1);
    if (greedyVoxelCell) {
      return greedyVoxelCell;
    }

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
  const borderedVoxelTexture = createBorderedVoxelTexture();
  const solidChunkMaterialByTextureKey = new Map();
  const centerChunkWorldPosition = world.spawnPosition ?? { x: 0, y: 0, z: 0 };
  const planeRaycastMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const solidChunkGroup = new THREE.Group();
  const texturedVoxelGroup = new THREE.Group();
  const planeRaycastGroup = new THREE.Group();
  solidChunkGroup.name = `${mapGroup.name} Solid Chunks`;
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
    }

    if (!isVoxelFullyOccluded(position.x, position.y, position.z, voxel)) {
      addColliderForCell(position.x, position.y, position.z);
    }
  }

  for (const chunkKey of sortChunkKeysByDistance(world.getActiveChunkKeys(), world.spawnPosition)) {
    scheduleSolidChunkJob(chunkKey, 'rebuild');
  }
  const boundaryColliders = createWorldBoundaryColliders();
  buildingColliders.push(...boundaryColliders);

  mapGroup.add(solidChunkGroup);
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
    raycastTargets: [solidChunkGroup, texturedVoxelGroup, planeRaycastGroup],
    miniMapStaticLayer: {
      type: 'voxel-grid',
      worldMinX: worldOrigin.x,
      worldMinZ: worldOrigin.z,
      worldWidth: world.size.x * voxelSize,
      worldDepth: world.size.z * voxelSize,
      pixelWidth: miniMapPixelWidth,
      pixelHeight: miniMapPixelHeight,
      sampleColor(cellX, cellZ) {
        if (staticMiniMapColor) {
          return cellX >= 0 && cellX < miniMapPixelWidth && cellZ >= 0 && cellZ < miniMapPixelHeight
            ? staticMiniMapColor
            : null;
        }

        const worldCellX = miniMapPixelWidth === world.size.x
          ? cellX
          : Math.min(
            world.size.x - 1,
            Math.max(0, Math.floor((cellX / Math.max(1, miniMapPixelWidth)) * world.size.x))
          );
        const worldCellZ = miniMapPixelHeight === world.size.z
          ? cellZ
          : Math.min(
            world.size.z - 1,
            Math.max(0, Math.floor((cellZ / Math.max(1, miniMapPixelHeight)) * world.size.z))
          );

        for (let cellY = world.size.y - 1; cellY >= 0; cellY -= 1) {
          const voxel = readWorldVoxel(worldCellX, cellY, worldCellZ);
          if (!voxel) continue;
          return voxel.color ?? null;
        }
        return null;
      },
    },
    voxelTypes: Array.from(voxelTypesByName.values()),
    resolveRaycastLabel(hit) {
      const voxelCell = getVoxelCellFromRaycastHit(hit);
      if (!voxelCell) return null;
      return readWorldVoxel(voxelCell.cellX, voxelCell.cellY, voxelCell.cellZ)?.name ?? null;
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
            textureInfluence: normalizeTextureInfluence(voxelType.textureInfluence),
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
          textureInfluence: normalizeTextureInfluence(voxelType.textureInfluence),
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
        textureInfluence: normalizeTextureInfluence(voxelType.textureInfluence),
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
            if (!isCollidableVoxel(readWorldVoxel(cellX, cellY, cellZ))) continue;

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
            if (isCollidableVoxel(readWorldVoxel(cellX, cellY, cellZ))) {
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
            if (!isCollidableVoxel(readWorldVoxel(cellX, cellY, cellZ))) continue;
            targetBoxes.push(setBoxFromCell(cellX, cellY, cellZ).clone());
          }
        }
      }

      return targetBoxes;
    },
    shadowRange: resolveWorldShadowRange(),
    miniMapViewSize: Math.max(world.size.x, world.size.z),
    miniMapHeight: Math.max(world.size.y + 20, 60),
  };
}
