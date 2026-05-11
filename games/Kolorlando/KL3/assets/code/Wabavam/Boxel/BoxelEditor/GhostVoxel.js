export const GhostVoxelMixin = {
    shouldStartVoxelExtrusion() {
        return this.player?.isFlightMode?.() === true;
    },

    createEmptyVoxelExtrusion() {
        return {
            enabled: false,
            mode: "none",
            referenceVoxel: null,
            ghostVoxel: null,
            faceNormal: null,
            distanceLock: 1,
            activeAxes: [],
            kind: "none",
        };
    },

    getDistanceLockedGhostVoxel(reference) {
        const cameraPosition = this.getCameraPosition();
        const cameraDirection = this.getCameraDirection();

        if (!cameraPosition || !cameraDirection) return reference;

        const distance = this.voxelExtrusion.distanceLock;

        const aimPoint = {
            x: cameraPosition.x + cameraDirection.x * distance,
            y: cameraPosition.y + cameraDirection.y * distance,
            z: cameraPosition.z + cameraDirection.z * distance,
        };

        return this.clampPositionToWoxel(this.woxel.gameToGrid(aimPoint));
    },

    getCameraPosition() {
        if (this.player?.getCameraPosition) {
            return this.player.getCameraPosition();
        }

        const camera = this.player?.camera;
        if (!camera?.position) return null;

        return {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
        };
    },

    getCameraDirection() {
        const camera = this.player?.camera;
        if (!camera?.getWorldDirection) return null;

        camera.getWorldDirection(this.cameraDirection);

        return {
            x: this.cameraDirection.x,
            y: this.cameraDirection.y,
            z: this.cameraDirection.z,
        };
    },

    getDistanceFromCameraToGridPosition(gridPosition) {
        const cameraPosition = this.getCameraPosition();
        const gamePosition = this.getVoxelCenterGamePosition(gridPosition);

        if (!cameraPosition || !gamePosition) return 1;

        return Math.max(1, Math.hypot(
            gamePosition.x - cameraPosition.x,
            gamePosition.y - cameraPosition.y,
            gamePosition.z - cameraPosition.z
        ));
    },

    getVoxelCenterGamePosition(gridPosition) {
        const gamePosition = this.woxel?.gridToGame?.(gridPosition);
        if (!gamePosition) return null;

        return {
            x: gamePosition.x + 0.5,
            y: gamePosition.y + 0.5,
            z: gamePosition.z + 0.5,
        };
    },
};

export default GhostVoxelMixin;
