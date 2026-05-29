import { Compass } from "../Compass.js";

export function isVoxelOrientable(voxel = null) {
    if (!voxel) return false;
    if (typeof voxel.isOrientable === "function") return voxel.isOrientable() === true;

    return voxel.orientable === true;
}

export function hasVoxelOrientation(voxel = null) {
    return Compass.isOriented(voxel?.orientation);
}

export function getPlayerPlacementOrientation(player = null) {
    return Compass.normalize(
        player?.getFacingPlayerOrientation?.()
        ?? Compass.opposite(player?.getDesiredOrientation?.())
        ?? null
    );
}

export function orientVoxelForPlacement(voxel = null, player = null) {
    return orientVoxel(voxel, getPlayerPlacementOrientation(player));
}

export function orientVoxel(voxel = null, orientation = null) {
    if (!voxel) return null;
    if (!isVoxelOrientable(voxel)) return voxel;

    const normalized = Compass.normalize(orientation);
    if (normalized === null) return voxel;

    if (typeof voxel.setOrientation === "function") {
        voxel.setOrientation(normalized);
        return voxel;
    }

    voxel.orientation = normalized;
    return voxel;
}

export function rotateVoxelOrientation(voxel = null, delta = Compass.NORTH) {
    if (!voxel) return null;
    if (!isVoxelOrientable(voxel)) return voxel;

    const baseOrientation = Compass.normalize(voxel.orientation) ?? Compass.NORTH;
    const nextOrientation = Compass.combine(baseOrientation, delta);

    return orientVoxel(voxel, nextOrientation);
}

export default {
    isVoxelOrientable,
    hasVoxelOrientation,
    getPlayerPlacementOrientation,
    orientVoxel,
    orientVoxelForPlacement,
    rotateVoxelOrientation,
};
