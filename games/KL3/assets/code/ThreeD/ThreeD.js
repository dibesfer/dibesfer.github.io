import * as THREE from "three";

export class ThreeD {
    constructor(options = {}) {
        this.canvas = options.canvas ?? document.querySelector("#threeDCanvas");
        this.clearColor = options.clearColor ?? 0x87ceeb;
        this.pixelRatioLimit = options.pixelRatioLimit ?? 2;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.worldObject = null;

        this.lastWidth = 0;
        this.lastHeight = 0;

        this.handleResize = this.handleResize.bind(this);
    }

    start() {
        if (!this.canvas) return;

        this.createScene();
        this.createCamera();
        this.createRenderer();

        window.addEventListener("resize", this.handleResize);
        this.resize();
        this.render();
    }

    stop() {
        window.removeEventListener("resize", this.handleResize);
        this.dispose();
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.setSkyColor(this.clearColor);
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        this.camera.position.set(54, 36, 54);
        this.camera.lookAt(22.5, 3.5, 22.5);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false,
            alpha: false,
        });

        this.renderer.setPixelRatio(this.getPixelRatio());
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

    update() {
        this.resizeIfNeeded();
        this.render();
    }

    render() {
        if (!this.renderer || !this.scene || !this.camera) return;

        this.renderer.render(this.scene, this.camera);
    }

    handleResize() {
        this.resize();
        this.render();
    }

    resizeIfNeeded() {
        if (!this.canvas) return;

        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        if (width === this.lastWidth && height === this.lastHeight) return;

        this.resize();
    }

    resize() {
        if (!this.canvas || !this.renderer || !this.camera) return;

        const width = Math.max(1, this.canvas.clientWidth);
        const height = Math.max(1, this.canvas.clientHeight);

        this.lastWidth = width;
        this.lastHeight = height;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setPixelRatio(this.getPixelRatio());
        this.renderer.setSize(width, height, false);
    }

    getPixelRatio() {
        return Math.min(window.devicePixelRatio || 1, this.pixelRatioLimit);
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
        this.renderer?.dispose();
    }
}

export default ThreeD;
