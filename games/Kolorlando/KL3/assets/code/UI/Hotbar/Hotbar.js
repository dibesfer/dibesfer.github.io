import { Icon } from "../Icon/Icon.js";

export class Hotbar {
    constructor(options = {}) {
        this.element = options.element ?? document.querySelector("#hotbar");
        this.inventory = options.inventory ?? null;
        this.onSelect = options.onSelect ?? null;
        this.icons = [];
    }

    start() {
        this.render();
    }

    setInventory(inventory = null) {
        this.inventory = inventory;
        this.render();
    }

    select(index = 0) {
        if (!this.inventory) return null;

        const item = this.inventory.select(index);
        this.onSelect?.(item, index, this.inventory);
        this.render();

        return item;
    }

    render() {
        if (!this.element || !this.inventory) return;

        this.clear();

        this.element.classList.add("uiGrid", "hotbar");
        this.element.style.setProperty("--ui-grid-columns", String(this.inventory.size));
        this.element.dataset.uiGridColumns = String(this.inventory.size);

        this.inventory.getItems().forEach((item, index) => {
            const icon = new Icon({
                item,
                index,
                selected: index === this.inventory.selectedIndex,
                onClick: (_item, clickedIndex) => {
                    this.select(clickedIndex);
                },
            });

            this.icons.push(icon);
            this.element.appendChild(icon.element);
        });
    }

    clear() {
        this.icons.forEach((icon) => icon.destroy());
        this.icons = [];
        this.element.innerHTML = "";
    }
}

export default Hotbar;
