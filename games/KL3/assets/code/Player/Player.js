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
        this.jumpVelocity = options.jumpVelocity ?? 5.2;
        this.maxJumps = options.maxJumps ?? 2;

        this.yaw = options.yaw ?? 0;
        this.pitch = options.pitch ?? 0;
        this.mouseSensitivity = options.mouseSensitivity ?? 0.0025;

        this.grounded = false;
        this.jumpsUsed = 0;
        this.jumpRequested = false;

        this.pitchLimit = Math.PI / 2;
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
        this.yaw -= movementX * this.mouseSensitivity;
        this.pitch -= movementY * this.mouseSensitivity;
        this.pitch = this.clamp(this.pitch, -this.pitchLimit, this.pitchLimit);

        this.applyCamera();
    }

    requestJump() {
        this.jumpRequested = true;
    }

    update(dt = 0) {
        const safeDt = Math.min(Math.max(dt, 0), 0.05);

        this.applyJump();
        this.velocity.y -= this.gravity * safeDt;

        const movement = this.createMovement(safeDt);
        const result = this.collision?.moveFeet(this.position, movement, this.body);

        if (result) {
            this.position = result.position;
            this.handleCollisionResult(result, movement);
        } else {
            this.position.x += movement.x;
            this.position.y += movement.y;
            this.position.z += movement.z;
        }

        this.applyCamera();
    }

    applyJump() {
        if (!this.jumpRequested) return;

        this.jumpRequested = false;

        if (!this.grounded && this.jumpsUsed >= this.maxJumps) return;

        this.velocity.y = this.jumpVelocity;
        this.grounded = false;
        this.jumpsUsed++;
    }

    createMovement(dt) {
        const inputVector = this.input?.getMovementVector?.() ?? { x: 0, z: 0 };
        const normalized = this.normalize2D(inputVector.x, inputVector.z);

        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);

        const worldX = (normalized.x * cos) + (normalized.z * sin);
        const worldZ = (normalized.z * cos) - (normalized.x * sin);

        return {
            x: worldX * this.moveSpeed * dt,
            y: this.velocity.y * dt,
            z: worldZ * this.moveSpeed * dt,
        };
    }

    handleCollisionResult(result, wantedMovement) {
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

    isGrounded() {
        return this.grounded;
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
