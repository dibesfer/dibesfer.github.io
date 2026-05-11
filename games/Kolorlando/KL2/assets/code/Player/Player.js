import * as THREE from "three";
import { voxelItems12 } from "../Item/Item.js";
import Inventory from "../Inventory/Inventory.js";
import { desiredOrientationFromCameraYaw } from "../Wabavam/Voxel/Orientation.js";

export class Player {
    constructor({ position = new THREE.Vector3(), rotation = new THREE.Euler(), input = null, groundTargets = [], mapper = null } = {}) {
        this.position = position.clone();
        this.previousPosition = position.clone();
        this.rotation = rotation.clone();
        this.cameraDirection = this.rotation.y;
        this.desiredOrientation = desiredOrientationFromCameraYaw(this.cameraDirection);
        this.input = input;
        this.groundTargets = groundTargets;
        this.mapper = mapper;
        this.inventory = new Inventory();
        this.moveSpeed = 7;
        this.sprintMultiplier = 2;
        this.gravity = 16;
        this.jumpHeight = 1.5;
        this.doubleJumpHeight = 2.5;
        this.jumpSpeed = this.getJumpSpeed(this.jumpHeight);
        this.doubleJumpSpeed = this.getJumpSpeed(this.doubleJumpHeight);
        this.groundSnapDistance = 0.08;
        this.verticalVelocity = 0;
        this.jumpCount = 0;
        this.maxJumps = 2;
        this.wasJumpPressed = false;
        this.wasFlyTogglePressed = false;
        this.isFlying = false;
        this.noclip = false;
        this.flySpeed = 12;
        this.selectedItem = voxelItems12[0] || null;
        this.localDirection = new THREE.Vector3();
        this.moveDirection = new THREE.Vector3();

        this.instance = new THREE.Group();
        this.instance.name = "Player";
        this.instance.position.copy(this.position);
        this.instance.rotation.copy(this.rotation);

        this.body = this.createBody();
        this.directionMarker = this.createDirectionMarker();

        this.instance.add(this.directionMarker);
        this.instance.add(this.body);
    }

    addItem(item, quantity = 1) {
        return this.inventory.add(item, quantity);
    }

    createBody() {
        const geometry = new THREE.CapsuleGeometry(0.35, 1.1, 4, 10);
        const material = new THREE.MeshBasicMaterial({ color: 0x2f80ed });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.name = "PlayerBody";
        mesh.position.y = 0.9;

        return mesh;
    }

    createDirectionMarker() {
        const marker = new THREE.Group();
        marker.name = "PlayerDirectionMarker";
        marker.rotation.y = Math.PI;

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.62, 0.68, 48),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                opacity: 0.25,
                transparent: true,
                side: THREE.DoubleSide
            })
        );
        ring.rotation.x = -Math.PI / 2;

        const pointerShape = new THREE.Shape();
        pointerShape.moveTo(0, -0.92);
        pointerShape.lineTo(-0.18, -0.58);
        pointerShape.lineTo(0.18, -0.58);
        pointerShape.lineTo(0, -0.92);

        const pointer = new THREE.Mesh(
            new THREE.ShapeGeometry(pointerShape),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                opacity: 0.25,
                transparent: true,
                side: THREE.DoubleSide
            })
        );
        pointer.position.y = 0.01;
        pointer.rotation.x = -Math.PI / 2;

        marker.position.y = 0.03;
        marker.add(ring);
        marker.add(pointer);

        return marker;
    }

    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.instance.position.copy(this.position);
    }

    beginFrame() {
        this.previousPosition.copy(this.position);
    }

    setPositionAxis(axis, value) {
        this.setPosition(
            axis === "x" ? value : this.position.x,
            axis === "y" ? value : this.position.y,
            axis === "z" ? value : this.position.z
        );
    }

    setRotation(x, y, z) {
        this.rotation.set(x, y, z);
        this.instance.rotation.copy(this.rotation);
    }

    setCameraDirection(y) {
        this.cameraDirection = y;
        this.updateDesiredOrientation();
    }

    updateDesiredOrientation() {
        this.desiredOrientation = desiredOrientationFromCameraYaw(this.cameraDirection);
        return this.desiredOrientation;
    }

    setFirstPerson(isFirstPerson) {
        this.body.visible = !isFirstPerson;
        this.directionMarker.visible = true;
    }

    setSelectedItem(item = null) {
        this.selectedItem = item;
    }

    spawn(position = new THREE.Vector3(), rotation = new THREE.Euler()) {
        this.previousPosition.copy(position);
        this.setPosition(position.x, position.y, position.z);
        this.setRotation(rotation.x, rotation.y, rotation.z);
        this.cameraDirection = rotation.y;
        this.verticalVelocity = 0;
        this.jumpCount = 0;
        this.wasJumpPressed = false;
        this.wasFlyTogglePressed = false;
        this.isFlying = false;
        this.noclip = false;
    }

    setNoclip(noclip = !this.noclip) {
        this.noclip = noclip;
        if (!this.noclip) return;

        this.isFlying = true;
        this.verticalVelocity = 0;
        this.jumpCount = 0;
    }

    selectedVoxel() {
        return this.selectedItem?.voxel || null;
    }

    orientedSelectedVoxel() {
        const voxel = this.selectedVoxel();
        if (!voxel) return null;

        const nextVoxel = voxel.clone?.() || voxel;

        if (nextVoxel.isOrientable?.()) {
            nextVoxel.setOrientation(this.desiredOrientation);
        }

        return nextVoxel;
    }

    moveBy(x, y, z) {
        this.setPosition(this.position.x + x, this.position.y + y, this.position.z + z);
    }

    land(y = this.position.y) {
        this.setPosition(this.position.x, y, this.position.z);
        this.verticalVelocity = 0;
        this.jumpCount = 0;
    }

    hitCeiling(y = this.position.y) {
        this.setPosition(this.position.x, y, this.position.z);
        if (this.verticalVelocity > 0) this.verticalVelocity = 0;
    }

    getMovementYaw(localDirection) {
        const inputAngle = Math.atan2(-localDirection.x, -localDirection.z);

        return this.cameraDirection + inputAngle;
    }

    getLocalDirection() {
        return this.localDirection.set(
            Number(this.input?.isPressed("d")) - Number(this.input?.isPressed("a")),
            0,
            Number(this.input?.isPressed("s")) - Number(this.input?.isPressed("w"))
        );
    }

    updateMovementIntent() {
        const localDirection = this.getLocalDirection();

        if (localDirection.lengthSq() === 0) return false;

        this.setRotation(0, this.getMovementYaw(localDirection), 0);
        return true;
    }

    update(deltaTime, syncMovementIntent = true) {
        if (!this.input) return;

        this.updateFlyToggle();
        const localDirection = this.getLocalDirection();

        if (this.isFlying) {
            if (localDirection.lengthSq() !== 0 && syncMovementIntent) {
                this.setRotation(0, this.getMovementYaw(localDirection), 0);
            }

            this.updateFlying(deltaTime, localDirection);
            return;
        }

        this.updateJump(deltaTime);

        if (localDirection.lengthSq() === 0) return;

        if (syncMovementIntent) this.setRotation(0, this.getMovementYaw(localDirection), 0);

        const direction = this.moveDirection
            .set(0, 0, -1)
            .applyEuler(this.rotation)
            .multiplyScalar(this.getMoveSpeed() * deltaTime);
        this.moveBy(direction.x, direction.y, direction.z);
    }

    hasMovementInput() {
        if (!this.input) return false;

        return this.input.isPressed("w")
            || this.input.isPressed("a")
            || this.input.isPressed("s")
            || this.input.isPressed("d");
    }

    hasFlyingInput() {
        return this.hasMovementInput()
            || this.input?.isPressed(" ")
            || this.input?.isPressed("shift");
    }

    getMoveSpeed() {
        if (!this.input?.isPressed("e")) return this.moveSpeed;

        return this.moveSpeed * this.sprintMultiplier;
    }

    getFlySpeed() {
        if (!this.input?.isPressed("e")) return this.flySpeed;

        return this.flySpeed * this.sprintMultiplier;
    }

    getJumpSpeed(height) {
        return Math.sqrt(2 * this.gravity * height);
    }

    updateJump(deltaTime) {
        const isJumpPressed = this.input.isPressed(" ");
        const ground = this.findGround();
        const isGrounded = ground
            && ground.y <= this.position.y + 0.02
            && this.position.y - ground.y <= this.groundSnapDistance;

        if (isGrounded && this.verticalVelocity <= 0) {
            this.land(ground.y);
        }

        if (isJumpPressed && !this.wasJumpPressed && this.jumpCount < this.maxJumps) {
            this.verticalVelocity = this.jumpCount === 0
                ? this.jumpSpeed
                : this.doubleJumpSpeed;
            this.jumpCount += 1;
        }

        this.wasJumpPressed = isJumpPressed;
        this.verticalVelocity -= this.gravity * deltaTime;

        const nextY = this.position.y + this.verticalVelocity * deltaTime;

        if (ground && ground.y <= this.position.y + this.groundSnapDistance && nextY <= ground.y) {
            this.land(ground.y);
            return;
        }

        this.setPosition(this.position.x, nextY, this.position.z);
    }

    updateFlyToggle() {
        const isFlyTogglePressed = this.input.isPressed("f");

        if (isFlyTogglePressed && !this.wasFlyTogglePressed) {
            this.isFlying = !this.isFlying;
            this.verticalVelocity = 0;
            this.jumpCount = 0;
        }

        this.wasFlyTogglePressed = isFlyTogglePressed;
    }

    updateFlying(deltaTime, localDirection) {
        const direction = this.moveDirection
            .set(0, 0, -1)
            .applyEuler(this.rotation)
            .multiplyScalar(this.getFlySpeed() * deltaTime);
        const vertical = Number(this.input?.isPressed(" ")) - Number(this.input?.isPressed("shift"));

        if (localDirection.lengthSq() === 0) {
            direction.set(0, 0, 0);
        }

        this.moveBy(
            direction.x,
            vertical * this.getFlySpeed() * deltaTime,
            direction.z
        );
        this.resolveFlyingGround();
    }

    resolveFlyingGround() {
        if (this.noclip) return;

        const ground = this.findGround();

        if (ground && this.position.y < ground.y) {
            this.setPosition(this.position.x, ground.y, this.position.z);
        }
    }

    findGround() {
        return this.mapper?.groundAt(this.position) || null;
    }

    isGrounded() {
        const ground = this.findGround();

        return Boolean(ground
            && ground.y <= this.position.y + 0.02
            && this.position.y - ground.y <= this.groundSnapDistance);
    }
}

export default Player;

