import * as THREE from "three";

import { Boxel15Mesher } from "../../Boxel15/Boxel15Mesher.js";
import { Compass } from "../../../Compass.js";
import { rotateVoxelOrientation } from "../../../Voxel/VoxelOrienting.js";

export class BoxelPreview {
    constructor(options = {}) {
        this.woxel = options.woxel ?? null;
        this.scale = options.scale ?? 1.1;
        this.opacity = options.opacity ?? 0.1;
        this.color = options.color ?? 0xffff00;
        this.depthWrite = options.depthWrite ?? false;

        this.group = new THREE.Group();
        this.group.name = "BoxelPreview";
        this.group.visible = false;
        this.group.userData.debugOnly = true;
        this.group.userData.highlightOnly = true;

        this.mesh = null;
        this.lastKey = "";

        this.boxelMaterial = options.boxelMaterial ?? new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: options.boxelOpacity ?? Math.max(this.opacity, 0.35),
            depthWrite: this.depthWrite,
        });
        this.boxelMesher = options.boxelMesher ?? new Boxel15Mesher({
            material: this.boxelMaterial,
        });
    }

    setWoxel(woxel) {
        this.woxel = woxel ?? null;
        this.hide();
    }

    show(area, options = {}) {
        if (!this.woxel || !area) return;

        const color = options.color ?? this.color;
        const key = `area|${area.key()}|${color}`;

        if (key !== this.lastKey) {
            this.rebuild(area, color);
            this.lastKey = key;
        }

        this.group.visible = true;
    }

    showBoxel(boxel, originPosition, options = {}) {
        if (!this.woxel || !boxel || !originPosition) return;

        const orientationDelta = Compass.normalize(options.orientationDelta ?? Compass.NORTH) ?? Compass.NORTH;
        const key = `boxel|${this.createBoxelKey(boxel)}|${this.positionKey(originPosition)}|${orientationDelta}`;

        if (key !== this.lastKey) {
            this.rebuildBoxel(boxel, originPosition, options);
            this.lastKey = key;
        }

        this.group.visible = true;
    }

    rebuild(area, color) {
        this.clearMesh();

        const min = area.getMin();
        const size = area.getSize();
        const geometry = this.createBoxGeometry(size);
        const material = this.createMaterial(color);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = "BoxelPreviewMesh";
        this.mesh.userData.debugOnly = true;
        this.mesh.userData.highlightOnly = true;

        const gamePosition = this.woxel.gridToGame(min);
        this.mesh.position.set(
            gamePosition.x + size.x / 2,
            gamePosition.y + size.y / 2,
            gamePosition.z + size.z / 2
        );

        this.group.add(this.mesh);
    }

    createBoxGeometry(size) {
        const padding = this.getScalePadding();

        const width = size.x + padding;
        const height = size.y + padding;
        const depth = size.z + padding;

        return new THREE.BoxGeometry(width, height, depth);
    }

    getScalePadding() {
        return Math.max(0, this.scale - 1);
    }

    rebuildBoxel(boxel, originPosition, options = {}) {
        this.clearMesh();

        const renderBoxel = this.createRenderBoxel(boxel, options);
        const mesh = this.boxelMesher.createMesh(renderBoxel, null);
        if (!mesh) return;

        mesh.name = "BoxelClipboardPreviewMesh";
        mesh.userData.debugOnly = true;
        mesh.userData.highlightOnly = true;

        const gamePosition = this.woxel.gridToGame(originPosition);
        mesh.position.set(gamePosition.x, gamePosition.y, gamePosition.z);

        this.mesh = mesh;
        this.group.add(this.mesh);
    }

    createRenderBoxel(boxel, options = {}) {
        const orientationDelta = Compass.normalize(options.orientationDelta ?? Compass.NORTH) ?? Compass.NORTH;

        if (typeof boxel.transformed === "function") {
            return boxel.transformed(orientationDelta, {
                name: `${boxel.name ?? "Boxel"} Preview`,
                position: { x: 0, y: 0, z: 0 },
            });
        }

        const clone = new boxel.constructor({
            name: `${boxel.name ?? "Boxel"} Preview`,
            size: Compass.rotateSize(boxel.size, orientationDelta),
            position: { x: 0, y: 0, z: 0 },
        });

        boxel.forEachVoxel((voxel, x, y, z) => {
            const position = Compass.rotatePositionInSize({ x, y, z }, boxel.size, orientationDelta);
            const cloneVoxel = voxel?.clone?.() ?? voxel;
            rotateVoxelOrientation(cloneVoxel, orientationDelta);

            clone.setVoxel(position.x, position.y, position.z, cloneVoxel);
        });

        return clone;
    }

    createMaterial(color) {
        return new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: this.opacity,
            side: THREE.DoubleSide,
            depthWrite: this.depthWrite,
        });
    }

    createBoxelKey(boxel) {
        const voxels = [];

        boxel.forEachVoxel((voxel, x, y, z) => {
            voxels.push(`${x},${y},${z},${voxel?.color ?? ""},${voxel?.orientable ?? voxel?.isOrientable?.() ?? false},${voxel?.orientation ?? ""}`);
        });

        return [
            boxel.size.x,
            boxel.size.y,
            boxel.size.z,
            voxels.sort().join(";"),
        ].join("|");
    }

    positionKey(position = {}) {
        return `${position.x},${position.y},${position.z}`;
    }

    hide() {
        this.group.visible = false;
        this.lastKey = "";
    }

    clearMesh() {
        if (!this.mesh) return;

        this.group.remove(this.mesh);
        this.mesh.geometry?.dispose?.();
        if (this.mesh.material !== this.boxelMaterial) {
            this.mesh.material?.dispose?.();
        }
        this.mesh = null;
    }

    getObject3D() {
        return this.group;
    }

    dispose() {
        this.clearMesh();
        this.boxelMesher?.dispose?.();
    }
}

export default BoxelPreview;