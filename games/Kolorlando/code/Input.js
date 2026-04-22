export class Input {
  constructor({
    isMobile = false,
  } = {}) {
    this.isMounted = false;
    this.isMobile = Boolean(isMobile);
    this.keys = Object.create(null);
    this.pointerLockRetryArmed = false;
    this.pointerLockRetryBlockedUntil = 0;
    this.move = { forward: 0, right: 0 };
    this.look = { x: 0, y: 0 };
    this.actions = {
      jumpPressed: false,
      flyUpPressed: false,
      flyDownPressed: false,
      sprintPressed: false,
      primaryPressed: false,
      secondaryPressed: false,
      menuPressed: false,
    };
    this.joysticks = {
      move: { active: false, x: 0, y: 0 },
      look: { active: false, x: 0, y: 0 },
    };
    this.scenePointerDrag = {
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
      dragDistance: 0,
    };
    this.touchIds = {
      move: null,
      look: null,
    };
    this.bindings = [];
  }

  mount() {
    if (this.isMounted) return this;
    this.isMounted = true;
    return this;
  }

  destroy() {
    for (let i = 0; i < this.bindings.length; i += 1) {
      const binding = this.bindings[i];
      binding.target?.removeEventListener?.(binding.type, binding.handler, binding.options);
    }

    this.bindings = [];
    this.isMounted = false;
    return this;
  }

  setMobileMode(nextMobileMode) {
    this.isMobile = Boolean(nextMobileMode);
    return this;
  }

  setMoveVector(forward = 0, right = 0) {
    this.move.forward = Number(forward) || 0;
    this.move.right = Number(right) || 0;
    return this;
  }

  setLookVector(x = 0, y = 0) {
    this.look.x = Number(x) || 0;
    this.look.y = Number(y) || 0;
    return this;
  }

  setAction(name, pressed) {
    if (!(name in this.actions)) return this;
    this.actions[name] = Boolean(pressed);
    return this;
  }

  setJoystickState(stickName, nextState = {}) {
    const joystick = this.joysticks[stickName];
    if (!joystick) return this;

    joystick.active = Boolean(nextState.active);
    joystick.x = Number(nextState.x) || 0;
    joystick.y = Number(nextState.y) || 0;
    return this;
  }

  setKey(code, pressed) {
    const normalizedCode = typeof code === 'string' ? code : '';
    if (!normalizedCode) return this;

    this.keys[normalizedCode] = Boolean(pressed);
    return this;
  }

  clearKeys() {
    Object.keys(this.keys).forEach(code => {
      this.keys[code] = false;
    });
    return this;
  }

  clearTransientState() {
    this.look.x = 0;
    this.look.y = 0;
    this.actions.jumpPressed = false;
    this.actions.menuPressed = false;
    return this;
  }

  clearScenePointerDrag() {
    this.scenePointerDrag.active = false;
    this.scenePointerDrag.pointerId = null;
    this.scenePointerDrag.lastX = 0;
    this.scenePointerDrag.lastY = 0;
    this.scenePointerDrag.dragDistance = 0;
    return this;
  }

  armPointerLockRetry() {
    this.pointerLockRetryArmed = true;
    return this;
  }

  disarmPointerLockRetry() {
    this.pointerLockRetryArmed = false;
    return this;
  }

  setPointerLockRetryBlockedUntil(timestamp = 0) {
    this.pointerLockRetryBlockedUntil = Number(timestamp) || 0;
    return this;
  }

  canRetryPointerLock(now = performance.now()) {
    return Number(now) >= this.pointerLockRetryBlockedUntil;
  }

  getSnapshot() {
    return {
      isMobile: this.isMobile,
      isMounted: this.isMounted,
      keys: { ...this.keys },
      move: { ...this.move },
      look: { ...this.look },
      actions: { ...this.actions },
      joysticks: {
        move: { ...this.joysticks.move },
        look: { ...this.joysticks.look },
      },
      pointerLockRetryArmed: this.pointerLockRetryArmed,
      pointerLockRetryBlockedUntil: this.pointerLockRetryBlockedUntil,
    };
  }

  addBinding(target, type, handler, options) {
    if (!target?.addEventListener || typeof handler !== 'function') {
      return this;
    }

    target.addEventListener(type, handler, options);
    this.bindings.push({ target, type, handler, options });
    return this;
  }

  bindKeyboard({
    target = document,
    onBeforeKeyDown = null,
    shouldIgnoreKeyDown = null,
    shouldIgnoreKeyUp = null,
  } = {}) {
    this.addBinding(target, 'keydown', event => {
      onBeforeKeyDown?.(event);
      if (shouldIgnoreKeyDown?.(event)) return;
      this.setKey(event.code, true);
    });

    this.addBinding(target, 'keyup', event => {
      if (shouldIgnoreKeyUp?.(event)) {
        this.setKey(event.code, false);
        return;
      }

      this.setKey(event.code, false);
    });

    return this;
  }

  bindDocumentGameplayShortcuts({
    target = document,
    onPointerDown = null,
    onRetryPointerLock = null,
    onPointerLockRetryHotkey = null,
  } = {}) {
    this.addBinding(target, 'pointerdown', event => {
      onPointerDown?.(event);
    });
    this.addBinding(target, 'pointerdown', event => {
      onRetryPointerLock?.(event);
    });
    this.addBinding(target, 'keydown', event => {
      onPointerLockRetryHotkey?.(event);
    });
    return this;
  }

  bindVirtualJoysticks({
    leftJoystick = null,
    rightJoystick = null,
    maxOffset = 50,
    onUnlockAudio = null,
    isLegoLolCameraMode = null,
  } = {}) {
    const leftPad = leftJoystick?.querySelector?.('.pad') ?? null;
    const rightPad = rightJoystick?.querySelector?.('.pad') ?? null;

    if (leftJoystick && leftPad) {
      this.addBinding(leftJoystick, 'touchstart', event => {
        onUnlockAudio?.(event);
        event.preventDefault();
        for (const touch of event.changedTouches) {
          this.touchIds.move = touch.identifier;
        }
        this.setJoystickState('move', { active: true, x: 0, y: 0 });
      }, { passive: false });

      this.addBinding(leftJoystick, 'touchend', event => {
        event.preventDefault();
        for (const touch of event.changedTouches) {
          if (touch.identifier !== this.touchIds.move) continue;
          this.touchIds.move = null;
          this.setMoveVector(0, 0);
          this.setJoystickState('move', { active: false, x: 0, y: 0 });
          leftPad.style.transform = 'translate(0px,0px)';
        }
      }, { passive: false });

      this.addBinding(leftJoystick, 'touchmove', event => {
        event.preventDefault();
        for (const touch of event.touches) {
          if (touch.identifier !== this.touchIds.move) continue;

          const rect = leftJoystick.getBoundingClientRect();
          const x = touch.clientX - rect.left - rect.width / 2;
          const y = touch.clientY - rect.top - rect.height / 2;
          const dx = Math.max(-maxOffset, Math.min(maxOffset, x));
          const dy = Math.max(-maxOffset, Math.min(maxOffset, y));

          leftPad.style.transform = `translate(${dx}px,${dy}px)`;
          this.setMoveVector(-dy / maxOffset, dx / maxOffset);
          this.setJoystickState('move', { active: true, x: dx, y: dy });
        }
      }, { passive: false });
    }

    if (rightJoystick && rightPad) {
      this.addBinding(rightJoystick, 'touchstart', event => {
        onUnlockAudio?.(event);
        event.preventDefault();
        for (const touch of event.changedTouches) {
          this.touchIds.look = touch.identifier;
        }
        this.setJoystickState('look', { active: true, x: 0, y: 0 });
      }, { passive: false });

      this.addBinding(rightJoystick, 'touchend', event => {
        event.preventDefault();
        for (const touch of event.changedTouches) {
          if (touch.identifier !== this.touchIds.look) continue;
          this.touchIds.look = null;
          this.setLookVector(0, 0);
          this.setJoystickState('look', { active: false, x: 0, y: 0 });
          rightPad.style.transform = 'translate(0px,0px)';
        }
      }, { passive: false });

      this.addBinding(rightJoystick, 'touchmove', event => {
        event.preventDefault();
        for (const touch of event.touches) {
          if (touch.identifier !== this.touchIds.look) continue;

          const rect = rightJoystick.getBoundingClientRect();
          const x = touch.clientX - rect.left - rect.width / 2;
          const y = touch.clientY - rect.top - rect.height / 2;
          const dx = Math.max(-maxOffset, Math.min(maxOffset, x));
          const dy = Math.max(-maxOffset, Math.min(maxOffset, y));

          rightPad.style.transform = `translate(${dx}px,${dy}px)`;
          if (isLegoLolCameraMode?.()) {
            this.setLookVector(-dx, -dy);
          } else {
            this.setLookVector(dx, dy);
          }
          this.setJoystickState('look', { active: true, x: dx, y: dy });
        }
      }, { passive: false });
    }

    return this;
  }

  bindMobileButtons({
    getIsMobile = null,
    getIsFlyMode = null,
    onUnlockAudio = null,
    onToggleChat = null,
    onJump = null,
    onStopJump = null,
    onDownAction = null,
    onStopDownAction = null,
    onPrimaryAction = null,
    onStopPrimaryAction = null,
    onSecondaryAction = null,
    onStopSecondaryAction = null,
    onInventoryTouchStart = null,
    onInventoryClick = null,
    onToggleSprint = null,
    buttons = {},
  } = {}) {
    const {
      up = null,
      down = null,
      chat = null,
      sprint = null,
      shoot = null,
      secondary = null,
      inventory = null,
    } = buttons;

    if (up) {
      this.addBinding(up, 'touchstart', event => {
        onJump?.(event);
      }, { passive: false });
      this.addBinding(up, 'touchend', event => {
        onStopJump?.(event);
      }, { passive: false });
      this.addBinding(up, 'touchcancel', event => {
        onStopJump?.(event);
      }, { passive: false });
      this.addBinding(up, 'pointerdown', event => {
        if (!getIsMobile?.()) return;
        onJump?.(event);
      });
      this.addBinding(up, 'pointerup', event => {
        if (!getIsMobile?.()) return;
        onStopJump?.(event);
      });
    }

    if (chat) {
      this.addBinding(chat, 'touchstart', event => {
        onUnlockAudio?.(event);
        if (!getIsMobile?.()) return;
        event.preventDefault();
        onToggleChat?.(event);
      }, { passive: false });
    }

    if (down) {
      this.addBinding(down, 'touchstart', event => {
        onDownAction?.(event);
      }, { passive: false });
      this.addBinding(down, 'touchend', event => {
        onStopDownAction?.(event);
      }, { passive: false });
      this.addBinding(down, 'touchcancel', event => {
        onStopDownAction?.(event);
      }, { passive: false });
      this.addBinding(down, 'pointerdown', event => {
        if (!getIsMobile?.()) return;
        onDownAction?.(event);
      });
      this.addBinding(down, 'pointerup', event => {
        if (!getIsMobile?.()) return;
        onStopDownAction?.(event);
      });
    }

    if (shoot) {
      this.addBinding(shoot, 'touchstart', event => {
        onPrimaryAction?.(event);
      }, { passive: false });
      this.addBinding(shoot, 'touchend', event => {
        onStopPrimaryAction?.(event);
      }, { passive: false });
      this.addBinding(shoot, 'touchcancel', event => {
        onStopPrimaryAction?.(event);
      }, { passive: false });
      this.addBinding(shoot, 'pointerdown', event => {
        if (!getIsMobile?.()) return;
        if (this.isTouchLikePointerEvent(event)) return;
        event.preventDefault();
        onPrimaryAction?.(event);
      });
      this.addBinding(shoot, 'pointerup', event => {
        if (!getIsMobile?.()) return;
        if (this.isTouchLikePointerEvent(event)) return;
        event.preventDefault();
        onStopPrimaryAction?.(event);
      });
      this.addBinding(shoot, 'click', event => {
        if (!getIsMobile?.()) return;
        event.preventDefault();
        event.stopPropagation();
      });
    }

    if (secondary) {
      this.addBinding(secondary, 'touchstart', event => {
        onSecondaryAction?.(event);
      }, { passive: false });
      this.addBinding(secondary, 'touchend', event => {
        onStopSecondaryAction?.(event);
      }, { passive: false });
      this.addBinding(secondary, 'touchcancel', event => {
        onStopSecondaryAction?.(event);
      }, { passive: false });
      this.addBinding(secondary, 'pointerdown', event => {
        if (!getIsMobile?.()) return;
        if (this.isTouchLikePointerEvent(event)) return;
        onSecondaryAction?.(event);
      });
      this.addBinding(secondary, 'pointerup', event => {
        if (!getIsMobile?.()) return;
        if (this.isTouchLikePointerEvent(event)) return;
        onStopSecondaryAction?.(event);
      });
      this.addBinding(secondary, 'click', event => {
        if (!getIsMobile?.()) return;
        event.preventDefault();
        event.stopPropagation();
      });
    }

    if (inventory) {
      this.addBinding(inventory, 'touchstart', event => {
        onUnlockAudio?.(event);
        if (!getIsMobile?.()) return;
        event.preventDefault();
        event.stopPropagation();
        onInventoryTouchStart?.(event);
      }, { passive: false });
      this.addBinding(inventory, 'touchend', event => {
        if (!getIsMobile?.()) return;
        event.preventDefault();
        event.stopPropagation();
      }, { passive: false });
      this.addBinding(inventory, 'click', event => {
        if (!getIsMobile?.()) return;
        event.preventDefault();
        event.stopPropagation();
        onInventoryClick?.(event);
      });
    }

    if (sprint) {
      this.addBinding(sprint, 'touchstart', event => {
        onToggleSprint?.(event);
      }, { passive: false });
      this.addBinding(sprint, 'click', event => {
        if (!getIsMobile?.()) return;
        event.preventDefault();
        onToggleSprint?.(event);
      });
    }

    return this;
  }

  bindScenePointer({
    target = null,
    getIsScreenDragCameraActive = null,
    getIsMenuVisible = null,
    onUpdateCursor = null,
    onClearCursor = null,
    onLookDelta = null,
    onSceneClick = null,
  } = {}) {
    if (!target) return this;

    this.addBinding(target, 'pointermove', event => {
      onUpdateCursor?.(event.clientX, event.clientY, event);

      if (
        !this.scenePointerDrag.active
        || event.pointerId !== this.scenePointerDrag.pointerId
        || !getIsScreenDragCameraActive?.()
      ) return;

      const dx = event.clientX - this.scenePointerDrag.lastX;
      const dy = event.clientY - this.scenePointerDrag.lastY;
      this.scenePointerDrag.lastX = event.clientX;
      this.scenePointerDrag.lastY = event.clientY;
      this.scenePointerDrag.dragDistance += Math.hypot(dx, dy);
      onLookDelta?.(dx, dy, event);
      event.preventDefault();
    });

    this.addBinding(target, 'pointerenter', event => {
      onUpdateCursor?.(event.clientX, event.clientY, event);
    });

    this.addBinding(target, 'pointerleave', event => {
      if (this.scenePointerDrag.active && event.pointerId === this.scenePointerDrag.pointerId) return;
      onClearCursor?.(event);
    });

    this.addBinding(target, 'pointerdown', event => {
      if (!getIsScreenDragCameraActive?.() || getIsMenuVisible?.() || event.button !== 0) return;

      this.scenePointerDrag.active = true;
      this.scenePointerDrag.pointerId = event.pointerId;
      this.scenePointerDrag.lastX = event.clientX;
      this.scenePointerDrag.lastY = event.clientY;
      this.scenePointerDrag.dragDistance = 0;
      target.setPointerCapture?.(event.pointerId);
      onUpdateCursor?.(event.clientX, event.clientY, event);
    });

    const stopScenePointerDrag = event => {
      if (!this.scenePointerDrag.active || event.pointerId !== this.scenePointerDrag.pointerId) return;

      const dragDistance = this.scenePointerDrag.dragDistance;
      target.releasePointerCapture?.(event.pointerId);
      this.clearScenePointerDrag();

      if (
        event.type === 'pointerup'
        && dragDistance < 6
        && getIsScreenDragCameraActive?.()
        && !getIsMenuVisible?.()
      ) {
        onSceneClick?.(event);
      }
    };

    this.addBinding(target, 'pointerup', stopScenePointerDrag);
    this.addBinding(target, 'pointercancel', stopScenePointerDrag);
    return this;
  }

  bindDesktopMouse({
    mouseTarget = document,
    wheelTarget = window,
    onMouseDown = null,
    onWheel = null,
    onContextMenu = null,
  } = {}) {
    this.addBinding(mouseTarget, 'mousedown', event => {
      onMouseDown?.(event);
    });

    this.addBinding(mouseTarget, 'contextmenu', event => {
      onContextMenu?.(event);
    });

    this.addBinding(wheelTarget, 'wheel', event => {
      onWheel?.(event);
    }, { passive: false });

    return this;
  }

  bindHotkeys({
    target = document,
    onEvent = null,
    handlers = {},
  } = {}) {
    this.addBinding(target, 'keydown', event => {
      onEvent?.(event);

      if (handlers.onEscape?.(event) === true) return;
      if (handlers.onTab?.(event) === true) return;
      if (handlers.onEnter?.(event) === true) return;
      if (handlers.onSlash?.(event) === true) return;
      if (handlers.onTypingTarget?.(event) === true) return;
      if (handlers.onKeyF?.(event) === true) return;
      if (handlers.onKeyC?.(event) === true) return;
      if (handlers.onKeyI?.(event) === true) return;
      if (handlers.onKeyM?.(event) === true) return;
      if (handlers.onHotbarNumber?.(event) === true) return;
      handlers.onSpace?.(event);
    });

    return this;
  }

  isTouchLikePointerEvent(event) {
    return event?.pointerType === 'touch';
  }
}
