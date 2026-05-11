export class Data {
    constructor({
        mapper = null,
        setChunkState = null,
        clearChunkState = null,
        onSkip = null,
        onLoaded = null,
        maxLoadsPerFrame = 2,
        frameBudgetMs = 5
    } = {}) {
        this.mapper = mapper;
        this.setChunkState = setChunkState;
        this.clearChunkState = clearChunkState;
        this.onSkip = onSkip;
        this.onLoaded = onLoaded;
        this.maxLoadsPerFrame = maxLoadsPerFrame;
        this.frameBudgetMs = frameBudgetMs;
        this.queue = [];
        this.keys = new Set();
        this.times = new Map();
    }

    add(position) {
        const key = this.mapper.voxelKey(position);

        if (this.keys.has(key)) return false;

        this.queue.push(position);
        this.keys.add(key);
        this.times.set(key, performance.now());
        this.setChunkState?.(key, "queuedData");
        return true;
    }

    process(keepKeys = new Set()) {
        let processed = 0;
        const startedAt = performance.now();

        for (let count = 0; count < this.maxLoadsPerFrame && this.queue.length > 0; count += 1) {
            const position = this.queue.shift();
            const key = this.mapper.voxelKey(position);

            this.keys.delete(key);
            this.times.delete(key);
            if (keepKeys.size > 0 && !keepKeys.has(key)) {
                this.clearChunkState?.(key, "queuedData");
                this.onSkip?.(1);
                continue;
            }

            const boxel = this.mapper.createLandBoxel(position);

            if (!boxel) continue;

            this.setChunkState?.(key, "dataReady");
            this.onLoaded?.(boxel);
            processed += 1;
            if (performance.now() - startedAt >= this.frameBudgetMs) break;
        }

        return processed;
    }

    prune(keepKeys = new Set()) {
        const before = this.queue.length;

        this.queue = this.queue.filter(position => keepKeys.has(this.mapper.voxelKey(position)));
        this.keys = new Set(this.queue.map(position => this.mapper.voxelKey(position)));
        this.times.forEach((_, key) => {
            if (!this.keys.has(key)) {
                this.times.delete(key);
                this.clearChunkState?.(key, "queuedData");
            }
        });
        this.onSkip?.(before - this.queue.length);
    }

    sort(compare) {
        this.queue.sort(compare);
    }

    hasWork() {
        return this.queue.length > 0;
    }

    profile(chunkProfile = {}) {
        const states = chunkProfile.chunkStates || {};

        return {
            loadQueue: this.queue.length,
            queuedData: states.queuedData ?? 0,
            dataReady: states.dataReady ?? 0,
            peakLoadQueue: chunkProfile.peakLoadQueueRecent ?? this.queue.length,
            oldestLoadMs: chunkProfile.oldestLoadQueueAgeMs ?? 0,
            pressure: this.hasWork() || (states.queuedData ?? 0) > 0
        };
    }
}

export default Data;
