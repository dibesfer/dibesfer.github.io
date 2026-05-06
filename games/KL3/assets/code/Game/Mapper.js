import * as THREE from "three";

import { Boxel15Mesher } from "/assets/code/Wabavam/Boxel/Boxel15Mesher.js";
import { Woxel } from "/assets/code/Wabavam/Woxel/Woxel.js";
import { randomVoxel12 } from "/assets/code/Wabavam/Voxel/12colors/12colors.js";

export class Mapper {
    constructor(options = {}) {
        this.boxel15Mesher = options.boxel15Mesher ?? new Boxel15Mesher();

        this.meshes = [];
        this.boxel15Bounds = [];

        this.wireframeMode = false;
        this.debugBoundsVisible = false;

        this.debugBoundsColor = options.debugBoundsColor ?? 0xcfcfcf;
    }

    createDemoWoxel() {
        const woxel = new Woxel({
            name: "Demo Woxel100",
            size: { x: 45, y: 45, z: 45 },
            land: { x: 45, y: 10, z: 45 },
            spawnPosition: { x: 0, y: 10, z: 0 },
        });

        woxel.createRequiredBoxel15s();

        /*
            Debug fill switch.

            Normal land filling:
            this.fillWoxelLand(woxel);

            Random position filling:
            this.fillWoxelRandomPositions(woxel);
        */

        this.fillWoxelLand(woxel);
        // this.fillWoxelRandomPositions(woxel);

        return woxel;
    }

    fillWoxelLand(woxel) {
        const landX = Math.min(woxel.land.x, woxel.size.x);
        const landY = Math.min(woxel.land.y, woxel.size.y);
        const landZ = Math.min(woxel.land.z, woxel.size.z);

        for (let x = 0; x < landX; x++) {
            for (let y = 0; y < landY; y++) {
                for (let z = 0; z < landZ; z++) {
                    woxel.setVoxelAt(x, y, z, randomVoxel12());
                }
            }
        }
    }

    fillWoxelRandomPositions(woxel) {
        const targetVoxelCount = woxel.land.x * woxel.land.y * woxel.land.z;
        const maxVoxelCount = woxel.size.x * woxel.size.y * woxel.size.z;
        const voxelCount = Math.min(targetVoxelCount, maxVoxelCount);
        const usedPositions = new Set();

        while (usedPositions.size < voxelCount) {
            const x = this.randomInteger(0, woxel.size.x - 1);
            const y = this.randomInteger(0, woxel.size.y - 1);
            const z = this.randomInteger(0, woxel.size.z - 1);
            const key = `${x},${y},${z}`;

            if (usedPositions.has(key)) continue;

            usedPositions.add(key);
            woxel.setVoxelAt(x, y, z, randomVoxel12());
        }
    }

    randomInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    createWoxelObject3D(woxel) {
        const group = new THREE.Group();
        group.name = woxel?.name ?? "Woxel";

        this.meshes = [];
        this.boxel15Bounds = [];

        woxel?.forEachBoxel((boxel) => {
            const mesh = this.boxel15Mesher.createMesh(boxel, woxel);
            if (mesh) {
                this.meshes.push(mesh);
                group.add(mesh);
            }

            const bounds = this.createBoxel15Bounds(boxel);
            this.boxel15Bounds.push(bounds);
            group.add(bounds);
        });

        const gridOriginInGame = woxel?.getGridOriginAsGamePosition?.() ?? { x: 0, y: 0, z: 0 };
        group.position.set(gridOriginInGame.x, gridOriginInGame.y, gridOriginInGame.z);

        this.setWireframeMode(this.wireframeMode);

        return group;
    }

    createBoxel15Bounds(boxel15) {
        const min = new THREE.Vector3(
            boxel15.position.x,
            boxel15.position.y,
            boxel15.position.z
        );

        const max = new THREE.Vector3(
            boxel15.position.x + boxel15.size.x,
            boxel15.position.y + boxel15.size.y,
            boxel15.position.z + boxel15.size.z
        );

        const box = new THREE.Box3(min, max);
        const helper = new THREE.Box3Helper(box, this.debugBoundsColor);

        helper.name = `${boxel15.name} Debug Bounds`;
        helper.visible = this.debugBoundsVisible;
        helper.userData.boxel = boxel15;
        helper.userData.debugOnly = true;

        return helper;
    }

    setWireframeMode(enabled = false) {
        this.wireframeMode = Boolean(enabled);
        this.debugBoundsVisible = this.wireframeMode;

        this.boxel15Mesher.setWireframe(this.wireframeMode);
        this.setBoxel15BoundsVisible(this.debugBoundsVisible);
    }

    setBoxel15BoundsVisible(enabled = false) {
        this.debugBoundsVisible = Boolean(enabled);

        this.boxel15Bounds.forEach((bounds) => {
            bounds.visible = this.debugBoundsVisible;
        });
    }

    dispose() {
        this.meshes.forEach((mesh) => {
            mesh.geometry?.dispose();
        });

        this.boxel15Bounds.forEach((bounds) => {
            bounds.geometry?.dispose?.();
            bounds.material?.dispose?.();
        });

        this.meshes = [];
        this.boxel15Bounds = [];

        this.boxel15Mesher.dispose();
    }
}

export default Mapper;
