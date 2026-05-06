export class Collision {
    constructor(options = {}) {
        this.woxel = options.woxel ?? null;
        this.epsilon = options.epsilon ?? 0.000001;
        this.boundaryAsSolid = options.boundaryAsSolid ?? true;

        this.defaultBody = {
            width: options.body?.width ?? 0.8,
            height: options.body?.height ?? 1.8,
            depth: options.body?.depth ?? 0.8,
        };
    }

    setWoxel(woxel) {
        this.woxel = woxel ?? null;
    }

    createAABBFromFeet(position, body = this.defaultBody) {
        const halfWidth = body.width / 2;
        const halfDepth = body.depth / 2;

        return {
            minX: position.x - halfWidth,
            maxX: position.x + halfWidth,
            minY: position.y,
            maxY: position.y + body.height,
            minZ: position.z - halfDepth,
            maxZ: position.z + halfDepth,
        };
    }

    createFeetFromAABB(aabb) {
        return {
            x: (aabb.minX + aabb.maxX) / 2,
            y: aabb.minY,
            z: (aabb.minZ + aabb.maxZ) / 2,
        };
    }

    moveFeet(position, movement, body = this.defaultBody) {
        const startAABB = this.createAABBFromFeet(position, body);
        const result = this.moveAABB(startAABB, movement);

        return {
            position: this.createFeetFromAABB(result.aabb),
            movement: result.movement,
            blocked: result.blocked,
            grounded: result.grounded,
        };
    }

    moveAABB(aabb, movement) {
        let current = { ...aabb };

        const result = {
            movement: { x: 0, y: 0, z: 0 },
            blocked: { x: false, y: false, z: false },
            grounded: false,
        };

        current = this.tryMoveAxis(current, "x", movement.x ?? 0, result);
        current = this.tryMoveAxis(current, "y", movement.y ?? 0, result);
        current = this.tryMoveAxis(current, "z", movement.z ?? 0, result);

        result.aabb = current;
        result.grounded = result.blocked.y && (movement.y ?? 0) < 0;

        return result;
    }

    tryMoveAxis(aabb, axis, amount, result) {
        if (amount === 0) return aabb;

        const moved = this.translateAABB(aabb, axis, amount);

        if (!this.hasSolidVoxelInAABB(moved)) {
            result.movement[axis] = amount;
            return moved;
        }

        result.blocked[axis] = true;
        return aabb;
    }

    translateAABB(aabb, axis, amount) {
        const moved = { ...aabb };

        if (axis === "x") {
            moved.minX += amount;
            moved.maxX += amount;
        }

        if (axis === "y") {
            moved.minY += amount;
            moved.maxY += amount;
        }

        if (axis === "z") {
            moved.minZ += amount;
            moved.maxZ += amount;
        }

        return moved;
    }

    hasSolidVoxelInAABB(aabb, woxel = this.woxel) {
        if (!woxel) return false;

        const range = this.getVoxelRangeFromAABB(aabb, woxel);

        for (let x = range.minX; x <= range.maxX; x++) {
            for (let y = range.minY; y <= range.maxY; y++) {
                for (let z = range.minZ; z <= range.maxZ; z++) {
                    if (this.isSolidVoxelAt(x, y, z, woxel)) return true;
                }
            }
        }

        return false;
    }

    getSolidVoxelsInAABB(aabb, woxel = this.woxel) {
        const solids = [];
        if (!woxel) return solids;

        const range = this.getVoxelRangeFromAABB(aabb, woxel);

        for (let x = range.minX; x <= range.maxX; x++) {
            for (let y = range.minY; y <= range.maxY; y++) {
                for (let z = range.minZ; z <= range.maxZ; z++) {
                    if (!this.isSolidVoxelAt(x, y, z, woxel)) continue;

                    solids.push({ x, y, z });
                }
            }
        }

        return solids;
    }

    getVoxelRangeFromAABB(aabb, woxel = this.woxel) {
        const min = woxel.gameToGrid({
            x: aabb.minX,
            y: aabb.minY,
            z: aabb.minZ,
        });

        const max = woxel.gameToGrid({
            x: aabb.maxX - this.epsilon,
            y: aabb.maxY - this.epsilon,
            z: aabb.maxZ - this.epsilon,
        });

        return {
            minX: min.x,
            maxX: max.x,
            minY: min.y,
            maxY: max.y,
            minZ: min.z,
            maxZ: max.z,
        };
    }

    isSolidVoxelAt(x, y, z, woxel = this.woxel) {
        if (!woxel?.isInside?.(x, y, z)) {
            return this.boundaryAsSolid;
        }

        const voxel = woxel.getVoxelAt(x, y, z);
        return voxel?.isActive?.() === true;
    }
}

export default Collision;
