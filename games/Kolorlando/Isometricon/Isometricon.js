/**
 * Isometricon.js
 * Tiny 2D API for square hexagonal orthographic isometric voxel/boxel icons.
 *
 * KL3:
 *   import { Isometricon } from './Isometricon.js';
 *   Isometricon.draw(canvas, { type:'boxel', voxels:[{x:0,y:0,z:0,color:'#44aa66'}] });
 */

const DEFAULTS = Object.freeze({
  size: 128,
  pixelRatio: 1,
  tileHalfWidth: 8,
  tileHalfHeight: 4,
  cubeHeight: 8,
  padding: 10,
  background: 'transparent',
  hexInset: 8,
  hexFill: 'rgba(255,255,255,0.04)',
  hexStroke: 'rgba(20,20,30,0.92)',
  cubeStroke: 'rgba(10,10,16,0.72)',
  debugCubeStroke: true,
  debugHexStroke: true,
  pixelPerfect: true,
  pixelLineWidth: 1,
  maxScale: 8,
  minScale: 1,
  cache: true,
});

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function isPlainObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }

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
  if (/^#[0-9a-f]{3}$/i.test(clean)) return '#' + clean.slice(1).split('').map(ch => ch + ch).join('');
  return fallback;
}

function hexToRgb(hex) {
  const value = Number.parseInt(normalizeHexColor(hex).slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(c => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0')).join('');
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
  if (Array.isArray(spec)) return { type: 'boxel', voxels: spec.map(entry => normalizePoint(entry)) };
  const type = spec.type || (spec.voxels ? 'boxel' : 'voxel');

  if (type === 'boxel') {
    return {
      type,
      voxels: (spec.voxels || spec.cells || spec.entries || [])
        .map(entry => normalizePoint(entry, spec.color || '#8cc8ff')),
    };
  }

  if (type === 'voxel' && Array.isArray(spec.microxels) && spec.microxels.length > 0) {
    return { type, voxels: spec.microxels.map(entry => normalizePoint(entry, spec.color || '#8cc8ff')) };
  }

  return { type: 'voxel', voxels: [{ x: 0, y: 0, z: 0, color: normalizeHexColor(spec.color || '#8cc8ff') }] };
}

function depthSort(a, b) {
  const da = a.x + a.z + a.y * 2;
  const db = b.x + b.z + b.y * 2;
  if (da !== db) return da - db;
  if (a.y !== b.y) return a.y - b.y;
  if (a.z !== b.z) return a.z - b.z;
  return a.x - b.x;
}

function project(point, o) {
  return {
    x: (point.x - point.z) * o.tileHalfWidth,
    y: (point.x + point.z) * o.tileHalfHeight - point.y * o.cubeHeight,
  };
}

function cubePolygons(voxel, o) {
  const p = project(voxel, o);
  const hw = o.tileHalfWidth, hh = o.tileHalfHeight, ch = o.cubeHeight;
  const top = [
    { x: p.x,      y: p.y - hh },
    { x: p.x + hw, y: p.y },
    { x: p.x,      y: p.y + hh },
    { x: p.x - hw, y: p.y },
  ];

  return {
    top,
    left:  [top[3], top[2], { x: p.x, y: p.y + ch + hh }, { x: p.x - hw, y: p.y + ch }],
    right: [top[1], { x: p.x + hw, y: p.y + ch }, { x: p.x, y: p.y + ch + hh }, top[2]],
  };
}

function measure(voxels, o) {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const voxel of voxels) {
    const faces = cubePolygons(voxel, o);
    for (const face of [faces.top, faces.left, faces.right]) {
      for (const p of face) {
        b.minX = Math.min(b.minX, p.x);
        b.minY = Math.min(b.minY, p.y);
        b.maxX = Math.max(b.maxX, p.x);
        b.maxY = Math.max(b.maxY, p.y);
      }
    }
  }
  return Number.isFinite(b.minX) ? b : { minX: 0, minY: 0, maxX: 1, maxY: 1 };
}

function mapPoint(p, t) {
  return { x: Math.round((p.x - t.cx) * t.scale + t.ox), y: Math.round((p.y - t.cy) * t.scale + t.oy) };
}

function mapPolygon(points, t) { return points.map(p => mapPoint(p, t)); }

function drawFilledPolygon(ctx, points, fillStyle) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function drawCanvasStroke(ctx, points, strokeStyle, lineWidth = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0].x + 0.5, points[0].y + 0.5);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x + 0.5, points[i].y + 0.5);
  ctx.closePath();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  ctx.stroke();
}

function pixelLine(ctx, a, b, color, width = 1) {
  let x0 = Math.round(a.x), y0 = Math.round(a.y);
  const x1 = Math.round(b.x), y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  ctx.fillStyle = color;

  while (true) {
    ctx.fillRect(x0, y0, width, width);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) { error += dy; x0 += sx; }
    if (e2 <= dx) { error += dx; y0 += sy; }
  }
}

function drawPixelStroke(ctx, points, strokeStyle, width = 1) {
  for (let i = 0; i < points.length; i += 1) pixelLine(ctx, points[i], points[(i + 1) % points.length], strokeStyle, width);
}

function drawPolygon(ctx, points, fillStyle, strokeStyle, o) {
  drawFilledPolygon(ctx, points, fillStyle);
  if (!strokeStyle) return;
  if (o.pixelPerfect) drawPixelStroke(ctx, points, strokeStyle, o.pixelLineWidth);
  else drawCanvasStroke(ctx, points, strokeStyle, o.pixelLineWidth);
}

function hexPoints(size, inset) {
  const cx = Math.round(size * 0.5);
  const top = inset, right = size - inset, bottom = size - inset, left = inset;
  const quarterY = Math.round(size * 0.25 + inset * 0.5);
  const threeQuarterY = Math.round(size * 0.75 - inset * 0.5);
  return [
    { x: cx, y: top },
    { x: right, y: quarterY },
    { x: right, y: threeQuarterY },
    { x: cx, y: bottom },
    { x: left, y: threeQuarterY },
    { x: left, y: quarterY },
  ];
}

function clipPolygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.clip();
}

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function fitTransform(voxels, size, o) {
  const b = measure(voxels, o);
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);
  const available = Math.max(1, size - o.padding * 2);
  const rawScale = available / Math.max(w, h);
  const scale = o.pixelPerfect ? clamp(Math.floor(rawScale), o.minScale, o.maxScale) : clamp(rawScale, o.minScale, o.maxScale);

  return {
    cx: b.minX + w * 0.5,
    cy: b.minY + h * 0.5,
    ox: Math.round(size * 0.5),
    oy: Math.round(size * 0.5),
    scale,
  };
}

export class Isometricon {
  static cache = new Map();
  static defaults = DEFAULTS;

  static normalize(spec) { return normalizeSpec(spec); }
  static clearCache() { this.cache.clear(); }

  static renderToCanvas(canvas, spec, userOptions = {}) {
    const o = { ...DEFAULTS, ...userOptions };
    const normalized = normalizeSpec(spec);
    const voxels = normalized.voxels.slice().sort(depthSort);
    const size = Math.max(16, Math.round(o.size));
    const drawSize = Math.max(16, Math.round(size * o.pixelRatio));

    canvas.width = drawSize;
    canvas.height = drawSize;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(o.pixelRatio, 0, 0, o.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, size, size);

    if (o.background !== 'transparent') {
      ctx.fillStyle = o.background;
      ctx.fillRect(0, 0, size, size);
    }

    const iconHex = hexPoints(size, o.hexInset);

    ctx.save();
    clipPolygon(ctx, iconHex);
    drawFilledPolygon(ctx, iconHex, o.hexFill);

    if (voxels.length > 0) {
      const transform = fitTransform(voxels, size, o);
      const stroke = o.debugCubeStroke ? o.cubeStroke : null;

      for (const voxel of voxels) {
        const faces = cubePolygons(voxel, o);
        drawPolygon(ctx, mapPolygon(faces.left, transform), tint(voxel.color, 'black', 0.14), stroke, o);
        drawPolygon(ctx, mapPolygon(faces.right, transform), tint(voxel.color, 'black', 0.03), stroke, o);
        drawPolygon(ctx, mapPolygon(faces.top, transform), tint(voxel.color, 'white', 0.24), stroke, o);
      }
    }

    ctx.restore();

    if (o.debugHexStroke) {
      if (o.pixelPerfect) drawPixelStroke(ctx, iconHex, o.hexStroke, Math.max(1, o.pixelLineWidth));
      else drawCanvasStroke(ctx, iconHex, o.hexStroke, 2);
    }

    return canvas;
  }

  static draw(target, spec, options = {}) {
    const canvas = target instanceof HTMLCanvasElement
      ? target
      : target?.querySelector?.('canvas') || makeCanvas(options.size || DEFAULTS.size);
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
    image.className = 'isometriconImage';
    return image;
  }
}

export default Isometricon;
