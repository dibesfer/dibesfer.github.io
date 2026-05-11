import Icon from "./Icon/Icon.js";

export class Hotbar {
    static selectionKeys = "12345678".split("");

    constructor(root = null, input = null) {
        this.root = root;
        this.input = input;
        this.inventory = null;
        this.selectedIndex = 0;
        this.targetName = "none";
        this.size = 8;
        this.fields = {
            target: this.find("target"),
            grid: this.find("hotbarItems"),
            slots: []
        };
    }

    async start() {
        await this.render();
        this.emitSelectedItem();
    }

    find(name) {
        return this.root?.querySelector(`[data-ui="${name}"]`) || null;
    }

    async setInventory(inventory = null) {
        this.inventory = inventory;
        await this.render();
        this.emitSelectedItem();
    }

    hotbarStacks() {
        return this.inventory?.slots?.slice(0, this.size) || Array.from({ length: this.size }, () => null);
    }

    async render() {
        this.syncSlots();

        const stacks = this.hotbarStacks();

        await Promise.all(this.fields.slots.map((slot, index) => {
            const stack = stacks[index];

            slot.replaceChildren();

            if (!stack) return Promise.resolve();

            return new Icon(stack.item.iconData(stack.quantity)).mount(slot);
        }));

        this.syncSelection();
    }

    syncSlots() {
        if (!this.fields.grid) return;

        this.fields.grid.replaceChildren();

        this.fields.slots = Array.from({ length: this.size }, (_, index) => {
            const slot = document.createElement("button");

            slot.type = "button";
            slot.className = "grid-item hotbarSlot";
            slot.dataset.hotbarSlot = String(index);

            this.fields.grid.appendChild(slot);
            return slot;
        });
    }

    selectByKey(key) {
        if (!key) return null;

        const index = this.constructor.selectionKeys.indexOf(key.toLowerCase());

        if (index === -1) return null;

        return this.select(index);
    }

    select(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.size) return null;

        this.selectedIndex = index;
        this.syncSelection();
        this.emitSelectedItem();
        this.input?.emit("hotbar.selected", index);

        return this.selectedItem;
    }

    selectFromElement(element) {
        const slot = element?.closest?.("[data-hotbar-slot]");
        const index = Number(slot?.dataset.hotbarSlot);

        if (!Number.isInteger(index)) return null;

        return this.select(index);
    }

    get selectedStack() {
        return this.hotbarStacks()[this.selectedIndex] || null;
    }

    get selectedItem() {
        return this.selectedStack?.item || null;
    }

    emitSelectedItem() {
        this.input?.emit("selectedItemChange", this.selectedItem);
    }

    syncSelection() {
        this.fields.slots.forEach((slot, index) => {
            slot.classList.toggle("is-selected", index === this.selectedIndex);
        });
    }

    setTargetName(name = "none") {
        if (name === this.targetName) return;

        this.targetName = name;

        if (this.fields.target) {
            this.fields.target.textContent = `Target: ${name}`;
        }
    }
}

export default Hotbar;
