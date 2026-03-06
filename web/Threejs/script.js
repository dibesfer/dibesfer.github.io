import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let mobileMode = false;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

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
  0.1,
  3000
);
const playerEye = new THREE.Vector3(5, 3, 5);
camera.position.copy(playerEye);

// --------------------
// RENDERER
// --------------------
const consola = document.getElementById('consola');
const miniMap = document.getElementById('miniMap');
const menuCentral = document.getElementById('menuCentral');
const menuInferior = document.getElementById('menuInferior');
const buttonUp = document.getElementById('buttonUp');
const buttonDown = document.getElementById('buttonDown');

const miniMapPlayerMarker = document.createElement('div');
miniMapPlayerMarker.id = 'miniMapPlayerMarker';
miniMap.appendChild(miniMapPlayerMarker);

function checkForJoysticks() {
  if (windowWidth < 600 && menuInferior.classList.contains('invisible')) {
    console.log('Joysticks Activated');
    menuCentral.classList.add('invisible');
    menuInferior.classList.remove('invisible');
    menuInferior.classList.add('flex');
    mobileMode = true;
    document.removeEventListener('click', controlLocker);
    return true;
  }

  if (windowWidth > 600) {
    console.log('Joysticks Deactivated');
    menuCentral.classList.remove('invisible');
    menuInferior.classList.add('invisible');
    menuInferior.classList.remove('flex');
    mobileMode = false;
    document.addEventListener('click', controlLocker);
    return false;
  }

  return mobileMode;
}

checkForJoysticks();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

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

const miniMapRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
miniMapRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
miniMapRenderer.shadowMap.enabled = false;
miniMap.appendChild(miniMapRenderer.domElement);

// --------------------
// CONTROLS
// --------------------
const controls = new PointerLockControls(camera, document.body);

function controlLocker() {
  controls.lock();
  controls.addEventListener('unlock', () => {
    menuCentral.classList.remove('invisible');
  });
  menuCentral.classList.add('invisible');
}

const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

const moveSpeed = 10;
const gravity = 30;
const jumpSpeed = 11;
const maxJumps = 2;

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
const CITY_MIN = -100;
const CITY_MAX = 100;
const BUILDING_FOOTPRINT = 6;
const CITY_MARGIN = 15;
const CITY_OUTER_LIMIT = CITY_MAX + BUILDING_FOOTPRINT * 0.5 + CITY_MARGIN;
const CITY_GROUND_SIZE = CITY_OUTER_LIMIT * 2;
const SHADOW_RANGE = CITY_OUTER_LIMIT + 20;
const MINI_MAP_VIEW_SIZE = 90;
const MINI_MAP_HEIGHT = 130;

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

const groundGeo = new THREE.PlaneGeometry(CITY_GROUND_SIZE, CITY_GROUND_SIZE);
const groundTileRepeat = CITY_GROUND_SIZE / 12;
groundTexture.repeat.set(groundTileRepeat, groundTileRepeat);
const groundMat = new THREE.MeshStandardMaterial({
  map: groundTexture,
  color: 0xffffff,
  roughness: 1.0,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const GROUND_Y = 0;

// --------------------
// PLAYER BODY + COLLIDER
// --------------------
const PLAYER_HEIGHT = 1.8;
const PLAYER_HALF_WIDTH = 0.35;
const EYE_HEIGHT = 1.5;

const playerState = {
  velocity: new THREE.Vector3(0, 0, 0),
  onGround: false,
  jumpQueued: false,
  jumpsUsed: 0,
};

const playerCollider = new THREE.Box3();
const playerFoot = new THREE.Vector3();
const previousFoot = new THREE.Vector3();
const testBox = new THREE.Box3();

const playerBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.28, 0.8, 6, 10),
  new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.1, roughness: 0.9 })
);
playerBody.castShadow = true;
scene.add(playerBody);

function updatePlayerCollider(eyePosition) {
  const min = new THREE.Vector3(
    eyePosition.x - PLAYER_HALF_WIDTH,
    eyePosition.y - EYE_HEIGHT,
    eyePosition.z - PLAYER_HALF_WIDTH
  );

  const max = new THREE.Vector3(
    eyePosition.x + PLAYER_HALF_WIDTH,
    min.y + PLAYER_HEIGHT,
    eyePosition.z + PLAYER_HALF_WIDTH
  );

  playerCollider.min.copy(min);
  playerCollider.max.copy(max);
  playerFoot.set(eyePosition.x, min.y, eyePosition.z);
}

function syncPlayerBody() {
  playerBody.position.set(
    playerEye.x,
    playerCollider.min.y + PLAYER_HEIGHT * 0.5,
    playerEye.z
  );
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
  thirdPersonDistance = THREE.MathUtils.clamp(nextDistance, 0, 8);
  event.preventDefault();
}

window.addEventListener('wheel', handleDesktopWheelThirdPerson, { passive: false });

updatePlayerCollider(playerEye);
syncPlayerBody();
syncCameraToPlayerView();

// --------------------
// NAME GENERATOR
// --------------------
const nameParts1 = ['Neo', 'Cyber', 'Quantum', 'Nova', 'Hyper', 'Astra', 'Meta'];
const nameParts2 = ['Corp', 'Tower', 'Labs', 'Systems', 'Group', 'Industries', 'Center'];

function randomName() {
  return (
    nameParts1[Math.floor(Math.random() * nameParts1.length)] +
    ' ' +
    nameParts2[Math.floor(Math.random() * nameParts2.length)]
  );
}

// --------------------
// WALL SIGN FUNCTION
// --------------------
function createWallSign(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = 512;
  canvas.height = 128;

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'white';
  ctx.font = '42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const geometry = new THREE.PlaneGeometry(3, 0.8);

  return new THREE.Mesh(geometry, material);
}

// --------------------
// CITY GENERATION + COLLIDERS
// --------------------
const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
const buildingColliders = [];
const spacing = 10;
const EMPTY_PLOT_CHANCE = 0.18;

for (let x = CITY_MIN; x <= CITY_MAX; x += spacing) {
  for (let z = CITY_MIN; z <= CITY_MAX; z += spacing) {
    if (Math.random() < EMPTY_PLOT_CHANCE) {
      continue;
    }

    let height = 4 + Math.random() * 10; // normal buildings: 4..14

    if (Math.random() < 0.04) {          // 4% chance of skyscraper
      height = 25 + Math.random() * 35;  // skyscrapers: 25..60
    }
    const tintHue = Math.random();
    const tintSat = 0.25 + Math.random() * 0.45;
    const tintLight = 0.42 + Math.random() * 0.28;
    const buildingTint = new THREE.Color().setHSL(tintHue, tintSat, tintLight);
    const buildingTexture = brickTexture.clone();
    buildingTexture.needsUpdate = true;
    buildingTexture.repeat.set(
      BUILDING_FOOTPRINT / BRICK_TILE_SIZE,
      height / BRICK_TILE_SIZE
    );

    const buildingMat = new THREE.MeshStandardMaterial({
      map: buildingTexture,
      color: buildingTint,
      roughness: 0.88,
      metalness: 0.08,
    });

    const building = new THREE.Mesh(buildingGeo, buildingMat);
    building.scale.set(BUILDING_FOOTPRINT, height, BUILDING_FOOTPRINT);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);

    const collider = new THREE.Box3().setFromObject(building);
    buildingColliders.push(collider);

    const sign = createWallSign(randomName());
    const halfSize = BUILDING_FOOTPRINT * 0.5;
    const face = Math.floor(Math.random() * 4);

    switch (face) {
      case 0:
        sign.position.set(x, 2, z + halfSize + 0.01);
        break;
      case 1:
        sign.position.set(x, 2, z - halfSize - 0.01);
        sign.rotation.y = Math.PI;
        break;
      case 2:
        sign.position.set(x + halfSize + 0.01, 2, z);
        sign.rotation.y = -Math.PI / 2;
        break;
      case 3:
        sign.position.set(x - halfSize - 0.01, 2, z);
        sign.rotation.y = Math.PI / 2;
        break;
    }

    scene.add(sign);
  }
}

const wallHeight = 6;
const wallThickness = 0.8;
function addCityWall(width, depth, x, z) {
  const wallTexture = brickTexture.clone();
  wallTexture.needsUpdate = true;
  wallTexture.repeat.set(
    Math.max(width, depth) / BRICK_TILE_SIZE,
    wallHeight / BRICK_TILE_SIZE
  );
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTexture,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.05,
  });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), wallMat);
  wall.position.set(x, wallHeight * 0.5, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);

  const wallCollider = new THREE.Box3().setFromObject(wall);
  buildingColliders.push(wallCollider);
}

addCityWall(CITY_GROUND_SIZE, wallThickness, 0, CITY_OUTER_LIMIT);
addCityWall(CITY_GROUND_SIZE, wallThickness, 0, -CITY_OUTER_LIMIT);
addCityWall(wallThickness, CITY_GROUND_SIZE, CITY_OUTER_LIMIT, 0);
addCityWall(wallThickness, CITY_GROUND_SIZE, -CITY_OUTER_LIMIT, 0);

const PROJECTILE_RADIUS = 0.14;
const PROJECTILE_SPEED = 42;
const PROJECTILE_LIFETIME = 3;
const projectileGeo = new THREE.SphereGeometry(PROJECTILE_RADIUS, 16, 16);
const projectileMat = new THREE.MeshStandardMaterial({
  color: 0xff2f2f,
  emissive: 0xaa1111,
  emissiveIntensity: 1.2,
  metalness: 0.2,
  roughness: 0.25,
});
const projectiles = [];

const EXPLOSION_PARTICLE_COUNT = 18;
const EXPLOSION_LIFETIME = 0.55;
const explosionGeo = new THREE.SphereGeometry(0.07, 8, 8);
const explosions = [];

const projectileSpawnPos = new THREE.Vector3();
const projectileDirection = new THREE.Vector3();
const projectileSphere = new THREE.Sphere();
let audioContext = null;

function ensureAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  return audioContext;
}

function playExplosionSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.25);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1300, now);
  filter.frequency.exponentialRampToValueAtTime(280, now + 0.25);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.3);
}

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
  playExplosionSound();
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

function shootDesktopProjectile(event) {
  if (event.button !== 0) return;
  if (mobileMode || !controls.isLocked) return;

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

function updateProjectilesAndExplosions(deltaTime) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    projectile.age += deltaTime;
    projectile.mesh.position.addScaledVector(projectile.velocity, deltaTime);

    const expired = projectile.age >= projectile.life;
    const hit = projectileHitsEnvironment(projectile.mesh.position, projectile.radius);

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
    playerEye.y = hit.max.y + EYE_HEIGHT +0.01;
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

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const miniMapFacing = new THREE.Vector3();

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

  const horizontalMove = new THREE.Vector3();
  horizontalMove.addScaledVector(tmpForward, inputForward * currentMoveSpeed * deltaTime);
  horizontalMove.addScaledVector(tmpRight, inputRight * currentMoveSpeed * deltaTime);

  tryMoveAxis('x', horizontalMove.x);
  tryMoveAxis('z', horizontalMove.z);

  playerState.velocity.y -= gravity * deltaTime;

  if (playerState.jumpQueued && playerState.jumpsUsed < maxJumps) {
    playerState.velocity.y = jumpSpeed;
    playerState.onGround = false;
    playerState.jumpsUsed += 1;
  }

  playerState.jumpQueued = false;

  resolveVertical(playerState.velocity.y * deltaTime);
  resolveGround();

  if (playerEye.y > GROUND_Y + EYE_HEIGHT + 0.001) {
    playerState.onGround = false;
  }

  syncPlayerBody();
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

  checkForJoysticks();

  renderer.setSize(window.innerWidth, window.innerHeight);
  updateMiniMapSize();
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

      const max = 50;
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

      const max = 50;
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

document.addEventListener('mousedown', shootDesktopProjectile);

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

function checkFPS(delta) {
  accTime += delta;
  frames++;

  if (accTime >= 1) {
    fps = Math.round(frames / accTime);
    frames = 0;
    accTime = 0;
  }

  const { x, y, z } = playerEye;
  consola.textContent = 'FPS: ' + fps + ` X: ${x.toFixed(2)} | Y: ${y.toFixed(2)} | Z: ${z.toFixed(2)}`;
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
  updateProjectilesAndExplosions(delta);
  checkFPS(delta);

  renderer.render(scene, camera);
  updateMiniMap();
});
