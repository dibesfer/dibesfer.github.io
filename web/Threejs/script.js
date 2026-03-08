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
const JOYSTICK_MAX_OFFSET = 50;
const SUPPORT_EPSILON = 0.03;

// --------------------
// SCENE
// --------------------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);

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
const menuInferior = document.getElementById('menuInferior');
const buttonUp = document.getElementById('buttonUp');
const buttonDown = document.getElementById('buttonDown');
const buttonShoot = document.getElementById('buttonShoot');
const playerHealthFill = document.getElementById('playerHealthFill');
const playerHealthText = document.getElementById('playerHealthText');
let mobileShootPressed = false;
const gameAudio = createGameAudio();

const miniMapPlayerMarker = document.createElement('div');
miniMapPlayerMarker.id = 'miniMapPlayerMarker';
miniMap.appendChild(miniMapPlayerMarker);
const entityMiniMapMarkers = new Map();

function resolveMode() {
  const hasTouchScreen = (navigator.maxTouchPoints ?? 0) > 1;
  const isCoarsePointer = touchQuery.matches;
  const touchMobileViewport = (hasTouchScreen || isCoarsePointer) && Math.max(windowWidth, windowHeight) <= 1400;
  const isMobile = windowWidth < MOBILE_BREAKPOINT || touchMobileViewport;
  if (!isMobile) return MODE_DESKTOP;
  return windowWidth > windowHeight ? MODE_MOBILE_LANDSCAPE : MODE_MOBILE_PORTRAIT;
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
    menuCentral.classList.add('invisible');
    menuInferior.classList.remove('invisible');
    menuInferior.classList.add('flex');
    document.removeEventListener('click', controlLocker);
    return;
  }

  if (controls.isLocked) {
    menuCentral.classList.add('invisible');
  } else {
    menuCentral.classList.remove('invisible');
  }
  menuInferior.classList.add('invisible');
  menuInferior.classList.remove('flex');
  mobileShootPressed = false;
  setShootButtonState(false);
  document.addEventListener('click', controlLocker);
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

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

sceneView.appendChild(renderer.domElement);

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
controls.addEventListener('unlock', () => {
  if (!mobileMode) {
    menuCentral.classList.remove('invisible');
  }
});

function controlLocker() {
  controls.lock();
  menuCentral.classList.add('invisible');
}

updateModeFromViewport();

const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

const moveSpeed = 10;
const gravity = 30;
const jumpSpeed = 11;
const maxJumps = 2;
const PLAYER_MAX_HEALTH = 100;

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
  if (mobileMode) return 1;
  if (!controls.isLocked) return 1;
  return keys['KeyE'] ? 2 : 1;
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
const MAP_PRESET = 'simple'; // 'simple' | 'city'
const mapBuilders = {
  simple: buildSimpleMap,
  city: buildCityMap,
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
const SHADOW_RANGE = mapData.shadowRange ?? 80;
const MINI_MAP_VIEW_SIZE = mapData.miniMapViewSize ?? 90;
const MINI_MAP_HEIGHT = mapData.miniMapHeight ?? 130;

playerEye.copy(mapData.spawnPoint);
camera.position.copy(playerEye);

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

  camera.getWorldDirection(playerFacingDir);
  playerFacingDir.y = 0;
  if (playerFacingDir.lengthSq() > 0.0001) {
    playerFacingDir.normalize();
    playerBody.rotation.y = Math.atan2(playerFacingDir.x, playerFacingDir.z);
  }
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

function syncCameraToPlayerView(deltaTime = 0) {
  const tDistance = 1 - Math.exp(-THIRD_PERSON_DISTANCE_LERP * deltaTime);
  const tShoulder = 1 - Math.exp(-THIRD_PERSON_SHOULDER_LERP * deltaTime);
  currentThirdPersonDistance = THREE.MathUtils.lerp(currentThirdPersonDistance, thirdPersonDistance, tDistance);
  const targetShoulderOffset = thirdPersonDistance > 0.001 ? THIRD_PERSON_MAX_SHOULDER_OFFSET : 0;
  currentShoulderOffset = THREE.MathUtils.lerp(currentShoulderOffset, targetShoulderOffset, tShoulder);

  camera.position.copy(playerEye);
  playerBody.visible = currentThirdPersonDistance > 0.001;
  firstPersonArmsRig.root.visible = currentThirdPersonDistance <= 0.001;

  if (!mobileMode && currentThirdPersonDistance > 0.001) {
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
  if (mobileMode) return;

  // Scroll out to move into third-person; scroll in back to first-person.
  const nextDistance = thirdPersonDistance + event.deltaY * 0.01;
  thirdPersonDistance = THREE.MathUtils.clamp(nextDistance, 0, THIRD_PERSON_MAX_DISTANCE);
  event.preventDefault();
}

window.addEventListener('wheel', handleDesktopWheelThirdPerson, { passive: false });

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

function startRightPunch() {
  if (mobileMode) return;
  if (!controls.isLocked) return;
  if (rightPunchTimer > 0) return;

  rightPunchTimer = RIGHT_PUNCH_DURATION;
  spawnPunchHitbox('right');
}

function startLeftPunch() {
  if (mobileMode) return;
  if (!controls.isLocked) return;
  if (leftPunchTimer > 0) return;

  leftPunchTimer = RIGHT_PUNCH_DURATION;
  spawnPunchHitbox('left');
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
  event.preventDefault();
  if (event.button === 0) {
    startRightPunch();
    return;
  }
  startLeftPunch();
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
  if (Math.abs(playerCollider.min.y - GROUND_Y) <= SUPPORT_EPSILON) {
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
const worldUp = new THREE.Vector3(0, 1, 0);
const miniMapFacing = new THREE.Vector3();
const miniMapProjectedPos = new THREE.Vector3();

function updateDesktopLook() {
  if (!controls.isLocked) return;
  yaw = camera.rotation.y;
  pitch = camera.rotation.x;
}

function updatePlayer(deltaTime) {
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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;

  updateModeFromViewport();

  renderer.setSize(window.innerWidth, window.innerHeight);
  updateMiniMapSize();
  updatePlayerHealthUI();
});

let leftTouchId = null;
let rightTouchId = null;

const leftJoy = document.querySelector('#menuInferiorLeft .joystick');
const leftPad = leftJoy.querySelector('.pad');

leftJoy.addEventListener('touchstart', e => {
  for (let t of e.changedTouches) {
    leftTouchId = t.identifier;
  }
});

leftJoy.addEventListener('touchend', e => {
  for (let t of e.changedTouches) {
    if (t.identifier === leftTouchId) {
      leftTouchId = null;
      moveForward = 0;
      moveRight = 0;
      leftPad.style.transform = 'translate(0px,0px)';
    }
  }
});

leftJoy.addEventListener('touchmove', e => {
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
});

const rightJoy = document.querySelector('#menuInferiorRight .joystick');
const rightPad = rightJoy.querySelector('.pad');

rightJoy.addEventListener('touchstart', e => {
  for (let t of e.changedTouches) {
    rightTouchId = t.identifier;
  }
});

rightJoy.addEventListener('touchend', e => {
  for (let t of e.changedTouches) {
    if (t.identifier === rightTouchId) {
      rightTouchId = null;
      lookDx = 0;
      lookDy = 0;
      rightPad.style.transform = 'translate(0px,0px)';
    }
  }
});

rightJoy.addEventListener('touchmove', e => {
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
});

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

function startMobileShooting(event) {
  // Shooting is reserved for a future update.
  if (!mobileMode) return;
  if (event) event.preventDefault();
  mobileShootPressed = false;
  setShootButtonState(false);
}

function stopMobileShooting(event) {
  if (event) event.preventDefault();
  mobileShootPressed = false;
  setShootButtonState(false);
}

if (buttonShoot) {
  buttonShoot.addEventListener('touchstart', startMobileShooting, { passive: false });
  buttonShoot.addEventListener('touchend', stopMobileShooting, { passive: false });
  buttonShoot.addEventListener('touchcancel', stopMobileShooting, { passive: false });
}

function updateMobileShooting(deltaTime) {
  return;
}

document.addEventListener('mousedown', handleDesktopAttack);
document.addEventListener('contextmenu', event => event.preventDefault());

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
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
  checkFPS(delta);

  renderer.render(scene, camera);
  updateMiniMap();
});
