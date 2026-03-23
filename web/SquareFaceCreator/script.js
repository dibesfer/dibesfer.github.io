const canvasWrapper = document.querySelector(".canvas-wrapper");
const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const faceItems = document.querySelectorAll(".faceItem");
const categoryPicker = document.querySelector(".categoryPicker");
const categoryWrapper = document.querySelector(".category-wrapper");
const categoryElements = document.querySelectorAll(".category");
const backgroundColorInput = document.querySelector(".canvas-background-picker");
const secondaryColorInput = document.querySelector(".canvas-secondary-picker");
const combinationsTitle = document.querySelector(".combinations-title");
const saveDataContainer = document.querySelector("#saveData");
const saveDataPre = saveDataContainer?.querySelector("pre");
const readDataButton = saveDataContainer?.querySelector(".read-data-button");
let currentCategory = "eyes";
const selectedCategoryImages = {};
const selectedCategoryColors = {};
const loadedImageCache = {};
const recoloredImageCache = {};
let canvasBackgroundColor = backgroundColorInput.value;
const saveCodeVersion = "SFC1";
const desktopPointerMediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

const categoryItems = {
    // Each category keeps a fixed list of 16 item slots.
    // Replace the example imgUrl values with your real image URLs.
    eyes: [
        { imgUrl: "assets/categories/eyes/SFC_eyes1.png" },
        { imgUrl: "assets/categories/eyes/SFC_eyes2.png" },
        { imgUrl: "https://www.pngmart.com/files/23/Cartoon-Eye-PNG-Picture.png" },
        { imgUrl: "https://pngimg.com/d/eye_PNG6187.png" },
        { imgUrl: "https://www.freeiconspng.com/uploads/eyes-icon-0.png" },
        
        { imgUrl: "https://www.onlygfx.com/wp-content/uploads/2021/08/simple-eye-5144.svg" },
        { imgUrl: "REPLACE_WITH_EYES_07_URL" },
        { imgUrl: "REPLACE_WITH_EYES_08_URL" },
        { imgUrl: "REPLACE_WITH_EYES_09_URL" },
        { imgUrl: "REPLACE_WITH_EYES_10_URL" },
        { imgUrl: "REPLACE_WITH_EYES_11_URL" },
        { imgUrl: "REPLACE_WITH_EYES_12_URL" },
        { imgUrl: "REPLACE_WITH_EYES_13_URL" },
        { imgUrl: "REPLACE_WITH_EYES_14_URL" },
        { imgUrl: "REPLACE_WITH_EYES_15_URL" },
        { imgUrl: "REPLACE_WITH_EYES_16_URL" }
    ],
    eyebrows: [
        { imgUrl: "assets/categories/eyebrows/SFC_eyebrows1.png" },
        { imgUrl: "https://www.pngall.com/wp-content/uploads/14/Eyebrow-PNG.png" },
        { imgUrl: "https://static.vecteezy.com/system/resources/thumbnails/022/924/750/small/black-eyebrow-drawing-png.png" },
        { imgUrl: "https://static.vecteezy.com/system/resources/thumbnails/016/658/101/small/brown-brow-line-art-png.png" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_05_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_06_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_07_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_08_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_09_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_10_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_11_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_12_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_13_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_14_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_15_URL" },
        { imgUrl: "REPLACE_WITH_EYEBROWS_16_URL" }
    ],
    nose: [
        { imgUrl: "assets/categories/nose/SFC_nose1.png" },
        { imgUrl: "assets/categories/nose/SFC_nose2.svg" },
        { imgUrl: "https://images.vexels.com/media/users/3/252474/isolated/preview/81c2548b31a26f089248ab4022c0d8da-anime-nose-stroke.png" },
        { imgUrl: "https://pngimg.com/d/nose_PNG12.png" },
        { imgUrl: "https://pngimg.com/d/nose_PNG8.png" },
        { imgUrl: "REPLACE_WITH_NOSE_05_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_06_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_07_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_08_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_09_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_10_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_11_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_12_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_13_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_14_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_15_URL" },
        { imgUrl: "REPLACE_WITH_NOSE_16_URL" }
    ],
    mouth: [
        { imgUrl: "assets/categories/mouth/SFC_mouth1.png" },
        
        { imgUrl: "https://images.vexels.com/media/users/3/252302/isolated/preview/49cb11a5214ad6339f540faf86a91c01-anime-open-mouth.png" },
        { imgUrl: "https://static.vecteezy.com/system/resources/thumbnails/025/868/361/small/happy-smile-046-png.png" },
        { imgUrl: "https://www.pngall.com/wp-content/uploads/15/Anime-Mouth-PNG-Image-File.png" },
        { imgUrl: "https://images.vexels.com/media/users/3/252487/isolated/preview/d9b94e35af6fb920c619807df06c9c75-boca-de-sonrisa-feliz.png" },
        { imgUrl: "https://images.vexels.com/media/users/3/252291/isolated/preview/bbd9948356d3fdd2f162226b7f1fe78c-anime-smile-color-stroke.png" },
        { imgUrl: "" },
        { imgUrl: "REPLACE_WITH_MOUTH_07_URL" },
        { imgUrl: "REPLACE_WITH_MOUTH_08_URL" },
        { imgUrl: "REPLACE_WITH_MOUTH_09_URL" },
        { imgUrl: "REPLACE_WITH_MOUTH_10_URL" },
        { imgUrl: "REPLACE_WITH_MOUTH_11_URL" },
        { imgUrl: "REPLACE_WITH_MOUTH_12_URL" },
        { imgUrl: "REPLACE_WITH_MOUTH_13_URL" },
        { imgUrl: "REPLACE_WITH_MOUTH_14_URL" },
        { imgUrl: "REPLACE_WITH_MOUTH_15_URL" },
        { imgUrl: "REPLACE_WITH_MOUTH_16_URL" }
    ],
    ears: [
        { imgUrl: "assets/categories/ears/SFC_ear2.svg" },
        { imgUrl: "https://cdn.creazilla.com/cliparts/69759/ear-clipart-md.png" },
        { imgUrl: "https://www.freepnglogos.com/uploads/ear-png/vector-graphic-ear-listen-hear-gossip-sound-image-pixabay-15.png" },
        { imgUrl: "https://www.freepnglogos.com/uploads/ear-png/ear-very-basic-listen-icon-ios-iconset-icons-35.png" },
        { imgUrl: "https://freepngimg.com/thumb/ear/142094-ear-vector-download-hq.png" },
        { imgUrl: "REPLACE_WITH_EARS_05_URL" },
        { imgUrl: "REPLACE_WITH_EARS_06_URL" },
        { imgUrl: "REPLACE_WITH_EARS_07_URL" },
        { imgUrl: "REPLACE_WITH_EARS_08_URL" },
        { imgUrl: "REPLACE_WITH_EARS_09_URL" },
        { imgUrl: "REPLACE_WITH_EARS_10_URL" },
        { imgUrl: "REPLACE_WITH_EARS_11_URL" },
        { imgUrl: "REPLACE_WITH_EARS_12_URL" },
        { imgUrl: "REPLACE_WITH_EARS_13_URL" },
        { imgUrl: "REPLACE_WITH_EARS_14_URL" },
        { imgUrl: "REPLACE_WITH_EARS_15_URL" },
        { imgUrl: "REPLACE_WITH_EARS_16_URL" }
    ],
    hair: [
        { imgUrl: "assets/categories/hair/SFC_hair1.png" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "REPLACE_WITH_HAIR_05_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_06_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_07_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_08_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_09_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_10_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_11_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_12_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_13_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_14_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_15_URL" },
        { imgUrl: "REPLACE_WITH_HAIR_16_URL" }
    ],
    glasses: [
        { imgUrl: "/web/SquareFaceCreator/assets/categories/glasses/SFC_glasses1.png" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" }
    ],
    beard: [
        { imgUrl: "/web/SquareFaceCreator/assets/categories/beard/SFC_beard1.png" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" },
        { imgUrl: "" }
    ]
};

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
        image.src = imgUrl;
        image.alt = "";
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
    Object.keys(categoryItems).forEach(categoryName => {
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

function getSelectedItemIndexForCategory(categoryName) {
    const selectedImgUrl = selectedCategoryImages[categoryName] || "";
    const categoryEntries = categoryItems[categoryName] || [];

    // Saving the selected slot index instead of the full URL keeps the
    // code shorter while still mapping back to the current local catalog.
    return categoryEntries.findIndex(item => item?.imgUrl === selectedImgUrl);
}

function buildSaveDataPayload() {
    const items = {};
    const colors = {};

    Object.keys(categoryItems).forEach(categoryName => {
        // Using -1 for empty categories makes "no item selected" explicit
        // in the code instead of silently dropping the category entirely.
        items[categoryName] = getSelectedItemIndexForCategory(categoryName);

        // Every category keeps its own tint entry so the read action can
        // restore custom recolors even if that category is not open yet.
        colors[categoryName] = selectedCategoryColors[categoryName] || "";
    });

    return {
        version: saveCodeVersion,
        background: canvasBackgroundColor,
        currentCategory,
        items,
        colors
    };
}

function generateSaveCode() {
    // A JSON string keeps the code human-readable inside the editable
    // <pre> while staying simple to parse back into app state later.
    return JSON.stringify(buildSaveDataPayload());
}

function updateSaveDataPre() {
    // The save-code preview should always reflect the live face state so
    // users do not need a separate save click before copying the code.
    if (!saveDataPre) {
        return;
    }

    saveDataPre.textContent = generateSaveCode();
}

function applySaveDataPayload(saveData) {
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
        const savedIndex = Number.parseInt(savedItems[categoryName], 10);
        const categoryEntries = categoryItems[categoryName] || [];
        const savedItem = Number.isInteger(savedIndex)
            ? categoryEntries[savedIndex]
            : null;
        const savedImgUrl = savedItem?.imgUrl || "";

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
    updateSaveDataPre();
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

    // Version-gating the payload gives the format room to evolve later
    // without trying to load incompatible codes into the current app.
    if (parsedSaveData?.version !== saveCodeVersion) {
        return;
    }

    applySaveDataPayload(parsedSaveData);
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
    const currentSettings =
        categoryDrawSettings[categoryName] || categoryDrawSettings.eyes;
    const sourceWidth = image.naturalWidth || image.videoWidth || image.width;
    const sourceHeight = image.naturalHeight || image.videoHeight || image.height;

    // Limit the drawn image so it fits comfortably inside the square
    // preview while keeping the original image proportions. These
    // limits come from the active category config for easy tweaking.
    const maxDrawWidth = canvasWidth * currentSettings.widthRatio;
    const maxDrawHeight = canvasHeight * currentSettings.heightRatio;
    const imageRatio = sourceWidth / sourceHeight;

    let drawWidth = maxDrawWidth;
    let drawHeight = drawWidth / imageRatio;

    if (drawHeight > maxDrawHeight) {
        drawHeight = maxDrawHeight;
        drawWidth = drawHeight * imageRatio;
    }

    // Unifying all categories under the same integer-snapped rendering path
    // removes special cases and avoids subpixel blur across the whole canvas.
    drawWidth = Math.max(1, Math.round(drawWidth));
    drawHeight = Math.max(1, Math.round(drawHeight));

    if (Array.isArray(currentSettings.placements) && currentSettings.placements.length > 0) {
        currentSettings.placements.forEach(placement => {
            // Placements can either pin artwork to an edge or center it on a
            // ratio, which keeps ears and eyes sharing one flexible system.
            const drawX = typeof placement.centerXRatio === "number"
                ? canvasWidth * placement.centerXRatio - drawWidth / 2
                : canvasWidth * placement.anchorXRatio - (placement.flipX ? 0 : drawWidth);
            const drawY = canvasHeight * placement.centerYRatio - drawHeight / 2;
            const finalDrawX = Math.round(drawX);
            const finalDrawY = Math.round(drawY);

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
    const drawX = canvasWidth * currentSettings.centerXRatio - drawWidth / 2;
    const drawY = canvasHeight * currentSettings.centerYRatio - drawHeight / 2;
    const finalDrawX = Math.round(drawX);
    const finalDrawY = Math.round(drawY);

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
    const cachedGridImage = document.querySelector(
        `.faceItem[data-img-url="${imgUrl}"] img`
    );

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
            updateSelectedFaceItemStyles();
            updateSaveDataPre();
            redrawCanvas();
            return;
        }

        image.addEventListener("load", () => {
            // Delayed loads still commit the selected image URL before
            // the combined canvas is repainted with all layers.
            selectedCategoryImages[currentCategory] = clickedImgUrl;
            updateSelectedFaceItemStyles();
            updateSaveDataPre();
            redrawCanvas();
        }, { once: true });
    });
});

backgroundColorInput.addEventListener("input", () => {
    // Keeping the selected color in a variable makes future redraws
    // reuse the same background without reading the DOM each time.
    canvasBackgroundColor = backgroundColorInput.value;
    updateSaveDataPre();
    redrawCanvas();
});

secondaryColorInput.addEventListener("input", () => {
    // The tint belongs to the currently active category so the user can pick
    // a part, choose a color, and immediately see that specific layer change.
    selectedCategoryColors[currentCategory] = secondaryColorInput.value;
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
loadDefaultSelections();
renderCategoryItems(currentCategory);
updateSelectedCategoryStyles();
syncSecondaryColorInput();
updateSaveDataPre();
resizeCanvasToWrapper();
enableDesktopCategoryDragScroll();
window.addEventListener("resize", resizeCanvasToWrapper);
