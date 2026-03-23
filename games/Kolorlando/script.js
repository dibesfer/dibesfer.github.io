import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HunterEntity, TalkerEntity } from './entity.js';
import {
  createHumanoidModel,
  applyHumanoidIdleAnimation,
  applyHumanoidWalkAnimation,
  applyHumanoidRightPunchAnimation,
  applyHumanoidLeftPunchAnimation,
} from './entityModel.js';
import { createGameAudio } from './audio.js';
import { createMiniMapUI } from './code/UI/minimap.js';
import { createMenuUI } from './code/UI/menu.js';
import { createCameraModeController } from './code/graphics/camera.js';
import { createScreenController } from './code/graphics/screen.js';
import {
  createInventoryUI,
  GAME_MODE_SURVIVAL,
} from './code/UI/inventory.js';
import { createChatUI } from './code/UI/chat.js';
import { createPlayerHud } from './playerHud.js';
import { CoinItemAppearance, GoxelItemAppearance, ItemAppearance } from './itemAppearance.js';
import { buildSimpleMap } from './maps/simpleMap.js';
import { buildCityMap } from './maps/cityMap.js';
import { buildVoxelandiaMap } from './maps/voxelandiaMap.js';

let mobileMode = false;
const touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
const THIRD_PERSON_MAX_DISTANCE = 8;
const LEGO_LOL_MIN_THIRD_PERSON_DISTANCE = 3;
const THIRD_PERSON_DISTANCE_INPUT_SCALE = 0.01;
const JOYSTICK_MAX_OFFSET = 50;
const SUPPORT_EPSILON = 0.03;
const gltfLoader = new GLTFLoader();

// --------------------
// SCENE
// --------------------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x5EC9FF, 0.002);

// --------------------
// CAMERA
// --------------------
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.03,
  3000
);
const playerEye = new THREE.Vector3(5, 3, 5);
camera.position.copy(playerEye);
scene.add(camera);

// --------------------
// RENDERER
// --------------------
const consola = document.getElementById('consola');
const miniMap = document.getElementById('miniMap');
const menuCentral = document.getElementById('menuCentral');
const menuCloseButton = document.getElementById('menuCloseButton');
const menuTabButtons = Array.from(document.querySelectorAll('#menuCentral .menu-tab'));
const menuPanels = Array.from(document.querySelectorAll('#menuCentral .menu-panel'));
const playButton = document.getElementById('playButton');
const menuInferior = document.getElementById('menuInferior');
const inventorySlots = document.getElementById('inventorySlots');
const inventorySelected = document.getElementById('inventorySelected');
const playerInventorySlots = document.getElementById('playerInventorySlots');
const itemEncyclopediaSlots = document.getElementById('itemEncyclopediaSlots');
const playerInventorySummary = document.getElementById('playerInventorySummary');
const playerInventorySelection = document.getElementById('playerInventorySelection');
const hotbarSlotEls = Array.from(document.querySelectorAll('#hotbar .hotbar-slot'));
const gameModeReadout = document.getElementById('gameModeReadout');
const gameModeButtons = Array.from(document.querySelectorAll('[data-game-mode]'));
const characterMenuPlayer = document.getElementById('kolorlandiaCharacterMenu_player');
const loadingScreen = document.getElementById('loadingScreen');
const loadingBarFill = document.getElementById('loadingBarFill');
const loadingText = document.getElementById('loadingText');
const buttonUp = document.getElementById('Right2');
const buttonDown = document.getElementById('buttonDown');
const buttonLeft1 = document.getElementById('Left1');
const buttonShoot = document.getElementById('buttonShoot');
const buttonRight1 = document.getElementById('Right1');
const buttonRight3 = document.getElementById('Right3');
const settingsFullScreen = document.getElementById('settingsFullScreen');
const settingsMenuThemeDark = document.getElementById('settingsMenuThemeDark');
const playerHealthFill = document.getElementById('playerHealthFill');
const playerHealthText = document.getElementById('playerHealthText');
const voxelReadout = document.getElementById('voxelReadout');
const wowCursorNdc = new THREE.Vector2();
const chatBox = document.getElementById('chatBox');
const chatBoxOutput = document.getElementById('chatBoxOutput');
const chatBoxInput = document.getElementById('chatBoxInput');
const buttonLeft0 = document.getElementById('Left0');
const cameraModeInputs = Array.from(document.querySelectorAll('input[name="cameraMode"]'));
const cameraModeWowInput = document.getElementById('cameraModeWow');
const cameraModeLegoLolInput = document.getElementById('cameraModeLegoLol');
let mobileShootPressed = false;
let mobileSprintEnabled = false;
let suppressRight3Click = false;
let openingChatFromPointerLock = false;
let characterPreviewDragState = null;
const gameAudio = createGameAudio();
const systemMenuThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let wowCameraDragState = null;
let wowCursorRaycastActive = false;
let cameraModeController = null;
let screenController = null;

function isLegoLolCameraMode() {
  return cameraModeController ? cameraModeController.isLegoLolCameraMode() : false;
}

function usesCenteredThirdPersonCamera() {
  return cameraModeController ? cameraModeController.usesCenteredThirdPersonCamera() : false;
}

function isScreenDragCameraMode() {
  return cameraModeController ? cameraModeController.isScreenDragCameraMode() : false;
}

function isScreenDragCameraActive() {
  return cameraModeController ? cameraModeController.isScreenDragCameraActive() : false;
}

function isDesktopGameplayActive() {
  return !mobileMode && (
    controls.isLocked
    || isScreenDragCameraActive()
    || (isLegoLolCameraMode() && !isMenuCentralVisible())
  );
}

function shouldUsePointerLock() {
  return cameraModeController ? cameraModeController.shouldUsePointerLock() : false;
}

function syncDesktopLookAnglesFromCamera() {
  yaw = camera.rotation.y;
  pitch = camera.rotation.x;
}

function setWowCameraScreenActive(nextActive) {
  if (!cameraModeController) return;
  cameraModeController.setWowCameraScreenActive(nextActive);
}

function setCurrentCameraMode(nextCameraMode) {
  if (!cameraModeController) return;
  cameraModeController.setCurrentCameraMode(nextCameraMode);
}

function syncCameraModeAvailability() {
  if (!cameraModeController) return;
  cameraModeController.syncCameraModeAvailability();
}
function activateDesktopScreenActivity() {
  if (mobileMode) return;
  hideMenuCentral();
  if (isLegoLolCameraMode()) {
    return;
  }
  if (isScreenDragCameraMode()) {
    setWowCameraScreenActive(true);
    return;
  }
  if (!controls.isLocked) {
    controls.lock();
  }
}
function deactivateDesktopScreenActivity(tabName = getActiveMenuCentralTab() || 'settings') {
  if (mobileMode) return;
  if (isLegoLolCameraMode()) {
    showMenuCentral(tabName, { force: true });
    return;
  }
  if (isScreenDragCameraMode()) {
    setWowCameraScreenActive(false);
    showMenuCentral(tabName, { force: true });
    return;
  }
  if (controls.isLocked) {
    controls.unlock();
    return;
  }
  showMenuCentral(tabName, { force: true });
}




function isTypingTarget(target) {
  return Boolean(
    target instanceof HTMLElement
      && (target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable)
  );
}

function setElementHidden(element, hidden) {
  if (!element) return;
  element.hidden = hidden;
}


function handleChatCommand(message) {
  const normalizedMessage = message.trim().toLowerCase();
  // Keep chat-command toggles centralized here so console-style commands reuse
  // the same state-changing helpers as keyboard shortcuts.
  if (normalizedMessage === '/debugmode') {
    setDebugMode(!debugModeEnabled);
    return true;
  }

  // Reuse the dedicated fly-mode setter so chat toggles keep jump/velocity
  // cleanup behavior identical to the keyboard shortcut.
  if (normalizedMessage === '/flymode') {
    setFlyMode(!flyMode);
    return true;
  }

  return false;
}

const chatUI = createChatUI({
  chatBox,
  chatBoxOutput,
  chatBoxInput,
  onCommand: handleChatCommand,
  onShow: () => {
    setMobileChatToggleState(true);
    if (!mobileMode && typeof controls !== 'undefined' && controls.isLocked) {
      openingChatFromPointerLock = true;
      controls.unlock();
    }
  },
  onHide: () => {
    setMobileChatToggleState(false);
    if (shouldUsePointerLock() && typeof controls !== 'undefined' && !controls.isLocked && !isMenuCentralVisible()) {
      controls.lock();
    }
  },
});

const menuUI = createMenuUI({
  menuCentral,
  menuTabButtons,
  menuPanels,
  settingsFullScreen,
  settingsMenuThemeDark,
  systemMenuThemeQuery,
  initialTab: 'settings',
});
let characterPreviewRenderer = null;
let characterPreviewScene = null;
let characterPreviewCamera = null;
let characterPreviewModel = null;
let characterPreviewModelRoot = null;
let characterPreviewIdleCycle = Math.random() * Math.PI * 2;
let characterPreviewWidth = 0;
let characterPreviewHeight = 0;
const CHARACTER_PREVIEW_LOOK_Y = 1.26;
const CHARACTER_PREVIEW_DRAG_THRESHOLD = 10;

function updateCharacterPreviewSize() {
  if (!characterMenuPlayer || !characterPreviewRenderer || !characterPreviewCamera) return;
  const width = Math.max(1, Math.round(characterMenuPlayer.clientWidth));
  const height = Math.max(1, Math.round(characterMenuPlayer.clientHeight));
  if (width === characterPreviewWidth && height === characterPreviewHeight) return;

  characterPreviewWidth = width;
  characterPreviewHeight = height;
  characterPreviewCamera.aspect = width / height;
  characterPreviewCamera.updateProjectionMatrix();
  characterPreviewRenderer.setSize(width, height, false);
}

function initCharacterPreview() {
  if (!characterMenuPlayer || characterPreviewRenderer) return;

  characterPreviewScene = new THREE.Scene();
  characterPreviewCamera = new THREE.PerspectiveCamera(24, 9 / 16, 0.1, 30);
  characterPreviewCamera.position.set(0, CHARACTER_PREVIEW_LOOK_Y, 5.1);
  characterPreviewCamera.lookAt(0, CHARACTER_PREVIEW_LOOK_Y, 0);

  characterPreviewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  characterPreviewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  characterPreviewRenderer.setClearColor(0x000000, 0);
  characterPreviewRenderer.outputColorSpace = THREE.SRGBColorSpace;
  characterPreviewRenderer.domElement.setAttribute('aria-hidden', 'true');
  characterMenuPlayer.appendChild(characterPreviewRenderer.domElement);

  const ambientLight = new THREE.HemisphereLight(0xf6fbff, 0x4b5566, 1.5);
  characterPreviewScene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
  keyLight.position.set(2.8, 4.4, 4.6);
  characterPreviewScene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xbfd8ff, 0.45);
  rimLight.position.set(-2.4, 1.8, -3.2);
  characterPreviewScene.add(rimLight);

  characterPreviewModel = createHumanoidModel({
    outfit: PLAYER_OUTFIT,
    castShadow: false,
    receiveShadow: false,
  });

  characterPreviewModelRoot = new THREE.Group();
  characterPreviewModelRoot.position.set(0, 1, 0);
  characterPreviewModel.root.position.set(0, -0.72, 0);
  characterPreviewModel.root.rotation.y = -0.42;
  characterPreviewModelRoot.add(characterPreviewModel.root);
  characterPreviewScene.add(characterPreviewModelRoot);
  updateCharacterPreviewSize();

  characterMenuPlayer.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    characterPreviewDragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      isRotating: !mobileMode,
      captureActive: false,
    };

    if (!mobileMode) {
      characterMenuPlayer.setPointerCapture?.(event.pointerId);
      characterPreviewDragState.captureActive = true;
    }
  });

  characterMenuPlayer.addEventListener('pointermove', event => {
    if (!characterPreviewDragState || event.pointerId !== characterPreviewDragState.pointerId || !characterPreviewModelRoot) {
      return;
    }

    if (mobileMode && !characterPreviewDragState.isRotating) {
      const totalDeltaX = event.clientX - characterPreviewDragState.startX;
      const totalDeltaY = event.clientY - characterPreviewDragState.startY;

      if (Math.abs(totalDeltaX) < CHARACTER_PREVIEW_DRAG_THRESHOLD && Math.abs(totalDeltaY) < CHARACTER_PREVIEW_DRAG_THRESHOLD) {
        return;
      }

      if (Math.abs(totalDeltaY) >= Math.abs(totalDeltaX)) {
        characterPreviewDragState = null;
        return;
      }

      characterPreviewDragState.isRotating = true;
      characterPreviewDragState.lastX = event.clientX;
      characterMenuPlayer.setPointerCapture?.(event.pointerId);
      characterPreviewDragState.captureActive = true;
    }

    if (!characterPreviewDragState.isRotating) {
      return;
    }

    const deltaX = event.clientX - characterPreviewDragState.lastX;
    characterPreviewDragState.lastX = event.clientX;
    characterPreviewModelRoot.rotation.y += deltaX * 0.014;
    event.preventDefault();
  });

  const stopCharacterPreviewDrag = event => {
    if (!characterPreviewDragState || event.pointerId !== characterPreviewDragState.pointerId) return;
    if (characterPreviewDragState.captureActive) {
      characterMenuPlayer.releasePointerCapture?.(event.pointerId);
    }
    characterPreviewDragState = null;
  };

  characterMenuPlayer.addEventListener('pointerup', stopCharacterPreviewDrag);
  characterMenuPlayer.addEventListener('pointercancel', stopCharacterPreviewDrag);
}

function syncAppHeight() {
  if (!screenController) return;
  screenController.syncAppHeight();
}

function updateModeFromViewport() {
  if (!screenController) return;
  screenController.updateModeFromViewport();
}

function getActiveMenuCentralTab() {
  return menuUI.getActiveTab();
}

function isMenuCentralVisible() {
  return menuUI.isVisible();
}

function setMenuCentralTab(tabName) {
  menuUI.setTab(tabName);
}

function showMenuCentral(tabName = getActiveMenuCentralTab(), { force = false } = {}) {
  setMobileInventoryToggleState(true);
  if (!force && !mobileMode && typeof controls !== 'undefined' && controls.isLocked) {
    hideMenuCentral();
    return;
  }
  if (isScreenDragCameraMode()) {
    setWowCameraScreenActive(false);
  }
  menuUI.show(tabName);
}

function hideMenuCentral() {
  setMobileInventoryToggleState(false);
  menuUI.hide();
}

if (menuCloseButton) {
  menuCloseButton.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    if (mobileMode) {
      hideMenuCentral();
      return;
    }
    activateDesktopScreenActivity();
  });
}

const sceneView = document.getElementById('sceneView');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x5EC9FF);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

sceneView.appendChild(renderer.domElement);

sceneView.addEventListener('pointermove', event => {
  updateWowCursorRaycastPointer(event.clientX, event.clientY);
  if (!wowCameraDragState || event.pointerId !== wowCameraDragState.pointerId || !isScreenDragCameraActive()) return;

  // WoW camera look is driven by drag deltas over the scene instead of pointer lock.
  const dx = event.clientX - wowCameraDragState.lastX;
  const dy = event.clientY - wowCameraDragState.lastY;
  wowCameraDragState.lastX = event.clientX;
  wowCameraDragState.lastY = event.clientY;
  wowCameraDragState.dragDistance += Math.hypot(dx, dy);
  yaw -= dx * sensitivity;
  pitch -= dy * sensitivity;
  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
  event.preventDefault();
});
sceneView.addEventListener('pointerenter', event => {
  updateWowCursorRaycastPointer(event.clientX, event.clientY);
});
sceneView.addEventListener('pointerleave', event => {
  if (wowCameraDragState && event.pointerId === wowCameraDragState.pointerId) return;
  clearWowCursorRaycastPointer();
});
sceneView.addEventListener('pointerdown', event => {
  if (!isScreenDragCameraActive() || isMenuCentralVisible() || event.button !== 0) return;
  wowCameraDragState = {
    pointerId: event.pointerId,
    lastX: event.clientX,
    lastY: event.clientY,
    dragDistance: 0,
  };
  sceneView.setPointerCapture?.(event.pointerId);
  updateWowCursorRaycastPointer(event.clientX, event.clientY);
});
const stopWowCameraDrag = event => {
  if (!wowCameraDragState || event.pointerId !== wowCameraDragState.pointerId) return;
  const dragDistance = wowCameraDragState.dragDistance;
  sceneView.releasePointerCapture?.(event.pointerId);
  wowCameraDragState = null;

  // A short click still acts like a gameplay click; only longer movement counts as camera dragging.
  if (event.type === 'pointerup' && dragDistance < 6 && isScreenDragCameraActive() && !isMenuCentralVisible()) {
    updateWowCursorRaycastPointer(event.clientX, event.clientY);
    updateVoxelRaycast();
    triggerActionForMouseButton(0);
  }
};
sceneView.addEventListener('pointerup', stopWowCameraDrag);
sceneView.addEventListener('pointercancel', stopWowCameraDrag);

function updateSceneViewSize() {
  const width = Math.max(1, sceneView.clientWidth);
  const height = Math.max(1, sceneView.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}


function updateLoadingUI(loaded, total) {
  const safeTotal = Math.max(1, total);
  const progress = Math.round((loaded / safeTotal) * 100);
  if (loadingBarFill) {
    loadingBarFill.style.width = `${progress}%`;
  }
  if (loadingText) {
    loadingText.textContent = `Loading assets... ${progress}%`;
  }
}


THREE.DefaultLoadingManager.onStart = (_url, itemsLoaded, itemsTotal) => {
  updateLoadingUI(itemsLoaded, itemsTotal);
};

THREE.DefaultLoadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
  updateLoadingUI(itemsLoaded, itemsTotal);
};

THREE.DefaultLoadingManager.onLoad = () => {
  updateLoadingUI(1, 1);
  if (!loadingScreen) return;
  requestAnimationFrame(() => {
    loadingScreen.classList.add('is-hidden');
    window.setTimeout(() => {
      loadingScreen.remove();
    }, 420);
  });
};

const textureLoader = new THREE.TextureLoader();
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
const BRICK_TILE_SIZE = 2.2;

const groundTexture = textureLoader.load('assets/grass.jpg');
groundTexture.colorSpace = THREE.SRGBColorSpace;
groundTexture.wrapS = THREE.RepeatWrapping;
groundTexture.wrapT = THREE.RepeatWrapping;
groundTexture.anisotropy = maxAnisotropy;

const brickTexture = textureLoader.load('assets/black-brick-wall.jpg');
brickTexture.colorSpace = THREE.SRGBColorSpace;
brickTexture.wrapS = THREE.RepeatWrapping;
brickTexture.wrapT = THREE.RepeatWrapping;
brickTexture.anisotropy = maxAnisotropy;

const spawnPadTexture = textureLoader.load('assets/1632.jpg');
spawnPadTexture.colorSpace = THREE.SRGBColorSpace;
spawnPadTexture.wrapS = THREE.ClampToEdgeWrapping;
spawnPadTexture.wrapT = THREE.ClampToEdgeWrapping;
spawnPadTexture.anisotropy = maxAnisotropy;

// --------------------
// CONTROLS
// --------------------
const controls = new PointerLockControls(camera, document.body);
controls.addEventListener('lock', () => {
  hideMenuCentral();
});
controls.addEventListener('unlock', () => {
  if (openingChatFromPointerLock) {
    openingChatFromPointerLock = false;
    return;
  }
  if (chatUI.isInputOpen()) {
    chatUI.hideInput();
    return;
  }
  if (!mobileMode) {
    showMenuCentral(getActiveMenuCentralTab() || 'settings', { force: true });
  }
});

function controlLocker(event) {
  if (!isMenuCentralVisible()) return;
  const clickedInsideMenu = Boolean(event?.target?.closest?.('#menuCentral'));
  const clickedMenuToggleButton = Boolean(event?.target?.closest?.('#Right3'));
  if (clickedInsideMenu || clickedMenuToggleButton) return;

  if (mobileMode) {
    hideMenuCentral();
    setElementHidden(menuInferior, false);
    menuInferior.classList.add('flex');
    return;
  }

  activateDesktopScreenActivity();
}

document.addEventListener('pointerdown', controlLocker);

function setInventoryPanelOpen(nextOpen, { allowMobile = false } = {}) {
  if (mobileMode) {
    if (!allowMobile) return;
    if (nextOpen) {
      showMenuCentral('creative');
    } else {
      hideMenuCentral();
    }
    return;
  }

  if (!nextOpen) return;
  if (controls.isLocked) {
    controls.unlock();
  }
  showMenuCentral('creative');
}

cameraModeController = createCameraModeController({
  cameraModeInputs,
  cameraModeWowInput,
  cameraModeLegoLolInput,
  getIsMobile: () => mobileMode,
  isPointerLocked: () => typeof controls !== 'undefined' && controls.isLocked,
  onSyncDesktopLookAngles: syncDesktopLookAnglesFromCamera,
  onDeactivateScreenDrag: () => {
    wowCameraDragState = null;
    clearWowCursorRaycastPointer();
  },
  onRequestUnlock: () => {
    if (typeof controls !== 'undefined' && controls.isLocked) {
      controls.unlock();
    }
  },
});
setCurrentCameraMode(cameraModeController.getCurrentCameraMode());


if (playButton) {
  playButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    gameAudio.unlockAudio(true);
    activateDesktopScreenActivity();
  });
}

const keys = {};
document.addEventListener('keydown', e => {
  gameAudio.unlockAudio(true);
  keys[e.code] = true;
});
document.addEventListener('keyup', e => keys[e.code] = false);

const moveSpeed = 10;
const flySpeed = 10;
const gravity = 30;
const jumpSpeed = 11;
const maxJumps = 2;
const PLAYER_MAX_HEALTH = 100;
let flyMode = false;

function updatePlayerHealthUI() {
  playerHud.setHealth(playerState.health);
}

function resetPlayerHealth() {
  playerState.health = playerState.maxHealth;
  updatePlayerHealthUI();
}

function respawnPlayerAfterDeath() {
  respawnPlayerAtSpawn();
  resetPlayerHealth();
}

function applyPlayerDamage(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  playerState.health = Math.max(0, playerState.health - amount);
  updatePlayerHealthUI();
  if (playerState.health > 0) return false;
  respawnPlayerAfterDeath();
  return true;
}

function getDesktopSprintMultiplier() {
  if (mobileMode) return mobileSprintEnabled ? 2 : 1;
  if (!isDesktopGameplayActive()) return 1;
  return keys['KeyE'] ? 2 : 1;
}

function setFlyMode(nextEnabled) {
  flyMode = nextEnabled;
  playerState.velocity.y = 0;
  playerState.jumpQueued = false;
  if (flyMode) {
    playerState.onGround = false;
    playerState.jumpsUsed = 0;
  }
}

// --------------------
// LIGHTS
// --------------------
const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.8);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(100, 200, 100);
dir.target.position.set(0, 0, 0);
dir.castShadow = true;
// Slightly lower shadow map resolution for a softer edge filter with PCFSoftShadowMap.
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.bias = -0.0002;
dir.shadow.normalBias = 0.02;
scene.add(dir);
scene.add(dir.target);

// --------------------
// GROUND
// --------------------
const MAP_PRESET = 'voxelandia'; // 'simple' | 'city' | 'voxelandia'
const mapBuilders = {
  simple: buildSimpleMap,
  city: buildCityMap,
  voxelandia: buildVoxelandiaMap,
};
const selectedMapBuilder = mapBuilders[MAP_PRESET] ?? buildSimpleMap;
const mapData = selectedMapBuilder({
  scene,
  camera,
  playerEye,
  groundTexture,
  brickTexture,
  spawnPadTexture,
  brickTileSize: BRICK_TILE_SIZE,
});
const GROUND_Y = mapData.groundY;
const buildingColliders = mapData.buildingColliders;
const entities = mapData.entities;
const raycastTargets = mapData.raycastTargets ?? [];
const resolveRaycastLabel = typeof mapData.resolveRaycastLabel === 'function'
  ? mapData.resolveRaycastLabel
  : () => null;
const removeVoxelAtRaycastHit = typeof mapData.removeVoxelAtRaycastHit === 'function'
  ? mapData.removeVoxelAtRaycastHit
  : () => false;
const addVoxelAtRaycastHit = typeof mapData.addVoxelAtRaycastHit === 'function'
  ? mapData.addVoxelAtRaycastHit
  : () => false;
const getVoxelBoxFromRaycastHit = typeof mapData.getVoxelBoxFromRaycastHit === 'function'
  ? mapData.getVoxelBoxFromRaycastHit
  : () => null;
const voxelTypes = Array.isArray(mapData.voxelTypes) ? mapData.voxelTypes : [];
const entityRaycastPoint = new THREE.Vector3();

function getEntityRaycastHit(origin, direction, maxDistance) {
  let closestHit = null;
  let closestDistance = maxDistance;

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const collider = entity?.collider;
    if (!collider) continue;
    if (!cameraRaycaster.ray.intersectBox(collider, entityRaycastPoint)) continue;

    const distance = origin.distanceTo(entityRaycastPoint);
    if (!Number.isFinite(distance) || distance > maxDistance || distance >= closestDistance) {
      continue;
    }

    const entityType = entity.typeLabel ?? 'Entity';
    const entityName = entity.name ? ` (${entity.name})` : '';
    closestDistance = distance;
    closestHit = {
      kind: 'entity',
      label: `${entityType}${entityName}`,
      entity,
      distance,
      point: entityRaycastPoint.clone(),
    };
  }

  return closestHit;
}

const itemRaycastPoint = new THREE.Vector3();

function getItemRaycastHit(origin, direction, maxDistance) {
  let closestHit = null;
  let closestDistance = maxDistance;

  for (let i = 0; i < itemAppearances.length; i++) {
    const itemAppearance = itemAppearances[i];
    const raycastSphere = itemAppearance?.raycastSphere;
    if (!raycastSphere || !(raycastSphere.radius > 0)) continue;
    if (!cameraRaycaster.ray.intersectSphere(raycastSphere, itemRaycastPoint)) continue;

    const distance = origin.distanceTo(itemRaycastPoint);
    if (!Number.isFinite(distance) || distance > maxDistance || distance >= closestDistance) {
      continue;
    }

    closestDistance = distance;
    closestHit = {
      kind: "item",
      label: itemAppearance.label ?? "Item",
      itemAppearance,
      distance,
      point: itemRaycastPoint.clone(),
    };
  }

  return closestHit;
}
const intersectMapColliderBox = typeof mapData.intersectColliderBox === 'function'
  ? mapData.intersectColliderBox
  : () => null;
const isMapBoxSupported = typeof mapData.isBoxSupported === 'function'
  ? mapData.isBoxSupported
  : () => false;
const collectMapDebugCollisionBoxes = typeof mapData.collectDebugCollisionBoxes === 'function'
  ? mapData.collectDebugCollisionBoxes
  : null;
const SHADOW_RANGE = mapData.shadowRange ?? 80;
const MINI_MAP_VIEW_SIZE = mapData.miniMapViewSize ?? 90;
const MINI_MAP_HEIGHT = mapData.miniMapHeight ?? 130;
const HAS_INFINITE_GROUND = mapData.hasInfiniteGround ?? true;
const miniMapUI = createMiniMapUI({
  miniMap,
  scene,
  camera,
  entities,
  playerEye,
  groundY: GROUND_Y,
  miniMapViewSize: MINI_MAP_VIEW_SIZE,
  miniMapHeight: MINI_MAP_HEIGHT,
});
const FALL_RESPAWN_Y = -100;
const playerSpawnPoint = mapData.spawnPoint.clone();
playerSpawnPoint.y += 1;

playerEye.copy(playerSpawnPoint);
camera.position.copy(playerEye);

const spawnTalkerPosition = playerSpawnPoint.clone().add(new THREE.Vector3(2.5, -1, 1.5));
entities.push(new TalkerEntity({
  scene,
  position: spawnTalkerPosition,
  groundY: GROUND_Y,
  name: 'Guide',
  dialogLines: ['Welcome back to Kolorlando', 'Check the item appearances nearby', 'Debug mode shows the item spheres'],
}));

const itemAppearances = [];
const PICKUP_ITEM_TYPES = new Set(['Sword', 'Gun', 'Coin']);
const PLAYER_PICKUP_RADIUS = 3;
const PLAYER_PICKUP_RADIUS_SQ = PLAYER_PICKUP_RADIUS * PLAYER_PICKUP_RADIUS;
const ITEM_PICKUP_COLLISION_RADIUS = 0.45;
const ITEM_PICKUP_MAGNET_MIN_SPEED = 1.6;
const ITEM_PICKUP_MAGNET_MAX_SPEED = 10.5;
const TEST_ITEM_SPAWN_DISTANCE = 3;
const TEST_ITEM_BEHIND_DISTANCE = 10;
const TEST_ITEM_SIDE_OFFSET = 2.8;
const firstItemSpawnPosition = playerSpawnPoint.clone().add(new THREE.Vector3(0, 0, -TEST_ITEM_SPAWN_DISTANCE));
itemAppearances.push(new ItemAppearance({
  scene,
  position: firstItemSpawnPosition,
  label: 'Spawn Point',
  inventoryType: 'Spawn Point',
  pickable: false,
  groundY: GROUND_Y,
}));

const swordItemSpawnPosition = playerSpawnPoint.clone().add(new THREE.Vector3(TEST_ITEM_SIDE_OFFSET, 0, -TEST_ITEM_BEHIND_DISTANCE));
itemAppearances.push(new GoxelItemAppearance({
  scene,
  position: swordItemSpawnPosition,
  label: 'Sword',
  inventoryType: 'Sword',
  pickable: true,
  groundY: GROUND_Y,
  modelUrl: 'assets/3D/weapons/sword.gltf',
}));

const gunItemSpawnPosition = playerSpawnPoint.clone().add(new THREE.Vector3(-TEST_ITEM_SIDE_OFFSET, 0, -TEST_ITEM_BEHIND_DISTANCE));
itemAppearances.push(new GoxelItemAppearance({
  scene,
  position: gunItemSpawnPosition,
  label: 'Gun',
  inventoryType: 'Gun',
  pickable: true,
  groundY: GROUND_Y,
  modelUrl: 'assets/3D/weapons/gun.gltf',
}));

const coinSpawnOffsets = [
  new THREE.Vector3(0, 0, -10),
  new THREE.Vector3(3.2, 0, -9.4),
  new THREE.Vector3(-3.2, 0, -9.4),
  new THREE.Vector3(6.2, 0, -7.5),
  new THREE.Vector3(-6.2, 0, -7.5),
  new THREE.Vector3(8.1, 0, -4.2),
  new THREE.Vector3(-8.1, 0, -4.2),
  new THREE.Vector3(8.4, 0, 0.5),
  new THREE.Vector3(-8.4, 0, 0.5),
  new THREE.Vector3(0, 0, 9.5),
];

for (let i = 0; i < coinSpawnOffsets.length; i++) {
  // These fixed offsets keep the coins around the same outer starter ring as the
  // sword and gun so players naturally encounter them while exploring the area.
  const coinPosition = playerSpawnPoint.clone().add(coinSpawnOffsets[i]);
  itemAppearances.push(new CoinItemAppearance({
    scene,
    position: coinPosition,
    label: 'Coin',
    inventoryType: 'Coin',
    pickable: true,
    groundY: GROUND_Y,
  }));
}


const inventoryUI = createInventoryUI({
  inventorySlots,
  inventorySelected,
  playerInventorySlots,
  itemEncyclopediaSlots,
  playerInventorySummary,
  playerInventorySelection,
  hotbarSlotEls,
  gameModeReadout,
  gameModeButtons,
  voxelTypes,
});

dir.shadow.camera.left = -SHADOW_RANGE;
dir.shadow.camera.right = SHADOW_RANGE;
dir.shadow.camera.top = SHADOW_RANGE;
dir.shadow.camera.bottom = -SHADOW_RANGE;
dir.shadow.camera.near = 10;
dir.shadow.camera.far = 600;
dir.shadow.camera.updateProjectionMatrix();

const CAMERA_RAYCAST_RANGE = 18;
const CAMERA_RAYCAST_START_OFFSET = 0.18;
const LEGO_LOL_RAYCAST_HEIGHT = 1;
const LEGO_LOL_RAYCAST_RANGE = 5;
const cameraRaycaster = new THREE.Raycaster();
cameraRaycaster.near = 0;
cameraRaycaster.far = CAMERA_RAYCAST_RANGE;
const cameraRayOrigin = new THREE.Vector3();
const cameraRayDirection = new THREE.Vector3();
const cameraRayEnd = new THREE.Vector3();
const cameraRayLineGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(),
  new THREE.Vector3(0, 0, -CAMERA_RAYCAST_RANGE),
]);
const cameraRayLine = new THREE.Line(
  cameraRayLineGeometry,
  new THREE.LineBasicMaterial({
    color: 0xff3a3a,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  })
);
cameraRayLine.frustumCulled = false;
cameraRayLine.renderOrder = 999;
cameraRayLine.visible = false;
scene.add(cameraRayLine);
const cameraRayTip = new THREE.Mesh(
  new THREE.SphereGeometry(0.045, 10, 10),
  new THREE.MeshBasicMaterial({
    color: 0xffb3b3,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  })
);
cameraRayTip.renderOrder = 1000;
cameraRayTip.frustumCulled = false;
cameraRayTip.visible = false;
scene.add(cameraRayTip);

const VOXEL_HIGHLIGHT_SCALE = 1.04;
const voxelHighlightMesh = new THREE.Mesh(
  new THREE.BoxGeometry(VOXEL_HIGHLIGHT_SCALE, VOXEL_HIGHLIGHT_SCALE, VOXEL_HIGHLIGHT_SCALE),
  new THREE.MeshStandardMaterial({
    color: 0xfff3a6,
    emissive: 0xffea84,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  })
);
voxelHighlightMesh.visible = false;
voxelHighlightMesh.renderOrder = 998;
scene.add(voxelHighlightMesh);
const voxelHighlightBox = new THREE.Box3();

// --------------------
// PLAYER BODY + COLLIDER
// --------------------
const PLAYER_HEIGHT = 1.8;
const PLAYER_HALF_WIDTH = 0.35;
const EYE_HEIGHT = 1.7;

const playerState = {
  velocity: new THREE.Vector3(0, 0, 0),
  onGround: false,
  jumpQueued: false,
  jumpsUsed: 0,
  maxHealth: PLAYER_MAX_HEALTH,
  health: PLAYER_MAX_HEALTH,
};
const playerHud = createPlayerHud({
  fillEl: playerHealthFill,
  textEl: playerHealthText,
  maxHealth: PLAYER_MAX_HEALTH,
});

screenController = createScreenController({
  touchQuery,
  onMobileModeChange: nextMobileMode => {
    mobileMode = nextMobileMode;
  },
  onSyncCameraModeAvailability: () => {
    syncCameraModeAvailability();
  },
  onEnterMobileMode: () => {
    if (controls.isLocked) {
      controls.unlock();
    }
    hideMenuCentral();
    setElementHidden(menuInferior, false);
    menuInferior.classList.add('flex');
  },
  onEnterDesktopMode: () => {
    setMenuCentralTab(getActiveMenuCentralTab() || 'settings');
    if (controls.isLocked) {
      hideMenuCentral();
    } else {
      showMenuCentral(getActiveMenuCentralTab() || 'settings');
    }
    setElementHidden(menuInferior, true);
    menuInferior.classList.remove('flex');
    mobileShootPressed = false;
    mobileSprintEnabled = false;
    setShootButtonState(false);
    setMobileChatToggleState(false);
    setMobileSprintState(false);
  },
  onPixelRatioChange: pixelRatio => {
    renderer.setPixelRatio(pixelRatio);
    miniMapUI.setPixelRatio(pixelRatio);
    if (characterPreviewRenderer) {
      characterPreviewRenderer.setPixelRatio(pixelRatio);
      updateCharacterPreviewSize();
    }
  },
  onResizeLayout: () => {
    updateSceneViewSize();
    miniMapUI.updateMiniMapSize();
    updatePlayerHealthUI();
  },
});
updateModeFromViewport();
syncAppHeight();
updateSceneViewSize();

const playerCollider = new THREE.Box3();
const playerFoot = new THREE.Vector3();
const previousFoot = new THREE.Vector3();
const testBox = new THREE.Box3();
const playerColliderMin = new THREE.Vector3();
const playerColliderMax = new THREE.Vector3();
const debugCollisionEntries = [];
const DEBUG_COLLISION_RADIUS = 4;
const DEBUG_COLLISION_COLOR_WORLD = 0x3ddcff;
const DEBUG_COLLISION_COLOR_ENTITY = 0x52e38c;
const DEBUG_COLLISION_COLOR_INTERSECTING = 0xff4d4d;
const playerBody = new THREE.Group();
const PLAYER_OUTFIT = {
  skin: 0xf0c9a5,
  shirt: 0x4f86f7,
  sleeves: 0x4f86f7,
  pants: 0x2d3a50,
  shoes: 0x161616,
  hair: 0x221710,
  faceEmoji: '😎',
};
initCharacterPreview();
const playerHumanoid = createHumanoidModel({
  outfit: PLAYER_OUTFIT,
  castShadow: true,
  receiveShadow: false,
});
playerBody.add(playerHumanoid.root);
playerBody.scale.set(1, PLAYER_HEIGHT / playerHumanoid.baseHeight, 1);

// Neutral defaults keep every held item consistent when first equipped.
// Individual items can still override any of these fields later if they need
// a custom grip, offset, or authored pivot rule.
const HELD_ITEM_DEFAULTS = {
  slotName: 'rightHandSlot',
  modelScale: 0.1,
  pivotMode: 'boundsCenter',
  position: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Euler(0, 0, 0),
};

// Held-item definitions now only need to provide asset-specific data unless an
// item wants to opt out of the neutral defaults above.
const HELD_ITEM_DEFINITIONS = {
  Sword: {
    // Swords use the middle of their base footprint as the hand anchor, then
    // rotate around that anchored point.
    modelUrl: 'assets/3D/weapons/sword.gltf',
    pivotMode: 'baseCenter',
    // Negative Y lifts the sword upward relative to the base-center hand anchor
    // so the grip point can sit a bit higher on the handle while preserving the
    // same base-derived attachment logic.
    position: new THREE.Vector3(0,0,  -0.2),
    // Adjust this authored hand rotation per sword if needed.
    rotation: new THREE.Euler(Math.PI * 0.5, 0, 0),
  },
  Gun: {
    // Guns can grip more naturally from the bottom-back of the model, so this
    // pivot uses the base center on X, the bottom on Y, and the back face on Z.
    modelUrl: 'assets/3D/weapons/gun.gltf',
    modelScale: 0.05,
    pivotMode: 'baseCenter',
    position: new THREE.Vector3(0,-0.2,0),

    rotation: new THREE.Euler(0, -Math.PI * 0.5, -Math.PI * 0.5),
  },
};
const heldItemTemplateCache = new Map();
let activeHeldItemType = null;
let activeHeldItemRoot = null;
let firstPersonHeldItemRoot = null;
let pendingHeldItemType = null;
let heldItemLoadRequestId = 0;
let firstPersonArmsRig = null;

function applyHeldItemShadows(root, castShadow, receiveShadow) {
  root.traverse(part => {
    if (!part.isMesh) return;
    part.castShadow = castShadow;
    part.receiveShadow = receiveShadow;
  });
}

function centerHeldItemModelOnBounds(root) {
  const bounds = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  root.position.sub(center);
  root.updateWorldMatrix(true, true);
}

function alignHeldItemPivot(root, pivotMode = 'boundsCenter') {
  const bounds = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  bounds.getCenter(center);

  // Different held items may need different authored grip pivots. For swords we
  // currently want the placeholder to hit the middle of the model base instead of
  // the exact volumetric center, so Y uses the bottom bound while X/Z stay centered.
  if (pivotMode === 'baseCenter') {
    root.position.x -= center.x;
    root.position.y -= bounds.min.y;
    root.position.z -= center.z;
    root.updateWorldMatrix(true, true);
    return;
  }

  if (pivotMode === 'baseBackCenter') {
    // This places the hand anchor at the middle of the model base while using
    // the back-most bound on Z, which is useful for gun-style grips.
    root.position.x -= center.x;
    root.position.y -= bounds.min.y;
    root.position.z -= bounds.min.z;
    root.updateWorldMatrix(true, true);
    return;
  }

  if (pivotMode === 'horizontalCenter') {
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.updateWorldMatrix(true, true);
    return;
  }

  centerHeldItemModelOnBounds(root);
}

function buildHeldItemMount(templateRoot, definition) {
  const mount = new THREE.Group();
  // The pivot group stays attached to the hand slot while the aligned mesh sits
  // beneath it. An extra correction node lets first-person apply view-specific
  // flips without changing the shared authored transform.
  const pivotRoot = new THREE.Group();
  const correctionRoot = new THREE.Group();
  const itemRoot = templateRoot.clone(true);
  mount.add(pivotRoot);
  pivotRoot.add(correctionRoot);
  correctionRoot.add(itemRoot);

  // Apply any authored hand offset before resolving the chosen grip anchor.
  pivotRoot.position.copy(definition.position ?? new THREE.Vector3());
  alignHeldItemPivot(itemRoot, definition.pivotMode);

  // Rotate the anchor, not the aligned mesh, so the grip point does not drift.
  pivotRoot.rotation.copy(definition.rotation ?? new THREE.Euler());
  correctionRoot.rotation.copy(definition.correctionRotation ?? new THREE.Euler());
  pivotRoot.updateWorldMatrix(true, true);

  return mount;
}

function loadHeldItemTemplate(definition) {
  const cachedTemplatePromise = heldItemTemplateCache.get(definition.modelUrl);
  if (cachedTemplatePromise) return cachedTemplatePromise;

  // Caching the load promise avoids duplicate GLTF requests when the player
  // flips across hotbar slots and later returns to the same held item.
  const templatePromise = new Promise((resolve, reject) => {
    gltfLoader.load(
      definition.modelUrl,
      gltf => {
        const root = gltf.scene ?? gltf.scenes?.[0];
        if (!root) {
          reject(new Error('Held item GLTF did not contain a scene root.'));
          return;
        }

        if (definition.modelScale !== 1) {
          root.scale.multiplyScalar(definition.modelScale ?? 1);
          root.updateWorldMatrix(true, true);
        }

        // Keep the cached template close to the authored asset. Each equipped
        // instance resolves its final placeholder alignment separately.
        applyHeldItemShadows(root, true, false);
        resolve(root);
      },
      undefined,
      error => reject(error)
    );
  });

  heldItemTemplateCache.set(definition.modelUrl, templatePromise);
  return templatePromise;
}

function clearActiveHeldItem() {
  if (activeHeldItemRoot?.parent) {
    activeHeldItemRoot.parent.remove(activeHeldItemRoot);
  }
  if (firstPersonHeldItemRoot?.parent) {
    firstPersonHeldItemRoot.parent.remove(firstPersonHeldItemRoot);
  }
  activeHeldItemRoot = null;
  firstPersonHeldItemRoot = null;
  activeHeldItemType = null;
  pendingHeldItemType = null;
}

function getFirstPersonHeldItemSlotName(slotName) {
  // The first-person arms are viewed from the opposite side of the naming
  // convention used on the world rig, so hand slots need to be mirrored there.
  if (slotName === 'rightHandSlot') return 'leftHandSlot';
  if (slotName === 'leftHandSlot') return 'rightHandSlot';
  return slotName;
}

function getFirstPersonHeldItemDefinition(definition) {
  // The first-person hand slots currently point local Z toward the floor, so
  // held items need a 180 degree flip around that local axis to match the
  // expected orientation from the player's view.
  return {
    ...definition,
    correctionRotation: new THREE.Euler(0, Math.PI * 1, Math.PI),
  };
}

async function mountHeldItem(itemType) {
  // Merge item-specific data onto the shared neutral defaults so every item
  // starts with the same in-hand placement unless it explicitly overrides it.
  const definition = HELD_ITEM_DEFINITIONS[itemType]
    ? { ...HELD_ITEM_DEFAULTS, ...HELD_ITEM_DEFINITIONS[itemType] }
    : null;
  const worldSlot = definition ? playerHumanoid.joints[definition.slotName] : null;
  const firstPersonSlot = definition && firstPersonArmsRig
    ? firstPersonArmsRig.joints[getFirstPersonHeldItemSlotName(definition.slotName)]
    : null;
  if (!definition || !worldSlot) {
    clearActiveHeldItem();
    return;
  }

  if (
    activeHeldItemType === itemType
    && activeHeldItemRoot?.parent === worldSlot
    && (!firstPersonArmsRig || firstPersonHeldItemRoot?.parent === firstPersonSlot)
  ) return;

  const requestId = ++heldItemLoadRequestId;
  clearActiveHeldItem();
  pendingHeldItemType = itemType;

  try {
    const templateRoot = await loadHeldItemTemplate(definition);
    if (requestId !== heldItemLoadRequestId) return;

    const heldRoot = buildHeldItemMount(templateRoot, definition);
    worldSlot.add(heldRoot);

    let fpHeldRoot = null;
    if (firstPersonSlot) {
      const firstPersonDefinition = getFirstPersonHeldItemDefinition(definition);
      fpHeldRoot = buildHeldItemMount(templateRoot, firstPersonDefinition);
      firstPersonSlot.add(fpHeldRoot);
    }

    activeHeldItemType = itemType;
    activeHeldItemRoot = heldRoot;
    firstPersonHeldItemRoot = fpHeldRoot;
    pendingHeldItemType = null;
  } catch (error) {
    console.error('Failed to mount held item', itemType, error);
    if (requestId === heldItemLoadRequestId) {
      clearActiveHeldItem();
    }
  }
}

function updateHeldItemSelection() {
  const selectedStack = inventoryUI.getGameMode() === GAME_MODE_SURVIVAL
    ? inventoryUI.getSelectedSurvivalStack()
    : null;
  const selectedItemType = selectedStack?.typeName ?? null;

  if (!selectedItemType || !HELD_ITEM_DEFINITIONS[selectedItemType]) {
    if (activeHeldItemRoot || activeHeldItemType || pendingHeldItemType) {
      // Bumping the request id invalidates any late async load from an older
      // selection so stale weapons do not appear after the player switched away.
      heldItemLoadRequestId += 1;
      clearActiveHeldItem();
    }
    return;
  }

  if (pendingHeldItemType === selectedItemType) return;
  if (activeHeldItemType === selectedItemType && activeHeldItemRoot) return;
  mountHeldItem(selectedItemType);
}

updateHeldItemSelection();

const PLAYER_DIRECTION_MARKER_DIAMETER = 1.5;
const PLAYER_DIRECTION_MARKER_RADIUS = PLAYER_DIRECTION_MARKER_DIAMETER / 2;
const playerDirectionMarker = new THREE.Group();
const playerDirectionCircle = new THREE.Mesh(
  new THREE.CircleGeometry(PLAYER_DIRECTION_MARKER_RADIUS, 48),
  new THREE.MeshBasicMaterial({
    color: 0x4da6ff,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
playerDirectionCircle.rotation.x = Math.PI / 2;
playerDirectionCircle.position.y = 0.03;
playerDirectionCircle.renderOrder = 21;
playerDirectionCircle.frustumCulled = false;
playerDirectionMarker.add(playerDirectionCircle);

const playerDirectionArrowShape = new THREE.Shape();
playerDirectionArrowShape.moveTo(0, 0.34);
playerDirectionArrowShape.lineTo(-0.2, -0.18);
playerDirectionArrowShape.lineTo(0.2, -0.18);
playerDirectionArrowShape.closePath();

const playerDirectionArrow = new THREE.Mesh(
  new THREE.ShapeGeometry(playerDirectionArrowShape),
  new THREE.MeshBasicMaterial({
    color: 0x7dc0ff,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
playerDirectionArrow.rotation.x = Math.PI / 2;
playerDirectionArrow.position.set(0, 0.035, PLAYER_DIRECTION_MARKER_RADIUS - 0.04);
playerDirectionArrow.renderOrder = 22;
playerDirectionArrow.frustumCulled = false;
playerDirectionMarker.add(playerDirectionArrow);
playerDirectionMarker.visible = false;
playerBody.add(playerDirectionMarker);

function createFirstPersonArmsRig() {
  const fpModel = createHumanoidModel({
    outfit: PLAYER_OUTFIT,
    castShadow: false,
    receiveShadow: false,
  });
  const visibleParts = new Set(['leftForearm', 'rightForearm', 'leftHand', 'rightHand']);

  fpModel.root.traverse(part => {
    if (!part.isMesh) return;
    part.visible = visibleParts.has(part.name);
    if (!part.visible) return;
    part.renderOrder = 30;
    part.frustumCulled = false;
    part.castShadow = false;
    part.receiveShadow = false;
    part.material.depthWrite = false;
    part.material.depthTest = false;
  });

  // First-person fists pose using the same skeleton parts as the player model.
  fpModel.joints.torso.rotation.x = 0.14;
  fpModel.joints.leftShoulder.position.x = -0.42;
  fpModel.joints.rightShoulder.position.x = 0.42;
  fpModel.joints.leftShoulder.rotation.set(2.34, 0.18, 0.24);
  fpModel.joints.rightShoulder.rotation.set(2.34, -0.18, -0.24);
  fpModel.joints.leftElbow.rotation.set(-0.52, 0.08, -0.1);
  fpModel.joints.rightElbow.rotation.set(-0.52, -0.08, 0.1);

  const leftHand = fpModel.root.getObjectByName('leftHand');
  const rightHand = fpModel.root.getObjectByName('rightHand');
  if (leftHand) {
    leftHand.rotation.set(-0.18, 0.2, -0.12);
  }
  if (rightHand) {
    rightHand.rotation.set(-0.18, -0.2, 0.12);
  }

  fpModel.root.scale.setScalar(1.28);
  fpModel.root.position.set(0, -2.75, -0.3);
  fpModel.root.visible = false;
  return {
    root: fpModel.root,
    joints: fpModel.joints,
  };
}

function createFirstPersonHandAxisHelper(size = 0.18) {
  // Reusing Three's built-in axes colors makes the debug readout easy to parse:
  // X = red, Y = green, Z = blue. Depth testing is disabled so the helper stays
  // visible even when the held item or hand geometry sits directly in front of it.
  const helper = new THREE.AxesHelper(size);
  helper.traverse(part => {
    if (!part.isLine) return;
    part.renderOrder = 999;
    part.frustumCulled = false;
    part.material.depthTest = false;
    part.material.depthWrite = false;
    part.material.transparent = true;
    part.material.opacity = 0.95;
  });

  // Tiny sprite labels at each axis tip remove guesswork while tuning held-item
  // transforms from the first-person camera.
  helper.add(createAxisLabelSprite('X', '#ff5555', new THREE.Vector3(size + 0.035, 0, 0)));
  helper.add(createAxisLabelSprite('Y', '#55ff55', new THREE.Vector3(0, size + 0.035, 0)));
  helper.add(createAxisLabelSprite('Z', '#5599ff', new THREE.Vector3(0, 0, size + 0.035)));
  return helper;
}

function createAxisLabelSprite(text, color, position) {
  // A small canvas sprite keeps the axis labels readable without needing extra
  // HTML UI, and disabling depth testing prevents the letters from disappearing
  // behind the hand or weapon while debugging.
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) {
    const fallback = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
    fallback.position.copy(position);
    fallback.scale.setScalar(0.05);
    return fallback;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = 'bold 42px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 8;
  context.strokeStyle = 'rgba(0, 0, 0, 0.9)';
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 1000;
  sprite.frustumCulled = false;
  sprite.position.copy(position);
  sprite.scale.set(0.08, 0.08, 0.08);
  return sprite;
}

firstPersonArmsRig = createFirstPersonArmsRig();
camera.add(firstPersonArmsRig.root);
updateHeldItemSelection();

const firstPersonRightHandAxisHelper = createFirstPersonHandAxisHelper();
const firstPersonLeftHandAxisHelper = createFirstPersonHandAxisHelper();
firstPersonArmsRig.joints.rightHandSlot.add(firstPersonRightHandAxisHelper);
firstPersonArmsRig.joints.leftHandSlot.add(firstPersonLeftHandAxisHelper);
firstPersonRightHandAxisHelper.visible = false;
firstPersonLeftHandAxisHelper.visible = false;

const RIGHT_PUNCH_DURATION = 0.2;
let rightPunchTimer = 0;
let leftPunchTimer = 0;
const fpRightShoulderBasePos = firstPersonArmsRig.joints.rightShoulder.position.clone();
const fpRightShoulderBaseRot = firstPersonArmsRig.joints.rightShoulder.rotation.clone();
const fpRightElbowBaseRot = firstPersonArmsRig.joints.rightElbow.rotation.clone();
const fpLeftShoulderBasePos = firstPersonArmsRig.joints.leftShoulder.position.clone();
const fpLeftShoulderBaseRot = firstPersonArmsRig.joints.leftShoulder.rotation.clone();
const fpLeftElbowBaseRot = firstPersonArmsRig.joints.leftElbow.rotation.clone();

scene.add(playerBody);
const playerFacingDir = new THREE.Vector3();
let playerWalkCycle = 0;
let playerIdleCycle = Math.random() * Math.PI * 2;

function updatePlayerCollider(eyePosition) {
  playerColliderMin.set(
    eyePosition.x - PLAYER_HALF_WIDTH,
    eyePosition.y - EYE_HEIGHT,
    eyePosition.z - PLAYER_HALF_WIDTH
  );

  playerColliderMax.set(
    eyePosition.x + PLAYER_HALF_WIDTH,
    playerColliderMin.y + PLAYER_HEIGHT,
    eyePosition.z + PLAYER_HALF_WIDTH
  );

  playerCollider.min.copy(playerColliderMin);
  playerCollider.max.copy(playerColliderMax);
  playerFoot.set(eyePosition.x, playerColliderMin.y, eyePosition.z);
}

const debugCollisionGroup = new THREE.Group();
debugCollisionGroup.visible = false;
scene.add(debugCollisionGroup);

const playerColliderDebugHelper = new THREE.Box3Helper(playerCollider, 0xffdd33);
debugCollisionGroup.add(playerColliderDebugHelper);
const playerPickupSphere = new THREE.Sphere(playerEye.clone(), PLAYER_PICKUP_RADIUS);
const playerPickupRadiusHelper = new THREE.Mesh(
  new THREE.SphereGeometry(1, 24, 18),
  new THREE.MeshBasicMaterial({
    color: 0xff9a3d,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  })
);
playerPickupRadiusHelper.renderOrder = 996;
playerPickupRadiusHelper.visible = false;
debugCollisionGroup.add(playerPickupRadiusHelper);

const nearbyCollisionHelpers = [];
const itemRaycastSphereHelpers = [];
const debugItemSphereGeometry = new THREE.SphereGeometry(1, 14, 12);

function getItemRaycastSphereHelper(index) {
  if (!itemRaycastSphereHelpers[index]) {
    const helper = new THREE.Mesh(
      debugItemSphereGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x7cf7ff,
        wireframe: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      })
    );
    helper.renderOrder = 997;
    itemRaycastSphereHelpers[index] = helper;
    debugCollisionGroup.add(helper);
  }
  return itemRaycastSphereHelpers[index];
}

function getDebugCollisionHelper(index) {
  if (!nearbyCollisionHelpers[index]) {
    const helper = new THREE.Box3Helper(new THREE.Box3(), 0x3ddcff);
    nearbyCollisionHelpers[index] = helper;
    debugCollisionGroup.add(helper);
  }
  return nearbyCollisionHelpers[index];
}

let debugModeEnabled = false;

function setDebugMode(nextEnabled) {
  debugModeEnabled = nextEnabled;
  debugCollisionGroup.visible = nextEnabled;
  firstPersonRightHandAxisHelper.visible = nextEnabled;
  firstPersonLeftHandAxisHelper.visible = nextEnabled;
  if (!nextEnabled) {
    for (let i = 0; i < nearbyCollisionHelpers.length; i++) {
      nearbyCollisionHelpers[i].visible = false;
    }
    for (let i = 0; i < itemRaycastSphereHelpers.length; i++) {
      itemRaycastSphereHelpers[i].visible = false;
    }
  }
  chatUI.appendLine(`Debug mode ${nextEnabled ? 'enabled' : 'disabled'}.`);
}

function addDebugCollisionEntry(box, color = DEBUG_COLLISION_COLOR_WORLD) {
  if (!box) return;
  debugCollisionEntries.push({ box, color });
}

function collectNearbyCollisionBoxes() {
  debugCollisionEntries.length = 0;

  if (collectMapDebugCollisionBoxes) {
    const mapDebugBoxes = [];
    collectMapDebugCollisionBoxes(playerEye, DEBUG_COLLISION_RADIUS, mapDebugBoxes);
    for (let i = 0; i < mapDebugBoxes.length; i++) {
      addDebugCollisionEntry(mapDebugBoxes[i], DEBUG_COLLISION_COLOR_WORLD);
    }
  }

  for (let i = 0; i < buildingColliders.length; i++) {
    const collider = buildingColliders[i];
    const centerX = (collider.min.x + collider.max.x) * 0.5;
    const centerY = (collider.min.y + collider.max.y) * 0.5;
    const centerZ = (collider.min.z + collider.max.z) * 0.5;
    if (
      Math.abs(centerX - playerEye.x) > DEBUG_COLLISION_RADIUS ||
      Math.abs(centerY - playerEye.y) > DEBUG_COLLISION_RADIUS ||
      Math.abs(centerZ - playerEye.z) > DEBUG_COLLISION_RADIUS
    ) {
      continue;
    }
    addDebugCollisionEntry(collider, DEBUG_COLLISION_COLOR_WORLD);
  }

  for (let i = 0; i < entities.length; i++) {
    const collider = entities[i]?.collider;
    if (!collider) continue;

    const centerX = (collider.min.x + collider.max.x) * 0.5;
    const centerY = (collider.min.y + collider.max.y) * 0.5;
    const centerZ = (collider.min.z + collider.max.z) * 0.5;
    if (
      Math.abs(centerX - playerEye.x) > DEBUG_COLLISION_RADIUS ||
      Math.abs(centerY - playerEye.y) > DEBUG_COLLISION_RADIUS ||
      Math.abs(centerZ - playerEye.z) > DEBUG_COLLISION_RADIUS
    ) {
      continue;
    }
    addDebugCollisionEntry(collider, DEBUG_COLLISION_COLOR_ENTITY);
  }
}

function updateDebugCollisionVisuals() {
  if (!debugModeEnabled) return;

  playerColliderDebugHelper.box.copy(playerCollider);
  playerColliderDebugHelper.visible = true;
  playerColliderDebugHelper.material.color.setHex(0xffdd33);
  playerPickupRadiusHelper.position.copy(playerPickupSphere.center);
  playerPickupRadiusHelper.scale.setScalar(playerPickupSphere.radius);
  playerPickupRadiusHelper.visible = true;

  collectNearbyCollisionBoxes();

  for (let i = 0; i < debugCollisionEntries.length; i++) {
    const helper = getDebugCollisionHelper(i);
    const entry = debugCollisionEntries[i];
    helper.box.copy(entry.box);
    helper.visible = true;
    helper.material.color.setHex(
      playerCollider.intersectsBox(entry.box)
        ? DEBUG_COLLISION_COLOR_INTERSECTING
        : entry.color
    );
  }

  for (let i = debugCollisionEntries.length; i < nearbyCollisionHelpers.length; i++) {
    nearbyCollisionHelpers[i].visible = false;
  }

  let visibleItemSphereCount = 0;
  for (let i = 0; i < itemAppearances.length; i++) {
    const raycastSphere = itemAppearances[i]?.raycastSphere;
    if (!raycastSphere || !(raycastSphere.radius > 0)) continue;

    const helper = getItemRaycastSphereHelper(visibleItemSphereCount++);
    helper.position.copy(raycastSphere.center);
    helper.scale.setScalar(raycastSphere.radius);
    helper.visible = true;
  }

  for (let i = visibleItemSphereCount; i < itemRaycastSphereHelpers.length; i++) {
    itemRaycastSphereHelpers[i].visible = false;
  }
}

function syncPlayerBody() {
  playerBody.position.set(
    playerEye.x,
    playerCollider.min.y,
    playerEye.z
  );
  playerDirectionMarker.visible = isLegoLolCameraMode();
}

function syncPlayerFacing(facingDirection) {
  if (!facingDirection) return;
  playerFacingDir.copy(facingDirection);
  playerFacingDir.y = 0;
  if (playerFacingDir.lengthSq() <= 0.0001) return;
  playerFacingDir.normalize();
  playerBody.rotation.y = Math.atan2(playerFacingDir.x, playerFacingDir.z);
}

function animatePlayerBody(deltaTime, isMoving) {
  if (isMoving) {
    playerWalkCycle += deltaTime * 10;
    applyHumanoidWalkAnimation(playerHumanoid.joints, playerWalkCycle, 1);
    return;
  }

  playerIdleCycle += deltaTime * 2.2;
  applyHumanoidIdleAnimation(playerHumanoid.joints, playerIdleCycle, 1);
}

const thirdPersonOffsetDir = new THREE.Vector3();
const thirdPersonRightDir = new THREE.Vector3();
const thirdPersonTargetPos = new THREE.Vector3();
const thirdPersonWorldUp = new THREE.Vector3(0, 1, 0);
const legoLolFocusPos = new THREE.Vector3();
const LEGO_LOL_FIXED_ORBIT_ANGLE = THREE.MathUtils.degToRad(35);
let thirdPersonDistance = 0;
let currentThirdPersonDistance = 0;
let currentShoulderOffset = 0;
const THIRD_PERSON_DISTANCE_LERP = 8;
const THIRD_PERSON_SHOULDER_LERP = 8;
const THIRD_PERSON_MAX_SHOULDER_OFFSET = 0.5;

let pinchZoomTouchIds = [];
let pinchStartDistance = 0;
let pinchStartThirdPersonDistance = 0;
const MOBILE_PINCH_BLOCK_SELECTOR = [
  '#menuCentral',
  '#chatBox',
  '#miniMap',
  '#hotbar',
  '#inventorySlots',
  '#playerInventorySlots',
  '.button',
  '.joystick',
  '.pad',
  'input',
  'select',
  'textarea',
  'button',
  'a',
].join(', ');

function getMinThirdPersonDistance() {
  return isLegoLolCameraMode() ? LEGO_LOL_MIN_THIRD_PERSON_DISTANCE : 0;
}

function setThirdPersonDistance(nextDistance) {
  thirdPersonDistance = THREE.MathUtils.clamp(nextDistance, getMinThirdPersonDistance(), THIRD_PERSON_MAX_DISTANCE);
}

function getTouchDistance(firstTouch, secondTouch) {
  return Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY);
}

function findTouchByIdentifier(touchList, identifier) {
  for (let i = 0; i < touchList.length; i++) {
    if (touchList[i].identifier === identifier) {
      return touchList[i];
    }
  }
  return null;
}

function resetMobilePinchZoom() {
  pinchZoomTouchIds = [];
  pinchStartDistance = 0;
  pinchStartThirdPersonDistance = thirdPersonDistance;
}

function shouldBlockMobilePinchTouch(touch) {
  const target = touch?.target;
  return Boolean(target instanceof Element && target.closest(MOBILE_PINCH_BLOCK_SELECTOR));
}

function handleMobilePinchStart(event) {
  if (!mobileMode || event.touches.length < 2) return;

  const firstTouch = event.touches[0];
  const secondTouch = event.touches[1];
  if (shouldBlockMobilePinchTouch(firstTouch) || shouldBlockMobilePinchTouch(secondTouch)) {
    return;
  }
  pinchZoomTouchIds = [firstTouch.identifier, secondTouch.identifier];
  pinchStartDistance = getTouchDistance(firstTouch, secondTouch);
  pinchStartThirdPersonDistance = thirdPersonDistance;
  event.preventDefault();
}

function handleMobilePinchMove(event) {
  if (!mobileMode || pinchZoomTouchIds.length !== 2) return;

  const firstTouch = findTouchByIdentifier(event.touches, pinchZoomTouchIds[0]);
  const secondTouch = findTouchByIdentifier(event.touches, pinchZoomTouchIds[1]);
  if (!firstTouch || !secondTouch) return;

  const pinchDistance = getTouchDistance(firstTouch, secondTouch);
  const pinchDelta = pinchStartDistance - pinchDistance;
  setThirdPersonDistance(pinchStartThirdPersonDistance + pinchDelta * THIRD_PERSON_DISTANCE_INPUT_SCALE);
  event.preventDefault();
}

function handleMobilePinchEnd(event) {
  if (!mobileMode || pinchZoomTouchIds.length === 0) return;

  const firstTouch = findTouchByIdentifier(event.touches, pinchZoomTouchIds[0]);
  const secondTouch = findTouchByIdentifier(event.touches, pinchZoomTouchIds[1]);
  if (firstTouch && secondTouch) return;

  resetMobilePinchZoom();
}

function syncCameraToPlayerView(deltaTime = 0) {
  const minThirdPersonDistance = getMinThirdPersonDistance();
  if (thirdPersonDistance < minThirdPersonDistance) {
    thirdPersonDistance = minThirdPersonDistance;
  }
  if (isLegoLolCameraMode() && currentThirdPersonDistance < minThirdPersonDistance) {
    currentThirdPersonDistance = minThirdPersonDistance;
  }
  const tDistance = 1 - Math.exp(-THIRD_PERSON_DISTANCE_LERP * deltaTime);
  const tShoulder = 1 - Math.exp(-THIRD_PERSON_SHOULDER_LERP * deltaTime);
  currentThirdPersonDistance = THREE.MathUtils.lerp(currentThirdPersonDistance, thirdPersonDistance, tDistance);
  // Skyrim keeps the over-the-shoulder offset in third person; WoW and Lego Lol stay centered behind the player.
  const targetShoulderOffset = thirdPersonDistance > 0.001 && !usesCenteredThirdPersonCamera() ? THIRD_PERSON_MAX_SHOULDER_OFFSET : 0;
  currentShoulderOffset = THREE.MathUtils.lerp(currentShoulderOffset, targetShoulderOffset, tShoulder);

  camera.position.copy(playerEye);
  // Swap first-person arms for the full body mesh once the camera pulls back into third person.
  playerBody.visible = currentThirdPersonDistance > 0.001;
  firstPersonArmsRig.root.visible = currentThirdPersonDistance <= 0.001 && !isLegoLolCameraMode();

  if (isLegoLolCameraMode() && currentThirdPersonDistance > 0.001) {
    const horizontalDistance = currentThirdPersonDistance * Math.cos(LEGO_LOL_FIXED_ORBIT_ANGLE);
    const verticalDistance = currentThirdPersonDistance * Math.sin(LEGO_LOL_FIXED_ORBIT_ANGLE);
    thirdPersonTargetPos.set(
      playerEye.x,
      playerEye.y + verticalDistance,
      playerEye.z - horizontalDistance
    );
    camera.position.copy(thirdPersonTargetPos);
    legoLolFocusPos.set(playerEye.x, playerBody.position.y + PLAYER_HEIGHT * 0.7, playerEye.z);
    camera.lookAt(legoLolFocusPos);
    return;
  }

  if (currentThirdPersonDistance > 0.001) {
    // Move camera backward from the look direction to get a third-person view.
    camera.getWorldDirection(thirdPersonOffsetDir);
    thirdPersonRightDir.crossVectors(thirdPersonOffsetDir, thirdPersonWorldUp).normalize();
    thirdPersonTargetPos.copy(playerEye);
    thirdPersonTargetPos.addScaledVector(thirdPersonOffsetDir, -currentThirdPersonDistance);
    thirdPersonTargetPos.addScaledVector(thirdPersonRightDir, currentShoulderOffset);
    camera.position.copy(thirdPersonTargetPos);
  }
}

function handleDesktopWheelThirdPerson(event) {
  if (mobileMode || !isDesktopGameplayActive()) return;

  // Scroll out to move into third-person; scroll in back to first-person.
  setThirdPersonDistance(thirdPersonDistance + event.deltaY * THIRD_PERSON_DISTANCE_INPUT_SCALE);
  event.preventDefault();
}

window.addEventListener('wheel', handleDesktopWheelThirdPerson, { passive: false });
document.addEventListener('touchstart', handleMobilePinchStart, { passive: false });
document.addEventListener('touchmove', handleMobilePinchMove, { passive: false });
document.addEventListener('touchend', handleMobilePinchEnd, { passive: false });
document.addEventListener('touchcancel', handleMobilePinchEnd, { passive: false });

updatePlayerCollider(playerEye);
syncPlayerBody();
syncCameraToPlayerView();

const PROJECTILE_RADIUS = 0.14;
const PROJECTILE_SPEED = 42;
const PROJECTILE_LIFETIME = 3;
const PROJECTILE_DAMAGE = 20;
const PUNCH_DAMAGE = 10;
const PUNCH_PUSH_FORCE = 8;
const CHASER_PUNCH_DAMAGE = 8;
const CHASER_ATTACK_INTERVAL = 0.4;
const CHASER_PUNCH_DURATION = 0.22;
const CHASER_PUNCH_HITBOX_RADIUS = 0.5;
const CHASER_PUNCH_HITBOX_LIFETIME = 0.12;
const CHASER_PUNCH_FORWARD_OFFSET = 0.85;
const CHASER_PUNCH_SIDE_OFFSET = 0.24;
const CHASER_PUNCH_HEIGHT = 1.05;
const CHASER_PUNCH_HITBOX_DEBUG_VISIBLE = true;
const PUNCH_HITBOX_RADIUS = 0.5;
const PUNCH_HITBOX_LIFETIME = 0.09;
const PUNCH_FORWARD_OFFSET = 0.95;
const PUNCH_SIDE_OFFSET = 0.28;
const PUNCH_VERTICAL_OFFSET = -0.12;
const PUNCH_HITBOX_DEBUG_VISIBLE = true;
const projectileGeo = new THREE.SphereGeometry(PROJECTILE_RADIUS, 16, 16);
const projectileMat = new THREE.MeshStandardMaterial({
  color: 0xff2f2f,
  emissive: 0xaa1111,
  emissiveIntensity: 1.2,
  metalness: 0.2,
  roughness: 0.25,
});
const projectiles = [];
const punchHitboxGeo = new THREE.SphereGeometry(PUNCH_HITBOX_RADIUS, 12, 12);
const punchHitboxRightMat = new THREE.MeshBasicMaterial({
  color: 0xff5522,
  wireframe: true,
  transparent: true,
  opacity: 0.85,
  visible: PUNCH_HITBOX_DEBUG_VISIBLE,
});
const punchHitboxLeftMat = new THREE.MeshBasicMaterial({
  color: 0x2277ff,
  wireframe: true,
  transparent: true,
  opacity: 0.85,
  visible: PUNCH_HITBOX_DEBUG_VISIBLE,
});
const punchHitboxes = [];

const EXPLOSION_PARTICLE_COUNT = 18;
const EXPLOSION_LIFETIME = 0.55;
const explosionGeo = new THREE.SphereGeometry(0.07, 8, 8);
const explosions = [];

const projectileSpawnPos = new THREE.Vector3();
const projectileDirection = new THREE.Vector3();
const projectileSphere = new THREE.Sphere();
const punchForwardDir = new THREE.Vector3();
const punchRightDir = new THREE.Vector3();
const punchUpDir = new THREE.Vector3();
const punchHitboxPos = new THREE.Vector3();
const punchPushDir = new THREE.Vector3();
const worldUpDir = new THREE.Vector3(0, 1, 0);
const chaserToPlayerDir = new THREE.Vector3();
const chaserAttackCooldowns = new WeakMap();
const chaserAttackStates = new WeakMap();
const chaserPunchForwardDir = new THREE.Vector3();
const chaserPunchRightDir = new THREE.Vector3();
const chaserPunchHitboxPos = new THREE.Vector3();
const chaserPunchHitboxes = [];
const chaserPunchHitboxGeo = new THREE.SphereGeometry(CHASER_PUNCH_HITBOX_RADIUS, 10, 10);
const chaserPunchHitboxMat = new THREE.MeshBasicMaterial({
  color: 0xff3333,
  wireframe: true,
  transparent: true,
  opacity: 0.9,
  visible: CHASER_PUNCH_HITBOX_DEBUG_VISIBLE,
});

function createExplosion(position) {
  const particles = [];

  for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
    const shade = 0.15 + Math.random() * 0.35;
    const particleMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setScalar(shade),
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.92,
    });
    const particle = new THREE.Mesh(explosionGeo, particleMat);
    particle.position.copy(position);
    particle.castShadow = false;
    particle.receiveShadow = false;
    scene.add(particle);

    const dir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 1.4 - 0.2,
      Math.random() * 2 - 1
    ).normalize();
    const speed = 6 + Math.random() * 12;

    particles.push({
      mesh: particle,
      velocity: dir.multiplyScalar(speed),
      baseScale: 0.6 + Math.random() * 0.9,
    });
  }

  explosions.push({
    age: 0,
    life: EXPLOSION_LIFETIME,
    particles,
  });
  gameAudio.playExplosionSound();
}

function projectileHitsEnvironment(position, radius) {
  if (position.y - radius <= GROUND_Y) return true;

  projectileSphere.center.copy(position);
  projectileSphere.radius = radius;

  for (let i = 0; i < buildingColliders.length; i++) {
    if (buildingColliders[i].intersectsSphere(projectileSphere)) return true;
  }

  return false;
}

function projectileHitsEntity(position, radius) {
  projectileSphere.center.copy(position);
  projectileSphere.radius = radius;

  for (let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i];
    if (!entity.collider.intersectsSphere(projectileSphere)) continue;

    const killed = entity.applyDamage(PROJECTILE_DAMAGE);
    if (killed) {
      scene.remove(entity.group);
      entities.splice(i, 1);
    }
    return true;
  }

  return false;
}

function getPunchForwardDirection(outDir) {
  if (currentThirdPersonDistance > 0.001) {
    if (playerFacingDir.lengthSq() > 0.0001) {
      outDir.copy(playerFacingDir).normalize();
      return outDir;
    }
    outDir.set(Math.sin(playerBody.rotation.y), 0, Math.cos(playerBody.rotation.y)).normalize();
    return outDir;
  }

  camera.getWorldDirection(outDir).normalize();
  return outDir;
}

function spawnPunchHitbox(side) {
  getPunchForwardDirection(punchForwardDir);

  punchRightDir.crossVectors(punchForwardDir, worldUpDir);
  if (punchRightDir.lengthSq() < 0.0001) {
    // Looking almost straight up/down: derive a stable right vector from camera orientation.
    punchRightDir.set(1, 0, 0).applyQuaternion(camera.quaternion);
  } else {
    punchRightDir.normalize();
  }
  punchUpDir.crossVectors(punchRightDir, punchForwardDir).normalize();

  const sideSign = side === 'right' ? 1 : -1;
  punchHitboxPos.copy(playerEye)
    .addScaledVector(punchForwardDir, PUNCH_FORWARD_OFFSET)
    .addScaledVector(punchRightDir, PUNCH_SIDE_OFFSET * sideSign)
    .addScaledVector(punchUpDir, PUNCH_VERTICAL_OFFSET);

  let mesh = null;
  if (PUNCH_HITBOX_DEBUG_VISIBLE) {
    mesh = new THREE.Mesh(
      punchHitboxGeo,
      side === 'right' ? punchHitboxRightMat : punchHitboxLeftMat
    );
    mesh.position.copy(punchHitboxPos);
    scene.add(mesh);
  }

  punchHitboxes.push({
    age: 0,
    life: PUNCH_HITBOX_LIFETIME,
    sphere: new THREE.Sphere(punchHitboxPos.clone(), PUNCH_HITBOX_RADIUS),
    mesh,
    forwardDir: punchForwardDir.clone(),
    hitEntities: new Set(),
    hitSomething: false,
  });
}

function updatePunchHitboxes(deltaTime) {
  for (let i = punchHitboxes.length - 1; i >= 0; i--) {
    const hitbox = punchHitboxes[i];
    hitbox.age += deltaTime;
    let hitThisFrame = false;

    for (let j = entities.length - 1; j >= 0; j--) {
      const entity = entities[j];
      if (hitbox.hitEntities.has(entity)) continue;
      if (!entity.collider.intersectsSphere(hitbox.sphere)) continue;

      hitbox.hitEntities.add(entity);
      hitThisFrame = true;
      punchPushDir.set(
        entity.position.x - playerEye.x,
        0,
        entity.position.z - playerEye.z
      );
      if (punchPushDir.lengthSq() < 0.0001) {
        punchPushDir.copy(hitbox.forwardDir);
      } else {
        punchPushDir.normalize();
      }
      entity.applyKnockback(punchPushDir, PUNCH_PUSH_FORCE);
      const killed = entity.applyDamage(PUNCH_DAMAGE);
      if (killed) {
        scene.remove(entity.group);
        entities.splice(j, 1);
      }
    }

    if (!hitThisFrame) {
      for (let j = 0; j < buildingColliders.length; j++) {
        if (!buildingColliders[j].intersectsSphere(hitbox.sphere)) continue;
        hitThisFrame = true;
        break;
      }
    }

    if (hitThisFrame && !hitbox.hitSomething) {
      hitbox.hitSomething = true;
      gameAudio.playPunchSound();
    }

    if (hitbox.age >= hitbox.life) {
      if (hitbox.mesh) {
        scene.remove(hitbox.mesh);
      }
      punchHitboxes.splice(i, 1);
    }
  }
}

function shootProjectileFromPlayer() {
  camera.getWorldDirection(projectileDirection).normalize();
  projectileSpawnPos.copy(playerEye).addScaledVector(projectileDirection, 1.0);

  const mesh = new THREE.Mesh(projectileGeo, projectileMat.clone());
  mesh.position.copy(projectileSpawnPos);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  scene.add(mesh);

  projectiles.push({
    mesh,
    velocity: projectileDirection.clone().multiplyScalar(PROJECTILE_SPEED),
    age: 0,
    life: PROJECTILE_LIFETIME,
    radius: PROJECTILE_RADIUS,
  });
}

function shootDesktopProjectile(event) {
  if (event.button !== 0) return;
  if (mobileMode || !isDesktopGameplayActive()) return;
  shootProjectileFromPlayer();
}

function startRightPunch(options = {}) {
  const allowMobile = options.allowMobile === true;
  if (mobileMode && !allowMobile) return;
  if (!mobileMode && !isDesktopGameplayActive()) return;
  if (rightPunchTimer > 0) return;

  rightPunchTimer = RIGHT_PUNCH_DURATION;
  spawnPunchHitbox('right');
}

function startLeftPunch(options = {}) {
  const allowMobile = options.allowMobile === true;
  if (mobileMode && !allowMobile) return;
  if (!mobileMode && !isDesktopGameplayActive()) return;
  if (leftPunchTimer > 0) return;

  leftPunchTimer = RIGHT_PUNCH_DURATION;
  spawnPunchHitbox('left');
}

function triggerActionForMouseButton(button, options = {}) {
  const allowMobile = options.allowMobile === true;

  if (button === 0) {
    if (currentRaycastState.voxelEditionMode) {
      const removedVoxelType = resolveRaycastLabel(currentRaycastState.hit);
      const removed = removeVoxelAtRaycastHit(currentRaycastState.hit);
      if (removed && removedVoxelType) {
        if (inventoryUI.getGameMode() === GAME_MODE_SURVIVAL) {
          inventoryUI.addItemToInventory(removedVoxelType, 1);
        } else if (!inventoryUI.inventoryHasType(removedVoxelType)) {
          inventoryUI.addCreativeInventoryItem(removedVoxelType);
        }
      }
      return;
    }
    startRightPunch({ allowMobile });
    return;
  }

  if (button === 2) {
    if (currentRaycastState.voxelEditionMode) {
      // Placement must only consume actual voxel stacks. Non-build items can share
      // the hotbar, so we resolve a voxel-safe selection before touching the world.
      const selectedVoxelType = inventoryUI.getSelectedPlaceableVoxelType();
      if (!selectedVoxelType) return;

      const added = addVoxelAtRaycastHit(currentRaycastState.hit, {
        playerCollider,
        voxelType: selectedVoxelType,
      });
      if (added && inventoryUI.getGameMode() === GAME_MODE_SURVIVAL) {
          inventoryUI.consumeSelectedInventoryItem(1);
      }
      return;
    }
    startLeftPunch({ allowMobile });
  }
}

function updateRightPunch(deltaTime) {
  const shoulder = firstPersonArmsRig.joints.rightShoulder;
  const elbow = firstPersonArmsRig.joints.rightElbow;
  const isFirstPerson = currentThirdPersonDistance <= 0.001;

  if (rightPunchTimer <= 0) {
    shoulder.position.copy(fpRightShoulderBasePos);
    shoulder.rotation.copy(fpRightShoulderBaseRot);
    elbow.rotation.copy(fpRightElbowBaseRot);
    rightPunchTimer = 0;
    return;
  }

  rightPunchTimer = Math.max(0, rightPunchTimer - deltaTime);
  const progress = 1 - rightPunchTimer / RIGHT_PUNCH_DURATION;
  const strikePhase = progress < 0.35
    ? progress / 0.35
    : 1 - (progress - 0.35) / 0.65;
  const punch = THREE.MathUtils.clamp(strikePhase, 0, 1);

  if (isFirstPerson) {
    // Straight jab towards the crosshair (camera forward axis), then return.
    shoulder.position.x = fpRightShoulderBasePos.x;
    shoulder.position.y = fpRightShoulderBasePos.y;
    shoulder.position.z = fpRightShoulderBasePos.z - 0.26 * punch;

    shoulder.rotation.copy(fpRightShoulderBaseRot);
    elbow.rotation.copy(fpRightElbowBaseRot);
    return;
  }

  shoulder.position.copy(fpRightShoulderBasePos);
  shoulder.rotation.copy(fpRightShoulderBaseRot);
  elbow.rotation.copy(fpRightElbowBaseRot);
  applyHumanoidLeftPunchAnimation(playerHumanoid.joints, punch, camera.rotation.x);
}

function updateLeftPunch(deltaTime) {
  const shoulder = firstPersonArmsRig.joints.leftShoulder;
  const elbow = firstPersonArmsRig.joints.leftElbow;
  const isFirstPerson = currentThirdPersonDistance <= 0.001;

  if (leftPunchTimer <= 0) {
    shoulder.position.copy(fpLeftShoulderBasePos);
    shoulder.rotation.copy(fpLeftShoulderBaseRot);
    elbow.rotation.copy(fpLeftElbowBaseRot);
    leftPunchTimer = 0;
    return;
  }

  leftPunchTimer = Math.max(0, leftPunchTimer - deltaTime);
  const progress = 1 - leftPunchTimer / RIGHT_PUNCH_DURATION;
  const strikePhase = progress < 0.35
    ? progress / 0.35
    : 1 - (progress - 0.35) / 0.65;
  const punch = THREE.MathUtils.clamp(strikePhase, 0, 1);

  if (isFirstPerson) {
    shoulder.position.x = fpLeftShoulderBasePos.x;
    shoulder.position.y = fpLeftShoulderBasePos.y;
    shoulder.position.z = fpLeftShoulderBasePos.z - 0.26 * punch;

    shoulder.rotation.copy(fpLeftShoulderBaseRot);
    elbow.rotation.copy(fpLeftElbowBaseRot);
    return;
  }

  shoulder.position.copy(fpLeftShoulderBasePos);
  shoulder.rotation.copy(fpLeftShoulderBaseRot);
  elbow.rotation.copy(fpLeftElbowBaseRot);
  applyHumanoidRightPunchAnimation(playerHumanoid.joints, punch, camera.rotation.x);
}

function handleDesktopAttack(event) {
  if (event.button !== 0 && event.button !== 2) return;
  if (mobileMode) return;

  if (isScreenDragCameraActive()) {
    updateWowCursorRaycastPointer(event.clientX, event.clientY);
    updateVoxelRaycast();
    if (event.button === 0) {
      event.preventDefault();
      return;
    }
  }

  if (isMenuCentralVisible()) {
    const clickedInsideMenu = Boolean(event.target?.closest?.('#menuCentral'));
    if (clickedInsideMenu) {
      return;
    }
    activateDesktopScreenActivity();
    return;
  }

  event.preventDefault();
  triggerActionForMouseButton(event.button);
}

function updateProjectilesAndExplosions(deltaTime) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    projectile.age += deltaTime;
    projectile.mesh.position.addScaledVector(projectile.velocity, deltaTime);

    const expired = projectile.age >= projectile.life;
    const hitEnvironment = projectileHitsEnvironment(projectile.mesh.position, projectile.radius);
    const hitEntity = projectileHitsEntity(projectile.mesh.position, projectile.radius);
    const hit = hitEnvironment || hitEntity;

    if (expired || hit) {
      if (hit) {
        createExplosion(projectile.mesh.position);
      }
      scene.remove(projectile.mesh);
      projectile.mesh.material.dispose();
      projectiles.splice(i, 1);
    }
  }

  for (let i = explosions.length - 1; i >= 0; i--) {
    const explosion = explosions[i];
    explosion.age += deltaTime;
    const t = Math.min(explosion.age / explosion.life, 1);

    for (let j = 0; j < explosion.particles.length; j++) {
      const p = explosion.particles[j];
      p.velocity.y -= 18 * deltaTime;
      p.mesh.position.addScaledVector(p.velocity, deltaTime);
      const scale = p.baseScale * (0.35 + t);
      p.mesh.scale.setScalar(scale);
      p.mesh.material.opacity = (1 - t) * 0.9;
    }

    if (t >= 1) {
      for (let j = 0; j < explosion.particles.length; j++) {
        const p = explosion.particles[j];
        scene.remove(p.mesh);
        p.mesh.material.dispose();
      }
      explosions.splice(i, 1);
    }
  }
}

function updateEntities(deltaTime) {
  for (let i = 0; i < entities.length; i++) {
    entities[i].update(deltaTime, buildingColliders, playerEye);
  }
}

const itemPickupOffset = new THREE.Vector3();
const itemPickupDirection = new THREE.Vector3();
const itemPickupColliderSphere = new THREE.Sphere(new THREE.Vector3(), ITEM_PICKUP_COLLISION_RADIUS);

function updatePlayerPickupSphere() {
  // Centering the pickup sphere around the player's torso keeps the debug visualization
  // aligned with the actual magnetic pickup area players will feel while walking around.
  playerPickupSphere.center.set(playerEye.x, playerCollider.min.y + PLAYER_HEIGHT * 0.5, playerEye.z);
  playerPickupSphere.radius = PLAYER_PICKUP_RADIUS;
}

function canPlayerPickUpItem(itemAppearance) {
  return !!(itemAppearance && itemAppearance.pickable && !itemAppearance.collected && PICKUP_ITEM_TYPES.has(itemAppearance.inventoryType));
}

function tryCollectItemAppearance(itemAppearance) {
  if (!canPlayerPickUpItem(itemAppearance)) return false;

  const addedAmount = inventoryUI.addItemToInventory(itemAppearance.inventoryType, 1);
  if (addedAmount <= 0) return false;

  itemAppearance.collect();
  return true;
}

function updateItemAppearances(deltaTime) {
  updatePlayerPickupSphere();

  for (let i = 0; i < itemAppearances.length; i++) {
    const itemAppearance = itemAppearances[i];
    if (!itemAppearance) continue;

    if (canPlayerPickUpItem(itemAppearance)) {
      // The magnetic pickup pull becomes stronger as the item gets closer to the
      // player, so the last stretch feels noticeably snappier than the outer edge.
      itemPickupOffset.set(
        playerPickupSphere.center.x - itemAppearance.position.x,
        playerPickupSphere.center.y - itemAppearance.group.position.y,
        playerPickupSphere.center.z - itemAppearance.position.z
      );
      const distanceSq = itemPickupOffset.lengthSq();

      if (distanceSq <= PLAYER_PICKUP_RADIUS_SQ) {
        const normalizedDistance = Math.min(1, Math.sqrt(distanceSq) / PLAYER_PICKUP_RADIUS);
        const pullStrength = 1 - normalizedDistance;
        if (pullStrength > 0.0001) {
          itemPickupDirection.copy(itemPickupOffset).normalize();
          const travelSpeed = THREE.MathUtils.lerp(
            ITEM_PICKUP_MAGNET_MIN_SPEED,
            ITEM_PICKUP_MAGNET_MAX_SPEED,
            pullStrength
          );
          itemAppearance.position.addScaledVector(itemPickupDirection, travelSpeed * deltaTime);
          itemAppearance.syncPosition();
        }
      }

      // A smaller collision sphere on the item itself decides the actual pickup moment.
      // Once it touches the player's collider, the world model disappears and the stack
      // is transferred into the player's inventory UI.
      itemPickupColliderSphere.center.copy(itemAppearance.group.position);
      itemPickupColliderSphere.radius = ITEM_PICKUP_COLLISION_RADIUS;
      if (playerCollider.intersectsSphere(itemPickupColliderSphere)) {
        tryCollectItemAppearance(itemAppearance);
        continue;
      }
    }

    itemAppearance.update(deltaTime);
  }
}

function spawnChaserPunchHitbox(entity, side) {
  chaserPunchForwardDir.copy(entity.direction);
  if (chaserPunchForwardDir.lengthSq() < 0.0001) {
    chaserPunchForwardDir.set(0, 0, 1);
  } else {
    chaserPunchForwardDir.normalize();
  }

  chaserPunchRightDir.crossVectors(worldUpDir, chaserPunchForwardDir);
  if (chaserPunchRightDir.lengthSq() < 0.0001) {
    chaserPunchRightDir.set(1, 0, 0);
  } else {
    chaserPunchRightDir.normalize();
  }

  const sideSign = side === 'right' ? 1 : -1;
  chaserPunchHitboxPos.set(entity.position.x, entity.groundY + CHASER_PUNCH_HEIGHT, entity.position.z)
    .addScaledVector(chaserPunchForwardDir, CHASER_PUNCH_FORWARD_OFFSET)
    .addScaledVector(chaserPunchRightDir, CHASER_PUNCH_SIDE_OFFSET * sideSign);

  let mesh = null;
  if (CHASER_PUNCH_HITBOX_DEBUG_VISIBLE) {
    mesh = new THREE.Mesh(chaserPunchHitboxGeo, chaserPunchHitboxMat);
    mesh.position.copy(chaserPunchHitboxPos);
    scene.add(mesh);
  }

  chaserPunchHitboxes.push({
    age: 0,
    life: CHASER_PUNCH_HITBOX_LIFETIME,
    sphere: new THREE.Sphere(chaserPunchHitboxPos.clone(), CHASER_PUNCH_HITBOX_RADIUS),
    mesh,
    hitPlayer: false,
  });
}

function updateChaserPunchHitboxes(deltaTime) {
  for (let i = chaserPunchHitboxes.length - 1; i >= 0; i--) {
    const hitbox = chaserPunchHitboxes[i];
    hitbox.age += deltaTime;

    if (!hitbox.hitPlayer && playerCollider.intersectsSphere(hitbox.sphere)) {
      hitbox.hitPlayer = true;
      applyPlayerDamage(CHASER_PUNCH_DAMAGE);
    }

    if (hitbox.age < hitbox.life) continue;

    if (hitbox.mesh) {
      scene.remove(hitbox.mesh);
    }
    chaserPunchHitboxes.splice(i, 1);
  }
}

function updateChaserMeleeAttacks(deltaTime) {
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (!(entity instanceof HunterEntity)) continue;

    let cooldown = chaserAttackCooldowns.get(entity) ?? 0;
    cooldown = Math.max(0, cooldown - deltaTime);
    const state = chaserAttackStates.get(entity) ?? {
      punchTimer: 0,
      punchSide: 'right',
      nextPunchRight: false,
    };
    state.punchTimer = Math.max(0, state.punchTimer - deltaTime);

    if (!entity.isAggro) {
      chaserAttackCooldowns.set(entity, 0);
      state.punchTimer = 0;
      chaserAttackStates.set(entity, state);
      continue;
    }

    chaserToPlayerDir.set(
      playerEye.x - entity.position.x,
      0,
      playerEye.z - entity.position.z
    );
    const attackRange = entity.stopDistance + 0.1;
    if (chaserToPlayerDir.lengthSq() > attackRange * attackRange) {
      // Out of melee range: return to chase mode.
      chaserAttackCooldowns.set(entity, 0);
      state.punchTimer = 0;
      chaserAttackStates.set(entity, state);
      continue;
    }

    if (cooldown <= 0) {
      state.punchSide = state.nextPunchRight ? 'right' : 'left';
      state.nextPunchRight = !state.nextPunchRight;
      state.punchTimer = CHASER_PUNCH_DURATION;
      spawnChaserPunchHitbox(entity, state.punchSide);
      cooldown = CHASER_ATTACK_INTERVAL;
    }

    if (state.punchTimer > 0) {
      const progress = 1 - state.punchTimer / CHASER_PUNCH_DURATION;
      const strikePhase = progress < 0.35
        ? progress / 0.35
        : 1 - (progress - 0.35) / 0.65;
      const punch = THREE.MathUtils.clamp(strikePhase, 0, 1);
      if (state.punchSide === 'right') {
        applyHumanoidRightPunchAnimation(entity.joints, punch, 0);
      } else {
        applyHumanoidLeftPunchAnimation(entity.joints, punch, 0);
      }
    }

    chaserAttackCooldowns.set(entity, cooldown);
    chaserAttackStates.set(entity, state);
  }
}

function collidesWithBuildings(box) {
  const mapCollision = intersectMapColliderBox(box);
  if (mapCollision) return mapCollision;

  for (let i = 0; i < buildingColliders.length; i++) {
    if (box.intersectsBox(buildingColliders[i])) return buildingColliders[i];
  }
  return null;
}

const axisTestPos = new THREE.Vector3();
const stepTestPos = new THREE.Vector3();
const PLAYER_STEP_HEIGHT = 1.05;

function tryStepUp(axis, delta, blockingHit) {
  if (!blockingHit || delta === 0) return false;
  if (flyMode || !playerState.onGround || playerState.velocity.y > 0) return false;

  const currentFootY = playerCollider.min.y;
  const stepHeight = blockingHit.max.y - currentFootY;
  if (stepHeight <= 0.001 || stepHeight > PLAYER_STEP_HEIGHT) return false;

  stepTestPos.copy(playerEye);
  stepTestPos.y = blockingHit.max.y + EYE_HEIGHT + 0.001;
  stepTestPos[axis] += delta;

  updatePlayerCollider(stepTestPos);
  testBox.copy(playerCollider);
  if (collidesWithBuildings(testBox)) {
    updatePlayerCollider(playerEye);
    return false;
  }

  playerEye.copy(stepTestPos);
  playerState.velocity.y = 0;
  playerState.onGround = true;
  playerState.jumpsUsed = 0;
  updatePlayerCollider(playerEye);
  return true;
}

function tryMoveAxis(axis, delta) {
  if (delta === 0) return;

  axisTestPos.copy(playerEye);
  axisTestPos[axis] += delta;

  updatePlayerCollider(axisTestPos);
  testBox.copy(playerCollider);

  const blockingHit = collidesWithBuildings(testBox);

  if (!blockingHit) {
    playerEye[axis] += delta;
    updatePlayerCollider(playerEye);
    return;
  }

  tryStepUp(axis, delta, blockingHit);
}

function resolveVertical(deltaY) {
  if (deltaY === 0) {
    return;
  }

  axisTestPos.copy(playerEye);
  axisTestPos.y += deltaY;

  updatePlayerCollider(axisTestPos);
  testBox.copy(playerCollider);

  const hit = collidesWithBuildings(testBox);

  if (!hit) {
    playerEye.y += deltaY;
    updatePlayerCollider(playerEye);
    return;
  }

  if (deltaY < 0 && playerCollider.max.y >= hit.max.y && previousFoot.y >= hit.max.y - 0.02) {
    playerEye.y = hit.max.y + EYE_HEIGHT + 0.001;
    playerState.velocity.y = 0;
    playerState.onGround = true;
    playerState.jumpsUsed = 0;
    updatePlayerCollider(playerEye);
    return;
  }

  if (deltaY > 0 && playerCollider.min.y <= hit.min.y) {
    playerEye.y = hit.min.y - (PLAYER_HEIGHT - EYE_HEIGHT) - 0.001;
    playerState.velocity.y = 0;
    updatePlayerCollider(playerEye);
    return;
  }

  playerState.velocity.y = 0;
  updatePlayerCollider(playerEye);
}

function resolveGround() {
  if (!HAS_INFINITE_GROUND) return;

  const minEyeY = GROUND_Y + EYE_HEIGHT;

  if (playerEye.y <= minEyeY) {
    playerEye.y = minEyeY;
    playerState.velocity.y = 0;
    playerState.onGround = true;
    playerState.jumpsUsed = 0;
    updatePlayerCollider(playerEye);
  }
}

function isStandingOnSupport() {
  if (HAS_INFINITE_GROUND && Math.abs(playerCollider.min.y - GROUND_Y) <= SUPPORT_EPSILON) {
    return true;
  }

  if (isMapBoxSupported(playerCollider, SUPPORT_EPSILON)) {
    return true;
  }

  for (let i = 0; i < buildingColliders.length; i++) {
    const c = buildingColliders[i];
    const nearTop = Math.abs(playerCollider.min.y - c.max.y) <= SUPPORT_EPSILON;
    if (!nearTop) continue;

    const overlapX = playerCollider.max.x > c.min.x + 0.001 && playerCollider.min.x < c.max.x - 0.001;
    const overlapZ = playerCollider.max.z > c.min.z + 0.001 && playerCollider.min.z < c.max.z - 0.001;

    if (overlapX && overlapZ) {
      return true;
    }
  }

  return false;
}

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const horizontalMove = new THREE.Vector3();
const playerMoveFacing = new THREE.Vector3();
const playerAimFacing = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const currentRaycastState = {
  hit: null,
  kind: null,
  entity: null,
  item: null,
  voxelEditionMode: false,
};

function updateWowCursorRaycastPointer(clientX, clientY) {
  if (!sceneView || mobileMode || !isScreenDragCameraActive()) {
    wowCursorRaycastActive = false;
    return;
  }

  const rect = sceneView.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    wowCursorRaycastActive = false;
    return;
  }

  wowCursorNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  wowCursorNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  wowCursorRaycastActive = wowCursorNdc.x >= -1 && wowCursorNdc.x <= 1
    && wowCursorNdc.y >= -1 && wowCursorNdc.y <= 1;
}

function clearWowCursorRaycastPointer() {
  wowCursorRaycastActive = false;
}

function updateVoxelRaycast() {
  let intersections = [];
  cameraRaycaster.far = isLegoLolCameraMode() ? LEGO_LOL_RAYCAST_RANGE : CAMERA_RAYCAST_RANGE;

  if (isScreenDragCameraActive()) {
    if (wowCursorRaycastActive) {
      cameraRaycaster.setFromCamera(wowCursorNdc, camera);
      cameraRayDirection.copy(cameraRaycaster.ray.direction).normalize();
      if (currentThirdPersonDistance > 0.001) {
        camera.getWorldPosition(cameraRayOrigin);
        cameraRaycaster.set(cameraRayOrigin, cameraRayDirection);
      } else {
        cameraRayOrigin.copy(cameraRaycaster.ray.origin);
      }
      intersections = raycastTargets.length > 0
        ? cameraRaycaster.intersectObjects(raycastTargets, true)
        : [];
    } else {
      camera.getWorldPosition(cameraRayOrigin);
      camera.getWorldDirection(cameraRayDirection);
      cameraRayDirection.normalize();
      cameraRayEnd.copy(cameraRayOrigin);
    }
  } else if (isScreenDragCameraMode()) {
    camera.getWorldPosition(cameraRayOrigin);
    camera.getWorldDirection(cameraRayDirection);
    cameraRayDirection.normalize();
    cameraRayEnd.copy(cameraRayOrigin);
  } else if (isLegoLolCameraMode()) {
    if (playerFacingDir.lengthSq() > 0.0001) {
      cameraRayDirection.copy(playerFacingDir);
    } else {
      cameraRayDirection.set(Math.sin(playerBody.rotation.y), 0, Math.cos(playerBody.rotation.y));
    }
    cameraRayDirection.y = 0;
    cameraRayDirection.normalize();
    cameraRayOrigin.set(playerEye.x, playerBody.position.y + LEGO_LOL_RAYCAST_HEIGHT, playerEye.z);
    cameraRaycaster.far = LEGO_LOL_RAYCAST_RANGE;
    cameraRaycaster.set(cameraRayOrigin, cameraRayDirection);
    intersections = raycastTargets.length > 0
      ? cameraRaycaster.intersectObjects(raycastTargets, true)
      : [];
  } else {
    camera.getWorldDirection(cameraRayDirection);
    cameraRayDirection.normalize();
    camera.getWorldPosition(cameraRayOrigin);
    cameraRayOrigin.addScaledVector(cameraRayDirection, CAMERA_RAYCAST_START_OFFSET);
    cameraRaycaster.set(cameraRayOrigin, cameraRayDirection);
    intersections = raycastTargets.length > 0
      ? cameraRaycaster.intersectObjects(raycastTargets, true)
      : [];
  }

  const maxRayDistance = isLegoLolCameraMode() ? LEGO_LOL_RAYCAST_RANGE : CAMERA_RAYCAST_RANGE;
  const voxelHit = intersections.length > 0 ? intersections[0] : null;
  const voxelLabel = voxelHit ? resolveRaycastLabel(voxelHit) : null;
  const voxelDistance = voxelHit ? cameraRayOrigin.distanceTo(voxelHit.point) : Infinity;
  const entityHit = getEntityRaycastHit(cameraRayOrigin, cameraRayDirection, maxRayDistance);
  const itemHit = getItemRaycastHit(cameraRayOrigin, cameraRayDirection, maxRayDistance);

  let readoutLabel = 'none';
  let activeVoxelHit = null;
  let activeHit = null;
  let activeHitKind = null;
  let activeEntity = null;

  if (voxelLabel && voxelDistance <= Math.min(entityHit?.distance ?? Infinity, itemHit?.distance ?? Infinity)) {
    readoutLabel = voxelLabel;
    activeVoxelHit = voxelHit;
    activeHit = voxelHit;
    activeHitKind = 'voxel';
    cameraRayEnd.copy(voxelHit.point);
  } else if (entityHit && entityHit.distance <= (itemHit?.distance ?? Infinity)) {
    readoutLabel = entityHit.label;
    activeHit = entityHit;
    activeHitKind = 'entity';
    activeEntity = entityHit.entity;
    cameraRayEnd.copy(entityHit.point);
  } else if (itemHit) {
    readoutLabel = itemHit.label;
    activeHit = itemHit;
    activeHitKind = 'item';
    cameraRayEnd.copy(itemHit.point);
  } else {
    cameraRayEnd.copy(cameraRayOrigin).addScaledVector(cameraRayDirection, maxRayDistance);
  }

  currentRaycastState.hit = activeHit;
  currentRaycastState.kind = activeHitKind;
  currentRaycastState.entity = activeEntity;
  currentRaycastState.item = activeHitKind === 'item' ? activeHit?.itemAppearance ?? null : null;
  currentRaycastState.voxelEditionMode = activeVoxelHit !== null;

  if (activeVoxelHit && getVoxelBoxFromRaycastHit(activeVoxelHit, voxelHighlightBox)) {
    voxelHighlightBox.getCenter(voxelHighlightMesh.position);
    voxelHighlightMesh.visible = true;
  } else {
    voxelHighlightMesh.visible = false;
  }

  cameraRayLine.visible = debugModeEnabled;
  cameraRayTip.visible = debugModeEnabled;

  const linePosition = cameraRayLineGeometry.attributes.position;
  linePosition.setXYZ(0, cameraRayOrigin.x, cameraRayOrigin.y, cameraRayOrigin.z);
  linePosition.setXYZ(1, cameraRayEnd.x, cameraRayEnd.y, cameraRayEnd.z);
  linePosition.needsUpdate = true;
  cameraRayLineGeometry.computeBoundingSphere();
  cameraRayTip.position.copy(cameraRayEnd);

  if (voxelReadout) {
    const readoutPrefix = activeHitKind === 'entity'
      ? 'Entity'
      : activeHitKind === 'voxel'
        ? 'Voxel'
        : activeHitKind === 'item'
          ? 'Item'
          : 'Target';
    voxelReadout.textContent = `${readoutPrefix}: ${readoutLabel}`;
  }
}

function updateDesktopLook() {
  if (isScreenDragCameraActive()) {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    return;
  }
  if (!controls.isLocked) return;
  yaw = camera.rotation.y;
  pitch = camera.rotation.x;
}

function respawnPlayerAtSpawn() {
  playerEye.copy(playerSpawnPoint);
  playerState.velocity.set(0, 0, 0);
  playerState.onGround = false;
  playerState.jumpQueued = false;
  playerState.jumpsUsed = 0;
  updatePlayerCollider(playerEye);
}

function updatePlayer(deltaTime) {
  if (playerEye.y < FALL_RESPAWN_Y) {
    respawnPlayerAtSpawn();
    syncPlayerBody();
    syncCameraToPlayerView(deltaTime);
    return;
  }

  previousFoot.copy(playerFoot);

  let inputForward = 0;
  let inputRight = 0;

  if (isDesktopGameplayActive()) {
    if (keys['KeyW']) inputForward += 1;
    if (keys['KeyS']) inputForward -= 1;
    if (keys['KeyA']) inputRight -= 1;
    if (keys['KeyD']) inputRight += 1;
  }

  if (mobileMode) {
    inputForward += moveForward;
    inputRight += moveRight;
  }

  const inputLength = Math.hypot(inputForward, inputRight);
  if (inputLength > 1) {
    inputForward /= inputLength;
    inputRight /= inputLength;
  }

  camera.getWorldDirection(tmpForward);
  tmpForward.y = 0;
  if (tmpForward.lengthSq() > 0) {
    tmpForward.normalize();
  }

  tmpRight.crossVectors(tmpForward, worldUp).normalize();
  const sprintMultiplier = getDesktopSprintMultiplier();
  const currentMoveSpeed = moveSpeed * sprintMultiplier;

  horizontalMove.set(0, 0, 0);
  horizontalMove.addScaledVector(tmpForward, inputForward * currentMoveSpeed * deltaTime);
  horizontalMove.addScaledVector(tmpRight, inputRight * currentMoveSpeed * deltaTime);

  tryMoveAxis('x', horizontalMove.x);
  tryMoveAxis('z', horizontalMove.z);

  if (flyMode) {
    let inputVertical = 0;
    if (isDesktopGameplayActive()) {
      if (keys['Space']) inputVertical += 1;
      if (keys['ShiftLeft'] || keys['ShiftRight']) inputVertical -= 1;
    }

    const verticalDelta = inputVertical * flySpeed * deltaTime;
    resolveVertical(verticalDelta);
    playerState.velocity.y = 0;
    playerState.jumpQueued = false;
    playerState.onGround = false;

    const isMoving = horizontalMove.lengthSq() > 0.00001 || Math.abs(verticalDelta) > 0.00001;
    gameAudio.updateFootsteps(deltaTime, false, sprintMultiplier, false);
    syncPlayerBody();
    const hasLegoLolAimInput = mobileMode && isLegoLolCameraMode() && Math.hypot(lookDx, lookDy) > JOYSTICK_MAX_OFFSET * 0.18;
    if (hasLegoLolAimInput) {
      playerAimFacing.set(-lookDx, 0, -lookDy);
      syncPlayerFacing(playerAimFacing);
    } else if (horizontalMove.lengthSq() > 0.00001) {
      syncPlayerFacing(horizontalMove);
    }
    animatePlayerBody(deltaTime, isMoving);
    syncCameraToPlayerView(deltaTime);
    return;
  }

  playerState.velocity.y -= gravity * deltaTime;

  if (playerState.jumpQueued && playerState.jumpsUsed < maxJumps) {
    playerState.velocity.y = jumpSpeed;
    playerState.onGround = false;
    playerState.jumpsUsed += 1;
    gameAudio.playJumpSound(playerState.jumpsUsed >= 2);
  }

  playerState.jumpQueued = false;

  resolveVertical(playerState.velocity.y * deltaTime);
  resolveGround();

  playerState.onGround = isStandingOnSupport();

  const isMoving = horizontalMove.lengthSq() > 0.00001;
  gameAudio.updateFootsteps(deltaTime, isMoving, sprintMultiplier, playerState.onGround);
  syncPlayerBody();
  const hasLegoLolAimInput = mobileMode && isLegoLolCameraMode() && Math.hypot(lookDx, lookDy) > JOYSTICK_MAX_OFFSET * 0.18;
  if (hasLegoLolAimInput) {
    playerAimFacing.set(-lookDx, 0, -lookDy);
    syncPlayerFacing(playerAimFacing);
  } else if (isMoving) {
    playerMoveFacing.copy(horizontalMove);
    syncPlayerFacing(playerMoveFacing);
  }
  animatePlayerBody(deltaTime, isMoving);
  syncCameraToPlayerView(deltaTime);
}

// --------------------
// RESIZE
// --------------------

let leftTouchId = null;
let rightTouchId = null;

const leftJoy = document.querySelector('#menuInferiorLeft .joystick');
const leftPad = leftJoy.querySelector('.pad');

leftJoy.addEventListener('touchstart', e => {
  gameAudio.unlockAudio(true);
  e.preventDefault();
  for (let t of e.changedTouches) {
    leftTouchId = t.identifier;
  }
}, { passive: false });

leftJoy.addEventListener('touchend', e => {
  e.preventDefault();
  for (let t of e.changedTouches) {
    if (t.identifier === leftTouchId) {
      leftTouchId = null;
      moveForward = 0;
      moveRight = 0;
      leftPad.style.transform = 'translate(0px,0px)';
    }
  }
}, { passive: false });

leftJoy.addEventListener('touchmove', e => {
  e.preventDefault();
  for (let t of e.touches) {
    if (t.identifier === leftTouchId) {
      const rect = leftJoy.getBoundingClientRect();
      const x = t.clientX - rect.left - rect.width / 2;
      const y = t.clientY - rect.top - rect.height / 2;

      const max = JOYSTICK_MAX_OFFSET;
      const dx = Math.max(-max, Math.min(max, x));
      const dy = Math.max(-max, Math.min(max, y));

      leftPad.style.transform = `translate(${dx}px,${dy}px)`;

      moveForward = -dy / max;
      moveRight = dx / max;
    }
  }
}, { passive: false });

const rightJoy = document.querySelector('#menuInferiorRight .joystick');
const rightPad = rightJoy.querySelector('.pad');

rightJoy.addEventListener('touchstart', e => {
  gameAudio.unlockAudio(true);
  e.preventDefault();
  for (let t of e.changedTouches) {
    rightTouchId = t.identifier;
  }
}, { passive: false });

rightJoy.addEventListener('touchend', e => {
  e.preventDefault();
  for (let t of e.changedTouches) {
    if (t.identifier === rightTouchId) {
      rightTouchId = null;
      lookDx = 0;
      lookDy = 0;
      rightPad.style.transform = 'translate(0px,0px)';
    }
  }
}, { passive: false });

rightJoy.addEventListener('touchmove', e => {
  e.preventDefault();
  for (let t of e.touches) {
    if (t.identifier === rightTouchId) {
      const rect = rightJoy.getBoundingClientRect();
      const x = t.clientX - rect.left - rect.width / 2;
      const y = t.clientY - rect.top - rect.height / 2;

      const max = JOYSTICK_MAX_OFFSET;
      const dx = Math.max(-max, Math.min(max, x));
      const dy = Math.max(-max, Math.min(max, y));

      rightPad.style.transform = `translate(${dx}px,${dy}px)`;

      lookDx = dx;
      lookDy = dy;
    }
  }
}, { passive: false });

// --------------------
// MOBILE CONTROL VALUES
// --------------------
let moveForward = 0;
let moveRight = 0;

let yaw = 0;
let pitch = 0;
let lookDx = 0;
let lookDy = 0;

const sensitivity = 0.002;
const MOBILE_SHOOT_INTERVAL = 0.18;
let mobileShootTimer = 0;

function queueJump(event) {
  gameAudio.unlockAudio(true);
  if (event) event.preventDefault();
  setMobilePressState(buttonUp, true);
  playerState.jumpQueued = true;
}

function stopQueueJump(event) {
  if (event) event.preventDefault();
  setMobilePressState(buttonUp, false);
}

buttonUp.addEventListener('touchstart', queueJump, { passive: false });
buttonUp.addEventListener('touchend', stopQueueJump, { passive: false });
buttonUp.addEventListener('touchcancel', stopQueueJump, { passive: false });
buttonUp.addEventListener('pointerdown', event => {
  if (!mobileMode) return;
  queueJump(event);
});
buttonUp.addEventListener('pointerup', event => {
  if (!mobileMode) return;
  stopQueueJump(event);
});

if (buttonLeft0) {
  buttonLeft0.addEventListener('touchstart', event => {
    gameAudio.unlockAudio(true);
    if (!mobileMode) return;
    event.preventDefault();
    chatUI.handleToggleAction();
  }, { passive: false });
}

// Optional quick drop for mobile
buttonDown.addEventListener('touchstart', () => {
  if (!playerState.onGround) {
    playerState.velocity.y = Math.min(playerState.velocity.y, -8);
  }
});

function setShootButtonState(active) {
  if (!buttonShoot) return;
  buttonShoot.classList.toggle('is-shooting', active);
}

function setMobilePressState(button, active) {
  if (!button) return;
  button.classList.toggle('is-shooting', active);
}


function setMobileChatToggleState(active) {
  if (!buttonLeft0) return;
  buttonLeft0.classList.toggle('is-active', active);
}

function setMobileSprintState(active) {
  if (!buttonLeft1) return;
  buttonLeft1.classList.toggle('is-active', active);
}

function setMobileInventoryToggleState(active) {
  if (!buttonRight3) return;
  buttonRight3.classList.toggle('is-active', active);
}

function startMobileLeftClick(event) {
  gameAudio.unlockAudio(true);
  if (!mobileMode) return;
  if (event) event.preventDefault();
  setShootButtonState(true);
  triggerActionForMouseButton(0, { allowMobile: true });
}

function stopMobileLeftClick(event) {
  if (event) event.preventDefault();
  setShootButtonState(false);
}

function startMobileRightClick(event) {
  gameAudio.unlockAudio(true);
  if (!mobileMode) return;
  if (event) event.preventDefault();
  setMobilePressState(buttonRight1, true);
  triggerActionForMouseButton(2, { allowMobile: true });
}

function stopMobileRightClick(event) {
  if (event) event.preventDefault();
  setMobilePressState(buttonRight1, false);
}

function toggleMobileSprint(event) {
  gameAudio.unlockAudio(true);
  if (!mobileMode) return;
  if (event) event.preventDefault();
  mobileSprintEnabled = !mobileSprintEnabled;
  setMobileSprintState(mobileSprintEnabled);
}

if (buttonShoot) {
  buttonShoot.addEventListener('touchstart', startMobileLeftClick, { passive: false });
  buttonShoot.addEventListener('touchend', stopMobileLeftClick, { passive: false });
  buttonShoot.addEventListener('touchcancel', stopMobileLeftClick, { passive: false });
  buttonShoot.addEventListener('pointerdown', event => {
    if (!mobileMode) return;
    event.preventDefault();
    startMobileLeftClick(event);
  });
  buttonShoot.addEventListener('pointerup', event => {
    if (!mobileMode) return;
    event.preventDefault();
    stopMobileLeftClick(event);
  });
  buttonShoot.addEventListener('click', event => {
    if (!mobileMode) return;
    event.preventDefault();
    triggerActionForMouseButton(0, { allowMobile: true });
  });
}

if (buttonRight1) {
  buttonRight1.addEventListener('touchstart', startMobileRightClick, { passive: false });
  buttonRight1.addEventListener('touchend', stopMobileRightClick, { passive: false });
  buttonRight1.addEventListener('touchcancel', stopMobileRightClick, { passive: false });
  buttonRight1.addEventListener('pointerdown', event => {
    if (!mobileMode) return;
    startMobileRightClick(event);
  });
  buttonRight1.addEventListener('pointerup', event => {
    if (!mobileMode) return;
    stopMobileRightClick(event);
  });
  buttonRight1.addEventListener('click', event => {
    if (!mobileMode) return;
    event.preventDefault();
    triggerActionForMouseButton(2, { allowMobile: true });
  });
}

if (buttonRight3) {
  buttonRight3.addEventListener('touchstart', event => {
    gameAudio.unlockAudio(true);
    if (!mobileMode) return;
    suppressRight3Click = true;
    event.preventDefault();
    event.stopPropagation();
    setInventoryPanelOpen(!isMenuCentralVisible(), { allowMobile: true });
  }, { passive: false });
  buttonRight3.addEventListener('touchend', event => {
    if (!mobileMode) return;
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });
  buttonRight3.addEventListener('click', event => {
    if (!mobileMode) return;
    if (suppressRight3Click) {
      suppressRight3Click = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setInventoryPanelOpen(!isMenuCentralVisible(), { allowMobile: true });
  });
}

if (buttonLeft1) {
  buttonLeft1.addEventListener('touchstart', toggleMobileSprint, { passive: false });
  buttonLeft1.addEventListener('click', event => {
    if (!mobileMode) return;
    event.preventDefault();
    toggleMobileSprint(event);
  });
}

function updateMobileShooting(deltaTime) {
  return;
}

function toggleMenuCentralTab(tabName) {
  if (mobileMode) return;

  const sameTabOpen = isMenuCentralVisible() && getActiveMenuCentralTab() === tabName;
  if (sameTabOpen) {
    activateDesktopScreenActivity();
    return;
  }

  setMenuCentralTab(tabName);

  if (controls.isLocked) {
    controls.unlock();
    return;
  }
  if (isScreenDragCameraActive()) {
    deactivateDesktopScreenActivity(tabName);
    return;
  }
  showMenuCentral(getActiveMenuCentralTab());
}

document.addEventListener('mousedown', event => {
  gameAudio.unlockAudio(true);
  handleDesktopAttack(event);
});
document.addEventListener('touchstart', () => {
  gameAudio.unlockAudio(true);
}, { passive: true });
document.addEventListener('pointerdown', () => {
  gameAudio.unlockAudio(true);
}, { passive: true });
document.addEventListener('contextmenu', event => event.preventDefault());

document.addEventListener('keydown', e => {
  if (e.code === 'Escape' && chatUI.isInputOpen()) {
    e.preventDefault();
    e.stopPropagation();
    chatUI.hideInput();
    return;
  }

  if (e.code === 'Escape' && (isScreenDragCameraActive() || (isLegoLolCameraMode() && !mobileMode && !isMenuCentralVisible()))) {
    e.preventDefault();
    e.stopPropagation();
    deactivateDesktopScreenActivity(getActiveMenuCentralTab() || 'settings');
    return;
  }

  if (e.code === 'Enter') {
    if (e.repeat) return;
    if (e.target === chatBoxInput || !isTypingTarget(e.target)) {
      e.preventDefault();
      chatUI.handleAction();
      return;
    }
  }

  // Let desktop players hit "/" to jump straight into command entry with the
  // slash already inserted, while leaving normal typing fields untouched.
  // Using the produced key instead of the physical key code keeps this working
  // across keyboard layouts and prevents the browser quick-search shortcut.
  if (!mobileMode && e.key === '/' && !e.repeat && !chatUI.isInputOpen() && !isTypingTarget(e.target)) {
    e.preventDefault();
    e.stopPropagation();
    chatUI.showInput();
    if (chatBoxInput) {
      chatBoxInput.value = '/';
      chatBoxInput.setSelectionRange(1, 1);
    }
    return;
  }

  if (isTypingTarget(e.target)) return;

  if (e.code === 'KeyF' && !mobileMode) {
    if (e.repeat) return;
    setFlyMode(!flyMode);
    return;
  }

  if (e.code === 'KeyC' && !mobileMode) {
    e.preventDefault();
    if (e.repeat) return;
    toggleMenuCentralTab('creative');
    return;
  }

  if (e.code === 'KeyI' && !mobileMode) {
    e.preventDefault();
    if (e.repeat) return;
    toggleMenuCentralTab('inventory');
    return;
  }

  if (!mobileMode && /^[1-8]$/.test(e.key)) {
    e.preventDefault();
    if (e.repeat) return;
    const slotIndex = Number(e.key) - 1;
    inventoryUI.selectHotbarSlot(slotIndex);
    return;
  }

  if (e.code === 'Space') {
    if (flyMode) return;
    if (e.repeat) return;
    playerState.jumpQueued = true;
  }
});

const clock = new THREE.Clock();
let frames = 0;
let accTime = 0;
let fps = 0;

miniMapUI.updateMiniMapSize();
updatePlayerHealthUI();
updateVoxelRaycast();

function checkFPS(delta) {
  accTime += delta;
  frames++;

  if (accTime >= 1) {
    fps = Math.round(frames / accTime);
    frames = 0;
    accTime = 0;
  }

  const { x, z } = playerEye;
  const y = playerFoot.y;
  consola.textContent = 'FPS: ' + fps + ` XYZ: ${x.toFixed(2)} | ${y.toFixed(2)} | ${z.toFixed(2)}`;
}

// --------------------
// ANIMATION LOOP
// --------------------
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  if (!mobileMode && isDesktopGameplayActive() && isMenuCentralVisible()) {
    hideMenuCentral();
  }

  if (mobileMode) {
    if (!isLegoLolCameraMode() && rightTouchId !== null) {
      yaw -= lookDx * sensitivity;
      pitch -= lookDy * sensitivity;
      pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    }

    if (!isLegoLolCameraMode()) {
      camera.rotation.order = 'YXZ';
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
  } else if (!isLegoLolCameraMode()) {
    updateDesktopLook();
  }

  updatePlayer(delta);
  updateHeldItemSelection();
  updateRightPunch(delta);
  updateLeftPunch(delta);
  updatePunchHitboxes(delta);
  updateMobileShooting(delta);
  updateEntities(delta);
  updateItemAppearances(delta);
  updateChaserMeleeAttacks(delta);
  updateChaserPunchHitboxes(delta);
  updateProjectilesAndExplosions(delta);
  updateVoxelRaycast();
  updateDebugCollisionVisuals();
  checkFPS(delta);

  if (
    characterPreviewRenderer
    && characterPreviewScene
    && characterPreviewCamera
    && characterPreviewModel
    && isMenuCentralVisible()
    && getActiveMenuCentralTab() === 'character'
  ) {
    updateCharacterPreviewSize();
    characterPreviewIdleCycle += delta * 0.65;
    applyHumanoidIdleAnimation(characterPreviewModel.joints, characterPreviewIdleCycle, 0.9);
    characterPreviewRenderer.render(characterPreviewScene, characterPreviewCamera);
  }

  renderer.render(scene, camera);
  miniMapUI.updateMiniMap();
});
