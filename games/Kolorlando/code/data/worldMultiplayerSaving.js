const KOLOR_MULTIPLAYER_WORLD_TABLE = 'KolorMultiplayerWorld';

function getDatabaseClient() {
  return window.database ?? null;
}

async function canAuthenticatedUserWrite(database) {
  if (!database?.auth?.getUser) {
    return false;
  }

  try {
    const { data, error } = await database.auth.getUser();
    if (error) {
      const isMissingSessionError =
        error?.name === 'AuthSessionMissingError' ||
        /auth session missing/i.test(String(error?.message || ''));

      if (isMissingSessionError) {
        return false;
      }

      throw error;
    }

    return Boolean(data?.user?.id);
  } catch (error) {
    console.warn('Failed to verify Kolorlando multiplayer world write access.', error);
    return false;
  }
}

function isFiniteInteger(value) {
  return Number.isInteger(value) && Number.isFinite(value);
}

function sanitizeWorldId(worldId) {
  /* Shared world rows should use the same compact predictable ids every page
  load so the multiplayer bootstrap always targets one stable Supabase row. */
  const normalized = String(worldId ?? 'voxelandia')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'voxelandia';
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

function normalizePlayerState(record) {
  if (!record || typeof record !== 'object') return null;

  const normalized = {};
  if (Number.isFinite(record.x)) normalized.x = Number(record.x);
  if (Number.isFinite(record.y)) normalized.y = Number(record.y);
  if (Number.isFinite(record.z)) normalized.z = Number(record.z);
  if (Number.isFinite(record.rotationY)) normalized.rotationY = Number(record.rotationY);
  if (Number.isFinite(record.health)) normalized.health = Number(record.health);
  if (Number.isFinite(record.maxHealth)) normalized.maxHealth = Number(record.maxHealth);
  if (typeof record.isDead === 'boolean') normalized.isDead = record.isDead;
  if (typeof record.displayName === 'string' && record.displayName.trim()) {
    normalized.displayName = record.displayName.trim();
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function createEmptyMultiplayerWorldState(worldId = 'voxelandia') {
  return {
    rowId: null,
    worldId: sanitizeWorldId(worldId),
    updatedAt: null,
    players: {},
    voxelEdits: {},
    voxelEditsList: [],
  };
}

function normalizeMultiplayerWorldRow(row, fallbackWorldId = 'voxelandia') {
  const normalized = createEmptyMultiplayerWorldState(fallbackWorldId);
  if (!row || typeof row !== 'object') {
    return normalized;
  }

  normalized.rowId = row.id ?? null;
  normalized.worldId = sanitizeWorldId(row.world_id ?? fallbackWorldId);
  normalized.updatedAt = typeof row.updated_at === 'string' ? row.updated_at : null;

  if (row.players && typeof row.players === 'object') {
    Object.entries(row.players).forEach(([playerKey, record]) => {
      const normalizedPlayerState = normalizePlayerState(record);
      if (!normalizedPlayerState) return;
      normalized.players[String(playerKey)] = normalizedPlayerState;
    });
  }

  if (row.voxel_edits && typeof row.voxel_edits === 'object') {
    Object.entries(row.voxel_edits).forEach(([key, record]) => {
      const parsedKey = parseVoxelEditKey(key);
      const normalizedRecord = normalizeVoxelEditRecord(record);
      if (!parsedKey || !normalizedRecord) return;
      normalized.voxelEdits[buildVoxelEditKey(parsedKey.cellX, parsedKey.cellY, parsedKey.cellZ)] = normalizedRecord;
      normalized.voxelEditsList.push({
        ...parsedKey,
        ...normalizedRecord,
      });
    });
  }

  return normalized;
}

async function fetchMultiplayerWorldRow({
  worldId = 'voxelandia',
  tableName = KOLOR_MULTIPLAYER_WORLD_TABLE,
} = {}) {
  const database = getDatabaseClient();
  const normalizedWorldId = sanitizeWorldId(worldId);

  if (!database) {
    return createEmptyMultiplayerWorldState(normalizedWorldId);
  }

  const { data: row, error } = await database
    .from(tableName)
    .select('id, world_id, players, voxel_edits, updated_at')
    .eq('world_id', normalizedWorldId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeMultiplayerWorldRow(row ?? null, normalizedWorldId);
}

export async function loadMultiplayerWorldState(options = {}) {
  return fetchMultiplayerWorldRow(options);
}

export async function createMultiplayerWorldStore({
  worldId = 'voxelandia',
  tableName = KOLOR_MULTIPLAYER_WORLD_TABLE,
} = {}) {
  const normalizedWorldId = sanitizeWorldId(worldId);
  const database = getDatabaseClient();
  const listeners = new Set();
  let realtimeChannel = null;
  let writeInFlight = false;
  let queuedPartialState = null;
  let hasLoggedRealtimeError = false;
  let currentState = await fetchMultiplayerWorldRow({
    worldId: normalizedWorldId,
    tableName,
  });
  let writesEnabled = await canAuthenticatedUserWrite(database);

  function notifyListeners(nextState, previousState, source) {
    listeners.forEach(listener => {
      try {
        listener({
          currentState: nextState,
          previousState,
          source,
        });
      } catch (error) {
        console.error('Failed to run a Kolorlando multiplayer world listener.', error);
      }
    });
  }

  async function refresh() {
    const previousState = currentState;
    currentState = await fetchMultiplayerWorldRow({
      worldId: normalizedWorldId,
      tableName,
    });
    notifyListeners(currentState, previousState, 'refresh');
    return currentState;
  }

  function mergePartialStateIntoCurrentState(partialState) {
    return {
      players: partialState?.players ?? currentState.players,
      voxel_edits: partialState?.voxel_edits ?? currentState.voxelEdits,
    };
  }

  async function flushQueuedWrite() {
    if (writeInFlight || !queuedPartialState) {
      return currentState;
    }

    const nextPartialState = queuedPartialState;
    queuedPartialState = null;
    return persistPartialState(nextPartialState);
  }

  async function persistPartialState(partialState) {
    if (!database || !writesEnabled) {
      return currentState;
    }

    if (writeInFlight) {
      queuedPartialState = mergePartialStateIntoCurrentState(partialState);
      return currentState;
    }

    const previousState = currentState;
    const mergedPartialState = mergePartialStateIntoCurrentState(partialState);
    writeInFlight = true;
    const { data: updatedRow, error } = await database
      .from(tableName)
      .update({
        ...mergedPartialState,
        updated_at: new Date().toISOString(),
      })
      .eq('world_id', normalizedWorldId)
      .select('id, world_id, players, voxel_edits, updated_at')
      .single();

    writeInFlight = false;

    if (error) {
      queuedPartialState = null;
      throw error;
    }

    currentState = normalizeMultiplayerWorldRow(updatedRow ?? null, normalizedWorldId);
    notifyListeners(currentState, previousState, 'local-write');
    await flushQueuedWrite();
    return currentState;
  }

  async function setPlayerState(playerKey, playerState) {
    const normalizedPlayerKey = String(playerKey ?? '').trim();
    if (!normalizedPlayerKey) return currentState;

    const normalizedPlayerState = normalizePlayerState(playerState);
    if (!normalizedPlayerState) return currentState;

    const nextPlayers = {
      ...currentState.players,
      [normalizedPlayerKey]: normalizedPlayerState,
    };

    return persistPartialState({
      players: nextPlayers,
      voxel_edits: currentState.voxelEdits,
    });
  }

  async function recordVoxelAdded(cellX, cellY, cellZ, voxelType) {
    if (!isFiniteInteger(cellX) || !isFiniteInteger(cellY) || !isFiniteInteger(cellZ)) {
      return currentState;
    }

    const normalizedVoxelType = String(voxelType ?? '').trim();
    if (!normalizedVoxelType) {
      return currentState;
    }

    const nextVoxelEdits = {
      ...currentState.voxelEdits,
      [buildVoxelEditKey(cellX, cellY, cellZ)]: {
        action: 'add',
        voxelType: normalizedVoxelType,
      },
    };

    return persistPartialState({
      players: currentState.players,
      voxel_edits: nextVoxelEdits,
    });
  }

  async function recordVoxelRemoved(cellX, cellY, cellZ) {
    if (!isFiniteInteger(cellX) || !isFiniteInteger(cellY) || !isFiniteInteger(cellZ)) {
      return currentState;
    }

    const nextVoxelEdits = {
      ...currentState.voxelEdits,
      [buildVoxelEditKey(cellX, cellY, cellZ)]: {
        action: 'remove',
      },
    };

    return persistPartialState({
      players: currentState.players,
      voxel_edits: nextVoxelEdits,
    });
  }

  function getCurrentState() {
    return currentState;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function connectRealtime() {
    if (!database?.channel || realtimeChannel) {
      return;
    }

    realtimeChannel = database.channel(`kolorlando-multiplayer-world-${normalizedWorldId}`);

    realtimeChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `world_id=eq.${normalizedWorldId}`,
        },
        payload => {
          const previousState = currentState;
          currentState = normalizeMultiplayerWorldRow(payload.new ?? null, normalizedWorldId);
          notifyListeners(currentState, previousState, 'realtime');
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          hasLoggedRealtimeError = false;
          return;
        }

        if (status === 'CHANNEL_ERROR') {
          if (!hasLoggedRealtimeError) {
            hasLoggedRealtimeError = true;
            console.error(`Kolorlando multiplayer world realtime channel failed: ${status}.`);
          }
        }
      });
  }

  connectRealtime();

  return {
    worldId: normalizedWorldId,
    writesEnabled,
    getCurrentState,
    refresh,
    subscribe,
    setPlayerState,
    recordVoxelAdded,
    recordVoxelRemoved,
  };
}
