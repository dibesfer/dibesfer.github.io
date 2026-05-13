import * as THREE from "three";

import { Boxel15Mesher } from "../Wabavam/Boxel/Boxel15/Boxel15Mesher.js";
import { Boxel15RenderDistance } from "../Wabavam/Boxel/Boxel15/Boxel15RenderDistance.js";
import { DeferredRemeshing } from "../Wabavam/Boxel/Boxel15/DeferredRemeshing.js";
import { Boxel15MeshStreamer } from "../Wabavam/Boxel/Boxel15/Boxel15MeshStreamer.js";
import { normalizeBoxel15List } from "../Wabavam/Boxel/Boxel15/Boxel15Utils.js";
import { WoxelGenerator } from "../Wabavam/Woxel/WoxelGenerator.js";
import { DEFAULT_WOXEL_TEMPLATE_ID } from "../Wabavam/Woxel/woxelTemplates.js";

export class Mapper {
    constructor(options = {}) {
        this.woxelGenerator = options.woxelGenerator ?? new WoxelGenerator({
            defaultTemplateId: options.defaultWoxelTemplateId ?? DEFAULT_WOXEL_TEMPLATE_ID,
        });

        this.boxel15Mesher = options.boxel15Mesher ?? new Boxel15Mesher();
        this.boxel15RenderDistance = this.createBoxel15RenderDistance(options);
        this.deferredRemeshing = options.deferredRemeshing ?? new DeferredRemeshing({
            mapper: this,
            maxRemeshPerFlush: options.maxDeferredRemeshPerFlush ?? 1,
            maxFlushMs: options.maxDeferredRemeshFlushMs ?? 4,
        });
        this.deferredRemeshing.setMapper(this);

        this.boxel15MeshStreamer = options.boxel15MeshStreamer ?? new Boxel15MeshStreamer({
            mapper: this,
            maxLoadsPerFrame: options.maxBoxel15MeshLoadsPerFrame ?? 2,
            maxUnloadsPerFrame: options.maxBoxel15MeshUnloadsPerFrame ?? 6,
            maxLoadedMeshes: options.maxLoadedBoxel15Meshes ?? 160,
        });
        this.boxel15MeshStreamer.setMapper(this);

        this.meshes = [];
        this.meshesByBoxel = new Map();
        this.boxel15Bounds = [];
        this.boxel15BoundsByBoxel = new Map();

        this.worldObject3D = null;
        this.currentWoxel = null;

        this.wireframeMode = false;
        this.debugBoundsVisible = false;

        this.debugBoundsColor = options.debugBoundsColor ?? 0xcfcfcf;

        // Dynamic voxel edits must prefer geometric truth over baked render shortcuts.
        // FaceBaking remains for fresh/static chunks; dirty remeshes fall back to SurfaceTrinity.
        this.disableFaceBakingOnDirtyRemesh = options.disableFaceBakingOnDirtyRemesh ?? true;
    }

    createBoxel15RenderDistance(options = {}) {
        const controller = options.boxel15RenderDistanceController ?? null;
        if (controller?.setWoxel && controller?.update) return controller;

        const distanceOption = options.boxel15RenderDistance;
        if (distanceOption?.setWoxel && distanceOption?.update) return distanceOption;

        return new Boxel15RenderDistance({
            distance: distanceOption ?? options.renderDistance ?? 60,
            raycastDistance: options.boxel15RaycastDistance ?? distanceOption ?? 60,
            renderBudget: options.boxel15RenderBudget ?? options.renderBudget ?? 48,
        });
    }

    createAWoxel(woxelTemplate = DEFAULT_WOXEL_TEMPLATE_ID) {
        return this.woxelGenerator.create(woxelTemplate);
    }

    createDemoWoxel() {
        return this.woxelGenerator.createDemo();
    }

    createWoxelObject3D(woxel) {
        const group = new THREE.Group();
        group.name = woxel?.name ?? "Woxel";

        this.worldObject3D = group;
        this.currentWoxel = woxel ?? null;
        this.boxel15RenderDistance.setWoxel(this.currentWoxel);
        this.deferredRemeshing.setWoxel(this.currentWoxel);
        this.boxel15MeshStreamer.setWoxel(this.currentWoxel);

        this.meshes = [];
        this.meshesByBoxel.clear();
        this.boxel15Bounds = [];
        this.boxel15BoundsByBoxel.clear();

        const gridOriginInGame = woxel?.getGridOriginAsGamePosition?.() ?? { x: 0, y: 0, z: 0 };
        group.position.set(gridOriginInGame.x, gridOriginInGame.y, gridOriginInGame.z);

        this.setWireframeMode(this.wireframeMode);

        return group;
    }

    createBoxel15Mesh(boxel15, woxel = this.currentWoxel, options = {}) {
        return this.boxel15Mesher.createMesh(boxel15, woxel, options);
    }

    registerBoxel15Mesh(boxel15, mesh) {
        if (!boxel15 || !mesh) return;

        this.meshes.push(mesh);
        this.meshesByBoxel.set(boxel15, mesh);
    }

    unregisterBoxel15Mesh(boxel15) {
        const mesh = this.meshesByBoxel.get(boxel15);
        if (!mesh) return null;

        this.meshesByBoxel.delete(boxel15);
        this.meshes = this.meshes.filter((item) => item !== mesh);

        return mesh;
    }

    ensureBoxel15Mesh(boxel15, woxel = this.currentWoxel) {
        if (!boxel15 || !this.worldObject3D) return null;

        const existingMesh = this.meshesByBoxel.get(boxel15);
        if (existingMesh) return existingMesh;

        const mesh = this.createBoxel15Mesh(boxel15, woxel);
        if (!mesh) return null;

        this.applyWireframeToMesh(mesh, this.wireframeMode);
        mesh.visible = false;
        this.registerBoxel15Mesh(boxel15, mesh);
        this.worldObject3D.add(mesh);
        this.boxel15RenderDistance.applyStoredVisibility?.(
            boxel15,
            mesh,
            this.boxel15BoundsByBoxel.get(boxel15) ?? null
        );

        return mesh;
    }

    destroyBoxel15Mesh(boxel15) {
        const mesh = this.unregisterBoxel15Mesh(boxel15);
        if (!mesh) return null;

        this.worldObject3D?.remove(mesh);
        this.disposeObject3D(mesh);

        return mesh;
    }

    remeshBoxel15Now(boxel15, woxel = this.currentWoxel) {
        if (!boxel15 || !this.worldObject3D) return null;

        const oldMesh = this.unregisterBoxel15Mesh(boxel15);
        if (oldMesh) {
            this.worldObject3D.remove(oldMesh);
            this.disposeObject3D(oldMesh);
        }

        const newMesh = this.createBoxel15Mesh(boxel15, woxel, {
            allowFaceBaking: !this.disableFaceBakingOnDirtyRemesh,
        });
        if (!newMesh) return null;

        this.applyWireframeToMesh(newMesh, this.wireframeMode);
        this.registerBoxel15Mesh(boxel15, newMesh);
        this.worldObject3D.add(newMesh);
        this.applyBoxel15Visibility(boxel15);

        return newMesh;
    }


    disposeObject3D(object = null) {
        if (!object) return;

        object.traverse?.((child) => {
            child.geometry?.dispose?.();

            const material = child.material;
            if (Array.isArray(material)) {
                material.forEach((item) => this.disposeMaterial(item));
            } else {
                this.disposeMaterial(material);
            }
        });
    }

    disposeMaterial(material = null) {
        if (!material) return;

        material.map?.dispose?.();
        material.dispose?.();
    }

    remeshBoxel15(boxel15, woxel = this.currentWoxel) {
        return this.remeshBoxel15s([boxel15], woxel)[0] ?? null;
    }

    remeshBoxel15s(boxel15s = [], woxel = this.currentWoxel) {
        return this.deferredRemeshing.remeshOrDefer(boxel15s, woxel);
    }

    remeshBoxel15sNow(boxel15s = [], woxel = this.currentWoxel) {
        const remeshed = [];

        normalizeBoxel15List(boxel15s).forEach((boxel15) => {
            const mesh = this.remeshBoxel15Now(boxel15, woxel);
            if (mesh) remeshed.push(mesh);
        });

        return remeshed;
    }

    flushDeferredRemeshing(options = {}) {
        return this.deferredRemeshing.flush({
            woxel: this.currentWoxel,
            ...options,
        });
    }

    remeshDirtyResult(result, woxel = this.currentWoxel) {
        const dirtyBoxels = Array.isArray(result?.dirtyBoxels)
            ? result.dirtyBoxels
            : [result?.dirtyBoxel ?? result?.boxel ?? null].filter(Boolean);

        if (dirtyBoxels.length === 0) return [];

        return this.remeshBoxel15s(dirtyBoxels, woxel);
    }

    createBoxel15Bounds(boxel15) {
        const min = new THREE.Vector3(
            boxel15.position.x,
            boxel15.position.y,
            boxel15.position.z
        );

        const max = new THREE.Vector3(
            boxel15.position.x + boxel15.size.x,
            boxel15.position.y + boxel15.size.y,
            boxel15.position.z + boxel15.size.z
        );

        const box = new THREE.Box3(min, max);
        const helper = new THREE.Box3Helper(box, this.debugBoundsColor);

        helper.name = `${boxel15.name} Debug Bounds`;
        helper.visible = false;
        helper.userData.boxel = boxel15;
        helper.userData.debugOnly = true;
        helper.userData.boxel15Visible = true;
        helper.userData.boxel15Raycastable = false;

        return helper;
    }

    registerBoxel15Bounds(boxel15, bounds) {
        if (!boxel15 || !bounds) return;

        this.boxel15Bounds.push(bounds);
        this.boxel15BoundsByBoxel.set(boxel15, bounds);
    }

    ensureBoxel15Bounds(boxel15) {
        if (!boxel15 || !this.worldObject3D) return null;

        const existingBounds = this.boxel15BoundsByBoxel.get(boxel15);
        if (existingBounds) return existingBounds;

        const bounds = this.createBoxel15Bounds(boxel15);
        this.registerBoxel15Bounds(boxel15, bounds);
        this.worldObject3D.add(bounds);
        this.boxel15RenderDistance.applyStoredVisibility?.(
            boxel15,
            this.meshesByBoxel.get(boxel15) ?? null,
            bounds
        );
        this.applyDebugBoundsVisibility();

        return bounds;
    }

    destroyBoxel15Bounds(boxel15) {
        const bounds = this.boxel15BoundsByBoxel.get(boxel15);
        if (!bounds) return null;

        this.boxel15BoundsByBoxel.delete(boxel15);
        this.boxel15Bounds = this.boxel15Bounds.filter((item) => item !== bounds);
        this.worldObject3D?.remove(bounds);
        bounds.geometry?.dispose?.();
        bounds.material?.dispose?.();

        return bounds;
    }

    setBoxel15RenderDistance(distance = 60) {
        this.boxel15RenderDistance.setDistance(distance);
        this.updateBoxel15RenderDistance();
    }

    getBoxel15RenderDistance() {
        return this.boxel15RenderDistance.getDistance();
    }

    setBoxel15RenderBudget(budget = 48) {
        this.boxel15RenderDistance.setRenderBudget?.(budget);
        this.updateBoxel15RenderDistance();
    }

    getBoxel15RenderBudget() {
        return this.boxel15RenderDistance.getRenderBudget?.() ?? Infinity;
    }

    updateBoxel15RenderDistance(observerPosition = null, observerDirection = null) {
        const stats = this.boxel15RenderDistance.update(
            observerPosition,
            this.getBoxel15VisibilityEntries(),
            { direction: observerDirection }
        );

        stats.meshStreaming = this.boxel15MeshStreamer.stream(stats);
        this.applyDebugBoundsVisibility();
        stats.deferredRemeshing = this.flushDeferredRemeshing({
            limit: this.deferredRemeshing.maxRemeshPerFlush,
            maxMs: this.deferredRemeshing.maxFlushMs,
        });

        return stats;
    }

    getBoxel15VisibilityEntries() {
        const entries = [];

        this.currentWoxel?.forEachBoxel?.((boxel15) => {
            entries.push({
                boxel15,
                mesh: this.meshesByBoxel.get(boxel15) ?? null,
                bounds: this.boxel15BoundsByBoxel.get(boxel15) ?? null,
            });
        });

        return entries;
    }

    applyBoxel15Visibility(boxel15) {
        if (!boxel15) return;

        this.boxel15RenderDistance.applyStoredVisibility?.(
            boxel15,
            this.meshesByBoxel.get(boxel15) ?? null,
            this.boxel15BoundsByBoxel.get(boxel15) ?? null
        );

        this.applyDebugBoundsVisibility();
    }

    getRaycastableMeshes() {
        return this.meshes.filter((mesh) => {
            if (!mesh?.visible) return false;

            return mesh.userData?.boxel15Raycastable !== false;
        });
    }

    setWireframeMode(enabled = false) {
        this.wireframeMode = Boolean(enabled);
        this.debugBoundsVisible = this.wireframeMode;

        this.boxel15Mesher.setWireframe(this.wireframeMode);
        this.applyWireframeToExistingMeshes(this.wireframeMode);

        if (this.debugBoundsVisible) {
            this.boxel15MeshStreamer.syncDebugBoundsForLoadedMeshes?.();
        }

        this.applyDebugBoundsVisibility();
    }

    setBoxel15BoundsVisible(enabled = false) {
        this.debugBoundsVisible = Boolean(enabled);
        this.applyDebugBoundsVisibility();
    }

    applyWireframeToExistingMeshes(enabled = false) {
        this.meshes.forEach((mesh) => this.applyWireframeToMesh(mesh, enabled));
    }

    applyWireframeToMesh(mesh, enabled = false) {
        if (!mesh) return;

        mesh.traverse?.((object) => {
            const materials = Array.isArray(object.material) ? object.material : [object.material];

            materials.filter(Boolean).forEach((material) => {
                this.applyDebugMaterialState(object, material, enabled);
            });
        });
    }

    applyDebugMaterialState(mesh, material, enabled = false) {
        const debugEnabled = Boolean(enabled);
        const isFaceBaked = mesh.userData?.faceBaked === true;

        if (!material.userData) material.userData = {};

        if (debugEnabled && !material.userData.beforeWireframeDebug) {
            material.userData.beforeWireframeDebug = {
                map: material.map ?? null,
                color: material.color?.clone?.() ?? null,
                vertexColors: material.vertexColors,
            };
        }

        if (!debugEnabled && material.userData.beforeWireframeDebug) {
            const previous = material.userData.beforeWireframeDebug;

            material.map = previous.map ?? null;
            if (previous.color && material.color?.copy) material.color.copy(previous.color);
            material.vertexColors = previous.vertexColors;
            delete material.userData.beforeWireframeDebug;
        }

        material.wireframe = debugEnabled;

        if (debugEnabled && isFaceBaked) {
            // Keep the baked texture visible in debug.
            // The wireframe now shows the real reduced geometry: big flat rects instead of voxel-per-face spam.
            material.vertexColors = false;
        }

        material.needsUpdate = true;
    }

    applyDebugBoundsVisibility() {
        this.boxel15Bounds.forEach((bounds) => {
            bounds.visible = this.debugBoundsVisible && bounds.userData?.boxel15Visible !== false;
        });
    }

    dispose() {
        this.meshes.forEach((mesh) => {
            mesh.traverse?.((object) => {
                object.geometry?.dispose?.();
            });
        });

        this.boxel15Bounds.forEach((bounds) => {
            bounds.geometry?.dispose?.();
            bounds.material?.dispose?.();
        });

        this.meshes = [];
        this.meshesByBoxel.clear();
        this.boxel15Bounds = [];
        this.boxel15BoundsByBoxel.clear();
        this.worldObject3D = null;
        this.currentWoxel = null;
        this.deferredRemeshing.clear();
        this.boxel15MeshStreamer.setWoxel(null);

        this.boxel15Mesher.dispose();
    }
}

export default Mapper;
