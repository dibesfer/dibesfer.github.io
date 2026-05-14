import * as THREE from "three";

import { BoxelArea } from "./Utils/BoxelArea.js";
import { VOXEL_EXTRUSION_CONFIG } from "./BoxelEditorConfig.js";

const PURPLE_BOXEL_COLOR = 0x9b35ff;
const PURPLE_BOXEL_LOCKED_OPACITY = 0.12;
const PURPLE_PLANE_OPACITY = 0.22;

export const PurpleBoxelMixin = {
    togglePurpleBoxel() {
        if (this.mode === "purpleBoxelSelecting") {
            this.clearPurpleBoxel();
            return false;
        }

        return this.startPurpleBoxelSelecting();
    },

    startPurpleBoxelSelecting() {
        this.mode = "purpleBoxelSelecting";
        this.area = null;
        this.startPosition = null;
        this.endPosition = null;
        this.previewOrigin = null;
        this.voxelExtrusion = this.createEmptyVoxelExtrusion();
        this.blueBoxelSelection = this.createEmptyBlueBoxelSelection();
        this.purpleBoxel = this.createEmptyPurpleBoxelState();
        this.purpleBoxelDistanceLock = null;

        this.voxelHighlight?.hide?.();
        this.preview.hide();
        this.hideSecondaryBlueBoxel();
        this.purpleBoxelPreview.hide();
        this.hidePurpleMirrorPlanes();
        this.updatePurpleBoxelSelectionPreview();

        return true;
    },

    selectPurpleBoxelPosition(options = {}) {
        const target = this.raycast?.getTarget?.();
        const position = this.getPurpleBoxelSelectionPosition(target, options);
        if (!position) return true;

        this.pushPurpleBoxelSelectionPosition(position);

        return true;
    },

    pushPurpleBoxelSelectionPosition(position) {
        const nextPosition = this.clonePosition(position);

        if (!this.purpleBoxel.hasStart) {
            this.purpleBoxel.hasStart = true;
            this.purpleBoxel.locked = false;
            this.purpleBoxel.mirroring = false;
            this.purpleBoxel.committedStart = this.clonePosition(nextPosition);
            this.purpleBoxel.committedEnd = this.clonePosition(nextPosition);
            this.purpleBoxelDistanceLock = this.getDistanceFromCameraToGridPosition(nextPosition);
            this.startPosition = this.clonePosition(nextPosition);
            this.endPosition = this.clonePosition(nextPosition);
            this.rebuildArea();
            this.drawPurpleSelectionPreview();
            return;
        }

        this.purpleBoxel.hasStart = true;
        this.purpleBoxel.locked = true;
        this.purpleBoxel.mirroring = true;
        this.purpleBoxel.committedEnd = this.clonePosition(nextPosition);
        this.startPosition = this.clonePosition(this.purpleBoxel.committedStart);
        this.endPosition = this.clonePosition(this.purpleBoxel.committedEnd);
        this.rebuildArea();
        this.purpleBoxel.area = this.area;
        this.mode = "idle";
        this.drawPurpleMirrorState();
    },

    getPurpleBoxelSelectionPosition(target, options = {}) {
        if (target?.voxel && target?.gridPosition) {
            if (options.usePlacePosition) {
                if (!target.faceNormal) return null;

                const position = this.getPlaceGridPosition(target);
                if (!this.canPreviewGreenAt(position)) return null;

                this.purpleBoxelDistanceLock = this.getDistanceFromCameraToGridPosition(position);
                return this.clonePosition(position);
            }

            this.purpleBoxelDistanceLock = this.getDistanceFromCameraToGridPosition(target.gridPosition);
            return this.clonePosition(target.gridPosition);
        }

        return this.getPurpleBoxelFlyModeCandidate();
    },

    getPurpleBoxelPreviewCandidatePosition(target = this.raycast?.getTarget?.()) {
        if (target?.voxel && target?.gridPosition) {
            this.purpleBoxelDistanceLock = this.getDistanceFromCameraToGridPosition(target.gridPosition);
            return this.clonePosition(target.gridPosition);
        }

        return this.getPurpleBoxelFlyModeCandidate();
    },

    getPurpleBoxelFlyModeCandidate() {
        if (!this.purpleBoxel?.hasStart) return null;
        if (this.purpleBoxel?.locked) return null;
        if (!this.shouldStartVoxelExtrusion()) return null;

        const reference = this.purpleBoxel.committedStart ?? this.startPosition;
        const distance = this.getFlyModeGhostVoxelDistance(
            this.endPosition ?? reference,
            this.purpleBoxelDistanceLock ?? this.raycast?.range * 0.5 ?? 6
        );
        this.purpleBoxelDistanceLock = distance;

        const position = this.getCameraGhostVoxelAtDistance(distance, this.endPosition ?? reference);
        if (!this.canPreviewGreenAt(position)) return null;

        return this.clonePosition(position);
    },

    updatePurpleBoxelSelectionPreview(target = this.raycast?.getTarget?.()) {
        this.voxelHighlight?.hide?.();
        this.preview.hide();
        this.hideSecondaryBlueBoxel();

        if (this.shouldUsePurpleBoxelVoxelExtrusion()) {
            return this.updatePurpleBoxelVoxelExtrusionPreview(target);
        }

        const candidatePosition = this.getPurpleBoxelPreviewCandidatePosition(target);

        if (!this.purpleBoxel.hasStart) {
            if (!candidatePosition) {
                this.purpleBoxelPreview.hide();
                this.hidePurpleMirrorPlanes();
                return false;
            }

            this.startPosition = candidatePosition;
            this.endPosition = candidatePosition;
            this.rebuildArea();
            this.drawPurpleSelectionPreview();
            this.hidePurpleMirrorPlanes();
            return true;
        }

        if (!candidatePosition) {
            this.drawPurpleSelectionPreview();
            this.hidePurpleMirrorPlanes();
            return false;
        }

        this.startPosition = this.clonePosition(this.purpleBoxel.committedStart ?? this.startPosition);
        this.endPosition = candidatePosition;
        this.rebuildArea();
        this.drawPurpleSelectionPreview();
        this.hidePurpleMirrorPlanes();

        return true;
    },

    shouldUsePurpleBoxelVoxelExtrusion() {
        if (!this.purpleBoxel?.hasStart) return false;
        if (this.purpleBoxel?.locked) return false;

        return this.shouldStartVoxelExtrusion();
    },

    getPurpleBoxelReferencePosition() {
        if (!this.purpleBoxel?.hasStart) return null;

        if (this.purpleBoxel.locked) {
            return this.clonePosition(this.purpleBoxel.committedEnd ?? this.endPosition);
        }

        return this.clonePosition(this.purpleBoxel.committedStart ?? this.startPosition);
    },

    isPurpleVoxelExtrusionActive() {
        return this.mode === VOXEL_EXTRUSION_CONFIG.modes.purple
            && this.voxelExtrusion.mode === VOXEL_EXTRUSION_CONFIG.modes.purple
            && this.voxelExtrusion.enabled === true;
    },

    updatePurpleBoxelVoxelExtrusionPreview(target = this.raycast?.getTarget?.()) {
        const referencePosition = this.getPurpleBoxelReferencePosition();

        if (!referencePosition || !this.shouldStartVoxelExtrusion()) {
            this.mode = "purpleBoxelSelecting";
            this.voxelExtrusion = this.createEmptyVoxelExtrusion();
            return this.updatePurpleBoxelSelectionPreview(target);
        }

        if (!this.isPurpleVoxelExtrusionActive()) {
            this.startVoxelExtrusion(target ?? {}, referencePosition, {
                mode: VOXEL_EXTRUSION_CONFIG.modes.purple,
            });
        }

        this.updateEndPosition(target);
        this.preview.hide();
        this.drawPurpleSelectionPreview();
        this.hidePurpleMirrorPlanes();

        return true;
    },

    confirmPurpleBoxelVoxelExtrusion() {
        if (this.mode !== VOXEL_EXTRUSION_CONFIG.modes.purple) return false;
        if (!this.endPosition) return true;

        const position = this.clonePosition(this.endPosition);
        const committedStart = this.clonePosition(this.purpleBoxel.committedStart ?? this.startPosition);
        const committedEnd = this.clonePosition(this.purpleBoxel.committedEnd ?? this.startPosition);

        this.voxelExtrusion = this.createEmptyVoxelExtrusion();
        this.mode = "purpleBoxelSelecting";
        this.purpleBoxel.hasStart = true;
        this.purpleBoxel.locked = false;
        this.purpleBoxel.mirroring = false;
        this.purpleBoxel.committedStart = committedStart;
        this.purpleBoxel.committedEnd = committedEnd;
        this.startPosition = committedStart;
        this.endPosition = committedEnd;

        this.pushPurpleBoxelSelectionPosition(position);

        return true;
    },

    drawPurpleSelectionPreview() {
        if (!this.area) return false;

        this.purpleBoxelPreview.show(this.area, {
            color: this.colors.purpleBoxelSelecting,
            opacity: this.highlighting?.opacity ?? 0.4,
        });

        return true;
    },

    drawPurpleMirrorState() {
        if (!this.purpleBoxel?.area) return false;

        this.purpleBoxelPreview.show(this.purpleBoxel.area, {
            color: this.colors.purpleBoxelMirroring,
            opacity: PURPLE_BOXEL_LOCKED_OPACITY,
        });
        this.showPurpleMirrorPlanes(this.purpleBoxel.area);

        return true;
    },

    isPurpleBoxelMirroring() {
        return this.purpleBoxel?.mirroring === true
            && this.purpleBoxel?.locked === true
            && this.purpleBoxel?.area !== null;
    },

    clearPurpleBoxel() {
        this.purpleBoxel = this.createEmptyPurpleBoxelState();
        this.purpleBoxelDistanceLock = null;
        this.purpleBoxelPreview?.hide?.();
        this.hidePurpleMirrorPlanes();

        if (this.mode === "purpleBoxelSelecting") {
            this.mode = "idle";
            this.area = null;
            this.startPosition = null;
            this.endPosition = null;
        }

        return true;
    },

    createEmptyPurpleBoxelState() {
        return {
            hasStart: false,
            locked: false,
            mirroring: false,
            committedStart: null,
            committedEnd: null,
            area: null,
        };
    },

    ensurePurpleMirrorPlanes() {
        if (this.purpleMirrorPlanes) return this.purpleMirrorPlanes;

        const createPlane = (name, color) => {
            const mesh = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity: PURPLE_PLANE_OPACITY,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                })
            );

            mesh.name = name;
            mesh.visible = false;
            mesh.userData.debugOnly = true;
            mesh.userData.highlightOnly = true;

            this.purpleMirrorPlaneGroup.add(mesh);

            return mesh;
        };

        this.purpleMirrorPlanes = {
            x: createPlane("PurpleMirrorPlaneX", this.highlighting?.colors?.axisX ?? 0xff3333),
            y: createPlane("PurpleMirrorPlaneY", this.highlighting?.colors?.axisY ?? 0x33ff66),
            z: createPlane("PurpleMirrorPlaneZ", this.highlighting?.colors?.axisZ ?? 0x3388ff),
        };

        return this.purpleMirrorPlanes;
    },

    showPurpleMirrorPlanes(area = this.purpleBoxel?.area) {
        if (!this.woxel || !area) return false;

        const planes = this.ensurePurpleMirrorPlanes();
        const min = area.getMin();
        const size = area.getSize();
        const center = this.getPurpleMirrorCenter(area);
        const gameCenter = {
            x: center.x - this.woxel.size.x / 2,
            y: center.y,
            z: center.z - this.woxel.size.z / 2,
        };
        const areaCenter = this.getPurpleAreaGameCenter(area);

        planes.x.geometry.dispose();
        planes.x.geometry = new THREE.PlaneGeometry(Math.max(0.01, size.z), Math.max(0.01, size.y));
        planes.x.rotation.set(0, Math.PI * 0.5, 0);
        planes.x.position.set(gameCenter.x, areaCenter.y, areaCenter.z);
        planes.x.visible = true;

        planes.y.geometry.dispose();
        planes.y.geometry = new THREE.PlaneGeometry(Math.max(0.01, size.x), Math.max(0.01, size.z));
        planes.y.rotation.set(-Math.PI * 0.5, 0, 0);
        planes.y.position.set(areaCenter.x, gameCenter.y, areaCenter.z);
        planes.y.visible = true;

        planes.z.geometry.dispose();
        planes.z.geometry = new THREE.PlaneGeometry(Math.max(0.01, size.x), Math.max(0.01, size.y));
        planes.z.rotation.set(0, 0, 0);
        planes.z.position.set(areaCenter.x, areaCenter.y, gameCenter.z);
        planes.z.visible = true;

        this.purpleMirrorPlaneGroup.visible = true;

        return true;
    },

    hidePurpleMirrorPlanes() {
        this.purpleMirrorPlaneGroup.visible = false;

        Object.values(this.purpleMirrorPlanes ?? {}).forEach((plane) => {
            plane.visible = false;
        });
    },

    getPurpleAreaGameCenter(area = this.purpleBoxel?.area) {
        const min = area.getMin();
        const size = area.getSize();
        const gameMin = this.woxel.gridToGame(min);

        return {
            x: gameMin.x + size.x / 2,
            y: gameMin.y + size.y / 2,
            z: gameMin.z + size.z / 2,
        };
    },

    getPurpleMirrorCenter(area = this.purpleBoxel?.area) {
        const min = area.getMin();
        const max = area.getMax();

        return {
            x: (min.x + max.x + 1) / 2,
            y: (min.y + max.y + 1) / 2,
            z: (min.z + max.z + 1) / 2,
        };
    },

    getPurpleMirroredPositions(position = {}) {
        const area = this.purpleBoxel?.area;
        if (!this.isPurpleBoxelMirroring() || !area?.contains?.(position)) {
            return [this.clonePosition(position)];
        }

        const min = area.getMin();
        const max = area.getMax();
        const x2 = min.x + max.x - position.x;
        const y2 = min.y + max.y - position.y;
        const z2 = min.z + max.z - position.z;
        const candidates = [
            { x: position.x, y: position.y, z: position.z },
            { x: x2, y: position.y, z: position.z },
            { x: position.x, y: y2, z: position.z },
            { x: position.x, y: position.y, z: z2 },
            { x: x2, y: y2, z: position.z },
            { x: x2, y: position.y, z: z2 },
            { x: position.x, y: y2, z: z2 },
            { x: x2, y: y2, z: z2 },
        ];
        const unique = [];
        const seen = new Set();

        candidates.forEach((candidate) => {
            if (!this.woxel?.isInside?.(candidate.x, candidate.y, candidate.z)) return;

            const key = `${candidate.x},${candidate.y},${candidate.z}`;
            if (seen.has(key)) return;

            seen.add(key);
            unique.push(this.clonePosition(candidate));
        });

        return unique;
    },

    placeVoxelAtWithPurpleMirror(position = {}, voxel = null) {
        const results = [];

        this.getPurpleMirroredPositions(position).forEach((targetPosition) => {
            if (!this.canPlaceAt(targetPosition)) return;

            const result = this.woxel.placeVoxelAt(
                targetPosition.x,
                targetPosition.y,
                targetPosition.z,
                voxel?.clone?.() ?? voxel
            );

            if (result.changed) results.push(result);
        });

        return results;
    },

    removeVoxelAtWithPurpleMirror(position = {}) {
        const results = [];

        this.getPurpleMirroredPositions(position).forEach((targetPosition) => {
            const result = this.woxel.removeVoxelAt(
                targetPosition.x,
                targetPosition.y,
                targetPosition.z
            );

            if (result.changed) results.push(result);
        });

        return results;
    },
};

export default PurpleBoxelMixin;