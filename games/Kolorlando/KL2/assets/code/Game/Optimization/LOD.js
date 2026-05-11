/*
  KL2 LOD
  -------
  Tiny distance translator.

  Golden Rule:
  - Data stays true.
  - Mesh chooses representation.
  - Render only displays.

  LOD does not analyze boxels.
  LOD does not build meshes.
  LOD does not touch Three.js.
*/

export const LOD_MODE = Object.freeze({
    FULL: "full-detail",
    MEDIUM: "medium-detail",
    MINIMAL: "minimal-detail"
});

export const LOD_DETAIL = Object.freeze({
    FULL_MICROXELS: "full-microxels",
    SIMPLIFIED_VOXELS: "simplified-voxels",
    COLOR_VOLUME: "color-volume",
    EMPTY: "empty"
});

export function positiveNumber(value, fallback = 0) {
    const numeric = Number(value);

    return Number.isFinite(numeric) && numeric >= 0
        ? numeric
        : fallback;
}

export function normalizeLodMode(mode = LOD_MODE.FULL) {
    if (mode === LOD_MODE.MINIMAL) return LOD_MODE.MINIMAL;
    if (mode === LOD_MODE.MEDIUM) return LOD_MODE.MEDIUM;

    return LOD_MODE.FULL;
}

export function getLodMode(distance = 0, settings = {}) {
    if (settings.enabled === false) return LOD_MODE.FULL;

    const fullDistance = positiveNumber(settings.fullDetailDistance ?? settings.fullDistance, 30);
    const mediumDistance = Math.max(
        fullDistance,
        positiveNumber(settings.mediumDetailDistance ?? settings.mediumDistance, 90)
    );
    const value = positiveNumber(distance, 0);

    if (value <= fullDistance) return LOD_MODE.FULL;
    if (value <= mediumDistance) return LOD_MODE.MEDIUM;

    return LOD_MODE.MINIMAL;
}

export function detailForMode(mode = LOD_MODE.FULL, hasMicroxels = false, empty = false) {
    const safeMode = normalizeLodMode(mode);

    if (empty) return LOD_DETAIL.EMPTY;
    if (safeMode === LOD_MODE.FULL) {
        return hasMicroxels
            ? LOD_DETAIL.FULL_MICROXELS
            : LOD_DETAIL.SIMPLIFIED_VOXELS;
    }
    if (safeMode === LOD_MODE.MEDIUM) return LOD_DETAIL.SIMPLIFIED_VOXELS;

    return LOD_DETAIL.COLOR_VOLUME;
}

export function meshStrategyForDetail(detail = LOD_DETAIL.SIMPLIFIED_VOXELS) {
    return {
        [LOD_DETAIL.FULL_MICROXELS]: "real-mesh-full-microxels",
        [LOD_DETAIL.SIMPLIFIED_VOXELS]: "real-mesh-simplified-voxels",
        [LOD_DETAIL.COLOR_VOLUME]: "dominant-color-volume",
        [LOD_DETAIL.EMPTY]: "none"
    }[detail] || "real-mesh-simplified-voxels";
}

export class LOD {
    static Mode = LOD_MODE;
    static Detail = LOD_DETAIL;

    constructor({
        enabled = true,
        fullDetailDistance = 30,
        mediumDetailDistance = 90,
        fullDistance = fullDetailDistance,
        mediumDistance = mediumDetailDistance
    } = {}) {
        this.enabled = Boolean(enabled);
        this.fullDetailDistance = positiveNumber(fullDistance, 30);
        this.mediumDetailDistance = Math.max(
            this.fullDetailDistance,
            positiveNumber(mediumDistance, 90)
        );
    }

    configure({
        enabled = this.enabled,
        fullDetailDistance = this.fullDetailDistance,
        mediumDetailDistance = this.mediumDetailDistance,
        fullDistance = fullDetailDistance,
        mediumDistance = mediumDetailDistance
    } = {}) {
        this.enabled = Boolean(enabled);
        this.fullDetailDistance = positiveNumber(fullDistance, this.fullDetailDistance);
        this.mediumDetailDistance = Math.max(
            this.fullDetailDistance,
            positiveNumber(mediumDistance, this.mediumDetailDistance)
        );

        return this;
    }

    settings() {
        return {
            enabled: this.enabled,
            fullDetailDistance: this.fullDetailDistance,
            mediumDetailDistance: this.mediumDetailDistance
        };
    }

    modeForDistance(distance = 0) {
        return getLodMode(distance, this.settings());
    }

    modeForSummary(summary = {}) {
        return this.modeForDistance(summary.centerDistance ?? summary.distance ?? 0);
    }

    boxelPlan(boxel = null, distance = 0) {
        const mode = this.modeForDistance(distance);
        const detail = detailForMode(mode);

        return {
            boxel,
            visible: true,
            mode,
            rawMode: mode,
            detail,

            distance,
            centerDistance: distance,
            distanceSpace: "render-horizontal",

            // Cheap placeholders.
            // Real counts belong to BoxelAnalysis, called only when data changes.
            empty: false,
            voxelCount: null,
            microxeledVoxelCount: null,
            hasMicroxeledVoxels: null,
            microxelCount: null,
            renderUnitCount: null,
            colorCount: null,
            complexity: null,

            dominantColor: null,
            bounds: null,
            localCenter: null,
            worldCenter: null,

            useFullMicroxels: detail === LOD_DETAIL.FULL_MICROXELS,
            simplifyMicroxels: detail === LOD_DETAIL.SIMPLIFIED_VOXELS,
            collapseToBoxel: detail === LOD_DETAIL.COLOR_VOLUME,

            editable: mode === LOD_MODE.FULL,
            raycastable: mode === LOD_MODE.FULL || mode === LOD_MODE.MEDIUM,
            meshStrategy: meshStrategyForDetail(detail),
            reason: this.reasonForMode(mode)
        };
    }

    boxelPlanFromOrigin(boxel, origin = {}) {
        return this.boxelPlan(boxel, this.distanceFromBoxelCenter(boxel, origin));
    }

    voxelPlan(voxel, mode = LOD_MODE.FULL) {
        const safeMode = normalizeLodMode(mode);
        const visible = Boolean(voxel && voxel.active !== false);
        const hasMicroxels = Boolean(
            voxel?.hasMicroxels?.()
            || voxel?.hasSemanticMicroxels?.()
            || voxel?.type === "microxeled"
        );
        const detail = detailForMode(safeMode, hasMicroxels, !visible);

        return {
            voxel,
            mode: safeMode,
            visible,
            detail,
            color: voxel?.color || "#ffffff",
            isMicroxeled: hasMicroxels,
            useMicroxels: safeMode === LOD_MODE.FULL && hasMicroxels,
            simplifyMicroxels: safeMode === LOD_MODE.MEDIUM && hasMicroxels,
            collapseToVolume: safeMode === LOD_MODE.MINIMAL
        };
    }

    voxelPlans(boxel, mode = LOD_MODE.FULL) {
        const voxels = Array.isArray(boxel?.voxels) ? boxel.voxels : [];

        return voxels
            .filter(voxel => voxel?.active !== false)
            .map(voxel => this.voxelPlan(voxel, mode));
    }

    detailForBoxelSummary(summary = {}, mode = LOD_MODE.FULL) {
        return detailForMode(mode, Boolean(summary.hasMicroxeledVoxels), Boolean(summary.empty));
    }

    meshStrategyForDetail(detail = LOD_DETAIL.SIMPLIFIED_VOXELS) {
        return meshStrategyForDetail(detail);
    }

    reasonForPlan(summary = {}, mode = LOD_MODE.FULL) {
        if (summary.empty) return "empty-boxel";

        return this.reasonForMode(mode);
    }

    reasonForMode(mode = LOD_MODE.FULL) {
        const safeMode = normalizeLodMode(mode);

        if (safeMode === LOD_MODE.FULL) return "near-full-detail";
        if (safeMode === LOD_MODE.MEDIUM) return "mid-distance-simplification";

        return "far-distance-collapse";
    }

    distanceFromBoxelCenter(boxel = {}, origin = {}) {
        const position = boxel.position || {};
        const size = positiveNumber(boxel.size ?? boxel.boxelSize, 15);
        const centerX = positiveNumber(position.x, 0) + size * 0.5;
        const centerZ = positiveNumber(position.z, 0) + size * 0.5;
        const dx = centerX - positiveNumber(origin.x, 0);
        const dz = centerZ - positiveNumber(origin.z, 0);

        return Math.sqrt(dx * dx + dz * dz);
    }

    positiveNumber(value, fallback = 0) {
        return positiveNumber(value, fallback);
    }
}

export default LOD;
