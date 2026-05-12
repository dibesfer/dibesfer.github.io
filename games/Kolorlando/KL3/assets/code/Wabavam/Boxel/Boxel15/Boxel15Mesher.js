import * as THREE from "three";

import { SurfaceTrinity } from "../../Mesh/SurfaceTrinity.js";
import { TextureAtlas } from "../../Mesh/TextureAtlas.js";
import { FaceBaking } from "../../Mesh/FaceBaking.js";
import { MicroxelMesher } from "../../Microxel/MicroxelMesher.js";

export class Boxel15Mesher {
    constructor(options = {}) {
        this.surfaceTrinity = options.surfaceTrinity ?? new SurfaceTrinity(options.surfaceTrinityOptions ?? {});
        this.textureAtlas = options.textureAtlas === false
            ? null
            : options.textureAtlas ?? new TextureAtlas(options.textureAtlasOptions ?? {});
        this.faceBaking = options.faceBaking === false
            ? null
            : options.faceBaking ?? new FaceBaking(options.faceBakingOptions ?? {});

        // Atlas material stays opt-in. Default KL3 debug/normal render remains vertex-color safe.
        this.useTextureAtlasMaterial = Boolean(options.useTextureAtlasMaterial ?? false);
        this.material = options.material ?? this.createDefaultMaterial(options.materialOptions ?? {});

        this.faceShading = {
            px: options.faceShading?.px ?? 0.5,
            nx: options.faceShading?.nx ?? 0.4,
            py: options.faceShading?.py ?? 1.0,
            ny: options.faceShading?.ny ?? 0.2,
            pz: options.faceShading?.pz ?? 0.3,
            nz: options.faceShading?.nz ?? 0.6,
        };

        this.microxelMesher = options.microxelMesher ?? new MicroxelMesher({
            surfaceTrinity: this.surfaceTrinity,
        });

        this.directions = this.surfaceTrinity.directions;
    }

    createDefaultMaterial(options = {}) {
        if (this.useTextureAtlasMaterial && this.textureAtlas?.hasValidTexture?.()) {
            return this.textureAtlas.createMaterial({
                vertexColors: false,
                wireframe: options.wireframe ?? false,
                transparent: options.transparent ?? false,
                alphaTest: options.alphaTest ?? 0,
            });
        }

        return new THREE.MeshBasicMaterial({
            vertexColors: true,
            wireframe: options.wireframe ?? false,
        });
    }

    createMesh(boxel15, woxel = null) {
        if (!boxel15) return null;

        const baked = this.tryFaceBaking(boxel15, woxel);
        if (baked) return baked;

        const voxelFaces = this.surfaceTrinity.createFaces(this.createSurfaceSource(boxel15, woxel));
        const microxelFaces = this.createMicroxelFaces(boxel15, woxel);
        return this.buildMesh([...voxelFaces, ...microxelFaces], boxel15);
    }

    tryFaceBaking(boxel15, woxel = null) {
        if (!this.faceBaking) return null;

        try {
            return this.faceBaking.createMesh(boxel15, woxel, {
                materialOptions: { wireframe: this.material?.wireframe === true },
            });
        } catch (error) {
            console.warn("FaceBaking fallback:", error);
            return null;
        }
    }

    createSurfaceSource(boxel15, woxel = null) {
        return {
            origin: boxel15.position,
            forEachCell: (callback) => {
                boxel15.forEachVoxelId((voxelId, localX, localY, localZ) => {
                    const voxel = boxel15.getVoxel(localX, localY, localZ, woxel?.palette ?? boxel15.palette);
                    if (!voxel?.isActive?.()) return;
                    if (voxel?.hasMicroxels?.()) return;
                    callback({ voxel, voxelId }, localX, localY, localZ);
                });
            },
            isSolidAt: (localX, localY, localZ) => this.isNeighborSolid(boxel15, woxel, localX, localY, localZ),
            getColor: (cell) => cell?.voxel?.color ?? cell?.color ?? "#ffffff",
            getFaceData: (cell, direction, localX, localY, localZ) => {
                return this.textureAtlas?.getFaceData?.(cell?.voxel ?? cell, direction?.name ?? direction, {
                    voxelId: cell?.voxelId ?? null,
                    localX,
                    localY,
                    localZ,
                    boxel15,
                    woxel,
                }) ?? null;
            },
        };
    }

    createMicroxelFaces(boxel15, woxel = null) {
        const faces = [];

        boxel15.forEachVoxel((voxel, localX, localY, localZ) => {
            if (!voxel?.isActive?.()) return;
            if (!voxel?.hasMicroxels?.()) return;

            faces.push(...this.microxelMesher.createFaces(voxel, {
                x: boxel15.position.x + localX,
                y: boxel15.position.y + localY,
                z: boxel15.position.z + localZ,
            }, {
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
        mesh.userData.faceBaked = false;
        mesh.userData.faceCount = faces.length;
        mesh.userData.originalVisibleFaceCount = faces.length;
        mesh.userData.boxel15Visible = true;
        mesh.userData.boxel15Raycastable = true;
        mesh.userData.textureAtlas = this.useTextureAtlasMaterial && this.textureAtlas?.enabled === true;

        return mesh;
    }

    buildGeometry(faces = []) {
        const positions = [];
        const colors = [];
        const uvs = [];
        const indices = [];
        const useAtlas = this.useTextureAtlasMaterial && this.textureAtlas?.hasValidTexture?.() === true;

        faces.forEach((face) => {
            const start = positions.length / 3;
            const vertices = this.createFaceVertices(face);
            const color = new THREE.Color(face.color ?? "#ffffff").multiplyScalar(this.getFaceShade(face.direction));

            vertices.forEach((vertex) => {
                positions.push(vertex.x, vertex.y, vertex.z);
                colors.push(color.r, color.g, color.b);
            });

            if (useAtlas) this.textureAtlas.pushFaceUvs(uvs, this.ensureFaceTextureAtlas(face));
            indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        if (useAtlas) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    ensureFaceTextureAtlas(face = {}) {
        if (face.textureAtlas) return face;
        const data = this.textureAtlas?.getFaceData?.({ color: face.color, name: face.color }, face.direction);
        return { ...face, textureAtlas: data?.textureAtlas ?? null };
    }

    createFaceVertices(face) {
        const p = face.plane;
        const u0 = face.u;
        const v0 = face.v;
        const u1 = face.u + face.width;
        const v1 = face.v + face.height;

        if (face.direction === "px") return [{ x: p, y: v0, z: u1 }, { x: p, y: v0, z: u0 }, { x: p, y: v1, z: u0 }, { x: p, y: v1, z: u1 }];
        if (face.direction === "nx") return [{ x: p, y: v0, z: u0 }, { x: p, y: v0, z: u1 }, { x: p, y: v1, z: u1 }, { x: p, y: v1, z: u0 }];
        if (face.direction === "py") return [{ x: u0, y: p, z: v1 }, { x: u1, y: p, z: v1 }, { x: u1, y: p, z: v0 }, { x: u0, y: p, z: v0 }];
        if (face.direction === "ny") return [{ x: u0, y: p, z: v0 }, { x: u1, y: p, z: v0 }, { x: u1, y: p, z: v1 }, { x: u0, y: p, z: v1 }];
        if (face.direction === "pz") return [{ x: u0, y: v0, z: p }, { x: u1, y: v0, z: p }, { x: u1, y: v1, z: p }, { x: u0, y: v1, z: p }];
        return [{ x: u1, y: v0, z: p }, { x: u0, y: v0, z: p }, { x: u0, y: v1, z: p }, { x: u1, y: v1, z: p }];
    }

    isNeighborSolid(boxel15, woxel, localX, localY, localZ) {
        const worldX = boxel15.position.x + localX;
        const worldY = boxel15.position.y + localY;
        const worldZ = boxel15.position.z + localZ;

        if (woxel && !woxel.isInside(worldX, worldY, worldZ)) return false;

        const neighbor = woxel
            ? woxel.getVoxelAt(worldX, worldY, worldZ)
            : boxel15.getVoxel(localX, localY, localZ);

        return neighbor?.isActive?.() === true && neighbor?.hasMicroxels?.() !== true;
    }

    getFaceShade(direction = "") {
        return this.faceShading[direction] ?? 1;
    }

    setWireframe(enabled = false) {
        this.material.wireframe = Boolean(enabled);
        this.material.needsUpdate = true;
        this.faceBaking?.setWireframe?.(enabled);
    }

    dispose() {
        this.material?.dispose?.();
        this.textureAtlas?.dispose?.();
        this.faceBaking?.dispose?.();
    }
}

export default Boxel15Mesher;
