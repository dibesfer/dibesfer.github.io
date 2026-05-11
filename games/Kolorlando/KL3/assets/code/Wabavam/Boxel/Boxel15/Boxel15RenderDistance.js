import {
    getBoxel15Key,
    normalizeBoxel15Budget,
    normalizeBoxel15Distance,
    normalizeBoxel15Dot,
} from "./Boxel15Utils.js";

export class Boxel15RenderDistance {
    constructor(options = {}) {
        this.woxel = options.woxel ?? null;

        this.renderDistance = normalizeBoxel15Distance(options.renderDistance ?? options.distance ?? 60);
        this.raycastDistance = normalizeBoxel15Distance(options.raycastDistance ?? this.renderDistance);
        this.syncRaycastWithRender = options.syncRaycastWithRender ?? true;

        this.renderBudget = normalizeBoxel15Budget(options.renderBudget ?? options.budget ?? 48);
        this.nearBuffer = normalizeBoxel15Distance(options.nearBuffer ?? 15);
        this.alwaysVisibleDistance = normalizeBoxel15Distance(options.alwaysVisibleDistance ?? 30);
        this.localPriorityDistance = normalizeBoxel15Distance(options.localPriorityDistance ?? 24);
        this.softFrustumDot = normalizeBoxel15Dot(options.softFrustumDot ?? -0.65);
        this.frontPriorityBoost = normalizeBoxel15Distance(options.frontPriorityBoost ?? 8);
        this.preloadBudget = normalizeBoxel15Budget(options.preloadBudget ?? this.renderBudget);

        this.useY = options.useY ?? false;
        this.useSoftFrustum = options.useSoftFrustum ?? true;
        this.prioritizeFront = options.prioritizeFront ?? true;

        this.origin = null;
        this.direction = null;

        this.distanceBoxels = [];
        this.nearBoxels = [];
        this.visibleBoxels = [];
        this.raycastableBoxels = [];
        this.frustumCulledBoxels = [];
        this.budgetedOutBoxels = [];
        this.loadBoxels = [];
        this.entryStatesByBoxel = new Map();
    }

    setWoxel(woxel = null) {
        this.woxel = woxel;
        this.origin = null;
        this.direction = null;
        this.clearLists();

        return this;
    }

    setRenderDistance(distance = 60) {
        this.renderDistance = normalizeBoxel15Distance(distance);

        if (this.syncRaycastWithRender) {
            this.raycastDistance = this.renderDistance;
        } else {
            this.raycastDistance = Math.min(this.raycastDistance, this.renderDistance);
        }

        return this;
    }

    setDistance(distance = 60) {
        return this.setRenderDistance(distance);
    }

    getDistance() {
        return this.renderDistance;
    }

    setRaycastDistance(distance = this.renderDistance) {
        this.raycastDistance = Math.min(normalizeBoxel15Distance(distance), this.renderDistance);
        this.syncRaycastWithRender = false;

        return this;
    }

    syncRaycastDistance() {
        this.raycastDistance = this.renderDistance;
        this.syncRaycastWithRender = true;

        return this;
    }

    setRenderBudget(budget = 48) {
        this.renderBudget = normalizeBoxel15Budget(budget);

        return this;
    }

    getRenderBudget() {
        return this.renderBudget;
    }

    setSoftFrustum(enabled = true) {
        this.useSoftFrustum = Boolean(enabled);

        return this;
    }

    update(origin = null, entries = [], context = {}) {
        this.origin = this.toGridOrigin(origin ?? this.origin);
        this.direction = this.toDirection(context.direction ?? context.cameraDirection ?? this.direction);
        this.clearLists();

        const analyzedEntries = this.analyzeEntries(this.normalizeEntries(entries));
        const visibleEntries = this.selectVisibleEntries(analyzedEntries);
        const visibleSet = new Set(visibleEntries);
        const loadEntries = this.selectLoadEntries(analyzedEntries, visibleEntries);
        const loadSet = new Set(loadEntries);

        analyzedEntries.forEach((entry) => {
            const visible = visibleSet.has(entry);
            const raycastable = visible && this.isEntryRaycastable(entry);

            this.rememberEntryState(entry, visible, raycastable, loadSet.has(entry));
            this.applyEntryVisibility(entry, visible, raycastable);

            if (entry.inDistance) this.distanceBoxels.push(entry.boxel15);
            if (entry.near) this.nearBoxels.push(entry.boxel15);
            if (entry.frustumCulled) this.frustumCulledBoxels.push(entry.boxel15);
            if (entry.budgetedOut) this.budgetedOutBoxels.push(entry.boxel15);
            if (visible) this.visibleBoxels.push(entry.boxel15);
            if (loadSet.has(entry)) this.loadBoxels.push(entry.boxel15);
            if (raycastable) this.raycastableBoxels.push(entry.boxel15);
        });

        return this.createResult();
    }

    clearLists() {
        this.distanceBoxels = [];
        this.nearBoxels = [];
        this.visibleBoxels = [];
        this.raycastableBoxels = [];
        this.frustumCulledBoxels = [];
        this.budgetedOutBoxels = [];
        this.loadBoxels = [];
        this.entryStatesByBoxel.clear();
    }

    normalizeEntries(entries = []) {
        if (!Array.isArray(entries)) return [];

        return entries
            .map((entry) => {
                if (!entry) return null;

                if (entry.boxel15) {
                    return {
                        boxel15: entry.boxel15,
                        mesh: entry.mesh ?? null,
                        bounds: entry.bounds ?? null,
                    };
                }

                return {
                    boxel15: entry,
                    mesh: null,
                    bounds: null,
                };
            })
            .filter((entry) => entry?.boxel15);
    }

    analyzeEntries(entries = []) {
        return entries.map((entry) => {
            const distance = this.getDistanceToBoxel15(entry.boxel15);
            const frontScore = this.getFrontScore(entry.boxel15);
            const inDistance = !this.origin || distance <= this.renderDistance;
            const localPriority = !this.origin || distance <= this.localPriorityDistance;
            const near = !this.origin || distance <= this.getNearDistance();
            const alwaysVisible = !this.origin || distance <= this.alwaysVisibleDistance;
            const inSoftFrustum = this.isEntryInsideSoftFrustum(frontScore, alwaysVisible || localPriority);
            const frustumCulled = inDistance && !inSoftFrustum;

            return {
                ...entry,
                distance,
                frontScore,
                inDistance,
                localPriority,
                near,
                alwaysVisible,
                inSoftFrustum,
                frustumCulled,
                budgetedOut: false,
            };
        });
    }

    selectVisibleEntries(entries = []) {
        const candidates = entries.filter((entry) => entry.inDistance && !entry.frustumCulled);
        const ordered = [...candidates].sort((a, b) => this.compareEntries(a, b));
        const budget = this.getEffectiveRenderBudget();
        const visibleEntries = Number.isFinite(budget)
            ? ordered.slice(0, budget)
            : ordered;
        const visibleSet = new Set(visibleEntries);

        candidates.forEach((entry) => {
            entry.budgetedOut = !visibleSet.has(entry);
        });

        return visibleEntries;
    }

    selectLoadEntries(entries = [], visibleEntries = []) {
        const loadLimit = this.getEffectiveLoadBudget();
        const loadEntries = [];
        const seen = new Set();

        visibleEntries.forEach((entry) => {
            const key = getBoxel15Key(entry.boxel15);
            if (seen.has(key)) return;

            seen.add(key);
            loadEntries.push(entry);
        });

        const nearEntries = entries
            .filter((entry) => entry.near && !seen.has(getBoxel15Key(entry.boxel15)))
            .sort((a, b) => this.compareEntries(a, b));

        for (const entry of nearEntries) {
            if (Number.isFinite(loadLimit) && loadEntries.length >= loadLimit) break;

            seen.add(getBoxel15Key(entry.boxel15));
            loadEntries.push(entry);
        }

        return loadEntries;
    }

    compareEntries(a, b) {
        if (a.localPriority !== b.localPriority) return a.localPriority ? -1 : 1;

        if (a.localPriority && b.localPriority) {
            return this.compareByDistanceThenFront(a, b);
        }

        if (a.alwaysVisible !== b.alwaysVisible) return a.alwaysVisible ? -1 : 1;

        if (a.alwaysVisible && b.alwaysVisible) {
            return this.compareByDistanceThenFront(a, b);
        }

        if (a.near !== b.near) return a.near ? -1 : 1;

        if (a.near && b.near) {
            return this.compareByDistanceThenFront(a, b);
        }

        if (this.prioritizeFront) {
            const aScore = this.createPriorityScore(a);
            const bScore = this.createPriorityScore(b);
            const scoreDelta = aScore - bScore;

            if (Math.abs(scoreDelta) > 0.0001) return scoreDelta;
        }

        return a.distance - b.distance;
    }

    compareByDistanceThenFront(a, b) {
        const distanceDelta = a.distance - b.distance;
        if (Math.abs(distanceDelta) > 0.0001) return distanceDelta;

        if (this.prioritizeFront) {
            return b.frontScore - a.frontScore;
        }

        return 0;
    }

    createPriorityScore(entry) {
        return entry.distance - (entry.frontScore * this.frontPriorityBoost);
    }

    isEntryInsideSoftFrustum(frontScore = 1, alwaysVisible = false) {
        if (!this.useSoftFrustum) return true;
        if (!this.direction) return true;
        if (alwaysVisible) return true;

        return frontScore >= this.softFrustumDot;
    }

    isEntryRaycastable(entry) {
        if (!this.origin) return true;

        return entry.distance <= this.raycastDistance;
    }

    rememberEntryState(entry, visible, raycastable, loadable = false) {
        this.entryStatesByBoxel.set(getBoxel15Key(entry.boxel15), {
            ...entry,
            visible,
            raycastable,
            loadable,
        });
    }

    applyStoredVisibility(boxel15, mesh = null, bounds = null) {
        const state = this.getEntryState(boxel15);

        if (!state) {
            this.applyEntryVisibility({ boxel15, mesh, bounds }, false, false);
            return false;
        }

        this.applyEntryVisibility({ ...state, mesh, bounds }, state.visible, state.raycastable);
        return state.visible === true;
    }

    getEntryState(boxel15) {
        if (!boxel15) return null;

        return this.entryStatesByBoxel.get(getBoxel15Key(boxel15)) ?? null;
    }

    applyEntryVisibility(entry, visible, raycastable) {
        const mesh = entry.mesh ?? null;
        const bounds = entry.bounds ?? null;

        if (mesh) {
            mesh.visible = visible;
            mesh.userData.boxel15Visible = visible;
            mesh.userData.boxel15Raycastable = raycastable;
            mesh.userData.boxel15Distance = entry.distance;
            mesh.userData.boxel15FrontScore = entry.frontScore;
            mesh.userData.boxel15LocalPriority = entry.localPriority;
            mesh.userData.boxel15Near = entry.near;
            mesh.userData.boxel15FrustumCulled = entry.frustumCulled;
            mesh.userData.boxel15BudgetedOut = entry.budgetedOut;
        }

        if (bounds) {
            bounds.userData.boxel15Visible = visible;
            bounds.userData.boxel15Raycastable = false;
            bounds.userData.boxel15Distance = entry.distance;
            bounds.userData.boxel15LocalPriority = entry.localPriority;
            bounds.userData.boxel15Near = entry.near;
            bounds.userData.boxel15FrustumCulled = entry.frustumCulled;
            bounds.userData.boxel15BudgetedOut = entry.budgetedOut;
        }
    }

    createResult() {
        return {
            origin: this.origin,
            direction: this.direction,
            renderDistance: this.renderDistance,
            raycastDistance: this.raycastDistance,
            renderBudget: this.renderBudget,
            localPriorityDistance: this.localPriorityDistance,
            nearDistance: this.getNearDistance(),
            distanceBoxels: this.distanceBoxels,
            nearBoxels: this.nearBoxels,
            visibleBoxels: this.visibleBoxels,
            loadBoxels: this.loadBoxels,
            raycastableBoxels: this.raycastableBoxels,
            frustumCulledBoxels: this.frustumCulledBoxels,
            budgetedOutBoxels: this.budgetedOutBoxels,
        };
    }

    toGridOrigin(origin = null) {
        if (!origin) return null;

        if (this.woxel?.gameToGrid) {
            return this.woxel.gameToGrid(origin);
        }

        return {
            x: origin.x ?? 0,
            y: origin.y ?? 0,
            z: origin.z ?? 0,
        };
    }

    toDirection(direction = null) {
        if (!direction) return null;

        const x = direction.x ?? 0;
        const y = this.useY ? direction.y ?? 0 : 0;
        const z = direction.z ?? 0;
        const length = Math.hypot(x, y, z);

        if (length === 0) return null;

        return {
            x: x / length,
            y: y / length,
            z: z / length,
        };
    }

    isBoxel15Visible(boxel15) {
        return this.getDistanceToBoxel15(boxel15) <= this.renderDistance;
    }

    isBoxel15Raycastable(boxel15) {
        return this.getDistanceToBoxel15(boxel15) <= this.raycastDistance;
    }

    getDistanceToBoxel15(boxel15) {
        if (!this.origin || !boxel15?.position || !boxel15?.size) return Infinity;

        const center = this.getBoxel15Center(boxel15);
        const dx = center.x - this.origin.x;
        const dy = this.useY ? center.y - this.origin.y : 0;
        const dz = center.z - this.origin.z;

        return Math.hypot(dx, dy, dz);
    }

    getFrontScore(boxel15) {
        if (!this.origin || !this.direction || !boxel15?.position || !boxel15?.size) return 1;

        const center = this.getBoxel15Center(boxel15);
        const dx = center.x - this.origin.x;
        const dy = this.useY ? center.y - this.origin.y : 0;
        const dz = center.z - this.origin.z;
        const length = Math.hypot(dx, dy, dz);

        if (length === 0) return 1;

        return ((dx / length) * this.direction.x)
            + ((dy / length) * this.direction.y)
            + ((dz / length) * this.direction.z);
    }

    getBoxel15Center(boxel15) {
        return {
            x: boxel15.position.x + boxel15.size.x / 2,
            y: boxel15.position.y + boxel15.size.y / 2,
            z: boxel15.position.z + boxel15.size.z / 2,
        };
    }

    getNearDistance() {
        return this.renderDistance + this.nearBuffer;
    }

    getEffectiveRenderBudget() {
        if (this.renderBudget <= 0) return Infinity;

        return this.renderBudget;
    }

    getEffectiveLoadBudget() {
        const renderBudget = this.getEffectiveRenderBudget();
        const preloadBudget = this.preloadBudget <= 0 ? Infinity : this.preloadBudget;

        if (!Number.isFinite(renderBudget) || !Number.isFinite(preloadBudget)) return Infinity;

        return renderBudget + preloadBudget;
    }

}

export default Boxel15RenderDistance;
