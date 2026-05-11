import { Voxel } from "./Voxel.js";

export class VoxelPalette {
    constructor(options = {}) {
        this.name = options.name ?? "VoxelPalette";
        this.emptyId = 0;
        this.nextId = 1;

        this.voxelsById = new Map();
        this.idsByName = new Map();
        this.idsByKey = new Map();

        this.addMany(options.voxels ?? options.items ?? []);
    }

    static fromMemoryData(data = {}) {
        const palette = new VoxelPalette({
            name: data.name ?? "Loaded VoxelPalette",
        });

        const items = Array.isArray(data.items)
            ? data.items
            : Array.isArray(data)
                ? data
                : [];

        items.forEach((item, index) => {
            if (!item) return;

            palette.addVoxelData(item, {
                id: item.id ?? item.voxelId ?? index + 1,
            });
        });

        return palette;
    }

    clone() {
        return VoxelPalette.fromMemoryData(this.toMemoryData());
    }

    addMany(voxels = []) {
        voxels.forEach((voxel) => this.add(voxel));

        return this;
    }

    add(voxel = null, options = {}) {
        if (!voxel) return this.emptyId;

        return this.addVoxelData(this.voxelToData(voxel), options);
    }

    addVoxelData(data = {}, options = {}) {
        const voxel = data instanceof Voxel
            ? data
            : new Voxel({
                name: data.name ?? "Voxel",
                color: data.color ?? "#ffffff",
                active: data.active ?? true,
                orientable: data.orientable ?? data.isOrientable ?? false,
                orientation: data.orientation ?? null,
                type: data.type ?? (Array.isArray(data.microxels) || data.microxelPalette ? "microxeled" : "colored"),
                microxelSize: data.microxelSize ?? data.microxelPalette?.size ?? data.microxels?.length ?? 0,
                microxelPalette: data.microxelPalette ?? data.microxelData ?? null,
                microxels: data.microxels ?? null,
            });

        const key = this.createVoxelKey(voxel);
        const existingId = this.idsByKey.get(key);
        if (existingId) return existingId;

        const id = this.normalizeId(options.id ?? data.id ?? data.voxelId ?? this.nextId);
        const safeId = id === this.emptyId ? this.nextId : id;

        this.voxelsById.set(safeId, voxel);
        this.idsByKey.set(key, safeId);
        this.idsByName.set(voxel.name, safeId);
        this.nextId = Math.max(this.nextId, safeId + 1);

        return safeId;
    }

    ensureVoxel(voxel = null) {
        if (!voxel) return this.emptyId;
        if (typeof voxel === "number") return this.normalizeId(voxel);

        const key = this.createVoxelKey(voxel);
        return this.idsByKey.get(key) ?? this.add(voxel);
    }

    get(id = this.emptyId) {
        return this.getVoxel(id);
    }

    getVoxel(id = this.emptyId) {
        const normalizedId = this.normalizeId(id);
        if (normalizedId === this.emptyId) return null;

        return this.voxelsById.get(normalizedId) ?? null;
    }

    getIdByName(name = "") {
        return this.idsByName.get(name) ?? this.emptyId;
    }

    getVoxelByName(name = "") {
        return this.getVoxel(this.getIdByName(name));
    }

    getIds() {
        return Array.from(this.voxelsById.keys()).sort((a, b) => a - b);
    }

    getVoxels() {
        return this.getIds().map((id) => this.getVoxel(id)).filter(Boolean);
    }

    getRandomId(options = {}) {
        const ids = this.getIds().filter((id) => {
            const voxel = this.getVoxel(id);
            if (!voxel?.isActive?.()) return false;
            if (options.excludeName && voxel.name === options.excludeName) return false;
            return true;
        });

        if (ids.length === 0) return this.emptyId;

        return ids[Math.floor(Math.random() * ids.length)];
    }

    toMemoryData() {
        return {
            kind: "voxelPalette",
            version: 1,
            name: this.name,
            items: this.getIds().map((id) => ({
                id,
                ...this.voxelToData(this.getVoxel(id)),
            })),
        };
    }

    voxelToData(voxel = null) {
        return voxel?.toMemoryData?.() ?? {
            name: voxel?.name ?? "Voxel",
            color: voxel?.color ?? "#ffffff",
            active: voxel?.active ?? true,
            orientable: voxel?.orientable ?? voxel?.isOrientable?.() ?? false,
            orientation: voxel?.orientation ?? null,
            type: voxel?.type ?? "colored",
        };
    }

    createVoxelKey(voxel = null) {
        return JSON.stringify(this.voxelToData(voxel));
    }

    normalizeId(id = this.emptyId) {
        const number = Number(id);
        if (!Number.isFinite(number)) return this.emptyId;

        return Math.max(this.emptyId, Math.floor(number));
    }
}

export default VoxelPalette;