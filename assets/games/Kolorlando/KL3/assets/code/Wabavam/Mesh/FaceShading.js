import { voxelFakeShading12 } from "../Voxel/12colors/12colors.js";

export const FACE_SHADING = voxelFakeShading12;

export function createFaceShading(overrides = {}) {
    return {
        ...FACE_SHADING,
        ...(overrides ?? {}),
    };
}

export function getFaceShade(direction = "", faceShading = FACE_SHADING) {
    const shade = Number(faceShading?.[direction]);
    return Number.isFinite(shade) ? Math.max(0, shade) : 1;
}

export function normalizeHexColor(color = "#ffffff") {
    if (typeof color !== "string") return "#ffffff";
    const value = color.trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(value) ? value : "#ffffff";
}

export function hexColorToBytes(color = "#ffffff") {
    const value = normalizeHexColor(color);
    return {
        r: parseInt(value.slice(1, 3), 16),
        g: parseInt(value.slice(3, 5), 16),
        b: parseInt(value.slice(5, 7), 16),
    };
}

export function shadeBytes(bytes = { r: 255, g: 255, b: 255 }, shade = 1) {
    const s = normalizeShade(shade);

    // Match Boxel15Mesher vertex colors:
    // THREE.Color(hex) -> linear RGB -> multiply fake shade -> renderer output.
    // FaceBaking paints sRGB texture bytes, so we shade in linear space first
    // and encode back to sRGB before writing the DataTexture.
    return {
        r: linearToByte(srgbByteToLinear(bytes.r) * s),
        g: linearToByte(srgbByteToLinear(bytes.g) * s),
        b: linearToByte(srgbByteToLinear(bytes.b) * s),
    };
}

export function colorToShadedBytes(color = "#ffffff", shade = 1) {
    return shadeBytes(hexColorToBytes(color), shade);
}

function normalizeShade(shade = 1) {
    const value = Number(shade);
    return Math.max(0, Number.isFinite(value) ? value : 1);
}

function srgbByteToLinear(value = 255) {
    const c = clamp01(Number(value) / 255);
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToByte(value = 1) {
    const c = clamp01(value);
    const srgb = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return clampByte(srgb * 255);
}

function clamp01(value = 0) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function clampByte(value = 0) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

