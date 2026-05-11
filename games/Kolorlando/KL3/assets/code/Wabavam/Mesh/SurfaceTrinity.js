export class SurfaceTrinity {
    constructor(options = {}) {
        this.directions = options.directions ?? [
            { name: "px", normal: { x: 1, y: 0, z: 0 } },
            { name: "nx", normal: { x: -1, y: 0, z: 0 } },
            { name: "py", normal: { x: 0, y: 1, z: 0 } },
            { name: "ny", normal: { x: 0, y: -1, z: 0 } },
            { name: "pz", normal: { x: 0, y: 0, z: 1 } },
            { name: "nz", normal: { x: 0, y: 0, z: -1 } },
        ];
    }

    createFaces(source = {}) {
        const visibleFaces = this.faceCulling(source);
        const surfaceFaces = this.perFaceSurfaceRendering(visibleFaces);

        return this.greedyMeshing(surfaceFaces);
    }

    faceCulling(source = {}) {
        const faces = [];
        const forEachCell = source.forEachCell ?? (() => {});
        const isSolidAt = source.isSolidAt ?? (() => false);
        const getColor = source.getColor ?? ((cell) => cell?.color ?? "#ffffff");
        const origin = source.origin ?? { x: 0, y: 0, z: 0 };

        forEachCell((cell, localX, localY, localZ) => {
            this.directions.forEach((direction) => {
                const neighborX = localX + direction.normal.x;
                const neighborY = localY + direction.normal.y;
                const neighborZ = localZ + direction.normal.z;

                if (isSolidAt(neighborX, neighborY, neighborZ, direction, cell)) return;

                faces.push({
                    direction: direction.name,
                    x: origin.x + localX,
                    y: origin.y + localY,
                    z: origin.z + localZ,
                    color: getColor(cell, localX, localY, localZ),
                });
            });
        });

        return faces;
    }

    perFaceSurfaceRendering(faces = []) {
        return faces.map((face) => ({
            ...face,
            width: 1,
            height: 1,
        }));
    }

    greedyMeshing(faces = []) {
        const groups = this.groupFacesForGreedy(faces);
        const mergedFaces = [];

        Array.from(groups.keys())
            .sort(this.compareText)
            .forEach((key) => {
                mergedFaces.push(...this.greedyMeshGroup(groups.get(key)));
            });

        return mergedFaces;
    }

    greedyMeshGroup(groupFaces = []) {
        if (groupFaces.length === 0) return [];

        const faceMap = this.createFaceMap(groupFaces);
        const bounds = this.getFaceMapBounds(groupFaces);
        const used = new Set();
        const mergedFaces = [];

        for (let v = bounds.minV; v <= bounds.maxV; v++) {
            for (let u = bounds.minU; u <= bounds.maxU; u++) {
                const face = faceMap.get(this.uvKey(u, v));
                if (!this.canUseFace(face, used)) continue;

                const width = this.growWidth(faceMap, used, u, v, bounds.maxU);
                const height = this.growHeight(faceMap, used, u, v, width, bounds.maxV);

                this.markRectangleUsed(used, u, v, width, height);

                mergedFaces.push({
                    direction: face.direction,
                    plane: face.plane,
                    u,
                    v,
                    width,
                    height,
                    color: face.color,
                });
            }
        }

        return mergedFaces;
    }

    createFaceMap(faces = []) {
        const map = new Map();

        faces.forEach((face) => {
            map.set(this.uvKey(face.u, face.v), face);
        });

        return map;
    }

    getFaceMapBounds(faces = []) {
        return faces.reduce((bounds, face) => ({
            minU: Math.min(bounds.minU, face.u),
            maxU: Math.max(bounds.maxU, face.u),
            minV: Math.min(bounds.minV, face.v),
            maxV: Math.max(bounds.maxV, face.v),
        }), {
            minU: Infinity,
            maxU: -Infinity,
            minV: Infinity,
            maxV: -Infinity,
        });
    }

    growWidth(faceMap, used, startU, startV, maxU) {
        let width = 0;

        while (startU + width <= maxU) {
            const face = faceMap.get(this.uvKey(startU + width, startV));
            if (!this.canUseFace(face, used)) break;

            width++;
        }

        return width;
    }

    growHeight(faceMap, used, startU, startV, width, maxV) {
        let height = 1;

        while (startV + height <= maxV) {
            if (!this.canUseRow(faceMap, used, startU, startV + height, width)) break;

            height++;
        }

        return height;
    }

    canUseRow(faceMap, used, startU, rowV, width) {
        for (let offsetU = 0; offsetU < width; offsetU++) {
            const face = faceMap.get(this.uvKey(startU + offsetU, rowV));
            if (!this.canUseFace(face, used)) return false;
        }

        return true;
    }

    canUseFace(face, used) {
        if (!face) return false;

        return !used.has(this.uvKey(face.u, face.v));
    }

    markRectangleUsed(used, startU, startV, width, height) {
        for (let offsetV = 0; offsetV < height; offsetV++) {
            for (let offsetU = 0; offsetU < width; offsetU++) {
                used.add(this.uvKey(startU + offsetU, startV + offsetV));
            }
        }
    }

    uvKey(u, v) {
        return `${u},${v}`;
    }

    compareText(a, b) {
        return String(a).localeCompare(String(b));
    }

    groupFacesForGreedy(faces = []) {
        const groups = new Map();

        faces.forEach((face) => {
            const greedyFace = this.toGreedyFace(face);
            const key = this.createGreedyGroupKey(greedyFace);

            if (!groups.has(key)) {
                groups.set(key, []);
            }

            groups.get(key).push(greedyFace);
        });

        return groups;
    }

    createGreedyGroupKey(face) {
        return `${face.direction}|${face.plane}|${face.color}`;
    }

    toGreedyFace(face) {
        if (face.direction === "px") return { ...face, plane: face.x + 1, u: face.z, v: face.y };
        if (face.direction === "nx") return { ...face, plane: face.x, u: face.z, v: face.y };
        if (face.direction === "py") return { ...face, plane: face.y + 1, u: face.x, v: face.z };
        if (face.direction === "ny") return { ...face, plane: face.y, u: face.x, v: face.z };
        if (face.direction === "pz") return { ...face, plane: face.z + 1, u: face.x, v: face.y };

        return { ...face, plane: face.z, u: face.x, v: face.y };
    }
}

export default SurfaceTrinity;
