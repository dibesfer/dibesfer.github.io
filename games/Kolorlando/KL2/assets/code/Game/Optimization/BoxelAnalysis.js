/*
  KL2 BoxelAnalysis
  -----------------
  Read-only helpers.

  BoxelAnalysis describes data.
  It does not decide LOD.
  It does not build meshes.
  It does not render.

  Use it when a boxel is created, loaded or dirtied.
  Do not call heavy summaries every frame.
*/

export function number(value, fallback = 0) {
    const numeric = Number(value);

    return Number.isFinite(numeric) ? numeric : fallback;
}

export function position(source = {}) {
    return {
        x: number(source.x),
        y: number(source.y),
        z: number(source.z)
    };
}

export function color(value = "#ffffff") {
    return typeof value === "string" && value.trim()
        ? value.trim()
        : "#ffffff";
}

export function voxels(boxel) {
    return Array.isArray(boxel?.voxels) ? boxel.voxels : [];
}

export function activeVoxels(boxel) {
    return voxels(boxel).filter(voxel => voxel?.active !== false);
}

export function isMicroxeledVoxel(voxel) {
    return Boolean(
        voxel?.hasMicroxels?.()
        || voxel?.hasSemanticMicroxels?.()
        || voxel?.type === "microxeled"
        || (microxelSize(voxel) > 1 && Array.isArray(voxel?.microxels))
    );
}

export function microxelSize(voxel) {
    const size = number(voxel?.microxelSize, 1);

    return size > 0 ? size : 1;
}

export function microxels(voxel) {
    const source = voxel?.effectiveMicroxels?.() || voxel?.microxels || [];

    return Array.isArray(source) ? source : [];
}

export function flattenMicroxels(voxel) {
    const cells = [];

    microxels(voxel).forEach(plane => {
        plane?.forEach?.(row => {
            row?.forEach?.(cell => cells.push(cell));
        });
    });

    return cells;
}

export function activeMicroxels(voxel) {
    return flattenMicroxels(voxel).filter(cell => cell?.active !== false && cell?.filled !== false);
}

export function voxelMicroxelCount(voxel) {
    return isMicroxeledVoxel(voxel) ? activeMicroxels(voxel).length : 0;
}

export function microxeledVoxelCount(boxel) {
    return activeVoxels(boxel).filter(isMicroxeledVoxel).length;
}

export function microxelCount(boxel) {
    return activeVoxels(boxel).reduce((total, voxel) => total + voxelMicroxelCount(voxel), 0);
}

export function voxelColor(voxel) {
    if (!isMicroxeledVoxel(voxel)) return color(voxel?.color);

    return dominantColor(activeMicroxels(voxel).map(cell => color(cell?.color || voxel?.color)))
        || color(voxel?.color);
}

export function dominantColor(colors = []) {
    const counts = new Map();

    colors.forEach(value => {
        if (!value) return;

        const safeColor = color(value);
        counts.set(safeColor, (counts.get(safeColor) || 0) + 1);
    });

    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

export function dominantBoxelColor(boxel) {
    return dominantColor(activeVoxels(boxel).map(voxelColor)) || "#ffffff";
}

export function colorSet(boxel) {
    return new Set(activeVoxels(boxel).map(voxelColor));
}

export function colorCount(boxel) {
    return colorSet(boxel).size;
}

export function voxelCount(boxel) {
    return activeVoxels(boxel).length;
}

export function isEmpty(boxel) {
    return voxelCount(boxel) === 0;
}

export function renderUnitCount(boxel) {
    return activeVoxels(boxel).reduce((total, voxel) => {
        const count = voxelMicroxelCount(voxel);

        return total + (count > 0 ? count : 1);
    }, 0);
}

export function bounds(boxel) {
    const items = activeVoxels(boxel);

    if (items.length === 0) {
        return {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 0, y: 0, z: 0 },
            size: { x: 0, y: 0, z: 0 },
            center: { x: 0, y: 0, z: 0 },
            volume: 0
        };
    }

    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };

    items.forEach(voxel => {
        const point = position(voxel.position || voxel);

        min.x = Math.min(min.x, point.x);
        min.y = Math.min(min.y, point.y);
        min.z = Math.min(min.z, point.z);
        max.x = Math.max(max.x, point.x);
        max.y = Math.max(max.y, point.y);
        max.z = Math.max(max.z, point.z);
    });

    const size = {
        x: max.x - min.x + 1,
        y: max.y - min.y + 1,
        z: max.z - min.z + 1
    };
    const center = {
        x: min.x + size.x * 0.5,
        y: min.y + size.y * 0.5,
        z: min.z + size.z * 0.5
    };

    return {
        min,
        max,
        size,
        center,
        volume: size.x * size.y * size.z
    };
}

export function worldCenter(boxel) {
    const origin = position(boxel?.position);
    const local = bounds(boxel).center;

    return {
        x: origin.x + local.x,
        y: origin.y + local.y,
        z: origin.z + local.z
    };
}

export function distanceBetween(a = {}, b = {}) {
    const pa = position(a);
    const pb = position(b);
    const dx = pa.x - pb.x;
    const dy = pa.y - pb.y;
    const dz = pa.z - pb.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function horizontalDistanceBetween(a = {}, b = {}) {
    const pa = position(a);
    const pb = position(b);
    const dx = pa.x - pb.x;
    const dz = pa.z - pb.z;

    return Math.sqrt(dx * dx + dz * dz);
}

export function distanceFrom(boxel, origin = {}) {
    return horizontalDistanceBetween(boxel?.position || {}, origin);
}

export function centerDistanceFrom(boxel, origin = {}) {
    return horizontalDistanceBetween(worldCenter(boxel), origin);
}

export function complexity(boxel) {
    // Cheap cached-ish score. Useful for debug/offline summaries, not per-frame policy.
    return Math.round(
        voxelCount(boxel)
        + microxeledVoxelCount(boxel) * 4
        + microxelCount(boxel) * 0.5
        + colorCount(boxel) * 2
        + bounds(boxel).volume * 0.03
    );
}

export function summary(boxel, origin = null) {
    const boxelBounds = bounds(boxel);
    const count = voxelCount(boxel);
    const microCount = microxelCount(boxel);
    const microVoxelCount = microxeledVoxelCount(boxel);
    const center = worldCenter(boxel);

    return {
        boxel,
        empty: count === 0,
        voxelCount: count,
        microxeledVoxelCount: microVoxelCount,
        hasMicroxeledVoxels: microVoxelCount > 0,
        microxelCount: microCount,
        renderUnitCount: count + microCount,
        colorCount: colorCount(boxel),
        dominantColor: dominantBoxelColor(boxel),
        bounds: boxelBounds,
        localCenter: boxelBounds.center,
        worldCenter: center,
        distance: origin ? distanceFrom(boxel, origin) : null,
        centerDistance: origin ? horizontalDistanceBetween(center, origin) : null,
        complexity: complexity(boxel)
    };
}

export class BoxelAnalysis {
    static number = number;
    static position = position;
    static color = color;
    static voxels = voxels;
    static activeVoxels = activeVoxels;
    static isMicroxeledVoxel = isMicroxeledVoxel;
    static microxelSize = microxelSize;
    static microxels = microxels;
    static flattenMicroxels = flattenMicroxels;
    static activeMicroxels = activeMicroxels;
    static voxelMicroxelCount = voxelMicroxelCount;
    static microxeledVoxelCount = microxeledVoxelCount;
    static microxelCount = microxelCount;
    static voxelColor = voxelColor;
    static dominantColor = dominantColor;
    static dominantBoxelColor = dominantBoxelColor;
    static colorSet = colorSet;
    static colorCount = colorCount;
    static voxelCount = voxelCount;
    static isEmpty = isEmpty;
    static renderUnitCount = renderUnitCount;
    static bounds = bounds;
    static worldCenter = worldCenter;
    static distanceBetween = distanceBetween;
    static horizontalDistanceBetween = horizontalDistanceBetween;
    static distanceFrom = distanceFrom;
    static centerDistanceFrom = centerDistanceFrom;
    static complexity = complexity;
    static summary = summary;
}

export default BoxelAnalysis;
