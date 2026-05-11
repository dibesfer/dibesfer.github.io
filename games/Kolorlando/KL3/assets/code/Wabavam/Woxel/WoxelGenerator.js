import { Woxel } from "./Woxel.js";
import { create12ColorsPalette } from "../Voxel/12colors/12colors.js";
import {
    DEFAULT_WOXEL_TEMPLATE_ID,
    createTemplateVoxelId,
    getWoxelTemplate,
    randomFlowerVoxelId,
} from "./woxelTemplates.js";

export class WoxelGenerator {
    constructor(options = {}) {
        this.defaultTemplateId = options.defaultTemplateId ?? DEFAULT_WOXEL_TEMPLATE_ID;
        this.extraVoxels = Array.isArray(options.extraVoxels) ? options.extraVoxels : [];
    }

    create(woxelTemplate = this.defaultTemplateId) {
        const template = this.resolveTemplate(woxelTemplate);
        const woxel = new Woxel({
            name: template.name ?? "Woxel",
            size: template.size,
            land: template.land,
            spawnPosition: template.spawnPosition,
            palette: this.createPalette(template),
        });

        this.fillFromTemplate(woxel, template);

        return woxel;
    }

    createDemo() {
        return this.create(this.defaultTemplateId);
    }

    createPalette(template = null) {
        return template?.palette?.clone ? template.palette.clone() : create12ColorsPalette();
    }

    resolveTemplate(woxelTemplate = this.defaultTemplateId) {
        if (typeof woxelTemplate === "string") {
            return getWoxelTemplate(woxelTemplate);
        }

        return woxelTemplate ?? getWoxelTemplate(this.defaultTemplateId);
    }

    fillFromTemplate(woxel, template = getWoxelTemplate()) {
        if (!woxel || !template) return woxel;

        if (template.fillMode === "grassLand") {
            this.fillLand(woxel, template);
            return woxel;
        }

        if (template.fillMode === "grassWithFlowers") {
            this.fillGrassWithFlowers(woxel, template);
            return woxel;
        }

        if (template.fillMode === "random12Land") {
            this.fillRandomLand(woxel, template);
            return woxel;
        }

        if (template.fillMode === "randomAll") {
            this.fillRandomAll(woxel, template);
        }

        return woxel;
    }

    fillLand(woxel, template = null) {
        const land = this.getClampedLand(woxel);
        const voxelId = createTemplateVoxelId(template, woxel.palette);

        this.fillBoxelsDirectly(woxel, {
            min: { x: 0, y: 0, z: 0 },
            max: { x: land.x - 1, y: land.y - 1, z: land.z - 1 },
            voxelId,
        });

        return woxel;
    }

    fillRandomLand(woxel, template = null) {
        const land = this.getClampedLand(woxel);

        this.fillBoxelsDirectly(woxel, {
            min: { x: 0, y: 0, z: 0 },
            max: { x: land.x - 1, y: land.y - 1, z: land.z - 1 },
            voxelIdFactory: () => woxel.palette?.getRandomId?.() ?? 0,
        });

        return woxel;
    }

    fillGrassWithFlowers(woxel, template = getWoxelTemplate(DEFAULT_WOXEL_TEMPLATE_ID)) {
        this.fillLand(woxel, template);
        this.scatterFlowers(woxel, template);

        return woxel;
    }

    scatterFlowers(woxel, template = getWoxelTemplate(DEFAULT_WOXEL_TEMPLATE_ID)) {
        const land = this.getClampedLand(woxel);
        const groundY = land.y - 1;
        const flowerChance = template.flowerChance ?? 0.035;

        if (groundY < 0 || groundY >= woxel.size.y) return woxel;

        for (let x = 0; x < land.x; x++) {
            for (let z = 0; z < land.z; z++) {
                if (Math.random() > flowerChance) continue;

                this.setVoxelIdDirect(woxel, x, groundY, z, randomFlowerVoxelId(template, woxel.palette));
            }
        }

        return woxel;
    }

    fillRandomAll(woxel, template = null) {
        const fillChance = template?.fillChance ?? 0.65;

        this.fillBoxelsDirectly(woxel, {
            min: { x: 0, y: 0, z: 0 },
            max: {
                x: woxel.size.x - 1,
                y: woxel.size.y - 1,
                z: woxel.size.z - 1,
            },
            voxelIdFactory: () => woxel.palette?.getRandomId?.() ?? 0,
            shouldFill: () => Math.random() <= fillChance,
        });

        return woxel;
    }

    fillBoxelsDirectly(woxel, options = {}) {
        const min = options.min ?? { x: 0, y: 0, z: 0 };
        const max = options.max ?? {
            x: woxel.size.x - 1,
            y: woxel.size.y - 1,
            z: woxel.size.z - 1,
        };
        const constantVoxelId = this.normalizeVoxelId(options.voxelId);
        const hasConstantVoxelId = constantVoxelId > 0;
        const voxelIdFactory = options.voxelIdFactory ?? (() => woxel.palette?.getRandomId?.() ?? 0);
        const shouldFill = options.shouldFill ?? (() => true);
        const canUseRangeFill = hasConstantVoxelId && options.shouldFill === undefined;

        woxel.forEachBoxelOriginInWorldRange({ min, max }, (origin) => {
            const boxel15 = woxel.ensureBoxelAtOrigin(origin.x, origin.y, origin.z);
            if (!boxel15) return;

            const range = this.getLocalRangeForWorldRange(boxel15, min, max);
            if (!range) return;

            if (canUseRangeFill) {
                boxel15.fillVoxelIdRange(range, constantVoxelId);
                return;
            }

            for (let localZ = range.minZ; localZ <= range.maxZ; localZ++) {
                for (let localY = range.minY; localY <= range.maxY; localY++) {
                    for (let localX = range.minX; localX <= range.maxX; localX++) {
                        const worldX = boxel15.position.x + localX;
                        const worldY = boxel15.position.y + localY;
                        const worldZ = boxel15.position.z + localZ;

                        if (!shouldFill(worldX, worldY, worldZ, boxel15)) continue;

                        const voxelId = hasConstantVoxelId
                            ? constantVoxelId
                            : voxelIdFactory(worldX, worldY, worldZ, boxel15);

                        boxel15.setVoxelId(localX, localY, localZ, voxelId);
                    }
                }
            }
        });

        return woxel;
    }

    setVoxelIdDirect(woxel, x, y, z, voxelId = 0) {
        if (!woxel?.isInside?.(x, y, z)) return false;

        const normalizedVoxelId = this.normalizeVoxelId(voxelId);
        const boxel15 = normalizedVoxelId === 0
            ? woxel.getBoxelAtWorld(x, y, z)
            : woxel.ensureBoxelAtWorld(x, y, z);

        if (!boxel15) return false;

        return boxel15.setVoxelId(
            x - boxel15.position.x,
            y - boxel15.position.y,
            z - boxel15.position.z,
            normalizedVoxelId
        );
    }

    getLocalRangeForWorldRange(boxel15, min, max) {
        const minX = Math.max(0, min.x - boxel15.position.x);
        const minY = Math.max(0, min.y - boxel15.position.y);
        const minZ = Math.max(0, min.z - boxel15.position.z);
        const maxX = Math.min(boxel15.size.x - 1, max.x - boxel15.position.x);
        const maxY = Math.min(boxel15.size.y - 1, max.y - boxel15.position.y);
        const maxZ = Math.min(boxel15.size.z - 1, max.z - boxel15.position.z);

        if (minX > maxX || minY > maxY || minZ > maxZ) return null;

        return { minX, minY, minZ, maxX, maxY, maxZ };
    }

    getClampedLand(woxel) {
        return {
            x: Math.min(woxel.land.x, woxel.size.x),
            y: Math.min(woxel.land.y, woxel.size.y),
            z: Math.min(woxel.land.z, woxel.size.z),
        };
    }

    normalizeVoxelId(voxelId = 0) {
        const number = Number(voxelId);
        if (!Number.isFinite(number)) return 0;

        return Math.min(Math.max(Math.floor(number), 0), 65535);
    }
}

export default WoxelGenerator;



