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

    getDistanceLockedGhostVoxel(reference, options = {}) {
        const distance = options.distance ?? this.voxelExtrusion?.distanceLock ?? 1;

        return this.getCameraGhostVoxelAtDistance(distance, reference);
    },

    getCameraGhostVoxelAtDistance(distance = 1, fallback = null) {
        const cameraPosition = this.getCameraPosition();
        const cameraDirection = this.getCameraDirection();

        if (!cameraPosition || !cameraDirection) return fallback;

        const safeDistance = Math.max(1, Number(distance) || 1);
        const aimPoint = {
            x: cameraPosition.x + cameraDirection.x * safeDistance,
            y: cameraPosition.y + cameraDirection.y * safeDistance,
            z: cameraPosition.z + cameraDirection.z * safeDistance,
        };

        return this.clampPositionToWoxel(this.woxel.gameToGrid(aimPoint));
    },

    getFlyModeGhostVoxelDistance(reference = null, fallbackDistance = 6) {
        if (reference) {
            return this.getDistanceFromCameraToGridPosition(reference);
        }

        return Math.max(1, Number(fallbackDistance) || 6);
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