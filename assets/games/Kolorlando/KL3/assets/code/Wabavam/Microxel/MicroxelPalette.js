import { Binarier } from "../../Memory/Binarier.js";
import { Microxel } from "./Microxel.js";

export class MicroxelPalette {
    static encoding = "microxel-palette-binary-v1";

    constructor(options = {}) {
        this.size = this.normalizeSize(options.size ?? options.microxelSize ?? 0);
        this.colors = this.normalizeColors(options.colors ?? options.palette ?? []);
        this.indexType = this.normalizeIndexType(
            options.indexType ?? this.inferIndexType(options),
            this.colors.length
        );
        this.indices = this.createIndices(options.indices ?? null, options.binary ?? null);
    }

    static fromMicroxels(microxels = [], options = {}) {
        const size = MicroxelPalette.prototype.normalizeSize(
            options.size ?? options.microxelSize ?? microxels.length
        );
        const palette = new MicroxelPalette({ size });
        const rawIndices = new Array(palette.volume).fill(0);

        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                for (let z = 0; z < size; z++) {
                    const cell = microxels?.[x]?.[y]?.[z] ?? null;
                    const active = cell?.active ?? cell?.filled ?? false;
                    if (!active) continue;

                    const color = palette.normalizeColor(cell?.color ?? options.color ?? "#ffffff");
                    rawIndices[palette.index(x, y, z)] = palette.ensureColor(color);
                }
            }
        }

        palette.indexType = palette.normalizeIndexType(options.indexType, palette.colors.length);
        palette.indices = palette.createTypedArray(rawIndices, palette.indexType);

        return palette;
    }

    static fromMemoryData(data = null) {
        if (!data) return null;

        if (data instanceof MicroxelPalette) {
            return data.clone();
        }

        if (data.encoding === MicroxelPalette.encoding) {
            return new MicroxelPalette({
                size: data.size ?? data.microxelSize,
                colors: data.colors,
                indexType: data.indexType,
                indices: data.indices,
                binary: data.binary,
            });
        }

        if (Array.isArray(data.microxels)) {
            return MicroxelPalette.fromMicroxels(data.microxels, data);
        }

        if (Array.isArray(data)) {
            return MicroxelPalette.fromMicroxels(data);
        }

        return null;
    }

    clone() {
        return new MicroxelPalette({
            size: this.size,
            colors: [...this.colors],
            indexType: this.indexType,
            indices: this.indices.slice(),
        });
    }

    get volume() {
        return this.size * this.size * this.size;
    }

    index(x = 0, y = 0, z = 0) {
        return x + y * this.size + z * this.size * this.size;
    }

    isInside(x = 0, y = 0, z = 0) {
        return x >= 0 && x < this.size
            && y >= 0 && y < this.size
            && z >= 0 && z < this.size;
    }

    getIndexAt(x = 0, y = 0, z = 0) {
        if (!this.isInside(x, y, z)) return 0;

        return this.indices[this.index(x, y, z)] ?? 0;
    }

    isActiveAt(x = 0, y = 0, z = 0) {
        return this.getIndexAt(x, y, z) > 0;
    }

    getColorAt(x = 0, y = 0, z = 0, fallback = "#ffffff") {
        const index = this.getIndexAt(x, y, z);
        if (index <= 0) return fallback;

        return this.colors[index - 1] ?? fallback;
    }

    getCellAt(x = 0, y = 0, z = 0, fallbackColor = "#ffffff") {
        return new Microxel({
            x,
            y,
            z,
            color: this.getColorAt(x, y, z, fallbackColor),
            active: this.isActiveAt(x, y, z),
        });
    }

    forEachCell(callback, fallbackColor = "#ffffff") {
        if (!callback) return;

        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    const paletteIndex = this.getIndexAt(x, y, z);
                    if (paletteIndex <= 0) continue;

                    callback({
                        x,
                        y,
                        z,
                        active: true,
                        filled: true,
                        paletteIndex,
                        color: this.colors[paletteIndex - 1] ?? fallbackColor,
                    }, x, y, z, this);
                }
            }
        }
    }

    toMicroxels(fallbackColor = "#ffffff") {
        return Array.from({ length: this.size }, (_, x) =>
            Array.from({ length: this.size }, (_, y) =>
                Array.from({ length: this.size }, (_, z) =>
                    this.getCellAt(x, y, z, fallbackColor)
                )
            )
        );
    }

    toMemoryData() {
        return {
            encoding: MicroxelPalette.encoding,
            size: this.size,
            colors: [...this.colors],
            indexType: this.indexType,
            indices: Binarier.typedArrayToBinaryData(this.indices),
        };
    }

    ensureColor(color = "#ffffff") {
        const normalized = this.normalizeColor(color);
        const existingIndex = this.colors.indexOf(normalized);

        if (existingIndex >= 0) return existingIndex + 1;

        this.colors.push(normalized);
        this.indexType = this.normalizeIndexType(this.indexType, this.colors.length);

        return this.colors.length;
    }

    createIndices(indices = null, binary = null) {
        const source = binary ?? indices;

        if (source?.encoding?.endsWith?.("-base64") || source?.data) {
            const decoded = Binarier.typedArrayFromBinaryData(source, this.indexType);
            const sourceType = Binarier.getTypedArrayName(decoded);
            this.indexType = this.normalizeIndexType(sourceType, this.colors.length);

            return this.ensureTypedArrayLength(decoded, this.indexType);
        }

        if (source instanceof Uint8Array || source instanceof Uint16Array) {
            const sourceType = Binarier.getTypedArrayName(source);
            this.indexType = this.normalizeIndexType(sourceType, this.colors.length);

            return this.ensureTypedArrayLength(source, this.indexType);
        }

        if (Array.isArray(source)) {
            return this.ensureTypedArrayLength(this.createTypedArray(source, this.indexType), this.indexType);
        }

        return this.createTypedArray(new Array(this.volume).fill(0), this.indexType);
    }

    createTypedArray(values = [], indexType = this.indexType) {
        return indexType === "uint16"
            ? Uint16Array.from(values)
            : Uint8Array.from(values);
    }

    ensureTypedArrayLength(typedArray, indexType = this.indexType) {
        const expected = this.volume;
        const output = indexType === "uint16"
            ? new Uint16Array(expected)
            : new Uint8Array(expected);

        output.set(typedArray.slice(0, expected));

        return output;
    }

    inferIndexType(options = {}) {
        const source = options.binary ?? options.indices ?? null;

        if (source?.type || source?.encoding) {
            return Binarier.getBinaryDataType(source, "uint8");
        }

        if (source instanceof Uint16Array) return "uint16";

        return null;
    }

    normalizeColors(colors = []) {
        return (Array.isArray(colors) ? colors : [])
            .map((color) => this.normalizeColor(color))
            .filter(Boolean);
    }

    normalizeColor(color = "#ffffff") {
        const text = typeof color === "string" ? color.trim().toLowerCase() : "";

        return /^#[0-9a-f]{6}$/i.test(text) ? text : "#ffffff";
    }

    normalizeSize(size = 0) {
        const number = Math.floor(Number(size));

        return Number.isFinite(number) && number > 0 ? number : 0;
    }

    normalizeIndexType(indexType = null, colorCount = 0) {
        if (indexType === "uint16") return "uint16";
        if (indexType === "uint8" && colorCount <= 255) return "uint8";

        return colorCount > 255 ? "uint16" : "uint8";
    }
}

export default MicroxelPalette;
