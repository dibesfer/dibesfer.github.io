import { Voxel } from "/assets/code/Wabavam/Voxel/Voxel.js";

export const voxelColors12 = [
    { name: "White", color: "#ededed" },
    { name: "Black", color: "#0d0d0d" },
    { name: "Gray", color: "#8a8a8a" },
    { name: "Orange", color: "#ff8e1e" },
    { name: "Yellow", color: "#ebeb26" },
    { name: "LightBlue", color: "#3ad1ff" },
    { name: "Green", color: "#169400" },
    { name: "Red", color: "#b42121" },
    { name: "Blue", color: "#161de3" },
    { name: "Purple", color: "#6b2cff" },
    { name: "Pink", color: "#ff7eb6" },
    { name: "Brown", color: "#583311" },
];

export const voxelObjects12 = voxelColors12.map((data) => {
    return new Voxel({
        name: data.name,
        color: data.color,
    });
});

export function randomVoxel12() {
    const index = Math.floor(Math.random() * voxelObjects12.length);

    return voxelObjects12[index].clone();
}

export default voxelObjects12;
