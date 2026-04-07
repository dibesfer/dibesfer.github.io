const WORLD_SAVE_SCHEMA_VERSION = 1;
const DEFAULT_STORAGE_PREFIX = 'kolorlando.worldSave';
const DEFAULT_SAVE_DEBOUNCE_MS = 750;

function isFiniteInteger(value) {
  return Number.isInteger(value) && Number.isFinite(value);
}

function sanitizeWorldId(worldId) {
  /* The save key is part of localStorage namespace management, so keeping it
  compact and deterministic helps us avoid awkward collisions between future
  presets, singleplayer profiles, and test worlds. */
  const normalized = String(worldId ?? 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'default';
}

function buildStorageKey(worldId, storagePrefix = DEFAULT_STORAGE_PREFIX) {
  return `${storagePrefix}.${sanitizeWorldId(worldId)}`;
}

function buildVoxelEditKey(cellX, cellY, cellZ) {
  return `${cellX},${cellY},${cellZ}`;
}

function parseVoxelEditKey(key) {
  const parts = String(key).split(',');
  if (parts.length !== 3) return null;

  const cellX = Number(parts[0]);
  const cellY = Number(parts[1]);
  const cellZ = Number(parts[2]);
  if (!isFiniteInteger(cellX) || !isFiniteInteger(cellY) || !isFiniteInteger(cellZ)) {
    return null;
  }

  return { cellX, cellY, cellZ };
}

function clonePlayerState(player) {
  if (!player || typeof player !== 'object') return null;

  const cloned = {};
  if (Number.isFinite(player.x)) cloned.x = Number(player.x);
  if (Number.isFinite(player.y)) cloned.y = Number(player.y);
  if (Number.isFinite(player.z)) cloned.z = Number(player.z);
  if (Number.isFinite(player.rotationY)) cloned.rotationY = Number(player.rotationY);

  return Object.keys(cloned).length > 0 ? cloned : null;
}

function createEmptyWorldSave(worldId = 'default') {
  /* The save format intentionally stores only player-authored mutations instead
  of the whole generated world. The base map remains code-driven, while this
  structure captures the delta we can later replay locally or in Supabase. */
  return {
    schemaVersion: WORLD_SAVE_SCHEMA_VERSION,
    worldId: sanitizeWorldId(worldId),
    savedAt: null,
    player: null,
    voxelEdits: {},
  };
}

function cloneWorldSave(saveData) {
  return {
    schemaVersion: saveData.schemaVersion,
    worldId: saveData.worldId,
    savedAt: saveData.savedAt,
    player: saveData.player ? { ...saveData.player } : null,
    voxelEdits: { ...saveData.voxelEdits },
  };
}

function normalizeVoxelEditRecord(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.action !== 'add' && record.action !== 'remove') return null;

  const normalized = {
    action: record.action,
  };

  if (record.action === 'add') {
    const voxelType = String(record.voxelType ?? '').trim();
    if (!voxelType) return null;
    normalized.voxelType = voxelType;
  }

  return normalized;
}

function normalizeWorldSave(rawSave, fallbackWorldId = 'default') {
  const normalized = createEmptyWorldSave(fallbackWorldId);
  if (!rawSave || typeof rawSave !== 'object') return normalized;

  normalized.schemaVersion = WORLD_SAVE_SCHEMA_VERSION;
  normalized.worldId = sanitizeWorldId(rawSave.worldId ?? fallbackWorldId);
  normalized.savedAt = typeof rawSave.savedAt === 'string' ? rawSave.savedAt : null;
  normalized.player = clonePlayerState(rawSave.player);

  if (rawSave.voxelEdits && typeof rawSave.voxelEdits === 'object') {
    Object.entries(rawSave.voxelEdits).forEach(([key, record]) => {
      const parsedKey = parseVoxelEditKey(key);
      const normalizedRecord = normalizeVoxelEditRecord(record);
      if (!parsedKey || !normalizedRecord) return;
      normalized.voxelEdits[key] = normalizedRecord;
    });
  }

  return normalized;
}

function readStorage(storageLike, key) {
  if (!storageLike || typeof storageLike.getItem !== 'function') return null;
  try {
    return storageLike.getItem(key);
  } catch (error) {
    console.warn('Failed to read world save from local storage.', error);
    return null;
  }
}

function writeStorage(storageLike, key, value) {
  if (!storageLike || typeof storageLike.setItem !== 'function') return false;
  try {
    storageLike.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('Failed to write world save to local storage.', error);
    return false;
  }
}

function removeStorage(storageLike, key) {
  if (!storageLike || typeof storageLike.removeItem !== 'function') return false;
  try {
    storageLike.removeItem(key);
    return true;
  } catch (error) {
    console.warn('Failed to remove world save from local storage.', error);
    return false;
  }
}

export function createLocalWorldSaveStore({
  worldId = 'default',
  storage = window.localStorage,
  storagePrefix = DEFAULT_STORAGE_PREFIX,
  saveDebounceMs = DEFAULT_SAVE_DEBOUNCE_MS,
} = {}) {
  const normalizedWorldId = sanitizeWorldId(worldId);
  const storageKey = buildStorageKey(normalizedWorldId, storagePrefix);
  let currentSave = null;
  let saveTimer = 0;
  let saveIsDirty = false;

  function ensureLoadedSave() {
    if (currentSave) return currentSave;

    const rawSerializedSave = readStorage(storage, storageKey);
    if (!rawSerializedSave) {
      currentSave = createEmptyWorldSave(normalizedWorldId);
      return currentSave;
    }

    try {
      currentSave = normalizeWorldSave(JSON.parse(rawSerializedSave), normalizedWorldId);
    } catch (error) {
      console.warn('Failed to parse world save. Falling back to an empty save.', error);
      currentSave = createEmptyWorldSave(normalizedWorldId);
    }

    return currentSave;
  }

  function persistCurrentSave() {
    saveIsDirty = false;
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
    }

    const saveToPersist = ensureLoadedSave();
    saveToPersist.savedAt = new Date().toISOString();
    writeStorage(storage, storageKey, JSON.stringify(saveToPersist));
    return cloneWorldSave(saveToPersist);
  }

  function schedulePersistCurrentSave() {
    // Voxel edits are already applied in-scene; disk persistence can breathe.
    saveIsDirty = true;
    if (saveTimer) return cloneWorldSave(ensureLoadedSave());

    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      if (saveIsDirty) {
        persistCurrentSave();
      }
    }, saveDebounceMs);

    return cloneWorldSave(ensureLoadedSave());
  }

  function flushPendingSave() {
    if (!saveIsDirty) return cloneWorldSave(ensureLoadedSave());
    return persistCurrentSave();
  }

  function loadWorldSave() {
    return cloneWorldSave(ensureLoadedSave());
  }

  function replaceWorldSave(nextSave) {
    currentSave = normalizeWorldSave(nextSave, normalizedWorldId);
    return persistCurrentSave();
  }

  function clearWorldSave() {
    saveIsDirty = false;
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
    }

    currentSave = createEmptyWorldSave(normalizedWorldId);
    removeStorage(storage, storageKey);
    return cloneWorldSave(currentSave);
  }

  function setPlayerState(playerState) {
    const saveData = ensureLoadedSave();
    saveData.player = clonePlayerState(playerState);
    return persistCurrentSave();
  }

  function recordVoxelAdded(cellX, cellY, cellZ, voxelType) {
    /* The latest edit for a cell always wins. This keeps the save compact and
    avoids replaying contradictory add/remove history when a player modifies the
    same voxel repeatedly during one session. */
    if (!isFiniteInteger(cellX) || !isFiniteInteger(cellY) || !isFiniteInteger(cellZ)) {
      return cloneWorldSave(ensureLoadedSave());
    }

    const normalizedVoxelType = String(voxelType ?? '').trim();
    if (!normalizedVoxelType) {
      return cloneWorldSave(ensureLoadedSave());
    }

    const saveData = ensureLoadedSave();
    saveData.voxelEdits[buildVoxelEditKey(cellX, cellY, cellZ)] = {
      action: 'add',
      voxelType: normalizedVoxelType,
    };
    return schedulePersistCurrentSave();
  }

  function recordVoxelRemoved(cellX, cellY, cellZ) {
    if (!isFiniteInteger(cellX) || !isFiniteInteger(cellY) || !isFiniteInteger(cellZ)) {
      return cloneWorldSave(ensureLoadedSave());
    }

    const saveData = ensureLoadedSave();
    saveData.voxelEdits[buildVoxelEditKey(cellX, cellY, cellZ)] = {
      action: 'remove',
    };
    return schedulePersistCurrentSave();
  }

  function getVoxelEditsList() {
    const saveData = ensureLoadedSave();
    return Object.entries(saveData.voxelEdits)
      .map(([key, record]) => {
        const parsedKey = parseVoxelEditKey(key);
        if (!parsedKey) return null;

        return {
          ...parsedKey,
          ...record,
        };
      })
      .filter(Boolean);
  }

  return {
    worldId: normalizedWorldId,
    storageKey,
    loadWorldSave,
    replaceWorldSave,
    clearWorldSave,
    setPlayerState,
    recordVoxelAdded,
    recordVoxelRemoved,
    flushPendingSave,
    getVoxelEditsList,
  };
}

export {
  WORLD_SAVE_SCHEMA_VERSION,
  DEFAULT_STORAGE_PREFIX,
  DEFAULT_SAVE_DEBOUNCE_MS,
  buildStorageKey,
  buildVoxelEditKey,
  createEmptyWorldSave,
  normalizeWorldSave,
  parseVoxelEditKey,
};
