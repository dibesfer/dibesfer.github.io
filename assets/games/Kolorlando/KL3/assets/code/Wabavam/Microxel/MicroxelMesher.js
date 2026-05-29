import * as THREE from "three";

import { SurfaceTrinity } from "../Mesh/SurfaceTrinity.js";
import { TextureAtlas } from "../Mesh/TextureAtlas.js";
import { Compass } from "../Compass.js";
import { colorToShadedBytes, createFaceShading, getFaceShade, normalizeHexColor } from "../Mesh/FaceShading.js";

export class MicroxelMesher {
    constructor(options = {}) {
        this.surfaceTrinity = options.surfaceTrinity ?? new SurfaceTrinity(options.surfaceTrinityOptions ?? {});
        this.textureAtlas = options.textureAtlas === false
            ? null
            : options.textureAtlas ?? new TextureAtlas(options.textureAtlasOptions ?? {});
        this.faceBaking = options.faceBaking ?? true;
        this.pixelScale = this.positiveInt(options.pixelScale, 4);
        this.maxTextureSize = this.positiveInt(options.maxTextureSize, 512);
        this.wireframe = Boolean(options.wireframe ?? false);
        this.faceShading = createFaceShading(options.faceShading ?? {});

        // Microxel baking is deliberately adaptive.
        // Random / cave-like microxel voxels are better served by SurfaceTrinity.
        this.minBakeFaces = this.positiveInt(options.minBakeFaces, 48);
        this.minPlaneCells = this.positiveInt(options.minPlaneCells, 4);
        this.minPlaneDensity = this.clamp01(options.minPlaneDensity ?? 0.6);
        this.minReductionRatio = this.clamp01(options.minReductionRatio ?? 0.25);
        this.maxTextureWasteRatio = this.positiveNumber(options.maxTextureWasteRatio, 2.4);
        this.maxBakeRects = this.positiveInt(options.maxBakeRects, 96);
        this.materials = new Set();
        this.textures = new Set();
    }

    createMesh(voxel = null, origin = { x: 0, y: 0, z: 0 }, context = {}) {
        if (!this.faceBaking) return null;

        const size = voxel?.effectiveMicroxelSize?.() ?? 0;
        if (!voxel?.hasMicroxels?.() || size <= 1) return null;

        const faces = this.createRawVisibleFaces(voxel, origin, context, size);
        if (faces.length === 0) return null;

        const rects = this.bakePlanes(faces);
        if (!this.isBakeWorthIt(faces, rects)) return null;

        const atlas = this.createAtlas(rects);
        if (!atlas?.texture) return null;

        const geometry = this.createGeometry(rects, atlas, origin, size);
        const material = this.createMaterial(atlas.texture);
        const mesh = new THREE.Mesh(geometry, material);

        mesh.name = `${voxel.name ?? "Voxel"} Microxel FaceBaked Mesh`;
        mesh.userData.faceBaked = true;
        mesh.userData.microxelFaceBaked = true;
        mesh.userData.microxelPlaneBaked = true;
        mesh.userData.faceCount = rects.length;
        mesh.userData.originalVisibleFaceCount = faces.length;
        mesh.userData.faceCountReduction = faces.length - rects.length;
        mesh.userData.textureAtlas = false;

        return mesh;
    }

    createFaces(voxel = null, origin = { x: 0, y: 0, z: 0 }, context = {}) {
        const size = voxel?.effectiveMicroxelSize?.() ?? 0;
        if (!voxel?.hasMicroxels?.() || size <= 1) return [];

        const cells = this.createOrientedCells(voxel, size);

        const faces = this.surfaceTrinity.createFaces({
            origin: { x: 0, y: 0, z: 0 },
            forEachCell: (callback) => {
                cells.forEach((entry) => callback(entry.cell, entry.x, entry.y, entry.z));
            },
            isSolidAt: (x, y, z) => {
                if (this.isInside(size, x, y, z)) return cells.has(this.key(x, y, z));
                return this.isOuterNeighborSolid(origin, { x, y, z }, size, context);
            },
            getColor: (cell) => cell?.color ?? voxel.color ?? "#ffffff",
            getFaceData: (cell, direction, x, y, z) => {
                return this.textureAtlas?.getFaceData?.(cell, direction?.name ?? direction, {
                    microxel: cell,
                    voxel,
                    localX: x,
                    localY: y,
                    localZ: z,
                }) ?? null;
            },
        });

        return faces.map((face) => this.scaleFace(face, origin, size));
    }

    createRawVisibleFaces(voxel, origin, context = {}, size = voxel?.effectiveMicroxelSize?.() ?? 0) {
        const faces = [];
        const cells = this.createOrientedCells(voxel, size);

        cells.forEach((entry) => {
            this.surfaceTrinity.directions.forEach((direction) => {
                const nx = entry.x + direction.normal.x;
                const ny = entry.y + direction.normal.y;
                const nz = entry.z + direction.normal.z;

                const solid = this.isInside(size, nx, ny, nz)
                    ? cells.has(this.key(nx, ny, nz))
                    : this.isOuterNeighborSolid(origin, { x: nx, y: ny, z: nz }, size, context);

                if (solid) return;

                faces.push(this.toFace({
                    direction: direction.name,
                    x: entry.x,
                    y: entry.y,
                    z: entry.z,
                    color: entry.cell?.color ?? voxel.color ?? "#ffffff",
                }));
            });
        });

        return faces;
    }

    bakePlanes(faces = []) {
        const groups = new Map();
        const rects = [];

        faces.forEach((face) => {
            const key = `${face.direction}|${face.plane}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(face);
        });

        groups.forEach((group) => {
            rects.push(...this.bakePlaneGroup(group));
        });

        return rects;
    }

    bakePlaneGroup(faces = []) {
        const rect = this.createPlaneRect(faces);
        if (!rect) return [];

        const density = rect.cells.length / Math.max(1, rect.width * rect.height);
        const canBakeWholePlane = rect.cells.length >= this.minPlaneCells
            && density >= this.minPlaneDensity;

        if (canBakeWholePlane) {
            rect.bakeMode = "plane";
            rect.density = density;
            return [rect];
        }

        // Sparse / hole-heavy planes keep their holes as real geometry.
        // Still merge contiguous cells, but do not flatten the whole plane.
        return this.mergeGroup(faces).map((chunk) => ({
            ...chunk,
            bakeMode: "greedy",
            density: 1,
        }));
    }

    createPlaneRect(faces = []) {
        if (faces.length === 0) return null;

        const bounds = this.bounds(faces);
        const first = faces[0];

        return {
            direction: first.direction,
            plane: first.plane,
            u: bounds.minU,
            v: bounds.minV,
            width: bounds.maxU - bounds.minU + 1,
            height: bounds.maxV - bounds.minV + 1,
            cells: faces,
        };
    }

    mergeByPlane(faces = []) {
        return this.bakePlanes(faces);
    }

    isBakeWorthIt(faces = [], rects = []) {
        if (faces.length < this.minBakeFaces) return false;
        if (rects.length === 0 || rects.length >= faces.length) return false;
        if (rects.length > this.maxBakeRects) return false;

        const reductionRatio = (faces.length - rects.length) / Math.max(1, faces.length);
        if (reductionRatio < this.minReductionRatio) return false;

        const textureCells = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
        const wasteRatio = textureCells / Math.max(1, faces.length);
        if (wasteRatio > this.maxTextureWasteRatio) return false;

        return true;
    }

    mergeGroup(faces = []) {
        const map = new Map();
        const used = new Set();
        const rects = [];
        const bounds = this.bounds(faces);

        faces.forEach((face) => map.set(this.key(face.u, face.v), face));

        for (let v = bounds.minV; v <= bounds.maxV; v++) {
            for (let u = bounds.minU; u <= bounds.maxU; u++) {
                const id = this.key(u, v);
                if (!map.has(id) || used.has(id)) continue;

                const width = this.growWidth(map, used, u, v, bounds.maxU);
                const height = this.growHeight(map, used, u, v, width, bounds.maxV);
                const cells = this.collect(map, used, u, v, width, height);
                const first = cells[0];

                rects.push({
                    direction: first.direction,
                    plane: first.plane,
                    u,
                    v,
                    width,
                    height,
                    cells,
                });
            }
        }

        return rects;
    }

    createAtlas(rects = []) {
        // Keep geometry and texture proportions identical to the normal SurfaceTrinity mesh.
        // The padding lives outside the UV rectangle; it only prevents atlas bleeding.
        const padding = 1;
        let x = padding;
        let y = padding;
        let rowHeight = 0;
        let width = 1;
        let height = 1;

        rects.forEach((rect) => {
            const w = Math.max(1, rect.width * this.pixelScale);
            const h = Math.max(1, rect.height * this.pixelScale);
            const slotW = w + padding * 2;
            const slotH = h + padding * 2;

            if (x + slotW + padding > this.maxTextureSize) {
                x = padding;
                y += rowHeight + padding;
                rowHeight = 0;
            }

            rect.atlas = { x: x + padding, y: y + padding, width: w, height: h, padding };
            x += slotW + padding;
            rowHeight = Math.max(rowHeight, slotH);
            width = Math.max(width, x + padding);
            height = Math.max(height, y + rowHeight + padding);
        });

        if (width > this.maxTextureSize || height > this.maxTextureSize) return null;

        const data = new Uint8Array(width * height * 4);
        this.clear(data);
        rects.forEach((rect) => this.paintRect(data, width, height, rect));

        const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
        this.configureTexture(texture);
        this.textures.add(texture);
        return { texture, width, height };
    }

    paintRect(data, width, height, rect) {
        const cells = new Map(rect.cells.map((cell) => [this.key(cell.u, cell.v), cell]));
        const shade = this.faceShade(rect.direction);
        const padding = rect.atlas.padding ?? 0;

        for (let py = -padding; py < rect.atlas.height + padding; py++) {
            for (let px = -padding; px < rect.atlas.width + padding; px++) {
                const sampleX = this.clampInt(px, 0, rect.atlas.width - 1);
                const sampleY = this.clampInt(py, 0, rect.atlas.height - 1);
                const u = rect.u + Math.min(rect.width - 1, Math.floor(sampleX / this.pixelScale));
                const v = rect.v + Math.min(rect.height - 1, Math.floor(sampleY / this.pixelScale));
                const cell = cells.get(this.key(u, v));
                const tx = rect.atlas.x + px;
                const ty = rect.atlas.y + py;
                if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
                const index = (ty * width + tx) * 4;

                if (!cell) {
                    data[index + 0] = 0;
                    data[index + 1] = 0;
                    data[index + 2] = 0;
                    data[index + 3] = 0;
                    continue;
                }

                const color = this.bytes(cell.color ?? "#ffffff", shade);
                data[index + 0] = color.r;
                data[index + 1] = color.g;
                data[index + 2] = color.b;
                data[index + 3] = 255;
            }
        }
    }

    createGeometry(rects = [], atlas = {}, origin = { x: 0, y: 0, z: 0 }, size = 1) {
        const positions = [];
        const uvs = [];
        const indices = [];
        const unit = 1 / size;

        rects.forEach((rect) => {
            const start = positions.length / 3;
            const rectUvs = this.uvsForRectVertices(rect, atlas);

            this.vertices(rect).forEach((vertex) => {
                positions.push(
                    origin.x + vertex.x * unit,
                    origin.y + vertex.y * unit,
                    origin.z + vertex.z * unit
                );
            });
            rectUvs.forEach((uv) => uvs.push(uv.u, uv.v));
            indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    createMaterial(texture) {
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            color: 0xffffff,
            vertexColors: false,
            wireframe: this.wireframe,
            transparent: false,
            alphaTest: 0.5,
            side: THREE.FrontSide,
        });

        material.name = "MicroxelFaceBakedMaterial";
        material.needsUpdate = true;
        this.materials.add(material);
        return material;
    }

    isInside(size, x, y, z) {
        return x >= 0 && x < size && y >= 0 && y < size && z >= 0 && z < size;
    }

    createOrientedCells(voxel = null, size = 0) {
        const cells = new Map();
        const orientation = Compass.normalize(voxel?.orientation) ?? Compass.NORTH;
        const gridSize = { x: size, y: size, z: size };

        voxel?.forEachMicroxel?.((cell, x, y, z) => {
            if (!cell?.active) return;

            const position = Compass.rotatePositionInSize({ x, y, z }, gridSize, orientation);
            cells.set(this.key(position.x, position.y, position.z), {
                cell,
                x: position.x,
                y: position.y,
                z: position.z,
            });
        });

        return cells;
    }

    isOuterNeighborSolid(origin, position, size, context = {}) {
        const world = { ...origin };

        if (position.x < 0) world.x -= 1;
        else if (position.x >= size) world.x += 1;
        else if (position.y < 0) world.y -= 1;
        else if (position.y >= size) world.y += 1;
        else if (position.z < 0) world.z -= 1;
        else if (position.z >= size) world.z += 1;
        else return false;

        return context.isWorldVoxelSolid?.(world.x, world.y, world.z) === true;
    }

    scaleFace(face, origin, size) {
        const unit = 1 / size;
        const scaled = { ...face, width: face.width * unit, height: face.height * unit };

        if (face.direction === "px" || face.direction === "nx") {
            scaled.plane = origin.x + face.plane * unit;
            scaled.u = origin.z + face.u * unit;
            scaled.v = origin.y + face.v * unit;
            return scaled;
        }

        if (face.direction === "py" || face.direction === "ny") {
            scaled.plane = origin.y + face.plane * unit;
            scaled.u = origin.x + face.u * unit;
            scaled.v = origin.z + face.v * unit;
            return scaled;
        }

        scaled.plane = origin.z + face.plane * unit;
        scaled.u = origin.x + face.u * unit;
        scaled.v = origin.y + face.v * unit;
        return scaled;
    }

    toFace(face) {
        if (face.direction === "px") return { ...face, plane: face.x + 1, u: face.z, v: face.y };
        if (face.direction === "nx") return { ...face, plane: face.x, u: face.z, v: face.y };
        if (face.direction === "py") return { ...face, plane: face.y + 1, u: face.x, v: face.z };
        if (face.direction === "ny") return { ...face, plane: face.y, u: face.x, v: face.z };
        if (face.direction === "pz") return { ...face, plane: face.z + 1, u: face.x, v: face.y };
        return { ...face, plane: face.z, u: face.x, v: face.y };
    }

    vertices(rect) {
        const p = rect.plane;
        const u0 = rect.u;
        const v0 = rect.v;
        const u1 = rect.u + rect.width;
        const v1 = rect.v + rect.height;

        if (rect.direction === "px") return [{ x: p, y: v0, z: u1 }, { x: p, y: v0, z: u0 }, { x: p, y: v1, z: u0 }, { x: p, y: v1, z: u1 }];
        if (rect.direction === "nx") return [{ x: p, y: v0, z: u0 }, { x: p, y: v0, z: u1 }, { x: p, y: v1, z: u1 }, { x: p, y: v1, z: u0 }];
        if (rect.direction === "py") return [{ x: u0, y: p, z: v1 }, { x: u1, y: p, z: v1 }, { x: u1, y: p, z: v0 }, { x: u0, y: p, z: v0 }];
        if (rect.direction === "ny") return [{ x: u0, y: p, z: v0 }, { x: u1, y: p, z: v0 }, { x: u1, y: p, z: v1 }, { x: u0, y: p, z: v1 }];
        if (rect.direction === "pz") return [{ x: u0, y: v0, z: p }, { x: u1, y: v0, z: p }, { x: u1, y: v1, z: p }, { x: u0, y: v1, z: p }];
        return [{ x: u1, y: v0, z: p }, { x: u0, y: v0, z: p }, { x: u0, y: v1, z: p }, { x: u1, y: v1, z: p }];
    }

    growWidth(map, used, u, v, maxU) {
        let width = 0;
        while (u + width <= maxU && map.has(this.key(u + width, v)) && !used.has(this.key(u + width, v))) width++;
        return width;
    }

    growHeight(map, used, u, v, width, maxV) {
        let height = 1;
        while (v + height <= maxV) {
            for (let offset = 0; offset < width; offset++) {
                const id = this.key(u + offset, v + height);
                if (!map.has(id) || used.has(id)) return height;
            }
            height++;
        }
        return height;
    }

    collect(map, used, u, v, width, height) {
        const cells = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const id = this.key(u + x, v + y);
                const cell = map.get(id);
                if (cell) cells.push(cell);
                used.add(id);
            }
        }
        return cells;
    }

    bounds(faces = []) {
        return faces.reduce((b, face) => ({
            minU: Math.min(b.minU, face.u),
            maxU: Math.max(b.maxU, face.u),
            minV: Math.min(b.minV, face.v),
            maxV: Math.max(b.maxV, face.v),
        }), { minU: Infinity, maxU: -Infinity, minV: Infinity, maxV: -Infinity });
    }


    uvsForRectVertices(rect = {}, atlas = {}) {
        const uv = this.uvRect(rect.atlas, atlas.width, atlas.height);
        const uv00 = { u: uv.u0, v: uv.v0 };
        const uv10 = { u: uv.u1, v: uv.v0 };
        const uv11 = { u: uv.u1, v: uv.v1 };
        const uv01 = { u: uv.u0, v: uv.v1 };

        // Same contract as FaceBaking.js: texel local (u, v) must land on the matching mesh corner.
        if (rect.direction === "px") return [uv10, uv00, uv01, uv11];
        if (rect.direction === "nx") return [uv00, uv10, uv11, uv01];
        if (rect.direction === "py") return [uv01, uv11, uv10, uv00];
        if (rect.direction === "ny") return [uv00, uv10, uv11, uv01];
        if (rect.direction === "pz") return [uv00, uv10, uv11, uv01];
        return [uv10, uv00, uv01, uv11];
    }

    uvRect(rect, width, height) {
        // Exact texel-edge UVs: no half-texel crop.
        // Half-texel UVs made baked faces look subtly rescaled compared to SurfaceTrinity.
        return {
            u0: rect.x / width,
            u1: (rect.x + rect.width) / width,
            v0: rect.y / height,
            v1: (rect.y + rect.height) / height,
        };
    }

    configureTexture(texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = false;
        texture.flipY = false;
        texture.premultiplyAlpha = false;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;
        return texture;
    }

    clear(data) {
        data.fill(0);
    }

    fill(data, width, height, color = "#ffffff") {
        const c = this.bytes(color);
        for (let i = 0; i < width * height; i++) {
            const o = i * 4;
            data[o + 0] = c.r;
            data[o + 1] = c.g;
            data[o + 2] = c.b;
            data[o + 3] = 255;
        }
    }

    bytes(color = "#ffffff", shade = 1) {
        return colorToShadedBytes(color, shade);
    }

    color(color = "#ffffff") {
        return normalizeHexColor(color);
    }

    faceShade(direction = "") {
        return getFaceShade(direction, this.faceShading);
    }

    positiveInt(value, fallback = 1) {
        const n = Math.floor(Number(value));
        return Number.isFinite(n) && n > 0 ? n : fallback;
    }

    positiveNumber(value, fallback = 1) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : fallback;
    }

    clamp01(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return 0;
        return Math.min(1, Math.max(0, number));
    }

    clampInt(value, min, max) {
        return Math.max(min, Math.min(max, Math.floor(value)));
    }

    key(x = 0, y = 0, z = null) {
        return z === null ? `${x},${y}` : `${x},${y},${z}`;
    }

    setWireframe(enabled = false) {
        this.wireframe = Boolean(enabled);
        this.materials.forEach((material) => {
            material.wireframe = this.wireframe;
            material.needsUpdate = true;
        });
    }

    dispose() {
        this.materials.forEach((material) => material.dispose?.());
        this.textures.forEach((texture) => texture.dispose?.());
        this.materials.clear();
        this.textures.clear();
    }
}

export default MicroxelMesher;




