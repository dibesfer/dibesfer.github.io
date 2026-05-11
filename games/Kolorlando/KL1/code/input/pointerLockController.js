const DEFAULT_POINTER_LOCK_RETRY_COOLDOWN_MS = 350;

export function createPointerLockController({
  input = null,
  controls = null,
  retryCooldownMs = DEFAULT_POINTER_LOCK_RETRY_COOLDOWN_MS,
  getMobileMode = () => false,
  shouldUsePointerLock = () => false,
  isMenuCentralVisible = () => false,
  isChatInputOpen = () => false,
  isTypingTarget = () => false,
  hideMenuCentral = () => {},
  showMenuCentral = () => {},
  getActiveMenuCentralTab = () => 'settings',
} = {}) {
  let openingChatFromPointerLock = false;

  function isLocked() {
    return Boolean(controls?.isLocked);
  }

  function shouldWantGameplayPointerLock() {
    return (
      !getMobileMode()
      && shouldUsePointerLock()
      && controls
      && !controls.isLocked
      && !isMenuCentralVisible()
      && !isChatInputOpen()
    );
  }

  function disarmRetry() {
    input?.disarmPointerLockRetry?.();
  }

  function armRetry() {
    if (!shouldWantGameplayPointerLock()) return;
    input?.armPointerLockRetry?.();
  }

  function request() {
    if (!shouldWantGameplayPointerLock()) {
      disarmRetry();
      return;
    }

    if (!input?.canRetryPointerLock?.()) {
      armRetry();
      return;
    }

    try {
      disarmRetry();
      const lockRequest = controls.lock();

      if (lockRequest && typeof lockRequest.catch === 'function') {
        lockRequest.catch(error => {
          console.warn('Failed to request pointer lock immediately.', error);
          armRetry();
        });
      }
    } catch (error) {
      console.warn('Failed to request pointer lock immediately.', error);
      armRetry();
      return;
    }

    window.setTimeout(() => {
      if (!controls.isLocked) {
        armRetry();
      }
    }, 0);
  }

  function retryFromUserGesture() {
    if (!input?.pointerLockRetryArmed) return;
    request();
  }

  function handleRetryHotkey(event) {
    if (event.repeat || isTypingTarget(event.target) || isChatInputOpen()) return;
    retryFromUserGesture();
  }

  function handleLock() {
    input?.setPointerLockRetryBlockedUntil?.(0);
    disarmRetry();
    hideMenuCentral();
  }

  function handleUnlock() {
    input?.setPointerLockRetryBlockedUntil?.(performance.now() + retryCooldownMs);
    if (openingChatFromPointerLock) {
      openingChatFromPointerLock = false;
      return;
    }
    if (isChatInputOpen()) {
      return 'hide-chat';
    }
    if (!getMobileMode()) {
      showMenuCentral(getActiveMenuCentralTab() || 'settings', { force: true });
    }
    return '';
  }

  function unlock() {
    controls?.unlock?.();
  }

  function markOpeningChatFromPointerLock() {
    openingChatFromPointerLock = true;
  }

  return {
    armRetry,
    disarmRetry,
    handleLock,
    handleRetryHotkey,
    handleUnlock,
    isLocked,
    markOpeningChatFromPointerLock,
    request,
    retryFromUserGesture,
    shouldWantGameplayPointerLock,
    unlock,
  };
}

export {
  DEFAULT_POINTER_LOCK_RETRY_COOLDOWN_MS,
};
