function mixColorChannel(channel, target, amount) {
  return Math.round(channel + (target - channel) * amount);
}

function tintHexColor(hexColor, amount) {
  const cleanHex = hexColor.replace('#', '');
  const parsed = Number.parseInt(cleanHex, 16);
  if (!Number.isFinite(parsed)) return hexColor;

  const r = (parsed >> 16) & 0xff;
  const g = (parsed >> 8) & 0xff;
  const b = parsed & 0xff;
  const tinted = (
    (mixColorChannel(r, 255, amount) << 16)
    | (mixColorChannel(g, 255, amount) << 8)
    | mixColorChannel(b, 255, amount)
  );

  return '#' + tinted.toString(16).padStart(6, '0');
}

function normalizeHexColor(color = '#ffffff') {
  if (typeof color === 'number' && Number.isFinite(color)) {
    return '#' + Math.max(0, color).toString(16).padStart(6, '0').slice(-6);
  }

  if (typeof color === 'string' && color.trim()) {
    const normalizedColor = color.trim();
    if (normalizedColor.startsWith('#')) return normalizedColor;

    const parsed = Number.parseInt(normalizedColor, 16);
    if (Number.isFinite(parsed)) {
      return '#' + parsed.toString(16).padStart(6, '0').slice(-6);
    }
  }

  return '#ffffff';
}

function normalizeVoxelIconSpec(voxel = null) {
  if (typeof voxel === 'string') {
    return {
      type: 'colored',
      color: normalizeHexColor(voxel),
      texture: '',
      textureFaces: null,
      textureInfluence: 1,
    };
  }

  return {
    name: typeof voxel?.name === 'string' ? voxel.name : '',
    type: typeof voxel?.type === 'string' && voxel.type.trim() ? voxel.type.trim().toLowerCase() : 'colored',
    color: normalizeHexColor(voxel?.color),
    texture: normalizeVoxelIconTexture(voxel?.texture),
    textureLayer: getLayeredVoxelIconTextureSpec(voxel?.texture),
    textureFaces: resolveVoxelIconTextureFaces(voxel?.texture),
    textureInfluence: normalizeVoxelIconTextureInfluence(voxel?.textureInfluence),
  };
}

function getLayeredVoxelIconTextureSpec(texture = null) {
  if (!texture || typeof texture !== 'object' || Array.isArray(texture)) {
    return null;
  }

  const baseTexture = typeof texture.base === 'string' && texture.base.trim()
    ? texture.base.trim()
    : typeof texture.background === 'string' && texture.background.trim()
      ? texture.background.trim()
      : typeof texture.all === 'string' && texture.all.trim()
        ? texture.all.trim()
        : '';
  const maskTexture = typeof texture.mask === 'string' && texture.mask.trim()
    ? texture.mask.trim()
    : typeof texture.detail === 'string' && texture.detail.trim()
      ? texture.detail.trim()
      : '';

  return baseTexture && maskTexture
    ? { base: baseTexture, mask: maskTexture }
    : null;
}

function normalizeVoxelIconTextureInfluence(textureInfluence = 1) {
  const numericInfluence = Number(textureInfluence);
  if (!Number.isFinite(numericInfluence)) {
    return 1;
  }

  return Math.min(1, Math.max(0, numericInfluence));
}

function createSvgPolygon(svgNs, points, fill) {
  const polygon = document.createElementNS(svgNs, 'polygon');
  polygon.setAttribute('points', points);
  polygon.setAttribute('fill', fill);
  return polygon;
}

function createInsetFacePoints(points, insetAmount = 0.18) {
  const parsedPoints = points.split(' ').map(function (point) {
    const [x, y] = point.split(',').map(Number);
    return { x, y };
  });

  const center = parsedPoints.reduce(function (accumulator, point) {
    return {
      x: accumulator.x + point.x / parsedPoints.length,
      y: accumulator.y + point.y / parsedPoints.length,
    };
  }, { x: 0, y: 0 });

  return parsedPoints.map(function (point) {
    const nextX = point.x + (center.x - point.x) * insetAmount;
    const nextY = point.y + (center.y - point.y) * insetAmount;
    return `${nextX},${nextY}`;
  }).join(' ');
}

function appendVoxelFace(svg, svgNs, {
  points,
  fill,
  borderFill = '',
  insetAmount = 0.16,
} = {}) {
  svg.appendChild(createSvgPolygon(svgNs, points, borderFill || fill));

  if (!borderFill) return;
  svg.appendChild(createSvgPolygon(svgNs, createInsetFacePoints(points, insetAmount), fill));
}

let voxelIconTextureIdCounter = 0;

function appendVoxelTextureFace(svg, svgNs, defs, {
  points,
  textureHref = '',
  fallbackFill = '#ffffff',
  borderFill = '',
  insetAmount = 0.16,
  imageTransform = '',
} = {}) {
  const normalizedTextureHref = typeof textureHref === 'string' ? textureHref.trim() : '';
  if (!normalizedTextureHref) {
    appendVoxelFace(svg, svgNs, {
      points,
      fill: fallbackFill,
      borderFill,
      insetAmount,
    });
    return;
  }

  const clipPathId = `voxel-icon-texture-clip-${voxelIconTextureIdCounter}`;
  voxelIconTextureIdCounter += 1;
  const insetPoints = createInsetFacePoints(points, borderFill ? insetAmount : 0);

  svg.appendChild(createSvgPolygon(svgNs, points, borderFill || fallbackFill));

  const clipPath = document.createElementNS(svgNs, 'clipPath');
  clipPath.setAttribute('id', clipPathId);
  clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
  clipPath.appendChild(createSvgPolygon(svgNs, insetPoints, fallbackFill));
  defs.appendChild(clipPath);

  const image = document.createElementNS(svgNs, 'image');
  image.setAttribute('href', normalizedTextureHref);
  image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', normalizedTextureHref);
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', '1');
  image.setAttribute('height', '1');
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('image-rendering', 'pixelated');
  if (imageTransform) {
    image.setAttribute('transform', imageTransform);
  }
  image.setAttribute('clip-path', `url(#${clipPathId})`);
  svg.appendChild(image);
}

function createFaceImageTransform({
  originX,
  originY,
  xAxisX,
  xAxisY,
  yAxisX,
  yAxisY,
} = {}) {
  return `matrix(${xAxisX} ${xAxisY} ${yAxisX} ${yAxisY} ${originX} ${originY})`;
}

function createBaseVoxelFaceVisuals(voxel = null) {
  return {
    top: {
      fill: tintHexColor(voxel?.color ?? '#ffffff', 0.22),
      borderFill: '',
    },
    left: {
      fill: tintHexColor(voxel?.color ?? '#ffffff', 0.06),
      borderFill: '',
    },
    right: {
      fill: voxel?.color ?? '#ffffff',
      borderFill: '',
    },
    showEdges: false,
  };
}

const voxelTextureFacePainters = {
  bordered(voxel) {
    const baseFaces = createBaseVoxelFaceVisuals(voxel);
    return {
      top: {
        ...baseFaces.top,
        borderFill: tintHexColor(voxel.color, 0.05),
      },
      left: {
        ...baseFaces.left,
        borderFill: tintHexColor(voxel.color, -0.1),
      },
      right: {
        ...baseFaces.right,
        borderFill: tintHexColor(voxel.color, -0.18),
      },
      showEdges: true,
    };
  },
};

const voxelTypeFacePainters = {
  colored: createBaseVoxelFaceVisuals,
  textured(voxel) {
    const texturePainter = voxelTextureFacePainters[voxel?.texture];
    return typeof texturePainter === 'function'
      ? texturePainter(voxel)
      : createBaseVoxelFaceVisuals(voxel);
  },
  microxeled: createBaseVoxelFaceVisuals,
};

function resolveVoxelFaceVisuals(voxel = null) {
  const typePainter = voxelTypeFacePainters[voxel?.type] ?? voxelTypeFacePainters.colored;

  /* Icons keep one cube structure. The selected type/texture painter only
  resolves how each face should look. */
  return typePainter(voxel);
}

export function createIcon(className = 'icon-chip') {
  const icon = document.createElement('span');
  icon.className = className;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

export function createSquareIcon(color = '#4a90ff') {
  const icon = createIcon('icon-chip item-slot-icon');
  const fill = document.createElement('span');
  fill.className = 'icon-chip__square';
  fill.style.background = color;
  icon.appendChild(fill);
  return icon;
}

export function createCircleIcon(color = '#d4af37', borderColor = '#ffe08a') {
  const icon = createIcon('icon-chip item-slot-icon');
  const fill = document.createElement('span');
  fill.className = 'icon-chip__square';

  // Reusing the existing square icon element and overriding it inline keeps the coin
  // icon compact while rendering as a simple golden circular token in the UI.
  fill.style.background = 'radial-gradient(circle at 30% 30%, ' + borderColor + ' 0%, ' + color + ' 58%, #9a7412 100%)';
  fill.style.borderRadius = '50%';
  fill.style.boxShadow = 'inset 0 0 0 2px rgba(255, 232, 138, 0.75)';
  icon.appendChild(fill);
  return icon;
}

export function createCoinSymbolIcon({
  color = '#d4af37',
  borderColor = '#ffe08a',
  symbolSrc = 'assets/icons/KoloraMonero.png',
  symbolAlt = 'Coin',
  symbolOpacity = 0.75,
} = {}) {
  const icon = createCircleIcon(color, borderColor);
  const symbol = document.createElement('img');

  /* The coin keeps the original circular token silhouette in the UI while a
  separate centered symbol image adds the KoloraMonero mark as a semi-transparent
  print above the gold base instead of replacing the whole icon artwork. */
  symbol.className = 'coin-symbol-icon__img';
  symbol.src = symbolSrc;
  symbol.alt = symbolAlt;
  symbol.decoding = 'async';
  symbol.style.opacity = String(symbolOpacity);
  symbol.style.pointerEvents = 'none';

  icon.appendChild(symbol);
  return icon;
}

export function createImageIcon(src, alt = '') {
  const icon = createIcon('icon-chip item-slot-icon image-icon');
  const image = document.createElement('img');
  image.className = 'image-icon__img';
  image.src = src;
  image.alt = alt;
  image.decoding = 'async';
  icon.appendChild(image);
  return icon;
}

export function createVoxelTextureIcon(src, alt = '') {
  const icon = createIcon('icon-chip item-slot-icon image-icon voxel-texture-icon');
  const image = document.createElement('img');
  image.className = 'image-icon__img voxel-texture-icon__img';
  image.src = src;
  image.alt = alt;
  image.decoding = 'async';
  icon.appendChild(image);
  return icon;
}

export function createIsometricVoxelTextureIcon(voxel = null) {
  const icon = createIcon('icon-chip item-slot-icon voxel-icon voxel-texture-cube-icon');
  const canvas = document.createElement('canvas');
  const textureLayer = voxel?.textureLayer ?? null;
  const textureFaces = voxel?.textureFaces ?? null;
  const faceTextureSources = {
    top: textureLayer?.base || textureFaces?.top || '',
    left: textureLayer?.base || textureFaces?.left || textureFaces?.front || textureFaces?.right || '',
    right: textureLayer?.base || textureFaces?.right || textureFaces?.front || textureFaces?.left || '',
    mask: textureLayer?.mask || '',
  };
  const textureImages = {
    top: new Image(),
    left: new Image(),
    right: new Image(),
    mask: new Image(),
  };
  let pendingTextures = 0;

  canvas.className = 'voxel-icon__svg voxel-texture-cube-icon__canvas';
  canvas.width = 64;
  canvas.height = 64;
  canvas.setAttribute('aria-label', voxel?.name || '');
  icon.appendChild(canvas);

  function draw() {
    drawTexturedVoxelCubeIcon(canvas, textureImages, voxel);
  }

  const faceNames = Object.keys(faceTextureSources);
  for (let i = 0; i < faceNames.length; i += 1) {
    const faceName = faceNames[i];
    const faceSource = faceTextureSources[faceName];
    const faceImage = textureImages[faceName];

    if (!faceSource) continue;

    pendingTextures += 1;
    faceImage.decoding = 'async';
    faceImage.addEventListener('load', function () {
      pendingTextures -= 1;
      if (pendingTextures === 0) {
        draw();
      }
    }, { once: true });
    faceImage.src = faceSource;

    if (faceImage.complete) {
      pendingTextures -= 1;
    }
  }

  if (pendingTextures === 0) {
    draw();
  }

  return icon;
}

export function createVoxelIcon(hexColor) {
  const voxel = normalizeVoxelIconSpec(hexColor);
  const previewTextureHref = resolveVoxelIconPreviewTexture(voxel);
  if (previewTextureHref) {
    return createIsometricVoxelTextureIcon(voxel);
  }
  const icon = createIcon('icon-chip item-slot-icon voxel-icon');
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  const defs = document.createElementNS(svgNs, 'defs');
  const edge = document.createElementNS(svgNs, 'path');
  const topPoints = '32,6 56,18 32,30 8,18';
  const leftPoints = '8,18 32,30 32,56 8,44';
  const rightPoints = '56,18 32,30 32,56 56,44';
  const topTextureTransform = createFaceImageTransform({
    originX: 8,
    originY: 18,
    xAxisX: 24,
    xAxisY: -12,
    yAxisX: 24,
    yAxisY: 12,
  });
  const leftTextureTransform = createFaceImageTransform({
    originX: 8,
    originY: 18,
    xAxisX: 24,
    xAxisY: 12,
    yAxisX: 0,
    yAxisY: 26,
  });
  const rightTextureTransform = createFaceImageTransform({
    originX: 32,
    originY: 30,
    xAxisX: 24,
    xAxisY: -12,
    yAxisX: 0,
    yAxisY: 26,
  });
  const faceVisuals = resolveVoxelFaceVisuals(voxel);

  svg.classList.add('voxel-icon__svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.appendChild(defs);
  edge.setAttribute('d', 'M32 6L56 18L32 30L8 18ZM32 30V56M8 18V44L32 56L56 44V18');
  edge.setAttribute('fill', 'none');
  edge.setAttribute('stroke-linejoin', 'round');

  appendVoxelFace(svg, svgNs, {
    points: topPoints,
    fill: faceVisuals.top.fill,
    borderFill: faceVisuals.top.borderFill,
  });
  appendVoxelFace(svg, svgNs, {
    points: leftPoints,
    fill: faceVisuals.left.fill,
    borderFill: faceVisuals.left.borderFill,
  });
  appendVoxelFace(svg, svgNs, {
    points: rightPoints,
    fill: faceVisuals.right.fill,
    borderFill: faceVisuals.right.borderFill,
  });

  if (faceVisuals.showEdges) {
    edge.setAttribute('stroke', 'rgba(15,23,42,0.18)');
    edge.setAttribute('stroke-width', '1.5');
    svg.appendChild(edge);
  }
  icon.appendChild(svg);
  return icon;
}

function drawTexturedVoxelCubeIcon(canvas, textureImages, voxel = null) {
  const context = canvas.getContext('2d');
  if (!context || !textureImages) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;

  const topFace = [
    { x: 32, y: 6 },
    { x: 56, y: 18 },
    { x: 32, y: 30 },
    { x: 8, y: 18 },
  ];
  const leftFace = [
    { x: 8, y: 18 },
    { x: 32, y: 30 },
    { x: 32, y: 56 },
    { x: 8, y: 44 },
  ];
  const rightFace = [
    { x: 32, y: 30 },
    { x: 56, y: 18 },
    { x: 56, y: 44 },
    { x: 32, y: 56 },
  ];

  const drawFace = voxel?.textureLayer
    ? drawLayeredTextureOnFace
    : drawTextureOnFace;
  const maskImage = voxel?.textureLayer ? textureImages.mask : null;

  drawFace(context, textureImages.top, topFace, {
    maskImage,
    textureInfluence: voxel?.textureInfluence,
    tint: tintHexColor(voxel?.color ?? '#ffffff', 0.22),
    shade: 'rgba(255, 255, 255, 0.08)',
  });
  drawFace(context, textureImages.left, leftFace, {
    maskImage,
    textureInfluence: voxel?.textureInfluence,
    tint: tintHexColor(voxel?.color ?? '#ffffff', 0.06),
    shade: 'rgba(0, 0, 0, 0.1)',
  });
  drawFace(context, textureImages.right, rightFace, {
    maskImage,
    textureInfluence: voxel?.textureInfluence,
    tint: voxel?.color ?? '#ffffff',
    shade: 'rgba(0, 0, 0, 0.03)',
  });

  context.save();
  context.strokeStyle = 'rgba(15, 23, 42, 0.18)';
  context.lineWidth = 1.5;
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(32, 6);
  context.lineTo(56, 18);
  context.lineTo(32, 30);
  context.lineTo(8, 18);
  context.closePath();
  context.moveTo(32, 30);
  context.lineTo(32, 56);
  context.moveTo(8, 18);
  context.lineTo(8, 44);
  context.lineTo(32, 56);
  context.lineTo(56, 44);
  context.lineTo(56, 18);
  context.stroke();
  context.restore();
}

function drawLayeredTextureOnFace(context, image, points, {
  maskImage = null,
  textureInfluence = 1,
  tint = '',
  shade = '',
} = {}) {
  drawTextureOnFace(context, image, points, { textureInfluence: 1, tint: '', shade: '' });

  if (maskImage) {
    const maskCanvas = document.createElement('canvas');
    const maskContext = maskCanvas.getContext('2d');
    maskCanvas.width = context.canvas.width;
    maskCanvas.height = context.canvas.height;
    drawTextureOnFace(maskContext, maskImage, points, { textureInfluence, tint: '', shade: '' });
    tintMaskCanvas(maskCanvas, tint, textureInfluence);
    context.drawImage(maskCanvas, 0, 0);
  }

  if (!shade) return;
  context.save();
  context.fillStyle = shade;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i].x, points[i].y);
  }
  context.closePath();
  context.fill();
  context.restore();
}

function drawTextureOnFace(context, image, points, { textureInfluence = 1, tint = '', shade = '' } = {}) {
  if (!context || !image || !Array.isArray(points) || points.length !== 4) return;

  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const origin = points[0];
  const xAxis = {
    x: points[1].x - points[0].x,
    y: points[1].y - points[0].y,
  };
  const yAxis = {
    x: points[3].x - points[0].x,
    y: points[3].y - points[0].y,
  };

  context.save();
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i].x, points[i].y);
  }
  context.closePath();
  context.clip();

  context.setTransform(
    xAxis.x / sourceWidth,
    xAxis.y / sourceWidth,
    yAxis.x / sourceHeight,
    yAxis.y / sourceHeight,
    origin.x,
    origin.y
  );
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  context.restore();

  const normalizedTextureInfluence = normalizeVoxelIconTextureInfluence(textureInfluence);
  if (normalizedTextureInfluence < 0.999) {
    context.save();
    context.globalAlpha = 1 - normalizedTextureInfluence;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      context.lineTo(points[i].x, points[i].y);
    }
    context.closePath();
    context.fill();
    context.restore();
  }

  if (tint) {
    context.save();
    context.fillStyle = tint;
    context.globalCompositeOperation = 'multiply';
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      context.lineTo(points[i].x, points[i].y);
    }
    context.closePath();
    context.fill();
    context.restore();
  }

  if (!shade) return;

  context.save();
  context.fillStyle = shade;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i].x, points[i].y);
  }
  context.closePath();
  context.fill();
  context.restore();
}

function tintMaskCanvas(canvas, tint = '#ffffff', textureInfluence = 1) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const tintRgb = parseHexRgb(tint);
  const normalizedTextureInfluence = normalizeVoxelIconTextureInfluence(textureInfluence);

  for (let i = 0; i < data.length; i += 4) {
    const maskStrength = (data[i + 3] / 255) * Math.max(data[i], data[i + 1], data[i + 2]) / 255;
    data[i] = tintRgb.r * (1 - normalizedTextureInfluence) + (tintRgb.r * data[i] / 255) * normalizedTextureInfluence;
    data[i + 1] = tintRgb.g * (1 - normalizedTextureInfluence) + (tintRgb.g * data[i + 1] / 255) * normalizedTextureInfluence;
    data[i + 2] = tintRgb.b * (1 - normalizedTextureInfluence) + (tintRgb.b * data[i + 2] / 255) * normalizedTextureInfluence;
    data[i + 3] = Math.round(maskStrength * 255);
  }

  context.putImageData(imageData, 0, 0);
}

function parseHexRgb(hexColor = '#ffffff') {
  const normalizedHex = normalizeHexColor(hexColor).replace('#', '');
  const parsed = Number.parseInt(normalizedHex, 16);
  return {
    r: (parsed >> 16) & 0xff,
    g: (parsed >> 8) & 0xff,
    b: parsed & 0xff,
  };
}

function resolveVoxelIconPreviewTexture(voxel = null) {
  if (voxel?.type !== 'textured') return '';

  if (voxel.textureLayer?.base) {
    return voxel.textureLayer.base;
  }

  return voxel.texture && voxel.texture !== 'bordered'
    ? voxel.texture
    : '';
}

function normalizeVoxelIconTexture(texture) {
  if (typeof texture === 'string') {
    return texture.trim();
  }

  if (!texture || typeof texture !== 'object' || Array.isArray(texture)) {
    return '';
  }

  const normalizedTexture = {};
  const supportedFaces = ['all', 'top', 'bottom', 'sides', 'left', 'right', 'front', 'back', 'base', 'background', 'mask', 'detail'];

  for (let i = 0; i < supportedFaces.length; i += 1) {
    const faceKey = supportedFaces[i];
    const faceTexture = typeof texture[faceKey] === 'string' ? texture[faceKey].trim() : '';
    if (faceTexture) {
      normalizedTexture[faceKey] = faceTexture;
    }
  }

  return (
    normalizedTexture.front
    || normalizedTexture.right
    || normalizedTexture.left
    || normalizedTexture.top
    || normalizedTexture.bottom
    || normalizedTexture.back
    || normalizedTexture.all
    || normalizedTexture.sides
    || ''
  );
}

function resolveVoxelIconTextureFaces(texture) {
  const normalizedTexture = normalizeVoxelTexture(texture);

  if (typeof normalizedTexture === 'string') {
    if (!normalizedTexture) return null;
    return {
      top: normalizedTexture,
      bottom: normalizedTexture,
      left: normalizedTexture,
      right: normalizedTexture,
      front: normalizedTexture,
      back: normalizedTexture,
    };
  }

  if (!normalizedTexture || typeof normalizedTexture !== 'object') {
    return null;
  }

  const allTexture = normalizedTexture.all ?? '';
  const sideTexture = normalizedTexture.sides ?? allTexture;

  return {
    top: normalizedTexture.top ?? allTexture ?? '',
    bottom: normalizedTexture.bottom ?? allTexture ?? '',
    left: normalizedTexture.left ?? sideTexture ?? '',
    right: normalizedTexture.right ?? sideTexture ?? '',
    front: normalizedTexture.front ?? sideTexture ?? '',
    back: normalizedTexture.back ?? sideTexture ?? '',
  };
}

function normalizeVoxelTexture(texture) {
  if (typeof texture === 'string') {
    return texture.trim();
  }

  if (!texture || typeof texture !== 'object' || Array.isArray(texture)) {
    return '';
  }

  const normalizedTexture = {};
  const supportedFaces = ['all', 'top', 'bottom', 'sides', 'left', 'right', 'front', 'back', 'base', 'background', 'mask', 'detail'];

  for (let i = 0; i < supportedFaces.length; i += 1) {
    const faceKey = supportedFaces[i];
    const faceTexture = typeof texture[faceKey] === 'string' ? texture[faceKey].trim() : '';
    if (faceTexture) {
      normalizedTexture[faceKey] = faceTexture;
    }
  }

  return Object.keys(normalizedTexture).length > 0 ? normalizedTexture : '';
}
