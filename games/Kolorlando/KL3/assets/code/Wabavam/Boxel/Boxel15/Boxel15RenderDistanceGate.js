import { getBoxel15Key } from "./Boxel15Utils.js";

export class Boxel15RenderDistanceGate {
    constructor(options = {}) {
        this.app = options.app ?? null;
        this.boxelSize = options.boxelSize ?? 15;

        // State-driven, not frame-driven.
        // Movement uses sub-Boxel15 buckets so forward chunks wake up before
        // the player fully crosses into the next chunk.
        this.movementBucketDivisions = options.movementBucketDivisions ?? 3;
        this.directionBucketStep = options.directionBucketStep ?? 0.125;

        this.lastStateKey = null;
        this.dirty = true;
        this.dirtyReason = "initial";
        this.lastResult = null;
    }

    setApp(app = null) {
        this.app = app;
        return this;
    }

    markDirty(reason = "dirty") {
        this.dirty = true;
        this.dirtyReason = reason;
        return this;
    }

    reset(reason = "reset") {
        this.lastStateKey = null;
        this.lastResult = null;
        return this.markDirty(reason);
    }

    updateIfNeeded(app = this.app) {
        if (!app?.mapper || !app?.player) return null;

        const cameraPosition = app.player.getCameraPosition();
        const cameraDirection = app.player.getCameraDirection();
        const stateKey = this.createStateKey(app, cameraPosition, cameraDirection);

        if (!this.dirty && stateKey === this.lastStateKey) {
            return this.continuePendingMeshStreaming(app);
        }

        this.lastStateKey = stateKey;
        this.dirty = false;
        this.dirtyReason = null;

        this.lastResult = app.mapper.updateBoxel15RenderDistance(
            cameraPosition,
            cameraDirection
        );

        return this.lastResult;
    }

    continuePendingMeshStreaming(app = this.app) {
        if (!this.lastResult || !this.hasPendingMeshStreaming(app, this.lastResult)) {
            return this.lastResult;
        }

        const meshStreaming = app.mapper.boxel15MeshStreamer.stream(this.lastResult);
        this.lastResult.meshStreaming = meshStreaming;

        // New meshes created by the streamer need to become raycastable without
        // recalculating the whole render-distance state.
        app.mapper.syncRaycastableMeshes?.(this.lastResult);
        app.mapper.applyDebugBoundsVisibility?.();

        return this.lastResult;
    }

    hasPendingMeshStreaming(app = this.app, stats = this.lastResult) {
        const mapper = app?.mapper ?? null;
        const streamer = mapper?.boxel15MeshStreamer ?? null;
        const wantedBoxels = stats?.meshStreaming?.wantedBoxels
            ?? stats?.wantedBoxels
            ?? [];

        if (!mapper || !streamer || wantedBoxels.length === 0) return false;

        const wantedSet = new Set(wantedBoxels.map((boxel15) => getBoxel15Key(boxel15)));

        for (const boxel15 of wantedBoxels) {
            if (!mapper.meshesByBoxel?.has?.(boxel15)) return true;
        }

        const loadedBoxels = Array.from(mapper.meshesByBoxel?.keys?.() ?? []);
        for (const boxel15 of loadedBoxels) {
            const key = getBoxel15Key(boxel15);
            if (wantedSet.has(key)) continue;
            if (streamer.shouldKeepLoaded?.(boxel15) === true) continue;
            return true;
        }

        return false;
    }

    createStateKey(app, cameraPosition = null, cameraDirection = null) {
        return [
            this.createWoxelKey(app),
            this.createRenderSettingsKey(app),
            this.createMovementBucketKey(app, cameraPosition),
            this.createDirectionKey(cameraDirection),
        ].join("|");
    }

    createWoxelKey(app = null) {
        const woxel = app?.woxel ?? app?.mapper?.currentWoxel ?? null;
        if (!woxel) return "woxel:none";

        const name = woxel.name ?? "woxel";
        const size = woxel.size
            ? `${woxel.size.x ?? 0},${woxel.size.y ?? 0},${woxel.size.z ?? 0}`
            : "size:none";
        const boxelCount = this.countBoxel15s(woxel);

        return `woxel:${name}:${size}:${boxelCount}`;
    }

    createRenderSettingsKey(app = null) {
        const mapper = app?.mapper ?? null;
        const distance = mapper?.getBoxel15RenderDistance?.()
            ?? mapper?.boxel15RenderDistance?.getDistance?.()
            ?? "distance:none";
        const budget = mapper?.getBoxel15RenderBudget?.()
            ?? mapper?.boxel15RenderDistance?.getRenderBudget?.()
            ?? "budget:none";

        return `settings:${distance}:${budget}`;
    }

    createMovementBucketKey(app = null, cameraPosition = null) {
        const gridPosition = this.toGridPosition(app, cameraPosition);
        const bucketSize = this.getMovementBucketSize(app);

        return [
            "move",
            this.bucket(gridPosition.x, bucketSize),
            this.bucket(gridPosition.y, bucketSize),
            this.bucket(gridPosition.z, bucketSize),
        ].join(":");
    }

    createDirectionKey(cameraDirection = null) {
        if (!cameraDirection) return "dir:none";

        const x = Number(cameraDirection.x ?? 0);
        const y = Number(cameraDirection.y ?? 0);
        const z = Number(cameraDirection.z ?? 0);
        const length = Math.hypot(x, y, z);

        if (length === 0) return "dir:none";

        const step = this.directionBucketStep;

        return [
            "dir",
            this.quantize(x / length, step),
            this.quantize(y / length, step),
            this.quantize(z / length, step),
        ].join(":");
    }

    toGridPosition(app = null, cameraPosition = null) {
        const position = cameraPosition ?? { x: 0, y: 0, z: 0 };
        const woxel = app?.woxel ?? app?.mapper?.currentWoxel ?? null;

        if (woxel?.gameToGrid) {
            return woxel.gameToGrid(position);
        }

        return {
            x: position.x ?? 0,
            y: position.y ?? 0,
            z: position.z ?? 0,
        };
    }

    getMovementBucketSize(app = null) {
        const boxelSize = this.getBoxelSize(app);
        const divisions = Number(this.movementBucketDivisions);

        if (!Number.isFinite(divisions) || divisions <= 1) return boxelSize;

        return Math.max(1, boxelSize / divisions);
    }

    getBoxelSize(app = null) {
        const firstBoxel = this.getFirstBoxel15(app);
        const size = firstBoxel?.size?.x ?? this.boxelSize;
        const number = Number(size);

        return Number.isFinite(number) && number > 0 ? number : this.boxelSize;
    }

    getFirstBoxel15(app = null) {
        let firstBoxel = null;
        app?.woxel?.forEachBoxel?.((boxel15) => {
            if (!firstBoxel) firstBoxel = boxel15;
        });

        return firstBoxel;
    }

    countBoxel15s(woxel = null) {
        let count = 0;
        woxel?.forEachBoxel?.(() => {
            count++;
        });

        return count;
    }

    bucket(value = 0, size = this.boxelSize) {
        const number = Number(value);
        const bucketSize = Number(size);

        if (!Number.isFinite(number)) return 0;
        if (!Number.isFinite(bucketSize) || bucketSize <= 0) return Math.floor(number);

        return Math.floor(number / bucketSize);
    }

    quantize(value = 0, step = this.directionBucketStep) {
        const number = Number(value);
        const bucketStep = Number(step);

        if (!Number.isFinite(number)) return 0;
        if (!Number.isFinite(bucketStep) || bucketStep <= 0) return number;

        return Math.round(number / bucketStep);
    }
}

export default Boxel15RenderDistanceGate;
