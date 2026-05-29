import { Boxel } from "../Boxel.js";

export class Boxel15 extends Boxel {
    static size = 15;
    static volume = 15 * 15 * 15;

    constructor(options = {}) {
        super({
            ...options,
            name: options.name ?? "Boxel15",
            size: {
                x: 15,
                y: 15,
                z: 15,
            },
        });

        this.palette = options.palette ?? null;
        this.voxelIds = this.createVoxelIds(options.voxelIds);
    }

    static fromMemoryData(data = {}, options = {}) {
        const boxel15 = new Boxel15({
            palette: options.palette ?? null,
            position: data.position ?? {
                x: data.x ?? 0,
                y: data.y ?? 0,
                z: data.z ?? 0,
            },
        });

        boxel15.loadVoxelIdsFromMemoryData(data);

        return boxel15;
    }

    setPalette(palette = null) {
        this.palette = palette;

        return this;
    }

    createVoxelIds(voxelIds = null) {
        if (voxelIds instanceof Uint16Array) {
            if (voxelIds.length === Boxel15.volume) return voxelIds;

            return this.createVoxelIdsFromArray(voxelIds);
        }

        if (Array.isArray(voxelIds)) {
            return this.createVoxelIdsFromArray(voxelIds);
        }

        return new Uint16Array(Boxel15.volume);
    }

    createVoxelIdsFromArray(values = []) {
        const voxelIds = new Uint16Array(Boxel15.volume);
        const limit = Math.min(values.length, Boxel15.volume);

        for (let index = 0; index < limit; index++) {
            voxelIds[index] = this.normalizeVoxelId(values[index]);
        }

        return voxelIds;
    }

    index(x, y, z) {
        return x + y * this.size.x + z * this.size.x * this.size.y;
    }

    setVoxelId(x, y, z, voxelId = 0) {
        if (!this.isInside(x, y, z)) return false;

        const index = this.index(x, y, z);
        const nextId = this.normalizeVoxelId(voxelId);
        const changed = this.voxelIds[index] !== nextId;

        this.voxelIds[index] = nextId;

        return changed;
    }

    getVoxelId(x, y, z) {
        if (!this.isInside(x, y, z)) return 0;

        return this.voxelIds[this.index(x, y, z)] ?? 0;
    }

    fillVoxelIdRange(range = {}, voxelId = 0) {
        const minX = this.clampLocal(range.minX ?? 0, "x");
        const maxX = this.clampLocal(range.maxX ?? this.size.x - 1, "x");
        const minY = this.clampLocal(range.minY ?? 0, "y");
        const maxY = this.clampLocal(range.maxY ?? this.size.y - 1, "y");
        const minZ = this.clampLocal(range.minZ ?? 0, "z");
        const maxZ = this.clampLocal(range.maxZ ?? this.size.z - 1, "z");
        const id = this.normalizeVoxelId(voxelId);

        if (minX > maxX || minY > maxY || minZ > maxZ) return false;

        let changed = false;

        for (let z = minZ; z <= maxZ; z++) {
            for (let y = minY; y <= maxY; y++) {
                const start = this.index(minX, y, z);
                const end = this.index(maxX, y, z) + 1;

                if (!changed) {
                    for (let index = start; index < end; index++) {
                        if (this.voxelIds[index] !== id) {
                            changed = true;
                            break;
                        }
                    }
                }

                this.voxelIds.fill(id, start, end);
            }
        }

        return changed;
    }

    clearVoxelIds() {
        if (!this.hasVoxelIds()) return false;

        this.voxelIds.fill(0);

        return true;
    }

    setVoxel(x, y, z, voxel = null) {
        if (!this.palette) return super.setVoxel(x, y, z, voxel);

        const voxelId = this.palette.ensureVoxel(voxel);

        return this.setVoxelId(x, y, z, voxelId);
    }

    getVoxel(x, y, z, palette = this.palette) {
        if (!this.palette && !palette) return super.getVoxel(x, y, z);

        const voxelId = this.getVoxelId(x, y, z);
        if (voxelId === 0) return null;

        return palette?.getVoxel?.(voxelId) ?? null;
    }

    forEachVoxel(callback, palette = this.palette) {
        if (!palette) {
            super.forEachVoxel(callback);
            return;
        }

        this.forEachVoxelId((voxelId, x, y, z, boxel15) => {
            const voxel = palette.getVoxel(voxelId);
            if (!voxel?.isActive?.()) return;

            callback(voxel, x, y, z, boxel15);
        });
    }

    forEachVoxelId(callback) {
        for (let z = 0; z < this.size.z; z++) {
            for (let y = 0; y < this.size.y; y++) {
                for (let x = 0; x < this.size.x; x++) {
                    const voxelId = this.getVoxelId(x, y, z);
                    if (voxelId === 0) continue;

                    callback(voxelId, x, y, z, this);
                }
            }
        }
    }

    hasVoxelIds() {
        for (let index = 0; index < this.voxelIds.length; index++) {
            if (this.voxelIds[index] !== 0) return true;
        }

        return false;
    }

    toMemoryData() {
        return {
            x: this.position.x,
            y: this.position.y,
            z: this.position.z,
            encoding: "rle16",
            volume: Boxel15.volume,
            runs: this.encodeVoxelIdsRLE(),
        };
    }

    loadVoxelIdsFromMemoryData(data = {}) {
        if (data.encoding === "rle16" || Array.isArray(data.runs)) {
            this.voxelIds = this.decodeVoxelIdsRLE(data.runs ?? []);
            return this;
        }

        if (Array.isArray(data.voxelIds)) {
            this.voxelIds = this.createVoxelIdsFromArray(data.voxelIds);
            return this;
        }

        return this;
    }

    encodeVoxelIdsRLE() {
        const runs = [];
        const ids = this.voxelIds;

        if (ids.length === 0) return runs;

        let currentId = ids[0];
        let count = 1;

        for (let index = 1; index < ids.length; index++) {
            const nextId = ids[index];

            if (nextId === currentId && count < 65535) {
                count++;
                continue;
            }

            runs.push(currentId, count);
            currentId = nextId;
            count = 1;
        }

        runs.push(currentId, count);

        return runs;
    }

    decodeVoxelIdsRLE(runs = []) {
        const voxelIds = new Uint16Array(Boxel15.volume);
        let index = 0;

        for (let runIndex = 0; runIndex < runs.length; runIndex += 2) {
            const voxelId = this.normalizeVoxelId(runs[runIndex]);
            const count = Math.max(0, Math.floor(Number(runs[runIndex + 1]) || 0));
            const end = Math.min(index + count, Boxel15.volume);

            voxelIds.fill(voxelId, index, end);
            index = end;

            if (index >= Boxel15.volume) break;
        }

        return voxelIds;
    }

    clampLocal(value = 0, axis = "x") {
        const max = this.size[axis] - 1;
        const number = Math.floor(Number(value));

        if (!Number.isFinite(number)) return 0;

        return Math.min(Math.max(number, 0), max);
    }

    normalizeVoxelId(voxelId = 0) {
        const number = Number(voxelId);
        if (!Number.isFinite(number)) return 0;

        return Math.min(Math.max(Math.floor(number), 0), 65535);
    }
}

export default Boxel15;
