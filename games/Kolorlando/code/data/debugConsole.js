const KOLORLANDO_PLAYER_NAME_STORAGE_KEY = 'kolorlando.playerName';
const MODE_DESKTOP_LABEL = 'Desktop';
const MODE_MOBILE_PORTRAIT_LABEL = 'Mobile/Portrait';
const MODE_MOBILE_LANDSCAPE_LABEL = 'Mobile-Landscape';

function resolveViewportModeLabel() {
  /* The debug console should describe the same device posture the runtime uses,
  so we derive one normalized label from viewport size plus touch capability. */
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const coarsePointerQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
  const hasTouchScreen = (navigator.maxTouchPoints ?? 0) > 1;
  const touchMobileViewport = (hasTouchScreen || coarsePointerQuery.matches)
    && Math.max(windowWidth, windowHeight) <= 1400;
  const isMobile = windowWidth < 900 || touchMobileViewport;

  if (!isMobile) {
    return MODE_DESKTOP_LABEL;
  }

  return windowWidth > windowHeight
    ? MODE_MOBILE_LANDSCAPE_LABEL
    : MODE_MOBILE_PORTRAIT_LABEL;
}

function resolveStoredUsername() {
  /* Landing and runtime pages already share the cached public player name, so
  the first debug read can stay consistent without waiting on extra auth code. */
  const storedName = window.localStorage.getItem(KOLORLANDO_PLAYER_NAME_STORAGE_KEY);
  const trimmedStoredName = typeof storedName === 'string' ? storedName.trim() : '';
  return trimmedStoredName || 'Anonymous';
}

export function createDebugConsole() {
  function log(message, ...rest) {
    console.log(`Ariadna: ${message}`, ...rest);
  }

  function logState(label, state = {}) {
    /* Auth/session debugging becomes much easier when every branch emits the
    same compact shape instead of ad-hoc console.log strings. */
    console.log(`Ariadna: ${label}`, state);
  }

  function logBootSummary() {
    /* One boot summary keeps the first page-level debug signal readable across
    the landing page and both runtime entry points. */
    console.log(
      `Ariadna:\n\nScreen mode: ${resolveViewportModeLabel()}\nusername: ${resolveStoredUsername()}`
    );
  }

  return {
    log,
    logState,
    logBootSummary,
    resolveScreenModeLabel: resolveViewportModeLabel,
    resolveUsername: resolveStoredUsername,
  };
}

const globalDebugConsole = createDebugConsole();

window.kolorlandoDebugConsole = globalDebugConsole;

export function logKolorlandoDebug(message, ...rest) {
  globalDebugConsole.log(message, ...rest);
}

export function printKolorlandoDebugBootSummary() {
  globalDebugConsole.logBootSummary();
}

export function logKolorlandoDebugState(label, state = {}) {
  globalDebugConsole.logState(label, state);
}

export function resolveKolorlandoDebugScreenMode() {
  return globalDebugConsole.resolveScreenModeLabel();
}

export function resolveKolorlandoDebugUsername() {
  return globalDebugConsole.resolveUsername();
}
