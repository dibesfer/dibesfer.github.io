import { Microxel } from "../Microxel/Microxel.js";
import { MicroxelPalette } from "../Microxel/MicroxelPalette.js";
import { Compass } from "../Compass.js";

export class Voxel {
    constructor(options = {}) {
        this.name = this.normalizeText(options.name ?? options.id, "Voxel");
        this.color = this.normalizeText(options.color, "#ffffff");
        this.active = Boolean(options.active ?? true);
        this.orientable = this.normalizeBoolean(
            options.orientable ?? options.isOrientable ?? Compass.isOriented(options.orientation ?? null),
            false
        );
        this.orientation = this.normalizeOrientation(options.orientation ?? null);
        this.type = this.normalizeType(options.type ?? "colored");
        this.microxelSize = this.normalizeGridSize(options.microxelSize ?? options.size ?? 0);
        this.microxelPalette = null;
        this.microxels = null;

        if (options.microxelPalette || options.microxelData || options.microxelEncoding) {
            this.setMicroxelPalette(options.microxelPalette ?? options.microxelData ?? options.microxelEncoding);
        } else if (Array.isArray(options.microxels)) {
            this.setMicroxels(options.microxels);
        } else {
            this.normalizeColoredMicroxelSize();
        }
    }

    clone() {
        return new Voxel(this.toMemoryData());
    }

    isActive() {
        return this.active === true;
    }

    hasMicroxels() {
        return this.type === "microxeled"
            && this.microxelSize > 1
            && this.microxelPalette instanceof MicroxelPalette;
    }

    hasStoredMicroxels() {
        return this.microxelSize > 0
            && this.microxelPalette instanceof MicroxelPalette;
    }

    isSingleMicroxelGrid() {
        return this.microxelSize === 1 && this.hasStoredMicroxels();
    }

    effectiveMicroxelSize() {
        if (this.hasStoredMicroxels()) return this.microxelSize;
        if (this.type === "colored") return 1;

        return 0;
    }

    effectiveMicroxels() {
        if (this.hasStoredMicroxels()) {
            if (!this.microxels) {
                this.microxels = this.microxelPalette.toMicroxels(this.color);
            }

            return this.microxels;
        }

        if (this.type === "colored") return [[[this.virtualMicroxel()]]];

        return null;
    }

    virtualMicroxel() {
        return new Microxel({
            x: 0,
            y: 0,
            z: 0,
            color: this.color,
            active: this.active,
        });
    }

    getMicroxel(x = 0, y = 0, z = 0) {
        if (this.hasStoredMicroxels()) {
            return this.microxelPalette.getCellAt(x, y, z, this.color);
        }

        return this.effectiveMicroxels()?.[x]?.[y]?.[z] ?? null;
    }

    forEachMicroxel(callback) {
        if (!callback) return;

        if (this.hasStoredMicroxels()) {
            this.microxelPalette.forEachCell(callback, this.color);
            return;
        }

        if (this.type === "colored" && this.active) {
            callback(this.virtualMicroxel(), 0, 0, 0, this);
        }
    }

    isMicroxelActiveAt(x = 0, y = 0, z = 0) {
        if (this.hasStoredMicroxels()) {
            return this.microxelPalette.isActiveAt(x, y, z);
        }

        return this.type === "colored" && x === 0 && y === 0 && z === 0 && this.active;
    }

    getMicroxelColorAt(x = 0, y = 0, z = 0) {
        if (this.hasStoredMicroxels()) {
            return this.microxelPalette.getColorAt(x, y, z, this.color);
        }

        return this.color;
    }

    setMicroxels(microxels = []) {
        const palette = MicroxelPalette.fromMicroxels(microxels, {
            size: this.normalizeGridSize(microxels.length),
            color: this.color,
        });

        return this.setMicroxelPalette(palette);
    }

    setMicroxelPalette(data = null) {
        const palette = MicroxelPalette.fromMemoryData(data);

        if (!palette || palette.size <= 0) {
            this.microxelSize = this.type === "colored" ? 1 : 0;
            this.microxelPalette = null;
            this.microxels = null;
            return this;
        }

        this.microxelSize = palette.size;
        this.microxelPalette = palette;
        this.microxels = null;

        if (palette.size === 1) {
            this.color = palette.getColorAt(0, 0, 0, this.color);
            this.active = palette.isActiveAt(0, 0, 0);
            this.type = "colored";
        } else {
            this.type = "microxeled";
        }

        return this;
    }

    toJSON() {
        return this.toMemoryData();
    }

    toMemoryData() {
        const data = {
            name: this.name,
            color: this.color,
            active: this.active,
            orientable: this.orientable,
            orientation: this.orientation,
            type: this.type,
            microxelSize: this.effectiveMicroxelSize(),
        };

        if (this.hasStoredMicroxels()) {
            data.microxelPalette = this.serializeMicroxelPalette();
        }

        return data;
    }

    serializeMicroxelPalette() {
        return this.microxelPalette?.toMemoryData?.() ?? null;
    }

    serializeMicroxels() {
        if (this.hasStoredMicroxels()) {
            return this.microxelPalette.toMicroxels(this.color).map((plane, x) =>
                plane.map((row, y) =>
                    row.map((cell, z) => ({
                        position: { x, y, z },
                        color: cell?.color ?? this.color,
                        active: Boolean(cell?.active),
                    }))
                )
            );
        }

        if (this.type === "colored") {
            return [[[
                {
                    position: { x: 0, y: 0, z: 0 },
                    color: this.color,
                    active: this.active,
                },
            ]]];
        }

        return null;
    }

    normalizeColoredMicroxelSize() {
        if (this.type === "colored" && this.microxelSize === 0) {
            this.microxelSize = 1;
        }
    }

    isOriented() {
        return Compass.isOriented(this.orientation);
    }

    isOrientable() {
        return this.orientable === true;
    }

    setOrientable(orientable = true) {
        this.orientable = this.normalizeBoolean(orientable, false);

        return this;
    }

    setOrientation(orientation = null) {
        this.orientation = this.normalizeOrientation(orientation);

        return this;
    }

    normalizeOrientation(orientation = null) {
        return Compass.normalize(orientation);
    }

    normalizeBoolean(value, fallback = false) {
        if (value === undefined || value === null || value === "") return Boolean(fallback);
        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();
            if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
            if (normalized === "false" || normalized === "0" || normalized === "no") return false;
        }

        return Boolean(value);
    }

    normalizeType(type = "colored") {
        const normalized = this.normalizeText(type, "colored").toLowerCase();

        return ["colored", "textured", "microxeled"].includes(normalized)
            ? normalized
            : "colored";
    }

    normalizeGridSize(size = 0) {
        const number = Math.floor(Number(size));

        return Number.isFinite(number) && number > 0 ? number : 0;
    }

    normalizeText(value, fallback = "") {
        if (typeof value !== "string") return fallback;

        const trimmed = value.trim();

        return trimmed || fallback;
    }
}

export default Voxel;