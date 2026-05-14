export const RedBoxelMixin = {
    startRedBoxel() {
        if (this.isBlueBoxelMode()) return false;
        if (this.mode === "purpleBoxelSelecting") return false;

        const target = this.raycast?.getTarget?.();
        if (!target?.voxel || !target?.gridPosition) return false;

        return this.start("redBoxelEditing", target.gridPosition);
    },

    commitRedBoxel() {
        if (!this.area) return false;

        const results = [];

        this.area.forEachPosition((position) => {
            const removeResults = this.removeVoxelAtWithPurpleMirror?.(position) ?? [
                this.woxel.removeVoxelAt(position.x, position.y, position.z)
            ];

            removeResults.forEach((result) => {
                if (result.changed) results.push(result);
            });
        });

        return this.finishCommit(results);
    },
};

export default RedBoxelMixin;
