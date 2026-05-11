import BoxelAnalysis from "../BoxelAnalysis.js";

/*
  KL2 OcclusionCulling
  --------------------
  Decides whether a Boxel15 is probably hidden behind solid world data.

  Important:
  - Occlusion is useful in caves / closed spaces.
  - Occlusion can be wasteful in open spaces.
  - This class is deliberately conservative.

  It should skip open world traversal by default.
*/

export class OcclusionCulling {
    static Mode = Object.freeze({
        OFF: "off",
        SOFT: "soft",
        HARD: "hard"
    });

    static Space = Object.freeze({
        OPEN: "open-space",
        CLOSED: "closed-space",
        UNKNOWN: "unknown-space"
    });

    constructor({
        mode = OcclusionCulling.Mode.SOFT,
        maxDistance = 90,
        sampleStep = 15,
        verticalTolerance = 3,
        minClosedSolidSamples = 5,
        closedSpaceRadius = 2
    } = {}) {
        this.mode = mode;
        this.maxDistance = maxDistance;
        this.sampleStep = sampleStep;
        this.verticalTolerance = verticalTolerance;
        this.minClosedSolidSamples = minClosedSolidSamples;
        this.closedSpaceRadius = closedSpaceRadius;
    }

    shouldRun(origin = {}, isSolidAt = null) {
        if (this.mode === OcclusionCulling.Mode.OFF) return false;
        if (!isSolidAt) return false;

        return this.spaceAt(origin, isSolidAt) === OcclusionCulling.Space.CLOSED;
    }

    spaceAt(origin = {}, isSolidAt = null) {
        if (!isSolidAt) return OcclusionCulling.Space.UNKNOWN;

        const samplePositions = this.closedSpaceSamples(origin);
        let solidSamples = 0;

        for (const position of samplePositions) {
            if (isSolidAt(position)) solidSamples += 1;
        }

        return solidSamples >= this.minClosedSolidSamples
            ? OcclusionCulling.Space.CLOSED
            : OcclusionCulling.Space.OPEN;
    }

    closedSpaceSamples(origin = {}) {
        const x = Math.round(origin.x || 0);
        const y = Math.round(origin.y || 0);
        const z = Math.round(origin.z || 0);
        const r = this.closedSpaceRadius;

        return [
            { x: x + r, y, z },
            { x: x - r, y, z },
            { x, y, z: z + r },
            { x, y, z: z - r },
            { x, y: y + r, z },
            { x, y: y - r, z },
            { x: x + r, y: y + r, z },
            { x: x - r, y: y + r, z },
            { x, y: y + r, z: z + r },
            { x, y: y + r, z: z - r }
        ];
    }

    plan(boxel, origin = {}, isSolidAt = null, options = {}) {
        const mode = options.mode || this.mode;
        const distance = BoxelAnalysis.distanceFrom(boxel, origin);
        const bounds = BoxelAnalysis.bounds(boxel);
        const space = this.spaceAt(origin, isSolidAt);

        if (mode === OcclusionCulling.Mode.OFF) {
            return this.visiblePlan(boxel, distance, bounds, space, "disabled");
        }

        if (space !== OcclusionCulling.Space.CLOSED) {
            return this.visiblePlan(boxel, distance, bounds, space, "open-space-skip");
        }

        if (distance > this.maxDistance) {
            return this.visiblePlan(boxel, distance, bounds, space, "too-far");
        }

        const originY = Number(origin.y) || 0;
        const targetY = (boxel?.position?.y || 0) + bounds.center.y;

        if (Math.abs(targetY - originY) > this.verticalTolerance + bounds.size.y) {
            return this.visiblePlan(boxel, distance, bounds, space, "vertical-skip");
        }

        const occluded = this.isBoxelOccluded(boxel, origin, isSolidAt, bounds);

        return {
            boxel,
            mode,
            space,
            distance,
            bounds,
            visible: !occluded,
            occluded,
            reason: occluded ? "occluded" : "clear-line",
            priority: "low-in-open-space-high-in-closed-space"
        };
    }

    isBoxelOccluded(boxel, origin = {}, isSolidAt = null, bounds = BoxelAnalysis.bounds(boxel)) {
        if (!boxel || !isSolidAt) return false;

        const target = BoxelAnalysis.worldCenter(boxel);
        const distance = BoxelAnalysis.distanceBetween(origin, target);
        const steps = Math.max(1, Math.floor(distance / this.sampleStep));

        for (let i = 1; i < steps; i += 1) {
            const t = i / steps;
            const sample = {
                x: Math.round(this.lerp(origin.x || 0, target.x, t)),
                y: Math.round(this.lerp(origin.y || 0, target.y, t)),
                z: Math.round(this.lerp(origin.z || 0, target.z, t))
            };

            if (isSolidAt(sample)) return true;
        }

        return false;
    }

    visiblePlan(boxel, distance = 0, bounds = BoxelAnalysis.bounds(boxel), space = OcclusionCulling.Space.UNKNOWN, reason = "visible") {
        return {
            boxel,
            mode: this.mode,
            space,
            distance,
            bounds,
            visible: true,
            occluded: false,
            reason,
            priority: space === OcclusionCulling.Space.CLOSED ? "useful" : "skip"
        };
    }

    lerp(a = 0, b = 0, t = 0) {
        return a + (b - a) * t;
    }
}

export default OcclusionCulling;

