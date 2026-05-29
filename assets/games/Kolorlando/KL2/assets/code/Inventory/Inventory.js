export class Inventory {
    constructor({ columns = 8, rows = 4, maxStack = 99 } = {}) {
        this.columns = columns;
        this.rows = rows;
        this.maxStack = maxStack;
        this.size = columns * rows;
        this.slots = Array.from({ length: this.size }, () => null);
    }

    add(item, quantity = 1) {
        if (!item?.possessable || quantity <= 0) return 0;

        let remaining = Math.floor(quantity);

        remaining = this.fillExistingStacks(item, remaining);
        if (remaining <= 0) return quantity;

        remaining = this.fillEmptySlots(item, remaining);

        return quantity - remaining;
    }

    fillExistingStacks(item, quantity) {
        let remaining = quantity;

        for (const stack of this.slots) {
            if (remaining <= 0) return 0;
            if (!stack || stack.item.id !== item.id || stack.quantity >= this.maxStack) continue;

            const amount = Math.min(this.maxStack - stack.quantity, remaining);

            stack.quantity += amount;
            remaining -= amount;
        }

        return remaining;
    }

    fillEmptySlots(item, quantity) {
        let remaining = quantity;

        for (let index = 0; index < this.slots.length; index += 1) {
            if (remaining <= 0) return 0;
            if (this.slots[index]) continue;

            const amount = Math.min(this.maxStack, remaining);

            this.slots[index] = { item, quantity: amount };
            remaining -= amount;
        }

        return remaining;
    }

    moveSlot(fromIndex, toIndex) {
        if (!this.isValidSlot(fromIndex) || !this.isValidSlot(toIndex)) return false;
        if (fromIndex === toIndex) return false;
        if (!this.slots[fromIndex]) return false;

        const draggedStack = this.slots[fromIndex];
        const targetStack = this.slots[toIndex];

        this.slots[toIndex] = draggedStack;
        this.slots[fromIndex] = targetStack || null;

        return true;
    }

    isValidSlot(index) {
        return Number.isInteger(index) && index >= 0 && index < this.slots.length;
    }

    clear() {
        this.slots.fill(null);
    }

    toArray() {
        return this.slots.map(stack => stack
            ? { item: stack.item, quantity: stack.quantity }
            : null
        );
    }
}

export default Inventory;