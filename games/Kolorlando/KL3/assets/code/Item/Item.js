export class Item {
    constructor(options = {}) {
        this.name = options.name ?? "Item";
        this.kind = options.kind ?? "item";
        this.icon = options.icon ?? null;
        this.data = options.data ?? null;
        this.count = options.count ?? null;
        this.stackable = options.stackable ?? false;
    }

    clone() {
        return new Item({
            name: this.name,
            kind: this.kind,
            icon: this.cloneIcon(),
            data: this.cloneData(),
            count: this.count,
            stackable: this.stackable,
        });
    }

    cloneIcon() {
        if (!this.icon || typeof this.icon !== "object") return this.icon;

        return { ...this.icon };
    }

    cloneData() {
        if (!this.data || typeof this.data !== "object") return this.data;

        if (this.kind === "voxel" && this.data.voxel) {
            return {
                ...this.data,
                voxel: this.data.voxel?.clone?.() ?? this.data.voxel,
            };
        }

        if (this.kind === "boxel" && this.data.boxel) {
            return {
                ...this.data,
                boxel: this.data.boxel,
            };
        }

        return { ...this.data };
    }

    hasCount() {
        return Number.isFinite(this.count) && this.count > 1;
    }

    getVoxel() {
        if (this.kind !== "voxel") return null;

        return this.data?.voxel ?? null;
    }

    getBoxel() {
        if (this.kind !== "boxel") return null;

        return this.data?.boxel ?? null;
    }
}

export function createBoxelItem(savedBoxel, options = {}) {
    const boxel = savedBoxel?.boxel ?? savedBoxel ?? null;

    return new Item({
        name: options.name ?? savedBoxel?.name ?? boxel?.name ?? "NULL",
        kind: "boxel",
        icon: options.icon ?? {
            type: "isometricon",
        },
        data: {
            id: savedBoxel?.id ?? null,
            createdAt: savedBoxel?.createdAt ?? null,
            favorite: savedBoxel?.favorite === true,
            favoritedAt: savedBoxel?.favoritedAt ?? null,
            boxel,
        },
        count: options.count ?? null,
        stackable: false,
    });
}

export function createVoxelItem(voxel, options = {}) {
    return new Item({
        name: options.name ?? voxel?.name ?? "Voxel",
        kind: "voxel",
        icon: options.icon ?? {
            type: "color",
            color: voxel?.color ?? "#ffffff",
        },
        data: {
            voxel,
        },
        count: options.count ?? null,
        stackable: options.stackable ?? false,
    });
}

export default Item;




