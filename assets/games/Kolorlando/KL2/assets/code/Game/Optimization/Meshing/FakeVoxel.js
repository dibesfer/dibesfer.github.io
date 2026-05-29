import * as THREE from "three";

export class FakeVoxel {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "FakeVoxelGroupPaused";
    this.group.visible = false;
  }

  place() {}
  quit() {}
  clearBoxel() {}
  clear() {}
  dispose() {}
}

export default FakeVoxel;
