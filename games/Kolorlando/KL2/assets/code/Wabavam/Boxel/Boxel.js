import Voxel from "../Voxel/Voxel.js";
import {
  ORIENTATION_DIRECTIONS,
  orientationData
} from "../Voxel/Orientation.js";

export class Boxel {
  constructor({
    name = "",
    persisted = false,
    position = { x: 0, y: 0, z: 0 },
    orientation = null,
    voxels = []
  } = {}) {
    this.name = name;
    this.persisted = persisted;
    this.position = { ...position };

    // FAKE orientation.
    // Temporary placement intent only.
    // Never world truth.
    this.orientation = orientation;

    this.voxels = voxels.map(voxel => voxel instanceof Voxel ? voxel : new Voxel(voxel));
  }

  clone() {
    return new Boxel({
      name: this.name,
      persisted: this.persisted,
      position: { ...this.position },
      orientation: this.orientation,
      voxels: this.voxels.map(voxel => voxel.clone?.() || new Voxel(voxel.toJSON?.() || voxel))
    });
  }

  orientedForPlacement(orientation = null) {
    const placementOrientation = orientationData(orientation);
    const steps = normalizeSteps(placementOrientation.steps);
    const bounds = this.bounds();

    return new Boxel({
      name: this.name,
      persisted: this.persisted,
      position: { ...this.position },
      orientation: null,
      voxels: this.voxels.map(voxel => this.orientedPlacementVoxel(voxel, bounds, steps))
    });
  }

  normalizedForSave(orientation = null) {
    const placementOrientation = orientationData(orientation);
    const inverseSteps = normalizeSteps(-placementOrientation.steps);
    const bounds = this.bounds();

    return new Boxel({
      name: this.name,
      persisted: this.persisted,
      position: { ...this.position },
      orientation: null,
      voxels: this.voxels.map(voxel => this.orientedPlacementVoxel(voxel, bounds, inverseSteps))
    });
  }

  orientedPlacementVoxel(voxel, bounds, steps = 0) {
    const nextVoxel = voxel.clone?.() || new Voxel(voxel.toJSON?.() || voxel);

    // This ALWAYS happens.
    // Orientable or not.
    const nextPosition = this.rotatedPosition(nextVoxel.position, bounds, steps);

    nextVoxel.setPosition(nextPosition.x, nextPosition.y, nextPosition.z);

    // This ONLY happens for orientable voxels.
    if (nextVoxel.isOrientable?.()) {
      nextVoxel.setOrientation(this.composedVoxelOrientation(nextVoxel, steps));
    }

    return nextVoxel;
  }

  composedVoxelOrientation(voxel, boxelSteps = 0) {
    const voxelOrientation = orientationData(voxel.orientation);
    const steps = normalizeSteps(voxelOrientation.steps + boxelSteps);

    return orientationData(directionFromSteps(steps));
  }

  rotatedPosition(position = {}, bounds = this.bounds(), steps = 0) {
    const normalizedSteps = normalizeSteps(steps);
    const source = normalizePosition(position);

    const min = bounds.min;
    const max = bounds.max;

    const local = {
      x: source.x - min.x,
      y: source.y - min.y,
      z: source.z - min.z
    };

    const size = {
      x: max.x - min.x,
      z: max.z - min.z
    };

    // NORTH / default
    if (normalizedSteps === 0) {
      return {
        x: min.x + local.x,
        y: min.y + local.y,
        z: min.z + local.z
      };
    }

    // EAST / 90º
    if (normalizedSteps === 1) {
      return {
        x: min.x + size.z - local.z,
        y: min.y + local.y,
        z: min.z + local.x
      };
    }

    // SOUTH / 180º
    if (normalizedSteps === 2) {
      return {
        x: min.x + size.x - local.x,
        y: min.y + local.y,
        z: min.z + size.z - local.z
      };
    }

    // WEST / 270º
    return {
      x: min.x + local.z,
      y: min.y + local.y,
      z: min.z + size.x - local.x
    };
  }

  bounds() {
    if (this.voxels.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      };
    }

    return this.voxels.reduce((bounds, voxel) => {
      const position = normalizePosition(voxel.position);

      return {
        min: {
          x: Math.min(bounds.min.x, position.x),
          y: Math.min(bounds.min.y, position.y),
          z: Math.min(bounds.min.z, position.z)
        },
        max: {
          x: Math.max(bounds.max.x, position.x),
          y: Math.max(bounds.max.y, position.y),
          z: Math.max(bounds.max.z, position.z)
        }
      };
    }, {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity }
    });
  }
}

function normalizePosition(position = {}) {
  return {
    x: Math.floor(Number(position.x) || 0),
    y: Math.floor(Number(position.y) || 0),
    z: Math.floor(Number(position.z) || 0)
  };
}

function normalizeSteps(steps = 0) {
  return ((Math.round(Number(steps) || 0) % 4) + 4) % 4;
}

function directionFromSteps(steps = 0) {
  return [
    ORIENTATION_DIRECTIONS.NORTH,
    ORIENTATION_DIRECTIONS.EAST,
    ORIENTATION_DIRECTIONS.SOUTH,
    ORIENTATION_DIRECTIONS.WEST
  ][normalizeSteps(steps)] || ORIENTATION_DIRECTIONS.NORTH;
}

export default Boxel;
