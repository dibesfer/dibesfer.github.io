import * as THREE from "three";

import { Compass } from "../../../Compass.js";

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
        this.lastGeometryKey = "";
    }

    setWoxel(woxel) {
        this.woxel = woxel ?? null;
        this.hide();
    }

    show(area, options = {}) {
        if (!this.woxel || !area) return;

        const color = options.color ?? this.color;
        const opacity = options.opacity ?? this.opacity;
        const min = area.getMin();
        const size = area.getSize();

        this.showBounds(min, size, { color, opacity });
    }

    showBoxel(boxel, originPosition, options = {}) {
        return this.showBoxelBounds(boxel, originPosition, options);
    }

    showBoxelBounds(boxel, originPosition, options = {}) {
        if (!this.woxel || !boxel || !originPosition) return;

        const orientationDelta = Compass.normalize(options.orientationDelta ?? Compass.NORTH) ?? Compass.NORTH;
        const size = Compass.rotateSize(boxel.size, orientationDelta);
        const color = options.color ?? this.color;
        const opacity = options.opacity ?? this.opacity;

        this.showBounds(originPosition, size, { color, opacity });
    }

    showBounds(originPosition, size, options = {}) {
        if (!this.woxel || !originPosition || !size) return;

        const color = options.color ?? this.color;
        const opacity = options.opacity ?? this.opacity;
        const geometryKey = this.createGeometryKey(size, color, opacity);

        if (geometryKey !== this.lastGeometryKey) {
            this.rebuild(size, color, opacity);
            this.lastGeometryKey = geometryKey;
        }

        this.positionMesh(originPosition, size);
        this.group.visible = true;
    }

    rebuild(size, color, opacity = this.opacity) {
        this.clearMesh();

        const geometry = this.createBoxGeometry(size);
        const material = this.createMaterial(color, opacity);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = "BoxelPreviewMesh";
        this.mesh.userData.debugOnly = true;
        this.mesh.userData.highlightOnly = true;

        this.group.add(this.mesh);
    }

    positionMesh(originPosition, size) {
        if (!this.mesh || !this.woxel || !originPosition || !size) return;

        const gamePosition = this.woxel.gridToGame(originPosition);
        this.mesh.position.set(
            gamePosition.x + size.x / 2,
            gamePosition.y + size.y / 2,
            gamePosition.z + size.z / 2
        );
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

    createMaterial(color, opacity = this.opacity) {
        return new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            side: THREE.DoubleSide,
            depthWrite: this.depthWrite,
        });
    }

    createGeometryKey(size = {}, color = this.color, opacity = this.opacity) {
        return [
            "bounds",
            size.x ?? 0,
            size.y ?? 0,
            size.z ?? 0,
            color,
            this.scale,
            opacity,
            this.depthWrite ? 1 : 0,
        ].join("|");
    }

    hide() {
        this.group.visible = false;
    }

    clearMesh() {
        if (!this.mesh) return;

        this.group.remove(this.mesh);
        this.mesh.geometry?.dispose?.();
        this.mesh.material?.dispose?.();
        this.mesh = null;
        this.lastGeometryKey = "";
    }

    getObject3D() {
        return this.group;
    }

    dispose() {
        this.clearMesh();
    }
}

export default BoxelPreview;
