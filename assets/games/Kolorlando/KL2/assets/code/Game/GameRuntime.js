import * as THREE from "three";
import { Camera } from "./Camera.js";
import { Collisions } from "./Collisions.js";
import { Debug } from "./Debug.js";
import World from "./World.js";
import { Player } from "../Player/Player.js";
import { Raycast } from "../Raycast/Raycast.js";
import RenderBudgeter from "./Optimization/RenderBudgeter.js";
import BoxelEditor from "../Wabavam/Boxel/BoxelEditor.js";
import ChunkVisibility from "./Optimization/Visibility/ChunkVisibility.js";
import FrustumCulling from "./Optimization/Visibility/FrustumCulling.js";
import RenderInvalidation from "./Optimization/RenderInvalidation.js";

export class GameRuntime {
    constructor({ threeD, input = null } = {}) {
        this.threeD = threeD;
        this.input = input;
        this.world = new World();
        this.timer = new THREE.Timer();
        this.player = null;
        this.cameraController = null;
        this.collisions = null;
        this.debug = null;
        this.raycast = null;
        this.boxelEditor = null;
        this.renderBudgeter = new RenderBudgeter("MEDIUM");
        this.frustumCulling = null;
        this.chunkVisibility = null;
        this.goldenRule = null;
        this.invalidation = new RenderInvalidation();

        this.spawnPosition = new THREE.Vector3();
        this.spawnRotation = new THREE.Euler(0, 0, 0);
        this.raycastTargets = [];
        this.renderDistance = 60;
        this.lodSettings = {
            enabled: false,
            fullDistance: 30,
            mediumDistance: 90
        };
        this.currentSettings = {};
        this.fogSize = 45;
        this.editDistance = 20;
        this.lastInputVersion = -1;
        this.animationFrame = null;
        this.saveTimer = null;
        this.editSaveTimer = null;
        this.saveIntervalMs = 3000;
        this.editSaveDelayMs = 750;
        this.worldDirty = false;
        this.editActiveFrames = 0;

        this.warmupFrames = 45;

        this.debugElapsed = 0;
        this.debugFrames = 0;
        this.debugInterval = 0.25;
        this.lastFrustumPosition = null;
        this.lastFrustumQuaternion = null;
        this.lastChunkRefreshKey = null;
        this.lastChunkRefreshYaw = null;
        this.lastChunkRefreshPitch = null;
        this.frustumMoveThreshold = 2;
        this.frustumRotationThreshold = THREE.MathUtils.degToRad(8);
        this.chunkCameraThreshold = THREE.MathUtils.degToRad(8);
        this.isReloadingWorld = false;
        this.skipNextMouseTap = false;
        this.skipEasyEditHold = false;

        this.update = this.update.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseTap = this.onMouseTap.bind(this);
        this.onMouseHoldStart = this.onMouseHoldStart.bind(this);
        this.onMouseHoldMove = this.onMouseHoldMove.bind(this);
        this.onMouseHoldEnd = this.onMouseHoldEnd.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onCommand = this.onCommand.bind(this);
        this.onWorldReset = this.onWorldReset.bind(this);
        this.onWorldExport = this.onWorldExport.bind(this);
        this.onWorldLoad = this.onWorldLoad.bind(this);
        this.onSelectedItemChange = this.onSelectedItemChange.bind(this);
        this.onInventoryAddItem = this.onInventoryAddItem.bind(this);
        this.onSettingsUpdated = this.onSettingsUpdated.bind(this);
        this.onBeforeUnload = this.onBeforeUnload.bind(this);
        this.debugProfile = this.debugProfile.bind(this);
        this.debugBenchmark = this.debugBenchmark.bind(this);

        this.input?.on("settings.updated", this.onSettingsUpdated);
    }

    async start() {
        await this.world.ready();
        this.threeD.configureFog(this.renderDistance, this.fogSize);

        const map = this.world.build();
        const mapper = this.world.mapper;

        const savedPlayer = await this.world.loadPlayer();
        const startPosition = new THREE.Vector3();
        const startRotation = this.spawnRotation.clone();

        this.spawnPosition.set(
            map.spawnPosition.x,
            map.spawnPosition.y,
            map.spawnPosition.z
        );

        startPosition.copy(this.spawnPosition);

        if (savedPlayer?.position) {
            startPosition.set(
                savedPlayer.position.x,
                savedPlayer.position.y,
                savedPlayer.position.z
            );
        }

        if (savedPlayer?.rotation) {
            startRotation.set(
                savedPlayer.rotation.x,
                savedPlayer.rotation.y,
                savedPlayer.rotation.z
            );
        }

        this.player = new Player({
            position: startPosition,
            rotation: startRotation,
            input: this.input,
            groundTargets: this.raycastTargets,
            mapper
        });

        if (savedPlayer?.cameraDirection !== undefined) {
            this.player.setCameraDirection(savedPlayer.cameraDirection);
        }

        this.input?.emit("inventory.updated", this.player.inventory);
        this.threeD.scene.add(this.player.instance);

        this.cameraController = new Camera({
            camera: this.threeD.camera,
            domElement: this.threeD.renderer.domElement,
            player: this.player,
            input: this.input
        });

        this.cameraController.update(0);

        this.frustumCulling = new FrustumCulling({
            camera: this.threeD.camera,
            mapper,
            memoryDistance: 24
        });

        this.frustumCulling.refresh();

        this.chunkVisibility = new ChunkVisibility({
            scene: this.threeD.scene,
            targets: this.raycastTargets,
            mapper,
            culling: this.frustumCulling,
            renderBudgeter: this.renderBudgeter,
            renderDistance: this.renderDistance,
            fogSize: this.fogSize,
            raycastDistance: this.editDistance
        });
        this.chunkVisibility.setLodSettings?.(this.lodSettings);

        this.world.setChunkVisibility(this.chunkVisibility);
        this.refreshWorldView(true);
        this.goldenRule = this.chunkVisibility.goldenRule;
        this.goldenRule.render.threeD = this.threeD;

        this.collisions = new Collisions({
            mapper,
            borders: map.borders,
            scene: this.threeD.scene
        });

        this.raycast = new Raycast({
            camera: this.threeD.camera,
            scene: this.threeD.scene,
            targets: this.raycastTargets,
            cameraDistance: this.editDistance,
            onTargetChange: name => this.input?.emit("targetChange", name)
        });

        this.boxelEditor = new BoxelEditor({
            scene: this.threeD.scene,
            mapper
        });

        this.input?.on("mouseDown", this.onMouseDown);
        this.input?.on("mouseUp", this.onMouseUp);
        this.input?.on("mouseTap", this.onMouseTap);
        this.input?.on("mouseHoldStart", this.onMouseHoldStart);
        this.input?.on("mouseHoldMove", this.onMouseHoldMove);
        this.input?.on("mouseHoldEnd", this.onMouseHoldEnd);
        this.input?.on("keyDown", this.onKeyDown);
        this.input?.on("command", this.onCommand);
        this.input?.on("world.reset", this.onWorldReset);
        this.input?.on("world.exportWoxel", this.onWorldExport);
        this.input?.on("world.loadWoxel", this.onWorldLoad);
        this.input?.on("selectedItemChange", this.onSelectedItemChange);
        this.input?.on("inventory.addItem", this.onInventoryAddItem);

        this.debug = new Debug({
            element: document.querySelector("[data-ui=\"consola\"]"),
            player: this.player,
            mapper,
            getProfile: metrics => this.profile(metrics)
        });

        window.gameRuntime = this;
        window.debugProfile = this.debugProfile;
        window.debugBenchmark = this.debugBenchmark;
        window.addEventListener("beforeunload", this.onBeforeUnload);

        this.threeD.onResize(() => {
            this.refreshWorldView(true);
        });

        this.timer.connect(document);
        this.startAutosave();
        this.animationFrame = requestAnimationFrame(this.update);
    }

        onMouseDown(event = {}) {
        if (event.button !== 0 && event.button !== 2) return;
        if (!this.cameraController?.acceptsPointerAction()) return;

        // MouseDown queda libre para hold / BoxelEditor semantics.
        // Voxel place/quit vuelve a mouseTap.
    }

    onMouseUp() {
        // Input owns tap vs hold.
        // No gameplay edit here.
    }

    editFromPointerButton(button = 0) {
        const hit = this.raycast?.castFromCamera(this.editDistance);
        if (!hit) return false;
        if (button === 2 && this.placementHitsPlayer(hit)) return false;

        let boxels = null;

        if (button === 2) {
            const selectedVoxel = this.player?.orientedSelectedVoxel();
            const position = this.placePositionFromHit(hit);

            if (!selectedVoxel || !position) return false;

            boxels = this.world.placeHit(hit, selectedVoxel);
        } else {
            boxels = this.world.removeHit(hit);
        }

        if (!boxels?.length) return false;

        this.refreshBoxels(boxels);
        return true;
    }

    onMouseTap(payload = {}) {
        const event = payload.event || payload;

        if (payload.button !== 0 && payload.button !== 2 && event.button !== 0 && event.button !== 2) return;
        if (!this.cameraController?.acceptsPointerAction()) return;

        const button = payload.button ?? event.button;
        const hit = this.raycast?.castFromCamera(this.editDistance);

        if (this.boxelEditor?.active) {
            const result = this.boxelEditor.onMouseDown({ ...event, button }, hit);

            if (result?.placement) {
                result.boxels = this.world.placeBoxel(result.placement.boxel, result.placement.anchor);
            }

            if (result?.boxels) {
                this.refreshBoxels(result.boxels);
            }

            this.threeD.requestRender();
            return;
        }

        this.editFromPointerButton(button);
    }

    onMouseHoldStart(payload = {}) {
        const button = payload.button;

        if (button !== 0 && button !== 2) return;
        if (!this.cameraController?.acceptsPointerAction()) return;

        const hit = this.raycast?.castFromCamera(this.editDistance);
        if (!hit) return;
        if (button === 2 && this.placementHitsPlayer(hit)) return;

        const voxel = button === 2 ? this.player?.orientedSelectedVoxel() : null;
        const result = this.boxelEditor?.beginEasyEdit({ button, hit, voxel });

        if (!result?.handled) return;

        this.raycast?.hideHighlight();
        this.threeD.requestRender();
    }

    onMouseHoldMove() {
        if (!this.boxelEditor?.isEasyEditing?.()) return;
        if (!this.cameraController?.acceptsPointerAction()) return;

        const hit = this.raycast?.castFromCamera(this.editDistance);

        this.boxelEditor.updateEasyEdit(hit);
        this.raycast?.hideHighlight();
        this.threeD.requestRender();
    }

    onMouseHoldEnd() {
        if (!this.boxelEditor?.isEasyEditing?.()) return;

        const result = this.boxelEditor.endEasyEdit();

        if (result?.boxels) {
            this.refreshBoxels(result.boxels);
        }

        this.threeD.requestRender();
    }

    onKeyDown(event) {
        if (event.target instanceof HTMLInputElement) return;
        if (event.key !== "B") return;
        if (event.repeat) return;

        this.boxelEditor?.toggle();
        if (this.boxelEditor?.active) this.raycast?.hideHighlight();
        this.threeD.requestRender();
    }

    onSelectedItemChange(item) {
        this.player?.setSelectedItem(item);
    }

    onInventoryAddItem({ item = null, quantity = 1 } = {}) {
        const added = this.player?.addItem(item, quantity) || 0;

        if (added > 0) {
            this.input?.emit("inventory.updated", this.player.inventory);
        }
    }

    applyWireframeSettings(settings = {}) {
        this.world?.mapper?.mesher?.setRenderStyle?.({
            wireframeMode: settings.wireframeMode === true,
            wireframeVertexColors: settings.wireframeVertexColors === true
        });

        this.boxelEditor?.blueprintMesher?.setRenderStyle?.({
            wireframeMode: settings.wireframeMode === true,
            wireframeVertexColors: settings.wireframeVertexColors === true
        });
    }

    onSettingsUpdated(settings = {}) {
        const previous = this.currentSettings || {};
        const nextRenderBudget = settings.renderBudget ?? previous.renderBudget ?? "MEDIUM";
        const nextRenderDistance = settings.chunkRenderDistance ?? previous.chunkRenderDistance ?? this.renderDistance;
        const nextLodSettings = {
            enabled: settings.lodEnabled === true,
            fullDistance: settings.lodFullDistance ?? this.lodSettings.fullDistance,
            mediumDistance: settings.lodMediumDistance ?? this.lodSettings.mediumDistance
        };

        const renderBudgetChanged = nextRenderBudget !== previous.renderBudget;
        const renderDistanceChanged = nextRenderDistance !== previous.chunkRenderDistance;
        const renderStyleChanged = settings.wireframeMode !== previous.wireframeMode
            || settings.wireframeVertexColors !== previous.wireframeVertexColors;

        if (renderStyleChanged) {
            this.applyWireframeSettings(settings);
        }

        if (renderBudgetChanged) {
            this.renderBudgeter.applyPreset(nextRenderBudget);
        }

        if (renderDistanceChanged) {
            this.renderDistance = nextRenderDistance;
            if (this.chunkVisibility) this.chunkVisibility.setRenderDistance?.(this.renderDistance);
            this.threeD?.configureFog(this.renderDistance, this.fogSize);
        }

        this.lodSettings = nextLodSettings;
        const lodVisibilityChanged = this.chunkVisibility?.setLodSettings?.(this.lodSettings) || false;

        this.currentSettings = {
            ...previous,
            ...settings,
            renderBudget: nextRenderBudget,
            chunkRenderDistance: nextRenderDistance
        };

        if (renderBudgetChanged || renderDistanceChanged || lodVisibilityChanged) {
            this.refreshWorldView(true);
        }

        this.threeD?.requestRender();
    }

    async onCommand(command = {}) {
        if (command.name === "boxel.save") {
            await this.saveSelectedBoxel(command.boxelName);
            return;
        }

        if (command.name === "boxel.load") {
            await this.loadSelectedBoxel(command.boxelName);
            return;
        }

        if (command.name === "noclip") {
            this.toggleNoclip();
            return;
        }

        if (command.name === "teleport") {
            this.teleportPlayer(command);
            return;
        }

        if (command.name !== "spawn") return;

        this.spawnPlayer();
    }

    async onWorldReset() {
        const confirmed = window.confirm("Are you sure you want to delete this world and create a new one?");

        if (!confirmed) return;

        this.isReloadingWorld = true;
        await this.world.clearMemory();
        window.location.reload();
    }

    onWorldExport() {
        this.world.exportWoxel();
    }

    async onWorldLoad(file) {
        if (!file) return;

        try {
            this.isReloadingWorld = true;
            await this.world.importWoxel(file);
            window.location.reload();
        } catch (error) {
            this.isReloadingWorld = false;
            console.warn("Woxel load failed", error);
            this.input?.emit("commandResult", {
                message: "Woxel load failed"
            });
        }
    }

    toggleNoclip() {
        this.player?.setNoclip();
        this.input?.emit("commandResult", {
            message: `Noclip ${this.player?.noclip ? "enabled" : "disabled"}`
        });
        this.threeD.requestRender();
    }

    async saveSelectedBoxel(name = "") {
        const boxel = this.boxelEditor?.createSelectedBoxel(name, this.player?.desiredOrientation);

        if (!boxel) {
            console.log("No blue boxel selection to save.");
            return;
        }

        const saved = await this.world.saveBoxel(name, boxel);

        if (!saved) {
            this.input?.emit("commandResult", {
                message: `Boxel save failed, named ${name} already exists`
            });
            return;
        }

        console.log("Saved boxel", boxel);
        this.input?.emit("commandResult", {
            message: `Saved "${name}" boxel`
        });
    }

    async loadSelectedBoxel(name = "") {
        if (!this.boxelEditor?.active) {
            this.input?.emit("commandResult", {
                message: "Boxel load failed, enter BoxelEdition mode first"
            });
            return;
        }

        const boxel = await this.world.loadBoxel(name);

        if (!boxel) {
            this.input?.emit("commandResult", {
                message: `Boxel load failed, named ${name} does not exist`
            });
            return;
        }

        const hit = this.raycast?.castFromCamera(this.editDistance);

        if (!this.boxelEditor.loadPlacementBoxel(boxel, hit, this.player?.desiredOrientation)) {
            this.input?.emit("commandResult", {
                message: `Boxel load failed, named ${name} is empty`
            });
            return;
        }

        this.raycast?.hideHighlight();
        this.threeD.requestRender();
        this.input?.emit("commandResult", {
            message: `Loaded "${name}" boxel`
        });
    }

    spawnPlayer() {
        this.player?.spawn(this.spawnPosition, this.spawnRotation);
        this.cameraController?.syncToPlayerDirection();
        this.cameraController?.update(0);
        this.refreshWorldView(true);
        this.collisions?.update(this.player);
        this.cameraController?.update(0);
        this.threeD.requestRender();
    }

    teleportPlayer({ x, y, z } = {}) {
        if (!this.player) return;

        const position = this.world.mapper.toRenderCoords({ x, y, z });

        this.player.setPosition(position.x, position.y, position.z);
        this.player.verticalVelocity = 0;
        this.player.jumpCount = 0;
        this.cameraController?.update(0);
        this.refreshWorldView(true);
        this.collisions?.update(this.player);
        this.cameraController?.update(0);
        this.saveGame();
        this.threeD.requestRender();
        this.input?.emit("commandResult", {
            message: `Teleported to X ${x} Y ${y} Z ${z}`
        });
    }

    placePositionFromHit(hit) {
        const voxel = this.world?.hitVoxel(hit);

        if (!voxel || !hit?.face?.normal) return null;

        return {
            x: voxel.position.x + Math.round(hit.face.normal.x),
            y: voxel.position.y + Math.round(hit.face.normal.y),
            z: voxel.position.z + Math.round(hit.face.normal.z)
        };
    }

    placementHitsPlayer(hit) {
        const voxel = this.world.hitVoxel(hit);
        if (!voxel || !hit.face) return false;

        const position = {
            x: voxel.position.x + Math.round(hit.face.normal.x),
            y: voxel.position.y + Math.round(hit.face.normal.y),
            z: voxel.position.z + Math.round(hit.face.normal.z)
        };

        return this.collisions?.playerOverlapsVoxel(this.player, position);
    }

    refreshBoxels(boxels = []) {
        if (!boxels?.length) return;

        this.worldDirty = true;
        this.editActiveFrames = Math.max(this.editActiveFrames, 6);

        // Baseline edit flow:
        // Data changed already. Mesh is queued and lands when ChunkVisibility can.
        this.world.refreshBoxels(boxels, this.player);

        this.raycast?.forceNextUpdate?.();
        this.scheduleEditSave();
        this.invalidation.markEdit("boxel-edit").markMesh("boxel-remesh-request");
        this.threeD.requestRender();
    }

    // Compatibility no-op for old cached callers after pruning edit-loop hacks.
    keepEditLoopAlive() {}

    flushRemeshBoxels(boxels = [], meta = {}) {
        if (!boxels.length) return;

        this.world.refreshBoxels(boxels, this.player);
        this.raycast?.forceNextUpdate?.();
        this.scheduleEditSave();
        this.invalidation.markMesh(`remesh-${meta.reason || "flush"}`).clear(RenderInvalidation.Flags.MESH);
        this.threeD.requestRender();
    }

    saveGame(forceWorld = false) {
        const shouldSaveWorld = forceWorld || this.worldDirty;

        this.world.save(this.player, shouldSaveWorld);

        if (shouldSaveWorld) {
            this.worldDirty = false;
        }
    }

    profile({ fps = 0, frameMs = 0 } = {}) {
        const player = this.world.mapper.toWorldCoords(this.player.position);
        const chunkProfiler = this.chunkVisibility?.profile?.() ?? {};

        return {
            renderCount: this.threeD.renderCount,
            visibleChunks: this.chunkVisibility?.visible.size ?? 0,
            loadedChunks: this.chunkVisibility?.meshes.size ?? 0,
            chunkLoadQueue: this.chunkVisibility?.loadQueue.length ?? 0,
            meshQueue: this.chunkVisibility?.meshQueue.length ?? 0,
            chunkProfiler,
            goldenRule: {
                data: this.goldenRule?.data.profile(chunkProfiler) ?? {},
                mesh: this.goldenRule?.mesh.profile(chunkProfiler) ?? {},
                render: this.goldenRule?.render.profile({ fps, frameMs }) ?? {}
            },
            optimizationWiring: {
                root: "./Optimization",
                renderBudgeter: this.renderBudgeter instanceof RenderBudgeter,
                chunkVisibility: this.chunkVisibility instanceof ChunkVisibility,
                frustumCulling: this.frustumCulling instanceof FrustumCulling,
                goldenRuleData: Boolean(this.goldenRule?.data),
                goldenRuleMesh: Boolean(this.goldenRule?.mesh),
                goldenRuleRender: Boolean(this.goldenRule?.render),
                meshWorkerPath: this.chunkVisibility?.meshWorkerPath ?? null
            },
            raycastTargets: this.raycastTargets.length,
            player
        };
    }

    debugProfile() {
        return this.debug?.debugProfile();
    }

    debugBenchmark(durationSec = 15, intervalMs = 1000) {
        const durationMs = Math.max(1000, Number(durationSec) * 1000 || 15000);
        const sampleMs = Math.max(250, Number(intervalMs) || 1000);
        const startedAt = performance.now();
        const samples = [];

        console.log(`KL2 benchmark started: ${Math.round(durationMs / 1000)}s`);

        return new Promise(resolve => {
            const sample = () => {
                samples.push(this.debug?.profileSnapshot?.() || this.profile());

                if (performance.now() - startedAt < durationMs) return;

                clearInterval(timer);

                const summary = this.summarizeBenchmark(samples);

                console.table(summary);
                console.log({ summary, samples });
                resolve({ summary, samples });
            };

            const timer = setInterval(sample, sampleMs);

            sample();
        });
    }

    summarizeBenchmark(samples = []) {
        const values = key => samples.map(key).filter(Number.isFinite);
        const avg = list => list.length
            ? Math.round(list.reduce((sum, value) => sum + value, 0) / list.length * 10) / 10
            : 0;
        const max = list => list.length ? Math.max(...list) : 0;

        return {
            samples: samples.length,
            avgFps: avg(values(sample => sample.fps)),
            avgFrameMs: avg(values(sample => sample.frameMs)),
            avgRaycastTargets: avg(values(sample => sample.raycastTargets)),
            maxRaycastTargets: max(values(sample => sample.raycastTargets)),
            avgRenderCalls: avg(values(sample => sample.goldenRule?.render?.calls ?? 0)),
            maxRenderTriangles: max(values(sample => sample.goldenRule?.render?.triangles ?? 0)),
            maxVisibleChunks: max(values(sample => sample.goldenRule?.render?.visibleChunks ?? 0)),
            avgMeshMsPerJob: avg(values(sample => sample.chunkProfiler?.meshMsRecentAvg ?? 0)),
            maxMeshQueue: max(values(sample => sample.meshQueue)),
            maxDataQueue: max(values(sample => sample.goldenRule?.data?.loadQueue ?? 0)),
            maxPeakMeshRecent: max(values(sample => sample.chunkProfiler?.peakMeshQueueRecent ?? 0)),
            maxPeakMeshSession: max(values(sample => sample.chunkProfiler?.peakMeshQueueSession ?? 0)),
            maxPendingWorkerJobs: max(values(sample => sample.chunkProfiler?.pendingMeshJobs ?? 0)),
            meshesBuilt: max(values(sample => sample.chunkProfiler?.meshesBuiltSession ?? 0)),
            renderCount: max(values(sample => sample.renderCount))
        };
    }

    update(timestamp = 0) {
        this.timer.update();

        const deltaTime = Math.min(this.timer.getDelta(), 1 / 30);
        const inputChanged = this.input?.version !== this.lastInputVersion;
        const acceptsPlayerMovement = this.cameraController?.acceptsPlayerMovement() ?? true;
        const isActive = this.isActive(inputChanged, acceptsPlayerMovement);

        if (acceptsPlayerMovement && isActive) {
            this.player?.beginFrame?.();
            this.player?.updateMovementIntent();
            this.player?.update(deltaTime, false);
        }

        if (isActive) {
            this.collisions?.update(this.player);
            this.cameraController?.update(deltaTime);
            this.refreshWorldView();
            const chunkWork = this.chunkVisibility?.tickBudgeted(this.player) || 0;
            if (chunkWork > 0) this.threeD.requestRender();

            if (this.boxelEditor?.isVisualEditing?.()) {
                const hit = this.raycast?.castFromCamera(this.editDistance);

                this.raycast?.hideHighlight();
                this.boxelEditor.update(hit, this.player?.desiredOrientation);
            } else {
                this.raycast?.update(deltaTime);
            }

            if (this.invalidation.has(RenderInvalidation.Flags.RENDER)) {
                this.threeD.requestRender();
                this.invalidation.clear(RenderInvalidation.Flags.RENDER);
            } else if (this.shouldRenderActiveFrame(inputChanged)) {
                this.threeD.requestRender();
            }
        }

        this.updateDebug(deltaTime);
        this.tickWarmup();
        this.tickEditActiveFrames();

        if (this.threeD.needsRender) this.threeD.render();

        this.lastInputVersion = this.input?.version ?? this.lastInputVersion;
        this.animationFrame = requestAnimationFrame(this.update);
    }

    isWarmingUp() {
        return this.warmupFrames > 0;
    }

    tickWarmup() {
        if (this.warmupFrames > 0) {
            this.warmupFrames -= 1;
        }
    }

    tickEditActiveFrames() {
        if (this.editActiveFrames > 0) {
            this.editActiveFrames -= 1;
        }
    }

    shouldRenderActiveFrame(inputChanged = false) {
        const playerMoving = this.player?.isFlying
            ? this.player.hasFlyingInput()
            : this.player?.hasMovementInput();

        return Boolean(
            inputChanged
            || this.isWarmingUp()
            || playerMoving
            || this.player?.verticalVelocity !== 0
            || this.input?.pointer?.isDown
        );
    }

    refreshWorldView(force = false) {
        if (!this.player || !this.threeD?.camera || !this.chunkVisibility) return;

        const frustumChanged = force || this.shouldRefreshFrustum();
        const chunksChanged = force || this.shouldRefreshChunks();

        if (frustumChanged) {
            this.frustumCulling?.refresh();
            this.captureFrustumState();
            this.invalidation.markRaycast("frustum-refresh");
        }

        if (chunksChanged) {
            this.chunkVisibility.refresh(this.player, true);
            this.captureChunkRefreshState();
            this.invalidation.markChunks("chunk-refresh");
        }
    }

    shouldRefreshFrustum() {
        const camera = this.threeD.camera;
        const moved = !this.lastFrustumPosition
            || camera.position.distanceToSquared(this.lastFrustumPosition) >= this.frustumMoveThreshold * this.frustumMoveThreshold;
        const rotated = !this.lastFrustumQuaternion
            || this.quaternionAngle(camera.quaternion, this.lastFrustumQuaternion) >= this.frustumRotationThreshold;

        if (!moved && !rotated) return false;

        this.captureFrustumState();
        return true;
    }

    shouldRefreshChunks() {
        const chunkKey = this.chunkVisibility.queueKey(this.player.position);
        const yaw = this.cameraController?.yaw ?? this.player.cameraDirection ?? this.player.rotation.y;
        const pitch = this.cameraController?.pitch ?? 0;
        const chunkChanged = chunkKey !== this.lastChunkRefreshKey;
        const cameraTurned = this.lastChunkRefreshYaw === null
            || Math.abs(this.angleDelta(yaw, this.lastChunkRefreshYaw)) >= this.chunkCameraThreshold
            || Math.abs(pitch - this.lastChunkRefreshPitch) >= this.chunkCameraThreshold;

        if (!chunkChanged && !cameraTurned) return false;

        this.captureChunkRefreshState(chunkKey, yaw, pitch);
        return true;
    }

    captureFrustumState() {
        const camera = this.threeD.camera;

        this.lastFrustumPosition = camera.position.clone();
        this.lastFrustumQuaternion = camera.quaternion.clone();
    }

    captureChunkRefreshState(
        chunkKey = this.chunkVisibility.queueKey(this.player.position),
        yaw = this.cameraController?.yaw ?? this.player.cameraDirection ?? this.player.rotation.y,
        pitch = this.cameraController?.pitch ?? 0
    ) {
        this.lastChunkRefreshKey = chunkKey;
        this.lastChunkRefreshYaw = yaw;
        this.lastChunkRefreshPitch = pitch;
    }

    quaternionAngle(a, b) {
        return 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));
    }

    angleDelta(a, b) {
        return Math.atan2(Math.sin(a - b), Math.cos(a - b));
    }

    updateDebug(deltaTime) {
        this.debugFrames += 1;
        this.debugElapsed += deltaTime;

        if (this.debugElapsed < this.debugInterval) return;

        const elapsed = this.debugElapsed;
        const frames = this.debugFrames;

        this.debugElapsed = 0;
        this.debugFrames = 0;
        this.debug?.update(elapsed, true, frames);
    }

    startAutosave() {
        this.stopAutosave();

        this.saveTimer = window.setInterval(() => {
            if (this.isReloadingWorld) return;

            this.saveGame();
        }, this.saveIntervalMs);
    }

    stopAutosave() {
        if (!this.saveTimer) return;

        window.clearInterval(this.saveTimer);
        this.saveTimer = null;
    }

    scheduleEditSave() {
        window.clearTimeout(this.editSaveTimer);
        this.editSaveTimer = window.setTimeout(() => {
            this.editSaveTimer = null;
            if (this.isReloadingWorld) return;

            this.saveGame();
        }, this.editSaveDelayMs);
    }

    flushEditSave() {
        if (!this.editSaveTimer) return;

        window.clearTimeout(this.editSaveTimer);
        this.editSaveTimer = null;
        this.saveGame();
    }

    onBeforeUnload() {
        if (this.isReloadingWorld) return;

        this.stopAutosave();
        this.flushEditSave();
        this.saveGame(true);
    }

    isActive(inputChanged, acceptsPlayerMovement) {
        if (this.isWarmingUp()) return true;
        if (this.editActiveFrames > 0) return true;
        if (inputChanged || this.threeD.needsRender || this.invalidation.has()) return true;
        if (this.chunkVisibility?.hasPendingWork()) return true;
        if (!acceptsPlayerMovement) return false;

        return this.shouldRenderActiveFrame(inputChanged);
    }
}

export default GameRuntime;



