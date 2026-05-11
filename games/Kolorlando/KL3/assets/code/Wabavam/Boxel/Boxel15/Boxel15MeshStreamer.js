import {
    addUniqueBoxel15s,
    createBoxel15Set,
    createEmptyBoxel15StreamResult,
    getBoxel15Key,
    normalizeBoxel15Limit,
} from "./Boxel15Utils.js";

export class Boxel15MeshStreamer {
    constructor(options = {}) {
        this.mapper = options.mapper ?? null;
        this.woxel = options.woxel ?? null;

        this.maxLoadsPerFrame = normalizeBoxel15Limit(options.maxLoadsPerFrame ?? 2);
        this.maxUnloadsPerFrame = normalizeBoxel15Limit(options.maxUnloadsPerFrame ?? 6);
        this.maxLoadedMeshes = normalizeBoxel15Limit(options.maxLoadedMeshes ?? 160);

        this.keepNearLoaded = options.keepNearLoaded ?? true;
        this.unloadFarMeshes = options.unloadFarMeshes ?? true;
        this.unloadBudgetedOut = options.unloadBudgetedOut ?? false;

        this.lastStreamResult = createEmptyBoxel15StreamResult();
    }

    setMapper(mapper = null) {
        this.mapper = mapper;
        return this;
    }

    setWoxel(woxel = null) {
        this.woxel = woxel;
        this.lastStreamResult = createEmptyBoxel15StreamResult();
        return this;
    }

    stream(stats = {}) {
        if (!this.mapper || !this.woxel) {
            this.lastStreamResult = createEmptyBoxel15StreamResult();
            return this.lastStreamResult;
        }

        const wantedBoxels = this.getWantedBoxels(stats);
        const wantedSet = createBoxel15Set(wantedBoxels);

        const loaded = this.loadWantedMeshes(wantedBoxels);
        const unloaded = this.unloadUnwantedMeshes(wantedSet);

        this.syncDebugBoundsForLoadedMeshes();

        this.lastStreamResult = {
            loaded,
            unloaded,
            wantedBoxels,
            wantedCount: wantedBoxels.length,
            loadedCount: this.mapper.meshesByBoxel?.size ?? 0,
        };

        return this.lastStreamResult;
    }

    getWantedBoxels(stats = {}) {
        const wanted = [];
        const seen = new Set();

        addUniqueBoxel15s(wanted, seen, stats.visibleBoxels);

        if (this.keepNearLoaded) {
            addUniqueBoxel15s(wanted, seen, stats.loadBoxels ?? stats.nearBoxels);
        }

        return this.limitWantedBoxels(wanted);
    }

    limitWantedBoxels(boxels = []) {
        if (!Number.isFinite(this.maxLoadedMeshes)) return boxels;
        return boxels.slice(0, this.maxLoadedMeshes);
    }

    loadWantedMeshes(wantedBoxels = []) {
        const loaded = [];
        let loadCount = 0;

        for (const boxel15 of wantedBoxels) {
            if (loadCount >= this.maxLoadsPerFrame) break;
            if (this.mapper.meshesByBoxel?.has?.(boxel15)) continue;

            const mesh = this.mapper.ensureBoxel15Mesh?.(boxel15);
            if (!mesh) continue;

            loaded.push(mesh);
            loadCount++;
        }

        return loaded;
    }

    unloadUnwantedMeshes(wantedSet = new Set()) {
        if (!this.unloadFarMeshes) return [];

        const unloaded = [];
        let unloadCount = 0;
        const loadedBoxels = Array.from(this.mapper.meshesByBoxel?.keys?.() ?? []);

        for (const boxel15 of loadedBoxels) {
            if (unloadCount >= this.maxUnloadsPerFrame) break;
            if (wantedSet.has(getBoxel15Key(boxel15))) continue;
            if (this.shouldKeepLoaded(boxel15)) continue;

            const mesh = this.mapper.destroyBoxel15Mesh?.(boxel15);
            this.mapper.destroyBoxel15Bounds?.(boxel15);
            if (!mesh) continue;

            unloaded.push(mesh);
            unloadCount++;
        }

        return unloaded;
    }

    shouldKeepLoaded(boxel15) {
        const key = getBoxel15Key(boxel15);

        if (this.mapper?.deferredRemeshing?.dirtyBoxels?.has?.(key)) return true;
        if (this.unloadBudgetedOut) return false;

        const mesh = this.mapper?.meshesByBoxel?.get?.(boxel15) ?? null;
        if (!mesh) return false;

        return mesh.userData?.boxel15BudgetedOut !== true
            && mesh.userData?.boxel15FrustumCulled !== true;
    }

    syncDebugBoundsForLoadedMeshes() {
        if (!this.mapper?.debugBoundsVisible) return;

        this.mapper.meshesByBoxel?.forEach?.((_mesh, boxel15) => {
            this.mapper.ensureBoxel15Bounds?.(boxel15);
        });
    }

    isWanted(boxel15) {
        const key = getBoxel15Key(boxel15);
        return (this.lastStreamResult?.wantedBoxels ?? [])
            .some((item) => getBoxel15Key(item) === key);
    }

    getLastStreamResult() {
        return this.lastStreamResult;
    }

}

export default Boxel15MeshStreamer;
