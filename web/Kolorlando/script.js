import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { HunterEntity } from './entity.js';
import {
  createHumanoidModel,
  applyHumanoidIdleAnimation,
  applyHumanoidWalkAnimation,
  applyHumanoidRightPunchAnimation,
  applyHumanoidLeftPunchAnimation,
} from './entityModel.js';
import { createGameAudio } from './audio.js';
import { createPlayerHud } from './playerHud.js';
import { buildSimpleMap } from './maps/simpleMap.js';
import { buildCityMap } from './maps/cityMap.js';
import { buildVoxelandiaMap } from './maps/voxelandiaMap.js';

let mobileMode = false;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;
const MOBILE_BREAKPOINT = 900;
const MODE_DESKTOP = 'desktop';
const MODE_MOBILE_PORTRAIT = 'mobile-portrait';
const MODE_MOBILE_LANDSCAPE = 'mobile-landscape';
let activeMode = MODE_DESKTOP;
const touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
const THIRD_PERSON_MAX_DISTANCE = 8;
const THIRD_PERSON_DISTANCE_INPUT_SCALE = 0.01;
const JOYSTICK_MAX_OFFSET = 50;
const SUPPORT_EPSILON = 0.03;

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
const menuTabButtons = Array.from(document.querySelectorAll('#menuCentral .menu-tab'));
const menuPanels = Array.from(document.querySelectorAll('#menuCentral .menu-panel'));
const playButton = document.getElementById('playButton');
const menuInferior = document.getElementById('menuInferior');
const inventorySlots = document.getElementById('inventorySlots');
const inventorySelected = document.getElementById('inventorySelected');
const playerInventorySlots = document.getElementById('playerInventorySlots');
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
const chatBox = document.getElementById('chatBox');
const chatBoxOutput = document.getElementById('chatBoxOutput');
const chatBoxInput = document.getElementById('chatBoxInput');
const buttonLeft0 = document.getElementById('Left0');
const inventoryDragPreview = document.createElement('div');
let mobileShootPressed = false;
let mobileSprintEnabled = false;
let activeMenuCentralTab = 'settings';
let openingChatFromPointerLock = false;
let inventorySlotEls = [];
let inventoryDragState = null;
let suppressInventorySlotClick = false;
let characterPreviewDragState = null;
const gameAudio = createGameAudio();
const systemMenuThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let menuThemePreference = 'system';

const miniMapPlayerMarker = document.createElement('div');
miniMapPlayerMarker.id = 'miniMapPlayerMarker';
miniMap.appendChild(miniMapPlayerMarker);
const entityMiniMapMarkers = new Map();
inventoryDragPreview.className = 'inventory-drag-preview';
inventoryDragPreview.hidden = true;
document.body.appendChild(inventoryDragPreview);

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

function resolveMenuTheme() {
  if (menuThemePreference === 'dark') return 'dark';
  if (menuThemePreference === 'light') return 'light';
  return systemMenuThemeQuery.matches ? 'dark' : 'light';
}

function syncMenuThemeSetting() {
  if (!settingsMenuThemeDark) return;
  settingsMenuThemeDark.checked = resolveMenuTheme() === 'dark';
}

function applyMenuTheme() {
  if (!menuCentral) return;
  menuCentral.dataset.theme = resolveMenuTheme();
  syncMenuThemeSetting();
}

function setMenuThemePreference(nextPreference) {
  menuThemePreference = nextPreference;
  applyMenuTheme();
}

function scrollChatToBottom() {
  if (!chatBoxOutput) return;
  chatBoxOutput.scrollTop = chatBoxOutput.scrollHeight;
}

function showChatInput() {
  if (!chatBoxInput) return;
  if (!mobileMode && typeof controls !== 'undefined' && controls.isLocked) {
    openingChatFromPointerLock = true;
    controls.unlock();
  }
  setElementHidden(chatBoxInput, false);
  chatBox?.classList.add('backgrounded');
  chatBoxInput.focus();
  chatBoxInput.select();
}

function hideChatInput() {
  if (!chatBoxInput) return;
  setElementHidden(chatBoxInput, true);
  chatBox?.classList.remove('backgrounded');
  chatBoxInput.blur();
  if (!mobileMode && typeof controls !== 'undefined' && !controls.isLocked && !isMenuCentralVisible()) {
    controls.lock();
  }
}

function submitChatInput() {
  if (!chatBoxInput || !chatBoxOutput) return false;
  const message = chatBoxInput.value.trim();
  if (!message) return false;

  const line = document.createElement('div');
  line.textContent = `You: ${message}`;
  chatBoxOutput.appendChild(line);
  chatBoxInput.value = '';
  hideChatInput();
  scrollChatToBottom();
  return true;
}

function handleChatAction() {
  if (!chatBoxInput) return false;
  if (chatBoxInput.hidden) {
    showChatInput();
    return true;
  }

  return submitChatInput();
}

if (chatBoxInput) {
  chatBoxInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    handleChatAction();
  });
}

let characterPreviewRenderer = null;
let characterPreviewScene = null;
let characterPreviewCamera = null;
let characterPreviewModel = null;
let characterPreviewModelRoot = null;
let characterPreviewIdleCycle = Math.random() * Math.PI * 2;
let characterPreviewWidth = 0;
let characterPreviewHeight = 0;
const CHARACTER_PREVIEW_LOOK_Y = 1.26;

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
      lastX: event.clientX,
    };
    characterMenuPlayer.setPointerCapture?.(event.pointerId);
  });

  characterMenuPlayer.addEventListener('pointermove', event => {
    if (!characterPreviewDragState || event.pointerId !== characterPreviewDragState.pointerId || !characterPreviewModelRoot) {
      return;
    }

    const deltaX = event.clientX - characterPreviewDragState.lastX;
    characterPreviewDragState.lastX = event.clientX;
    characterPreviewModelRoot.rotation.y += deltaX * 0.014;
    event.preventDefault();
  });

  const stopCharacterPreviewDrag = event => {
    if (!characterPreviewDragState || event.pointerId !== characterPreviewDragState.pointerId) return;
    characterMenuPlayer.releasePointerCapture?.(event.pointerId);
    characterPreviewDragState = null;
  };

  characterMenuPlayer.addEventListener('pointerup', stopCharacterPreviewDrag);
  characterMenuPlayer.addEventListener('pointercancel', stopCharacterPreviewDrag);
}

function syncAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}

function resolveMode() {
  const hasTouchScreen = (navigator.maxTouchPoints ?? 0) > 1;
  const isCoarsePointer = touchQuery.matches;
  const touchMobileViewport = (hasTouchScreen || isCoarsePointer) && Math.max(windowWidth, windowHeight) <= 1400;
  const isMobile = windowWidth < MOBILE_BREAKPOINT || touchMobileViewport;
  if (!isMobile) return MODE_DESKTOP;
  return windowWidth > windowHeight ? MODE_MOBILE_LANDSCAPE : MODE_MOBILE_PORTRAIT;
}

function isMenuCentralVisible() {
  return !menuCentral.hidden;
}

function setMenuCentralTab(tabName) {
  activeMenuCentralTab = tabName;
  for (let i = 0; i < menuTabButtons.length; i++) {
    const isActive = menuTabButtons[i].dataset.menuTab === tabName;
    menuTabButtons[i].classList.toggle('is-active', isActive);
  }
  for (let i = 0; i < menuPanels.length; i++) {
    const isActive = menuPanels[i].dataset.menuPanel === tabName;
    menuPanels[i].classList.toggle('is-active', isActive);
  }
}

function showMenuCentral(tabName = activeMenuCentralTab, { force = false } = {}) {
  if (!force && !mobileMode && typeof controls !== 'undefined' && controls.isLocked) {
    hideMenuCentral();
    return;
  }
  setMenuCentralTab(tabName);
  setElementHidden(menuCentral, false);
  document.body.classList.add('menu-central-open');
}

function hideMenuCentral() {
  setElementHidden(menuCentral, true);
  document.body.classList.remove('menu-central-open');
}

function applyMode(mode) {
  activeMode = mode;
  document.body.dataset.mode = mode;

  const shouldUseMobile = mode !== MODE_DESKTOP;
  mobileMode = shouldUseMobile;

  if (shouldUseMobile) {
    if (controls.isLocked) {
      controls.unlock();
    }
    hideMenuCentral();
    setElementHidden(menuInferior, false);
    menuInferior.classList.add('flex');
    return;
  }

  setMenuCentralTab(activeMenuCentralTab || 'settings');
  if (controls.isLocked) {
    hideMenuCentral();
  } else {
    showMenuCentral(activeMenuCentralTab || 'settings');
  }
  setElementHidden(menuInferior, true);
  menuInferior.classList.remove('flex');
  mobileShootPressed = false;
  mobileSprintEnabled = false;
  setShootButtonState(false);
  setMobileSprintState(false);
}

function updateModeFromViewport() {
  const nextMode = resolveMode();
  if (nextMode !== activeMode) {
    console.log(`Mode changed: ${activeMode} -> ${nextMode}`);
  }
  applyMode(nextMode);
}

const sceneView = document.getElementById('sceneView');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x5EC9FF);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

sceneView.appendChild(renderer.domElement);

function updateSceneViewSize() {
  const width = Math.max(1, sceneView.clientWidth);
  const height = Math.max(1, sceneView.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function syncFullScreenSetting() {
  if (!settingsFullScreen) return;
  settingsFullScreen.checked = document.fullscreenElement != null;
}

async function setFullScreenEnabled(nextEnabled) {
  if (nextEnabled) {
    if (document.fullscreenElement) return true;
    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch (error) {
      console.error('Failed to enter fullscreen mode.', error);
      syncFullScreenSetting();
      return false;
    }
  }

  if (!document.fullscreenElement) return true;
  try {
    await document.exitFullscreen();
    return true;
  } catch (error) {
    console.error('Failed to exit fullscreen mode.', error);
    syncFullScreenSetting();
    return false;
  }
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

for (let i = 0; i < gameModeButtons.length; i++) {
  gameModeButtons[i].addEventListener('click', () => {
    setGameMode(gameModeButtons[i].dataset.gameMode);
  });
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

const miniMapRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
miniMapRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
miniMapRenderer.shadowMap.enabled = false;
miniMap.appendChild(miniMapRenderer.domElement);

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
  if (chatBoxInput && !chatBoxInput.hidden) {
    hideChatInput();
    return;
  }
  if (!mobileMode) {
    showMenuCentral(activeMenuCentralTab || 'settings', { force: true });
  }
});

function controlLocker(event) {
  if (!isMenuCentralVisible()) return;
  const clickedInsideMenu = Boolean(event?.target?.closest?.('#menuCentral'));
  if (clickedInsideMenu) return;
  hideMenuCentral();

  if (mobileMode) {
    setElementHidden(menuInferior, false);
    menuInferior.classList.add('flex');
    return;
  }

  if (!controls.isLocked) {
    controls.lock();
  }
}

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

updateModeFromViewport();
syncAppHeight();
updateSceneViewSize();
setMenuCentralTab('settings');
syncFullScreenSetting();
applyMenuTheme();
scrollChatToBottom();
document.addEventListener('click', controlLocker);
document.addEventListener('touchstart', controlLocker, { passive: true });
document.addEventListener('fullscreenchange', syncFullScreenSetting);
if (typeof systemMenuThemeQuery.addEventListener === 'function') {
  systemMenuThemeQuery.addEventListener('change', () => {
    if (menuThemePreference !== 'system') return;
    applyMenuTheme();
  });
}

if (menuCentral) {
  menuCentral.addEventListener('click', event => {
    event.stopPropagation();
  });
}

if (settingsFullScreen) {
  settingsFullScreen.addEventListener('change', () => {
    setFullScreenEnabled(settingsFullScreen.checked);
  });
}

if (settingsMenuThemeDark) {
  settingsMenuThemeDark.addEventListener('change', () => {
    setMenuThemePreference(settingsMenuThemeDark.checked ? 'dark' : 'light');
  });
}

for (let i = 0; i < menuTabButtons.length; i++) {
  menuTabButtons[i].addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const nextTab = menuTabButtons[i].dataset.menuTab;
    if (!nextTab) return;
    setMenuCentralTab(nextTab);
  });
}

if (playButton) {
  playButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    hideMenuCentral();
    controls.lock();
  });
}

const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
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

function applyPlayerDamage(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  playerState.health = Math.max(0, playerState.health - amount);
  updatePlayerHealthUI();
  return playerState.health <= 0;
}

function getDesktopSprintMultiplier() {
  if (mobileMode) return mobileSprintEnabled ? 2 : 1;
  if (!controls.isLocked) return 1;
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
const voxelTypeByName = new Map(voxelTypes.map(type => [type.name, type]));
const PLAYER_INVENTORY_SLOT_COUNT = 32;
const PLAYER_STACK_LIMIT = 99;
const GAME_MODE_CREATIVE = 'creative';
const GAME_MODE_SURVIVAL = 'survival';
let gameMode = GAME_MODE_SURVIVAL;
const playerInventory = Array.from({ length: PLAYER_INVENTORY_SLOT_COUNT }, () => null);
let selectedInventorySlotIndex = 0;
let selectedVoxelType = voxelTypes.find(type => type.name === 'green')?.name ?? voxelTypes[0]?.name ?? 'green';
let selectedHotbarIndex = Math.max(0, voxelTypes.findIndex(type => type.name === selectedVoxelType));
const intersectMapColliderBox = typeof mapData.intersectColliderBox === 'function'
  ? mapData.intersectColliderBox
  : () => null;
const isMapBoxSupported = typeof mapData.isBoxSupported === 'function'
  ? mapData.isBoxSupported
  : () => false;
const SHADOW_RANGE = mapData.shadowRange ?? 80;
const MINI_MAP_VIEW_SIZE = mapData.miniMapViewSize ?? 90;
const MINI_MAP_HEIGHT = mapData.miniMapHeight ?? 130;
const HAS_INFINITE_GROUND = mapData.hasInfiniteGround ?? true;
const FALL_RESPAWN_Y = -100;
const playerSpawnPoint = mapData.spawnPoint.clone();
playerSpawnPoint.y += 1;

playerEye.copy(playerSpawnPoint);
camera.position.copy(playerEye);

function getVoxelTypeColor(typeName) {
  return voxelTypeByName.get(typeName)?.color ?? 0xffffff;
}

function getVoxelTypeHexColor(typeName) {
  return `#${getVoxelTypeColor(typeName).toString(16).padStart(6, '0')}`;
}

function mixColorChannel(channel, target, amount) {
  return Math.round(channel + (target - channel) * amount);
}

function tintHexColor(hexColor, amount) {
  const normalized = hexColor.replace('#', '');
  const color = Number.parseInt(normalized, 16);
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const target = amount >= 0 ? 255 : 0;
  const strength = Math.abs(amount);

  const tinted = (mixColorChannel(r, target, strength) << 16)
    | (mixColorChannel(g, target, strength) << 8)
    | mixColorChannel(b, target, strength);

  return `#${tinted.toString(16).padStart(6, '0')}`;
}

function createVoxelIcon(hexColor) {
  const icon = document.createElement('span');
  icon.className = 'voxel-icon item-slot-icon';
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('voxel-icon__svg');

  const top = document.createElementNS(svgNamespace, 'polygon');
  top.setAttribute('points', '32,6 54,19 32,32 10,19');
  top.setAttribute('fill', tintHexColor(hexColor, 0.38));
  top.setAttribute('stroke', 'rgba(15, 18, 22, 0.92)');
  top.setAttribute('stroke-width', '2');
  top.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(top);

  const left = document.createElementNS(svgNamespace, 'polygon');
  left.setAttribute('points', '10,19 32,32 32,57 10,44');
  left.setAttribute('fill', tintHexColor(hexColor, 0.1));
  left.setAttribute('stroke', 'rgba(15, 18, 22, 0.92)');
  left.setAttribute('stroke-width', '2');
  left.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(left);

  const right = document.createElementNS(svgNamespace, 'polygon');
  right.setAttribute('points', '54,19 32,32 32,57 54,44');
  right.setAttribute('fill', tintHexColor(hexColor, -0.18));
  right.setAttribute('stroke', 'rgba(15, 18, 22, 0.92)');
  right.setAttribute('stroke-width', '2');
  right.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(right);

  const edge = document.createElementNS(svgNamespace, 'polyline');
  edge.setAttribute('points', '32,32 32,57');
  edge.setAttribute('fill', 'none');
  edge.setAttribute('stroke', 'rgba(15, 18, 22, 0.92)');
  edge.setAttribute('stroke-width', '2');
  edge.setAttribute('stroke-linecap', 'round');
  edge.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(edge);

  icon.appendChild(svg);

  return icon;
}

function getSelectedSurvivalStack() {
  return playerInventory[selectedInventorySlotIndex];
}

function findInventorySlotIndexByType(typeName) {
  if (!typeName) return -1;
  return playerInventory.findIndex(stack => stack?.typeName === typeName);
}

function inventoryHasType(typeName) {
  return findInventorySlotIndexByType(typeName) >= 0;
}

function syncSelectedVoxelTypeFromMode() {
  const selectedStack = getSelectedSurvivalStack();
  if (selectedStack?.typeName) {
    selectedVoxelType = selectedStack.typeName;
  }
}

function getSelectedInventoryLabel() {
  const slotNumber = selectedInventorySlotIndex + 1;
  const selectedStack = getSelectedSurvivalStack();
  if (!selectedStack) {
    return `Selected slot: ${slotNumber} (empty)`;
  }
  return `Selected slot: ${slotNumber} (${selectedStack.typeName} x${selectedStack.count})`;
}

function updateGameModeUI() {
  if (gameModeReadout) {
    const modeLabel = gameMode === GAME_MODE_SURVIVAL ? 'Survival' : 'Creative';
    gameModeReadout.textContent = `Mode: ${modeLabel}`;
  }

  for (let i = 0; i < gameModeButtons.length; i++) {
    const isActive = gameModeButtons[i].dataset.gameMode === gameMode;
    gameModeButtons[i].classList.toggle('is-active', isActive);
  }
}

function setGameMode(nextMode) {
  const normalizedMode = nextMode === GAME_MODE_SURVIVAL ? GAME_MODE_SURVIVAL : GAME_MODE_CREATIVE;
  if (gameMode === normalizedMode) {
    updateGameModeUI();
    updateInventorySelectionUI();
    renderPlayerInventorySlots();
    return;
  }

  gameMode = normalizedMode;
  if (gameMode === GAME_MODE_SURVIVAL) {
    selectedHotbarIndex = selectedInventorySlotIndex < hotbarSlotEls.length ? selectedInventorySlotIndex : -1;
  }
  syncSelectedVoxelTypeFromMode();
  updateGameModeUI();
  updateInventorySelectionUI();
  renderPlayerInventorySlots();
}

function addItemToInventory(typeName, amount = 1) {
  if (!typeName || amount <= 0) return 0;

  let remaining = amount;

  for (let i = 0; i < playerInventory.length && remaining > 0; i++) {
    const stack = playerInventory[i];
    if (!stack || stack.typeName !== typeName || stack.count >= PLAYER_STACK_LIMIT) continue;
    const freeSpace = PLAYER_STACK_LIMIT - stack.count;
    const movedAmount = Math.min(freeSpace, remaining);
    stack.count += movedAmount;
    remaining -= movedAmount;
  }

  for (let i = 0; i < playerInventory.length && remaining > 0; i++) {
    if (playerInventory[i]) continue;
    const movedAmount = Math.min(PLAYER_STACK_LIMIT, remaining);
    playerInventory[i] = { typeName, count: movedAmount };
    remaining -= movedAmount;
  }

  renderPlayerInventorySlots();
  updateInventorySelectionUI();
  return amount - remaining;
}

function consumeSelectedInventoryItem(amount = 1) {
  const selectedStack = getSelectedSurvivalStack();
  if (!selectedStack || amount <= 0) return false;
  if (selectedStack.count < amount) return false;

  selectedStack.count -= amount;
  if (selectedStack.count <= 0) {
    playerInventory[selectedInventorySlotIndex] = null;
  }

  syncSelectedVoxelTypeFromMode();
  renderPlayerInventorySlots();
  updateInventorySelectionUI();
  return true;
}

function selectInventorySlot(index) {
  if (index < 0 || index >= playerInventory.length) return;
  selectedInventorySlotIndex = index;
  selectedHotbarIndex = index < hotbarSlotEls.length ? index : -1;
  syncSelectedVoxelTypeFromMode();
  renderPlayerInventorySlots();
  updateInventorySelectionUI();
}

function handlePlayerInventorySlotClick(index) {
  if (suppressInventorySlotClick) {
    suppressInventorySlotClick = false;
    return;
  }
  selectInventorySlot(index);
}

function clearInventoryDragPreview() {
  inventoryDragPreview.hidden = true;
  inventoryDragPreview.textContent = '';
}

function updateInventoryDragPreviewPosition(clientX, clientY) {
  inventoryDragPreview.style.transform = `translate(${clientX - 32}px, ${clientY - 32}px)`;
}

function stopInventoryDrag() {
  if (!inventoryDragState) return;
  inventoryDragState.sourceElement?.classList.remove('is-drag-source');
  inventoryDragState = null;
  clearInventoryDragPreview();
}

function moveInventoryStack(sourceIndex, targetIndex) {
  if (sourceIndex === targetIndex) return;
  if (sourceIndex < 0 || sourceIndex >= playerInventory.length) return;
  if (targetIndex < 0 || targetIndex >= playerInventory.length) return;

  const movedStack = playerInventory[sourceIndex];
  playerInventory[sourceIndex] = playerInventory[targetIndex];
  playerInventory[targetIndex] = movedStack;

  if (selectedInventorySlotIndex === sourceIndex) {
    selectedInventorySlotIndex = targetIndex;
  } else if (selectedInventorySlotIndex === targetIndex) {
    selectedInventorySlotIndex = sourceIndex;
  }

  selectedHotbarIndex = selectedInventorySlotIndex < hotbarSlotEls.length ? selectedInventorySlotIndex : -1;
  syncSelectedVoxelTypeFromMode();
  renderPlayerInventorySlots();
  updateInventorySelectionUI();
}

function beginInventorySlotDrag(index, event, element) {
  if (!playerInventory[index]) return;
  if (event.button !== undefined && event.button !== 0) return;

  inventoryDragState = {
    pointerId: event.pointerId,
    sourceIndex: index,
    sourceElement: element,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    dragging: false,
  };
}

function handleInventoryDragMove(event) {
  if (!inventoryDragState || event.pointerId !== inventoryDragState.pointerId) return;

  inventoryDragState.lastX = event.clientX;
  inventoryDragState.lastY = event.clientY;

  if (!inventoryDragState.dragging) {
    const deltaX = event.clientX - inventoryDragState.startX;
    const deltaY = event.clientY - inventoryDragState.startY;
    if (Math.hypot(deltaX, deltaY) < 8) return;

    inventoryDragState.dragging = true;
    suppressInventorySlotClick = true;
    inventoryDragState.sourceElement?.classList.add('is-drag-source');
    const previewSlot = inventoryDragState.sourceElement?.cloneNode(true);
    if (previewSlot) {
      inventoryDragPreview.textContent = '';
      inventoryDragPreview.appendChild(previewSlot);
    }
    inventoryDragPreview.hidden = false;
  }

  event.preventDefault();
  updateInventoryDragPreviewPosition(event.clientX, event.clientY);
}

function handleInventoryDragEnd(event) {
  if (!inventoryDragState || event.pointerId !== inventoryDragState.pointerId) return;

  const { dragging, sourceIndex, lastX, lastY } = inventoryDragState;
  const clientX = event.clientX ?? lastX;
  const clientY = event.clientY ?? lastY;

  if (dragging) {
    event.preventDefault();
    const dropTarget = document.elementFromPoint(clientX, clientY)?.closest?.('.inventory-menu-slot');
    const targetIndex = Number(dropTarget?.dataset.slotIndex);
    if (Number.isInteger(targetIndex)) {
      moveInventoryStack(sourceIndex, targetIndex);
    }
    window.setTimeout(() => {
      suppressInventorySlotClick = false;
    }, 0);
  }

  stopInventoryDrag();
}

function addCreativeInventoryItem(typeName) {
  const added = addItemToInventory(typeName, 1);
  if (added <= 0) return;

  const slotIndex = findInventorySlotIndexByType(typeName);
  if (slotIndex >= 0) {
    selectInventorySlot(slotIndex);
  }
}

function renderInventorySlots() {
  if (!inventorySlots) return;
  inventorySlots.textContent = '';
  inventorySlotEls = [];

  for (let i = 0; i < voxelTypes.length; i++) {
    const voxelType = voxelTypes[i];
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'hotbar-slot creative-slot';
    slot.dataset.voxelType = voxelType.name;

    const swatch = createVoxelIcon(getVoxelTypeHexColor(voxelType.name));
    slot.appendChild(swatch);

    const label = document.createElement('span');
    label.className = 'hotbar-slot-label';
    label.textContent = voxelType.name;
    slot.appendChild(label);

    slot.addEventListener('click', () => {
      if (gameMode === GAME_MODE_CREATIVE) {
        addCreativeInventoryItem(voxelType.name);
        return;
      }
      selectedVoxelType = voxelType.name;
      updateInventorySelectionUI();
    });

    inventorySlots.appendChild(slot);
    inventorySlotEls.push(slot);
  }

  updateInventorySelectionUI();
}

function renderPlayerInventorySlots() {
  if (!playerInventorySlots) return;
  playerInventorySlots.textContent = '';

  for (let i = 0; i < PLAYER_INVENTORY_SLOT_COUNT; i++) {
    const stack = playerInventory[i];
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'hotbar-slot inventory-menu-slot';
    slot.dataset.slotIndex = String(i);
    if (!stack) {
      slot.classList.add('is-empty');
    }
    if (i === selectedInventorySlotIndex) {
      slot.classList.add('is-selected');
    }

    if (stack) {
      const swatch = createVoxelIcon(getVoxelTypeHexColor(stack.typeName));
      slot.appendChild(swatch);
    }

    const label = document.createElement('span');
    label.className = 'hotbar-slot-label';
    label.textContent = stack ? stack.typeName : 'empty';
    slot.appendChild(label);

    const count = document.createElement('span');
    count.className = 'hotbar-slot-count';
    count.textContent = stack ? String(stack.count) : '';
    slot.appendChild(count);

    slot.addEventListener('click', () => {
      handlePlayerInventorySlotClick(i);
    });
    slot.addEventListener('pointerdown', event => {
      beginInventorySlotDrag(i, event, slot);
    });

    playerInventorySlots.appendChild(slot);
  }

  if (playerInventorySummary) {
    const totalItems = playerInventory.reduce((sum, stack) => sum + (stack?.count ?? 0), 0);
    playerInventorySummary.textContent = `${totalItems} / ${PLAYER_INVENTORY_SLOT_COUNT * PLAYER_STACK_LIMIT} items`;
  }

  if (playerInventorySelection) {
    playerInventorySelection.textContent = getSelectedInventoryLabel();
  }
}

function updateInventorySelectionUI() {
  if (inventorySelected) {
    const selectedStack = getSelectedSurvivalStack();
    inventorySelected.textContent = selectedStack
      ? `Selected: ${selectedStack.typeName} x${selectedStack.count}`
      : 'Selected: empty slot';
  }
  if (!inventorySlots) return;

  for (let i = 0; i < inventorySlotEls.length; i++) {
    const slot = inventorySlotEls[i];
    const selectedStack = getSelectedSurvivalStack();
    const isSelected = slot.dataset.voxelType === selectedStack?.typeName;
    slot.classList.toggle('is-selected', isSelected);
  }

  for (let i = 0; i < hotbarSlotEls.length; i++) {
    hotbarSlotEls[i].classList.toggle('is-selected', i === selectedHotbarIndex);
    hotbarSlotEls[i].textContent = '';

    const stack = playerInventory[i];
    if (!stack) continue;

    const swatch = createVoxelIcon(getVoxelTypeHexColor(stack.typeName));
    hotbarSlotEls[i].appendChild(swatch);

    const label = document.createElement('span');
    label.className = 'hotbar-slot-label';
    label.textContent = stack.typeName;
    hotbarSlotEls[i].appendChild(label);

    const count = document.createElement('span');
    count.className = 'hotbar-slot-count';
    count.textContent = String(stack.count);
    hotbarSlotEls[i].appendChild(count);
  }

  if (playerInventorySelection) {
    playerInventorySelection.textContent = getSelectedInventoryLabel();
  }
}

function selectHotbarSlot(index) {
  if (index < 0 || index >= hotbarSlotEls.length) return;
  selectedHotbarIndex = index;
  selectedInventorySlotIndex = index;
  selectedHotbarIndex = index;
  syncSelectedVoxelTypeFromMode();
  updateInventorySelectionUI();
  renderPlayerInventorySlots();
}

for (let i = 0; i < hotbarSlotEls.length; i++) {
  const slot = hotbarSlotEls[i];
  slot.setAttribute('role', 'button');
  slot.setAttribute('tabindex', '0');
  slot.setAttribute('aria-label', `Select hotbar slot ${i + 1}`);

  slot.addEventListener('mousedown', event => {
    event.preventDefault();
    event.stopPropagation();
    selectHotbarSlot(i);
  });

  slot.addEventListener('touchstart', event => {
    event.preventDefault();
    event.stopPropagation();
    selectHotbarSlot(i);
  }, { passive: false });

  slot.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    selectHotbarSlot(i);
  });

  slot.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectHotbarSlot(i);
  });
}

document.addEventListener('pointermove', handleInventoryDragMove, { passive: false });
document.addEventListener('pointerup', handleInventoryDragEnd);
document.addEventListener('pointercancel', handleInventoryDragEnd);

renderInventorySlots();
renderPlayerInventorySlots();
updateGameModeUI();

const miniMapCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
miniMapCamera.up.set(0, 0, -1);
scene.add(miniMapCamera);

function updateMiniMapSize() {
  const width = miniMap.clientWidth || 200;
  const height = miniMap.clientHeight || 200;
  const aspect = width / height;
  const halfHeight = MINI_MAP_VIEW_SIZE * 0.5;
  const halfWidth = halfHeight * aspect;

  miniMapCamera.left = -halfWidth;
  miniMapCamera.right = halfWidth;
  miniMapCamera.top = halfHeight;
  miniMapCamera.bottom = -halfHeight;
  miniMapCamera.updateProjectionMatrix();

  miniMapRenderer.setSize(width, height, false);
}

dir.shadow.camera.left = -SHADOW_RANGE;
dir.shadow.camera.right = SHADOW_RANGE;
dir.shadow.camera.top = SHADOW_RANGE;
dir.shadow.camera.bottom = -SHADOW_RANGE;
dir.shadow.camera.near = 10;
dir.shadow.camera.far = 600;
dir.shadow.camera.updateProjectionMatrix();

const CAMERA_RAYCAST_RANGE = 18;
const CAMERA_RAYCAST_START_OFFSET = 0.18;
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

const playerCollider = new THREE.Box3();
const playerFoot = new THREE.Vector3();
const previousFoot = new THREE.Vector3();
const testBox = new THREE.Box3();
const playerColliderMin = new THREE.Vector3();
const playerColliderMax = new THREE.Vector3();
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

const firstPersonArmsRig = createFirstPersonArmsRig();
camera.add(firstPersonArmsRig.root);

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

function syncPlayerBody() {
  playerBody.position.set(
    playerEye.x,
    playerCollider.min.y,
    playerEye.z
  );
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
let thirdPersonDistance = 0;
let currentThirdPersonDistance = 0;
let currentShoulderOffset = 0;
const THIRD_PERSON_DISTANCE_LERP = 8;
const THIRD_PERSON_SHOULDER_LERP = 8;
const THIRD_PERSON_MAX_SHOULDER_OFFSET = 0.5;

let pinchZoomTouchIds = [];
let pinchStartDistance = 0;
let pinchStartThirdPersonDistance = 0;

function setThirdPersonDistance(nextDistance) {
  thirdPersonDistance = THREE.MathUtils.clamp(nextDistance, 0, THIRD_PERSON_MAX_DISTANCE);
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

function handleMobilePinchStart(event) {
  if (!mobileMode || event.touches.length < 2) return;

  const firstTouch = event.touches[0];
  const secondTouch = event.touches[1];
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
  const tDistance = 1 - Math.exp(-THIRD_PERSON_DISTANCE_LERP * deltaTime);
  const tShoulder = 1 - Math.exp(-THIRD_PERSON_SHOULDER_LERP * deltaTime);
  currentThirdPersonDistance = THREE.MathUtils.lerp(currentThirdPersonDistance, thirdPersonDistance, tDistance);
  const targetShoulderOffset = thirdPersonDistance > 0.001 ? THIRD_PERSON_MAX_SHOULDER_OFFSET : 0;
  currentShoulderOffset = THREE.MathUtils.lerp(currentShoulderOffset, targetShoulderOffset, tShoulder);

  camera.position.copy(playerEye);
  playerBody.visible = currentThirdPersonDistance > 0.001;
  firstPersonArmsRig.root.visible = currentThirdPersonDistance <= 0.001;

  if (currentThirdPersonDistance > 0.001) {
    // Move camera backward from the look direction to get a third-person view.
    camera.getWorldDirection(thirdPersonOffsetDir);
    thirdPersonRightDir.crossVectors(thirdPersonOffsetDir, worldUp).normalize();
    thirdPersonTargetPos.copy(playerEye);
    thirdPersonTargetPos.addScaledVector(thirdPersonOffsetDir, -currentThirdPersonDistance);
    thirdPersonTargetPos.addScaledVector(thirdPersonRightDir, currentShoulderOffset);
    camera.position.copy(thirdPersonTargetPos);
  }
}

function handleDesktopWheelThirdPerson(event) {
  if (mobileMode || !controls.isLocked) return;

  // Scroll out to move into third-person; scroll in back to first-person.
  setThirdPersonDistance(thirdPersonDistance + event.deltaY * THIRD_PERSON_DISTANCE_INPUT_SCALE);
  event.preventDefault();
}

window.addEventListener('wheel', handleDesktopWheelThirdPerson, { passive: false });
sceneView.addEventListener('touchstart', handleMobilePinchStart, { passive: false });
sceneView.addEventListener('touchmove', handleMobilePinchMove, { passive: false });
sceneView.addEventListener('touchend', handleMobilePinchEnd, { passive: false });
sceneView.addEventListener('touchcancel', handleMobilePinchEnd, { passive: false });

updatePlayerCollider(playerEye);
syncPlayerBody();
syncCameraToPlayerView();

function getEntityMiniMapMarkerClass(entity) {
  if (entity.miniMapType === 'chaser') return 'mini-map-marker--chaser';
  if (entity.miniMapType === 'talker') return 'mini-map-marker--talker';
  return 'mini-map-marker--walker';
}

function syncEntityMiniMapMarkers() {
  const aliveEntities = new Set(entities);

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    let marker = entityMiniMapMarkers.get(entity);
    if (!marker) {
      marker = document.createElement('div');
      marker.className = `mini-map-entity-marker ${getEntityMiniMapMarkerClass(entity)}`;
      miniMap.appendChild(marker);
      entityMiniMapMarkers.set(entity, marker);
    }
  }

  for (const [entity, marker] of entityMiniMapMarkers.entries()) {
    if (!aliveEntities.has(entity)) {
      marker.remove();
      entityMiniMapMarkers.delete(entity);
    }
  }
}

const PROJECTILE_RADIUS = 0.14;
const PROJECTILE_SPEED = 42;
const PROJECTILE_LIFETIME = 3;
const PROJECTILE_DAMAGE = 20;
const PUNCH_DAMAGE = 10;
const PUNCH_PUSH_FORCE = 8;
const CHASER_PUNCH_DAMAGE = 8;
const CHASER_ATTACK_INTERVAL = 0.4;
const CHASER_FRONT_DOT_THRESHOLD = 0.1;
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
const playerLookForwardDir = new THREE.Vector3();
const playerToChaserDir = new THREE.Vector3();
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

function spawnPunchHitbox(side) {
  camera.getWorldDirection(punchForwardDir).normalize();

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
        punchPushDir.copy(punchForwardDir);
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
  if (mobileMode || !controls.isLocked) return;
  shootProjectileFromPlayer();
}

function startRightPunch(options = {}) {
  const allowMobile = options.allowMobile === true;
  if (mobileMode && !allowMobile) return;
  if (!mobileMode && !controls.isLocked) return;
  if (rightPunchTimer > 0) return;

  rightPunchTimer = RIGHT_PUNCH_DURATION;
  spawnPunchHitbox('right');
}

function startLeftPunch(options = {}) {
  const allowMobile = options.allowMobile === true;
  if (mobileMode && !allowMobile) return;
  if (!mobileMode && !controls.isLocked) return;
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
        if (gameMode === GAME_MODE_SURVIVAL) {
          addItemToInventory(removedVoxelType, 1);
        } else if (!inventoryHasType(removedVoxelType)) {
          addCreativeInventoryItem(removedVoxelType);
        }
      }
      return;
    }
    startRightPunch({ allowMobile });
    return;
  }

  if (button === 2) {
    if (currentRaycastState.voxelEditionMode) {
      const selectedStack = getSelectedSurvivalStack();
      if (!selectedStack?.typeName) return;

      const added = addVoxelAtRaycastHit(currentRaycastState.hit, {
        playerCollider,
        voxelType: selectedStack.typeName,
      });
      if (added && gameMode === GAME_MODE_SURVIVAL) {
          consumeSelectedInventoryItem(1);
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

  if (isMenuCentralVisible()) {
    const clickedInsideMenu = Boolean(event.target?.closest?.('#menuCentral'));
    if (clickedInsideMenu) {
      return;
    }
    hideMenuCentral();
    controls.lock();
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
    mesh,
  });
}

function updateChaserPunchHitboxes(deltaTime) {
  for (let i = chaserPunchHitboxes.length - 1; i >= 0; i--) {
    const hitbox = chaserPunchHitboxes[i];
    hitbox.age += deltaTime;
    if (hitbox.age < hitbox.life) continue;

    if (hitbox.mesh) {
      scene.remove(hitbox.mesh);
    }
    chaserPunchHitboxes.splice(i, 1);
  }
}

function updateChaserMeleeAttacks(deltaTime) {
  camera.getWorldDirection(playerLookForwardDir);
  playerLookForwardDir.y = 0;
  if (playerLookForwardDir.lengthSq() > 0.0001) {
    playerLookForwardDir.normalize();
  } else {
    playerLookForwardDir.set(0, 0, -1);
  }

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

    playerToChaserDir.copy(chaserToPlayerDir).multiplyScalar(-1);
    if (playerToChaserDir.lengthSq() > 0.0001) {
      playerToChaserDir.normalize();
    } else {
      playerToChaserDir.set(0, 0, 1);
    }
    const isInFrontOfPlayer = playerLookForwardDir.dot(playerToChaserDir) >= CHASER_FRONT_DOT_THRESHOLD;
    if (!isInFrontOfPlayer) {
      chaserAttackCooldowns.set(entity, cooldown);
      chaserAttackStates.set(entity, state);
      continue;
    }

    if (cooldown <= 0) {
      applyPlayerDamage(CHASER_PUNCH_DAMAGE);
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

function tryMoveAxis(axis, delta) {
  if (delta === 0) return;

  axisTestPos.copy(playerEye);
  axisTestPos[axis] += delta;

  updatePlayerCollider(axisTestPos);
  testBox.copy(playerCollider);

  if (!collidesWithBuildings(testBox)) {
    playerEye[axis] += delta;
    updatePlayerCollider(playerEye);
  }
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
const worldUp = new THREE.Vector3(0, 1, 0);
const miniMapFacing = new THREE.Vector3();
const miniMapProjectedPos = new THREE.Vector3();
const currentRaycastState = {
  hit: null,
  voxelEditionMode: false,
};

function updateVoxelRaycast() {
  camera.getWorldDirection(cameraRayDirection);
  cameraRayDirection.normalize();
  camera.getWorldPosition(cameraRayOrigin);
  cameraRayOrigin.addScaledVector(cameraRayDirection, CAMERA_RAYCAST_START_OFFSET);

  cameraRaycaster.set(cameraRayOrigin, cameraRayDirection);
  const intersections = raycastTargets.length > 0
    ? cameraRaycaster.intersectObjects(raycastTargets, true)
    : [];

  let voxelLabel = 'none';
  let activeVoxelHit = null;
  if (intersections.length > 0) {
    const hit = intersections[0];
    cameraRayEnd.copy(hit.point);
    const resolvedLabel = resolveRaycastLabel(hit);
    if (resolvedLabel) {
      voxelLabel = resolvedLabel;
      activeVoxelHit = hit;
    }
  } else {
    cameraRayEnd.copy(cameraRayOrigin).addScaledVector(cameraRayDirection, CAMERA_RAYCAST_RANGE);
  }

  currentRaycastState.hit = activeVoxelHit;
  currentRaycastState.voxelEditionMode = activeVoxelHit !== null;

  if (activeVoxelHit && getVoxelBoxFromRaycastHit(activeVoxelHit, voxelHighlightBox)) {
    voxelHighlightBox.getCenter(voxelHighlightMesh.position);
    voxelHighlightMesh.visible = true;
  } else {
    voxelHighlightMesh.visible = false;
  }

  const linePosition = cameraRayLineGeometry.attributes.position;
  linePosition.setXYZ(0, cameraRayOrigin.x, cameraRayOrigin.y, cameraRayOrigin.z);
  linePosition.setXYZ(1, cameraRayEnd.x, cameraRayEnd.y, cameraRayEnd.z);
  linePosition.needsUpdate = true;
  cameraRayLineGeometry.computeBoundingSphere();
  cameraRayTip.position.copy(cameraRayEnd);

  if (voxelReadout) {
    voxelReadout.textContent = `Voxel: ${voxelLabel}`;
  }
}

function updateDesktopLook() {
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

  if (controls.isLocked) {
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
    if (controls.isLocked) {
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
    if (horizontalMove.lengthSq() > 0.00001) {
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
  if (isMoving) {
    playerMoveFacing.copy(horizontalMove);
    syncPlayerFacing(playerMoveFacing);
  }
  animatePlayerBody(deltaTime, isMoving);
  syncCameraToPlayerView(deltaTime);
}

function updateMiniMap() {
  miniMapCamera.position.set(playerEye.x, playerEye.y + MINI_MAP_HEIGHT, playerEye.z);
  miniMapCamera.lookAt(playerEye.x, GROUND_Y, playerEye.z);

  camera.getWorldDirection(miniMapFacing);
  miniMapFacing.y = 0;

  if (miniMapFacing.lengthSq() > 0.0001) {
    miniMapFacing.normalize();
    const markerAngle = Math.atan2(miniMapFacing.x, -miniMapFacing.z);
    miniMapPlayerMarker.style.transform = `translate(-50%, -50%) rotate(${markerAngle}rad)`;
  }

  syncEntityMiniMapMarkers();
  const width = miniMap.clientWidth || 200;
  const height = miniMap.clientHeight || 200;

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const marker = entityMiniMapMarkers.get(entity);
    if (!marker) continue;

    miniMapProjectedPos.set(entity.position.x, GROUND_Y, entity.position.z).project(miniMapCamera);
    const insideView =
      miniMapProjectedPos.z >= -1 &&
      miniMapProjectedPos.z <= 1 &&
      Math.abs(miniMapProjectedPos.x) <= 1 &&
      Math.abs(miniMapProjectedPos.y) <= 1;
    marker.style.display = insideView ? 'block' : 'none';
    if (!insideView) continue;

    const x = (miniMapProjectedPos.x * 0.5 + 0.5) * width;
    const y = (-miniMapProjectedPos.y * 0.5 + 0.5) * height;
    let markerAngle = 0;
    if (entity.direction && entity.direction.lengthSq() > 0.0001) {
      markerAngle = Math.atan2(entity.direction.x, -entity.direction.z);
    }
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.transform = `translate(-50%, -50%) rotate(${markerAngle}rad)`;
  }

  miniMapRenderer.render(scene, miniMapCamera);
}

// --------------------
// RESIZE
// --------------------
window.addEventListener('resize', () => {
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;

  syncAppHeight();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  miniMapRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (characterPreviewRenderer) {
    characterPreviewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    updateCharacterPreviewSize();
  }
  updateModeFromViewport();
  updateSceneViewSize();
  updateMiniMapSize();
  updatePlayerHealthUI();
});

let leftTouchId = null;
let rightTouchId = null;

const leftJoy = document.querySelector('#menuInferiorLeft .joystick');
const leftPad = leftJoy.querySelector('.pad');

leftJoy.addEventListener('touchstart', e => {
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

function queueJump() {
  playerState.jumpQueued = true;
}

buttonUp.addEventListener('touchstart', queueJump);

if (buttonLeft0) {
  buttonLeft0.addEventListener('touchstart', event => {
    if (!mobileMode) return;
    event.preventDefault();
    handleChatAction();
  }, { passive: false });
  buttonLeft0.addEventListener('click', event => {
    if (!mobileMode) return;
    event.preventDefault();
    handleChatAction();
  });
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

function setMobileSprintState(active) {
  if (!buttonLeft1) return;
  buttonLeft1.classList.toggle('is-active', active);
}

function startMobileLeftClick(event) {
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
  if (!mobileMode) return;
  if (event) event.preventDefault();
  triggerActionForMouseButton(2, { allowMobile: true });
}

function toggleMobileSprint(event) {
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
  buttonRight1.addEventListener('click', event => {
    if (!mobileMode) return;
    event.preventDefault();
    triggerActionForMouseButton(2, { allowMobile: true });
  });
}

if (buttonRight3) {
  buttonRight3.addEventListener('touchstart', event => {
    if (!mobileMode) return;
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

  const sameTabOpen = isMenuCentralVisible() && activeMenuCentralTab === tabName;
  if (sameTabOpen) {
    hideMenuCentral();
    controls.lock();
    return;
  }

  setMenuCentralTab(tabName);

  if (controls.isLocked) {
    controls.unlock();
    return;
  }
  showMenuCentral(activeMenuCentralTab);
}

document.addEventListener('mousedown', handleDesktopAttack);
document.addEventListener('contextmenu', event => event.preventDefault());

document.addEventListener('keydown', e => {
  if (e.code === 'Escape' && chatBoxInput && !chatBoxInput.hidden) {
    e.preventDefault();
    e.stopPropagation();
    hideChatInput();
    return;
  }

  if (e.code === 'Enter') {
    if (e.repeat) return;
    if (e.target === chatBoxInput || !isTypingTarget(e.target)) {
      e.preventDefault();
      handleChatAction();
      return;
    }
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
    selectHotbarSlot(slotIndex);
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

updateMiniMapSize();
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

  const { x, y, z } = playerEye;
  consola.textContent = 'FPS: ' + fps + ` XYZ: ${x.toFixed(2)} | ${y.toFixed(2)} | ${z.toFixed(2)}`;
}

// --------------------
// ANIMATION LOOP
// --------------------
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  if (!mobileMode && controls.isLocked && isMenuCentralVisible()) {
    hideMenuCentral();
  }

  if (mobileMode) {
    if (rightTouchId !== null) {
      yaw -= lookDx * sensitivity;
      pitch -= lookDy * sensitivity;
      pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    }

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  } else {
    updateDesktopLook();
  }

  updatePlayer(delta);
  updateRightPunch(delta);
  updateLeftPunch(delta);
  updatePunchHitboxes(delta);
  updateMobileShooting(delta);
  updateEntities(delta);
  updateChaserMeleeAttacks(delta);
  updateChaserPunchHitboxes(delta);
  updateProjectilesAndExplosions(delta);
  updateVoxelRaycast();
  checkFPS(delta);

  if (
    characterPreviewRenderer
    && characterPreviewScene
    && characterPreviewCamera
    && characterPreviewModel
    && isMenuCentralVisible()
    && activeMenuCentralTab === 'character'
  ) {
    updateCharacterPreviewSize();
    characterPreviewIdleCycle += delta * 0.65;
    applyHumanoidIdleAnimation(characterPreviewModel.joints, characterPreviewIdleCycle, 0.9);
    characterPreviewRenderer.render(characterPreviewScene, characterPreviewCamera);
  }

  renderer.render(scene, camera);
  updateMiniMap();
});
