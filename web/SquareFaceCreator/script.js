import {
    DEFAULT_SFC_FACE,
    SFC_FACE_FEATURE_SCALE,
    SFC_CATEGORY_ITEMS,
    SFC_FACE_STORAGE_KEY,
    resolveSfcImageUrlAlias
} from "../../games/Kolorlando/sfcFace.js";
import {
    loadPlayerFaceData,
    savePlayerFaceData
} from "../../games/Kolorlando/code/data/playerSaving.js";

const canvasWrapper = document.querySelector(".canvas-wrapper");
const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const faceItems = document.querySelectorAll(".faceItem");
const categoryPicker = document.querySelector(".categoryPicker");
const categoryWrapper = document.querySelector(".category-wrapper");
const categoryElements = document.querySelectorAll(".category");
const presetElements = document.querySelectorAll(".preset");
const backgroundColorInput = document.querySelector(".canvas-background-picker");
const secondaryColorInput = document.querySelector(".canvas-secondary-picker");
const combinationsTitle = document.querySelector(".combinations-title");
const saveDataContainer = document.querySelector("#saveData");
const saveDataPre = saveDataContainer?.querySelector("pre");
const readDataButton = saveDataContainer?.querySelector(".read-data-button");
let currentCategory = DEFAULT_SFC_FACE.currentCategory;
const selectedCategoryImages = {};
const selectedCategoryColors = {};
const loadedImageCache = {};
const recoloredImageCache = {};
let canvasBackgroundColor = DEFAULT_SFC_FACE.background;
const saveCodeVersion = DEFAULT_SFC_FACE.version;
const desktopPointerMediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
let faceSaveTimeoutId = 0;
let faceStateUpdatedAt = DEFAULT_SFC_FACE.updatedAt || "";

function readSfcDebugLocalDataState() {
    try {
        const rawFaceData = window.localStorage.getItem(SFC_FACE_STORAGE_KEY);
        return {
            hasLocalFaceData: Boolean(rawFaceData),
            localFaceDataValid: Boolean(rawFaceData && JSON.parse(rawFaceData)?.version === saveCodeVersion)
        };
    } catch {
        return {
            hasLocalFaceData: true,
            localFaceDataValid: false
        };
    }
}

async function logSfcDebugStorageState(loadResult) {
    const localDataState = readSfcDebugLocalDataState();
    let user = null;
    let username = "";

    try {
        const { data, error } = await window.database?.auth?.getUser?.() ?? {};
        const isMissingSession =
            error?.name === "AuthSessionMissingError"
            || /auth session missing/i.test(String(error?.message || ""));

        if (error && !isMissingSession) {
            throw error;
        }

        user = data?.user ?? null;

        // Debug should print the same visible identity source Kolorlando uses
        // so auth checks across both pages can be compared directly.
        if (user?.email) {
            const { data: profileRows, error: profileError } = await window.database
                .from("users")
                .select("username")
                .eq("email", user.email.toLowerCase())
                .limit(1);

            if (profileError) {
                throw profileError;
            }

            const profileUsername = profileRows?.[0]?.username;
            username = typeof profileUsername === "string" && profileUsername.trim()
                ? profileUsername.trim()
                : user.email.split("@")[0];
        }
    } catch (error) {
        console.warn("[SFC debug] Could not resolve auth state.", error);
    }

    const loggedIn = Boolean(user?.id);
    const hasOnlineFaceData = Boolean(loadResult?.playerRow?.avatar_face);

    console.log(
        `[SFC debug]\n`
        + `${loggedIn ? "Logged in" : "Anonymous"}\n`
        + `${loggedIn ? `- username: ${username || "unknown"}\n` : ""}`
        + `- local data: ${localDataState.hasLocalFaceData ? "yes" : "no"}\n`
        + `- table data: ${hasOnlineFaceData ? "yes" : "no"}\n`
        + `- load source: ${loadResult?.source ?? "unknown"}`
    );
}

function createResolvedCategoryItems(rawCategoryItems) {
    return Object.fromEntries(
        Object.entries(rawCategoryItems).map(([categoryName, items]) => [
            categoryName,
            items.map(item => ({
                ...item,
                // Normalizing every catalog URL through the shared resolver
                // keeps local assets and mirrored former external assets
                // reachable after deployment from any supported site root.
                imgUrl: resolveSfcImageUrlAlias(item?.imgUrl || "", import.meta.url)
            }))
        ])
    );
}

function createEditorCategoryItems(categoryName, slotCount = 16) {
    const sharedItems = SFC_CATEGORY_ITEMS[categoryName] || [];
    const nextItems = sharedItems.map(item => ({ ...item }));

    while (nextItems.length < slotCount) {
        const slotLabel = String(nextItems.length + 1).padStart(2, "0");
        nextItems.push({
            imgUrl: `REPLACE_WITH_${categoryName.toUpperCase()}_${slotLabel}_URL`
        });
    }

    return nextItems;
}

const categoryItems = createResolvedCategoryItems({
    eyes: createEditorCategoryItems("eyes"),
    eyebrows: createEditorCategoryItems("eyebrows"),
    nose: createEditorCategoryItems("nose"),
    mouth: createEditorCategoryItems("mouth"),
    ears: createEditorCategoryItems("ears"),
    hair: createEditorCategoryItems("hair"),
    glasses: createEditorCategoryItems("glasses"),
    beard: createEditorCategoryItems("beard")
});

// Keeping the visible background picker aligned with the shared default face
// avoids saving an editor-only color that differs from Kolorlando's fallback.
backgroundColorInput.value = canvasBackgroundColor;

const categoryDrawSettings = {
    // Each category gets its own normalized layout values so you can
    // tweak placement quickly without touching the drawing math below.
    eyes: {
        layerOrder: 4,
        widthRatio: 0.27,
        heightRatio: 0.27,
        placements: [
            {
                // The right eye stays near the original eye row height, but
                // now each eye can be positioned independently as its own copy.
                centerXRatio: 0.67,
                centerYRatio: 1 / 3,
                flipX: false
            },
            {
                // The left eye mirrors the same asset so a single eye drawing
                // can generate a pair while keeping a balanced anime spacing.
                centerXRatio: 0.33,
                centerYRatio: 1 / 3,
                flipX: true
            }
        ]
    },
    eyebrows: {
        layerOrder: 5,
        widthRatio: 0.25,
        heightRatio: 0.25,
        placements: [
            {
                // The right eyebrow sits a bit above the right eye while
                // keeping a clean spacing that matches the paired-eye setup.
                centerXRatio: 0.67,
                centerYRatio: 0.20,
                flipX: false
            },
            {
                // The left eyebrow mirrors the same line art so one asset can
                // generate a symmetrical eyebrow pair automatically.
                centerXRatio: 0.33,
                centerYRatio: 0.20,
                flipX: true
            }
        ]
    },
    nose: {
        layerOrder: 6,
        widthRatio: 0.25,
        heightRatio: 0.25,
        centerXRatio: 0.5,
        centerYRatio: 0.55
    },
    mouth: {
        layerOrder: 3,
        widthRatio: 0.5,
        heightRatio: 0.5,
        centerXRatio: 0.5,
        centerYRatio: 0.75
    },
    ears: {
        layerOrder: 2,
        widthRatio: 0.24,
        heightRatio: 0.32,
        placements: [
            {
                // Right ear sits flush against the right edge and is
                // vertically centered halfway down the canvas.
                anchorXRatio: 1,
                centerYRatio: 0.5,
                flipX: false
            },
            {
                // Left ear mirrors the same source image so you only
                // need one asset for both sides of the head.
                anchorXRatio: 0,
                centerYRatio: 0.5,
                flipX: true
            }
        ]
    },
    hair: {
        layerOrder: 1,
        widthRatio: 1,
        heightRatio: 1,
        centerXRatio: 0.5,
        centerYRatio: 0.5
    },
    glasses: {
        layerOrder: 7,
        widthRatio: 0.27,
        heightRatio: 0.27,
        placements: [
            {
                // The right glasses lens follows the same eye-row height so
                // eyewear can sit naturally over the existing eye placement.
                centerXRatio: 0.635,
                centerYRatio: 1 / 3,
                flipX: false
            },
            {
                // The left lens mirrors the same source art so one glasses
                // asset can render as a matching side-by-side pair.
                centerXRatio: 0.365,
                centerYRatio: 1 / 3,
                flipX: true
            }
        ]
    },
    beard: {
        layerOrder: 8,
        widthRatio: 0.38,
        heightRatio: 0.38,
        placements: [
            {
                // The right beard half uses the shared mirrored layout so a
                // single beard asset can be duplicated into a centered pair.
                centerXRatio: 0.688,
                centerYRatio: 0.81,
                flipX: false
            },
            {
                // The left beard half mirrors the same source image so both
                // sides meet cleanly in the middle under the mouth.
                centerXRatio: 0.312,
                centerYRatio: 0.81,
                flipX: true
            }
        ]
    }
};

function resizeCanvasToWrapper() {
    // Keep the canvas internal pixel size aligned with the wrapper size
    // so anything we draw stays sharp and lands in the expected position.
    const wrapperWidth = canvasWrapper.clientWidth;
    const wrapperHeight = canvasWrapper.clientHeight;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.round(wrapperWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(wrapperHeight * pixelRatio));

    // Reset the transform after resizing, then scale drawing operations
    // back into CSS pixels so positioning math stays simple.
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    applyCanvasSmoothing();
    redrawCanvas();
}

function applyCanvasSmoothing() {
    // Reapply smoothing on the shared 2D context so every image draw on
    // this canvas follows the same browser smoothing behavior.
    context.imageSmoothingEnabled = true;

    // Ask the browser for the smoothest interpolation it offers when
    // face parts are scaled during preview rendering.
    context.imageSmoothingQuality = "high";
}

function isRealImageUrl(imgUrl) {
    // Placeholder values are useful while building the catalog, but
    // they should not create broken <img> tags in the visible grid.
    return Boolean(imgUrl) && !imgUrl.startsWith("REPLACE_WITH_");
}

function updatePossibleCombinationsTitle() {
    const possibleCombinations = Object.values(categoryItems).reduce((total, items) => {
        // Only real item URLs count toward the total combination space so
        // unfinished placeholder slots do not inflate the displayed number.
        const realItemsCount = items.filter(item => isRealImageUrl(item.imgUrl)).length;
        return total * Math.max(realItemsCount, 1);
    }, 1);

    combinationsTitle.textContent = `Make ${possibleCombinations.toLocaleString()} different faces`;
}

function findCategoryItemByImgUrl(imgUrl) {
    const categoryEntryList = Object.values(categoryItems);

    for (let categoryIndex = 0; categoryIndex < categoryEntryList.length; categoryIndex += 1) {
        const matchedItem = categoryEntryList[categoryIndex].find(item => item?.imgUrl === imgUrl);

        if (matchedItem) {
            return matchedItem;
        }
    }

    return null;
}

function renderCategoryItems(categoryName) {
    // Read the selected category from the source object and push those
    // values into the 16 existing DOM slots before any click logic runs.
    const itemsForCategory = categoryItems[categoryName] || [];

    faceItems.forEach((faceItem, index) => {
        // Storing the index on the element keeps click handling simple
        // if you later want to know exactly which slot was selected.
        faceItem.dataset.itemIndex = index;

        const itemData = itemsForCategory[index];
        const imgUrl = itemData?.imgUrl || "";

        // Clearing the slot first guarantees old category images do not
        // leak into the new category when switching tabs.
        faceItem.innerHTML = "";
        faceItem.dataset.imgUrl = imgUrl;

        if (!isRealImageUrl(imgUrl)) {
            return;
        }

        const image = document.createElement("img");

        // The image source comes from the category object, making the
        // object the single source of truth for every face item slot.
        image.alt = "";
        image.src = imgUrl;
        faceItem.appendChild(image);
    });

    updateSelectedFaceItemStyles();
}

function updateSelectedFaceItemStyles() {
    const selectedImgUrl = selectedCategoryImages[currentCategory] || "";

    faceItems.forEach(faceItem => {
        // The visible highlight follows the selected item for the
        // currently open category so the grid shows what is active now.
        const isSelected = faceItem.dataset.imgUrl === selectedImgUrl && Boolean(selectedImgUrl);
        faceItem.classList.toggle("selected", isSelected);
    });
}

function updateSelectedCategoryStyles() {
    categoryElements.forEach(categoryElement => {
        // Highlighting the active category makes the current item panel and
        // recolor target easier to understand at a glance.
        const isSelected = categoryElement.dataset.category === currentCategory;
        categoryElement.classList.toggle("selected", isSelected);
    });
}

function syncSecondaryColorInput() {
    // The right-hand color picker reflects the tint assigned to the currently
    // open category so switching tabs always shows the active recolor state.
    secondaryColorInput.value = selectedCategoryColors[currentCategory] || "#d4af37";
}

function loadDefaultSelections() {
    const categoriesWithoutDefaultSelection = ["glasses", "beard"];

    Object.keys(categoryItems).forEach(categoryName => {
        // Some optional categories should start empty so the opening face
        // keeps its simpler default look until the user opts into them.
        if (categoriesWithoutDefaultSelection.includes(categoryName)) {
            return;
        }

        const defaultItem = categoryItems[categoryName]?.[0];
        const defaultImgUrl = defaultItem?.imgUrl || "";

        // Only real URLs should become default layers so unfinished
        // placeholder slots do not appear selected on first load.
        if (!isRealImageUrl(defaultImgUrl)) {
            return;
        }

        selectedCategoryImages[categoryName] = defaultImgUrl;
    });
}

function getFirstRealCategoryItemUrl(categoryName) {
    const firstRealItem = (categoryItems[categoryName] || []).find(item => isRealImageUrl(item?.imgUrl || ""));
    return firstRealItem?.imgUrl || "";
}

function createRandomHexColor() {
    const randomChannel = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
    return `#${randomChannel()}${randomChannel()}${randomChannel()}`;
}

function createDefaultPresetSaveData() {
    const defaultCategoryNames = Object.keys(categoryItems);
    const editorSelectionUrls = {};

    defaultCategoryNames.forEach(categoryName => {
        const savedIndex = Number.parseInt(DEFAULT_SFC_FACE.items?.[categoryName], 10);
        const runtimeEntries = SFC_CATEGORY_ITEMS[categoryName] || [];
        const defaultRuntimeUrl = Number.isInteger(savedIndex) && savedIndex >= 0
            ? resolveSfcImageUrlAlias(runtimeEntries[savedIndex]?.imgUrl || "", import.meta.url)
            : "";

        if (isRealImageUrl(defaultRuntimeUrl)) {
            editorSelectionUrls[categoryName] = defaultRuntimeUrl;
        }
    });

    return {
        version: saveCodeVersion,
        updatedAt: new Date().toISOString(),
        background: DEFAULT_SFC_FACE.background,
        currentCategory: DEFAULT_SFC_FACE.currentCategory,
        items: { ...DEFAULT_SFC_FACE.items },
        colors: { ...DEFAULT_SFC_FACE.colors },
        editorSelectionUrls
    };
}

function createRandomPresetSaveData() {
    const categoryNames = Object.keys(categoryItems);
    const items = {};
    const colors = {};
    const editorSelectionUrls = {};

    categoryNames.forEach(categoryName => {
        const availableItems = (categoryItems[categoryName] || []).filter(item => isRealImageUrl(item?.imgUrl || ""));
        const shouldIncludeItem = availableItems.length > 0 && Math.random() >= 0.35;
        const randomItem = shouldIncludeItem
            ? availableItems[Math.floor(Math.random() * availableItems.length)] || null
            : null;
        const randomImgUrl = randomItem?.imgUrl || "";
        const runtimeEntries = SFC_CATEGORY_ITEMS[categoryName] || [];

        editorSelectionUrls[categoryName] = randomImgUrl;
        items[categoryName] = runtimeEntries.findIndex(item => resolveSfcImageUrlAlias(item?.imgUrl || "", import.meta.url) === randomImgUrl);
        colors[categoryName] = createRandomHexColor();
    });

    return {
        version: saveCodeVersion,
        updatedAt: new Date().toISOString(),
        background: createRandomHexColor(),
        currentCategory,
        items,
        colors,
        editorSelectionUrls
    };
}

function createEmptyPresetSaveData() {
    const categoryNames = Object.keys(categoryItems);
    const items = {};
    const colors = {};
    const editorSelectionUrls = {};

    categoryNames.forEach(categoryName => {
        editorSelectionUrls[categoryName] = "";
        items[categoryName] = -1;
        colors[categoryName] = "#000000";
    });

    return {
        version: saveCodeVersion,
        updatedAt: new Date().toISOString(),
        background: "#ffffff",
        currentCategory,
        items,
        colors,
        editorSelectionUrls
    };
}

function applyPresetSelection(presetName) {
    // Presets rebuild the whole face payload so preview, storage, and pasted
    // save codes all stay aligned after one click.
    if (presetName === "default") {
        applySaveDataPayload(createDefaultPresetSaveData());
        return;
    }

    if (presetName === "random") {
        applySaveDataPayload(createRandomPresetSaveData());
        return;
    }

    if (presetName === "empty") {
        applySaveDataPayload(createEmptyPresetSaveData());
    }
}

function getRuntimeItemIndexForCategory(categoryName) {
    const selectedImgUrl = selectedCategoryImages[categoryName] || "";
    const runtimeCategoryEntries = SFC_CATEGORY_ITEMS[categoryName] || [];

    // Kolorlando only understands the shared runtime catalog, so the saved
    // game-facing item index must be resolved against that smaller list.
    return runtimeCategoryEntries.findIndex(item => resolveSfcImageUrlAlias(item?.imgUrl || "") === selectedImgUrl);
}

function getSavedEditorSelectionUrl(categoryName, saveData) {
    const savedSelectionUrls = saveData?.editorSelectionUrls || {};
    const savedEditorUrl = resolveSfcImageUrlAlias(savedSelectionUrls[categoryName] || "");
    const editorCategoryEntries = categoryItems[categoryName] || [];
    const hasMatchingEditorItem = editorCategoryEntries.some(item => item?.imgUrl === savedEditorUrl);

    // The editor keeps its own richer catalog, so a saved URL is the most
    // reliable way to restore custom picks that Kolorlando itself ignores.
    if (isRealImageUrl(savedEditorUrl) && hasMatchingEditorItem) {
        return savedEditorUrl;
    }

    return "";
}

function getSavedRuntimeSelectionUrl(categoryName, saveData) {
    const savedIndex = Number.parseInt(saveData?.items?.[categoryName], 10);
    const runtimeCategoryEntries = SFC_CATEGORY_ITEMS[categoryName] || [];
    const runtimeItem = Number.isInteger(savedIndex)
        ? runtimeCategoryEntries[savedIndex]
        : null;
    const runtimeImgUrl = resolveSfcImageUrlAlias(runtimeItem?.imgUrl || "");

    // Falling back to the runtime catalog lets the editor open existing
    // Kolorlando payloads even when they do not include editor-only metadata.
    if (isRealImageUrl(runtimeImgUrl)) {
        return runtimeImgUrl;
    }

    return "";
}

function buildSaveDataPayload() {
    const items = {};
    const colors = {};
    const editorSelectionUrls = {};

    Object.keys(categoryItems).forEach(categoryName => {
        // Using -1 for empty categories makes "no item selected" explicit
        // in the code instead of silently dropping the category entirely.
        items[categoryName] = getRuntimeItemIndexForCategory(categoryName);

        // The editor also saves the raw selected URL so larger local catalogs
        // survive reloads even when the game only supports a smaller subset.
        editorSelectionUrls[categoryName] = selectedCategoryImages[categoryName] || "";

        // Every category keeps its own tint entry so the read action can
        // restore custom recolors even if that category is not open yet.
        colors[categoryName] = selectedCategoryColors[categoryName] || "";
    });

    return {
        version: saveCodeVersion,
        updatedAt: faceStateUpdatedAt,
        background: canvasBackgroundColor,
        currentCategory,
        items,
        colors,
        editorSelectionUrls
    };
}

function markFaceStateDirty() {
    // One shared revision timestamp lets local and remote storage agree on
    // which face snapshot is newer without guessing from page flow order.
    faceStateUpdatedAt = new Date().toISOString();
}

function generateSaveCode() {
    // A JSON string keeps the code human-readable inside the editable
    // <pre> while staying simple to parse back into app state later.
    return JSON.stringify(buildSaveDataPayload());
}

function updateSaveDataPre({ persist = true } = {}) {
    // The save-code preview should always reflect the live face state so
    // users do not need a separate save click before copying the code.
    const savePayload = buildSaveDataPayload();
    const saveCode = JSON.stringify(savePayload,null,2);

    if (saveDataPre) {
        saveDataPre.textContent = saveCode;
    }

    if (persist) {
        scheduleFacePersistence(savePayload);
    }
}

function applySaveDataPayload(saveData, { persist = true } = {}) {
    faceStateUpdatedAt = typeof saveData?.updatedAt === "string"
        ? saveData.updatedAt
        : "";

    const savedItems = saveData?.items || {};
    const savedColors = saveData?.colors || {};
    const categoryNames = Object.keys(categoryItems);

    // Clear prior selections first so missing entries in the incoming code
    // truly remove layers instead of leaving stale state behind.
    categoryNames.forEach(categoryName => {
        delete selectedCategoryImages[categoryName];
        delete selectedCategoryColors[categoryName];
    });

    categoryNames.forEach(categoryName => {
        const savedEditorUrl = getSavedEditorSelectionUrl(categoryName, saveData);
        const savedRuntimeUrl = getSavedRuntimeSelectionUrl(categoryName, saveData);
        const savedImgUrl = savedEditorUrl || savedRuntimeUrl;

        // Only real URLs should become active layers so malformed codes or
        // placeholder catalog slots do not break the restored face.
        if (isRealImageUrl(savedImgUrl)) {
            selectedCategoryImages[categoryName] = savedImgUrl;
        }

        // Valid hex colors are restored category by category so the color
        // picker can immediately reflect the active category tint again.
        if (/^#[0-9a-f]{6}$/i.test(savedColors[categoryName] || "")) {
            selectedCategoryColors[categoryName] = savedColors[categoryName];
        }
    });

    // Restoring the background input keeps the saved skin/base color visible
    // in both the UI control and the painted canvas after a read action.
    if (/^#[0-9a-f]{6}$/i.test(saveData?.background || "")) {
        canvasBackgroundColor = saveData.background;
        backgroundColorInput.value = saveData.background;
    }

    // Falling back to the current category prevents broken tab state when
    // the pasted code references a category name that no longer exists.
    if (categoryNames.includes(saveData?.currentCategory)) {
        currentCategory = saveData.currentCategory;
    }

    renderCategoryItems(currentCategory);
    updateSelectedCategoryStyles();
    updateSelectedFaceItemStyles();
    syncSecondaryColorInput();
    updateSaveDataPre({ persist });
    redrawCanvas();
}

function readSaveCodeFromPre() {
    const rawSaveCode = saveDataPre?.textContent?.trim() || "";

    // Empty save text should not trigger a noisy parse failure when the
    // user presses Read before any code has been generated or pasted in.
    if (!rawSaveCode) {
        return;
    }

    let parsedSaveData;

    try {
        parsedSaveData = JSON.parse(rawSaveCode);
    } catch {
        return;
    }

    // The editor accepts full payloads so pasted SFC codes can restore both
    // the shared Kolorlando fields and any editor-only catalog selections.
    if (parsedSaveData?.version !== saveCodeVersion) {
        return;
    }

    applySaveDataPayload(parsedSaveData);
}

function scheduleFacePersistence(saveData) {
    // Coalescing rapid editor changes avoids firing one remote write per
    // pointer move while still keeping the latest face state authoritative.
    if (faceSaveTimeoutId) {
        window.clearTimeout(faceSaveTimeoutId);
    }

    faceSaveTimeoutId = window.setTimeout(() => {
        faceSaveTimeoutId = 0;
        savePlayerFaceData(saveData).then(saveResult => {
            if (saveResult?.savedRemotely) {
                console.log("[SFC debug]\nLogged in\n- saved to online table: yes");
            }
        });
    }, 250);
}

function enableDesktopCategoryDragScroll() {
    if (!categoryPicker || !categoryWrapper) {
        return;
    }

    let isMouseDown = false;
    let isDragging = false;
    let shouldSuppressClick = false;
    let dragStartX = 0;
    let scrollStartX = 0;

    const stopDragging = () => {
        shouldSuppressClick = isDragging;
        isMouseDown = false;
        isDragging = false;
        categoryPicker.classList.remove("dragging");
    };

    // Mouse-only drag scrolling avoids interfering with touch scrolling and
    // keeps normal category clicks intact on desktop browsers.
    categoryWrapper.addEventListener("mousedown", event => {
        if (!desktopPointerMediaQuery.matches || event.button !== 0) {
            return;
        }

        isMouseDown = true;
        isDragging = false;
        dragStartX = event.clientX;
        scrollStartX = categoryPicker.scrollLeft;
    });

    // The threshold avoids turning a simple click into a drag when the
    // mouse wiggles by a couple of pixels during a normal category click.
    window.addEventListener("mousemove", event => {
        if (!isMouseDown || !desktopPointerMediaQuery.matches) {
            return;
        }

        const dragDistanceX = event.clientX - dragStartX;

        if (Math.abs(dragDistanceX) > 6) {
            isDragging = true;
            categoryPicker.classList.add("dragging");
        }

        if (!isDragging) {
            return;
        }

        categoryPicker.scrollLeft = scrollStartX - dragDistanceX;
        event.preventDefault();
    });

    window.addEventListener("mouseup", stopDragging);

    // Cancelling the click right after a drag keeps the strip from selecting
    // a category accidentally when the user only meant to scroll sideways.
    categoryPicker.addEventListener("click", event => {
        if (!shouldSuppressClick) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        shouldSuppressClick = false;
    }, true);
}

function hexToRgb(hexColor) {
    const normalizedHex = hexColor.replace("#", "");
    const fullHex = normalizedHex.length === 3
        ? normalizedHex.split("").map(character => character + character).join("")
        : normalizedHex;
    const colorNumber = Number.parseInt(fullHex, 16);

    return {
        r: (colorNumber >> 16) & 255,
        g: (colorNumber >> 8) & 255,
        b: colorNumber & 255
    };
}

function rgbToHsl(red, green, blue) {
    const normalizedRed = red / 255;
    const normalizedGreen = green / 255;
    const normalizedBlue = blue / 255;
    const maxChannel = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
    const minChannel = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
    const lightness = (maxChannel + minChannel) / 2;
    const delta = maxChannel - minChannel;

    if (delta === 0) {
        return { h: 0, s: 0, l: lightness };
    }

    const saturation = lightness > 0.5
        ? delta / (2 - maxChannel - minChannel)
        : delta / (maxChannel + minChannel);

    let hue = 0;

    if (maxChannel === normalizedRed) {
        hue = (normalizedGreen - normalizedBlue) / delta + (normalizedGreen < normalizedBlue ? 6 : 0);
    } else if (maxChannel === normalizedGreen) {
        hue = (normalizedBlue - normalizedRed) / delta + 2;
    } else {
        hue = (normalizedRed - normalizedGreen) / delta + 4;
    }

    return { h: hue / 6, s: saturation, l: lightness };
}

function hslToRgb(hue, saturation, lightness) {
    if (saturation === 0) {
        const grayscaleValue = Math.round(lightness * 255);
        return { r: grayscaleValue, g: grayscaleValue, b: grayscaleValue };
    }

    const hueToChannel = (p, q, t) => {
        let adjustedT = t;

        if (adjustedT < 0) {
            adjustedT += 1;
        }

        if (adjustedT > 1) {
            adjustedT -= 1;
        }

        if (adjustedT < 1 / 6) {
            return p + (q - p) * 6 * adjustedT;
        }

        if (adjustedT < 1 / 2) {
            return q;
        }

        if (adjustedT < 2 / 3) {
            return p + (q - p) * (2 / 3 - adjustedT) * 6;
        }

        return p;
    };

    const q = lightness < 0.5
        ? lightness * (1 + saturation)
        : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;

    return {
        r: Math.round(hueToChannel(p, q, hue + 1 / 3) * 255),
        g: Math.round(hueToChannel(p, q, hue) * 255),
        b: Math.round(hueToChannel(p, q, hue - 1 / 3) * 255)
    };
}

function getRecoloredImageCacheKey(imgUrl, tintColor) {
    return `${imgUrl}::${tintColor}`;
}

function recolorImageWithTint(image, tintColor) {
    const cacheKey = getRecoloredImageCacheKey(image.currentSrc || image.src, tintColor);
    const cachedRecoloredImage = recoloredImageCache[cacheKey];

    if (cachedRecoloredImage) {
        return cachedRecoloredImage;
    }

    const offscreenCanvas = document.createElement("canvas");
    const offscreenContext = offscreenCanvas.getContext("2d", { willReadFrequently: true });
    offscreenCanvas.width = image.naturalWidth || image.videoWidth || image.width;
    offscreenCanvas.height = image.naturalHeight || image.videoHeight || image.height;

    // The original asset is drawn once into an offscreen buffer so we can
    // remap only the visible pixels while leaving transparency untouched.
    try {
        offscreenContext.drawImage(image, 0, 0);
    } catch {
        return image;
    }

    let imageData;

    try {
        imageData = offscreenContext.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    } catch {
        // When a remote image blocks pixel reads, the safest behavior is to
        // keep showing the original asset instead of blanking the whole face.
        return image;
    }
    const pixelData = imageData.data;
    const tintRgb = hexToRgb(tintColor);
    const tintHsl = rgbToHsl(tintRgb.r, tintRgb.g, tintRgb.b);

    for (let pixelIndex = 0; pixelIndex < pixelData.length; pixelIndex += 4) {
        const alpha = pixelData[pixelIndex + 3];

        // Transparent pixels must stay transparent so recoloring only affects
        // the painted content inside the selected face-part silhouette.
        if (alpha === 0) {
            continue;
        }

        const sourceHsl = rgbToHsl(
            pixelData[pixelIndex],
            pixelData[pixelIndex + 1],
            pixelData[pixelIndex + 2]
        );

        // Neutral whites, blacks and grays should stay intact so line art,
        // shine, and antialias edges do not get unnaturally colorized.
        if (sourceHsl.s < 0.18 || sourceHsl.l < 0.08 || sourceHsl.l > 0.92) {
            continue;
        }

        // Preserving source lightness and part of the original saturation
        // keeps volume and shading while only shifting genuinely colored areas.
        const recoloredPixel = hslToRgb(
            tintHsl.h,
            Math.min(1, sourceHsl.s * 0.35 + tintHsl.s * 0.65),
            sourceHsl.l
        );

        pixelData[pixelIndex] = recoloredPixel.r;
        pixelData[pixelIndex + 1] = recoloredPixel.g;
        pixelData[pixelIndex + 2] = recoloredPixel.b;
    }

    offscreenContext.putImageData(imageData, 0, 0);
    recoloredImageCache[cacheKey] = offscreenCanvas;
    return offscreenCanvas;
}

function drawFacePart(categoryName, image) {
    const canvasWidth = canvasWrapper.clientWidth;
    const canvasHeight = canvasWrapper.clientHeight;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    const currentSettings =
        categoryDrawSettings[categoryName] || categoryDrawSettings.eyes;
    const sourceWidth = image.naturalWidth || image.videoWidth || image.width;
    const sourceHeight = image.naturalHeight || image.videoHeight || image.height;
    const featureScale = categoryName === "hair" ? 1 : SFC_FACE_FEATURE_SCALE;

    // Limit the drawn image so it fits comfortably inside the square
    // preview while keeping the original image proportions. These
    // limits come from the active category config for easy tweaking.
    const maxDrawWidth = canvasWidth * currentSettings.widthRatio;
    const maxDrawHeight = canvasHeight * currentSettings.heightRatio;
    const imageRatio = sourceWidth / sourceHeight;

    let baseDrawWidth = maxDrawWidth;
    let baseDrawHeight = baseDrawWidth / imageRatio;

    if (baseDrawHeight > maxDrawHeight) {
        baseDrawHeight = maxDrawHeight;
        baseDrawWidth = baseDrawHeight * imageRatio;
    }

    // Scaling from base dimensions keeps each category's configured center as
    // the source of truth before the shared face-wide expansion is applied.
    let drawWidth = baseDrawWidth * featureScale;
    let drawHeight = baseDrawHeight * featureScale;

    // Unifying all categories under the same integer-snapped rendering path
    // removes special cases and avoids subpixel blur across the whole canvas.
    drawWidth = Math.max(1, Math.round(drawWidth));
    drawHeight = Math.max(1, Math.round(drawHeight));

    if (Array.isArray(currentSettings.placements) && currentSettings.placements.length > 0) {
        currentSettings.placements.forEach(placement => {
            // Placements can either pin artwork to an edge or center it on a
            // ratio, which keeps ears and eyes sharing one flexible system.
            const baseCenterX = typeof placement.centerXRatio === "number"
                ? canvasWidth * placement.centerXRatio
                : canvasWidth * placement.anchorXRatio + (placement.flipX ? baseDrawWidth / 2 : -baseDrawWidth / 2);
            const baseCenterY = canvasHeight * placement.centerYRatio;
            const scaledCenterX = canvasCenterX + (baseCenterX - canvasCenterX) * featureScale;
            const scaledCenterY = canvasCenterY + (baseCenterY - canvasCenterY) * featureScale;
            const finalDrawX = Math.round(scaledCenterX - drawWidth / 2);
            const finalDrawY = Math.round(scaledCenterY - drawHeight / 2);

            // Flipping the left ear in canvas space keeps the source
            // art reusable while still placing it exactly at the target slot.
            if (placement.flipX) {
                context.save();
                context.translate(finalDrawX + drawWidth, 0);
                context.scale(-1, 1);
                context.drawImage(image, 0, finalDrawY, drawWidth, drawHeight);
                context.restore();
                return;
            }

            context.drawImage(image, finalDrawX, finalDrawY, drawWidth, drawHeight);
        });
        return;
    }

    // Position the image from category-specific center ratios so each
    // face part can be moved independently with a couple of numbers.
    const baseCenterX = canvasWidth * currentSettings.centerXRatio;
    const baseCenterY = canvasHeight * currentSettings.centerYRatio;
    const scaledCenterX = canvasCenterX + (baseCenterX - canvasCenterX) * featureScale;
    const scaledCenterY = canvasCenterY + (baseCenterY - canvasCenterY) * featureScale;
    const finalDrawX = Math.round(scaledCenterX - drawWidth / 2);
    const finalDrawY = Math.round(scaledCenterY - drawHeight / 2);

    context.drawImage(image, finalDrawX, finalDrawY, drawWidth, drawHeight);
}

function drawStoredCategoryImage(categoryName, image) {
    const tintColor = selectedCategoryColors[categoryName];
    const imageToDraw = tintColor
        ? recolorImageWithTint(image, tintColor)
        : image;

    drawFacePart(categoryName, imageToDraw);
}

function getImageForCategory(imgUrl) {
    const cachedGridImage = Array.from(faceItems).find(faceItem => {
        // Absolute URLs can contain selector-special characters like ":"
        // and "/", so matching through dataset values is safer than
        // building a CSS attribute selector string from the raw URL.
        return faceItem.dataset.imgUrl === imgUrl;
    })?.querySelector("img");

    // Reusing an already rendered grid image avoids extra network work
    // when the selected category is currently visible in the picker.
    if (cachedGridImage && cachedGridImage.complete && cachedGridImage.naturalWidth > 0) {
        loadedImageCache[imgUrl] = cachedGridImage;
        return Promise.resolve(cachedGridImage);
    }

    const cachedImage = loadedImageCache[imgUrl];

    if (cachedImage && cachedImage.complete && cachedImage.naturalWidth > 0) {
        return Promise.resolve(cachedImage);
    }

    if (cachedImage?.dataset.loading === "true") {
        return new Promise(resolve => {
            cachedImage.addEventListener("load", () => {
                resolve(cachedImage);
            }, { once: true });
        });
    }

    const image = new Image();
    image.dataset.loading = "true";
    loadedImageCache[imgUrl] = image;

    // Off-DOM images let us redraw saved selections even when their
    // category is not the one currently displayed in the grid.
    return new Promise(resolve => {
        image.addEventListener("load", () => {
            delete image.dataset.loading;
            resolve(image);
        }, { once: true });
        image.addEventListener("error", () => {
            // Clearing failed local-only loads keeps the cache honest so a
            // later deploy or asset fix can be retried on the next redraw.
            delete loadedImageCache[imgUrl];
            resolve(null);
        }, { once: true });
        image.src = imgUrl;
    });
}

async function redrawCanvas() {
    const canvasWidth = canvasWrapper.clientWidth;
    const canvasHeight = canvasWrapper.clientHeight;

    // Repainting from saved selections lets parts from different
    // categories coexist instead of the newest click wiping the rest.
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    applyCanvasSmoothing();

    // Filling the canvas first makes the chosen background color act
    // like the base layer under every face part category.
    context.fillStyle = canvasBackgroundColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    const sortedCategoryNames = Object.keys(categoryDrawSettings).sort((leftCategory, rightCategory) => {
        const leftOrder = categoryDrawSettings[leftCategory]?.layerOrder ?? 0;
        const rightOrder = categoryDrawSettings[rightCategory]?.layerOrder ?? 0;

        // Lower layer numbers are painted first so higher numbers stay
        // visually on top when different category parts overlap.
        return leftOrder - rightOrder;
    });

    const imagesToDraw = await Promise.all(sortedCategoryNames.map(async categoryName => {
        const imgUrl = selectedCategoryImages[categoryName];

        if (!imgUrl) {
            return null;
        }

        const image = await getImageForCategory(imgUrl);

        if (!image) {
            return null;
        }

        return { categoryName, image };
    }));

    // Drawing only after every selected image is ready preserves the
    // configured layer order instead of letting network timing decide.
    imagesToDraw.forEach(imageData => {
        if (!imageData) {
            return;
        }

        drawStoredCategoryImage(imageData.categoryName, imageData.image);
    });
}

categoryElements.forEach(categoryElement => {
    categoryElement.addEventListener("click", () => {
        // Reading the category from HTML keeps the mapping simple and
        // makes future category switching work without hardcoded indexes.
        currentCategory = categoryElement.dataset.category || "eyes";
        markFaceStateDirty();

        // Rebuilding the grid here ensures the visible item list always
        // matches the currently selected category before the next click.
        renderCategoryItems(currentCategory);
        updateSelectedCategoryStyles();
        syncSecondaryColorInput();
        updateSaveDataPre();
    });
});

faceItems.forEach(faceItem => {
    faceItem.addEventListener("click", () => {
        const image = faceItem.querySelector("img");
        const clickedImgUrl = faceItem.dataset.imgUrl || "";

        // Ignore empty slots until they have real art assigned.
        if (!image) {
            return;
        }

        // Clicking the same item again removes that category layer
        // so the user can toggle individual parts on and off easily.
        if (selectedCategoryImages[currentCategory] === clickedImgUrl) {
            delete selectedCategoryImages[currentCategory];
            markFaceStateDirty();
            updateSelectedFaceItemStyles();
            updateSaveDataPre();
            redrawCanvas();
            return;
        }

        // If the browser has already loaded the image we can draw it
        // immediately, otherwise we wait for it to finish loading once.
        if (image.complete && image.naturalWidth > 0) {
            // Saving the URL instead of the DOM node keeps the selected
            // layer stable even when the grid is rebuilt for categories.
            selectedCategoryImages[currentCategory] = clickedImgUrl;
            markFaceStateDirty();
            updateSelectedFaceItemStyles();
            updateSaveDataPre();
            redrawCanvas();
            return;
        }

        image.addEventListener("load", () => {
            // Delayed loads still commit the selected image URL before
            // the combined canvas is repainted with all layers.
            selectedCategoryImages[currentCategory] = clickedImgUrl;
            markFaceStateDirty();
            updateSelectedFaceItemStyles();
            updateSaveDataPre();
            redrawCanvas();
        }, { once: true });
    });
});

presetElements.forEach(presetElement => {
    presetElement.addEventListener("click", () => {
        applyPresetSelection(presetElement.dataset.preset || "");
    });
});

backgroundColorInput.addEventListener("input", () => {
    // Keeping the selected color in a variable makes future redraws
    // reuse the same background without reading the DOM each time.
    canvasBackgroundColor = backgroundColorInput.value;
    markFaceStateDirty();
    updateSaveDataPre();
    redrawCanvas();
});

secondaryColorInput.addEventListener("input", () => {
    // The tint belongs to the currently active category so the user can pick
    // a part, choose a color, and immediately see that specific layer change.
    selectedCategoryColors[currentCategory] = secondaryColorInput.value;
    markFaceStateDirty();
    updateSaveDataPre();
    redrawCanvas();
});

readDataButton?.addEventListener("click", () => {
    // Reading directly from the <pre> lets pasted codes and freshly saved
    // codes follow the same restore path and UI refresh behavior.
    readSaveCodeFromPre();
});

// Rendering once at startup makes the initial "eyes" category come
// from the data object instead of relying on hardcoded HTML images.
updatePossibleCombinationsTitle();
const storedPlayerFaceDataResult = await loadPlayerFaceData();
const storedPlayerFaceData = storedPlayerFaceDataResult?.faceData;
await logSfcDebugStorageState(storedPlayerFaceDataResult);

if (storedPlayerFaceData?.version === saveCodeVersion) {
    applySaveDataPayload(storedPlayerFaceData, { persist: false });
} else {
    loadDefaultSelections();
    markFaceStateDirty();
    renderCategoryItems(currentCategory);
    updateSelectedCategoryStyles();
    syncSecondaryColorInput();
    updateSaveDataPre({ persist: false });
    resizeCanvasToWrapper();
}

if (storedPlayerFaceData) {
    resizeCanvasToWrapper();
}

enableDesktopCategoryDragScroll();
window.addEventListener("resize", resizeCanvasToWrapper);
