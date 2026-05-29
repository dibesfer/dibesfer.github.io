export class Debug {
    constructor({ element, player, mapper = null, getProfile = null }) {
        this.element = element;
        this.player = player;
        this.mapper = mapper;
        this.getProfile = getProfile;
        this.frameCount = 0;
        this.elapsed = 0;
        this.fps = 0;
        this.frameMs = 0;
        this.updateRate = 0.25;
    }

    update(deltaTime, force = false, frameCount = 1) {
        if (!this.element || !this.player) return;

        this.frameCount += frameCount;
        this.elapsed += deltaTime;

        if (!force && this.elapsed < this.updateRate) return;

        const currentFps = this.frameCount / Math.max(this.elapsed, 0.001);

        this.fps = Math.round(this.fps === 0
            ? currentFps
            : this.fps * 0.8 + currentFps * 0.2);
        this.frameMs = Math.round(10000 / Math.max(this.fps, 1)) / 10;
        this.frameCount = 0;
        this.elapsed = 0;
        this.render();
    }

    render() {
        const { x, y, z } = this.mapper
            ? this.mapper.toWorldCoords(this.player.position)
            : this.player.position;

        this.element.textContent = `FPS ${this.fps} | X ${this.format(x)} Y ${this.format(y)} Z ${this.format(z)}`;
    }

    format(value) {
        return Math.floor(value * 100) / 100;
    }

    profileSnapshot() {
        return {
            fps: this.fps,
            frameMs: this.frameMs,
            renderCount: 0,
            visibleChunks: 0,
            loadedChunks: 0,
            chunkLoadQueue: 0,
            meshQueue: 0,
            chunkProfiler: {},
            optimizationWiring: {},
            raycastTargets: 0,
            player: { x: 0, y: 0, z: 0 },
            ...this.getProfile?.({
                fps: this.fps,
                frameMs: this.frameMs
            })
        };
    }

    debugProfile() {
        const profile = this.profileSnapshot();
        const chunks = profile.chunkProfiler || {};
        const states = chunks.chunkStates || {};
        const priority = chunks.priority || {};
        const goldenRule = profile.goldenRule || {};
        const data = goldenRule.data || {};
        const mesh = goldenRule.mesh || {};
        const render = goldenRule.render || {};
        const optimization = profile.optimizationWiring || {};
        const optimizationReady = [
            optimization.renderBudgeter,
            optimization.chunkVisibility,
            optimization.frustumCulling,
            optimization.goldenRuleData,
            optimization.goldenRuleMesh,
            optimization.goldenRuleRender
        ].every(Boolean);
        const lines = [
            `FPS ${profile.fps} | Frame ${profile.frameMs}ms | Renders ${profile.renderCount}`,
            `Golden Rule data ${data.loadQueue ?? 0}/${data.peakLoadQueue ?? 0} | mesh ${mesh.meshQueue ?? 0}/${mesh.peakQueue ?? 0} ${mesh.avgMsPerJob ?? 0}ms/job | render ${render.visibleChunks ?? 0} chunks ${render.calls ?? 0} calls ${render.triangles ?? 0} tris`,
            `Chunks visible ${profile.visibleChunks} | loaded ${profile.loadedChunks}`,
            `Queues load ${profile.chunkLoadQueue} | mesh ${profile.meshQueue}`,
            `States data ${states.queuedData ?? 0}/${states.dataReady ?? 0} | mesh ${states.queuedMesh ?? 0}/${states.meshReady ?? 0} | visible ${states.visible ?? 0} | cached ${states.cached ?? 0}`,
            `Dirty Boxel15 remesh ${chunks.dirtyMeshQueue ?? 0}`,
            `Worker meshing ${chunks.workerMeshing ? "yes" : "no"} | pending ${chunks.pendingMeshJobs ?? 0}/${chunks.maxWorkerJobs ?? 0} | idle ${chunks.workerIdleSlots ?? 0}`,
            `Chunk history ${chunks.chunkHistoryWindowSec ?? 0}s | mesh total ${chunks.meshMsRecentTotal ?? 0}ms | avg/job ${chunks.meshMsRecentAvg ?? 0}ms`,
            `Chunk work built ${chunks.meshesBuiltRecent ?? 0} | jobs ${chunks.meshJobsRecent ?? 0} | skipped ${chunks.skippedChunksRecent ?? 0}`,
            `Chunk peaks load ${chunks.peakLoadQueueRecent ?? 0} | mesh ${chunks.peakMeshQueueRecent ?? 0}/${chunks.meshQueueLimit ?? 0} | oldest mesh ${chunks.oldestMeshQueueAgeMs ?? 0}ms | trimmed ${chunks.trimmedMeshJobs ?? 0}`,
            `Chunk session mesh ${chunks.meshMsSessionTotal ?? 0}ms | built ${chunks.meshesBuiltSession ?? 0} | peak mesh ${chunks.peakMeshQueueSession ?? 0}`,
            `Priority camera ${priority.forward ?? 0} | motion ${priority.motion ?? 0} | vertical trust ${priority.verticalTrustBoost ?? 0} | surface ${priority.surface ?? 0} | age ${priority.age ?? 0}/${priority.maxAgeMs ?? 0}ms`,
            `Motion intent X ${this.format(priority.motionIntent?.x ?? 0)} Y ${this.format(priority.motionIntent?.y ?? 0)} Z ${this.format(priority.motionIntent?.z ?? 0)}`,
            `Optimization wiring ${optimizationReady ? "ok" : "check"} | root ${optimization.root ?? "none"} | worker ${optimization.meshWorkerPath ?? chunks.meshWorkerPath ?? "none"}`,
            `Shared chunk material ${chunks.sharedMaterial ? "yes" : "no"}`,
            `Raycast targets ${profile.raycastTargets} | grace ${chunks.raycastGraceTargets ? "yes" : "no"} ${chunks.raycastGraceMs ?? 0}ms`,
            `Player X ${this.format(profile.player?.x ?? 0)} Y ${this.format(profile.player?.y ?? 0)} Z ${this.format(profile.player?.z ?? 0)}`
        ];

        console.group("%cKL2 Debug Profile", "color:#27B4F5;font-weight:700");
        lines.forEach(line => console.log(line));
        console.log(profile);
        console.groupEnd();

        return profile;
    }
}
