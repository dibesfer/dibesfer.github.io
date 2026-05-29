import { Menu } from "./Menu/Menu.js";

export class UI {
    constructor(options = {}) {
        this.settings = options.settings ?? null;
        this.onPageLoaded = options.onPageLoaded ?? null;
        this.onJoysticksLoaded = options.onJoysticksLoaded ?? null;

        this.items = {
            root: document.querySelector("#UI"),
            chat: document.querySelector("#chat"),
            crosshair: document.querySelector("#crosshair"),
            menu: document.querySelector("#menu"),
            playerHUD: document.querySelector("#playerHUD"),
            targetNameP: document.querySelector("#targetNameP"),
            hotbar: document.querySelector("#hotbar"),
            targetName: document.querySelector("#targetName"),
            joysticksMount: document.querySelector("#joysticksMount"),
            joysticks: null,
        };

        this.joysticksLoaded = false;
        this.joysticksLoadPromise = null;
        this.joysticksPath = new URL("./Joysticks/joysticks.html", import.meta.url).href;

        this.menu = new Menu({
            menuElement: this.items.menu,
            tabsElement: document.querySelector("#menuTabs"),
            contentElement: document.querySelector("#menuContent"),
            defaultPage: "woxel",
            onPageLoaded: (contentElement, page) => {
                this.wireGrids(contentElement);
                this.settings?.wireScope(contentElement);
                this.onPageLoaded?.(contentElement, page);
            },
        });
    }

    start() {
        this.settings?.wireScope(this.items.root);
        this.menu.start();
    }

    stop() {
        this.menu.stop();
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

    applyScreenPolicy(policy = {}) {
        const uiPolicy = policy.ui ?? {};

        this.setElementVisible(this.items.crosshair, uiPolicy.crosshair !== false);
        this.setElementVisible(this.items.playerHUD, uiPolicy.playerHUD !== false);
        this.setElementVisible(this.items.targetNameP, uiPolicy.targetName !== false);
        this.setElementVisible(this.items.hotbar, uiPolicy.hotbar !== false);

        this.items.root?.setAttribute?.("data-screen-mode", policy.mode ?? "desktop");
        this.updateJoysticksForPolicy(policy);
    }

    updateJoysticksForPolicy(policy = {}) {
        const mode = policy.mode ?? "desktop";
        const shouldShowJoysticks = mode === "mobile-portrait" || mode === "mobile-landscape";

        if (!shouldShowJoysticks) {
            this.setElementVisible(this.items.joysticks, false);
            return;
        }

        this.ensureJoysticksLoaded().then(() => {
            this.setElementVisible(this.items.joysticks, true);
        });
    }

    async ensureJoysticksLoaded() {
        if (this.joysticksLoaded) return this.items.joysticks;
        if (this.joysticksLoadPromise) return this.joysticksLoadPromise;

        this.joysticksLoadPromise = this.loadJoysticks();

        return this.joysticksLoadPromise;
    }

    async loadJoysticks() {
        if (!this.items.joysticksMount) return null;

        try {
            const response = await fetch(this.joysticksPath);

            if (!response.ok) {
                throw new Error(`Joysticks layout not found: ${this.joysticksPath}`);
            }

            this.items.joysticksMount.innerHTML = await response.text();
            this.items.joysticks = this.items.joysticksMount.querySelector("#joysticks");
            this.joysticksLoaded = true;
            this.onJoysticksLoaded?.(this.items.joysticks);

            return this.items.joysticks;
        } catch (error) {
            this.joysticksLoadPromise = null;
            console.warn(error);
            return null;
        }
    }

    setJoysticksLoaded(callback = null) {
        this.onJoysticksLoaded = callback;

        if (this.joysticksLoaded && this.items.joysticks) {
            this.onJoysticksLoaded?.(this.items.joysticks);
        }
    }

    setElementVisible(element = null, visible = true) {
        if (!element) return;

        element.hidden = visible !== true;
        element.classList.toggle("isScreenHidden", visible !== true);
    }

    getInteractiveElements() {
        return [
            this.items.chat,
            this.items.menu,
            this.items.playerHUD,
            this.items.joysticks,
        ].filter((element) => {
            if (!element) return false;
            if (element.hidden === true) return false;
            if (element.classList?.contains?.("isScreenHidden")) return false;

            return true;
        });
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
