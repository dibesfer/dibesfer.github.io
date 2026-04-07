export const KOLORLANDO_LOCAL_BOXELS_STORAGE_KEY = 'kolorlando.localBoxels.v1';

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

export function readLocalBoxels() {
  try {
    const rawValue = window.localStorage.getItem(KOLORLANDO_LOCAL_BOXELS_STORAGE_KEY);
    if (!rawValue) {
      console.log('[Boxel Save] local read: 0 saved Boxels.');
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    const boxels = Array.isArray(parsedValue) ? parsedValue : [];
    console.log(`[Boxel Save] local read: ${boxels.length} saved Boxels.`);
    return boxels;
  } catch (error) {
    console.warn('Could not read local Boxel saves.', error);
    return [];
  }
}

export function writeLocalBoxel(boxelData) {
  const displayName = normalizeBoxelName(boxelData?.displayName || boxelData?.assetId);
  const assetId = createBoxelId(boxelData?.assetId || displayName);
  const savedBoxel = {
    ...boxelData,
    assetId,
    displayName: displayName || assetId,
    savedAt: new Date().toISOString(),
  };
  const previousBoxels = readLocalBoxels();
  const nextBoxels = [
    savedBoxel,
    ...previousBoxels.filter(boxel => boxel?.assetId !== assetId),
  ];

  try {
    window.localStorage.setItem(KOLORLANDO_LOCAL_BOXELS_STORAGE_KEY, JSON.stringify(nextBoxels));
    console.log(`[Boxel Save] local write: ${savedBoxel.displayName} (${savedBoxel.voxels?.length ?? 0} voxels).`);
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
    window.localStorage.setItem(KOLORLANDO_LOCAL_BOXELS_STORAGE_KEY, JSON.stringify(nextBoxels));
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
