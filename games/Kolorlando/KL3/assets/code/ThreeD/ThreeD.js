import * as THREE from "three";

export class ThreeD {
    constructor(options = {}) {
        this.canvas = options.canvas ?? document.querySelector("#threeDCanvas");
        this.clearColor = options.clearColor ?? 0x87ceeb;
        this.pixelRatioLimit = options.pixelRatioLimit ?? 2;
        this.cameraFov = options.cameraFov ?? 90;
        this.undersampling = options.undersampling ?? false;
        this.undersamplingRatio = options.undersamplingRatio ?? 0.5;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.worldObject = null;

        this.lastWidth = 0;
        this.lastHeight = 0;
        this.pendingWidth = 0;
        this.pendingHeight = 0;
        this.resizeDirty = true;
        this.resizeObserver = null;

        this.handleResize = this.handleResize.bind(this);
    }

    start() {
        if (!this.canvas) return;

        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.startResizeObserver();

        window.addEventListener("resize", this.handleResize);
        this.resize();
        this.render();
    }

    stop() {
        window.removeEventListener("resize", this.handleResize);
        this.stopResizeObserver();
        this.dispose();
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.setSkyColor(this.clearColor);
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(this.cameraFov, 1, 0.1, 1000);
        this.camera.position.set(54, 36, 54);
        this.camera.lookAt(22.5, 3.5, 22.5);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
        });

        this.renderer.setPixelRatio(this.getPixelRatio());
    }

    startResizeObserver() {
        if (!this.canvas || typeof ResizeObserver === "undefined") return;

        this.resizeObserver = new ResizeObserver((entries = []) => {
            const entry = entries[0];
            const rect = entry?.contentRect;
            if (!rect) return;

            const width = Math.max(1, Math.round(rect.width));
            const height = Math.max(1, Math.round(rect.height));

            if (width === this.pendingWidth && height === this.pendingHeight) return;

            this.pendingWidth = width;
            this.pendingHeight = height;
            this.markResizeDirty();
        });

        this.resizeObserver.observe(this.canvas);
    }

    stopResizeObserver() {
        this.resizeObserver?.disconnect?.();
        this.resizeObserver = null;
    }

    markResizeDirty() {
        this.resizeDirty = true;
    }

    setWorld(object3D) {
        if (this.worldObject) {
            this.remove(this.worldObject);
        }

        this.worldObject = object3D;
        this.add(this.worldObject);
    }

    focusOnWoxel(woxel) {
        if (!this.camera || !woxel) return;

        const center = {
            x: woxel.size.x / 2,
            y: Math.max(1, woxel.land.y / 2),
            z: woxel.size.z / 2,
        };
        const distance = Math.max(woxel.size.x, woxel.size.y, woxel.size.z) * 0.85;

        this.camera.position.set(
            center.x + distance,
            center.y + distance * 0.7,
            center.z + distance
        );

        this.camera.lookAt(center.x, center.y, center.z);
    }

    setSkyColor(color = this.clearColor) {
        this.clearColor = color;

        if (!this.scene) return;

        this.scene.background = new THREE.Color(color);
    }

    setCameraFov(fov = this.cameraFov) {
        const nextFov = this.clampNumber(fov, 30, 120, this.cameraFov);
        this.cameraFov = nextFov;

        if (!this.camera) return;

        this.camera.fov = nextFov;
        this.camera.updateProjectionMatrix();
    }

    setUndersampling(enabled = false, ratio = this.undersamplingRatio) {
        this.undersampling = Boolean(enabled);
        this.undersamplingRatio = this.clampNumber(ratio, 0.1, 1, this.undersamplingRatio);

        if (this.canvas) {
            this.canvas.style.imageRendering = this.undersampling ? "pixelated" : "";
        }

        this.resize();
    }

    update() {
        this.resizeIfNeeded();
        this.render();
    }

    render() {
        if (!this.renderer || !this.scene || !this.camera) return;

        this.renderer.render(this.scene, this.camera);
    }

    handleResize() {
        // Window resize is only a signal.
        // The real canvas size is read once on the next frame, not every frame.
        this.markResizeDirty();
    }

    resizeIfNeeded() {
        if (!this.resizeDirty) return;

        this.resizeDirty = false;
        this.resize();
    }

    resize(width = null, height = null) {
        if (!this.canvas || !this.renderer || !this.camera) return;

        const size = this.getCanvasRenderSize(width, height);
        if (size.width === this.lastWidth && size.height === this.lastHeight) return;

        this.lastWidth = size.width;
        this.lastHeight = size.height;
        this.pendingWidth = size.width;
        this.pendingHeight = size.height;

        this.camera.aspect = size.width / size.height;
        this.camera.updateProjectionMatrix();

        this.renderer.setPixelRatio(this.getPixelRatio());
        this.renderer.setSize(size.width, size.height, false);
    }

    getCanvasRenderSize(width = null, height = null) {
        const nextWidth = Number(width ?? this.pendingWidth);
        const nextHeight = Number(height ?? this.pendingHeight);

        if (Number.isFinite(nextWidth) && nextWidth > 0 && Number.isFinite(nextHeight) && nextHeight > 0) {
            return {
                width: Math.max(1, Math.round(nextWidth)),
                height: Math.max(1, Math.round(nextHeight)),
            };
        }

        // Fallback path only runs on dirty resize events.
        // It avoids forcing a layout read on every animation frame.
        return {
            width: Math.max(1, Math.round(this.canvas.clientWidth)),
            height: Math.max(1, Math.round(this.canvas.clientHeight)),
        };
    }

    getPixelRatio() {
        const baseRatio = Math.min(window.devicePixelRatio || 1, this.pixelRatioLimit);
        const renderRatio = this.undersampling ? this.undersamplingRatio : 1;

        return Math.max(0.1, baseRatio * renderRatio);
    }

    clampNumber(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;

        return Math.min(Math.max(number, min), max);
    }

    getScene() {
        return this.scene;
    }

    getCamera() {
        return this.camera;
    }

    getRenderer() {
        return this.renderer;
    }

    getCanvas() {
        return this.canvas;
    }

    add(object3D) {
        if (!this.scene || !object3D) return;

        this.scene.add(object3D);
    }

    remove(object3D) {
        if (!this.scene || !object3D) return;

        this.scene.remove(object3D);
    }

    dispose() {
        this.stopResizeObserver();
        this.renderer?.dispose();
    }
}

export default ThreeD;
