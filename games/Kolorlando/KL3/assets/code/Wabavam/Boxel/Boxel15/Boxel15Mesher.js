import * as THREE from "three";

import { SurfaceTrinity } from "../../Mesh/SurfaceTrinity.js";
import { MicroxelMesher } from "../../Microxel/MicroxelMesher.js";

export class Boxel15Mesher {
    constructor(options = {}) {
        this.material = options.material ?? new THREE.MeshBasicMaterial({
            vertexColors: true,
        });

        this.faceShading = {
            px: options.faceShading?.px ?? 0.5,
            nx: options.faceShading?.nx ?? 0.4,
            py: options.faceShading?.py ?? 1.0,
            ny: options.faceShading?.ny ?? 0.2,
            pz: options.faceShading?.pz ?? 0.3,
            nz: options.faceShading?.nz ?? 0.6,
        };

        this.surfaceTrinity = options.surfaceTrinity ?? new SurfaceTrinity(options.surfaceTrinityOptions ?? {});
        this.microxelMesher = options.microxelMesher ?? new MicroxelMesher({
            surfaceTrinity: this.surfaceTrinity,
        });
        this.directions = this.surfaceTrinity.directions;
    }

    createMesh(boxel15, woxel = null) {
        if (!boxel15) return null;

        const voxelFaces = this.surfaceTrinity.createFaces(this.createSurfaceSource(boxel15, woxel));
        const microxelFaces = this.createMicroxelFaces(boxel15, woxel);

        return this.buildMesh([...voxelFaces, ...microxelFaces], boxel15);
    }

    createSurfaceSource(boxel15, woxel = null) {
        return {
            origin: boxel15.position,
            forEachCell: (callback) => {
                boxel15.forEachVoxel((voxel, localX, localY, localZ) => {
                    if (!voxel?.isActive?.()) return;
                    if (voxel?.hasMicroxels?.()) return;

                    callback(voxel, localX, localY, localZ);
                });
            },
            isSolidAt: (localX, localY, localZ) => {
                return this.isNeighborSolid(boxel15, woxel, localX, localY, localZ);
            },
            getColor: (voxel) => voxel?.color ?? "#ffffff",
        };
    }

    createMicroxelFaces(boxel15, woxel = null) {
        const faces = [];

        boxel15.forEachVoxel((voxel, localX, localY, localZ) => {
            if (!voxel?.isActive?.()) return;
            if (!voxel?.hasMicroxels?.()) return;

            const worldPosition = {
                x: boxel15.position.x + localX,
                y: boxel15.position.y + localY,
                z: boxel15.position.z + localZ,
            };

            faces.push(...this.microxelMesher.createFaces(voxel, worldPosition, {
                isWorldVoxelSolid: () => false,
            }));
        });

        return faces;
    }

    faceCulling(boxel15, woxel = null) {
        return this.surfaceTrinity.faceCulling(this.createSurfaceSource(boxel15, woxel));
    }

    perFaceSurfaceRendering(faces) {
        return this.surfaceTrinity.perFaceSurfaceRendering(faces);
    }

    greedyMeshing(faces) {
        return this.surfaceTrinity.greedyMeshing(faces);
    }

    buildMesh(faces, boxel15) {
        const geometry = this.buildGeometry(faces);
        const mesh = new THREE.Mesh(geometry, this.material);

        mesh.name = `${boxel15.name} Mesh`;
        mesh.userData.boxel = boxel15;
        mesh.userData.faceCount = faces.length;
        mesh.userData.boxel15Visible = true;
        mesh.userData.boxel15Raycastable = true;

        return mesh;
    }

    buildGeometry(faces) {
        const positions = [];
        const colors = [];
        const indices = [];

        faces.forEach((face) => {
            const vertices = this.createFaceVertices(face);
            const color = this.createShadedFaceColor(face);
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

    createShadedFaceColor(face) {
        const shade = this.getFaceShade(face.direction);

        return new THREE.Color(face.color).multiplyScalar(shade);
    }

    getFaceShade(direction = "") {
        return this.faceShading[direction] ?? 1;
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

        if (!neighbor?.isActive?.()) return false;

        return neighbor?.hasMicroxels?.() !== true;
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
