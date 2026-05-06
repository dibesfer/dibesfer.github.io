import * as THREE from "three";

export class Boxel15Mesher {
    constructor(options = {}) {
        this.material = options.material ?? new THREE.MeshBasicMaterial({
            vertexColors: true,
        });

        this.directions = [
            { name: "px", normal: { x: 1, y: 0, z: 0 } },
            { name: "nx", normal: { x: -1, y: 0, z: 0 } },
            { name: "py", normal: { x: 0, y: 1, z: 0 } },
            { name: "ny", normal: { x: 0, y: -1, z: 0 } },
            { name: "pz", normal: { x: 0, y: 0, z: 1 } },
            { name: "nz", normal: { x: 0, y: 0, z: -1 } },
        ];
    }

    createMesh(boxel15, woxel = null) {
        if (!boxel15) return null;

        const visibleFaces = this.faceCulling(boxel15, woxel);
        const surfaceFaces = this.perFaceSurfaceRendering(visibleFaces);
        const greedyFaces = this.greedyMeshing(surfaceFaces);

        return this.buildMesh(greedyFaces, boxel15);
    }

    faceCulling(boxel15, woxel = null) {
        const faces = [];

        boxel15.forEachVoxel((voxel, localX, localY, localZ) => {
            if (!voxel?.isActive?.()) return;

            this.directions.forEach((direction) => {
                const neighborX = localX + direction.normal.x;
                const neighborY = localY + direction.normal.y;
                const neighborZ = localZ + direction.normal.z;

                if (this.isNeighborSolid(boxel15, woxel, neighborX, neighborY, neighborZ)) return;

                faces.push({
                    direction: direction.name,
                    x: boxel15.position.x + localX,
                    y: boxel15.position.y + localY,
                    z: boxel15.position.z + localZ,
                    color: voxel.color,
                });
            });
        });

        return faces;
    }

    perFaceSurfaceRendering(faces) {
        return faces.map((face) => ({
            ...face,
            width: 1,
            height: 1,
        }));
    }

    greedyMeshing(faces) {
        const groups = this.groupFacesForGreedy(faces);
        const mergedFaces = [];

        groups.forEach((groupFaces) => {
            const map = new Map();

            groupFaces.forEach((face) => {
                const key = `${face.u},${face.v}`;
                map.set(key, face);
            });

            groupFaces.forEach((face) => {
                if (face.used) return;

                let width = 1;
                let height = 1;

                while (this.canGrowWidth(map, face, width, height)) {
                    width++;
                }

                while (this.canGrowHeight(map, face, width, height)) {
                    height++;
                }

                this.markUsed(map, face, width, height);

                mergedFaces.push({
                    direction: face.direction,
                    plane: face.plane,
                    u: face.u,
                    v: face.v,
                    width,
                    height,
                    color: face.color,
                });
            });
        });

        return mergedFaces;
    }

    buildMesh(faces, boxel15) {
        const geometry = this.buildGeometry(faces);
        const mesh = new THREE.Mesh(geometry, this.material);

        mesh.name = `${boxel15.name} Mesh`;
        mesh.userData.boxel = boxel15;
        mesh.userData.faceCount = faces.length;

        return mesh;
    }

    buildGeometry(faces) {
        const positions = [];
        const colors = [];
        const indices = [];

        faces.forEach((face) => {
            const vertices = this.createFaceVertices(face);
            const color = new THREE.Color(face.color);
            const vertexStart = positions.length / 3;

            vertices.forEach((vertex) => {
                positions.push(vertex.x, vertex.y, vertex.z);
                colors.push(color.r, color.g, color.b);
            });

            indices.push(
                vertexStart,
                vertexStart + 1,
                vertexStart + 2,
                vertexStart,
                vertexStart + 2,
                vertexStart + 3
            );
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    createFaceVertices(face) {
        const p = face.plane;
        const u0 = face.u;
        const v0 = face.v;
        const u1 = face.u + face.width;
        const v1 = face.v + face.height;

        if (face.direction === "px") {
            return [
                { x: p, y: v0, z: u1 },
                { x: p, y: v0, z: u0 },
                { x: p, y: v1, z: u0 },
                { x: p, y: v1, z: u1 },
            ];
        }

        if (face.direction === "nx") {
            return [
                { x: p, y: v0, z: u0 },
                { x: p, y: v0, z: u1 },
                { x: p, y: v1, z: u1 },
                { x: p, y: v1, z: u0 },
            ];
        }
        if (face.direction === "py") {
            return [
                { x: u0, y: p, z: v1 },
                { x: u1, y: p, z: v1 },
                { x: u1, y: p, z: v0 },
                { x: u0, y: p, z: v0 },
            ];
        }

        if (face.direction === "ny") {
            return [
                { x: u0, y: p, z: v0 },
                { x: u1, y: p, z: v0 },
                { x: u1, y: p, z: v1 },
                { x: u0, y: p, z: v1 },
            ];
        }

        if (face.direction === "pz") {
            return [
                { x: u0, y: v0, z: p },
                { x: u1, y: v0, z: p },
                { x: u1, y: v1, z: p },
                { x: u0, y: v1, z: p },
            ];
        }

        return [
            { x: u1, y: v0, z: p },
            { x: u0, y: v0, z: p },
            { x: u0, y: v1, z: p },
            { x: u1, y: v1, z: p },
        ];
    }

    isNeighborSolid(boxel15, woxel, localX, localY, localZ) {
        const worldX = boxel15.position.x + localX;
        const worldY = boxel15.position.y + localY;
        const worldZ = boxel15.position.z + localZ;

        if (woxel && !woxel.isInside(worldX, worldY, worldZ)) {
            return false;
        }

        const neighbor = woxel
            ? woxel.getVoxelAt(worldX, worldY, worldZ)
            : boxel15.getVoxel(localX, localY, localZ);

        return neighbor?.isActive?.() === true;
    }

    groupFacesForGreedy(faces) {
        const groups = new Map();

        faces.forEach((face) => {
            const greedyFace = this.toGreedyFace(face);
            const key = `${greedyFace.direction}|${greedyFace.plane}|${greedyFace.color}`;

            if (!groups.has(key)) {
                groups.set(key, []);
            }

            groups.get(key).push(greedyFace);
        });

        return groups;
    }

    toGreedyFace(face) {
        if (face.direction === "px") return { ...face, plane: face.x + 1, u: face.z, v: face.y };
        if (face.direction === "nx") return { ...face, plane: face.x, u: face.z, v: face.y };
        if (face.direction === "py") return { ...face, plane: face.y + 1, u: face.x, v: face.z };
        if (face.direction === "ny") return { ...face, plane: face.y, u: face.x, v: face.z };
        if (face.direction === "pz") return { ...face, plane: face.z + 1, u: face.x, v: face.y };

        return { ...face, plane: face.z, u: face.x, v: face.y };
    }

    canGrowWidth(map, face, width, height) {
        for (let offsetV = 0; offsetV < height; offsetV++) {
            const next = map.get(`${face.u + width},${face.v + offsetV}`);
            if (!this.canMergeFace(next)) return false;
        }

        return true;
    }

    canGrowHeight(map, face, width, height) {
        for (let offsetU = 0; offsetU < width; offsetU++) {
            const next = map.get(`${face.u + offsetU},${face.v + height}`);
            if (!this.canMergeFace(next)) return false;
        }

        return true;
    }

    canMergeFace(face) {
        return Boolean(face) && face.used !== true;
    }

    markUsed(map, face, width, height) {
        for (let offsetU = 0; offsetU < width; offsetU++) {
            for (let offsetV = 0; offsetV < height; offsetV++) {
                const item = map.get(`${face.u + offsetU},${face.v + offsetV}`);
                if (item) item.used = true;
            }
        }
    }

    setWireframe(enabled = false) {
        this.material.wireframe = Boolean(enabled);
        this.material.needsUpdate = true;
    }

    dispose() {
        this.material?.dispose();
    }
}

export default Boxel15Mesher;
