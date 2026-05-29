import { CAMERA_VIEW } from "./Camera.js";

export class Settings {
    constructor({ threeD = null, input = null, storage = window.localStorage } = {}) {
        this.threeD = threeD;
        this.input = input;
        this.storage = storage;
        this.storageKey = "KL2.settings";
        this.schemaVersion = 3;
        this.defaults = {
            schemaVersion: this.schemaVersion,
            undersampling: 100,
            renderBudget: "MEDIUM",
            chunkRenderDistance: 60,
            lodEnabled: false,
            lodFullDistance: 30,
            lodMediumDistance: 90,
            cameraFov: CAMERA_VIEW.fov.default,
            pixelatedUpscale: false,
            wireframeMode: false,
            wireframeVertexColors: false
        };
        this.chunkRenderDistance = {
            min: 1,
            step: 1
        };
        this.lodDistance = {
            min: 0,
            fullMax: 180,
            mediumMax: 360,
            step: 5
        };
        this.values = { ...this.defaults };

        this.onChange = this.onChange.bind(this);
        this.restoreDefaults = this.restoreDefaults.bind(this);
    }

    start() {
        this.values = this.normalize({
            ...this.values,
            ...this.load()
        });
        this.apply();
        this.input?.on("settings.change", this.onChange);
        this.input?.on("settings.restoreDefaults", this.restoreDefaults);
        this.input?.emit("settings.updated", this.values);
    }

    stop() {
        this.input?.off("settings.change", this.onChange);
        this.input?.off("settings.restoreDefaults", this.restoreDefaults);
    }

    onChange(changes = {}) {
        this.values = this.normalize({
            ...this.values,
            ...changes
        });
        this.save();
        this.apply();
        this.input?.emit("settings.updated", this.values);
    }

    restoreDefaults() {
        this.values = this.normalize(this.defaults);
        this.save();
        this.apply();
        this.input?.emit("settings.updated", this.values);
    }

    apply() {
        this.threeD?.setRenderSettings(this.values);
    }

    load() {
        try {
            const saved = JSON.parse(this.storage.getItem(this.storageKey) || "{}");

            // Old experimental LOD builds may have left LOD enabled in localStorage.
            // New baseline: LOD is opt-in again after this schema migration.
            if (saved.schemaVersion !== this.schemaVersion) {
                return {
                    ...saved,
                    schemaVersion: this.schemaVersion,
                    lodEnabled: false,
                    wireframeMode: false,
                    wireframeVertexColors: false
                };
            }

            return saved;
        } catch (error) {
            console.warn("Settings load failed", error);
            return {};
        }
    }

    save() {
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.values));
        } catch (error) {
            console.warn("Settings save failed", error);
        }
    }

    normalize(values = {}) {
        return {
            schemaVersion: this.schemaVersion,
            undersampling: this.normalizeUndersampling(values.undersampling),
            renderBudget: this.normalizeRenderBudget(values.renderBudget),
            chunkRenderDistance: this.normalizeChunkRenderDistance(values.chunkRenderDistance),
            lodEnabled: Boolean(values.lodEnabled),
            lodFullDistance: this.normalizeLodFullDistance(values.lodFullDistance),
            lodMediumDistance: this.normalizeLodMediumDistance(values.lodMediumDistance, values.lodFullDistance),
            cameraFov: this.normalizeCameraFov(values.cameraFov),
            pixelatedUpscale: Boolean(values.pixelatedUpscale),
            wireframeMode: Boolean(values.wireframeMode),
            wireframeVertexColors: Boolean(values.wireframeVertexColors)
        };
    }

    normalizeUndersampling(value) {
        const number = Number(value);
        const options = [100, 75, 50, 25, 10, 5];

        return options.includes(number) ? number : 100;
    }

    normalizeRenderBudget(value) {
        const preset = String(value || "MEDIUM").toUpperCase();
        const options = ["LOW", "MEDIUM", "HIGH"];

        return options.includes(preset) ? preset : "MEDIUM";
    }

    normalizeChunkRenderDistance(value) {
        const number = Math.round(Number(value));
        const fallback = this.values.chunkRenderDistance ?? 60;
        const distance = Number.isFinite(number) ? number : fallback;

        // Intentionally no upper cap here: this is the main experimental control.
        return Math.max(this.chunkRenderDistance.min, distance);
    }

    normalizeLodFullDistance(value) {
        const number = Math.round(Number(value));
        const fallback = this.values.lodFullDistance ?? 30;
        const distance = Number.isFinite(number) ? number : fallback;

        return Math.max(
            this.lodDistance.min,
            Math.min(this.lodDistance.fullMax, distance)
        );
    }

    normalizeLodMediumDistance(value, fullDistance = this.values.lodFullDistance ?? 30) {
        const number = Math.round(Number(value));
        const fallback = this.values.lodMediumDistance ?? 90;
        const distance = Number.isFinite(number) ? number : fallback;
        const full = this.normalizeLodFullDistance(fullDistance);

        return Math.max(
            full,
            Math.min(this.lodDistance.mediumMax, distance)
        );
    }

    normalizeCameraFov(value) {
        const number = Math.round(Number(value));
        const fallback = this.values.cameraFov ?? CAMERA_VIEW.fov.default;
        const fov = Number.isFinite(number) ? number : fallback;

        return Math.max(
            CAMERA_VIEW.fov.min,
            Math.min(CAMERA_VIEW.fov.max, fov)
        );
    }
}

export default Settings;






