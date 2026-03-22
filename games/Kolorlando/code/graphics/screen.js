export const MODE_DESKTOP = 'desktop';
export const MODE_MOBILE_PORTRAIT = 'mobile-portrait';
export const MODE_MOBILE_LANDSCAPE = 'mobile-landscape';

export function createScreenController({
  touchQuery,
  mobileBreakpoint = 900,
  onMobileModeChange,
  onSyncCameraModeAvailability,
  onEnterMobileMode,
  onEnterDesktopMode,
  onPixelRatioChange,
  onResizeLayout,
} = {}) {
  let windowWidth = window.innerWidth;
  let windowHeight = window.innerHeight;
  let activeMode = MODE_DESKTOP;

  function syncAppHeight() {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  }

  function resolveMode() {
    const hasTouchScreen = (navigator.maxTouchPoints ?? 0) > 1;
    const isCoarsePointer = Boolean(touchQuery?.matches);
    const touchMobileViewport = (hasTouchScreen || isCoarsePointer) && Math.max(windowWidth, windowHeight) <= 1400;
    const isMobile = windowWidth < mobileBreakpoint || touchMobileViewport;
    if (!isMobile) return MODE_DESKTOP;
    return windowWidth > windowHeight ? MODE_MOBILE_LANDSCAPE : MODE_MOBILE_PORTRAIT;
  }

  function applyMode(mode) {
    activeMode = mode;
    document.body.dataset.mode = mode;

    const isMobile = mode !== MODE_DESKTOP;
    onMobileModeChange?.(isMobile, mode);
    onSyncCameraModeAvailability?.(isMobile, mode);

    if (isMobile) {
      onEnterMobileMode?.(mode);
      return;
    }

    onEnterDesktopMode?.(mode);
  }

  function updateModeFromViewport() {
    const nextMode = resolveMode();
    if (nextMode !== activeMode) {
      console.log(`Mode changed: ${activeMode} -> ${nextMode}`);
    }
    applyMode(nextMode);
  }

  function handleResize() {
    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;

    syncAppHeight();

    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    onPixelRatioChange?.(pixelRatio);

    updateModeFromViewport();
    onResizeLayout?.({
      width: windowWidth,
      height: windowHeight,
      pixelRatio,
      mode: activeMode,
      isMobile: activeMode !== MODE_DESKTOP,
    });
  }

  window.addEventListener('resize', handleResize);

  return {
    getActiveMode: () => activeMode,
    getWindowSize: () => ({ width: windowWidth, height: windowHeight }),
    isMobileMode: () => activeMode !== MODE_DESKTOP,
    syncAppHeight,
    updateModeFromViewport,
  };
}
