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
camera.position.set(5, 3, 5);

// --------------------
// RENDERER
// --------------------
const consola = document.getElementById('consola');
const menuCentral = document.getElementById('menuCentral');
const menuInferior = document.getElementById('menuInferior');
const buttonUp = document.getElementById('buttonUp');
const buttonDown = document.getElementById('buttonDown');

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
document.body.appendChild(renderer.domElement);

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

// --------------------
// LIGHTS
// --------------------
const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.5);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(100, 200, 100);
dir.castShadow = true;
scene.add(dir);

// --------------------
// GROUND
// --------------------
const groundGeo = new THREE.PlaneGeometry(1000, 1000);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
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
const EYE_HEIGHT = 1.62;

const playerState = {
  velocity: new THREE.Vector3(0, 0, 0),
  onGround: false,
  jumpQueued: false,
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
    camera.position.x,
    playerCollider.min.y + PLAYER_HEIGHT * 0.5,
    camera.position.z
  );
}

updatePlayerCollider(camera.position);
syncPlayerBody();

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

for (let x = -100; x <= 100; x += spacing) {
  for (let z = -100; z <= 100; z += spacing) {
    const height = Math.random() * 25 + 5;

    const buildingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(Math.random(), Math.random(), Math.random())
    });

    const building = new THREE.Mesh(buildingGeo, buildingMat);
    building.scale.set(6, height, 6);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);

    const collider = new THREE.Box3().setFromObject(building);
    buildingColliders.push(collider);

    const sign = createWallSign(randomName());
    const halfSize = 3;
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

function collidesWithBuildings(box) {
  for (let i = 0; i < buildingColliders.length; i++) {
    if (box.intersectsBox(buildingColliders[i])) return buildingColliders[i];
  }
  return null;
}

const axisTestPos = new THREE.Vector3();

function tryMoveAxis(axis, delta) {
  if (delta === 0) return;

  axisTestPos.copy(camera.position);
  axisTestPos[axis] += delta;

  updatePlayerCollider(axisTestPos);
  testBox.copy(playerCollider);

  if (!collidesWithBuildings(testBox)) {
    camera.position[axis] += delta;
    updatePlayerCollider(camera.position);
  }
}

function resolveVertical(deltaY) {
  if (deltaY === 0) {
    return;
  }

  axisTestPos.copy(camera.position);
  axisTestPos.y += deltaY;

  updatePlayerCollider(axisTestPos);
  testBox.copy(playerCollider);

  const hit = collidesWithBuildings(testBox);

  if (!hit) {
    camera.position.y += deltaY;
    updatePlayerCollider(camera.position);
    return;
  }

  if (deltaY < 0 && playerCollider.max.y >= hit.max.y && previousFoot.y >= hit.max.y - 0.02) {
    camera.position.y = hit.max.y + EYE_HEIGHT;
    playerState.velocity.y = 0;
    playerState.onGround = true;
    updatePlayerCollider(camera.position);
    return;
  }

  if (deltaY > 0 && playerCollider.min.y <= hit.min.y) {
    camera.position.y = hit.min.y - (PLAYER_HEIGHT - EYE_HEIGHT) - 0.001;
    playerState.velocity.y = 0;
    updatePlayerCollider(camera.position);
    return;
  }

  playerState.velocity.y = 0;
  updatePlayerCollider(camera.position);
}

function resolveGround() {
  const minEyeY = GROUND_Y + EYE_HEIGHT;

  if (camera.position.y <= minEyeY) {
    camera.position.y = minEyeY;
    playerState.velocity.y = 0;
    playerState.onGround = true;
    updatePlayerCollider(camera.position);
  }
}

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

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

  const horizontalMove = new THREE.Vector3();
  horizontalMove.addScaledVector(tmpForward, inputForward * moveSpeed * deltaTime);
  horizontalMove.addScaledVector(tmpRight, inputRight * moveSpeed * deltaTime);

  tryMoveAxis('x', horizontalMove.x);
  tryMoveAxis('z', horizontalMove.z);

  playerState.velocity.y -= gravity * deltaTime;

  if (playerState.jumpQueued && playerState.onGround) {
    playerState.velocity.y = jumpSpeed;
    playerState.onGround = false;
  }

  playerState.jumpQueued = false;

  resolveVertical(playerState.velocity.y * deltaTime);
  resolveGround();

  if (camera.position.y > GROUND_Y + EYE_HEIGHT + 0.001) {
    playerState.onGround = false;
  }

  syncPlayerBody();
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

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    playerState.jumpQueued = true;
  }
});

const clock = new THREE.Clock();
let frames = 0;
let accTime = 0;
let fps = 0;

function checkFPS(delta) {
  accTime += delta;
  frames++;

  if (accTime >= 1) {
    fps = Math.round(frames / accTime);
    frames = 0;
    accTime = 0;
  }

  const { x, y, z } = camera.position;
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
  checkFPS(delta);

  renderer.render(scene, camera);
});
