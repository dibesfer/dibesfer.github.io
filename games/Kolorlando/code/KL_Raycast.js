import * as THREE from 'three';

const DEFAULT_INPUT_EPSILON_SQ = 0.000001;
const DEFAULT_POINTER_EPSILON_SQ = 0.000004;

export class KLRaycast {
  constructor({
    camera,
    raycaster,
    rayOrigin,
    rayDirection,
    rayEnd,
    raycastTargets = [],
    playerEye,
    playerBody,
    playerFacingDir,
    sceneView,
    mobileMode = () => false,
    getModeKey = () => 'default',
    isScreenDragCameraActive = () => false,
    isScreenDragCameraMode = () => false,
    isLegoLolCameraMode = () => false,
    getThirdPersonDistance = () => 0,
    resolveRaycastLabel = () => null,
    getWorldEntityRaycastHit = () => null,
    getRemotePlayerRaycastHit = () => null,
    getVoxelBoxFromRaycastHit = () => false,
    isBoxelSelectionToolSelected = () => false,
    syncVoxelHighlightStyle = () => {},
    syncBoxelSelectedVoxelHighlightVisibility = () => {},
    voxelHighlightBox,
    voxelHighlightMesh,
    cameraRayLine,
    cameraRayLineGeometry,
    cameraRayTip,
    voxelReadout,
    debugModeEnabled = () => false,
    multiplayerEnabled = false,
    entityRaycastPoint = null,
    raycastRange = 18,
    raycastStartOffset = 0.18,
    legoLolRaycastHeight = 1,
    legoLolRaycastRange = 5,
    refreshInterval = 1 / 30,
    pointerEpsilonSq = DEFAULT_POINTER_EPSILON_SQ,
    inputEpsilonSq = DEFAULT_INPUT_EPSILON_SQ,
  } = {}) {
    this.camera = camera;
    this.raycaster = raycaster;
    this.rayOrigin = rayOrigin;
    this.rayDirection = rayDirection;
    this.rayEnd = rayEnd;
    this.raycastTargets = raycastTargets;
    this.playerEye = playerEye;
    this.playerBody = playerBody;
    this.playerFacingDir = playerFacingDir;
    this.sceneView = sceneView;
    this.mobileMode = mobileMode;
    this.getModeKey = getModeKey;
    this.isScreenDragCameraActive = isScreenDragCameraActive;
    this.isScreenDragCameraMode = isScreenDragCameraMode;
    this.isLegoLolCameraMode = isLegoLolCameraMode;
    this.getThirdPersonDistance = getThirdPersonDistance;
    this.resolveRaycastLabel = resolveRaycastLabel;
    this.getWorldEntityRaycastHit = getWorldEntityRaycastHit;
    this.getRemotePlayerRaycastHit = getRemotePlayerRaycastHit;
    this.getVoxelBoxFromRaycastHit = getVoxelBoxFromRaycastHit;
    this.isBoxelSelectionToolSelected = isBoxelSelectionToolSelected;
    this.syncVoxelHighlightStyle = syncVoxelHighlightStyle;
    this.syncBoxelSelectedVoxelHighlightVisibility = syncBoxelSelectedVoxelHighlightVisibility;
    this.voxelHighlightBox = voxelHighlightBox;
    this.voxelHighlightMesh = voxelHighlightMesh;
    this.cameraRayLine = cameraRayLine;
    this.cameraRayLineGeometry = cameraRayLineGeometry;
    this.cameraRayTip = cameraRayTip;
    this.voxelReadout = voxelReadout;
    this.debugModeEnabled = debugModeEnabled;
    this.multiplayerEnabled = multiplayerEnabled;
    this.entityRaycastPoint = entityRaycastPoint;
    this.raycastRange = raycastRange;
    this.raycastStartOffset = raycastStartOffset;
    this.legoLolRaycastHeight = legoLolRaycastHeight;
    this.legoLolRaycastRange = legoLolRaycastRange;
    this.refreshInterval = refreshInterval;
    this.pointerEpsilonSq = pointerEpsilonSq;
    this.inputEpsilonSq = inputEpsilonSq;

    this.pointerNdc = new THREE.Vector2();
    this.lastCameraPosition = new THREE.Vector3();
    this.lastCameraDirection = new THREE.Vector3();
    this.lastPlayerPosition = new THREE.Vector3();
    this.trackedCameraPosition = new THREE.Vector3();
    this.trackedCameraDirection = new THREE.Vector3();
    this.trackedPlayerPosition = new THREE.Vector3();
    this.dirty = true;
    this.refreshAccumulator = refreshInterval;
    this.lastModeKey = '';
    this.pointerActive = false;
    this.lastPointerActive = false;
    this.state = {
      hit: null,
      kind: null,
      worldEntity: null,
      entity: null,
      item: null,
      voxelEditionMode: false,
      boxelEditionMode: false,
    };
  }

  invalidate() {
    this.dirty = true;
  }

  getState() {
    return this.state;
  }

  refresh(force = false, deltaTime = 0) {
    if (force) {
      this.syncTrackedInputs();
      this.update();
      this.commitInputs();
      this.refreshAccumulator = 0;
      return;
    }

    const inputsChanged = this.haveInputsChanged();
    if (!this.dirty && !inputsChanged) return;

    this.refreshAccumulator += Number.isFinite(deltaTime) ? deltaTime : 0;
    if (this.refreshAccumulator < this.refreshInterval) return;

    this.syncTrackedInputs();
    this.update();
    this.commitInputs();
    this.refreshAccumulator %= this.refreshInterval;
  }

  updatePointer(clientX, clientY) {
    if (!this.sceneView || this.mobileMode() || !this.isScreenDragCameraActive()) {
      this.setPointerActive(false);
      return;
    }

    const rect = this.sceneView.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      this.setPointerActive(false);
      return;
    }

    const previousX = this.pointerNdc.x;
    const previousY = this.pointerNdc.y;
    const wasActive = this.pointerActive;

    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerActive = this.pointerNdc.x >= -1 && this.pointerNdc.x <= 1
      && this.pointerNdc.y >= -1 && this.pointerNdc.y <= 1;

    const movedEnough =
      (this.pointerNdc.x - previousX) * (this.pointerNdc.x - previousX)
      + (this.pointerNdc.y - previousY) * (this.pointerNdc.y - previousY)
      > this.pointerEpsilonSq;

    if (this.pointerActive !== wasActive || (this.pointerActive && movedEnough)) {
      this.invalidate();
    }
  }

  clearPointer() {
    this.setPointerActive(false);
  }

  syncTrackedInputs() {
    this.camera.getWorldPosition(this.trackedCameraPosition);
    this.camera.getWorldDirection(this.trackedCameraDirection);
    this.trackedPlayerPosition.copy(this.playerEye);
  }

  haveInputsChanged() {
    const modeKey = this.getModeKey();
    this.syncTrackedInputs();

    return modeKey !== this.lastModeKey
      || this.trackedCameraPosition.distanceToSquared(this.lastCameraPosition) > this.inputEpsilonSq
      || this.trackedCameraDirection.distanceToSquared(this.lastCameraDirection) > this.inputEpsilonSq
      || this.trackedPlayerPosition.distanceToSquared(this.lastPlayerPosition) > this.inputEpsilonSq
      || this.pointerActive !== this.lastPointerActive;
  }

  commitInputs() {
    this.lastCameraPosition.copy(this.trackedCameraPosition);
    this.lastCameraDirection.copy(this.trackedCameraDirection);
    this.lastPlayerPosition.copy(this.trackedPlayerPosition);
    this.lastModeKey = this.getModeKey();
    this.lastPointerActive = this.pointerActive;
    this.dirty = false;
  }

  setPointerActive(active) {
    if (this.pointerActive === active) return;
    this.pointerActive = active;
    this.invalidate();
  }

  update() {
    const maxDistance = this.isLegoLolCameraMode()
      ? this.legoLolRaycastRange
      : this.raycastRange;
    const intersections = this.updateRay(maxDistance);
    const voxelHit = intersections.length > 0 ? intersections[0] : null;
    const voxelLabel = voxelHit ? this.resolveRaycastLabel(voxelHit) : null;
    const voxelDistance = voxelHit ? this.rayOrigin.distanceTo(voxelHit.point) : Infinity;
    const worldEntityHit = this.getWorldEntityRaycastHit(
      this.rayOrigin,
      this.rayDirection,
      maxDistance,
      this.raycaster.ray
    );
    const remotePlayerHit = this.multiplayerEnabled
      ? this.getRemotePlayerRaycastHit(
        this.rayOrigin,
        this.raycaster.ray,
        maxDistance,
        this.entityRaycastPoint
      )
      : null;
    const closestWorldEntityHit = worldEntityHit && remotePlayerHit
      ? (worldEntityHit.distance <= remotePlayerHit.distance ? worldEntityHit : remotePlayerHit)
      : (worldEntityHit ?? remotePlayerHit);

    let readoutLabel = 'none';
    let activeVoxelHit = null;
    let activeHit = null;
    let activeHitKind = null;
    let activeWorldEntity = null;

    if (voxelLabel && voxelDistance <= (closestWorldEntityHit?.distance ?? Infinity)) {
      readoutLabel = voxelLabel;
      activeVoxelHit = voxelHit;
      activeHit = voxelHit;
      activeHitKind = 'voxel';
      this.rayEnd.copy(voxelHit.point);
    } else if (closestWorldEntityHit) {
      readoutLabel = closestWorldEntityHit.label;
      activeHit = closestWorldEntityHit;
      activeHitKind = 'worldEntity';
      activeWorldEntity = closestWorldEntityHit.worldEntity ?? closestWorldEntityHit.entity ?? null;
      this.rayEnd.copy(closestWorldEntityHit.point);
    } else {
      this.rayEnd.copy(this.rayOrigin).addScaledVector(this.rayDirection, maxDistance);
    }

    this.state.hit = activeHit;
    this.state.kind = activeHitKind;
    this.state.worldEntity = activeWorldEntity;
    this.state.entity = activeWorldEntity?.typeLabel === 'Item' ? null : activeWorldEntity;
    this.state.item = activeWorldEntity?.typeLabel === 'Item' ? activeWorldEntity : null;
    this.state.voxelEditionMode = activeVoxelHit !== null;
    this.state.boxelEditionMode = activeVoxelHit !== null && this.isBoxelSelectionToolSelected();

    this.updateVoxelHighlight(activeVoxelHit);
    this.updateDebugRay();
    this.updateReadout(activeHitKind, readoutLabel, activeWorldEntity);
  }

  updateRay(maxDistance) {
    this.raycaster.far = maxDistance;

    if (this.isScreenDragCameraActive()) {
      if (!this.pointerActive) {
        this.camera.getWorldPosition(this.rayOrigin);
        this.camera.getWorldDirection(this.rayDirection);
        this.rayDirection.normalize();
        this.raycaster.set(this.rayOrigin, this.rayDirection);
        this.rayEnd.copy(this.rayOrigin);
        return [];
      }

      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      this.rayDirection.copy(this.raycaster.ray.direction).normalize();
      if (this.getThirdPersonDistance() > 0.001) {
        this.camera.getWorldPosition(this.rayOrigin);
        this.raycaster.set(this.rayOrigin, this.rayDirection);
      } else {
        this.rayOrigin.copy(this.raycaster.ray.origin);
      }
      return this.intersectTargets();
    }

    if (this.isScreenDragCameraMode()) {
      this.camera.getWorldPosition(this.rayOrigin);
      this.camera.getWorldDirection(this.rayDirection);
      this.rayDirection.normalize();
      this.raycaster.set(this.rayOrigin, this.rayDirection);
      this.rayEnd.copy(this.rayOrigin);
      return [];
    }

    if (this.isLegoLolCameraMode()) {
      if (this.playerFacingDir.lengthSq() > 0.0001) {
        this.rayDirection.copy(this.playerFacingDir);
      } else {
        this.rayDirection.set(Math.sin(this.playerBody.rotation.y), 0, Math.cos(this.playerBody.rotation.y));
      }
      this.rayDirection.y = 0;
      this.rayDirection.normalize();
      this.rayOrigin.set(this.playerEye.x, this.playerBody.position.y + this.legoLolRaycastHeight, this.playerEye.z);
      this.raycaster.set(this.rayOrigin, this.rayDirection);
      return this.intersectTargets();
    }

    this.camera.getWorldDirection(this.rayDirection);
    this.rayDirection.normalize();
    this.camera.getWorldPosition(this.rayOrigin);
    this.rayOrigin.addScaledVector(this.rayDirection, this.raycastStartOffset);
    this.raycaster.set(this.rayOrigin, this.rayDirection);
    return this.intersectTargets();
  }

  intersectTargets() {
    return this.raycastTargets.length > 0
      ? this.raycaster.intersectObjects(this.raycastTargets, true)
      : [];
  }

  updateVoxelHighlight(activeVoxelHit) {
    if (activeVoxelHit && this.getVoxelBoxFromRaycastHit(activeVoxelHit, this.voxelHighlightBox)) {
      this.syncVoxelHighlightStyle();
      this.voxelHighlightBox.getCenter(this.voxelHighlightMesh.position);
      this.voxelHighlightMesh.visible = true;
    } else if (this.voxelHighlightMesh) {
      this.voxelHighlightMesh.visible = false;
    }

    this.syncBoxelSelectedVoxelHighlightVisibility();
  }

  updateDebugRay() {
    const debugVisible = this.debugModeEnabled();
    this.cameraRayLine.visible = debugVisible;
    this.cameraRayTip.visible = debugVisible;

    const linePosition = this.cameraRayLineGeometry.attributes.position;
    linePosition.setXYZ(0, this.rayOrigin.x, this.rayOrigin.y, this.rayOrigin.z);
    linePosition.setXYZ(1, this.rayEnd.x, this.rayEnd.y, this.rayEnd.z);
    linePosition.needsUpdate = true;
    this.cameraRayLineGeometry.computeBoundingSphere();
    this.cameraRayTip.position.copy(this.rayEnd);
  }

  updateReadout(activeHitKind, readoutLabel, activeWorldEntity = null) {
    if (!this.voxelReadout) return;
    if (!activeHitKind) {
      this.voxelReadout.textContent = '';
      return;
    }

    const readoutPrefix = activeHitKind === 'worldEntity'
      ? (activeWorldEntity?.typeLabel ?? 'Entity')
      : activeHitKind === 'voxel'
        ? 'Voxel'
        : 'Target';
    this.voxelReadout.textContent = `${readoutPrefix}: ${readoutLabel}`;
  }
}
