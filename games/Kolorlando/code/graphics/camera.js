export const CAMERA_MODE_SKYRIM = 'skyrim';
export const CAMERA_MODE_WOW = 'wow';
export const CAMERA_MODE_LEGO_LOL = 'legoLol';

export function createCameraModeController(options) {
  const cameraModeInputs = options.cameraModeInputs || [];
  const cameraModeWowInput = options.cameraModeWowInput;
  const cameraModeLegoLolInput = options.cameraModeLegoLolInput;
  const getIsMobile = options.getIsMobile || function () { return false; };
  const isPointerLocked = options.isPointerLocked || function () { return false; };
  const onSyncDesktopLookAngles = options.onSyncDesktopLookAngles;
  const onDeactivateScreenDrag = options.onDeactivateScreenDrag;
  const onRequestUnlock = options.onRequestUnlock;
  const storageKey = options.storageKey || 'kolorlando.cameraMode';
  let wowCameraScreenActive = false;
  let currentCameraMode = CAMERA_MODE_SKYRIM;

  try {
    const savedCameraMode = window.localStorage.getItem(storageKey);
    if (
      savedCameraMode === CAMERA_MODE_SKYRIM
      || savedCameraMode === CAMERA_MODE_WOW
      || savedCameraMode === CAMERA_MODE_LEGO_LOL
    ) {
      currentCameraMode = savedCameraMode;
    }
  } catch (error) {
    currentCameraMode = CAMERA_MODE_SKYRIM;
  }

  function syncInputs() {
    for (let i = 0; i < cameraModeInputs.length; i += 1) {
      cameraModeInputs[i].checked = cameraModeInputs[i].value === currentCameraMode;
    }
  }

  function persistCameraModePreference() {
    try {
      window.localStorage.setItem(storageKey, currentCameraMode);
    } catch (error) {
      // Ignore persistence failures.
    }
  }

  function isLegoLolCameraMode() {
    return currentCameraMode === CAMERA_MODE_LEGO_LOL;
  }

  function usesCenteredThirdPersonCamera() {
    return currentCameraMode === CAMERA_MODE_WOW || currentCameraMode === CAMERA_MODE_LEGO_LOL;
  }

  function isScreenDragCameraMode() {
    return !getIsMobile() && currentCameraMode === CAMERA_MODE_WOW;
  }

  function isScreenDragCameraActive() {
    return isScreenDragCameraMode() && wowCameraScreenActive;
  }

  function shouldUsePointerLock() {
    return !getIsMobile() && currentCameraMode === CAMERA_MODE_SKYRIM;
  }

  function setWowCameraScreenActive(nextActive) {
    wowCameraScreenActive = Boolean(nextActive) && isScreenDragCameraMode();
    if (wowCameraScreenActive) {
      if (typeof onSyncDesktopLookAngles === 'function') {
        onSyncDesktopLookAngles();
      }
      return;
    }
    if (typeof onDeactivateScreenDrag === 'function') {
      onDeactivateScreenDrag();
    }
  }

  function applyCameraMode() {
    document.body.dataset.cameraMode = currentCameraMode;
    persistCameraModePreference();
    setWowCameraScreenActive(false);
    if (isScreenDragCameraMode() && isPointerLocked() && typeof onRequestUnlock === 'function') {
      onRequestUnlock();
    }
  }

  function setCurrentCameraMode(nextCameraMode) {
    if (!nextCameraMode) return;
    if (nextCameraMode === CAMERA_MODE_WOW && getIsMobile()) {
      nextCameraMode = CAMERA_MODE_SKYRIM;
    }
    currentCameraMode = nextCameraMode;
    syncInputs();
    applyCameraMode();
  }

  function syncCameraModeAvailability() {
    const wowAvailable = !getIsMobile();
    if (cameraModeWowInput) {
      cameraModeWowInput.disabled = !wowAvailable;
    }
    if (cameraModeLegoLolInput) {
      cameraModeLegoLolInput.disabled = false;
    }
    if (!wowAvailable && currentCameraMode === CAMERA_MODE_WOW) {
      setCurrentCameraMode(CAMERA_MODE_SKYRIM);
      return;
    }
    applyCameraMode();
  }

  for (let i = 0; i < cameraModeInputs.length; i += 1) {
    cameraModeInputs[i].addEventListener('change', function () {
      if (!cameraModeInputs[i].checked || cameraModeInputs[i].disabled) return;
      setCurrentCameraMode(cameraModeInputs[i].value);
    });
  }

  syncInputs();

  return {
    getCurrentCameraMode: function () {
      return currentCameraMode;
    },
    isLegoLolCameraMode: isLegoLolCameraMode,
    isScreenDragCameraActive: isScreenDragCameraActive,
    isScreenDragCameraMode: isScreenDragCameraMode,
    setCurrentCameraMode: setCurrentCameraMode,
    setWowCameraScreenActive: setWowCameraScreenActive,
    shouldUsePointerLock: shouldUsePointerLock,
    syncCameraModeAvailability: syncCameraModeAvailability,
    usesCenteredThirdPersonCamera: usesCenteredThirdPersonCamera,
  };
}
