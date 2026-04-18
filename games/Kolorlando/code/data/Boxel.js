class Boxel {
    constructor(size = 7) {
        this.size = size;
        this.name = "";
        this.voxels = Array.from({ length: size }, () =>
            Array.from({ length: size }, () =>
                Array.from({ length: size }, () => new Voxel())
            )
        );

        this.applyPreset("full");
    }

    get(x, y, z) {
        return this.voxels[x]?.[y]?.[z];
    }

    setName(name = "") {
        this.name = String(name).trim();
    }

    toJSON() {
        return {
            name: this.name,
            size: this.size,
            voxels: this.voxels.map((plane) =>
                plane.map((row) =>
                    row.map((cell) => ({
                        color: cell.color,
                        active: cell.active
                    }))
                )
            )
        };
    }

    loadFromData(data) {
        if (!data || data.size !== this.size || !Array.isArray(data.voxels)) {
            throw new Error("Loaded voxel size does not match the current editor.");
        }

        // Only explicit names should replace the current voxel name.
        if ("name" in data) {
            this.setName(data.name ?? "");
        }

        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    const nextCell = data.voxels?.[x]?.[y]?.[z];

                    if (!nextCell) {
                        throw new Error(`Missing Voxel at ${x},${y},${z}.`);
                    }

                    const cell = this.get(x, y, z);
                    cell.color = typeof nextCell.color === "string" ? nextCell.color : cell.color;
                    cell.active = Boolean(nextCell.active);
                }
            }
        }
    }

    // revise
    applyPreset(presetName) {
        const presetBuilder = voxelPresets[`${presetName}_preset`];

        if (!presetBuilder) {
            throw new Error(`Unknown preset "${presetName}".`);
        }

        this.loadFromData(presetBuilder(this.size));
    }
}