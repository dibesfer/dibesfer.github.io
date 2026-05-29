export class Mesh {
    constructor({
        mapper = null,
        setChunkState = null,
        clearChunkState = null,
        hasFinishedMeshState = null,
        shouldRemeshFinishedBoxel = null,
        onSkip = null,
        limit = 72
    } = {}) {
        this.mapper = mapper;
        this.setChunkState = setChunkState;
        this.clearChunkState = clearChunkState;
        this.hasFinishedMeshState = hasFinishedMeshState;
        this.shouldRemeshFinishedBoxel = shouldRemeshFinishedBoxel;
        this.onSkip = onSkip;
        this.limit = limit;
        this.queue = [];
        this.keys = new Set();
        this.times = new Map();
        this.trimmed = 0;
    }

    add(boxel, { force = false, player = null, prioritize = null } = {}) {
        if (!boxel || (!force && !boxel.voxels?.length)) return false;
        const key = this.mapper.voxelKey(boxel.position);

        if (this.keys.has(key)) return false;
        if (!force && this.hasFinishedMeshState?.(key)) return false;
        if (force && this.hasFinishedMeshState?.(key) && !this.shouldRemeshFinishedBoxel?.(boxel, key)) return false;

        this.queue.push(boxel);
        this.keys.add(key);
        this.times.set(key, performance.now());
        this.setChunkState?.(key, "queuedMesh");
        if (player) this.trim(prioritize);
        return true;
    }

    take() {
        const boxel = this.queue.shift();

        if (!boxel) return null;

        const key = this.mapper.voxelKey(boxel.position);
        this.keys.delete(key);
        this.times.delete(key);
        return { boxel, key };
    }

    prune(keepKeys = new Set()) {
        const before = this.queue.length;

        this.queue = this.queue.filter(boxel => keepKeys.has(this.mapper.voxelKey(boxel.position)) || boxel.persisted);
        this.keys = new Set(this.queue.map(boxel => this.mapper.voxelKey(boxel.position)));
        this.times.forEach((_, key) => {
            if (!this.keys.has(key)) {
                this.times.delete(key);
                this.clearChunkState?.(key, "queuedMesh");
            }
        });
        this.onSkip?.(before - this.queue.length);
    }

    sort(compare) {
        this.queue.sort(compare);
    }

    trim(prioritize = null) {
        if (this.queue.length <= this.limit) return 0;

        prioritize?.();
        const removed = this.queue.splice(this.limit);

        removed.forEach(boxel => {
            const key = this.mapper.voxelKey(boxel.position);

            this.keys.delete(key);
            this.times.delete(key);
            this.clearChunkState?.(key, "queuedMesh");
        });
        this.trimmed += removed.length;
        return removed.length;
    }

    hasWork() {
        return this.queue.length > 0;
    }

    profile(chunkProfile = {}) {
        return {
            meshQueue: this.queue.length,
            queuedMesh: chunkProfile.chunkStates?.queuedMesh ?? 0,
            meshReady: chunkProfile.chunkStates?.meshReady ?? 0,
            avgMsPerJob: chunkProfile.meshMsRecentAvg ?? 0,
            recentMeshMs: chunkProfile.meshMsRecentTotal ?? 0,
            recentJobs: chunkProfile.meshJobsRecent ?? 0,
            pendingJobs: chunkProfile.pendingMeshJobs ?? 0,
            maxWorkerJobs: chunkProfile.maxWorkerJobs ?? 0,
            peakQueue: chunkProfile.peakMeshQueueRecent ?? this.queue.length,
            queueLimit: this.limit,
            sessionPeakQueue: chunkProfile.peakMeshQueueSession ?? 0,
            workerMeshing: Boolean(chunkProfile.workerMeshing),
            pressure: this.hasWork() || (chunkProfile.pendingMeshJobs ?? 0) > 0
        };
    }
}

export default Mesh;
