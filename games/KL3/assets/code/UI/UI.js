import { Menu } from "/assets/code/UI/Menu/Menu.js";

export class UI {
    constructor(options = {}) {
        this.settings = options.settings ?? null;

        this.items = {
            root: document.querySelector("#UI"),
            chat: document.querySelector("#chat"),
            crosshair: document.querySelector("#crosshair"),
            menu: document.querySelector("#menu"),
            playerHUD: document.querySelector("#playerHUD"),
            hotbar: document.querySelector("#hotbar"),
            targetName: document.querySelector("#targetName"),
        };

        this.menu = new Menu({
            menuElement: this.items.menu,
            tabsElement: document.querySelector("#menuTabs"),
            contentElement: document.querySelector("#menuContent"),
            defaultPage: "woxel",
            onPageLoaded: (contentElement) => {
                this.wireGrids(contentElement);
                this.settings?.wireScope(contentElement);
            },
        });
    }

    start() {
        this.wireBaseGrids();
        this.settings?.wireScope(this.items.root);
        this.menu.start();
    }

    stop() {
        this.menu.stop();
    }

    wireBaseGrids() {
        this.registerGrid(this.items.hotbar, {
            columns: 8,
            rows: 1,
            itemSelector: ".hotbarSlot",
        });
    }

    wireGrids(scope = document) {
        if (!scope) return;

        const grids = Array.from(scope.querySelectorAll("[data-ui-grid]"));

        grids.forEach((grid) => {
            const columns = this.readPositiveInteger(grid.dataset.uiGridColumns, 8);
            const rows = this.readPositiveInteger(grid.dataset.uiGridRows, 1);
            const shouldFill = grid.dataset.uiGridFill === "true";

            this.registerGrid(grid, {
                columns,
                rows,
                fill: shouldFill,
            });
        });
    }

    registerGrid(gridElement, options = {}) {
        if (!gridElement) return;

        const columns = this.readPositiveInteger(options.columns, 8);
        const rows = this.readPositiveInteger(options.rows, 1);
        const itemSelector = options.itemSelector ?? ".uiGridItem";
        const shouldFill = options.fill === true;

        gridElement.classList.add("uiGrid");
        gridElement.style.setProperty("--ui-grid-columns", String(columns));
        gridElement.dataset.uiGridColumns = String(columns);
        gridElement.dataset.uiGridRows = String(rows);

        if (shouldFill) {
            this.fillGrid(gridElement, columns * rows);
        }

        const items = Array.from(gridElement.querySelectorAll(itemSelector));

        items.forEach((item) => {
            item.classList.add("uiGridItem");
        });
    }

    fillGrid(gridElement, totalItems) {
        const currentItems = gridElement.querySelectorAll(":scope > .uiGridItem").length;
        const missingItems = Math.max(0, totalItems - currentItems);

        for (let index = 0; index < missingItems; index++) {
            const item = document.createElement("div");
            item.className = "uiGridItem";
            gridElement.appendChild(item);
        }
    }

    readPositiveInteger(value, fallback) {
        const number = Number.parseInt(value, 10);

        if (!Number.isFinite(number)) return fallback;
        if (number <= 0) return fallback;

        return number;
    }

    getInteractiveElements() {
        return [
            this.items.chat,
            this.items.crosshair,
            this.items.menu,
            this.items.playerHUD,
        ].filter(Boolean);
    }

    isInsideInteractiveElement(target) {
        if (!target) return false;

        return this.getInteractiveElements().some((element) => {
            return element.contains(target);
        });
    }

    showMenu() {
        this.menu.show();
    }

    hideMenu() {
        this.menu.hide();
    }

    toggleMenu() {
        this.menu.toggle();
    }

    isMenuVisible() {
        return this.menu.isVisible();
    }

    isInsideMenu(target) {
        return this.menu.contains(target);
    }

    setTargetName(name = "none") {
        if (!this.items.targetName) return;

        this.items.targetName.textContent = name;
    }
}

export default UI;
