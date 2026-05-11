import * as THREE from "three";
import VoxelHighlight from "../Wabavam/Voxel/VoxelHighlight.js";

export class Raycast {
    constructor({ camera, scene, targets = [], interval = 1 / 20, cameraDistance = Infinity, onTargetChange = null }) {
        this.camera = camera;
        this.scene = scene;
        this.targets = targets;
        this.interval = interval;
        this.cameraDistance = cameraDistance;
        this.onTargetChange = onTargetChange;
        this.targetName = "none";
        this.elapsed = 0;
        this.raycaster = new THREE.Raycaster();
        this.playerRaycaster = new THREE.Raycaster();
        this.direction = new THREE.Vector3();
        this.playerDirection = new THREE.Vector3();
        this.playerOrigin = new THREE.Vector3();
        this.hitPoint = new THREE.Vector3();
        this.candidateTargets = [];
        this.highlight = new VoxelHighlight();
        this.hit = null;
        this.playerHit = null;
        this.holdTargetNameUntil = 0;
        this.lastStableHit = null;
        this.stableHighlightUntil = 0;

        this.scene.add(this.highlight.instance);
    }

    update(deltaTime = 0) {
        if (!this.camera || this.targets.length === 0) {
            this.hit = null;
            this.highlight.hide();
            return;
        }


        this.elapsed += deltaTime;
        if (this.elapsed < this.interval) return;
        this.elapsed = 0;

        const hit = this.castFromCamera(this.cameraDistance);

        this.showStableHighlight(hit);
    }

    refreshHighlight(distance = Infinity) {
        const hit = this.castFromCamera(distance);

        this.showStableHighlight(hit);
        this.elapsed = 0;
        return hit;
    }

    showStableHighlight(hit = null) {
        const exactHit = this.highlightHit(hit);

        if (this.isStableHighlightHit(exactHit)) {
            this.lastStableHit = exactHit;
            this.highlight.show(exactHit);
            return;
        }

        if (this.lastStableHit && performance.now() < this.stableHighlightUntil) {
            this.highlight.show(this.lastStableHit);
            return;
        }

        this.lastStableHit = null;
        this.highlight.hide();
    }

    highlightHit(hit = null) {
        if (!hit || !this.isActiveTarget(hit.object)) return null;
        if (this.isUsableVoxel(hit.voxel) && (hit.isExactVoxelHit)) return hit;

        const voxel = this.hitPointVoxel(hit);
        if (!this.isUsableVoxel(voxel)) return null;

        return {
            ...hit,
            voxel,
            isExactVoxelHit: true
        };
    }

    freezeHighlight(duration = 0.12) {
        this.stableHighlightUntil = performance.now() + Math.max(0, Number(duration) || 0) * 1000;

        const exactHit = this.highlightHit(this.hit);
        if (this.isStableHighlightHit(exactHit)) {
            this.lastStableHit = exactHit;
        }
    }

    isStableHighlightHit(hit = null) {
        const voxel = this.hitVoxel(hit);

        return Boolean(
            hit
            && this.isActiveTarget(hit.object)
            && voxel
            && this.isUsableVoxel(voxel)
            && this.hitBelongsToObject(hit, voxel)
        );
    }

    isUsableVoxel(voxel = null) {
        return Boolean(
            voxel
            && voxel.active !== false
            && voxel.position
            && Number.isFinite(Number(voxel.position.x))
            && Number.isFinite(Number(voxel.position.y))
            && Number.isFinite(Number(voxel.position.z))
        );
    }

    hitBelongsToObject(hit = null, voxel = null) {
        const boxel = hit?.object?.userData?.boxel;
        const size = hit?.object?.userData?.woxel?.boxelSize || 15;

        if (!boxel?.position || !voxel?.position) return true;

        return voxel.position.x >= boxel.position.x
            && voxel.position.y >= boxel.position.y
            && voxel.position.z >= boxel.position.z
            && voxel.position.x < boxel.position.x + size
            && voxel.position.y < boxel.position.y + size
            && voxel.position.z < boxel.position.z + size;
    }

    hitVoxel(hit = null) {
        if (!hit) return null;
        if (this.isUsableVoxel(hit.voxel)) return hit.voxel;

        const pointVoxel = this.hitPointVoxel(hit);
        if (this.isUsableVoxel(pointVoxel)) return pointVoxel;

        const faceVoxel = this.hitFaceVoxel(hit);
        if (this.isUsableVoxel(faceVoxel)) return faceVoxel;

        return null;
    }

    hideHighlight() {
        this.hit = null;
        this.lastStableHit = null;
        this.highlight.hide();
        this.elapsed = 0;
    }

    forceNextUpdate() {
        this.elapsed = this.interval;
    }

    holdTargetName(duration = 0.35) {
        this.holdTargetNameUntil = performance.now() + duration * 1000;
    }

    cast() {
        this.camera.getWorldDirection(this.direction);
        this.raycaster.set(this.camera.position, this.direction);

        const targets = this.activeTargets();
        const hit = this.closestHit(targets, Infinity);

        this.hit = hit || null;
        this.updateTarget(this.hit);
        return this.hit;
    }

    castFromCamera(distance = Infinity) {
        const targets = this.activeTargets();

        if (targets.length === 0) {
            this.hit = null;
            return null;
        }

        this.camera.getWorldDirection(this.direction);
        this.raycaster.set(this.camera.position, this.direction);
        this.raycaster.far = distance;

        const nearTargets = this.targetsNear(this.camera.position, distance);
        const hit = this.closestHit(nearTargets, distance);

        this.raycaster.far = Infinity;
        this.hit = hit || null;
        this.updateTarget(this.hit);
        return this.hit;
    }

    closestHit(targets = [], distance = Infinity) {
        const cleanTargets = targets.filter(target => !target.userData?.dirty);
        const [geometryHit] = this.raycaster.intersectObjects(cleanTargets, false);

        return this.exactGeometryHit(geometryHit);
    }

    exactGeometryHit(hit = null) {
        if (!hit || !this.isActiveTarget(hit.object)) return null;

        const voxel = this.hitPointVoxel(hit);
        if (!this.isUsableVoxel(voxel)) return null;

        return {
            ...hit,
            voxel,
            isExactVoxelHit: true
        };
    }

    updateTarget(hit) {
        const name = this.hitVoxelName(hit);

        if (name === "none" && performance.now() < this.holdTargetNameUntil) return;

        this.setTargetName(name);
    }

    activeTargets() {
        return this.targets.filter(target => this.isActiveTarget(target));
    }

    isActiveTarget(target = null) {
        if (!target) return false;
        if (target.userData?.raycastDisabled) return false;
        if (target.userData?.dirty) return false;
        if (!target.parent) return false;
        if (!target.geometry) return false;
        if (target.geometry.userData?.disposed) return false;
        if (!target.geometry.attributes?.position) return false;

        return true;
    }

    setTargetName(name = "none") {
        if (name === this.targetName) return;

        this.targetName = name;
        this.onTargetChange?.(name);
    }

    hitVoxelName(hit) {
        const voxel = this.hitVoxel(hit);

        return voxel?.name || "none";
    }

    hitPointVoxel(hit) {
        if (hit?.voxel) return hit.voxel;
        if (!hit.point || !hit.face?.normal) return null;

        const point = this.hitPoint.copy(hit.point).addScaledVector(hit.face.normal, -0.01);
        const position = hit.object.userData.toVoxelPosition?.(point);

        return position ? hit.object.userData.voxelAt?.(position) : null;
    }

    hitFaceVoxel(hit) {
        const faceIndex = Math.floor((hit.faceIndex ?? -1) / 2);

        return hit.object.userData.faceVoxels?.[faceIndex] || null;
    }

    castPlayerForward(player, distance = 7, height = 0.45, frontOffset = 0.35) {
        if (!player || this.targets.length === 0) return null;

        this.playerDirection.set(0, 0, -1).applyEuler(player.rotation).normalize();
        this.playerOrigin.copy(player.position).addScaledVector(this.playerDirection, frontOffset);
        this.playerOrigin.y += height;
        this.playerRaycaster.set(this.playerOrigin, this.playerDirection);
        this.playerRaycaster.far = distance;

        const [hit] = this.playerRaycaster.intersectObjects(this.targetsNear(this.playerOrigin, distance), false);

        this.playerHit = hit || null;
        return this.playerHit;
    }

    castPlayerStep(player, distance = 0.2) {
        if (!player || this.targets.length === 0 || !player.hasMovementInput()) return null;

        this.playerDirection.set(0, 0, -1).applyEuler(player.rotation).normalize();
        this.playerOrigin.copy(player.position).addScaledVector(this.playerDirection, 0.35);
        this.playerOrigin.y += 0.45;
        this.playerRaycaster.set(this.playerOrigin, this.playerDirection);
        this.playerRaycaster.far = distance;

        const [hit] = this.playerRaycaster.intersectObjects(this.targetsNear(this.playerOrigin, distance), false);

        return hit || null;
    }

    targetsNear(origin, distance = Infinity) {
        const targets = this.activeTargets();

        if (!Number.isFinite(distance)) return targets;

        this.candidateTargets.length = 0;
        targets.forEach(target => {
            const sphere = target.geometry?.boundingSphere;
            if (!sphere) {
                this.candidateTargets.push(target);
                return;
            }

            const radius = sphere.radius * Math.max(target.scale.x, target.scale.y, target.scale.z);
            const maxDistance = distance + radius;
            const dx = sphere.center.x + target.position.x - origin.x;
            const dy = sphere.center.y + target.position.y - origin.y;
            const dz = sphere.center.z + target.position.z - origin.z;

            if (dx * dx + dy * dy + dz * dz <= maxDistance * maxDistance) {
                this.candidateTargets.push(target);
            }
        });

        return this.candidateTargets;
    }
}

export default Raycast;


