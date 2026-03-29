const SFC_SUPPORTED_VERSION = 'SFC1';

export const SFC_FACE_STORAGE_KEY = 'kolorlando.playerFaceData';

export const DEFAULT_SFC_FACE = {
  version: SFC_SUPPORTED_VERSION,
  background: '#f0c9a5',
  currentCategory: 'eyes',
  items: {
    eyes: 0,
    eyebrows: 0,
    nose: 0,
    mouth: 0,
    ears: 0,
    hair: 0,
    glasses: -1,
    beard: -1,
  },
  colors: {
    eyes: '',
    eyebrows: '#2a1d16',
    nose: '',
    mouth: '',
    ears: '',
    hair: '#2a1d16',
    glasses: '',
    beard: '#2a1d16',
  },
};

export const SFC_CATEGORY_ITEMS = {
  eyes: [
    { imgUrl: '/web/SquareFaceCreator/assets/categories/eyes/SFC_eyes1.png' },
    { imgUrl: '/web/SquareFaceCreator/assets/categories/eyes/SFC_eyes2.png' },
  ],
  eyebrows: [
    { imgUrl: '/web/SquareFaceCreator/assets/categories/eyebrows/SFC_eyebrows1.png' },
  ],
  nose: [
    { imgUrl: '/web/SquareFaceCreator/assets/categories/nose/SFC_nose1.png' },
    { imgUrl: '/web/SquareFaceCreator/assets/categories/nose/SFC_nose2.svg' },
  ],
  mouth: [
    { imgUrl: '/web/SquareFaceCreator/assets/categories/mouth/SFC_mouth1.png' },
    { imgUrl: '' },
  ],
  ears: [
    { imgUrl: '/web/SquareFaceCreator/assets/categories/ears/SFC_ear2.svg' },
  ],
  hair: [
    { imgUrl: '/web/SquareFaceCreator/assets/categories/hair/SFC_hair1.png' },
    { imgUrl: '' },
  ],
  glasses: [
    { imgUrl: '/web/SquareFaceCreator/assets/categories/glasses/SFC_glasses1.png' },
    { imgUrl: '' },
  ],
  beard: [
    { imgUrl: '/web/SquareFaceCreator/assets/categories/beard/SFC_beard1.png' },
    { imgUrl: '' },
  ],
};

const SFC_CATEGORY_DRAW_SETTINGS = {
  hair: {
    layerOrder: 1,
    widthRatio: 1,
    heightRatio: 1,
    centerXRatio: 0.5,
    centerYRatio: 0.5,
  },
  ears: {
    layerOrder: 2,
    widthRatio: 0.24,
    heightRatio: 0.32,
    placements: [
      { anchorXRatio: 1, centerYRatio: 0.5, flipX: false },
      { anchorXRatio: 0, centerYRatio: 0.5, flipX: true },
    ],
  },
  mouth: {
    layerOrder: 3,
    widthRatio: 0.5,
    heightRatio: 0.5,
    centerXRatio: 0.5,
    centerYRatio: 0.75,
  },
  eyes: {
    layerOrder: 4,
    widthRatio: 0.27,
    heightRatio: 0.27,
    placements: [
      { centerXRatio: 0.67, centerYRatio: 1 / 3, flipX: false },
      { centerXRatio: 0.33, centerYRatio: 1 / 3, flipX: true },
    ],
  },
  eyebrows: {
    layerOrder: 5,
    widthRatio: 0.25,
    heightRatio: 0.25,
    placements: [
      { centerXRatio: 0.67, centerYRatio: 0.2, flipX: false },
      { centerXRatio: 0.33, centerYRatio: 0.2, flipX: true },
    ],
  },
  nose: {
    layerOrder: 6,
    widthRatio: 0.25,
    heightRatio: 0.25,
    centerXRatio: 0.5,
    centerYRatio: 0.55,
  },
  glasses: {
    layerOrder: 7,
    widthRatio: 0.27,
    heightRatio: 0.27,
    placements: [
      { centerXRatio: 0.635, centerYRatio: 1 / 3, flipX: false },
      { centerXRatio: 0.365, centerYRatio: 1 / 3, flipX: true },
    ],
  },
  beard: {
    layerOrder: 8,
    widthRatio: 0.38,
    heightRatio: 0.38,
    placements: [
      { centerXRatio: 0.688, centerYRatio: 0.81, flipX: false },
      { centerXRatio: 0.312, centerYRatio: 0.81, flipX: true },
    ],
  },
};

const SFC_CATEGORY_NAMES = Object.keys(SFC_CATEGORY_ITEMS);
const SFC_HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const imagePromiseCache = new Map();
const recoloredCanvasCache = new Map();

function deepCloneSfcFaceData(faceData) {
  return JSON.parse(JSON.stringify(faceData));
}

function clampSfcItemIndex(categoryName, rawValue) {
  const categoryEntries = SFC_CATEGORY_ITEMS[categoryName] || [];
  const normalizedIndex = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(normalizedIndex)) {
    return DEFAULT_SFC_FACE.items[categoryName] ?? -1;
  }

  if (normalizedIndex < 0) {
    return -1;
  }

  if (normalizedIndex >= categoryEntries.length) {
    return DEFAULT_SFC_FACE.items[categoryName] ?? -1;
  }

  return normalizedIndex;
}

export function normalizeSfcFaceData(faceData, fallback = DEFAULT_SFC_FACE) {
  const fallbackFace = deepCloneSfcFaceData(fallback);

  /* Normalizing imported face data against a local fallback keeps the first
  render stable even when older saves are missing keys or contain invalid
  category values from an unfinished editor session. */
  if (!faceData || faceData.version !== SFC_SUPPORTED_VERSION) {
    return fallbackFace;
  }

  const normalizedFace = {
    version: SFC_SUPPORTED_VERSION,
    background: SFC_HEX_COLOR_PATTERN.test(faceData.background || '')
      ? faceData.background
      : fallbackFace.background,
    currentCategory: SFC_CATEGORY_NAMES.includes(faceData.currentCategory)
      ? faceData.currentCategory
      : fallbackFace.currentCategory,
    items: {},
    colors: {},
  };

  for (let i = 0; i < SFC_CATEGORY_NAMES.length; i += 1) {
    const categoryName = SFC_CATEGORY_NAMES[i];
    normalizedFace.items[categoryName] = clampSfcItemIndex(categoryName, faceData.items?.[categoryName]);
    normalizedFace.colors[categoryName] = SFC_HEX_COLOR_PATTERN.test(faceData.colors?.[categoryName] || '')
      ? faceData.colors[categoryName]
      : fallbackFace.colors?.[categoryName] || '';
  }

  return normalizedFace;
}

function createImageLoadPromise(imgUrl) {
  if (!imgUrl) {
    return Promise.resolve(null);
  }

  const cachedPromise = imagePromiseCache.get(imgUrl);
  if (cachedPromise) {
    return cachedPromise;
  }

  const imagePromise = new Promise(resolve => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => resolve(null), { once: true });
    image.src = imgUrl;
  });

  imagePromiseCache.set(imgUrl, imagePromise);
  return imagePromise;
}

function hexToRgb(hexColor) {
  const normalizedHex = hexColor.replace('#', '');
  const fullHex = normalizedHex.length === 3
    ? normalizedHex.split('').map(character => character + character).join('')
    : normalizedHex;
  const colorNumber = Number.parseInt(fullHex, 16);

  return {
    r: (colorNumber >> 16) & 255,
    g: (colorNumber >> 8) & 255,
    b: colorNumber & 255,
  };
}

function rgbToHsl(red, green, blue) {
  const normalizedRed = red / 255;
  const normalizedGreen = green / 255;
  const normalizedBlue = blue / 255;
  const maxChannel = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const minChannel = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  let hue = 0;
  let saturation = 0;
  const lightness = (maxChannel + minChannel) / 2;

  if (maxChannel !== minChannel) {
    const delta = maxChannel - minChannel;
    saturation = lightness > 0.5
      ? delta / (2 - maxChannel - minChannel)
      : delta / (maxChannel + minChannel);

    switch (maxChannel) {
      case normalizedRed:
        hue = (normalizedGreen - normalizedBlue) / delta + (normalizedGreen < normalizedBlue ? 6 : 0);
        break;
      case normalizedGreen:
        hue = (normalizedBlue - normalizedRed) / delta + 2;
        break;
      default:
        hue = (normalizedRed - normalizedGreen) / delta + 4;
        break;
    }

    hue /= 6;
  }

  return { h: hue, s: saturation, l: lightness };
}

function hslToRgb(hue, saturation, lightness) {
  if (saturation === 0) {
    const grayscale = Math.round(lightness * 255);
    return { r: grayscale, g: grayscale, b: grayscale };
  }

  const hueToRgb = (p, q, t) => {
    let wrappedT = t;

    if (wrappedT < 0) wrappedT += 1;
    if (wrappedT > 1) wrappedT -= 1;
    if (wrappedT < 1 / 6) return p + (q - p) * 6 * wrappedT;
    if (wrappedT < 1 / 2) return q;
    if (wrappedT < 2 / 3) return p + (q - p) * (2 / 3 - wrappedT) * 6;
    return p;
  };

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return {
    r: Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hue) * 255),
    b: Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
  };
}

function recolorImageWithTint(image, tintColor) {
  const cacheKey = `${image.currentSrc || image.src}::${tintColor}`;
  const cachedCanvas = recoloredCanvasCache.get(cacheKey);

  if (cachedCanvas) {
    return cachedCanvas;
  }

  const offscreenCanvas = document.createElement('canvas');
  const offscreenContext = offscreenCanvas.getContext('2d', { willReadFrequently: true });

  if (!offscreenContext) {
    return image;
  }

  offscreenCanvas.width = image.naturalWidth || image.width;
  offscreenCanvas.height = image.naturalHeight || image.height;
  offscreenContext.drawImage(image, 0, 0);

  let imageData;

  try {
    imageData = offscreenContext.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
  } catch (error) {
    return image;
  }

  const pixelData = imageData.data;
  const tintRgb = hexToRgb(tintColor);
  const tintHsl = rgbToHsl(tintRgb.r, tintRgb.g, tintRgb.b);

  for (let pixelIndex = 0; pixelIndex < pixelData.length; pixelIndex += 4) {
    const alpha = pixelData[pixelIndex + 3];

    if (alpha === 0) {
      continue;
    }

    const sourceHsl = rgbToHsl(
      pixelData[pixelIndex],
      pixelData[pixelIndex + 1],
      pixelData[pixelIndex + 2]
    );

    if (sourceHsl.s < 0.18 || sourceHsl.l < 0.08 || sourceHsl.l > 0.92) {
      continue;
    }

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
  recoloredCanvasCache.set(cacheKey, offscreenCanvas);
  return offscreenCanvas;
}

function drawFacePart(context, canvasSize, categoryName, image) {
  const currentSettings = SFC_CATEGORY_DRAW_SETTINGS[categoryName] || SFC_CATEGORY_DRAW_SETTINGS.eyes;
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const maxDrawWidth = canvasSize * currentSettings.widthRatio;
  const maxDrawHeight = canvasSize * currentSettings.heightRatio;
  const imageRatio = sourceWidth / sourceHeight;
  let drawWidth = maxDrawWidth;
  let drawHeight = drawWidth / imageRatio;

  if (drawHeight > maxDrawHeight) {
    drawHeight = maxDrawHeight;
    drawWidth = drawHeight * imageRatio;
  }

  drawWidth = Math.max(1, Math.round(drawWidth));
  drawHeight = Math.max(1, Math.round(drawHeight));

  if (Array.isArray(currentSettings.placements) && currentSettings.placements.length > 0) {
    for (let i = 0; i < currentSettings.placements.length; i += 1) {
      const placement = currentSettings.placements[i];
      const drawX = typeof placement.centerXRatio === 'number'
        ? canvasSize * placement.centerXRatio - drawWidth / 2
        : canvasSize * placement.anchorXRatio - (placement.flipX ? 0 : drawWidth);
      const drawY = canvasSize * placement.centerYRatio - drawHeight / 2;
      const finalDrawX = Math.round(drawX);
      const finalDrawY = Math.round(drawY);

      if (placement.flipX) {
        context.save();
        context.translate(finalDrawX + drawWidth, 0);
        context.scale(-1, 1);
        context.drawImage(image, 0, finalDrawY, drawWidth, drawHeight);
        context.restore();
        continue;
      }

      context.drawImage(image, finalDrawX, finalDrawY, drawWidth, drawHeight);
    }
    return;
  }

  const drawX = canvasSize * currentSettings.centerXRatio - drawWidth / 2;
  const drawY = canvasSize * currentSettings.centerYRatio - drawHeight / 2;
  context.drawImage(image, Math.round(drawX), Math.round(drawY), drawWidth, drawHeight);
}

export async function drawSfcFaceToContext(context, canvasSize, rawFaceData) {
  const faceData = normalizeSfcFaceData(rawFaceData);

  /* The face texture is redrawn from the normalized SFC payload every time so
  both the live player model and the character preview can share one rendering
  path without depending on the original Square Face Creator page DOM. */
  context.clearRect(0, 0, canvasSize, canvasSize);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = faceData.background;
  context.fillRect(0, 0, canvasSize, canvasSize);

  const sortedCategoryNames = Object.keys(SFC_CATEGORY_DRAW_SETTINGS).sort((leftCategory, rightCategory) => {
    const leftOrder = SFC_CATEGORY_DRAW_SETTINGS[leftCategory]?.layerOrder ?? 0;
    const rightOrder = SFC_CATEGORY_DRAW_SETTINGS[rightCategory]?.layerOrder ?? 0;
    return leftOrder - rightOrder;
  });

  const imagesToDraw = await Promise.all(sortedCategoryNames.map(async categoryName => {
    const itemIndex = faceData.items?.[categoryName];
    if (!Number.isInteger(itemIndex) || itemIndex < 0) {
      return null;
    }

    const imgUrl = SFC_CATEGORY_ITEMS[categoryName]?.[itemIndex]?.imgUrl || '';
    if (!imgUrl) {
      return null;
    }

    const image = await createImageLoadPromise(imgUrl);
    if (!image) {
      return null;
    }

    return { categoryName, image };
  }));

  for (let i = 0; i < imagesToDraw.length; i += 1) {
    const imageData = imagesToDraw[i];
    if (!imageData) {
      continue;
    }

    const tintColor = faceData.colors?.[imageData.categoryName];
    const imageToDraw = SFC_HEX_COLOR_PATTERN.test(tintColor || '')
      ? recolorImageWithTint(imageData.image, tintColor)
      : imageData.image;

    drawFacePart(context, canvasSize, imageData.categoryName, imageToDraw);
  }
}
