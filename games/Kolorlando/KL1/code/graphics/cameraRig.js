import * as THREE from 'three';

const DEFAULT_THIRD_PERSON_MAX_DISTANCE = 8;
const DEFAULT_LEGO_LOL_MIN_THIRD_PERSON_DISTANCE = 3;
const DEFAULT_THIRD_PERSON_DISTANCE_INPUT_SCALE = 0.01;
const THIRD_PERSON_DISTANCE_LERP = 8;
const THIRD_PERSON_SHOULDER_LERP = 8;
const THIRD_PERSON_MAX_SHOULDER_OFFSET = 0.5;
const LEGO_LOL_FIXED_ORBIT_ANGLE = THREE.MathUtils.degToRad(35);
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

export function createCameraRigController({
  camera = null,
  playerEye = null,
  playerBody = null,
  firstPersonArmsRig = null,
  sceneView = null,
  playerHeight = 1.8,
  thirdPersonMaxDistance = DEFAULT_THIRD_PERSON_MAX_DISTANCE,
  legoLolMinThirdPersonDistance = DEFAULT_LEGO_LOL_MIN_THIRD_PERSON_DISTANCE,
  distanceInputScale = DEFAULT_THIRD_PERSON_DISTANCE_INPUT_SCALE,
  getMobileMode = () => false,
  isMenuCentralVisible = () => false,
  isLegoLolCameraMode = () => false,
  usesCenteredThirdPersonCamera = () => false,
  isScreenDragCameraActive = () => false,
  isTypingTarget = () => false,
  isChatInputOpen = () => false,
  isPointerLocked = () => false,
  syncLocalPlayerShadowCasters = () => {},
} = {}) {
  const thirdPersonOffsetDir = new THREE.Vector3();
  const thirdPersonRightDir = new THREE.Vector3();
  const thirdPersonTargetPos = new THREE.Vector3();
  const thirdPersonWorldUp = new THREE.Vector3(0, 1, 0);
  const legoLolFocusPos = new THREE.Vector3();
  let thirdPersonDistance = 0;
  let currentThirdPersonDistance = 0;
  let currentShoulderOffset = 0;
  let pinchZoomTouchIds = [];
  let pinchStartDistance = 0;
  let pinchStartThirdPersonDistance = 0;

  function getMinThirdPersonDistance() {
    return isLegoLolCameraMode() ? legoLolMinThirdPersonDistance : 0;
  }

  function setThirdPersonDistance(nextDistance) {
    thirdPersonDistance = THREE.MathUtils.clamp(
      nextDistance,
      getMinThirdPersonDistance(),
      thirdPersonMaxDistance
    );
  }

  function getCurrentThirdPersonDistance() {
    return currentThirdPersonDistance;
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

  function isTouchInsideSceneView(touch) {
    if (!touch || !sceneView || !sceneView.isConnected) return false;

    const rect = sceneView.getBoundingClientRect();
    return (
      touch.clientX >= rect.left
      && touch.clientX <= rect.right
      && touch.clientY >= rect.top
      && touch.clientY <= rect.bottom
    );
  }

  function resolveScenePinchTouches(touchList) {
    const sceneTouches = [];

    for (let i = 0; i < touchList.length; i += 1) {
      const touch = touchList[i];
      if (!isTouchInsideSceneView(touch) || shouldBlockMobilePinchTouch(touch)) continue;
      sceneTouches.push(touch);
      if (sceneTouches.length === 2) break;
    }

    return sceneTouches;
  }

  function handleMobilePinchStart(event) {
    if (!getMobileMode() || isMenuCentralVisible()) return;

    const [firstTouch, secondTouch] = resolveScenePinchTouches(event.touches);
    if (!firstTouch || !secondTouch) return;

    pinchZoomTouchIds = [firstTouch.identifier, secondTouch.identifier];
    pinchStartDistance = getTouchDistance(firstTouch, secondTouch);
    pinchStartThirdPersonDistance = thirdPersonDistance;
    event.preventDefault();
  }

  function handleMobilePinchMove(event) {
    if (!getMobileMode() || isMenuCentralVisible() || pinchZoomTouchIds.length !== 2) return;

    const firstTouch = findTouchByIdentifier(event.touches, pinchZoomTouchIds[0]);
    const secondTouch = findTouchByIdentifier(event.touches, pinchZoomTouchIds[1]);
    if (!firstTouch || !secondTouch) return;
    if (!isTouchInsideSceneView(firstTouch) || !isTouchInsideSceneView(secondTouch)) {
      resetMobilePinchZoom();
      return;
    }

    const pinchDistance = getTouchDistance(firstTouch, secondTouch);
    const pinchDelta = pinchStartDistance - pinchDistance;
    setThirdPersonDistance(pinchStartThirdPersonDistance + pinchDelta * distanceInputScale);
    event.preventDefault();
  }

  function handleMobilePinchEnd(event) {
    if (!getMobileMode() || pinchZoomTouchIds.length === 0) return;

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
    const targetShoulderOffset = thirdPersonDistance > 0.001 && !usesCenteredThirdPersonCamera()
      ? THIRD_PERSON_MAX_SHOULDER_OFFSET
      : 0;
    currentShoulderOffset = THREE.MathUtils.lerp(currentShoulderOffset, targetShoulderOffset, tShoulder);

    camera.position.copy(playerEye);
    playerBody.visible = currentThirdPersonDistance > 0.001;
    firstPersonArmsRig.root.visible = currentThirdPersonDistance <= 0.001 && !isLegoLolCameraMode();
    syncLocalPlayerShadowCasters();

    if (isLegoLolCameraMode() && currentThirdPersonDistance > 0.001) {
      const horizontalDistance = currentThirdPersonDistance * Math.cos(LEGO_LOL_FIXED_ORBIT_ANGLE);
      const verticalDistance = currentThirdPersonDistance * Math.sin(LEGO_LOL_FIXED_ORBIT_ANGLE);
      thirdPersonTargetPos.set(
        playerEye.x,
        playerEye.y + verticalDistance,
        playerEye.z + horizontalDistance
      );
      camera.position.copy(thirdPersonTargetPos);
      legoLolFocusPos.set(playerEye.x, playerBody.position.y + playerHeight * 0.7, playerEye.z);
      camera.lookAt(legoLolFocusPos);
      return;
    }

    if (currentThirdPersonDistance > 0.001) {
      camera.getWorldDirection(thirdPersonOffsetDir);
      thirdPersonRightDir.crossVectors(thirdPersonOffsetDir, thirdPersonWorldUp).normalize();
      thirdPersonTargetPos.copy(playerEye);
      thirdPersonTargetPos.addScaledVector(thirdPersonOffsetDir, -currentThirdPersonDistance);
      thirdPersonTargetPos.addScaledVector(thirdPersonRightDir, currentShoulderOffset);
      camera.position.copy(thirdPersonTargetPos);
    }
  }

  function handleDesktopWheelThirdPerson(event) {
    if (
      getMobileMode()
      || isMenuCentralVisible()
      || isChatInputOpen()
      || isTypingTarget(event.target)
      || (!isPointerLocked() && !isScreenDragCameraActive() && !isLegoLolCameraMode())
    ) return;

    setThirdPersonDistance(thirdPersonDistance + event.deltaY * distanceInputScale);
    event.preventDefault();
  }

  return {
    getCurrentThirdPersonDistance,
    handleDesktopWheelThirdPerson,
    handleMobilePinchEnd,
    handleMobilePinchMove,
    handleMobilePinchStart,
    setThirdPersonDistance,
    syncCameraToPlayerView,
  };
}
