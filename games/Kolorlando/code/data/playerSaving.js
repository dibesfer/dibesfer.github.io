import { DEFAULT_SFC_FACE, SFC_FACE_STORAGE_KEY, normalizeSfcFaceData } from '../avatar/sfcFace.js';

const KOLOR_PLAYERS_TABLE = 'KolorPlayers';

function getDatabaseClient() {
  return window.database ?? null;
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
  /* The local cache stays as the anonymous fallback and also gives logged-in
  users something to bootstrap from before their cloud profile exists. */
  try {
    const storedFaceData = window.localStorage.getItem(SFC_FACE_STORAGE_KEY);
    if (!storedFaceData) {
      return normalizeSfcFaceData(DEFAULT_SFC_FACE);
    }

    return normalizeSfcFaceData(JSON.parse(storedFaceData), DEFAULT_SFC_FACE);
  } catch (error) {
    console.warn('Failed to read the local Kolorlando player face data.', error);
    return normalizeSfcFaceData(DEFAULT_SFC_FACE);
  }
}

export function writeLocalPlayerFaceData(faceData) {
  /* Keeping the browser cache updated means both anonymous play and logged-in
  pages can reuse one normalized face payload without branching everywhere. */
  const normalizedFaceData = normalizeSfcFaceData(faceData, DEFAULT_SFC_FACE);

  try {
    window.localStorage.setItem(SFC_FACE_STORAGE_KEY, JSON.stringify(normalizedFaceData));
  } catch (error) {
    console.warn('Failed to write the local Kolorlando player face data.', error);
  }

  return normalizedFaceData;
}

export async function getAuthenticatedKolorPlayer() {
  const database = getDatabaseClient();

  if (!database) {
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
  /* Logged-in users should read their cloud face first, but anonymous mode and
  first-login bootstrap still fall back to the same normalized local cache. */
  const localFaceData = readLocalPlayerFaceData();

  try {
    const ensuredPlayer = await ensureAuthenticatedKolorPlayer({
      fallbackFaceData: localFaceData,
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
      : localFaceData;
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

    writeLocalPlayerFaceData(resolvedFaceData);

    return {
      faceData: resolvedFaceData,
      source: remoteNeedsHealing
        ? 'remote-healed'
        : (ensuredPlayer.created ? 'remote-created' : 'remote'),
      playerRow: ensuredPlayer.row,
    };
  } catch (error) {
    if (isKolorPlayersWritePolicyError(error)) {
      console.warn('KolorPlayers insert is blocked by Supabase RLS. Using local face data.');
    } else {
      console.error('Failed to load the Kolorlando player face data.', error);
    }

    return {
      faceData: localFaceData,
      source: 'local-error',
      playerRow: null,
    };
  }
}

export async function savePlayerFaceData(faceData) {
  /* Saves always refresh the local cache first so the latest face remains
  usable immediately even if the authenticated write fails later on. */
  const normalizedFaceData = writeLocalPlayerFaceData(faceData);

  try {
    const ensuredPlayer = await ensureAuthenticatedKolorPlayer({
      fallbackFaceData: normalizedFaceData,
    });

    if (!ensuredPlayer.user || !ensuredPlayer.row?.id) {
      return {
        faceData: normalizedFaceData,
        savedRemotely: false,
        playerRow: ensuredPlayer.row ?? null,
      };
    }

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
      console.warn('KolorPlayers write is blocked by Supabase RLS. Saved face locally only.');
    } else {
      console.error('Failed to save the Kolorlando player face data.', error);
    }

    return {
      faceData: normalizedFaceData,
      savedRemotely: false,
      playerRow: null,
      error,
    };
  }
}
