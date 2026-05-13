/**
 * Isometricon.js
 * Tiny 2D API for square hexagonal isometric voxel/boxel icons.
 *
 * KL3 call shape:
 *   import { Isometricon } from './Isometricon.js';
 *   Isometricon.draw(canvas, { type: 'boxel', voxels: [{ x:0, y:0, z:0, color:'#44aa66' }] });
 *
 * Data contract:
 *   Voxel icon  = { type:'voxel', color:'#ffaa00' }
 *   Micro voxel = { type:'voxel', microxels:[{x,y,z,color}] }
 *   Boxel icon  = { type:'boxel', voxels:[{x,y,z,color}] }
 */

const DEFAULTS = Object.freeze({
  size: 128,
  pixelRatio: 1,
  padding: 14,
  tileWidth: 32,
  tileHeight: 16,
  cubeHeight: 24,
  background: 'transparent',
  hexFill: 'rgba(255,255,255,0.04)',
  hexStroke: 'rgba(20,20,30,0.85)',
  cubeStroke: 'rgba(12,12,18,0.55)',
  debugCubeStroke: true,
  debugHexStroke: true,
  maxScale: 4,
  minScale: 0.1,
  cache: true,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeHexColor(color, fallback = '#8cc8ff') {
  if (typeof color !== 'string') return fallback;
  const clean = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean;
  if (/^#[0-9a-f]{3}$/i.test(clean)) {
    return '#' + clean.slice(1).split('').map(ch => ch + ch).join('');
  }
  return fallback;
}

function hexToRgb(hex) {
  const clean = normalizeHexColor(hex).slice(1);
  const value = Number.parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(channel => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('');
}

function tint(color, target, amount) {
  const source = hexToRgb(color);
  const dest = target === 'black' ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  return rgbToHex({
    r: source.r + (dest.r - source.r) * amount,
    g: source.g + (dest.g - source.g) * amount,
    b: source.b + (dest.b - source.b) * amount,
  });
}

function normalizePoint(entry, fallbackColor = '#8cc8ff') {
  const pos = entry?.position || entry || {};
  return {
    x: Math.round(Number(pos.x) || 0),
    y: Math.round(Number(pos.y) || 0),
    z: Math.round(Number(pos.z) || 0),
    color: normalizeHexColor(entry?.color || entry?.voxel?.color || fallbackColor, fallbackColor),
  };
}

function normalizeSpec(spec = {}) {
  if (Array.isArray(spec)) {
    return { type: 'boxel', voxels: spec.map(entry => normalizePoint(entry)) };
  }

  const type = spec.type || (spec.voxels ? 'boxel' : 'voxel');

  if (type === 'boxel') {
    return {
      type,
      voxels: (spec.voxels || spec.cells || spec.entries || [])
        .map(entry => normalizePoint(entry, spec.color || '#8cc8ff')),
    };
  }

  if (type === 'voxel' && Array.isArray(spec.microxels) && spec.microxels.length > 0) {
    return {
      type,
      voxels: spec.microxels.map(entry => normalizePoint(entry, spec.color || '#8cc8ff')),
    };
  }

  return {
    type: 'voxel',
    voxels: [{ x: 0, y: 0, z: 0, color: normalizeHexColor(spec.color || '#8cc8ff') }],
  };
}

function depthSort(a, b) {
  const da = a.x + a.z + a.y * 2;
  const db = b.x + b.z + b.y * 2;
  if (da !== db) return da - db;
  if (a.y !== b.y) return a.y - b.y;
  if (a.z !== b.z) return a.z - b.z;
  return a.x - b.x;
}

function project(point, options) {
  return {
    x: (point.x - point.z) * options.tileWidth * 0.5,
    y: (point.x + point.z) * options.tileHeight * 0.5 - point.y * options.cubeHeight,
  };
}

function cubePolygons(voxel, options) {
  const origin = project(voxel, options);
  const top = [
    { x: origin.x, y: origin.y - options.tileHeight * 0.5 },
    { x: origin.x + options.tileWidth * 0.5, y: origin.y },
    { x: origin.x, y: origin.y + options.tileHeight * 0.5 },
    { x: origin.x - options.tileWidth * 0.5, y: origin.y },
  ];

  return {
    top,
    left: [
      top[3],
      top[2],
      { x: origin.x, y: origin.y + options.cubeHeight + options.tileHeight * 0.5 },
      { x: origin.x - options.tileWidth * 0.5, y: origin.y + options.cubeHeight },
    ],
    right: [
      top[1],
      { x: origin.x + options.tileWidth * 0.5, y: origin.y + options.cubeHeight },
      { x: origin.x, y: origin.y + options.cubeHeight + options.tileHeight * 0.5 },
      top[2],
    ],
  };
}

function measure(voxels, options) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const voxel of voxels) {
    const polygons = cubePolygons(voxel, options);
    for (const face of [polygons.top, polygons.left, polygons.right]) {
      for (const point of face) {
        bounds.minX = Math.min(bounds.minX, point.x);
        bounds.minY = Math.min(bounds.minY, point.y);
        bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.maxY = Math.max(bounds.maxY, point.y);
      }
    }
  }
  if (!Number.isFinite(bounds.minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return bounds;
}

function drawPolygon(ctx, points, fillStyle, strokeStyle, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0].x), Math.round(points[0].y));
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(Math.round(points[i].x), Math.round(points[i].y));
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle && lineWidth > 0) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'miter';
    ctx.stroke();
  }
}

function hexPath(ctx, size, inset = 4) {
  const cx = size * 0.5;
  const cy = size * 0.5;
  const radius = size * 0.5 - inset;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 6 + i * Math.PI / 3;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

export class Isometricon {
  static cache = new Map();

  static normalize(spec) {
    return normalizeSpec(spec);
  }

  static clearCache() {
    this.cache.clear();
  }

  static renderToCanvas(canvas, spec, userOptions = {}) {
    const options = { ...DEFAULTS, ...userOptions };
    const normalized = normalizeSpec(spec);
    const voxels = normalized.voxels.slice().sort(depthSort);
    const drawSize = Math.max(16, Math.round(options.size * options.pixelRatio));
    const visualSize = options.size;

    canvas.width = drawSize;
    canvas.height = drawSize;
    canvas.style.width = `${visualSize}px`;
    canvas.style.height = `${visualSize}px`;

    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, visualSize, visualSize);

    if (options.background !== 'transparent') {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, visualSize, visualSize);
    }

    hexPath(ctx, visualSize, 4);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = options.hexFill;
    ctx.fillRect(0, 0, visualSize, visualSize);

    if (voxels.length > 0) {
      const bounds = measure(voxels, options);
      const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
      const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
      const available = visualSize - options.padding * 2;
      const scale = clamp(available / Math.max(contentWidth, contentHeight), options.minScale, options.maxScale);

      ctx.save();
      ctx.translate(
        visualSize * 0.5 - (bounds.minX + contentWidth * 0.5) * scale,
        visualSize * 0.5 - (bounds.minY + contentHeight * 0.5) * scale
      );
      ctx.scale(scale, scale);

      for (const voxel of voxels) {
        const faces = cubePolygons(voxel, options);
        const stroke = options.debugCubeStroke ? options.cubeStroke : null;
        const strokeWidth = options.debugCubeStroke ? 1 / scale : 0;
        drawPolygon(ctx, faces.left, tint(voxel.color, 'black', 0.12), stroke, strokeWidth);
        drawPolygon(ctx, faces.right, tint(voxel.color, 'black', 0.02), stroke, strokeWidth);
        drawPolygon(ctx, faces.top, tint(voxel.color, 'white', 0.24), stroke, strokeWidth);
      }

      ctx.restore();
    }

    ctx.restore();

    if (options.debugHexStroke) {
      hexPath(ctx, visualSize, 4);
      ctx.strokeStyle = options.hexStroke;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'miter';
      ctx.stroke();
    }

    return canvas;
  }

  static draw(target, spec, options = {}) {
    const canvas = target instanceof HTMLCanvasElement ? target : target?.querySelector?.('canvas') || makeCanvas(options.size || DEFAULTS.size);
    const rendered = this.renderToCanvas(canvas, spec, options);
    if (target && target !== rendered && target.appendChild) target.appendChild(rendered);
    return rendered;
  }

  static toCanvas(spec, options = {}) {
    const canvas = makeCanvas(options.size || DEFAULTS.size);
    return this.renderToCanvas(canvas, spec, options);
  }

  static toDataURL(spec, options = {}) {
    const merged = { ...DEFAULTS, ...options };
    const key = merged.cache ? stableStringify({ spec: normalizeSpec(spec), options: merged }) : null;
    if (key && this.cache.has(key)) return this.cache.get(key);
    const dataURL = this.toCanvas(spec, merged).toDataURL('image/png');
    if (key) this.cache.set(key, dataURL);
    return dataURL;
  }

  static toImage(spec, options = {}) {
    const image = new Image();
    image.width = options.size || DEFAULTS.size;
    image.height = options.size || DEFAULTS.size;
    image.src = this.toDataURL(spec, options);
    return image;
  }
}

export default Isometricon;
