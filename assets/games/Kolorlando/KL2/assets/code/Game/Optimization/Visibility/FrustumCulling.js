import * as THREE from "three";

export class FrustumCulling {
  constructor({ camera = null, mapper = null, memoryDistance = 18, padding = 2 } = {}) {
    this.camera = camera;
    this.mapper = mapper;
    this.memoryDistance = memoryDistance;
    this.padding = padding;
    this.visible = new Set();
    this.version = 0;

    this.frustum = new THREE.Frustum();
    this.matrix = new THREE.Matrix4();
    this.lastMatrix = new THREE.Matrix4();
    this.box = new THREE.Box3();
    this.min = new THREE.Vector3();
    this.max = new THREE.Vector3();
  }

  refresh(camera = this.camera) {
    if (!camera) return;

    this.camera = camera;
    camera.updateMatrixWorld();
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (this.lastMatrix.equals(this.matrix)) return;

    this.frustum.setFromProjectionMatrix(this.matrix);
    this.lastMatrix.copy(this.matrix);
    this.version += 1;
  }

  canRender(boxel, key) {
    const canRender = this.intersectsBoxel(boxel);

    if (key) {
      if (canRender) this.visible.add(key);
      else this.visible.delete(key);
    }

    return canRender;
  }

  forget(key) {
    this.visible.delete(key);
  }

  shouldKeepLoaded(boxel, playerPosition) {
    return this.intersectsBoxel(boxel) || this.isNearPlayer(boxel, playerPosition);
  }

  intersectsBoxel(boxel) {
    if (!this.mapper || !boxel) return true;

    this.setBoxelBounds(boxel);
    return this.frustum.intersectsBox(this.box);
  }

  isNearPlayer(boxel, playerPosition) {
    if (!this.mapper || !boxel || !playerPosition) return false;
    const center = this.boxelCenter(boxel);
    const dx = center.x - playerPosition.x;
    const dz = center.z - playerPosition.z;

    return dx * dx + dz * dz <= this.memoryDistance * this.memoryDistance;
  }

  setBoxelBounds(boxel) {
    const size = this.mapper.woxel.boxelSize;
    const origin = this.mapper.toRenderPosition(boxel.position);

    this.min.set(
      origin.x - 0.5 - this.padding,
      origin.y - 0.5 - this.padding,
      origin.z - 0.5 - this.padding
    );
    this.max.set(
      origin.x + size - 0.5 + this.padding,
      origin.y + size - 0.5 + this.padding,
      origin.z + size - 0.5 + this.padding
    );
    this.box.set(this.min, this.max);
  }

  boxelCenter(boxel) {
    const half = (this.mapper.woxel.boxelSize - 1) / 2;

    return this.mapper.toRenderPosition({
      x: boxel.position.x + half,
      y: boxel.position.y + half,
      z: boxel.position.z + half
    });
  }
}

export default FrustumCulling;
