export class InteractionBudgeter {
  constructor({
    targets = [],
    mapper = null,
    culling = null,
    visible = null,
    raycastDistance = 15,
    graceMs = 250,
    boxelCenter = null,
    isSurfaceBoxel = null,
    isMeshStable = null
  } = {}) {
    this.targets = targets;
    this.mapper = mapper;
    this.culling = culling;
    this.visible = visible;
    this.raycastDistance = raycastDistance;
    this.graceMs = graceMs;
    this.boxelCenter = boxelCenter;
    this.isSurfaceBoxel = isSurfaceBoxel;
    this.isMeshStable = isMeshStable;

    this.targetTimes = new Map();
    this.graceTargets = new Set();
  }

  configure({
    targets = this.targets,
    mapper = this.mapper,
    culling = this.culling,
    visible = this.visible,
    raycastDistance = this.raycastDistance,
    graceMs = this.graceMs
  } = {}) {
    this.targets = targets;
    this.mapper = mapper;
    this.culling = culling;
    this.visible = visible;
    this.raycastDistance = raycastDistance;
    this.graceMs = graceMs;
    return this;
  }

  updateTargets({ meshes = new Map(), playerPosition = null } = {}) {
    const now = performance.now();

    this.graceTargets.clear();

    meshes.forEach((mesh, key) => {
      const boxel = mesh?.userData?.boxel;

      if (this.canRaycast(boxel, key, playerPosition, mesh)) {
        this.targetTimes.set(key, now);
        this.addTarget(mesh);
        return;
      }

      if (this.isInGrace(key, now) && this.isStableMesh(mesh)) {
        this.graceTargets.add(key);
        this.addTarget(mesh);
        return;
      }

      this.targetTimes.delete(key);
      this.removeTarget(mesh);
    });

    return this.targets;
  }

  canRaycast(boxel = null, key = "", playerPosition = null, mesh = null) {
    if (!boxel || !key || !playerPosition) return false;
    if (!this.isVisible(key)) return false;
    if (!this.isStableMesh(mesh)) return false;
    if (!this.isInRaycastRange(boxel, playerPosition)) return false;

    return this.isSurface(boxel) || !this.culling || this.culling.intersectsBoxel(boxel);
  }

  isVisible(key = "") {
    return this.visible?.has?.(key) ?? false;
  }

  isStableMesh(mesh = null) {
    if (!mesh) return true;
    if (typeof this.isMeshStable === "function") return this.isMeshStable(mesh);

    return !mesh.userData?.dirty
      && !mesh.userData?.raycastDisabled
      && Boolean(mesh.parent)
      && Boolean(mesh.geometry)
      && !mesh.geometry.userData?.disposed;
  }

  isSurface(boxel = null) {
    if (typeof this.isSurfaceBoxel === "function") return this.isSurfaceBoxel(boxel);

    return this.mapper?.isSurfaceBoxel?.(boxel) ?? false;
  }

  isInRaycastRange(boxel = null, playerPosition = null) {
    if (!boxel || !playerPosition) return false;

    const center = this.center(boxel);
    const radius = this.raycastDistance + (this.mapper?.woxel?.boxelSize ?? 0);
    const dx = center.x - playerPosition.x;
    const dy = center.y - playerPosition.y;
    const dz = center.z - playerPosition.z;

    return dx * dx + dy * dy + dz * dz <= radius * radius;
  }

  center(boxel = null) {
    if (typeof this.boxelCenter === "function") return this.boxelCenter(boxel);

    const size = this.mapper?.woxel?.boxelSize ?? 15;
    const half = size / 2;

    return {
      x: (boxel?.position?.x ?? 0) + half,
      y: (boxel?.position?.y ?? 0) + half,
      z: (boxel?.position?.z ?? 0) + half
    };
  }

  isInGrace(key = "", now = performance.now()) {
    return now - (this.targetTimes.get(key) ?? 0) <= this.graceMs;
  }

  addTarget(mesh = null) {
    if (!mesh || this.targets.includes(mesh)) return;

    this.targets.push(mesh);
  }

  removeTarget(mesh = null) {
    const index = this.targets.indexOf(mesh);

    if (index !== -1) this.targets.splice(index, 1);
  }

  forget(key = "", mesh = null) {
    this.targetTimes.delete(key);
    this.graceTargets.delete(key);
    this.removeTarget(mesh);
  }

  hasGraceTargets() {
    return this.graceTargets.size > 0;
  }

  profile() {
    return {
      targets: this.targets.length,
      graceTargets: this.graceTargets.size,
      rememberedTargets: this.targetTimes.size,
      raycastDistance: this.raycastDistance,
      graceMs: this.graceMs
    };
  }
}

export default InteractionBudgeter;
