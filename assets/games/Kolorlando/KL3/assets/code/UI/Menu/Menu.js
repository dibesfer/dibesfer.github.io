export class Menu {
    constructor(options = {}) {
        this.menuElement = options.menuElement ?? null;
        this.tabsElement = options.tabsElement ?? null;
        this.contentElement = options.contentElement ?? null;
        this.defaultPage = options.defaultPage ?? "woxel";
        this.pagesPath = options.pagesPath ?? new URL("./pages", import.meta.url).href.replace(/\/$/, "");
        this.onPageLoaded = options.onPageLoaded ?? null;

        this.selectedTab = null;

        this.handleTabClick = this.handleTabClick.bind(this);
    }

    start() {
        if (!this.tabsElement) return;

        this.prepareTabs();
        this.tabsElement.addEventListener("click", this.handleTabClick);
        this.loadPage(this.defaultPage);
    }

    stop() {
        if (!this.tabsElement) return;

        this.tabsElement.removeEventListener("click", this.handleTabClick);
    }

    prepareTabs() {
        const tabs = this.getTabs();

        tabs.forEach((tab) => {
            tab.classList.add("menuTab");

            if (!tab.dataset.page) {
                tab.dataset.page = tab.textContent.trim().toLowerCase();
            }
        });
    }

    getTabs() {
        if (!this.tabsElement) return [];

        return Array.from(this.tabsElement.children);
    }

    handleTabClick(event) {
        const tab = event.target.closest(".menuTab");
        if (!tab) return;
        if (!this.tabsElement.contains(tab)) return;

        const page = tab.dataset.page;
        if (!page) return;

        this.loadPage(page);
    }

    async loadPage(page) {
        const tab = this.getTabByPage(page);
        this.selectTab(tab);

        if (!this.contentElement) return;

        try {
            const response = await fetch(`${this.pagesPath}/${page}.html`);

            if (!response.ok) {
                throw new Error(`Menu page not found: ${page}`);
            }

            this.contentElement.innerHTML = await response.text();
            this.onPageLoaded?.(this.contentElement, page);
        } catch (error) {
            this.contentElement.innerHTML = `<div class="menuSection"><p>Menu page not found: ${page}</p></div>`;
            this.onPageLoaded?.(this.contentElement, page);
            console.warn(error);
        }
    }

    getTabByPage(page) {
        return this.getTabs().find((tab) => tab.dataset.page === page) ?? null;
    }

    selectTab(selectedTab) {
        this.getTabs().forEach((tab) => {
            tab.removeAttribute("id");
        });

        if (!selectedTab) return;

        selectedTab.id = "menuTabSelected";
        this.selectedTab = selectedTab;
    }

    show() {
        if (!this.menuElement) return;

        this.menuElement.classList.remove("isHidden");
    }

    hide() {
        if (!this.menuElement) return;

        this.menuElement.classList.add("isHidden");
    }

    toggle() {
        if (!this.menuElement) return;

        this.menuElement.classList.toggle("isHidden");
    }

    isVisible() {
        if (!this.menuElement) return false;

        return !this.menuElement.classList.contains("isHidden");
    }

    contains(target) {
        if (!this.menuElement || !target) return false;

        return this.menuElement.contains(target);
    }
}
