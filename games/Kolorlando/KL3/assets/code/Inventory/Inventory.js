export class Inventory {
    constructor(options = {}) {
        this.name = options.name ?? "Inventory";
        this.size = this.normalizeSize(options.size ?? 7);
        this.selectedIndex = 0;
        this.slots = Array.from({ length: this.size }, () => null);
        this.onChange = options.onChange ?? null;

        if (Array.isArray(options.items)) {
            this.setItems(options.items);
        }

        this.select(options.selectedIndex ?? 0, { silent: true });
    }

    normalizeSize(size) {
        const number = Number.parseInt(size, 10);

        if (!Number.isFinite(number)) return 7;

        return Math.min(Math.max(number, 1), 9);
    }

    setItems(items = []) {
        this.slots = Array.from({ length: this.size }, (_, index) => {
            return items[index] ?? null;
        });

        this.selectedIndex = this.clampIndex(this.selectedIndex);
        this.emitChange("setItems");

        return this.slots;
    }

    addItem(item, preferredIndex = null) {
        if (!item) return false;

        const index = this.findTargetIndex(preferredIndex);
        if (index < 0) return false;

        this.slots[index] = item;
        this.emitChange("addItem", { index, item });

        return true;
    }

    removeItem(index = this.selectedIndex) {
        if (!this.isValidIndex(index)) return null;

        const removed = this.slots[index];
        this.slots[index] = null;
        this.emitChange("removeItem", { index, item: removed });

        return removed;
    }

    moveItem(fromIndex, toIndex) {
        if (!this.isValidIndex(fromIndex)) return false;
        if (!this.isValidIndex(toIndex)) return false;
        if (fromIndex === toIndex) return true;
        if (this.slots[toIndex]) return false;

        this.slots[toIndex] = this.slots[fromIndex];
        this.slots[fromIndex] = null;
        this.emitChange("moveItem", { fromIndex, toIndex });

        return true;
    }

    swapItems(aIndex, bIndex) {
        if (!this.isValidIndex(aIndex)) return false;
        if (!this.isValidIndex(bIndex)) return false;
        if (aIndex === bIndex) return true;

        const aItem = this.slots[aIndex];
        this.slots[aIndex] = this.slots[bIndex];
        this.slots[bIndex] = aItem;
        this.emitChange("swapItems", { aIndex, bIndex });

        return true;
    }

    setItem(index, item = null) {
        if (!this.isValidIndex(index)) return false;

        this.slots[index] = item;
        this.emitChange("setItem", { index, item });

        return true;
    }

    getItem(index) {
        if (!this.isValidIndex(index)) return null;

        return this.slots[index] ?? null;
    }

    getItems() {
        return this.slots;
    }

    getSelectedItem() {
        return this.getItem(this.selectedIndex);
    }

    select(index = 0, options = {}) {
        if (!this.isValidIndex(index)) return this.getSelectedItem();

        const previousIndex = this.selectedIndex;
        this.selectedIndex = index;

        if (!options.silent && previousIndex !== this.selectedIndex) {
            this.emitChange("select", { index });
        }

        return this.getSelectedItem();
    }

    selectNext() {
        return this.select((this.selectedIndex + 1) % this.size);
    }

    selectPrevious() {
        return this.select((this.selectedIndex - 1 + this.size) % this.size);
    }

    findTargetIndex(preferredIndex = null) {
        if (this.isValidIndex(preferredIndex) && !this.slots[preferredIndex]) {
            return preferredIndex;
        }

        return this.slots.findIndex((item) => item === null);
    }

    clampIndex(index = 0) {
        return Math.min(Math.max(Number.parseInt(index, 10) || 0, 0), this.size - 1);
    }

    isValidIndex(index) {
        return Number.isInteger(index) && index >= 0 && index < this.size;
    }

    emitChange(type = "change", detail = {}) {
        this.onChange?.({
            type,
            detail,
            inventory: this,
            selectedIndex: this.selectedIndex,
            selectedItem: this.getSelectedItem(),
        });
    }
}

export default Inventory;
