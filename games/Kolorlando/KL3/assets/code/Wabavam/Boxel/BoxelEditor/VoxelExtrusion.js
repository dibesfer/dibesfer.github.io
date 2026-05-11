import { VOXEL_EXTRUSION_CONFIG } from "./BoxelEditorConfig.js";

export const VoxelExtrusionMixin = {
    startVoxelExtrusion(target, position, options = {}) {
        if (!this.woxel || !position) return false;

        const normal = this.roundNormal(target?.faceNormal);
        const axis = this.getAxisFromNormal(normal);
        const mode = options.mode ?? VOXEL_EXTRUSION_CONFIG.modes.green;

        this.voxelExtrusion = {
            enabled: true,
            mode,
            referenceVoxel: this.clonePosition(position),
            ghostVoxel: this.clonePosition(position),
            faceNormal: normal,
            distanceLock: this.getDistanceFromCameraToGridPosition(position),
            activeAxes: axis ? [axis] : [],
            kind: "line",
        };

        this.mode = mode;
        this.startPosition = this.clonePosition(position);
        this.endPosition = this.clonePosition(position);
        this.rebuildArea();

        this.voxelHighlight?.hide?.();
        this.drawPreview();

        return true;
    },

    updateBlueBoxelVoxelExtrusionPreview(target = this.raycast?.getTarget?.()) {
        const referencePosition = this.getBlueBoxelReferencePosition();

        if (!referencePosition || !this.shouldStartVoxelExtrusion()) {
            this.mode = "blueBoxelSelecting";
            this.voxelExtrusion = this.createEmptyVoxelExtrusion();
            this.hideSecondaryBlueBoxel();
            return this.updateBlueBoxelSelectionPreview(target);
        }

        if (!this.isBlueVoxelExtrusionActive()) {
            if (!target?.voxel || !target?.gridPosition || !target?.faceNormal) {
                this.startPosition = this.clonePosition(referencePosition);
                this.endPosition = this.clonePosition(referencePosition);
                this.rebuildArea();
                this.drawPreview();
                this.hideSecondaryBlueBoxel();
                return false;
            }

            this.startVoxelExtrusion(target, referencePosition, {
                mode: VOXEL_EXTRUSION_CONFIG.modes.blue,
            });
        }

        this.updateEndPosition(target);
        this.drawPreview();

        if (this.endPosition) {
            this.showSecondaryBlueBoxel(this.endPosition);
        }

        return true;
    },

    confirmBlueBoxelVoxelExtrusion() {
        if (this.mode !== VOXEL_EXTRUSION_CONFIG.modes.blue) return false;
        if (!this.endPosition) return true;

        const position = this.clonePosition(this.endPosition);
        const wasLocked = this.blueBoxelSelection.locked === true;
        const committedStart = this.clonePosition(this.blueBoxelSelection.committedStart ?? this.startPosition);
        const committedEnd = this.clonePosition(this.blueBoxelSelection.committedEnd ?? this.startPosition);

        this.voxelExtrusion = this.createEmptyVoxelExtrusion();
        this.mode = "blueBoxelSelecting";
        this.blueBoxelSelection.hasStart = true;
        this.blueBoxelSelection.locked = wasLocked;
        this.blueBoxelSelection.committedStart = committedStart;
        this.blueBoxelSelection.committedEnd = committedEnd;
        this.startPosition = wasLocked ? committedEnd : committedStart;
        this.endPosition = wasLocked ? committedEnd : committedStart;

        this.pushBlueBoxelSelectionPosition(position);

        if (this.blueBoxelSelection.locked) {
            this.hideSecondaryBlueBoxel();
        }

        return true;
    },

    updateVoxelExtrusionEndPosition() {
        if (!this.voxelExtrusion.enabled) return null;

        const reference = this.voxelExtrusion.referenceVoxel;
        const rawGhost = this.getDistanceLockedGhostVoxel(reference);
        if (!rawGhost) return reference;

        const delta = this.subtractPositions(rawGhost, reference);
        this.updateActiveAxes(delta);

        const ghost = this.constrainGhostVoxel(reference, rawGhost);
        this.voxelExtrusion.ghostVoxel = ghost;

        return ghost;
    },

    updateActiveAxes(delta) {
        const axes = ["x", "y", "z"];
        const activeAxes = new Set(this.voxelExtrusion.activeAxes);

        axes.forEach((axis) => {
            const distance = Math.abs(delta[axis] ?? 0);

            if (activeAxes.has(axis)) {
                if (activeAxes.size > 1 && distance <= VOXEL_EXTRUSION_CONFIG.axisExitVoxels) {
                    activeAxes.delete(axis);
                }

                return;
            }

            if (distance >= VOXEL_EXTRUSION_CONFIG.axisEnterVoxels) {
                activeAxes.add(axis);
            }
        });

        if (activeAxes.size === 0) {
            const axis = this.getAxisFromNormal(this.voxelExtrusion.faceNormal);
            if (axis) activeAxes.add(axis);
        }

        this.voxelExtrusion.activeAxes = Array.from(activeAxes);
        this.voxelExtrusion.kind = this.getVoxelExtrusionKind();
    },

    constrainGhostVoxel(reference, rawGhost) {
        const activeAxes = new Set(this.voxelExtrusion.activeAxes);

        return this.clampPositionToWoxel({
            x: activeAxes.has("x") ? rawGhost.x : reference.x,
            y: activeAxes.has("y") ? rawGhost.y : reference.y,
            z: activeAxes.has("z") ? rawGhost.z : reference.z,
        });
    },

    getVoxelExtrusionKind() {
        const count = this.voxelExtrusion.activeAxes.length;

        if (count <= 1) return "line";
        if (count === 2) return "wall";

        return "box";
    },
};

export default VoxelExtrusionMixin;
