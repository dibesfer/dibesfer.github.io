import { Input } from "../Input/Input.js";
import Commands from "./Chat/Commands.js";
import Hotbar from "./Hotbar.js";
import Menu from "./Menu/menu.js";

export class UI {
    constructor(root = document, input = new Input()) {
        this.root = root;
        this.input = input;
        this.fields = {
            consola: this.find("consola"),
            chat: this.find("chat"),
            minimap: this.find("minimap"),
            menu: this.find("menu"),
            hotbar: this.find("hotbar")
        };
        this.settings = {
            chunkRenderDistance: 60,
            cameraFov: 72,
            wireframeMode: false,
            wireframeVertexColors: false
        };
        this.hotbar = new Hotbar(this.fields.hotbar, this.input);
        this.menu = new Menu(this.fields.menu, this.input);
        this.chat = new Commands(this.fields.chat, this.root.querySelector("#chatInput"));

        this.settingDebounceMs = 250;
        this.pendingSettingTimers = new Map();
        this.pendingLodSettings = {
            lodFullDistance: 30,
            lodMediumDistance: 90
        };

        this.onInput = this.onInput.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onMenuToggle = this.onMenuToggle.bind(this);
        this.onPointerLockChange = this.onPointerLockChange.bind(this);
        this.onTargetChange = this.onTargetChange.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onSettingsUpdated = this.onSettingsUpdated.bind(this);
        this.onMenuTabChange = this.onMenuTabChange.bind(this);
        this.onInventoryUpdated = this.onInventoryUpdated.bind(this);
        this.onHotbarSelectIndex = this.onHotbarSelectIndex.bind(this);
    }

    start() {
        this.root.addEventListener("input", this.onInput);
        this.root.addEventListener("change", this.onChange);
        this.input.on("click", this.onClick);
        this.input.on("menuToggle", this.onMenuToggle);
        this.input.on("pointerLockChange", this.onPointerLockChange);
        this.input.on("targetChange", this.onTargetChange);
        this.input.on("keyDown", this.onKeyDown);
        this.input.on("settings.updated", this.onSettingsUpdated);
        this.input.on("menu.tabChange", this.onMenuTabChange);
        this.input.on("inventory.updated", this.onInventoryUpdated);
        this.input.on("hotbar.selectIndex", this.onHotbarSelectIndex);

        this.chat.start(this.input);
        this.menu.start();
        this.hotbar.start();
    }

    stop() {
        this.root.removeEventListener("input", this.onInput);
        this.root.removeEventListener("change", this.onChange);
        this.input.off("click", this.onClick);
        this.input.off("menuToggle", this.onMenuToggle);
        this.input.off("pointerLockChange", this.onPointerLockChange);
        this.input.off("targetChange", this.onTargetChange);
        this.input.off("keyDown", this.onKeyDown);
        this.input.off("settings.updated", this.onSettingsUpdated);
        this.input.off("menu.tabChange", this.onMenuTabChange);
        this.input.off("inventory.updated", this.onInventoryUpdated);
        this.input.off("hotbar.selectIndex", this.onHotbarSelectIndex);
        this.chat.stop();
        this.menu.stop();
        this.hotbar.stop?.();
    }

    find(name) {
        return this.root.querySelector(`[data-ui="${name}"]`);
    }

    async onInventoryUpdated(inventory = null) {
        await this.hotbar.setInventory(inventory);
    }

    onInput(event) {
        const target = event.target;

        if (target?.matches?.("[data-setting=\"chunk-render-distance\"]")) {
            const value = this.numberInputValue(target, this.settings.chunkRenderDistance ?? 60);
            this.previewChunkRenderDistance(value);
            this.scheduleSettingChange("chunkRenderDistance", value);
            return;
        }

        if (target?.matches?.("[data-setting=\"lod-full-distance\"]")) {
            const value = this.numberInputValue(target, this.pendingLodSettings.lodFullDistance ?? this.settings.lodFullDistance ?? 30);
            this.pendingLodSettings.lodFullDistance = value;
            this.previewLodInfo();
            return;
        }

        if (target?.matches?.("[data-setting=\"lod-medium-distance\"]")) {
            const value = this.numberInputValue(target, this.pendingLodSettings.lodMediumDistance ?? this.settings.lodMediumDistance ?? 90);
            this.pendingLodSettings.lodMediumDistance = value;
            this.previewLodInfo();
        }
    }

    onChange(event) {
        if (event.target?.matches?.("[data-setting=\"undersampling\"]")) {
            this.input.emit("settings.change", { undersampling: event.target.value });
            return;
        }

        if (event.target?.matches?.("[data-setting=\"render-budget\"]")) {
            this.input.emit("settings.change", { renderBudget: event.target.value });
            return;
        }

        if (event.target?.matches?.("[data-setting=\"chunk-render-distance\"]")) {
            this.flushScheduledSetting("chunkRenderDistance");
            this.input.emit("settings.change", { chunkRenderDistance: this.numberInputValue(event.target, this.settings.chunkRenderDistance ?? 60) });
            return;
        }

        if (event.target?.matches?.("[data-setting=\"camera-fov\"]")) {
            this.input.emit("settings.change", { cameraFov: event.target.value });
            return;
        }

        if (event.target?.matches?.("[data-setting=\"pixelated-upscale\"]")) {
            this.input.emit("settings.change", { pixelatedUpscale: event.target.checked });
            return;
        }

        if (event.target?.matches?.("[data-setting=\"wireframe-mode\"]")) {
            this.input.emit("settings.change", { wireframeMode: event.target.checked });
            return;
        }

        if (event.target?.matches?.("[data-setting=\"wireframe-vertex-colors\"]")) {
            this.input.emit("settings.change", { wireframeVertexColors: event.target.checked });
            return;
        }

        if (event.target?.matches?.("[data-setting=\"lod-enabled\"]")) {
            this.input.emit("settings.change", { lodEnabled: event.target.checked });
            return;
        }

        if (event.target?.matches?.("[data-setting=\"lod-full-distance\"]")) {
            this.pendingLodSettings.lodFullDistance = this.numberInputValue(event.target, this.settings.lodFullDistance ?? 30);
            this.previewLodInfo();
            return;
        }

        if (event.target?.matches?.("[data-setting=\"lod-medium-distance\"]")) {
            this.pendingLodSettings.lodMediumDistance = this.numberInputValue(event.target, this.settings.lodMediumDistance ?? 90);
            this.previewLodInfo();
            return;
        }

        if (event.target?.matches?.("[data-action=\"load-woxel-file\"]")) {
            const file = event.target.files?.[0] || null;

            if (file) this.input.emit("world.loadWoxel", file);
            event.target.value = "";
        }
    }

    onClick(event) {
        const hotbarItem = this.hotbar.selectFromElement(event.target);

        if (hotbarItem !== null) return;

        if (event.target?.matches?.("[data-action=\"reload-world\"]")) {
            this.input.emit("world.reset");
            return;
        }

        if (event.target?.matches?.("[data-action=\"export-woxel\"]")) {
            this.input.emit("world.exportWoxel");
            return;
        }

        if (event.target?.matches?.("[data-action=\"load-woxel\"]")) {
            this.root.querySelector("[data-action=\"load-woxel-file\"]")?.click();
            return;
        }

        if (event.target?.matches?.("[data-action=\"restore-settings\"]")) {
            this.input.emit("settings.restoreDefaults");
            return;
        }

        if (event.target?.matches?.("[data-action=\"apply-lod-settings\"]")) {
            this.applyPendingLodSettings();
            return;
        }

        if (event.target?.closest?.("#ThreeScene")) {
            this.hideMenu();
            return;
        }

        if (!this.fields.menu || this.fields.menu.contains(event.target)) return;

        this.hideMenu();
    }

    onMenuToggle() {
        this.toggleMenu();
    }

    onPointerLockChange(isLocked) {
        if (isLocked) this.hideMenu();
        else this.showMenu();
    }

    onTargetChange(name = "none") {
        this.hotbar.setTargetName(name);
    }

    onSettingsUpdated(settings = {}) {
        this.settings = {
            ...this.settings,
            ...settings
        };
        this.pendingLodSettings = {
            lodFullDistance: this.settings.lodFullDistance ?? 30,
            lodMediumDistance: this.settings.lodMediumDistance ?? 90
        };

        const undersampling = this.root.querySelector("[data-setting=\"undersampling\"]");
        const renderBudget = this.root.querySelector("[data-setting=\"render-budget\"]");
        const renderBudgetInfo = this.root.querySelector("[data-ui=\"render-budget-info\"]");
        const pixelatedUpscale = this.root.querySelector("[data-setting=\"pixelated-upscale\"]");
        const wireframeMode = this.root.querySelector("[data-setting=\"wireframe-mode\"]");
        const wireframeVertexColors = this.root.querySelector("[data-setting=\"wireframe-vertex-colors\"]");
        const wireframeVertexColorsField = this.root.querySelector("[data-ui=\"wireframe-vertex-colors-field\"]");
        const chunkRenderDistance = this.root.querySelector("[data-ui=\"chunk-render-distance\"]");
        const chunkRenderDistanceInput = this.root.querySelector("[data-setting=\"chunk-render-distance\"]");
        const cameraFov = this.root.querySelector("[data-setting=\"camera-fov\"]");
        const lodEnabled = this.root.querySelector("[data-setting=\"lod-enabled\"]");
        const lodFullDistance = this.root.querySelector("[data-ui=\"lod-full-distance\"]");
        const lodFullInput = this.root.querySelector("[data-setting=\"lod-full-distance\"]");
        const lodMediumDistance = this.root.querySelector("[data-ui=\"lod-medium-distance\"]");
        const lodMediumInput = this.root.querySelector("[data-setting=\"lod-medium-distance\"]");
        const lodInfo = this.root.querySelector("[data-ui=\"lod-info\"]");

        if (undersampling) undersampling.value = String(settings.undersampling ?? 100);

        if (renderBudget) {
            const value = settings.renderBudget ?? "MEDIUM";

            renderBudget.value = value;
            if (renderBudgetInfo) renderBudgetInfo.textContent = `${this.renderBudgetChunks(value)} visible chunks`;
        }

        if (pixelatedUpscale) pixelatedUpscale.checked = Boolean(settings.pixelatedUpscale);
        if (wireframeMode) wireframeMode.checked = Boolean(settings.wireframeMode);
        if (wireframeVertexColors) wireframeVertexColors.checked = Boolean(settings.wireframeVertexColors);
        if (wireframeVertexColorsField) wireframeVertexColorsField.hidden = !Boolean(settings.wireframeMode);

        const currentChunkRenderDistance = settings.chunkRenderDistance ?? 60;

        if (chunkRenderDistance) chunkRenderDistance.textContent = `${currentChunkRenderDistance} voxels`;
        if (chunkRenderDistanceInput && document.activeElement !== chunkRenderDistanceInput) {
            chunkRenderDistanceInput.value = String(currentChunkRenderDistance);
        }

        if (lodEnabled) lodEnabled.checked = Boolean(settings.lodEnabled);
        if (lodFullDistance) lodFullDistance.textContent = `${settings.lodFullDistance ?? 30} voxels`;
        if (lodFullInput && document.activeElement !== lodFullInput) lodFullInput.value = String(settings.lodFullDistance ?? 30);
        if (lodMediumDistance) lodMediumDistance.textContent = `${settings.lodMediumDistance ?? 90} voxels`;
        if (lodMediumInput && document.activeElement !== lodMediumInput) lodMediumInput.value = String(settings.lodMediumDistance ?? 90);
        this.previewLodInfo();
        if (cameraFov) cameraFov.value = String(settings.cameraFov ?? 72);
    }

    onMenuTabChange(name = "") {
        if (name !== "settings") return;

        requestAnimationFrame(() => this.onSettingsUpdated(this.settings));
    }

    numberInputValue(input, fallback = 0) {
        const number = Math.round(Number(input?.value));

        return Number.isFinite(number) ? number : fallback;
    }

    previewChunkRenderDistance(value = this.settings.chunkRenderDistance ?? 60) {
        const label = this.root.querySelector("[data-ui=\"chunk-render-distance\"]");

        if (label) label.textContent = `${value} voxels`;
    }

    scheduleSettingChange(name, value) {
        window.clearTimeout(this.pendingSettingTimers.get(name));
        this.pendingSettingTimers.set(name, window.setTimeout(() => {
            this.pendingSettingTimers.delete(name);
            this.input.emit("settings.change", { [name]: value });
        }, this.settingDebounceMs));
    }

    flushScheduledSetting(name) {
        const timer = this.pendingSettingTimers.get(name);

        if (!timer) return;
        window.clearTimeout(timer);
        this.pendingSettingTimers.delete(name);
    }

    previewLodInfo() {
        const lodFullDistance = this.root.querySelector("[data-ui=\"lod-full-distance\"]");
        const lodMediumDistance = this.root.querySelector("[data-ui=\"lod-medium-distance\"]");
        const lodInfo = this.root.querySelector("[data-ui=\"lod-info\"]");
        const enabled = Boolean(this.settings.lodEnabled);
        const full = this.pendingLodSettings.lodFullDistance ?? this.settings.lodFullDistance ?? 30;
        const medium = Math.max(full, this.pendingLodSettings.lodMediumDistance ?? this.settings.lodMediumDistance ?? 90);
        const dirty = full !== (this.settings.lodFullDistance ?? 30) || medium !== (this.settings.lodMediumDistance ?? 90);

        if (lodFullDistance) lodFullDistance.textContent = `${full} voxels`;
        if (lodMediumDistance) lodMediumDistance.textContent = `${medium} voxels`;
        if (lodInfo) {
            lodInfo.textContent = `${enabled ? "LOD ON" : "LOD OFF"} | FULL 0-${full} | MEDIUM ${full}-${medium} | MINIMAL ${medium}+${dirty ? " | unapplied" : ""}`;
        }
    }

    applyPendingLodSettings() {
        const full = this.pendingLodSettings.lodFullDistance ?? this.settings.lodFullDistance ?? 30;
        const medium = Math.max(full, this.pendingLodSettings.lodMediumDistance ?? this.settings.lodMediumDistance ?? 90);

        this.input.emit("settings.change", {
            lodFullDistance: full,
            lodMediumDistance: medium
        });
    }

    renderBudgetChunks(renderBudget = "MEDIUM") {
        return {
            LOW: 32,
            MEDIUM: 48,
            HIGH: 64
        }[renderBudget] ?? 48;
    }

    onKeyDown(event) {
        if (event.repeat) return;
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;

        this.hotbar.selectByKey(event.key);
    }

    onHotbarSelectIndex(index = 0) {
        this.hotbar.select(index);
    }

    toggleMenu() {
        if (!this.fields.menu) return;

        this.fields.menu.hidden = !this.fields.menu.hidden;
    }

    hideMenu() {
        if (!this.fields.menu) return;

        this.fields.menu.hidden = true;
    }

    showMenu() {
        if (!this.fields.menu) return;

        this.fields.menu.hidden = false;
    }
}

export default UI;






