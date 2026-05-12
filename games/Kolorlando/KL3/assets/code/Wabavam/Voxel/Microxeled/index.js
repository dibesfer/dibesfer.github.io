import { VoxelFile } from "../VoxelFile.js";

const ROOT = new URL("./", import.meta.url).href;

export const microxeledVoxelFiles = [
    "StyledBox.voxel",
    "SpaceShip1.voxel",
].map((file) => `${ROOT}${file}`);

export async function loadMicroxeledVoxels() {
    const results = await Promise.allSettled(
        microxeledVoxelFiles.map((path) => VoxelFile.load(path))
    );

    return results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
}

export default microxeledVoxelFiles;
