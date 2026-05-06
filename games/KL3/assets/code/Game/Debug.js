export class Debug {
    constructor(options = {}) {
        this.consolaElement = options.consolaElement ?? null;

        this.coords = {
            x: 0,
            y: 0,
            z: 0,
        };

        this.frameCount = 0;
        this.fps = 0;

        this.lastFrameTime = performance.now();
        this.lastFpsTime = performance.now();
        this.lastDrawTime = performance.now();

        this.drawThrottleMs = options.drawThrottleMs ?? 250;
    }

    setCoords(x = 0, y = 0, z = 0) {
        this.coords.x = x;
        this.coords.y = y;
        this.coords.z = z;
    }

    update(now = performance.now()) {
        this.frameCount++;

        const fpsDelta = now - this.lastFpsTime;

        if (fpsDelta >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / fpsDelta);
            this.frameCount = 0;
            this.lastFpsTime = now;
        }

        const drawDelta = now - this.lastDrawTime;

        if (drawDelta >= this.drawThrottleMs) {
            this.draw();
            this.lastDrawTime = now;
        }

        this.lastFrameTime = now;
    }

    reset() {
        const now = performance.now();

        this.frameCount = 0;
        this.fps = 0;

        this.lastFrameTime = now;
        this.lastFpsTime = now;
        this.lastDrawTime = now;

        this.draw();
    }

    draw() {
        if (!this.consolaElement) return;

        const x = this.formatCoord(this.coords.x);
        const y = this.formatCoord(this.coords.y);
        const z = this.formatCoord(this.coords.z);

        this.consolaElement.textContent = `FPS: ${this.formatFps(this.fps)} XYZ: ${x}, ${y}, ${z}`;
    }

    formatFps(value) {
        return String(value).padStart(2, "0");
    }

    formatCoord(value) {
        if (Number.isInteger(value)) return String(value);

        return value.toFixed(2);
    }
}

export default Debug;
