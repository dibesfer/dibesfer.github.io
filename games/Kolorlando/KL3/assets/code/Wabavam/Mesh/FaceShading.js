export const FACE_SHADING = Object.freeze({
    // Central fake shading knobs.
    // 1.0 = real voxel color. Lower values only darken that face direction.
    py: 1.00, // top
    px: 0.92, // right
    nx: 0.88, // left
    pz: 0.84, // front
    nz: 0.80, // back
    ny: 0.68, // bottom
});

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
    const s = Math.max(0, Number.isFinite(Number(shade)) ? Number(shade) : 1);
    return {
        r: clampByte(bytes.r * s),
        g: clampByte(bytes.g * s),
        b: clampByte(bytes.b * s),
    };
}

export function colorToShadedBytes(color = "#ffffff", shade = 1) {
    return shadeBytes(hexColorToBytes(color), shade);
}

function clampByte(value = 0) {
    return Math.max(0, Math.min(255, Math.round(value)));
}
