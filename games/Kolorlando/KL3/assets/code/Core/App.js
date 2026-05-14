import { BoxelEditor } from "../Wabavam/Boxel/BoxelEditor/BoxelEditor.js";
import { Chat } from "../UI/Chat/Chat.js";
import { Collision } from "../Game/Collision.js";
import { Commands } from "../UI/Chat/Commands.js";
import { Debug } from "../Game/Debug.js";
import { Events } from "./Events.js";
import { Highlighting } from "../Wabavam/Highlighting.js";
import { History } from "../Memory/History.js";
import { Hotbar } from "../UI/Hotbar/Hotbar.js";
import { Input } from "../Input/Input.js";
import { Inventory } from "../Inventory/Inventory.js";
import { Loop } from "./Loop.js";
import { Mapper } from "../Game/Mapper.js";
import { WoxelGenerator } from "../Wabavam/Woxel/WoxelGenerator.js";
import { Memory } from "../Memory/Memory.js";
import { Player } from "../Player/Player.js";
import { Raycast } from "../Raycast/Raycast.js";
import { Settings } from "../Game/Settings.js";
import { Screen } from "../Game/Screen/Screen.js";
import { ThreeD } from "../ThreeD/ThreeD.js";
import { UI } from "../UI/UI.js";
import { VoxelHighlight } from "../Wabavam/Voxel/VoxelHighlight.js";
import { createBoxelItem, createVoxelItem } from "../Item/Item.js";
import { voxelObjects12 } from "../Wabavam/Voxel/12colors/12colors.js";
import { DEFAULT_WOXEL_TEMPLATE_ID } from "../Wabavam/Woxel/woxelTemplates.js";
import { loadMicroxeledVoxels } from "../Wabavam/Voxel/Microxeled/index.js";

export class App {
    constructor(options = {}) {
        this.mainWoxelKey = options.mainWoxelKey ?? "mainWoxel";
        this.mainHistoryKey = options.mainHistoryKey ?? "mainWoxelHistory";
        this.mainBlueBoxelClipboardKey = options.mainBlueBoxelClipboardKey ?? "mainBlueBoxelClipboard";
        this.mainSavedBoxelsKey = options.mainSavedBoxelsKey ?? "mainSavedBoxels";
        this.mainSettingsKey = options.mainSettingsKey ?? "mainSettings";
        this.autosaveDelayMs = options.autosaveDelayMs ?? 5000;
        this.historySaveDelayMs = options.historySaveDelayMs ?? 750;
        this.savedBoxelsSaveDelayMs = options.savedBoxelsSaveDelayMs ?? 250;
        this.savedBoxelsLimit = options.savedBoxelsLimit ?? 17;
        this.inventorySize = options.inventorySize ?? 7;
        this.boxelHoldMs = options.boxelHoldMs ?? 450;
        this.boxel15RenderDistance = options.boxel15RenderDistance ?? 60;
        this.boxel15RenderBudget = options.boxel15RenderBudget ?? 48;
        this.cameraFov = options.cameraFov ?? 90;
        this.undersampling = options.undersampling ?? false;
        this.undersamplingRatio = options.undersamplingRatio ?? 0.5;

        this.elements = {};
        this.autosaveTimer = null;
        this.historySaveTimer = null;
        this.blueBoxelClipboardSaveTimer = null;
        this.savedBoxelsSaveTimer = null;
        this.settingsSaveTimer = null;
        this.autosaveInFlight = false;
        this.historySaveInFlight = false;
        this.blueBoxelClipboardSaveInFlight = false;
        this.savedBoxelsSaveInFlight = false;
        this.settingsSaveInFlight = false;
        this.woxel = null;
        this.microxeledVoxels = [];
        this.selectedItem = null;
        this.savedBoxels = [];
        this.woxelMemoryStatusText = "checking...";
    }

    async start() {
        /*
        1. DOM
        Cache the few document nodes needed by runtime systems.
        */
        this.cacheElements();

        this.screen = new Screen({
            onChange: () => this.handleScreenModeChange(),
        });
        this.screen.start();

        /*
        2. MEMORY
        Memory loads saved settings before ThreeD creates the camera and renderer.
        */
        this.memory = new Memory();
        this.savedSettingsData = await this.loadSettingsDataFromIndexedDB();
        await this.loadSavedBoxelsFromIndexedDB();

        /*
        3. THREED AND MAPPER
        ThreeD owns the scene bridge; Mapper creates renderable world meshes.
        */
        this.threeD = new ThreeD({
            canvas: this.elements.threeDCanvas,
            cameraFov: this.savedSettingsData?.values?.cameraFov ?? this.cameraFov,
            undersampling: this.savedSettingsData?.values?.undersampling ?? this.undersampling,
            undersamplingRatio: this.savedSettingsData?.values?.undersamplingRatio ?? this.undersamplingRatio,
        });
        this.threeD.start();

        this.microxeledVoxels = await loadMicroxeledVoxels();
        this.mapper = new Mapper({
            woxelGenerator: new WoxelGenerator({
                defaultTemplateId: DEFAULT_WOXEL_TEMPLATE_ID,
                extraVoxels: this.microxeledVoxels,
            }),
            boxel15RenderDistance: this.boxel15RenderDistance,
            boxel15RenderBudget: this.boxel15RenderBudget,
        });
        this.woxel = await this.loadInitialWoxel();
        this.threeD.setWorld(this.mapper.createWoxelObject3D(this.woxel));

        /*
        4. GAME SYSTEMS
        Create simulation systems that depend on the active Woxel.
        */
        this.collision = new Collision({
            woxel: this.woxel,
            boundaryAsSolid: true,
        });

        this.player = new Player({
            camera: this.threeD.getCamera(),
            collision: this.collision,
            gravity: 9.807,
            body: {
                width: 0.8,
                height: 1.8,
                depth: 0.8,
            },
            cameraPosition: 1.7,
        });
        this.restorePlayerInWoxel(this.woxel);
        this.mapper.updateBoxel15RenderDistance(
            this.player.getCameraPosition(),
            this.player.getCameraDirection()
        );

        this.settings = new Settings({
            threeD: this.threeD,
            mapper: this.mapper,
            values: this.savedSettingsData?.values,
            boxel15RenderDistance: this.savedSettingsData?.values?.boxel15RenderDistance ?? this.boxel15RenderDistance,
            boxel15RenderBudget: this.savedSettingsData?.values?.boxel15RenderBudget ?? this.boxel15RenderBudget,
            cameraFov: this.savedSettingsData?.values?.cameraFov ?? this.cameraFov,
            undersampling: this.savedSettingsData?.values?.undersampling ?? this.undersampling,
            undersamplingRatio: this.savedSettingsData?.values?.undersamplingRatio ?? this.undersamplingRatio,
            onChange: () => this.scheduleSettingsSave(),
        });
        this.settings.start();

        this.debug = new Debug({
            consolaElement: this.elements.consola,
            drawThrottleMs: 250,
        });

        /*
        5. INVENTORY AND UI
        Build visible interface after settings exist so menus can wire settings.
        */
        this.voxelCatalogItems = [
            ...voxelObjects12,
            ...this.microxeledVoxels,
        ].map((voxel) => createVoxelItem(voxel));
        this.inventory = new Inventory({
            name: "Hotbar Inventory",
            size: this.inventorySize,
            items: this.voxelCatalogItems.slice(0, this.inventorySize).map((item) => item.clone()),
        });
        this.selectedItem = this.inventory.getSelectedItem();

        this.events = new Events({ app: this });

        this.ui = new UI({
            settings: this.settings,
            onPageLoaded: (contentElement, page) => {
                this.events.wireMenuPage(contentElement, page);
            },
        });
        this.ui.start();
        this.ui.setTargetName("none");

        this.hotbar = new Hotbar({
            element: this.elements.hotbar,
            inventory: this.inventory,
            onSelect: (item) => {
                this.selectedItem = item;
            },
        });
        this.hotbar.start();

        /*
        6. AIMING AND EDITING
        Raycast reads raycastable Boxel15 meshes; highlights and BoxelEditor visualize intent.
        */
        this.raycast = new Raycast({
            camera: this.threeD.getCamera(),
            woxel: this.woxel,
            ui: this.ui,
            range: 20,
            throttleMs: 80,
            getTargets: () => this.mapper.getRaycastableMeshes(),
        });

        this.history = new History({
            woxel: this.woxel,
            mapper: this.mapper,
            raycast: this.raycast,
            limit: 15,
            onChange: () => this.scheduleHistorySave(),
            onApply: () => {
                this.scheduleAutosave();
                this.scheduleHistorySave();
            },
        });
        await this.loadCurrentHistoryFromIndexedDB();

        this.highlighting = new Highlighting();

        this.voxelHighlight = new VoxelHighlight({
            woxel: this.woxel,
            highlighting: this.highlighting,
        });
        this.threeD.add(this.voxelHighlight.getObject3D());

        this.boxelEditor = new BoxelEditor({
            woxel: this.woxel,
            mapper: this.mapper,
            raycast: this.raycast,
            player: this.player,
            voxelHighlight: this.voxelHighlight,
            highlighting: this.highlighting,
            history: this.history,
            getSelectedVoxel: () => this.selectedItem?.getVoxel?.() ?? null,
            isInsidePlayerBody: (gridPosition) => this.isInsidePlayerBody(gridPosition),
            scheduleAutosave: () => this.scheduleAutosave(),
            scheduleClipboardSave: () => this.scheduleBlueBoxelClipboardSave(),
            onBlueBoxelSaved: (boxel) => this.addSavedBoxelFromBlueBoxel(boxel),
        });
        await this.loadCurrentBlueBoxelClipboardFromIndexedDB();
        this.threeD.add(this.boxelEditor.getObject3D());

        /*
        7. CHAT AND INPUT
        Chat owns text entry; Input owns raw keys and pointer intent.
        */
        this.commands = new Commands({
            player: this.player,
            woxel: this.woxel,
            collision: this.collision,
        });

        this.chat = new Chat({
            chatBoxElement: this.elements.chatBox,
            chatInputElement: this.elements.chatInput,
            commands: this.commands,
        });
        this.chat.start();

        this.input = new Input({
            ui: this.ui,
            canvas: this.elements.threeDCanvas,
            player: this.player,
            chat: this.chat,
            holdMs: this.boxelHoldMs,
            ...this.events.createInputCallbacks(),
        });

        this.chat.onClose = () => {
            this.input.handleChatClosed();
        };

        this.ui.setJoysticksLoaded((joysticks) => {
            this.input.setJoysticksRoot(joysticks);
        });

        this.player.setInput(this.input);
        this.applyScreenModePolicy();

        /*
        8. EVENTS AND LOOP
        Events wire browser/gameplay callbacks; Loop starts the frame heartbeat.
        */
        this.events.start();
        this.loop = new Loop({ app: this });

        this.exposeGlobal();
        this.updateWoxelMenuInfo();
        this.loop.start();
    }

    cacheElements() {
        this.elements = {
            consola: document.querySelector("#consola"),
            threeDCanvas: document.querySelector("#threeDCanvas"),
            chatBox: document.querySelector("#chatBox"),
            chatInput: document.querySelector("#chatInput"),
            hotbar: document.querySelector("#hotbar"),
        };
    }

    async loadSettingsDataFromIndexedDB() {
        try {
            return await this.memory.loadSettings(this.mainSettingsKey);
        } catch (error) {
            console.warn("Settings load failed. Using defaults.", error);
            return null;
        }
    }

    async loadInitialWoxel() {
        try {
            const savedWoxel = await this.memory.load(this.mainWoxelKey);
            if (savedWoxel) return savedWoxel;
        } catch (error) {
            console.warn("Memory load failed. Creating default Woxel.", error);
        }

        const defaultWoxel = this.mapper.createAWoxel(DEFAULT_WOXEL_TEMPLATE_ID);
        await this.memory.save(this.mainWoxelKey, defaultWoxel);
        this.woxelMemoryStatusText = "Datos guardados";

        return defaultWoxel;
    }

    setActiveWoxel(nextWoxel, options = {}) {
        if (!nextWoxel) return;

        this.woxel = nextWoxel;

        const worldObject3D = this.mapper.createWoxelObject3D(this.woxel);
        this.threeD.setWorld(worldObject3D);

        this.collision.setWoxel(this.woxel);
        this.commands.setWoxel(this.woxel);
        this.raycast.setWoxel(this.woxel);
        this.history?.setWoxel(this.woxel);
        this.voxelHighlight.setWoxel(this.woxel);
        this.boxelEditor.setWoxel(this.woxel);
        this.applyScreenModePolicy();

        if (options.preserveHistory !== true) {
            this.history?.clear?.();
            this.scheduleHistorySave();
        }

        if (options.spawnPlayer !== false) {
            this.restorePlayerInWoxel(this.woxel);
        }

        this.mapper.updateBoxel15RenderDistance(
            this.player.getCameraPosition(),
            this.player.getCameraDirection()
        );

        if (window.KL3) {
            window.KL3.woxel = this.woxel;
        }

        this.updateWoxelMenuInfo();
    }

    restorePlayerInWoxel(woxel = this.woxel) {
        const playerState = woxel?.getPlayerState?.();

        if (playerState && this.player?.loadMemoryData?.(playerState, { pitch: this.player.defaultPitch })) {
            this.rememberCurrentPlayerState();
            return true;
        }

        this.player.spawnInWoxel(woxel);
        this.rememberCurrentPlayerState();

        return false;
    }

    rememberCurrentPlayerState() {
        this.lastPlayerStateKey = this.createPlayerStateKey();
    }

    createPlayerStateKey() {
        const state = this.player?.toMemoryData?.();
        if (!state?.position) return "";

        return [
            state.position.x.toFixed(3),
            state.position.y.toFixed(3),
            state.position.z.toFixed(3),
            Number(state.yaw ?? 0).toFixed(4),
        ].join(",");
    }

    maybeSchedulePlayerStateAutosave() {
        if (!this.player || !this.woxel) return false;

        const key = this.createPlayerStateKey();
        if (!key || key === this.lastPlayerStateKey) return false;

        this.rememberCurrentPlayerState();
        this.scheduleAutosave();

        return true;
    }

    async createNewWoxelFromTemplate(templateId = DEFAULT_WOXEL_TEMPLATE_ID) {
        const nextWoxel = this.mapper.createAWoxel(templateId);

        this.setActiveWoxel(nextWoxel);
        await this.saveCurrentWoxelToIndexedDB();

        return nextWoxel;
    }

    handleScreenModeChange() {
        this.applyScreenModePolicy();
        this.threeD?.resize?.();
        this.raycast?.forceNextCast?.({ preserveTargetOnMiss: false });
    }

    getScreenPolicy() {
        return this.screen?.getPolicy?.() ?? {
            ui: {},
            input: {},
            services: {},
        };
    }

    isScreenServiceEnabled(name) {
        const services = this.getScreenPolicy().services ?? {};

        return services[name] !== false;
    }

    applyScreenModePolicy() {
        const policy = this.getScreenPolicy();

        this.screenPolicy = policy;

        if (window.KL3) {
            window.KL3.screenPolicy = policy;
        }

        this.ui?.applyScreenPolicy?.(policy);
        this.input?.setScreenPolicy?.(policy.input);

        if (policy.services?.raycast === false) {
            this.raycast?.setTarget?.(null);
            this.ui?.setTargetName?.("none");
        }

        if (policy.services?.voxelHighlight === false) {
            this.voxelHighlight?.hide?.();
        }

        if (policy.services?.boxelEditor === false) {
            this.boxelEditor?.cancel?.({ forceIdle: true });
        }
    }

    isInsidePlayerBody(gridPosition) {
        const gamePosition = this.woxel.gridToGame(gridPosition);
        const voxelCenter = {
            x: gamePosition.x + 0.5,
            y: gamePosition.y + 0.5,
            z: gamePosition.z + 0.5,
        };
        const feet = this.player.getFeetPosition();
        const body = this.player.body;

        const halfWidth = body.width / 2;
        const halfDepth = body.depth / 2;

        return voxelCenter.x >= feet.x - halfWidth
            && voxelCenter.x <= feet.x + halfWidth
            && voxelCenter.y >= feet.y
            && voxelCenter.y <= feet.y + body.height
            && voxelCenter.z >= feet.z - halfDepth
            && voxelCenter.z <= feet.z + halfDepth;
    }

    scheduleAutosave() {
        window.clearTimeout(this.autosaveTimer);
        this.setWoxelMemoryStatus("Guardando datos...");

        this.autosaveTimer = window.setTimeout(() => {
            this.saveCurrentWoxelToIndexedDB();
        }, this.autosaveDelayMs);
    }

    async saveCurrentWoxelToIndexedDB() {
        if (this.autosaveInFlight) return false;

        this.autosaveInFlight = true;
        this.setWoxelMemoryStatus("Guardando datos...");
        window.clearTimeout(this.autosaveTimer);
        this.autosaveTimer = null;

        let saved = false;

        try {
            saved = await this.memory.save(this.mainWoxelKey, this.woxel, {
                player: this.player,
            });

            return saved;
        } catch (error) {
            console.warn("Memory save failed.", error);
            return false;
        } finally {
            this.autosaveInFlight = false;

            if (saved) {
                this.setWoxelMemoryStatus("Datos guardados");
            }

            this.updateWoxelMenuInfo();
        }
    }

    scheduleHistorySave() {
        window.clearTimeout(this.historySaveTimer);

        this.historySaveTimer = window.setTimeout(() => {
            this.saveCurrentHistoryToIndexedDB();
        }, this.historySaveDelayMs);
    }

    async saveCurrentHistoryToIndexedDB() {
        if (this.historySaveInFlight) return false;
        if (!this.history) return false;

        this.historySaveInFlight = true;
        window.clearTimeout(this.historySaveTimer);
        this.historySaveTimer = null;

        try {
            return await this.memory.saveData(this.mainHistoryKey, this.history.toMemoryData());
        } catch (error) {
            console.warn("History save failed.", error);
            return false;
        } finally {
            this.historySaveInFlight = false;
        }
    }

    async loadCurrentHistoryFromIndexedDB() {
        if (!this.history) return false;

        try {
            const data = await this.memory.loadData(this.mainHistoryKey);
            return this.history.loadMemoryData(data);
        } catch (error) {
            console.warn("History load failed.", error);
            this.history.clear({ silent: true });
            return false;
        }
    }


    scheduleBlueBoxelClipboardSave() {
        window.clearTimeout(this.blueBoxelClipboardSaveTimer);

        this.blueBoxelClipboardSaveTimer = window.setTimeout(() => {
            this.saveCurrentBlueBoxelClipboardToIndexedDB();
        }, this.historySaveDelayMs);
    }

    async saveCurrentBlueBoxelClipboardToIndexedDB() {
        if (this.blueBoxelClipboardSaveInFlight) return false;
        if (!this.boxelEditor) return false;

        const data = this.boxelEditor.getBlueBoxelClipboardMemoryData?.();
        if (!data) return false;

        this.blueBoxelClipboardSaveInFlight = true;
        window.clearTimeout(this.blueBoxelClipboardSaveTimer);
        this.blueBoxelClipboardSaveTimer = null;

        try {
            return await this.memory.saveData(this.mainBlueBoxelClipboardKey, data);
        } catch (error) {
            console.warn("BlueBoxel clipboard save failed.", error);
            return false;
        } finally {
            this.blueBoxelClipboardSaveInFlight = false;
        }
    }

    async loadCurrentBlueBoxelClipboardFromIndexedDB() {
        if (!this.boxelEditor) return false;

        try {
            const data = await this.memory.loadData(this.mainBlueBoxelClipboardKey);
            return this.boxelEditor.setBlueBoxelClipboardMemoryData?.(data) === true;
        } catch (error) {
            console.warn("BlueBoxel clipboard load failed.", error);
            return false;
        }
    }

    async loadSavedBoxelsFromIndexedDB() {
        try {
            this.savedBoxels = await this.memory.loadSavedBoxels(this.mainSavedBoxelsKey);
            this.trimSavedBoxels();
            this.syncSavedBoxelsGlobal();
            return true;
        } catch (error) {
            console.warn("Saved Boxels load failed.", error);
            this.savedBoxels = [];
            return false;
        }
    }

    addSavedBoxelFromBlueBoxel(boxel = null) {
        if (!boxel) return false;

        const savedBoxel = {
            id: this.createSavedBoxelId(),
            name: null,
            createdAt: new Date().toISOString(),
            boxel,
        };

        this.savedBoxels = [savedBoxel, ...this.savedBoxels];
        this.trimSavedBoxels();
        this.syncSavedBoxelsGlobal();
        this.scheduleSavedBoxelsSave();
        this.refreshBoxelCatalog();

        return true;
    }

    createSavedBoxelId() {
        if (globalThis.crypto?.randomUUID) return `boxel_${globalThis.crypto.randomUUID()}`;

        return `boxel_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }

    trimSavedBoxels() {
        this.savedBoxels = this.savedBoxels.slice(0, this.savedBoxelsLimit);
    }

    syncSavedBoxelsGlobal() {
        if (window.KL3) {
            window.KL3.savedBoxels = this.savedBoxels;
        }
    }

    getSavedBoxelItems() {
        return this.savedBoxels.map((savedBoxel) => createBoxelItem(savedBoxel, {
            name: savedBoxel.name ?? "NULL",
        }));
    }

    loadSavedBoxelIntoClipboard(savedBoxelId = null) {
        const savedBoxel = this.savedBoxels.find((boxel) => boxel.id === savedBoxelId);
        if (!savedBoxel?.boxel) return false;

        this.boxelEditor?.blueBoxelClipboard?.setBoxel?.(savedBoxel.boxel);
        this.boxelEditor?.enterBlueBoxelPreview?.();
        this.scheduleBlueBoxelClipboardSave();

        return true;
    }

    getSavedBoxelById(savedBoxelId = null) {
        if (!savedBoxelId) return null;

        return this.savedBoxels.find((boxel) => boxel.id === savedBoxelId) ?? null;
    }

    async downloadSavedBoxel(savedBoxelId = null) {
        const savedBoxel = this.getSavedBoxelById(savedBoxelId);
        if (!savedBoxel?.boxel) return false;

        return this.memory.exportSavedBoxel(savedBoxel);
    }

    deleteSavedBoxel(savedBoxelId = null) {
        if (!savedBoxelId) return false;

        const nextSavedBoxels = this.savedBoxels.filter((boxel) => boxel.id !== savedBoxelId);
        if (nextSavedBoxels.length === this.savedBoxels.length) return false;

        this.savedBoxels = nextSavedBoxels;
        this.syncSavedBoxelsGlobal();
        this.scheduleSavedBoxelsSave();
        this.refreshBoxelCatalog();

        return true;
    }


    scheduleSavedBoxelsSave() {
        window.clearTimeout(this.savedBoxelsSaveTimer);

        this.savedBoxelsSaveTimer = window.setTimeout(() => {
            this.saveSavedBoxelsToIndexedDB();
        }, this.savedBoxelsSaveDelayMs);
    }

    async saveSavedBoxelsToIndexedDB() {
        if (this.savedBoxelsSaveInFlight) return false;

        this.savedBoxelsSaveInFlight = true;
        window.clearTimeout(this.savedBoxelsSaveTimer);
        this.savedBoxelsSaveTimer = null;

        try {
            return await this.memory.saveSavedBoxels(this.mainSavedBoxelsKey, this.savedBoxels);
        } catch (error) {
            console.warn("Saved Boxels save failed.", error);
            return false;
        } finally {
            this.savedBoxelsSaveInFlight = false;
        }
    }

    refreshBoxelCatalog() {
        document.querySelectorAll("#boxelCatalog").forEach((catalogElement) => {
            const contentElement = catalogElement.closest(".menuSection") ?? document;
            this.events?.renderBoxelCatalog?.(contentElement);
        });
    }

    scheduleSettingsSave() {
        window.clearTimeout(this.settingsSaveTimer);

        this.settingsSaveTimer = window.setTimeout(() => {
            this.saveCurrentSettingsToIndexedDB();
        }, 250);
    }

    async saveCurrentSettingsToIndexedDB() {
        if (this.settingsSaveInFlight) return false;
        if (!this.settings) return false;

        this.settingsSaveInFlight = true;
        window.clearTimeout(this.settingsSaveTimer);
        this.settingsSaveTimer = null;

        try {
            return await this.memory.saveSettings(this.mainSettingsKey, this.settings);
        } catch (error) {
            console.warn("Settings save failed.", error);
            return false;
        } finally {
            this.settingsSaveInFlight = false;
        }
    }

    async updateWoxelMenuInfo(scope = document) {
        const nameElement = scope.querySelector?.("#woxelName");
        const sizeElement = scope.querySelector?.("#woxelSize");
        const memoryStatusElement = scope.querySelector?.("#woxelMemoryStatus");

        if (nameElement) nameElement.textContent = this.woxel?.name ?? "Woxel";

        if (sizeElement && this.woxel?.size) {
            sizeElement.textContent = `${this.woxel.size.x} ${this.woxel.size.y} ${this.woxel.size.z}`;
        }

        if (!memoryStatusElement) return;

        if (this.isAutosavePending()) {
            memoryStatusElement.textContent = "Guardando datos...";
            return;
        }

        if (this.woxelMemoryStatusText === "Datos guardados") {
            memoryStatusElement.textContent = this.woxelMemoryStatusText;
            return;
        }

        memoryStatusElement.textContent = await this.memory.has(this.mainWoxelKey)
            ? "Datos guardados"
            : "checking...";
    }

    setWoxelMemoryStatus(text = "checking...") {
        this.woxelMemoryStatusText = text;

        const memoryStatusElements = Array.from(document.querySelectorAll("#woxelMemoryStatus"));
        memoryStatusElements.forEach((element) => {
            element.textContent = text;
        });
    }

    isAutosavePending() {
        return this.autosaveTimer !== null || this.autosaveInFlight === true;
    }


    debugProfile() {
        return this.debug?.debugProfile?.(this);
    }

    debugBenchmark(durationSec = 15, intervalMs = 1000) {
        return this.debug?.debugBenchmark?.(this, durationSec, intervalMs);
    }

    exposeGlobal() {
        window.KL3 = {
            app: this,
            threeD: this.threeD,
            mapper: this.mapper,
            memory: this.memory,
            history: this.history,
            savedBoxels: this.savedBoxels,
            woxel: this.woxel,
            collision: this.collision,
            player: this.player,
            input: this.input,
            chat: this.chat,
            commands: this.commands,
            inventory: this.inventory,
            hotbar: this.hotbar,
            raycast: this.raycast,
            highlighting: this.highlighting,
            settings: this.settings,
            screen: this.screen,
            screenPolicy: this.screenPolicy,
            voxelHighlight: this.voxelHighlight,
            boxelEditor: this.boxelEditor,
            boxel15RenderDistance: this.mapper.boxel15RenderDistance,
            microxeledVoxels: this.microxeledVoxels,
            events: this.events,
            loop: this.loop,
            debug: this.debug,
            debugProfile: () => this.debugProfile(),
            debugBenchmark: (durationSec = 15, intervalMs = 1000) => this.debugBenchmark(durationSec, intervalMs),
        };

        window.debugProfile = () => this.debugProfile();
        window.debugBenchmark = (durationSec = 15, intervalMs = 1000) => this.debugBenchmark(durationSec, intervalMs);
    }
}

export default App;