import { Microxel } from './Microxel.js';
import { VoxelPresets } from './VoxelPresets.js';
import { DEFAULT_VOXEL_COLOR } from './MicroxelPalette.js';

const VOXEL_FILE_FORMAT = 'voxel-editor';
const VOXEL_FILE_VERSION = 1;

export class Voxel {
  constructor(data = {}) {
    const {
      id = 'air',
      name = id,
      position = null,
      x = 0,
      y = 0,
      z = 0,
      rotation = null,
      solid = false,
      type = 'colored',
      color = DEFAULT_VOXEL_COLOR,
      texture = null,
      textureInfluence = 1,
      transparent = false,
      active = true,
      microxelSize = 0,
      microxels = null,
      shape = 'voxel',
      planeFace = 'front',
      doubleSided = false,
      inset = 0,
      contentType = null,
      text = '',
      fontFamily = 'monospace',
      fontSize = '3rem',
      textColor = 'black',
      backgroundColor = 'white',
      horizontalAlign = 'center',
      verticalAlign = 'center',
      padding = 0,
    } = data;
    const sourcePosition = normalizePosition(position, { x, y, z });

    // Shared Voxel stays compatible with simple cell mode and composed mode.
    this.id = normalizeText(id, 'air');
    this.name = normalizeText(name, this.id);
    this.solid = Boolean(solid);
    this.shape = normalizeText(shape, 'voxel');
    this.planeFace = normalizeVoxelPlaneFace(planeFace);
    this.doubleSided = Boolean(doubleSided);
    this.inset = toFiniteNumber(inset, 0);
    this.contentType = contentType ? normalizeText(contentType, '') : null;
    this.text = normalizeText(text, '');
    this.fontFamily = normalizeText(fontFamily, 'monospace');
    this.fontSize = normalizeText(fontSize, '3rem');
    this.textColor = normalizeText(textColor, 'black');
    this.backgroundColor = normalizeText(backgroundColor, 'white');
    this.horizontalAlign = normalizeText(horizontalAlign, 'center');
    this.verticalAlign = normalizeText(verticalAlign, 'center');
    this.padding = toFiniteNumber(padding, 0);
    this.rotation = normalizeVoxelRotation(rotation);
    this.type = normalizeVoxelType(type);
    this.color = normalizeText(color, DEFAULT_VOXEL_COLOR);
    this.texture = normalizeVoxelTexture(texture);
    this.textureInfluence = normalizeVoxelTextureInfluence(textureInfluence);
    this.transparent = Boolean(transparent);
    this.active = Boolean(active);
    this.microxelSize = normalizeGridSize(microxelSize);
    this.microxels = null;

    this.setPosition(sourcePosition.x, sourcePosition.y, sourcePosition.z);

    if (Array.isArray(microxels) && microxels.length > 0) {
      this.setMicroxels(microxels);
    } else if (this.microxelSize > 0) {
      this.initializeMicroxels(this.microxelSize);
    } else {
      this.syncMode();
    }
  }

  setPosition(x = 0, y = 0, z = 0) {
    this.x = toFiniteNumber(x, 0);
    this.y = toFiniteNumber(y, 0);
    this.z = toFiniteNumber(z, 0);
    this.position = { x: this.x, y: this.y, z: this.z };
    return this;
  }

  setName(name = '') {
    this.name = normalizeText(name, '');
    return this;
  }

  setRotation(rotation = null) {
    this.rotation = normalizeVoxelRotation(rotation);
    return this;
  }

  setColor(color = DEFAULT_VOXEL_COLOR) {
    this.type = 'colored';
    this.color = normalizeText(color, this.color || DEFAULT_VOXEL_COLOR);
    this.syncMode();
    return this;
  }

  setTexture(texture = '') {
    this.type = 'textured';
    this.texture = normalizeVoxelTexture(texture);
    this.syncMode();
    return this;
  }

  setTextureInfluence(textureInfluence = 1) {
    this.textureInfluence = normalizeVoxelTextureInfluence(textureInfluence);
    return this;
  }

  setTransparent(transparent = false) {
    this.transparent = Boolean(transparent);
    return this;
  }

  getTexture() {
    return cloneVoxelTexture(this.texture);
  }

  getResolvedTextureFaces() {
    return resolveVoxelTextureFaces(this.texture);
  }

  initializeMicroxels(size = 7, presetName = 'full') {
    const normalizedSize = normalizeGridSize(size);
    if (!normalizedSize) {
      return this.clearMicroxels();
    }

    const presetData = VoxelPresets[presetName] ?? null;
    const nextData = presetData
      ? {
        ...presetData,
        microxelSize: normalizedSize,
        microxels: cloneMicroxelDataGrid(presetData.microxels, normalizedSize),
      }
      : {
        type: 'microxeled',
        microxelSize: normalizedSize,
        microxels: createEmptyMicroxelDataGrid(normalizedSize),
      };

    return this.fromJSON(nextData);
  }

  get(x, y, z) {
    return this.microxels?.[x]?.[y]?.[z] ?? null;
  }

  set(x, y, z, microxel) {
    if (!this.microxels) {
      throw new Error('Voxel has no microxel grid.');
    }

    if (!(microxel instanceof Microxel)) {
      throw new Error('setMicroxel expects a Microxel instance.');
    }

    if (!this.microxels?.[x]?.[y]) {
      throw new Error(`Invalid microxel position ${x},${y},${z}.`);
    }

    microxel.setPosition(x, y, z);
    this.microxels[x][y][z] = microxel;
    return this;
  }

  setMicroxels(microxelsArray) {
    if (!Array.isArray(microxelsArray) || microxelsArray.length === 0) {
      return this.clearMicroxels();
    }

    const size = normalizeGridSize(microxelsArray.length);
    this.microxelSize = size;
    this.microxels = Array.from({ length: size }, (_, x) =>
      Array.from({ length: size }, (_, y) =>
        Array.from({ length: size }, (_, z) => {
          const sourceCell = microxelsArray?.[x]?.[y]?.[z];

          if (sourceCell instanceof Microxel) {
            return sourceCell.clone().setPosition(x, y, z);
          }

          return new Microxel({
            x,
            y,
            z,
            color: sourceCell?.color,
            active: sourceCell ? sourceCell.active ?? sourceCell.filled : false,
          });
        })
      )
    );

    this.type = 'microxeled';
    this.syncMode();
    return this;
  }

  clearMicroxels() {
    this.microxels = null;
    this.microxelSize = 0;
    this.syncMode();
    return this;
  }

  getType() {
    return this.type;
  }

  hasMicroxels() {
    return this.type === 'microxeled' && this.microxelSize > 0 && Array.isArray(this.microxels);
  }

  destroy() {
    this.active = false;
    return this;
  }

  revive() {
    this.active = true;
    return this;
  }

  clone() {
    return new Voxel({
      id: this.id,
      name: this.name,
      position: { ...this.position },
      rotation: { ...this.rotation },
      solid: this.solid,
      shape: this.shape,
      planeFace: this.planeFace,
      doubleSided: this.doubleSided,
      inset: this.inset,
      contentType: this.contentType,
      text: this.text,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      textColor: this.textColor,
      backgroundColor: this.backgroundColor,
      horizontalAlign: this.horizontalAlign,
      verticalAlign: this.verticalAlign,
      padding: this.padding,
      type: this.type,
      color: this.color,
      texture: cloneVoxelTexture(this.texture),
      textureInfluence: this.textureInfluence,
      transparent: this.transparent,
      active: this.active,
      microxelSize: this.microxelSize,
      microxels: this.microxels ? cloneMicroxelGrid(this.microxels) : null,
    });
  }

  toJSON() {
    const serializedMicroxels = this.hasMicroxels()
      ? this.microxels.map((plane, x) =>
        plane.map((row, y) =>
          row.map((cell, z) => ({
            position: {
              x,
              y,
              z,
            },
            color: cell.color,
            active: cell.active,
          }))
        )
      )
      : this.type === 'colored'
        ? [[[
          {
            position: { x: 0, y: 0, z: 0 },
            color: this.color,
            active: this.active,
          },
        ]]]
        : null;

    return {
      format: VOXEL_FILE_FORMAT,
      version: VOXEL_FILE_VERSION,
      id: this.id,
      name: this.name,
      position: { ...this.position },
      rotation: {
        x: this.rotation.x,
        y: this.rotation.y,
        z: this.rotation.z,
      },
      shape: this.shape,
      planeFace: this.planeFace,
      doubleSided: this.doubleSided,
      inset: this.inset,
      contentType: this.contentType,
      text: this.text,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      textColor: this.textColor,
      backgroundColor: this.backgroundColor,
      horizontalAlign: this.horizontalAlign,
      verticalAlign: this.verticalAlign,
      padding: this.padding,
      solid: this.solid,
      type: this.type,
      color: this.color,
      texture: serializeVoxelTexture(this.texture),
      textureInfluence: this.textureInfluence,
      transparent: this.transparent,
      active: this.active,
      microxelSize: serializedMicroxels ? serializedMicroxels.length : 0,
      microxels: serializedMicroxels,
    };
  }

  fromJSON(data = {}) {
    const sourcePosition = normalizePosition(data?.position, {
      x: data?.x ?? this.x,
      y: data?.y ?? this.y,
      z: data?.z ?? this.z,
    });

    this.setPosition(sourcePosition.x, sourcePosition.y, sourcePosition.z);

    if ('id' in data) {
      this.id = normalizeText(data.id, 'air');
    }

    if ('rotation' in data) {
      this.setRotation(data.rotation);
    }

    if ('name' in data) {
      this.setName(data.name || this.id);
    } else if ('id' in data && (!this.name || this.name === 'air' || this.name === 'Default Voxel')) {
      this.setName(this.id);
    }

    if ('solid' in data) {
      this.solid = Boolean(data.solid);
    }

    if ('active' in data) {
      this.active = Boolean(data.active);
    }

    if ('shape' in data) {
      this.shape = normalizeText(data.shape, 'voxel');
    }

    if ('planeFace' in data) {
      this.planeFace = normalizeVoxelPlaneFace(data.planeFace);
    }

    if ('doubleSided' in data) {
      this.doubleSided = Boolean(data.doubleSided);
    }

    if ('inset' in data) {
      this.inset = toFiniteNumber(data.inset, 0);
    }

    if ('contentType' in data) {
      this.contentType = data.contentType ? normalizeText(data.contentType, '') : null;
    }

    if ('text' in data) {
      this.text = normalizeText(data.text, '');
    }

    if ('fontFamily' in data) {
      this.fontFamily = normalizeText(data.fontFamily, 'monospace');
    }

    if ('fontSize' in data) {
      this.fontSize = normalizeText(data.fontSize, '3rem');
    }

    if ('textColor' in data) {
      this.textColor = normalizeText(data.textColor, 'black');
    }

    if ('backgroundColor' in data) {
      this.backgroundColor = normalizeText(data.backgroundColor, 'white');
    }

    if ('horizontalAlign' in data) {
      this.horizontalAlign = normalizeText(data.horizontalAlign, 'center');
    }

    if ('verticalAlign' in data) {
      this.verticalAlign = normalizeText(data.verticalAlign, 'center');
    }

    if ('padding' in data) {
      this.padding = toFiniteNumber(data.padding, 0);
    }

    if ('type' in data) {
      this.type = normalizeVoxelType(data.type);
    }

    if (typeof data?.color === 'string' && data.color.trim()) {
      this.color = normalizeText(data.color, this.color || DEFAULT_VOXEL_COLOR);
    }

    if ('texture' in data) {
      this.texture = normalizeVoxelTexture(data.texture);
    }

    if ('textureInfluence' in data) {
      this.textureInfluence = normalizeVoxelTextureInfluence(data.textureInfluence);
    }

    if ('transparent' in data) {
      this.transparent = Boolean(data.transparent);
    }

    if (Array.isArray(data?.microxels) && data.microxels.length > 0) {
      this.setMicroxels(data.microxels);
      return this;
    }

    if ('microxels' in data || 'microxelSize' in data) {
      this.clearMicroxels();
    }

    this.syncMode();
    return this;
  }

  syncMode() {
    this.mode = this.hasMicroxels() ? 'microxels' : this.type === 'textured' ? 'texture' : 'color';
  }
}

export class VoxelPlane extends Voxel {
  constructor({
    planeFace = 'front',
    doubleSided = false,
    inset = 0,
    ...voxelOptions
  } = {}) {
    super(voxelOptions);
    this.shape = 'plane';
    this.planeFace = normalizeVoxelPlaneFace(planeFace);
    this.doubleSided = Boolean(doubleSided);
    this.inset = toFiniteNumber(inset, 0);
  }

  setPlaneFace(planeFace = 'front') {
    this.planeFace = normalizeVoxelPlaneFace(planeFace);
    return this;
  }

  setDoubleSided(doubleSided = false) {
    this.doubleSided = Boolean(doubleSided);
    return this;
  }

  setInset(inset = 0) {
    this.inset = toFiniteNumber(inset, 0);
    return this;
  }

  clone() {
    return new VoxelPlane({
      x: this.x,
      y: this.y,
      z: this.z,
      rotation: { ...this.rotation },
      type: this.type,
      color: this.color,
      texture: cloneVoxelTexture(this.texture),
      textureInfluence: this.textureInfluence,
      transparent: this.transparent,
      active: this.active,
      name: this.name,
      planeFace: this.planeFace,
      doubleSided: this.doubleSided,
      inset: this.inset,
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      shape: this.shape,
      planeFace: this.planeFace,
      doubleSided: this.doubleSided,
      inset: this.inset,
    };
  }

  fromJSON(data = {}) {
    super.fromJSON(data);

    if ('planeFace' in data) {
      this.planeFace = normalizeVoxelPlaneFace(data.planeFace);
    }

    if ('doubleSided' in data) {
      this.doubleSided = Boolean(data.doubleSided);
    }

    if ('inset' in data) {
      this.inset = toFiniteNumber(data.inset, 0);
    }

    return this;
  }

}

export class VoxelPlaneText extends VoxelPlane {
  constructor({
    text = 'Write your message',
    fontFamily = 'monospace',
    fontSize = '3rem',
    textColor = 'black',
    backgroundColor = 'white',
    horizontalAlign = 'center',
    verticalAlign = 'center',
    padding = 0,
    ...planeOptions
  } = {}) {
    super(planeOptions);
    this.contentType = 'text';
    this.text = normalizeText(text, 'Write your message');
    this.fontFamily = normalizeText(fontFamily, 'monospace');
    this.fontSize = normalizeText(fontSize, '3rem');
    this.textColor = normalizeText(textColor, 'black');
    this.backgroundColor = normalizeText(backgroundColor, 'white');
    this.horizontalAlign = normalizeText(horizontalAlign, 'center');
    this.verticalAlign = normalizeText(verticalAlign, 'center');
    this.padding = toFiniteNumber(padding, 0);
  }

  clone() {
    return new VoxelPlaneText({
      x: this.x,
      y: this.y,
      z: this.z,
      rotation: { ...this.rotation },
      type: this.type,
      color: this.color,
      texture: cloneVoxelTexture(this.texture),
      textureInfluence: this.textureInfluence,
      transparent: this.transparent,
      active: this.active,
      name: this.name,
      planeFace: this.planeFace,
      doubleSided: this.doubleSided,
      inset: this.inset,
      text: this.text,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      textColor: this.textColor,
      backgroundColor: this.backgroundColor,
      horizontalAlign: this.horizontalAlign,
      verticalAlign: this.verticalAlign,
      padding: this.padding,
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      contentType: this.contentType,
      text: this.text,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      textColor: this.textColor,
      backgroundColor: this.backgroundColor,
      horizontalAlign: this.horizontalAlign,
      verticalAlign: this.verticalAlign,
      padding: this.padding,
    };
  }

  fromJSON(data = {}) {
    super.fromJSON(data);

    if ('text' in data) {
      this.text = normalizeText(data.text, 'Write your message');
    }

    if ('fontFamily' in data) {
      this.fontFamily = normalizeText(data.fontFamily, 'monospace');
    }

    if ('fontSize' in data) {
      this.fontSize = normalizeText(data.fontSize, '3rem');
    }

    if ('textColor' in data) {
      this.textColor = normalizeText(data.textColor, 'black');
    }

    if ('backgroundColor' in data) {
      this.backgroundColor = normalizeText(data.backgroundColor, 'white');
    }

    if ('horizontalAlign' in data) {
      this.horizontalAlign = normalizeText(data.horizontalAlign, 'center');
    }

    if ('verticalAlign' in data) {
      this.verticalAlign = normalizeText(data.verticalAlign, 'center');
    }

    if ('padding' in data) {
      this.padding = toFiniteNumber(data.padding, 0);
    }

    return this;
  }

  createCanvasTextureSource({
    width = 512,
    height = 512,
    canvas = null,
  } = {}) {
    const targetCanvas = canvas ?? document.createElement('canvas');
    const canvasWidth = Math.max(1, Math.floor(Number(width) || 512));
    const canvasHeight = Math.max(1, Math.floor(Number(height) || 512));
    const context = targetCanvas.getContext('2d');

    targetCanvas.width = canvasWidth;
    targetCanvas.height = canvasHeight;

    if (!context) {
      return targetCanvas;
    }

    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = this.backgroundColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    const padding = Math.max(0, this.padding);
    const drawWidth = Math.max(1, canvasWidth - padding * 2);
    const drawHeight = Math.max(1, canvasHeight - padding * 2);

    context.fillStyle = this.textColor;
    context.font = `${this.fontSize} ${this.fontFamily}`;
    context.textAlign = normalizeCanvasTextAlign(this.horizontalAlign);
    context.textBaseline = normalizeCanvasTextBaseline(this.verticalAlign);

    const textX = getCanvasTextX(this.horizontalAlign, padding, drawWidth);
    const textY = getCanvasTextY(this.verticalAlign, padding, drawHeight);
    context.fillText(this.text, textX, textY, drawWidth);

    return targetCanvas;
  }
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
}

function normalizePosition(position, fallback = { x: 0, y: 0, z: 0 }) {
  if (Array.isArray(position)) {
    return {
      x: toFiniteNumber(position[0], fallback.x),
      y: toFiniteNumber(position[1], fallback.y),
      z: toFiniteNumber(position[2], fallback.z),
    };
  }

  if (position && typeof position === 'object') {
    return {
      x: toFiniteNumber(position.x, fallback.x),
      y: toFiniteNumber(position.y, fallback.y),
      z: toFiniteNumber(position.z, fallback.z),
    };
  }

  return {
    x: toFiniteNumber(fallback.x, 0),
    y: toFiniteNumber(fallback.y, 0),
    z: toFiniteNumber(fallback.z, 0),
  };
}

function normalizeCanvasTextAlign(horizontalAlign = 'center') {
  const normalizedAlign = normalizeText(horizontalAlign, 'center').toLowerCase();
  if (normalizedAlign === 'left' || normalizedAlign === 'right' || normalizedAlign === 'center') {
    return normalizedAlign;
  }

  return 'center';
}

function normalizeCanvasTextBaseline(verticalAlign = 'center') {
  const normalizedAlign = normalizeText(verticalAlign, 'center').toLowerCase();
  if (normalizedAlign === 'top') return 'top';
  if (normalizedAlign === 'bottom') return 'bottom';
  return 'middle';
}

function getCanvasTextX(horizontalAlign = 'center', padding = 0, drawWidth = 1) {
  const normalizedAlign = normalizeCanvasTextAlign(horizontalAlign);
  if (normalizedAlign === 'left') return padding;
  if (normalizedAlign === 'right') return padding + drawWidth;
  return padding + drawWidth * 0.5;
}

function getCanvasTextY(verticalAlign = 'center', padding = 0, drawHeight = 1) {
  const normalizedAlign = normalizeCanvasTextBaseline(verticalAlign);
  if (normalizedAlign === 'top') return padding;
  if (normalizedAlign === 'bottom') return padding + drawHeight;
  return padding + drawHeight * 0.5;
}

function normalizeVoxelType(type) {
  const normalizedType = normalizeText(type, 'colored').toLowerCase();

  if (
    normalizedType === 'colored'
    || normalizedType === 'textured'
    || normalizedType === 'microxeled'
  ) {
    return normalizedType;
  }

  return 'colored';
}

function normalizeVoxelPlaneFace(planeFace = 'front') {
  const normalizedPlaneFace = normalizeText(planeFace, 'front').toLowerCase();
  const supportedPlaneFaces = new Set(['top', 'bottom', 'left', 'right', 'front', 'back']);
  return supportedPlaneFaces.has(normalizedPlaneFace) ? normalizedPlaneFace : 'front';
}

function normalizeVoxelTexture(texture) {
  if (typeof texture === 'string') {
    return normalizeText(texture, '');
  }

  if (!texture || typeof texture !== 'object' || Array.isArray(texture)) {
    return '';
  }

  const normalizedTexture = {};
  const supportedFaces = [
    'all',
    'top',
    'bottom',
    'sides',
    'left',
    'right',
    'front',
    'back',
    'base',
    'background',
    'mask',
    'detail',
  ];

  for (let i = 0; i < supportedFaces.length; i += 1) {
    const faceKey = supportedFaces[i];
    const faceTexture = normalizeText(texture[faceKey], '');
    if (faceTexture) {
      normalizedTexture[faceKey] = faceTexture;
    }
  }

  return Object.keys(normalizedTexture).length > 0 ? normalizedTexture : '';
}

function normalizeVoxelRotation(rotation = null) {
  if (!rotation || typeof rotation !== 'object' || Array.isArray(rotation)) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: normalizeRightAngleDegrees(rotation.x),
    y: normalizeRightAngleDegrees(rotation.y),
    z: normalizeRightAngleDegrees(rotation.z),
  };
}

function normalizeRightAngleDegrees(value = 0) {
  const numericValue = toFiniteNumber(value, 0);
  const snappedValue = Math.round(numericValue / 90) * 90;
  return ((snappedValue % 360) + 360) % 360;
}

function cloneVoxelTexture(texture) {
  if (typeof texture === 'string') {
    return texture;
  }

  if (!texture || typeof texture !== 'object') {
    return '';
  }

  return { ...texture };
}

function serializeVoxelTexture(texture) {
  if (typeof texture === 'string') {
    return texture || null;
  }

  if (!texture || typeof texture !== 'object') {
    return null;
  }

  return { ...texture };
}

function resolveVoxelTextureFaces(texture) {
  const normalizedTexture = normalizeVoxelTexture(texture);

  if (typeof normalizedTexture === 'string') {
    if (!normalizedTexture) {
      return null;
    }

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

  const resolvedFaces = {
    top: normalizedTexture.top ?? allTexture ?? '',
    bottom: normalizedTexture.bottom ?? allTexture ?? '',
    left: normalizedTexture.left ?? sideTexture ?? '',
    right: normalizedTexture.right ?? sideTexture ?? '',
    front: normalizedTexture.front ?? sideTexture ?? '',
    back: normalizedTexture.back ?? sideTexture ?? '',
  };

  return Object.values(resolvedFaces).some(Boolean) ? resolvedFaces : null;
}

function cloneMicroxelGrid(grid) {
  return grid.map(plane =>
    plane.map(row =>
      row.map(cell => cell.clone())
    )
  );
}

function createEmptyMicroxelDataGrid(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        color: DEFAULT_VOXEL_COLOR,
        active: false,
      }))
    )
  );
}

function cloneMicroxelDataGrid(grid, size) {
  if (!Array.isArray(grid)) {
    return createEmptyMicroxelDataGrid(size);
  }

  return Array.from({ length: size }, (_, x) =>
    Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, z) => ({
        color: grid?.[x]?.[y]?.[z]?.color ?? DEFAULT_VOXEL_COLOR,
        active: Boolean(grid?.[x]?.[y]?.[z]?.active ?? grid?.[x]?.[y]?.[z]?.filled),
      }))
    )
  );
}

function normalizeGridSize(size) {
  const numericSize = Math.floor(Number(size));
  return Number.isFinite(numericSize) && numericSize > 0 ? numericSize : 0;
}

function normalizeVoxelTextureInfluence(textureInfluence = 1) {
  const numericInfluence = Number(textureInfluence);
  if (!Number.isFinite(numericInfluence)) {
    return 1;
  }

  return Math.min(1, Math.max(0, numericInfluence));
}



