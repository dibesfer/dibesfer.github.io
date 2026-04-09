import { DEFAULT_SFC_FACE, SFC_FACE_STORAGE_KEY, normalizeSfcFaceData } from '../avatar/sfcFace.js';

const KOLOR_PLAYERS_TABLE = 'KolorPlayers';
const AUTHENTICATED_FACE_STORAGE_KEY_PREFIX = `${SFC_FACE_STORAGE_KEY}.user.`;
const KOLORLANDO_ACCOUNT_CLAIMED_STORAGE_KEY = 'kolorlando.accountClaimed';

function getDatabaseClient() {
  return window.database ?? null;
}

function hasActiveKolorlandoAccountSession() {
  /* Face persistence should follow the same claimed-session contract as the
  rest of Kolorlando so companion tools like SFC never look logged in alone. */
  return window.sessionStorage.getItem(KOLORLANDO_ACCOUNT_CLAIMED_STORAGE_KEY) === '1';
}

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function isKolorPlayersWritePolicyError(error) {
  return error?.code === '42501';
}

function areJsonValuesEqual(leftValue, rightValue) {
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

function getAuthenticatedPlayerFaceStorageKey(userId) {
  return `${AUTHENTICATED_FACE_STORAGE_KEY_PREFIX}${encodeURIComponent(String(userId || 'unknown'))}`;
}

function readStoredPlayerFaceData(storageKey) {
  try {
    const storedFaceData = window.localStorage.getItem(storageKey);
    if (!storedFaceData) {
      return null;
    }

    return normalizeSfcFaceData(JSON.parse(storedFaceData), DEFAULT_SFC_FACE);
  } catch (error) {
    console.warn('Failed to read Kolorlando player face data.', error);
    return null;
  }
}

function writeStoredPlayerFaceData(storageKey, faceData) {
  const normalizedFaceData = normalizeSfcFaceData(faceData, DEFAULT_SFC_FACE);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(normalizedFaceData));
  } catch (error) {
    console.warn('Failed to write Kolorlando player face data.', error);
  }

  return normalizedFaceData;
}

function readAuthenticatedPlayerFaceData(userId) {
  return readStoredPlayerFaceData(getAuthenticatedPlayerFaceStorageKey(userId));
}

function writeAuthenticatedPlayerFaceData(userId, faceData) {
  return writeStoredPlayerFaceData(getAuthenticatedPlayerFaceStorageKey(userId), faceData);
}

function pickAuthoritativeKolorPlayerRow(rows) {
  /* Duplicate profile rows can happen while auth flow is still evolving. The
  newest row that actually has face data is the safest table authority. */
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index]?.avatar_face) {
      return rows[index];
    }
  }

  return rows[rows.length - 1] ?? null;
}

export function readLocalPlayerFaceData() {
  /* This key is the anonymous avatar only; account faces use per-user storage. */
  return readStoredPlayerFaceData(SFC_FACE_STORAGE_KEY) ?? normalizeSfcFaceData(DEFAULT_SFC_FACE);
}

export function writeLocalPlayerFaceData(faceData) {
  /* This intentionally preserves the anonymous face across login/logout. */
  return writeStoredPlayerFaceData(SFC_FACE_STORAGE_KEY, faceData);
}

export async function getAuthenticatedKolorPlayer() {
  const database = getDatabaseClient();

  if (!database || !hasActiveKolorlandoAccountSession()) {
    return { user: null, row: null };
  }

  const { data: authData, error: authError } = await database.auth.getUser();
  if (authError) {
    const isMissingSessionError =
      authError?.name === 'AuthSessionMissingError' ||
      /auth session missing/i.test(String(authError?.message || ''));

    if (isMissingSessionError) {
      return { user: null, row: null };
    }

    throw authError;
  }

  const user = authData?.user ?? null;
  if (!user?.id) {
    return { user: null, row: null };
  }

  const { data: rows, error: rowError } = await database
    .from(KOLOR_PLAYERS_TABLE)
    .select('*')
    .eq('user_id', user.id)
    .order('id', { ascending: true })

  if (rowError) {
    throw rowError;
  }

  return {
    user,
    row: pickAuthoritativeKolorPlayerRow(rows),
  };
}

export async function ensureAuthenticatedKolorPlayer({ fallbackFaceData } = {}) {
  /* Row creation belongs here so every future caller shares the same bootstrap
  behavior instead of re-implementing user lookup and first-save rules. */
  const database = getDatabaseClient();
  if (!database) {
    return { user: null, row: null, created: false };
  }

  const existing = await getAuthenticatedKolorPlayer();
  if (!existing.user) {
    return { user: null, row: null, created: false };
  }

  if (existing.row) {
    return { ...existing, created: false };
  }

  const normalizedFaceData = fallbackFaceData
    ? normalizeSfcFaceData(fallbackFaceData, DEFAULT_SFC_FACE)
    : null;

  const insertPayload = {
    user_id: existing.user.id,
    avatar_face: normalizedFaceData ? cloneJsonValue(normalizedFaceData) : null,
  };

  const { data: insertedRows, error: insertError } = await database
    .from(KOLOR_PLAYERS_TABLE)
    .insert([insertPayload])
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return {
    user: existing.user,
    row: insertedRows ?? null,
    created: true,
  };
}

export async function loadPlayerFaceData() {
  /* Anonymous and account avatars are separate sources, so login never
  overwrites the anonymous local face. */
  const localFaceData = readLocalPlayerFaceData();
  let authenticatedUser = null;
  let accountBootstrapFaceData = null;

  try {
    const authenticatedPlayer = await getAuthenticatedKolorPlayer();
    authenticatedUser = authenticatedPlayer.user;

    if (!authenticatedPlayer.user) {
      return {
        faceData: localFaceData,
        source: 'local',
        playerRow: null,
      };
    }

    const authenticatedLocalFaceData = readAuthenticatedPlayerFaceData(authenticatedPlayer.user.id);
    accountBootstrapFaceData = authenticatedLocalFaceData ?? normalizeSfcFaceData(DEFAULT_SFC_FACE);
    const ensuredPlayer = await ensureAuthenticatedKolorPlayer({
      fallbackFaceData: accountBootstrapFaceData,
    });

    if (!ensuredPlayer.user) {
      return {
        faceData: localFaceData,
        source: 'local',
        playerRow: null,
      };
    }

    const remoteFaceData = ensuredPlayer.row?.avatar_face
      ? normalizeSfcFaceData(ensuredPlayer.row.avatar_face, DEFAULT_SFC_FACE)
      : accountBootstrapFaceData;
    const resolvedFaceData = remoteFaceData;
    const remoteNeedsHealing = Boolean(ensuredPlayer.row?.avatar_face)
      && !areJsonValuesEqual(ensuredPlayer.row.avatar_face, remoteFaceData);

    if (remoteNeedsHealing && ensuredPlayer.row?.id) {
      const database = getDatabaseClient();
      const { data: healedRows, error: healedUpdateError } = await database
        .from(KOLOR_PLAYERS_TABLE)
        .update({
          avatar_face: cloneJsonValue(resolvedFaceData),
        })
        .eq('user_id', ensuredPlayer.user.id)
        .select();

      if (healedUpdateError && !isKolorPlayersWritePolicyError(healedUpdateError)) {
        throw healedUpdateError;
      }

      if (!healedUpdateError && healedRows) {
        ensuredPlayer.row = pickAuthoritativeKolorPlayerRow(healedRows) ?? ensuredPlayer.row;
      }
    }

    writeAuthenticatedPlayerFaceData(ensuredPlayer.user.id, resolvedFaceData);

    return {
      faceData: resolvedFaceData,
      source: remoteNeedsHealing
        ? 'remote-healed'
        : (ensuredPlayer.created ? 'remote-created' : 'remote'),
      playerRow: ensuredPlayer.row,
    };
  } catch (error) {
    if (isKolorPlayersWritePolicyError(error)) {
      console.warn('KolorPlayers insert is blocked by Supabase RLS. Using browser face data.');
    } else {
      console.error('Failed to load the Kolorlando player face data.', error);
    }

    if (authenticatedUser?.id && accountBootstrapFaceData) {
      return {
        faceData: accountBootstrapFaceData,
        source: 'account-local-error',
        playerRow: null,
      };
    }

    return {
      faceData: localFaceData,
      source: 'local-error',
      playerRow: null,
    };
  }
}

export async function savePlayerFaceData(faceData) {
  /* Save to either anonymous local storage or the active account, never both. */
  const normalizedFaceData = normalizeSfcFaceData(faceData, DEFAULT_SFC_FACE);
  let authenticatedUser = null;

  try {
    const existingPlayer = await getAuthenticatedKolorPlayer();
    authenticatedUser = existingPlayer.user;

    if (!existingPlayer.user) {
      writeLocalPlayerFaceData(normalizedFaceData);
      return {
        faceData: normalizedFaceData,
        savedRemotely: false,
        playerRow: null,
      };
    }

    const ensuredPlayer = existingPlayer.row
      ? { ...existingPlayer, created: false }
      : await ensureAuthenticatedKolorPlayer({ fallbackFaceData: normalizedFaceData });

    if (!ensuredPlayer.row?.id) {
      writeAuthenticatedPlayerFaceData(existingPlayer.user.id, normalizedFaceData);
      return {
        faceData: normalizedFaceData,
        savedRemotely: false,
        playerRow: ensuredPlayer.row ?? null,
      };
    }

    writeAuthenticatedPlayerFaceData(ensuredPlayer.user.id, normalizedFaceData);

    const database = getDatabaseClient();
    const { data: updatedRows, error: updateError } = await database
      .from(KOLOR_PLAYERS_TABLE)
      .update({
        avatar_face: cloneJsonValue(normalizedFaceData),
      })
      .eq('user_id', ensuredPlayer.user.id)
      .select();

    if (updateError) {
      throw updateError;
    }

    return {
      faceData: normalizedFaceData,
      savedRemotely: true,
      playerRow: pickAuthoritativeKolorPlayerRow(updatedRows) ?? ensuredPlayer.row,
    };
  } catch (error) {
    if (isKolorPlayersWritePolicyError(error)) {
      console.warn('KolorPlayers write is blocked by Supabase RLS. Saved face in browser cache only.');
    } else {
      console.error('Failed to save the Kolorlando player face data.', error);
    }

    if (authenticatedUser?.id) {
      writeAuthenticatedPlayerFaceData(authenticatedUser.id, normalizedFaceData);
    } else if (error?.name === 'AuthSessionMissingError' || /auth session missing/i.test(String(error?.message || ''))) {
      writeLocalPlayerFaceData(normalizedFaceData);
    }

    return {
      faceData: normalizedFaceData,
      savedRemotely: false,
      playerRow: null,
      error,
    };
  }
}
