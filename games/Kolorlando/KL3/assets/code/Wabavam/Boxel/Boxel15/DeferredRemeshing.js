import {
    createEmptyDeferredRemeshingResult,
    getBoxel15Key,
    normalizeBoxel15Limit,
    normalizeBoxel15List,
    normalizeBoxel15Milliseconds,
} from "./Boxel15Utils.js";

export class DeferredRemeshing {
    constructor(options = {}) {
        this.mapper = options.mapper ?? null;
        this.woxel = options.woxel ?? null;
        this.maxRemeshPerFlush = normalizeBoxel15Limit(options.maxRemeshPerFlush ?? 1);
        this.maxFlushMs = normalizeBoxel15Milliseconds(options.maxFlushMs ?? options.timeBudgetMs ?? 4);
        this.useNearBoxels = options.useNearBoxels ?? true;

        this.dirtyBoxels = new Map();
        this.lastFlushResult = createEmptyDeferredRemeshingResult();
    }

    setMapper(mapper = null) {
        this.mapper = mapper;

        return this;
    }

    setWoxel(woxel = null) {
        this.woxel = woxel;
        this.clear();

        return this;
    }

    setMaxRemeshPerFlush(limit = 1) {
        this.maxRemeshPerFlush = normalizeBoxel15Limit(limit);

        return this;
    }

    setMaxFlushMs(milliseconds = 4) {
        this.maxFlushMs = normalizeBoxel15Milliseconds(milliseconds);

        return this;
    }

    mark(boxel15s = []) {
        normalizeBoxel15List(boxel15s).forEach((boxel15) => {
            this.dirtyBoxels.set(getBoxel15Key(boxel15), boxel15);
        });

        return this.getDirtyBoxels();
    }

    remeshOrDefer(boxel15s = [], woxel = this.woxel, options = {}) {
        this.mark(boxel15s);

        if (options.flush === false) return [];

        const force = options.force === true;
        const limit = force
            ? Infinity
            : normalizeBoxel15Limit(options.limit ?? this.maxRemeshPerFlush);
        const maxMs = force
            ? Infinity
            : normalizeBoxel15Milliseconds(options.maxMs ?? this.maxFlushMs);

        const result = this.flush({
            force,
            limit,
            maxMs,
            woxel,
        });

        return result.remeshed;
    }

    flush(options = {}) {
        const force = options.force === true;
        const limit = force
            ? Infinity
            : normalizeBoxel15Limit(options.limit ?? this.maxRemeshPerFlush);
        const maxMs = force
            ? Infinity
            : normalizeBoxel15Milliseconds(options.maxMs ?? this.maxFlushMs);
        const woxel = options.woxel ?? this.woxel;
        const startedAt = performance.now();

        const remeshed = [];
        const deferred = [];
        let processed = 0;

        for (const boxel15 of this.getSortedDirtyBoxels()) {
            if (!force && processed >= limit) {
                deferred.push(boxel15);
                continue;
            }

            if (!force && performance.now() - startedAt >= maxMs) {
                deferred.push(boxel15);
                continue;
            }

            if (!force && !this.shouldRemesh(boxel15)) {
                deferred.push(boxel15);
                continue;
            }

            this.dirtyBoxels.delete(getBoxel15Key(boxel15));
            processed++;

            const mesh = this.mapper?.remeshBoxel15Now?.(boxel15, woxel);
            if (mesh) remeshed.push(mesh);
        }

        this.lastFlushResult = {
            remeshed,
            deferred,
            dirtyBoxels: this.getDirtyBoxels(),
            dirtyCount: this.dirtyBoxels.size,
        };

        return this.lastFlushResult;
    }

    flushAll(woxel = this.woxel) {
        return this.flush({
            force: true,
            limit: Infinity,
            maxMs: Infinity,
            woxel,
        });
    }

    shouldRemesh(boxel15) {
        if (!boxel15) return false;

        const mesh = this.mapper?.meshesByBoxel?.get?.(boxel15) ?? null;
        if (!mesh) {
            return this.mapper?.boxel15MeshStreamer?.isWanted?.(boxel15) === true
                || this.mapper?.boxel15RenderDistance?.getEntryState?.(boxel15)?.loadable === true;
        }

        if (mesh.visible === true) return true;
        if (mesh.userData?.boxel15Visible === true) return true;
        if (this.useNearBoxels && mesh.userData?.boxel15Near === true) return true;
        if (this.useNearBoxels && this.mapper?.boxel15RenderDistance?.nearBoxels?.includes?.(boxel15)) return true;

        return false;
    }

    getSortedDirtyBoxels() {
        return this.getDirtyBoxels().sort((a, b) => {
            const aScore = this.getPriorityScore(a);
            const bScore = this.getPriorityScore(b);

            if (aScore !== bScore) return bScore - aScore;

            return getBoxel15Key(a).localeCompare(getBoxel15Key(b));
        });
    }

    getPriorityScore(boxel15) {
        const mesh = this.mapper?.meshesByBoxel?.get?.(boxel15) ?? null;
        let score = 0;

        if (!mesh && this.mapper?.boxel15MeshStreamer?.isWanted?.(boxel15) === true) score += 100;
        if (mesh?.visible === true) score += 80;
        if (mesh?.userData?.boxel15Visible === true) score += 80;
        if (mesh?.userData?.boxel15Near === true) score += 40;
        if (this.mapper?.boxel15RenderDistance?.nearBoxels?.includes?.(boxel15)) score += 40;

        const distance = mesh?.userData?.boxel15Distance;
        if (Number.isFinite(distance)) score -= distance / 1000;

        return score;
    }

    clear() {
        this.dirtyBoxels.clear();
        this.lastFlushResult = createEmptyDeferredRemeshingResult();
    }

    getDirtyBoxels() {
        return Array.from(this.dirtyBoxels.values());
    }

    getDirtyCount() {
        return this.dirtyBoxels.size;
    }

    hasDirtyBoxels() {
        return this.dirtyBoxels.size > 0;
    }

    getLastFlushResult() {
        return this.lastFlushResult;
    }

}

export default DeferredRemeshing;
