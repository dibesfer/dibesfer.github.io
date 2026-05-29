import Icon from "../Icon/Icon.js";
import { voxelItems12 } from "../../Item/Item.js";

export class Menu {
    static tabs = {
        settings: "./settings.html",
        voxels: "./voxels.html",
        inventory: "./inventory.html"
    };

    constructor(root = null, input = null, items = voxelItems12) {
        this.root = root;
        this.input = input;
        this.items = items;
        this.activeTab = "settings";
        this.inventory = null;
        this.cache = new Map();
        this.draggedSlotIndex = null;
        this.selectedHotbarIndex = 0;

        this.onClick = this.onClick.bind(this);
        this.onDragStart = this.onDragStart.bind(this);
        this.onDragOver = this.onDragOver.bind(this);
        this.onDragLeave = this.onDragLeave.bind(this);
        this.onDrop = this.onDrop.bind(this);
        this.onDragEnd = this.onDragEnd.bind(this);
        this.onInventoryUpdated = this.onInventoryUpdated.bind(this);
        this.onHotbarSelected = this.onHotbarSelected.bind(this);
    }

    async start() {
        if (!this.root) return;

        this.root.replaceChildren(this.createShell());
        this.root.addEventListener("click", this.onClick);
        this.root.addEventListener("dragstart", this.onDragStart);
        this.root.addEventListener("dragover", this.onDragOver);
        this.root.addEventListener("dragleave", this.onDragLeave);
        this.root.addEventListener("drop", this.onDrop);
        this.root.addEventListener("dragend", this.onDragEnd);
        this.input?.on("inventory.updated", this.onInventoryUpdated);
        this.input?.on("hotbar.selected", this.onHotbarSelected);

        await this.openTab("settings");
    }

    stop() {
        this.root?.removeEventListener("click", this.onClick);
        this.root?.removeEventListener("dragstart", this.onDragStart);
        this.root?.removeEventListener("dragover", this.onDragOver);
        this.root?.removeEventListener("dragleave", this.onDragLeave);
        this.root?.removeEventListener("drop", this.onDrop);
        this.root?.removeEventListener("dragend", this.onDragEnd);
        this.input?.off("inventory.updated", this.onInventoryUpdated);
        this.input?.off("hotbar.selected", this.onHotbarSelected);
    }

    createShell() {
        const shell = document.createElement("div");
        shell.className = "menuShell";

        shell.innerHTML = `
            <nav class="menuTabs">
                <button type="button" class="menuTab" data-menu-tab="settings">Settings</button>
                <button type="button" class="menuTab" data-menu-tab="voxels">Voxels</button>
                <button type="button" class="menuTab" data-menu-tab="inventory">Inventory</button>
            </nav>

            <section class="menuContent" data-menu="content"></section>
        `;

        return shell;
    }

    async onClick(event) {
        const tabButton = event.target.closest("[data-menu-tab]");
        if (tabButton) {
            await this.openTab(tabButton.dataset.menuTab);
            return;
        }

        const inventorySlot = event.target.closest("[data-inventory-slot]");
        if (inventorySlot) {
            this.selectInventoryHotbarSlot(Number(inventorySlot.dataset.inventorySlot));
            return;
        }

        const voxelButton = event.target.closest("[data-menu-voxel-index]");
        if (voxelButton) {
            const index = Number(voxelButton.dataset.menuVoxelIndex);
            const item = this.items[index];

            if (item) {
                this.input?.emit("selectedItemChange", item);
                this.input?.emit("inventory.addItem", { item, quantity: 1 });
            }
        }
    }

    selectInventoryHotbarSlot(index) {
        if (!Number.isInteger(index) || index < 0 || index >= 8) return;

        this.selectedHotbarIndex = index;
        this.input?.emit("hotbar.selectIndex", index);
        this.syncInventorySelection();
    }

    onHotbarSelected(index = 0) {
        if (!Number.isInteger(index)) return;

        this.selectedHotbarIndex = index;
        this.syncInventorySelection();
    }

    onDragStart(event) {
        const slot = event.target.closest("[data-inventory-slot]");
        const index = Number(slot?.dataset.inventorySlot);

        if (!slot || !Number.isInteger(index) || !this.inventory?.slots?.[index]) {
            event.preventDefault();
            return;
        }

        this.draggedSlotIndex = index;
        slot.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
    }

    onDragOver(event) {
        const slot = event.target.closest("[data-inventory-slot]");
        if (!slot) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        slot.classList.add("is-drop-target");
    }

    onDragLeave(event) {
        const slot = event.target.closest("[data-inventory-slot]");
        if (!slot) return;
        if (slot.contains(event.relatedTarget)) return;

        slot.classList.remove("is-drop-target");
    }

    async onDrop(event) {
        const slot = event.target.closest("[data-inventory-slot]");
        if (!slot) return;

        event.preventDefault();

        const fromIndex = this.draggedSlotIndex ?? Number(event.dataTransfer.getData("text/plain"));
        const toIndex = Number(slot.dataset.inventorySlot);

        this.clearDragClasses();

        if (!this.inventory?.moveSlot?.(fromIndex, toIndex)) return;

        this.input?.emit("inventory.updated", this.inventory);
        await this.renderInventoryGrid();
    }

    onDragEnd() {
        this.draggedSlotIndex = null;
        this.clearDragClasses();
    }

    clearDragClasses() {
        this.root?.querySelectorAll(".is-dragging, .is-drop-target").forEach(slot => {
            slot.classList.remove("is-dragging", "is-drop-target");
        });
    }

    async openTab(name = "settings") {
        if (!this.constructor.tabs[name]) return;

        this.activeTab = name;
        this.syncTabButtons();

        const content = this.root.querySelector("[data-menu=\"content\"]");
        if (!content) return;

        content.scrollTop = 0;
        content.innerHTML = await this.loadTabHtml(name);

        if (name === "voxels") {
            await this.renderVoxelGrid();
        }

        if (name === "inventory") {
            await this.renderInventoryGrid();
        }

        this.input?.emit("menu.tabChange", name);
    }

    async loadTabHtml(name) {
        if (this.cache.has(name)) return this.cache.get(name);

        const response = await fetch(this.constructor.tabs[name], { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`Menu tab could not be loaded: ${name}`);
        }

        const html = await response.text();

        this.cache.set(name, html);
        return html;
    }

    syncTabButtons() {
        this.root?.querySelectorAll("[data-menu-tab]").forEach(button => {
            button.classList.toggle("is-selected", button.dataset.menuTab === this.activeTab);
        });
    }

    async renderVoxelGrid() {
        const grid = this.root.querySelector("[data-menu=\"voxels-grid\"]");
        if (!grid) return;

        grid.replaceChildren();

        await Promise.all(this.items.map((item, index) => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "grid-item menuVoxelItem";
            button.dataset.menuVoxelIndex = String(index);
            grid.appendChild(button);

            return new Icon(item.iconData()).mount(button);
        }));
    }

    async renderInventoryGrid() {
        const grid = this.root.querySelector("[data-menu=\"inventory-grid\"]");
        if (!grid) return;

        grid.replaceChildren();

        const slots = this.inventory?.slots || Array.from({ length: 32 }, () => null);

        await Promise.all(slots.map((stack, index) => {
            const slot = document.createElement("button");

            slot.type = "button";
            slot.className = "grid-item inventorySlot";
            slot.classList.toggle("is-hotbar-slot", index < 8);
            slot.dataset.inventorySlot = String(index);
            slot.draggable = Boolean(stack);

            grid.appendChild(slot);

            if (!stack) return Promise.resolve();

            return new Icon(stack.item.iconData(stack.quantity)).mount(slot);
        }));

        this.syncInventorySelection();
    }

    syncInventorySelection() {
        this.root?.querySelectorAll("[data-inventory-slot]").forEach(slot => {
            const index = Number(slot.dataset.inventorySlot);

            slot.classList.toggle("is-selected", index === this.selectedHotbarIndex);
            slot.classList.toggle("is-hotbar-slot", index >= 0 && index < 8);
        });
    }

    async onInventoryUpdated(inventory = null) {
        this.inventory = inventory;

        if (this.activeTab === "inventory") {
            await this.renderInventoryGrid();
        }
    }
}

export default Menu;
