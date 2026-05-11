import { Desktop } from "./Desktop.js";
import { MobileLandscape } from "./MobileLandscape.js";
import { MobilePortrait } from "./MobilePortrait.js";

export const SCREEN_MODES = {
    desktop: "desktop",
    mobilePortrait: "mobile-portrait",
    mobileLandscape: "mobile-landscape",
};

export class Screen {
    constructor(options = {}) {
        this.mode = options.mode ?? null;
        this.onChange = options.onChange ?? null;
        this.mobileMaxWidth = options.mobileMaxWidth ?? 900;
        this.mobileMaxHeight = options.mobileMaxHeight ?? 540;
        this.resizeThrottleMs = options.resizeThrottleMs ?? 120;
        this.resizeTimer = null;

        this.profiles = {
            [SCREEN_MODES.desktop]: options.desktop ?? new Desktop(),
            [SCREEN_MODES.mobilePortrait]: options.mobilePortrait ?? new MobilePortrait(),
            [SCREEN_MODES.mobileLandscape]: options.mobileLandscape ?? new MobileLandscape(),
        };

        this.handleResize = this.handleResize.bind(this);
        this.handleOrientationChange = this.handleOrientationChange.bind(this);
    }

    start() {
        window.addEventListener("resize", this.handleResize);
        window.addEventListener("orientationchange", this.handleOrientationChange);
        this.update({ force: true });
    }

    stop() {
        window.removeEventListener("resize", this.handleResize);
        window.removeEventListener("orientationchange", this.handleOrientationChange);
        window.clearTimeout(this.resizeTimer);
        this.resizeTimer = null;
    }

    handleResize() {
        window.clearTimeout(this.resizeTimer);
        this.resizeTimer = window.setTimeout(() => {
            this.update();
        }, this.resizeThrottleMs);
    }

    handleOrientationChange() {
        this.handleResize();
    }

    update(options = {}) {
        const nextMode = this.detectMode();
        const previousMode = this.mode;

        if (nextMode === previousMode && options.force !== true) {
            this.applyBodyMode(nextMode);
            return nextMode;
        }

        this.mode = nextMode;
        this.applyBodyMode(nextMode);
        this.onChange?.(nextMode, previousMode, this);

        return nextMode;
    }

    detectMode() {
        const width = Math.max(1, window.innerWidth || document.documentElement?.clientWidth || 1);
        const height = Math.max(1, window.innerHeight || document.documentElement?.clientHeight || 1);

        if (!this.shouldUseMobileMode(width, height)) {
            return SCREEN_MODES.desktop;
        }

        return height >= width
            ? SCREEN_MODES.mobilePortrait
            : SCREEN_MODES.mobileLandscape;
    }

    shouldUseMobileMode(width, height) {
        const hasTouch = navigator.maxTouchPoints > 0;
        const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches === true;
        const smallViewport = width <= this.mobileMaxWidth || height <= this.mobileMaxHeight;

        return hasTouch || coarsePointer || smallViewport;
    }

    applyBodyMode(mode = this.mode) {
        if (!document.body) return;

        document.body.dataset.screenMode = mode ?? SCREEN_MODES.desktop;
    }

    getMode() {
        return this.mode ?? SCREEN_MODES.desktop;
    }

    getProfile(mode = this.getMode()) {
        return this.profiles[mode] ?? this.profiles[SCREEN_MODES.desktop];
    }

    getPolicy(mode = this.getMode()) {
        return this.getProfile(mode)?.getPolicy?.() ?? this.profiles[SCREEN_MODES.desktop].getPolicy();
    }

    isDesktop() {
        return this.getMode() === SCREEN_MODES.desktop;
    }

    isMobile() {
        return !this.isDesktop();
    }

    isPortrait() {
        return this.getMode() === SCREEN_MODES.mobilePortrait;
    }

    isLandscape() {
        return this.getMode() === SCREEN_MODES.mobileLandscape;
    }
}

export default Screen;
