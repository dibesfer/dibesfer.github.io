import { Microxel } from './Microxel.js';
import { VoxelPresets } from './VoxelPresets.js';

export class Voxel {
  constructor({
    x = 0,
    y = 0,
    z = 0,
    rotation = null,
    type = 'colored',
    color = '#ffffff',
    texture = null,
    transparent = false,
    active = true,
    microxelSize = 0,
    microxels = null,
    name = 'Default Voxel',
  } = {}) {
    // Shared Voxel stays compatible with simple cell mode and composed mode.
    this.x = toFiniteNumber(x, 0);
    this.y = toFiniteNumber(y, 0);
    this.z = toFiniteNumber(z, 0);
    this.position = [this.x, this.y, this.z];
    this.rotation = normalizeVoxelRotation(rotation);
    this.type = normalizeVoxelType(type);
    this.color = normalizeText(color, '#ffffff');
    this.texture = normalizeVoxelTexture(texture);
    this.transparent = Boolean(transparent);
    this.active = Boolean(active);
    this.name = normalizeText(name, '');
    this.shape = 'voxel';
    this.microxelSize = normalizeGridSize(microxelSize);
    this.microxels = null;

    if (Array.isArray(microxels)) {
      this.setMicroxels(microxels);
    } else if (this.microxelSize > 0) {
      this.initializeMicroxels(this.microxelSize);
    }
  }

  setPosition(x = 0, y = 0, z = 0) {
    this.x = toFiniteNumber(x, 0);
    this.y = toFiniteNumber(y, 0);
    this.z = toFiniteNumber(z, 0);
    this.position = [this.x, this.y, this.z];
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

  setColor(color = '#ffffff') {
    this.type = 'colored';
    this.color = normalizeText(color, this.color || '#ffffff');
    return this;
  }

  setTexture(texture = '') {
    this.type = 'textured';
    this.texture = normalizeVoxelTexture(texture);
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
      this.microxels = null;
      this.microxelSize = 0;
      return this;
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
      this.microxels = null;
      this.microxelSize = 0;
      return this;
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
            active: sourceCell?.active,
          });
        })
      )
    );

    this.color = '#ffffff';
    this.type = 'microxeled';
    return this;
  }

  clearMicroxels() {
    this.microxels = null;
    this.microxelSize = 0;
    return this;
  }

  getType() {
    return this.type;
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
      x: this.x,
      y: this.y,
      z: this.z,
      rotation: { ...this.rotation },
      // Preserve the declared voxel mode when cloning across systems.
      type: this.type,
      color: this.color,
      texture: cloneVoxelTexture(this.texture),
      transparent: this.transparent,
      active: this.active,
      microxelSize: this.microxelSize,
      microxels: this.microxels ? cloneMicroxelGrid(this.microxels) : null,
      name: this.name,
    });
  }

  toJSON() {
    return {
      name: this.name,
      position: {
        x: this.x,
        y: this.y,
        z: this.z,
      },
      rotation: {
        x: this.rotation.x,
        y: this.rotation.y,
        z: this.rotation.z,
      },
      shape: this.shape,
      type: this.type,
      color: this.color,
      texture: serializeVoxelTexture(this.texture),
      transparent: this.transparent,
      active: this.active,
      microxelSize: this.microxelSize,
      microxels: this.microxels
        ? this.microxels.map(plane =>
          plane.map(row =>
            row.map(cell => ({
              color: cell.color,
              active: cell.active,
            }))
          )
        )
        : null,
    };
  }

  fromJSON(data = {}) {
    if (data?.position) {
      this.setPosition(data.position.x, data.position.y, data.position.z);
    }

    if ('rotation' in data) {
      this.setRotation(data.rotation);
    }

    if ('name' in data) {
      this.setName(data.name);
    }

    if ('active' in data) {
      this.active = Boolean(data.active);
    }

    if (Array.isArray(data?.microxels) && data.microxels.length > 0) {
      this.setMicroxels(data.microxels);
      return this;
    }

    if ('type' in data) {
      this.type = normalizeVoxelType(data.type);
    }

    if (typeof data?.color === 'string' && data.color.trim()) {
      this.color = normalizeText(data.color, this.color || '#ffffff');
    }

    if ('texture' in data) {
      this.texture = normalizeVoxelTexture(data.texture);
    }

    if ('transparent' in data) {
      this.transparent = Boolean(data.transparent);
    }

    if ('texture' in data) {
      return this;
    }

    this.clearMicroxels();
    return this;
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
    fontSize = '1rem',
    textColor = 'black',
    backgroundColor = 'white',
    horizontalAlign = 'center',
    verticalAlign = 'center',
    padding = 0,
    ...planeOptions
  } = {}) {
    super(planeOptions);
    this.text = normalizeText(text, 'Write your message');
    this.fontFamily = normalizeText(fontFamily, 'monospace');
    this.fontSize = normalizeText(fontSize, '1rem');
    this.textColor = normalizeText(textColor, 'black');
    this.backgroundColor = normalizeText(backgroundColor, 'white');
    this.horizontalAlign = normalizeText(horizontalAlign, 'center');
    this.verticalAlign = normalizeText(verticalAlign, 'center');
    this.padding = toFiniteNumber(padding, 0);
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
  const supportedFaces = ['all', 'top', 'bottom', 'sides', 'left', 'right', 'front', 'back'];

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
    x: toFiniteNumber(rotation.x, 0),
    y: toFiniteNumber(rotation.y, 0),
    z: toFiniteNumber(rotation.z, 0),
  };
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
        color: '#ffffff',
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
        color: grid?.[x]?.[y]?.[z]?.color ?? '#ffffff',
        active: Boolean(grid?.[x]?.[y]?.[z]?.active),
      }))
    )
  );
}

function normalizeGridSize(size) {
  const numericSize = Math.floor(Number(size));
  return Number.isFinite(numericSize) && numericSize > 0 ? numericSize : 0;
}
