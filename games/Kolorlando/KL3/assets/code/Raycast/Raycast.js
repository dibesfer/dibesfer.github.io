import {
    Raycaster,
    Vector2,
    Vector3,
} from "three";

export class Raycast {
    constructor(options = {}) {
        this.camera = options.camera ?? null;
        this.woxel = options.woxel ?? null;
        this.ui = options.ui ?? null;

        this.range = options.range ?? 20;
        this.throttleMs = options.throttleMs ?? 80;
        this.getTargets = options.getTargets ?? (() => options.targets ?? []);

        this.raycaster = new Raycaster();
        this.raycaster.far = this.range;

        this.screenCenter = new Vector2(0, 0);
        this.faceNormal = new Vector3();
        this.insidePoint = new Vector3();
        this.samplePoint = new Vector3();
        this.insideEpsilon = options.insideEpsilon ?? 0.01;
        this.gridRayStep = options.gridRayStep ?? 0.05;

        this.lastCastTime = -Infinity;
        this.preserveTargetOnNextMiss = false;

        this.target = null;
        this.targetName = "none";
    }

    setWoxel(woxel) {
        this.woxel = woxel ?? null;
        this.setTarget(null);
        this.forceNextCast({ preserveTargetOnMiss: false });
    }

    update(now = performance.now()) {
        if (!this.canCast(now)) return this.target;

        this.lastCastTime = now;
        this.raycaster.far = this.range;
        this.raycaster.setFromCamera(this.screenCenter, this.camera);

        const target = this.createTargetFromGridRay()
            ?? this.findTargetFromHits(this.raycaster.intersectObjects(this.getRaycastTargets(), true));

        if (!target) {
            return this.handleNoTarget();
        }

        this.preserveTargetOnNextMiss = false;
        this.setTarget(target);

        return this.target;
    }

    canCast(now) {
        if (!this.camera) return false;
        if (!this.woxel) return false;

        return now - this.lastCastTime >= this.throttleMs;
    }

    forceNextCast(options = {}) {
        this.lastCastTime = -Infinity;
        this.preserveTargetOnNextMiss = options.preserveTargetOnMiss ?? true;
    }

    findTargetFromHits(hits = []) {
        for (const hit of hits) {
            const target = this.createTargetFromHit(hit);
            if (target) return target;
        }

        return null;
    }

    createTargetFromGridRay() {
        if (!this.woxel?.gameToGrid || !this.raycaster?.ray) return null;

        const ray = this.raycaster.ray;
        const step = Math.max(0.01, this.gridRayStep);
        let previousGrid = null;

        for (let distance = 0; distance <= this.range; distance += step) {
            this.samplePoint
                .copy(ray.origin)
                .addScaledVector(ray.direction, distance);

            const gridPosition = this.woxel.gameToGrid(this.samplePoint);
            if (!this.isValidGridPosition(gridPosition)) continue;

            if (previousGrid && this.sameGridPosition(previousGrid, gridPosition)) continue;

            const voxel = this.woxel.getVoxelAt?.(
                gridPosition.x,
                gridPosition.y,
                gridPosition.z
            ) ?? null;

            if (voxel?.isActive?.()) {
                return {
                    hit: null,
                    object: null,
                    faceNormal: this.getGridEntryNormal(previousGrid, gridPosition, ray.direction),
                    gridPosition,
                    voxel,
                    name: voxel.name ?? "Voxel",
                };
            }

            previousGrid = gridPosition;
        }

        return null;
    }

    createTargetFromHit(hit) {
        if (!this.isValidHit(hit)) return null;

        const faceNormal = this.getHitFaceNormal(hit);
        const gridPosition = this.getHitGridPosition(hit, faceNormal);
        const voxel = this.woxel?.getVoxelAt?.(
            gridPosition.x,
            gridPosition.y,
            gridPosition.z
        ) ?? null;

        if (!voxel?.isActive?.()) return null;

        return {
            hit,
            object: hit.object,
            faceNormal: faceNormal.clone(),
            gridPosition,
            voxel,
            name: voxel.name ?? "Voxel",
        };
    }

    handleNoTarget() {
        if (this.preserveTargetOnNextMiss && this.target) {
            this.preserveTargetOnNextMiss = false;
            this.lastCastTime = -Infinity;
            return this.target;
        }

        this.preserveTargetOnNextMiss = false;
        this.setTarget(null);

        return this.target;
    }

    getRaycastTargets() {
        const targets = this.getTargets?.() ?? [];

        if (!Array.isArray(targets)) return [];

        return targets.filter(Boolean);
    }

    isValidHit(hit) {
        if (!hit?.object) return false;

        let object = hit.object;

        while (object) {
            if (object.userData?.debugOnly) return false;
            if (object.userData?.highlightOnly) return false;
            if (object.userData?.boxel) return true;

            object = object.parent;
        }

        return false;
    }

    getHitFaceNormal(hit) {
        this.faceNormal
            .copy(hit.face?.normal ?? new Vector3(0, 0, 0))
            .transformDirection(hit.object.matrixWorld);

        return this.cardinalizeNormal(this.faceNormal);
    }

    getHitGridPosition(hit, faceNormal = this.getHitFaceNormal(hit)) {
        this.insidePoint
            .copy(hit.point)
            .addScaledVector(faceNormal, -this.insideEpsilon);

        return this.woxel.gameToGrid(this.insidePoint);
    }

    getGridEntryNormal(previousGrid = null, gridPosition = null, direction = null) {
        if (previousGrid && gridPosition) {
            const delta = {
                x: previousGrid.x - gridPosition.x,
                y: previousGrid.y - gridPosition.y,
                z: previousGrid.z - gridPosition.z,
            };

            return this.cardinalizeGridDelta(delta, direction);
        }

        return this.cardinalizeDirection(direction);
    }

    cardinalizeGridDelta(delta = {}, direction = null) {
        const candidates = ["x", "y", "z"].filter((axis) => (delta[axis] ?? 0) !== 0);

        if (candidates.length === 0) {
            return this.cardinalizeDirection(direction);
        }

        const axis = this.chooseAxis(candidates, direction);
        const normal = new Vector3(0, 0, 0);
        normal[axis] = Math.sign(delta[axis]) || 1;

        return normal;
    }

    cardinalizeDirection(direction = null) {
        if (!direction) return new Vector3(0, 1, 0);

        const axis = this.chooseAxis(["x", "y", "z"], direction);
        const normal = new Vector3(0, 0, 0);
        normal[axis] = -Math.sign(direction[axis] || 1);

        return normal;
    }

    cardinalizeNormal(normal = null) {
        if (!normal) return new Vector3(0, 1, 0);

        const axis = this.chooseAxis(["x", "y", "z"], normal);
        const cardinal = new Vector3(0, 0, 0);
        cardinal[axis] = Math.sign(normal[axis] || 1);

        return cardinal;
    }

    chooseAxis(candidates = ["x", "y", "z"], vector = null) {
        const weights = vector ?? { x: 0, y: 1, z: 0 };
        let bestAxis = candidates[0] ?? "y";
        let bestWeight = -Infinity;

        candidates.forEach((axis) => {
            const weight = Math.abs(weights[axis] ?? 0);

            if (weight > bestWeight) {
                bestAxis = axis;
                bestWeight = weight;
            }
        });

        return bestAxis;
    }

    isValidGridPosition(position = null) {
        return Number.isFinite(position?.x)
            && Number.isFinite(position?.y)
            && Number.isFinite(position?.z)
            && this.woxel?.isInside?.(position.x, position.y, position.z) === true;
    }

    sameGridPosition(a = null, b = null) {
        return a?.x === b?.x
            && a?.y === b?.y
            && a?.z === b?.z;
    }

    setTarget(target) {
        this.target = target;
        this.targetName = target?.name ?? "none";
        this.ui?.setTargetName?.(this.targetName);
    }

    getTarget() {
        return this.target;
    }

    getTargetName() {
        return this.targetName;
    }
}

export default Raycast;
