import * as THREE from "three";

import { SurfaceTrinity } from "../../Mesh/SurfaceTrinity.js";
import { TextureAtlas } from "../../Mesh/TextureAtlas.js";
import { FaceBaking } from "../../Mesh/FaceBaking.js";
import { MicroxelMesher } from "../../Microxel/MicroxelMesher.js";
import { createFaceShading, getFaceShade } from "../../Mesh/FaceShading.js";

export class Boxel15Mesher {
    constructor(options = {}) {
        this.surfaceTrinity = options.surfaceTrinity ?? new SurfaceTrinity(options.surfaceTrinityOptions ?? {});
        this.faceShading = createFaceShading(options.faceShading ?? {});
        this.textureAtlas = options.textureAtlas === false
            ? null
            : options.textureAtlas ?? new TextureAtlas(options.textureAtlasOptions ?? {});
        this.faceBaking = options.faceBaking === false
            ? null
            : options.faceBaking ?? new FaceBaking({
                ...(options.faceBakingOptions ?? {}),
                faceShading: this.faceShading,
            });

        // Atlas material stays opt-in. Default KL3 debug/normal render remains vertex-color safe.
        this.useTextureAtlasMaterial = Boolean(options.useTextureAtlasMaterial ?? false);
        this.material = options.material ?? this.createDefaultMaterial(options.materialOptions ?? {});

        this.microxelMesher = options.microxelMesher ?? new MicroxelMesher({
            surfaceTrinity: this.surfaceTrinity,
            textureAtlas: this.textureAtlas,
            faceBaking: options.microxelFaceBaking ?? true,
            pixelScale: options.microxelFaceBakingPixelScale ?? 4,
            maxTextureSize: options.microxelFaceBakingMaxTextureSize ?? 512,
            faceShading: this.faceShading,
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

    createMesh(boxel15, woxel = null, options = {}) {
        if (!boxel15) return null;

        const allowFaceBaking = options.allowFaceBaking ?? true;
        const surfaceSource = this.createSurfaceSource(boxel15, woxel);
        const visibleSurfaceFaces = this.surfaceTrinity.perFaceSurfaceRendering(
            this.surfaceTrinity.faceCulling(surfaceSource)
        );
        const microxelResult = this.createMicroxelRenderParts(boxel15, woxel);
        const baked = allowFaceBaking
            ? this.tryFaceBaking(boxel15, woxel, visibleSurfaceFaces)
            : null;

        if (!baked) {
            const surfaceFaces = this.surfaceTrinity.greedyMeshing(visibleSurfaceFaces);
            const surfaceMesh = this.buildMesh([
                ...surfaceFaces,
                ...microxelResult.faces,
            ], boxel15);

            if (microxelResult.meshes.length === 0) return surfaceMesh;
            return this.createMeshGroup(boxel15, surfaceMesh, microxelResult);
        }

        if (microxelResult.faces.length === 0 && microxelResult.meshes.length === 0) return baked;

        const microxelFallbackMesh = this.buildMesh(microxelResult.faces, boxel15);
        const microxelMeshes = microxelFallbackMesh
            ? [microxelFallbackMesh, ...microxelResult.meshes]
            : microxelResult.meshes;

        return this.createMeshGroup(boxel15, baked, { faces: [], meshes: microxelMeshes });
    }

    createMeshGroup(boxel15, surfaceMesh = null, microxelResult = { faces: [], meshes: [] }) {
        const group = new THREE.Group();
        group.name = `${boxel15.name} Mesh Group`;
        group.userData.boxel = boxel15;
        group.userData.faceBaked = surfaceMesh?.userData?.faceBaked === true
            || microxelResult.meshes.some((mesh) => mesh.userData?.faceBaked === true);
        group.userData.microxelFaceBaked = microxelResult.meshes.some((mesh) => mesh.userData?.microxelFaceBaked === true);
        group.userData.faceCount = (surfaceMesh?.userData?.faceCount ?? 0)
            + microxelResult.meshes.reduce((sum, mesh) => sum + (mesh.userData?.faceCount ?? 0), 0);
        group.userData.originalVisibleFaceCount = (surfaceMesh?.userData?.originalVisibleFaceCount ?? 0)
            + microxelResult.meshes.reduce((sum, mesh) => sum + (mesh.userData?.originalVisibleFaceCount ?? 0), 0);
        group.userData.boxel15Visible = true;
        group.userData.boxel15Raycastable = true;
        group.userData.textureAtlas = false;

        if (surfaceMesh) group.add(surfaceMesh);
        microxelResult.meshes.forEach((mesh) => group.add(mesh));

        return group;
    }

    tryFaceBaking(boxel15, woxel = null, visibleFaces = null) {
        if (!this.faceBaking) return null;

        try {
            return this.faceBaking.createMesh(boxel15, woxel, {
                visibleFaces,
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
                this.forEachRenderableVoxel(boxel15, woxel, (voxel, voxelId, localX, localY, localZ) => {
                    callback({ voxel, voxelId }, localX, localY, localZ);
                }, { skipMicroxels: true });
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

    forEachRenderableVoxel(boxel15, woxel = null, callback = () => {}, options = {}) {
        const skipMicroxels = options.skipMicroxels ?? false;
        const palette = woxel?.palette ?? boxel15?.palette ?? null;

        if (typeof boxel15?.forEachVoxelId === "function") {
            boxel15.forEachVoxelId((voxelId, localX, localY, localZ) => {
                const voxel = boxel15.getVoxel(localX, localY, localZ, palette);
                if (!voxel?.isActive?.()) return;
                if (skipMicroxels && voxel?.hasMicroxels?.()) return;

                callback(voxel, voxelId, localX, localY, localZ, boxel15);
            });
            return;
        }

        if (typeof boxel15?.forEachVoxel === "function") {
            boxel15.forEachVoxel((voxel, localX, localY, localZ) => {
                if (!voxel?.isActive?.()) return;
                if (skipMicroxels && voxel?.hasMicroxels?.()) return;

                callback(voxel, null, localX, localY, localZ, boxel15);
            });
        }
    }

    createMicroxelRenderParts(boxel15, woxel = null) {
        const faces = [];
        const meshes = [];

        boxel15.forEachVoxel((voxel, localX, localY, localZ) => {
            if (!voxel?.isActive?.()) return;
            if (!voxel?.hasMicroxels?.()) return;

            const origin = {
                x: boxel15.position.x + localX,
                y: boxel15.position.y + localY,
                z: boxel15.position.z + localZ,
            };
            const context = {
                isWorldVoxelSolid: (worldX, worldY, worldZ) => this.isWorldVoxelSolid(boxel15, woxel, worldX, worldY, worldZ),
            };
            const baked = this.microxelMesher.createMesh(voxel, origin, context);

            if (baked) {
                meshes.push(baked);
                return;
            }

            faces.push(...this.microxelMesher.createFaces(voxel, origin, context));
        });

        return { faces, meshes };
    }

    createMicroxelFaces(boxel15, woxel = null) {
        return this.createMicroxelRenderParts(boxel15, woxel).faces;
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
        if (!faces || faces.length === 0) return null;

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

        return this.isSolidMacroVoxel(neighbor);
    }

    isSolidMacroVoxel(voxel = null) {
        return voxel?.isActive?.() === true && voxel?.hasMicroxels?.() !== true;
    }


    isWorldVoxelSolid(boxel15, woxel, worldX, worldY, worldZ) {
        if (woxel) {
            if (!woxel.isInside(worldX, worldY, worldZ)) return false;
            return this.isSolidMacroVoxel(woxel.getVoxelAt(worldX, worldY, worldZ));
        }

        const localX = worldX - boxel15.position.x;
        const localY = worldY - boxel15.position.y;
        const localZ = worldZ - boxel15.position.z;

        if (localX < 0 || localY < 0 || localZ < 0) return false;
        if (localX >= boxel15.size.x || localY >= boxel15.size.y || localZ >= boxel15.size.z) return false;

        return this.isSolidMacroVoxel(boxel15.getVoxel(localX, localY, localZ));
    }

    getFaceShade(direction = "") {
        return getFaceShade(direction, this.faceShading);
    }

    setWireframe(enabled = false) {
        this.material.wireframe = Boolean(enabled);
        this.material.needsUpdate = true;
        this.faceBaking?.setWireframe?.(enabled);
        this.microxelMesher?.setWireframe?.(enabled);
    }

    dispose() {
        this.material?.dispose?.();
        this.textureAtlas?.dispose?.();
        this.faceBaking?.dispose?.();
        this.microxelMesher?.dispose?.();
    }
}

export default Boxel15Mesher;
