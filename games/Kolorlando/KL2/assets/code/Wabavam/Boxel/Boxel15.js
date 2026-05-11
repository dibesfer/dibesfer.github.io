import Boxel from "./Boxel.js";

export class Boxel15 extends Boxel {
  constructor({ name = "", persisted = false, position = { x: 0, y: 0, z: 0 }, voxels = [] } = {}) {
    super({ name, persisted, position, voxels });
    this.size = 15;
  }
}

export default Boxel15;

