import { Voxel } from "../Voxel.js";
import { VoxelPalette } from "../VoxelPalette.js";

export const voxelColors12 = [
    { id: 1, name: "White", color: "#ededed" },
    { id: 2, name: "Black", color: "#1f1f1f" },
    { id: 3, name: "Gray", color: "#8a8a8a" },
    { id: 8, name: "Red", color: "#b42121" },
    { id: 12, name: "Brown", color: "#583311" },
    { id: 4, name: "Orange", color: "#ff8e1e" },
    { id: 5, name: "Yellow", color: "#ebeb26" },
    { id: 7, name: "Green", color: "#169400" },
    { id: 6, name: "LightBlue", color: "#3ad1ff" },
    { id: 9, name: "Blue", color: "#161de3" },
    { id: 10, name: "Purple", color: "#6b2cff" },
    { id: 11, name: "Pink", color: "#ff7eb6" },
    
];

export const voxelFakeShading12 = Object.freeze({
    // Central fake shading knobs for every KL3 voxel surface path.
    // 1.0 = real voxel color. Lower values only darken that face direction.
    py: 1.0, // top
    px: 0.8, // right
    nx: 0.5, // left
    pz: 0.7, // front
    nz: 0.7, // back
    ny: 0.4, // bottom
});

export const fakeShading12 = voxelFakeShading12;

export function create12ColorsPalette() {
    const palette = new VoxelPalette({ name: "12colors" });

    voxelColors12.forEach((data) => {
        palette.addVoxelData(data, { id: data.id });
    });

    return palette;
}

export const voxelObjects12 = voxelColors12.map((data) => {
    return new Voxel({
        name: data.name,
        color: data.color,
    });
});

export const voxelIds12 = voxelColors12.map((data) => data.id);

export function getVoxel12(name = "") {
    return voxelObjects12.find((voxel) => voxel.name === name) ?? null;
}

export function getVoxel12Id(name = "") {
    return voxelColors12.find((voxel) => voxel.name === name)?.id ?? 0;
}

export function randomVoxel12() {
    const index = Math.floor(Math.random() * voxelObjects12.length);

    return voxelObjects12[index].clone();
}

export function randomVoxelId12(options = {}) {
    const ids = voxelColors12
        .filter((voxel) => voxel.name !== options.excludeName)
        .map((voxel) => voxel.id);

    if (ids.length === 0) return 0;

    return ids[Math.floor(Math.random() * ids.length)];
}

export default voxelObjects12;

