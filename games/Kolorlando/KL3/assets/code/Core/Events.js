import { Icon } from "../UI/Icon/Icon.js";
import { createBoxelItem } from "../Item/Item.js";
import { orientVoxelForPlacement } from "../Wabavam/Voxel/VoxelOrienting.js";

export class Events {
    constructor(options = {}) {
        this.app = options.app ?? null;

        this.handlePageHide = this.handlePageHide.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleCreateWoxelClick = this.handleCreateWoxelClick.bind(this);
        this.handleSaveWoxelClick = this.handleSaveWoxelClick.bind(this);
        this.handleLoadWoxelFileChange = this.handleLoadWoxelFileChange.bind(this);
        this.handleLoadBoxelFileChange = this.handleLoadBoxelFileChange.bind(this);
    }

    start() {
        /*
        1. PAGE LIFETIME
        Save the current Woxel when the browser page is hidden or closed.
        */
        window.addEventListener("pagehide", this.handlePageHide);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    stop() {
        window.removeEventListener("pagehide", this.handlePageHide);
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }

    createInputCallbacks() {
        /*
        2. INPUT WIRING
        Input listens to raw intent; Events routes intent to gameplay systems.
        */
        return {
            onPrimaryAction: () => this.handlePrimaryAction(),
            onSecondaryAction: () => this.handleSecondaryAction(),
            onPrimaryHold: () => this.startRedBoxel(),
            onSecondaryHold: () => this.startGreenBoxel(),
            onPointerRelease: () => this.commitBoxelEditor(),
            onMiddleAction: () => this.toggleBlueBoxel(),
            onMiddleHold: () => this.togglePurpleBoxel(),
            onCopy: () => this.copyBlueBoxelSelection(),
            onCut: () => this.cutBlueBoxelSelection(),
            onPaste: () => this.previewBlueBoxelClipboard(),
            onCancel: () => this.cancelBoxelEditor(),
            onUndo: () => this.handleUndo(),
            onRedo: () => this.handleRedo(),
            onHotbarSelect: (index) => this.handleHotbarKeySelect(index),
        };
    }

    handlePageHide() {
        this.app.saveCurrentWoxelToIndexedDB();
        this.app.saveCurrentHistoryToIndexedDB?.();
        this.app.saveSavedBoxelsToIndexedDB?.();
        this.app.saveCurrentSettingsToIndexedDB?.();
    }

    handleVisibilityChange() {
        if (!document.hidden) {
            this.app.debug.reset();
            this.app.threeD.resize();
            return;
        }

        this.app.saveCurrentWoxelToIndexedDB();
        this.app.saveCurrentHistoryToIndexedDB?.();
        this.app.saveSavedBoxelsToIndexedDB?.();
        this.app.saveCurrentSettingsToIndexedDB?.();
    }

    handlePrimaryAction() {
        if (this.app.boxelEditor.handlePrimaryAction?.()) return;

        this.quitTargetVoxel();
    }

    handleSecondaryAction() {
        if (this.app.boxelEditor.handleSecondaryAction?.()) return;

        this.placeVoxelOnTarget();
    }

    quitTargetVoxel() {
        const app = this.app;
        if (app.boxelEditor.isActive() && !app.boxelEditor.isPurpleBoxelMirroring?.()) return;

        const target = app.raycast.getTarget();
        if (!target?.voxel || !target?.gridPosition) return;

        const results = app.boxelEditor.removeVoxelAtWithPurpleMirror?.(target.gridPosition) ?? [
            app.woxel.removeVoxelAt(
                target.gridPosition.x,
                target.gridPosition.y,
                target.gridPosition.z
            )
        ];

        app.boxelEditor.finishWorldChanges(results, {
            cancel: false,
            historyType: results.length > 1 ? "bulkQuit" : "voxelQuit",
            historyLabel: app.boxelEditor.isPurpleBoxelMirroring?.() ? "PurpleBoxel voxel quit" : "Voxel quit",
        });
    }

    placeVoxelOnTarget() {
        const app = this.app;
        if (app.boxelEditor.isActive() && !app.boxelEditor.isPurpleBoxelMirroring?.()) return;

        const target = app.raycast.getTarget();
        if (!target?.voxel || !target?.gridPosition || !target?.faceNormal) return;

        const selectedVoxel = app.selectedItem?.getVoxel?.();
        if (!selectedVoxel) return;

        const position = this.getPlaceGridPosition(target);
        if (!this.canPlaceVoxelAt(position)) return;

        const placeVoxel = orientVoxelForPlacement(
            selectedVoxel?.clone?.() ?? selectedVoxel,
            app.player
        );

        const results = app.boxelEditor.placeVoxelAtWithPurpleMirror?.(position, placeVoxel) ?? [
            app.woxel.placeVoxelAt(
                position.x,
                position.y,
                position.z,
                placeVoxel
            )
        ];

        app.boxelEditor.finishWorldChanges(results, {
            cancel: false,
            historyType: results.length > 1 ? "bulkPlacement" : "voxelPlacement",
            historyLabel: app.boxelEditor.isPurpleBoxelMirroring?.() ? "PurpleBoxel voxel placement" : "Voxel placement",
        });
    }

    startRedBoxel() {
        this.app.boxelEditor.startRedBoxel();
    }

    startGreenBoxel() {
        this.app.boxelEditor.startGreenBoxel();
    }

    commitBoxelEditor() {
        if (!this.app.boxelEditor.isActive()) return;

        this.app.boxelEditor.commit();
    }

    toggleBlueBoxel() {
        this.app.boxelEditor.toggleBlueBoxel?.();
    }

    togglePurpleBoxel() {
        this.app.boxelEditor.togglePurpleBoxel?.();
    }

    copyBlueBoxelSelection() {
        this.app.boxelEditor.copyBlueBoxelSelection?.();
    }

    cutBlueBoxelSelection() {
        this.app.boxelEditor.cutBlueBoxelSelection?.();
    }

    previewBlueBoxelClipboard() {
        this.app.boxelEditor.enterBlueBoxelPreview?.();
    }

    cancelBoxelEditor() {
        this.app.boxelEditor.cancel?.();
    }

    async handleUndo() {
        return this.app.history?.undo?.() ?? false;
    }

    async handleRedo() {
        return this.app.history?.redo?.() ?? false;
    }

    getPlaceGridPosition(target) {
        const normal = target.faceNormal;

        return {
            x: target.gridPosition.x + Math.round(normal.x),
            y: target.gridPosition.y + Math.round(normal.y),
            z: target.gridPosition.z + Math.round(normal.z),
        };
    }

    canPlaceVoxelAt(position) {
        const app = this.app;

        if (!position) return false;
        if (!app.woxel.isInside(position.x, position.y, position.z)) return false;
        if (app.woxel.getVoxelAt(position.x, position.y, position.z)) return false;
        if (app.isInsidePlayerBody(position)) return false;

        return true;
    }

    handleHotbarKeySelect(index) {
        if (index >= this.app.inventory.size) return;

        this.app.hotbar.select(index);
    }

    wireMenuPage(contentElement, page) {
        /*
        3. MENU WIRING
        Menu pages are loaded as HTML fragments, then wired when they appear.
        */
        if (page === "woxel") {
            this.wireWoxelPage(contentElement);
            return;
        }

        if (page === "voxels") {
            this.renderVoxelCatalog(contentElement);
            return;
        }

        if (page === "boxels") {
            this.wireBoxelsPage(contentElement);
        }
    }

    wireWoxelPage(contentElement) {
        contentElement.querySelector("#createWoxelButton")
            ?.addEventListener("click", this.handleCreateWoxelClick);

        contentElement.querySelector("#saveWoxelButton")
            ?.addEventListener("click", this.handleSaveWoxelClick);

        contentElement.querySelector("#loadWoxelButton")
            ?.addEventListener("click", () => {
                contentElement.querySelector("#loadWoxelInput")?.click();
            });

        contentElement.querySelector("#loadWoxelInput")
            ?.addEventListener("change", this.handleLoadWoxelFileChange);

        this.app.updateWoxelMenuInfo(contentElement);
    }

    wireBoxelsPage(contentElement) {
        contentElement.querySelector("#loadBoxelInput")
            ?.addEventListener("change", this.handleLoadBoxelFileChange);

        this.renderBoxelCatalog(contentElement);
    }

    renderVoxelCatalog(contentElement) {
        const catalogElement = contentElement.querySelector("#voxelCatalog");
        if (!catalogElement) return;

        catalogElement.innerHTML = "";

        this.app.voxelCatalogItems.forEach((item) => {
            const icon = new Icon({
                item,
                onClick: () => {
                    this.app.inventory.setItem(this.app.inventory.selectedIndex, item.clone());
                    this.app.selectedItem = this.app.inventory.getSelectedItem();
                    this.app.hotbar.render();
                },
            });

            icon.element.classList.add("voxelCatalogItem");
            catalogElement.appendChild(icon.element);
        });
    }

    renderBoxelCatalog(contentElement) {
        const catalogElement = contentElement.querySelector("#boxelCatalog");
        if (!catalogElement) return;

        this.renderSavedBoxelsWarning(contentElement);

        catalogElement.innerHTML = "";
        catalogElement.appendChild(this.createLoadBoxelSlot(contentElement));

        this.app.getSavedBoxelItems().forEach((item) => {
            const icon = new Icon({
                item,
                onClick: () => {
                    this.app.loadSavedBoxelIntoClipboard(item.data?.id);
                },
            });

            icon.element.classList.add("boxelCatalogItem");
            icon.element.classList.toggle("isFavorite", item.data?.favorite === true);
            this.addSavedBoxelFavoriteBadge(icon.element, item);
            this.addSavedBoxelActions(icon.element, item);
            catalogElement.appendChild(icon.element);
        });
    }

    renderSavedBoxelsWarning(contentElement) {
        const catalogElement = contentElement.querySelector("#boxelCatalog");
        if (!catalogElement) return;

        let warningElement = contentElement.querySelector("#boxelCatalogWarning");
        if (!warningElement) {
            warningElement = document.createElement("div");
            warningElement.id = "boxelCatalogWarning";
            warningElement.className = "boxelCatalogWarning";
            catalogElement.before(warningElement);
        }

        const fullFavorites = this.app.isSavedBoxelsFullOfFavorites?.() === true;
        warningElement.hidden = !fullFavorites;
        warningElement.textContent = fullFavorites
            ? `⛔⭐ You can't save more boxels because all ${this.app.savedBoxelsLimit ?? 17} slots are favorited. Consider saving best boxels locally.`
            : "";
    }

    addSavedBoxelFavoriteBadge(iconElement, item) {
        if (!iconElement || item?.data?.favorite !== true) return;

        const badgeElement = document.createElement("div");
        badgeElement.className = "boxelCatalogFavoriteBadge";
        badgeElement.textContent = "⭐";
        badgeElement.title = "Favorite Boxel";

        iconElement.appendChild(badgeElement);
    }

    addSavedBoxelActions(iconElement, item) {
        const savedBoxelId = item?.data?.id ?? null;
        if (!iconElement || !savedBoxelId) return;

        const isFavorite = item?.data?.favorite === true;
        const actionsElement = document.createElement("div");
        actionsElement.className = "boxelCatalogActions";
        actionsElement.innerHTML = `
            <button type="button" class="boxelCatalogActionButton" data-boxel-action="favorite" title="${isFavorite ? "Unfavorite" : "Favorite"}">${isFavorite ? "⭐" : "☆"}</button>
            <button type="button" class="boxelCatalogActionButton" data-boxel-action="save" title="Download .boxel">⬇️</button>
            <button type="button" class="boxelCatalogActionButton" data-boxel-action="delete" title="Delete saved Boxel">❌</button>
        `;

        actionsElement.addEventListener("click", async (event) => {
            const actionButton = event.target?.closest?.("[data-boxel-action]");
            if (!actionButton) return;

            event.preventDefault();
            event.stopPropagation();

            const action = actionButton.dataset.boxelAction;

            if (action === "favorite" || action === "star") {
                this.app.toggleSavedBoxelFavorite?.(savedBoxelId);
                return;
            }

            if (action === "save") {
                await this.app.downloadSavedBoxel?.(savedBoxelId);
                return;
            }

            if (action === "delete") {
                this.app.deleteSavedBoxel?.(savedBoxelId);
            }
        });

        iconElement.appendChild(actionsElement);
    }

    createLoadBoxelSlot(contentElement) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "icon uiGridItem boxelCatalogItem boxelLoadItem";
        button.innerHTML = `
            <div class="iconName">Load</div>
            <div class="iconImage" aria-hidden="true" style="font-size: 2rem; line-height: 1;">+</div>
        `;
        button.addEventListener("click", () => {
            contentElement.querySelector("#loadBoxelInput")?.click();
        });

        return button;
    }

    async handleCreateWoxelClick(event) {
        const contentElement = event?.target?.closest?.(".menuSection") ?? document;
        const templateId = contentElement.querySelector("#woxelTemplateSelect")?.value ?? "grassWithFlowers";
        const confirmed = confirm("Estás seguro que quieres crear un nuevo Woxel y pisar el mundo actual?");
        if (!confirmed) return;

        await this.app.createNewWoxelFromTemplate(templateId);
    }

    async handleSaveWoxelClick() {
        await this.app.saveCurrentWoxelToIndexedDB();
        await this.app.memory.export(this.app.mainWoxelKey);
        this.app.updateWoxelMenuInfo();
    }

    async handleLoadWoxelFileChange(event) {
        const inputElement = event.target;
        const file = inputElement.files?.[0] ?? null;

        inputElement.value = "";

        if (!file) return;

        try {
            const loadedWoxel = await this.app.memory.import(file);

            this.app.setActiveWoxel(loadedWoxel);
            await this.app.saveCurrentWoxelToIndexedDB();
        } catch (error) {
            console.warn(error);
            alert("No se pudo cargar este .woxel");
        }
    }

    async handleLoadBoxelFileChange(event) {
        const inputElement = event.target;
        const file = inputElement.files?.[0] ?? null;

        inputElement.value = "";

        if (!file) return;

        try {
            const loaded = await this.app.memory.import(file);
            const boxel = loaded?.getBoxel?.() ?? loaded?.boxel ?? loaded;

            if (!boxel?.forEachVoxel) {
                throw new Error("Loaded file is not a Boxel.");
            }

            this.app.addSavedBoxel?.(boxel, {
                name: boxel.name ?? null,
            });
        } catch (error) {
            console.warn(error);
            alert("No se pudo cargar este .boxel");
        }
    }
}

export default Events;

