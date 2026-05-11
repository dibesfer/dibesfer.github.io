import * as THREE from "three";

export class LocalPatch {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "LocalPatchGroupPaused";
    this.group.visible = false;
  }

  applyLastMapperEdit() {}
  clearBoxel() {}
  clear() {}
  dispose() {}
}

export default LocalPatch;
