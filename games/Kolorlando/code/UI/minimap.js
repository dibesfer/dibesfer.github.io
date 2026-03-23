import * as THREE from 'three';

export function createMiniMapUI(options) {
  const miniMap = options.miniMap;
  const scene = options.scene;
  const camera = options.camera;
  const entities = options.entities;
  const playerEye = options.playerEye;
  const getPlayerFacingDirection = options.getPlayerFacingDirection;
  const groundY = options.groundY;
  const miniMapViewSize = options.miniMapViewSize;
  const miniMapHeight = options.miniMapHeight;

  const miniMapPlayerMarker = document.createElement('div');
  const entityMiniMapMarkers = new Map();
  const miniMapRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const miniMapCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  const miniMapFacing = new THREE.Vector3();
  const miniMapProjectedPos = new THREE.Vector3();

  miniMapPlayerMarker.id = 'miniMapPlayerMarker';
  miniMap.appendChild(miniMapPlayerMarker);
  miniMapRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  miniMapRenderer.shadowMap.enabled = false;
  miniMap.appendChild(miniMapRenderer.domElement);
  miniMapCamera.up.set(0, 0, -1);
  scene.add(miniMapCamera);

  function updateMiniMapSize() {
    const width = miniMap.clientWidth || 200;
    const height = miniMap.clientHeight || 200;
    const aspect = width / height;
    const halfHeight = miniMapViewSize * 0.5;
    const halfWidth = halfHeight * aspect;

    miniMapCamera.left = -halfWidth;
    miniMapCamera.right = halfWidth;
    miniMapCamera.top = halfHeight;
    miniMapCamera.bottom = -halfHeight;
    miniMapCamera.updateProjectionMatrix();
    miniMapRenderer.setSize(width, height, false);
  }

  function getEntityMiniMapMarkerClass(entity) {
    if (entity.miniMapType === 'chaser') return 'mini-map-marker--chaser';
    if (entity.miniMapType === 'talker') return 'mini-map-marker--talker';
    return 'mini-map-marker--walker';
  }

  function syncEntityMiniMapMarkers() {
    const aliveEntities = new Set(entities);

    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i];
      let marker = entityMiniMapMarkers.get(entity);
      if (!marker) {
        marker = document.createElement('div');
        marker.className = 'mini-map-entity-marker ' + getEntityMiniMapMarkerClass(entity);
        miniMap.appendChild(marker);
        entityMiniMapMarkers.set(entity, marker);
      }
    }

    entityMiniMapMarkers.forEach(function (marker, entity) {
      if (!aliveEntities.has(entity)) {
        marker.remove();
        entityMiniMapMarkers.delete(entity);
      }
    });
  }

  function updateMiniMap() {
    miniMapCamera.position.set(playerEye.x, playerEye.y + miniMapHeight, playerEye.z);
    miniMapCamera.lookAt(playerEye.x, groundY, playerEye.z);

    if (typeof getPlayerFacingDirection === 'function') {
      const facingDirection = getPlayerFacingDirection();
      if (facingDirection) {
        miniMapFacing.copy(facingDirection);
      } else {
        camera.getWorldDirection(miniMapFacing);
      }
    } else {
      camera.getWorldDirection(miniMapFacing);
    }
    miniMapFacing.y = 0;

    if (miniMapFacing.lengthSq() > 0.0001) {
      miniMapFacing.normalize();
      miniMapPlayerMarker.style.transform = 'translate(-50%, -50%) rotate(' + Math.atan2(miniMapFacing.x, -miniMapFacing.z) + 'rad)';
    }

    syncEntityMiniMapMarkers();

    const width = miniMap.clientWidth || 200;
    const height = miniMap.clientHeight || 200;

    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i];
      const marker = entityMiniMapMarkers.get(entity);
      if (!marker) continue;

      miniMapProjectedPos.set(entity.position.x, groundY, entity.position.z).project(miniMapCamera);
      const insideView =
        miniMapProjectedPos.z >= -1 &&
        miniMapProjectedPos.z <= 1 &&
        Math.abs(miniMapProjectedPos.x) <= 1 &&
        Math.abs(miniMapProjectedPos.y) <= 1;

      marker.style.display = insideView ? 'block' : 'none';
      if (!insideView) continue;

      marker.style.left = (miniMapProjectedPos.x * 0.5 + 0.5) * width + 'px';
      marker.style.top = (-miniMapProjectedPos.y * 0.5 + 0.5) * height + 'px';
      marker.style.transform = 'translate(-50%, -50%) rotate(' + (entity.direction && entity.direction.lengthSq() > 0.0001 ? Math.atan2(entity.direction.x, -entity.direction.z) : 0) + 'rad)';
    }

    miniMapRenderer.render(scene, miniMapCamera);
  }

  return {
    setPixelRatio: function (value) {
      miniMapRenderer.setPixelRatio(value);
    },
    updateMiniMap: updateMiniMap,
    updateMiniMapSize: updateMiniMapSize,
  };
}
