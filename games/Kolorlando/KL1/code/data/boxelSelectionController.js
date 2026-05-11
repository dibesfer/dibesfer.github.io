import * as THREE from 'three';

export function createBoxelSelectionController({
  anchorMesh = null,
  rangeMesh = null,
  rangePadding = 0,
  isSelectionToolSelected = () => false,
  getVoxelBoxFromRaycastHit = () => null,
  getAdjacentVoxelBoxFromRaycastHit = () => null,
} = {}) {
  const anchorBox = new THREE.Box3();
  const rangeBox = new THREE.Box3();
  const combinedBox = new THREE.Box3();
  const inputBox = new THREE.Box3();
  const combinedSize = new THREE.Vector3();
  const combinedCenter = new THREE.Vector3();

  function clear() {
    if (anchorMesh) anchorMesh.visible = false;
    if (rangeMesh) rangeMesh.visible = false;
    anchorBox.makeEmpty();
    rangeBox.makeEmpty();
    combinedBox.makeEmpty();
  }

  function syncVisibility() {
    const selected = isSelectionToolSelected();
    if (anchorMesh) {
      anchorMesh.visible = selected && anchorBox.isEmpty() === false;
    }
    if (rangeMesh) {
      rangeMesh.visible = selected
        && rangeBox.isEmpty() === false
        && combinedBox.isEmpty() === false;
    }
  }

  function placeFromBox(clickedVoxelBox = null) {
    if (!clickedVoxelBox || clickedVoxelBox.isEmpty()) {
      clear();
      return false;
    }

    if (anchorBox.isEmpty()) {
      anchorBox.copy(clickedVoxelBox);
      rangeBox.makeEmpty();
      combinedBox.makeEmpty();
      if (anchorMesh) {
        anchorBox.getCenter(anchorMesh.position);
      }
      if (rangeMesh) rangeMesh.visible = false;
      syncVisibility();
      return true;
    }

    if (rangeBox.isEmpty() === false) {
      if (anchorMesh) {
        rangeBox.getCenter(anchorMesh.position);
      }
      anchorBox.copy(rangeBox);
    }

    rangeBox.copy(clickedVoxelBox);
    combinedBox.copy(anchorBox).union(rangeBox);
    combinedBox.getSize(combinedSize);
    combinedBox.getCenter(combinedCenter);

    if (rangeMesh) {
      rangeMesh.position.copy(combinedCenter);
      rangeMesh.scale.set(
        combinedSize.x + rangePadding,
        combinedSize.y + rangePadding,
        combinedSize.z + rangePadding
      );
    }

    syncVisibility();
    return true;
  }

  function placeFromHit(hit = null) {
    if (!hit || !getVoxelBoxFromRaycastHit(hit, inputBox)) {
      clear();
      return false;
    }

    return placeFromBox(inputBox);
  }

  function placeFromAdjacentHit(hit = null) {
    const adjacentVoxelBox = getAdjacentVoxelBoxFromRaycastHit(hit, inputBox);
    if (!adjacentVoxelBox) {
      clear();
      return false;
    }

    return placeFromBox(adjacentVoxelBox);
  }

  function getSelectionSourceBox() {
    return combinedBox.isEmpty() ? anchorBox : combinedBox;
  }

  return {
    clear,
    syncVisibility,
    placeFromHit,
    placeFromAdjacentHit,
    getSelectionSourceBox,
  };
}
