import {
    getVoxel12,
    getVoxel12Id,
    randomVoxel12,
    randomVoxelId12,
    voxelObjects12,
} from "../Voxel/12colors/12colors.js";

export const WOXEL_TEMPLATE_IDS = {
    grass: "grass",
    grassWithFlowers: "grassWithFlowers",
    randomLand: "randomLand",
    randomAll: "randomAll",
};

export const DEFAULT_WOXEL_TEMPLATE_ID = WOXEL_TEMPLATE_IDS.grassWithFlowers;

export const grassVoxelName = "Green";
export const grassVoxelId = getVoxel12Id(grassVoxelName);
export const grassVoxel = getVoxel12(grassVoxelName);
export const flowerVoxelNames = voxelObjects12
    .filter((voxel) => voxel.name !== grassVoxelName)
    .map((voxel) => voxel.name);
export const flowerVoxels = voxelObjects12.filter((voxel) => voxel.name !== grassVoxelName);

export const woxelTemplates = [
    {
        id: WOXEL_TEMPLATE_IDS.grass,
        name: "Grass",
        size: { x: 45, y: 45, z: 45 },
        land: { x: 45, y: 7, z: 45 },
        respectLand: true,
        fillMode: "grassLand",
        palettePreset: "12colors",
        grassVoxelName,
        grassVoxelId,
        grassVoxel,
    },
    {
        id: WOXEL_TEMPLATE_IDS.grassWithFlowers,
        name: "Grass with flowers",
        size: { x: 1000, y: 45, z: 1000 },
        land: { x: 1000, y: 7, z: 1000 },
        respectLand: true,
        fillMode: "grassWithFlowers",
        palettePreset: "12colors",
        grassVoxelName,
        grassVoxelId,
        grassVoxel,
        flowerVoxelNames,
        flowers: flowerVoxels,
        flowerChance: 0.035,
    },
    {
        id: WOXEL_TEMPLATE_IDS.randomLand,
        name: "Random 12 voxel colors all land",
        size: { x: 45, y: 45, z: 45 },
        land: { x: 45, y: 7, z: 45 },
        respectLand: true,
        fillMode: "random12Land",
        palettePreset: "12colors",
    },
    {
        id: WOXEL_TEMPLATE_IDS.randomAll,
        name: "Random ALL",
        size: { x: 45, y: 45, z: 45 },
        land: { x: 45, y: 7, z: 45 },
        respectLand: false,
        fillMode: "randomAll",
        fillChance: 0.65,
        palettePreset: "12colors",
    },
];

export function getWoxelTemplate(id = DEFAULT_WOXEL_TEMPLATE_ID) {
    return woxelTemplates.find((template) => template.id === id)
        ?? woxelTemplates.find((template) => template.id === DEFAULT_WOXEL_TEMPLATE_ID)
        ?? woxelTemplates[0];
}

export function cloneWoxelTemplate(template = getWoxelTemplate()) {
    return {
        ...template,
        size: { ...template.size },
        land: { ...template.land },
        flowerVoxelNames: Array.isArray(template.flowerVoxelNames) ? [...template.flowerVoxelNames] : undefined,
        flowers: Array.isArray(template.flowers) ? [...template.flowers] : undefined,
    };
}

export function randomFlowerVoxel(template = getWoxelTemplate(WOXEL_TEMPLATE_IDS.grassWithFlowers)) {
    const flowers = Array.isArray(template.flowers) && template.flowers.length > 0
        ? template.flowers
        : flowerVoxels;
    const index = Math.floor(Math.random() * flowers.length);

    return flowers[index]?.clone?.() ?? grassVoxel?.clone?.() ?? randomVoxel12();
}

export function randomFlowerVoxelId(template = getWoxelTemplate(WOXEL_TEMPLATE_IDS.grassWithFlowers), palette = null) {
    const names = Array.isArray(template.flowerVoxelNames) && template.flowerVoxelNames.length > 0
        ? template.flowerVoxelNames
        : flowerVoxelNames;
    const name = names[Math.floor(Math.random() * names.length)] ?? "Red";

    return palette?.getIdByName?.(name) ?? getVoxel12Id(name) ?? randomVoxelId12({ excludeName: grassVoxelName });
}

export function createTemplateVoxel(template, mode = template?.fillMode) {
    if (mode === "grassLand" || mode === "grassWithFlowers") {
        return (template?.grassVoxel ?? grassVoxel)?.clone?.() ?? randomVoxel12();
    }

    return randomVoxel12();
}

export function createTemplateVoxelId(template, palette = null, mode = template?.fillMode) {
    if (mode === "grassLand" || mode === "grassWithFlowers") {
        const name = template?.grassVoxelName ?? template?.grassVoxel?.name ?? grassVoxelName;

        return palette?.getIdByName?.(name) ?? template?.grassVoxelId ?? getVoxel12Id(name) ?? grassVoxelId;
    }

    return palette?.getRandomId?.() ?? randomVoxelId12();
}

export default woxelTemplates;
