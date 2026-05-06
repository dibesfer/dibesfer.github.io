import { Boxel15 } from "/assets/code/Wabavam/Boxel/Boxel15.js";

export class Woxel {
    constructor(options = {}) {
        this.name = options.name ?? "Woxel";
        this.size = {
            x: options.size?.x ?? 15,
            y: options.size?.y ?? 15,
            z: options.size?.z ?? 15,
        };
        this.land = {
            x: options.land?.x ?? this.size.x,
            y: options.land?.y ?? Math.floor(this.size.y / 2),
            z: options.land?.z ?? this.size.z,
        };
        this.spawnPosition = {
            x: options.spawnPosition?.x ?? 0,
            y: options.spawnPosition?.y ?? this.land.y,
            z: options.spawnPosition?.z ?? 0,
        };

        this.boxels = [];
        this.boxelsByPosition = new Map();
    }

    getBoxel15Counts() {
        return {
            x: Math.ceil(this.size.x / Boxel15.size),
            y: Math.ceil(this.size.y / Boxel15.size),
            z: Math.ceil(this.size.z / Boxel15.size),
        };
    }

    createRequiredBoxel15s() {
        this.clearBoxels();

        const counts = this.getBoxel15Counts();

        for (let boxelX = 0; boxelX < counts.x; boxelX++) {
            for (let boxelY = 0; boxelY < counts.y; boxelY++) {
                for (let boxelZ = 0; boxelZ < counts.z; boxelZ++) {
                    this.addBoxel(new Boxel15({
                        position: {
                            x: boxelX * Boxel15.size,
                            y: boxelY * Boxel15.size,
                            z: boxelZ * Boxel15.size,
                        },
                    }));
                }
            }
        }

        return this.boxels;
    }

    clearBoxels() {
        this.boxels = [];
        this.boxelsByPosition.clear();
    }

    addBoxel(boxel) {
        if (!boxel) return null;

        this.boxels.push(boxel);
        this.boxelsByPosition.set(this.boxelPositionKey(boxel.position.x, boxel.position.y, boxel.position.z), boxel);

        return boxel;
    }

    getBoxels() {
        return this.boxels;
    }

    boxelPositionKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    worldToBoxelOrigin(value) {
        return Math.floor(value / Boxel15.size) * Boxel15.size;
    }

    getBoxelAtWorld(x, y, z) {
        if (!this.isInside(x, y, z)) return null;

        const originX = this.worldToBoxelOrigin(x);
        const originY = this.worldToBoxelOrigin(y);
        const originZ = this.worldToBoxelOrigin(z);

        return this.boxelsByPosition.get(this.boxelPositionKey(originX, originY, originZ)) ?? null;
    }

    gameToGrid(position = {}) {
        return {
            x: Math.floor((position.x ?? 0) + this.size.x / 2),
            y: Math.floor(position.y ?? 0),
            z: Math.floor((position.z ?? 0) + this.size.z / 2),
        };
    }

    gridToGame(position = {}) {
        return {
            x: (position.x ?? 0) - this.size.x / 2,
            y: position.y ?? 0,
            z: (position.z ?? 0) - this.size.z / 2,
        };
    }

    getGridOriginAsGamePosition() {
        return this.gridToGame({ x: 0, y: 0, z: 0 });
    }

    getSpawnPositionGame() {
        return { ...this.spawnPosition };
    }

    getLandTopY() {
        return Math.min(this.land.y, this.size.y);
    }

    isInside(x, y, z) {
        return x >= 0 && x < this.size.x
            && y >= 0 && y < this.size.y
            && z >= 0 && z < this.size.z;
    }

    isInsideGame(position = {}) {
        const grid = this.gameToGrid(position);

        return this.isInside(grid.x, grid.y, grid.z);
    }

    setVoxelAt(x, y, z, voxel = null) {
        if (!this.isInside(x, y, z)) return false;

        const boxel = this.getBoxelAtWorld(x, y, z);
        if (!boxel) return false;

        return boxel.setVoxel(
            x - boxel.position.x,
            y - boxel.position.y,
            z - boxel.position.z,
            voxel
        );
    }

    getVoxelAt(x, y, z) {
        if (!this.isInside(x, y, z)) return null;

        const boxel = this.getBoxelAtWorld(x, y, z);
        if (!boxel) return null;

        return boxel.getVoxel(
            x - boxel.position.x,
            y - boxel.position.y,
            z - boxel.position.z
        );
    }

    forEachBoxel(callback) {
        this.boxels.forEach((boxel) => {
            callback(boxel, this);
        });
    }

    forEachVoxel(callback) {
        this.boxels.forEach((boxel) => {
            boxel.forEachVoxel((voxel, localX, localY, localZ) => {
                callback(
                    voxel,
                    boxel.position.x + localX,
                    boxel.position.y + localY,
                    boxel.position.z + localZ,
                    boxel
                );
            });
        });
    }
}

export default Woxel;
