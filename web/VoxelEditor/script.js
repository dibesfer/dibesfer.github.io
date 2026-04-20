// UI
const menu = document.getElementById("menu");
const supertitle = document.getElementById("supertitle");
const loadButton = document.getElementById("loadButton");
const saveButton = document.getElementById("saveButton");
const menuState = {
    active: false,
    panel: null,
    cache: {}
};

async function fetchMenuContent(panel) {
    if (menuState.cache[panel]) {
        return menuState.cache[panel];
    }

    const response = await fetch(`./UI/${panel}.html`);

    if (!response.ok) {
        throw new Error(`Menu "${panel}" could not be loaded.`);
    }

    const html = await response.text();
    menuState.cache[panel] = html;
    return html;
}

async function openMenu(panel) {
    menu.innerHTML = "<p>Loading...</p>";
    menu.classList.remove("invisible");
    menuState.active = true;
    menuState.panel = panel;
    document.addEventListener("click", clickDetect);

    try {
        const html = await fetchMenuContent(panel);

        // Keep the active panel explicit for menu-specific logic later.
        menu.dataset.panel = panel;
        menu.innerHTML = html;
        hydrateMenu(panel);
    } catch (error) {
        menu.innerHTML = `<p>${error.message}</p>`;
    }
}

function hydrateMenu(panel) {
    if (panel === "save") {
        const output = menu.querySelector("#saveJsonOutput");
        const downloadButton = menu.querySelector("#downloadVoxelButton");
        const saveData = window.getVoxelSaveData?.();

        if (!output || !downloadButton || !saveData) return;

        syncSavePreview(output);
        downloadButton.addEventListener("click", () => {
            const freshSaveData = window.ensureVoxelName?.("Table");

            if (!freshSaveData) return;

            syncSavePreview(output, freshSaveData);
            const fileName = buildVoxelFileName(freshSaveData.name);
            const fileContent = JSON.stringify(freshSaveData, null, 2);
            downloadVoxelFile(fileName, fileContent);
        });
        return;
    }

    if (panel === "load") {
        const input = menu.querySelector("#loadJsonInput");
        const button = menu.querySelector("#loadJsonButton");
        const status = menu.querySelector("#loadStatus");
        const templateInputs = menu.querySelectorAll('input[name="loadTemplate"]');

        if (!input || !button || !status) return;

        button.addEventListener("click", () => {
            const selectedTemplate = Array.from(templateInputs).find((radio) => radio.checked)?.value;
            const result = input.value.trim()
                ? window.applyVoxelSaveData?.(input.value)
                : window.applyVoxelPreset?.(selectedTemplate);

            status.textContent = result?.message || "Load failed.";
        });
    }
}

function syncSavePreview(output, saveData = window.getVoxelSaveData?.()) {
    if (!output || !saveData) return;

    output.value = JSON.stringify(saveData, null, 2);
}

function buildVoxelFileName(name = "") {
    const safeName = String(name)
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, " ");

    return `${safeName || "Table"}.voxel`;
}

function downloadVoxelFile(fileName, content) {
    const blob = new Blob([content], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);
}

function closeMenu() {
    menu.classList.add("invisible");
    menuState.active = false;
    menuState.panel = null;
    delete menu.dataset.panel;
    document.removeEventListener("click", clickDetect);
}

async function toggleMenu(panel) {
    if (menuState.active && menuState.panel === panel) {
        closeMenu();
        return;
    }

    await openMenu(panel);
}

function clickDetect(e) {
    if (
        e.target.closest("#supertitle") ||
        e.target.closest("#loadButton") ||
        e.target.closest("#saveButton")
    ) {
        return;
    }

    if (menuState.active && !e.target.closest("#menu")) {
        closeMenu();
    }
}

supertitle.addEventListener("click", () => toggleMenu("about"));
loadButton.addEventListener("click", () => toggleMenu("load"));
saveButton.addEventListener("click", () => toggleMenu("save"));


