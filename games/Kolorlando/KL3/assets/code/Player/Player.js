import { Vector3 } from "three";
import { Compass } from "../Wabavam/Compass.js";

export class Player {
    constructor(options = {}) {
        this.camera = options.camera ?? null;
        this.collision = options.collision ?? null;
        this.input = options.input ?? null;

        this.position = {
            x: options.position?.x ?? 0,
            y: options.position?.y ?? 0,
            z: options.position?.z ?? 0,
        };

        this.velocity = {
            x: 0,
            y: 0,
            z: 0,
        };

        this.body = {
            width: options.body?.width ?? 0.8,
            height: options.body?.height ?? 1.8,
            depth: options.body?.depth ?? 0.8,
        };

        this.cameraPosition = options.cameraPosition ?? 1.7;
        this.gravity = options.gravity ?? 9.807;
        this.moveSpeed = options.moveSpeed ?? 6;
        this.flightSpeed = options.flightSpeed ?? 8;
        this.sprintMultiplier = options.sprintMultiplier ?? 2;
        this.jumpVelocity = options.jumpVelocity ?? 5.2;
        this.maxJumps = options.maxJumps ?? 2;

        this.yaw = options.yaw ?? 0;
        this.defaultPitch = options.defaultPitch ?? 0;
        this.pitch = options.pitch ?? this.defaultPitch;
        this.mouseSensitivity = options.mouseSensitivity ?? 0.0025;

        this.grounded = false;
        this.flightMode = false;
        this.noClip = false;
        this.jumpsUsed = 0;
        this.jumpRequested = false;

        this.pitchLimit = Math.PI / 2;
        this.cameraDirection = new Vector3(0, 0, -1);
    }

    setCamera(camera) {
        this.camera = camera ?? null;
        this.applyCamera();
    }

    setCollision(collision) {
        this.collision = collision ?? null;
    }

    setInput(input) {
        this.input = input ?? null;
    }

    spawnAtFeet(position = {}) {
        this.position.x = position.x ?? 0;
        this.position.y = position.y ?? 0;
        this.position.z = position.z ?? 0;

        this.velocity.x = 0;
        this.velocity.y = 0;
        this.velocity.z = 0;

        this.grounded = false;
        this.jumpsUsed = 0;

        this.applyCamera();
    }

    spawnInWoxel(woxel) {
        this.spawnAtFeet(woxel?.getSpawnPositionGame?.() ?? woxel?.spawnPosition ?? { x: 0, y: 2, z: 0 });
    }

    rotateFromMouse(movementX = 0, movementY = 0) {
        this.rotateBy(
            -movementX * this.mouseSensitivity,
            -movementY * this.mouseSensitivity
        );
    }

    rotateBy(yawDelta = 0, pitchDelta = 0, options = {}) {
        this.yaw += Number(yawDelta) || 0;
        this.pitch += Number(pitchDelta) || 0;
        this.pitch = this.clamp(this.pitch, -this.pitchLimit, this.pitchLimit);

        if (options.applyCamera !== false) {
            this.applyCamera();
        }
    }

    applyMobileLook(dt = 0) {
        const lookDelta = this.input?.consumeMobileLookDelta?.(dt);
        if (!lookDelta) return;

        this.rotateBy(lookDelta.yaw, lookDelta.pitch, { applyCamera: false });
    }

    requestJump() {
        this.jumpRequested = true;
    }

    toggleFlightMode() {
        this.flightMode = !this.flightMode;
        this.velocity.y = 0;
        this.jumpRequested = false;

        if (this.flightMode) {
            this.grounded = false;
            this.jumpsUsed = 0;
        }
    }

    toggleNoClip() {
        this.setNoClip(!this.noClip);
    }

    setNoClip(enabled = false) {
        this.noClip = Boolean(enabled);
        this.velocity.y = 0;
        this.jumpRequested = false;

        if (this.noClip) {
            this.flightMode = true;
            this.grounded = false;
            this.jumpsUsed = 0;
            return;
        }

        this.flightMode = false;
    }

    update(dt = 0) {
        const safeDt = Math.min(Math.max(dt, 0), 0.05);

        this.applyMobileLook(safeDt);

        if (this.flightMode) {
            this.updateFlight(safeDt);
        } else {
            this.updateWalk(safeDt);
        }

        this.applyCamera();
    }

    updateWalk(dt) {
        this.applyJump();
        this.velocity.y -= this.gravity * dt;

        const movement = this.createWalkMovement(dt);
        this.moveWithCollision(movement);
    }

    updateFlight(dt) {
        this.jumpRequested = false;
        this.velocity.y = 0;

        const movement = this.createFlightMovement(dt);

        if (this.noClip) {
            this.moveWithoutCollision(movement);
            return;
        }

        this.moveWithCollision(movement);
    }

    moveWithCollision(movement) {
        const result = this.collision?.moveFeet(this.position, movement, this.body);

        if (result) {
            this.position = result.position;
            this.handleCollisionResult(result, movement);
            return;
        }

        this.moveWithoutCollision(movement);
    }

    moveWithoutCollision(movement) {
        this.position.x += movement.x;
        this.position.y += movement.y;
        this.position.z += movement.z;
    }

    applyJump() {
        if (!this.jumpRequested) return;

        this.jumpRequested = false;

        if (!this.grounded && this.jumpsUsed >= this.maxJumps) return;

        this.velocity.y = this.jumpVelocity;
        this.grounded = false;
        this.jumpsUsed++;
    }

    createWalkMovement(dt) {
        const direction = this.createHorizontalDirection();
        const speed = this.getCurrentWalkSpeed();

        return {
            x: direction.x * speed * dt,
            y: this.velocity.y * dt,
            z: direction.z * speed * dt,
        };
    }

    createFlightMovement(dt) {
        const inputVector = this.input?.getMovementVector?.() ?? { x: 0, y: 0, z: 0 };
        const direction = this.createHorizontalDirection(inputVector);
        const verticalIntent = this.input?.getFlightVerticalIntent?.() ?? inputVector.y ?? 0;
        const speed = this.getCurrentFlightSpeed();

        return {
            x: direction.x * speed * dt,
            y: verticalIntent * speed * dt,
            z: direction.z * speed * dt,
        };
    }

    createHorizontalDirection(inputVector = this.input?.getMovementVector?.() ?? { x: 0, z: 0 }) {
        const normalized = this.normalize2D(inputVector.x, inputVector.z);

        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);

        return {
            x: (normalized.x * cos) + (normalized.z * sin),
            z: (normalized.z * cos) - (normalized.x * sin),
        };
    }

    getCurrentWalkSpeed() {
        return this.moveSpeed * this.getSprintMultiplier();
    }

    getCurrentFlightSpeed() {
        return this.flightSpeed * this.getSprintMultiplier();
    }

    getSprintMultiplier() {
        return this.input?.isSprinting?.() ? this.sprintMultiplier : 1;
    }

    handleCollisionResult(result, wantedMovement) {
        if (this.noClip) return;

        if (result.blocked.y) {
            if (wantedMovement.y < 0) {
                this.grounded = true;
                this.jumpsUsed = 0;
            }

            this.velocity.y = 0;
        } else {
            this.grounded = false;
        }

        if (result.blocked.x) this.velocity.x = 0;
        if (result.blocked.z) this.velocity.z = 0;
    }

    applyCamera() {
        if (!this.camera) return;

        this.camera.position.set(
            this.position.x,
            this.position.y + this.cameraPosition,
            this.position.z
        );

        this.camera.rotation.order = "YXZ";
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;
        this.camera.rotation.z = 0;
    }

    toMemoryData() {
        return {
            position: { ...this.position },
            yaw: this.yaw,
        };
    }

    loadMemoryData(data = null, options = {}) {
        if (!data || typeof data !== "object") return false;

        this.position.x = this.normalizeNumber(data.position?.x, this.position.x);
        this.position.y = this.normalizeNumber(data.position?.y, this.position.y);
        this.position.z = this.normalizeNumber(data.position?.z, this.position.z);
        this.yaw = this.normalizeNumber(data.yaw, this.yaw);
        this.pitch = this.normalizeNumber(options.pitch, this.defaultPitch);

        this.velocity.x = 0;
        this.velocity.y = 0;
        this.velocity.z = 0;

        this.grounded = false;
        this.jumpsUsed = 0;
        this.jumpRequested = false;

        this.applyCamera();

        return true;
    }

    normalizeNumber(value, fallback = 0) {
        const number = Number(value);

        return Number.isFinite(number) ? number : fallback;
    }

    getFeetPosition() {
        return { ...this.position };
    }

    getCameraPosition() {
        return {
            x: this.position.x,
            y: this.position.y + this.cameraPosition,
            z: this.position.z,
        };
    }

    getDesiredOrientation() {
        return Compass.fromYaw(this.yaw);
    }

    getFacingPlayerOrientation() {
        return Compass.opposite(this.getDesiredOrientation());
    }

    getCameraDirection() {
        if (this.camera?.getWorldDirection) {
            this.camera.getWorldDirection(this.cameraDirection);

            return {
                x: this.cameraDirection.x,
                y: this.cameraDirection.y,
                z: this.cameraDirection.z,
            };
        }

        return {
            x: -Math.sin(this.yaw) * Math.cos(this.pitch),
            y: Math.sin(this.pitch),
            z: -Math.cos(this.yaw) * Math.cos(this.pitch),
        };
    }

    isGrounded() {
        return this.grounded;
    }

    isFlightMode() {
        return this.flightMode;
    }

    isNoClip() {
        return this.noClip;
    }

    normalize2D(x = 0, z = 0) {
        const length = Math.hypot(x, z);

        if (length === 0) {
            return { x: 0, z: 0 };
        }

        return {
            x: x / length,
            z: z / length,
        };
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}

export default Player;