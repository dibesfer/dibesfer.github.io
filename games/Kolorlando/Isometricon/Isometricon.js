/**
 * Isometricon.js
 * Tiny 2D API for square hexagonal orthographic isometric voxel/boxel icons.
 *
 * External apps:
 *   import { renderIsometricon } from './Isometricon.js';
 *   renderIsometricon(canvas, { voxels:[{x:0,y:0,z:0,color:'#44aa66'}] });
 *
 * Voxel data may use direct colors, palette indexes, or palette keys:
 *   { palette:['#44aa66'], voxels:[{x:0,y:0,z:0,material:0}] }
 */

const DEFAULTS = Object.freeze({
  size: 128,
  pixelRatio: 1,
  tileHalfWidth: 8,
  tileHalfHeight: 4,
  cubeHeight: 8,
  padding: 0,
  background: 'transparent',
  hexInset: 0,
  hexFill: 'rgba(255,255,255,0.07)',
  hexStroke: 'rgba(20,20,30,0.9)',
  cubeStroke: 'rgba(10,10,16,0.58)',
  gridStroke: 'rgba(134,218,255,0.22)',
  cubeOutline: true,
  underlayGrid: true,
  hexOutline: true,
  pixelPerfect: true,
  pixelLineWidth: 1,
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

function paletteColor(palette, key, fallbackColor) {
  if (Array.isArray(palette)) return normalizeHexColor(palette[key], fallbackColor);
  if (isPlainObject(palette)) return normalizeHexColor(palette[key], fallbackColor);
  return fallbackColor;
}

function entryColor(entry, spec, fallbackColor) {
  const direct = entry?.color || entry?.voxel?.color;
  if (direct) return normalizeHexColor(direct, fallbackColor);
  const key = entry?.material ?? entry?.palette ?? entry?.colorIndex ?? entry?.voxel?.material;
  return paletteColor(spec?.palette, key, normalizeHexColor(spec?.color || fallbackColor, fallbackColor));
}

function normalizePoint(entry, fallbackColor = '#8cc8ff', spec = {}) {
  const pos = entry?.position || entry || {};
  return {
    x: Math.round(Number(pos.x) || 0),
    y: Math.round(Number(pos.y) || 0),
    z: Math.round(Number(pos.z) || 0),
    color: entryColor(entry, spec, fallbackColor),
  };
}

function normalizeSpec(spec = {}) {
  if (Array.isArray(spec)) {
    const voxels = spec.map(entry => normalizePoint(entry));
    return { type: 'boxel', voxels };
  }

  const voxelsSource = spec.voxels || spec.cells || spec.entries || spec.data;
  const type = spec.type || (voxelsSource ? 'boxel' : 'voxel');

  if (Array.isArray(voxelsSource)) {
    const voxels = (voxelsSource || [])
      .map(entry => normalizePoint(entry, spec.color || '#8cc8ff', spec));
    return {
      type,
      voxels,
    };
  }

  if (type === 'voxel' && Array.isArray(spec.microxels) && spec.microxels.length > 0) {
    const voxels = spec.microxels.map(entry => normalizePoint(entry, spec.color || '#8cc8ff', spec));
    return { type, voxels };
  }

  const voxels = [{ x: 0, y: 0, z: 0, color: normalizeHexColor(spec.color || '#8cc8ff') }];
  return { type: 'voxel', voxels };
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

function cubeInnerGridPolygons(o) {
  const hw = o.tileHalfWidth, hh = o.tileHalfHeight, ch = o.cubeHeight;
  const top = [
    { x: 0, y: -hh },
    { x: hw, y: 0 },
    { x: 0, y: hh },
    { x: -hw, y: 0 },
  ];
  const bottom = top.map(point => ({ x: point.x, y: point.y + ch }));

  return {
    bottom,
    back: [top[0], top[1], bottom[1], bottom[0]],
    left: [top[3], bottom[3], bottom[0], top[0]],
    right: [top[1], bottom[1], bottom[2], top[2]],
  };
}

function transformPoint(p, t) {
  return { x: (p.x - t.cx) * t.scale + t.ox, y: (p.y - t.cy) * t.scale + t.oy };
}

function mapPoint(p, t) {
  const mapped = transformPoint(p, t);
  return { x: Math.round(mapped.x), y: Math.round(mapped.y) };
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

function resolveHexInset(size, o) {
  const inset = o.hexInset <= 1 ? size * o.hexInset : o.hexInset;
  return Math.round(clamp(inset, 0, size * 0.24));
}

function cubeSilhouette(o) {
  const hw = o.tileHalfWidth, hh = o.tileHalfHeight, ch = o.cubeHeight;
  return [
    { x: 0, y: -hh },
    { x: hw, y: 0 },
    { x: hw, y: ch },
    { x: 0, y: ch + hh },
    { x: -hw, y: ch },
    { x: -hw, y: 0 },
  ];
}

function fitPointsToSize(points, size, inset) {
  const b = measurePoints(points);
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);
  const fit = Math.max(1, size - inset * 2 - 1);
  const scale = fit / Math.max(w, h);
  return points.map(point => mapPoint(point, {
    cx: b.minX + w * 0.5,
    cy: b.minY + h * 0.5,
    ox: Math.round((size - 1) * 0.5),
    oy: Math.round((size - 1) * 0.5),
    scale,
  }));
}

function hexPoints(size, inset, o) {
  return fitPointsToSize(cubeSilhouette(o), size, inset);
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

function isCanvasTarget(target) {
  return typeof HTMLCanvasElement !== 'undefined' && target instanceof HTMLCanvasElement;
}

function resolveTarget(target, size) {
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  if (isCanvasTarget(node)) return { canvas: node, mount: null };
  return {
    canvas: node?.querySelector?.('canvas') || makeCanvas(size),
    mount: node && node.appendChild ? node : null,
  };
}

function resolveOptions(spec, userOptions = {}) {
  const specOptions = isPlainObject(spec?.options) ? spec.options : {};
  return { ...DEFAULTS, ...specOptions, ...userOptions };
}

function measurePoints(points) {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of points) {
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  }
  return Number.isFinite(b.minX) ? b : { minX: 0, minY: 0, maxX: 1, maxY: 1 };
}

function voxelVertices(voxels, o) {
  const points = [];
  for (const voxel of voxels) {
    const faces = cubePolygons(voxel, o);
    points.push(...faces.top, ...faces.left, ...faces.right);
  }
  return points;
}

function cubicSlotVoxels(divisions) {
  const voxels = [];
  for (let x = 0; x < divisions; x += 1) {
    for (let y = 0; y < divisions; y += 1) {
      for (let z = 0; z < divisions; z += 1) {
        voxels.push({ x, y, z });
      }
    }
  }
  return voxels;
}

function lerpPoint(a, b, amount) {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
  };
}

function strokeLine(ctx, a, b, strokeStyle, o) {
  const from = { x: Math.round(a.x), y: Math.round(a.y) };
  const to = { x: Math.round(b.x), y: Math.round(b.y) };

  if (o.pixelPerfect) pixelLine(ctx, from, to, strokeStyle, o.pixelLineWidth);
  else {
    ctx.beginPath();
    ctx.moveTo(from.x + 0.5, from.y + 0.5);
    ctx.lineTo(to.x + 0.5, to.y + 0.5);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = o.pixelLineWidth;
    ctx.stroke();
  }
}

function drawFaceGrid(ctx, face, divisions, o) {
  const [a, b, c, d] = face;

  for (let column = 0; column <= divisions; column += 1) {
    const amount = column / divisions;
    strokeLine(ctx, lerpPoint(a, d, amount), lerpPoint(b, c, amount), o.gridStroke, o);
  }

  for (let row = 0; row <= divisions; row += 1) {
    const amount = row / divisions;
    strokeLine(ctx, lerpPoint(a, b, amount), lerpPoint(d, c, amount), o.gridStroke, o);
  }
}

function iconTransform(size, o) {
  const points = cubeSilhouette(o);
  const b = measurePoints(points);
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);

  return {
    cx: b.minX + w * 0.5,
    cy: b.minY + h * 0.5,
    ox: Math.round((size - 1) * 0.5),
    oy: Math.round((size - 1) * 0.5),
    scale: Math.max(1, size - resolveHexInset(size, o) * 2 - 1) / Math.max(w, h),
  };
}

function voxelSpan(voxels) {
  const max = voxels.reduce((bounds, voxel) => ({
    x: Math.max(bounds.x, voxel.x),
    y: Math.max(bounds.y, voxel.y),
    z: Math.max(bounds.z, voxel.z),
  }), { x: 0, y: 0, z: 0 });

  return Math.max(1, max.x + 1, max.y + 1, max.z + 1);
}

function drawInnerGrid(ctx, size, divisions, o) {
  const faces = cubeInnerGridPolygons(o);
  const transform = iconTransform(size, o);
  const safeDivisions = Math.max(1, Math.min(64, divisions));

  drawFaceGrid(ctx, mapPolygon(faces.bottom, transform), safeDivisions, o);
  drawFaceGrid(ctx, mapPolygon(faces.left, transform), safeDivisions, o);
  drawFaceGrid(ctx, mapPolygon(faces.back, transform), safeDivisions, o);
}

function gridAlignedTransform(size, o, divisions) {
  const icon = iconTransform(size, o);
  const points = voxelVertices(cubicSlotVoxels(divisions), o);
  const b = measurePoints(points);

  return {
    cx: b.minX + (b.maxX - b.minX) * 0.5,
    cy: b.minY + (b.maxY - b.minY) * 0.5,
    ox: icon.ox,
    oy: icon.oy,
    scale: icon.scale / divisions,
  };
}

export class Isometricon {
  static cache = new Map();
  static defaults = DEFAULTS;

  static normalize(spec) { return normalizeSpec(spec); }
  static clearCache() { this.cache.clear(); }

  static renderToCanvas(canvas, spec, userOptions = {}) {
    const o = resolveOptions(spec, userOptions);
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

    const iconHex = hexPoints(size, resolveHexInset(size, o), o);

    ctx.save();
    clipPolygon(ctx, iconHex);
    drawFilledPolygon(ctx, iconHex, o.hexFill);

    if (voxels.length > 0) {
      const gridDivisions = voxelSpan(voxels);
      const transform = gridAlignedTransform(size, o, gridDivisions);
      const stroke = o.cubeOutline ? o.cubeStroke : null;

      if (o.underlayGrid) drawInnerGrid(ctx, size, gridDivisions, o);

      for (const voxel of voxels) {
        const faces = cubePolygons(voxel, o);
        drawPolygon(ctx, mapPolygon(faces.left, transform), tint(voxel.color, 'black', 0.14), stroke, o);
        drawPolygon(ctx, mapPolygon(faces.right, transform), tint(voxel.color, 'black', 0.03), stroke, o);
        drawPolygon(ctx, mapPolygon(faces.top, transform), tint(voxel.color, 'white', 0.24), stroke, o);
      }
    }

    ctx.restore();

    if (o.hexOutline) {
      if (o.pixelPerfect) drawPixelStroke(ctx, iconHex, o.hexStroke, Math.max(1, o.pixelLineWidth));
      else drawCanvasStroke(ctx, iconHex, o.hexStroke, 2);
    }

    return canvas;
  }

  static draw(target, spec, options = {}) {
    const merged = resolveOptions(spec, options);
    const { canvas, mount } = resolveTarget(target, merged.size);
    const rendered = this.renderToCanvas(canvas, spec, merged);
    if (mount && rendered.parentNode !== mount) mount.appendChild(rendered);
    return rendered;
  }

  static render(target, voxelData, options = {}) {
    return this.draw(target, voxelData, options);
  }

  static toCanvas(spec, options = {}) {
    const merged = resolveOptions(spec, options);
    const canvas = makeCanvas(merged.size);
    return this.renderToCanvas(canvas, spec, merged);
  }

  static toDataURL(spec, options = {}) {
    const merged = resolveOptions(spec, options);
    const key = merged.cache ? stableStringify({ spec: normalizeSpec(spec), options: merged }) : null;
    if (key && this.cache.has(key)) return this.cache.get(key);
    const dataURL = this.toCanvas(spec, merged).toDataURL('image/png');
    if (key) this.cache.set(key, dataURL);
    return dataURL;
  }

  static toImage(spec, options = {}) {
    const image = new Image();
    const merged = resolveOptions(spec, options);
    image.width = merged.size;
    image.height = merged.size;
    image.src = this.toDataURL(spec, merged);
    image.className = 'isometriconImage';
    return image;
  }
}

export function renderIsometricon(target, voxelData, options = {}) {
  return Isometricon.render(target, voxelData, options);
}

export default Isometricon;
