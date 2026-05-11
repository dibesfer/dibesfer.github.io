import { VOXEL_EXTRUSION_CONFIG } from "./BoxelEditorConfig.js";
import { orientVoxelForPlacement } from "../../Voxel/VoxelOrienting.js";

export const GreenBoxelMixin = {
    startGreenBoxel() {
        if (this.isBlueBoxelMode()) return false;

        const target = this.raycast?.getTarget?.();
        if (!target?.voxel || !target?.gridPosition || !target?.faceNormal) return false;
        if (!this.getSelectedVoxel()) return false;

        const position = this.getPlaceGridPosition(target);
        if (!this.canPreviewGreenAt(position)) return false;

        if (this.shouldStartVoxelExtrusion()) {
            return this.startVoxelExtrusion(target, position, {
                mode: VOXEL_EXTRUSION_CONFIG.modes.green,
            });
        }

        return this.start("greenBoxelEditing", position);
    },

    commitGreenBoxel() {
        if (!this.area) return false;

        const voxel = this.getSelectedVoxel();
        if (!voxel) return false;

        const results = [];

        this.area.forEachPosition((position) => {
            if (!this.canPlaceAt(position)) return;

            const placeVoxel = orientVoxelForPlacement(
                voxel?.clone?.() ?? voxel,
                this.player
            );

            const result = this.woxel.placeVoxelAt(position.x, position.y, position.z, placeVoxel);
            if (result.changed) results.push(result);
        });

        return this.finishCommit(results);
    },
};

export default GreenBoxelMixin;
