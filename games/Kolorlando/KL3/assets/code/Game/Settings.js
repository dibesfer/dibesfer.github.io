export class Settings {
    constructor(options = {}) {
        this.threeD = options.threeD ?? null;
        this.mapper = options.mapper ?? null;
        this.onChange = options.onChange ?? null;

        this.defaults = {
            wireframe: false,
            boxel15RenderDistance: options.defaultBoxel15RenderDistance ?? 60,
            boxel15RenderBudget: options.defaultBoxel15RenderBudget ?? 48,
            cameraFov: options.defaultCameraFov ?? 90,
            undersampling: options.defaultUndersampling ?? false,
            undersamplingRatio: options.defaultUndersamplingRatio ?? 0.5,
        };

        this.values = this.createValues({
            ...this.defaults,
            ...(options.values ?? {}),
            boxel15RenderDistance: options.boxel15RenderDistance ?? options.values?.boxel15RenderDistance ?? this.defaults.boxel15RenderDistance,
            boxel15RenderBudget: options.boxel15RenderBudget ?? options.values?.boxel15RenderBudget ?? this.defaults.boxel15RenderBudget,
            cameraFov: options.cameraFov ?? options.values?.cameraFov ?? this.defaults.cameraFov,
            undersampling: options.undersampling ?? options.values?.undersampling ?? this.defaults.undersampling,
            undersamplingRatio: options.undersamplingRatio ?? options.values?.undersamplingRatio ?? this.defaults.undersamplingRatio,
        });

        this.defaultSkyColor = options.defaultSkyColor ?? 0x87ceeb;
        this.wireframeSkyColor = options.wireframeSkyColor ?? 0x000000;

        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleRestoreDefaultsClick = this.handleRestoreDefaultsClick.bind(this);
    }

    start() {
        this.applyAll();
    }

    wireScope(scope = document) {
        if (!scope) return;

        const inputs = Array.from(scope.querySelectorAll("[data-setting]"));

        inputs.forEach((input) => {
            this.syncInput(input);
            input.removeEventListener("change", this.handleInputChange);
            input.addEventListener("change", this.handleInputChange);
        });

        const restoreButtons = Array.from(scope.querySelectorAll("[data-settings-restore-defaults]"));

        restoreButtons.forEach((button) => {
            button.removeEventListener("click", this.handleRestoreDefaultsClick);
            button.addEventListener("click", this.handleRestoreDefaultsClick);
        });
    }

    handleInputChange(event) {
        const input = event.target;
        const settingName = input.dataset.setting;

        if (!settingName) return;

        this.set(settingName, this.readInputValue(input));
    }

    handleRestoreDefaultsClick() {
        this.restoreDefaults();
    }

    readInputValue(input) {
        const type = input.dataset.settingType ?? input.type;

        if (type === "checkbox") return input.checked;
        if (type === "number") return Number(input.value);

        return input.value;
    }

    syncInput(input) {
        const settingName = input.dataset.setting;
        if (!settingName) return;
        if (!(settingName in this.values)) return;

        const value = this.values[settingName];
        const type = input.dataset.settingType ?? input.type;

        if (type === "checkbox") {
            input.checked = Boolean(value);
            return;
        }

        input.value = value;
    }

    syncScope(scope = document) {
        if (!scope) return;

        Array.from(scope.querySelectorAll("[data-setting]")).forEach((input) => {
            this.syncInput(input);
        });
    }

    set(name, value, options = {}) {
        if (!(name in this.values)) return;

        const normalizedValue = this.normalizeValue(name, value);
        if (this.values[name] === normalizedValue) return;

        this.values[name] = normalizedValue;
        this.apply(name);

        if (options.silent !== true) {
            this.notifyChange(name);
        }
    }

    setValues(values = {}, options = {}) {
        let changed = false;

        Object.keys(values).forEach((name) => {
            if (!(name in this.values)) return;

            const normalizedValue = this.normalizeValue(name, values[name]);
            if (this.values[name] === normalizedValue) return;

            this.values[name] = normalizedValue;
            changed = true;
        });

        if (!changed) return false;

        this.applyAll();
        this.syncScope();

        if (options.silent !== true) {
            this.notifyChange("all");
        }

        return true;
    }

    get(name) {
        return this.values[name];
    }

    restoreDefaults() {
        this.setValues(this.defaults);
    }

    createValues(values = {}) {
        const output = { ...this.defaults };

        Object.keys(output).forEach((name) => {
            output[name] = this.normalizeValue(name, values[name] ?? output[name], output);
        });

        return output;
    }

    normalizeValue(name, value, fallbackValues = this.values) {
        if (name === "boxel15RenderDistance") {
            const number = Number(value);
            if (!Number.isFinite(number)) return fallbackValues.boxel15RenderDistance;

            return Math.min(Math.max(number, 0), 1000);
        }

        if (name === "boxel15RenderBudget") {
            const number = Number(value);
            if (!Number.isFinite(number)) return fallbackValues.boxel15RenderBudget;

            return Math.min(Math.max(Math.floor(number), 0), 1000);
        }

        if (name === "cameraFov") {
            const number = Number(value);
            if (!Number.isFinite(number)) return fallbackValues.cameraFov;

            return Math.min(Math.max(number, 30), 120);
        }

        if (name === "undersampling") {
            return Boolean(value);
        }

        if (name === "undersamplingRatio") {
            const number = Number(value);
            if (!Number.isFinite(number)) return fallbackValues.undersamplingRatio;

            return Math.min(Math.max(number, 0.1), 1);
        }

        if (name === "wireframe") {
            return Boolean(value);
        }

        return value;
    }

    applyAll() {
        Object.keys(this.values).forEach((name) => {
            this.apply(name);
        });
    }

    apply(name) {
        if (name === "wireframe") {
            this.applyDebugMode();
            return;
        }

        if (name === "boxel15RenderDistance") {
            this.applyBoxel15RenderDistance();
            return;
        }

        if (name === "boxel15RenderBudget") {
            this.applyBoxel15RenderBudget();
            return;
        }

        if (name === "cameraFov") {
            this.applyCameraFov();
            return;
        }

        if (name === "undersampling" || name === "undersamplingRatio") {
            this.applyUndersampling();
        }
    }

    applyDebugMode() {
        const enabled = Boolean(this.values.wireframe);

        this.mapper?.setWireframeMode(enabled);
        this.threeD?.setSkyColor(enabled ? this.wireframeSkyColor : this.defaultSkyColor);
    }

    applyBoxel15RenderDistance() {
        this.mapper?.setBoxel15RenderDistance?.(this.values.boxel15RenderDistance);
    }

    applyBoxel15RenderBudget() {
        this.mapper?.setBoxel15RenderBudget?.(this.values.boxel15RenderBudget);
    }

    applyCameraFov() {
        this.threeD?.setCameraFov?.(this.values.cameraFov);
    }

    applyUndersampling() {
        this.threeD?.setUndersampling?.(
            this.values.undersampling,
            this.values.undersamplingRatio
        );
    }

    notifyChange(name) {
        this.syncScope();
        this.onChange?.(this.toMemoryData(), name, this);
    }

    toMemoryData() {
        return {
            kind: "settings",
            version: 1,
            name: "KL3 Settings",
            values: { ...this.values },
        };
    }

    loadMemoryData(data = null, options = {}) {
        const values = data?.values ?? data;
        if (!values || typeof values !== "object") return false;

        return this.setValues(values, options);
    }
}

export default Settings;
