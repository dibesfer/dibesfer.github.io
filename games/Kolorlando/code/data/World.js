import { Boxel } from './Boxel.js';

export const Boxel10 = new Boxel({
  name: 'Boxel10',
  size: 10,
});

export class World {
  constructor({
    name = 'Default World',
    size = { x: 100, y: 100, z: 100 },
    boxels = null,
  } = {}) {
    // World is the top container layer for placed Boxels in world space.
    this.name = normalizeText(name, '');
    this.size = normalizeWorldSize(size);
    this.boxels = [];

    if (Array.isArray(boxels)) {
      this.setBoxels(boxels);
    }
  }

  setName(name = '') {
    this.name = normalizeText(name, '');
    return this;
  }

  setSize(size = { x: 100, y: 100, z: 100 }) {
    this.size = normalizeWorldSize(size);
    return this;
  }

  get(index) {
    return this.boxels[index] ?? null;
  }

  add(boxel, position = {}) {
    const placedBoxel = normalizePlacedBoxel(boxel, position);
    this.boxels.push(placedBoxel);
    return this;
  }

  set(index, boxel, position = {}) {
    const normalizedIndex = Math.max(0, Math.floor(Number(index) || 0));
    this.boxels[normalizedIndex] = normalizePlacedBoxel(boxel, position);
    return this;
  }

  remove(index) {
    const normalizedIndex = Math.max(0, Math.floor(Number(index) || 0));
    this.boxels.splice(normalizedIndex, 1);
    return this;
  }

  clear() {
    this.boxels = [];
    return this;
  }

  setBoxels(boxelsArray) {
    this.boxels = Array.isArray(boxelsArray)
      ? boxelsArray.map(entry => normalizePlacedBoxel(entry?.boxel ?? entry, entry?.position ?? entry))
      : [];

    return this;
  }

  toJSON() {
    return {
      name: this.name,
      size: {
        x: this.size.x,
        y: this.size.y,
        z: this.size.z,
      },
      boxels: this.boxels.map(entry => ({
        position: {
          x: entry.position.x,
          y: entry.position.y,
          z: entry.position.z,
        },
        boxel: entry.boxel.toJSON(),
      })),
    };
  }

  fromJSON(data = {}) {
    if ('name' in data) {
      this.setName(data.name);
    }

    if ('size' in data) {
      this.setSize(data.size);
    }

    if (Array.isArray(data?.boxels)) {
      this.setBoxels(data.boxels);
    }

    return this;
  }

  clone() {
    return new World({
      name: this.name,
      size: this.size,
      boxels: this.boxels,
    });
  }
}

function normalizePlacedBoxel(boxel, position = {}) {
  const normalizedBoxel = boxel instanceof Boxel
    ? boxel.clone()
    : new Boxel().fromJSON(boxel ?? {});

  return {
    position: {
      x: toFiniteNumber(position?.x, 0),
      y: toFiniteNumber(position?.y, 0),
      z: toFiniteNumber(position?.z, 0),
    },
    boxel: normalizedBoxel,
  };
}

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeWorldSize(size = {}) {
  return {
    x: normalizeWorldAxisSize(size?.x),
    y: normalizeWorldAxisSize(size?.y),
    z: normalizeWorldAxisSize(size?.z),
  };
}

function normalizeWorldAxisSize(value) {
  const numericValue = Math.floor(Number(value));
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 1;
}
