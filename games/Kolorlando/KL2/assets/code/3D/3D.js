import * as THREE from "three";
import { CAMERA_VIEW, cameraFarForRenderDistance } from "../Game/Camera.js";

export class ThreeD {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            CAMERA_VIEW.fov.default,
            1,
            CAMERA_VIEW.near,
            cameraFarForRenderDistance(60)
        );
        this.renderer = new THREE.WebGLRenderer(
            {
                antialias: false,
                alpha: false,
                powerPreference: "high-performance",
                logarithmicDepthBuffer: false,
                stencil: false,
                preserveDrawingBuffer: false
            }

        );
        this.defaultSkyColor = 0x38a4e8;
        this.wireframeSkyColor = 0x000000;
        this.skyColor = this.defaultSkyColor;
        this.groundLightColor = 0x000000;
        this.sunColor = 0x000000;
        this.needsRender = true;
        this.renderCount = 0;
        this.resizeObserver = null;
        this.resizeCallbacks = [];
        this.undersampling = 100;
        this.pixelatedUpscale = false;
        this.cameraFov = CAMERA_VIEW.fov.default;
        this.chunkRenderDistance = 60;
        this.wireframeMode = false;

        this.resize = this.resize.bind(this);
        this.render = this.render.bind(this);
    }

    start() {
        this.applySkyColor();

        this.setupRendererStyle();
        this.setupLights();

        this.updatePixelRatio();
        this.container.appendChild(this.renderer.domElement);

        window.addEventListener("resize", this.resize);
        this.resizeObserver = new ResizeObserver(this.resize);
        this.resizeObserver.observe(this.container);
        this.resize();
    }

    setupRendererStyle() {
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.toneMappingExposure = 1;
    }

    setRenderSettings({
        undersampling = this.undersampling,
        pixelatedUpscale = this.pixelatedUpscale,
        cameraFov = this.cameraFov,
        chunkRenderDistance = this.chunkRenderDistance,
        wireframeMode = this.wireframeMode
    } = {}) {
        this.undersampling = Math.max(5, Math.min(100, Number(undersampling) || 100));
        this.pixelatedUpscale = Boolean(pixelatedUpscale);
        this.cameraFov = THREE.MathUtils.clamp(
            Number(cameraFov) || CAMERA_VIEW.fov.default,
            CAMERA_VIEW.fov.min,
            CAMERA_VIEW.fov.max
        );
        this.chunkRenderDistance = Math.max(1, Number(chunkRenderDistance) || 60);
        this.wireframeMode = Boolean(wireframeMode);
        this.setSkyColor(this.wireframeMode ? this.wireframeSkyColor : this.defaultSkyColor);
        this.camera.fov = this.cameraFov;
        this.camera.far = cameraFarForRenderDistance(this.chunkRenderDistance);
        this.camera.updateProjectionMatrix();
        this.updatePixelRatio();
        this.updateCanvasScaling();
        this.resize();
    }

    updatePixelRatio() {
        const scale = this.undersampling / 100;

        this.renderer.setPixelRatio(Math.max(0.05, scale));
    }

    updateCanvasScaling() {
        this.renderer.domElement.style.imageRendering = this.pixelatedUpscale ? "pixelated" : "";
    }

    setupLights() {
        const ambient = new THREE.HemisphereLight(
            0xffffff,
            this.groundLightColor,
            0.75
        );

        const sun = new THREE.DirectionalLight(
            this.sunColor,
            1.25
        );

        sun.position.set(-3, 6, 4);

        this.scene.add(ambient);
        this.scene.add(sun);
    }

    resize() {
        const { width, height } = this.getViewportSize();

        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
        this.resizeCallbacks.forEach(callback => callback());
        this.requestRender();
        this.render();
    }

    getViewportSize() {
        const bounds = this.container.getBoundingClientRect();

        return {
            width: Math.max(1, Math.floor(bounds.width || window.innerWidth)),
            height: Math.max(1, Math.floor(bounds.height || window.innerHeight))
        };
    }

    render() {
        this.renderer.render(this.scene, this.camera);
        this.renderCount += 1;
        this.needsRender = false;
    }

    requestRender() {
        this.needsRender = true;
    }

    setSkyColor(color = this.defaultSkyColor) {
        const nextColor = Number(color);

        this.skyColor = Number.isFinite(nextColor) ? nextColor : this.defaultSkyColor;
        this.applySkyColor();
    }

    configureFog(renderDistance, fogSize) {
        this.scene.fog = new THREE.Fog(
            new THREE.Color(this.skyColor),
            Math.max(0, renderDistance - fogSize),
            renderDistance
        );
    }

    applySkyColor() {
        const skyColor = new THREE.Color(this.skyColor);

        this.scene.background = skyColor;
        if (this.scene.fog) this.scene.fog.color.copy(skyColor);
    }

    onResize(callback) {
        this.resizeCallbacks.push(callback);
    }
}


