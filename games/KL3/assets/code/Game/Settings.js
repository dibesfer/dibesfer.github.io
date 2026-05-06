export class Settings {
    constructor(options = {}) {
        this.threeD = options.threeD ?? null;
        this.mapper = options.mapper ?? null;

        this.values = {
            wireframe: false,
        };

        this.defaultSkyColor = options.defaultSkyColor ?? 0x87ceeb;
        this.wireframeSkyColor = options.wireframeSkyColor ?? 0x000000;

        this.handleInputChange = this.handleInputChange.bind(this);
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
    }

    handleInputChange(event) {
        const input = event.target;
        const settingName = input.dataset.setting;

        if (!settingName) return;

        this.set(settingName, this.readInputValue(input));
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

    set(name, value) {
        if (!(name in this.values)) return;
        if (this.values[name] === value) return;

        this.values[name] = value;
        this.apply(name);
    }

    get(name) {
        return this.values[name];
    }

    applyAll() {
        Object.keys(this.values).forEach((name) => {
            this.apply(name);
        });
    }

    apply(name) {
        if (name === "wireframe") {
            this.applyDebugMode();
        }
    }

    applyDebugMode() {
        const enabled = Boolean(this.values.wireframe);

        this.mapper?.setWireframeMode(enabled);
        this.threeD?.setSkyColor(enabled ? this.wireframeSkyColor : this.defaultSkyColor);
    }
}

export default Settings;
