import { SurfaceTrinity } from "../Mesh/SurfaceTrinity.js";
import { Compass } from "../Compass.js";

export class MicroxelMesher {
    constructor(options = {}) {
        this.surfaceTrinity = options.surfaceTrinity ?? new SurfaceTrinity(options.surfaceTrinityOptions ?? {});
    }

    createFaces(voxel = null, origin = { x: 0, y: 0, z: 0 }, context = {}) {
        const size = voxel?.effectiveMicroxelSize?.() ?? 0;

        if (!voxel?.hasMicroxels?.() || size <= 1) return [];

        const cells = this.createOrientedCells(voxel, size);

        const faces = this.surfaceTrinity.createFaces({
            origin: { x: 0, y: 0, z: 0 },
            forEachCell: (callback) => {
                cells.forEach((entry) => {
                    callback(entry.cell, entry.x, entry.y, entry.z);
                });
            },
            isSolidAt: (x, y, z) => {
                if (this.isInside(size, x, y, z)) {
                    return cells.has(this.key(x, y, z));
                }

                return this.isOuterNeighborSolid(origin, { x, y, z }, size, context);
            },
            getColor: (cell) => cell?.color ?? voxel.color ?? "#ffffff",
        });

        return faces.map((face) => this.scaleFace(face, origin, size));
    }

    isInside(size, x, y, z) {
        return x >= 0 && x < size
            && y >= 0 && y < size
            && z >= 0 && z < size;
    }

    createOrientedCells(voxel = null, size = 0) {
        const cells = new Map();
        const orientation = Compass.normalize(voxel?.orientation) ?? Compass.NORTH;
        const gridSize = { x: size, y: size, z: size };

        voxel?.forEachMicroxel?.((cell, x, y, z) => {
            if (!cell?.active) return;

            const position = Compass.rotatePositionInSize({ x, y, z }, gridSize, orientation);
            cells.set(this.key(position.x, position.y, position.z), {
                cell,
                x: position.x,
                y: position.y,
                z: position.z,
            });
        });

        return cells;
    }

    key(x = 0, y = 0, z = 0) {
        return `${x},${y},${z}`;
    }

    isOuterNeighborSolid(origin, position, size, context = {}) {
        const world = { ...origin };

        if (position.x < 0) world.x -= 1;
        else if (position.x >= size) world.x += 1;
        else if (position.y < 0) world.y -= 1;
        else if (position.y >= size) world.y += 1;
        else if (position.z < 0) world.z -= 1;
        else if (position.z >= size) world.z += 1;
        else return false;

        return context.isWorldVoxelSolid?.(world.x, world.y, world.z) === true;
    }

    scaleFace(face, origin, size) {
        const unit = 1 / size;
        const scaled = {
            ...face,
            width: face.width * unit,
            height: face.height * unit,
        };

        if (face.direction === "px" || face.direction === "nx") {
            scaled.plane = origin.x + face.plane * unit;
            scaled.u = origin.z + face.u * unit;
            scaled.v = origin.y + face.v * unit;
            return scaled;
        }

        if (face.direction === "py" || face.direction === "ny") {
            scaled.plane = origin.y + face.plane * unit;
            scaled.u = origin.x + face.u * unit;
            scaled.v = origin.z + face.v * unit;
            return scaled;
        }

        scaled.plane = origin.z + face.plane * unit;
        scaled.u = origin.x + face.u * unit;
        scaled.v = origin.y + face.v * unit;

        return scaled;
    }
}

export default MicroxelMesher;
