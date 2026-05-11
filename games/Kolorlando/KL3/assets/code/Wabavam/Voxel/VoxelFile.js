import { Binarier } from "../../Memory/Binarier.js";
import { Voxel } from "./Voxel.js";

const VOXEL_BINARY_MAGIC = "KL3B";

export class VoxelFile {
    static async load(path) {
        const response = await fetch(path);

        if (!response.ok) {
            throw new Error(`Voxel file could not be loaded: ${path}`);
        }

        const buffer = await response.arrayBuffer();
        const data = await this.decodeFetchedData(buffer);

        return this.fromData(data);
    }

    static decode(textOrData = {}) {
        const data = typeof textOrData === "string"
            ? JSON.parse(textOrData)
            : textOrData;

        return this.fromData(data);
    }

    static async decodeFetchedData(buffer = new ArrayBuffer(0)) {
        if (this.isBinaryBuffer(buffer)) {
            return new Binarier().decode(buffer);
        }

        const text = new TextDecoder().decode(buffer).trim();
        if (!text) {
            throw new Error("Voxel file is empty.");
        }

        return JSON.parse(text);
    }

    static isBinaryBuffer(buffer = new ArrayBuffer(0)) {
        if (!buffer || buffer.byteLength < VOXEL_BINARY_MAGIC.length) return false;

        const magic = new TextDecoder().decode(
            new Uint8Array(buffer, 0, VOXEL_BINARY_MAGIC.length)
        );

        return magic === VOXEL_BINARY_MAGIC;
    }

    static fromData(data = {}) {
        return new Voxel(this.normalize(data));
    }

    static normalize(data = {}) {
        const hasMicroxelPalette = Boolean(data.microxelPalette ?? data.microxelData);
        const hasLegacyMicroxels = Array.isArray(data.microxels);

        return {
            name: data.name ?? data.id ?? "Voxel",
            color: data.color ?? "#ffffff",
            active: data.active ?? true,
            orientable: data.orientable ?? data.isOrientable ?? false,
            orientation: data.orientation ?? null,
            type: data.type ?? (hasMicroxelPalette || hasLegacyMicroxels ? "microxeled" : "colored"),
            microxelSize: data.microxelSize
                ?? data.microxelPalette?.size
                ?? data.microxelData?.size
                ?? data.microxels?.length
                ?? 0,
            microxelPalette: data.microxelPalette ?? data.microxelData ?? null,
            microxels: data.microxels ?? null,
        };
    }
}

export default VoxelFile;