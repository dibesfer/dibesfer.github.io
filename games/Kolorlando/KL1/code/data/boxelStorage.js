import { Boxel } from './Boxel.js';
import { Voxel } from './Voxel.js';

export const KOLORLANDO_LOCAL_BOXELS_STORAGE_KEY = 'kolorlando.localBoxels.v1';
export const KOLORLANDO_BOXEL_FORMAT = 'kolorlando.boxel';
export const KOLORLANDO_BOXEL_VERSION = 2;

function normalizeBoxelName(name) {
  return String(name || '').trim();
}

export function createBoxelId(name) {
  const normalizedName = normalizeBoxelName(name).toLowerCase();
  const slug = normalizedName
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || `boxel-${Date.now()}`;
}

export function createStoredBoxel({
  assetId = '',
  displayName = '',
  boxel = null,
  placement = null,
  savedAt = null,
} = {}) {
  const normalizedDisplayName = normalizeBoxelName(displayName || assetId || boxel?.name);
  const normalizedAssetId = createBoxelId(assetId || normalizedDisplayName || boxel?.name);
  const normalizedBoxel = boxel instanceof Boxel
    ? boxel.clone()
    : new Boxel({
      size: Number(boxel?.size) || undefined,
    }).fromJSON(boxel ?? {});
  const normalizedPlacement = normalizeStoredBoxelPlacement(
    placement,
    normalizedBoxel,
  );

  if (!normalizedBoxel.name) {
    normalizedBoxel.setName(normalizedDisplayName || normalizedAssetId);
  }

  return {
    format: KOLORLANDO_BOXEL_FORMAT,
    version: KOLORLANDO_BOXEL_VERSION,
    assetType: 'structure',
    assetId: normalizedAssetId,
    displayName: normalizedDisplayName || normalizedAssetId,
    savedAt: typeof savedAt === 'string' && savedAt.trim()
      ? savedAt
      : new Date().toISOString(),
    placement: normalizedPlacement,
    boxel: normalizedBoxel,
  };
}

export function serializeStoredBoxel(storedBoxel = null) {
  const normalizedStoredBoxel = createStoredBoxel(storedBoxel ?? {});

  return {
    format: normalizedStoredBoxel.format,
    version: normalizedStoredBoxel.version,
    assetType: normalizedStoredBoxel.assetType,
    assetId: normalizedStoredBoxel.assetId,
    displayName: normalizedStoredBoxel.displayName,
    savedAt: normalizedStoredBoxel.savedAt,
    placement: normalizedStoredBoxel.placement,
    boxel: normalizedStoredBoxel.boxel.toJSON(),
  };
}

export function deserializeStoredBoxel(boxelData = null) {
  if (!boxelData || typeof boxelData !== 'object') {
    return null;
  }

  if (Array.isArray(boxelData?.voxels)) {
    return normalizeLegacyStoredBoxel(boxelData);
  }

  return createStoredBoxel({
    assetId: boxelData.assetId,
    displayName: boxelData.displayName,
    placement: boxelData.placement,
    savedAt: boxelData.savedAt,
    boxel: boxelData.boxel,
  });
}

export function getBoxelVoxelEntries(boxelSource = null) {
  const normalizedStoredBoxel = isStoredBoxel(boxelSource)
    ? boxelSource
    : deserializeStoredBoxel(boxelSource);
  if (!normalizedStoredBoxel?.boxel) {
    return [];
  }

  return normalizedStoredBoxel.boxel.getVoxelEntries({ activeOnly: true });
}

export function readLocalBoxels() {
  try {
    const rawValue = window.localStorage.getItem(KOLORLANDO_LOCAL_BOXELS_STORAGE_KEY);
    if (!rawValue) {
      console.log('[Boxel Save] local read: 0 saved Boxels.');
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    const storedBoxels = Array.isArray(parsedValue)
      ? parsedValue.map(deserializeStoredBoxel).filter(Boolean)
      : [];
    console.log(`[Boxel Save] local read: ${storedBoxels.length} saved Boxels.`);
    return storedBoxels;
  } catch (error) {
    console.warn('Could not read local Boxel saves.', error);
    return [];
  }
}

export function writeLocalBoxel(boxelData) {
  const savedBoxel = isStoredBoxel(boxelData)
    ? createStoredBoxel(boxelData)
    : deserializeStoredBoxel(boxelData);
  if (!savedBoxel) {
    throw new Error('Invalid Boxel data.');
  }
  const previousBoxels = readLocalBoxels();
  const nextBoxels = [
    savedBoxel,
    ...previousBoxels.filter(boxel => boxel?.assetId !== savedBoxel.assetId),
  ];

  try {
    window.localStorage.setItem(
      KOLORLANDO_LOCAL_BOXELS_STORAGE_KEY,
      JSON.stringify(nextBoxels.map(serializeStoredBoxel)),
    );
    console.log(
      `[Boxel Save] local write: ${savedBoxel.displayName} (${getBoxelVoxelEntries(savedBoxel).length} voxels).`,
    );
  } catch (error) {
    console.warn('Could not write local Boxel save.', error);
  }

  return savedBoxel;
}

export function deleteLocalBoxel(assetId) {
  const normalizedAssetId = createBoxelId(assetId);
  const previousBoxels = readLocalBoxels();
  const nextBoxels = previousBoxels.filter(boxel => createBoxelId(boxel?.assetId) !== normalizedAssetId);

  try {
    window.localStorage.setItem(
      KOLORLANDO_LOCAL_BOXELS_STORAGE_KEY,
      JSON.stringify(nextBoxels.map(serializeStoredBoxel)),
    );
    console.log(`[Boxel Save] local delete: ${normalizedAssetId}.`);
  } catch (error) {
    console.warn('Could not delete local Boxel save.', error);
  }

  return previousBoxels.length !== nextBoxels.length;
}

export function findLocalBoxel(assetId) {
  const normalizedAssetId = createBoxelId(assetId);
  return readLocalBoxels().find(boxel => createBoxelId(boxel?.assetId) === normalizedAssetId) ?? null;
}

function isStoredBoxel(value = null) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.boxel instanceof Boxel
    && typeof value.assetId === 'string'
  );
}

function normalizeLegacyStoredBoxel(boxelData = {}) {
  const legacyVoxelEntries = Array.isArray(boxelData?.voxels)
    ? boxelData.voxels
        .map(entry => {
          const position = normalizeLegacyVoxelPosition(entry?.position);
          if (!position) return null;

          return {
            position,
            voxel: new Voxel({
              x: position.x,
              y: position.y,
              z: position.z,
              name: typeof entry?.voxelTypeId === 'string' ? entry.voxelTypeId.trim() : '',
              color: typeof entry?.color === 'string' && entry.color.trim()
                ? entry.color.trim()
                : '#ffffff',
              active: true,
            }),
          };
        })
        .filter(Boolean)
    : [];
  const legacyBounds = normalizeLegacyBounds(boxelData?.bounds);
  const translatedLegacy = translateLegacyVoxelEntriesToBoxelSpace(legacyVoxelEntries);
  const boxelSize = resolveBoxelSizeFromLegacyEntries(translatedLegacy.voxelEntries, legacyBounds);
  const boxel = new Boxel({
    size: boxelSize,
    name: normalizeBoxelName(boxelData?.displayName || boxelData?.assetId || 'Boxel'),
  }).setVoxelEntries(translatedLegacy.voxelEntries);
  const placement = normalizeLegacyPlacement(boxelData?.placement, translatedLegacy.offset);

  return createStoredBoxel({
    assetId: boxelData.assetId,
    displayName: boxelData.displayName,
    placement,
    savedAt: boxelData.savedAt,
    boxel,
  });
}

function normalizeStoredBoxelPlacement(placement = null, boxel = null) {
  const nextPlacement = {
    anchor: {
      x: Math.floor(Number(placement?.anchor?.x) || 0),
      y: Math.floor(Number(placement?.anchor?.y) || 0),
      z: Math.floor(Number(placement?.anchor?.z) || 0),
    },
    rotationY: Number.isFinite(Number(placement?.rotationY)) ? Number(placement.rotationY) : 0,
  };

  if (!placement?.anchor && boxel instanceof Boxel) {
    const centerAnchor = Math.floor((boxel.size - 1) * 0.5);
    nextPlacement.anchor.x = centerAnchor;
    nextPlacement.anchor.z = centerAnchor;
  }

  return nextPlacement;
}

function resolveBoxelSizeFromLegacyEntries(voxelEntries = [], legacyBounds = null) {
  const sizeCandidates = [];

  if (legacyBounds) {
    sizeCandidates.push(legacyBounds.width, legacyBounds.height, legacyBounds.depth);
  }

  for (let i = 0; i < voxelEntries.length; i += 1) {
    const position = voxelEntries[i]?.position;
    if (!position) continue;
    sizeCandidates.push(position.x + 1, position.y + 1, position.z + 1);
  }

  const largestSize = sizeCandidates.reduce((largest, size) => {
    const numericSize = Math.floor(Number(size));
    if (!Number.isFinite(numericSize)) return largest;
    return Math.max(largest, numericSize);
  }, 0);

  return Math.max(largestSize, 1);
}

function translateLegacyVoxelEntriesToBoxelSpace(voxelEntries = []) {
  if (!Array.isArray(voxelEntries) || voxelEntries.length === 0) {
    return {
      offset: { x: 0, y: 0, z: 0 },
      voxelEntries: [],
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;

  for (let i = 0; i < voxelEntries.length; i += 1) {
    const position = voxelEntries[i]?.position;
    if (!position) continue;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    minZ = Math.min(minZ, position.z);
  }

  const offset = {
    x: Number.isFinite(minX) ? Math.max(0, -minX) : 0,
    y: Number.isFinite(minY) ? Math.max(0, -minY) : 0,
    z: Number.isFinite(minZ) ? Math.max(0, -minZ) : 0,
  };

  return {
    offset,
    voxelEntries: voxelEntries.map(entry => ({
      ...entry,
      position: {
        x: entry.position.x + offset.x,
        y: entry.position.y + offset.y,
        z: entry.position.z + offset.z,
      },
    })),
  };
}

function normalizeLegacyPlacement(placement = null, offset = { x: 0, y: 0, z: 0 }) {
  return {
    anchor: {
      x: Math.floor(Number(placement?.anchor?.x) || 0) + (offset.x || 0),
      y: Math.floor(Number(placement?.anchor?.y) || 0) + (offset.y || 0),
      z: Math.floor(Number(placement?.anchor?.z) || 0) + (offset.z || 0),
    },
    rotationY: Number.isFinite(Number(placement?.rotationY)) ? Number(placement.rotationY) : 0,
  };
}

function normalizeLegacyBounds(bounds = null) {
  return {
    width: Math.floor(Number(bounds?.size?.width) || 0),
    height: Math.floor(Number(bounds?.size?.height) || 0),
    depth: Math.floor(Number(bounds?.size?.depth) || 0),
  };
}

function normalizeLegacyVoxelPosition(position = null) {
  if (!position || typeof position !== 'object') return null;

  const x = Math.floor(Number(position.x) || 0);
  const y = Math.floor(Number(position.y) || 0);
  const z = Math.floor(Number(position.z) || 0);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }

  return { x, y, z };
}
