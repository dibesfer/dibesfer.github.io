import Boxel15 from "../Boxel/Boxel15.js";

export class Woxel {
  constructor({
    name = "Example",
    size = { x: 250, y: 250, z: 250 },
    land = { x: 250, y: 50, z: 250 },
    landVoxel = null,
    spawnPosition = { x: 0, y: 53, z: 0 },
    boxels = []
  } = {}) {
    this.name = name;
    this.boxel = Boxel15;
    this.size = { ...size };
    this.land = { ...land };
    this.landVoxel = landVoxel;
    this.spawnPosition = spawnPosition || { x: 0, y: this.land.y + 3, z: 0 };
    this.boxelSize = 15;
    this.boxelUnits = this.toBoxelUnits(this.size);
    this.landBoxelUnits = this.toBoxelUnits(this.land);
    this.boxels = boxels;
  }

  toBoxelUnits(size) {
    return {
      x: Math.ceil(size.x / this.boxelSize),
      y: Math.ceil(size.y / this.boxelSize),
      z: Math.ceil(size.z / this.boxelSize)
    };
  }
}

export default Woxel;

