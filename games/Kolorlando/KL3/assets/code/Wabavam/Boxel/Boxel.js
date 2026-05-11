import { Compass } from "../Compass.js";
import { rotateVoxelOrientation } from "../Voxel/VoxelOrienting.js";

export class Boxel {
    constructor(options = {}) {
        this.name = options.name ?? "Boxel";
        this.size = {
            x: options.size?.x ?? 1,
            y: options.size?.y ?? 1,
            z: options.size?.z ?? 1,
        };
        this.position = {
            x: options.position?.x ?? 0,
            y: options.position?.y ?? 0,
            z: options.position?.z ?? 0,
        };
        this.orientation = Compass.normalize(options.orientation ?? Compass.NORTH) ?? Compass.NORTH;

        this.voxels = new Map();
    }

    key(x, y, z) {
        return `${x},${y},${z}`;
    }

    isInside(x, y, z) {
        return x >= 0 && x < this.size.x
            && y >= 0 && y < this.size.y
            && z >= 0 && z < this.size.z;
    }

    setVoxel(x, y, z, voxel = null) {
        if (!this.isInside(x, y, z)) return false;

        const key = this.key(x, y, z);

        if (!voxel) {
            this.voxels.delete(key);
            return true;
        }

        this.voxels.set(key, voxel);
        return true;
    }

    getVoxel(x, y, z) {
        if (!this.isInside(x, y, z)) return null;

        return this.voxels.get(this.key(x, y, z)) ?? null;
    }

    forEachVoxel(callback) {
        this.voxels.forEach((voxel, key) => {
            const [x, y, z] = key.split(",").map(Number);

            callback(voxel, x, y, z, this);
        });
    }

    transformed(delta = Compass.NORTH, options = {}) {
        const amount = Compass.normalize(delta) ?? Compass.NORTH;
        const size = Compass.rotateSize(this.size, amount);
        const boxel = new Boxel({
            name: options.name ?? `${this.name} Transformed`,
            size,
            position: options.position ?? { x: 0, y: 0, z: 0 },
            orientation: Compass.combine(this.orientation, amount),
        });

        let voxelCount = 0;

        this.forEachVoxel((voxel, x, y, z) => {
            const position = Compass.rotatePositionInSize({ x, y, z }, this.size, amount);
            const clone = voxel?.clone?.() ?? voxel;
            rotateVoxelOrientation(clone, amount);

            boxel.setVoxel(position.x, position.y, position.z, clone);
            voxelCount++;
        });

        boxel.origin = options.origin ?? this.origin ?? null;
        boxel.voxelCount = voxelCount;

        return boxel;
    }
}

export default Boxel;
