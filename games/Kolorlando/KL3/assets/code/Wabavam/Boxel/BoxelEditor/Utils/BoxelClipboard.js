import { Boxel } from "../../Boxel.js";
import { Voxel } from "../../../Voxel/Voxel.js";

export class BoxelClipboard {
    constructor(options = {}) {
        this.name = options.name ?? "BoxelClipboard";
        this.boxel = options.boxel ?? null;
    }

    setBoxel(boxel = null) {
        this.boxel = boxel ?? null;

        return this.boxel;
    }

    getBoxel() {
        return this.boxel;
    }

    hasBoxel() {
        return this.boxel !== null;
    }

    clear() {
        this.boxel = null;
    }

    toMemoryData() {
        return {
            kind: "boxelClipboard",
            version: 1,
            name: this.name,
            boxel: this.boxelToMemoryData(this.boxel),
        };
    }

    loadMemoryData(data = null) {
        if (!data || data.kind !== "boxelClipboard") {
            this.clear();
            return false;
        }

        this.setBoxel(this.boxelFromMemoryData(data.boxel));

        return this.hasBoxel();
    }

    static fromMemoryData(data = null) {
        const clipboard = new BoxelClipboard({
            name: data?.name ?? "BoxelClipboard",
        });

        clipboard.loadMemoryData(data);

        return clipboard;
    }

    boxelToMemoryData(boxel = null) {
        if (!boxel) return null;

        const voxels = [];

        boxel.forEachVoxel((voxel, x, y, z) => {
            voxels.push({
                x,
                y,
                z,
                voxel: this.voxelToMemoryData(voxel),
            });
        });

        return {
            kind: "boxel",
            version: 1,
            name: boxel.name ?? "Boxel",
            size: { ...boxel.size },
            position: { ...boxel.position },
            orientation: boxel.orientation ?? 0,
            origin: boxel.origin ? { ...boxel.origin } : null,
            voxelCount: boxel.voxelCount ?? voxels.length,
            voxels,
        };
    }

    boxelFromMemoryData(data = null) {
        if (!data) return null;

        const boxel = new Boxel({
            name: data.name ?? "Boxel",
            size: data.size,
            position: data.position,
            orientation: data.orientation ?? 0,
        });

        const voxels = Array.isArray(data.voxels) ? data.voxels : [];

        voxels.forEach((item) => {
            const voxel = this.voxelFromMemoryData(item.voxel);
            if (!voxel?.isActive?.()) return;

            boxel.setVoxel(item.x, item.y, item.z, voxel);
        });

        boxel.origin = data.origin ?? data.position ?? null;
        boxel.voxelCount = data.voxelCount ?? voxels.length;

        return boxel.voxelCount > 0 ? boxel : null;
    }

    voxelToMemoryData(voxel = null) {
        return voxel?.toMemoryData?.() ?? null;
    }

    voxelFromMemoryData(data = null) {
        if (!data) return null;

        return new Voxel(data);
    }
}

export default BoxelClipboard;


