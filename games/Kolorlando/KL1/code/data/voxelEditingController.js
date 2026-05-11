export function createVoxelEditingController({
  worldEditor = null,
  inventoryUI = null,
  getUseWorldEditorVoxelMode = () => false,
  getCanEditCurrentVoxelWorld = () => false,
  getPlayerCollider = () => null,
  resolveRaycastLabel = () => '',
  createVoxelFromType = () => null,
  orientPlacedVoxelFromHit = (_hit, voxel) => voxel,
  removeVoxelAtRaycastHit = () => false,
  addVoxelAtRaycastHit = () => false,
  syncWorldVoxelRemovedAtCell = () => false,
  syncWorldVoxelAddedAtCell = () => false,
  recordLocalVoxelRemoved = () => {},
  recordLocalVoxelAdded = () => {},
  getLocalWorldSaveStore = () => null,
  getMultiplayerWorldStore = () => null,
  isSurvivalMode = () => false,
  invalidateVoxelRaycast = () => {},
  refreshVoxelRaycast = () => {},
} = {}) {
  function removeVoxelFromHit(hit = null) {
    if (!getCanEditCurrentVoxelWorld()) return false;

    const useWorldEditorVoxelMode = getUseWorldEditorVoxelMode();
    const removedVoxelType = resolveRaycastLabel(hit);
    const removedResult = useWorldEditorVoxelMode
      ? worldEditor?.removeVoxelFromHit?.(hit)
      : null;
    const removedVoxelCell = removedResult ?? worldEditor?.getTargetVoxelCell?.(hit);
    const removed = useWorldEditorVoxelMode
      ? Boolean(removedResult && syncWorldVoxelRemovedAtCell(
        removedResult.cellX,
        removedResult.cellY,
        removedResult.cellZ,
        { immediateSolidChunkJobs: false }
      ))
      : removeVoxelAtRaycastHit(hit);

    if (!removed || !removedVoxelType) return false;

    if (removedVoxelCell && getLocalWorldSaveStore()) {
      recordLocalVoxelRemoved(
        removedVoxelCell.cellX,
        removedVoxelCell.cellY,
        removedVoxelCell.cellZ
      );
    }

    const multiplayerWorldStore = getMultiplayerWorldStore();
    if (removedVoxelCell && multiplayerWorldStore) {
      multiplayerWorldStore.recordVoxelRemoved(
        removedVoxelCell.cellX,
        removedVoxelCell.cellY,
        removedVoxelCell.cellZ
      ).catch(error => {
        console.error('Failed to persist the Kolorlando multiplayer voxel removal.', error);
      });
    }

    if (isSurvivalMode()) {
      inventoryUI?.addItemToInventory?.(removedVoxelType, 1);
    } else if (!inventoryUI?.inventoryHasType?.(removedVoxelType)) {
      inventoryUI?.addCreativeInventoryItem?.(removedVoxelType);
    }

    invalidateVoxelRaycast();
    refreshVoxelRaycast(true);
    return true;
  }

  function placeVoxelFromHit(hit = null) {
    if (!getCanEditCurrentVoxelWorld()) return false;

    const selectedVoxelType = inventoryUI?.getSelectedPlaceableVoxelType?.();
    if (!selectedVoxelType) return false;

    const useWorldEditorVoxelMode = getUseWorldEditorVoxelMode();
    let addedVoxelCell = null;
    const added = useWorldEditorVoxelMode
      ? (() => {
        const selectedWorldVoxel = createVoxelFromType(selectedVoxelType);
        if (!selectedWorldVoxel) return false;
        orientPlacedVoxelFromHit(hit, selectedWorldVoxel);

        const addedResult = worldEditor?.setVoxelFromHit?.(
          hit,
          selectedWorldVoxel,
          { playerCollider: getPlayerCollider() }
        );
        if (!addedResult) return false;
        addedVoxelCell = addedResult;

        return syncWorldVoxelAddedAtCell(
          addedResult.cellX,
          addedResult.cellY,
          addedResult.cellZ,
          { immediateSolidChunkJobs: false }
        );
      })()
      : (() => {
        addedVoxelCell = worldEditor?.getAdjacentTargetVoxelCell?.(hit);
        if (!addedVoxelCell) return false;
        return addVoxelAtRaycastHit(hit, {
          playerCollider: getPlayerCollider(),
          voxelType: selectedVoxelType,
        });
      })();

    if (!added) return false;

    if (getLocalWorldSaveStore()) {
      recordLocalVoxelAdded(
        addedVoxelCell.cellX,
        addedVoxelCell.cellY,
        addedVoxelCell.cellZ,
        selectedVoxelType
      );
    }

    const multiplayerWorldStore = getMultiplayerWorldStore();
    if (addedVoxelCell && multiplayerWorldStore) {
      multiplayerWorldStore.recordVoxelAdded(
        addedVoxelCell.cellX,
        addedVoxelCell.cellY,
        addedVoxelCell.cellZ,
        selectedVoxelType
      ).catch(error => {
        console.error('Failed to persist the Kolorlando multiplayer voxel addition.', error);
      });
    }

    if (isSurvivalMode()) {
      inventoryUI?.consumeSelectedInventoryItem?.(1);
    }

    invalidateVoxelRaycast();
    refreshVoxelRaycast(true);
    return true;
  }

  return {
    removeVoxelFromHit,
    placeVoxelFromHit,
  };
}
