import { Group, Vector3 } from "three";

import { BoxelArea } from "./Utils/BoxelArea.js";
import { BoxelClipboard } from "./Utils/BoxelClipboard.js";
import { BoxelPreview } from "./Utils/BoxelPreview.js";
import { Highlighting } from "../../Highlighting.js";

import { VOXEL_EXTRUSION_CONFIG } from "./BoxelEditorConfig.js";
import { RedBoxelMixin } from "./RedBoxel.js";
import { GreenBoxelMixin } from "./GreenBoxel.js";
import { BlueBoxelMixin } from "./BlueBoxel.js";
import { GhostVoxelMixin } from "./GhostVoxel.js";
import { VoxelExtrusionMixin } from "./VoxelExtrusion.js";

export class BoxelEditor {
    constructor(options = {}) {
        this.woxel = options.woxel ?? null;
        this.mapper = options.mapper ?? null;
        this.raycast = options.raycast ?? null;
        this.player = options.player ?? null;
        this.voxelHighlight = options.voxelHighlight ?? null;
        this.highlighting = options.highlighting ?? new Highlighting(options.highlightingOptions ?? {});
        this.getSelectedVoxel = options.getSelectedVoxel ?? (() => null);
        this.isInsidePlayerBody = options.isInsidePlayerBody ?? (() => false);
        this.scheduleAutosave = options.scheduleAutosave ?? (() => {});
        this.scheduleClipboardSave = options.scheduleClipboardSave ?? (() => {});
        this.onBlueBoxelSaved = options.onBlueBoxelSaved ?? (() => {});
        this.history = options.history ?? null;

        this.colors = {
            redBoxelEditing: options.colors?.red ?? this.highlighting.colors.redBoxel,
            greenBoxelEditing: options.colors?.green ?? this.highlighting.colors.greenBoxel,
            greenVoxelExtrusion: options.colors?.green ?? this.highlighting.colors.greenBoxel,
            blueBoxelSelecting: options.colors?.blue ?? this.highlighting.colors.blueBoxel,
            blueVoxelExtrusion: options.colors?.blue ?? this.highlighting.colors.blueBoxel,
            blueBoxelPreview: options.colors?.blue ?? this.highlighting.colors.blueBoxel,
        };

        this.mode = "idle";
        this.area = null;
        this.startPosition = null;
        this.endPosition = null;
        this.previewOrigin = null;

        this.voxelExtrusion = this.createEmptyVoxelExtrusion();
        this.blueBoxelSelection = this.createEmptyBlueBoxelSelection();
        this.blueBoxelClipboard = options.blueBoxelClipboard ?? new BoxelClipboard({
            name: "blueBoxelClipboard",
        });

        this.cameraDirection = new Vector3();

        this.group = new Group();
        this.group.name = "BoxelEditor";
        this.group.userData.debugOnly = true;
        this.group.userData.highlightOnly = true;

        const boxelStyle = this.highlighting.getBoxelOptions("blueBoxel");

        this.preview = options.preview ?? new BoxelPreview({
            woxel: this.woxel,
            scale: boxelStyle.scale,
            opacity: boxelStyle.opacity,
            depthWrite: boxelStyle.depthWrite,
        });

        this.secondaryBlueBoxelPreview = options.secondaryBlueBoxelPreview ?? new BoxelPreview({
            woxel: this.woxel,
            scale: boxelStyle.scale,
            opacity: options.secondaryBlueBoxelOpacity ?? 0.5,
            depthWrite: boxelStyle.depthWrite,
        });

        this.group.add(this.preview.getObject3D());
        this.group.add(this.secondaryBlueBoxelPreview.getObject3D());
    }

    setWoxel(woxel) {
        this.cancel({ forceIdle: true });
        this.woxel = woxel ?? null;
        this.preview.setWoxel(this.woxel);
        this.secondaryBlueBoxelPreview.setWoxel(this.woxel);
    }

    setPlayer(player) {
        this.player = player ?? null;
    }

    setHistory(history) {
        this.history = history ?? null;
    }

    start(mode, position) {
        if (!this.woxel || !position) return false;

        this.mode = mode;
        this.startPosition = this.clonePosition(position);
        this.endPosition = this.clonePosition(position);
        this.rebuildArea();

        this.voxelHighlight?.hide?.();
        this.drawPreview();

        return true;
    }

    update(target = this.raycast?.getTarget?.()) {
        if (!this.isActive()) return;

        if (this.mode === "blueBoxelSelecting") {
            this.updateBlueBoxelSelectionPreview(target);
            return;
        }

        if (this.mode === VOXEL_EXTRUSION_CONFIG.modes.blue) {
            this.updateBlueBoxelVoxelExtrusionPreview(target);
            return;
        }

        if (this.mode === "blueBoxelPreview") {
            this.updateBlueBoxelClipboardPreview(target);
            return;
        }

        this.updateEndPosition(target);
        this.voxelHighlight?.hide?.();
        this.drawPreview();
    }

    updateEndPosition(target) {
        const position = this.getTargetEditPosition(target);
        if (!position) return false;

        this.endPosition = this.clonePosition(position);
        this.rebuildArea();

        return true;
    }

    getTargetEditPosition(target) {
        if (this.isVoxelExtrusionActive()) {
            return this.updateVoxelExtrusionEndPosition();
        }

        if (this.mode === "redBoxelEditing") {
            if (!target?.voxel || !target?.gridPosition) return null;

            return target.gridPosition;
        }

        if (this.mode === "greenBoxelEditing") {
            if (!target?.voxel || !target?.gridPosition || !target?.faceNormal) return null;
            if (!this.getSelectedVoxel()) return null;

            const position = this.getPlaceGridPosition(target);
            if (!this.canPreviewGreenAt(position)) return null;

            return position;
        }

        return null;
    }

    handlePrimaryAction() {
        if (this.mode === VOXEL_EXTRUSION_CONFIG.modes.blue) {
            return this.confirmBlueBoxelVoxelExtrusion();
        }

        if (this.mode !== "blueBoxelSelecting") return false;

        return this.selectBlueBoxelPosition({ usePlacePosition: false });
    }

    handleSecondaryAction() {
        if (this.mode === "blueBoxelPreview") {
            return this.pasteBlueBoxelClipboard();
        }

        if (this.mode === VOXEL_EXTRUSION_CONFIG.modes.blue) {
            return this.confirmBlueBoxelVoxelExtrusion();
        }

        if (this.mode === "blueBoxelSelecting") {
            return this.selectBlueBoxelPosition({ usePlacePosition: true });
        }

        return false;
    }

    rebuildArea() {
        this.area = BoxelArea.fromPositions(this.startPosition, this.endPosition)
            ?.clampToWoxel(this.woxel) ?? null;
    }

    drawPreview() {
        if (!this.area) return;

        this.preview.show(this.area, {
            color: this.getModeColor(),
        });
    }

    commit() {
        if (this.mode === "redBoxelEditing") return this.commitRedBoxel();
        if (this.mode === "greenBoxelEditing") return this.commitGreenBoxel();
        if (this.mode === VOXEL_EXTRUSION_CONFIG.modes.green) return this.commitGreenBoxel();

        return false;
    }

    finishCommit(results = []) {
        return this.finishWorldChanges(results, {
            cancel: true,
            historyType: this.getCommitHistoryType(),
            historyLabel: this.getCommitHistoryLabel(),
        });
    }

    finishWorldChanges(results = [], options = {}) {
        const dirtyBoxels = this.collectDirtyBoxels(results);

        if (dirtyBoxels.length > 0) {
            this.history?.pushResults?.(results, {
                type: options.historyType ?? "bulkChange",
                label: options.historyLabel ?? "Boxel edit",
            });
            this.mapper?.remeshBoxel15s?.(dirtyBoxels, this.woxel);
            this.raycast?.forceNextCast?.({ preserveTargetOnMiss: true });
            this.scheduleAutosave();
        }

        if (options.cancel !== false) {
            this.cancel();
        }

        return dirtyBoxels.length > 0;
    }

    getCommitHistoryType() {
        if (this.mode === "redBoxelEditing") return "bulkQuit";
        if (this.mode === "greenBoxelEditing") return "bulkPlacement";
        if (this.mode === VOXEL_EXTRUSION_CONFIG.modes.green) return "bulkPlacement";

        return "bulkChange";
    }

    getCommitHistoryLabel() {
        if (this.mode === "redBoxelEditing") return "RedBoxel quit";
        if (this.mode === "greenBoxelEditing") return "GreenBoxel place";
        if (this.mode === VOXEL_EXTRUSION_CONFIG.modes.green) return `GreenBoxel ${this.voxelExtrusion.kind}`;

        return "Boxel edit";
    }

    collectDirtyBoxels(results = []) {
        const dirtyBoxels = [];
        const seen = new Set();

        results.forEach((result) => {
            const resultBoxels = Array.isArray(result?.dirtyBoxels)
                ? result.dirtyBoxels
                : [result?.dirtyBoxel].filter(Boolean);

            resultBoxels.forEach((boxel) => {
                const key = `${boxel.position.x},${boxel.position.y},${boxel.position.z}`;
                if (seen.has(key)) return;

                seen.add(key);
                dirtyBoxels.push(boxel);
            });
        });

        return dirtyBoxels;
    }

    cancel(options = {}) {
        if (this.isBlueBoxelMode() && options.forceIdle !== true) {
            this.resetBlueBoxelOperation();
            return;
        }

        this.mode = "idle";
        this.area = null;
        this.startPosition = null;
        this.endPosition = null;
        this.previewOrigin = null;
        this.voxelExtrusion = this.createEmptyVoxelExtrusion();
        this.blueBoxelSelection = this.createEmptyBlueBoxelSelection();
        this.preview.hide();
        this.hideSecondaryBlueBoxel();
    }

    resetBlueBoxelOperation() {
        this.mode = "blueBoxelSelecting";
        this.area = null;
        this.startPosition = null;
        this.endPosition = null;
        this.previewOrigin = null;
        this.voxelExtrusion = this.createEmptyVoxelExtrusion();
        this.blueBoxelSelection = this.createEmptyBlueBoxelSelection();
        this.preview.hide();
        this.hideSecondaryBlueBoxel();
        this.updateBlueBoxelSelectionPreview();
    }

    canPreviewGreenAt(position) {
        if (!position) return false;
        if (!this.woxel?.isInside?.(position.x, position.y, position.z)) return false;

        return true;
    }

    canPreviewBlueAt(position) {
        return this.canPreviewGreenAt(position);
    }

    canPlaceAt(position) {
        if (!this.canPreviewGreenAt(position)) return false;
        if (this.woxel.getVoxelAt(position.x, position.y, position.z)) return false;
        if (this.isInsidePlayerBody(position)) return false;

        return true;
    }

    getPlaceGridPosition(target) {
        const normal = target.faceNormal;

        return {
            x: target.gridPosition.x + Math.round(normal.x),
            y: target.gridPosition.y + Math.round(normal.y),
            z: target.gridPosition.z + Math.round(normal.z),
        };
    }

    roundNormal(normal = {}) {
        return {
            x: Math.round(normal.x ?? 0),
            y: Math.round(normal.y ?? 0),
            z: Math.round(normal.z ?? 0),
        };
    }

    getAxisFromNormal(normal = {}) {
        const axes = ["x", "y", "z"];

        return axes.find((axis) => Math.abs(normal[axis] ?? 0) === 1) ?? null;
    }

    subtractPositions(a = {}, b = {}) {
        return {
            x: (a.x ?? 0) - (b.x ?? 0),
            y: (a.y ?? 0) - (b.y ?? 0),
            z: (a.z ?? 0) - (b.z ?? 0),
        };
    }

    clampPositionToWoxel(position = {}) {
        if (!this.woxel?.size) return this.clonePosition(position);

        return {
            x: this.clamp(Math.floor(position.x ?? 0), 0, this.woxel.size.x - 1),
            y: this.clamp(Math.floor(position.y ?? 0), 0, this.woxel.size.y - 1),
            z: this.clamp(Math.floor(position.z ?? 0), 0, this.woxel.size.z - 1),
        };
    }

    getModeColor() {
        return this.colors[this.mode] ?? this.colors.blueBoxelSelecting;
    }

    isActive() {
        return this.mode !== "idle";
    }

    isBlueBoxelMode() {
        return this.mode === "blueBoxelSelecting"
            || this.mode === VOXEL_EXTRUSION_CONFIG.modes.blue
            || this.mode === "blueBoxelPreview";
    }

    isVoxelExtrusionActive() {
        return this.mode === VOXEL_EXTRUSION_CONFIG.modes.green
            || this.mode === VOXEL_EXTRUSION_CONFIG.modes.blue;
    }

    isBlueVoxelExtrusionActive() {
        return this.mode === VOXEL_EXTRUSION_CONFIG.modes.blue
            && this.voxelExtrusion.mode === VOXEL_EXTRUSION_CONFIG.modes.blue
            && this.voxelExtrusion.enabled === true;
    }

    clonePosition(position = {}) {
        return {
            x: Math.floor(position.x ?? 0),
            y: Math.floor(position.y ?? 0),
            z: Math.floor(position.z ?? 0),
        };
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    getObject3D() {
        return this.group;
    }

    getVoxelExtrusionState() {
        return {
            ...this.voxelExtrusion,
            activeAxes: [...this.voxelExtrusion.activeAxes],
        };
    }

    getBlueBoxelState() {
        return {
            mode: this.mode,
            area: this.area,
            previewOrigin: this.previewOrigin,
            hasClipboard: this.blueBoxelClipboard.hasBoxel(),
            clipboardBoxel: this.blueBoxelClipboard.getBoxel(),
        };
    }


    saveBlueBoxelAsAsset(boxel = null) {
        if (!boxel) return false;

        this.onBlueBoxelSaved(boxel);

        return true;
    }

    getBlueBoxelClipboardMemoryData() {
        return this.blueBoxelClipboard?.toMemoryData?.() ?? null;
    }

    setBlueBoxelClipboardMemoryData(data = null) {
        if (!this.blueBoxelClipboard?.loadMemoryData) return false;

        const loaded = this.blueBoxelClipboard.loadMemoryData(data);

        this.mode = "idle";
        this.area = null;
        this.startPosition = null;
        this.endPosition = null;
        this.previewOrigin = null;
        this.voxelExtrusion = this.createEmptyVoxelExtrusion();
        this.blueBoxelSelection = this.createEmptyBlueBoxelSelection();
        this.preview.hide();
        this.hideSecondaryBlueBoxel();

        return loaded;
    }

    dispose() {
        this.preview.dispose();
        this.secondaryBlueBoxelPreview.dispose();
    }
}

Object.assign(
    BoxelEditor.prototype,
    RedBoxelMixin,
    GreenBoxelMixin,
    BlueBoxelMixin,
    GhostVoxelMixin,
    VoxelExtrusionMixin
);

export default BoxelEditor;

