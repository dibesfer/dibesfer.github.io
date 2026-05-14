export class Debug {
    constructor(options = {}) {
        this.consolaElement = options.consolaElement ?? null;

        this.coords = { x: 0, y: 0, z: 0 };

        this.frameCount = 0;
        this.frameCountTotal = 0;
        this.fps = 0;
        this.frameMs = 0;

        this.lastFrameTime = performance.now();
        this.lastFpsTime = performance.now();
        this.lastDrawTime = performance.now();

        this.drawThrottleMs = options.drawThrottleMs ?? 250;
    }

    setCoords(x = 0, y = 0, z = 0) {
        this.coords.x = x;
        this.coords.y = y;
        this.coords.z = z;
    }

    update(now = performance.now(), coords = null) {
        this.frameCount++;
        this.frameCountTotal++;

        // Ultra-cheap live debug path.
        // No profiler calls. No mesh reads. No Woxel reads. No DOM writes per frame.
        if (coords) {
            this.coords.x = coords.x ?? this.coords.x;
            this.coords.y = coords.y ?? this.coords.y;
            this.coords.z = coords.z ?? this.coords.z;
        }

        const fpsDelta = now - this.lastFpsTime;
        if (fpsDelta < 1000) {
            this.lastFrameTime = now;
            return;
        }

        const currentFps = (this.frameCount * 1000) / Math.max(fpsDelta, 1);
        this.fps = Math.round(currentFps);
        this.frameMs = Math.round((1000 / Math.max(currentFps, 1)) * 10) / 10;
        this.frameCount = 0;
        this.lastFpsTime = now;
        this.lastFrameTime = now;

        this.draw();
        this.lastDrawTime = now;
    }

    reset() {
        const now = performance.now();

        this.frameCount = 0;
        this.frameCountTotal = 0;
        this.fps = 0;
        this.frameMs = 0;

        this.lastFrameTime = now;
        this.lastFpsTime = now;
        this.lastDrawTime = now;

        this.draw();
    }

    draw() {
        if (!this.consolaElement) return;

        const x = this.formatCoord(this.coords.x);
        const y = this.formatCoord(this.coords.y);
        const z = this.formatCoord(this.coords.z);

        this.consolaElement.textContent = `FPS: ${this.formatFps(this.fps)} XYZ: ${x}, ${y}, ${z}`;
    }

    // Golden Rule debug must be pull-only and cheap.
    // Never scan Woxel voxels here. Never traverse deep scene trees by default.
    profileSnapshot(app = null) {
        const player = app?.player?.getFeetPosition?.() ?? this.coords;
        const render = this.createRenderProfile(app);
        const mesh = this.createMeshProfile(app);
        const data = this.createDataProfile(app);
        const duoPainters = this.createDuoPaintersProfile(app);
        const streamResult = app?.mapper?.boxel15MeshStreamer?.getLastStreamResult?.() ?? {};
        const deferredResult = app?.mapper?.deferredRemeshing?.getLastFlushResult?.() ?? {};

        return {
            fps: this.fps,
            frameMs: this.frameMs,
            renderCount: this.frameCountTotal,
            player: {
                x: player?.x ?? 0,
                y: player?.y ?? 0,
                z: player?.z ?? 0,
            },
            goldenRule: { data, mesh, render },
            duoPainters,
            meshStreamer: {
                loaded: streamResult.loaded?.length ?? 0,
                unloaded: streamResult.unloaded?.length ?? 0,
                wantedCount: streamResult.wantedCount ?? 0,
                loadedCount: streamResult.loadedCount ?? app?.mapper?.meshesByBoxel?.size ?? 0,
            },
            deferredRemeshing: {
                dirtyCount: app?.mapper?.deferredRemeshing?.getDirtyCount?.() ?? 0,
                remeshed: deferredResult.remeshed?.length ?? 0,
                deferred: deferredResult.deferred?.length ?? 0,
            },
            raycastTargets: this.safeRaycastTargetsCount(app),
            boxelEditor: this.createBoxelEditorProfile(app),
            memory: {
                status: app?.woxelMemoryStatusText ?? "unknown",
                autosavePending: app?.isAutosavePending?.() === true,
                historySavePending: app?.historySaveTimer !== null || app?.historySaveInFlight === true,
                clipboardSavePending: app?.blueBoxelClipboardSaveTimer !== null || app?.blueBoxelClipboardSaveInFlight === true,
                savedBoxels: app?.savedBoxels?.length ?? 0,
            },
            settings: {
                boxel15RenderDistance: app?.mapper?.getBoxel15RenderDistance?.() ?? app?.boxel15RenderDistance ?? 0,
                boxel15RenderBudget: app?.mapper?.getBoxel15RenderBudget?.() ?? app?.boxel15RenderBudget ?? 0,
                screenMode: app?.screen?.mode ?? null,
            },
        };
    }

    debugProfile(app = null) {
        const profile = this.profileSnapshot(app);
        const data = profile.goldenRule?.data ?? {};
        const mesh = profile.goldenRule?.mesh ?? {};
        const render = profile.goldenRule?.render ?? {};
        const duo = profile.duoPainters ?? {};
        const streamer = profile.meshStreamer ?? {};
        const deferred = profile.deferredRemeshing ?? {};
        const boxelEditor = profile.boxelEditor ?? {};
        const memory = profile.memory ?? {};

        const lines = [
            `FPS ${profile.fps} | Frame ${profile.frameMs}ms | Frames ${profile.renderCount}`,
            `Golden Rule data boxel15 ${data.boxel15Count ?? 0} | world voxels ${data.worldVoxels ?? 0} | memory ${memory.status ?? "unknown"}`,
            `Golden Rule mesh loaded ${mesh.loadedMeshes ?? 0} | visible ${mesh.visibleMeshes ?? 0} | dirty ${deferred.dirtyCount ?? 0} | streamed +${streamer.loaded ?? 0}/-${streamer.unloaded ?? 0}`,
            `Golden Rule render calls ${render.calls ?? 0} | tris ${render.triangles ?? 0} | points ${render.points ?? 0} | lines ${render.lines ?? 0}`,
            `Duo Painters faces ${duo.currentFaces ?? 0}/${duo.originalFaces ?? 0} | saved ${duo.savedFaces ?? 0} (${duo.reductionPercent ?? 0}%)`,
            `Duo Painters tris approx ${duo.currentTrianglesApprox ?? 0}/${duo.originalTrianglesApprox ?? 0} | saved ${duo.savedTrianglesApprox ?? 0}`,
            `FaceBaking roots ${duo.faceBakedRoots ?? 0}/${duo.visibleRoots ?? 0} | microxel baked ${duo.microxelFaceBakedRoots ?? 0} | atlas ${duo.textureAtlasRoots ?? 0}`,
            `Raycast targets ${profile.raycastTargets ?? 0}`,
            `BoxelEditor active ${boxelEditor.active ? "yes" : "no"} | mode ${boxelEditor.mode ?? "none"} | blue ${boxelEditor.blueBoxelState ?? "none"}`,
            `Player X ${this.formatCoord(profile.player?.x ?? 0)} Y ${this.formatCoord(profile.player?.y ?? 0)} Z ${this.formatCoord(profile.player?.z ?? 0)}`,
        ];

        console.group("%cKL3 Debug Profile", "color:#27B4F5;font-weight:700");
        lines.forEach((line) => console.log(line));
        console.groupEnd();

        window.KL3_LAST_DEBUG_PROFILE = profile;
        return profile;
    }

    debugBenchmark(app = null, durationSec = 15, intervalMs = 1000) {
        const durationMs = Math.max(1000, Number(durationSec) * 1000 || 15000);
        const sampleMs = Math.max(250, Number(intervalMs) || 1000);
        const startedAt = performance.now();
        const samples = [];

        console.log(`KL3 benchmark started: ${Math.round(durationMs / 1000)}s`);

        return new Promise((resolve) => {
            const sample = () => {
                samples.push(this.profileSnapshot(app));

                if (performance.now() - startedAt < durationMs) {
                    window.setTimeout(sample, sampleMs);
                    return;
                }

                const summary = this.summarizeBenchmark(samples);
                console.table(summary);
                console.log("KL3 benchmark done", summary);
                window.KL3_LAST_DEBUG_BENCHMARK = { summary, samples };
                resolve({ summary, samples });
            };

            window.setTimeout(sample, sampleMs);
        });
    }

    summarizeBenchmark(samples = []) {
        const values = (readValue) => samples.map(readValue).filter(Number.isFinite);
        const avg = (list) => list.length
            ? Math.round((list.reduce((sum, value) => sum + value, 0) / list.length) * 10) / 10
            : 0;
        const max = (list) => list.length ? Math.max(...list) : 0;
        const last = (list) => list.length ? list[list.length - 1] : 0;

        return {
            samples: samples.length,
            avgFps: avg(values((sample) => sample.fps)),
            avgFrameMs: avg(values((sample) => sample.frameMs)),
            avgRenderCalls: avg(values((sample) => sample.goldenRule?.render?.calls ?? 0)),
            maxRenderTriangles: max(values((sample) => sample.goldenRule?.render?.triangles ?? 0)),
            avgRenderTriangles: avg(values((sample) => sample.goldenRule?.render?.triangles ?? 0)),
            avgVisibleMeshes: avg(values((sample) => sample.goldenRule?.mesh?.visibleMeshes ?? 0)),
            maxVisibleMeshes: max(values((sample) => sample.goldenRule?.mesh?.visibleMeshes ?? 0)),
            avgRaycastTargets: avg(values((sample) => sample.raycastTargets ?? 0)),
            maxRaycastTargets: max(values((sample) => sample.raycastTargets ?? 0)),
            avgDuoFaces: avg(values((sample) => sample.duoPainters?.currentFaces ?? 0)),
            avgDuoOriginalFaces: avg(values((sample) => sample.duoPainters?.originalFaces ?? 0)),
            avgDuoSavedFaces: avg(values((sample) => sample.duoPainters?.savedFaces ?? 0)),
            maxDuoSavedFaces: max(values((sample) => sample.duoPainters?.savedFaces ?? 0)),
            avgDuoReductionPercent: avg(values((sample) => sample.duoPainters?.reductionPercent ?? 0)),
            avgDuoCurrentTrianglesApprox: avg(values((sample) => sample.duoPainters?.currentTrianglesApprox ?? 0)),
            avgDuoOriginalTrianglesApprox: avg(values((sample) => sample.duoPainters?.originalTrianglesApprox ?? 0)),
            avgDuoSavedTrianglesApprox: avg(values((sample) => sample.duoPainters?.savedTrianglesApprox ?? 0)),
            faceBakedRoots: last(values((sample) => sample.duoPainters?.faceBakedRoots ?? 0)),
            microxelFaceBakedRoots: last(values((sample) => sample.duoPainters?.microxelFaceBakedRoots ?? 0)),
            textureAtlasRoots: last(values((sample) => sample.duoPainters?.textureAtlasRoots ?? 0)),
            maxDirtyBoxel15: max(values((sample) => sample.deferredRemeshing?.dirtyCount ?? 0)),
            maxMeshLoadedThisFrame: max(values((sample) => sample.meshStreamer?.loaded ?? 0)),
            maxMeshUnloadedThisFrame: max(values((sample) => sample.meshStreamer?.unloaded ?? 0)),
        };
    }

    createRenderProfile(app = null) {
        const renderInfo = app?.threeD?.getRenderer?.()?.info?.render ?? {};

        return {
            calls: renderInfo.calls ?? 0,
            triangles: renderInfo.triangles ?? 0,
            points: renderInfo.points ?? 0,
            lines: renderInfo.lines ?? 0,
        };
    }

    createMeshProfile(app = null) {
        const meshes = app?.mapper?.meshes ?? [];
        let visibleMeshes = 0;

        for (let index = 0; index < meshes.length; index++) {
            if (meshes[index]?.visible !== false) visibleMeshes++;
        }

        return {
            loadedMeshes: meshes.length,
            visibleMeshes,
            hiddenMeshes: Math.max(0, meshes.length - visibleMeshes),
            raycastableMeshes: this.safeRaycastTargetsCount(app),
            loadedBoxel15Meshes: app?.mapper?.meshesByBoxel?.size ?? 0,
            debugBounds: app?.mapper?.boxel15Bounds?.length ?? 0,
            wireframe: app?.mapper?.wireframeMode === true,
        };
    }

    createDataProfile(app = null) {
        const woxel = app?.woxel ?? null;
        const size = woxel?.size ?? { x: 0, y: 0, z: 0 };
        const boxels = woxel?.boxels ?? woxel?.getBoxels?.() ?? [];
        const counts = woxel?.getBoxel15Counts?.() ?? null;

        return {
            boxel15Count: Array.isArray(boxels) ? boxels.length : 0,
            boxel15Grid: counts ? `${counts.x}x${counts.y}x${counts.z}` : null,
            worldVoxels: Math.max(0, (size.x ?? 0) * (size.y ?? 0) * (size.z ?? 0)),
            activeVoxels: "not scanned",
            totalVoxels: "not scanned",
            microxeledVoxels: "not scanned",
            paletteSize: this.safePaletteSize(woxel?.palette),
        };
    }

    createDuoPaintersProfile(app = null) {
        const meshes = app?.mapper?.meshes ?? [];
        const totals = {
            visibleRoots: 0,
            faceBakedRoots: 0,
            microxelFaceBakedRoots: 0,
            textureAtlasRoots: 0,
            currentFaces: 0,
            originalFaces: 0,
            savedFaces: 0,
            currentTrianglesApprox: 0,
            originalTrianglesApprox: 0,
            savedTrianglesApprox: 0,
            reductionPercent: 0,
        };

        for (let index = 0; index < meshes.length; index++) {
            const root = meshes[index];
            if (root?.visible === false) continue;

            totals.visibleRoots++;

            const currentFaces = Number(root?.userData?.faceCount);
            const originalFaces = Number(root?.userData?.originalVisibleFaceCount);
            const fallbackFaces = Number.isFinite(currentFaces) ? currentFaces : 0;

            totals.currentFaces += fallbackFaces;
            totals.originalFaces += Number.isFinite(originalFaces) ? originalFaces : fallbackFaces;
            totals.faceBakedRoots += root?.userData?.faceBaked === true ? 1 : 0;
            totals.microxelFaceBakedRoots += root?.userData?.microxelFaceBaked === true ? 1 : 0;
            totals.textureAtlasRoots += root?.userData?.textureAtlas === true ? 1 : 0;
        }

        totals.savedFaces = Math.max(0, totals.originalFaces - totals.currentFaces);
        totals.currentTrianglesApprox = totals.currentFaces * 2;
        totals.originalTrianglesApprox = totals.originalFaces * 2;
        totals.savedTrianglesApprox = Math.max(0, totals.originalTrianglesApprox - totals.currentTrianglesApprox);
        totals.reductionPercent = totals.originalFaces > 0
            ? Math.round((totals.savedFaces / totals.originalFaces) * 1000) / 10
            : 0;

        return totals;
    }

    createBoxelEditorProfile(app = null) {
        const editor = app?.boxelEditor ?? null;
        const blue = editor?.blueBoxel ?? editor?.blue ?? null;

        return {
            active: editor?.isActive?.() === true,
            mode: editor?.mode ?? editor?.activeMode ?? null,
            blueBoxelState: blue?.state ?? blue?.blueBoxelState ?? null,
            clipboard: Boolean(blue?.clipboard ?? editor?.blueBoxelClipboard),
            savedBoxels: app?.savedBoxels?.length ?? 0,
        };
    }

    safeRaycastTargetsCount(app = null) {
        const mapper = app?.mapper;
        if (!mapper) return 0;
        if (Array.isArray(mapper.raycastableMeshes)) return mapper.raycastableMeshes.length;
        if (Array.isArray(mapper.meshes)) return mapper.meshes.length;
        return 0;
    }

    safePaletteSize(palette = null) {
        const size = palette?.size;
        if (typeof size === "function") return size.call(palette);
        if (Number.isFinite(size)) return size;
        if (Array.isArray(palette?.voxels)) return palette.voxels.length;
        if (Array.isArray(palette?.items)) return palette.items.length;
        return 0;
    }

    formatFps(value) {
        return String(value).padStart(2, "0");
    }

    formatCoord(value) {
        if (Number.isInteger(value)) return String(value);
        return Number(value).toFixed(2);
    }
}

export default Debug;
