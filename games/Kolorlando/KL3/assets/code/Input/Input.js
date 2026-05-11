export class Input {
    constructor(options = {}) {
        this.ui = options.ui ?? null;
        this.canvas = options.canvas ?? document.querySelector("#threeDCanvas");
        this.player = options.player ?? null;
        this.chat = options.chat ?? null;

        this.onPrimaryAction = options.onPrimaryAction ?? null;
        this.onSecondaryAction = options.onSecondaryAction ?? null;
        this.onPrimaryHold = options.onPrimaryHold ?? null;
        this.onSecondaryHold = options.onSecondaryHold ?? null;
        this.onPointerRelease = options.onPointerRelease ?? null;
        this.onMiddleAction = options.onMiddleAction ?? null;
        this.onCopy = options.onCopy ?? null;
        this.onCut = options.onCut ?? null;
        this.onPaste = options.onPaste ?? null;
        this.onCancel = options.onCancel ?? null;
        this.onUndo = options.onUndo ?? null;
        this.onRedo = options.onRedo ?? null;
        this.onHotbarSelect = options.onHotbarSelect ?? null;

        this.holdMs = options.holdMs ?? 650;
        this.pointerHold = null;

        this.screenPolicy = this.createDefaultScreenPolicy();

        this.playerInputOn = false;
        this.chatInputOn = false;
        this.playerInputBeforeChat = false;

        this.keys = {
            KeyW: false,
            KeyA: false,
            KeyS: false,
            KeyD: false,
            KeyE: false,
            Space: false,
            ShiftLeft: false,
            ShiftRight: false,
        };

        this.moveIntent = { x: 0, z: 0 };
        this.verticalIntent = { up: false, down: false };
        this.mobileLookTarget = { x: 0, y: 0 };
        this.mobileLookCurrent = { x: 0, y: 0 };
        this.mobileSprint = false;

        // MOBILE LOOK TUNING
        // Increase acceleration/deceleration for snappier joystick camera.
        // Decrease them for softer sugar ease-in/ease-out.
        this.mobileJoystickDeadzone = options.mobileJoystickDeadzone ?? 0.12;
        this.mobileLookSensitivity = options.mobileLookSensitivity ?? 1.2;
        this.mobileLookAcceleration = options.mobileLookAcceleration ?? 10;
        this.mobileLookDeceleration = options.mobileLookDeceleration ?? 50;

        this.mobileJoystickRoot = null;
        this.mobileJoystickBindings = [];
        this.mobileMoveJoystickPointerId = null;
        this.mobileMoveJoystickPad = null;
        this.mobileLookJoystickPointerId = null;
        this.mobileLookJoystickPad = null;

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handlePointerCancel = this.handlePointerCancel.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerLockChange = this.handlePointerLockChange.bind(this);

        this.start();
    }

    start() {
        document.addEventListener("keydown", this.handleKeyDown);
        document.addEventListener("keyup", this.handleKeyUp);
        document.addEventListener("pointerdown", this.handlePointerDown);
        document.addEventListener("pointerup", this.handlePointerUp);
        document.addEventListener("pointercancel", this.handlePointerCancel);
        document.addEventListener("contextmenu", this.handleContextMenu);
        document.addEventListener("pointermove", this.handlePointerMove);
        document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    }

    stop() {
        document.removeEventListener("keydown", this.handleKeyDown);
        document.removeEventListener("keyup", this.handleKeyUp);
        document.removeEventListener("pointerdown", this.handlePointerDown);
        document.removeEventListener("pointerup", this.handlePointerUp);
        document.removeEventListener("pointercancel", this.handlePointerCancel);
        document.removeEventListener("contextmenu", this.handleContextMenu);
        document.removeEventListener("pointermove", this.handlePointerMove);
        document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
        this.unbindMobileJoysticks();
    }

    setPlayer(player) {
        this.player = player ?? null;
    }

    setChat(chat) {
        this.chat = chat ?? null;
    }

    createDefaultScreenPolicy() {
        return {
            cursorLock: true,
            pointerActions: true,
            keyboardGameplay: true,
            keyboardEditing: true,
            hotbarKeys: true,
            mobileGameplay: false,
            mobileVoxelActions: false,
            mobileChatWithMenu: false,
        };
    }

    setScreenPolicy(policy = {}) {
        this.screenPolicy = {
            ...this.createDefaultScreenPolicy(),
            ...(policy ?? {}),
        };

        if (this.screenPolicy.cursorLock === false) {
            this.unlockCursor();
        }

        if (this.screenPolicy.keyboardGameplay === false) {
            this.playerInputOn = false;
            this.clearMovementKeys();
        }

        if (this.screenPolicy.mobileGameplay === false) {
            this.clearMobileInput();
        }

        if (this.screenPolicy.pointerActions === false) {
            this.clearPointerHold();
        }
    }

    setPrimaryAction(callback = null) {
        this.onPrimaryAction = callback;
    }

    setSecondaryAction(callback = null) {
        this.onSecondaryAction = callback;
    }

    setPrimaryHold(callback = null) {
        this.onPrimaryHold = callback;
    }

    setSecondaryHold(callback = null) {
        this.onSecondaryHold = callback;
    }

    setPointerRelease(callback = null) {
        this.onPointerRelease = callback;
    }

    setMiddleAction(callback = null) {
        this.onMiddleAction = callback;
    }

    setCopy(callback = null) {
        this.onCopy = callback;
    }

    setCut(callback = null) {
        this.onCut = callback;
    }

    setPaste(callback = null) {
        this.onPaste = callback;
    }

    setCancel(callback = null) {
        this.onCancel = callback;
    }

    setUndo(callback = null) {
        this.onUndo = callback;
    }

    setRedo(callback = null) {
        this.onRedo = callback;
    }

    setHotbarSelect(callback = null) {
        this.onHotbarSelect = callback;
    }

    setJoysticksRoot(root = null) {
        if (this.mobileJoystickRoot === root) return;

        this.unbindMobileJoysticks();
        this.mobileJoystickRoot = root;

        if (this.mobileJoystickRoot) {
            this.bindMobileJoysticks();
        }
    }

    bindMobileJoysticks() {
        const moveJoystick = this.mobileJoystickRoot?.querySelector?.('[data-joystick="move"]');
        const movePad = moveJoystick?.querySelector?.(".joystickPad");
        const lookJoystick = this.mobileJoystickRoot?.querySelector?.('[data-joystick="look"]');
        const lookPad = lookJoystick?.querySelector?.(".joystickPad");

        if (moveJoystick && movePad) {
            this.mobileMoveJoystickPad = movePad;
            this.bindMobileVectorJoystick({
                joystick: moveJoystick,
                pad: movePad,
                getPointerId: () => this.mobileMoveJoystickPointerId,
                setPointerId: (pointerId) => {
                    this.mobileMoveJoystickPointerId = pointerId;
                },
                onVector: (vector) => {
                    this.moveIntent.x = vector.x;
                    this.moveIntent.z = vector.y;
                },
                onRelease: () => this.clearMobileMovement(),
            });
        }

        if (lookJoystick && lookPad) {
            this.mobileLookJoystickPad = lookPad;
            this.bindMobileVectorJoystick({
                joystick: lookJoystick,
                pad: lookPad,
                getPointerId: () => this.mobileLookJoystickPointerId,
                setPointerId: (pointerId) => {
                    this.mobileLookJoystickPointerId = pointerId;
                },
                onVector: (vector) => {
                    this.mobileLookTarget.x = vector.x;
                    this.mobileLookTarget.y = vector.y;
                },
                onRelease: () => this.clearMobileLookTarget(),
            });
        }

        this.bindMobileButton("jump", {
            down: () => {
                this.verticalIntent.up = true;
                this.player?.requestJump?.();
            },
            up: () => {
                this.verticalIntent.up = false;
            },
        });

        // RESERVED MOBILE BUTTON.
        // Jump already means ascend while FlightMode is active.
        this.bindMobileButton("up", {});

        this.bindMobileButton("down", {
            down: () => {
                this.verticalIntent.down = true;
            },
            up: () => {
                this.verticalIntent.down = false;
            },
        });

        this.bindMobileButton("sprint", {
            tap: (button) => this.toggleMobileSprint(button),
        });

        this.bindMobileButton("menu", {
            tap: () => {
                this.clearMobileInput();
                this.ui?.toggleMenu?.();
            },
        });

        this.bindMobileButton("chat", {
            allowChat: true,
            tap: (button) => this.toggleMobileChat(button),
        });

        this.bindMobileButton("primary", {
            tap: () => this.triggerMobilePrimaryAction(),
        });

        this.bindMobileButton("secondary", {
            tap: () => this.triggerMobileSecondaryAction(),
        });
    }

    bindMobileVectorJoystick({
        joystick = null,
        pad = null,
        getPointerId = null,
        setPointerId = null,
        onVector = null,
        onRelease = null,
    } = {}) {
        if (!joystick || !pad) return;

        joystick.style.touchAction = "none";

        this.addMobileJoystickBinding(joystick, "pointerdown", (event) => {
            if (!this.canUseMobileGameplay()) return;
            if (getPointerId?.() !== null) return;

            event.preventDefault();
            event.stopPropagation();

            setPointerId?.(event.pointerId);
            joystick.setPointerCapture?.(event.pointerId);
            this.updateMobileVectorJoystick(joystick, pad, event, onVector);
        });

        this.addMobileJoystickBinding(joystick, "pointermove", (event) => {
            if (event.pointerId !== getPointerId?.()) return;

            event.preventDefault();
            event.stopPropagation();

            this.updateMobileVectorJoystick(joystick, pad, event, onVector);
        });

        const releaseJoystick = (event) => {
            if (event.pointerId !== getPointerId?.()) return;

            event.preventDefault();
            event.stopPropagation();

            setPointerId?.(null);
            onRelease?.();
        };

        this.addMobileJoystickBinding(joystick, "pointerup", releaseJoystick);
        this.addMobileJoystickBinding(joystick, "pointercancel", releaseJoystick);
        this.addMobileJoystickBinding(joystick, "lostpointercapture", releaseJoystick);
    }

    addMobileJoystickBinding(target, type, handler, options = { passive: false }) {
        target.addEventListener(type, handler, options);
        this.mobileJoystickBindings.push({ target, type, handler, options });
    }

    bindMobileButton(action, handlers = {}) {
        const button = this.mobileJoystickRoot?.querySelector?.(`[data-mobile-action="${action}"]`);
        if (!button) return;

        button.style.touchAction = "none";

        let isPressed = false;
        let activePointerId = null;

        const capturePointer = (event) => {
            if (typeof event.pointerId !== "number") return;

            activePointerId = event.pointerId;

            try {
                button.setPointerCapture?.(event.pointerId);
            } catch {
                // Safe no-op. Some browsers reject capture if the pointer already ended.
            }
        };

        const releasePointer = (event) => {
            if (typeof event.pointerId !== "number") return;

            try {
                if (button.hasPointerCapture?.(event.pointerId)) {
                    button.releasePointerCapture?.(event.pointerId);
                }
            } catch {
                // Safe no-op.
            }
        };

        const stopMobileEvent = (event) => {
            event.preventDefault?.();
            event.stopPropagation?.();
        };

        const canPressButton = () => {
            return this.canUseMobileGameplay({
                allowMenu: action === "menu"
                    || handlers.allowMenu === true
                    || (action === "chat" && this.screenPolicy.mobileChatWithMenu === true),
                allowChat: handlers.allowChat === true,
            });
        };

        const handleDown = (event) => {
            stopMobileEvent(event);

            if (!canPressButton()) return;
            if (isPressed) return;

            isPressed = true;
            capturePointer(event);

            button.classList.add("is-pressed");
            handlers.down?.(button, event);
            handlers.tap?.(button, event);
        };

        const handleUp = (event) => {
            stopMobileEvent(event);

            if (!isPressed) return;

            if (activePointerId !== null
                && typeof event.pointerId === "number"
                && event.pointerId !== activePointerId) {
                return;
            }

            releasePointer(event);

            isPressed = false;
            activePointerId = null;

            button.classList.remove("is-pressed");
            handlers.up?.(button, event);
        };

        this.addMobileJoystickBinding(button, "pointerdown", handleDown);

        // Continuous buttons must release from the document, not from lostpointercapture.
        // Some mobile browsers can lose capture early, which cuts held actions like descend.
        this.addMobileJoystickBinding(document, "pointerup", handleUp);
        this.addMobileJoystickBinding(document, "pointercancel", handleUp);
    }

    unbindMobileJoysticks() {
        this.mobileJoystickBindings.forEach(({ target, type, handler, options }) => {
            target.removeEventListener(type, handler, options);
        });

        this.mobileJoystickBindings = [];
        this.mobileJoystickRoot = null;
        this.mobileMoveJoystickPointerId = null;
        this.mobileMoveJoystickPad = null;
        this.mobileLookJoystickPointerId = null;
        this.mobileLookJoystickPad = null;
        this.clearMobileInput();
    }

    updateMobileVectorJoystick(joystick, pad, event, onVector = null) {
        const rect = joystick.getBoundingClientRect();
        const padRect = pad.getBoundingClientRect();
        const maxOffset = Math.max(1, (Math.min(rect.width, rect.height) - Math.min(padRect.width, padRect.height)) / 2);

        const rawX = event.clientX - rect.left - (rect.width / 2);
        const rawY = event.clientY - rect.top - (rect.height / 2);
        const rawLength = Math.hypot(rawX, rawY);
        const scale = rawLength > maxOffset ? maxOffset / rawLength : 1;
        const dx = rawX * scale;
        const dy = rawY * scale;

        pad.style.transform = `translate(${dx}px, ${dy}px)`;

        const x = dx / maxOffset;
        const y = dy / maxOffset;
        const amount = Math.hypot(x, y);

        if (amount < this.mobileJoystickDeadzone) {
            onVector?.({ x: 0, y: 0 });
            return;
        }

        onVector?.({ x, y });
    }

    clearMobileMovement() {
        this.moveIntent.x = 0;
        this.moveIntent.z = 0;

        if (this.mobileMoveJoystickPad) {
            this.mobileMoveJoystickPad.style.transform = "translate(0px, 0px)";
        }
    }

    clearMobileLookTarget() {
        this.mobileLookTarget.x = 0;
        this.mobileLookTarget.y = 0;

        if (this.mobileLookJoystickPad) {
            this.mobileLookJoystickPad.style.transform = "translate(0px, 0px)";
        }
    }

    clearMobileLook() {
        this.clearMobileLookTarget();
        this.mobileLookCurrent.x = 0;
        this.mobileLookCurrent.y = 0;
    }

    clearMobileInput() {
        this.clearMobileMovement();
        this.clearMobileLook();
        this.verticalIntent.up = false;
        this.verticalIntent.down = false;
        this.mobileSprint = false;

        this.mobileJoystickRoot?.querySelectorAll?.(".joystickButton.is-active, .joystickButton.is-pressed").forEach((button) => {
            button.classList.remove("is-active", "is-pressed");
        });
    }

    canUseMobileGameplay(options = {}) {
        if (this.screenPolicy.mobileGameplay !== true) return false;
        if (this.chatInputOn && options.allowChat !== true) return false;
        if (options.allowMenu !== true && this.ui?.isMenuVisible?.()) return false;

        return true;
    }

    toggleMobileChat(button = null) {
        if (!this.chat) return;

        if (this.chatInputOn || this.chat.isOpen?.()) {
            button?.classList.remove("is-active");
            this.chat.close();
            return;
        }

        this.clearMobileInput();
        this.openChat("");
        button?.classList.add("is-active");
    }

    toggleMobileSprint(button = null) {
        this.mobileSprint = !this.mobileSprint;
        button?.classList.toggle("is-active", this.mobileSprint);
    }

    canUseMobileVoxelActions() {
        if (this.screenPolicy.mobileVoxelActions !== true) return false;

        return this.canUseMobileGameplay();
    }

    triggerMobilePrimaryAction() {
        if (!this.canUseMobileVoxelActions()) return;

        // MOBILE ACTIONS ARE INTENTIONALLY INVERTED FROM MOUSE CLICKS.
        // PRIMARY TOUCH BUTTON QUITS A VOXEL.
        this.onPrimaryAction?.();
    }

    triggerMobileSecondaryAction() {
        if (!this.canUseMobileVoxelActions()) return;

        // SECONDARY TOUCH BUTTON PLACES A VOXEL.
        this.onSecondaryAction?.();
    }

    handleKeyDown(event) {
        if (this.chatInputOn) return;

        if (event.key === "Enter") {
            event.preventDefault();
            this.openChat("");
            return;
        }

        if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            this.openChat("/");
            return;
        }

        if (this.screenPolicy.keyboardEditing && this.handleHistoryShortcut(event)) {
            return;
        }

        if (this.screenPolicy.keyboardEditing && this.handleBoxelEditingShortcut(event)) {
            return;
        }

        if (this.screenPolicy.hotbarKeys && /^Digit[1-9]$/.test(event.code)) {
            event.preventDefault();
            this.onHotbarSelect?.(Number(event.code.slice(5)) - 1);
            return;
        }

        if (event.key === "Tab") {
            event.preventDefault();
            this.ui?.toggleMenu();

            if (this.ui?.isMenuVisible?.()) {
                this.unlockCursor();
            }

            return;
        }

        if (!this.playerInputOn) return;
        if (!this.screenPolicy.keyboardGameplay) return;

        if (event.code === "KeyF") {
            event.preventDefault();
            if (!event.repeat) this.player?.toggleFlightMode?.();
            return;
        }

        if (event.code in this.keys) {
            event.preventDefault();
            this.keys[event.code] = true;
        }

        if (event.code === "Space" && !event.repeat) {
            this.player?.requestJump?.();
        }
    }

    handleKeyUp(event) {
        if (!(event.code in this.keys)) return;

        this.keys[event.code] = false;
    }

    handleHistoryShortcut(event) {
        const key = event.key?.toLowerCase?.() ?? "";
        const isModifier = event.ctrlKey || event.metaKey;

        if (!isModifier || event.altKey) return false;
        if (this.ui?.isMenuVisible?.()) return false;
        if (this.isTextEditingTarget(event.target)) return false;

        if (key === "z" && event.shiftKey) {
            event.preventDefault();
            this.onRedo?.(event);
            return true;
        }

        if (key === "z") {
            event.preventDefault();
            this.onUndo?.(event);
            return true;
        }

        if (key === "y") {
            event.preventDefault();
            this.onRedo?.(event);
            return true;
        }

        return false;
    }

    handleBoxelEditingShortcut(event) {
        if (!this.canUsePointerIntent()) return false;
        if (event.altKey) return false;

        const key = event.key?.toLowerCase?.() ?? "";
        const isModifier = event.ctrlKey || event.metaKey;

        if (isModifier && key === "c") {
            event.preventDefault();
            this.onCopy?.(event);
            return true;
        }

        if (isModifier && key === "x") {
            event.preventDefault();
            this.onCut?.(event);
            return true;
        }

        if (isModifier && key === "v") {
            event.preventDefault();
            this.onPaste?.(event);
            return true;
        }

        if (!isModifier && key === "x") {
            event.preventDefault();
            this.onCancel?.(event);
            return true;
        }

        return false;
    }

    handlePointerDown(event) {
        if (this.isInsideUI(event.target)) return;

        if (this.handleScenePointerDown(event)) {
            return;
        }

        if (this.screenPolicy.pointerActions === false) return;
        if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
        if (!this.canUsePointerIntent()) return;

        event.preventDefault();

        if (this.screenPolicy.cursorLock !== false && !this.isCursorLocked()) {
            this.clearPointerHold();
            this.lockCursor();
            return;
        }

        if (this.screenPolicy.cursorLock === false && !this.playerInputOn) {
            this.playerInputOn = true;
        }

        if (event.button === 1) {
            this.clearPointerHold();
            this.onMiddleAction?.(event);
            return;
        }

        this.startPointerHold(event.button);
    }

    handleScenePointerDown(event) {
        if (!this.ui?.isMenuVisible?.()) return false;

        event.preventDefault();
        this.clearPointerHold();
        this.ui.hideMenu();

        if (this.screenPolicy.cursorLock === false) {
            this.playerInputOn = false;
            this.clearMovementKeys();
        }

        return true;
    }

    startPointerHold(button) {
        this.clearPointerHold();

        this.pointerHold = {
            button,
            didHold: false,
            action: button === 0 ? this.onPrimaryAction : this.onSecondaryAction,
            holdAction: button === 0 ? this.onPrimaryHold : this.onSecondaryHold,
            timer: window.setTimeout(() => {
                this.triggerPointerHold();
            }, this.holdMs),
        };
    }

    triggerPointerHold() {
        if (!this.pointerHold) return;
        if (this.pointerHold.didHold) return;

        this.pointerHold.didHold = true;
        this.pointerHold.holdAction?.();
    }

    handlePointerUp(event) {
        if (!this.pointerHold) return;
        if (event.button !== this.pointerHold.button) return;

        event.preventDefault();

        const pointerHold = this.clearPointerHold({ keepData: true });
        if (!pointerHold) return;

        if (pointerHold.didHold) {
            this.onPointerRelease?.(event);
            return;
        }

        pointerHold.action?.(event);
    }

    handlePointerCancel() {
        this.clearPointerHold();
    }

    clearPointerHold(options = {}) {
        if (!this.pointerHold) return null;

        window.clearTimeout(this.pointerHold.timer);

        const pointerHold = this.pointerHold;
        this.pointerHold = null;

        return options.keepData ? pointerHold : null;
    }

    handleContextMenu(event) {
        if (this.shouldAllowContextMenu(event.target)) return;

        event.preventDefault();
    }

    shouldAllowContextMenu(target) {
        if (this.screenPolicy.mobileGameplay === true) {
            return this.isInsideChatTarget(target);
        }

        return this.isInsideUI(target);
    }

    isInsideChatTarget(target) {
        if (!target?.closest) return false;

        return target.closest("#chatBox, #chatInput") !== null;
    }

    handlePointerMove(event) {
        if (!this.playerInputOn) return;
        if (this.chatInputOn) return;
        if (this.screenPolicy.cursorLock === false) return;

        this.player?.rotateFromMouse?.(event.movementX, event.movementY);
    }

    handlePointerLockChange() {
        if (this.chatInputOn) return;
        if (this.screenPolicy.cursorLock === false) return;

        this.playerInputOn = document.pointerLockElement === this.canvas;

        if (!this.playerInputOn) {
            this.clearMovementKeys();
            this.clearPointerHold();
        }
    }

    openChat(prefix = "") {
        if (!this.chat) return;

        this.chatInputOn = true;
        this.playerInputBeforeChat = this.playerInputOn;
        this.playerInputOn = false;
        this.clearMovementKeys();
        this.clearPointerHold();
        this.clearMobileInput();

        this.chat.open(prefix);
    }

    handleChatClosed() {
        this.chatInputOn = false;

        if (this.playerInputBeforeChat && document.pointerLockElement === this.canvas) {
            this.playerInputOn = true;
        }

        this.playerInputBeforeChat = false;
        this.clearMovementKeys();
        this.clearMobileInput();
    }

    isCursorLocked() {
        return document.pointerLockElement === this.canvas;
    }

    lockCursor() {
        if (this.screenPolicy.cursorLock === false) return;
        if (this.isCursorLocked()) return;

        this.canvas?.requestPointerLock?.();
    }

    unlockCursor() {
        if (document.pointerLockElement) {
            document.exitPointerLock?.();
        }

        this.playerInputOn = false;
        this.clearMovementKeys();
        this.clearPointerHold();
    }

    clearMovementKeys() {
        Object.keys(this.keys).forEach((code) => {
            this.keys[code] = false;
        });
    }

    isTextEditingTarget(target) {
        if (!target) return false;

        const tagName = target.tagName?.toLowerCase?.() ?? "";

        return tagName === "input"
            || tagName === "textarea"
            || target.isContentEditable === true;
    }

    isInsideUI(target) {
        if (!target) return false;
        if (!this.ui) return false;

        return this.ui.isInsideInteractiveElement(target);
    }

    canUsePointerIntent() {
        if (this.screenPolicy.pointerActions === false) return false;
        if (this.chatInputOn) return false;
        if (this.ui?.isMenuVisible?.()) return false;

        return true;
    }

    canUseGameplayPointer() {
        if (!this.canUsePointerIntent()) return false;

        return this.playerInputOn || document.pointerLockElement === this.canvas;
    }

    updateMobileLookCurrent(dt = 0) {
        const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.05);
        const hasTarget = Math.hypot(this.mobileLookTarget.x, this.mobileLookTarget.y) > 0;
        const rate = hasTarget ? this.mobileLookAcceleration : this.mobileLookDeceleration;
        const alpha = 1 - Math.exp(-rate * safeDt);

        this.mobileLookCurrent.x += (this.mobileLookTarget.x - this.mobileLookCurrent.x) * alpha;
        this.mobileLookCurrent.y += (this.mobileLookTarget.y - this.mobileLookCurrent.y) * alpha;

        if (!hasTarget && Math.hypot(this.mobileLookCurrent.x, this.mobileLookCurrent.y) < 0.001) {
            this.mobileLookCurrent.x = 0;
            this.mobileLookCurrent.y = 0;
        }
    }

    consumeMobileLookDelta(dt = 0) {
        if (!this.canUseMobileGameplay()) return { yaw: 0, pitch: 0 };

        this.updateMobileLookCurrent(dt);

        return {
            yaw: -this.mobileLookCurrent.x * this.mobileLookSensitivity * dt,
            pitch: -this.mobileLookCurrent.y * this.mobileLookSensitivity * dt,
        };
    }

    getMovementVector() {
        if (this.canUseMobileGameplay()) {
            return {
                x: this.moveIntent.x,
                y: 0,
                z: this.moveIntent.z,
            };
        }

        if (!this.playerInputOn || this.chatInputOn || !this.screenPolicy.keyboardGameplay) {
            return { x: 0, y: 0, z: 0 };
        }

        let x = 0;
        let y = 0;
        let z = 0;

        if (this.keys.KeyW) z -= 1;
        if (this.keys.KeyS) z += 1;
        if (this.keys.KeyA) x -= 1;
        if (this.keys.KeyD) x += 1;
        if (this.keys.Space) y += 1;
        if (this.keys.ShiftLeft || this.keys.ShiftRight) y -= 1;

        return { x, y, z };
    }

    getFlightVerticalIntent() {
        if (this.canUseMobileGameplay()) {
            let y = 0;

            if (this.verticalIntent.up) y += 1;
            if (this.verticalIntent.down) y -= 1;

            return y;
        }

        if (!this.playerInputOn || this.chatInputOn || !this.screenPolicy.keyboardGameplay) {
            return 0;
        }

        let y = 0;

        if (this.keys.Space) y += 1;
        if (this.keys.ShiftLeft || this.keys.ShiftRight) y -= 1;

        return y;
    }

    isSprinting() {
        if (this.canUseMobileGameplay()) return this.mobileSprint === true;

        return this.playerInputOn && !this.chatInputOn && this.screenPolicy.keyboardGameplay && this.keys.KeyE === true;
    }

    isPlayerInputOn() {
        return this.playerInputOn;
    }

    isChatInputOn() {
        return this.chatInputOn;
    }
}

export default Input;