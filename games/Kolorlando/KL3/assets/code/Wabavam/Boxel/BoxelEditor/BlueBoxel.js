import { Boxel } from "../Boxel.js";
import { BoxelArea } from "./Utils/BoxelArea.js";
import { Compass } from "../../Compass.js";

export const BlueBoxelMixin = {
    toggleBlueBoxel() {
        if (this.isBlueBoxelMode()) {
            this.stopBlueBoxel();
            return false;
        }

        return this.startBlueBoxelSelecting();
    },

    stopBlueBoxel() {
        this.cancel({ forceIdle: true });

        return true;
    },

    startBlueBoxelSelecting() {
        this.mode = "blueBoxelSelecting";
        this.area = null;
        this.startPosition = null;
        this.endPosition = null;
        this.previewOrigin = null;
        this.blueBoxelSelection = this.createEmptyBlueBoxelSelection();
        this.voxelExtrusion = this.createEmptyVoxelExtrusion();

        this.voxelHighlight?.hide?.();
        this.hideSecondaryBlueBoxel();
        this.updateBlueBoxelSelectionPreview();

        return true;
    },

    selectBlueBoxelPosition(options = {}) {
        const target = this.raycast?.getTarget?.();
        const position = this.getBlueBoxelSelectionPosition(target, options);
        if (!position) return true;

        this.pushBlueBoxelSelectionPosition(position);

        return true;
    },

    pushBlueBoxelSelectionPosition(position) {
        const nextPosition = this.clonePosition(position);

        if (!this.blueBoxelSelection.hasStart) {
            this.blueBoxelSelection.hasStart = true;
            this.blueBoxelSelection.locked = false;
            this.blueBoxelSelection.committedStart = this.clonePosition(nextPosition);
            this.blueBoxelSelection.committedEnd = this.clonePosition(nextPosition);
            this.startPosition = this.clonePosition(nextPosition);
            this.endPosition = this.clonePosition(nextPosition);
            this.rebuildArea();
            this.drawPreview();
            return;
        }

        if (!this.blueBoxelSelection.locked) {
            this.blueBoxelSelection.locked = true;
            this.blueBoxelSelection.committedEnd = this.clonePosition(nextPosition);
            this.startPosition = this.clonePosition(this.blueBoxelSelection.committedStart);
            this.endPosition = this.clonePosition(this.blueBoxelSelection.committedEnd);
            this.rebuildArea();
            this.drawPreview();
            return;
        }

        this.blueBoxelSelection.committedStart = this.clonePosition(this.blueBoxelSelection.committedEnd);
        this.blueBoxelSelection.committedEnd = this.clonePosition(nextPosition);
        this.startPosition = this.clonePosition(this.blueBoxelSelection.committedStart);
        this.endPosition = this.clonePosition(this.blueBoxelSelection.committedEnd);
        this.blueBoxelSelection.locked = true;
        this.rebuildArea();
        this.drawPreview();
    },

    getBlueBoxelSelectionPosition(target, options = {}) {
        if (!target?.voxel || !target?.gridPosition) return null;

        if (options.usePlacePosition) {
            if (!target.faceNormal) return null;

            const position = this.getPlaceGridPosition(target);
            if (!this.canPreviewBlueAt(position)) return null;

            return this.clonePosition(position);
        }

        return this.clonePosition(target.gridPosition);
    },

    hasBlueBoxelSelection() {
        return this.blueBoxelSelection.hasStart === true
            && this.blueBoxelSelection.locked === true
            && this.area !== null;
    },

    copyBlueBoxelSelection() {
        if (!this.hasBlueBoxelSelection()) return false;

        const copiedBoxel = this.createBoxelFromArea(this.area);
        if (!copiedBoxel) return false;

        copiedBoxel.orientation = this.getCurrentBlueBoxelOrientation();
        this.blueBoxelClipboard.setBoxel(copiedBoxel);
        this.scheduleClipboardSave();
        this.enterBlueBoxelPreview();

        return true;
    },

    cutBlueBoxelSelection() {
        if (!this.hasBlueBoxelSelection()) return false;

        const copiedBoxel = this.createBoxelFromArea(this.area);
        if (!copiedBoxel) return false;

        copiedBoxel.orientation = this.getCurrentBlueBoxelOrientation();
        this.blueBoxelClipboard.setBoxel(copiedBoxel);
        this.scheduleClipboardSave();

        const results = [];
        this.area.forEachPosition((position) => {
            const result = this.woxel.removeVoxelAt(position.x, position.y, position.z);
            if (result.changed) results.push(result);
        });

        this.finishWorldChanges(results, {
            cancel: false,
            historyType: "bulkQuit",
            historyLabel: "BlueBoxel cut",
        });
        this.enterBlueBoxelPreview();

        return true;
    },

    enterBlueBoxelPreview() {
        if (!this.blueBoxelClipboard.hasBoxel()) return false;

        this.mode = "blueBoxelPreview";
        this.area = null;
        this.startPosition = null;
        this.endPosition = null;
        this.previewOrigin = null;
        this.blueBoxelSelection = this.createEmptyBlueBoxelSelection();
        this.voxelExtrusion = this.createEmptyVoxelExtrusion();

        this.preview.hide();
        this.hideSecondaryBlueBoxel();
        this.updateBlueBoxelClipboardPreview();

        return true;
    },

    pasteBlueBoxelClipboard() {
        const boxel = this.blueBoxelClipboard.getBoxel();
        const origin = this.previewOrigin;
        if (!boxel || !origin) return true;

        const results = [];

        const renderBoxel = this.createOrientedClipboardBoxel(boxel);

        renderBoxel.forEachVoxel((voxel, localX, localY, localZ) => {
            const position = {
                x: origin.x + localX,
                y: origin.y + localY,
                z: origin.z + localZ,
            };

            if (!this.canPlaceAt(position)) return;

            const result = this.woxel.placeVoxelAt(
                position.x,
                position.y,
                position.z,
                voxel?.clone?.() ?? voxel
            );

            if (result.changed) results.push(result);
        });

        this.finishWorldChanges(results, {
            cancel: false,
            historyType: "bulkPlacement",
            historyLabel: "BlueBoxel paste",
        });
        this.startBlueBoxelSelecting();

        return true;
    },

    updateBlueBoxelSelectionPreview(target = this.raycast?.getTarget?.()) {
        this.voxelHighlight?.hide?.();

        if (this.shouldUseBlueBoxelVoxelExtrusion()) {
            return this.updateBlueBoxelVoxelExtrusionPreview(target);
        }

        const candidatePosition = target?.voxel && target?.gridPosition
            ? this.clonePosition(target.gridPosition)
            : null;

        if (!this.blueBoxelSelection.hasStart) {
            if (!candidatePosition) {
                this.preview.hide();
                this.hideSecondaryBlueBoxel();
                return false;
            }

            this.startPosition = candidatePosition;
            this.endPosition = candidatePosition;
            this.rebuildArea();
            this.drawPreview();
            this.hideSecondaryBlueBoxel();
            return true;
        }

        if (!this.blueBoxelSelection.locked) {
            if (!candidatePosition) {
                if (!this.area) this.preview.hide();
                this.hideSecondaryBlueBoxel();
                return false;
            }

            this.startPosition = this.clonePosition(this.blueBoxelSelection.committedStart ?? this.startPosition);
            this.endPosition = candidatePosition;
            this.rebuildArea();
            this.drawPreview();
            this.hideSecondaryBlueBoxel();
            return true;
        }

        this.showCommittedBlueBoxelSelection();

        if (candidatePosition) {
            this.showSecondaryBlueBoxel(candidatePosition);
        } else {
            this.hideSecondaryBlueBoxel();
        }

        return true;
    },

    shouldUseBlueBoxelVoxelExtrusion() {
        if (!this.blueBoxelSelection.hasStart) return false;
        if (this.blueBoxelSelection.locked) return false;

        return this.shouldStartVoxelExtrusion();
    },

    getBlueBoxelReferencePosition() {
        if (!this.blueBoxelSelection.hasStart) return null;

        if (this.blueBoxelSelection.locked) {
            return this.clonePosition(this.blueBoxelSelection.committedEnd ?? this.endPosition);
        }

        return this.clonePosition(this.blueBoxelSelection.committedStart ?? this.startPosition);
    },

    showCommittedBlueBoxelSelection() {
        if (!this.blueBoxelSelection.hasStart || !this.blueBoxelSelection.locked) return false;

        this.startPosition = this.clonePosition(this.blueBoxelSelection.committedStart);
        this.endPosition = this.clonePosition(this.blueBoxelSelection.committedEnd);
        this.rebuildArea();
        this.drawPreview();

        return true;
    },

    updateBlueBoxelClipboardPreview(target = this.raycast?.getTarget?.()) {
        this.voxelHighlight?.hide?.();

        const boxel = this.blueBoxelClipboard.getBoxel();
        if (!boxel) {
            this.preview.hide();
            this.previewOrigin = null;
            return false;
        }

        if (!target?.voxel || !target?.gridPosition) {
            this.preview.hide();
            this.previewOrigin = null;
            return false;
        }

        if (!target.faceNormal) {
            this.preview.hide();
            this.previewOrigin = null;
            return false;
        }

        const position = this.getPlaceGridPosition(target);
        if (!this.canPreviewBlueAt(position)) {
            this.preview.hide();
            this.previewOrigin = null;
            return false;
        }

        this.previewOrigin = this.clonePosition(position);
        this.preview.showBoxel(boxel, this.previewOrigin, {
            color: this.colors.blueBoxelPreview,
            orientationDelta: this.getClipboardOrientationDelta(boxel),
        });

        return true;
    },

    showSecondaryBlueBoxel(position) {
        if (!position) {
            this.hideSecondaryBlueBoxel();
            return false;
        }

        const area = BoxelArea.fromSingle(position)?.clampToWoxel(this.woxel);
        if (!area) {
            this.hideSecondaryBlueBoxel();
            return false;
        }

        this.secondaryBlueBoxelPreview.show(area, {
            color: this.colors.blueBoxelSelecting,
        });

        return true;
    },

    hideSecondaryBlueBoxel() {
        this.secondaryBlueBoxelPreview?.hide?.();
    },

    getCurrentBlueBoxelOrientation() {
        return Compass.normalize(this.player?.getDesiredOrientation?.()) ?? Compass.NORTH;
    },

    getClipboardOrientationDelta(boxel = this.blueBoxelClipboard.getBoxel()) {
        return Compass.delta(
            boxel?.orientation ?? Compass.NORTH,
            this.getCurrentBlueBoxelOrientation()
        );
    },

    createOrientedClipboardBoxel(boxel = this.blueBoxelClipboard.getBoxel()) {
        if (!boxel) return null;

        const delta = this.getClipboardOrientationDelta(boxel);
        return typeof boxel.transformed === "function"
            ? boxel.transformed(delta, { name: `${boxel.name ?? "Boxel"} Oriented` })
            : boxel;
    },

    createBoxelFromArea(area) {
        if (!area || !this.woxel) return null;

        const origin = area.getMin();
        const size = area.getSize();
        const boxel = new Boxel({
            name: "BlueBoxelClipboard",
            size,
            position: origin,
        });

        let voxelCount = 0;

        area.forEachPosition((worldPosition) => {
            const voxel = this.woxel.getVoxelAt(worldPosition.x, worldPosition.y, worldPosition.z);
            if (!voxel?.isActive?.()) return;

            const localPosition = {
                x: worldPosition.x - origin.x,
                y: worldPosition.y - origin.y,
                z: worldPosition.z - origin.z,
            };

            boxel.setVoxel(
                localPosition.x,
                localPosition.y,
                localPosition.z,
                voxel?.clone?.() ?? voxel
            );

            voxelCount++;
        });

        if (voxelCount === 0) return null;

        boxel.origin = origin;
        boxel.voxelCount = voxelCount;

        return boxel;
    },

    createEmptyBlueBoxelSelection() {
        return {
            hasStart: false,
            locked: false,
            committedStart: null,
            committedEnd: null,
        };
    },
};

export default BlueBoxelMixin;
