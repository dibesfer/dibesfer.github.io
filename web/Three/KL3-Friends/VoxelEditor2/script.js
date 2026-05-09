// UI
const menu = document.getElementById("menu");
const supertitle = document.getElementById("supertitle");
const loadButton = document.getElementById("loadButton");
const saveButton = document.getElementById("saveButton");
const consola = document.getElementById("consola");
const optionsBar = document.getElementById("options");
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
        const fileInput = menu.querySelector("#loadVoxelFileInput");
        const input = menu.querySelector("#loadJsonInput");
        const button = menu.querySelector("#loadJsonButton");
        const status = menu.querySelector("#loadStatus");
        const sizeInput = menu.querySelector("#loadVoxelSizeInput");
        const templateInputs = menu.querySelectorAll('input[name="loadTemplate"]');

        if (!fileInput || !input || !button || !status) return;

        if (sizeInput && window.getVoxelEditorSize) {
            sizeInput.value = window.getVoxelEditorSize();
        }

        button.addEventListener("click", async () => {
            const selectedTemplate = Array.from(templateInputs).find((radio) => radio.checked)?.value;
            const selectedSize = sizeInput?.value;
            let result = null;

            if (fileInput.files?.[0]) {
                try {
                    const fileText = await fileInput.files[0].text();
                    result = window.applyVoxelSaveData?.(fileText);
                } catch (error) {
                    result = {
                        ok: false,
                        message: error instanceof Error ? error.message : "File could not be loaded."
                    };
                }
            } else if (input.value.trim()) {
                result = window.applyVoxelSaveData?.(input.value);
            } else {
                result = window.applyVoxelPreset?.(selectedTemplate, selectedSize);
            }

            if (result?.ok && sizeInput && window.getVoxelEditorSize) {
                sizeInput.value = window.getVoxelEditorSize();
            }

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

enableDesktopDragScroll(consola);
enableDesktopDragScroll(optionsBar);

function enableDesktopDragScroll(element) {
    if (!element || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        return;
    }

    const dragState = {
        pressed: false,
        dragging: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        startScrollLeft: 0
    };
    const DRAG_THRESHOLD = 6;

    element.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;

        dragState.pressed = true;
        dragState.dragging = false;
        dragState.pointerId = event.pointerId;
        dragState.startX = event.clientX;
        dragState.startY = event.clientY;
        dragState.startScrollLeft = element.scrollLeft;
    });

    element.addEventListener("pointermove", event => {
        if (!dragState.pressed || dragState.pointerId !== event.pointerId) return;

        const offsetX = event.clientX - dragState.startX;
        const offsetY = event.clientY - dragState.startY;

        if (!dragState.dragging) {
            if (Math.abs(offsetX) < DRAG_THRESHOLD || Math.abs(offsetX) < Math.abs(offsetY)) {
                return;
            }

            dragState.dragging = true;
            element.classList.add("is-dragging");
            element.setPointerCapture?.(event.pointerId);
        }

        element.scrollLeft = dragState.startScrollLeft - offsetX;
        event.preventDefault();
    });

    function stopDragging(event) {
        if (!dragState.pressed) return;
        if (event?.pointerId != null && dragState.pointerId !== event.pointerId) return;

        dragState.pressed = false;
        dragState.dragging = false;
        dragState.pointerId = null;
        element.classList.remove("is-dragging");

        if (event?.pointerId != null && element.hasPointerCapture?.(event.pointerId)) {
            element.releasePointerCapture(event.pointerId);
        }
    }

    element.addEventListener("pointerup", stopDragging);
    element.addEventListener("pointercancel", stopDragging);
    element.addEventListener("lostpointercapture", () => {
        dragState.pressed = false;
        dragState.dragging = false;
        dragState.pointerId = null;
        element.classList.remove("is-dragging");
    });
}
