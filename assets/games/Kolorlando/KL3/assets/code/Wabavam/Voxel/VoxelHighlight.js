import * as THREE from "three";

import { Highlighting } from "../Highlighting.js";

export class VoxelHighlight {
    constructor(options = {}) {
        this.woxel = options.woxel ?? null;
        this.highlighting = options.highlighting ?? new Highlighting(options.highlightingOptions ?? {});
        const style = this.highlighting.getVoxelOptions(options);

        this.color = style.color;
        this.opacity = style.opacity;
        this.planeOpacity = style.planeOpacity;
        this.scale = style.scale;
        this.planeOffset = style.planeOffset;
        this.depthWrite = style.depthWrite;

        this.group = new THREE.Group();
        this.group.name = "VoxelHighlight";
        this.group.visible = false;
        this.group.userData.debugOnly = true;
        this.group.userData.highlightOnly = true;

        this.voxelMesh = this.createVoxelMesh();
        this.planeMesh = this.createPlaneMesh();

        this.group.add(this.voxelMesh);
        this.group.add(this.planeMesh);

        this.lastKey = "";
        this.normal = new THREE.Vector3(0, 1, 0);
        this.planeNormal = new THREE.Vector3(0, 0, 1);
    }

    setWoxel(woxel) {
        this.woxel = woxel ?? null;
        this.hide();
    }

    createVoxelMesh() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: this.opacity,
            side: THREE.DoubleSide,
            depthWrite: this.depthWrite,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "VoxelHighlightBox";
        mesh.scale.setScalar(this.scale);
        mesh.userData.highlightOnly = true;

        return mesh;
    }

    createPlaneMesh() {
        const geometry = new THREE.PlaneGeometry(this.scale, this.scale);
        const material = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: this.planeOpacity,
            side: THREE.DoubleSide,
            depthWrite: true,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "PlaneHighlight";
        mesh.userData.highlightOnly = true;

        return mesh;
    }

    update(target = null) {
        if (!target?.voxel || !target?.gridPosition) {
            this.hide();
            return;
        }

        this.showAt(target.gridPosition, this.getTargetNormal(target));
    }

    showAt(gridPosition, normal = this.normal) {
        if (!this.woxel) return;

        const key = this.createTargetKey(gridPosition, normal);
        if (key === this.lastKey && this.group.visible) return;

        const gamePosition = this.woxel.gridToGame(gridPosition);

        this.group.position.set(
            gamePosition.x + 0.5,
            gamePosition.y + 0.5,
            gamePosition.z + 0.5
        );

        this.normal.copy(normal).normalize();
        this.positionPlane(this.normal);

        this.group.visible = true;
        this.lastKey = key;
    }

    hide() {
        this.group.visible = false;
        this.lastKey = "";
    }

    getTargetNormal(target) {
        if (target.faceNormal) {
            return this.cardinalizeNormal(target.faceNormal);
        }

        if (!target.hit?.face?.normal || !target.hit?.object?.matrixWorld) {
            return this.normal.set(0, 1, 0);
        }

        this.normal
            .copy(target.hit.face.normal)
            .transformDirection(target.hit.object.matrixWorld);

        return this.cardinalizeNormal(this.normal);
    }

    cardinalizeNormal(normal = null) {
        if (!normal) return this.normal.set(0, 1, 0);

        const x = Math.abs(normal.x ?? 0);
        const y = Math.abs(normal.y ?? 0);
        const z = Math.abs(normal.z ?? 0);

        this.normal.set(0, 0, 0);

        if (x >= y && x >= z) {
            this.normal.x = Math.sign(normal.x || 1);
            return this.normal;
        }

        if (y >= x && y >= z) {
            this.normal.y = Math.sign(normal.y || 1);
            return this.normal;
        }

        this.normal.z = Math.sign(normal.z || 1);
        return this.normal;
    }

    positionPlane(normal) {
        this.planeMesh.position.copy(normal).multiplyScalar((this.scale / 2) + this.planeOffset);
        this.planeMesh.quaternion.setFromUnitVectors(this.planeNormal, normal);
    }

    createTargetKey(gridPosition, normal) {
        return [
            gridPosition.x,
            gridPosition.y,
            gridPosition.z,
            Math.round(normal.x),
            Math.round(normal.y),
            Math.round(normal.z),
        ].join(",");
    }

    getObject3D() {
        return this.group;
    }

    dispose() {
        this.voxelMesh.geometry?.dispose?.();
        this.voxelMesh.material?.dispose?.();

        this.planeMesh.geometry?.dispose?.();
        this.planeMesh.material?.dispose?.();
    }
}

export default VoxelHighlight;
