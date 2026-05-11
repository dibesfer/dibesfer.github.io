const KOLORLANDO_PLAYER_NAME_STORAGE_KEY = 'kolorlando.playerName';
const KOLORLANDO_FACE_STORAGE_KEY = 'kolorlando.playerFaceData';
const KOLORLANDO_WORLD_SAVE_PREFIX = 'kolorlando.worldSave.';
const KOLORLANDO_LOCAL_SETTINGS_KEYS = [
  'kolorlando.cameraMode',
  'kolorlando.renderScale',
  'kolorlando.shadowsEnabled',
  'kolorlando.shadowPreset',
];
const MODE_DESKTOP_LABEL = 'Desktop';
const MODE_MOBILE_PORTRAIT_LABEL = 'Mobile/Portrait';
const MODE_MOBILE_LANDSCAPE_LABEL = 'Mobile-Landscape';
const CAMERA_MODE_STORAGE_KEY = 'kolorlando.cameraMode';
const CAMERA_MODE_LABELS = {
  skyrim: 'Skyrim',
  wow: 'WoW',
  legoLol: 'Lego Lol',
};

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

function resolveStoredCameraModeLabel() {
  /* The debug summary should mirror the player's persisted camera preference
  while still falling back to the same default mode the runtime uses. */
  try {
    const storedCameraMode = window.localStorage.getItem(CAMERA_MODE_STORAGE_KEY);
    return CAMERA_MODE_LABELS[storedCameraMode] || CAMERA_MODE_LABELS.skyrim;
  } catch (error) {
    return CAMERA_MODE_LABELS.skyrim;
  }
}

function resolveStoredLocalDataLabels() {
  const labels = [];

  try {
    const storedFaceData = window.localStorage.getItem(KOLORLANDO_FACE_STORAGE_KEY);
    if (typeof storedFaceData === 'string' && storedFaceData.trim()) {
      labels.push('Face config');
    }

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageKey = window.localStorage.key(index);
      if (!storageKey || !storageKey.startsWith(KOLORLANDO_WORLD_SAVE_PREFIX)) continue;
      labels.push('World save');
      break;
    }

    const hasStoredLocalSettings = KOLORLANDO_LOCAL_SETTINGS_KEYS.some(storageKey => {
      const storedValue = window.localStorage.getItem(storageKey);
      return typeof storedValue === 'string' && storedValue.trim();
    });

    if (hasStoredLocalSettings) {
      labels.push('Local settings');
    }
  } catch (error) {
    console.warn('Failed to inspect Kolorlando local data.', error);
  }

  return labels;
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
    const localDataLabels = resolveStoredLocalDataLabels();
    const localDataBlock = localDataLabels.length
      ? `\nLocal data:\n-${localDataLabels.join('\n-')}`
      : '';

    console.log(
      `Ariadna:\n\nScreen mode: ${resolveViewportModeLabel()}\nCamera mode: ${resolveStoredCameraModeLabel()}\nusername: ${resolveStoredUsername()}${localDataBlock}`
    );
  }

  return {
    log,
    logState,
    logBootSummary,
    resolveCameraModeLabel: resolveStoredCameraModeLabel,
    resolveScreenModeLabel: resolveViewportModeLabel,
    resolveUsername: resolveStoredUsername,
    resolveStoredLocalDataLabels,
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

export function resolveKolorlandoDebugCameraMode() {
  return globalDebugConsole.resolveCameraModeLabel();
}

export function resolveKolorlandoDebugUsername() {
  return globalDebugConsole.resolveUsername();
}

export function resolveKolorlandoDebugLocalDataLabels() {
  return globalDebugConsole.resolveStoredLocalDataLabels();
}
