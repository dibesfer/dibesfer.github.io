// /assets/code/Item/Item.js

import { colors12 } from "../Wabavam/Voxel/12colors/12colors.js";
import Voxel from "../Wabavam/Voxel/Voxel.js";
import VoxelFile from "../Wabavam/Voxel/VoxelFile.js";
import firstMicroxelVoxelFiles from "../Wabavam/Voxel/firstMicroxels/index.js";

export class Item {
    constructor({ id, name, tradeable = true, possessable = true, icon = {}, voxel = null } = {}) {
        this.id = id || name;
        this.name = name || "item";
        this.tradeable = tradeable;
        this.possessable = possessable;
        this.icon = icon;
        this.voxel = voxel;
    }

    iconData(quantity = " ") {
        return {
            name: this.name,
            count: quantity,
            ...this.icon
        };
    }

    static fromVoxel(voxel) {
        const color = Item.displayColor(voxel);

        return new Item({
            id: `voxel:${voxel.name}`,
            name: voxel.name,
            voxel,
            icon: {
                color,
                image: Item.colorIcon(color)
            }
        });
    }

    static displayColor(voxel) {
        if (!voxel) return "#ffffff";
        if (!voxel.hasSemanticMicroxels?.()) return voxel.color || "#ffffff";

        const counts = new Map();
        const microxels = voxel.effectiveMicroxels?.() || voxel.microxels || [];

        microxels.forEach(plane => {
            plane.forEach(row => {
                row.forEach(cell => {
                    if (!cell?.active) return;

                    const color = cell.color || voxel.color || "#ffffff";
                    counts.set(color, (counts.get(color) || 0) + 1);
                });
            });
        });

        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])[0]?.[0]
            || voxel.color
            || "#ffffff";
    }

    static colorIcon(color) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${color}"/></svg>`;

        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
}

async function loadVoxelFile(path) {
    return new Voxel(await VoxelFile.load(path));
}

async function loadFirstMicroxelVoxelItems() {
    const results = await Promise.allSettled(firstMicroxelVoxelFiles.map(loadVoxelFile));

    return results
        .filter(result => result.status === "fulfilled")
        .map(result => Item.fromVoxel(result.value));
}

export const voxelItems12 = [
    ...Object.values(colors12).map(voxel => Item.fromVoxel(voxel)),
    ...await loadFirstMicroxelVoxelItems()
];

export default Item;
