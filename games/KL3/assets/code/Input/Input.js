export class Input {
    constructor(options = {}) {
        this.ui = options.ui ?? null;
        this.canvas = options.canvas ?? document.querySelector("#threeDCanvas");
        this.player = options.player ?? null;

        this.playerInputOn = false;

        this.keys = {
            KeyW: false,
            KeyA: false,
            KeyS: false,
            KeyD: false,
        };

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handlePointerLockChange = this.handlePointerLockChange.bind(this);

        this.start();
    }

    start() {
        document.addEventListener("keydown", this.handleKeyDown);
        document.addEventListener("keyup", this.handleKeyUp);
        document.addEventListener("pointerdown", this.handlePointerDown);
        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    }

    stop() {
        document.removeEventListener("keydown", this.handleKeyDown);
        document.removeEventListener("keyup", this.handleKeyUp);
        document.removeEventListener("pointerdown", this.handlePointerDown);
        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    }

    setPlayer(player) {
        this.player = player ?? null;
    }

    handleKeyDown(event) {
        if (event.repeat && event.code === "Space") return;

        if (event.key === "Tab") {
            event.preventDefault();
            this.ui?.toggleMenu();

            if (this.ui?.isMenuVisible?.()) {
                this.unlockCursor();
            }

            return;
        }

        if (!this.playerInputOn) return;

        if (event.code in this.keys) {
            event.preventDefault();
            this.keys[event.code] = true;
        }

        if (event.code === "Space") {
            event.preventDefault();
            this.player?.requestJump?.();
        }
    }

    handleKeyUp(event) {
        if (!(event.code in this.keys)) return;

        this.keys[event.code] = false;
    }

    handlePointerDown(event) {
        if (this.isInsideUI(event.target)) return;

        if (this.ui?.isMenuVisible?.()) {
            this.ui.hideMenu();
        }

        this.lockCursor();
    }

    handleMouseMove(event) {
        if (!this.playerInputOn) return;

        this.player?.rotateFromMouse?.(event.movementX, event.movementY);
    }

    handlePointerLockChange() {
        this.playerInputOn = document.pointerLockElement === this.canvas;

        if (!this.playerInputOn) {
            this.clearMovementKeys();
        }
    }

    lockCursor() {
        this.canvas?.requestPointerLock?.();
    }

    unlockCursor() {
        if (document.pointerLockElement) {
            document.exitPointerLock?.();
        }

        this.playerInputOn = false;
        this.clearMovementKeys();
    }

    clearMovementKeys() {
        Object.keys(this.keys).forEach((code) => {
            this.keys[code] = false;
        });
    }

    isInsideUI(target) {
        if (!target) return false;
        if (!this.ui) return false;

        return this.ui.isInsideInteractiveElement(target);
    }

    getMovementVector() {
        if (!this.playerInputOn) {
            return { x: 0, z: 0 };
        }

        let x = 0;
        let z = 0;

        if (this.keys.KeyW) z -= 1;
        if (this.keys.KeyS) z += 1;
        if (this.keys.KeyA) x -= 1;
        if (this.keys.KeyD) x += 1;

        return { x, z };
    }

    isPlayerInputOn() {
        return this.playerInputOn;
    }
}

export default Input;
