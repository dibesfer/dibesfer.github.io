import * as THREE from "three";

export const DEFAULT_TEXTURE_ATLAS_COLORS = [
    { id: 1, name: "White", color: "#ededed" },
    { id: 2, name: "Black", color: "#0d0d0d" },
    { id: 3, name: "Gray", color: "#8a8a8a" },
    { id: 4, name: "Orange", color: "#ff8e1e" },
    { id: 5, name: "Yellow", color: "#ebeb26" },
    { id: 6, name: "LightBlue", color: "#3ad1ff" },
    { id: 7, name: "Green", color: "#169400" },
    { id: 8, name: "Red", color: "#b42121" },
    { id: 9, name: "Blue", color: "#161de3" },
    { id: 10, name: "Purple", color: "#6b2cff" },
    { id: 11, name: "Pink", color: "#ff7eb6" },
    { id: 12, name: "Brown", color: "#583311" },
];

export class TextureAtlas {
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        this.tileSize = this.positiveInt(options.tileSize, 16);
        this.columns = this.positiveInt(options.columns, 4);
        this.rows = this.positiveInt(options.rows, 4);
        this.fallbackTileId = options.fallbackTileId ?? 1;
        this.texture = options.texture ?? null;

        this.tilesById = new Map();
        this.tilesByIndex = new Map();
        this.tilesByName = new Map();
        this.tilesByColor = new Map();
        this.tiles = this.tilesById;

        this.addTiles(options.tiles ?? DEFAULT_TEXTURE_ATLAS_COLORS);
        if (!this.texture && options.createDefaultTexture !== false) this.texture = this.createTexture();
    }

    addTiles(tiles = []) {
        tiles.forEach((tile, index) => this.addTile(tile, index));
        return this;
    }

    addTile(tile = {}, index = 0) {
        const normalized = this.normalizeTile(tile, index);
        this.tilesById.set(String(normalized.id), normalized);
        this.tilesByIndex.set(String(normalized.index), normalized);
        this.tilesByName.set(normalized.name, normalized);
        this.tilesByName.set(normalized.name.toLowerCase(), normalized);
        this.tilesByColor.set(this.normalizeColor(normalized.color), normalized);
        return normalized;
    }

    normalizeTile(tile = {}, index = 0) {
        const safeIndex = this.nonNegativeInt(tile.index ?? index, index);
        const id = tile.id ?? tile.voxelId ?? safeIndex + 1;
        const name = String(tile.name ?? id).trim() || String(id);
        const color = this.normalizeColor(tile.color ?? "#ffffff");

        return {
            ...tile,
            id,
            name,
            color,
            index: safeIndex,
            column: this.nonNegativeInt(tile.column ?? (safeIndex % this.columns), 0),
            row: this.nonNegativeInt(tile.row ?? Math.floor(safeIndex / this.columns), 0),
        };
    }

    createTexture() {
        const width = Math.max(1, this.columns * this.tileSize);
        const height = Math.max(1, this.rows * this.tileSize);
        const data = new Uint8Array(width * height * 4);
        this.fill(data, width, height, "#ffffff");

        this.getUniqueTiles().forEach((tile) => this.paintTile(data, width, height, tile));

        const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
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

    createMaterial(options = {}) {
        if (!this.hasValidTexture()) {
            return new THREE.MeshBasicMaterial({
                vertexColors: true,
                wireframe: options.wireframe ?? false,
            });
        }

        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            color: options.color ?? 0xffffff,
            vertexColors: false,
            wireframe: options.wireframe ?? false,
            transparent: options.transparent ?? false,
            alphaTest: options.alphaTest ?? 0,
            side: options.side ?? THREE.FrontSide,
        });

        material.name = options.name ?? "TextureAtlasMaterial";
        material.needsUpdate = true;
        return material;
    }

    getFaceData(voxel = null, direction = "", context = {}) {
        if (!this.enabled) return null;
        const tile = this.getVoxelFaceTile(voxel, direction, context);
        const greedyKey = `atlas:${tile?.id ?? this.fallbackTileId}`;

        return {
            textureAtlas: {
                tileId: tile.id,
                tileIndex: tile.index,
                tileName: tile.name,
                tileColor: tile.color,
                greedyKey,
            },
            greedyKey,
        };
    }

    getVoxelFaceTile(voxel = null, direction = "", context = {}) {
        const explicit = this.getVoxelFaceTileId(voxel, direction, context);
        return this.getTileById(context.voxelId)
            ?? this.getTile(explicit)
            ?? this.getTileByColor(voxel?.color)
            ?? this.getTileByName(voxel?.name)
            ?? this.getTile(this.fallbackTileId)
            ?? this.getFirstTile();
    }

    getVoxelFaceTileId(voxel = null, direction = "", context = {}) {
        const faceTiles = voxel?.faceTextureAtlasTiles
            ?? voxel?.faceTextureTiles
            ?? voxel?.atlasTiles
            ?? voxel?.textureTiles
            ?? null;

        if (faceTiles && typeof faceTiles === "object") {
            return faceTiles[direction]
                ?? faceTiles[this.directionFamily(direction)]
                ?? faceTiles.default
                ?? null;
        }

        return context.voxelId
            ?? voxel?.textureAtlasTile
            ?? voxel?.textureTile
            ?? voxel?.atlasTile
            ?? voxel?.tile
            ?? voxel?.id
            ?? voxel?.voxelId
            ?? voxel?.name
            ?? voxel?.color
            ?? null;
    }

    pushFaceUvs(target = [], face = {}) {
        const tile = this.getTileFromFace(face);
        const rect = this.getTileUvRect(tile);
        target.push(rect.u0, rect.v0, rect.u1, rect.v0, rect.u1, rect.v1, rect.u0, rect.v1);
        return target;
    }

    getTileFromFace(face = {}) {
        const atlas = face.textureAtlas ?? null;
        return this.getTileById(atlas?.tileId)
            ?? this.getTileByIndex(atlas?.tileIndex)
            ?? this.getTileByColor(face.color)
            ?? this.getTile(this.fallbackTileId)
            ?? this.getFirstTile();
    }

    getTileUvRect(tile = this.getFirstTile()) {
        const textureWidth = Math.max(1, this.columns * this.tileSize);
        const textureHeight = Math.max(1, this.rows * this.tileSize);
        const x = tile.column * this.tileSize;
        const y = tile.row * this.tileSize;
        const halfU = 0.5 / textureWidth;
        const halfV = 0.5 / textureHeight;

        return {
            u0: x / textureWidth + halfU,
            u1: (x + this.tileSize) / textureWidth - halfU,
            v0: y / textureHeight + halfV,
            v1: (y + this.tileSize) / textureHeight - halfV,
        };
    }

    paintTile(data, width, height, tile) {
        const x0 = tile.column * this.tileSize;
        const y0 = tile.row * this.tileSize;
        const color = this.bytes(tile.color);

        for (let y = 0; y < this.tileSize; y++) {
            for (let x = 0; x < this.tileSize; x++) {
                const px = x0 + x;
                const py = y0 + y;
                if (px < 0 || py < 0 || px >= width || py >= height) continue;
                const offset = (py * width + px) * 4;
                data[offset + 0] = color.r;
                data[offset + 1] = color.g;
                data[offset + 2] = color.b;
                data[offset + 3] = 255;
            }
        }
    }

    hasValidTexture() {
        const image = this.texture?.image ?? this.texture?.source?.data ?? null;
        const width = Number(image?.width ?? 0);
        const height = Number(image?.height ?? 0);
        return this.enabled === true && Boolean(this.texture) && width > 0 && height > 0;
    }

    directionFamily(direction = "") {
        if (direction === "py") return "top";
        if (direction === "ny") return "bottom";
        return "side";
    }

    getTile(tileId = null) {
        return this.getTileById(tileId) ?? this.getTileByName(tileId) ?? this.getTileByColor(tileId);
    }

    getTileById(id = null) {
        if (id === null || id === undefined || id === "") return null;
        return this.tilesById.get(String(id)) ?? null;
    }

    getTileByIndex(index = null) {
        if (index === null || index === undefined || index === "") return null;
        return this.tilesByIndex.get(String(index)) ?? null;
    }

    getTileByName(name = null) {
        if (name === null || name === undefined || name === "") return null;
        const key = String(name).trim();
        return this.tilesByName.get(key) ?? this.tilesByName.get(key.toLowerCase()) ?? null;
    }

    getTileByColor(color = "") {
        return this.tilesByColor.get(this.normalizeColor(color)) ?? null;
    }

    getFirstTile() {
        return this.getUniqueTiles()[0] ?? { id: 1, name: "White", color: "#ffffff", index: 0, column: 0, row: 0 };
    }

    getUniqueTiles() {
        return Array.from(this.tilesById.values()).sort((a, b) => a.index - b.index);
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

    bytes(color = "#ffffff") {
        const c = new THREE.Color(this.normalizeColor(color));
        return { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255) };
    }

    normalizeColor(color = "#ffffff") {
        if (typeof color !== "string") return "#ffffff";
        const value = color.trim().toLowerCase();
        return /^#[0-9a-f]{6}$/.test(value) ? value : "#ffffff";
    }

    positiveInt(value, fallback = 1) {
        const n = Math.floor(Number(value));
        return Number.isFinite(n) && n > 0 ? n : fallback;
    }

    nonNegativeInt(value, fallback = 0) {
        const n = Math.floor(Number(value));
        return Number.isFinite(n) && n >= 0 ? n : fallback;
    }

    dispose() {
        this.texture?.dispose?.();
    }
}

export default TextureAtlas;
