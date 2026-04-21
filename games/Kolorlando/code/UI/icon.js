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
    };
  }

  return {
    type: typeof voxel?.type === 'string' && voxel.type.trim() ? voxel.type.trim().toLowerCase() : 'colored',
    color: normalizeHexColor(voxel?.color),
    texture: typeof voxel?.texture === 'string' && voxel.texture.trim() ? voxel.texture.trim().toLowerCase() : '',
  };
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

export function createVoxelIcon(hexColor) {
  const icon = createIcon('icon-chip item-slot-icon voxel-icon');
  const voxel = normalizeVoxelIconSpec(hexColor);
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  const edge = document.createElementNS(svgNs, 'path');
  const topPoints = '32,6 56,18 32,30 8,18';
  const leftPoints = '8,18 32,30 32,56 8,44';
  const rightPoints = '56,18 32,30 32,56 56,44';
  const faceVisuals = resolveVoxelFaceVisuals(voxel);

  svg.classList.add('voxel-icon__svg');
  svg.setAttribute('viewBox', '0 0 64 64');
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
