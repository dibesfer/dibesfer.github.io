import * as THREE from "three";

export class VoxelHighlight {
  constructor() {
    this.faceOffset = 0.535;

    this.instance = new THREE.Group();
    this.instance.name = "VoxelHighlightGroup";
    this.instance.visible = false;
    this.instance.raycast = () => {};

    this.box = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 1.06, 1.06),
      new THREE.MeshBasicMaterial({
        color: 0xffff00,
        opacity: 0.10,
        transparent: true,
        depthWrite: false
      })
    );

    this.box.name = "VoxelHighlightBox";
    this.box.raycast = () => {};

    this.face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.04, 1.04),
      new THREE.MeshBasicMaterial({
        color: 0xffff00,
        opacity: 0.15,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );

    this.face.name = "VoxelFaceHighlight";
    this.face.raycast = () => {};

    this.normal = new THREE.Vector3();
    this.facePosition = new THREE.Vector3();
    this.faceQuaternion = new THREE.Quaternion();
    this.defaultFaceNormal = new THREE.Vector3(0, 0, 1);
    this.hitPoint = new THREE.Vector3();

    this.instance.add(this.box);
    this.instance.add(this.face);
  }

  show(hit) {
    const voxel = this.hitVoxel(hit);

    // Golden rule for this visual helper:
    // no valid voxel, no highlight.
    // This prevents the old Boxel15-center blink when a mesh is being rebuilt.
    if (!this.isUsableVoxel(voxel)) return this.hide();

    const position = hit.object.userData.toRenderPosition?.(voxel.position);
    if (!position) return this.hide();

    this.instance.position.set(position.x, position.y, position.z);
    this.showFace(hit);
    this.instance.visible = true;
  }

  showFace(hit) {
    const normal = this.hitNormal(hit);

    if (!normal) {
      this.face.visible = false;
      return;
    }

    this.facePosition.copy(normal).multiplyScalar(this.faceOffset);
    this.face.position.copy(this.facePosition);

    this.faceQuaternion.setFromUnitVectors(this.defaultFaceNormal, normal);
    this.face.quaternion.copy(this.faceQuaternion);

    this.face.visible = true;
  }

  hitNormal(hit) {
    if (!hit?.face?.normal) return null;

    this.normal.copy(hit.face.normal);

    if (hit.object?.matrixWorld) {
      this.normal.transformDirection(hit.object.matrixWorld);
    }

    this.normal.set(
      Math.round(this.normal.x),
      Math.round(this.normal.y),
      Math.round(this.normal.z)
    );

    if (this.normal.lengthSq() === 0) return null;

    return this.normal.normalize();
  }

  hitVoxel(hit) {
    if (this.isUsableVoxel(hit?.voxel) && (hit.isExactVoxelHit || hit.isFullVoxelFallback)) return hit.voxel;

    const pointVoxel = this.hitPointVoxel(hit);
    if (this.isUsableVoxel(pointVoxel)) return pointVoxel;

    // Do not fall back to faceVoxels here.
    // Greedy mesh faces can represent a large merged surface, so faceVoxels are
    // good for metadata fallback but bad for precise visual highlight placement.
    return null;
  }

  hitPointVoxel(hit) {
    if (!hit?.point || !hit.face?.normal) return null;

    this.hitPoint.copy(hit.point).addScaledVector(hit.face.normal, -0.01);

    const position = hit.object?.userData?.toVoxelPosition?.(this.hitPoint);

    return position ? hit.object.userData.voxelAt?.(position) : null;
  }

  hitFaceVoxel(hit) {
    const faceIndex = Math.floor((hit?.faceIndex ?? -1) / 2);

    if (faceIndex < 0) return null;

    return hit?.object?.userData?.faceVoxels?.[faceIndex] || null;
  }

  isUsableVoxel(voxel = null) {
    return Boolean(
      voxel
      && voxel.active !== false
      && voxel.position
      && Number.isFinite(Number(voxel.position.x))
      && Number.isFinite(Number(voxel.position.y))
      && Number.isFinite(Number(voxel.position.z))
    );
  }

  hide() {
    this.instance.visible = false;
    this.face.visible = false;
  }
}

export default VoxelHighlight;
