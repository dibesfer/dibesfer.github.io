function normalizeMiniMapColor(color) {
  if (typeof color === 'number' && Number.isFinite(color)) {
    return `#${Math.max(0, color).toString(16).padStart(6, '0').slice(-6)}`;
  }

  if (typeof color === 'string') {
    const trimmed = color.trim();
    return trimmed || null;
  }

  return null;
}

function buildStaticMiniMapCanvas(staticLayer) {
  if (!staticLayer) return null;

  const pixelWidth = Math.max(1, Math.floor(staticLayer.pixelWidth ?? 0));
  const pixelHeight = Math.max(1, Math.floor(staticLayer.pixelHeight ?? 0));
  const sampleColor = typeof staticLayer.sampleColor === 'function'
    ? staticLayer.sampleColor
    : null;

  if (!sampleColor) return null;

  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const context = canvas.getContext('2d');

  if (!context) return null;

  const imageData = context.createImageData(pixelWidth, pixelHeight);
  const data = imageData.data;

  for (let z = 0; z < pixelHeight; z += 1) {
    for (let x = 0; x < pixelWidth; x += 1) {
      const color = normalizeMiniMapColor(sampleColor(x, z));
      if (!color) continue;

      const pixelIndex = (z * pixelWidth + x) * 4;
      const hex = color.startsWith('#') ? color.slice(1) : color;
      const normalizedHex = hex.length === 3
        ? hex.split('').map(char => char + char).join('')
        : hex.padStart(6, '0').slice(-6);

      data[pixelIndex] = Number.parseInt(normalizedHex.slice(0, 2), 16);
      data[pixelIndex + 1] = Number.parseInt(normalizedHex.slice(2, 4), 16);
      data[pixelIndex + 2] = Number.parseInt(normalizedHex.slice(4, 6), 16);
      data[pixelIndex + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

export function createMiniMapUI(options) {
  const miniMap = options.miniMap;
  const entities = options.entities;
  const playerEye = options.playerEye;
  const getPlayerFacingDirection = options.getPlayerFacingDirection;
  const miniMapViewSize = options.miniMapViewSize;
  const staticLayer = options.staticLayer ?? null;

  const miniMapPlayerMarker = document.createElement('div');
  const entityMiniMapMarkers = new Map();
  const miniMapFacing = { x: 0, z: -1 };
  const staticMiniMapCanvas = buildStaticMiniMapCanvas(staticLayer);
  const backgroundCanvas = staticMiniMapCanvas ?? document.createElement('canvas');
  const MINIMAP_TARGET_FPS = 8;
  const MINIMAP_FRAME_INTERVAL = 1 / MINIMAP_TARGET_FPS;
  let miniMapFrameAccumulator = MINIMAP_FRAME_INTERVAL;
  let miniMapRenderDirty = true;
  let width = 200;
  let height = 200;
  let pixelsPerWorldX = 1;
  let pixelsPerWorldZ = 1;
  let staticLayerScreenWidth = 0;
  let staticLayerScreenHeight = 0;

  miniMap.style.overflow = 'hidden';

  backgroundCanvas.id = 'miniMapBackground';
  backgroundCanvas.style.position = 'absolute';
  backgroundCanvas.style.left = '0';
  backgroundCanvas.style.top = '0';
  backgroundCanvas.style.transformOrigin = 'top left';
  backgroundCanvas.style.imageRendering = 'pixelated';
  backgroundCanvas.style.pointerEvents = 'none';

  if (!staticMiniMapCanvas) {
    backgroundCanvas.width = 1;
    backgroundCanvas.height = 1;
  }

  miniMap.appendChild(backgroundCanvas);

  miniMapPlayerMarker.id = 'miniMapPlayerMarker';
  miniMapPlayerMarker.style.pointerEvents = 'none';
  miniMap.appendChild(miniMapPlayerMarker);

  function getEntityMiniMapMarkerClass(entity) {
    if (entity.miniMapType === 'chaser') return 'mini-map-marker--chaser';
    if (entity.miniMapType === 'talker') return 'mini-map-marker--talker';
    return 'mini-map-marker--walker';
  }

  function syncEntityMiniMapMarkers() {
    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i];
      let marker = entityMiniMapMarkers.get(entity);
      if (!marker) {
        marker = document.createElement('div');
        marker.className = 'mini-map-entity-marker ' + getEntityMiniMapMarkerClass(entity);
        marker.style.pointerEvents = 'none';
        miniMap.appendChild(marker);
        entityMiniMapMarkers.set(entity, marker);
      }
      marker.__seenInFrame = true;
    }

    entityMiniMapMarkers.forEach((marker, entity) => {
      if (marker.__seenInFrame) {
        marker.__seenInFrame = false;
        return;
      }

      marker.remove();
      entityMiniMapMarkers.delete(entity);
    });
  }

  function updateStaticLayerTransform() {
    if (!staticLayer || !staticMiniMapCanvas) return;

    const worldWidth = Math.max(0.0001, staticLayer.worldWidth ?? staticMiniMapCanvas.width);
    const worldDepth = Math.max(0.0001, staticLayer.worldDepth ?? staticMiniMapCanvas.height);
    const worldMinX = staticLayer.worldMinX ?? 0;
    const worldMinZ = staticLayer.worldMinZ ?? 0;

    staticLayerScreenWidth = worldWidth * pixelsPerWorldX;
    staticLayerScreenHeight = worldDepth * pixelsPerWorldZ;
    backgroundCanvas.style.width = `${staticLayerScreenWidth}px`;
    backgroundCanvas.style.height = `${staticLayerScreenHeight}px`;
    backgroundCanvas.style.left = `${width * 0.5 + (worldMinX - playerEye.x) * pixelsPerWorldX}px`;
    backgroundCanvas.style.top = `${height * 0.5 + (worldMinZ - playerEye.z) * pixelsPerWorldZ}px`;
  }

  function updateMiniMapSize() {
    width = miniMap.clientWidth || 200;
    height = miniMap.clientHeight || 200;
    const worldViewHeight = Math.max(0.0001, miniMapViewSize);
    const worldViewWidth = worldViewHeight * (width / Math.max(1, height));

    pixelsPerWorldX = width / worldViewWidth;
    pixelsPerWorldZ = height / worldViewHeight;
    updateStaticLayerTransform();
    miniMapRenderDirty = true;
  }

  function updatePlayerMarker() {
    if (typeof getPlayerFacingDirection === 'function') {
      const facingDirection = getPlayerFacingDirection();
      if (facingDirection) {
        miniMapFacing.x = facingDirection.x;
        miniMapFacing.z = facingDirection.z;
      }
    }

    const facingLengthSq = miniMapFacing.x * miniMapFacing.x + miniMapFacing.z * miniMapFacing.z;
    if (facingLengthSq > 0.0001) {
      const rotation = Math.atan2(miniMapFacing.x, -miniMapFacing.z);
      miniMapPlayerMarker.style.transform = `translate(-50%, -50%) rotate(${rotation}rad)`;
    }
  }

  function updateEntityMarkers() {
    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i];
      const marker = entityMiniMapMarkers.get(entity);
      if (!marker) continue;

      const screenX = width * 0.5 + (entity.position.x - playerEye.x) * pixelsPerWorldX;
      const screenY = height * 0.5 + (entity.position.z - playerEye.z) * pixelsPerWorldZ;
      const insideView =
        screenX >= 0 && screenX <= width &&
        screenY >= 0 && screenY <= height;

      marker.style.display = insideView ? 'block' : 'none';
      if (!insideView) continue;

      marker.style.left = `${screenX}px`;
      marker.style.top = `${screenY}px`;
      marker.style.transform = `translate(-50%, -50%) rotate(${
        entity.direction && entity.direction.lengthSq() > 0.0001
          ? Math.atan2(entity.direction.x, -entity.direction.z)
          : 0
      }rad)`;
    }
  }

  function renderMiniMapFrame() {
    updateStaticLayerTransform();
    updatePlayerMarker();
    syncEntityMiniMapMarkers();
    updateEntityMarkers();
  }

  function updateMiniMap(deltaTime, force) {
    if (force === true) {
      miniMapFrameAccumulator = 0;
      miniMapRenderDirty = false;
      renderMiniMapFrame();
      return;
    }

    miniMapFrameAccumulator += Number.isFinite(deltaTime) ? deltaTime : 0;

    if (!miniMapRenderDirty && miniMapFrameAccumulator < MINIMAP_FRAME_INTERVAL) {
      return;
    }

    miniMapFrameAccumulator %= MINIMAP_FRAME_INTERVAL;
    miniMapRenderDirty = false;
    renderMiniMapFrame();
  }

  return {
    setPixelRatio() {
      // The 2D minimap no longer needs WebGL pixel-ratio scaling.
    },
    updateMiniMap,
    updateMiniMapSize,
  };
}
