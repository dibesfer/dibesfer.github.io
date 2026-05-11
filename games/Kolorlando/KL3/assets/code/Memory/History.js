import { Voxel } from "../Wabavam/Voxel/Voxel.js";

export class History {
    constructor(options = {}) {
        this.woxel = options.woxel ?? null;
        this.mapper = options.mapper ?? null;
        this.raycast = options.raycast ?? null;

        this.limit = options.limit ?? 15;
        this.snapshots = [];
        this.cursor = 0;
        this.busy = false;

        this.onChange = options.onChange ?? null;
        this.onApply = options.onApply ?? null;
    }

    setWoxel(woxel) {
        this.woxel = woxel ?? null;
    }

    setMapper(mapper) {
        this.mapper = mapper ?? null;
    }

    setRaycast(raycast) {
        this.raycast = raycast ?? null;
    }

    pushResults(results = [], options = {}) {
        const snapshot = this.createSnapshotFromResults(results, options);

        return this.push(snapshot);
    }

    createSnapshotFromResults(results = [], options = {}) {
        const changes = [];
        const seen = new Set();

        results.forEach((result) => {
            if (!result?.changed || !result.gridPosition) return;

            const position = this.clonePosition(result.gridPosition);
            const key = this.positionKey(position);
            if (seen.has(key)) return;

            seen.add(key);
            changes.push({
                position,
                before: this.voxelToHistoryData(result.previousVoxel),
                after: this.voxelToHistoryData(result.nextVoxel),
            });
        });

        return this.createSnapshot({
            type: options.type ?? this.inferTypeFromChanges(changes),
            label: options.label ?? "Woxel change",
            changes,
        });
    }

    createSnapshot(options = {}) {
        return {
            kind: "historySnapshot",
            version: 1,
            type: options.type ?? "woxelChange",
            label: options.label ?? "Woxel change",
            createdAt: options.createdAt ?? Date.now(),
            changes: Array.isArray(options.changes) ? options.changes : [],
        };
    }

    push(snapshot) {
        if (this.busy) return false;
        if (!this.isValidSnapshot(snapshot)) return false;

        this.clearFuture();
        this.snapshots.push(this.cloneSnapshot(snapshot));
        this.trimToLimit();
        this.cursor = this.snapshots.length;
        this.emitChange("push");

        return true;
    }

    async undo() {
        if (this.busy) return false;
        if (!this.canUndo()) return false;

        const snapshot = this.snapshots[this.cursor - 1];
        const applied = await this.applySnapshot(snapshot, "before");
        if (!applied) return false;

        this.cursor--;
        this.emitChange("undo");

        return true;
    }

    async redo() {
        if (this.busy) return false;
        if (!this.canRedo()) return false;

        const snapshot = this.snapshots[this.cursor];
        const applied = await this.applySnapshot(snapshot, "after");
        if (!applied) return false;

        this.cursor++;
        this.emitChange("redo");

        return true;
    }

    async applySnapshot(snapshot, side = "before") {
        if (!this.woxel) return false;
        if (!this.isValidSnapshot(snapshot)) return false;
        if (side !== "before" && side !== "after") return false;

        this.busy = true;

        try {
            const dirtyBoxels = [];
            const seenBoxels = new Set();

            snapshot.changes.forEach((change) => {
                const position = change.position;
                const voxel = this.voxelFromHistoryData(change[side]);

                const result = this.woxel.writeVoxelAt(
                    position.x,
                    position.y,
                    position.z,
                    voxel
                );

                this.collectDirtyBoxels(result, dirtyBoxels, seenBoxels);
            });

            if (dirtyBoxels.length > 0) {
                this.mapper?.remeshBoxel15s?.(dirtyBoxels, this.woxel);
                this.raycast?.forceNextCast?.({ preserveTargetOnMiss: true });
            }

            this.onApply?.({
                type: side === "before" ? "undo" : "redo",
                snapshot,
                dirtyBoxels,
                history: this,
            });

            return true;
        } finally {
            this.busy = false;
        }
    }

    collectDirtyBoxels(result, dirtyBoxels, seenBoxels) {
        const resultBoxels = Array.isArray(result?.dirtyBoxels)
            ? result.dirtyBoxels
            : [result?.dirtyBoxel].filter(Boolean);

        resultBoxels.forEach((boxel) => {
            const key = this.boxelKey(boxel);
            if (!key || seenBoxels.has(key)) return;

            seenBoxels.add(key);
            dirtyBoxels.push(boxel);
        });
    }

    clearFuture() {
        if (this.cursor >= this.snapshots.length) return;

        this.snapshots = this.snapshots.slice(0, this.cursor);
    }

    trimToLimit() {
        const overflow = this.snapshots.length - this.limit;
        if (overflow <= 0) return;

        this.snapshots.splice(0, overflow);
        this.cursor = Math.max(0, this.cursor - overflow);
    }

    clear(options = {}) {
        this.snapshots = [];
        this.cursor = 0;
        this.busy = false;

        if (options.silent !== true) {
            this.emitChange("clear");
        }
    }

    canUndo() {
        return !this.busy && this.cursor > 0;
    }

    canRedo() {
        return !this.busy && this.cursor < this.snapshots.length;
    }

    getPastCount() {
        return this.cursor;
    }

    getFutureCount() {
        return this.snapshots.length - this.cursor;
    }

    isBusy() {
        return this.busy;
    }

    toMemoryData() {
        return {
            magic: "KL3H",
            version: 1,
            kind: "history",
            limit: this.limit,
            cursor: this.cursor,
            snapshots: this.snapshots.map((snapshot) => this.cloneSnapshot(snapshot)),
        };
    }

    loadMemoryData(data = null) {
        if (!data || data.kind !== "history") {
            this.clear({ silent: true });
            return false;
        }

        this.limit = Number.isFinite(data.limit) ? data.limit : this.limit;
        this.snapshots = Array.isArray(data.snapshots)
            ? data.snapshots.filter((snapshot) => this.isValidSnapshot(snapshot)).map((snapshot) => this.cloneSnapshot(snapshot))
            : [];
        this.cursor = this.clampCursor(data.cursor ?? this.snapshots.length);
        this.busy = false;

        return true;
    }

    isValidSnapshot(snapshot) {
        return snapshot?.kind === "historySnapshot"
            && Array.isArray(snapshot.changes)
            && snapshot.changes.length > 0;
    }

    inferTypeFromChanges(changes = []) {
        const places = changes.filter((change) => !change.before && change.after).length;
        const quits = changes.filter((change) => change.before && !change.after).length;

        if (changes.length > 1 && places === changes.length) return "bulkPlacement";
        if (changes.length > 1 && quits === changes.length) return "bulkQuit";
        if (places === 1) return "voxelPlacement";
        if (quits === 1) return "voxelQuit";

        return changes.length > 1 ? "bulkChange" : "voxelChange";
    }

    voxelToHistoryData(voxel) {
        if (!voxel) return null;

        return {
            name: voxel.name ?? "Voxel",
            color: voxel.color ?? "#ffffff",
            active: voxel.active ?? true,
            microxels: this.cloneData(voxel.microxels ?? null),
        };
    }

    voxelFromHistoryData(data) {
        if (!data) return null;

        return new Voxel({
            name: data.name ?? "Voxel",
            color: data.color ?? "#ffffff",
            active: data.active ?? true,
            microxels: this.cloneData(data.microxels ?? null),
        });
    }

    cloneSnapshot(snapshot) {
        return this.cloneData(snapshot);
    }

    cloneData(data) {
        if (typeof structuredClone === "function") {
            return structuredClone(data);
        }

        return JSON.parse(JSON.stringify(data));
    }

    clonePosition(position = {}) {
        return {
            x: Math.floor(position.x ?? 0),
            y: Math.floor(position.y ?? 0),
            z: Math.floor(position.z ?? 0),
        };
    }

    positionKey(position = {}) {
        return `${position.x},${position.y},${position.z}`;
    }

    boxelKey(boxel) {
        if (!boxel?.position) return "";

        return this.positionKey(boxel.position);
    }

    clampCursor(cursor) {
        const number = Number.parseInt(cursor, 10);
        if (!Number.isFinite(number)) return this.snapshots.length;

        return Math.min(Math.max(number, 0), this.snapshots.length);
    }

    emitChange(type = "change") {
        this.onChange?.({
            type,
            history: this,
            cursor: this.cursor,
            length: this.snapshots.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
        });
    }
}

export default History;
