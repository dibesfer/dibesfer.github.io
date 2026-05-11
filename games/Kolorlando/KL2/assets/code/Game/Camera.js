import * as THREE from "three";

export const CAMERA_VIEW = {
    fov: {
        default: 72,
        min: 45,
        max: 100
    },
    near: 0.1,
    farPadding: 40
};

export function cameraFarForRenderDistance(renderDistance = 60) {
    return Math.max(50, Number(renderDistance) + CAMERA_VIEW.farPadding);
}

export class Camera {
    constructor({ camera, domElement, player, input = null }) {
        this.camera = camera;
        this.domElement = domElement;
        this.player = player;
        this.input = input;

        this.modes = {
            cursorLock: "cursorLock",
            dragToRotate: "dragToRotate",
            fixed: "fixed"
        };
        this.mode = this.modes.cursorLock;

        this.yaw = this.player?.cameraDirection ?? this.player?.rotation.y ?? Math.PI;
        this.cursorLock = {
            distance: 3,
            maxDistance: 7,
            minDistance: 0,
            maxPitch: Math.PI / 2 - 0.01,
            minPitch: -Math.PI / 2 + 0.01,
            pitch: 0.22,
            sensitivity: 0.003,
            wheelSensitivity: 0.01,
            wheelStep: 1,
            firstPersonDistance: 0,
            shoulderOffset: 0.65,
            targetHeight: 1.45
        };
        this.pitch = this.cursorLock.pitch;
        this.dragging = false;

        this.target = new THREE.Vector3();
        this.offset = new THREE.Vector3();
        this.shoulder = new THREE.Vector3();
        this.lookTarget = new THREE.Vector3();
        this.lookDirection = new THREE.Vector3();

        this.onClick = this.onClick.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onMenuToggle = this.onMenuToggle.bind(this);

        this.bindInput();
        this.setMode(this.modes.cursorLock);
    }

    bindInput() {
        this.input?.on("click", this.onClick);
        this.input?.on("mouseMove", this.onMouseMove);
        this.input?.on("wheel", this.onWheel);
        this.input?.on("menuToggle", this.onMenuToggle);
    }

    setMode(mode) {
        if (!Object.values(this.modes).includes(mode)) return;

        this.mode = mode;
    }

    syncToPlayerDirection() {
        this.yaw = this.player?.cameraDirection ?? this.player?.rotation.y ?? this.yaw;
        this.player?.setCameraDirection(this.yaw);
    }

    onClick(event) {
        if (this.mode !== this.modes.cursorLock) return;
        if (event.target !== this.domElement) return;

        this.input?.requestPointerLock(this.domElement);
    }

    onMouseMove(event) {
        if (this.mode !== this.modes.cursorLock) return;
        if (this.input?.pointer.lockedElement !== this.domElement) return;

        this.yaw -= event.movementX * this.cursorLock.sensitivity;
        this.pitch += event.movementY * this.cursorLock.sensitivity;
        this.pitch = THREE.MathUtils.clamp(this.pitch, this.cursorLock.minPitch, this.cursorLock.maxPitch);
        this.player?.setCameraDirection(this.yaw);
    }

    onWheel(event) {
        if (this.mode !== this.modes.cursorLock) return;
        if (this.input?.pointer.lockedElement !== this.domElement) return;

        this.cursorLock.distance = THREE.MathUtils.clamp(
            this.snapDistance(this.cursorLock.distance + Math.sign(event.deltaY) * this.cursorLock.wheelStep),
            this.cursorLock.minDistance,
            this.cursorLock.maxDistance
        );
    }

    snapDistance(distance) {
        const step = this.cursorLock.wheelStep;

        return Math.round(distance / step) * step;
    }

    onMenuToggle() {
        if (this.mode !== this.modes.cursorLock) return;

        this.input?.exitPointerLock();
    }

    update() {
        if (!this.player) return;

        const config = this.getModeConfig();
        const isFirstPerson = this.isFirstPerson(config);

        this.target.copy(this.player.position);
        this.target.y += config.targetHeight;
        this.shoulder.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        this.shoulder.multiplyScalar(isFirstPerson ? 0 : config.shoulderOffset);
        this.target.add(this.shoulder);

        this.offset.set(
            Math.sin(this.yaw) * Math.cos(this.pitch) * config.distance,
            Math.sin(this.pitch) * config.distance,
            Math.cos(this.yaw) * Math.cos(this.pitch) * config.distance
        );

        this.camera.position.copy(this.target).add(this.offset);
        this.camera.lookAt(this.getLookTarget(isFirstPerson));
        this.player.setFirstPerson(isFirstPerson);
    }

    acceptsPlayerMovement() {
        if (this.mode !== this.modes.cursorLock) return true;

        return this.input?.pointer.lockedElement === this.domElement;
    }

    acceptsPointerAction() {
        if (this.mode !== this.modes.cursorLock) return true;

        return this.input?.pointer.lockedElement === this.domElement;
    }

    getModeConfig() {
        if (this.mode === this.modes.cursorLock) return this.cursorLock;

        return {
            distance: 6.2,
            shoulderOffset: 0,
            targetHeight: 2
        };
    }

    isFirstPerson(config) {
        return config.distance <= config.firstPersonDistance;
    }

    getLookTarget(isFirstPerson) {
        if (!isFirstPerson) return this.target;

        return this.lookTarget.copy(this.target).add(this.lookDirection.set(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            -Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ));
    }
}

export default Camera;