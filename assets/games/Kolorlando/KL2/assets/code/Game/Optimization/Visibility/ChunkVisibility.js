import Data from "../GoldenRule/Data.js";
import Mesh from "../GoldenRule/Mesh.js";
import Render from "../GoldenRule/Render.js";
import LOD from "../LOD.js";
import InteractionBudgeter from "../Interaction/InteractionBudgeter.js";

export class ChunkVisibility {
  constructor({
    scene,
    targets,
    mapper,
    culling = null,
    renderBudgeter = null,
    renderDistance = 30,
    fogSize = 25,
    raycastDistance = 15,
    lod = null
  } = {}) {
    this.scene = scene;
    this.targets = targets;
    this.mapper = mapper;
    this.culling = culling;
    this.renderBudgeter = renderBudgeter;

    this.renderDistance = renderDistance;
    this.fogSize = fogSize;
    this.raycastDistance = raycastDistance;

    this.lod = lod || new LOD({ enabled: false });
    this.lodEnabled = false;
    this.lodModes = new Map();

    this.meshWorkerPath = "../Meshing/BoxelMeshWorker.js";

    this.raycastGraceMs = 250;
    this.raycastTargetTimes = new Map();
    this.hasGraceTargets = false;

    this.meshes = new Map();
    this.visible = new Set();
    this.chunkStates = new Map();
        // FakeVoxel and LocalPatch are intentionally paused for the clean baseline.
        this.fakeVoxel = null;
        this.localPatch = null;

    this.interactionBudgeter = new InteractionBudgeter({
      targets,
      mapper,
      culling,
      visible: this.visible,
      raycastDistance: this.raycastDistance,
      graceMs: this.raycastGraceMs,
      boxelCenter: boxel => this.boxelCenter(boxel),
      isSurfaceBoxel: boxel => this.mapper?.isSurfaceBoxel?.(boxel),
      isMeshStable: mesh => this.isStableRaycastMesh(mesh)
    });

    this.lastPositionKey = null;
    this.lastQueueKey = null;
    this.lastCullingVersion = -1;
    this.lastPlayerPosition = null;
    this.currentPlayer = null;

    this.motionIntent = { x: 0, y: 0, z: 0 };
    this.isDirty = true;

    this.loadQueue = [];
    this.loadQueueKeys = new Set();
    this.meshQueue = [];
    this.meshQueueKeys = new Set();

    this.meshWorker = this.createMeshWorker();
    this.meshJobId = 0;
    this.pendingMeshJobs = new Map();

    // Mesh build can happen in workers. Mesh apply always happens on the main thread,
    // so we budget it separately to avoid frame pacing spikes while walking.
    this.pendingMeshApplies = [];
    this.pendingMeshApplyKeys = new Set();
    this.maxMeshAppliesPerFrame = 1;
    this.editImmediateMeshLimit = 2;
    this.editMeshApplyBoostFrames = 0;

    this.maxWorkerJobs = Math.max(3, Math.min(8, navigator.hardwareConcurrency || 4));

    this.loadQueueTimes = new Map();
    this.meshQueueTimes = new Map();
    this.dirtyMeshKeys = new Set();
    this.keepKeys = new Set();

    this.meshQueueLimit = 72;
    this.trimmedMeshJobs = 0;

    this.maxLoadsPerFrame = 2;
    this.maxMeshesPerFrame = this.renderBudgeter?.getLimits().meshBuildsPerFrame ?? 2;
    this.frameBudgetMs = 5;

    this.forwardPriority = 0.45;
    this.motionPriority = 0.3;
    this.verticalTrustBoost = 0.15;
    this.surfacePriority = 0.35;
    this.agePriority = 0.55;
    this.maxPriorityAgeMs = 5000;

    this.historyWindowMs = 15000;
    this.history = [];
    this.frameStats = this.createFrameStats();
    this.asyncFrameStats = this.createFrameStats();
    this.sessionStats = this.createSessionStats();

    this.data = new Data({
      mapper,
      setChunkState: (key, state) => this.setChunkState(key, state),
      clearChunkState: (key, state) => this.clearChunkState(key, state),
      onSkip: count => this.frameStats.skippedChunks += count,
      onLoaded: boxel => this.onDataLoaded(boxel),
      maxLoadsPerFrame: this.maxLoadsPerFrame,
      frameBudgetMs: this.frameBudgetMs
    });

    this.mesh = new Mesh({
      mapper,
      setChunkState: (key, state) => this.setChunkState(key, state),
      clearChunkState: (key, state) => this.clearChunkState(key, state),
      hasFinishedMeshState: key => this.hasFinishedMeshState(key),
      shouldRemeshFinishedBoxel: (boxel, key) => this.shouldRemeshFinishedBoxel(boxel, key),
      onSkip: count => this.frameStats.skippedChunks += count,
      limit: this.meshQueueLimit
    });

    this.render = new Render({
      chunkVisibility: this,
      raycastTargets: targets
    });

    this.goldenRule = {
      data: this.data,
      mesh: this.mesh,
      render: this.render
    };

    this.loadQueue = this.data.queue;
    this.loadQueueKeys = this.data.keys;
    this.loadQueueTimes = this.data.times;

    this.meshQueue = this.mesh.queue;
    this.meshQueueKeys = this.mesh.keys;
    this.meshQueueTimes = this.mesh.times;
  }

  createMeshWorker() {
    if (typeof Worker === "undefined") return null;

    try {
      const worker = new Worker(this.meshWorkerPath, { type: "module" });

      worker.onmessage = event => this.onMeshWorkerMessage(event.data || {});
      worker.onerror = error => {
        console.warn("Boxel mesh worker failed; falling back to main thread", error);
        this.requeuePendingMeshJobs();
        this.meshWorker?.terminate?.();
        this.meshWorker = null;
      };

      return worker;
    } catch (error) {
      console.warn("Boxel mesh worker unavailable; using main thread", error);
      return null;
    }
  }

  setMeshes(meshes = []) {
    meshes.forEach(mesh => {
      const boxel = mesh?.userData?.boxel;
      if (boxel) this.queueMeshApply(boxel, mesh, mesh.userData?.lodMode);
    });
  }

  setMesh(boxel, mesh, lodMode = "full-detail") {
    const key = this.boxelKey(boxel);
    const mode = this.normalizeLodMode(lodMode);
    const current = this.meshes.get(key);
    const wasVisible = this.visible.has(key);

    if (mesh) {
      mesh.userData.lodMode = mode;
      mesh.userData.dirty = false;
      mesh.userData.raycastDisabled = false;

      this.meshes.set(key, mesh);
      this.lodModes.set(key, mode);

      if (wasVisible) this.replaceVisibleMesh(current, mesh, key);
      this.setChunkState(key, wasVisible ? "visible" : "meshReady");
    } else {
      this.meshes.delete(key);
      this.lodModes.delete(key);

      if (current) {
        this.hideMesh(current, key);
        this.removeTarget(current);
        this.disposeMesh(current);
      }

      this.setChunkState(key, "meshReady");
    }

    if (current && current !== mesh) {
      this.removeTarget(current);
      this.disposeMesh(current);
    }

    this.dirtyMeshKeys.delete(key);
    this.isDirty = true;
  }

  setRenderDistance(distance = this.renderDistance) {
    const nextDistance = Math.max(1, Number(distance) || this.renderDistance || 30);

    if (nextDistance === this.renderDistance) return false;

    this.renderDistance = nextDistance;
    this.lastQueueKey = null;
    this.isDirty = true;

    return true;
  }

  remeshBoxels(boxels = [], player = null) {
    const editBoxels = this.prioritizeEditBoxels(boxels, player || this.currentPlayer);
    let immediate = 0;

    this.editMeshApplyBoostFrames = Math.max(this.editMeshApplyBoostFrames, 8);

    editBoxels.forEach(boxel => {
      const key = this.boxelKey(boxel);
      const currentMesh = this.meshes.get(key);

      this.touchMeshVersion(boxel);

      if (currentMesh) {
        currentMesh.userData.dirty = true;
        currentMesh.userData.raycastDisabled = true;
        this.removeTarget(currentMesh);
      }

      this.dirtyMeshKeys.add(key);

      if (immediate < this.editImmediateMeshLimit) {
        if (this.buildEditMeshNow(boxel, player || this.currentPlayer)) {
          immediate += 1;
          return;
        }
      }

      this.queueMesh(boxel, {
        force: true,
        player: player || this.currentPlayer
      });
    });

    if (player) this.prioritizeQueues(player);
  }

  prioritizeEditBoxels(boxels = [], player = null) {
    const unique = new Map();

    boxels.forEach(boxel => {
      if (!boxel) return;
      unique.set(this.boxelKey(boxel), boxel);
    });

    const editPositions = this.mapper?.lastEditPositions || [];

    return [...unique.values()].sort((a, b) => {
      return this.editBoxelScore(a, player, editPositions) - this.editBoxelScore(b, player, editPositions);
    });
  }

  editBoxelScore(boxel, player = null, editPositions = []) {
    const editScore = editPositions.length
      ? Math.min(...editPositions.map(position => this.boxelVoxelDistanceSq(boxel, position)))
      : 0;
    const playerScore = player?.position
      ? this.boxelRenderDistanceSq(boxel, player.position)
      : 0;

    return editScore + playerScore * 0.001;
  }

  boxelVoxelDistanceSq(boxel, position = {}) {
    const size = this.mapper?.woxel?.boxelSize || 15;
    const center = {
      x: boxel.position.x + size * 0.5,
      y: boxel.position.y + size * 0.5,
      z: boxel.position.z + size * 0.5
    };
    const dx = center.x - position.x;
    const dy = center.y - position.y;
    const dz = center.z - position.z;

    return dx * dx + dy * dy + dz * dz;
  }

  boxelRenderDistanceSq(boxel, renderPosition = {}) {
    const center = this.boxelCenter(boxel);
    const dx = center.x - renderPosition.x;
    const dy = center.y - renderPosition.y;
    const dz = center.z - renderPosition.z;

    return dx * dx + dy * dy + dz * dz;
  }

  buildEditMeshNow(boxel, player = null) {
    if (!boxel) return false;

    const key = this.boxelKey(boxel);
    const lodMode = this.lodModeFor(boxel, player?.position);
    const version = this.meshVersion(boxel);
    const startedAt = performance.now();
    const mesh = this.createBoxelMesh(boxel, lodMode);

    this.asyncFrameStats.meshMs += performance.now() - startedAt;
    this.asyncFrameStats.meshJobs += 1;
    if (mesh) this.asyncFrameStats.meshesBuilt += 1;

    if (version !== this.meshVersion(boxel)) {
      if (mesh) this.disposeMesh(mesh);
      this.asyncFrameStats.skippedChunks += 1;
      return false;
    }

    this.dropQueuedMesh(key);
    this.setMesh(boxel, mesh, lodMode);
    return true;
  }

  dropQueuedMesh(key) {
    if (!key || !this.meshQueueKeys.has(key)) return false;

    this.meshQueue = this.meshQueue.filter(boxel => this.boxelKey(boxel) !== key);
    this.mesh.queue = this.meshQueue;
    this.meshQueueKeys.delete(key);
    this.mesh.keys.delete(key);
    this.meshQueueTimes.delete(key);
    this.mesh.times.delete(key);
    return true;
  }

  touchMeshVersion(boxel = null) {
    if (!boxel) return 0;

    boxel.__meshVersion = (Number(boxel.__meshVersion) || 0) + 1;
    return boxel.__meshVersion;
  }

  meshVersion(boxel = null) {
    return Number(boxel?.__meshVersion) || 0;
  }

  isStaleMeshJob(job = null) {
    return Boolean(job && job.version !== this.meshVersion(job.boxel));
  }

  discardStaleMeshJob(job = null) {
    if (!job) return;

    this.asyncFrameStats.skippedChunks += 1;

    if (this.dirtyMeshKeys.has(job.key)) {
      this.queueMesh(job.boxel, {
        force: true,
        player: this.currentPlayer,
        lodMode: job.lodMode
      });
    }
  }

  refresh(player, force = false) {
    if (!player) return;

    this.syncRenderBudget();

    const positionKey = this.positionKey(player.position);
    const queueKey = this.queueKey(player.position);
    const cullingVersion = this.culling?.version ?? 0;

    const positionChanged = positionKey !== this.lastPositionKey;
    const queueChanged = queueKey !== this.lastQueueKey;
    const cullingChanged = cullingVersion !== this.lastCullingVersion;
    const needsRefresh = force || this.isDirty || positionChanged || cullingChanged;

    if (!needsRefresh) return;

    this.currentPlayer = player;
    this.updateMotionIntent(player);

    if (force || this.isDirty || queueChanged || cullingChanged) {
      this.queueAround(player);
    }

    this.applyVisibility(player);

    this.lastPositionKey = positionKey;
    this.lastQueueKey = queueKey;
    this.lastCullingVersion = cullingVersion;
    this.isDirty = false;
  }

  tickBudgeted(player) {
    if (!player) return 0;

    this.syncRenderBudget();

    this.currentPlayer = player;
    this.updateMotionIntent(player);
    this.frameStats = this.createFrameStats();

    const processedWork = this.processQueues();

    this.collectAsyncFrameStats();
    this.recordHistorySample();

    if (processedWork || this.isDirty || this.hasGraceTargets) {
      this.applyVisibility(player);
      this.isDirty = false;
    } else {
      this.updateRaycastTargets(player);
    }

    return processedWork;
  }

  applyVisibility(player) {
    const renderCandidates = [];

    this.meshes.forEach((mesh, key) => {
      const boxel = mesh.userData.boxel;

      if (!this.shouldKeepMesh(boxel, player.position)) {
        this.unloadMesh(mesh, key);
        return;
      }

      this.reconcileMeshLod(boxel, key, mesh, player);

      if (this.canRender(boxel, key, player.position)) {
        renderCandidates.push({
          boxel,
          key,
          mesh: this.meshes.get(key) || mesh
        });
      } else {
        this.hideMesh(mesh, key);
      }
    });

    this.applyRenderBudget(renderCandidates, player);
    this.updateRaycastTargets(player);
  }

  queueAround(player) {
    const position = player.position;
    const positions = this.mapper.landBoxelPositionsNear(position, this.renderDistance);
    const keepKeys = new Set();

    positions.forEach(item => {
      const key = this.mapper.voxelKey(item);
      const boxel = this.mapper.boxels.get(key) || this.virtualBoxel(item);

      if (!this.shouldQueue(boxel, position)) return;

      keepKeys.add(key);

      const lodMode = this.lodModeFor(boxel, position);

      if (this.meshMatchesLod(this.meshes.get(key), lodMode)) return;

      if (this.mapper.boxels.has(key)) {
        this.queueMesh(boxel, { lodMode, player });
        return;
      }

      this.data.add(item);
    });

    this.queueKnownBoxels(position, keepKeys);
    this.keepKeys = keepKeys;
    this.pruneQueues(keepKeys);
    this.prioritizeQueues(player);
  }

  queueKnownBoxels(position, keepKeys = new Set()) {
    this.mapper.boxels.forEach((boxel, key) => {
      if (!this.shouldQueue(boxel, position)) return;

      keepKeys.add(key);

      const lodMode = this.lodModeFor(boxel, position);

      if (this.meshMatchesLod(this.meshes.get(key), lodMode)) return;

      this.queueMesh(boxel, {
        lodMode,
        player: this.currentPlayer
      });
    });
  }

  reconcileMeshLod(boxel, key, mesh, player) {
    if (!this.isLodActive()) return false;

    const lodMode = this.lodModeFor(boxel, player?.position);

    if (this.meshMatchesLod(mesh, lodMode)) return false;
    if (this.meshQueueKeys.has(key) || this.hasPendingMeshJob(key)) return false;

    return this.queueMesh(boxel, {
      lodMode,
      player
    });
  }

  processQueues() {
    return this.processLoadQueue()
      + this.processMeshQueue()
      + this.processMeshApplyQueue();
  }

  processLoadQueue() {
    return this.data.process(this.keepKeys);
  }

  onDataLoaded(boxel) {
    this.mapper.boxelsAround(boxel).forEach(item => {
      this.queueMesh(item, {
        force: true,
        player: this.currentPlayer
      });
    });
  }

  processMeshQueue() {
    let processed = 0;
    const startedAt = performance.now();

    if (this.meshWorker) return this.dispatchWorkerJobs();

    const maxJobs = this.meshBuildsPerFrame();

    for (let count = 0; count < maxJobs && this.mesh.hasWork(); count += 1) {
      const { boxel, key } = this.mesh.take();
      const lodMode = this.lodModeFor(boxel, this.currentPlayer?.position);

      if (this.keepKeys.size > 0 && !this.keepKeys.has(key) && !boxel.persisted) {
        this.clearChunkState(key, "queuedMesh");
        this.frameStats.skippedChunks += 1;
        continue;
      }

      const meshStartedAt = performance.now();
      const mesh = this.createBoxelMesh(boxel, lodMode);

      this.frameStats.meshMs += performance.now() - meshStartedAt;
      this.frameStats.meshJobs += 1;

      if (mesh) this.frameStats.meshesBuilt += 1;

      if (mesh) this.queueMeshApply(boxel, mesh, lodMode);
      else this.queueMeshApply(boxel, null, lodMode);
      processed += 1;

      if (performance.now() - startedAt >= this.frameBudgetMs) break;
    }

    return processed;
  }

  dispatchWorkerJobs() {
    let processed = 0;

    while (
      this.mesh.hasWork()
      && this.pendingMeshJobs.size < this.maxWorkerJobs
      && processed < this.meshBuildsPerFrame()
    ) {
      const { boxel, key } = this.mesh.take();
      const lodMode = this.lodModeFor(boxel, this.currentPlayer?.position);

      if (this.keepKeys.size > 0 && !this.keepKeys.has(key) && !boxel.persisted) {
        this.clearChunkState(key, "queuedMesh");
        this.frameStats.skippedChunks += 1;
        continue;
      }

      if (this.mapper.isSurfaceBoxel?.(boxel)) {
        this.buildMeshOnMainThread(boxel, lodMode);
        processed += 1;
        continue;
      }

      this.dispatchMeshJob(boxel, key, lodMode);
      processed += 1;
    }

    return processed;
  }

  dispatchMeshJob(boxel, key, lodMode = this.lodModeFor(boxel, this.currentPlayer?.position)) {
    const id = ++this.meshJobId;
    const payload = {
      ...this.mapper.meshWorkerPayload(boxel),
      lodMode
    };

    this.pendingMeshJobs.set(id, {
      boxel,
      key,
      lodMode,
      version: this.meshVersion(boxel),
      startedAt: performance.now()
    });

    this.meshWorker.postMessage({ id, ...payload });
  }

  onMeshWorkerMessage(message = {}) {
    const job = this.pendingMeshJobs.get(message.id);

    if (!job) return;

    this.pendingMeshJobs.delete(message.id);

    if (this.isStaleMeshJob(job)) {
      this.discardStaleMeshJob(job);
      this.dispatchWorkerJobs();
      return;
    }

    if (message.error) {
      console.warn("Boxel mesh worker job failed; retrying on main thread", message.error);
      this.buildMeshOnMainThread(job.boxel, job.lodMode);
      return;
    }

    const mesh = this.mapper.createBoxelMeshFromGeometryData(job.boxel, message.geometryData);

    this.asyncFrameStats.meshMs += message.meshMs || 0;
    this.asyncFrameStats.meshJobs += 1;

    if (mesh) this.asyncFrameStats.meshesBuilt += 1;

    if (mesh) this.queueMeshApply(job.boxel, mesh, job.lodMode, job.version);
    else this.queueMeshApply(job.boxel, null, job.lodMode, job.version);

    this.dispatchWorkerJobs();
  }

  buildMeshOnMainThread(boxel, lodMode = this.lodModeFor(boxel, this.currentPlayer?.position)) {
    const meshStartedAt = performance.now();
    const mesh = this.createBoxelMesh(boxel, lodMode);

    this.asyncFrameStats.meshMs += performance.now() - meshStartedAt;
    this.asyncFrameStats.meshJobs += 1;

    if (mesh) this.asyncFrameStats.meshesBuilt += 1;

    if (mesh) this.queueMeshApply(boxel, mesh, lodMode, this.meshVersion(boxel));
    else this.queueMeshApply(boxel, null, lodMode, this.meshVersion(boxel));
  }

  queueMeshApply(boxel, mesh, lodMode = "full-detail", version = this.meshVersion(boxel)) {
    if (!boxel) return false;

    const key = this.boxelKey(boxel);

    if (this.pendingMeshApplyKeys.has(key)) {
      const previousIndex = this.pendingMeshApplies.findIndex(item => item.key === key);
      const previous = this.pendingMeshApplies[previousIndex];

      if (previous?.mesh && previous.mesh !== mesh) {
        this.disposeMesh(previous.mesh);
      }

      if (previousIndex !== -1) this.pendingMeshApplies.splice(previousIndex, 1);
      this.pendingMeshApplyKeys.delete(key);
    }

    this.pendingMeshApplies.push({
      boxel,
      key,
      mesh,
      lodMode,
      version
    });
    this.pendingMeshApplyKeys.add(key);
    this.setChunkState(key, "queuedMesh");

    return true;
  }

  processMeshApplyQueue() {
    let applied = 0;
    const maxApplies = this.editMeshApplyBoostFrames > 0
      ? Math.max(this.maxMeshAppliesPerFrame, 3)
      : this.maxMeshAppliesPerFrame;

    if (this.editMeshApplyBoostFrames > 0) this.editMeshApplyBoostFrames -= 1;

    while (applied < maxApplies && this.pendingMeshApplies.length > 0) {
      const item = this.pendingMeshApplies.shift();

      this.pendingMeshApplyKeys.delete(item.key);

      if (item.version !== this.meshVersion(item.boxel)) {
        if (item.mesh) this.disposeMesh(item.mesh);
        this.frameStats.skippedChunks += 1;
        continue;
      }

      this.setMesh(item.boxel, item.mesh, item.lodMode);
      applied += 1;
    }

    return applied;
  }

  requeuePendingMeshJobs() {
    this.pendingMeshJobs.forEach(job => {
      this.queueMesh(job.boxel, {
        force: true,
        player: this.currentPlayer,
        lodMode: job.lodMode
      });
    });

    this.pendingMeshJobs.clear();
  }

  collectAsyncFrameStats() {
    this.frameStats.meshMs += this.asyncFrameStats.meshMs;
    this.frameStats.meshJobs += this.asyncFrameStats.meshJobs;
    this.frameStats.meshesBuilt += this.asyncFrameStats.meshesBuilt;
    this.frameStats.skippedChunks += this.asyncFrameStats.skippedChunks;
    this.asyncFrameStats = this.createFrameStats();
  }

  queueMesh(boxel, force = false) {
    const options = typeof force === "object" ? force : { force };
    const player = options.player || this.currentPlayer;
    const key = this.boxelKey(boxel);
    const lodMode = this.normalizeLodMode(
      options.lodMode || this.lodModeFor(boxel, player?.position)
    );
    const hasReadyMesh = this.meshMatchesLod(this.meshes.get(key), lodMode);
    const shouldForce = Boolean(options.force) || !hasReadyMesh;

    return this.mesh.add(boxel, {
      force: shouldForce,
      player,
      prioritize: () => this.prioritizeQueues(player)
    });
  }

  shouldRemeshFinishedBoxel(boxel, key) {
    return this.dirtyMeshKeys.has(key)
      || this.visible.has(key)
      || this.meshTouchesVisibleBoxel(boxel)
      || !this.meshMatchesLod(this.meshes.get(key), this.lodModeFor(boxel, this.currentPlayer?.position));
  }

  meshTouchesVisibleBoxel(boxel) {
    return this.mapper.boxelsAround(boxel)
      .some(item => item !== boxel && this.visible.has(this.boxelKey(item)));
  }

  trimMeshQueue(player) {
    const trimmed = this.mesh.trim(() => this.prioritizeQueues(player));

    this.frameStats.trimmedMeshJobs += trimmed;
    this.trimmedMeshJobs += trimmed;
  }

  pruneQueues(keepKeys) {
    this.data.prune(keepKeys);
    this.mesh.prune(keepKeys);

    this.loadQueue = this.data.queue;
    this.loadQueueKeys = this.data.keys;
    this.meshQueue = this.mesh.queue;
    this.meshQueueKeys = this.mesh.keys;
  }

  prioritizeQueues(player) {
    if (!player) return;

    const now = performance.now();

    this.data.sort((a, b) => {
      const aKey = this.mapper.voxelKey(a);
      const bKey = this.mapper.voxelKey(b);

      return this.priorityScore(this.virtualBoxel(a), player, this.queueAge(aKey, this.loadQueueTimes, now))
        - this.priorityScore(this.virtualBoxel(b), player, this.queueAge(bKey, this.loadQueueTimes, now));
    });

    this.mesh.sort((a, b) => {
      const aKey = this.boxelKey(a);
      const bKey = this.boxelKey(b);

      return this.priorityScore(a, player, this.queueAge(aKey, this.meshQueueTimes, now))
        - this.priorityScore(b, player, this.queueAge(bKey, this.meshQueueTimes, now));
    });
  }

  applyRenderBudget(renderCandidates = [], player) {
    const prioritized = this.prioritizeRenderCandidates(renderCandidates, player);
    const allowed = new Set(
      (this.renderBudgeter?.selectVisibleChunks(prioritized) ?? prioritized)
        .map(item => item.key)
    );

    prioritized.forEach(item => {
      if (allowed.has(item.key)) {
        this.showMesh(item.mesh, item.key);
      } else {
        this.hideMesh(item.mesh, item.key);
      }
    });
  }

  prioritizeRenderCandidates(renderCandidates = [], player) {
    return [...renderCandidates].sort((a, b) => {
      return this.priorityScore(a.boxel, player) - this.priorityScore(b.boxel, player);
    });
  }

  meshBuildsPerFrame() {
    return this.renderBudgeter?.getLimits().meshBuildsPerFrame ?? this.maxMeshesPerFrame;
  }

  syncRenderBudget() {
    this.mesh.limit = this.meshQueueLimit;
  }

  hasPendingWork() {
    return this.isDirty
      || this.loadQueue.length > 0
      || this.mesh.hasWork()
      || this.pendingMeshJobs.size > 0
      || this.pendingMeshApplies.length > 0
      || this.interactionBudgeter.hasGraceTargets();
  }

  createFrameStats() {
    return {
      meshMs: 0,
      meshJobs: 0,
      meshesBuilt: 0,
      skippedChunks: 0,
      trimmedMeshJobs: 0
    };
  }

  recordHistorySample() {
    const now = performance.now();
    const sample = {
      at: now,
      meshMs: this.frameStats.meshMs,
      meshJobs: this.frameStats.meshJobs,
      meshesBuilt: this.frameStats.meshesBuilt,
      skippedChunks: this.frameStats.skippedChunks,
      loadQueue: this.loadQueue.length,
      meshQueue: this.meshQueue.length,
      oldestLoadAgeMs: this.oldestQueueAge(this.loadQueueTimes, now),
      oldestMeshAgeMs: this.oldestQueueAge(this.meshQueueTimes, now)
    };

    this.history.push(sample);
    this.history = this.history.filter(item => now - item.at <= this.historyWindowMs);

    this.sessionStats.meshMs += sample.meshMs;
    this.sessionStats.meshJobs += sample.meshJobs;
    this.sessionStats.meshesBuilt += sample.meshesBuilt;
    this.sessionStats.skippedChunks += sample.skippedChunks;
    this.sessionStats.peakLoadQueue = Math.max(this.sessionStats.peakLoadQueue, sample.loadQueue);
    this.sessionStats.peakMeshQueue = Math.max(this.sessionStats.peakMeshQueue, sample.meshQueue);
    this.sessionStats.oldestLoadAgeMs = Math.max(this.sessionStats.oldestLoadAgeMs, sample.oldestLoadAgeMs);
    this.sessionStats.oldestMeshAgeMs = Math.max(this.sessionStats.oldestMeshAgeMs, sample.oldestMeshAgeMs);
  }

  profile() {
    const samples = this.history;
    const totals = samples.reduce((total, sample) => ({
      meshMs: total.meshMs + sample.meshMs,
      meshJobs: total.meshJobs + sample.meshJobs,
      meshesBuilt: total.meshesBuilt + sample.meshesBuilt,
      skippedChunks: total.skippedChunks + sample.skippedChunks,
      peakLoadQueue: Math.max(total.peakLoadQueue, sample.loadQueue),
      peakMeshQueue: Math.max(total.peakMeshQueue, sample.meshQueue),
      oldestLoadAgeMs: Math.max(total.oldestLoadAgeMs, sample.oldestLoadAgeMs),
      oldestMeshAgeMs: Math.max(total.oldestMeshAgeMs, sample.oldestMeshAgeMs)
    }), {
      meshMs: 0,
      meshJobs: 0,
      meshesBuilt: 0,
      skippedChunks: 0,
      peakLoadQueue: this.loadQueue.length,
      peakMeshQueue: this.meshQueue.length,
      oldestLoadAgeMs: this.oldestQueueAge(this.loadQueueTimes),
      oldestMeshAgeMs: this.oldestQueueAge(this.meshQueueTimes)
    });

    return {
      chunkHistoryWindowSec: this.historyWindowMs / 1000,
      meshMsLastFrame: this.round(this.frameStats.meshMs),
      meshMsRecentTotal: this.round(totals.meshMs),
      meshMsRecentAvg: this.round(totals.meshJobs ? totals.meshMs / totals.meshJobs : 0),
      meshJobsRecent: totals.meshJobs,
      pendingMeshJobs: this.pendingMeshJobs.size,
      pendingMeshApplies: this.pendingMeshApplies.length,
      maxMeshAppliesPerFrame: this.maxMeshAppliesPerFrame,
      maxWorkerJobs: this.maxWorkerJobs,
      workerIdleSlots: Math.max(0, this.maxWorkerJobs - this.pendingMeshJobs.size),
      workerMeshing: Boolean(this.meshWorker),
      meshesBuiltLastFrame: this.frameStats.meshesBuilt,
      meshesBuiltRecent: totals.meshesBuilt,
      skippedChunksRecent: totals.skippedChunks,
      peakLoadQueueRecent: totals.peakLoadQueue,
      peakMeshQueueRecent: totals.peakMeshQueue,
      meshQueueLimit: this.meshQueueLimit,
      oldestLoadQueueAgeMs: Math.round(totals.oldestLoadAgeMs),
      oldestMeshQueueAgeMs: Math.round(totals.oldestMeshAgeMs),
      meshMsSessionTotal: this.round(this.sessionStats.meshMs),
      meshMsSessionAvg: this.round(this.sessionStats.meshJobs ? this.sessionStats.meshMs / this.sessionStats.meshJobs : 0),
      meshJobsSession: this.sessionStats.meshJobs,
      meshesBuiltSession: this.sessionStats.meshesBuilt,
      skippedChunksSession: this.sessionStats.skippedChunks,
      peakLoadQueueSession: this.sessionStats.peakLoadQueue,
      peakMeshQueueSession: this.sessionStats.peakMeshQueue,
      oldestLoadQueueAgeSessionMs: Math.round(this.sessionStats.oldestLoadAgeMs),
      oldestMeshQueueAgeSessionMs: Math.round(this.sessionStats.oldestMeshAgeMs),
      chunkStates: this.chunkStateCounts(),
      dirtyMeshQueue: this.dirtyMeshKeys.size,
      raycastTargets: this.targets.length,
      raycastGraceTargets: this.hasGraceTargets,
      raycastGraceMs: this.raycastGraceMs,
      meshWorkerPath: this.meshWorkerPath,
      trimmedMeshJobs: this.trimmedMeshJobs,
      priority: {
        renderBudget: this.renderBudgeter?.getLimits() ?? null,
        forward: this.forwardPriority,
        motion: this.motionPriority,
        verticalTrustBoost: this.verticalTrustBoost,
        surface: this.surfacePriority,
        age: this.agePriority,
        maxAgeMs: this.maxPriorityAgeMs,
        motionIntent: this.motionIntent
      },
      lod: {
        enabled: this.isLodActive(),
        modes: this.lodModeCounts()
      },
      sharedMaterial: this.mapper?.mesher?.usesSharedMaterial?.() ?? false
    };
  }

  setChunkState(key, state) {
    this.chunkStates.set(key, state);
  }

  clearChunkState(key, state = null) {
    if (state && this.chunkStates.get(key) !== state) return;

    this.chunkStates.delete(key);
  }

  hasFinishedMeshState(key) {
    if (this.dirtyMeshKeys.has(key)) return false;

    return ["meshReady", "visible", "cached"].includes(this.chunkStates.get(key));
  }

  chunkStateCounts() {
    const counts = {
      queuedData: 0,
      dataReady: 0,
      queuedMesh: 0,
      meshReady: 0,
      visible: 0,
      cached: 0
    };

    this.chunkStates.forEach(state => {
      if (counts[state] === undefined) return;
      counts[state] += 1;
    });

    return counts;
  }

  createSessionStats() {
    return {
      meshMs: 0,
      meshJobs: 0,
      meshesBuilt: 0,
      skippedChunks: 0,
      peakLoadQueue: 0,
      peakMeshQueue: 0,
      oldestLoadAgeMs: 0,
      oldestMeshAgeMs: 0
    };
  }

  oldestQueueAge(times, now = performance.now()) {
    let oldest = 0;

    times.forEach(queuedAt => {
      oldest = Math.max(oldest, now - queuedAt);
    });

    return oldest;
  }

  queueAge(key, times, now = performance.now()) {
    return Math.max(0, now - (times.get(key) ?? now));
  }

  round(value) {
    return Math.round(value * 10) / 10;
  }

  createBoxelMesh(boxel, lodMode = this.lodModeFor(boxel, this.currentPlayer?.position)) {
    const mesh = this.mapper.mesher?.createChunkMesh?.(boxel, { lodMode })
      || this.mapper.createBoxelMesh(boxel);

    return this.mapper.decorateBoxelMesh?.(boxel, mesh) || mesh;
  }

  isLodActive() {
    return Boolean(this.lodEnabled && this.lod?.enabled !== false);
  }

  lodDistanceFromPlayer(boxel, playerPosition = this.currentPlayer?.position) {
    if (!boxel || !playerPosition) return 0;

    const center = this.boxelCenter(boxel);
    const dx = center.x - playerPosition.x;
    const dz = center.z - playerPosition.z;

    return Math.sqrt(dx * dx + dz * dz);
  }

  lodModeFor(boxel, playerPosition = this.currentPlayer?.position) {
    if (!this.isLodActive()) return "full-detail";

    const distance = this.lodDistanceFromPlayer(boxel, playerPosition);

    if (typeof this.lod?.modeForDistance === "function") {
      return this.normalizeLodMode(this.lod.modeForDistance(distance));
    }

    if (typeof this.lod?.boxelPlan === "function") {
      return this.normalizeLodMode(this.lod.boxelPlan(boxel, distance)?.mode);
    }

    return "full-detail";
  }

  normalizeLodMode(mode = "full-detail") {
    if (!this.isLodActive()) return "full-detail";
    if (mode === "minimal-detail") return "minimal-detail";
    if (mode === "medium-detail") return "medium-detail";

    return "full-detail";
  }

  meshMatchesLod(mesh = null, lodMode = "full-detail") {
    return Boolean(
      mesh
      && this.normalizeLodMode(mesh.userData?.lodMode) === this.normalizeLodMode(lodMode)
    );
  }

  hasPendingMeshJob(key) {
    for (const job of this.pendingMeshJobs.values()) {
      if (job.key === key) return true;
    }

    return false;
  }

  lodModeCounts() {
    const counts = {
      "full-detail": 0,
      "medium-detail": 0,
      "minimal-detail": 0
    };

    this.meshes.forEach(mesh => {
      const mode = this.normalizeLodMode(mesh.userData?.lodMode);
      counts[mode] = (counts[mode] || 0) + 1;
    });

    return counts;
  }

  setLodSettings({ enabled = false, fullDistance = 30, mediumDistance = 90 } = {}) {
    const wasActive = this.isLodActive();
    const nextFull = Math.max(0, Number(fullDistance) || 0);
    const nextMedium = Math.max(nextFull, Number(mediumDistance) || nextFull);
    const nextEnabled = Boolean(enabled);

    const distanceChanged = this.lod?.fullDetailDistance !== nextFull
      || this.lod?.mediumDetailDistance !== nextMedium;
    const enabledChanged = this.lodEnabled !== nextEnabled;

    this.lodEnabled = nextEnabled;

    this.lod?.configure?.({
      enabled: nextEnabled,
      fullDetailDistance: nextFull,
      mediumDetailDistance: nextMedium
    });

    const isActive = this.isLodActive();

    if (!enabledChanged && !distanceChanged) return false;

    // Golden rule: LOD OFF must be zero-cost.
    if (!wasActive && !isActive) {
      this.isDirty = true;
      return false;
    }

    this.lodModes.clear();

    this.meshes.forEach((mesh, key) => {
      const boxel = mesh.userData?.boxel;

      if (!boxel) return;

      this.queueMesh(boxel, {
        force: true,
        player: this.currentPlayer
      });

      this.setChunkState(key, this.visible.has(key) ? "visible" : "cached");
    });

    this.isDirty = true;
    return true;
  }

  canRender(boxel, key, playerPosition) {
    return this.render.canRender(boxel, key, playerPosition);
  }

  shouldQueue(boxel, playerPosition) {
    return this.render.shouldQueue(boxel, playerPosition);
  }

  shouldKeepMesh(boxel, playerPosition) {
    return this.render.shouldKeepMesh(boxel, playerPosition);
  }

  isInRange(boxel, playerPosition) {
    return this.render.isInRange(boxel, playerPosition);
  }

  renderDistanceSq(boxel, playerPosition) {
    const center = this.boxelCenter(boxel);
    const dx = center.x - playerPosition.x;
    const dz = center.z - playerPosition.z;

    return dx * dx + dz * dz;
  }

  priorityScore(boxel, player, ageMs = 0) {
    const center = this.boxelCenter(boxel);
    const dx = center.x - player.position.x;
    const dy = center.y - player.position.y;
    const dz = center.z - player.position.z;
    const distanceSq = dx * dx + dy * dy + dz * dz;
    const distance = Math.sqrt(distanceSq);
    const verticalScore = this.surfaceScore(boxel);

    if (distance === 0) return verticalScore;

    const yaw = player.cameraDirection ?? player.rotation?.y ?? 0;
    const camera = {
      x: -Math.sin(yaw),
      y: 0,
      z: -Math.cos(yaw)
    };
    const direction = {
      x: dx / distance,
      y: dy / distance,
      z: dz / distance
    };
    const cameraAlignment = this.dot(direction, camera);
    const motionAlignment = this.dot(direction, this.motionIntent);
    const verticalMotion = Math.abs(this.motionIntent.y);
    const cameraWeight = Math.max(0.2, this.forwardPriority - verticalMotion * this.verticalTrustBoost);
    const motionWeight = this.motionPriority + verticalMotion * this.verticalTrustBoost;
    const intentAlignment = cameraAlignment * cameraWeight + motionAlignment * motionWeight;
    const intentMultiplier = 1 - Math.max(-1, Math.min(1, intentAlignment));
    const surfaceMultiplier = 1 + verticalScore * this.surfacePriority;
    const ageMultiplier = 1 - Math.min(ageMs, this.maxPriorityAgeMs) / this.maxPriorityAgeMs * this.agePriority;

    return distanceSq * intentMultiplier * surfaceMultiplier * ageMultiplier;
  }

  updateMotionIntent(player) {
    if (!this.lastPlayerPosition) {
      this.lastPlayerPosition = player.position.clone();
      return;
    }

    const movement = {
      x: player.position.x - this.lastPlayerPosition.x,
      y: player.position.y - this.lastPlayerPosition.y,
      z: player.position.z - this.lastPlayerPosition.z
    };
    const length = Math.hypot(movement.x, movement.y, movement.z);

    if (length > 0.001) {
      this.motionIntent = {
        x: movement.x / length,
        y: movement.y / length,
        z: movement.z / length
      };
    }

    this.lastPlayerPosition.copy(player.position);
  }

  dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  surfaceScore(boxel) {
    const size = this.mapper.woxel.boxelSize;
    const topOrigin = Math.floor((this.mapper.woxel.land.y - 1) / size) * size;

    return Math.max(0, (topOrigin - boxel.position.y) / size);
  }

  boxelCenter(boxel) {
    const half = (this.mapper.woxel.boxelSize - 1) / 2;

    return this.mapper.toRenderPosition({
      x: boxel.position.x + half,
      y: boxel.position.y + half,
      z: boxel.position.z + half
    });
  }

  virtualBoxel(position) {
    return { position };
  }

  showMesh(mesh, key) {
    if (this.visible.has(key)) return;

    this.scene.add(mesh);
    this.visible.add(key);
    this.setChunkState(key, "visible");
  }

  hideMesh(mesh, key) {
    if (!this.visible.has(key)) return;

    this.scene.remove(mesh);
    this.visible.delete(key);
    this.setChunkState(key, "cached");
  }

  disposeMesh(mesh) {
    mesh.geometry?.dispose?.();
  }

  unloadMesh(mesh, key) {
    const boxel = mesh.userData.boxel;
    this.hideMesh(mesh, key);
    this.removeTarget(mesh);
    this.raycastTargetTimes.delete(key);
    this.disposeMesh(mesh);

    this.meshes.delete(key);
    this.visible.delete(key);
    this.lodModes.delete(key);
    this.chunkStates.delete(key);
    this.culling?.forget(key);

    if (this.mapper.removeTransientBoxel(boxel)) {
      this.mapper.boxelsAround(boxel)
        .filter(item => this.meshes.has(this.boxelKey(item)))
        .forEach(item => {
          this.queueMesh(item, {
            force: true,
            player: this.currentPlayer
          });
        });
    }
  }

  replaceVisibleMesh(current, next, key) {
    if (current === next) {
      if (!this.visible.has(key)) this.scene.add(next);
      this.visible.add(key);
      this.setChunkState(key, "visible");
      return;
    }

    if (current) {
      this.scene.remove(current);
      this.removeTarget(current);
    }

    this.scene.add(next);
    this.visible.add(key);
    this.setChunkState(key, "visible");
  }

  updateRaycastTargets(player) {
    this.interactionBudgeter.configure({
      targets: this.targets,
      mapper: this.mapper,
      culling: this.culling,
      visible: this.visible,
      raycastDistance: this.raycastDistance,
      graceMs: this.raycastGraceMs
    });

    this.interactionBudgeter.updateTargets({
      meshes: this.meshes,
      playerPosition: player?.position
    });

    this.raycastTargetTimes = this.interactionBudgeter.targetTimes;
    this.hasGraceTargets = this.interactionBudgeter.hasGraceTargets();
  }

  canRaycast(boxel, key, playerPosition, mesh = this.meshes.get(key)) {
    return this.interactionBudgeter.canRaycast(boxel, key, playerPosition, mesh);
  }

  isInRaycastRange(boxel, playerPosition) {
    return this.interactionBudgeter.isInRaycastRange(boxel, playerPosition);
  }

  isStableRaycastMesh(mesh = null) {
    return Boolean(
      mesh
      && !mesh.userData?.dirty
      && !mesh.userData?.raycastDisabled
      && mesh.parent
      && mesh.geometry
      && !mesh.geometry.userData?.disposed
    );
  }

  addTarget(mesh) {
    this.interactionBudgeter.addTarget(mesh);
  }

  removeTarget(mesh) {
    this.interactionBudgeter.removeTarget(mesh);
  }

  boxelKey(boxel) {
    return this.mapper.voxelKey(boxel.position);
  }

  positionKey(position) {
    return `${Math.floor(position.x)},${Math.floor(position.z)}`;
  }

  queueKey(position) {
    const voxel = this.mapper.toVoxelPosition(position);
    const origin = this.mapper.boxelOrigin(voxel);

    return `${origin.x},${origin.z}`;
  }
}

export default ChunkVisibility;


