import Microxel from "../Microxel/Microxel.js";
import {
  isOrientableVoxelName,
  orientationData,
  rotateYawPositionToSource
} from "./Orientation.js";

const VOXEL_FILE_FORMAT = "voxel-editor";
const VOXEL_FILE_VERSION = 1;

export class Voxel {
  constructor(data = {}) {
    const {
      id = "air",
      name = id,
      position = null,
      x = 0,
      y = 0,
      z = 0,
      rotation = null,
      orientation = null,
      orientable = undefined,
      solid = false,
      type = "colored",
      color = "#ffffff",
      texture = null,
      textureInfluence = 1,
      transparent = false,
      active = true,
      microxelSize = 0,
      microxels = null,
      shape = "voxel",
      planeFace = "front",
      doubleSided = false,
      inset = 0,
      contentType = null,
      text = "",
      fontFamily = "monospace",
      fontSize = "3rem",
      textColor = "black",
      backgroundColor = "white",
      horizontalAlign = "center",
      verticalAlign = "center",
      padding = 0
    } = data;

    const sourcePosition = normalizePosition(position, { x, y, z });

    this.id = normalizeText(id, "air");
    this.name = normalizeText(name, this.id);
    this.solid = Boolean(solid);
    this.shape = normalizeText(shape, "voxel");
    this.planeFace = normalizeText(planeFace, "front");
    this.doubleSided = Boolean(doubleSided);
    this.inset = toFiniteNumber(inset, 0);
    this.contentType = contentType ? normalizeText(contentType, "") : null;
    this.text = normalizeText(text, "");
    this.fontFamily = normalizeText(fontFamily, "monospace");
    this.fontSize = normalizeText(fontSize, "3rem");
    this.textColor = normalizeText(textColor, "black");
    this.backgroundColor = normalizeText(backgroundColor, "white");
    this.horizontalAlign = normalizeText(horizontalAlign, "center");
    this.verticalAlign = normalizeText(verticalAlign, "center");
    this.padding = toFiniteNumber(padding, 0);
    this.rotation = normalizeRotation(rotation);
    this.orientable = Boolean(orientable ?? isOrientableVoxelName(this.name));
    this.orientation = orientationData(orientation || this.rotation);
    this.texture = normalizeTexture(texture);
    this.textureInfluence = normalizeTextureInfluence(textureInfluence);
    this.transparent = Boolean(transparent);
    this.active = Boolean(active);
    this.color = normalizeText(color, "#ffffff");
    this.type = normalizeVoxelType(type);
    this.microxelSize = normalizeGridSize(microxelSize);
    this.microxels = null;

    this.setPosition(sourcePosition.x, sourcePosition.y, sourcePosition.z);

    if (Array.isArray(microxels) && microxels.length > 0) {
      this.setMicroxels(microxels);
    } else {
      this.normalizeColoredMicroxelSize();
      this.syncMode();
    }
  }

  static fromJSON(data = {}) {
    return new Voxel(data);
  }

  static fromColor({ id = "", name = "", color = "#ffffff", solid = true, position = { x: 0, y: 0, z: 0 } } = {}) {
    return new Voxel({
      id: id || name || "voxel",
      name: name || id || "voxel",
      type: "colored",
      color,
      solid,
      position
    });
  }

  setPosition(x = 0, y = 0, z = 0) {
    this.x = toFiniteNumber(x, 0);
    this.y = toFiniteNumber(y, 0);
    this.z = toFiniteNumber(z, 0);
    this.position = { x: this.x, y: this.y, z: this.z };
    return this;
  }

  setName(name = "") {
    this.name = normalizeText(name, "");
    return this;
  }

  setRotation(rotation = null) {
    this.rotation = normalizeRotation(rotation);
    this.orientation = orientationData(rotation || this.orientation);
    return this;
  }

  setOrientation(orientation = null) {
    this.orientation = orientationData(orientation || this.orientation);
    this.rotation = {
      ...this.rotation,
      y: this.orientation.yaw * Math.PI / 180
    };
    return this;
  }

  setOrientable(orientable = true) {
    this.orientable = Boolean(orientable);
    return this;
  }

  isOrientable() {
    return Boolean(this.orientable);
  }

  setColor(color = "#ffffff") {
    this.color = normalizeText(color, this.color || "#ffffff");
    this.type = "colored";

    if (this.isSingleMicroxelGrid()) {
      this.microxels[0][0][0].setColor(this.color);
    }

    this.normalizeColoredMicroxelSize();
    this.syncMode();
    return this;
  }

  setTexture(texture = "") {
    this.texture = normalizeTexture(texture);
    this.type = "textured";
    this.syncMode();
    return this;
  }

  setTextureInfluence(textureInfluence = 1) {
    this.textureInfluence = normalizeTextureInfluence(textureInfluence);
    return this;
  }

  setTransparent(transparent = false) {
    this.transparent = Boolean(transparent);
    return this;
  }

  initializeMicroxels(size = 7) {
    const normalizedSize = normalizeGridSize(size);

    if (!normalizedSize) {
      return this.clearMicroxels();
    }

    return this.setMicroxels(createEmptyMicroxelGrid(normalizedSize));
  }

  get(x, y, z) {
    if (this.microxels) {
      const source = this.sourceMicroxelPosition({ x, y, z });

      return this.microxels?.[source.x]?.[source.y]?.[source.z] || null;
    }

    if (this.isColoredLikeSingleMicroxel() && x === 0 && y === 0 && z === 0) {
      return this.virtualMicroxel();
    }

    return null;
  }

  sourceMicroxelPosition(position) {
    if (!this.isOrientable()) return position;

    return rotateYawPositionToSource(position, this.microxelSize, this.orientation);
  }

  set(x, y, z, microxel) {
    if (!(microxel instanceof Microxel)) {
      throw new Error("setMicroxel expects a Microxel instance.");
    }

    if (!this.microxels && this.isColoredLikeSingleMicroxel() && x === 0 && y === 0 && z === 0) {
      this.microxels = [[[this.virtualMicroxel()]]];
      this.microxelSize = 1;
    }

    if (!this.microxels) throw new Error("Voxel has no microxel grid.");
    if (!this.microxels?.[x]?.[y]) throw new Error(`Invalid microxel position ${x},${y},${z}.`);

    microxel.setPosition(x, y, z);
    this.microxels[x][y][z] = microxel;

    if (this.isSingleMicroxelGrid()) {
      this.color = microxel.color;
      this.active = microxel.active;
      this.type = "colored";
    } else {
      this.type = "microxeled";
    }

    this.syncMode();
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

          if (sourceCell instanceof Microxel) return sourceCell.clone().setPosition(x, y, z);

          return new Microxel({
            x,
            y,
            z,
            color: sourceCell?.color,
            active: sourceCell ? sourceCell.active ?? sourceCell.filled : false
          });
        })
      )
    );

    if (size === 1) {
      const cell = this.microxels[0][0][0];

      this.color = normalizeText(cell.color, this.color || "#ffffff");
      this.active = Boolean(cell.active ?? cell.filled ?? this.active);
      this.type = "colored";
    } else {
      this.type = "microxeled";
    }

    this.syncMode();
    return this;
  }

  clearMicroxels() {
    this.microxels = null;
    this.microxelSize = this.type === "colored" ? 1 : 0;
    this.syncMode();
    return this;
  }

  getType() {
    return this.type;
  }

  hasMicroxels() {
    return this.type === "microxeled" && this.microxelSize > 1 && Array.isArray(this.microxels);
  }

  hasStoredMicroxels() {
    return this.microxelSize > 0 && Array.isArray(this.microxels);
  }

  hasSemanticMicroxels() {
    return this.hasStoredMicroxels() || this.isColoredLikeSingleMicroxel();
  }

  isSimpleColored() {
    return this.type === "colored" && !this.hasMicroxels();
  }

  isColoredLikeSingleMicroxel() {
    return this.type === "colored" && this.microxelSize <= 1;
  }

  isSingleMicroxelGrid() {
    return this.microxelSize === 1 && Array.isArray(this.microxels);
  }

  effectiveMicroxelSize() {
    if (this.hasStoredMicroxels()) return this.microxelSize;
    if (this.type === "colored") return 1;
    return 0;
  }

  virtualMicroxel() {
    return new Microxel({
      x: 0,
      y: 0,
      z: 0,
      color: this.color,
      active: this.active
    });
  }

  effectiveMicroxels() {
    if (this.hasStoredMicroxels()) return this.microxels;
    if (this.type === "colored") return [[[this.virtualMicroxel()]]];
    return null;
  }

  toMicroxelVoxel(size = 1) {
    const normalizedSize = normalizeGridSize(size) || 1;
    const voxel = this.clone();

    if (normalizedSize === 1) {
      voxel.microxelSize = 1;
      voxel.microxels = [[[new Microxel({
        x: 0,
        y: 0,
        z: 0,
        color: this.color,
        active: this.active
      })]]];
      voxel.type = "colored";
      voxel.syncMode();
      return voxel;
    }

    voxel.initializeMicroxels(normalizedSize);
    voxel.type = "microxeled";
    voxel.syncMode();
    return voxel;
  }

  destroy() {
    this.active = false;

    if (this.isSingleMicroxelGrid()) {
      this.microxels[0][0][0].destroy();
    }

    return this;
  }

  revive() {
    this.active = true;

    if (this.isSingleMicroxelGrid()) {
      this.microxels[0][0][0].revive();
    }

    return this;
  }

  clone() {
    return new Voxel(this.toJSON());
  }

  toJSON() {
    const serializedMicroxels = this.serializeMicroxels();

    return {
      format: VOXEL_FILE_FORMAT,
      version: VOXEL_FILE_VERSION,
      id: this.id,
      name: this.name,
      position: { ...this.position },
      rotation: { ...this.rotation },
      orientable: this.orientable,
      orientation: { ...this.orientation },
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
      texture: serializeTexture(this.texture),
      textureInfluence: this.textureInfluence,
      transparent: this.transparent,
      active: this.active,
      microxelSize: serializedMicroxels ? serializedMicroxels.length : this.effectiveMicroxelSize(),
      microxels: serializedMicroxels
    };
  }

  serializeMicroxels() {
    const microxels = this.effectiveMicroxels();

    if (!microxels) return null;

    return microxels.map((plane, x) =>
      plane.map((row, y) =>
        row.map((cell, z) => ({
          position: { x, y, z },
          color: cell.color,
          active: cell.active
        }))
      )
    );
  }

  fromJSON(data = {}) {
    const nextVoxel = new Voxel(data);

    Object.assign(this, nextVoxel);
    return this;
  }

  normalizeColoredMicroxelSize() {
    if (this.type === "colored" && this.microxelSize === 0) {
      this.microxelSize = 1;
    }
  }

  syncMode() {
    this.mode = this.hasMicroxels() ? "microxels" : this.type === "textured" ? "texture" : "color";
  }
}

function normalizePosition(position, fallback = { x: 0, y: 0, z: 0 }) {
  if (Array.isArray(position)) {
    return {
      x: toFiniteNumber(position[0], fallback.x),
      y: toFiniteNumber(position[1], fallback.y),
      z: toFiniteNumber(position[2], fallback.z)
    };
  }

  if (position && typeof position === "object") {
    return {
      x: toFiniteNumber(position.x, fallback.x),
      y: toFiniteNumber(position.y, fallback.y),
      z: toFiniteNumber(position.z, fallback.z)
    };
  }

  return {
    x: toFiniteNumber(fallback.x, 0),
    y: toFiniteNumber(fallback.y, 0),
    z: toFiniteNumber(fallback.z, 0)
  };
}

function normalizeRotation(rotation = null) {
  if (!rotation || typeof rotation !== "object" || Array.isArray(rotation)) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: toFiniteNumber(rotation.x, 0),
    y: toFiniteNumber(rotation.y, 0),
    z: toFiniteNumber(rotation.z, 0)
  };
}

function normalizeVoxelType(type = "colored") {
  const normalizedType = normalizeText(type, "colored").toLowerCase();

  return ["colored", "textured", "microxeled"].includes(normalizedType)
    ? normalizedType
    : "colored";
}

function normalizeTexture(texture) {
  if (typeof texture === "string") return normalizeText(texture, "");
  if (!texture || typeof texture !== "object" || Array.isArray(texture)) return "";

  return Object.fromEntries(
    Object.entries(texture)
      .map(([key, value]) => [key, normalizeText(value, "")])
      .filter(([, value]) => value)
  );
}

function serializeTexture(texture) {
  if (typeof texture === "string") return texture || null;
  if (!texture || typeof texture !== "object") return null;

  return { ...texture };
}

function createEmptyMicroxelGrid(size) {
  return Array.from({ length: size }, (_, x) =>
    Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, z) => new Microxel({ x, y, z, active: false }))
    )
  );
}

function normalizeGridSize(size) {
  const numericSize = Math.floor(Number(size));

  return Number.isFinite(numericSize) && numericSize > 0 ? numericSize : 0;
}

function normalizeTextureInfluence(textureInfluence = 1) {
  const numericInfluence = Number(textureInfluence);

  if (!Number.isFinite(numericInfluence)) return 1;

  return Math.min(1, Math.max(0, numericInfluence));
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const trimmedValue = value.trim();

  return trimmedValue || fallback;
}

export default Voxel;

