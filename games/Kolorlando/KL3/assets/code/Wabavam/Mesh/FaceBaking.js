import * as THREE from "three";

export class FaceBaking {
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        this.pixelScale = this.positiveInt(options.pixelScale, 4);
        this.maxTextureSize = this.positiveInt(options.maxTextureSize, 2048);
        this.wireframe = Boolean(options.wireframe ?? false);
        this.materials = new Set();
        this.textures = new Set();

        this.directions = options.directions ?? [
            { name: "px", normal: { x: 1, y: 0, z: 0 } },
            { name: "nx", normal: { x: -1, y: 0, z: 0 } },
            { name: "py", normal: { x: 0, y: 1, z: 0 } },
            { name: "ny", normal: { x: 0, y: -1, z: 0 } },
            { name: "pz", normal: { x: 0, y: 0, z: 1 } },
            { name: "nz", normal: { x: 0, y: 0, z: -1 } },
        ];
    }

    createMesh(boxel15 = null, woxel = null, options = {}) {
        if (!this.enabled || !boxel15 || this.hasMicroxels(boxel15, woxel)) return null;

        const faces = this.createVisibleFaces(boxel15, woxel);
        if (faces.length === 0) return null;

        const rects = this.mergeByPlane(faces);
        if (rects.length === 0 || rects.length >= faces.length) return null;

        const atlas = this.createAtlas(rects);
        if (!atlas?.texture) return null;

        const geometry = this.createGeometry(rects, atlas);
        const material = this.createMaterial(atlas.texture, options.materialOptions ?? {});
        const mesh = new THREE.Mesh(geometry, material);

        mesh.name = `${boxel15.name} FaceBaked Mesh`;
        mesh.userData.boxel = boxel15;
        mesh.userData.faceBaked = true;
        mesh.userData.faceCount = rects.length;
        mesh.userData.originalVisibleFaceCount = faces.length;
        mesh.userData.faceCountReduction = faces.length - rects.length;
        mesh.userData.bakedSurfaceRects = rects.length;
        mesh.userData.boxel15Visible = true;
        mesh.userData.boxel15Raycastable = true;
        mesh.userData.textureAtlas = false;

        return mesh;
    }

    createVisibleFaces(boxel15, woxel = null) {
        const faces = [];
        const palette = woxel?.palette ?? boxel15.palette ?? null;

        boxel15.forEachVoxelId((voxelId, x, y, z) => {
            const voxel = boxel15.getVoxel(x, y, z, palette);
            if (!voxel?.isActive?.()) return;

            this.directions.forEach((direction) => {
                if (this.isSolidAt(boxel15, woxel, x + direction.normal.x, y + direction.normal.y, z + direction.normal.z)) return;

                faces.push(this.toFace({
                    direction: direction.name,
                    x: boxel15.position.x + x,
                    y: boxel15.position.y + y,
                    z: boxel15.position.z + z,
                    color: voxel.color ?? "#ffffff",
                    voxelId,
                }));
            });
        });

        return faces;
    }

    mergeByPlane(faces = []) {
        const groups = new Map();
        faces.forEach((face) => {
            const key = `${face.direction}|${face.plane}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(face);
        });

        const rects = [];
        for (const key of Array.from(groups.keys()).sort()) {
            rects.push(...this.mergeGroup(groups.get(key)));
        }
        return rects;
    }

    mergeGroup(faces = []) {
        const map = new Map();
        const used = new Set();
        const rects = [];
        const bounds = this.bounds(faces);

        faces.forEach((face) => map.set(this.key(face.u, face.v), face));

        for (let v = bounds.minV; v <= bounds.maxV; v++) {
            for (let u = bounds.minU; u <= bounds.maxU; u++) {
                if (!map.has(this.key(u, v)) || used.has(this.key(u, v))) continue;

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
        const padding = 1;
        let x = padding;
        let y = padding;
        let rowHeight = 0;
        let width = 1;
        let height = 1;

        rects.forEach((rect) => {
            const w = Math.max(1, rect.width * this.pixelScale);
            const h = Math.max(1, rect.height * this.pixelScale);

            if (x + w + padding > this.maxTextureSize) {
                x = padding;
                y += rowHeight + padding;
                rowHeight = 0;
            }

            rect.atlas = { x, y, width: w, height: h };
            x += w + padding;
            rowHeight = Math.max(rowHeight, h);
            width = Math.max(width, x + padding);
            height = Math.max(height, y + rowHeight + padding);
        });

        if (width > this.maxTextureSize || height > this.maxTextureSize) return null;

        const data = new Uint8Array(width * height * 4);
        this.fill(data, width, height, "#ffffff");
        rects.forEach((rect) => this.paintRect(data, width, height, rect));

        const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
        this.configureTexture(texture);
        this.textures.add(texture);

        return { texture, width, height };
    }

    paintRect(data, width, height, rect) {
        const cells = new Map(rect.cells.map((cell) => [this.key(cell.u, cell.v), cell]));
        const shade = this.faceShade(rect.direction);

        for (let py = 0; py < rect.atlas.height; py++) {
            for (let px = 0; px < rect.atlas.width; px++) {
                const u = rect.u + Math.min(rect.width - 1, Math.floor(px / this.pixelScale));
                const v = rect.v + Math.min(rect.height - 1, Math.floor(py / this.pixelScale));
                const cell = cells.get(this.key(u, v));
                const color = this.bytes(cell?.color ?? "#ffffff", shade);
                const index = ((rect.atlas.y + py) * width + rect.atlas.x + px) * 4;

                data[index + 0] = color.r;
                data[index + 1] = color.g;
                data[index + 2] = color.b;
                data[index + 3] = 255;
            }
        }
    }

    createGeometry(rects = [], atlas = {}) {
        const positions = [];
        const uvs = [];
        const indices = [];

        rects.forEach((rect) => {
            const start = positions.length / 3;
            const uv = this.uvRect(rect.atlas, atlas.width, atlas.height);

            this.vertices(rect).forEach((v) => positions.push(v.x, v.y, v.z));
            uvs.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
            indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    createMaterial(texture, options = {}) {
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            color: options.color ?? 0xffffff,
            vertexColors: false,
            wireframe: options.wireframe ?? this.wireframe,
            transparent: options.transparent ?? false,
            alphaTest: options.alphaTest ?? 0,
            side: options.side ?? THREE.FrontSide,
        });

        material.name = "FaceBakedMaterial";
        material.needsUpdate = true;
        this.materials.add(material);
        return material;
    }

    hasMicroxels(boxel15, woxel = null) {
        const palette = woxel?.palette ?? boxel15.palette ?? null;

        for (let z = 0; z < boxel15.size.z; z++) {
            for (let y = 0; y < boxel15.size.y; y++) {
                for (let x = 0; x < boxel15.size.x; x++) {
                    const voxel = boxel15.getVoxel?.(x, y, z, palette);
                    if (voxel?.hasMicroxels?.()) return true;
                }
            }
        }

        return false;
    }

    isSolidAt(boxel15, woxel, localX, localY, localZ) {
        const worldX = boxel15.position.x + localX;
        const worldY = boxel15.position.y + localY;
        const worldZ = boxel15.position.z + localZ;

        if (woxel && !woxel.isInside(worldX, worldY, worldZ)) return false;

        const voxel = woxel
            ? woxel.getVoxelAt(worldX, worldY, worldZ)
            : boxel15.getVoxel(localX, localY, localZ);

        return voxel?.isActive?.() === true && voxel?.hasMicroxels?.() !== true;
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
                const key = this.key(u + offset, v + height);
                if (!map.has(key) || used.has(key)) return height;
            }
            height++;
        }

        return height;
    }

    collect(map, used, u, v, width, height) {
        const cells = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const key = this.key(u + x, v + y);
                const cell = map.get(key);
                if (cell) cells.push(cell);
                used.add(key);
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

    uvRect(rect, width, height) {
        const halfU = 0.5 / width;
        const halfV = 0.5 / height;
        return {
            u0: rect.x / width + halfU,
            u1: (rect.x + rect.width) / width - halfU,
            v0: rect.y / height + halfV,
            v1: (rect.y + rect.height) / height - halfV,
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
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;
        return texture;
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
        const c = new THREE.Color(this.color(color)).multiplyScalar(shade);
        return { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255) };
    }

    color(color = "#ffffff") {
        if (typeof color !== "string") return "#ffffff";
        const value = color.trim().toLowerCase();
        return /^#[0-9a-f]{6}$/.test(value) ? value : "#ffffff";
    }

    faceShade(direction = "") {
        if (direction === "py") return 1.0;
        if (direction === "px") return 0.85;
        if (direction === "nx") return 0.75;
        if (direction === "pz") return 0.70;
        if (direction === "nz") return 0.60;
        if (direction === "ny") return 0.45;
        return 1;
    }

    positiveInt(value, fallback = 1) {
        const n = Math.floor(Number(value));
        return Number.isFinite(n) && n > 0 ? n : fallback;
    }

    key(u, v) {
        return `${u},${v}`;
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

export default FaceBaking;
