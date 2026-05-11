export class Input {
    constructor(target = document) {
        this.target = target;
        this.listeners = new Map();
        this.keys = new Set();
        this.pointer = {
            isLocked: false,
            lockedElement: null,
            isDown: false,
            button: null,
            x: 0,
            y: 0,
            startX: 0,
            startY: 0,
            movementX: 0,
            movementY: 0
        };
        this.isActive = false;
        this.version = 0;

        this.holdDelayMs = 500;
        this.holdMoveTolerancePx = 8;
        this.pointerHold = null;

        this.onClick = this.onClick.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);
        this.onPointerLockChange = this.onPointerLockChange.bind(this);
    }

    start() {
        if (this.isActive) return;

        this.target.addEventListener("click", this.onClick);
        this.target.addEventListener("keydown", this.onKeyDown);
        this.target.addEventListener("keyup", this.onKeyUp);
        this.target.addEventListener("mousedown", this.onMouseDown);
        this.target.addEventListener("mousemove", this.onMouseMove);
        this.target.addEventListener("mouseup", this.onMouseUp);
        this.target.addEventListener("wheel", this.onWheel, { passive: false });
        this.target.addEventListener("contextmenu", this.onContextMenu);
        document.addEventListener("pointerlockchange", this.onPointerLockChange);
        this.isActive = true;
    }

    stop() {
        if (!this.isActive) return;

        this.target.removeEventListener("click", this.onClick);
        this.target.removeEventListener("keydown", this.onKeyDown);
        this.target.removeEventListener("keyup", this.onKeyUp);
        this.target.removeEventListener("mousedown", this.onMouseDown);
        this.target.removeEventListener("mousemove", this.onMouseMove);
        this.target.removeEventListener("mouseup", this.onMouseUp);
        this.target.removeEventListener("wheel", this.onWheel);
        this.target.removeEventListener("contextmenu", this.onContextMenu);
        document.removeEventListener("pointerlockchange", this.onPointerLockChange);
        this.clearPointerHold();
        this.keys.clear();
        this.isActive = false;
    }

    isPressed(key) {
        if (this.isKeyboardCaptured()) return false;

        return this.keys.has(key.toLowerCase());
    }

    isKeyboardCaptured() {
        return this.isTextEntryTarget(document.activeElement);
    }

    isTextEntryTarget(target) {
        return target instanceof HTMLInputElement
            || target instanceof HTMLTextAreaElement
            || target?.isContentEditable;
    }

    requestPointerLock(element = this.target) {
        element?.requestPointerLock?.();
    }

    exitPointerLock() {
        document.exitPointerLock?.();
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }

        this.listeners.get(type).add(callback);
    }

    off(type, callback) {
        this.listeners.get(type)?.delete(callback);
    }

    emit(type, payload) {
        this.listeners.get(type)?.forEach(callback => callback(payload));
    }

    markChanged() {
        this.version += 1;
    }

    onClick(event) {
        this.markChanged();
        this.emit("click", event);
    }

    onKeyDown(event) {
        if (this.isTextEntryTarget(event.target)) {
            this.emit("keyDown", event);
            return;
        }

        if (event.key === "Tab" || event.key === " ") {
            event.preventDefault();
        }

        if (event.key === "Tab") {
            this.emit("menuToggle", event);
        }

        if (!this.keys.has(event.key.toLowerCase())) this.markChanged();
        this.keys.add(event.key.toLowerCase());
        this.emit("keyDown", event);
    }

    onKeyUp(event) {
        if (this.keys.has(event.key.toLowerCase())) this.markChanged();
        this.keys.delete(event.key.toLowerCase());
        this.emit("keyUp", event);
    }

    onMouseDown(event) {
        this.markChanged();
        this.pointer.isDown = true;
        this.pointer.button = event.button;
        this.pointer.startX = event.clientX;
        this.pointer.startY = event.clientY;
        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;

        this.beginPointerHold(event);
        this.emit("mouseDown", event);
    }

    onMouseMove(event) {
        if ((this.pointer.isLocked || this.pointer.isDown) && (event.movementX !== 0 || event.movementY !== 0)) {
            this.markChanged();
        }

        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;
        this.pointer.movementX = event.movementX;
        this.pointer.movementY = event.movementY;

        this.emit("mouseMove", event);
        this.emitPointerHoldMove(event);
    }

    onMouseUp(event) {
        this.markChanged();
        this.pointer.isDown = false;
        this.pointer.button = null;

        const hold = this.pointerHold;
        this.clearPointerHold();

        this.emit("mouseUp", event);

        if (!hold || hold.button !== event.button) return;

        const payload = this.pointerPayload(event, hold);

        if (hold.active) {
            this.emit("mouseHoldEnd", payload);
            return;
        }

        this.emit("mouseTap", payload);
    }

    beginPointerHold(event) {
        if (event.button !== 0 && event.button !== 2) return;

        this.clearPointerHold();

        const hold = {
            event,
            button: event.button,
            startX: event.clientX,
            startY: event.clientY,
            startedAt: performance.now(),
            active: false,
            timer: null
        };

        hold.timer = window.setTimeout(() => {
            if (this.pointerHold !== hold || !this.pointer.isDown) return;

            hold.active = true;
            this.markChanged();
            this.emit("mouseHoldStart", this.pointerPayload(event, hold));
        }, this.holdDelayMs);

        this.pointerHold = hold;
    }

    emitPointerHoldMove(event) {
        const hold = this.pointerHold;
        if (!hold || !hold.active) return;

        this.emit("mouseHoldMove", this.pointerPayload(event, hold));
    }

    pointerPayload(event, hold = this.pointerHold) {
        return {
            event,
            button: hold?.button ?? event.button,
            startedAt: hold?.startedAt ?? performance.now(),
            durationMs: performance.now() - (hold?.startedAt ?? performance.now()),
            startX: hold?.startX ?? event.clientX,
            startY: hold?.startY ?? event.clientY,
            x: event.clientX,
            y: event.clientY,
            movementX: event.movementX ?? 0,
            movementY: event.movementY ?? 0
        };
    }

    clearPointerHold(cancelTimer = true) {
        if (cancelTimer && this.pointerHold?.timer) {
            window.clearTimeout(this.pointerHold.timer);
        }

        this.pointerHold = null;
    }

    onWheel(event) {
        if (!this.pointer.isLocked && this.isScrollableUiTarget(event.target)) return;

        event.preventDefault();
        this.markChanged();
        this.emit("wheel", event);
    }

    isScrollableUiTarget(target) {
        return Boolean(target?.closest?.(
            ".menuContent, .menuPanel, #center, #chat, select, input, textarea"
        ));
    }

    onContextMenu(event) {
        event.preventDefault();
    }

    onPointerLockChange() {
        this.pointer.lockedElement = document.pointerLockElement;
        this.pointer.isLocked = Boolean(this.pointer.lockedElement);
        this.markChanged();
        this.emit("pointerLockChange", this.pointer.isLocked);
    }
}

export default Input;
