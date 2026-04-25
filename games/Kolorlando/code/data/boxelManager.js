import { Boxel } from './Boxel.js';
import { Voxel } from './Voxel.js';
import {
  createBoxelId,
  createStoredBoxel,
  deserializeStoredBoxel,
  getBoxelVoxelEntries,
  readLocalBoxels,
  writeLocalBoxel,
} from './boxelStorage.js';

function normalizeQuarterTurnRotation(rotationY) {
  const normalizedRotation = Number.isFinite(rotationY) ? rotationY : 0;
  return ((Math.round(normalizedRotation / 90) % 4) + 4) % 4;
}

function rotateLocalVoxelOffset(x, z, quarterTurns) {
  switch (quarterTurns) {
    case 1:
      return { x: -z, z: x };
    case 2:
      return { x: -x, z: -z };
    case 3:
      return { x: z, z: -x };
    default:
      return { x, z };
  }
}

export function createBoxelManager({
  structureAssetUrls = {},
  getPlayerFoot,
  getSelectionSourceBox,
  getUseWorldEditorVoxelMode,
  getWorldData,
  getWorldVoxelSize,
  getVoxelTypes,
  getVoxelAtCell,
  addVoxelAtCell,
  getCanEditCurrentVoxelWorld,
  getLocalWorldSaveStore,
  getMultiplayerWorldStore,
  invalidateVoxelRaycast,
  appendChatLine,
  respawnPlayerAtSpawn,
  syncPlayerBody,
} = {}) {
  async function loadStructureAssetByName(assetName) {
    const normalizedAssetName = typeof assetName === 'string' ? assetName.trim().toLowerCase() : '';
    const assetUrl = structureAssetUrls[normalizedAssetName];

    if (assetUrl) {
      const response = await fetch(assetUrl);
      if (!response.ok) {
        throw new Error(`Failed to load structure "${assetName}".`);
      }

      return deserializeStoredBoxel(JSON.parse(await response.text()));
    }

    const normalizedBoxelId = createBoxelId(assetName);
    const localBoxel = readLocalBoxels().find(boxel => (
      createBoxelId(boxel?.assetId) === normalizedBoxelId
      || createBoxelId(boxel?.displayName) === normalizedBoxelId
    ));

    if (localBoxel) {
      console.log(`[Boxel Save] spawn local Boxel: ${localBoxel.displayName || localBoxel.assetId}`);
      return localBoxel;
    }

    throw new Error(`Unknown structure "${assetName}".`);
  }

  function isKnownVoxelTypeId(voxelTypeId) {
    return (getVoxelTypes?.() ?? []).some(voxelType => voxelType?.name === voxelTypeId);
  }

  function persistPlacedVoxel(cellX, cellY, cellZ, voxelTypeId) {
    const localWorldSaveStore = getLocalWorldSaveStore?.();
    if (localWorldSaveStore) {
      localWorldSaveStore.recordVoxelAdded(cellX, cellY, cellZ, voxelTypeId);
    }

    const multiplayerWorldStore = getMultiplayerWorldStore?.();
    if (multiplayerWorldStore) {
      multiplayerWorldStore.recordVoxelAdded(
        cellX,
        cellY,
        cellZ,
        voxelTypeId
      ).catch(error => {
        console.error('Failed to persist the Kolorlando multiplayer voxel addition.', error);
      });
    }
  }

  function placeStructureAssetAtPlayer(structureAsset) {
    if (!getCanEditCurrentVoxelWorld?.()) {
      throw new Error('Voxel editing is not available in this world.');
    }

    const voxelEntries = getBoxelVoxelEntries(structureAsset);
    if (voxelEntries.length === 0) {
      throw new Error('This structure has no voxels to place.');
    }

    const playerFoot = getPlayerFoot?.();
    const placementAnchor = structureAsset?.placement?.anchor ?? { x: 0, y: 0, z: 0 };
    const quarterTurns = normalizeQuarterTurnRotation(structureAsset?.placement?.rotationY);
    const baseCellX = Math.floor(playerFoot?.x ?? 0) - Math.floor(Number(placementAnchor.x) || 0);
    const baseCellY = Math.floor(playerFoot?.y ?? 0) - Math.floor(Number(placementAnchor.y) || 0);
    const baseCellZ = Math.floor(playerFoot?.z ?? 0) - Math.floor(Number(placementAnchor.z) || 0);
    let placedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < voxelEntries.length; i += 1) {
      const voxelEntry = voxelEntries[i];
      const voxel = voxelEntry?.voxel;
      const voxelTypeId = typeof voxel?.name === 'string' ? voxel.name.trim() : '';
      const localX = Math.round(Number(voxelEntry?.position?.x) || 0);
      const localY = Math.round(Number(voxelEntry?.position?.y) || 0);
      const localZ = Math.round(Number(voxelEntry?.position?.z) || 0);

      if (!voxelTypeId || !isKnownVoxelTypeId(voxelTypeId)) {
        skippedCount += 1;
        continue;
      }

      const rotatedOffset = rotateLocalVoxelOffset(localX, localZ, quarterTurns);
      const targetCellX = baseCellX + rotatedOffset.x;
      const targetCellY = baseCellY + localY;
      const targetCellZ = baseCellZ + rotatedOffset.z;
      const added = addVoxelAtCell?.(targetCellX, targetCellY, targetCellZ, {
        voxelType: voxelTypeId,
      });

      if (!added) {
        skippedCount += 1;
        continue;
      }

      persistPlacedVoxel(targetCellX, targetCellY, targetCellZ, voxelTypeId);
      placedCount += 1;
    }

    invalidateVoxelRaycast?.();
    return { placedCount, skippedCount };
  }

  async function handleSpawnCommand(args = []) {
    const assetName = typeof args[0] === 'string' ? args[0].trim() : '';

    if (!assetName) {
      respawnPlayerAtSpawn?.();
      syncPlayerBody?.();
      return;
    }

    const structureAsset = await loadStructureAssetByName(assetName);
    const { placedCount, skippedCount } = placeStructureAssetAtPlayer(structureAsset);
    appendChatLine?.(
      `Spawned ${assetName}: ${placedCount} placed${skippedCount ? `, ${skippedCount} skipped` : ''}.`
    );
  }

  function getCurrentBoxelSelectionCellBounds() {
    const sourceBox = getSelectionSourceBox?.();

    if (!sourceBox || sourceBox.isEmpty()) {
      return null;
    }

    const worldData = getWorldData?.();
    if (getUseWorldEditorVoxelMode?.() && worldData) {
      const worldVoxelSize = getWorldVoxelSize?.() ?? 1;
      const minGridPosition = worldData.mapToGridPosition(
        sourceBox.min.x + 0.001,
        sourceBox.min.y + 0.001,
        sourceBox.min.z + 0.001,
        worldVoxelSize,
      );
      const maxGridPosition = worldData.mapToGridPosition(
        sourceBox.max.x - 0.001,
        sourceBox.max.y - 0.001,
        sourceBox.max.z - 0.001,
        worldVoxelSize,
      );

      return {
        minCellX: Math.floor(minGridPosition.x),
        minCellY: Math.floor(minGridPosition.y),
        minCellZ: Math.floor(minGridPosition.z),
        maxCellX: Math.floor(maxGridPosition.x),
        maxCellY: Math.floor(maxGridPosition.y),
        maxCellZ: Math.floor(maxGridPosition.z),
      };
    }

    return {
      minCellX: Math.floor(sourceBox.min.x + 0.001),
      minCellY: Math.floor(sourceBox.min.y + 0.001),
      minCellZ: Math.floor(sourceBox.min.z + 0.001),
      maxCellX: Math.ceil(sourceBox.max.x - 0.001) - 1,
      maxCellY: Math.ceil(sourceBox.max.y - 0.001) - 1,
      maxCellZ: Math.ceil(sourceBox.max.z - 0.001) - 1,
    };
  }

  function createBoxelFromSelection(displayName) {
    const cellBounds = getCurrentBoxelSelectionCellBounds();
    if (!cellBounds) {
      throw new Error('Select voxels with the Boxel Tool first.');
    }

    console.log('[Boxel Save] exporting selection bounds:', cellBounds);

    const assetId = createBoxelId(displayName);
    const boxelSize = Math.max(
      cellBounds.maxCellX - cellBounds.minCellX + 1,
      cellBounds.maxCellY - cellBounds.minCellY + 1,
      cellBounds.maxCellZ - cellBounds.minCellZ + 1,
      1,
    );
    const voxelEntries = [];

    for (let cellY = cellBounds.minCellY; cellY <= cellBounds.maxCellY; cellY += 1) {
      for (let cellX = cellBounds.minCellX; cellX <= cellBounds.maxCellX; cellX += 1) {
        for (let cellZ = cellBounds.minCellZ; cellZ <= cellBounds.maxCellZ; cellZ += 1) {
          const voxel = getVoxelAtCell?.(cellX, cellY, cellZ);
          if (!voxel) continue;

          const voxelName = typeof voxel?.name === 'string' && voxel.name.trim()
            ? voxel.name.trim()
            : (typeof voxel?.voxelTypeId === 'string' && voxel.voxelTypeId.trim()
              ? voxel.voxelTypeId.trim()
              : '');
          const voxelColor = typeof voxel?.color === 'string' && voxel.color.trim()
            ? voxel.color.trim()
            : '#ffffff';
          if (!voxelName) continue;

          voxelEntries.push({
            position: {
              x: cellX - cellBounds.minCellX,
              y: cellY - cellBounds.minCellY,
              z: cellZ - cellBounds.minCellZ,
            },
            voxel: new Voxel({
              name: voxelName,
              color: voxelColor,
              active: true,
            }),
          });
        }
      }
    }

    if (voxelEntries.length === 0) {
      throw new Error('The selected Boxel area has no voxels to save.');
    }

    const boxel = new Boxel({
      size: boxelSize,
      name: displayName,
    }).setVoxelEntries(voxelEntries);

    return createStoredBoxel({
      assetId,
      displayName,
      boxel,
      placement: {
        anchor: {
          x: Math.floor((cellBounds.maxCellX - cellBounds.minCellX) / 2),
          y: 0,
          z: Math.floor((cellBounds.maxCellZ - cellBounds.minCellZ) / 2),
        },
        rotationY: 0,
      },
    });
  }

  function handleSaveBoxelCommand(args = []) {
    const displayName = args.join(' ').trim();
    if (!displayName) {
      throw new Error('Use /saveBoxel nameoftheboxel.');
    }

    console.log(`[Boxel Save] command: /saveBoxel ${displayName}`);
    const savedBoxel = writeLocalBoxel(createBoxelFromSelection(displayName));
    appendChatLine?.(`Saved Boxel ${savedBoxel.displayName}: ${getBoxelVoxelEntries(savedBoxel).length} voxels.`);
  }

  return {
    createBoxelFromSelection,
    getCurrentBoxelSelectionCellBounds,
    handleSaveBoxelCommand,
    handleSpawnCommand,
    loadStructureAssetByName,
    placeStructureAssetAtPlayer,
  };
}
