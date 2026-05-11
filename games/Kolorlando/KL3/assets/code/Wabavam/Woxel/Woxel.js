import { Boxel15 } from "../Boxel/Boxel15/Boxel15.js";
import { Voxel } from "../Voxel/Voxel.js";
import { VoxelPalette } from "../Voxel/VoxelPalette.js";
import { create12ColorsPalette } from "../Voxel/12colors/12colors.js";

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
            y: options.spawnPosition?.y ?? this.land.y + 3,
            z: options.spawnPosition?.z ?? 0,
        };
        this.palette = options.palette ?? create12ColorsPalette();
        this.playerState = this.normalizePlayerState(options.playerState ?? options.meta?.playerState ?? null);

        this.boxels = [];
        this.boxelsByPosition = new Map();

        this.neighborDirections = [
            { x: 1, y: 0, z: 0 },
            { x: -1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: -1, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: -1 },
        ];
    }

    static fromMemoryData(data = {}) {
        if (data.kind !== "woxel") {
            throw new Error("Woxel.fromMemoryData expected kind 'woxel'.");
        }

        const palette = Woxel.createPaletteFromMemoryData(data.palette);
        const woxel = new Woxel({
            name: data.name ?? "Loaded Woxel",
            size: data.size,
            land: data.land,
            spawnPosition: data.spawnPosition,
            palette,
            playerState: data.playerState ?? data.meta?.playerState ?? null,
        });

        if (Array.isArray(data.boxels)) {
            woxel.loadBoxel15MemoryData(data.boxels);
            return woxel;
        }

        woxel.loadLegacyVoxelMemoryData(data);

        return woxel;
    }

    static createPaletteFromMemoryData(data = null) {
        if (!data) return create12ColorsPalette();

        if (Array.isArray(data)) {
            const palette = new VoxelPalette({ name: "Loaded VoxelPalette" });

            data.forEach((item, index) => {
                palette.addVoxelData(item, { id: item?.id ?? item?.voxelId ?? index + 1 });
            });

            return palette;
        }

        return VoxelPalette.fromMemoryData(data);
    }

    loadBoxel15MemoryData(boxelDataList = []) {
        boxelDataList.forEach((boxelData) => {
            if (!boxelData) return;

            const position = boxelData.position ?? boxelData;
            const boxel = this.ensureBoxelAtOrigin(
                position.x ?? 0,
                position.y ?? 0,
                position.z ?? 0
            );

            boxel?.loadVoxelIdsFromMemoryData?.(boxelData);
        });

        this.dropEmptyBoxels();

        return this;
    }

    loadLegacyVoxelMemoryData(data = {}) {
        const voxels = Array.isArray(data.voxels) ? data.voxels : [];

        voxels.forEach((item) => {
            const voxelId = this.memoryVoxelItemToId(item, data.palette);
            if (voxelId === 0) return;

            this.setVoxelIdAt(item.x, item.y, item.z, voxelId);
        });

        return this;
    }

    memoryVoxelItemToId(item = {}, rawPalette = null) {
        if (Number.isFinite(item.voxelId)) return item.voxelId;
        if (Number.isFinite(item.paletteId)) return item.paletteId;

        if (Number.isFinite(item.paletteIndex)) {
            const paletteItems = Array.isArray(rawPalette)
                ? rawPalette
                : Array.isArray(rawPalette?.items)
                    ? rawPalette.items
                    : [];
            const paletteItem = paletteItems[item.paletteIndex] ?? null;

            if (paletteItem?.id || paletteItem?.voxelId) {
                return paletteItem.id ?? paletteItem.voxelId;
            }

            if (paletteItem) {
                return this.palette.ensureVoxel(new Voxel({
                    name: paletteItem.name,
                    color: paletteItem.color,
                    active: paletteItem.active ?? true,
                    microxels: paletteItem.microxels ?? null,
                }));
            }
        }

        return 0;
    }

    toMemoryData() {
        return {
            magic: "KL3W",
            version: 3,
            kind: "woxel",
            name: this.name,
            size: { ...this.size },
            land: { ...this.land },
            spawnPosition: { ...this.spawnPosition },
            palette: this.palette?.toMemoryData?.() ?? null,
            playerState: this.playerState ? { ...this.playerState, position: { ...this.playerState.position } } : null,
            boxelFormat: "boxel15-rle16",
            boxels: this.toBoxel15MemoryData(),
        };
    }

    setPlayerState(playerState = null) {
        this.playerState = this.normalizePlayerState(playerState);

        return this;
    }

    getPlayerState() {
        if (!this.playerState) return null;

        return {
            position: { ...this.playerState.position },
            yaw: this.playerState.yaw,
        };
    }

    normalizePlayerState(playerState = null) {
        if (!playerState || typeof playerState !== "object") return null;

        const position = playerState.position ?? {};
        const x = Number(position.x);
        const y = Number(position.y);
        const z = Number(position.z);
        const yaw = Number(playerState.yaw);

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

        return {
            position: { x, y, z },
            yaw: Number.isFinite(yaw) ? yaw : 0,
        };
    }

    toBoxel15MemoryData() {
        const boxels = [];

        this.forEachBoxel((boxel15) => {
            if (!boxel15?.hasVoxelIds?.()) return;

            boxels.push(boxel15.toMemoryData());
        });

        return boxels;
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

        return this.createBoxel15sInWorldRange({
            min: { x: 0, y: 0, z: 0 },
            max: {
                x: this.size.x - 1,
                y: this.size.y - 1,
                z: this.size.z - 1,
            },
        });
    }

    createBoxel15sInWorldRange(range = {}) {
        const created = [];

        this.forEachBoxelOriginInWorldRange(range, (origin) => {
            const boxel = this.ensureBoxelAtOrigin(origin.x, origin.y, origin.z);
            if (boxel) created.push(boxel);
        });

        return created;
    }

    clearBoxels() {
        this.boxels = [];
        this.boxelsByPosition.clear();
    }

    addBoxel(boxel) {
        if (!boxel) return null;

        const key = this.boxelPositionKey(boxel.position.x, boxel.position.y, boxel.position.z);
        const existing = this.boxelsByPosition.get(key);
        if (existing) return existing;

        boxel.setPalette?.(this.palette);
        this.boxels.push(boxel);
        this.boxelsByPosition.set(key, boxel);

        return boxel;
    }

    removeBoxel(boxel) {
        if (!boxel) return false;

        const key = this.boxelPositionKey(boxel.position.x, boxel.position.y, boxel.position.z);
        if (!this.boxelsByPosition.has(key)) return false;

        this.boxelsByPosition.delete(key);
        this.boxels = this.boxels.filter((item) => item !== boxel);

        return true;
    }

    dropEmptyBoxels() {
        const emptyBoxels = this.boxels.filter((boxel) => !boxel?.hasVoxelIds?.());

        emptyBoxels.forEach((boxel) => {
            this.removeBoxel(boxel);
        });

        return emptyBoxels.length;
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

    getBoxelOriginAtWorld(x, y, z) {
        return {
            x: this.worldToBoxelOrigin(x),
            y: this.worldToBoxelOrigin(y),
            z: this.worldToBoxelOrigin(z),
        };
    }

    getBoxelAtOrigin(x, y, z) {
        return this.boxelsByPosition.get(this.boxelPositionKey(x, y, z)) ?? null;
    }

    ensureBoxelAtOrigin(x, y, z) {
        const origin = {
            x: this.worldToBoxelOrigin(x),
            y: this.worldToBoxelOrigin(y),
            z: this.worldToBoxelOrigin(z),
        };

        if (!this.isBoxelOriginInside(origin.x, origin.y, origin.z)) return null;

        const key = this.boxelPositionKey(origin.x, origin.y, origin.z);
        const existing = this.boxelsByPosition.get(key);
        if (existing) return existing;

        return this.addBoxel(new Boxel15({
            palette: this.palette,
            position: origin,
        }));
    }

    ensureBoxelAtWorld(x, y, z) {
        if (!this.isInside(x, y, z)) return null;

        const origin = this.getBoxelOriginAtWorld(x, y, z);

        return this.ensureBoxelAtOrigin(origin.x, origin.y, origin.z);
    }

    getBoxelAtWorld(x, y, z) {
        if (!this.isInside(x, y, z)) return null;

        const origin = this.getBoxelOriginAtWorld(x, y, z);

        return this.getBoxelAtOrigin(origin.x, origin.y, origin.z);
    }

    isBoxelOriginInside(x, y, z) {
        return x >= 0 && x < this.size.x
            && y >= 0 && y < this.size.y
            && z >= 0 && z < this.size.z;
    }

    forEachBoxelOriginInWorldRange(range = {}, callback = () => {}) {
        const min = this.clampWorldPosition(range.min ?? { x: 0, y: 0, z: 0 });
        const max = this.clampWorldPosition(range.max ?? {
            x: this.size.x - 1,
            y: this.size.y - 1,
            z: this.size.z - 1,
        });

        if (min.x > max.x || min.y > max.y || min.z > max.z) return;

        const startX = this.worldToBoxelOrigin(min.x);
        const startY = this.worldToBoxelOrigin(min.y);
        const startZ = this.worldToBoxelOrigin(min.z);
        const endX = this.worldToBoxelOrigin(max.x);
        const endY = this.worldToBoxelOrigin(max.y);
        const endZ = this.worldToBoxelOrigin(max.z);

        for (let x = startX; x <= endX; x += Boxel15.size) {
            for (let y = startY; y <= endY; y += Boxel15.size) {
                for (let z = startZ; z <= endZ; z += Boxel15.size) {
                    callback({ x, y, z }, this);
                }
            }
        }
    }

    clampWorldPosition(position = {}) {
        return {
            x: this.clamp(Math.floor(position.x ?? 0), 0, this.size.x - 1),
            y: this.clamp(Math.floor(position.y ?? 0), 0, this.size.y - 1),
            z: this.clamp(Math.floor(position.z ?? 0), 0, this.size.z - 1),
        };
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
        const result = this.writeVoxelAt(x, y, z, voxel);

        return result.changed;
    }

    setVoxelIdAt(x, y, z, voxelId = 0) {
        const result = this.writeVoxelIdAt(x, y, z, voxelId);

        return result.changed;
    }

    placeVoxelAt(x, y, z, voxel = null) {
        return this.writeVoxelAt(x, y, z, voxel?.clone?.() ?? voxel);
    }

    removeVoxelAt(x, y, z) {
        return this.writeVoxelIdAt(x, y, z, 0);
    }

    writeVoxelAt(x, y, z, voxel = null) {
        const voxelId = this.palette?.ensureVoxel?.(voxel) ?? 0;

        return this.writeVoxelIdAt(x, y, z, voxelId);
    }

    writeVoxelIdAt(x, y, z, voxelId = 0) {
        if (!this.isInside(x, y, z)) {
            return this.createVoxelWriteResult(false, null, null, null);
        }

        const normalizedVoxelId = this.normalizeVoxelId(voxelId);
        const boxel = normalizedVoxelId === 0
            ? this.getBoxelAtWorld(x, y, z)
            : this.ensureBoxelAtWorld(x, y, z);

        if (!boxel) {
            return this.createVoxelWriteResult(false, null, null, null);
        }

        const localPosition = {
            x: x - boxel.position.x,
            y: y - boxel.position.y,
            z: z - boxel.position.z,
        };

        const previousVoxel = boxel.getVoxel(localPosition.x, localPosition.y, localPosition.z, this.palette);
        const changed = boxel.setVoxelId(localPosition.x, localPosition.y, localPosition.z, normalizedVoxelId);
        const nextVoxel = boxel.getVoxel(localPosition.x, localPosition.y, localPosition.z, this.palette);
        const gridPosition = { x, y, z };
        const dirtyBoxels = changed ? this.getDirtyBoxelsForGridPosition(gridPosition) : [];

        if (changed && normalizedVoxelId === 0 && !boxel.hasVoxelIds()) {
            this.removeBoxel(boxel);
        }

        return this.createVoxelWriteResult(changed, boxel, previousVoxel, nextVoxel, gridPosition, dirtyBoxels);
    }

    createVoxelWriteResult(changed, boxel, previousVoxel, nextVoxel, gridPosition = null, dirtyBoxels = []) {
        return {
            changed,
            boxel,
            dirtyBoxel: changed ? boxel : null,
            dirtyBoxels,
            previousVoxel,
            nextVoxel,
            gridPosition,
        };
    }

    getDirtyBoxelsForGridPosition(gridPosition = {}) {
        const dirtyBoxels = [];
        const seen = new Set();

        this.addDirtyBoxelAt(gridPosition.x, gridPosition.y, gridPosition.z, dirtyBoxels, seen);

        this.neighborDirections.forEach((direction) => {
            const neighborPosition = {
                x: gridPosition.x + direction.x,
                y: gridPosition.y + direction.y,
                z: gridPosition.z + direction.z,
            };

            if (!this.isInside(neighborPosition.x, neighborPosition.y, neighborPosition.z)) return;

            const currentBoxel = this.getBoxelAtWorld(gridPosition.x, gridPosition.y, gridPosition.z);
            const neighborBoxel = this.getBoxelAtWorld(neighborPosition.x, neighborPosition.y, neighborPosition.z);

            if (!neighborBoxel) return;
            if (neighborBoxel === currentBoxel) return;

            this.addDirtyBoxel(neighborBoxel, dirtyBoxels, seen);
        });

        return dirtyBoxels;
    }

    addDirtyBoxelAt(x, y, z, dirtyBoxels, seen) {
        const boxel = this.getBoxelAtWorld(x, y, z);

        this.addDirtyBoxel(boxel, dirtyBoxels, seen);
    }

    addDirtyBoxel(boxel, dirtyBoxels, seen) {
        if (!boxel) return;

        const key = this.boxelPositionKey(boxel.position.x, boxel.position.y, boxel.position.z);
        if (seen.has(key)) return;

        seen.add(key);
        dirtyBoxels.push(boxel);
    }

    getVoxelAt(x, y, z) {
        if (!this.isInside(x, y, z)) return null;

        const boxel = this.getBoxelAtWorld(x, y, z);
        if (!boxel) return null;

        return boxel.getVoxel(x - boxel.position.x, y - boxel.position.y, z - boxel.position.z, this.palette);
    }

    getVoxelIdAt(x, y, z) {
        if (!this.isInside(x, y, z)) return 0;

        const boxel = this.getBoxelAtWorld(x, y, z);
        if (!boxel) return 0;

        return boxel.getVoxelId(x - boxel.position.x, y - boxel.position.y, z - boxel.position.z);
    }

    forEachBoxel(callback) {
        this.boxels.forEach((boxel) => {
            callback(boxel, this);
        });
    }

    forEachVoxel(callback) {
        this.boxels.forEach((boxel) => {
            boxel.forEachVoxel((voxel, localX, localY, localZ) => {
                callback(voxel, boxel.position.x + localX, boxel.position.y + localY, boxel.position.z + localZ, boxel);
            }, this.palette);
        });
    }

    forEachVoxelId(callback) {
        this.boxels.forEach((boxel) => {
            boxel.forEachVoxelId((voxelId, localX, localY, localZ) => {
                callback(voxelId, boxel.position.x + localX, boxel.position.y + localY, boxel.position.z + localZ, boxel);
            });
        });
    }

    normalizeVoxelId(voxelId = 0) {
        const number = Number(voxelId);
        if (!Number.isFinite(number)) return 0;

        return Math.min(Math.max(Math.floor(number), 0), 65535);
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}

export default Woxel;

